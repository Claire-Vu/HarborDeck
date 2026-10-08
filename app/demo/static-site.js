'use strict';
// Demo mode's local web page: serves <demo dir>/assets/web on 127.0.0.1 (random port) so the demo can show
// the in-desk browser pane without anything leaving the machine. GET only, no directory listing.
const fs = require('fs');
const http = require('http');
const path = require('path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

function startStaticSite(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split(/[?#]/)[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, rel);
    if (req.method !== 'GET' || !file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }));
  });
}

module.exports = { startStaticSite };
