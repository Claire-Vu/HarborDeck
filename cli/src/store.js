// The data directory: paths, atomic writes, appends.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function homeDir(env = process.env) {
  const h = env.HARBORDECK_HOME;
  if (h) return path.resolve(h.startsWith('~/') ? path.join(os.homedir(), h.slice(2)) : h);
  return path.join(os.homedir(), '.harbordeck');
}

export class Store {
  constructor(home) {
    this.home = home;
    this.items = path.join(home, 'items');
    this.answers = path.join(home, 'answers.jsonl');
    this.gaps = path.join(home, 'gaps.jsonl');
    this.cursors = path.join(home, 'cursors');
  }

  snapshot(name) { return path.join(this.home, `${name}.json`); }
  itemPath(id) { return path.join(this.items, `${id}.json`); }

  readItem(id) {
    try { return JSON.parse(fs.readFileSync(this.itemPath(id), 'utf8')); } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw new Error(`${id}: unreadable item (${e.message})`);
    }
  }

  writeItem(item) { writeAtomic(this.itemPath(item.id), JSON.stringify(item, null, 1) + '\n'); }

  listItems() {
    let names;
    try { names = fs.readdirSync(this.items); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    return names.filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort();
  }

  // One write per line: O_APPEND keeps concurrent small appends whole.
  appendLine(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + '\n');
  }

  readCursor(name) {
    try { return Number(fs.readFileSync(path.join(this.cursors, name), 'utf8').trim()) || 0; } catch { return 0; }
  }

  writeCursor(name, off) { writeAtomic(path.join(this.cursors, name), `${off}\n`); }

  // Complete answer lines starting at byte offset `off`.
  // Returns { lines: [{ end, raw }], next, reset }. A trailing partial line is left for next time.
  readAnswers(off) {
    let size;
    try { size = fs.statSync(this.answers).size; } catch (e) {
      if (e.code === 'ENOENT') return { lines: [], next: 0, reset: off > 0 };
      throw e;
    }
    let reset = false;
    if (off > size) { off = 0; reset = true; }
    if (off === size) return { lines: [], next: off, reset };
    const fd = fs.openSync(this.answers, 'r');
    const buf = Buffer.alloc(size - off);
    try { fs.readSync(fd, buf, 0, buf.length, off); } finally { fs.closeSync(fd); }
    const lines = [];
    let start = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] !== 0x0a) continue;
      const raw = buf.subarray(start, i).toString('utf8').replace(/\r$/, '');
      if (raw.trim()) lines.push({ end: off + i + 1, raw });
      start = i + 1;
    }
    return { lines, next: off + start, reset };
  }
}

export function writeAtomic(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
