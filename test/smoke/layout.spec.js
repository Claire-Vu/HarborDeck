// No horizontal scroll at any window size: with a decision and its report open on the desk (stamps tray open and
// closed), the page never gets wider than the window, the desk papers stay inside the desk and never cover each other.
// Regression: the closed stamp tray slid 150 px past the right edge and widened the page, so a scroll shifted the
// whole window sideways (header cut off on the left, a blank band on the right, the reading paper over the ask card).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
let app, page;
test.describe.configure({ mode: 'serial' });

const SIZES = [[1000, 630], [1280, 800], [900, 600], [1440, 900], [700, 600], [400, 700]];

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-layout-'));
  app = await launchApp({ home: seedDemo(path.join(tmp, 'home')), profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setMinimumSize(300, 300); w.setContentSize(1280, 800); });
  await page.getByRole('button', { name: 'Open the office' }).click();
  await page.locator('#queue li', { hasText: 'Launch pricing' }).click(); // a decision whose report fills the reading paper
  await expect(page.locator('#desk-surface .paper.reading')).toBeVisible();
});
test.afterAll(async () => { await app?.close(); });

async function measure() {
  return page.evaluate(() => {
    const over = sel => { const el = document.querySelector(sel); return el ? el.scrollWidth - el.clientWidth : 0; };
    window.scrollTo(10000, 0); // a scroll (scrollIntoView, a swipe) must have nowhere to go sideways
    const surf = document.querySelector('#desk-surface').getBoundingClientRect();
    const papers = [...document.querySelectorAll('#desk-surface .paper')].map(p => ({ cls: p.className, r: p.getBoundingClientRect() }));
    const overlaps = [];
    for (let i = 0; i < papers.length; i++) for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i].r, b = papers[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${papers[i].cls} / ${papers[j].cls}`);
    }
    return {
      doc: over('html'), body: over('body'), header: over('.topbar'), col: over('.window-col'), desk: over('#desk'), surface: over('#desk-surface'),
      scrollX: window.scrollX, outside: papers.filter(p => p.r.left < surf.left - 1 || p.r.right > surf.right + 1).map(p => p.cls), overlaps
    };
  });
}

for (const tray of ['open', 'closed']) {
  test(`stamps ${tray}: nothing wider than the window, papers inside the desk and apart`, async () => {
    if ((await page.locator('#stamps').getAttribute('data-open')) !== String(tray === 'open')) {
      await page.locator('#tray-handle').click();
      await expect(page.locator('#stamps')).toHaveAttribute('data-open', String(tray === 'open'));
    }
    for (const [w, h] of SIZES) {
      await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h]);
      await page.waitForFunction(w => window.innerWidth === w, w);
      await page.waitForTimeout(400); // the tray's width transition, then the desk lays out again
      // poll: a slow runner can take longer than the fixed wait to finish laying the desk out
      await expect.poll(measure, { message: `${w}x${h}`, timeout: 5000 }).toEqual({ doc: 0, body: 0, header: 0, col: 0, desk: 0, surface: 0, scrollX: 0, outside: [], overlaps: [] });
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
    await page.waitForFunction(() => window.innerWidth === 1280);
  });
}
