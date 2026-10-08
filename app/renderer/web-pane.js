/* In-desk browser frame for `web` / `lavish` artifacts (Lavish plans, local dev servers). Draws the dossier
   chrome (back, reload, open in browser, full size) and keeps the main-process page view (app/lib/web-pane.js)
   laid exactly over the mount box. The page never touches this document or window.harbor. */
window.harborWebPane = (() => {
  'use strict';
  const web = window.harbor && window.harbor.web;
  let live = null;
  if (web) web.onState(s => live && live.state(s));

  // modal, h, toast: app.js helpers, passed in so this file stays free of desk state.
  function open({ url, title, modal, h, toast }) {
    const addr = h('span', { class: 'web-addr', title: url }, url);
    const mount = h('div', { class: 'web-mount' });
    const back = h('button', { class: 'tbtn', 'aria-label': 'Back', title: 'Back', disabled: true, onclick: () => web.go('back') }, '←');
    const fullBtn = h('button', { class: 'tbtn', title: 'Fill the window', onclick: () => { fullBtn.textContent = m.classList.toggle('full') ? 'Restore' : 'Full'; } }, 'Full');
    const controls = h('div', { class: 'zoomer' }, back,
      h('button', { class: 'tbtn', 'aria-label': 'Reload', title: 'Reload', onclick: () => web.go('reload') }, '↻'),
      h('button', { class: 'tbtn', title: 'Open this page in your browser', onclick: () => web.go('external') }, 'Browser ↗'), fullBtn);
    const m = modal('dossier web', title, h('div', { class: 'web-frame' }, h('div', { class: 'web-bar' }, addr), mount), null, controls);
    const rect = () => { const r = mount.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
    const sync = () => web.bounds(rect());
    const ro = new ResizeObserver(sync);
    const me = {
      state(s) {
        if (s.url) { addr.textContent = s.url; addr.title = s.url; }
        back.disabled = !s.canGoBack; m.classList.toggle('loading', !!s.loading);
        if (s.error) toast(`Page did not load: ${s.error}`, 'warn');
        if (s.notice) toast(s.notice);
      }
    };
    live = me;
    // closeModal() just empties #modal-root; drop the page view when this frame leaves the DOM, unless a
    // newer frame has already taken the view over.
    const gone = new MutationObserver(() => {
      if (m.isConnected) return;
      gone.disconnect(); ro.disconnect(); window.removeEventListener('resize', sync);
      if (live === me) { live = null; web.close(); }
    });
    gone.observe(m.parentNode, { childList: true });
    web.open(url, rect()).then(r => {
      if (r.ok) { ro.observe(mount); window.addEventListener('resize', sync); return; }
      mount.replaceChildren(h('div', { class: 'web-refused' }, h('p', null, r.error), h('button', { class: 'tbtn', onclick: () => window.harbor.openExternal(url) }, 'Open in your browser')));
    });
  }

  return { open };
})();
