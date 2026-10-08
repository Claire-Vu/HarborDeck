'use strict';
// Data directory: items/*.json, optional fleet.json / quota.json / rules.json, append-only answers.jsonl, gaps.jsonl, notes.jsonl.
// Pure Node (no Electron) so it is unit-testable.
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.log', '.json', '.csv', '.yaml', '.yml']);
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogg': 'video/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8', '.markdown': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8'
};
const MAX_TEXT = 512 * 1024;

const expandHome = p => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
const defaultHome = () => path.join(os.homedir(), '.harbordeck');
const mimeFor = p => MIME[path.extname(p).toLowerCase()] || null;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

function ensureHome(home) {
  fs.mkdirSync(path.join(home, 'items'), { recursive: true });
  return home;
}

// An item is usable when it has an id, a title and a kind; anything else is reported, not rendered.
function loadItems(home) {
  const dir = path.join(home, 'items'); const items = [], errors = [];
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json') && !n.startsWith('.')).sort(); } catch (e) { return { items, errors }; }
  for (const name of names) {
    const file = path.join(dir, name);
    let it;
    try { it = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push({ file: name, error: 'invalid JSON' }); continue; }
    const list = Array.isArray(it) ? it : [it];
    for (const x of list) {
      if (!x || typeof x !== 'object' || !x.id || !x.title) { errors.push({ file: name, error: 'missing id or title' }); continue; }
      let mtime = 0; try { mtime = Math.floor(fs.statSync(file).mtimeMs / 1000); } catch (e) { /* raced */ }
      items.push(normalize(x, mtime));
    }
  }
  return { items, errors };
}

function normalize(x, mtime) {
  const it = Object.assign({}, x);
  it.kind = ['decision', 'answer', 'review', 'todo'].includes(it.kind) ? it.kind : 'answer';
  if (x.kind && x.kind !== it.kind) it.kind_raw = x.kind;
  it.status = it.status === 'resolved' ? 'resolved' : 'open';
  it.project = it.project || 'general';
  it.summary = it.summary || '';
  it.created = +it.created || mtime || Math.floor(Date.now() / 1000);
  it.artifacts = Array.isArray(it.artifacts) ? it.artifacts.filter(a => a && (a.path || a.url)) : [];
  it.thread = Array.isArray(it.thread) ? it.thread : [];
  it._mtime = mtime;
  return it;
}

// JSONL readers consume complete lines only; a trailing partial line is still being written.
function readJsonl(file) {
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  raw = raw.slice(0, raw.lastIndexOf('\n') + 1);
  const out = [];
  for (const ln of raw.split('\n')) { if (!ln.trim()) continue; try { out.push(JSON.parse(ln)); } catch (e) { /* skip a bad line */ } }
  return out;
}
const readAnswers = home => readJsonl(path.join(home, 'answers.jsonl'));

const ACTIONS = new Set(['decide', 'approve', 'reject', 'needs-work', 'comment', 'ask', 'file', 'request']);
// Validates and appends one answer line; returns the exact line written (without newline).
function appendAnswer(home, line) {
  if (!line || typeof line !== 'object' || !line.id || !ACTIONS.has(line.action)) throw new Error('invalid answer line');
  const out = { id: String(line.id), action: line.action };
  if (line.key != null) out.key = String(line.key);
  out.note = line.note == null ? '' : String(line.note);
  if (line.anchor && typeof line.anchor === 'object') out.anchor = line.anchor;
  if (line.to != null) out.to = String(line.to);
  out.at = Number.isFinite(+line.at) && +line.at > 0 ? Math.floor(+line.at) : Math.floor(Date.now() / 1000);
  const text = JSON.stringify(out);
  ensureHome(home);
  fs.appendFileSync(path.join(home, 'answers.jsonl'), text + '\n');
  return text;
}

// Artifact/body path resolution (docs/CONTRACT.md): URLs stay URLs; absolute paths as-is; relative ones against the
// data directory, then the optional artifactRoot setting.
function resolvePath(p, { home, artifactRoot }) {
  if (!p || /^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return null;
  const q = expandHome(p);
  if (path.isAbsolute(q)) return path.normalize(q);
  const roots = [home, artifactRoot && expandHome(artifactRoot)].filter(Boolean);
  for (const r of roots) { const abs = path.resolve(r, q); if (fs.existsSync(abs)) return abs; }
  return path.resolve(roots[0], q);
}

// One entry per referenced path: {abs, url, mime, exists, text?}. url uses the harbor:// protocol.
function resolveFiles(items, opts, notes = []) {
  const files = {};
  const add = p => {
    if (!p || files[p] !== undefined) return;
    const abs = resolvePath(p, opts);
    if (!abs) { files[p] = null; return; }
    let exists = false, size = 0;
    try { const s = fs.statSync(abs); exists = s.isFile(); size = s.size; } catch (e) { /* missing */ }
    const ext = path.extname(abs).toLowerCase();
    const f = { abs, exists, mime: mimeFor(abs), url: exists ? fileUrl(abs) : null };
    if (exists && TEXT_EXT.has(ext)) { try { f.text = readHead(abs, Math.min(size, MAX_TEXT)); f.truncated = size > MAX_TEXT; } catch (e) { /* unreadable */ } }
    files[p] = f;
  };
  for (const it of items) { add(it.body); for (const a of it.artifacts || []) add(a.path); }
  for (const n of notes) add(n.artifact?.path);
  return files;
}
function readHead(file, n) { const fd = fs.openSync(file, 'r'); try { const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, 0); return b.toString('utf8'); } finally { fs.closeSync(fd); } }
const fileUrl = abs => 'harbor://file/' + encodeURIComponent(abs);
const pathFromUrl = url => { const m = String(url).match(/^harbor:\/\/file\/(.+)$/); return m ? decodeURIComponent(m[1].split(/[?#]/)[0]) : null; };

function snapshot(home, opts = {}) {
  const { items, errors } = loadItems(home);
  const ro = { home, artifactRoot: opts.artifactRoot };
  const notes = readJsonl(path.join(home, 'notes.jsonl')).filter(n => n && n.text && (n.item || n.topic));
  return {
    home,
    items,
    errors,
    rules: readJson(path.join(home, 'rules.json'), {}),
    fleet: readJson(path.join(home, 'fleet.json'), null),
    quota: readJson(path.join(home, 'quota.json'), []),
    answers: readAnswers(home),
    gaps: readJsonl(path.join(home, 'gaps.jsonl')).filter(g => g && g.text),
    notes,
    files: resolveFiles(items, ro, notes)
  };
}

module.exports = { defaultHome, ensureHome, expandHome, loadItems, readAnswers, readJsonl, appendAnswer, resolvePath, resolveFiles, snapshot, mimeFor, fileUrl, pathFromUrl, ACTIONS };
