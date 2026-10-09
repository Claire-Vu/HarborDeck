/* What changed: the desk remembers the version of each item the captain last looked at (desk state in
   localStorage, per data directory; never in the shared contract) and, when an agent rewrites the item, shows
   only what is new: the title, summary sentences, options, artifacts, correspondence and body lines.
   Pure functions; app.js stores the versions and draws the highlights. Loaded before app.js; unit-tested in node. */
'use strict';
const HarborChanges = (() => {
  const BODY_MAX = 20000; // longer bodies are not remembered, so their lines are never compared
  const sentences = text => (text || '').split(/(?<=[.!?])\s+(?=[A-Z"'(@$0-9])/).map(s => s.trim()).filter(Boolean);
  const artKey = a => a.path || a.url || '';

  // What to remember of one version. msgs: the agent's thread entries and notes on the item ({at}).
  function digest(it, body, msgs) {
    return {
      title: it.title, summary: it.summary || '', options: (it.options || []).map(o => [o.key, o.label]), arts: (it.artifacts || []).map(artKey),
      last: msgs.reduce((m, x) => Math.max(m, x.at || 0), 0), body: typeof body === 'string' && body.length <= BODY_MAX ? body : null
    };
  }

  // Body lines in b that a did not have (trimmed, counted, order-blind): cheap, and a moved line is not news.
  function newLines(a, b) {
    const have = new Map();
    for (const l of a.split('\n')) { const k = l.trim(); if (k) have.set(k, (have.get(k) || 0) + 1); }
    const out = [];
    for (const l of b.split('\n')) { const k = l.trim(); if (!k) continue; const n = have.get(k) || 0; if (n) have.set(k, n - 1); else out.push(k); }
    return out;
  }

  // What is new in `now` since `was`, or null when nothing (or no earlier version to compare with).
  // { title: <old title>, claims: [new sentences], options: [keys added or relabelled], arts: [new artifact keys],
  //   since: <at of the last message seen>, lines: [new body lines] }
  function diff(was, now) {
    if (!was || !now) return null;
    const out = {};
    if (was.title !== now.title) out.title = was.title;
    const oldClaims = new Set(sentences(was.summary)); const claims = sentences(now.summary).filter(s => !oldClaims.has(s));
    if (claims.length) out.claims = claims;
    const oldOpts = new Map(was.options || []); const options = (now.options || []).filter(([k, l]) => oldOpts.get(k) !== l).map(([k]) => k);
    if (options.length) out.options = options;
    const oldArts = new Set(was.arts || []); const arts = (now.arts || []).filter(k => !oldArts.has(k));
    if (arts.length) out.arts = arts;
    if (now.last > (was.last || 0)) out.since = was.last || 0;
    if (was.body != null && now.body != null && was.body !== now.body) { const lines = newLines(was.body, now.body); if (lines.length) out.lines = lines; }
    return Object.keys(out).length ? out : null;
  }

  // One line for a tooltip or a note: "title, 2 sentences, 1 reply".
  function describe(d) {
    if (!d) return '';
    const n = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
    return [d.title != null && 'title', d.claims && n(d.claims.length, 'sentence'), d.options && n(d.options.length, 'option'), d.arts && n(d.arts.length, 'paper'),
      d.since != null && 'replies', d.lines && n(d.lines.length, 'body line')].filter(Boolean).join(', ');
  }

  return { digest, diff, describe, newLines, sentences };
})();
if (typeof module === 'object') module.exports = HarborChanges;
