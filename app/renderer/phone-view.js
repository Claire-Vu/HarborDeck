/* The ship phone: a speaking tube to the first mates. It sits as a small icon in the top bar; the phone shortcut
   (Settings, default Cmd/Ctrl+Shift+Space; the main process also holds it system-wide) or the icon brings it to the
   middle of the screen with the mouthpiece focused. Dial a first mate (1-9 or arrows while the pad is empty,
   Cmd/Ctrl+1-9 any time, or a click), speak, Enter sends (Shift+Enter: new line) one `request` line to answers.jsonl; "Remember this" adds `rule: true` (a standing order).
   Out of stamina? Option/Alt+Enter queues it for after the usage-limit reset, or pick a time and queue it for then;
   the scheduler sends it by itself. Esc or the shortcut hangs up; an unsent message stays on the pad.
   Loaded before app.js; holds no desk state: app.js passes its helpers and live accessors in. */
'use strict';
const HarborPhoneKeys = (() => {
  const isMac = typeof navigator === 'object' && /Mac/.test(navigator.platform || navigator.userAgent || '');
  // Electron accelerator ('CommandOrControl+Shift+Space') -> { key, mods } or null.
  function parse(acc, mac = isMac) {
    const parts = String(acc || '').split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
    const key = parts.pop(); if (!key) return null;
    const mods = { meta: false, ctrl: false, alt: false, shift: false };
    for (const m of parts) {
      if (m === 'commandorcontrol' || m === 'cmdorctrl') mods[mac ? 'meta' : 'ctrl'] = true;
      else if (['command', 'cmd', 'super', 'meta'].includes(m)) mods.meta = true;
      else if (m === 'control' || m === 'ctrl') mods.ctrl = true;
      else if (m === 'alt' || m === 'option') mods.alt = true;
      else if (m === 'shift') mods.shift = true;
      else return null;
    }
    return { key, mods };
  }
  // By physical key for letters, digits and space, so Shift or Option never changes what matches.
  const keyIs = (k, e) => k === 'space' ? e.code === 'Space' : /^[a-z]$/.test(k) ? e.code === `Key${k.toUpperCase()}` : /^[0-9]$/.test(k) ? e.code === `Digit${k}` : String(e.key || '').toLowerCase() === k;
  function matches(acc, e, mac = isMac) {
    const p = parse(acc, mac);
    return !!p && keyIs(p.key, e) && !!e.metaKey === p.mods.meta && !!e.ctrlKey === p.mods.ctrl && !!e.altKey === p.mods.alt && !!e.shiftKey === p.mods.shift;
  }
  function label(acc, mac = isMac) {
    const p = parse(acc, mac); if (!p) return '';
    const key = p.key.length === 1 ? p.key.toUpperCase() : p.key[0].toUpperCase() + p.key.slice(1);
    if (mac) return `${p.mods.ctrl ? '⌃' : ''}${p.mods.alt ? '⌥' : ''}${p.mods.shift ? '⇧' : ''}${p.mods.meta ? '⌘' : ''}${key}`;
    return [p.mods.ctrl && 'Ctrl', p.mods.alt && 'Alt', p.mods.shift && 'Shift', p.mods.meta && 'Super', key].filter(Boolean).join('+');
  }
  return { parse, matches, label };
})();
if (typeof module === 'object') module.exports = HarborPhoneKeys;
else window.HarborPhone = deps => {
  const { h, snd } = deps;
  let el = null, rule = null, pad = null, dial = null, dialed = null, back = null, resetBtn = null, at = null, atBtn = null;
  const mates = () => deps.mates();
  const shortcut = () => deps.settings().phoneShortcut || '';
  const isOpen = () => !!el;

  // Brass speaking tube with its whistle cap: original art.
  const ART = `<svg viewBox="0 0 120 150" aria-hidden="true"><defs><linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#8a5a1c"/><stop offset=".45" stop-color="#f2c56b"/><stop offset="1" stop-color="#9a6a22"/></linearGradient></defs>
    <rect x="18" y="8" width="84" height="134" rx="8" fill="var(--wood-2)" stroke="var(--wood-edge)" stroke-width="3"/>
    <circle cx="28" cy="18" r="2.5" fill="#d9b25c"/><circle cx="92" cy="18" r="2.5" fill="#d9b25c"/><circle cx="28" cy="132" r="2.5" fill="#d9b25c"/><circle cx="92" cy="132" r="2.5" fill="#d9b25c"/>
    <path d="M52 150V92a14 14 0 0 1 14-14h2" fill="none" stroke="url(#brass)" stroke-width="12"/>
    <path d="M66 70l22-16v52l-22-16z" fill="url(#brass)" stroke="#6b4513" stroke-width="2"/>
    <ellipse cx="89" cy="80" rx="7" ry="27" fill="#2b1a0d" stroke="url(#brass)" stroke-width="5"/>
    <g class="ph-cap"><ellipse cx="89" cy="44" rx="6" ry="9" fill="url(#brass)" stroke="#6b4513" stroke-width="1.5"/><rect x="86" y="50" width="6" height="5" fill="#6b4513"/></g>
  </svg>`;

  function render() {
    const list = mates();
    if (!list.some(m => m.id === dialed)) dialed = list[0]?.id;
    dial.replaceChildren(...list.map((m, i) => h('button', { class: 'dial-pos', role: 'radio', 'aria-checked': String(m.id === dialed), tabindex: m.id === dialed ? 0 : -1, dataset: { mate: m.id }, title: m.domain || m.label, onclick: () => { dialTo(m.id); pad.focus(); } },
      h('span', { class: 'dial-n' }, i < 9 ? String(i + 1) : '·'), h('span', { class: 'dial-face', html: deps.sprite(m.id) }), h('span', { class: 'dial-name' }, m.label))));
    const who = list.find(m => m.id === dialed);
    pad.placeholder = who ? `Speak to ${who.label}…` : '';
    pad.setAttribute('aria-label', who ? `Message to ${who.label}` : 'Message');
  }
  function dialTo(id) { if (id === dialed) return; dialed = id; snd('tick'); render(); }
  function step(d) { const list = mates(); if (!list.length) return; const i = list.findIndex(m => m.id === dialed); dialTo(list[(i + d + list.length) % list.length].id); }

  function open() {
    if (el) { pad.focus(); return; }
    back = document.activeElement;
    dialed = deps.lastMate() || mates()[0]?.id;
    pad = h('textarea', { class: 'phone-pad', rows: 3, value: deps.draft.get(), oninput: () => deps.draft.set(pad.value) });
    dial = h('div', { class: 'dial', role: 'radiogroup', 'aria-label': 'Dial a first mate' });
    resetBtn = h('button', { class: 'phone-q', title: `Queue for after the usage-limit reset: it goes out by itself (${deps.resetNote()})`, onclick: () => queue('reset') }, 'Queue for after reset');
    at = h('input', { type: 'time', class: 'phone-at', 'aria-label': 'Send at time', title: 'Send at this time (next occurrence)' });
    atBtn = h('button', { class: 'phone-q', disabled: true, onclick: () => { if (at.value) queue(deps.clockEpoch(at.value)); } }, 'Queue at time');
    at.addEventListener('input', () => { atBtn.disabled = !at.value; });
    rule = h('input', { type: 'checkbox', id: 'phone-rule', onchange: () => pad.focus() }); // back to the pad, so Enter still sends
    el = h('div', { class: 'phone', id: 'phone', onclick: e => { if (e.target === el) close(); } },
      h('div', { class: 'phone-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ship phone' },
        h('div', { class: 'phone-art', html: ART }),
        h('div', { class: 'phone-main' }, dial, pad,
          h('div', { class: 'phone-when' }, resetBtn, h('span', { class: 'phone-at-group' }, at, atBtn), h('label', { class: 'remember', title: 'A standing order: your first mate files it with your preferences and follows it from now on' }, rule, ' Remember this')),
          h('div', { class: 'phone-keys', 'aria-hidden': 'true' }, h('span', null, h('b', null, '1-9'), ' dial'), h('span', null, h('b', null, '⏎'), ' send'), h('span', null, h('b', null, '⌥⏎'), ' after reset'), h('span', null, h('b', null, '⇧⏎'), ' new line'), h('span', null, h('b', null, 'Esc'), ' hang up')))));
    render();
    document.body.append(el); document.getElementById('btn-phone')?.setAttribute('aria-expanded', 'true');
    pad.focus(); pad.setSelectionRange(pad.value.length, pad.value.length);
    snd('whistle');
  }
  function close() {
    if (!el) return;
    el.remove(); el = null; document.getElementById('btn-phone')?.setAttribute('aria-expanded', 'false');
    if (back && back.isConnected && back !== document.body) back.focus(); else document.activeElement?.blur();
    back = null;
  }
  function toggle() { if (el) close(); else open(); }
  function send() {
    const v = pad.value.trim(); if (!v || !dialed) { pad.focus(); return; }
    if (!deps.send(v, dialed, rule.checked)) return; // write failed: the pad keeps the words
    sent();
  }
  async function queue(when) {
    const v = pad.value.trim(); if (!v || !dialed) { pad.focus(); return; }
    if (!(await deps.queue(v, dialed, when, rule.checked))) return; // refused: the pad keeps the words
    sent();
  }
  function sent() {
    deps.draft.set(''); close();
    const b = document.getElementById('btn-phone');
    if (b) { b.classList.remove('sent'); void b.offsetWidth; b.classList.add('sent'); setTimeout(() => b.classList.remove('sent'), 1600); }
  }

  // Capture phase: the phone answers its keys before the desk's own shortcuts see them.
  document.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (HarborPhoneKeys.matches(shortcut(), e)) { e.preventDefault(); e.stopPropagation(); toggle(); return; }
    if (!el) return;
    const empty = !pad.value, inPad = e.target === pad, inTime = e.target === at;
    e.stopPropagation(); // the phone is modal: the desk's own shortcuts never fire under it
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && e.altKey && !e.shiftKey && inPad) queue('reset');
    else if (e.key === 'Enter' && !e.shiftKey && inPad) send();
    else if (e.key === 'Enter' && inTime) { if (at.value) queue(deps.clockEpoch(at.value)); }
    else if (/^[1-9]$/.test(e.key) && !e.altKey && !e.shiftKey && (e.metaKey || e.ctrlKey || (!inTime && (empty || !inPad)))) { const m = mates()[+e.key - 1]; if (m) dialTo(m.id); }
    else if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !inTime && (empty || !inPad)) step(e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    else if (e.key === 'Tab') { // focus stays in the phone: dial, pad, then the queue controls
      const ring = [dial.querySelector('[aria-checked="true"]'), pad, resetBtn, at, atBtn, rule].filter(x => x && !x.disabled);
      const i = ring.indexOf(e.target); ring[(i + (e.shiftKey ? -1 : 1) + ring.length) % ring.length].focus();
    }
    else return;
    e.preventDefault();
  }, true);

  return { open, close, toggle, isOpen, refresh: () => { if (el) render(); } };
};
