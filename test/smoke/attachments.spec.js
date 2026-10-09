// Image attachments end to end on the real app (headless, synthetic data): an image pasted or dropped on the ship
// phone is copied into <home>/attachments at once and named by the request line; "Add to…" turns the message into a
// comment on the item at the desk; Snap desk captures the window, the markup writes a flattened copy and the pin
// notes join the text; the ask / needs-work slip takes an image too; non-images are refused; the rail shows the images.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { seedDemo } = require('../../app/demo/seed');
const { launchApp } = require('./launch');

let app, page, home;
test.describe.configure({ mode: 'serial' });
const answers = () => fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
// A synthetic w x h PNG of one colour.
function png(w, h, rgb) {
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
// Fire a real paste (or drop) event carrying a file, the way the OS hands one to the page.
const fire = (sel, kind, b64, type, name) => page.evaluate(({ sel, kind, b64, type, name }) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([bytes], name, { type }));
  const el = document.querySelector(sel);
  if (kind === 'paste') el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  else { el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }
}, { sel, kind, b64, type, name });
const RED = png(48, 30, [210, 50, 40]).toString('base64'), BLUE = png(40, 40, [40, 80, 200]).toString('base64');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeAll(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-attach-'));
  home = seedDemo(path.join(tmp, 'home'));
  app = await launchApp({ home, profile: path.join(tmp, 'profile') });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  await page.getByRole('button', { name: 'Open the office' }).click();
});
test.afterAll(async () => { await app?.close(); });

test('paste and drop on the phone: copied into attachments at once, named by the request line, shown on the rail', async () => {
  await page.locator('#btn-phone').click();
  await fire('.phone-pad', 'paste', RED, 'image/png', 'Screenshot.png');
  await expect(page.locator('#phone .att-thumb')).toHaveCount(1);
  const p1 = await page.locator('#phone .att-thumb').first().getAttribute('data-path');
  expect(p1.startsWith(path.join(fs.realpathSync(home), 'attachments') + path.sep) || p1.startsWith(path.join(home, 'attachments') + path.sep)).toBe(true);
  expect(fs.readFileSync(p1).toString('base64')).toBe(RED); // the bytes, not a path to a temp file
  expect(fs.statSync(p1).mode & 0o777).toBe(0o600);
  await fire('#phone .phone-box', 'drop', BLUE, 'image/png', 'ref.png');
  await expect(page.locator('#phone .att-thumb')).toHaveCount(2);
  await fire('#phone .phone-box', 'drop', Buffer.from('hello').toString('base64'), 'text/plain', 'notes.txt');
  await expect(page.locator('.toast.warn', { hasText: 'Only PNG, JPEG, WebP or GIF' })).toBeVisible();
  await page.locator('.toast.warn .toast-x').click();
  await expect(page.locator('#phone .att-thumb')).toHaveCount(2);
  await page.locator('.phone-pad').fill('The tray covers the rail');
  await page.locator('.phone-pad').press('Enter');
  await expect(page.locator('#phone')).toHaveCount(0);
  const line = answers().at(-1);
  expect(line).toMatchObject({ action: 'request', note: 'The tray covers the rail', to: 'mate-main' });
  expect(line.attachments.map(a => [a.source, a.w, a.h])).toEqual([['paste', 48, 30], ['drop', 40, 40]]);
  expect(line.attachments[0].path).toBe(p1);
  await expect(page.locator('#rail .ticket', { hasText: 'The tray covers the rail' }).locator('.tk-att')).toHaveText('🖼 2');
  // the tray empties once sent
  await page.locator('#btn-phone').click();
  await expect(page.locator('#phone .att-thumb')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('Add to… is off by default; picking the item at the desk sends a comment on it; × goes back to a new order', async () => {
  const desk = await page.evaluate(() => document.querySelector('#desk-surface [data-item], .slip[data-id]')?.dataset.item || null);
  await page.locator('#btn-phone').click();
  await expect(page.locator('.addto-btn')).toHaveText('Add to…');
  await page.locator('.addto-btn').click();
  const first = page.locator('.addto-opt').first();
  await expect(first.locator('.addto-kind')).toHaveText('at the desk');
  const target = await first.getAttribute('data-id');
  if (desk) expect(target).toBe(desk);
  await first.click();
  await expect(page.locator('.addto-chip')).toBeVisible();
  await expect(page.locator('#phone .phone-q').first()).toBeDisabled(); // an addition goes now, never queued
  await page.locator('.addto-x').click();
  await expect(page.locator('.addto-btn')).toBeVisible();
  await expect(page.locator('#phone .phone-q').first()).toBeEnabled();
  await page.locator('.addto-btn').click(); await page.locator('.addto-opt').first().click();
  await fire('.phone-pad', 'paste', BLUE, 'image/png', 'b.png');
  await page.locator('.phone-pad').fill('also check the dark theme');
  await page.locator('.phone-pad').press('Enter');
  const line = answers().at(-1);
  expect(line).toMatchObject({ id: target, action: 'comment', note: 'also check the dark theme' });
  expect('to' in line).toBe(false);
  expect(line.attachments).toHaveLength(1);
  // the next call is a new order again
  await page.locator('#btn-phone').click();
  await expect(page.locator('.addto-btn')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('Snap desk captures the window without the phone, the markup writes a marked copy and the pin notes', async () => {
  await page.locator('#btn-phone').click();
  const phoneBox = await page.locator('#phone .phone-box').boundingBox();
  await page.locator('#phone .att-snap').click();
  await expect(page.locator('#markup')).toBeVisible();
  const canvas = page.locator('#markup .mk-canvas');
  const b = await canvas.boundingBox();
  await page.mouse.click(b.x + b.width * .3, b.y + b.height * .4); // a pin
  await page.keyboard.type('stamp hidden here');
  await page.keyboard.press('Tab');
  await page.locator('.mk-tool[data-tool="box"]').click();
  await page.mouse.move(b.x + b.width * .6, b.y + b.height * .2); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .8, b.y + b.height * .5, { steps: 4 }); await page.mouse.up();
  await page.locator('#markup .mk-note').nth(1).fill('overflow');
  await page.locator('.mk-tool[data-tool="arrow"]').click();
  await page.mouse.move(b.x + b.width * .1, b.y + b.height * .9); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .25, b.y + b.height * .5, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('#markup .mk-notes li')).toHaveCount(2); // arrows carry no number
  // keys under the markup stay with it: Esc in a note input would cancel only the markup, never hang up
  await page.keyboard.press(`${MOD}+Enter`);
  await expect(page.locator('#markup')).toHaveCount(0);
  await expect(page.locator('#phone .att-n')).toHaveText('3');
  await page.locator('.phone-pad').fill('Two problems');
  await page.locator('.phone-pad').press('Enter');
  const line = answers().at(-1);
  expect(line.note).toBe('Two problems [1] stamp hidden here [2] overflow');
  const [a] = line.attachments;
  expect(a.source).toBe('snap');
  expect(a.marks.map(m => [m.shape, m.n, m.note])).toEqual([['pin', 1, 'stamp hidden here'], ['box', 2, 'overflow'], ['arrow', undefined, undefined]]);
  expect(a.marks[0].x).toBeCloseTo(.3, 1);
  const orig = fs.readFileSync(a.path), marked = fs.readFileSync(a.marked);
  expect(orig.subarray(1, 4).toString()).toBe('PNG'); expect(marked.subarray(1, 4).toString()).toBe('PNG');
  expect(a.marked).not.toBe(a.path);
  expect(a.w).toBeGreaterThanOrEqual(1280); // the whole window, at device pixels
  // the snap shows the desk, not the phone: the phone's wood frame (#8a5a33) is not where the phone stood
  const px = await app.evaluate(({ nativeImage }, { file, x, y, w }) => {
    const img = nativeImage.createFromPath(file), k = img.getSize().width / w;
    const bm = img.crop({ x: Math.round(x * k), y: Math.round(y * k), width: 1, height: 1 }).toBitmap(); // BGRA
    return [bm[2], bm[1], bm[0]];
  }, { file: a.path, x: phoneBox.x + 6, y: phoneBox.y + phoneBox.height / 2, w: await page.evaluate(() => window.innerWidth) });
  expect(Math.abs(px[0] - 0x8a) + Math.abs(px[1] - 0x5a) + Math.abs(px[2] - 0x33)).toBeGreaterThan(40);
  expect(await page.evaluate(() => document.body.classList.contains('snapping'))).toBe(false);
});

test('the ask slip takes a pasted image; the line lands after the undo hold and the ticket shows it', async () => {
  const before = answers().length;
  await page.keyboard.press('4'); // Ask (every kind has it; needs-work uses the same slip)
  await expect(page.locator('.noteslip')).toBeVisible();
  await fire('.noteslip textarea', 'paste', RED, 'image/png', 'x.png');
  await expect(page.locator('.noteslip .att-thumb')).toHaveCount(1);
  await page.locator('.noteslip textarea').fill('the red bar is wrong');
  await page.locator('.noteslip textarea').press(`${MOD}+Enter`);
  await expect.poll(() => answers().length, { timeout: 8000 }).toBe(before + 1);
  const line = answers().at(-1);
  expect(line).toMatchObject({ action: 'ask', note: 'the red bar is wrong' });
  expect(fs.readFileSync(line.attachments[0].path).toString('base64')).toBe(RED);
  // the desk moves on after an ask; its ticket on the rail shows the image (served through harbor:// from the snapshot)
  await page.locator('#rail .ticket', { hasText: 'the red bar is wrong' }).click();
  const img = page.locator('.tk-pop .att-mini img');
  await expect(img).toBeVisible({ timeout: 8000 });
  expect(await img.evaluate(i => i.complete && i.naturalWidth)).toBe(48);
});
