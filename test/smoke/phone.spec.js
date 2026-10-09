// Ship phone: the shortcut opens it centered with the pad focused, dialing picks the first mate, Enter sends the
// same `request` line the Requests tab writes, Esc/the shortcut hangs up keeping the draft, and the main-process
// hotkey (fired through its test seam, never registered system-wide in headless runs) opens it without showing the window.
const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const ROOT = path.join(__dirname, '..', '..');
const KEY = process.platform === 'darwin' ? 'Meta+Shift+Space' : 'Control+Shift+Space';
let app, page, home;
test.describe.configure({ mode: 'serial' });

const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-phone-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await electron.launch({ args: [ROOT], env: { ...process.env, HARBORDECK_HEADLESS: process.env.HARBORDECK_HEADLESS ?? '1', HARBORDECK_HOME: home, HARBORDECK_USER_DATA: path.join(tmp, 'profile') } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('the shortcut brings the phone up centered with the pad focused, and puts it back', async () => {
  await expect(page.locator('#phone')).toHaveCount(0);
  await page.keyboard.press(KEY);
  await expect(page.locator('#phone .phone-box')).toBeVisible();
  await expect(page.locator('.phone-pad')).toBeFocused();
  const box = await page.locator('#phone .phone-box').boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(4);
  await expect(page.locator('#btn-phone')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press(KEY);
  await expect(page.locator('#phone')).toHaveCount(0);
  await expect(page.locator('#btn-phone')).toHaveAttribute('aria-expanded', 'false');
});

test('dial by number and arrows, digits type once speaking, Enter sends one request line', async () => {
  const before = answers().length;
  await page.locator('#btn-phone').click();
  const dial = page.locator('.dial-pos[aria-checked="true"]');
  await expect(dial).toHaveAttribute('data-mate', 'mate-main');
  await page.keyboard.press('3');
  await expect(dial).toHaveAttribute('data-mate', 'mate-growth');
  await page.keyboard.press('ArrowLeft');
  await expect(dial).toHaveAttribute('data-mate', 'mate-web');
  await page.keyboard.type('Ship 2 fixes');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('today');
  await expect(dial).toHaveAttribute('data-mate', 'mate-web'); // the 2 was typed, not dialed
  await page.keyboard.press('Enter');
  await expect(page.locator('#phone')).toHaveCount(0);
  await expect(page.locator('#btn-phone.sent')).toBeVisible();
  await expect(page.locator('.toast', { hasText: 'Order handed to' })).toBeVisible();
  const lines = answers();
  expect(lines.length).toBe(before + 1); // no undo hold, nothing else written
  expect(lines.at(-1)).toMatchObject({ action: 'request', note: 'Ship 2 fixes\ntoday', to: 'mate-web' });
  expect(lines.at(-1).id).toMatch(/^req-\d+-\d+$/);
  await expect(page.locator('#rail .ticket', { hasText: 'Ship 2 fixes' })).toBeVisible();
});

test('remembers the last dialed, Esc keeps the draft, desk keys stay still under the phone', async () => {
  const before = answers().length;
  await page.keyboard.press(KEY);
  await expect(page.locator('.dial-pos[aria-checked="true"]')).toHaveAttribute('data-mate', 'mate-web');
  await page.keyboard.type('half a thought');
  await page.keyboard.press('Escape');
  await expect(page.locator('#phone')).toHaveCount(0);
  await page.keyboard.press(KEY);
  await expect(page.locator('.phone-pad')).toHaveValue('half a thought');
  await page.locator('.dial-pos[data-mate="mate-main"]').focus();
  await page.keyboard.press('1'); // dials, never stamps the item on the desk
  await expect(page.locator('.dial-pos[aria-checked="true"]')).toHaveAttribute('data-mate', 'mate-main');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.locator('.toast.undo')).toHaveCount(0);
  expect(answers().length).toBe(before);
});

test('the main-process hotkey opens the phone; a headless run never shows the window or registers it', async () => {
  await app.evaluate(({ app: a }) => a.emit('harbor:phone-hotkey'));
  await expect(page.locator('#phone .phone-box')).toBeVisible();
  if (process.env.HARBORDECK_HEADLESS !== '0') {
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('CommandOrControl+Shift+Space'))).toBe(false);
    expect((await page.evaluate(() => window.harbor.getSettings())).phoneKey).toBe('off');
  }
  await page.keyboard.press('Escape');
});

test('the shortcut is a setting: a new one opens the phone, the old one no longer does', async () => {
  await page.evaluate(async () => { const s = await window.harbor.getSettings(); await window.harbor.setSettings({ ...s, phoneShortcut: 'CommandOrControl+Shift+K' }); });
  await page.evaluate(() => window.harbor.snapshot()); // the renderer reads settings from snapshots
  await page.locator('#btn-settings').click();
  await expect(page.locator('.settings input').nth(3)).toHaveValue('CommandOrControl+Shift+K');
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press(KEY);
  await expect(page.locator('#phone')).toHaveCount(0);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
  await expect(page.locator('#phone .phone-box')).toBeVisible();
  await page.keyboard.press('Escape');
});
