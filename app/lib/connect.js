'use strict';
// "Connect an agent": what each connector changes (shown to the user before anything runs), running it, and the
// status light (the last time an agent wrote to the data directory).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Files only agents (or their feeders) write; answers.jsonl is the user's own and does not count.
const AGENT_FILES = ['notes.jsonl', 'gaps.jsonl', 'fleet.json'];
function agentActivity(home) {
  let best = null;
  const see = (file, what) => { try { const t = fs.statSync(file).mtimeMs; if (!best || t > best.at) best = { at: t, what }; } catch (e) { /* absent */ } };
  let names = []; try { names = fs.readdirSync(path.join(home, 'items')); } catch (e) { /* no items yet */ }
  for (const n of names) if (n.endsWith('.json')) see(path.join(home, 'items', n), `items/${n}`);
  for (const f of AGENT_FILES) see(path.join(home, f), f);
  return best && { at: Math.floor(best.at / 1000), what: best.what };
}

const shq = s => /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
const showCmd = argv => argv.map(shq).join(' ');

// Claude Code: register the CLI's stdio MCP server (`harbordeck mcp`) in the user's Claude Code config.
function claudeCodePlan({ claudeBin, hdPath, home, defaultHome }) {
  const env = home === defaultHome ? [] : ['-e', `HARBORDECK_HOME=${home}`];
  const argv = ['mcp', 'add', 'harbordeck', '-s', 'user', ...env, '--', hdPath, 'mcp'];
  return { argv, command: showCmd(['claude', ...argv]), claudeBin };
}

// firstmate: the bundled adapters/firstmate/install.sh (bridge, feeders, firstmate-side instructions).
function firstmatePlan({ script, fmHome, home, settingsDir, service, pending }) {
  const argv = ['--fm-home', fmHome, '--data-dir', home, '--settings-dir', settingsDir];
  if (!service) argv.push('--no-service');
  if (pending) argv.push('--pending', pending);
  return { script, argv, command: showCmd([script, ...argv]) };
}

// Runs a connector; resolves { code, out } (never rejects).
function runConnector(file, argv, env) {
  return new Promise(resolve => execFile(file, argv, { env, timeout: 120000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
    const out = `${stdout || ''}${stderr || ''}`.trim();
    resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: out || (err ? err.message : '') });
  }));
}

// The user's login-shell PATH: an app started from Finder gets a bare PATH without ~/.local/bin, Homebrew or npm globals.
let loginPathCache = null;
function loginPath(env = process.env) {
  if (loginPathCache) return Promise.resolve(loginPathCache);
  const shell = env.SHELL || '/bin/zsh';
  return new Promise(resolve => execFile(shell, ['-lc', 'printf %s "$PATH"'], { timeout: 5000 }, (err, out) => {
    const merged = [...new Set([...(err ? '' : String(out)).split(':'), ...(env.PATH || '').split(':'), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'].filter(Boolean))].join(':');
    resolve(loginPathCache = merged);
  }));
}
function which(name, envPath) {
  for (const d of envPath.split(':')) { const p = path.join(d, name); try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) { /* next */ } }
  return null;
}

module.exports = { agentActivity, claudeCodePlan, firstmatePlan, runConnector, loginPath, which, showCmd };
