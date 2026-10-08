// Finds the review URL of a Lavish artifact so `-a lavish:<file.html>` can store a page the desk opens in its
// browser pane. `lavish-axi <file> --no-open` starts or resumes the session without opening a browser window and
// prints `url: "http://127.0.0.1:<port>/session/<id>"`. Optional: no lavish-axi (or HARBORDECK_LAVISH=0) -> null.
import { spawnSync } from 'node:child_process';

export function lavishUrl(file, env) {
  if (env.HARBORDECK_LAVISH === '0') return null;
  const r = spawnSync('lavish-axi', [file, '--no-open'], { encoding: 'utf8', timeout: 15000, env });
  if (r.error || r.status !== 0) return null;
  const m = /^\s*url:\s*"?(https?:\/\/[^"\s]+)"?\s*$/m.exec(r.stdout || '');
  return m ? m[1] : null;
}
