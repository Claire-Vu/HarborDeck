// harbordeck / hd: the agent side of HarborDeck. One short command per item,
// artifacts by path or URL only, answers read back from a byte offset.
import fs from 'node:fs';
import path from 'node:path';
import { tokenize, parseFlags } from './args.js';
import { Store, SLUG, homeDir, writeAtomic } from './store.js';
import { validate } from './schema.js';
import { SCHEDULER_COMMANDS } from './scheduler-cli.js';
import { TOPIC_COMMANDS, NOTE_FLAGS } from './topics-cli.js';
import { parseArt, isUrl, absPath } from './artifacts.js';

export const VERSION = '1.0.0';
const KINDS = ['decision', 'answer', 'review', 'todo'];
const SNAPSHOTS = ['fleet', 'quota', 'rules'];

const HELP = `harbordeck (hd) ${VERSION}: put agent output on the HarborDeck desk.
Data dir: $HARBORDECK_HOME or ~/.harbordeck

Items (re-running with the same id rewrites it; created and thread are kept):
  hd decision <id> "<title>" --opt key+ --opt key=Label [flags]   + = recommended
  hd answer   <id> "<title>" [flags]       research/report to read and file
  hd review   <id> "<title>" [flags]       work to approve/reject/send back
  hd todo     <id> "<title>" [flags]       something only the user can do
  flags: -s/--sum "<one line>"  -b/--body <path|url>  -a/--art [type:]<path|url> (repeat)
         -a web:<url> opens in the desk's browser pane; -a lavish:<url|file.html> stores a Lavish review page
         -p/--pri 1-4  -d/--due <epoch|ISO|+2d|+12h>  -f/--from <agent>  --project <p>  --stream <s>
         -r/--rule <key> (repeat)  --ok <rule>[:note]  --flag <rule>:<note>  (standing-order checks)
         -t/--topic <slug>  --rel <id>[,<id>]   what it is about; related items (kept on rewrite)
  hd reply <id> "<text>"     append to the item's thread (answers an ask, or a request id)
  hd resolve <id>...         mark resolved
  hd batch                   read commands from stdin, one per line (same syntax, no "hd")

Topics (one subject across items, stamps, replies and notes):
  hd note <id|topic:slug> "<text>" [-a <artifact>]   keep a remark with its item/topic, not just in chat
                             a new topic:slug is created by its first note
  hd topics [--json]         one line per topic: open/items, notes, last activity, related
  hd topic <slug> [--json]   the topic's timeline, oldest first, open items on top

Reading back:
  hd answers [--cursor <name> | --since-offset <n>] [--json] [--peek] [--wait [--timeout <s>]]
                             --wait blocks until a new answer lands (live on-answer loops)
  hd ls [--all]              one line per item

Snapshots and upkeep:
  hd fleet|quota|rules <file|->   validate and install a snapshot
  hd gap "<what didn't fit and why>" [--sample <path|url>] [--item <id>]
  hd validate [--json]       check the whole data dir
  hd path                    print the data dir
  hd mcp                     run a stdio MCP server exposing the same verbs

Limit-reset scheduler (deliver later, through the wake command):
  hd schedule <HH:MM|+30m|ISO|@epoch|reset> "<msg>" [--item <id>] [--request [--to <agent>]]
                             reset = after the usage limit resets; --request also writes
                             the request line to answers.jsonl at delivery
  hd schedule list [--json] | cancel <id|item id>
  hd limit record            Claude Code StopFailure hook (hook JSON on stdin; never fails)
  hd limit snapshot          statusline tee (statusline JSON on stdin)
  hd limit set --reset <time> [--window <name>]   any agent: record a known reset
  hd tick                    deliver due items (run every 60s; see scheduler install)
  hd scheduler status [--json] | on | off
  hd scheduler config [--wake-command <cmd>] [--margin <s>] [--max-attempts <n>] [--keep-awake on|off]
  hd scheduler install [--no-load] [--interval <s>] | uninstall [--no-load]
`;

class UsageError extends Error {}
const fail = (msg) => { throw new UsageError(msg); };
const now = () => Math.floor(Date.now() / 1000);

function checkId(id, what = 'id') {
  if (!id) fail(`missing ${what}`);
  if (!SLUG.test(id)) fail(`bad ${what} "${id}" (letters, digits, . _ -; max 128)`);
  return id;
}

function parseDue(v) {
  if (/^\d+$/.test(v)) return Number(v);
  const rel = /^\+(\d+(?:\.\d+)?)([mhdw])$/.exec(v);
  if (rel) return now() + Math.round(Number(rel[1]) * { m: 60, h: 3600, d: 86400, w: 604800 }[rel[2]]);
  const t = Date.parse(v);
  if (Number.isNaN(t)) fail(`bad --due "${v}"`);
  return Math.floor(t / 1000);
}

function labelFromKey(key) {
  const s = key.replace(/[-_.]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseOpt(v) {
  // "+" marks the recommended option ("*" also works where the shell won't glob it).
  const m = /^([^=*+]+)([*+])?(?:=(.+))?$/s.exec(v);
  if (!m) fail(`bad --opt "${v}" (key, key+, key=Label or key+=Label)`);
  const key = checkId(m[1].trim(), 'option key');
  const o = { key, label: (m[3] || '').trim() || labelFromKey(key) };
  if (m[2]) o.recommended = true;
  return o;
}

function parseCheck(v, ok) {
  const i = v.indexOf(':');
  const rule = checkId(i < 0 ? v : v.slice(0, i), 'rule key');
  const note = i < 0 ? '' : v.slice(i + 1).trim();
  if (!ok && !note) fail(`--flag ${rule} needs a note (--flag ${rule}:<why>)`);
  return note ? { rule, ok, note } : { rule, ok };
}

function findProject(cwd) {
  for (let d = cwd; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return path.basename(d);
    if (path.dirname(d) === d) return path.basename(cwd);
  }
}

const ITEM_FLAGS = {
  sum: { alias: 's' }, body: { alias: 'b' }, opt: { alias: 'o', multi: true }, art: { alias: 'a', multi: true },
  pri: { alias: 'p' }, due: { alias: 'd' }, from: { alias: 'f' }, project: {}, stream: {},
  rule: { alias: 'r', multi: true }, ok: { multi: true }, flag: { multi: true },
  topic: { alias: 't' }, rel: { multi: true },
};

function buildItem(kind, argv, ctx) {
  const { pos, flags } = parseFlags(argv, ITEM_FLAGS);
  const [id, title, ...extra] = pos;
  checkId(id);
  if (!title) fail(`${kind} ${id}: missing "<title>"`);
  if (extra.length) fail(`${kind} ${id}: unexpected "${extra[0]}" (quote the title; flags start with --)`);
  const item = { id, kind, title };
  item.project = flags.project || ctx.env.HARBORDECK_PROJECT || findProject(ctx.cwd);
  if (flags.stream) item.stream = flags.stream;
  if (flags.topic) item.topic = checkId(flags.topic, 'topic');
  if (flags.rel) item.rel = [...new Set(flags.rel.flatMap((v) => v.split(',')).map((r) => checkId(r.trim(), 'rel id')))];
  if (flags.sum) item.summary = flags.sum;
  if (flags.body) {
    if (isUrl(flags.body)) item.body = flags.body;
    else {
      item.body = absPath(flags.body, ctx.cwd);
      if (!fs.existsSync(item.body)) ctx.warn(`warning: body not found: ${item.body}`);
    }
  }
  if (flags.opt) {
    if (kind !== 'decision') fail(`${kind} ${id}: --opt is for decisions only`);
    item.options = flags.opt.map(parseOpt);
    const keys = item.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) fail(`decision ${id}: duplicate option key`);
  } else if (kind === 'decision') fail(`decision ${id}: needs at least one --opt`);
  if (flags.art) item.artifacts = flags.art.map((a) => parseArt(a, ctx));
  const checks = [...(flags.ok || []).map((v) => parseCheck(v, true)), ...(flags.flag || []).map((v) => parseCheck(v, false))];
  const rules = [...(flags.rule || []).map((r) => checkId(r, 'rule key')), ...checks.map((c) => c.rule)];
  if (rules.length) item.rules = [...new Set(rules)];
  if (checks.length) item.checks = checks;
  if (flags.pri !== undefined) {
    if (!/^[1-4]$/.test(flags.pri)) fail(`${kind} ${id}: --pri must be 1 (critical) .. 4 (low)`);
    item.priority = Number(flags.pri);
  }
  if (flags.due !== undefined) item.due = parseDue(flags.due);
  const from = flags.from || ctx.env.HARBORDECK_FROM;
  if (from) item.from = from;
  return item;
}

function saveItem(item, ctx) {
  const prev = ctx.store.readItem(item.id);
  const t = now();
  item.created = prev?.created ?? t;
  if (prev?.thread) item.thread = prev.thread;
  for (const k of ['topic', 'rel']) if (item[k] === undefined && prev?.[k] !== undefined) item[k] = prev[k];
  if (prev) item.updated = t;
  item.status = 'open';
  const errs = validate('item', item);
  if (errs.length) fail(`${item.id}: ${errs.join('; ')}`);
  ctx.store.writeItem(item);
  ctx.out(`ok ${item.kind} ${item.id}`);
}

function findRequest(store, id) {
  let hit = null;
  for (const { raw } of store.readAnswers(0).lines) {
    try { const a = JSON.parse(raw); if (a.id === id && a.action === 'request') hit = a; } catch { /* skip bad line */ }
  }
  return hit;
}

const REPLY_FLAGS = { from: { alias: 'f' } };
function cmdReply(argv, ctx) {
  const { pos, flags } = parseFlags(argv, REPLY_FLAGS);
  const [id, text, ...extra] = pos;
  checkId(id);
  if (!text) fail(`reply ${id}: missing "<text>"`);
  if (extra.length) fail(`reply ${id}: unexpected "${extra[0]}" (quote the text)`);
  const t = now();
  const entry = { from: flags.from || ctx.env.HARBORDECK_FROM || 'agent', text, at: t };
  let item = ctx.store.readItem(id);
  if (!item) {
    // A reply to a request the user handed over becomes an item with the request's id.
    const req = findRequest(ctx.store, id);
    if (!req) fail(`reply ${id}: no such item or request`);
    const title = req.note.length > 120 ? `${req.note.slice(0, 117)}...` : req.note;
    item = { id, kind: 'answer', title, project: ctx.env.HARBORDECK_PROJECT || findProject(ctx.cwd), created: t, status: 'open' };
    if (req.to) item.from = req.to;
  }
  item.thread = [...(item.thread || []), entry];
  item.updated = t;
  item.status = 'open';
  const errs = validate('item', item);
  if (errs.length) fail(`${id}: ${errs.join('; ')}`);
  ctx.store.writeItem(item);
  ctx.out(`ok reply ${id}`);
}

function cmdResolve(argv, ctx) {
  const { pos } = parseFlags(argv, {});
  if (!pos.length) fail('resolve: missing <id>');
  for (const id of pos) {
    checkId(id);
    const item = ctx.store.readItem(id);
    if (!item) fail(`resolve ${id}: no such item`);
    item.status = 'resolved';
    item.updated = now();
    ctx.store.writeItem(item);
    ctx.out(`ok resolve ${id}`);
  }
}

const GAP_FLAGS = { sample: {}, item: {}, from: { alias: 'f' } };
function cmdGap(argv, ctx) {
  const { pos, flags } = parseFlags(argv, GAP_FLAGS);
  const [text, ...extra] = pos;
  if (!text) fail('gap: missing "<what didn\'t fit and why>"');
  if (extra.length) fail(`gap: unexpected "${extra[0]}" (quote the text)`);
  const gap = { text };
  if (flags.sample) {
    gap.sample = isUrl(flags.sample) ? flags.sample : absPath(flags.sample, ctx.cwd);
    if (!isUrl(gap.sample) && !fs.existsSync(gap.sample)) ctx.warn(`warning: sample not found: ${gap.sample}`);
  }
  if (flags.item) gap.item = checkId(flags.item, 'item id');
  const from = flags.from || ctx.env.HARBORDECK_FROM;
  if (from) gap.from = from;
  gap.at = now();
  const errs = validate('gap', gap);
  if (errs.length) fail(`gap: ${errs.join('; ')}`);
  ctx.store.appendLine(ctx.store.gaps, gap);
  ctx.out('ok gap');
}

// Resolves once answers.jsonl has a complete line past `off`, or after `timeout` seconds (0 = never).
// Watches the data dir (the file may not exist yet) with a short poll as a fallback.
function waitForAnswers(store, off, timeout) {
  fs.mkdirSync(store.home, { recursive: true });
  return new Promise((resolve) => {
    let watcher = null;
    const done = () => {
      clearInterval(poll); clearTimeout(timer); watcher?.close(); resolve();
    };
    const check = () => { if (store.readAnswers(off).lines.length) done(); };
    const poll = setInterval(check, 1000);
    const timer = timeout > 0 ? setTimeout(done, timeout * 1000) : null;
    try { watcher = fs.watch(store.home, check); } catch { /* poll only */ }
    check();
  });
}

async function cmdAnswers(argv, ctx) {
  const { pos, flags } = parseFlags(argv, {
    cursor: { alias: 'c' }, 'since-offset': {}, json: { bool: true }, peek: { bool: true }, wait: { bool: true }, timeout: {},
  });
  if (pos.length) fail(`answers: unexpected "${pos[0]}"`);
  if (flags.cursor && flags['since-offset'] !== undefined) fail('answers: use --cursor or --since-offset, not both');
  if (flags.cursor) checkId(flags.cursor, 'cursor name');
  let off = 0;
  if (flags.cursor) off = ctx.store.readCursor(flags.cursor);
  else if (flags['since-offset'] !== undefined) {
    if (!/^\d+$/.test(flags['since-offset'])) fail('answers: --since-offset must be a byte count');
    off = Number(flags['since-offset']);
  }
  if (flags.timeout !== undefined && !/^\d+$/.test(flags.timeout)) fail('answers: --timeout must be seconds');
  if (flags.wait) await waitForAnswers(ctx.store, off, Number(flags.timeout || 0));
  const { lines, next, reset } = ctx.store.readAnswers(off);
  if (reset) ctx.warn('warning: answers.jsonl is shorter than the offset; reading from the start');
  if (flags.json) {
    const parsed = lines.map(({ end, raw }) => {
      try { return { end, answer: JSON.parse(raw) }; } catch { return { end, raw, error: 'not JSON' }; }
    });
    ctx.out(JSON.stringify({ next, lines: parsed }));
  } else {
    for (const { raw } of lines) ctx.out(raw);
    if (!flags.cursor) ctx.out(`next=${next}`);
  }
  if (flags.cursor && !flags.peek && next !== off) ctx.store.writeCursor(flags.cursor, next);
}

function readInput(src, ctx) {
  if (!src) fail('missing <file|->');
  if (src === '-') {
    const text = ctx.readStdin();
    if (text === null) fail('no stdin (pipe the JSON in)');
    return text;
  }
  return fs.readFileSync(absPath(src, ctx.cwd), 'utf8');
}

function cmdSnapshot(name, argv, ctx) {
  const { pos } = parseFlags(argv, {});
  let data;
  try { data = JSON.parse(readInput(pos[0], ctx)); } catch (e) {
    if (e instanceof UsageError) throw e;
    fail(`${name}: ${e.code === 'ENOENT' ? 'file not found' : `not JSON (${e.message})`}`);
  }
  const errs = validate(name, data);
  if (errs.length) fail(`${name}: ${errs.join('; ')}`);
  writeAtomic(ctx.store.snapshot(name), JSON.stringify(data, null, 1) + '\n');
  ctx.out(`ok ${name}`);
}

function cmdLs(argv, ctx) {
  const { flags } = parseFlags(argv, { all: { bool: true } });
  for (const name of ctx.store.listItems()) {
    let it;
    try { it = JSON.parse(fs.readFileSync(path.join(ctx.store.items, name), 'utf8')); } catch { ctx.out(`${name} (unreadable)`); continue; }
    if (it.status === 'resolved' && !flags.all) continue;
    const reply = it.thread?.length ? ` +${it.thread.length}` : '';
    ctx.out(`${it.id} ${it.kind} p${it.priority ?? 3} ${it.status}${reply}${it.topic ? ` #${it.topic}` : ''} ${it.title}`);
  }
}

function validateJsonl(file, schema, errors) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return 0; throw e; }
  let n = 0;
  const rows = text.split('\n');
  rows.pop(); // empty after the final newline, or a partial line still being written
  rows.forEach((raw, i) => {
    if (!raw.trim()) return;
    n++;
    let v;
    try { v = JSON.parse(raw); } catch { errors.push(`${path.basename(file)}:${i + 1}: not JSON`); return; }
    for (const e of validate(schema, v)) errors.push(`${path.basename(file)}:${i + 1}: ${e}`);
  });
  return n;
}

function cmdValidate(argv, ctx) {
  const { flags } = parseFlags(argv, { json: { bool: true } });
  const { store } = ctx;
  const errors = [];
  const warnings = [];
  let rules = null;
  const counts = {};
  for (const name of SNAPSHOTS) {
    const file = store.snapshot(name);
    if (!fs.existsSync(file)) continue;
    let v;
    try { v = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { errors.push(`${name}.json: not JSON`); continue; }
    for (const e of validate(name, v)) errors.push(`${name}.json: ${e}`);
    if (name === 'rules') rules = v;
    counts[name] = 1;
  }
  const ids = new Set();
  const rels = [];
  counts.items = 0;
  for (const name of store.listItems()) {
    counts.items++;
    let it;
    try { it = JSON.parse(fs.readFileSync(path.join(store.items, name), 'utf8')); } catch { errors.push(`items/${name}: not JSON`); continue; }
    for (const e of validate('item', it)) errors.push(`items/${name}: ${e}`);
    if (it.id && `${it.id}.json` !== name) errors.push(`items/${name}: id "${it.id}" does not match file name`);
    ids.add(it.id);
    for (const r of it.rel || []) rels.push([name, r]);
    if (rules) {
      for (const k of new Set([...(it.rules || []), ...(it.checks || []).map((c) => c.rule)])) {
        if (!(k in rules)) warnings.push(`items/${name}: rule "${k}" not in rules.json`);
      }
    }
  }
  for (const [name, r] of rels) if (!ids.has(r)) warnings.push(`items/${name}: rel "${r}" is not an item`);
  counts.answers = validateJsonl(store.answers, 'answer', errors);
  counts.gaps = validateJsonl(store.gaps, 'gap', errors);
  counts.notes = validateJsonl(store.notes, 'note', errors);
  if (flags.json) ctx.out(JSON.stringify({ ok: errors.length === 0, counts, errors, warnings }));
  else {
    for (const e of errors) ctx.out(`error ${e}`);
    for (const w of warnings) ctx.out(`warn ${w}`);
    const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
    ctx.out(`${errors.length ? 'invalid' : 'ok'}: ${summary}`);
  }
  return errors.length ? 1 : 0;
}

const BATCH_FLAGS = { reply: REPLY_FLAGS, resolve: {}, gap: GAP_FLAGS, note: NOTE_FLAGS };
const BATCH_VERBS = new Set([...KINDS, ...Object.keys(BATCH_FLAGS)]);

function cmdBatch(argv, ctx) {
  parseFlags(argv, {});
  const text = ctx.readStdin();
  if (text === null) fail('batch: no stdin (pipe the lines in)');
  // Parse and validate every line first so a typo writes nothing.
  const ops = [];
  const errors = [];
  text.split('\n').forEach((line, i) => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    try {
      let argv2 = tokenize(s);
      if (argv2[0] === 'hd' || argv2[0] === 'harbordeck') argv2 = argv2.slice(1);
      const [verb, ...rest] = argv2;
      if (!BATCH_VERBS.has(verb)) fail(`unknown verb "${verb}" (use ${[...BATCH_VERBS].join('|')})`);
      if (KINDS.includes(verb)) {
        const item = buildItem(verb, rest, ctx);
        ops.push(() => saveItem(item, ctx));
      } else {
        parseFlags(rest, BATCH_FLAGS[verb]);
        ops.push(() => COMMANDS[verb](rest, ctx));
      }
    } catch (e) {
      errors.push(`line ${i + 1}: ${e.message}`);
    }
  });
  if (errors.length) fail(`batch rejected, nothing written:\n${errors.join('\n')}`);
  if (!ops.length) fail('batch: no commands on stdin');
  for (const op of ops) op();
}

async function cmdMcp(argv, ctx) {
  parseFlags(argv, {});
  const { serveMcp } = await import('./mcp.js');
  await serveMcp(ctx);
}

const COMMANDS = {
  reply: cmdReply, resolve: cmdResolve, gap: cmdGap, answers: cmdAnswers, ls: cmdLs,
  validate: cmdValidate, batch: cmdBatch, '-': cmdBatch, mcp: cmdMcp,
  ...SCHEDULER_COMMANDS, ...TOPIC_COMMANDS,
  path: (argv, ctx) => { parseFlags(argv, {}); ctx.out(ctx.store.home); },
};
for (const k of KINDS) COMMANDS[k] = (argv, ctx) => saveItem(buildItem(k, argv, ctx), ctx);
for (const k of SNAPSHOTS) COMMANDS[k] = (argv, ctx) => cmdSnapshot(k, argv, ctx);

// io: { out(line), err(line), readStdin(): string|null, cwd, env }. Returns an exit code.
export async function run(argv, io) {
  const env = io.env || process.env;
  const ctx = {
    out: io.out, warn: io.err, readStdin: io.readStdin || (() => null), cwd: io.cwd || process.cwd(), env,
    store: new Store(homeDir(env)),
  };
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { io.out(HELP.trimEnd()); return cmd ? 0 : 2; }
  if (cmd === '--version' || cmd === '-v') { io.out(VERSION); return 0; }
  const fn = COMMANDS[cmd];
  if (!fn) { io.err(`hd: unknown command "${cmd}" (hd help)`); return 2; }
  try {
    return (await fn(rest, ctx)) || 0;
  } catch (e) {
    io.err(`hd: ${e.message}`);
    return 1;
  }
}
