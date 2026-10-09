/* Desk keyboard shortcuts (registered by app.js), and take-all-recommended.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

function deskKeys(e) {
  // Cmd/Ctrl+K: search, from anywhere but the ship phone (it swallows keys while up; checked again here)
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK') { e.preventDefault(); if (!phone.isOpen()) { setMenu(false); search.toggle(); } return; }
  if (e.key === 'Escape' && menuOpen()) { setMenu(false); return; }
  if (e.key === 'Escape' && !$('#stow-view').hidden) { closeStowView(); return; }
  if (e.key === 'Escape') { closeModal(); closeDrawers(); clearPick(); document.querySelector('.tk-pop')?.remove(); return; }
  const tgt = e.target instanceof Element ? e.target : document.body;
  if (tgt.matches('textarea,select,input:not([type=radio]):not([type=checkbox])') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (phone.isOpen()) return; // the ship phone is modal: no desk keys (letters, Space, S, Shift+A) while it is up
  const box = document.querySelector('#modal-root .modal');
  if (box && (e.key === ' ' || (e.shiftKey && k === 'a'))) {
    // Space opens the office from the manifest; Shift+A again stamps the take-all-recommended list
    const go = box.classList.contains('manifest') && e.key === ' ' ? box.querySelector('footer .pbtn') : box.classList.contains('sweep') && k === 'a' ? box.querySelector('footer .pbtn:not(.ghost)') : null;
    if (go) { e.preventDefault(); go.click(); }
    return;
  }
  if (tgt.matches('input') && !tgt.closest('#desk-surface')) return; // a radio or checkbox on the desk still takes letters and Space
  if (k === 'u' || k === 'z') { if (pending) { e.preventDefault(); undoPending(); } return; }
  if (k === 'm') { e.preventDefault(); setMenu(!menuOpen()); return; }
  if (k === 'p') { e.preventDefault(); $('#btn-plain').click(); return; }
  if (S.prefs.plain) return;
  if (tgt.closest('#rail')) { railKeys(e); if (e.key.startsWith('Arrow')) return; }
  if (e.key === 'Tab' && !tgt.closest('.modal,.drawer')) { e.preventDefault(); toggleTray(); return; }
  if (k === 't') { e.preventDefault(); const b = document.querySelector('#rail .ticket.new') || document.querySelector('#rail .ticket'); /* newest reply first (tickets()) */ if (b) { railFocus = +b.dataset.i; b.focus(); } else toast('No tickets on the rail.'); }
  else if (k === 'n') walk(); else if (k === 'w') backOfLine(); else if (k === 'b' && e.shiftKey) $('#btn-shop').click(); /* plain B picks option B (quick calls) */ else if (k === 'i') setInspect(!document.body.classList.contains('inspect')); else if (k === 'r') $('#btn-orders').click(); else if (k === 'l') openLedger();
  else if (k === 'o') { const it = byId[S.current]; if (it?.topic) topicView.open(it.topic); else toast(it ? 'No topic on this item.' : 'Nobody at the desk.'); }
  else if ('1234'.includes(k) && k) { e.preventDefault(); if (!document.querySelector('.modal')) stamp(VERDICTS[+k - 1]); }
  else if (box) return;
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !tgt.matches('input')) { e.preventDefault(); setScene(HS.step(sceneKind(), e.key === 'ArrowRight' ? 1 : -1)); }
  // quick calls: Space stamps (never Enter), A-E pick, J/K move on a sheet, S later, Shift+A take all recommended
  else if (e.key === ' ') { e.preventDefault(); if (document.activeElement?.matches('button,a,[tabindex]')) document.activeElement.blur(); if (!openUnreadReply()) stamp('approve'); } // an unread reply is read first
  else if (e.shiftKey && k === 'a') { e.preventDefault(); quick.openSweep(queueItems().filter(i => !st(i.id).awaiting), sweep); }
  else if (!e.shiftKey && 'abcde'.includes(k) && k) { e.preventDefault(); pickLetter('abcde'.indexOf(k)); }
  else if (k === 'x') { e.preventDefault(); if (e.shiftKey) unstowAll(S.current); else stowKey(); }
  else if (k === 'j') moveRow(1); else if (k === 'k') moveRow(-1);
  else if (k === 's') { e.preventDefault(); stamp('later', e.shiftKey); }
}
// Take all recommended: one stamp writes the recommended option for every ticked decision; undone together.
function sweep(list) {
  const lines = list.map(it => ({ it, line: { id: it.id, action: 'decide', key: it.options.find(o => o.recommended).key } }));
  S.current = list[0].id; st(list[0].id).read = true; save(); renderAll();
  finishStamp(list[0], `APPROVED ×${lines.length}`, 'approve', lines[0].line, false, lines.slice(1), true); // bulk: never a tidy run
}
