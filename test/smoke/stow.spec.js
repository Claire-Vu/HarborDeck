// Storage box: papers stow by control, key and drag; the box counts them; one or all come back; it survives a reload.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
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

test('stow by control, key and drag; count; restore one, restore all', async () => {
  await expect(count()).toHaveAttribute('data-n', '0');
  const n0 = await papers().count();
  expect(n0).toBeGreaterThan(2);
  // control
  await papers().first().locator('.stow-btn').click();
  await expect(papers()).toHaveCount(n0 - 1);
  await expect(count()).toHaveAttribute('data-n', '1');
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
  // restore one
  await page.locator('#stow-box').click();
  await expect(page.locator('#stow-list .stowed')).toHaveCount(3);
  await page.locator('#stow-list .stowed').first().click();
  await expect(papers()).toHaveCount(n0 - 2);
  await expect(count()).toHaveAttribute('data-n', '2');
});

test('stowed state survives a reload; bring all back', async () => {
  await page.reload();
  await expect(count()).toHaveAttribute('data-n', '2');
  await page.locator('#stow-box').click();
  await page.locator('#stow-list .all').click();
  await expect(count()).toHaveAttribute('data-n', '0');
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
  await expect(page.locator('#stow-list button', { hasText: /ask/i })).toHaveCount(0);
  await page.keyboard.press('Shift+X');
  await expect(count()).toHaveAttribute('data-n', '0');
});
