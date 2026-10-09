// A paper dragged past the desk edge stops with its whole grab handle on the desk, so it can always be grabbed again.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
let app, page;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-clamp-'));
  app = await launchApp({ home: seedDemo(path.join(tmp, 'home')), profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
  await expect(page.locator('#desk-surface .paper.manifest')).toBeVisible();
  await page.waitForTimeout(1000); // deal-in animation
});
test.afterAll(async () => { await app?.close(); });

const gripBox = () => page.locator('#desk-surface .paper.manifest .grip').first().boundingBox();
const deskBox = () => page.locator('#desk-surface').boundingBox();
async function drag(dx, dy) {
  const b = await gripBox(); const x = b.x + 40, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / 2, y + dy / 2); await page.mouse.move(x + dx, y + dy); await page.mouse.up();
}
const inside = async () => { const g = await gripBox(), d = await deskBox(); if (!g) return false; return g.y >= d.y - 1 && g.y + g.height <= d.y + d.height + 1 && g.x >= d.x - 1 && g.x + g.width <= d.x + d.width + 1; };

test('dragging a paper above the desk stops at the top edge and it can be grabbed again', async () => {
  await drag(0, -900);
  expect(await inside()).toBe(true);
  const before = await gripBox();
  await drag(60, 120);
  const after = await gripBox();
  expect(after.y).toBeGreaterThan(before.y + 50);
});

test('dragging past the side and bottom edges keeps the handle on the desk', async () => {
  await drag(3000, 3000);
  expect(await inside()).toBe(true);
  await drag(-3000, 3000);
  expect(await inside()).toBe(true);
});

test('shrinking the window pulls a far paper back in', async () => {
  await drag(3000, 3000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1000, 600));
  await expect.poll(inside, { timeout: 5000 }).toBe(true);
  await page.waitForTimeout(1000); // deal-in finished: still inside
  expect(await inside()).toBe(true);
});
