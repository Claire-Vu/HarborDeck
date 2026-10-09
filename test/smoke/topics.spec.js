// Topics: items sharing a topic arrive as one bundle (a rel link never bundles) and are stamped together; a review or
// report rides unticked until it has been opened, so one Space never approves unseen work; the topic page shows
// the timeline, and notes an agent appends to notes.jsonl show up live on the page and on the item.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page, home;
test.describe.configure({ mode: 'serial' });

const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const addNote = n => fs.appendFileSync(path.join(home, 'notes.jsonl'), JSON.stringify({ ...n, at: Math.floor(Date.now() / 1000) }) + '\n');

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-topics-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('a topic arrives as one bundle; a rel link never bundles; an unopened review rides unticked', async () => {
  // pricing-launch + onboarding-copy share #launch; competitor-scan (project brand) only links to pricing-launch by rel
  const row = page.locator('#queue li', { hasText: 'Launch pricing' });
  await expect(row.locator('.bundle-n')).toHaveText('+1');
  await expect(page.locator('#queue li', { hasText: 'Review onboarding copy v2' })).toHaveCount(0);
  const scan = page.locator('#queue li', { hasText: 'Competitor scan' });
  await expect(scan).toHaveCount(1);
  await expect(scan.locator('.bundle-n')).toHaveCount(0);
  await row.click();
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Launch pricing: one plan or free + pro?');
  await expect(page.locator('#at-window .speech')).toContainText('2 papers on Launch');
  const bundle = page.locator('#desk-surface .paper.qsheet');
  await expect(bundle.locator('.b-row')).toHaveCount(2);
  await expect(bundle.locator('.b-row.cur .b-title')).toHaveText('Launch pricing: one plan or free + pro?');
  const review = bundle.locator('.b-row', { hasText: 'Review onboarding copy v2' });
  await expect(review.locator('input[type=checkbox]')).not.toBeChecked();
  await expect(review.locator('.b-verb')).toHaveText('Review: not opened yet, open it to include');
  await expect(bundle.locator('.sheet-n')).toHaveText('1 row');
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

test('one stamp settles the ticked rows, one line per paper, undoable as one; opening the review ticks it', async () => {
  const before = answers().length;
  const sheet = page.locator('#desk-surface .paper.qsheet');
  await sheet.getByRole('button', { name: 'Stamp the sheet' }).click();
  await expect(page.locator('.toast.undo')).toBeVisible();
  await page.keyboard.press('u');
  await expect(page.locator('#queue li', { hasText: 'Launch pricing' }).locator('.bundle-n')).toHaveText('+1');
  await page.waitForTimeout(4500);
  expect(answers().length).toBe(before);
  await page.locator('#queue li', { hasText: 'Launch pricing' }).click();
  await page.keyboard.press('j'); // open the review: its papers fill the desk, and its row is ticked
  await expect(sheet.locator('.b-row.cur .b-title')).toHaveText('Review onboarding copy v2');
  await expect(sheet.locator('.b-row', { hasText: 'Review onboarding copy v2' }).locator('input[type=checkbox]')).toBeChecked();
  await expect(sheet.locator('.sheet-n')).toHaveText('2 rows');
  await page.keyboard.press('k');
  await sheet.getByRole('button', { name: 'Stamp the sheet' }).click();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 2);
  // the paper at the desk first, then the rest; the rel-linked report in another project is never on the stamp
  expect(answers().slice(-2).map(a => [a.id, a.action, a.key])).toEqual([['pricing-launch', 'decide', 'free-pro'], ['onboarding-copy', 'approve', undefined]]);
  await expect(page.locator('#queue li', { hasText: 'Launch pricing' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Review onboarding copy v2' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Competitor scan' })).toHaveCount(1);
});

test('one Space on a mixed topic writes only the decision; the head is the decision even beside a P1 report', async () => {
  const t = Math.floor(Date.now() / 1000);
  const item = it => fs.writeFileSync(path.join(home, 'items', `${it.id}.json`), JSON.stringify({ from: 'mate-growth', created: t, status: 'open', ...it }));
  // the report is P1 in a lane that sorts first, yet the P2 decision heads the bundle in its own lane
  item({ id: 'ut-licence', topic: 'ut-font', kind: 'answer', project: 'aa-legal', priority: 1, title: 'Font licensing costs', summary: 'Two quotes.' });
  item({ id: 'ut-font', topic: 'ut-font', kind: 'decision', project: 'brand', priority: 2, title: 'Adopt the new font?', options: [{ key: 'yes', label: 'Yes', recommended: true }, { key: 'no', label: 'No' }] });
  item({ id: 'ut-deck', topic: 'ut-font', kind: 'review', project: 'brand', priority: 3, title: 'Review the brand deck v3', summary: '22 slides' });
  item({ id: 'ut-quote', rel: ['ut-font'], kind: 'answer', project: 'other', priority: 3, title: 'Type foundry quote', summary: 'Linked by rel only.' });
  await page.locator('#filters .chip', { hasText: 'All' }).click();
  const head = page.locator('#queue li', { hasText: 'Adopt the new font?' });
  await expect(head.locator('.bundle-n')).toHaveText('+2', { timeout: 8000 });
  await expect(page.locator('#queue li', { hasText: 'Font licensing costs' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Review the brand deck v3' })).toHaveCount(0);
  await expect(page.locator('#queue li', { hasText: 'Type foundry quote' }).locator('.bundle-n')).toHaveCount(0);
  await head.click();
  const sheet = page.locator('#desk-surface .paper.qsheet');
  await expect(sheet.locator('.b-row')).toHaveCount(3);
  await expect(sheet.locator('.b-row.skip')).toHaveCount(2);
  const before = answers().length;
  await page.keyboard.press(' ');
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 1);
  await page.waitForTimeout(1500);
  expect(answers().slice(before)).toMatchObject([{ id: 'ut-font', action: 'decide', key: 'yes' }]);
  // the rest stay at the window: the review now heads its topic, the report still unticked until opened
  const rest = page.locator('#queue li', { hasText: 'Review the brand deck v3' });
  await expect(rest.locator('.bundle-n')).toHaveText('+1');
  await rest.click();
  await expect(sheet.locator('.b-row.skip .b-title')).toHaveText('Font licensing costs');
});

test('no Topics tab: O opens the topic page of the item at the desk', async () => {
  await expect(page.locator('.tab, .tabs')).toHaveCount(0);
  await page.locator('#filters .chip', { hasText: 'All' }).click();
  await page.locator('#queue li', { hasText: 'Hosted Postgres' }).click();
  await page.keyboard.press('o');
  await expect(page.locator('.modal.topic .topic-page')).toHaveAttribute('data-topic', 'infra');
  await page.keyboard.press('Escape');
});

test('plain mode: topic chips, topics list and the bundle stamp', async () => {
  await page.keyboard.press('p');
  await expect(page.locator('#plain-mode .pcard .topic-chip', { hasText: '#infra' }).first()).toBeVisible();
  await expect(page.locator('#plain-mode .topics-plain .tp-row').first()).toBeVisible();
  // the bundle stamp takes only cards that were opened: open the second report first
  await page.locator('#plain-mode details.pcard', { hasText: 'Privacy-friendly analytics' }).locator('summary').click();
  const card = page.locator('#plain-mode details.pcard', { hasText: 'Hosted Postgres: three options' });
  await card.locator('summary').click();
  const before = answers().length;
  await card.getByRole('button', { name: 'Approve bundle (2)' }).click();
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 2);
  expect(answers().slice(-2).map(a => [a.id, a.action])).toEqual([['postgres-options', 'file'], ['analytics-options', 'file']]);
  await page.screenshot({ path: path.join(SHOTS, 'harbordeck-plain-topics.png') });
  await page.keyboard.press('p');
});
