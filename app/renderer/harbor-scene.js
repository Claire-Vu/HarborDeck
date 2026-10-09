/* The living harbor in the window (F1 boats, F3 sky/weather/tide, F5 cosmetics, F10 town), the ship cat (F8),
   the tidy-run badge (F4), and the two paper modals: the chandlery with the stamp book (F5/F6) and the ships-out
   recap (F7). Rules live in harbor-game.js; desk state lives in app.js, which passes its helpers in. Everything here
   runs after a stamp has landed and never delays one. Loaded before app.js. */
'use strict';
window.HarborScene = deps => {
  const { h, G } = deps;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = sel => document.querySelector(sel);
  const svg = (tag, attrs, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v); for (const k of kids) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k)); return el; };
  const px = (x, y, w, hh, fill, extra) => svg('rect', { x, y, width: w, height: hh, fill, ...extra });

  // ---------------------------------------------------------- sky and weather (F3)
  function drawSky(hour, minute, stamina) {
    const phase = G.sky(hour), c = G.SKY[phase], night = phase === 'night';
    const frame = $('.window-frame'); if (!frame) return phase;
    frame.dataset.phase = phase; frame.style.setProperty('--sky-1', c.s1); frame.style.setProperty('--sky-2', c.s2); frame.style.setProperty('--sea-1', c.sea); frame.style.setProperty('--sea-2', c.sea2);
    // sun arcs over the day; the moon takes its place at night
    const sun = $('#sc-sun'); const f = Math.max(0, Math.min(1, (hour + minute / 60 - 6) / 14));
    if (night) { sun.setAttribute('cx', 118); sun.setAttribute('cy', 30); sun.setAttribute('r', 11); sun.setAttribute('fill', '#e9eef5'); }
    else { sun.setAttribute('cx', Math.round(30 + f * 260)); sun.setAttribute('cy', Math.round(78 - Math.sin(f * Math.PI) * 52)); sun.setAttribute('r', 15); sun.setAttribute('fill', phase === 'day' ? '#ffe08a' : '#ffb36b'); }
    const stars = $('#sc-stars'); stars.replaceChildren(); if (night) for (let i = 0; i < 26; i++) stars.append(px((i * 53 + 7) % 320, (i * 29 + 3) % 84, 1, 1, '#fff', { opacity: i % 3 ? .9 : .5, class: i % 4 ? null : 'twinkle' }));
    const w = G.weather(stamina); frame.dataset.weather = w;
    const clouds = $('#sc-clouds'); clouds.replaceChildren();
    const n = w === 'rain' ? 6 : w === 'cloudy' ? 3 : 1, grey = w === 'rain' ? '#6f7d8a' : night ? '#9aa7b8' : '#fff';
    for (let i = 0; i < n; i++) { const x = 14 + i * 52 + (i % 2) * 9, y = 14 + (i % 3) * 11; clouds.append(px(x, y, 30, 6, grey, { opacity: .8 }), px(x + 6, y - 4, 16, 4, grey, { opacity: .8 })); }
    const rain = $('#sc-rain'); rain.replaceChildren();
    if (w === 'rain') { const g = svg('g', { class: 'rain-fall' }); for (let i = 0; i < 46; i++) g.append(px((i * 37) % 320, (i * 53) % 220 - 20, 1, 4, '#cfe0ef', { opacity: .55 })); rain.append(g); }
    return phase;
  }

  // ---------------------------------------------------------- the far shore: town (F10) and the lighthouse (F5)
  const HOUSE = [[10, 8, '#c8552d'], [14, 10, '#8a3a7a'], [12, 9, '#3b6f9e'], [16, 11, '#a8632d'], [10, 12, '#4f8a5b'], [18, 9, '#6b4a2a'], [14, 13, '#7a4e5e'], [8, 16, '#d8c7a0'], [8, 18, '#5a5fb0'], [20, 12, '#9a3a2a']];
  function drawShore(days, owned, night) {
    const g = $('#sc-town'); g.replaceChildren();
    G.town(days).forEach((name, i) => {
      const [w, hh, roof] = HOUSE[i]; const x = 66 + i * 23 - (i % 2) * 4, base = 108;
      const b = svg('g', { class: 'bldg' }, svg('title', null, name), px(x, base - hh, w, hh, '#e8dcc0'), px(x - 1, base - hh - 3, w + 2, 3, roof), px(x + 2, base - hh + 3, 2, 2, night ? '#ffd56a' : '#4a5a6a'), w > 10 ? px(x + w - 4, base - hh + 3, 2, 2, night ? '#ffd56a' : '#4a5a6a') : null);
      if (name === 'Windmill') b.append(px(x + 3, base - hh - 9, 2, 8, '#6b4a2a', { class: 'vane' }), px(x - 1, base - hh - 6, 10, 2, '#6b4a2a', { class: 'vane' }));
      if (name === 'Clock tower') b.append(px(x + 2, base - hh + 1, 4, 4, '#fff8e0'), px(x + 3, base - hh + 2, 1, 2, '#222'));
      g.append(b);
    });
    const lh = $('#sc-light'); lh.replaceChildren();
    if (owned.includes('lighthouse')) {
      lh.append(svg('title', null, 'Lighthouse'), px(14, 66, 10, 42, '#f1e4c0'), px(14, 76, 10, 5, '#c0392b'), px(14, 90, 10, 5, '#c0392b'), px(12, 60, 14, 6, '#333'), px(16, 62, 6, 3, night ? '#ffe08a' : '#cfe0ef'));
      if (night) lh.append(svg('polygon', { class: 'beam', points: '26,63 120,48 120,78', fill: '#ffe08a', opacity: '.22' }));
    }
  }

  // ---------------------------------------------------------- boats (F1): one per open task, sail out when settled
  const SLOTS = [[18, 152, 1], [96, 156, 1], [56, 128, .8], [134, 130, .8], [174, 154, 1], [212, 128, .8], [252, 152, 1], [290, 128, .8]];
  let moored = new Map(); // key -> { x, y, s, el }
  function boatEl(b, slot, opts) {
    const [x, y, s] = slot; const reg = G.regular(b.project); const sail = G.sailHeight(b.calls);
    const g = svg('g', { class: 'hb', transform: `translate(${x} ${y}) scale(${s})`, 'data-task': b.key });
    const bob = svg('g', { class: 'boat', style: `animation-delay:${-(G.hash(b.key) % 30) / 10}s` });
    bob.append(px(0, 0, 28, 6, '#3a2a1a'), px(2, 6, 24, 2, '#2a1d12'), px(12, -sail - 4, 2, sail + 4, '#2b2318'), px(14, -sail - 2, 11, sail, '#f1e4c0'), px(14, -sail - 2, 11, 3, reg.coat));
    if (b.calls > 1) bob.append(svg('text', { x: 16.5, y: -sail / 2 + 2, 'font-size': 6, fill: '#2b2318', 'font-family': 'monospace' }, String(b.calls)));
    if (opts.pennants) bob.append(svg('polygon', { points: `14,${-sail - 6} 22,${-sail - 4} 14,${-sail - 2}`, fill: reg.coat }));
    if (opts.night) bob.append(px(3, 1, 2, 2, '#ffe08a', { class: 'lantern' }));
    g.append(svg('title', null, `${b.title} · ${b.calls} call${b.calls > 1 ? 's' : ''} · ${reg.name}`), svg('g', { class: 'sail' }, bob));
    return g;
  }
  function drawBoats(open, opts) {
    const layer = $('#sc-boats'); if (!layer) return;
    const list = G.boats(open); const shown = list.slice(0, SLOTS.length); const next = new Map();
    layer.querySelectorAll('.hb:not(.sailing)').forEach(el => el.remove());
    shown.forEach((b, i) => { const el = boatEl(b, SLOTS[i], opts); layer.append(el); next.set(b.key, { slot: SLOTS[i], el }); });
    // a task that left the harbor since the last draw sails out to sea (after its stamp; nothing waits on it)
    for (const [key, m] of moored) if (!next.has(key) && !list.some(b => b.key === key)) {
      const ghost = m.el.cloneNode(true); ghost.classList.add('sailing'); layer.append(ghost); setTimeout(() => ghost.remove(), 2000);
    }
    moored = next;
    const more = $('#sc-more'); more.textContent = list.length > SLOTS.length ? `+${list.length - SLOTS.length} boats` : '';
    $('.window-frame').dataset.boats = String(list.length);
  }

  // ---------------------------------------------------------- tide line (F3) and the daily goal (F7)
  function drawTide(t, goal, open) {
    const g = $('#sc-tide'); g.replaceChildren(); if (!t) return;
    const y = Math.round(172 - t.level * 54);
    const label = goal?.beat ? '⚑ beat the tide' : `high tide ${dur(t.in)}${open ? ` · ${open} to clear` : ''}`;
    g.append(svg('title', null, `Tide: ${Math.round(t.level * 100)}% toward the next refill (${t.name} ${t.window}, ${deps.fmtTime(t.resets)})`), px(0, y, 320, 1, '#e6f4fa', { opacity: .75 }), px(0, y + 2, 320, 1, '#e6f4fa', { opacity: .3 }), svg('text', { x: 4, y: y - 2, 'font-size': 7, fill: '#eef7fb', 'font-family': 'monospace', class: 'tide-l' }, label));
  }
  const dur = s => { s = Math.max(0, s); const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return hh ? `${hh}h ${m}m` : `${m}m`; };

  // ---------------------------------------------------------- dock lamp (F5)
  function drawLamp(owned, night) {
    const g = $('#sc-lamp'); g.replaceChildren(); if (!owned.includes('lamp')) return;
    g.append(svg('title', null, 'Dock lamp'), px(146, 150, 2, 27, '#2b2318'), px(142, 146, 10, 5, '#222'), px(144, 147, 6, 3, night ? '#ffe08a' : '#cfd6dc'));
    if (night) g.append(svg('circle', { cx: 147, cy: 149, r: 14, fill: '#ffe08a', opacity: .18, class: 'glow' }));
  }

  function render(v) {
    const d = new Date(v.t * 1000); const phase = drawSky(d.getHours(), d.getMinutes(), v.stamina); const night = phase === 'night' || phase === 'dusk';
    drawShore(v.days, v.owned, night); drawBoats(v.open, { pennants: v.owned.includes('pennants'), night }); drawTide(v.tide, v.goal, v.open.length); drawLamp(v.owned, night);
  }

  // ---------------------------------------------------------- ship cat (F8): sits on the most urgent visitor
  const CAT = bell => `<svg viewBox="0 0 14 10" class="cat-svg" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="3" width="8" height="5" fill="#e0a43a"/><rect x="1" y="1" width="2" height="2" fill="#e0a43a"/><rect x="5" y="1" width="2" height="2" fill="#e0a43a"/><rect x="1" y="2" width="6" height="4" fill="#e0a43a"/><rect x="2" y="3" width="1" height="1" fill="#222"/><rect x="5" y="3" width="1" height="1" fill="#222"/><rect x="4" y="4" width="1" height="1" fill="#c0606a"/><rect x="4" y="5" width="4" height="1" fill="#b8822a"/><rect x="8" y="4" width="2" height="1" fill="#b8822a"/><rect x="10" y="2" width="2" height="4" fill="#e0a43a" class="tail"/><rect x="12" y="1" width="1" height="2" fill="#e0a43a" class="tail"/><rect x="2" y="8" width="2" height="1" fill="#b8822a"/><rect x="7" y="8" width="2" height="1" fill="#b8822a"/>${bell ? '<rect x="3" y="6" width="2" height="2" fill="#f2c94c"/>' : ''}</svg>`;
  const cat = (where, bell, napping) => h('div', { class: `ship-cat ${where}${napping ? ' nap' : ''}`, title: napping ? 'The ship cat, napping: nobody waiting' : 'The ship cat sits on whoever is most urgent', html: CAT(bell) });

  // ---------------------------------------------------------- tidy run (F4)
  function showRun(n) {
    const el = $('#run'); if (!el) return;
    if (n < 2) { el.classList.remove('show'); return; }
    el.textContent = `×${n} tidy run`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------------------------------------------------------- stamp book (F6) + chandlery (F5)
  function book(have) {
    return h('div', { class: 'stampbook', role: 'list', 'aria-label': 'Stamp book' }, G.BADGES.map(b => {
      const at = have[b.key];
      return h('div', { class: `sb-stamp ${at ? 'got' : ''}`, role: 'listitem', title: at ? `${b.label} · ${deps.fmtDate(at)}` : `${b.label} · not yet`, style: `--rot:${(G.hash(b.key) % 16) - 8}deg` },
        h('span', { class: 'sb-l' }, b.label), at ? h('small', null, deps.fmtDate(at)) : null);
    }));
  }
  function openChandlery() {
    const fun = deps.fun(); const cash = deps.cash();
    const row = s => {
      const own = fun.owned.includes(s.key); const equipped = (s.ink && fun.ink === s.ink) || (s.track && fun.track === s.track);
      const btn = own ? (s.ink || s.track ? h('button', { class: 'pbtn ghost', 'aria-pressed': String(!!equipped), onclick: () => { deps.equip(s.ink ? { ink: equipped ? 'red' : s.ink } : { track: equipped ? 'harbor' : s.track }); openChandlery(); } }, equipped ? 'in use' : 'use') : h('span', { class: 'owned' }, 'owned'))
        : h('button', { class: 'pbtn', disabled: cash < s.price, onclick: () => { deps.buy(s.key); openChandlery(); } }, deps.money(s.price));
      return h('li', { class: 'shop-row' }, h('div', null, h('b', null, s.label), h('div', { class: 'dim' }, s.what)), btn);
    };
    const days = fun.dayCount || 0; const built = G.town(days); const nextIn = G.nextBuildingIn(days);
    const content = h('div', { class: 'report chandlery' },
      h('div', { class: 'rp-head' }, h('span', null, `Till ${deps.money(cash)}`), h('span', null, `${Object.keys(fun.badges).length}/${G.BADGES.length} stamps · ${built.length} buildings`)),
      h('section', { class: 'rp' }, h('h3', null, 'Stamp book'), book(fun.badges)),
      h('section', { class: 'rp' }, h('h3', null, 'Chandlery · cosmetic only'), h('ul', { class: 'shop' }, G.SHOP.map(row))),
      h('section', { class: 'rp' }, h('h3', null, 'Harbor town'), h('p', { class: 'dim' }, built.length ? built.join(' · ') : 'Just the shore so far.', ' ', nextIn ? `Next building after ${nextIn} more day${nextIn > 1 ? 's' : ''} at the desk (${days} so far).` : 'The town is complete.')));
    deps.modal('ledger chandlery-modal', 'Chandlery', content);
  }

  // ---------------------------------------------------------- ships-out recap (F7)
  // v: { day, cleared: [{ title, calls, project }], earned, waiting, tide, badgesToday, logbook, footer }
  function recap(v) {
    const W = 400, H0 = 76 + Math.ceil(Math.max(1, Math.min(8, v.cleared.length)) / 2) * 22; const strip = svg('svg', { class: 'recap-sea', viewBox: `0 0 ${W} ${H0}`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': `${v.cleared.length} boats sailed out today` });
    strip.append(px(0, 0, W, 40, '#cfe8f5'), px(0, 40, W, H0 - 40, '#3f7fa6'), px(0, 40, W, 2, '#e6f4fa', { opacity: .7 }));
    // each boat sails in from the left, one after another over ~3 s, and comes to rest with its tally
    const shown = v.cleared.slice(0, 8);
    shown.forEach((b, i) => {
      const reg = G.regular(b.project); const sail = Math.min(G.sailHeight(b.calls), 20); const x = 8 + (i % 2) * 196, y = 66 + Math.floor(i / 2) * 22;
      const g = svg('g', { class: 'recap-boat', style: `animation-delay:${Math.round(i * 3000 / Math.max(1, shown.length))}ms` });
      g.append(px(x, y, 26, 5, '#3a2a1a'), px(x + 11, y - sail - 3, 2, sail + 3, '#2b2318'), px(x + 13, y - sail - 1, 10, sail, '#f1e4c0'), px(x + 13, y - sail - 1, 10, 3, reg.coat),
        svg('text', { x: x + 30, y: y + 4, 'font-size': 8, fill: '#fff', 'font-family': 'monospace' }, `${b.title.slice(0, 22)}${b.calls > 1 ? ` ×${b.calls}` : ''}`));
      strip.append(g);
    });
    if (!v.cleared.length) strip.append(svg('text', { x: W / 2, y: 100, 'font-size': 10, fill: '#fff', 'font-family': 'monospace', 'text-anchor': 'middle' }, 'No boats went out today.'));
    const tideLine = v.tide ? (v.tide.beat ? '⚑ Beat the tide' : `Tide still coming in · ${v.waiting} moored`) : null;
    return h('div', { class: 'report recap' },
      h('div', { class: 'rp-head' }, h('span', null, `Day ${v.day}`), h('span', null, `${v.cleared.reduce((n, b) => n + b.calls, 0)} cleared · ${deps.money(v.earned)} · ${v.waiting} waiting`)),
      strip,
      h('div', { class: 'recap-tally' },
        h('span', { class: 'rt' }, h('b', null, String(v.cleared.length)), v.cleared.length === 1 ? ' boat out' : ' boats out'),
        tideLine ? h('span', { class: `rt ${v.tide.beat ? 'won' : ''}` }, tideLine) : null,
        v.run > 1 ? h('span', { class: 'rt' }, `best run ×${v.run}`) : null,
        v.badgesToday.length ? h('span', { class: 'rt won' }, `new stamps: ${v.badgesToday.join(', ')}`) : null),
      h('details', { class: 'logbook' }, h('summary', null, 'Logbook'), v.logbook));
  }

  return { render, cat, showRun, openChandlery, recap, book };
};
