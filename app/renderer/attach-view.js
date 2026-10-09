/* Image attachments for anything the user writes back: the ship phone and the needs-work / ask / mismatch slips.
   Paste (Cmd/Ctrl+V) or drop an image, or Snap the desk window; each one is copied into <home>/attachments by the
   main process the moment it arrives (never a path into a temp folder that can vanish), shown as a thumbnail, and
   can be marked up (markup-view.js). The answer line names the copies in `attachments` and the pin notes join the
   text. Loaded before app.js; holds no desk state. */
'use strict';
window.HarborAttach = deps => {
  const { h, bridge, toast, markup } = deps;
  const MAX = 15 * 1024 * 1024, TYPES = /^image\/(png|jpeg|gif|webp)$/;

  // A file dropped anywhere else must never navigate the window to it.
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, e => { if (e.dataTransfer?.types?.includes('Files') && !e.defaultPrevented) e.preventDefault(); });

  const size = blob => new Promise(res => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => res({ url: u, w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ url: u, w: 0, h: 0 }); i.src = u; });
  // Hide the overlays (phone, slips, popovers) for a frame or two so the snap shows the desk itself.
  async function snapDesk() {
    document.body.classList.add('snapping');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let r; try { r = await bridge.snap(); } finally { document.body.classList.remove('snapping'); }
    return r;
  }

  // One tray per surface. mount(zone, input) (re)binds it to that surface's elements; the list survives remounts,
  // so a phone hung up with images keeps them for next time, like the unsent text.
  function tray(opts = {}) {
    let list = [], zone = null, input = null;
    const el = h('div', { class: 'att-tray', 'aria-label': 'Attached images' });
    const changed = () => { render(); opts.onChange?.(); };

    async function addBlob(blob, source) {
      if (!TYPES.test(blob.type || '')) { toast('Only PNG, JPEG, WebP or GIF images can be attached.', 'warn'); return; }
      if (blob.size > MAX) { toast('That image is over 15 MB.', 'warn'); return; }
      const r = await bridge.attach(await blob.arrayBuffer());
      if (!r.ok) { toast(`Could not attach: ${r.error}`, 'warn'); return; }
      add({ path: r.path, source, ...(await size(blob)) });
    }
    function add(entry) {
      if (list.some(x => x.path === entry.path)) { toast('Already attached.'); return; }
      if (list.length >= 8) { toast('At most 8 images per message.', 'warn'); return; }
      list.push(entry); changed();
    }
    async function snap() {
      const r = await snapDesk();
      if (!r?.ok) { toast(`Could not snap the desk: ${r?.error || 'unknown error'}`, 'warn'); return; }
      const entry = { path: r.path, source: 'snap', ...(await size(new Blob([r.bytes], { type: 'image/png' }))) };
      add(entry); if (list.includes(entry)) markUp(entry); // a snap is for pointing at something: mark it up straight away
    }
    function markUp(entry) {
      markup.open(entry, r => { Object.assign(entry, { marked: r.marked, markedUrl: r.markedUrl, marks: r.marks }); changed(); input?.focus(); });
    }

    const onPaste = e => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (!files.length) return; // plain text pastes as usual
      e.preventDefault(); files.forEach(f => addBlob(f, 'paste'));
    };
    const onOver = e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); zone.classList.add('att-drop'); } };
    const onLeave = e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('att-drop'); };
    const onDrop = e => {
      zone.classList.remove('att-drop');
      const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
      e.preventDefault(); files.forEach(f => addBlob(f, 'drop'));
    };
    function mount(z, i) {
      zone = z; input = i;
      i.addEventListener('paste', onPaste);
      z.addEventListener('dragover', onOver); z.addEventListener('dragleave', onLeave); z.addEventListener('drop', onDrop);
      render(); return el;
    }

    function render() {
      el.replaceChildren(...list.map((a, i) => {
        const n = (a.marks || []).length;
        return h('span', { class: 'att-thumb', dataset: { path: a.path } },
          h('button', { class: 'att-img', type: 'button', title: n ? 'Edit the marks' : 'Mark it up: pins, boxes, arrows', 'aria-label': `Image ${i + 1}${n ? `, ${n} marks` : ''}: mark up`, onclick: () => markUp(a) },
            h('img', { src: a.markedUrl || a.url, alt: '' }), n ? h('span', { class: 'att-n' }, String(n)) : null),
          h('button', { class: 'att-x', type: 'button', 'aria-label': `Remove image ${i + 1}`, onclick: () => { list.splice(i, 1); changed(); input?.focus(); } }, '×'));
      }),
      opts.snap ? h('button', { class: 'att-snap', type: 'button', title: 'Snap this window (without the phone) and mark it up', onclick: snap }, 'Snap desk') : null,
      h('span', { class: 'att-hint' }, list.length ? 'Click an image to mark it up' : `${/Mac/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'} or drop an image here`));
    }

    return {
      el, mount, snap,
      has: () => list.length > 0,
      // answer `attachments` (attach.js re-validates every field)
      payload: () => list.length ? list.map(a => ({ type: 'image', path: a.path, ...(a.marked ? { marked: a.marked } : {}), source: a.source, ...(a.w ? { w: a.w, h: a.h } : {}), ...(a.marks?.length ? { marks: a.marks } : {}) })) : undefined,
      // the text that goes out: what was typed, then the pin notes; an image alone still says something
      note: typed => [typed, HarborMarks.noteText(list)].filter(Boolean).join(' ').trim() || (list.length ? 'See the attached image.' : ''),
      clear: () => { list = []; render(); }
    };
  }
  // Images on an answer the desk shows back (correspondence, ticket pop): thumbnails of the marked copy, click to zoom.
  const thumbs = atts => Array.isArray(atts) && atts.length ? h('div', { class: 'att-row' }, atts.map(x => {
    const p = x.marked || x.path, f = deps.fileFor(p), name = p.split('/').pop();
    return f ? h('button', { class: 'att-mini', type: 'button', title: name, onclick: e => { e.stopPropagation(); deps.openViewer({ type: 'image', path: p }); } }, h('img', { src: f.url, alt: `attached image ${name}` }))
      : h('span', { class: 'att-mini missing', title: p }, 'image');
  })) : null;
  const badge = atts => atts?.length ? h('span', { class: 'tk-att', title: 'Images sent with it' }, `🖼 ${atts.length}`) : null;

  // A note slip (needs-work, ask, mismatch). opts: { title, to, placeholder?, prefill?, draft?, attach?, rule? }; with attach it
  // takes images too, with rule it offers "Remember this" (a standing order). onSubmit(note, attachments?, rule) once
  // sent; an image alone is enough to send.
  // opts.draft: a key; the unsent text is kept under it when the slip is closed (Esc, Cancel), like the phone's pad
  const drafts = new Map();
  function slip(opts, onSubmit) {
    const ta = h('textarea', { placeholder: opts.placeholder || '', value: drafts.get(opts.draft) ?? opts.prefill ?? '', oninput: () => { if (opts.draft) drafts.set(opts.draft, ta.value); } });
    const t = opts.attach ? tray({ snap: true }) : null;
    const rule = opts.rule ? h('input', { type: 'checkbox', id: 'note-rule' }) : null;
    const body = h('div', null, h('div', { class: 'to' }, opts.to), ta, t?.el, rule && h('label', { class: 'remember', title: 'A standing order: filed with your preferences and followed from now on' }, rule, ' Remember this'));
    deps.modal('noteslip', opts.title, body, [h('button', { class: 'pbtn ghost', onclick: deps.closeModal }, 'Cancel'), h('button', { class: 'pbtn', onclick: submit }, 'Send')]);
    t?.mount(body.closest('.box'), ta);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); });
    function submit() {
      const v = ta.value.trim(); if (!v && !t?.has()) { ta.focus(); return; }
      const note = t ? t.note(v) : v, atts = t?.payload(), r = !!rule?.checked; drafts.delete(opts.draft); deps.closeModal(); onSubmit(note, atts, r);
    }
  }
  return { tray, snapDesk, thumbs, badge, slip };
};
