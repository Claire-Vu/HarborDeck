#!/usr/bin/env node
// Live agent round trip, timed per leg, all on scratch dirs:
//   a real agent session (`claude -p`) posts a decision with the harbordeck CLI -> the headless app shows it ->
//   a stamp in the app (Playwright, the same driver as ui.mjs) -> answers.jsonl -> hd-bridge.sh --follow (live)
//   -> a stub firstmate home records the keyed answer -> the agent, blocked on `fm-wait`, gets it and replies.
// The firstmate home is a stub (bin/fm-captain-hold.sh, fm-inbox.sh write ms-stamped lines to received.log);
// the data dir and app come from `hdv launch` under its own state dir. Nothing touches ~/.harbordeck or a real home.
//
// Usage: node test/live/agent-roundtrip.mjs [--model <claude model>] [--keep]
// Env: AGENT_CMD (default: claude), HDV_STATE (default: a temp dir). Exit 0 when every leg completed.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(`${root}/package.json`)('playwright-core');
const args = process.argv.slice(2);
const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'haiku';
const keep = args.includes('--keep');
const hdv = path.join(root, '.agents/skills/verify-harbordeck/scripts/hdv');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-roundtrip-'));
const state = process.env.HDV_STATE || path.join(tmp, 'hdv');
const env = { ...process.env, HDV_STATE: state };
const id = `rt-${Date.now().toString(36)}`;
const title = `Merge PR 7 (round trip ${id})?`;
const t = {};
const procs = [];
const log = (m) => console.log(`${new Date().toISOString().slice(11, 23)} ${m}`);

function cleanup() {
  for (const p of procs) try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ }
  if (!keep) {
    try { execFileSync(hdv, ['cleanup'], { env, stdio: 'ignore' }); } catch { /* not launched */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// Resolves with Date.now() when check() first returns truthy; fs.watch on dir plus a 50 ms poll fallback.
function when(dir, check, timeoutMs, what) {
  return new Promise((resolve, reject) => {
    const done = (v) => { clearInterval(poll); clearTimeout(timer); w?.close(); v instanceof Error ? reject(v) : resolve(v); };
    const test = () => { try { if (check()) done(Date.now()); } catch { /* not there yet */ } };
    const poll = setInterval(test, 50);
    const timer = setTimeout(() => done(new Error(`timed out waiting for ${what}`)), timeoutMs);
    let w; try { w = fs.watch(dir, test); } catch { /* poll only */ }
    test();
  });
}

const script = (file, body) => { fs.writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`); fs.chmodSync(file, 0o755); };
const ms = `perl -MTime::HiRes=time -e 'printf "%d", time*1000'`;

try {
  // 1. headless app on a seeded synthetic data dir
  const ready = execFileSync(hdv, ['launch'], { env, encoding: 'utf8' });
  const port = /cdp=http:\/\/127\.0\.0\.1:(\d+)/.exec(ready)[1];
  const home = /home=(\S+)/.exec(ready)[1];
  log(`app up (headless) cdp :${port}, data dir ${home}`);

  // 2. stub firstmate home: every hold answer / inbox note is what the agent "receives"
  const fm = path.join(tmp, 'fm');
  fs.mkdirSync(path.join(fm, 'bin'), { recursive: true });
  const recv = path.join(fm, 'received.log');
  fs.writeFileSync(recv, '');
  script(path.join(fm, 'bin/fm-captain-hold.sh'), `[ "$1" = open ] && { case $2 in rt-*) exit 0 ;; *) exit 1 ;; esac; }
in=$(cat); printf '%s\\thold\\t%s\\n' "$(${ms})" "$in" >> "${recv}"; echo "closed: \${in%%$'\\t'*}"`);
  script(path.join(fm, 'bin/fm-inbox.sh'), `printf '%s\\tinbox\\t%s\\n' "$(${ms})" "$*" >> "${recv}"`);
  script(path.join(fm, 'bin/fm-crew-state.sh'), 'echo "state: unknown"');
  // what the agent runs to wait for the captain: blocks until firstmate received an answer for the item
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.symlinkSync(path.join(root, 'cli/bin/harbordeck.js'), path.join(bin, 'harbordeck'));
  script(path.join(bin, 'fm-wait'), `for _ in $(seq 1 6000); do
  l=$(grep -F "$1" "${recv}" | head -1)
  [ -n "$l" ] && { IFS=$'\\t' read -r _ via a b c _ <<<"$l"
    if [ "$via" = hold ]; then echo "The captain chose: $b ($c) on $a"; else echo "Note from the captain: $a"; fi; exit 0; }
  sleep 0.1
done; echo "no answer" >&2; exit 1`);

  // 3. the live bridge, cursor at the end of the seeded answers
  fs.mkdirSync(path.join(home, 'cursors'), { recursive: true });
  fs.writeFileSync(path.join(home, 'cursors/firstmate-bridge'), String(fs.statSync(path.join(home, 'answers.jsonl')).size));
  const bridgeLog = fs.openSync(path.join(tmp, 'bridge.log'), 'a');
  const benv = { ...env, FM_HOME: fm, HARBORDECK_HOME: home, HD: path.join(root, 'cli/bin/harbordeck.js'), HD_BRIDGE_MODE: 'live' };
  procs.push(spawn(path.join(root, 'adapters/firstmate/hd-bridge.sh'), ['--follow'], { env: benv, stdio: ['ignore', bridgeLog, bridgeLog], detached: true }));

  // 4. the desk
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().endsWith('/renderer/index.html'));
  await page.getByRole('button', { name: 'Open the office' }).click();

  // 5. the agent
  const prompt = [
    'You are an agent that reports to a captain through Harbor Deck. Use the Bash tool for each step, exactly:',
    `1. Run: harbordeck decision ${id} "${title}" -s "Live round-trip check." --opt merge+ --opt hold`,
    `2. Run: fm-wait ${id}   (it blocks until the captain's answer reaches you and prints it; use a 600000 ms Bash timeout)`,
    `3. Act on it: run harbordeck reply ${id} "Acting on <the key the captain chose>" with the real key filled in.`,
    'Do nothing else, then stop.'
  ].join('\n');
  const aenv = { ...env, HARBORDECK_HOME: home, HARBORDECK_FROM: 'mate-main', PATH: `${bin}:${process.env.PATH}` };
  delete aenv.CLAUDECODE;
  const agentOut = fs.openSync(path.join(tmp, 'agent.log'), 'a');
  t.agentStart = Date.now();
  const agent = spawn(process.env.AGENT_CMD || 'claude', ['-p', prompt, '--model', model, '--dangerously-skip-permissions'],
    { env: aenv, cwd: tmp, stdio: ['ignore', agentOut, agentOut], detached: true });
  procs.push(agent);
  const agentExit = new Promise((r) => agent.on('exit', r));
  log(`agent started (claude -p --model ${model})`);

  const itemFile = path.join(home, 'items', `${id}.json`);
  t.item = await when(path.join(home, 'items'), () => fs.existsSync(itemFile), 180000, 'the agent to post the item');
  log('agent posted the item');
  const row = page.locator('#queue li', { hasText: id });
  await row.waitFor({ timeout: 30000 });
  t.desk = Date.now();
  log('item on the desk');

  // 6. the stamp: select it, press 1 (approve = the recommended option); the line lands after the undo hold
  await row.click();
  await page.locator('#desk-surface .paper.manifest h3', { hasText: id }).waitFor();
  t.stamp = Date.now();
  await page.keyboard.press('1');
  const answers = path.join(home, 'answers.jsonl');
  t.line = await when(home, () => fs.readFileSync(answers, 'utf8').includes(`"id":"${id}"`), 30000, 'the answer line');
  log('answer line written');
  t.recv = await when(fm, () => fs.readFileSync(recv, 'utf8').includes(id), 30000, 'firstmate to receive it');
  t.recvExact = Number(fs.readFileSync(recv, 'utf8').split('\n').find((l) => l.includes(id)).split('\t')[0]);
  log(`firstmate received: ${fs.readFileSync(recv, 'utf8').trim().split('\n').find((l) => l.includes(id)).split('\t').slice(1).join(' | ')}`);
  t.reply = await when(path.join(home, 'items'), () => (JSON.parse(fs.readFileSync(itemFile, 'utf8')).thread || []).length > 0, 180000, 'the agent to act');
  const reply = JSON.parse(fs.readFileSync(itemFile, 'utf8')).thread.at(-1).text;
  log(`agent acted: reply "${reply}"`);
  await Promise.race([agentExit, new Promise((r) => setTimeout(r, 30000))]);
  await browser.close();

  const legs = [
    ['agent start -> item posted (agent think + CLI)', t.item - t.agentStart],
    ['item posted -> on the desk', t.desk - t.item],
    ['stamp -> answer line (undo hold, by design)', t.line - t.stamp],
    ['answer line -> firstmate received (bridge)', t.recvExact - t.line],
    ['firstmate received -> agent acted (wait + agent think)', t.reply - t.recvExact],
    ['stamp -> firstmate received', t.recvExact - t.stamp]
  ];
  console.log('\nleg\tms');
  for (const [k, v] of legs) console.log(`${k}\t${v}`);
  const ok = /merge/i.test(reply);
  console.log(`\n${ok ? 'PASS' : 'FAIL'}: agent ${ok ? 'acted on' : 'did not act on'} the stamped key (reply "${reply}")`);
  const out = path.join(os.homedir(), '.local/share/verify-harbordeck', `roundtrip-${id}`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'legs.json'), JSON.stringify({ id, model, legs: Object.fromEntries(legs), reply }, null, 2));
  for (const f of ['bridge.log', 'agent.log']) fs.copyFileSync(path.join(tmp, f), path.join(out, f));
  fs.copyFileSync(recv, path.join(out, 'received.log'));
  console.log(`evidence: ${out}`);
  cleanup();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  for (const f of ['bridge.log', 'agent.log']) { try { console.error(`--- ${f}\n${fs.readFileSync(path.join(tmp, f), 'utf8').slice(-2000)}`); } catch { /* none */ } }
  cleanup();
  process.exit(1);
}
