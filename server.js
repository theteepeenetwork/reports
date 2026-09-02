#!/usr/bin/env node
/* =====================================================================
   server.js — static file server for the deployed app.
   Owner: Shell (docs/OWNERSHIP.md)

   Classroom Hub is a static site; this exists only because Railway needs
   a process to run. Deliberately zero-dependency: nothing to install,
   nothing to keep patched, and the build is a no-op.

   Notes that matter:
   - firebase-config.js IS served, on purpose. A Firebase *web* config is
     public by design; the data is protected by the database rules. See
     the note at the top of that file and SETUP.md.
   - node_modules, tests and CI config are not served. They are not
     secret, but there is no reason to publish them.
   - HTML is sent no-cache so a deploy is visible on the next reload.
     Everything else is cached hard, which is safe because the app
     cache-busts its own assets with ?v= query strings.
   ===================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

/* Not served. Prefix match on the URL path. */
const HIDDEN = ['/node_modules', '/tests', '/.git', '/.github', '/test-results', '/playwright-report'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }, headers || {}));
  res.end(body);
}

const server = http.createServer(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (pathname === '/healthz') {
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';

  const lower = pathname.toLowerCase();
  if (HIDDEN.some(function (p) { return lower === p || lower.startsWith(p + '/'); })) {
    return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // Resolve, then confirm the result is still inside ROOT. This is what
  // stops ../ and encoded traversal, not any check on the raw string.
  const filePath = path.resolve(ROOT, '.' + pathname);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const isHTML = ext === '.html';
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Last-Modified': stat.mtime.toUTCString(),
      // HTML must revalidate or a deploy stays invisible. Everything else
      // is versioned with ?v= by the app itself, so cache it hard.
      'Cache-Control': isHTML ? 'no-cache' : 'public, max-age=31536000'
    };
    if (req.method === 'HEAD') return send(res, 200, '', headers);
    res.writeHead(200, Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers));
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('Classroom Hub listening on ' + PORT);
});
