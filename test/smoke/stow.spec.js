// Storage box: papers stow by control, key and drag; the tray shows them as a pile of sheets and counts them; its view
// shows a mini copy of each; one (click a card) or all come back; it survives a reload. HARBORDECK_SHOTS saves screenshots.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
const SHOTS = process.env.HARBORDECK_SHOTS;
const shot = async (loc, name) => { if (!SHOTS) return; await page.evaluate(() => getSelection().removeAllRanges()); const b = loc === page ? null : await loc.boundingBox(); await page.screenshot({ path: path.join(SHOTS, name), clip: b ? { x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 40 } : undefined }); };
let app, page;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-stow-'));
  const home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

const papers = () => page.locator('#desk-surface .paper');
const count = () => page.locator('#stow');
const sheets = () => page.locator('#stow-stack .leaf');
const view = () => page.locator('#stow-view');

test('stow by control, key and drag; count; restore one, restore all', async () => {
  await expect(count()).toHaveAttribute('data-n', '0');
  await expect(sheets()).toHaveCount(0);
  await page.locator('#stow-box').click(); // empty: no view, just a hint
  await expect(view()).toBeHidden();
  await shot(page.locator('#stow-box'), 'stow-empty.png');
  const n0 = await papers().count();
  expect(n0).toBeGreaterThan(2);
  // control
  await papers().first().locator('.stow-btn').click();
  await expect(papers()).toHaveCount(n0 - 1);
  await expect(count()).toHaveAttribute('data-n', '1');
  await expect(sheets()).toHaveCount(1);
  // key
  await page.keyboard.press('x');
  await expect(papers()).toHaveCount(n0 - 2);
  await expect(count()).toHaveAttribute('data-n', '2');
  // drag a grip onto the box
  const grip = page.locator('#desk-surface .paper:not([data-pid="ask"])').last().locator('.grip');
  const g = await grip.boundingBox(), b = await page.locator('#stow-box').boundingBox();
  await page.mouse.move(g.x + 20, g.y + 8); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await expect(page.locator('#stow-box')).toHaveClass(/drop/);
  await page.mouse.up();
  await expect(papers()).toHaveCount(n0 - 3);
  await expect(count()).toHaveAttribute('data-n', '3');
  await expect(page.locator('#stow-n')).toHaveText('3');
  // the pile grows: each sheet sits higher than the one under it
  await expect(sheets()).toHaveCount(3);
  const tops = await sheets().evaluateAll(els => els.map(e => e.getBoundingClientRect().top));
  expect(tops[2]).toBeLessThan(tops[0]);
  await shot(page.locator('#stow-box'), 'stow-filled.png');
  // the view: one card per stowed paper, each a mini copy of the paper (its kind, title, content)
  await page.locator('#stow-box').click();
  await expect(view()).toBeVisible();
  await expect(page.locator('#stow-box')).toHaveAttribute('aria-expanded', 'true');
  const cards = page.locator('#stow-view .stow-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('.thumb .paper.mini')).toHaveCount(3);
  await expect(cards.first().locator('.thumb .grip')).not.toBeEmpty();
  await expect(page.locator('#stow-view video, #stow-view iframe, #stow-view audio')).toHaveCount(0);
  const vb = await view().boundingBox(), win = await page.evaluate(() => [innerWidth, innerHeight]);
  expect(vb.x).toBeGreaterThanOrEqual(0); expect(vb.x + vb.width).toBeLessThanOrEqual(win[0]); expect(vb.y).toBeGreaterThanOrEqual(0);
  await shot(page, 'stow-view.png');
  // restore one by its card; the view stays open on the rest
  const pid = await cards.first().getAttribute('data-pid');
  await cards.first().click();
  await expect(papers()).toHaveCount(n0 - 2);
  await expect(page.locator(`#desk-surface .paper[data-pid="${pid}"]`)).toBeVisible();
  await expect(count()).toHaveAttribute('data-n', '2');
  await expect(cards).toHaveCount(2);
  await expect(sheets()).toHaveCount(2);
  // Esc closes the view
  await page.keyboard.press('Escape');
  await expect(view()).toBeHidden();
  await expect(page.locator('#stow-box')).toHaveAttribute('aria-expanded', 'false');
});

test('stowed state survives a reload; bring all back', async () => {
  await page.reload();
  await expect(count()).toHaveAttribute('data-n', '2');
  await expect(sheets()).toHaveCount(2);
  await page.locator('#stow-box').click();
  await expect(page.locator('#stow-view .stow-card .paper.mini')).toHaveCount(2);
  await page.locator('#stow-view .all').click();
  await expect(count()).toHaveAttribute('data-n', '0');
  await expect(view()).toBeHidden();
  await expect(sheets()).toHaveCount(0);
  await expect(papers().first()).toBeVisible();
  await page.keyboard.press('x'); await expect(count()).toHaveAttribute('data-n', '1');
  await page.keyboard.press('Shift+X'); await expect(count()).toHaveAttribute('data-n', '0');
});

test('the decision slip can never be stowed: no control, drag or key', async () => {
  const slip = page.locator('#desk-surface .paper[data-pid="ask"]');
  await expect(slip).toBeVisible();
  await expect(slip.locator('.stow-btn')).toHaveCount(0);
  const g = await slip.locator('.grip').boundingBox(), b = await page.locator('#stow-box').boundingBox();
  await page.mouse.move(g.x + 20, g.y + 8); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await expect(page.locator('#stow-box')).not.toHaveClass(/drop/);
  await page.mouse.up();
  // raising the slip last (a click on it) must not make X pick it
  await slip.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('x');
  await expect(slip).toBeVisible();
  await expect(count()).toHaveAttribute('data-n', '1');
  while (await page.locator('#desk-surface .paper:not([data-pid="ask"])').count()) await page.keyboard.press('x');
  await page.keyboard.press('x');
  await expect(slip).toBeVisible();
  await expect(count()).not.toHaveAttribute('data-n', '0');
  await page.locator('#stow-box').click();
  await expect(page.locator('#stow-view .stow-card[data-pid="ask"]')).toHaveCount(0);
  await expect(page.locator('#stow-view .stow-card', { hasText: /the ask/i })).toHaveCount(0);
  await page.keyboard.press('Shift+X');
  await expect(view()).toBeHidden();
  await expect(count()).toHaveAttribute('data-n', '0');
});
