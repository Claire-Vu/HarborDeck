'use strict';
// Image attachments: what the main process accepts (type by magic bytes, size, where it writes), what an answer
// line may name (desk copies only), how the store and snapshot carry them, and the markup helpers' wire format.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const attach = require('../../app/lib/attach');
const store = require('../../app/lib/store');
const marks = require('../../app/renderer/markup-view');

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-attach-')));
// A real (tiny, synthetic) PNG: w x h of one colour.
function png(w = 4, h = 3, rgb = [200, 40, 40]) {
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

test('sniff knows PNG, JPEG, GIF and WebP by their bytes and nothing else', () => {
  assert.strictEqual(attach.sniff(png()), 'png');
  assert.strictEqual(attach.sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])), 'jpg');
  assert.strictEqual(attach.sniff(Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00', 'latin1')), 'gif');
  assert.strictEqual(attach.sniff(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1')), 'webp');
  assert.strictEqual(attach.sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.strictEqual(attach.sniff(Buffer.from('%PDF-1.7 hello world')), null);
  assert.strictEqual(attach.sniff(Buffer.alloc(3)), null);
});

test('save copies into attachments/<yyyy-mm>/<hash>.<ext>, 0600, atomically and once per content', () => {
  const home = tmp();
  const a = attach.save(home, png(), new Date(2026, 9, 9));
  assert.match(a.path, new RegExp(`^${home}/attachments/2026-10/[0-9a-f]{10}\\.png$`));
  assert.strictEqual(fs.statSync(a.path).mode & 0o777, 0o600);
  assert.deepStrictEqual(fs.readFileSync(a.path), png());
  // an ArrayBuffer (what the renderer sends over IPC) of the same bytes lands on the same file
  const b = attach.save(home, new Uint8Array(png()).buffer, new Date(2026, 9, 9));
  assert.strictEqual(b.path, a.path);
  assert.deepStrictEqual(fs.readdirSync(path.dirname(a.path)), [path.basename(a.path)]); // no tmp files left behind
  assert.notStrictEqual(attach.save(home, png(5, 3), new Date(2026, 9, 9)).path, a.path);
});

test('save refuses empty, oversized and non-image bytes (SVG included)', () => {
  const home = tmp();
  assert.throws(() => attach.save(home, Buffer.alloc(0)), /empty/);
  assert.throws(() => attach.save(home, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')), /PNG, JPEG, WebP or GIF/);
  const big = Buffer.concat([png(), Buffer.alloc(attach.MAX_BYTES)]);
  assert.throws(() => attach.save(home, big), /over 15 MB/);
  assert.strictEqual(fs.existsSync(path.join(home, 'attachments')), false);
});

test('clean accepts only desk copies and well-formed marks', () => {
  const home = tmp(); const other = tmp();
  const a = attach.save(home, png()).path, m = attach.save(home, png(6, 4)).path;
  const ok = attach.clean(home, [{ type: 'image', path: a, marked: m, source: 'snap', w: 4, h: 3, marks: [{ shape: 'pin', x: .51234, y: .2, n: 1, note: 'here' }, { shape: 'box', x: 0, y: 0, w: .5, h: .5, n: 2 }, { shape: 'arrow', x: .1, y: .1, x2: .9, y2: .9 }], extra: 'dropped' }]);
  assert.deepStrictEqual(ok, [{ type: 'image', path: a, marked: m, source: 'snap', w: 4, h: 3, marks: [{ shape: 'pin', x: .512, y: .2, n: 1, note: 'here' }, { shape: 'box', x: 0, y: 0, w: .5, h: .5, n: 2 }, { shape: 'arrow', x: .1, y: .1, x2: .9, y2: .9 }] }]);
  assert.strictEqual(attach.clean(home, undefined), null);
  assert.strictEqual(attach.clean(home, []), null);
  // anything that is not a file the app wrote under <home>/attachments
  const outside = attach.save(other, png()).path;
  const fake = path.join(home, 'attachments', 'x.png'); fs.writeFileSync(fake, png()); // fine: under attachments
  const hidden = path.join(home, 'attachments', '.x.png'); fs.writeFileSync(hidden, png());
  const link = path.join(home, 'attachments', 'link.png'); fs.symlinkSync(outside, link);
  const txt = path.join(home, 'attachments', 'notes.txt'); fs.writeFileSync(txt, 'x');
  for (const p of [outside, hidden, link, txt, 'attachments/x.png', path.join(home, 'attachments', '..', 'answers.jsonl'), path.join(home, 'attachments', 'missing.png')])
    assert.throws(() => attach.clean(home, [{ type: 'image', path: p }]), /not a desk attachment/, p);
  assert.ok(attach.clean(home, [{ path: fake }]));
  assert.throws(() => attach.clean(home, [{ type: 'video', path: a }]), /type must be image/);
  assert.throws(() => attach.clean(home, [{ path: a, marked: outside }]), /marked copy/);
  assert.throws(() => attach.clean(home, [{ path: a, source: 'web' }]), /source/);
  assert.throws(() => attach.clean(home, [{ path: a, marks: [{ shape: 'circle', x: .1, y: .1 }] }]), /mark 0/);
  assert.throws(() => attach.clean(home, [{ path: a, marks: [{ shape: 'pin', x: 1.5, y: .1 }] }]), /mark 0/);
  assert.throws(() => attach.clean(home, [{ path: a, marks: [{ shape: 'box', x: .1, y: .1 }] }]), /box needs w,h/);
  assert.throws(() => attach.clean(home, Array(9).fill({ path: a })), /at most 8/);
  assert.throws(() => attach.clean(home, 'nope'), /must be a list/);
});

test('appendAnswer writes attachments through, refuses forged ones, and the snapshot serves them', () => {
  const home = tmp(); store.ensureHome(home);
  const a = attach.save(home, png()).path;
  const line = JSON.parse(store.appendAnswer(home, { id: 'req-1-2', action: 'request', note: 'Fix this [1] here', to: 'mate-main', attachments: [{ type: 'image', path: a, source: 'paste', marks: [{ shape: 'pin', x: .5, y: .5, n: 1, note: 'here' }] }] }));
  assert.deepStrictEqual(line.attachments, [{ type: 'image', path: a, source: 'paste', marks: [{ shape: 'pin', x: .5, y: .5, n: 1, note: 'here' }] }]);
  assert.strictEqual('attachments' in JSON.parse(store.appendAnswer(home, { id: 'x', action: 'comment', note: 'no image', attachments: undefined })), false);
  assert.throws(() => store.appendAnswer(home, { id: 'x', action: 'comment', note: 'n', attachments: [{ path: '/etc/hosts' }] }), /not a desk attachment/);
  assert.strictEqual(store.readAnswers(home).length, 2); // the refused line was never written
  // the snapshot resolves desk copies named by answers (so harbor:// may serve them), never other paths
  fs.appendFileSync(path.join(home, 'answers.jsonl'), JSON.stringify({ id: 'y', action: 'comment', note: 'forged', attachments: [{ type: 'image', path: '/etc/hosts' }], at: 1 }) + '\n');
  const snap = store.snapshot(home);
  assert.strictEqual(snap.files[a].exists, true);
  assert.match(snap.files[a].url, /^harbor:\/\/file\//);
  assert.strictEqual(snap.files['/etc/hosts'], undefined);
});

test('the answer schema takes attachments; the CLI validator agrees with the app', async () => {
  const { validate } = await import('../../cli/src/schema.js');
  const good = { id: 'a', action: 'comment', note: 'see [1]', attachments: [{ type: 'image', path: '/h/attachments/2026-10/aa.png', marked: '/h/attachments/2026-10/bb.png', source: 'snap', w: 10, h: 10, marks: [{ shape: 'pin', x: .5, y: .5, n: 1, note: 'x' }] }], at: 1 };
  assert.deepStrictEqual(validate('answer', good), []);
  assert.notDeepStrictEqual(validate('answer', { ...good, attachments: [{ type: 'image', path: 'relative.png' }] }), []);
  assert.notDeepStrictEqual(validate('answer', { ...good, attachments: [{ type: 'image', path: '/a.png', marks: [{ shape: 'blob', x: 0, y: 0 }] }] }), []);
});

test('markup helpers: a click is a pin, pins and boxes are numbered, notes join the text', () => {
  assert.deepStrictEqual(marks.fromDrag('box', { x: .5, y: .5 }, { x: .505, y: .5 }), { shape: 'pin', x: .5, y: .5, note: '' });
  assert.deepStrictEqual(marks.fromDrag('box', { x: .6, y: .7 }, { x: .2, y: .1 }), { shape: 'box', x: .2, y: .1, w: .39999999999999997, h: .6, note: '' });
  assert.deepStrictEqual(marks.fromDrag('arrow', { x: .1, y: .1 }, { x: .5, y: .5 }), { shape: 'arrow', x: .1, y: .1, x2: .5, y2: .5 });
  const list = marks.renumber([{ shape: 'pin', x: .1, y: .1, note: 'too wide' }, { shape: 'arrow', x: 0, y: 0, x2: 1, y2: 1 }, { shape: 'box', x: 0, y: 0, w: .123456, h: .2, note: '' }]);
  assert.deepStrictEqual(list.map(m => m.n), [1, undefined, 2]);
  assert.deepStrictEqual(list.map(marks.wire), [{ shape: 'pin', x: .1, y: .1, n: 1, note: 'too wide' }, { shape: 'arrow', x: 0, y: 0, x2: 1, y2: 1 }, { shape: 'box', x: 0, y: 0, w: .123, h: .2, n: 2 }]);
  assert.strictEqual(marks.noteText([{ marks: list.map(marks.wire) }, { marks: [{ shape: 'pin', x: 0, y: 0, n: 1, note: 'cut off' }] }, {}]), '[1] too wide [2.1] cut off');
});
