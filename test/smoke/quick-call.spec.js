// Quick calls: one keystroke per answer. Space opens the office, letter keys pick options (A-E) with their why
// lines, a task's questions arrive as one question sheet stamped with Space, Later (S) writes a defer line and
// parks the item, Shift+A takes every low-stakes recommendation at once, the queue groups lanes by project with
// weight icons, papers never overlap or print absolute paths, a local .html report opens in the browser pane,
// the ticket rail scrolls with the wheel, and the stamp tray never overlaps at short window heights.
const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page, home;
test.describe.configure({ mode: 'serial' });

const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const size = (w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h]).then(() => page.waitForFunction(([w, h]) => window.innerWidth === w && window.innerHeight === h, [w, h]));
const overlaps = sel => page.evaluate(sel => {
  const r = [...document.querySelectorAll(sel)].map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
  const hits = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) hits.push([i, j]);
  return hits;
}, sel);

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-quick-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await electron.launch({ args: [ROOT], env: { ...process.env, HARBORDECK_HOME: home, HARBORDECK_USER_DATA: path.join(tmp, 'profile') } });
  page = await app.firstWindow();
  await size(1280, 800);
});
test.afterAll(async () => { await app?.close(); });

test('lean manifest: no empty sections; Space opens the office', async () => {
  const sheet = page.locator('.modal.manifest');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('h3', { hasText: 'Galley' })).toBeVisible(); // the seed has crew at work
  await page.keyboard.press(' ');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#desk-surface .paper.manifest h3')).toBeVisible();
});

test('queue: lanes by project, weight icons, no zero-count chips', async () => {
  await expect(page.locator('#queue li.q-lane').first()).toBeVisible();
  const lanes = await page.locator('#queue li.q-lane:not(.later) span:first-child').allTextContents();
  expect(new Set(lanes).size).toBe(lanes.length); // each project once
  expect(lanes).toEqual(expect.arrayContaining(['board-app', 'brand', 'captain']));
  await expect(page.locator('#queue li', { hasText: 'Merge PR 142' }).locator('.wt')).toHaveAttribute('data-weight', /video/);
  await expect(page.locator('#queue li', { hasText: 'Renew the domain' }).locator('.wt')).toHaveAttribute('data-weight', 'quick');
  for (const chip of await page.locator('#filters .chip').allTextContents()) expect(chip).not.toMatch(/ 0$/);
});

test('a single decision: letters pick (with why lines), Space stamps', async () => {
  await page.locator('#queue li', { hasText: 'Quarantine the flaky' }).click();
  await expect(page.locator('#at-window .speech')).toContainText('Quarantine the flaky drag-and-drop test?');
  const slip = page.locator('#desk-surface .paper.ask');
  await expect(slip.locator('label.opt .k')).toHaveText(['A', 'B']);
  await page.keyboard.press('b');
  await expect(slip.locator('label.opt.on')).toContainText('Keep it blocking');
  const before = answers().length;
  await page.keyboard.press(' ');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 1);
  expect(answers().pop()).toMatchObject({ id: 'flaky-e2e', action: 'decide', key: 'keep' });
});

test('question sheet: a task\'s questions as one visitor; letters walk the rows; one Space writes every answer', async () => {
  const row = page.locator('#queue li', { hasText: 'Beta invites: how many' });
  await expect(row.locator('.bundle-n')).toHaveText('+2');
  await row.click();
  await expect(page.locator('#at-window .speech')).toContainText('3 quick calls on Beta invites');
  const sheet = page.locator('#desk-surface .paper.qsheet');
  await expect(sheet.locator('.b-row')).toHaveCount(3);
  await expect(sheet.locator('.why').first()).toHaveText('enough feedback, support stays small');
  await expect(sheet.locator('.b-row.cur .b-title')).toHaveText('Beta invites: how many in the first wave?');
  // the papers follow the row in focus: q1's local HTML report, by file name only
  await expect(page.locator('#desk-surface .paper.prcard.web')).toContainText('waves.html');
  expect(await page.locator('#desk-surface').innerText()).not.toContain(home);
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-question-sheet.png') });
  await page.keyboard.press('b'); // q1: 200 people, focus moves to q2
  await expect(sheet.locator('.b-row.cur .b-title')).toHaveText('Pick by waitlist order or by hand?');
  await page.keyboard.press('a'); // q2: waitlist, focus to q3
  await page.keyboard.press('k'); // back up to q2: still waitlist
  await expect(sheet.locator('.b-row.cur label.opt.on')).toContainText('Waitlist order');
  await page.keyboard.press('j');
  await page.keyboard.press('c'); // q3: both
  await expect(overlaps('#desk-surface .paper')).resolves.toEqual([]);
  const before = answers().length;
  await page.keyboard.press(' ');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 3);
  expect(answers().slice(-3).map(a => [a.id, a.key]).sort()).toEqual([['beta-invites.q1', 'two-hundred'], ['beta-invites.q2', 'waitlist'], ['beta-invites.q3', 'both']]);
  await expect(page.locator('#queue li', { hasText: 'Beta invites' })).toHaveCount(0);
});

test('a local HTML report opens in the browser pane with its own stylesheet and script', async () => {
  fs.writeFileSync(path.join(home, 'items', 'html-1.json'), JSON.stringify({ id: 'html-1', kind: 'answer', project: 'board-app', title: 'Invite waves report', priority: 1, artifacts: [{ type: 'report', path: 'assets/beta/waves.html' }], created: Math.floor(Date.now() / 1000), status: 'open' }));
  const li = page.locator('#queue li', { hasText: 'Invite waves report' });
  await expect(li).toBeVisible({ timeout: 8000 });
  await li.click();
  await page.locator('#desk-surface .paper.web').getByRole('button', { name: 'Open in the desk browser' }).click();
  await expect(page.locator('.modal.web')).toBeVisible();
  const inPane = js => app.evaluate(({ BrowserWindow }, code) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(code), js);
  await expect.poll(() => inPane('document.readyState === "complete" && document.getElementById("state").textContent').catch(() => null)).toBe('script loaded from the same folder');
  expect(await inPane('getComputedStyle(document.querySelector("table")).borderCollapse')).toBe('collapse');
  // nothing outside the report's folder, and no hidden files inside it
  expect(await inPane(`fetch(location.href.replace(/beta\\/waves\\.html$/, "reports/pricing-tiers.md")).then(r => r.status)`)).toBe(404);
  expect(await inPane(`fetch(location.href.replace(/waves\\.html$/, ".secret")).then(r => r.status)`)).toBe(404);
  await page.locator('.modal.web').getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length)).toBe(0);
});

test('Later (S) writes a defer line with until tomorrow 9:00 and parks the item', async () => {
  await page.locator('#queue li', { hasText: 'Renew the domain' }).click();
  const before = answers().length;
  await page.keyboard.press('s');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await expect(page.locator('#queue li.q-later', { hasText: 'Renew the domain' })).toBeVisible();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 1);
  const line = answers().pop();
  const nine = new Date(); nine.setDate(nine.getDate() + 1); nine.setHours(9, 0, 0, 0);
  expect(line).toMatchObject({ id: 'todo-domain', action: 'defer', until: Math.floor(nine / 1000) });
  await expect(page.locator('#queue li:not(.q-later)', { hasText: 'Renew the domain' })).toHaveCount(0);
  // pulled back early by a click: at the desk again, nothing written
  await page.locator('#queue li.q-later', { hasText: 'Renew the domain' }).click();
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Renew the domain before it lapses');
  expect(answers().length).toBe(before + 1);
});

test('Shift+A: every low-stakes recommendation listed first, untick, one stamp, undo writes nothing', async () => {
  await page.keyboard.press('Shift+A');
  const box = page.locator('.modal.sweep');
  await expect(box).toBeVisible();
  const rows = box.locator('.sw-row');
  await expect(rows).toHaveText([/Rename the repo.*Leave it/]); // the only P3-P4 decision with a rec. still open
  await page.keyboard.press('Shift+A');
  await expect(page.locator('.toast.undo')).toBeVisible();
  const before = answers().length;
  await page.keyboard.press('u');
  await page.waitForTimeout(4500);
  expect(answers().length).toBe(before);
  await page.keyboard.press('Shift+A');
  await box.getByRole('button', { name: /Stamp 1 recommended/ }).click();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 1);
  expect(answers().pop()).toMatchObject({ id: 'rename-repo', action: 'decide', key: 'leave' });
});

test('the ship phone is modal: letters, Space, S and Shift+A do nothing while it is up', async () => {
  await page.locator('#queue li', { hasText: 'Pick a logo direction' }).click();
  const before = answers().length;
  await page.locator('#btn-phone').click();
  await expect(page.locator('#phone')).toBeVisible();
  await page.locator('#phone .phone-box').click({ position: { x: 4, y: 4 } }); // focus off the pad
  for (const key of ['c', ' ', 's', 'Shift+A']) await page.keyboard.press(key);
  await expect(page.locator('.modal.sweep')).toHaveCount(0);
  await expect(page.locator('.toast.undo')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#phone')).toHaveCount(0);
  await expect(page.locator('#desk-surface .paper.ask label.opt.on')).toContainText('B · Tide mark');
  await page.waitForTimeout(500);
  expect(answers().length).toBe(before);
});

test('ticket rail: the wheel scrolls it sideways and a count shows what is off screen', async () => {
  const t = Math.floor(Date.now() / 1000);
  const lines = Array.from({ length: 9 }, (_, i) => JSON.stringify({ id: `req-${t}-${i}`, action: 'request', note: `Order number ${i + 1}`, to: 'mate-main', at: t - 60 + i }));
  fs.appendFileSync(path.join(home, 'answers.jsonl'), lines.join('\n') + '\n');
  await expect(page.locator('#rail .ticket', { hasText: 'Order number 9' })).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('#rail-right')).toBeVisible();
  await expect(page.locator('#rail-right')).toHaveText(/\d+ more ›/);
  const rail = page.locator('#rail');
  const x0 = await rail.evaluate(el => el.scrollLeft);
  await rail.hover(); await page.mouse.wheel(0, 600);
  await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(x0);
  // the count is a button too: clicking it pages through until every ticket has been on screen
  for (let i = 0; i < 12 && await page.locator('#rail-right').isVisible(); i++) { await page.locator('#rail-right').click(); await page.waitForTimeout(400); }
  expect(await rail.evaluate(el => el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)).toBe(true);
  await expect(page.locator('#rail-left')).toBeVisible();
  await expect(page.locator('#rail-right')).toBeHidden();
});

test('stamp tray: the five stamps never overlap, at any window height', async () => {
  for (const [w, h] of [[1280, 800], [1100, 600], [960, 600]]) {
    await size(w, h);
    await expect.poll(() => overlaps('#stamps .stamp')).toEqual([]);
    // each label sits inside its own stamp's box
    expect(await page.evaluate(() => [...document.querySelectorAll('#stamps .stamp')].every(s => { const a = s.getBoundingClientRect(), b = s.querySelector('.lbl').getBoundingClientRect(); return b.top >= a.top - 1 && b.bottom <= a.bottom + 1; }))).toBe(true);
  }
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-tray-short.png') });
  await size(1280, 800);
});
