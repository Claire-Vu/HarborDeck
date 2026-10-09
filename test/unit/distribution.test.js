'use strict';
// Distribution: the command line tool links (app/lib/cli-link.js), the bundle launcher (cli/bin/hd-app), the update
// check (app/lib/updater.js) and the connect-an-agent plans and status light (app/lib/connect.js). Temp dirs only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { execFileSync } = require('child_process');
const cli = require('../../app/lib/cli-link');
const { createUpdater, isDeveloperIdSigned } = require('../../app/lib/updater');
const connect = require('../../app/lib/connect');
const { saveSettings, loadSettings } = require('../../app/lib/settings');

const ROOT = path.join(__dirname, '..', '..');
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-dist-')));

test('cliTarget: the bundle launcher when packaged, harbordeck.js from a checkout', () => {
  assert.strictEqual(cli.cliTarget({ packaged: true, resourcesPath: '/A/Harbor Deck.app/Contents/Resources', appRoot: 'x' }), '/A/Harbor Deck.app/Contents/Resources/app.asar.unpacked/cli/bin/hd-app');
  assert.strictEqual(cli.cliTarget({ packaged: false, appRoot: '/src/hd' }), '/src/hd/cli/bin/harbordeck.js');
  assert.strictEqual(cli.defaultBinDir('/x/home'), '/x/home/.local/bin');
});

test('install links hd and harbordeck (creating the folder), is idempotent, and uninstall removes only its own links', () => {
  const d = tmp(), bin = path.join(d, 'deep', 'bin'), target = path.join(d, 'hd-app');
  fs.writeFileSync(target, '#!/bin/sh\n');
  let st = cli.cliStatus(bin, target, '/usr/bin');
  assert.deepStrictEqual(st.links.map(l => l.state), ['missing', 'missing']);
  assert.strictEqual(st.installed, false); assert.strictEqual(st.onPath, false);
  st = cli.installCli(bin, target);
  assert.strictEqual(st.installed, true);
  for (const n of ['hd', 'harbordeck']) assert.strictEqual(fs.readlinkSync(path.join(bin, n)), target);
  assert.strictEqual(cli.installCli(bin, target).installed, true);
  assert.strictEqual(cli.cliStatus(bin, target, `/usr/bin:${bin}`).onPath, true);
  st = cli.uninstallCli(bin, target);
  assert.deepStrictEqual(st.links.map(l => l.state), ['missing', 'missing']);
});

test('another install in the way: reported, kept, replaced only on request; a real file is never touched', () => {
  const d = tmp(), bin = path.join(d, 'bin'), target = path.join(d, 'hd-app'), other = path.join(d, 'checkout', 'harbordeck.js');
  fs.mkdirSync(bin); fs.symlinkSync(other, path.join(bin, 'hd'));
  assert.deepStrictEqual(cli.cliStatus(bin, target).links.map(l => [l.name, l.state, l.to]), [['harbordeck', 'missing', undefined], ['hd', 'link', other]]);
  assert.throws(() => cli.installCli(bin, target), e => e.conflict === true && /already links to/.test(e.message));
  assert.strictEqual(fs.existsSync(path.join(bin, 'harbordeck')), false, 'nothing is linked when anything is in the way');
  assert.strictEqual(cli.installCli(bin, target, { replace: true }).installed, true);
  // uninstall leaves a link to anything else alone
  fs.unlinkSync(path.join(bin, 'hd')); fs.symlinkSync(other, path.join(bin, 'hd'));
  cli.uninstallCli(bin, target);
  assert.strictEqual(fs.readlinkSync(path.join(bin, 'hd')), other);
  fs.unlinkSync(path.join(bin, 'hd')); fs.writeFileSync(path.join(bin, 'hd'), 'mine');
  assert.throws(() => cli.installCli(bin, target, { replace: true }), e => !e.conflict && /not a link/.test(e.message));
  assert.strictEqual(fs.readFileSync(path.join(bin, 'hd'), 'utf8'), 'mine');
});

test('hd-app runs the CLI through a symlink on the runtime next to it, as Node, and hands out itself as the command', () => {
  // A fake bundle: <app>/Contents/MacOS/Harbor Deck is node; the CLI sits in Resources/app.asar.unpacked/cli.
  const d = tmp(), res = path.join(d, 'H.app', 'Contents', 'Resources', 'app.asar.unpacked');
  fs.mkdirSync(path.join(d, 'H.app', 'Contents', 'MacOS'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'cli'), path.join(res, 'cli'), { recursive: true, filter: s => !/node_modules|\/test(\/|$)/.test(s) });
  fs.cpSync(path.join(ROOT, 'schema'), path.join(res, 'schema'), { recursive: true });
  const exe = path.join(d, 'H.app', 'Contents', 'MacOS', 'Harbor Deck');
  fs.writeFileSync(exe, `#!/bin/sh\n[ "$ELECTRON_RUN_AS_NODE" = 1 ] || { echo "not as node" >&2; exit 9; }\nprintf '%s' "$HARBORDECK_LAUNCHER" > "${path.join(d, 'launcher')}"\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  const bin = path.join(d, 'bin'); cli.installCli(bin, path.join(res, 'cli', 'bin', 'hd-app'));
  const out = execFileSync(path.join(bin, 'hd'), ['--version'], { encoding: 'utf8', env: { ...process.env, HARBORDECK_HOME: path.join(d, 'home') } });
  assert.match(out.trim(), /^\d+\.\d+\.\d+$/);
  assert.strictEqual(fs.readFileSync(path.join(d, 'launcher'), 'utf8'), path.join(res, 'cli', 'bin', 'hd-app'));
});

function fakeUpdater() {
  const u = new EventEmitter();
  u.calls = [];
  u.checkForUpdates = async () => { u.calls.push('check'); u.emit(...u.next); };
  u.downloadUpdate = async () => { u.calls.push('download'); u.emit(...u.afterDownload); };
  u.quitAndInstall = () => u.calls.push('install');
  return u;
}
const REL = 'https://github.com/o/r/releases';

test('updater, unsigned build: a new version is a download link, never a download', async () => {
  const u = fakeUpdater(), states = [];
  const up = createUpdater({ autoUpdater: u, signed: false, releasesUrl: REL, onState: s => states.push(s.status) });
  assert.strictEqual(u.autoDownload, false); assert.strictEqual(u.autoInstallOnAppQuit, false);
  u.next = ['update-available', { version: '0.2.0' }];
  const s = await up.check();
  assert.deepStrictEqual({ status: s.status, version: s.version, url: s.url }, { status: 'available', version: '0.2.0', url: `${REL}/tag/v0.2.0` });
  assert.deepStrictEqual(u.calls, ['check']); assert.deepStrictEqual(states, ['checking', 'available']);
  up.install(); assert.deepStrictEqual(u.calls, ['check'], 'nothing to install');
  u.next = ['update-not-available', {}];
  assert.strictEqual((await up.check()).status, 'none');
});

test('updater, signed build: downloads, then restart installs; a failed download falls back to the link', async () => {
  const u = fakeUpdater();
  const up = createUpdater({ autoUpdater: u, signed: true, releasesUrl: REL, onState: () => {} });
  u.next = ['update-available', { version: '0.3.0' }]; u.afterDownload = ['update-downloaded', { version: '0.3.0' }];
  await up.check(); await new Promise(r => setImmediate(r));
  assert.strictEqual(up.state().status, 'ready');
  up.install(); assert.deepStrictEqual(u.calls, ['check', 'download', 'install']);

  const v = fakeUpdater();
  const up2 = createUpdater({ autoUpdater: v, signed: true, releasesUrl: REL, onState: () => {} });
  v.next = ['update-available', { version: '0.3.0' }]; v.afterDownload = ['error', new Error('Code signature at URL did not pass validation')];
  await up2.check(); await new Promise(r => setImmediate(r));
  assert.deepStrictEqual([up2.state().status, up2.state().url], ['available', `${REL}/tag/v0.3.0`]);
});

test('updater: a failed check (offline, no release yet) reports an error with the releases link', async () => {
  const u = fakeUpdater();
  u.checkForUpdates = async () => { u.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED\nstack')); throw new Error('x'); };
  const up = createUpdater({ autoUpdater: u, signed: false, releasesUrl: REL, onState: () => {} });
  const s = await up.check();
  assert.deepStrictEqual([s.status, s.error, s.url], ['error', 'no connection to GitHub', REL]);
  u.checkForUpdates = async () => { u.emit('error', new Error('Cannot find channel "latest-mac.yml" update info: HttpError: 404')); };
  assert.strictEqual((await up.check()).error, 'no release is published yet');
});

test('isDeveloperIdSigned reads the codesign authority', () => {
  const fake = (status, stderr) => () => ({ status, stderr, stdout: '' });
  assert.strictEqual(isDeveloperIdSigned('/A.app', fake(0, 'Authority=Developer ID Application: X (T)\nAuthority=Apple Root CA')), true);
  assert.strictEqual(isDeveloperIdSigned('/A.app', fake(0, 'Signature=adhoc')), false);
  assert.strictEqual(isDeveloperIdSigned('/A.app', fake(1, 'code object is not signed at all')), false);
});

test('agentActivity: newest agent-written file; answers.jsonl (the user\'s) does not count', () => {
  const home = tmp();
  assert.strictEqual(connect.agentActivity(home), null);
  fs.writeFileSync(path.join(home, 'answers.jsonl'), '{}\n');
  assert.strictEqual(connect.agentActivity(home), null);
  fs.mkdirSync(path.join(home, 'items'));
  fs.writeFileSync(path.join(home, 'items', 'a.json'), '{}'); fs.utimesSync(path.join(home, 'items', 'a.json'), 1000, 1000);
  fs.writeFileSync(path.join(home, 'notes.jsonl'), '{}\n'); fs.utimesSync(path.join(home, 'notes.jsonl'), 2000, 2000);
  assert.deepStrictEqual(connect.agentActivity(home), { at: 2000, what: 'notes.jsonl' });
});

test('connect plans: the exact commands shown before anything runs', () => {
  const c = connect.claudeCodePlan({ claudeBin: '/x/claude', hdPath: '/x/home/.local/bin/harbordeck', home: '/x/home/.harbordeck', defaultHome: '/x/home/.harbordeck' });
  assert.deepStrictEqual(c.argv, ['mcp', 'add', 'harbordeck', '-s', 'user', '--', '/x/home/.local/bin/harbordeck', 'mcp']);
  assert.strictEqual(c.command, 'claude mcp add harbordeck -s user -- /x/home/.local/bin/harbordeck mcp');
  const c2 = connect.claudeCodePlan({ hdPath: '/b/harbordeck', home: '/d/my desk', defaultHome: '/u/.harbordeck' });
  assert.strictEqual(c2.command, "claude mcp add harbordeck -s user -e 'HARBORDECK_HOME=/d/my desk' -- /b/harbordeck mcp");
  const f = connect.firstmatePlan({ script: '/r/install.sh', fmHome: '/fm', home: '/h', settingsDir: '/p/Harbor Deck', service: false, pending: 'skip' });
  assert.deepStrictEqual(f.argv, ['--fm-home', '/fm', '--data-dir', '/h', '--settings-dir', '/p/Harbor Deck', '--no-service', '--pending', 'skip']);
  assert.strictEqual(f.command, "/r/install.sh --fm-home /fm --data-dir /h --settings-dir '/p/Harbor Deck' --no-service --pending skip");
});

test('settings keep onboarded', () => {
  const file = path.join(tmp(), 'settings.json');
  assert.strictEqual(loadSettings(file).onboarded, false);
  saveSettings(file, { ...loadSettings(file), onboarded: true });
  assert.strictEqual(loadSettings(file).onboarded, true);
});
