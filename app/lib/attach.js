'use strict';
// Images the user attaches to an answer (pasted, dropped or snapped on the desk). The app copies the bytes into
// <home>/attachments/<yyyy-mm>/<sha256:10>.<ext> the moment they arrive, so nothing depends on a temp file that
// vanishes (macOS screenshot thumbnails do). Answer lines name those copies in `attachments` (docs/CONTRACT.md).
// Pure Node (no Electron) so it is unit-testable.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 8, MAX_MARKS = 50, MAX_MARK_NOTE = 500;
const EXTS = new Set(['png', 'jpg', 'gif', 'webp']);
const SHAPES = new Set(['pin', 'box', 'arrow']);
const SOURCES = new Set(['paste', 'drop', 'snap']);

// File type by magic bytes, never by name: png | jpg | gif | webp, else null (SVG and anything else are refused).
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG' && buf[4] === 0x0d && buf[5] === 0x0a) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const dirOf = home => path.join(home, 'attachments');

// Writes the bytes (atomic: dot tmp file, then rename; mode 0600) and returns { path, type: 'image', ext }.
// The same bytes always land at the same path, so attaching an image twice stores it once.
function save(home, bytes, t = new Date()) {
  const buf = Buffer.isBuffer(bytes) ? bytes : bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes) ? Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength) : null;
  if (!buf || !buf.length) throw new Error('empty attachment');
  if (buf.length > MAX_BYTES) throw new Error(`attachment over ${MAX_BYTES / 1024 / 1024} MB`);
  const ext = sniff(buf);
  if (!ext) throw new Error('only PNG, JPEG, WebP or GIF images can be attached');
  const month = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(dirOf(home), month);
  const file = path.join(dir, `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10)}.${ext}`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, buf, { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  return { type: 'image', path: file, ext };
}

// True when p is an existing attachment file the app wrote: absolute, inside <home>/attachments (after resolving
// links), not hidden, with an image extension. Anything else in an answer line is refused.
function isAttachment(home, p) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) return false;
  let root, real;
  try { root = fs.realpathSync(dirOf(home)); real = fs.realpathSync(p); } catch (e) { return false; }
  if (!real.startsWith(root + path.sep)) return false;
  const rel = real.slice(root.length + 1).split(path.sep);
  if (rel.some(s => s.startsWith('.'))) return false;
  const m = /\.([a-z]+)$/.exec(real);
  try { return !!m && EXTS.has(m[1]) && fs.statSync(real).isFile(); } catch (e) { return false; }
}

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r3 = v => Math.round(v * 1000) / 1000;
function cleanMark(m, i) {
  if (!m || typeof m !== 'object' || !SHAPES.has(m.shape) || !num(m.x, 0, 1) || !num(m.y, 0, 1)) throw new Error(`attachment mark ${i}: needs shape pin|box|arrow and x,y in 0..1`);
  const out = { shape: m.shape, x: r3(m.x), y: r3(m.y) };
  if (m.shape === 'box') { if (!num(m.w, 0, 1) || !num(m.h, 0, 1)) throw new Error(`attachment mark ${i}: box needs w,h in 0..1`); out.w = r3(m.w); out.h = r3(m.h); }
  if (m.shape === 'arrow') { if (!num(m.x2, 0, 1) || !num(m.y2, 0, 1)) throw new Error(`attachment mark ${i}: arrow needs x2,y2 in 0..1`); out.x2 = r3(m.x2); out.y2 = r3(m.y2); }
  if (m.n != null) { if (!Number.isInteger(m.n) || m.n < 1 || m.n > 999) throw new Error(`attachment mark ${i}: bad n`); out.n = m.n; }
  if (m.note != null) out.note = String(m.note).slice(0, MAX_MARK_NOTE);
  return out;
}

// Validates an answer's `attachments` and returns the exact list to write. Throws on anything off: the renderer
// only ever passes what save() returned, so a bad entry is a bug or a forgery, never something to half-write.
function clean(home, list) {
  if (list == null) return null;
  if (!Array.isArray(list)) throw new Error('attachments must be a list');
  if (!list.length) return null;
  if (list.length > MAX_ATTACHMENTS) throw new Error(`at most ${MAX_ATTACHMENTS} attachments`);
  return list.map((a, i) => {
    if (!a || typeof a !== 'object' || (a.type ?? 'image') !== 'image') throw new Error(`attachment ${i}: type must be image`);
    if (!isAttachment(home, a.path)) throw new Error(`attachment ${i}: not a desk attachment`);
    const out = { type: 'image', path: path.normalize(a.path) };
    if (a.marked != null) { if (!isAttachment(home, a.marked)) throw new Error(`attachment ${i}: marked copy is not a desk attachment`); out.marked = path.normalize(a.marked); }
    if (a.source != null) { if (!SOURCES.has(a.source)) throw new Error(`attachment ${i}: source must be paste|drop|snap`); out.source = a.source; }
    for (const k of ['w', 'h']) if (a[k] != null) { if (!Number.isInteger(a[k]) || a[k] < 1 || a[k] > 100000) throw new Error(`attachment ${i}: bad ${k}`); out[k] = a[k]; }
    if (a.marks != null) {
      if (!Array.isArray(a.marks) || a.marks.length > MAX_MARKS) throw new Error(`attachment ${i}: marks must be a list of at most ${MAX_MARKS}`);
      if (a.marks.length) out.marks = a.marks.map(cleanMark);
    }
    return out;
  });
}

// Every attachment path named by these answer lines that is a real desk attachment (for the harbor:// allow list).
function referenced(home, answers) {
  const out = new Set();
  for (const a of answers || []) for (const x of Array.isArray(a?.attachments) ? a.attachments : []) for (const p of [x?.path, x?.marked]) if (isAttachment(home, p)) out.add(path.normalize(p));
  return out;
}

module.exports = { sniff, save, isAttachment, clean, referenced, dirOf, MAX_BYTES };
