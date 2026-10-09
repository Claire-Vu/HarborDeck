// Scenes: one per kind with a figure per open item; ←/→ and the on-screen arrows flip them, the kind chips jump to
// them, a figure opens its item at the desk, a stamp makes it leave, and an emptied scene shows all clear.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp } = require('./launch');
const SHOTS = process.env.HARBORDECK_SHOTS || os.tmpdir();
let app, page;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-scenes-'));
  const home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

const scenes = () => page.locator('#scenes');
const figs = () => page.locator('#scenes .sc-fig:not(.leaving)');
const chipCount = async name => +(await page.locator('#filters .chip', { hasText: name }).textContent()).match(/(\d+)$/)[1];
const title = () => page.locator('#desk-surface .paper.manifest h3');

test('one figure per open decision; arrows and the on-screen arrows flip scenes', async () => {
  await expect(scenes()).toHaveAttribute('data-scene', 'decision');
  await expect(scenes().locator('.sc-name')).toHaveText('Signpost Square');
  const n = await chipCount('Decisions');
  await expect(scenes().locator('.sc-count')).toHaveText(String(n));
  await expect(figs()).toHaveCount(n);
  await expect(figs().first().locator('.placard')).toContainText('A');
  await page.locator('#scenes').screenshot({ path: path.join(SHOTS, 'harbordeck-scene-decisions.png') });
  const before = await title().textContent();
  await page.keyboard.press('ArrowRight');
  await expect(scenes()).toHaveAttribute('data-scene', 'review');
  await expect(scenes().locator('.sc-name')).toHaveText('Customs Shed');
  await expect(figs()).toHaveCount(await chipCount('Reviews'));
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toContainText('Reviews'); // the chips are the scene index
  await expect(title()).toHaveText(before); // flipping never moves the desk
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); // wraps around
  await expect(scenes()).toHaveAttribute('data-scene', 'todo');
  await scenes().locator('.sc-arrow.next').click();
  await expect(scenes()).toHaveAttribute('data-scene', 'decision');
  await page.locator('#filters .chip', { hasText: 'Dispatches' }).click();
  await expect(scenes()).toHaveAttribute('data-scene', 'answer');
  await expect(figs()).toHaveCount(await chipCount('Dispatches'));
});

test('a figure opens its item; a stamp makes it leave; an empty scene is all clear', async () => {
  await page.locator('#filters .chip', { hasText: 'Notices' }).click();
  await expect(scenes()).toHaveAttribute('data-scene', 'todo');
  let n = await chipCount('Notices');
  const left = +(await scenes().locator('.sc-left').textContent()).match(/^(\d+)/)[1];
  while (n > 0) {
    const fig = figs().first(); const label = await fig.getAttribute('aria-label');
    await fig.click();
    await expect(title()).toHaveText(label.split(' · ')[1]);
    await expect(scenes().locator('.sc-fig.at-desk')).toHaveCount(1);
    await page.keyboard.press('1');
    await expect(figs()).toHaveCount(n - 1);
    await expect(scenes().locator('.sc-count')).toHaveText(String(n - 1));
    if (n === 3) await expect(scenes().locator('.sc-fig.leaving')).toHaveCount(1); // it walks off, then is gone
    await expect(page.locator('#scenes .sc-fig.leaving')).toHaveCount(0, { timeout: 4000 });
    await page.waitForTimeout(1600); // let the desk move on before the next pick
    n--;
  }
  await expect(scenes().locator('.sc-clear')).toContainText('All clear');
  await expect(scenes().locator('.sc-pip.clear')).toHaveCount(1);
  await expect(scenes().locator('.sc-left')).toContainText(`${left - 3} to zero`);
  await page.locator('#scenes').screenshot({ path: path.join(SHOTS, 'harbordeck-scene-clear.png') });
  await scenes().locator('.sc-go').click(); // the next scene with anyone waiting
  await expect(scenes()).toHaveAttribute('data-scene', 'decision');
});

test('existing keys still work beside the arrows: letters pick, U undoes a stamp and the figure returns', async () => {
  const n = await figs().count();
  await figs().first().click();
  await page.keyboard.press('a');
  await expect(page.locator('#desk-surface .paper.ask')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(figs()).toHaveCount(n - 1);
  await page.keyboard.press('u');
  await expect(figs()).toHaveCount(n);
});

test('the left column is the top scene, the working crew, the kind chips and the list; no tabs', async () => {
  await expect(page.locator('.window-frame #scenes')).toBeVisible(); // the scene is the big window, not a panel below it
  await expect(page.locator('.window-frame #scenes .sc-head .sc-arrow')).toHaveCount(2);
  await expect(page.locator('#yard .zone.galley')).toBeVisible(); // the crew at work replaces the Crew tab
  await expect(page.locator('.tabs, .tab, .tabpane, #crew-pane, #topics-pane')).toHaveCount(0);
  const order = await page.evaluate(() => ['.window-frame', '#yard', '#filters', '#queue', '#btn-next'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top)));
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // the header usage chip opens the long form that used to live on the Crew tab
  await page.locator('#stamina-cluster').click();
  await expect(page.locator('.modal.stamina-modal .stamina .sub').first()).toBeVisible();
  await page.keyboard.press('Escape');
  // a saved pref pointing at a removed tab falls back to the window
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('harbor-deck-prefs') || '{}'); localStorage.setItem('harbor-deck-prefs', JSON.stringify({ ...p, tab: 'crew' })); });
  await page.reload();
  const office = page.getByRole('button', { name: 'Open the office' });
  if (await office.isVisible().catch(() => false)) await office.click();
  await expect(page.locator('#queue li').first()).toBeVisible();
  await expect(page.locator('#scenes .sc-fig').first()).toBeVisible();
  await page.locator('.window-col').screenshot({ path: path.join(SHOTS, 'harbordeck-left-column.png') });
});
