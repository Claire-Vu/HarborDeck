// Topics: items sharing a topic or a rel link arrive as one bundle and are stamped together, the topic page shows
// the timeline, and notes an agent appends to notes.jsonl show up live on the page and on the item.
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
const addNote = n => fs.appendFileSync(path.join(home, 'notes.jsonl'), JSON.stringify({ ...n, at: Math.floor(Date.now() / 1000) }) + '\n');

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-topics-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await electron.launch({ args: [ROOT], env: { ...process.env, HARBORDECK_HEADLESS: process.env.HARBORDECK_HEADLESS ?? '1', HARBORDECK_HOME: home, HARBORDECK_USER_DATA: path.join(tmp, 'profile') } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('a topic and its rel arrive as one bundle with several papers', async () => {
  // pricing-launch + onboarding-copy share #launch; competitor-scan links to pricing-launch
  const row = page.locator('#queue li', { hasText: 'Launch pricing' });
  await expect(row.locator('.bundle-n')).toHaveText('+2');
  await expect(page.locator('#queue li', { hasText: 'Review onboarding copy v2' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Competitor scan' })).toHaveCount(0);
  await row.click();
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Launch pricing: one plan or free + pro?');
  await expect(page.locator('#at-window .speech')).toContainText('+ 2 more');
  const bundle = page.locator('#desk-surface .paper.bundle');
  await expect(bundle.locator('.b-row')).toHaveCount(3);
  await expect(page.locator('#desk-surface .paper.manifest .topic-chip')).toHaveText('#launch');
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-bundle.png') });
});

test('the topic page: open items, timeline with notes, related topics; notes land live', async () => {
  await page.locator('#desk-surface .paper.manifest .topic-chip').click();
  const sheet = page.locator('.modal.topic');
  await expect(sheet.locator('h2')).toHaveText('Topic · launch');
  await expect(sheet.locator('.rp-head')).toContainText('2 open · 2 items · 2 notes');
  await expect(sheet.locator('.tp-rel .topic-chip')).toHaveText('#research');
  await expect(sheet.locator('.tp-ev')).toHaveCount(4);
  await expect(sheet.locator('.tp-ev.note').first()).toContainText('Annual-plan discount survey');
  addNote({ topic: 'launch', from: 'mate-growth', text: 'Survey done: two months free is the norm.' });
  await expect(sheet.locator('.tp-ev.note')).toHaveCount(3, { timeout: 8000 });
  await expect(sheet.locator('.tp-ev').last()).toContainText('Survey done');
  await expect(page.locator('.toast', { hasText: 'Note on #launch' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-topic-page.png') });
  // related topic opens its own page
  await sheet.locator('.tp-rel .topic-chip').click();
  await expect(page.locator('.modal.topic h2')).toHaveText('Topic · research');
  await page.keyboard.press('Escape');
  await page.keyboard.press('o'); // O: topic of the item at the desk
  await expect(page.locator('.modal.topic h2')).toHaveText('Topic · launch');
  await page.keyboard.press('Escape');
});

test('a note on the item joins its correspondence live', async () => {
  addNote({ item: 'pricing-launch', topic: 'launch', from: 'mate-growth', text: 'Hosting estimate for free users rechecked: $38.' });
  await expect(page.locator('#desk-surface .paper.thread')).toContainText('Hosting estimate for free users rechecked', { timeout: 8000 });
});

test('one stamp settles the whole bundle, one line per paper, undoable as one', async () => {
  const before = answers().length;
  await page.locator('#desk-surface .paper.bundle').getByRole('button', { name: 'Stamp the bundle' }).click();
  await expect(page.locator('.toast.undo')).toContainText('+2 more');
  await page.keyboard.press('u');
  await expect(page.locator('#queue li', { hasText: 'Launch pricing' }).locator('.bundle-n')).toHaveText('+2');
  await page.waitForTimeout(4500);
  expect(answers().length).toBe(before);
  await page.locator('#queue li', { hasText: 'Launch pricing' }).click();
  await page.locator('#desk-surface .paper.bundle').getByRole('button', { name: 'Stamp the bundle' }).click();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 3);
  // the paper at the desk first, then the rest in queue order
  expect(answers().slice(-3).map(a => [a.id, a.action, a.key])).toEqual([
    ['pricing-launch', 'decide', 'free-pro'], ['competitor-scan', 'file', undefined], ['onboarding-copy', 'approve', undefined]]);
  await expect(page.locator('#queue li', { hasText: 'Launch pricing' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Review onboarding copy v2' })).toHaveCount(0);
});

test('Topics tab lists topics, open ones first', async () => {
  await page.locator('.tab[data-tab="topics"]').click();
  const rows = page.locator('#topics-pane .tp-row');
  await expect(rows.first()).toBeVisible();
  await expect(page.locator('#topics-pane .tp-row', { hasText: '#releases' })).toHaveClass(/settled/);
  await page.locator('#topics-pane .tp-row', { hasText: '#infra' }).click();
  await expect(page.locator('.modal.topic h2')).toHaveText('Topic · infra');
  await page.keyboard.press('Escape');
  await page.locator('.tab[data-tab="window"]').click();
});

test('plain mode: topic chips, topics list and the bundle stamp', async () => {
  await page.keyboard.press('p');
  await expect(page.locator('#plain-mode .pcard .topic-chip', { hasText: '#infra' }).first()).toBeVisible();
  await expect(page.locator('#plain-mode .topics-plain .tp-row').first()).toBeVisible();
  const card = page.locator('#plain-mode details.pcard', { hasText: 'Hosted Postgres: three options' });
  await card.locator('summary').click();
  const before = answers().length;
  await card.getByRole('button', { name: 'Approve bundle (2)' }).click();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 2);
  expect(answers().slice(-2).map(a => [a.id, a.action])).toEqual([['postgres-options', 'file'], ['analytics-options', 'file']]);
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-plain-topics.png') });
  await page.keyboard.press('p');
});
