// First run: an empty desk opens on "Connect an agent". The command line tool, Claude Code (a stand-in claude that
// records its arguments) and firstmate (adapters/firstmate/install.sh against a stub home, no launchd) all run for
// real, inside a temp HOME, so the user's own ~/.local/bin, ~/.claude.json and app settings are never touched.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedDemo } = require('../../app/demo/seed');

const { launchApp, ROOT } = require('./launch');
let app, page, tmp, home, profile, fakeHome;
const errors = [];
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-onboard-')));
  home = path.join(tmp, 'desk'); profile = path.join(tmp, 'profile'); fakeHome = path.join(tmp, 'home');
  fs.mkdirSync(fakeHome);
  const claude = path.join(tmp, 'claude');
  fs.writeFileSync(claude, `#!/bin/sh\nprintf '%s\\n' "$@" > "${tmp}/claude-args"\necho "Added stdio MCP server harbordeck to user config"\n`, { mode: 0o755 });
  app = await launchApp({ home, profile, env: { HOME: fakeHome, SHELL: '/bin/sh', HARBORDECK_CLAUDE_BIN: claude } });
  page = await app.firstWindow();
  page.on('pageerror', e => errors.push(e.message));
});
test.afterAll(async () => { await app?.close(); });

test('an empty desk opens on Connect an agent, with no agent activity yet', async () => {
  await expect(page.locator('.modal.connect-modal')).toBeVisible();
  await expect(page.locator('.connect-modal h2')).toHaveText(/connect an agent/i);
  await expect(page.locator('.cn-status')).toHaveClass(/none/);
  await expect(page.locator('.cn-status')).toContainText('No agent has written');
});

test('Install links hd and harbordeck in ~/.local/bin, Uninstall removes them', async () => {
  const bin = path.join(fakeHome, '.local', 'bin');
  await expect(page.locator('#cn-cli')).toContainText('~/.local/bin');
  await page.locator('#cn-cli-install').click();
  await expect(page.locator('#cn-cli')).toContainText('are linked in');
  for (const n of ['hd', 'harbordeck']) expect(fs.readlinkSync(path.join(bin, n))).toBe(path.join(ROOT, 'cli', 'bin', 'harbordeck.js'));
  await page.locator('#cn-cli').getByRole('button', { name: 'Uninstall' }).click();
  await expect(page.locator('#cn-cli-install')).toBeVisible();
  expect(fs.existsSync(path.join(bin, 'hd'))).toBe(false);
});

test('Claude Code: shows the exact command, then links the CLI and runs claude mcp add', async () => {
  const hd = path.join(fakeHome, '.local', 'bin', 'harbordeck');
  await expect(page.locator('.cn-panel')).toContainText(`claude mcp add harbordeck -s user -e HARBORDECK_HOME=${home} -- ${hd} mcp`);
  expect(fs.existsSync(path.join(tmp, 'claude-args'))).toBe(false); // nothing ran yet
  await page.locator('#cn-run').click();
  await expect(page.locator('#cn-out')).toHaveClass(/ok/);
  await expect(page.locator('#cn-out')).toContainText('Added stdio MCP server');
  expect(fs.readFileSync(path.join(tmp, 'claude-args'), 'utf8').trim().split('\n')).toEqual(['mcp', 'add', 'harbordeck', '-s', 'user', '-e', `HARBORDECK_HOME=${home}`, '--', hd, 'mcp']);
  expect(fs.readlinkSync(hd)).toBe(path.join(ROOT, 'cli', 'bin', 'harbordeck.js'));
});

test('the status light turns on when an agent writes to the desk', async () => {
  fs.writeFileSync(path.join(home, 'items', 'hello.json'), JSON.stringify({ id: 'hello', kind: 'todo', title: 'Hello from the agent', created: Math.floor(Date.now() / 1000), status: 'open' }));
  await expect(page.locator('.cn-status')).toHaveClass(/live/);
  await expect(page.locator('.cn-status')).toContainText('items/hello.json');
});

test('firstmate: install.sh against a stub home, without launchd; the app picks up its settings', async () => {
  const fm = path.join(tmp, 'fm');
  fs.mkdirSync(path.join(fm, 'bin'), { recursive: true }); fs.mkdirSync(path.join(fm, 'data'));
  for (const s of ['fm-captain-hold.sh', 'fm-inbox.sh', 'fm-crew-state.sh']) fs.writeFileSync(path.join(fm, 'bin', s), '#!/bin/sh\n', { mode: 0o755 });
  await page.locator('.cn-tabs').getByRole('radio', { name: 'firstmate' }).click();
  await expect(page.locator('#cn-run')).toBeDisabled();
  await page.locator('#cn-fm-home').fill(fm);
  await page.locator('#cn-fm-home').press('Tab');
  await expect(page.locator('.cn-panel pre')).toContainText(`--fm-home ${fm}`);
  await page.locator('.cn-panel').getByRole('checkbox').uncheck();
  await page.locator('#cn-run').click();
  await expect(page.locator('#cn-out')).toHaveClass(/ok/, { timeout: 30000 });
  await expect(page.locator('#cn-out')).toContainText('service: not installed');
  expect(fs.readFileSync(path.join(fm, 'data', 'captain.md'), 'utf8')).toContain('{#harbordeck}');
  expect(JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).artifactRoot).toBe(fm);
  expect((await page.evaluate(() => window.harbor.getSettings())).artifactRoot).toBe(fm);
  expect(fs.existsSync(path.join(fakeHome, 'Library', 'LaunchAgents'))).toBe(false);
});

test('Done finishes setup: the office opens and the setup is not offered again', async () => {
  await page.locator('.connect-modal footer').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.modal.connect-modal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open the office' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).onboarded).toBe(true);
  expect((await page.evaluate(() => window.harbor.snapshot())).firstRun).toBe(false);
});

test('Settings: Agents opens Connect (CLI focused or not), Version checks for updates; Save keeps the setup finished', async () => {
  await page.getByRole('button', { name: 'Open the office' }).click();
  await page.keyboard.press('m'); await page.locator('#btn-settings').click();
  await expect(page.locator('.modal.settings-modal')).toBeVisible();
  await page.locator('#btn-update-check').click();
  await expect(page.locator('#toasts .toast').last()).toContainText('source checkout');
  await page.locator('.settings-modal footer').getByRole('button', { name: 'Save' }).click();
  expect(JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).onboarded).toBe(true);
  await page.keyboard.press('m'); await page.locator('#btn-settings').click();
  await page.getByRole('button', { name: 'Command line tool…' }).click();
  await expect(page.locator('.connect-modal #cn-cli')).toHaveClass(/focus/);
  await expect(page.locator('.connect-modal h2')).toHaveText('Connect an agent');
  await page.locator('.connect-modal footer').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.modal.connect-modal')).toHaveCount(0);
});

test('a desk that already has items skips the setup; File > Connect an Agent still opens it', async () => {
  const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-onboard2-'));
  const app2 = await launchApp({ home: seedDemo(path.join(t2, 'home')), profile: path.join(t2, 'profile'), env: { HOME: t2 } });
  try {
    const p2 = await app2.firstWindow();
    await expect(p2.getByRole('button', { name: 'Open the office' })).toBeVisible();
    await expect(p2.locator('.modal.connect-modal')).toHaveCount(0);
    await app2.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(m => m.label === 'File').submenu.items.find(i => i.label === 'Connect an Agent…').click());
    await expect(p2.locator('.modal.connect-modal')).toBeVisible();
    await expect(p2.locator('.cn-status')).toHaveClass(/live|recent|idle/);
  } finally { await app2.close(); }
});
