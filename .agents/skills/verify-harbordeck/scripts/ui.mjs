#!/usr/bin/env node
// ui.mjs: drive the running Harbor Deck window (started by `hdv launch`) through Playwright over CDP.
// Stable handles only: ARIA role + name, or the app's own ids/classes. One action per call; exit 1 on failure.
//
//   ui.mjs click (--role <role> --name <name> [--exact] | --css <selector> [--text <substring>])
//   ui.mjs press <key> [<key>...]              keyboard on the focused page (1-4 or ' ' stamp, a-e pick, s later, u undo, n next, Escape...); several keys go back to back
//   ui.mjs drag (--role .. --name .. | --css .. [--text ..]) (--to <css> | --by dx,dy)   pointer drag (a paper's .grip)
//   ui.mjs fill (--role .. --name .. | --css ..) --value <text>
//   ui.mjs wait (--role .. --name .. | --css .. [--text ..]) [--gone] [--timeout ms]
//   ui.mjs text (--css <selector> [--text ..])  print the text of every match
//   ui.mjs aria [--out <file>]                 ARIA snapshot of the whole window (YAML)
//   ui.mjs shot <file.png> [--size WxH]        screenshot of the window (--size: as if the window were WxH)
//   ui.mjs reload                              reload the desk page (persistence checks; the app keeps running)
//   ui.mjs eval '<js expression>'              read-only inspection; never use it to change app state
// --pane on any command acts inside the in-desk browser pane's page (http(s) or a local harbor:// page) instead of the desk.
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
  if (['--gone', '--exact', '--pane'].includes(rest[i])) opt[rest[i].slice(2)] = true;
  else if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
  else pos.push(rest[i]);
}
const cdp = opt.cdp || process.env.CHROME_DEVTOOLS_AXI_BROWSER_URL;
if (!cmd || !cdp) { console.error('usage: ui.mjs <click|press|drag|fill|wait|text|aria|shot|reload|eval> ... (eval "$(hdv env)" first)'); process.exit(2); }
const timeout = Number(opt.timeout || 10000);

const browser = await chromium.connectOverCDP(cdp);
try {
  // --pane: the in-desk browser pane's page (a separate WebContentsView) instead of the desk itself.
  const all = browser.contexts().flatMap((c) => c.pages());
  const desk = (p) => p.url().endsWith('/renderer/index.html');
  const page = opt.pane ? all.find((p) => !desk(p) && /^(https?|harbor):/.test(p.url())) : all.find(desk);
  if (!page) throw new Error(opt.pane ? 'no browser pane open' : 'no Harbor Deck window on ' + cdp);
  page.setDefaultTimeout(timeout);
  const target = () => {
    let l = opt.role ? page.getByRole(opt.role, { name: opt.name, exact: !!opt.exact }) : opt.css ? page.locator(opt.css) : null;
    if (!l) throw new Error('need --role/--name or --css');
    if (opt.text) l = l.filter({ hasText: opt.text });
    return l.first();
  };
  switch (cmd) {
    case 'click': await target().click(); break;
    case 'press': for (const k of pos) await page.keyboard.press(k); break; // several keys: back to back, in one connection
    case 'drag': {
      // pointer drag from the start of the match (a paper's .grip) to the centre of --to <css> (#stow-box) or by --by dx,dy
      const a = await target().boundingBox(); if (!a) throw new Error('drag source not visible');
      let x, y;
      if (opt.to) { const b = await page.locator(opt.to).first().boundingBox(); if (!b) throw new Error('drag target not visible'); x = b.x + b.width / 2; y = b.y + b.height / 2; }
      else if (/^-?\d+,-?\d+$/.test(opt.by || '')) { const [dx, dy] = opt.by.split(',').map(Number); x = a.x + 20 + dx; y = a.y + 8 + dy; }
      else throw new Error('drag needs --to <css> or --by dx,dy');
      await page.mouse.move(a.x + 20, a.y + 8); await page.mouse.down();
      await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up();
      break;
    }
    case 'fill': await target().fill(opt.value ?? ''); break;
    case 'wait': await target().waitFor({ state: opt.gone ? 'hidden' : 'visible', timeout }); break;
    case 'text': {
      let l = page.locator(opt.css); if (opt.text) l = l.filter({ hasText: opt.text });
      // SVG nodes (scene tide label etc.) have no innerText; fall back to textContent
      for (const t of await l.evaluateAll((els) => els.map((e) => e.innerText ?? e.textContent))) console.log(t.replace(/\s+/g, ' ').trim());
      break;
    }
    case 'aria': {
      const y = await page.locator('body').ariaSnapshot();
      if (opt.out) writeFileSync(opt.out, y + '\n'); else console.log(y);
      break;
    }
    case 'reload': await page.reload(); await page.locator('#queue').waitFor(); break;
    case 'shot': {
      // --size WxH: emulate that viewport for this shot only (CDP cannot resize Electron's window); cleared on exit
      const m = /^(\d+)x(\d+)$/.exec(opt.size || '');
      if (opt.size && !m) throw new Error('--size wants WxH, e.g. 960x600');
      if (m) {
        const s = await page.context().newCDPSession(page);
        await s.send('Emulation.setDeviceMetricsOverride', { width: +m[1], height: +m[2], deviceScaleFactor: 0, mobile: false });
        await page.waitForTimeout(500); // let the desk's resize relayout settle
      }
      await page.screenshot({ path: pos[0] });
      break;
    }
    case 'eval': console.log(JSON.stringify(await page.evaluate(pos[0]))); break;
    default: throw new Error(`unknown command ${cmd}`);
  }
} catch (e) {
  console.error(`ui ${cmd}: ${e.message.split('\n')[0]}`); process.exitCode = 1;
} finally {
  await browser.close().catch(() => {}); // disconnects only; the app keeps running
}
