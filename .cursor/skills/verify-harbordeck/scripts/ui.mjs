#!/usr/bin/env node
// ui.mjs: drive the running Harbor Deck window (started by `hdv launch`) through Playwright over CDP.
// Stable handles only: ARIA role + name, or the app's own ids/classes. One action per call; exit 1 on failure.
//
//   ui.mjs click (--role <role> --name <name> [--exact] | --css <selector> [--text <substring>])
//   ui.mjs press <key>                         keyboard on the focused page (1-4 stamp, u undo, n next, Escape...)
//   ui.mjs fill (--role .. --name .. | --css ..) --value <text>
//   ui.mjs wait (--role .. --name .. | --css .. [--text ..]) [--gone] [--timeout ms]
//   ui.mjs text (--css <selector> [--text ..])  print the text of every match
//   ui.mjs aria [--out <file>]                 ARIA snapshot of the whole window (YAML)
//   ui.mjs shot <file.png>                     screenshot of the window
//   ui.mjs eval '<js expression>'              read-only inspection; never use it to change app state
// The CDP url comes from `hdv env` (CHROME_DEVTOOLS_AXI_BROWSER_URL) or --cdp <url>.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const { chromium } = createRequire(`${root}/package.json`)('playwright-core');

const [cmd, ...rest] = process.argv.slice(2);
const opt = {}; const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--gone' || rest[i] === '--exact') opt[rest[i].slice(2)] = true;
  else if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
  else pos.push(rest[i]);
}
const cdp = opt.cdp || process.env.CHROME_DEVTOOLS_AXI_BROWSER_URL;
if (!cmd || !cdp) { console.error('usage: ui.mjs <click|press|fill|wait|text|aria|shot|eval> ... (eval "$(hdv env)" first)'); process.exit(2); }
const timeout = Number(opt.timeout || 10000);

const browser = await chromium.connectOverCDP(cdp);
try {
  const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().endsWith('/renderer/index.html'));
  if (!page) throw new Error('no Harbor Deck window on ' + cdp);
  page.setDefaultTimeout(timeout);
  const target = () => {
    let l = opt.role ? page.getByRole(opt.role, { name: opt.name, exact: !!opt.exact }) : opt.css ? page.locator(opt.css) : null;
    if (!l) throw new Error('need --role/--name or --css');
    if (opt.text) l = l.filter({ hasText: opt.text });
    return l.first();
  };
  switch (cmd) {
    case 'click': await target().click(); break;
    case 'press': await page.keyboard.press(pos[0]); break;
    case 'fill': await target().fill(opt.value ?? ''); break;
    case 'wait': await target().waitFor({ state: opt.gone ? 'hidden' : 'visible', timeout }); break;
    case 'text': {
      let l = page.locator(opt.css); if (opt.text) l = l.filter({ hasText: opt.text });
      for (const t of await l.allInnerTexts()) console.log(t.replace(/\s+/g, ' ').trim());
      break;
    }
    case 'aria': {
      const y = await page.locator('body').ariaSnapshot();
      if (opt.out) writeFileSync(opt.out, y + '\n'); else console.log(y);
      break;
    }
    case 'shot': await page.screenshot({ path: pos[0] }); break;
    case 'eval': console.log(JSON.stringify(await page.evaluate(pos[0]))); break;
    default: throw new Error(`unknown command ${cmd}`);
  }
} catch (e) {
  console.error(`ui ${cmd}: ${e.message.split('\n')[0]}`); process.exitCode = 1;
} finally {
  await browser.close().catch(() => {}); // disconnects only; the app keeps running
}
