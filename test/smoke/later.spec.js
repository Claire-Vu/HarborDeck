// Later: the Later stamp opens a slip (tomorrow 9:00, after the next usage reset, or a picked date and time), parked
// items sit on the Parked shelf above the storage box with their return time and Bring back now, and the window never
// says zero waiting while anything is parked. S and Shift+S stay one key; Alt+S opens the slip.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { launchApp, ROOT } = require('./launch');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page, home, reset;
test.describe.configure({ mode: 'serial' });

const hd = (args, input) => execFileSync(process.execPath, [path.join(ROOT, 'cli/bin/harbordeck.js'), ...args], { env: { ...process.env, HARBORDECK_HOME: home }, input });
const answers = () => { const f = path.join(home, 'answers.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []; };
const pick = title => page.locator('#queue li', { hasText: title }).first().click();
const deskTitle = () => page.locator('#desk-surface .paper.manifest h3');
const sill = () => page.locator('#scenes .sc-left');

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-later-'));
  home = path.join(tmp, 'home');
  hd(['todo', 'todo-domain', 'Renew the domain']);
  hd(['todo', 'todo-lease', 'Sign the lease']);
  reset = Math.floor(Date.now() / 1000) + 2 * 3600;
  hd(['quota', '-'], JSON.stringify([{ name: 'Solo', window: '5h', used_pct: 100, resets_at: reset }]));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('the Later stamp opens the slip; a picked date and time parks the item until exactly then', async () => {
  await pick('Renew the domain');
  await page.locator('#stamps .stamp[data-verdict=later]').click();
  const slip = page.locator('.modal.laterslip');
  await expect(slip).toBeVisible();
  await expect(slip.locator('.ls-opt')).toHaveText([/Tomorrow morning.*S/, /After the next usage reset.*⇧S/]);
  await expect(slip.locator('.ls-opt').nth(1)).toBeEnabled();
  const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(14, 30, 0, 0); const until = Math.floor(d / 1000);
  const p = n => String(n).padStart(2, '0');
  await slip.locator('.ls-at').fill(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T14:30`);
  await page.locator('#desk-mode').screenshot({ path: path.join(SHOTS, 'harbordeck-later-slip.png') }).catch(() => {});
  await slip.getByRole('button', { name: 'Park', exact: true }).click();
  await expect(slip).toHaveCount(0);
  await expect(page.locator('#parked-btn')).toBeVisible();
  await expect(page.locator('#parked-n')).toHaveText('1');
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(1);
  expect(answers()[0]).toMatchObject({ id: 'todo-domain', action: 'defer', until });
});

test('the Parked shelf lists it with its return time; the window counts it instead of saying zero', async () => {
  await expect(sill()).toHaveText('1 to zero · 1 parked');
  await page.locator('#parked-btn').click();
  const view = page.locator('#parked-view');
  await expect(view).toBeVisible();
  const until = answers()[0].until;
  const when = await page.evaluate(t => `back ${fmtDate(t)} ${fmtTime(t)}`, until);
  await expect(view.locator('.parked-row')).toHaveCount(1);
  await expect(view.locator('.parked-row .pk-title')).toHaveText('Renew the domain');
  await expect(view.locator('.parked-row .pk-when')).toHaveText(when);
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-parked-shelf.png') });
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  // clear the rest: the window is at zero waiting, but says what is parked
  await pick('Sign the lease');
  await page.keyboard.press(' ');
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(2);
  await expect(sill()).toHaveText('Zero waiting · 1 parked');
  await expect(page.locator('#scenes .sc-zero')).toHaveText('⚑ Zero waiting anywhere · 1 parked');
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-zero-parked.png') });
});

test('Bring back now: back at the desk, nothing written, the shelf empties', async () => {
  await page.locator('#parked-btn').click();
  await page.locator('#parked-view .pk-back').click();
  await expect(deskTitle()).toHaveText('Renew the domain');
  await expect(page.locator('#parked-btn')).toBeHidden();
  await expect(sill()).toHaveText('1 to zero');
  await page.waitForTimeout(500);
  expect(answers().length).toBe(2);
});

test('Shift+S parks until just after the next usage reset', async () => {
  await page.keyboard.press('Shift+S');
  await expect(page.locator('#parked-n')).toHaveText('1');
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(3);
  expect(answers()[2]).toMatchObject({ id: 'todo-domain', action: 'defer', until: reset + 60 });
  await page.locator('#queue li.q-later', { hasText: 'Renew the domain' }).click();
  await expect(deskTitle()).toHaveText('Renew the domain');
});

test('Bring back now during the undo hold is the undo: the Later line never goes out', async () => {
  await page.keyboard.press('s');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await page.locator('#parked-btn').click();
  await page.locator('#parked-view .pk-back').click();
  await expect(page.locator('.toast.undo')).toHaveCount(0);
  await expect(deskTitle()).toHaveText('Renew the domain');
  await page.waitForTimeout(5000); // past the undo hold
  expect(answers().length).toBe(3);
  await expect(page.locator('#parked-btn')).toBeHidden();
});

test('Alt+S opens the slip from the keyboard; Esc leaves the item at the desk', async () => {
  await page.keyboard.press('Alt+s');
  await expect(page.locator('.modal.laterslip')).toBeVisible();
  await expect(page.locator('.modal.laterslip .ls-opt').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal.laterslip')).toHaveCount(0);
  await expect(deskTitle()).toHaveText('Renew the domain');
  expect(answers().length).toBe(3);
});
