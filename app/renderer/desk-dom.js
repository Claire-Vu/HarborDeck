/* DOM helpers for the desk: h(), icons, formatting, toasts, the cash pop, markdown.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ helpers
const $ = sel => document.querySelector(sel);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'style' && typeof v !== 'object') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const icon = name => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ic'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', `#i-${name}`); svg.append(u); return svg; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const fmtDate = ts => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const age = secs => { const s = Math.max(0, secs); if (s < 3600) return `${Math.round(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; const d = Math.floor(s / 86400); return `${d}d${d < 3 ? ' ' + Math.floor((s % 86400) / 3600) + 'h' : ''}`; };
const sentences = text => (text || '').split(/(?<=[.!?])\s+(?=[A-Z"'(@$0-9])/).map(s => s.trim()).filter(Boolean);
const base = p => (p || '').split('/').pop();
const prio = it => it.priority || 3;
const money = n => '$' + Math.round(n).toLocaleString();
// Corner toasts: small, bottom-right, info fades; warn stays until dismissed. Only for facts the scene doesn't show.
// Dismissing gives focus back to where it was (the phone pad keeps its text and Enter still sends).
function toast(msg, cls) {
  const t = h('div', { class: `toast ${cls || ''}`, role: cls === 'warn' ? 'alert' : null }, h('span', null, msg));
  const back = document.activeElement;
  const dismiss = () => { t.remove(); (back?.isConnected && back !== document.body ? back : document.querySelector('#phone .phone-pad'))?.focus(); };
  if (cls === 'warn') t.append(h('button', { class: 'toast-x', type: 'button', 'aria-label': 'Dismiss', onclick: dismiss }, '×'));
  else setTimeout(() => t.remove(), 2800);
  $('#toasts').append(t);
}
// Cash pop: a small "+50" floating off the cash chip; pops inside a short window merge into one running total.
let cashPop = null;
function popCash(n) {
  const chip = $('#cash'); if (!chip || !n) return;
  if (cashPop && now() * 1000 - cashPop.at < 900) { cashPop.sum += n; cashPop.at = now() * 1000; cashPop.el.textContent = `+${money(cashPop.sum)}`; cashPop.el.style.animation = 'none'; void cashPop.el.offsetWidth; cashPop.el.style.animation = ''; clearTimeout(cashPop.t); cashPop.t = setTimeout(() => { cashPop?.el.remove(); cashPop = null; }, 1300); return; }
  const rc = chip.getBoundingClientRect(); const el = h('div', { class: 'cash-pop', 'aria-hidden': 'true', style: `left:${Math.round(rc.left + rc.width / 2)}px;top:${Math.round(rc.bottom + 2)}px` }, `+${money(n)}`);
  document.body.append(el);
  cashPop = { el, sum: n, at: now() * 1000, t: setTimeout(() => { el.remove(); cashPop = null; }, 1300) };
}

// lit: optional Set of trimmed source lines that are new since the captain last looked (changes.js); they get class chg.
function mdToHtml(md, lit) {
  const raw = String(md).split('\n'), lines = esc(md).split('\n'); let out = '', list = null, table = null, code = null, codeLit = false, i = -1;
  const c = cls => { const on = lit && lit.has(raw[i].trim()); return on || cls ? ` class="${[cls, on && 'chg'].filter(Boolean).join(' ')}"` : ''; };
  const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const close = () => { if (list) { out += `</${list}>`; list = null; } if (table) { out += '</tbody></table>'; table = null; } };
  for (const ln of lines) {
    let m; i++;
    if (code != null) { if (ln.startsWith('```')) { out += `<pre${codeLit ? ' class="chg"' : ''}><code>${code}</code></pre>`; code = null; } else { code += ln + '\n'; codeLit ||= !!(lit && lit.has(raw[i].trim())); } continue; }
    if (ln.startsWith('```')) { close(); code = ''; codeLit = false; continue; }
    if (ln.startsWith('|')) {
      const cells = ln.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (ln.match(/^\|[-:| ]+\|$/)) continue;
      if (!table) { close(); table = true; out += `<table><thead><tr>${cells.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`; }
      else out += `<tr${c()}>${cells.map(x => `<td>${inline(x)}</td>`).join('')}</tr>`;
      continue;
    }
    if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { close(); out += `<h${m[1].length + 1}${c('mdh')} data-heading="${esc(m[2])}">${inline(m[2])}</h${m[1].length + 1}>`; }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); list = 'ul'; out += '<ul>'; } out += `<li${c()}>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); list = 'ol'; out += '<ol>'; } out += `<li${c()}>${inline(m[1])}</li>`; }
    else if (ln.trim() === '') close();
    else if (ln.startsWith('>')) { close(); out += `<blockquote${c()}>${inline(ln.slice(1))}</blockquote>`; }
    else { if (table) close(); out += `<p${c()}>${inline(ln)}</p>`; }
  }
  close(); return out;
}
