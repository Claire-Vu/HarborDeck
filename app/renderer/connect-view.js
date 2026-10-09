/* Harbor Deck renderer: "Connect an agent" (first run, File > Connect an Agent, Settings) and the command line tool.
   Every change is listed before it runs; nothing runs until the user presses the button under that list.
   The work happens in the main process (app/lib/connect.js, app/lib/cli-link.js). Loaded before app.js, which creates
   it last: on first run (an empty desk, setup never finished) it opens instead of the morning, then calls `then`. */
'use strict';
window.HarborConnect = ({ h, modal, toast, bridge, firstRun, then }) => {
  const CONTRACT = 'https://github.com/Claire-Vu/HarborDeck/blob/main/docs/CONTRACT.md';
  let info = null, root = null, choice = 'claude', fmHome = '', service = true, output = null, onClose = null;

  // Status light: when an agent last wrote to the data directory.
  function light(agent, t = Date.now() / 1000) {
    if (!agent) return { cls: 'none', text: 'No agent has written to this desk yet.' };
    const d = Math.max(0, t - agent.at), ago = d < 90 ? 'just now' : d < 3600 ? `${Math.round(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
    return { cls: d < 600 ? 'live' : d < 86400 ? 'recent' : 'idle', text: `Last agent write ${ago} (${agent.what}).` };
  }
  const statusRow = () => { const l = light(info.agent); return h('div', { class: `cn-status ${l.cls}`, role: 'status' }, h('span', { class: 'cn-light', 'aria-hidden': 'true' }), h('span', null, l.text, ' ', h('span', { class: 'dim' }, 'Data directory ', h('code', null, info.home)))); };
  const copyBtn = text => h('button', { class: 'tbtn', type: 'button', onclick: () => navigator.clipboard?.writeText(text).then(() => toast('Copied')) }, 'Copy');
  const block = text => h('div', { class: 'cn-code' }, h('pre', null, text), copyBtn(text));
  const tilde = p => info.userHome && (p === info.userHome || p.startsWith(info.userHome + '/')) ? '~' + p.slice(info.userHome.length) : p;
  const showOut = (r, extra) => { output = { ok: r.ok, text: r.out || r.error || '', extra }; render(); };

  async function load() { info = await bridge.connect.info(fmHome); service = service && info.firstmate.argv.indexOf('--no-service') < 0; }

  function cliSection(focus) {
    const c = info.cli, dir = tilde(c.binDir);
    const act = async (fn, okMsg) => { const r = await fn(); if (r.ok) { toast(okMsg); await load(); output = null; render(); } else showOut(r, r.conflict ? 'replace' : null); };
    const install = (opts = {}) => act(() => bridge.connect.installCli(opts), `hd and harbordeck linked in ${opts.binDir ? tilde(opts.binDir) : dir}`);
    const choose = async () => { const d = await bridge.chooseDir('Folder for hd and harbordeck'); if (d) install({ binDir: d }); };
    const body = c.installed
      ? [h('p', null, '✓ ', h('code', null, 'hd'), ' and ', h('code', null, 'harbordeck'), ' are linked in ', h('code', null, dir), '.'),
        c.onPath ? null : h('p', { class: 'flag-note' }, `${dir} is not on your PATH. Add it: `, h('code', null, `echo 'export PATH="${dir.replace(/^~/, '$HOME')}:$PATH"' >> ~/.zshrc`)),
        h('div', { class: 'cn-act' }, h('button', { class: 'tbtn', type: 'button', onclick: () => act(() => bridge.connect.uninstallCli(), 'Command line tool removed') }, 'Uninstall'))]
      : [h('p', null, 'Agents put items on the desk with the ', h('code', null, 'hd'), ' command. This will link ', h('code', null, 'hd'), ' and ', h('code', null, 'harbordeck'), ' in ', h('code', null, dir), ' to ', h('code', null, tilde(c.target)), '.'),
        ...c.links.filter(l => l.state !== 'missing').map(l => h('p', { class: 'flag-note' }, l.state === 'file' ? `${tilde(l.path)} exists and is not a link: remove it first.` : `${tilde(l.path)} already links to ${tilde(l.to)} (another install). Replace it to use this app's.`)),
        h('div', { class: 'cn-act' }, h('button', { class: 'pbtn', type: 'button', id: 'cn-cli-install', onclick: () => install() }, 'Install'), h('button', { class: 'tbtn', type: 'button', onclick: choose }, 'Choose another folder…'),
          output?.extra === 'replace' ? h('button', { class: 'tbtn', type: 'button', onclick: () => install({ replace: true }) }, 'Replace') : null)];
    return h('section', { class: `cn-sec${focus ? ' focus' : ''}`, id: 'cn-cli' }, h('h3', null, 'Command line tool'), ...body);
  }

  const panels = {
    claude() {
      const c = info.claude;
      return [h('p', null, 'Adds Harbor Deck\'s MCP server to Claude Code, so every session gets the desk tools: write items, read your answers.'),
        h('p', { class: 'cn-will' }, 'This will:'),
        h('ul', null, info.cli.installed ? null : h('li', null, 'link ', h('code', null, 'hd'), ' and ', h('code', null, 'harbordeck'), ' in ', h('code', null, tilde(info.cli.binDir))),
          h('li', null, 'run ', h('code', null, c.command), ' (adds a harbordeck entry to your Claude Code user config, ', h('code', null, '~/.claude.json'), ')')),
        c.claudeBin ? null : h('p', { class: 'flag-note' }, 'The claude command was not found on your PATH. Install Claude Code, or run the command above yourself.'),
        h('div', { class: 'cn-act' }, h('button', { class: 'pbtn', type: 'button', id: 'cn-run', disabled: !c.claudeBin, onclick: async () => showOut(await bridge.connect.claude()) }, 'Connect Claude Code')),
        h('details', null, h('summary', null, 'Optional: tell it when to use the desk (paste into CLAUDE.md)'), block(info.snippet))];
    },
    firstmate() {
      const f = info.firstmate;
      const inp = h('input', { type: 'text', value: fmHome, placeholder: '~/firstmate', spellcheck: false, id: 'cn-fm-home', onchange: async () => { fmHome = inp.value.trim(); await load(); render(); } });
      const svc = h('input', { type: 'checkbox', checked: service, onchange: () => { service = svc.checked; } });
      return [h('p', null, 'Connects a firstmate home: the bridge routes your stamps back to firstmate, and feeders keep the fleet and quota on the desk.'),
        h('label', { class: 'set-row' }, h('span', { class: 'set-l' }, 'firstmate home'), h('span', { class: 'set-in' }, inp, h('button', { class: 'tbtn', type: 'button', onclick: async () => { const d = await bridge.chooseDir('firstmate home'); if (d) { fmHome = d; await load(); render(); } } }, 'Choose…'))),
        h('label', { class: 'set-check' }, svc, ' Run the bridge as a background service (launchd agent dev.harbordeck.firstmate)'),
        h('p', { class: 'cn-will' }, 'This will run ', h('code', null, 'adapters/firstmate/install.sh'), ', which:'),
        h('ul', null, h('li', null, 'links ', h('code', null, 'hd'), ' and ', h('code', null, 'harbordeck'), ' in ', h('code', null, '~/.local/bin')),
          h('li', null, 'points this app at ', h('code', null, info.home), ' with the firstmate home as the Artifact root'),
          h('li', null, 'starts the bridge and feeders (a launchd agent when the box above is ticked)'),
          h('li', null, 'writes ', h('code', null, 'data/harbordeck.md'), ' and one standing order in ', h('code', null, 'data/captain.md'), ' in the firstmate home')),
        h('div', { class: 'cn-code' }, h('pre', null, f.command)),
        f.available ? null : h('p', { class: 'flag-note' }, 'adapters/firstmate is missing from this build.'),
        h('div', { class: 'cn-act' }, h('button', { class: 'pbtn', type: 'button', id: 'cn-run', disabled: !fmHome || !f.available, onclick: () => runFirstmate() }, 'Connect firstmate'),
          output?.extra === 'pending' ? [h('button', { class: 'tbtn', type: 'button', onclick: () => runFirstmate('deliver') }, 'Deliver them'), h('button', { class: 'tbtn', type: 'button', onclick: () => runFirstmate('skip') }, 'Skip them')] : null)];
    },
    other() {
      return [h('p', null, 'Any agent with a shell: install the command line tool above, then paste this into its instructions file (AGENTS.md, CLAUDE.md, …):'), block(info.snippet),
        h('p', null, 'Agents that take MCP servers (stdio):'), block(info.mcpJson),
        h('p', null, 'Agents that only write files: the item format is in ', h('a', { href: '#', onclick: e => { e.preventDefault(); bridge.openExternal(CONTRACT); } }, 'docs/CONTRACT.md'), '.')];
    }
  };
  async function runFirstmate(pending) {
    const r = await bridge.connect.firstmate({ fmHome, service, pending });
    showOut(r, r.pending ? 'pending' : null);
  }

  function render() {
    if (!root || !root.isConnected) return;
    const tabs = h('div', { class: 'cn-tabs', role: 'radiogroup', 'aria-label': 'Agent' }, ...[['claude', 'Claude Code'], ['firstmate', 'firstmate'], ['other', 'Other agent']].map(([k, label]) =>
      h('button', { class: `tbtn${choice === k ? ' on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(choice === k), onclick: () => { choice = k; output = null; render(); } }, label)));
    const out = output && output.extra !== 'replace' ? h('pre', { class: `cn-out ${output.ok ? 'ok' : 'bad'}`, id: 'cn-out' }, output.text || (output.ok ? 'Done.' : 'Failed.')) : null;
    const cliErr = output && output.extra === 'replace' ? h('pre', { class: 'cn-out bad' }, output.text) : null;
    root.replaceChildren(...[statusRow(), cliSection(root.dataset.focus === 'cli'), cliErr, h('section', { class: 'cn-sec' }, h('h3', null, 'Connect an agent'), tabs, h('div', { class: 'cn-panel' }, ...panels[choice]()), out)].filter(Boolean));
  }

  async function open({ firstRun = false, focus = '', then = null } = {}) {
    output = null; onClose = then; await load();
    root = h('div', { class: 'connect', dataset: { focus } });
    const finish = async () => { if (!info.onboarded) await bridge.connect.done(); const cb = onClose; onClose = null; document.querySelector('#modal-root').replaceChildren(); cb?.(); };
    modal('connect-modal', firstRun ? 'Welcome to Harbor Deck: connect an agent' : 'Connect an agent', root,
      firstRun ? [h('button', { class: 'pbtn ghost', onclick: finish }, 'Skip for now'), h('button', { class: 'pbtn', onclick: finish }, 'Done')] : [h('button', { class: 'pbtn', onclick: finish }, 'Done')]);
    render();
    if (focus === 'cli') root.querySelector('#cn-cli')?.scrollIntoView({ block: 'nearest' });
  }
  // A new snapshot: refresh the status light while the panel is up.
  function refresh(snap) {
    if (!root || !root.isConnected || !info) return;
    info.agent = snap.agent; info.home = snap.home;
    root.querySelector('.cn-status')?.replaceWith(statusRow());
  }
  bridge.onUpdate(refresh);
  bridge.onMenu(what => { if (what === 'connect') open(); else if (what === 'cli') open({ focus: 'cli' }); });
  // Settings > Agent connection > Agents
  const settingsButtons = () => [h('button', { class: 'set-btn', type: 'button', onclick: () => open() }, 'Connect an agent…'), h('button', { class: 'set-btn', type: 'button', onclick: () => open({ focus: 'cli' }) }, 'Command line tool…')];
  if (firstRun) open({ firstRun: true, then }); else then();
  return { open, refresh, light, settingsButtons };
};
