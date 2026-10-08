'use strict';
// Settings live in <userData>/settings.json. HARBORDECK_HOME overrides dataDir for the session.
const fs = require('fs');
const path = require('path');
const { defaultHome, expandHome } = require('./store');

const DEFAULTS = { dataDir: '', artifactRoot: '', onAnswer: { enabled: false, command: '' } };

function loadSettings(file) {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
  return { ...DEFAULTS, ...raw, onAnswer: { ...DEFAULTS.onAnswer, ...(raw.onAnswer || {}) } };
}

function saveSettings(file, s) {
  const clean = {
    dataDir: String(s.dataDir || ''),
    artifactRoot: String(s.artifactRoot || ''),
    onAnswer: { enabled: !!(s.onAnswer && s.onAnswer.enabled), command: String((s.onAnswer && s.onAnswer.command) || '') }
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}

// Precedence: explicit override (demo) > HARBORDECK_HOME > settings.dataDir > ~/.harbordeck
function effectiveHome(settings, env = process.env, override) {
  const p = override || env.HARBORDECK_HOME || settings.dataDir || defaultHome();
  return path.resolve(expandHome(p));
}

module.exports = { DEFAULTS, loadSettings, saveSettings, effectiveHome };
