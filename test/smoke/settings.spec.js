// Settings dialog: four sections, web hosts as chips, folders shown by name with Reset, Esc while recording the phone
// shortcut cancels only the recording, the on-answer hook under Advanced; Save writes every field, Cancel none.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp } = require('./launch');

let app, page, home;
test.describe.configure({ mode: 'serial' });
const settings = () => page.evaluate(() => window.harbor.getSettings());
const open = async () => { await page.locator('#btn-menu').click(); await page.locator('#btn-settings').click(); await expect(page.locator('.modal.settings-modal')).toBeVisible(); };
const dialog = () => page.locator('.modal.settings-modal');

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-settings-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('grouped sections; the data dir being read is shown; Advanced starts folded while the hook is off', async () => {
  await open();
  for (const s of ['General', 'Phone', 'Agent connection']) await expect(dialog().getByRole('region', { name: s })).toBeVisible();
  await expect(dialog().locator('.set-reading code')).toHaveText(home);
  await expect(dialog().locator('.set-adv')).not.toHaveAttribute('open', '');
  await expect(dialog().getByRole('button', { name: /Phone shortcut/ }).locator('kbd')).toHaveCount(3);
  await dialog().getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog()).toHaveCount(0);
});

test('hosts are chips: Enter or comma adds, × removes, Save writes the list; Cancel writes nothing', async () => {
  await open();
  const add = dialog().getByLabel('Add a web host');
  await add.fill('devbox.lan:8080'); await add.press('Enter');
  await add.fill('Build.Lan,'); await add.press(',');
  await add.fill('scratch.lan'); await add.press('Enter');
  await expect(dialog().locator('.chip-host')).toHaveText(['devbox.lan:8080×', 'build.lan×', 'scratch.lan×']);
  await dialog().getByRole('button', { name: 'Remove scratch.lan' }).click();
  await dialog().getByRole('button', { name: 'Cancel' }).click();
  expect((await settings()).webHosts).toEqual([]);
  await open();
  await add.fill('devbox.lan:8080'); await add.press('Enter');
  await add.fill('typed.lan'); // still in the field at Save: kept
  await dialog().getByRole('button', { name: 'Save' }).click();
  expect((await settings()).webHosts).toEqual(['devbox.lan:8080', 'typed.lan']);
  await open();
  await expect(dialog().locator('.chip-host')).toHaveCount(2);
  await dialog().getByRole('button', { name: 'Cancel' }).click();
});

test('folders show name and parent; Reset falls back to the default and Save clears it', async () => {
  await page.evaluate(async () => { const s = await window.harbor.getSettings(); await window.harbor.setSettings({ ...s, artifactRoot: '/srv/work/artifacts' }); });
  await open();
  const fp = dialog().locator('.set-row', { hasText: 'Artifact folder' });
  await expect(fp.locator('.fp-name')).toHaveText('artifacts');
  await expect(fp.locator('.fp-where')).toHaveText('/srv/work');
  await fp.getByRole('button', { name: 'Reset' }).click();
  await expect(fp.locator('.fp-name')).toHaveText('Not set');
  await expect(fp.getByRole('button', { name: 'Reset' })).toBeHidden();
  await dialog().getByRole('button', { name: 'Save' }).click();
  expect((await settings()).artifactRoot).toBe('');
});

test('Esc while recording cancels the recording, not the dialog; Off clears the shortcut', async () => {
  await open();
  const rec = dialog().getByRole('button', { name: /Phone shortcut/ });
  await rec.click();
  await expect(rec).toHaveClass(/rec/);
  await page.keyboard.press('Escape');
  await expect(rec).not.toHaveClass(/rec/);
  await expect(dialog()).toBeVisible();
  await expect(rec).toHaveAttribute('data-accel', 'CommandOrControl+Shift+Space');
  await dialog().getByRole('button', { name: 'Off' }).click();
  await expect(rec).toContainText('top-bar icon only');
  await dialog().getByRole('button', { name: 'Save' }).click();
  expect((await settings()).phoneShortcut).toBe('');
});

test('on-answer hook under Advanced: switch + command saved; Advanced opens by itself once it is on', async () => {
  await open();
  await dialog().locator('.set-adv summary').click();
  await dialog().getByLabel('Run a command on every answer').check();
  await dialog().getByLabel('On-answer command').fill('/bin/true');
  await dialog().getByRole('button', { name: 'Save' }).click();
  expect((await settings()).onAnswer).toEqual({ enabled: true, command: '/bin/true' });
  await open();
  await expect(dialog().locator('.set-adv')).toHaveAttribute('open', '');
  await expect(dialog().locator('.set-adv .set-sub')).toHaveText('on answer: on');
  await dialog().getByRole('button', { name: 'Cancel' }).click();
});
