// A snapshot pushed while the captain types is held until focus leaves the field. A newer snapshot applied in the
// meantime (here: the one the phone gets back when it queues an order) must win: the held one is dropped, so the
// queued ticket never blinks off the rail when the phone closes.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
let app, page, home;

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-held-'));
  home = seedDemo(path.join(tmp, 'home'));
  const caffeinate = path.join(tmp, 'caffeinate-stub'); fs.writeFileSync(caffeinate, '#!/bin/sh\nsleep 120\n'); fs.chmodSync(caffeinate, 0o755);
  app = await launchApp({ home, profile: path.join(tmp, 'profile'), env: { HARBORDECK_CAFFEINATE: caffeinate, HARBORDECK_WAKE_COMMAND: 'true' } });
  page = await app.firstWindow();
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('a snapshot held while typing never overwrites the newer one the phone queued with', async () => {
  await page.locator('#btn-phone').click();
  await page.locator('.phone-pad').fill('Write the weekly digest');
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([{ name: 'Solo', window: '5h', used_pct: 100, resets_at: Math.floor(Date.now() / 1000) + 8000 }]));
  await page.waitForFunction(() => deferred !== null); // the watcher's snapshot arrived while the pad has focus: held
  await page.evaluate(() => { window.__queued = []; new MutationObserver(() => window.__queued.push(document.querySelectorAll('#rail .ticket.queued').length)).observe(document.querySelector('#rail'), { childList: true, subtree: true }); });
  await page.keyboard.press('Alt+Enter');
  await expect(page.locator('#phone')).toHaveCount(0);
  await expect(page.locator('#rail .ticket.queued', { hasText: 'Write the weekly digest' })).toBeVisible();
  await page.waitForTimeout(300); // past the focusout flush of the held snapshot
  const seen = await page.evaluate(() => window.__queued);
  expect(seen.indexOf(1)).toBeGreaterThanOrEqual(0);
  expect(seen.slice(seen.indexOf(1))).not.toContain(0); // once on the rail, it stays
});
