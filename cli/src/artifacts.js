// "[type:]<path|url>" artifact references, shared by item verbs (-a) and notes.
import fs from 'node:fs';
import path from 'node:path';
import { lavishUrl } from './lavish.js';

const EXT_TYPES = [
  [/\.(mp4|mov|webm|mkv|m4v)$/i, 'video'],
  [/\.(png|jpe?g|gif|webp|svg|avif)$/i, 'image'],
  [/\.(mp3|wav|m4a|ogg|flac)$/i, 'audio'],
  [/\.(md|markdown|txt|pdf|html?)$/i, 'report'],
  [/\.(diff|patch)$/i, 'diff'],
];

export function isUrl(v) { return /^[a-z][a-z0-9+.-]*:\/\//i.test(v); }

export function absPath(p, cwd) { return path.isAbsolute(p) ? p : path.resolve(cwd, p); }

// "[type:]<path|url>" -> { type, url } | { type, path }
export function parseArt(v, ctx) {
  let type = null;
  let ref = v;
  const m = /^([a-z][a-z0-9-]{0,31}):(.+)$/s.exec(v);
  if (m && !m[2].startsWith('//')) { type = m[1]; ref = m[2]; }
  if (isUrl(ref)) {
    return { type: type || (/\/pull\/\d+|\/merge_requests\/\d+/.test(ref) ? 'pr' : 'link'), url: ref };
  }
  if (type === 'web') throw new Error(`bad --art "${v}" (web needs a URL, e.g. web:http://localhost:3000/)`);
  const p = absPath(ref, ctx.cwd);
  if (!fs.existsSync(p)) ctx.warn(`warning: artifact not found: ${p}`);
  if (type === 'lavish') {
    const url = fs.existsSync(p) ? lavishUrl(p, ctx.env) : null;
    if (url) return { type, url };
    ctx.warn(`warning: no Lavish session URL for ${p}; stored the file path (run lavish-axi on it, or pass lavish:<url>)`);
  }
  return { type: type || (EXT_TYPES.find(([re]) => re.test(p)) || [null, 'file'])[1], path: p };
}
