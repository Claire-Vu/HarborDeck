'use strict';
// Writes a synthetic "full day" into a data directory: items, rules, fleet, quota, a few answer lines and
// original art. Times are relative to `now` so the demo always looks current. All content is invented.
const fs = require('fs');
const path = require('path');

const H = 3600, D = 86400;

function items(t, webUrl) {
  return [
    { id: 'pr-142-checkout', topic: 'checkout', kind: 'decision', project: 'board-app', stream: 'checkout', from: 'mate-web', priority: 1, due: t + 20 * H,
      title: 'Merge PR 142 (calmer checkout)?',
      summary: 'The checkout is down to two steps and one screen. Card errors now show inline instead of a modal. All 212 tests pass and the preview deploy is up. Nothing else waits on this branch.',
      options: [{ key: 'merge', label: 'Merge', recommended: true }, { key: 'hold', label: 'Hold, I want changes' }, { key: 'later', label: 'Decide later' }],
      artifacts: [{ type: 'pr', url: 'https://github.com/example-org/board-app/pull/142' }, { type: 'image', path: 'assets/checkout-mock.svg' }, { type: 'video', path: 'assets/harbor-promo.mp4' }],
      rules: ['never-merge-without-word', 'a11y-contrast', 'tests-green'],
      checks: [{ rule: 'never-merge-without-word', ok: true, note: 'held for your word; nothing merged' }, { rule: 'a11y-contrast', ok: true, note: 'all text passes AA on the new screens' }, { rule: 'tests-green', ok: true, note: '212/212 on the last run' }],
      thread: [{ from: 'captain', text: 'make the pay button bigger on phones before merge', at: t - 26 * H }, { from: 'Web mate', text: 'Done; it is full-width under 480 px now. Screenshot on the desk.', at: t - 22 * H }],
      created: t - 23 * H },
    { id: 'pricing-launch', topic: 'launch', kind: 'decision', project: 'board-app', stream: 'launch', from: 'mate-growth', priority: 2, due: t + 3 * D,
      title: 'Launch pricing: one plan or free + pro?',
      summary: 'Free + pro earns more by month three in every comparable product. It also adds about $40 a month of hosting for free users. One plan is simpler to explain.',
      options: [{ key: 'free-pro', label: 'Free + pro ($9)', recommended: true }, { key: 'one-plan', label: 'One plan ($7)' }],
      body: 'assets/reports/pricing-tiers.md', rules: ['budget-60', 'no-dark-patterns'],
      checks: [{ rule: 'budget-60', ok: false, note: 'free tier hosting pushes tooling spend to about $70/mo' }, { rule: 'no-dark-patterns', ok: true, note: 'no countdowns or pre-ticked upgrades' }],
      created: t - 9 * H },
    { id: 'logo-direction', topic: 'logo', kind: 'decision', project: 'brand', stream: 'brand', from: 'mate-growth', priority: 2,
      title: 'Pick a logo direction',
      summary: 'Three directions, all original. B reads best at 16 px. C is the most distinctive but busy in one colour.',
      options: [{ key: 'a', label: 'A · Roundel' }, { key: 'b', label: 'B · Tide mark', recommended: true }, { key: 'c', label: 'C · Beacon' }],
      artifacts: [{ type: 'image', path: 'assets/logo-options.svg' }], rules: ['brand-calm'],
      created: t - 2 * D - 3 * H },
    { id: 'flaky-e2e', topic: 'ci', kind: 'decision', project: 'board-app', stream: 'quality', from: 'mate-web', priority: 3,
      title: 'Quarantine the flaky drag-and-drop test?',
      summary: 'It failed 4 of the last 30 runs, always on the slow runner. Quarantine keeps CI green while I rewrite it this week.',
      options: [{ key: 'quarantine', label: 'Quarantine and rewrite', recommended: true }, { key: 'keep', label: 'Keep it blocking' }],
      rules: ['tests-green'], checks: [{ rule: 'tests-green', ok: true, note: 'only this test is flaky' }],
      created: t - 5 * H },
    { id: 'rename-repo', topic: 'housekeeping', kind: 'decision', project: 'board-app', stream: 'housekeeping', from: 'mate-main', priority: 4,
      title: 'Rename the repo to match the product name?',
      summary: 'The repo is still called task-proto. Renaming breaks two bookmarks and nothing else.',
      options: [{ key: 'rename', label: 'Rename' }, { key: 'leave', label: 'Leave it', recommended: true }],
      created: t - 16 * D },
    { id: 'promo-cut-v2', topic: 'promo-video', kind: 'review', project: 'brand', stream: 'video', from: 'mate-growth', priority: 2, due: t + 40 * H,
      title: 'Review the 10-second promo cut',
      summary: 'A calm harbor loop for the landing page hero. No text on screen, so it works in every language. The boat crosses once every 15 seconds.',
      artifacts: [{ type: 'video', path: 'assets/harbor-promo.mp4' }], rules: ['brand-calm', 'no-onscreen-prices'],
      checks: [{ rule: 'brand-calm', ok: true, note: 'slow motion, muted palette' }, { rule: 'no-onscreen-prices', ok: true, note: 'no prices anywhere' }],
      created: t - 7 * H },
    { id: 'dashboard-mock', topic: 'dashboard', kind: 'review', project: 'board-app', stream: 'design', from: 'mate-web', priority: 3,
      title: 'Review the new dashboard layout',
      summary: 'Three stat cards on top, one trend chart below. The sidebar is collapsed by default on laptops.',
      artifacts: [{ type: 'image', path: 'assets/dashboard-mock.svg' }], rules: ['a11y-contrast'],
      checks: [{ rule: 'a11y-contrast', ok: false, note: 'grey sidebar labels are 3.9:1, below AA' }],
      created: t - 30 * H },
    { id: 'onboarding-copy', topic: 'launch', kind: 'review', project: 'board-app', stream: 'launch', from: 'mate-growth', priority: 3,
      title: 'Review onboarding copy v2',
      summary: 'Three screens and one empty state. Every line is under 12 words.',
      body: 'assets/reports/onboarding-copy.md', rules: ['plain-words'], checks: [{ rule: 'plain-words', ok: true, note: 'no jargon found' }],
      created: t - 4 * H },
    { id: 'newsletter-6', topic: 'newsletter', kind: 'review', project: 'brand', stream: 'newsletter', from: 'mate-growth', priority: 3, due: t + 2 * D,
      waiting: ['crew-newsletter'],
      title: 'Newsletter #6 draft',
      summary: 'What shipped in September, plus a teaser for the calmer checkout.',
      body: 'assets/reports/newsletter-draft.md', rules: ['plain-words'],
      thread: [{ from: 'Growth mate', text: 'Yes: the digest is off by default and the draft says so in the second bullet.', at: t - 1 * H }],
      created: t - 6 * H },
    { id: 'postgres-options', topic: 'infra', kind: 'answer', project: 'board-app', stream: 'infra', from: 'mate-web', priority: 3,
      title: 'Hosted Postgres: three options',
      summary: 'Provider Quay fits the beta best at $25 a month. Point-in-time restore covers a bad migration. Both managed options restored a 1 GB dump in under 4 minutes.',
      body: 'assets/reports/hosted-postgres.md', created: t - 20 * H },
    { id: 'analytics-options', topic: 'infra', kind: 'answer', project: 'board-app', stream: 'infra', from: 'mate-web', priority: 4,
      title: 'Privacy-friendly analytics',
      summary: 'Hosted service A covers the sign-up funnel for $9 a month. No cookies, no consent banner.',
      body: 'assets/reports/analytics-options.md', artifacts: [{ type: 'pdf', path: 'assets/analytics-one-pager.pdf' }], rules: ['budget-60'],
      checks: [{ rule: 'budget-60', ok: true, note: '$9/mo keeps tooling at $41' }],
      created: t - 3 * D },
    { id: 'competitor-scan', topic: 'research', rel: ['pricing-launch'], kind: 'answer', project: 'brand', stream: 'research', from: 'mate-growth', priority: 3,
      title: 'Competitor scan: task boards',
      summary: 'Five products, $0 to $12 a seat. Nobody does a good "what changed" view. Mobile is weak everywhere.',
      body: 'assets/reports/competitor-scan.md', artifacts: [{ type: 'link', url: 'https://example.com/' }],
      created: t - 28 * H },
    { id: 'todo-app-store', topic: 'app-store', kind: 'todo', project: 'captain', from: 'mate-main', priority: 1, due: t - 2 * H,
      title: 'Sign the app store developer agreement',
      summary: 'Only the account holder can accept it. The beta build is blocked until then.', created: t - 2 * D },
    { id: 'todo-domain', topic: 'domain', kind: 'todo', project: 'captain', from: 'mate-main', priority: 2, due: t + 30 * H,
      title: 'Renew the domain before it lapses',
      summary: 'Auto-renew failed on an expired card.', created: t - 10 * H },
    { id: 'todo-receipts', topic: 'bookkeeping', kind: 'todo', project: 'captain', from: 'mate-main', priority: 4,
      title: 'Forward September receipts to the bookkeeper',
      summary: 'Six receipts in the shared inbox.', created: t - 4 * D },
    // one hold with three questions (<task>.qN ids, one topic): they arrive as one question sheet
    { id: 'beta-invites.q1', topic: 'beta-invites', kind: 'decision', project: 'board-app', stream: 'launch', from: 'mate-main', priority: 3,
      title: 'Beta invites: how many in the first wave?', summary: 'Fifty people is enough to hear from every team size. Support stays under an hour a day.',
      options: [{ key: 'fifty', label: '50 people', recommended: true, why: 'enough feedback, support stays small' }, { key: 'two-hundred', label: '200 people', why: 'more signal, about 3 h of support a day' }],
      artifacts: [{ type: 'report', path: 'assets/beta/waves.html', label: 'Invite waves' }], created: t - 3 * H },
    { id: 'beta-invites.q2', topic: 'beta-invites', kind: 'decision', project: 'board-app', stream: 'launch', from: 'mate-main', priority: 3,
      title: 'Pick by waitlist order or by hand?', summary: 'Hand-picking takes about an hour and gives a better mix.',
      options: [{ key: 'waitlist', label: 'Waitlist order', why: 'fair and no work' }, { key: 'hand', label: 'Hand-pick', recommended: true, why: 'better mix of team sizes, an hour of picking' }], created: t - 3 * H },
    { id: 'beta-invites.q3', topic: 'beta-invites', kind: 'decision', project: 'board-app', stream: 'launch', from: 'mate-main', priority: 3,
      title: 'Send the invites by email or in the app?', summary: 'Email reaches people before they ever sign in.',
      options: [{ key: 'email', label: 'Email', recommended: true, why: 'works before they sign in' }, { key: 'in-app', label: 'In the app', why: 'only reaches people who already log in' }, { key: 'both', label: 'Both' }], created: t - 3 * H },
    webUrl && { id: 'plan-offline', topic: 'offline-mode', kind: 'review', project: 'board-app', stream: 'design', from: 'mate-web', priority: 3,
      title: 'Review the offline-mode plan',
      summary: 'Three steps: cache the last board, queue edits offline, show a quiet badge. Pin a note on any step you want changed.',
      artifacts: [{ type: 'web', url: `${webUrl}plan.html`, label: 'Plan page' }],
      created: t - 1 * H },
    { id: 'release-1-3', topic: 'releases', kind: 'answer', project: 'board-app', stream: 'release', from: 'mate-web', priority: 3, status: 'resolved',
      title: 'Release 1.3 notes', summary: 'Keyboard shortcuts, faster boards, weekly digest.', created: t - 6 * D }
  ].filter(Boolean).map(it => Object.assign({ status: 'open' }, it));
}

const rules = {
  'never-merge-without-word': { text: 'Never merge a PR without my explicit word.', source: 'standing order 1' },
  'tests-green': { text: 'Nothing ships with a red test suite.', source: 'standing order 2' },
  'a11y-contrast': { text: 'All text meets WCAG AA contrast.', source: 'design notes' },
  'brand-calm': { text: 'Brand visuals stay calm and quiet: slow motion, muted colours, no flashing.', source: 'brand notes' },
  'no-onscreen-prices': { text: 'No prices in videos; they go stale.', source: 'brand notes' },
  'no-dark-patterns': { text: 'No fake urgency, pre-ticked upsells or hidden cancel buttons.', source: 'standing order 3' },
  'plain-words': { text: 'User-facing copy uses plain words and short sentences.', source: 'style guide' },
  'budget-60': { text: 'Tooling budget is about $60 a month.', source: 'finance notes' },
  'medium-effort': { text: 'Default to medium effort; go deep only for real design or diagnosis questions.', source: 'standing order 4' }
};

function fleet(t) {
  return {
    generated: t, day: new Date(t * 1000).toISOString().slice(0, 10),
    firstmates: [
      { id: 'mate-main', label: 'First Mate', domain: 'everything else', harness: 'agent', model: 'large', state: 'attending' },
      { id: 'mate-web', label: 'Web mate', domain: 'board-app', harness: 'agent', model: 'large', state: 'attending' },
      { id: 'mate-growth', label: 'Growth mate', domain: 'brand and launch', harness: 'agent', model: 'large', state: 'attending' }
    ],
    crew: [
      { id: 'crew-checkout', firstmate: 'mate-web', harness: 'agent', model: 'opus', effort: 'medium', state: 'waiting', task: 'checkout', task_title: 'Two-step checkout', item: 'pr-142-checkout', project: 'board-app', shipped: 4, rework: 1 },
      { id: 'crew-tests', firstmate: 'mate-web', harness: 'agent', model: 'sonnet', effort: 'low', state: 'working', task: 'e2e-rewrite', task_title: 'Rewrite the drag-and-drop test', item: 'flaky-e2e', project: 'board-app', shipped: 6, rework: 0 },
      { id: 'crew-video', firstmate: 'mate-growth', harness: 'agent', model: 'opus', effort: 'medium', state: 'done', task: 'promo', task_title: 'Landing page promo loop', item: 'promo-cut-v2', project: 'brand', shipped: 2, rework: 1 },
      { id: 'scout-research', firstmate: 'mate-growth', harness: 'agent', model: 'fable', effort: 'medium', state: 'working', task: 'pricing-survey', task_title: 'Survey of annual-plan discounts', project: 'brand', shipped: 4, rework: 0 },
      { id: 'crew-infra', firstmate: 'mate-web', harness: 'agent', model: 'sonnet', effort: 'low', state: 'idle', project: 'board-app', shipped: 5, rework: 0 },
      { id: 'crew-ops', firstmate: 'mate-main', harness: 'agent', model: 'other', effort: 'high', state: 'idle', project: 'ops', shipped: 3, rework: 1 }
    ],
    regulars: [
      { id: 'checkout', label: 'The checkout', shipped: 2, rework: 1 },
      { id: 'launch', label: 'Launch prep', shipped: 3, rework: 0 },
      { id: 'brand', label: 'Brand studio', shipped: 2, rework: 2 },
      { id: 'infra', label: 'Engine room', shipped: 4, rework: 0 },
      { id: 'newsletter', label: 'The newsletter', shipped: 5, rework: 1 }
    ],
    tools: [
      { id: 'analytics', label: 'Funnel analytics', item: 'analytics-options', state: 'proposed' },
      { id: 'pg', label: 'Managed database', item: 'postgres-options', state: 'proposed' },
      { id: 'checkout-v2', label: 'Two-step checkout', item: 'pr-142-checkout', state: 'building' },
      { id: 'ci', label: 'Parallel CI runners', state: 'installed' }
    ],
    counts: { shipped_7d: 9, merged_7d: 3, rework_7d: 2, open_prs: 1, reports_7d: 3 }
  };
}

// Primary's 5h pace (62% in 2h50m) empties it before the reset, so the top bar warns; Opal is a per-model window.
const quota = t => [
  { name: 'Primary', window: '5h', used_pct: 62, resets_at: t + 2 * H + 10 * 60, at: t },
  { name: 'Primary', window: '7d', used_pct: 41, resets_at: t + 3 * D + 5 * H, at: t },
  { name: 'Primary', model: 'Opal', window: '7d', used_pct: 20, resets_at: t + 3 * D + 5 * H, at: t },
  { name: 'Backup', window: '5h', used_pct: 18, resets_at: t + 4 * H, at: t },
  { name: 'Backup', window: '7d', used_pct: 88, resets_at: t + 1 * D + 7 * H, at: t }
];

// An ask with its reply already in the thread (green ticket) and an order still waiting.
const answers = t => [
  { id: 'newsletter-6', action: 'ask', note: 'is the weekly digest opt-in?', at: t - 3 * H },
  { id: `req-${t - 5 * H}-7`, action: 'request', note: 'Add a "what changed since last visit" banner to boards', to: 'mate-web', at: t - 5 * H }
];

// Agent notes kept with their item or topic instead of lost in chat (notes.jsonl).
const notes = t => [
  { item: 'postgres-options', topic: 'infra', from: 'mate-web', text: 'Quay confirmed EU hosting in writing; the restore test numbers still hold.', at: t - 5 * H },
  { item: 'pr-142-checkout', topic: 'checkout', from: 'mate-web', text: 'Preview deploy refreshed after the last rebase; still green.', at: t - 3 * H },
  { topic: 'launch', from: 'mate-growth', text: 'Annual-plan discount survey is half done; most products give two months free.', at: t - 2 * H },
  { topic: 'launch', from: 'mate-main', text: 'Launch date pencilled in for the 20th, once pricing is settled.', at: t - 50 * 60 }
];

// Smallest valid one-page PDF with a line of text (original content).
function onePagePdf(lines) {
  const text = lines.map((l, i) => `BT /F1 ${i ? 12 : 18} Tf 56 ${740 - i * 26} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return out;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const n of fs.readdirSync(src)) {
    const s = path.join(src, n), d = path.join(dst, n);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 1) + '\n');

// webUrl: base URL of the demo's local static site (static-site.js); adds an item that opens in the browser pane.
function seedDemo(home, now = Math.floor(Date.now() / 1000), { webUrl } = {}) {
  // Only ever wipe a directory this function created (marked by .demo) or an empty one.
  if (fs.existsSync(home) && fs.readdirSync(home).length && !fs.existsSync(path.join(home, '.demo'))) throw new Error(`refusing to seed non-demo directory: ${home}`);
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, 'items'), { recursive: true });
  copyDir(path.join(__dirname, 'assets'), path.join(home, 'assets'));
  fs.writeFileSync(path.join(home, 'assets', 'analytics-one-pager.pdf'), onePagePdf(['Analytics one-pager', 'Hosted service A: $9/mo, EU hosting, funnels.', 'No cookies, no consent banner.', 'Synthetic demo document.']));
  for (const it of items(now, webUrl)) writeJson(path.join(home, 'items', `${it.id}.json`), it);
  writeJson(path.join(home, 'rules.json'), rules);
  writeJson(path.join(home, 'fleet.json'), fleet(now));
  writeJson(path.join(home, 'quota.json'), quota(now));
  fs.writeFileSync(path.join(home, 'answers.jsonl'), answers(now).map(a => JSON.stringify(a)).join('\n') + '\n');
  fs.writeFileSync(path.join(home, 'notes.jsonl'), notes(now).map(n => JSON.stringify(n)).join('\n') + '\n');
  fs.writeFileSync(path.join(home, 'gaps.jsonl'), JSON.stringify({ text: 'A live progress feed for a long render has no item kind; squeezed into a review', item: 'promo-cut-v2', from: 'mate-growth', at: now - 2 * H }) + '\n');
  fs.writeFileSync(path.join(home, '.demo'), 'synthetic demo data; safe to delete\n');
  return home;
}

module.exports = { seedDemo };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node app/demo/seed.js <dir>'); process.exit(2); }
  console.log(seedDemo(path.resolve(dir)));
}
