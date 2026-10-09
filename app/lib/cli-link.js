'use strict';
// "Install Command Line Tool": links `harbordeck` and `hd` into a bin folder (default ~/.local/bin). The packaged app links
// the bundle's launcher (cli/bin/hd-app: runs the CLI on the app's own runtime, no Node needed); a source checkout links
// cli/bin/harbordeck.js like adapters/firstmate/install.sh. Only links pointing at this target are ever replaced silently
// or removed; anything else in the way is reported and left alone unless the caller says replace.
const fs = require('fs');
const os = require('os');
const path = require('path');

const NAMES = ['harbordeck', 'hd'];
const defaultBinDir = (home = os.homedir()) => path.join(home, '.local', 'bin');

function cliTarget({ packaged, resourcesPath, appRoot }) {
  return packaged ? path.join(resourcesPath, 'app.asar.unpacked', 'cli', 'bin', 'hd-app') : path.join(appRoot, 'cli', 'bin', 'harbordeck.js');
}

// state: ours (links to target) | missing | link (a symlink elsewhere: another install) | file (a real file or folder)
function linkState(file, target) {
  let st; try { st = fs.lstatSync(file); } catch (e) { return { state: 'missing' }; }
  if (!st.isSymbolicLink()) return { state: 'file' };
  const to = fs.readlinkSync(file);
  return { state: path.resolve(path.dirname(file), to) === target ? 'ours' : 'link', to };
}

function cliStatus(binDir, target, envPath = '') {
  const links = NAMES.map(name => ({ name, path: path.join(binDir, name), ...linkState(path.join(binDir, name), target) }));
  return { binDir, target, links, installed: links.every(l => l.state === 'ours'), onPath: envPath.split(':').some(d => d && path.resolve(d) === path.resolve(binDir)) };
}

function installCli(binDir, target, { replace = false } = {}) {
  const status = cliStatus(binDir, target);
  const blocked = status.links.filter(l => l.state === 'file' || (l.state === 'link' && !replace));
  if (blocked.length) {
    const err = new Error(blocked.map(l => l.state === 'file' ? `${l.path} exists and is not a link` : `${l.path} already links to ${l.to}`).join('; '));
    err.conflict = blocked.every(l => l.state === 'link'); // replaceable with { replace: true }
    throw err;
  }
  fs.mkdirSync(binDir, { recursive: true });
  for (const l of status.links) {
    if (l.state === 'ours') continue;
    if (l.state === 'link') fs.unlinkSync(l.path);
    fs.symlinkSync(target, l.path);
  }
  return cliStatus(binDir, target);
}

function uninstallCli(binDir, target) {
  for (const l of cliStatus(binDir, target).links) if (l.state === 'ours') fs.unlinkSync(l.path);
  return cliStatus(binDir, target);
}

module.exports = { NAMES, defaultBinDir, cliTarget, cliStatus, installCli, uninstallCli };
