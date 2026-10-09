// Review tools: who's waiting (badge + queue lift), what changed (only the new parts lit, cleared once seen), and
// Cmd/Ctrl+K search over items, topics and notes (keyboard only, never under the ship phone).
const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { seedDemo } = require('../../app/demo/seed');

const ROOT = path.join(__dirname, '..', '..');
const HD = path.join(ROOT, 'cli', 'bin', 'harbordeck.js');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page, home;
test.describe.configure({ mode: 'serial' });

const hd = (...args) => execFileSync(process.execPath, [HD, ...args], { env: { ...process.env, HARBORDECK_HOME: home }, encoding: 'utf8' });
const itemFile = id => path.join(home, 'items', `${id}.json`);
// an agent rewrite: same id, newer `updated`, whole-file atomic write
function rewrite(id, change) {
  const it = JSON.parse(fs.readFileSync(itemFile(id), 'utf8'));
  change(it); it.updated = Math.max(Math.floor(Date.now() / 1000), (it.updated || it.created) + 1);
  const tmp = path.join(home, 'items', `.${id}.tmp`); fs.writeFileSync(tmp, JSON.stringify(it)); fs.renameSync(tmp, itemFile(id));
}
const rowIndex = async title => (await page.locator('#queue li').allTextContents()).findIndex(t => t.includes(title));
const title = page => page.locator('#desk-surface .paper.manifest h3');
const searchKey = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-review-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await electron.launch({ args: [ROOT], env: { ...process.env, HARBORDECK_HEADLESS: process.env.HARBORDECK_HEADLESS ?? '1', HARBORDECK_HOME: home, HARBORDECK_USER_DATA: path.join(tmp, 'profile') } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test("who's waiting: badges from the item field and the fleet; more blocked workers rise", async () => {
  const pr = page.locator('#queue li', { hasText: 'Merge PR 142' });
  await expect(pr.locator('.waitn')).toHaveText('⏸1'); // crew in fleet.json waiting on it
  await expect(page.locator('#queue li', { hasText: 'Newsletter #6' }).locator('.waitn')).toHaveText('⏸1'); // item.waiting
  await expect(page.locator('#queue li', { hasText: 'Pick a logo direction' }).locator('.waitn')).toHaveCount(0);
  await expect(title(page)).toHaveText('Merge PR 142 (calmer checkout)?');
  await expect(page.locator('#desk-surface .paper.manifest .waitn')).toHaveAttribute('title', /1 worker paused until you answer/);
  // an agent marks three workers blocked on a low-priority item: it climbs the queue live, with no edit to the item
  const before = await rowIndex('Rename the repo');
  const updated = JSON.parse(fs.readFileSync(itemFile('rename-repo'), 'utf8')).updated;
  expect(hd('waiting', 'rename-repo', 'crew-a', 'crew-b', 'crew-c').trim()).toBe('ok waiting rename-repo 3');
  const row = page.locator('#queue li', { hasText: 'Rename the repo' });
  await expect(row.locator('.waitn')).toHaveText('⏸3');
  await expect.poll(() => rowIndex('Rename the repo')).toBeLessThan(before);
  expect(JSON.parse(fs.readFileSync(itemFile('rename-repo'), 'utf8')).updated).toBe(updated);
  await expect(row).not.toContainText('updated'); // who is waiting is not news about the item
  await page.locator('#queue').screenshot({ path: path.join(SHOTS, 'harbordeck-waiting.png') });
});

test('what changed: a rewrite lights only the new parts; leaving the desk clears them', async () => {
  const logo = page.locator('#queue li', { hasText: 'Pick a logo direction' });
  await logo.click();
  await expect(title(page)).toHaveText('Pick a logo direction');
  await expect(page.locator('#desk-surface .chg')).toHaveCount(0);
  await page.locator('#queue li', { hasText: 'Merge PR 142' }).click();
  fs.copyFileSync(path.join(home, 'assets', 'logo-options.svg'), path.join(home, 'assets', 'logo-d.svg'));
  rewrite('logo-direction', it => {
    it.title = 'Pick a logo direction (with D)';
    it.summary = 'Three directions, all original. B reads best at 16 px. D is B with a heavier stroke.';
    it.options.push({ key: 'd', label: 'D · Heavy tide' });
    it.artifacts.push({ type: 'image', path: 'assets/logo-d.svg', label: 'Direction D' });
    it.thread = [{ from: 'mate-growth', text: 'Added D after the 16 px test.', at: Math.floor(Date.now() / 1000) }];
  });
  const row = page.locator('#queue li', { hasText: 'Pick a logo direction (with D)' });
  await expect(row.locator('.upd')).toHaveText('updated');
  await row.click();
  const desk = page.locator('#desk-surface');
  await expect(desk.locator('.chg-note')).toContainText('Updated since you last looked: title, 1 sentence, 1 option, 1 paper, replies');
  await expect(desk.locator('.paper.manifest h3.chg')).toHaveAttribute('title', 'was: Pick a logo direction');
  await expect(desk.locator('.claims .fact.chg')).toHaveText(['D is B with a heavier stroke. ']);
  await expect(desk.locator('.claims .fact:not(.chg)')).toHaveCount(2); // the unchanged sentences stay plain
  await expect(desk.locator('.paper.ask .chg')).toHaveCount(1);
  await expect(desk.locator('.paper.ask .chg')).toContainText('D · Heavy tide');
  await expect(desk.locator('.paper.photo.chg')).toHaveCount(1);
  await expect(desk.locator('.paper.photo.chg .cap')).toHaveText('Direction D');
  await expect(desk.locator('.paper.thread .msg.chg')).toHaveCount(1);
  await expect(row.locator('.upd')).toHaveCount(0); // at the desk: the queue mark is gone
  await page.locator('#desk-surface').screenshot({ path: path.join(SHOTS, 'harbordeck-what-changed.png') });
  // step away and come back: seen, so nothing is lit
  await page.locator('#queue li', { hasText: 'Merge PR 142' }).click();
  await row.click();
  await expect(title(page)).toHaveText('Pick a logo direction (with D)');
  await expect(desk.locator('.chg, .chg-note')).toHaveCount(0);
});

test('what changed: body report lines new since the last look are lit', async () => {
  await page.keyboard.press(searchKey);
  await page.keyboard.type('onboarding copy');
  await page.keyboard.press('Enter');
  await expect(title(page)).toHaveText('Review onboarding copy v2');
  await page.locator('#queue li', { hasText: 'Merge PR 142' }).click();
  const body = path.join(home, 'assets', 'reports', 'onboarding-copy.md');
  fs.appendFileSync(body, '\nA brand-new closing line for the empty state.\n');
  rewrite('onboarding-copy', () => {});
  await page.keyboard.press(searchKey);
  await page.keyboard.type('onboarding copy');
  await page.keyboard.press('Enter');
  await expect(page.locator('#desk-surface .paper.dispatch .md .chg')).toHaveText(['A brand-new closing line for the empty state.']);
  await expect(page.locator('#desk-surface .chg-note')).toContainText('1 body line');
});

test('search: Cmd/Ctrl+K finds items, topics, notes and filed work; arrows, Enter, Esc', async () => {
  await page.keyboard.press(searchKey);
  const pal = page.locator('.modal.search');
  await expect(pal).toBeVisible();
  await expect(pal.locator('.sr-in')).toBeFocused();
  await page.keyboard.type('logo');
  await expect(pal.locator('.sr-row').first()).toContainText('Pick a logo direction (with D)');
  await page.keyboard.press('Escape');
  await expect(pal).toHaveCount(0);
  // fuzzy, two words
  await page.keyboard.press(searchKey);
  await page.keyboard.type('mrg chk');
  await expect(pal.locator('.sr-row').first()).toContainText('Merge PR 142');
  // a topic opens its page
  await pal.locator('.sr-in').fill('#launch');
  await expect(pal.locator('.sr-row.topic').first()).toContainText('#launch');
  const n = await pal.locator('.sr-row').evaluateAll(rs => rs.findIndex(r => r.classList.contains('topic')));
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowDown');
  await expect(pal.locator('.sr-row[aria-selected="true"]')).toHaveClass(/topic/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.modal.topic .topic-page')).toHaveAttribute('data-topic', 'launch');
  await page.keyboard.press('Escape');
  // a note, by words only in its text, opens its item
  await page.keyboard.press(searchKey);
  await page.keyboard.type('restore test numbers');
  await expect(pal.locator('.sr-row').first()).toHaveClass(/note/);
  await page.keyboard.press('Enter');
  await expect(title(page)).toContainText('Postgres');
  // filed work is found too and opens read-only
  await page.keyboard.press(searchKey);
  await page.keyboard.type('release 1.3 notes');
  await expect(pal.locator('.sr-row').first()).toContainText('Filed');
  await page.keyboard.press('Enter');
  await expect(page.locator('.modal.viewer .box h2')).toHaveText('Release 1.3 notes');
  await page.keyboard.press('Escape');
  // the menu has it too
  await page.keyboard.press('m');
  await page.locator('#btn-search').click();
  await expect(pal).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-search.png') });
  await page.keyboard.press(searchKey); // the same key closes it
  await expect(pal).toHaveCount(0);
});

test('search never opens while the ship phone is up', async () => {
  await page.locator('#btn-phone').click();
  await expect(page.locator('#phone')).toBeVisible();
  await page.keyboard.press(searchKey);
  await expect(page.locator('.modal.search')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#phone')).toHaveCount(0);
  await page.keyboard.press(searchKey);
  await expect(page.locator('.modal.search')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('plain mode: waiting badge and the changed parts on the card', async () => {
  await page.keyboard.press('p');
  rewrite('newsletter-6', it => { it.summary = `${it.summary} Subject line is now under 40 characters.`; });
  const card = page.locator('.pcard', { hasText: 'Newsletter #6 draft' });
  await expect(card.locator('.waitn')).toHaveText('⏸1');
  await expect(card.locator('.summary-text')).toContainText('under 40 characters');
  await card.locator('summary').click(); // first look: nothing to compare with yet
  await expect(card.locator('.chg')).toHaveCount(0);
  await page.keyboard.press('p'); await page.keyboard.press('p'); // redraw
  rewrite('newsletter-6', it => { it.summary = `${it.summary} Sends Tuesday 9:00.`; });
  const again = page.locator('.pcard', { hasText: 'Newsletter #6 draft' });
  await expect(again.locator('.upd')).toHaveText('updated');
  await again.locator('summary').click();
  await expect(again.locator('.summary-text .chg')).toHaveText(['Sends Tuesday 9:00. ']);
  await page.keyboard.press('p');
});
