'use strict';
// Option previews: a sample of a decision option, small, in its row. An image shows a thumbnail, audio and video a
// play button (inline, one clip at a time), anything else an open link. Clicking the thumbnail or the enlarge
// button opens the viewer; a local file that is gone leaves a quiet placeholder. Clicks here never pick the option.
// Holds no desk state: app.js passes its helpers in (all lazy, they are defined after this loads).
window.HarborOptionPreview = deps => {
  const { h } = deps;
  // audio has no desk viewer of its own: a plain player in the same dossier modal
  const open = a => (deps.artType(a) === 'audio' ? deps.modal('dossier', a.label || deps.base(a.path || a.url), h('div', { class: 'mount' }, h('audio', { src: deps.srcFor(a), controls: true, autoplay: true }))) : deps.openArtifact(a));
  let playing = null;
  const stop = el => { if (playing && playing !== el) { playing.pause(); playing.dispatchEvent(new Event('hd-stop')); } playing = el; };
  return function preview(a) {
    if (!a || !(a.path || a.url)) return null;
    const type = deps.artType(a), label = a.label || deps.base(a.path || a.url), src = deps.srcFor(a);
    const quiet = e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); };
    const view = h('button', { type: 'button', class: 'op-open', title: `Enlarge ${label}`, 'aria-label': `Enlarge ${label}`, onclick: e => { quiet(e); open(a); } }, '⤢');
    const wrap = (kind, ...kids) => h('span', { class: `op-art ${kind}`, dataset: { art: type } }, ...kids);
    if (type === 'image') return !src ? wrap('gone', 'not available') : wrap('img', h('button', { type: 'button', class: 'op-thumb', title: `Enlarge ${label}`, 'aria-label': `Enlarge ${label}`, onclick: e => { quiet(e); open(a); } }, h('img', { src, alt: '' })));
    if (type === 'audio' || type === 'video') {
      if (!src) return wrap('gone', 'not available');
      const m = h(type, { src, preload: 'metadata', class: 'op-media' });
      const play = h('button', { type: 'button', class: 'op-play', title: `Play ${label}`, 'aria-label': `Play ${label}`, onclick: e => { quiet(e); if (m.paused) { stop(m); m.play().catch(() => {}); } else m.pause(); } }, '▶');
      const sync = () => { play.textContent = m.paused ? '▶' : '❚❚'; play.classList.toggle('on', !m.paused); };
      for (const ev of ['play', 'pause', 'ended', 'hd-stop']) m.addEventListener(ev, sync);
      return wrap(type, m, play, view);
    }
    return wrap('link', h('button', { type: 'button', class: 'op-link', title: label, onclick: e => { quiet(e); open(a); } }, type === 'web' ? 'Open page ↗' : 'Open ↗'));
  }
};
