/* Desk papers: the manifest, artifacts, correspondence and the ask, laid out on the desk and draggable.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ desk papers
let inspectPick = null, deskShown = null;
function renderDesk() {
  const surf = $('#desk-surface'); sheetScroll = surf.querySelector('.paper.qsheet')?.scrollTop ?? null; surf.replaceChildren();
  const it = byId[S.current];
  if (deskShown && deskShown !== S.current && S.items[deskShown]) delete S.items[deskShown].shown; // left the desk: highlights done
  deskShown = it ? it.id : null;
  if (!it || statusOf(it) !== 'open') {
    lastDeskGroup = null;
    surf.append(h('div', { class: 'desk-hint' }, !ITEMS.length ? h('span', null, 'Nothing in ', h('code', null, `${SNAP.home}/items/`), ' yet. Connect an agent (see the README), or ', h('button', { class: 'tbtn', onclick: async () => { applySnapshot(await bridge.demo(true)); } }, 'load the demo day'), '.') : S.dayOpen ? 'Desk is clear. Pick someone at the window, or pick up the ship phone for a new order.' : 'The office is closed. Open the day from the morning manifest.'));
    stowEls = {}; renderTray(null); renderStow(); return;
  }
  const s = st(it.id); const papers = []; const claims = sentences(it.summary); const m = mateFor(it); const c = crewFor(it);
  const ch = lookAt(it, true); const fresh = new Set(ch?.claims || []);
  papers.push(paper('manifest', `${KIND[it.kind]} manifest`, [
    h('div', { class: 'm-top' }, prioChip(it), waitChip(it), dueChip(it), h('span', { class: 'spacer' }), h('span', { class: 'pay', title: 'pays on stamp (value × priority × urgency)' }, money(payFor(it, 'decide')))),
    ch ? h('div', { class: 'chg-note' }, `Updated since you last looked: ${CH.describe(ch)}`) : null,
    h('h3', { class: ch?.title != null ? 'chg' : null, title: ch?.title != null ? `was: ${ch.title}` : null }, it.title),
    h('div', { class: 'meta' }, `${it.project}${it.stream ? ' · ' + it.stream : ''} · ${fmtDate(it.created)} · ${m.label}${c ? ', via ' + crewName(c.id) : ''} `, topicView.chip(it)),
    it.rules?.length ? h('div', { class: 'check-row' }, checksFor(it).map(({ rule, check }) => h('button', { class: `chk ${check ? (check.ok ? 'ok' : 'flag') : 'none'}`, title: `${rule}: ${check ? (check.ok ? 'passed' : 'FLAGGED') + ' · ' + check.note : 'tagged, not auto-checked'}`, onclick: () => openDrawer('orders') }, check ? (check.ok ? '✓' : '⚠') : '§', ' ', rule))) : null,
    (it.checks || []).some(x => x.ok === false) ? h('div', { class: 'flag-note' }, (it.checks || []).filter(x => x.ok === false).map(x => h('div', null, '⚠ ', x.note))) : null,
    h('p', { class: 'claims' }, claims.map((cl, i) => h('span', { class: `fact ${s.flags[i] === 'match' ? 'matched' : s.flags[i] === 'flag' ? 'flagged' : ''}${fresh.has(cl) ? ' chg' : ''}`, onclick: e => pickFact({ type: 'claim', label: cl, anchor: { claim: cl }, idx: i }, e.currentTarget) }, cl, ' ')))
  ], 'm', h('button', { class: 'ibtn back-btn', title: 'Back of the line (W): step aside to the end of the line; the next one steps up. Writes nothing.', onclick: backOfLine }, 'Back of the line')));
  const seen = new Set();
  const arts = [...(it.artifacts || [])]; if (it.body && !arts.some(a => (a.path || a.url) === it.body)) arts.unshift(bodyArtifact(it.body, true));
  arts.forEach((a, i) => { const key = a.path || a.url; if (seen.has(key)) return; seen.add(key); const p = artifactPaper(it, a, i, ch); if (p) { if (ch?.arts?.includes(key)) markNew(p); papers.push(p); } });
  // the main artifact fills the blotter; cards that only open something elsewhere (PR, link, web page) stay small
  const reading = papers.find(p => p.dataset.pid !== 'm' && !p.classList.contains('prcard')); reading?.classList.add('reading');
  const thread = threadFor(it);
  if (thread.length) papers.push(paper('thread', 'Correspondence', thread.map(x => h('div', { class: `msg${isNewMsg(x, ch) ? ' chg' : ''}` }, h('div', { class: 'who' }, `${x.from} · ${fmtDate(x.at)} ${fmtTime(x.at)}`), h('div', null, x.text), x.anchor && h('div', { class: 'anchor' }, anchorText(x.anchor)), attachView.thumbs(x.attachments))), 't'));
  const group = bundleOf(it);
  papers.push(group.length > 1 ? quick.sheet(it, group, { awaiting: s.awaiting }) : askSlip(it, ch));
  // Moving between rows of one sheet keeps the papers still: no deal-in animation, the sheet keeps its scroll.
  const gk = group.map(m => m.id).join(' '); const calm = gk === lastDeskGroup; lastDeskGroup = gk;
  surf.classList.toggle('calm', calm);
  const pos = S.positions[it.id] || {};
  const away = stowedOf(it.id); stowLabels = {}; stowEls = {}; papers.forEach(p => { stowLabels[p.dataset.pid] = p.querySelector('.grip > span')?.textContent || 'Paper'; if (away[p.dataset.pid]) stowEls[p.dataset.pid] = p; });
  const shown = papers.filter(p => !away[p.dataset.pid]);
  if (!shown.some(p => p.classList.contains('reading'))) shown.find(p => p.dataset.pid !== 'm' && p.dataset.pid !== 'ask')?.classList.add('reading');
  shown.forEach((p, i) => { p.style.zIndex = 10 + i; p.style.animationDelay = (i * 70) + 'ms'; makeDraggable(p, it.id); addStowBtn(p, it.id); surf.append(p); });
  layoutPapers(shown, surf, pos);
  const sh = surf.querySelector('.paper.qsheet');
  if (sh) { if (calm && sheetScroll != null) sh.scrollTop = sheetScroll; keepRowInView(sh); sheetCount(); }
  renderTray(it); renderStow();
}
let lastDeskGroup = null, sheetScroll = null;
// The sheet's current row stays in view by scrolling the sheet only: scrollIntoView would also scroll the desk (and,
// when stacked, push the manifest off the top). Below 860 px the papers flow and the desk itself is the scroller.
function keepRowInView(sh) {
  const row = sh.querySelector('.b-row.cur'); if (!row) return;
  if (window.innerWidth <= 860) { row.scrollIntoView({ block: 'nearest' }); return; }
  const r = row.getBoundingClientRect(), b = sh.getBoundingClientRect();
  if (r.top < b.top) sh.scrollTop += r.top - b.top; else if (r.bottom > b.bottom) sh.scrollTop += Math.min(r.bottom - b.bottom, r.top - b.top);
}
const isNewMsg = (x, ch) => ch?.since != null && !x.me && x.from !== 'captain' && x.at > ch.since;
const markNew = p => { p.classList.add('chg'); p.querySelector('.grip > span')?.after(h('span', { class: 'upd' }, 'new')); };
// Papers never overlap: the manifest and the ask (slip or sheet) stack on the left, the main artifact fills the
// reading column, and the rest stack in a side column (or under the reading paper when the desk is narrow).
// A paper the captain dragged keeps its spot. Below 860 px the CSS flows papers instead.
function layoutPapers(papers, surf, pos) {
  if (window.innerWidth <= 860) return;
  const W = surf.clientWidth || 900, H = surf.clientHeight || 600, G = 14, X0 = 16, Y0 = 16;
  const at = (p, x, y, w, hMax) => { if (w) p.style.width = w + 'px'; if (hMax) p.style.maxHeight = Math.max(120, hMax) + 'px'; const u = pos[p.dataset.pid]; const c = u && clampToDesk(p, u.x, u.y); p.style.left = (c ? c.x : x) + 'px'; p.style.top = (c ? c.y : y) + 'px'; };
  const man = papers.find(p => p.dataset.pid === 'm'), ask = papers.find(p => p.dataset.pid === 'ask');
  const reading = papers.find(p => p.classList.contains('reading'));
  const rest = papers.filter(p => p !== man && p !== ask && p !== reading);
  const leftW = ask?.classList.contains('qsheet') ? Math.min(440, Math.max(340, W * .36)) : 320;
  // Too narrow for a reading column beside the left stack (small window, stamps open): one full-width column, the desk scrolls.
  if (W - X0 * 2 < leftW + G * 1.5 + 300) {
    let y = Y0; const w = W - X0 * 2;
    for (const p of [man, reading, ask, ...rest].filter(Boolean)) { at(p, X0, y, w, p === reading ? Math.max(240, H * .7) : null); if (p === reading) p.style.height = p.style.maxHeight; y += p.offsetHeight + G; }
    return;
  }
  let manH = 0;
  if (man) { man.style.width = leftW + 'px'; man.style.maxHeight = (H * .42) + 'px'; manH = Math.min(man.offsetHeight, H * .42); at(man, X0, Y0, leftW); }
  if (ask) at(ask, X0, man ? Y0 + manH + G : Y0, leftW, H - Y0 * 2 - (man ? manH + G : 0));
  const rx = X0 + leftW + G * 1.5, sideW = 290;
  const roomForSide = rest.length && W - rx - X0 >= 420 + G + sideW;
  const readW = Math.max(260, Math.min(820, W - rx - X0 - (roomForSide ? sideW + G : 0)));
  let y = Y0;
  if (reading) {
    const below = roomForSide ? [] : rest;
    const belowH = below.reduce((n, p) => { p.style.width = readW + 'px'; return n + Math.min(p.offsetHeight, 220) + G; }, 0);
    const hMax = Math.max(H * .45, H - Y0 * 2 - belowH);
    at(reading, rx, y, readW, hMax); reading.style.height = hMax + 'px'; y += hMax + G;
    for (const p of below) { const ph = Math.min(p.offsetHeight, 220); at(p, rx, y, readW, ph); y += ph + G; }
  }
  if (!reading || roomForSide) {
    let x = reading ? rx + readW + G : rx; y = Y0;
    for (const p of rest) { const w = reading ? sideW : Math.min(320, W - x - X0); p.style.width = w + 'px'; const ph = Math.min(p.offsetHeight, H - Y0 * 2); if (y > Y0 && y + ph > H - Y0) { x += w + G; y = Y0; } at(p, x, y, w, H - Y0 - y); y += Math.min(p.offsetHeight, H - Y0 - y) + G; }
  }
}
// Comment anchors name files by their base name; the full path stays on hover elsewhere.
const anchorText = a => Object.entries(a).map(([k, v]) => `${k}: ${k === 'artifact' && !/^[a-z]+:\/\//i.test(v) ? base(v) : v}`).join(' · ');
function threadFor(it) {
  const s = st(it.id);
  return [...(it.thread || []).map(x => ({ ...x, from: x.from === 'captain' ? 'captain' : mateLabel(x.from) })), ...(SNAP.notes || []).filter(n => n.item === it.id).map(n => ({ from: `note · ${n.from ? mateLabel(n.from) : 'agent'}`, text: n.text, at: n.at })), ...S.answers.filter(a => a.id === it.id && ['comment', 'ask', 'needs-work'].includes(a.action)).map(a => ({ from: 'captain', text: `${a.action}: ${a.note}`, at: a.at, anchor: a.anchor, attachments: a.attachments, me: true }))].sort((a, b) => a.at - b.at);
}
function paper(cls, label, kids, pid, extraGrip) {
  return h('div', { class: `paper ${cls}`, dataset: { pid } }, h('div', { class: 'grip' }, h('span', null, label), h('span', { class: 'spacer' }), extraGrip || null, h('span', { class: 'drag-only', title: 'drag' }, '⋮⋮')), ...kids);
}
const fileFor = path => { const f = FILES[path]; return f && f.exists ? f : null; };
// Never print absolute paths on the desk: the file name, with the full path on hover.
const pathMeta = p => h('div', { class: 'meta path', title: p }, base(p));
const missing = p => h('p', { class: 'meta', title: p }, `not available locally: ${base(p)}`);
const EXT_TYPE = { png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image', mp4: 'video', m4v: 'video', webm: 'video', mov: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio', pdf: 'pdf', diff: 'diff', patch: 'diff', md: 'report', markdown: 'report', txt: 'report', log: 'report', json: 'report', csv: 'report', yaml: 'report', yml: 'report' };
// The renderer understands pr | video | image | pdf | report | web | link; anything else is guessed from the path, or shown as a link/file card.
function artType(a) {
  const t = String(a.type || '').toLowerCase();
  if (a.url && (t === 'web' || t === 'lavish')) return 'web';
  if (a.path && /\.html?$/i.test(a.path) && !['pdf', 'image', 'video', 'audio'].includes(t)) return 'web'; // local HTML opens in the pane
  if (['pr', 'video', 'image', 'pdf', 'report', 'audio', 'diff'].includes(t)) return t;
  if (a.url && /^(link|file)$/.test(t)) return 'link';
  if (a.path) return EXT_TYPE[(a.path.split('.').pop() || '').toLowerCase()] || 'file';
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(a.url || '') ? 'pr' : 'link';
}
const openUrl = url => bridge.openExternal(url);
const webUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);
// local file (served via harbor://) or a web URL for media
const srcFor = a => fileFor(a.path)?.url || webUrl(a.url);
const bodyArtifact = (body, isBody) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(body) ? { type: 'link', url: body, label: 'Research', isBody } : { type: artType({ path: body }) === 'pdf' ? 'pdf' : 'report', path: body, isBody });
function artifactPaper(it, a, i, ch) {
  const pid = `a${i}`; const f = fileFor(a.path); const type = artType(a);
  if (type === 'link') {
    let host = a.url; try { host = new URL(a.url).host; } catch (e) { /* keep raw */ }
    return paper('prcard', a.label || a.type || 'Link', [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: host, anchor: { artifact: a.url } }, e.currentTarget) }, host),
      h('dl', { class: 'pr-meta' }, h('dt', null, 'link'), h('dd', null, h('a', { href: a.url, onclick: e => { e.preventDefault(); openUrl(a.url); } }, a.url)))
    ], pid, h('button', { class: 'ibtn', onclick: () => openUrl(a.url) }, 'Open'));
  }
  if (type === 'web') {
    let host = a.url || base(a.path); try { host = new URL(a.url).host; } catch (e) { /* keep raw */ }
    const label = a.label || (a.type === 'lavish' ? 'Lavish plan' : a.path ? 'Report page' : 'Web page');
    return paper('prcard web', label, [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: host, anchor: { artifact: a.url || a.path } }, e.currentTarget) }, host),
      a.path && !fileFor(a.path) ? missing(a.path) : h('dl', { class: 'pr-meta' }, h('dt', null, 'page'), h('dd', null, h('a', { href: '#', title: a.url || a.path, onclick: e => { e.preventDefault(); openViewer(a); } }, a.url || base(a.path)))),
      h('button', { class: 'pbtn web-open', onclick: () => openViewer(a) }, 'Open in the desk browser')
    ], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'View'));
  }
  if (type === 'pdf' || type === 'file') {
    return paper('report', type === 'pdf' ? 'Document' : 'File', [pathMeta(a.path),
      f ? (type === 'pdf' ? h('iframe', { class: 'pdf-frame', src: f.url, title: base(a.path) }) : h('p', { class: 'meta' }, f.mime || 'file')) : missing(a.path)],
      pid, f ? h('button', { class: 'ibtn', onclick: () => type === 'pdf' ? openViewer(a) : bridge.openPath(f.url) }, type === 'pdf' ? 'Read' : 'Open') : null);
  }
  if (type === 'pr') {
    const m = (a.url || '').match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    return paper('prcard', 'Pull request', [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: `PR ${m ? m[3] : ''}`, anchor: { artifact: a.url } }, e.currentTarget) }, m ? `#${m[3]}` : 'PR'),
      h('dl', { class: 'pr-meta' }, h('dt', null, 'repo'), h('dd', null, m ? `${m[1]}/${m[2]}` : '-'), h('dt', null, 'link'), h('dd', null, h('a', { href: a.url, onclick: e => { e.preventDefault(); openUrl(a.url); } }, a.url)))
    ], pid, h('button', { class: 'ibtn', onclick: () => openUrl(a.url) }, 'Open'));
  }
  if (type === 'audio') {
    const src = srcFor(a); const au = h('audio', { controls: true, preload: 'metadata', src: src || '' });
    const mark = h('button', { class: 'ibtn', onclick: e => pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${au.currentTime.toFixed(1)}s`, anchor: { artifact: a.path || a.url, t: Math.round(au.currentTime * 10) / 10 } }, e.currentTarget) }, 'Mark moment');
    return paper('monitor', a.label || 'Recording', [src ? au : missing(a.path), h('div', { class: 'leds' }, h('span', { class: 'led' }), base(a.path || a.url), h('span', { class: 'spacer' }), h('span', { class: 'inspect-only' }, mark))], pid);
  }
  if (type === 'video') {
    const v = h('video', { controls: true, preload: 'metadata', src: srcFor(a) || '' });
    const mark = h('button', { class: 'ibtn', onclick: e => pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${v.currentTime.toFixed(1)}s`, anchor: { artifact: a.path || a.url, t: Math.round(v.currentTime * 10) / 10 } }, e.currentTarget) }, 'Mark moment');
    return paper('monitor', 'Monitor', [srcFor(a) ? v : missing(a.path), h('div', { class: 'leds' }, h('span', { class: 'led' }), base(a.path || a.url), h('span', { class: 'spacer' }), h('span', { class: 'inspect-only' }, mark))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Full'));
  }
  if (type === 'image') {
    const img = h('img', { src: srcFor(a) || '', alt: base(a.path || a.url), loading: 'lazy', onclick: e => {
      if (document.body.classList.contains('inspect')) { const r = img.getBoundingClientRect(); pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${Math.round((e.clientX - r.left) / r.width * 100)}%,${Math.round((e.clientY - r.top) / r.height * 100)}%`, anchor: { artifact: a.path || a.url, x: +((e.clientX - r.left) / r.width).toFixed(2), y: +((e.clientY - r.top) / r.height).toFixed(2) } }, img); }
      else openViewer(a);
    } });
    return paper('photo', 'Photo', [srcFor(a) ? img : missing(a.path), h('p', { class: 'cap' }, a.label || base(a.path || a.url))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Zoom'));
  }
  const text = f?.text;
  if (type === 'diff' && text != null) return paper('report', a.label || 'Diff', [pathMeta(a.path), diffView(text.split('\n').slice(0, 80).join('\n'))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Read'));
  if (f && text == null) return paper('report', 'File', [pathMeta(a.path), h('p', { class: 'meta' }, f.mime || 'file')], pid, h('button', { class: 'ibtn', onclick: () => bridge.openPath(f.url) }, 'Open'));
  const lit = a.isBody && ch?.lines ? new Set(ch.lines) : null;
  const ex = h('div', { class: 'excerpt md', html: text ? mdToHtml(text.split('\n').slice(0, 400).join('\n'), lit) : `<p class="meta" title="${esc(a.path)}">not available locally: ${esc(base(a.path))}</p>` });
  ex.querySelectorAll('.mdh').forEach(hd => hd.classList.add('fact'));
  ex.addEventListener('click', e => { const hd = e.target.closest('.mdh'); if (hd && document.body.classList.contains('inspect')) pickFact({ type: 'point', label: `${base(a.path)} § ${hd.dataset.heading}`, anchor: { artifact: a.path, heading: hd.dataset.heading } }, hd); });
  return paper(a.isBody ? 'report dispatch' : 'report', a.isBody ? 'Research' : 'Report', [pathMeta(a.path), ex], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Read'));
}
function diffView(text) {
  return h('pre', { class: 'diff' }, text.split('\n').map(l => h('span', { class: /^\+(?!\+\+)/.test(l) ? 'add' : /^-(?!--)/.test(l) ? 'del' : /^@@/.test(l) ? 'hunk' : '' }, l + '\n')));
}
function askSlip(it, ch) {
  const s = st(it.id); const kids = [];
  if (it.kind === 'decision' && it.options) {
    s.choice ??= it.options.find(o => o.recommended)?.key || null;
    kids.push(h('fieldset', { class: 'q' }, h('legend', null, 'Your call ', h('span', { class: 'hint' }, 'A–E pick · Space stamps')), it.options.map((o, i) => { const el = quick.option(it, o, i, s.choice === o.key, key => { s.choice = key; save(); afterPick(it.id); }, `opt-${it.id}`); if (ch?.options?.includes(o.key)) el.classList.add('chg'); return el; })));
  } else kids.push(h('p', { class: 'ql' }, { review: 'Your verdict on the work.', answer: 'Read, then file.', todo: 'Only you can do this. File it when done.' }[it.kind]));
  kids.push(h('div', { class: 'stamp-zone', id: 'stamp-zone' }, s.awaiting ? 'sent back; awaiting reply' : 'Space to stamp'));
  return paper('ask', 'The ask', kids, 'ask');
}
// Keeps a paper's whole grab handle on the desk (below the ticket rail, inside the side and bottom edges).
function clampToDesk(p, x, y) {
  const surf = p.parentElement, grip = p.querySelector('.grip');
  return { x: Math.max(0, Math.min(x, surf.clientWidth - p.offsetWidth)), y: Math.max(0, Math.min(y, surf.clientHeight - (grip ? grip.getBoundingClientRect().bottom - p.getBoundingClientRect().top : 30))) };
}
function makeDraggable(p, itemId) {
  const grip = p.querySelector('.grip'); let sx, sy, ox, oy, dragging = false;
  grip.addEventListener('pointerdown', e => { if (window.innerWidth <= 860 || e.target.closest('button,a')) return; dragging = true; grip.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = p.offsetLeft; oy = p.offsetTop; p.style.zIndex = 90; p.style.animation = 'none'; });
  grip.addEventListener('pointermove', e => { if (!dragging) return; const c = clampToDesk(p, ox + e.clientX - sx, oy + e.clientY - sy); p.style.left = c.x + 'px'; p.style.top = c.y + 'px'; $('#stow-box').classList.toggle('drop', p.dataset.pid !== 'ask' && overStow(e)); });
  grip.addEventListener('pointerup', e => { if (!dragging) return; dragging = false; $('#stow-box').classList.remove('drop'); if (p.dataset.pid !== 'ask' && overStow(e)) { stow(itemId, p.dataset.pid); return; } ((S.positions[itemId] ||= {})[p.dataset.pid] = { x: p.offsetLeft, y: p.offsetTop }); save(); snd('flip'); });
  p.addEventListener('pointerdown', () => { document.querySelectorAll('.paper').forEach(q => { if (q.style.zIndex === '90') q.style.zIndex = 40; }); if (!dragging) p.style.zIndex = 89; });
}
