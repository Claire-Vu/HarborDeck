// Evidence scenario: the running desk is a live feed. An agent posts items with the CLI and they appear, a stamp
// lands in answers.jsonl and the firstmate bridge (echo mode) logs the exact firstmate command, an ask becomes a
// ticket, and the agent's `harbordeck reply` turns that ticket green. Run through test/evidence/run.sh.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const title = 'Harbor Deck live feed: items in, stamp and ask out, reply back';

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`run through test/evidence/run.sh (${k} unset)`); return v; };
const HOME = env('HD_EV_HOME');
const HD = env('HD_EV_HD');
const BRIDGE_LOG = env('HD_EV_BRIDGE_LOG');
const STAMP = env('HD_EV_STAMP');
const ASK = env('HD_EV_ASK');

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const answers = () => read(join(HOME, 'answers.jsonl')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const bridged = (needle) => read(BRIDGE_LOG).split('\n').filter((l) => l.includes(needle));
const hd = (args, input) => execFileSync(HD, args, { input, env: { ...process.env, HARBORDECK_HOME: HOME, HARBORDECK_FROM: 'mate-main' } }).toString();
const titleOf = (id) => JSON.parse(readFileSync(join(HOME, 'items', `${id}.json`), 'utf8')).title;

export default async ({ page, step, save }) => {
  await step('Open the office', async () => {
    await page.reload();
    const open = page.getByRole('button', { name: 'Open the office' });
    if (await open.isVisible({ timeout: 3000 }).catch(() => false)) await open.click();
  }, { ready: async () => (await page.locator('#queue li').count()) > 0 && { queue: await page.locator('#queue li').count() } });

  await step('Agent posts two items with one batch', () => hd(['batch'], [
    'decision live-palette "Which palette for the launch page?" -s "Two options mocked; warm tested better." --opt warm+ --opt cool -p 2',
    'todo live-renew "Renew the maps API key" -s "Expires Friday; only you can log in." -d +3d',
  ].join('\n')), { ready: async () => {
    const q = page.locator('#queue li');
    return (await q.filter({ hasText: 'Which palette' }).count()) && (await q.filter({ hasText: 'Renew the maps' }).count()) && { queue: await q.count() };
  } });

  const stampTitle = titleOf(STAMP);
  const stampCount = answers().length;
  await step('Stamp a decision (key 1)', async () => {
    await page.locator('#queue li', { hasText: stampTitle }).click();
    await page.keyboard.press('1');
  }, { timeout: 20000, ready: async () => {
    const line = answers().slice(stampCount).find((a) => a.id === STAMP && a.action === 'decide');
    const routed = bridged(STAMP).find((l) => l.includes('fm-captain-hold.sh') || l.includes('fm-inbox.sh'));
    if (!line || !routed) return false;
    save('stamp.json', JSON.stringify({ answer: line, bridge: routed }, null, 2));
    return { key: line.key, bridge: routed.includes('fm-captain-hold.sh') ? 'captain hold answer' : 'inbox note' };
  } });

  const askTitle = titleOf(ASK);
  const askText = 'What would change if we waited a week?';
  await step('Ask a follow-up (key 4)', async () => {
    await page.locator('#queue li', { hasText: askTitle }).click();
    await page.keyboard.press('4');
    await page.locator('.modal.noteslip textarea').fill(askText);
    await page.getByRole('button', { name: 'Send' }).click();
  }, { timeout: 20000, ready: async () => {
    const line = answers().find((a) => a.id === ASK && a.action === 'ask' && a.note === askText);
    const routed = bridged(`hd-${ASK}-ask-`).find((l) => l.includes('fm-inbox.sh'));
    const ticket = await page.locator('#rail .ticket.waiting').count();
    if (!line || !routed || !ticket) return false;
    save('ask.json', JSON.stringify({ answer: line, bridge: routed }, null, 2));
    return { ticket: 'waiting', bridge: 'inbox note' };
  } });

  await step('Agent replies; the ticket turns green', () => hd(['reply', ASK, 'Waiting a week costs one posting slot; nothing else changes.']),
    { ready: async () => (await page.locator('#rail .ticket.replied.new').count()) > 0 && { ticket: 'replied' } });

  await step('Read the reply on the rail', () => page.locator('#rail .ticket.replied.new').first().click(),
    { ready: () => page.locator('.tk-pop').getByText('nothing else changes').isVisible() });
};
