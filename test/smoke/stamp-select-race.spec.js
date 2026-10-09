// A pick made right after a stamp (during the leave animation) must win over the auto-advance.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp } = require('./launch');

let app, page, home;
const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-race-'));
  home = seedDemo(path.join(tmp, 'home'));
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

test('undo pressed during the stamp flight (a quick "oops") cancels it: no line is written, the item stays', async () => {
  await page.locator('#queue li', { hasText: 'Rename the repo' }).click();
  await expect(title(page)).toHaveText('Rename the repo to match the product name?');
  const before = answers().length;
  await page.keyboard.press('2');
  await page.keyboard.press('u'); // well inside the 380 ms flight, before the undo chip shows
  await page.waitForTimeout(5000); // past the hold
  expect(answers().length).toBe(before);
  await expect(title(page)).toHaveText('Rename the repo to match the product name?');
  await expect(page.locator('#queue li', { hasText: 'Rename the repo' })).toHaveCount(1);
  await expect(page.locator('.toast.undo')).toHaveCount(0);
});
