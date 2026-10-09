// Preview per option: a decision option can carry a sample (image thumbnail, audio/video play button, page link);
// a click enlarges it in the viewer, only one clip plays at a time, letters still pick, a missing file is a quiet placeholder.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp } = require('./launch');

// 1x1 PNG and 0.2 s of silent 8 kHz mono WAV: synthetic fixtures
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function wav() {
  const n = 1600, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}

let app, page, home;
test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-optprev-'));
  home = seedDemo(path.join(tmp, 'home'));
  const dir = path.join(home, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'logo.png'), PNG);
  fs.writeFileSync(path.join(dir, 'amy.wav'), wav());
  fs.writeFileSync(path.join(dir, 'bo.wav'), wav());
  fs.writeFileSync(path.join(dir, 'page.html'), '<!doctype html><title>Sample page</title><p>hello</p>');
  fs.writeFileSync(path.join(home, 'items', 'voice-pick.json'), JSON.stringify({
    id: 'voice-pick', kind: 'decision', title: 'Which narrator voice?', project: 'brand', created: Math.floor(Date.now() / 1000) + 5, status: 'open', priority: 1,
    options: [
      { key: 'amy', label: 'Amy', recommended: true, artifact: { type: 'audio', path: path.join(dir, 'amy.wav') } },
      { key: 'bo', label: 'Bo', artifact: { type: 'audio', path: path.join(dir, 'bo.wav') } },
      { key: 'logo', label: 'Logo', artifact: { type: 'image', path: path.join(dir, 'logo.png') } },
      { key: 'page', label: 'Page', artifact: { type: 'web', path: path.join(dir, 'page.html') } },
      { key: 'gone', label: 'Gone', artifact: { type: 'image', path: path.join(dir, 'nope.png') } }
    ]
  }));
  app = await launchApp({ home, profile: path.join(tmp, 'profile'), env: { HARBORDECK_WAKE_COMMAND: 'true' } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
  await page.locator('#queue li', { hasText: 'Which narrator voice?' }).click();
});
test.afterAll(async () => { await app?.close(); });

const row = key => page.locator(`#desk-surface .paper.ask label.opt[data-key="${key}"]`);
const paused = key => row(key).locator('audio').evaluate(a => a.paused);

test('each option row shows its preview; a missing file is a placeholder; letters still pick', async () => {
  await expect(page.locator('#desk-surface .paper.ask label.opt .k')).toHaveText(['A', 'B', 'C', 'D', 'E']);
  await expect(row('amy').locator('.op-play')).toBeVisible();
  await expect(row('logo').locator('.op-thumb img')).toBeVisible();
  await expect(row('page').locator('.op-link')).toBeVisible();
  await expect(row('gone').locator('.op-art.gone')).toContainText('not available');
  await page.keyboard.press('b');
  await expect(row('bo')).toHaveClass(/on/);
});

test('play is inline, one at a time, and does not pick or stamp', async () => {
  await row('amy').locator('.op-play').click();
  await expect.poll(() => paused('amy')).toBe(false);
  await expect(row('bo')).toHaveClass(/on/); // still the earlier pick
  await row('bo').locator('.op-play').click();
  await expect.poll(() => paused('bo')).toBe(false);
  await expect.poll(() => paused('amy')).toBe(true);
  await expect(row('bo')).toHaveClass(/on/);
  await row('bo').locator('.op-play').click();
  await expect.poll(() => paused('bo')).toBe(true);
  await expect(page.locator('.toast.undo')).toHaveCount(0);
});

test('clicking a thumbnail enlarges it in the viewer without picking', async () => {
  await row('logo').locator('.op-thumb').click();
  await expect(page.locator('#modal-root .modal.dossier img')).toBeVisible();
  await expect(row('logo')).not.toHaveClass(/on/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-root .modal')).toHaveCount(0);
});

test('an audio clip enlarges to a player; a page opens in the desk browser', async () => {
  await row('amy').locator('.op-open').click();
  await expect(page.locator('#modal-root .modal.dossier audio')).toBeVisible();
  await page.keyboard.press('Escape');
  await row('page').locator('.op-link').click();
  await expect(page.locator('#modal-root .modal')).toBeVisible();
  await page.keyboard.press('Escape');
});
