'use strict';
// A CDP pass-through that lets the evidence runner's --attach mode drive the running Electron window.
// Electron answers Target.createTarget with "Not supported", so the shim keeps the app window hidden from the
// client until the client asks for a new window, then hands it that window (re-attached) instead.
// Usage: node cdp-shim.js <electron CDP http url> <listen port>
const http = require('http');
const { ws: WebSocket, wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle');

const [upstream, port] = [process.argv[2].replace(/\/$/, ''), Number(process.argv[3])];

async function json(p) { return (await fetch(upstream + p)).json(); }

const server = http.createServer(async (req, res) => {
  try {
    const info = await json(req.url.replace(/\/$/, ''));
    const fix = o => ({ ...o, webSocketDebuggerUrl: o.webSocketDebuggerUrl && o.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`) });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Array.isArray(info) ? info.map(fix) : fix(info)));
  } catch (e) { res.statusCode = 502; res.end(String(e)); }
});

const wss = new WebSocketServer({ server });
wss.on('connection', async (client, req) => {
  const pages = (await json('/json/list')).filter(t => t.type === 'page');
  const hidden = pages.length ? pages[0].id : null; // the app window, handed out on Target.createTarget
  let revealed = false;
  const up = new WebSocket(upstream.replace(/^http/, 'ws') + req.url);
  const queue = [];
  const send = m => (up.readyState === 1 ? up.send(m) : queue.push(m));
  up.on('open', () => queue.splice(0).forEach(m => up.send(m)));
  const OWN = 1e9; // ids the shim uses for its own calls; their replies are swallowed

  const hides = msg => {
    if (revealed || !hidden) return false;
    const t = msg.params && (msg.params.targetInfo || msg.params);
    return /^Target\.(attachedToTarget|targetCreated|targetInfoChanged)$/.test(msg.method || '') && t && t.targetId === hidden;
  };
  up.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.id >= OWN) return;
    if (hides(msg)) return;
    if (msg.result && Array.isArray(msg.result.targetInfos) && !revealed) msg.result.targetInfos = msg.result.targetInfos.filter(t => t.targetId !== hidden);
    client.send(JSON.stringify(msg));
  });
  client.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Target.createTarget' && hidden && !revealed) {
      revealed = true;
      client.send(JSON.stringify({ id: msg.id, sessionId: msg.sessionId, result: { targetId: hidden } }));
      send(JSON.stringify({ id: OWN, method: 'Target.attachToTarget', params: { targetId: hidden, flatten: true } }));
      return;
    }
    send(data.toString());
  });
  const end = () => { client.close(); up.close(); };
  client.on('close', end); up.on('close', end); up.on('error', end);
});

server.listen(port, '127.0.0.1', () => console.log(`cdp-shim on http://127.0.0.1:${port} -> ${upstream}`));
