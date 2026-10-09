// A pick made right after a stamp (during the leave animation) must win over the auto-advance.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp } = require('./launch');

let app, page;
test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-race-'));
  const home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile'), env: { HARBORDECK_WAKE_COMMAND: 'true' } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 760));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

const title = page => page.locator('#desk-surface .paper.manifest h3');

test('selecting an item right after a stamp is not overridden by the auto-advance', async () => {
  await page.locator('#queue li', { hasText: 'Merge PR 142' }).click();
  await page.keyboard.press('1');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await page.locator('#queue li', { hasText: 'Renew the domain' }).click();
  await expect(title(page)).toHaveText('Renew the domain before it lapses');
  await page.waitForTimeout(2500); // past the leave animation
  await expect(title(page)).toHaveText('Renew the domain before it lapses');
  await expect(page.locator('#desk-surface .paper.leaving')).toHaveCount(0);
});

test('without a pick the desk still advances, and undo during the hold still works', async () => {
  await page.locator('#queue li', { hasText: 'Pick a logo direction' }).click();
  await page.keyboard.press('2');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await expect(title(page)).not.toHaveText('Pick a logo direction', { timeout: 4000 });
  await page.keyboard.press('u');
  await expect(title(page)).toHaveText('Pick a logo direction');
});
