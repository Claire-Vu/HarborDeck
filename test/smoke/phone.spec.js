// Ship phone: the shortcut opens it centered with the pad focused, dialing picks the first mate, Enter sends
// one `request` line (Alt+Enter or a time queues it in the scheduler instead), Esc/the shortcut hangs up keeping the draft, and the main-process
// hotkey (fired through its test seam, never registered system-wide in headless runs) opens it without showing the window.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
const KEY = process.platform === 'darwin' ? 'Meta+Shift+Space' : 'Control+Shift+Space';
let app, page, home;
test.describe.configure({ mode: 'serial' });

const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-phone-'));
  home = seedDemo(path.join(tmp, 'home'));
  // queueing may start keep-awake: a stub, never the real caffeinate
  const caffeinate = path.join(tmp, 'caffeinate-stub'); fs.writeFileSync(caffeinate, '#!/bin/sh\nsleep 120\n'); fs.chmodSync(caffeinate, 0o755);
  app = await launchApp({ home, profile: path.join(tmp, 'profile'), env: { HARBORDECK_CAFFEINATE: caffeinate, HARBORDECK_WAKE_COMMAND: 'true' } });
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
  await expect(page.locator('.toast')).toHaveCount(0); // the ticket on the rail is the feedback
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
  await page.locator('#btn-menu').click();
  await page.locator('#btn-settings').click();
  await expect(page.locator('.settings input').nth(3)).toHaveValue('CommandOrControl+Shift+K');
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press(KEY);
  await expect(page.locator('#phone')).toHaveCount(0);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
  await expect(page.locator('#phone .phone-box')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('queue at a time from the keyboard: Tab to the time, digits never dial, Enter queues it in the scheduler', async () => {
  const before = answers().length;
  await page.locator('#btn-phone').click();
  await page.locator('.phone-pad').fill(''); // an earlier test left a draft
  await page.keyboard.press('2');
  const dial = page.locator('.dial-pos[aria-checked="true"]');
  await expect(dial).toHaveAttribute('data-mate', 'mate-web');
  await page.keyboard.type('Rotate the staging keys');
  await expect(page.getByRole('button', { name: 'Queue at time' })).toBeDisabled();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Queue for after reset' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Send at time')).toBeFocused();
  await page.keyboard.type('0345'); await page.keyboard.press('a'); // fills the time field (am, where the locale asks): the dial stays on the Web mate
  await expect(dial).toHaveAttribute('data-mate', 'mate-web');
  await expect(page.getByRole('button', { name: 'Queue at time' })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.locator('#phone')).toHaveCount(0);
  await expect(page.locator('#rail .ticket.queued', { hasText: 'Rotate the staging keys' })).toBeVisible();
  await expect(page.locator('#sched-chip')).toContainText('queued');
  expect(answers().length).toBe(before); // held in the scheduler, nothing sent yet
  const queued = fs.readdirSync(path.join(home, 'schedule', 'queue')).map(f => JSON.parse(fs.readFileSync(path.join(home, 'schedule', 'queue', f), 'utf8')));
  const q = queued.find(x => x.request?.note === 'Rotate the staging keys');
  expect(q.request).toMatchObject({ to: 'mate-web', id: expect.stringMatching(/^req-\d+-\d+$/) });
  // the scheduler chip opens the phone again
  await page.locator('#sched-chip').click();
  await expect(page.locator('#phone .phone-box')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('no Requests tab: the phone is the one place to write an order', async () => {
  await expect(page.locator('.tab[data-tab="requests"]')).toHaveCount(0);
  await expect(page.locator('#requests-pane')).toHaveCount(0);
});

test('Remember this: the toggle makes the request a standing order (rule: true), pinned on its ticket and in the orders list', async () => {
  const before = answers().length;
  await page.locator('#btn-phone').click();
  await page.locator('.phone-pad').fill('');
  await page.keyboard.type('Never use max effort for routine tasks');
  const box = page.getByLabel('Remember this');
  await expect(box).not.toBeChecked(); // off by default: most messages are one-offs
  await box.check();
  await page.locator('.phone-pad').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#phone')).toHaveCount(0);
  const line = answers().at(-1);
  expect(answers().length).toBe(before + 1);
  expect(line).toMatchObject({ action: 'request', note: 'Never use max effort for routine tasks', rule: true });
  const ticket = page.locator('#rail .ticket', { hasText: 'Never use max effort' });
  await expect(ticket.locator('.tk-pin')).toBeVisible();
  // a plain message after it carries no rule and no pin; the toggle does not stick
  await page.locator('#btn-phone').click();
  await expect(page.getByLabel('Remember this')).not.toBeChecked();
  await page.keyboard.type('Just a one-off');
  await page.keyboard.press('Enter');
  expect('rule' in answers().at(-1)).toBe(false);
  await expect(page.locator('#rail .ticket', { hasText: 'Just a one-off' }).locator('.tk-pin')).toHaveCount(0);
  // once the agent records it in rules.json (answer = the line id) the desk lists it with a pin
  const rules = JSON.parse(fs.readFileSync(path.join(home, 'rules.json'), 'utf8'));
  rules['no-max-effort'] = { text: 'Never use max effort for routine tasks.', source: 'preferences.md', answer: line.id };
  fs.writeFileSync(path.join(home, 'rules.json'), JSON.stringify(rules));
  await page.locator('#btn-menu').click();
  await page.locator('#btn-orders').click();
  const row = page.locator('#orders-content .rule[data-rule="no-max-effort"]');
  await expect(row).toBeVisible();
  await expect(row.locator('.mark')).toHaveText('📌');
  await expect(row).toContainText('sent by you');
  await expect(page.locator('#orders-content .rule:not(.sent):not(.ok):not(.flag) .mark').first()).toHaveText('§');
  await expect(ticket.locator('.tk-pin')).toHaveAttribute('title', /recorded/);
});
