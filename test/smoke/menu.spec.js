// Header menu: the top bar keeps only status + phone + one menu button; everything else lives in the `M` menu,
// keeps its shortcut, and nothing overflows at narrow widths.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
let app, page;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-menu-'));
  const home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('header holds only the phone and the menu button; the rest is in the menu', async () => {
  await expect(page.locator('.topbar button.ibtn-top')).toHaveCount(2);
  await expect(page.locator('#menu')).toBeHidden();
  await page.locator('#btn-menu').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#btn-menu')).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['inspect', 'plain', 'shop', 'orders', 'vault', 'ledger', 'log', 'sound', 'music', 'theme', 'settings']) await expect(page.locator(`#menu #btn-${id}`)).toBeVisible();
  await expect(page.locator('#menu #music-vol')).toBeVisible();
  await expect(page.locator('#btn-inspect .kbd')).toHaveText('I');
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeHidden();
});

test('M toggles the menu; items act and close it, toggles stay open', async () => {
  await page.keyboard.press('m');
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#btn-theme').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#btn-theme .mi-l')).not.toHaveText('Theme: auto');
  await page.locator('#btn-vault').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#vault')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await page.keyboard.press('m');
  await expect(page.locator('#menu')).toBeHidden();
});

test('existing shortcuts still work with the menu closed', async () => {
  await page.keyboard.press('r');
  await expect(page.locator('#orders')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  await expect(page.locator('body')).toHaveClass(/inspect/);
  await page.keyboard.press('i');
  await page.keyboard.press('l');
  await expect(page.locator('.modal.ledger')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('no overflow at narrow widths, menu stays inside the window', async () => {
  for (const width of [1280, 1120, 960, 900]) {
    await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setContentSize(w, 760), width);
    await page.waitForFunction(w => window.innerWidth === w, width);
    expect(await page.evaluate(() => document.querySelector('.topbar').scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('m');
    const r = await page.locator('#menu').boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
  }
});
