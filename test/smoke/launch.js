'use strict';
// The only way a test starts the Electron app. Headless by default (no window, no focus, no Dock icon) so a test run
// never interrupts whoever is at the machine; HARBORDECK_HEADLESS=0 is the explicit opt-in to watch a run.
// test/unit/no-direct-launch.test.js fails if any other file under test/ launches Electron itself.
const { _electron: electron } = require('@playwright/test');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// home: data dir, profile: Electron userData dir, env: extra variables for the app.
// app: a packaged build's executable (<Harbor Deck.app>/Contents/MacOS/Harbor Deck) instead of this checkout.
function launchApp({ home, profile, env = {}, app }) {
  return electron.launch({
    ...(app ? { executablePath: app, args: [] } : { args: [ROOT] }),
    env: { ...process.env, HARBORDECK_HEADLESS: process.env.HARBORDECK_HEADLESS || '1', HARBORDECK_HOME: home, HARBORDECK_USER_DATA: profile, ...env }
  });
}

module.exports = { launchApp, ROOT };
