// The scene line: switching scenes puts the front of the line on the desk (P1 first, then oldest), the figures stand
// single file with the one at the desk in front, Back of the line (W) sends it to the end and calls the next, and N
// walks forward through the line, then on to the next busy scene. None of it writes to answers.jsonl.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
let app, page, home;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-line-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

const scenes = () => page.locator('#scenes');
const figs = () => page.locator('#scenes .sc-fig:not(.leaving)');
const title = () => page.locator('#desk-surface .paper.manifest h3');
const items = () => fs.readdirSync(path.join(home, 'items')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(home, 'items', f), 'utf8')));
const created = title => items().find(i => i.title === title).created;
// with a kind shown, the list is that scene's line: [title, priority, away] per row, front first
const rows = () => page.locator('#queue li:not(.q-lane):not(.q-later)').evaluateAll(els => els.map(e => [e.querySelector('.q-title > span:not(.unread-dot)').textContent, +e.querySelector('.prio').textContent.slice(1), e.classList.contains('away')]));
const front = async () => (await rows()).find(r => !r[2])[0];
const frontFig = async () => (await figs().first().getAttribute('aria-label')).split(' · ')[1];
const answers = () => { try { return fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8'); } catch { return ''; } };

test('switching scenes puts the front of the line on the desk: P1 first, then oldest', async () => {
  // a kind chip narrows the list to that scene's line; arrows and pips then move that filter along
  for (const go of [() => page.locator('#filters .chip', { hasText: 'Notices' }).click(), () => page.keyboard.press('ArrowRight'), () => page.locator('#scenes .sc-pip').nth(1).click()]) {
    const was = await scenes().getAttribute('data-scene'); await go(); await expect(scenes()).not.toHaveAttribute('data-scene', was);
    const line = (await rows()).filter(r => !r[2]); expect(line.length).toBeGreaterThan(0);
    for (let i = 1; i < line.length; i++) expect(line[i - 1][1] < line[i][1] || (line[i - 1][1] === line[i][1] && created(line[i - 1][0]) <= created(line[i][0]))).toBe(true);
    await expect(title()).toHaveText(line[0][0]); // no click needed
    expect(await frontFig()).toBe(line[0][0]); // the one at the desk stands at the front of the single-file line
    await expect(figs().first()).toHaveClass(/at-desk/);
  }
});

test('Back of the line (W, or the slip button) sends the visitor to the end and calls the next; nothing is written', async () => {
  await page.locator('#filters .chip', { hasText: 'Decisions' }).click();
  const log = answers(); const before = (await rows()).filter(r => !r[2]).map(r => r[0]); expect(before.length).toBeGreaterThan(2);
  await expect(title()).toHaveText(before[0]);
  await page.keyboard.press('w');
  await expect(title()).toHaveText(before[1]);
  let after = (await rows()).filter(r => !r[2]).map(r => r[0]);
  expect(after).toEqual([...before.slice(1), before[0]]);
  expect(await frontFig()).toBe(before[1]);
  await page.locator('#desk-surface .paper.manifest .back-btn').click();
  await expect(title()).toHaveText(before[2]);
  after = (await rows()).filter(r => !r[2]).map(r => r[0]);
  expect(after).toEqual([...before.slice(2), before[0], before[1]]);
  await page.waitForTimeout(500); expect(answers()).toBe(log); // view state only
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); // the order holds across scene switches
  await expect(title()).toHaveText(before[2]);
});

test('N walks forward through the whole line, not back and forth between the first two', async () => {
  await page.locator('#filters .chip', { hasText: 'Decisions' }).click();
  await expect(scenes()).toHaveAttribute('data-scene', 'decision');
  const n = await figs().count(); expect(n).toBeGreaterThan(2);
  const seen = new Set([await title().textContent()]);
  for (let i = 1; i < n; i++) { const was = await title().textContent(); await page.keyboard.press('n'); await expect(title()).not.toHaveText(was); seen.add(await title().textContent()); }
  expect(seen.size).toBe(n);
  await page.keyboard.press('n'); // past the end of the line: the next busy scene's front
  await expect(scenes()).toHaveAttribute('data-scene', 'review');
  await expect(title()).toHaveText(await front());
});
