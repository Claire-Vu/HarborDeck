// Launches the app against a temp data dir, checks the desk renders, a stamp lands in answers.jsonl after the
// undo hold, and a file written by an "agent" shows up live.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp, ROOT } = require('./launch');
let app, page, home, profile, caffeinate;
test.describe.configure({ mode: 'serial' }); // one app instance walks through the day

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-smoke-'));
  home = seedDemo(path.join(tmp, 'home')); profile = path.join(tmp, 'profile');
  // keep-awake runs a stub, never the real caffeinate
  caffeinate = path.join(tmp, 'caffeinate-stub'); fs.writeFileSync(caffeinate, '#!/bin/sh\nsleep 120\n'); fs.chmodSync(caffeinate, 0o755);
  app = await launchApp({ home, profile, env: { HARBORDECK_CAFFEINATE: caffeinate, HARBORDECK_WAKE_COMMAND: 'true' } });
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

test('headless: the window is never shown yet still paints', async () => {
  test.skip(process.env.HARBORDECK_HEADLESS === '0', 'watching run');
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  expect((await page.screenshot()).length).toBeGreaterThan(10000);
});

test('morning manifest opens, then the desk fills from the data dir', async () => {
  await expect(page.locator('.modal .box h2', { hasText: 'Morning manifest' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the office' }).click();
  await expect(page.locator('#queue li').first()).toBeVisible();
  // queue order: priority lifted one step per worker waiting on the item, then due date; the P1 merge a crew waits on is first
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Merge PR 142 (calmer checkout)?');
  await page.locator('#queue li', { hasText: 'Sign the app store' }).click();
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
  // the Claude Code status line snapshot adds Claude's windows; a fresher reading of the same window wins
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([{ name: 'Claude', window: '5h', used_pct: 50, resets_at: t + 3600, at: t - 600 }, { name: 'Claude', window: '7d', used_pct: 30, resets_at: t + 5 * 86400, at: t - 3 * 3600 }]));
  fs.mkdirSync(path.join(home, 'schedule'), { recursive: true });
  fs.writeFileSync(path.join(home, 'schedule', 'rate-limits.json'), JSON.stringify({ default: { at: t, rate_limits: { five_hour: { used_percentage: 20, resets_at: t + 3600 } } } }));
  const subs = page.locator('#stamina-cluster .mini-sub');
  await expect(subs.nth(0).locator('.ms-pct')).toHaveText('80%', { timeout: 8000 });
  await expect(page.locator('#stamina-cluster .ms-prov')).toHaveText(['Claude']);
  await expect(subs.nth(0)).toHaveAttribute('title', /^Claude · 5h: 80% left \(20% used\)[^]*Claude Code status line, just now/);
  await expect(subs.nth(1).locator('.ms-name')).toHaveText('week');
  await expect(subs.nth(1).locator('.ms-stale')).toHaveText('stale');
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
  // a reply in the same second as the ask still counts (timestamps are whole seconds)
  const askAt = JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').pop()).at;
  it.thread = [...(it.thread || []), { from: 'Web mate', text: 'Never locally; only on the slow runner.', at: askAt }];
  fs.writeFileSync(itemFile, JSON.stringify(it));
  await expect(page.locator('#rail .ticket.replied.new', { hasText: 'Quarantine' })).toBeVisible({ timeout: 8000 });
});

test('queue for after reset: countdown ticket, delivered by tick, then replied', async () => {
  const t = Math.floor(Date.now() / 1000);
  const reset = t + 2 * 3600 + 14 * 60 + 30;
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([{ name: 'Solo', window: '5h', used_pct: 100, resets_at: reset }]));
  await page.locator('#btn-phone').click();
  await page.locator('.phone-pad').fill('Write the weekly digest');
  await page.keyboard.press('Alt+Enter'); // the phone's queue-for-reset key
  await expect(page.locator('#phone')).toHaveCount(0);
  const ticket = page.locator('#rail .ticket.queued', { hasText: 'Write the weekly digest' });
  await expect(ticket).toBeVisible();
  await expect(ticket.locator('.tk-foot')).toHaveText(/waiting for reset · 2h 1[56]m/);
  await expect(page.locator('#sched-chip')).toContainText('1 queued');
  await expect(page.locator('#sched-chip')).toContainText('☕');
  await page.screenshot({ path: path.join(os.tmpdir(), 'harbordeck-queued.png') });
  for (const width of [1280, 1180, 960, 1280]) {
    await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setContentSize(w, 760), width);
    await page.waitForFunction(w => window.innerWidth === w, width);
    expect(await page.evaluate(() => document.querySelector('.topbar').getBoundingClientRect().height)).toBeLessThan(50);
    expect(await page.evaluate(() => document.querySelector('.topbar').scrollWidth <= window.innerWidth)).toBe(true);
  }
  // nothing reached the agent yet
  const file = path.join(home, 'answers.jsonl');
  expect(fs.readFileSync(file, 'utf8')).not.toContain('Write the weekly digest');
  // the reset passes: one tick delivers it with no prompt
  const sched = await import(path.join(ROOT, 'cli', 'src', 'scheduler.js'));
  const r = await sched.tick(home, { ...process.env, HARBORDECK_WAKE_COMMAND: 'true', HARBORDECK_CAFFEINATE: caffeinate }, reset + 91);
  expect(r.delivered).toEqual([`limit-${reset}`, expect.stringMatching(/^reset-req-/)]);
  const line = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l)).find(a => a.note === 'Write the weekly digest');
  expect(line).toMatchObject({ action: 'request' });
  const sent = page.locator('#rail .ticket.waiting', { hasText: 'Write the weekly digest' });
  await expect(sent).toBeVisible({ timeout: 8000 });
  await expect(sent.locator('.tk-foot')).toContainText('sent');
  await expect(page.locator('#rail .ticket.queued')).toHaveCount(0);
  // the agent replies with an item carrying the request id
  fs.writeFileSync(path.join(home, 'items', `${line.id}.json`), JSON.stringify({ id: line.id, kind: 'answer', project: 'x', title: 'Weekly digest', summary: 'Drafted.', created: Math.floor(Date.now() / 1000), status: 'open' }));
  await expect(page.locator('#rail .ticket.replied', { hasText: 'Write the weekly digest' })).toBeVisible({ timeout: 8000 });
});
