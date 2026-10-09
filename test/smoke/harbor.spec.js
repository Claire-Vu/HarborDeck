// The living harbor: boats per open task, sky from the clock, tide line, regulars, the ship cat, tidy runs (undo
// breaks one), the stamp book and chandlery, and the ships-out recap. None of it adds a key to clearing.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page, home;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-harbor-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

const title = () => page.locator('#desk-surface .paper.manifest h3').textContent();

test('the window shows the harbor: boats per task, real-clock sky, tide line, regulars and the cat', async () => {
  const frame = page.locator('.window-frame');
  await expect(frame).toHaveAttribute('data-phase', await page.evaluate(() => window.HarborGame.sky(new Date().getHours())));
  const boats = +(await frame.getAttribute('data-boats'));
  expect(boats).toBeGreaterThan(1);
  await expect(page.locator('#sc-boats .hb:not(.sailing)')).toHaveCount(Math.min(8, boats));
  await expect(page.locator('#sc-tide-l')).toContainText('high tide');
  // the top bar reads on its own: plain window names, % left, countdown, a run-out warning; per-model windows set apart
  // the window running lowest leads (Backup · week, 12% left), so its provider comes first
  await expect(page.locator('#stamina-cluster .mini-sub').first()).toHaveAttribute('aria-label', 'Backup · week: 12% left');
  await expect(page.locator('#stamina-cluster .ms-prov')).toHaveText(['Backup', 'Primary']);
  const first = page.locator('#stamina-cluster .mini-sub[aria-label^="Primary · 5h"]');
  await expect(first.locator('.ms-name')).toHaveText('5h');
  await expect(first.locator('.ms-pct')).toHaveText('38%');
  await expect(first.locator('.ms-time')).toHaveText(/^↻ 2h (9|10)m$/);
  await expect(first.locator('.ms-warn')).toContainText('⚠ out ~');
  await expect(first).toHaveAttribute('title', /Primary · 5h: 38% left \(62% used\)\. Resets .+, in 2h (9|10)m\./);
  await expect(page.locator('#stamina-cluster .mini-sub.model .ms-name')).toHaveText('Opal · week');
  await expect(page.locator('#stamina-cluster .ms-stale')).toHaveCount(0);
  await page.locator('#stamina-cluster').screenshot({ path: path.join(SHOTS, 'harbordeck-stamina.png') });
  await expect(page.locator('#scenes .sc-fig.urgent .ship-cat')).toHaveCount(1); // the cat sits by the most urgent figure in the scene
  await page.locator('#queue li', { hasText: 'Sign the app store' }).click(); // a project regular brings this one
  await expect(page.locator('#at-window .speech small.memory')).toContainText('First time at your window.');
  await page.locator('.window-frame').screenshot({ path: path.join(SHOTS, 'harbordeck-harbor.png') });
});

test('quick stamps build a tidy run; the settled task sails out; undo breaks the run', async () => {
  const boats = +(await page.locator('.window-frame').getAttribute('data-boats'));
  const first = await title();
  await page.keyboard.press('1');
  await expect(page.locator('#sc-boats .hb.sailing')).toHaveCount(1);
  await expect(page.locator('.window-frame')).toHaveAttribute('data-boats', String(boats - 1));
  await expect.poll(title).not.toBe(first);
  await page.keyboard.press('1');
  await expect(page.locator('#run')).toHaveText('×2 tidy run');
  await expect(page.locator('#run')).toHaveClass(/show/);
  await page.keyboard.press('u');
  await expect(page.locator('#run')).not.toHaveClass(/show/);
  await page.keyboard.press('1'); // after an undo the run starts over
  await expect(page.locator('.toast.undo')).toBeVisible();
  const ub = await page.locator('.toast.undo').boundingBox(), vp = { width: await page.evaluate(() => innerWidth) }; // a small corner chip, never a full-width bar
  expect(ub.width).toBeLessThan(vp.width / 3); expect(ub.x + ub.width).toBeGreaterThan(vp.width * 0.6);
  await expect(page.locator('.cash-pop').first()).toBeVisible(); // earnings pop near the cash chip, not a toast
  expect(await page.locator('.cash-pop').first().evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  await expect(page.locator('.toast.cash')).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(page.locator('#run')).not.toHaveClass(/show/);
});

test('the stamp book fills and the chandlery sells cosmetics for the till', async () => {
  // The earn toast lives 2.8 s and fires during the previous test, so it is not asserted here; the book below proves the badge.
  await page.locator('#cash').click();
  const box = page.locator('.modal.chandlery-modal');
  await expect(box.locator('.sb-stamp')).toHaveCount(await page.evaluate(() => window.HarborGame.BADGES.length));
  await expect(box.locator('.sb-stamp.got')).toContainText(['First stamp']);
  await box.locator('.shop-row', { hasText: 'Dock lamp' }).getByRole('button').click();
  await expect(page.locator('.modal.chandlery-modal .shop-row', { hasText: 'Dock lamp' })).toContainText('owned');
  await expect(page.locator('.modal.chandlery-modal .sb-stamp.got', { hasText: 'First purchase' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-chandlery.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#sc-lamp rect').first()).toBeAttached();
});

test('ships out: today\'s boats sail past, the old report rides along as the logbook', async () => {
  await page.keyboard.press('l');
  const box = page.locator('.modal.ledger', { hasText: 'Ships out' });
  await expect(box.locator('.recap-boat')).toHaveCount(2);
  await expect(box.locator('.recap-tally')).toContainText('2 boats out');
  await expect(box.locator('details.logbook')).toBeAttached();
  await expect(box.getByRole('button', { name: 'Close the day' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-ships-out.png') });
  await page.keyboard.press('Escape');
});
