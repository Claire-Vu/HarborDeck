// Flow at the desk for a busy captain: the scene follows the item at the desk, All stays All, fast Space presses each
// stamp the next item, an unread reply is shown before Space decides, and the small frictions (ticket wording, T,
// rail overflow, empty queue, phone dial, manifest, slip drafts, Inspect undo).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp, ROOT } = require('./launch');

const HD = path.join(ROOT, 'cli', 'bin', 'harbordeck.js');
let app, page, home;

const hd = (...args) => execFileSync(process.execPath, [HD, ...args], { env: { ...process.env, HARBORDECK_HOME: home }, encoding: 'utf8' });
const lines = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const title = () => page.locator('#desk-surface .paper.manifest h3');
const allChip = () => page.locator('#filters .chip', { hasText: 'All' });
const visitors = () => page.locator('#queue li:not(.q-lane):not(.q-later):not(.q-empty)');
const pick = async t => { await page.locator('#queue li', { hasText: t }).click(); await expect(title()).toContainText(t); };

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-flow-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('F1: the scene follows the kind of the item at the desk', async () => {
  await expect(allChip()).toHaveAttribute('aria-pressed', 'true');
  await pick('Review the new dashboard');
  await expect(page.locator('#scenes')).toHaveAttribute('data-scene', 'review');
  await pick('Renew the domain');
  await expect(page.locator('#scenes')).toHaveAttribute('data-scene', 'todo');
  await pick('Pick a logo direction');
  await expect(page.locator('#scenes')).toHaveAttribute('data-scene', 'decision');
  await expect(allChip()).toHaveAttribute('aria-pressed', 'true');
});

test('F2: arrows, scene arrows, pips and N never leave All', async () => {
  const n = await visitors().count();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#scenes .sc-arrow.next').click();
  await page.locator('#scenes .sc-pip').nth(2).click();
  await expect(page.locator('#scenes')).toHaveAttribute('data-scene', 'answer'); // the window still flips
  for (let i = 0; i < n + 3; i++) await page.keyboard.press('n');
  await expect(allChip()).toHaveAttribute('aria-pressed', 'true');
  await expect(visitors()).toHaveCount(n);
  // a kind chip is an explicit filter; arrows then flip the filter along with the scene
  await page.locator('#filters .chip', { hasText: 'Reviews' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toContainText('Research');
  await allChip().click();
});

test('F5 + F6: tickets read "new reply" / "awaiting reply"; T focuses the newest reply', async () => {
  await expect(page.locator('#rail .ticket', { hasText: 'Newsletter #6' }).locator('.tk-foot')).toContainText('new reply');
  await expect(page.locator('#rail .ticket.waiting').first().locator('.tk-foot')).toContainText('awaiting reply');
  await pick('Quarantine the flaky');
  await page.keyboard.press('4');
  await page.locator('.modal.noteslip textarea').fill('How flaky, % of runs?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => lines().some(a => a.id === 'flaky-e2e' && a.action === 'ask'), { timeout: 8000 }).toBe(true);
  hd('reply', 'flaky-e2e', 'About 7% of runs, all on the drag step.');
  await expect(page.locator('#rail .ticket.new', { hasText: 'Quarantine' })).toBeVisible();
  await page.locator('#queue').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Escape');
  await page.keyboard.press('t');
  await expect(page.locator('#rail .ticket:focus')).toContainText('Quarantine');
});

test('F4: on an item with an unread reply the first Space opens the reply; the second stamps', async () => {
  await page.keyboard.press('Escape');
  await pick('Newsletter #6');
  await page.keyboard.press(' ');
  await expect(page.locator('.tk-pop')).toContainText('the digest is off by default');
  await expect(page.locator('.toast.undo')).toHaveCount(0);
  await expect(title()).toContainText('Newsletter #6');
  await page.keyboard.press(' ');
  await expect(page.locator('.toast.undo')).toBeVisible();
  await page.keyboard.press('u');
  await expect(page.locator('.toast.undo')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('F10: the manifest cannot be stowed', async () => {
  await pick('Review the new dashboard');
  await expect(page.locator('#desk-surface .paper.manifest .stow-btn')).toHaveCount(0);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('x'); await page.waitForTimeout(450); }
  await expect(page.locator('#desk-surface .paper.manifest')).toBeVisible();
  await page.keyboard.press('Shift+X');
});

test('F11: a note slip keeps its draft after Esc', async () => {
  await page.keyboard.press('3');
  await page.locator('.modal.noteslip textarea').fill('The legend overlaps the chart on narrow screens');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal.noteslip')).toHaveCount(0);
  await page.keyboard.press('3');
  await expect(page.locator('.modal.noteslip textarea')).toHaveValue('The legend overlaps the chart on narrow screens');
  await page.keyboard.press('Escape');
});

test('F9: the phone keeps the dialed mate with the unsent draft', async () => {
  await page.locator('#btn-phone').click();
  await page.keyboard.press('3');
  await expect(page.locator('#phone .dial-pos[aria-checked="true"]')).toHaveAttribute('data-mate', 'mate-growth');
  await page.locator('#phone .phone-pad').fill('Draft for growth');
  await page.keyboard.press('Escape');
  await page.locator('#btn-phone').click();
  await expect(page.locator('#phone .phone-pad')).toHaveValue('Draft for growth');
  await expect(page.locator('#phone .dial-pos[aria-checked="true"]')).toHaveAttribute('data-mate', 'mate-growth');
  await page.locator('#phone .phone-pad').fill('');
  await page.keyboard.press('Escape');
});

test('F12: Inspect Match is held for undo like a stamp', async () => {
  await pick('Review the new dashboard');
  await page.keyboard.press('i');
  await page.locator('#desk-surface .paper.manifest .fact').first().click();
  await page.locator('#desk-surface .paper.photo img').first().click({ position: { x: 20, y: 20 } });
  await page.locator('.popover').getByRole('button', { name: 'Match', exact: true }).click();
  await expect(page.locator('.toast.undo')).toBeVisible();
  expect(lines().some(a => a.action === 'comment')).toBe(false);
  await page.keyboard.press('u');
  await page.waitForTimeout(4600);
  expect(lines().some(a => a.action === 'comment')).toBe(false);
  await page.keyboard.press('i');
});

test('F7: the overflow cue sits beside the tickets and no ticket is clipped', async () => {
  const t = Math.floor(Date.now() / 1000);
  const add = Array.from({ length: 8 }, (_, i) => JSON.stringify({ id: `req-flow-${i}`, action: 'request', note: `Order number ${i} for the web crew`, to: 'mate-web', at: t - 60 + i }));
  fs.appendFileSync(path.join(home, 'answers.jsonl'), add.join('\n') + '\n');
  await expect(page.locator('#rail-right')).toBeVisible();
  await page.waitForTimeout(2300); // the new-reply wiggle settles
  const g = await page.evaluate(() => {
    const rail = document.querySelector('#rail').getBoundingClientRect(), cue = document.querySelector('#rail-right').getBoundingClientRect();
    return { rail: { right: rail.right, bottom: rail.bottom }, cue: { left: cue.left }, feet: [...document.querySelectorAll('#rail .ticket .tk-foot')].map(f => f.getBoundingClientRect().bottom) };
  });
  expect(g.cue.left).toBeGreaterThanOrEqual(g.rail.right - 1);
  for (const b of g.feet) expect(b).toBeLessThanOrEqual(g.rail.bottom);
});

test('F3 + F8: fast Space presses each stamp the next item; the empty list reads on one line', async () => {
  await page.locator('#filters .chip', { hasText: 'Notices' }).click();
  const before = lines().length;
  for (let i = 0; i < 3; i++) { await page.keyboard.press(' '); await page.waitForTimeout(200); }
  await expect.poll(() => lines().slice(before).filter(a => a.action === 'file').map(a => a.id).sort(), { timeout: 10000 })
    .toEqual(['todo-app-store', 'todo-domain', 'todo-receipts']);
  const empty = page.locator('#queue li.q-empty');
  await expect(empty).toHaveText('Nobody at the window.');
  expect((await empty.boundingBox()).height).toBeLessThan(50); // one line (it wrapped to three, ~76 px)
});
