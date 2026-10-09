// In-desk browser pane: a localhost page (the demo's static site) renders and stays interactive inside the desk,
// links off the machine open in the system browser, and the page gets no bridge, node or main-window session.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');
const { startStaticSite } = require('../../app/demo/static-site');

const { launchApp, ROOT } = require('./launch');
let app, page, home, site;
test.describe.configure({ mode: 'serial' });

const paneView = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length);
const inPane = js => app.evaluate(({ BrowserWindow }, code) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(code), js);
const opened = () => app.evaluate(() => globalThis.__opened);

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-web-'));
  site = await startStaticSite(path.join(ROOT, 'app', 'demo', 'assets', 'web'));
  home = seedDemo(path.join(tmp, 'home'), undefined, { webUrl: site.url });
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow, shell }) => {
    BrowserWindow.getAllWindows()[0].setContentSize(1280, 800);
    globalThis.__opened = [];
    shell.openExternal = async url => { globalThis.__opened.push(url); };
  });
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); site?.close(); });

test('a localhost page renders in the pane and stays interactive', async () => {
  await page.locator('#queue li', { hasText: 'Review the offline-mode plan' }).click();
  await expect(page.locator('#desk-surface .paper.manifest h3')).toHaveText('Review the offline-mode plan');
  // the ask slip may cover the card's grip at this width; the page link opens the same pane
  await page.locator('#desk-surface .paper.prcard', { hasText: 'Plan page' }).getByRole('link').click({ position: { x: 8, y: 6 } });
  await expect(page.locator('.modal.web')).toBeVisible();
  await expect.poll(paneView).toBe(1);
  await expect.poll(() => inPane('document.readyState === "complete" && document.querySelector("h1")?.textContent')).toBe('Plan: offline mode for boards');
  await expect(page.locator('.modal.web .web-addr')).toHaveText(`${site.url}plan.html`);
  // the view sits on the mount box
  const mount = await page.locator('.web-mount').boundingBox();
  const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds());
  expect(Math.abs(b.x - mount.x)).toBeLessThan(2); expect(Math.abs(b.width - mount.width)).toBeLessThan(2); expect(b.height).toBeGreaterThan(200);
  await inPane('document.getElementById("s2").click()');
  expect(await inPane('document.getElementById("count").textContent')).toBe('1 notes pinned');
});

test('the page has no bridge, no node and its own session', async () => {
  expect(await inPane('typeof window.harbor + "/" + typeof require + "/" + typeof process')).toBe('undefined/undefined/undefined');
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.getLastWebPreferences());
  expect(prefs).toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true });
  expect(prefs.preload || '').toBe('');
  expect(await app.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.session === session.defaultSession)).toBe(false);
  expect(await inPane('navigator.permissions.query({ name: "geolocation" }).then(p => p.state)')).toBe('denied');
});

test('links off the machine open in the system browser, not in the pane', async () => {
  await inPane('document.getElementById("ext").click()');
  await expect.poll(opened).toEqual(['https://example.com/']);
  await inPane('window.open("https://example.org/x"); true');
  await expect.poll(opened).toEqual(['https://example.com/', 'https://example.org/x']);
  expect(await inPane('location.href')).toBe(`${site.url}plan.html`);
  await expect(page.locator('.toast', { hasText: 'Opened in your browser' }).first()).toBeVisible();
});

test('full size toggle resizes the view; closing removes it', async () => {
  await page.locator('.modal.web').getByRole('button', { name: 'Full' }).click();
  await expect.poll(async () => (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds())).width).toBeGreaterThan(1250);
  await page.locator('.modal.web').getByRole('button', { name: 'Close' }).click();
  await expect.poll(paneView).toBe(0);
});

test('a page off the machine is refused in the pane and offered externally', async () => {
  const t = Math.floor(Date.now() / 1000);
  fs.writeFileSync(path.join(home, 'items', 'ext-web.json'), JSON.stringify({ id: 'ext-web', kind: 'answer', title: 'Outside page', priority: 1, artifacts: [{ type: 'web', url: 'https://example.net/', label: 'Outside' }], created: t, status: 'open' }));
  await page.locator('#queue li', { hasText: 'Outside page' }).click({ timeout: 8000 });
  await page.locator('#desk-surface .paper.prcard', { hasText: 'Outside' }).getByRole('link').click({ position: { x: 8, y: 6 } });
  await expect(page.locator('.web-refused')).toBeVisible();
  expect(await paneView()).toBe(0);
  await page.locator('.web-refused').getByRole('button', { name: 'Open in your browser' }).click();
  await expect.poll(opened).toContain('https://example.net/');
  await page.locator('.modal.web').getByRole('button', { name: 'Close' }).click();
});

test('a file:// web artifact opens its local .html page in the pane', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-fileurl-'));
  fs.writeFileSync(path.join(dir, 'mockup.html'), '<!doctype html><title>m</title><link rel="stylesheet" href="m.css"><h1>Synthetic mockup</h1>');
  fs.writeFileSync(path.join(dir, 'm.css'), 'h1 { color: rgb(1, 2, 3); }');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not html');
  const t = Math.floor(Date.now() / 1000);
  const url = require('url').pathToFileURL(path.join(dir, 'mockup.html')).href;
  fs.writeFileSync(path.join(home, 'items', 'file-web.json'), JSON.stringify({ id: 'file-web', kind: 'answer', title: 'File url page', priority: 1, artifacts: [{ type: 'web', url, label: 'Mockup' }], created: t, status: 'open' }));
  await page.locator('#queue li', { hasText: 'File url page' }).click({ timeout: 8000 });
  await page.locator('#desk-surface .paper.prcard', { hasText: 'Mockup' }).getByRole('link').click({ position: { x: 8, y: 6 } });
  await expect(page.locator('.modal.web')).toBeVisible();
  await expect(page.locator('.web-refused')).toHaveCount(0);
  await expect.poll(paneView).toBe(1);
  await expect.poll(() => inPane('document.readyState === "complete" && document.querySelector("h1")?.textContent')).toBe('Synthetic mockup');
  expect(await inPane('getComputedStyle(document.querySelector("h1")).color')).toBe('rgb(1, 2, 3)');
  expect(await inPane('location.protocol')).toBe('harbor:');
  // no general file:// access: a file URL the item does not reference stays refused
  const r = await page.evaluate(u => window.harbor.web.open(u, { x: 0, y: 0, width: 10, height: 10 }), require('url').pathToFileURL(path.join(dir, 'notes.txt')).href);
  expect(r.ok).toBe(false);
  await page.locator('.modal.web').getByRole('button', { name: 'Close' }).click();
  await expect.poll(paneView).toBe(0);
});

for (const theme of ['light', 'dark']) {
  test(`the refusal's "Open in your browser" button is readable in the ${theme} theme`, async () => {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.locator('#queue li', { hasText: 'Outside page' }).click();
    await page.locator('#desk-surface .paper.prcard', { hasText: 'Outside' }).getByRole('link').click({ position: { x: 8, y: 6 } });
    const btn = page.locator('.web-refused').getByRole('button', { name: 'Open in your browser' });
    await expect(btn).toBeVisible();
    const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(n => { n /= 255; return n <= .03928 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const s = await btn.evaluate(el => { const c = getComputedStyle(el); return { color: c.color, bg: c.backgroundColor, border: c.borderTopColor, bw: c.borderTopWidth }; });
    // button face is opaque; label contrasts with it >= 4.5, and with the white panel behind it the button is bounded by an edge
    expect(s.bg).not.toMatch(/rgba\(.*, 0\)|transparent/);
    const [a, b] = [lum(s.color), lum(s.bg)].sort((x, y) => y - x);
    expect((a + .05) / (b + .05)).toBeGreaterThanOrEqual(4.5);
    const face = lum(s.bg), panel = 1;
    expect((panel + .05) / (face + .05)).toBeGreaterThanOrEqual(1.5);
    await page.locator('.modal.web').getByRole('button', { name: 'Close' }).click();
  });
}
