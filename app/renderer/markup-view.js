/* Mark up an attached image before it goes out: numbered pins (each with a one-line note), boxes (numbered too) and
   arrows, Undo. One canvas draws both the live view and the flattened copy, so what the user sees is what the crew
   gets. Coordinates are normalized 0..1 like inspect anchors. Saving writes the flattened PNG through the same
   attach path as a paste and hands back { marked, marks }.
   Keys (while open, ahead of the phone and the desk): P pin, B box, A arrow, Cmd/Ctrl+Z undo, Cmd/Ctrl+Enter save,
   Esc cancel. Loaded before app.js; holds no desk state. */
'use strict';
const HarborMarks = (() => {
  // Pins and boxes get numbers in order; arrows point and need none.
  function renumber(marks) { let n = 1; for (const m of marks) { if (m.shape === 'arrow') delete m.n; else m.n = n++; } return marks; }
  // A drag shorter than this (fraction of the image) is a click: it drops a pin whatever the tool.
  const CLICK = .02;
  function fromDrag(tool, a, b) {
    const far = Math.hypot(b.x - a.x, b.y - a.y) > CLICK;
    if (tool === 'pin' || !far) return { shape: 'pin', x: a.x, y: a.y, note: '' };
    if (tool === 'box') return { shape: 'box', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), note: '' };
    return { shape: 'arrow', x: a.x, y: a.y, x2: b.x, y2: b.y };
  }
  // The JSON a mark travels as (attach.js validates the same shape).
  const r3 = v => Math.round(v * 1000) / 1000;
  function wire(m) {
    const o = { shape: m.shape, x: r3(m.x), y: r3(m.y) };
    if (m.shape === 'box') Object.assign(o, { w: r3(m.w), h: r3(m.h) });
    if (m.shape === 'arrow') Object.assign(o, { x2: r3(m.x2), y2: r3(m.y2) });
    if (m.n) { o.n = m.n; if (m.note && m.note.trim()) o.note = m.note.trim(); }
    return o;
  }
  // "[1] too wide [2] cut off": the pin notes in the answer text, so nothing depends on reading the picture.
  // The k-th image (k > 1) numbers its marks k.n.
  function noteText(atts) {
    const parts = [];
    atts.forEach((a, k) => { for (const m of a.marks || []) if (m.n && m.note) parts.push(`[${k ? `${k + 1}.` : ''}${m.n}] ${m.note}`); });
    return parts.join(' ');
  }
  function draw(ctx, img, marks, w, h) {
    const u = Math.max(w, h) / 160, red = '#e0452b';
    ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const m of marks) {
      ctx.strokeStyle = red; ctx.fillStyle = red;
      if (m.shape === 'box') { ctx.lineWidth = .4 * u; ctx.strokeRect(m.x * w, m.y * h, m.w * w, m.h * h); }
      if (m.shape === 'arrow') {
        const x1 = m.x * w, y1 = m.y * h, x2 = m.x2 * w, y2 = m.y2 * h, ang = Math.atan2(y2 - y1, x2 - x1), hl = 2.4 * u;
        ctx.lineWidth = .5 * u; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * hl * .6, y2 - Math.sin(ang) * hl * .6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang - .45), y2 - hl * Math.sin(ang - .45)); ctx.lineTo(x2 - hl * Math.cos(ang + .45), y2 - hl * Math.sin(ang + .45)); ctx.closePath(); ctx.fill();
      }
      if (m.n) {
        const cx = m.x * w, cy = m.y * h, r = 1.5 * u;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = .25 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${1.6 * u}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(m.n), cx, cy + .1 * u);
      }
    }
  }
  return { renumber, fromDrag, wire, noteText, draw };
})();
if (typeof module === 'object') module.exports = HarborMarks;
else window.HarborMarkup = deps => {
  const { h, bridge, toast } = deps;
  let el = null;
  // entry: { url (blob: URL of the original), w, h, marks? }. onSave({ marked, markedUrl, marks }) once written.
  function open(entry, onSave) {
    close();
    const img = new Image(); img.src = entry.url;
    const marks = (entry.marks || []).map(m => ({ ...m })); const undo = [];
    let tool = 'pin', drag = null;
    const canvas = h('canvas', { class: 'mk-canvas', width: entry.w, height: entry.h, 'aria-label': 'Image to mark up: click for a pin, drag for a box or arrow' });
    const ctx = canvas.getContext('2d');
    const list = h('ol', { class: 'mk-notes' });
    const tools = ['pin', 'box', 'arrow'].map(t => h('button', { class: 'mk-tool', type: 'button', dataset: { tool: t }, 'aria-pressed': String(t === tool), onclick: () => setTool(t) }, { pin: 'Pin', box: 'Box', arrow: 'Arrow' }[t], ' ', h('b', null, t[0].toUpperCase())));
    const save = h('button', { class: 'pbtn', type: 'button', onclick: () => commit() }, 'Done');
    el = h('div', { class: 'markup', id: 'markup', onclick: e => { if (e.target === el) close(); } },
      h('div', { class: 'mk-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mark up the image' },
        h('div', { class: 'mk-bar' }, ...tools, h('button', { class: 'mk-tool', type: 'button', onclick: () => pop() }, 'Undo ', h('b', null, '⌘Z')), h('span', { class: 'spacer' }),
          h('button', { class: 'pbtn ghost', type: 'button', onclick: () => close() }, 'Cancel'), save),
        h('div', { class: 'mk-stage', style: `aspect-ratio:${entry.w}/${entry.h};--ar:${entry.w / entry.h}` }, canvas), list,
        h('p', { class: 'mk-hint' }, 'Click to drop a numbered pin; drag for a box or an arrow. Each number gets a note. ⌘⏎ done, Esc cancel.')));
    document.body.append(el);
    const redraw = tmp => { if (img.complete) HarborMarks.draw(ctx, img, tmp ? [...marks, tmp] : marks, entry.w, entry.h); };
    img.onload = () => redraw();
    const at = e => { const r = canvas.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
    canvas.addEventListener('pointerdown', e => { drag = at(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (drag && tool !== 'pin') redraw(HarborMarks.fromDrag(tool, drag, at(e))); });
    canvas.addEventListener('pointerup', e => { if (!drag) return; const m = HarborMarks.fromDrag(tool, drag, at(e)); drag = null; push(m); });
    function push(m) { marks.push(m); undo.push(m); HarborMarks.renumber(marks); renderList(m); redraw(); }
    function pop() { const m = undo.pop() || marks[marks.length - 1]; if (!m) return; marks.splice(marks.indexOf(m), 1); HarborMarks.renumber(marks); renderList(); redraw(); }
    function setTool(t) { tool = t; tools.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t))); }
    function renderList(focusMark) {
      let focus = null;
      list.replaceChildren(...marks.filter(m => m.n).map(m => {
        const inp = h('input', { class: 'mk-note', value: m.note || '', placeholder: m.shape === 'box' ? 'What is wrong in this box?' : 'What is wrong here?', 'aria-label': `Note for mark ${m.n}`, maxlength: 500, oninput: () => { m.note = inp.value; } });
        if (m === focusMark) focus = inp;
        return h('li', null, h('span', { class: 'mk-n' }, String(m.n)), inp, h('button', { class: 'mk-x', type: 'button', 'aria-label': `Remove mark ${m.n}`, onclick: () => { marks.splice(marks.indexOf(m), 1); undo.splice(undo.indexOf(m) >>> 0, undo.includes(m) ? 1 : 0); HarborMarks.renumber(marks); renderList(); redraw(); } }, '×'));
      }));
      focus?.focus(); // at once: the next key the user types is the note
    }
    async function commit() {
      if (!marks.length) { onSave({ marked: null, markedUrl: null, marks: null }); close(); return; }
      save.disabled = true; redraw();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const r = blob ? await bridge.attach(await blob.arrayBuffer()) : { ok: false, error: 'could not draw the image' };
      if (!r.ok) { save.disabled = false; toast(`Could not save the marked copy: ${r.error}`, 'warn'); return; }
      onSave({ marked: r.path, markedUrl: URL.createObjectURL(blob), marks: marks.map(HarborMarks.wire) });
      close();
    }
    el.keys = e => {
      const inInput = e.target.tagName === 'INPUT', mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' && mod) commit();
      else if (e.key.toLowerCase() === 'z' && mod && !inInput) pop();
      else if (!inInput && !mod && !e.altKey && ['p', 'b', 'a'].includes(e.key.toLowerCase())) setTool({ p: 'pin', b: 'box', a: 'arrow' }[e.key.toLowerCase()]);
      else if (e.key === 'Enter' && inInput) e.target.blur();
      else return false;
      return true;
    };
    renderList(); save.focus();
  }
  function close() { el?.remove(); el = null; }
  // Window capture runs before the phone's and the desk's document listeners: while marking up, nothing else
  // under it sees a key (typing in a note never dials, stamps or hangs up).
  window.addEventListener('keydown', e => {
    if (!el || e.isComposing) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    if (el.keys(e)) e.preventDefault();
  }, true);
  return { open, close, isOpen: () => !!el };
};
