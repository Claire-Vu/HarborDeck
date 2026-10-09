// Packaged-app walk: the built Harbor Deck.app, headless, under a temp HOME, against a local update feed.
// Proves the bundled CLI runs with no Node on PATH, first run, Install/Uninstall Command Line Tool, and both update
// outcomes: a newer version (an unsigned build shows a Download link and downloads nothing) and no release yet.
// Build first (ad-hoc, feed on 127.0.0.1:47123; the feed config is the package.json build with publish swapped):
//   node -e "const b=require('./package.json').build;b.publish={provider:'generic',url:'http://127.0.0.1:47123/'};b.mac.identity='-';b.mac.hardenedRuntime=false;require('fs').writeFileSync('/tmp/eb-feed.json',JSON.stringify(b))"
//   npx electron-builder --mac zip --arm64 --config /tmp/eb-feed.json --publish never
//   node .agents/skills/verify-harbordeck/scripts/packaged-walk.cjs <evidence-dir>
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const { launchApp } = require('../../../../test/smoke/launch');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const E = path.resolve(process.argv[2] || 'packaged-walk'); fs.mkdirSync(E, { recursive: true });
const APP = path.join(ROOT, 'dist/mac-arm64/Harbor Deck.app'), EXE = path.join(APP, 'Contents/MacOS/Harbor Deck');
const res = [];
const step = async (n, fn) => { try { await fn(); res.push(`PASS ${n}`); } catch (e) { res.push(`FAIL ${n}: ${e.message.split('\n')[0]}`); } console.log(res.at(-1)); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };
// feed: newest version 9.9.9 (the build's own latest-mac.yml, renumbered), or 404 for "no release yet"
let feed = 'newer'; const hits = [];
const yml = fs.readFileSync(path.join(ROOT, 'dist/latest-mac.yml'), 'utf8').replace(/0\.1\.0/g, '9.9.9');
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; hits.push(`${q.method} ${p}`);
  if (feed === 'newer' && p === '/latest-mac.yml') r.end(yml); else { r.statusCode = 404; r.end(); } });
const launch = t => launchApp({ app: EXE, home: t + '/desk', profile: t + '/p', env: { HOME: t + '/h', HARBORDECK_CLAUDE_BIN: '/usr/bin/false' } });
const tmp = () => { const t = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hd-pkgwalk-'))); fs.mkdirSync(t + '/h'); return t; };

(async () => {
  if (!fs.existsSync(EXE)) throw new Error(`no build at ${APP}`);
  await new Promise(r => srv.listen(47123, '127.0.0.1', r));
  const t = tmp(), app = await launch(t), page = await app.firstWindow();
  const shot = async n => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(E, n + '.png') }); };
  const bin = t + '/h/.local/bin', target = path.join(APP, 'Contents/Resources/app.asar.unpacked/cli/bin/hd-app');
  await step('01-packaged-first-run', async () => { await page.locator('.connect-modal').waitFor(); await page.locator('#cn-cli').getByText('hd-app').waitFor(); await shot('01-packaged-first-run'); });
  await step('02-packaged-cli-install', async () => {
    await page.locator('#cn-cli-install').click(); await page.locator('#cn-cli').getByText('are linked in').waitFor();
    eq(fs.readlinkSync(bin + '/hd'), target, 'hd link'); eq(fs.readlinkSync(bin + '/harbordeck'), target, 'harbordeck link'); await shot('02-packaged-cli-installed');
  });
  await step('03-hd-without-node', async () => {
    const env = { PATH: '/usr/bin:/bin', HOME: t + '/h', HARBORDECK_HOME: t + '/desk', HARBORDECK_FROM: 'mate-main' };
    let node = ''; try { node = execFileSync('/bin/sh', ['-c', 'command -v node'], { env }).toString(); } catch (e) { /* none: wanted */ }
    if (node) throw new Error(`node on PATH: ${node}`);
    const v = execFileSync(bin + '/hd', ['--version'], { env }).toString().trim();
    const d = execFileSync(bin + '/hd', ['decision', 'hdv-pkg', 'Ship the dmg?', '-s', 'Written by the bundled hd with no Node.', '--opt', 'ship+', '--opt', 'wait', '-t', 'hdv-release'], { env }).toString().trim();
    fs.writeFileSync(path.join(E, '03-hd-without-node.txt'), `$ env PATH=/usr/bin:/bin ~/.local/bin/hd --version\n${v}\n$ ~/.local/bin/hd decision hdv-pkg "Ship the dmg?" ...\n${d}\n`);
    await page.locator('.cn-status.live').getByText('items/hdv-pkg.json').waitFor(); await shot('03-packaged-light-live');
  });
  await step('04-packaged-done', async () => { await page.locator('.connect-modal footer').getByRole('button', { name: 'Done' }).click(); await page.getByRole('button', { name: 'Open the office' }).click(); });
  await step('05-update-banner', async () => {
    await page.keyboard.press('m'); await page.locator('#btn-settings').click();
    eq((await page.locator('.set-ver').textContent()).trim(), '0.1.0', 'version label');
    await page.locator('#btn-update-check').click();
    const n = page.locator('#toasts .toast.update'); await n.waitFor({ timeout: 20000 });
    if (!(await n.textContent()).includes('Harbor Deck 9.9.9 is out.')) throw new Error(await n.textContent());
    await n.getByRole('button', { name: 'Download' }).waitFor(); await shot('05-update-banner');
  });
  await step('06-feed-read-nothing-downloaded', async () => { if (!hits.includes('GET /latest-mac.yml') || hits.some(h => /\.zip/.test(h))) throw new Error(hits.join(', ')); });
  await step('07-cli-uninstall', async () => {
    await page.keyboard.press('Escape'); await page.keyboard.press('m'); await page.locator('#btn-settings').click();
    await page.getByRole('button', { name: 'Command line tool…' }).click(); await page.locator('#cn-cli').getByRole('button', { name: 'Uninstall' }).click();
    await page.locator('#cn-cli-install').waitFor(); eq(fs.readdirSync(bin).length, 0, 'links left');
  });
  await app.close();
  feed = 'none';
  const t2 = tmp(), app2 = await launch(t2), p2 = await app2.firstWindow();
  await step('08-no-release-yet', async () => {
    await p2.locator('.connect-modal footer').getByRole('button', { name: 'Skip for now' }).click(); await p2.getByRole('button', { name: 'Open the office' }).click();
    await p2.keyboard.press('m'); await p2.locator('#btn-settings').click(); await p2.locator('#btn-update-check').click();
    const w = p2.locator('#toasts .toast.warn'); await w.waitFor({ timeout: 20000 });
    eq((await w.textContent()).replace('×', '').trim(), 'Could not check for updates: no release is published yet', 'toast');
    await p2.waitForTimeout(400); await p2.screenshot({ path: path.join(E, '08-no-release-yet.png') });
  });
  await app2.close(); srv.close();
  fs.writeFileSync(path.join(E, 'results.txt'), res.join('\n') + '\n');
  process.exitCode = res.every(r => r.startsWith('PASS')) ? 0 : 1;
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
