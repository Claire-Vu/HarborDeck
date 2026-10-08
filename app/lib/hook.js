'use strict';
// The optional "on-answer" command: run once per flushed answer line so an agent can be woken at once.
// The line arrives on stdin and in $HARBORDECK_LINE; $HARBORDECK_HOME is the data directory.
const { spawn } = require('child_process');

function runOnAnswer(command, line, home, { timeoutMs = 30000, log = () => {} } = {}) {
  if (!command || !String(command).trim()) return null;
  const shell = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
  const child = spawn(shell, args, { cwd: home, env: Object.assign({}, process.env, { HARBORDECK_LINE: line, HARBORDECK_HOME: home }), stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', d => { if (err.length < 2000) err += d; });
  const t = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
  child.on('error', e => { clearTimeout(t); log(`on-answer failed: ${e.message}`); });
  child.on('exit', code => { clearTimeout(t); if (code) log(`on-answer exited ${code}: ${err.trim().slice(0, 300)}`); });
  child.stdin.on('error', () => { /* command ignored stdin */ });
  child.stdin.end(line + '\n');
  return child;
}

module.exports = { runOnAnswer };
