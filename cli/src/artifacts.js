// "[type:]<path|url>" artifact references, shared by item verbs (-a) and notes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  if (/^file:\/\//i.test(ref)) { // a file:// URL is a local path: store it as a path artifact (web:file://x.html opens like x.html)
    try { ref = fileURLToPath(ref); } catch (e) { throw new Error(`bad --art "${v}" (not a local file URL)`); }
    if (type === 'web' || type === 'link' || type === 'file') type = null;
  } else if (isUrl(ref)) {
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

// --opt-art key=[type:]<path|url>: a sample of one decision option. `fail` throws the CLI's usage error.
export function attachOptArt(options, specs, ctx, who, fail) {
  const keys = options.map((o) => o.key);
  for (const v of specs) {
    const i = v.indexOf('=');
    const o = i > 0 && options.find((x) => x.key === v.slice(0, i).trim());
    if (!o) fail(`${who}: --opt-art "${v}" needs <option key>=<[type:]path|url> for one of ${keys.join(', ')}`);
    if (o.artifact) fail(`${who}: option ${o.key} already has an --opt-art`);
    const ref = v.slice(i + 1).trim();
    if (!ref) fail(`${who}: --opt-art "${v}" is missing the path or URL`);
    // a sample that is not there would only show "not available" on the desk: refuse it (nothing is written)
    try { o.artifact = parseArt(ref, { ...ctx, warn: (m) => /artifact not found/.test(m) || ctx.warn(m) }); } catch (e) { fail(`${who}: ${e.message}`); }
    if (o.artifact.path && !fs.existsSync(o.artifact.path)) fail(`${who}: --opt-art ${o.key}: file not found: ${o.artifact.path}`);
  }
}
