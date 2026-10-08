// Launches the app against a temp data dir, checks the desk renders, a stamp lands in answers.jsonl after the
// undo hold, and a file written by an "agent" shows up live.
const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const ROOT = path.join(__dirname, '..', '..');
let app, page, home, profile;
test.describe.configure({ mode: 'serial' }); // one app instance walks through the day

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-smoke-'));
  home = seedDemo(path.join(tmp, 'home')); profile = path.join(tmp, 'profile');
  app = await electron.launch({ args: [ROOT], env: { ...process.env, HARBORDECK_HOME: home, HARBORDECK_USER_DATA: profile } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 760));
});
test.afterAll(async () => { await app?.close(); });

test('security: renderer has no node, preload bridge only', async () => {
  expect(await page.evaluate(() => typeof require)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.harbor.appendAnswer)).toBe('function');
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(prefs.contextIsolation).toBe(true);
  expect(prefs.nodeIntegration).toBe(false);
});

test('morning manifest opens, then the desk fills from the data dir', async () => {
  await expect(page.locator('.modal .box h2', { hasText: 'Morning manifest' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the office' }).click();
  await expect(page.locator('#queue li').first()).toBeVisible();
  // queue order: priority, then due date; the overdue P1 notice is first
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Sign the app store developer agreement');
  await page.locator('#queue li', { hasText: 'Merge PR 142' }).click();
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Merge PR 142 (calmer checkout)?');
  // top bar stays on one row
  for (const width of [1280, 1180, 960, 1280]) {
    await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setContentSize(w, 760), width);
    await page.waitForFunction(w => window.innerWidth === w, width);
    expect(await page.evaluate(() => document.querySelector('.topbar').getBoundingClientRect().height)).toBeLessThan(50);
  }
});

test('local media is served through harbor://', async () => {
  const img = page.locator('#desk-surface .paper.photo img').first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
});

test('stamp writes one line to answers.jsonl after the undo hold', async () => {
  const file = path.join(home, 'answers.jsonl');
  const before = fs.readFileSync(file, 'utf8').trim().split('\n').length;
  await page.keyboard.press('1');
  await expect(page.locator('.toast.undo')).toBeVisible();
  expect(fs.readFileSync(file, 'utf8').trim().split('\n').length).toBe(before); // held, not written
  await expect.poll(() => fs.readFileSync(file, 'utf8').trim().split('\n').length, { timeout: 8000 }).toBe(before + 1);
  const last = JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').pop());
  expect(last).toMatchObject({ id: 'pr-142-checkout', action: 'decide', key: 'merge' });
});

test('undo writes nothing', async () => {
  const file = path.join(home, 'answers.jsonl');
  const before = fs.readFileSync(file, 'utf8');
  await page.locator('#queue li', { hasText: 'Pick a logo direction' }).click();
  await page.keyboard.press('2');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await page.keyboard.press('u');
  await page.waitForTimeout(4600);
  expect(fs.readFileSync(file, 'utf8')).toBe(before);
});

test('new item and thread replies appear live', async () => {
  const t = Math.floor(Date.now() / 1000);
  fs.writeFileSync(path.join(home, 'items', 'live-1.json'), JSON.stringify({ id: 'live-1', kind: 'todo', project: 'x', title: 'Live item from the agent', summary: 'Arrived while open.', priority: 1, created: t, status: 'open' }));
  await expect(page.locator('#queue li', { hasText: 'Live item from the agent' })).toBeVisible({ timeout: 8000 });
  // the newsletter ask in the seed already has its reply, so its ticket is green
  await expect(page.locator('#rail .ticket.replied')).toHaveCount(1);
});

test('fleet and stamina snapshots update live', async () => {
  const t = Math.floor(Date.now() / 1000);
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([{ name: 'Solo', window: '5h', used_pct: 95, resets_at: t + 3600 }]));
  await expect(page.locator('#stamina-cluster .mini-sub')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('#stamina-cluster')).toHaveClass(/empty/);
  const fleet = JSON.parse(fs.readFileSync(path.join(home, 'fleet.json'), 'utf8'));
  fleet.crew = fleet.crew.map(c => ({ ...c, state: 'working' }));
  fs.writeFileSync(path.join(home, 'fleet.json'), JSON.stringify(fleet));
  await expect(page.locator('#yard .yc.cook')).toHaveCount(fleet.crew.length, { timeout: 8000 });
});

test('an ask becomes a ticket, and the agent reply turns it green live', async () => {
  await page.locator('#queue li', { hasText: 'Quarantine the flaky' }).click();
  await page.keyboard.press('4');
  await page.locator('.modal.noteslip textarea').fill('how often does it fail locally?');
  await page.getByRole('button', { name: 'Send' }).click();
  const file = path.join(home, 'answers.jsonl');
  await expect.poll(() => fs.readFileSync(file, 'utf8').includes('how often does it fail locally?'), { timeout: 8000 }).toBe(true);
  await expect(page.locator('#rail .ticket.waiting', { hasText: 'Quarantine' })).toBeVisible();
  const itemFile = path.join(home, 'items', 'flaky-e2e.json');
  const it = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
  it.thread = [...(it.thread || []), { from: 'Web mate', text: 'Never locally; only on the slow runner.', at: Math.floor(Date.now() / 1000) + 1 }];
  fs.writeFileSync(itemFile, JSON.stringify(it));
  await expect(page.locator('#rail .ticket.replied.new', { hasText: 'Quarantine' })).toBeVisible({ timeout: 8000 });
});
