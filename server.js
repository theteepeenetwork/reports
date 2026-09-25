#!/usr/bin/env node
/* =====================================================================
   server.js — static file server for the deployed app.
   Owner: Shell (docs/OWNERSHIP.md)

   Classroom Hub is a static site; this exists mainly because Railway
   needs a process to run. The one piece of server logic is optional:
   POST /api/dictate, the Markbook's "smart mode" for dictated marking,
   which asks Claude to read a teacher's spoken notes. It is OFF unless
   ANTHROPIC_API_KEY is set, and the file server works without the
   @anthropic-ai/sdk package installed at all.

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

/* =====================================================================
   /api/dictate — smart mode for Markbook › Marking › Dictate
   GET  → { enabled } so the page knows whether to offer the toggle.
   POST → { plan } read from the teacher's words by Claude.

   This sends pupil first names, the class list and the teacher's notes to
   Anthropic. That is a data-protection decision for the school (see
   PRIVACY.md), which is why it is off until someone sets the key, and why
   the page leaves it switched off until the teacher turns it on.

   Guards, because the endpoint spends money on every call and the site is
   public: same-origin browsers only, a 64 KB body cap, and a per-address
   rate limit. It does not check who is signed in — anyone who can load the
   site can call it. Add a Firebase ID-token check before relying on it
   beyond a single school.
   ===================================================================== */
const DICTATE_MODEL = process.env.DICTATE_MODEL || 'claude-opus-5';
const DICTATE_LIMIT = Number(process.env.DICTATE_RATE_PER_HOUR) || 60;
const dictateHits = new Map();
let anthropic = null;
function dictateClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (anthropic) return anthropic;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new (Anthropic.default || Anthropic)();
  } catch (e) {
    console.warn('dictate: ANTHROPIC_API_KEY is set but @anthropic-ai/sdk is not installed');
    anthropic = null;
  }
  return anthropic;
}
function rateLimited(ip) {
  const now = Date.now(), hour = 3600e3;
  const hits = (dictateHits.get(ip) || []).filter(function (t) { return now - t < hour; });
  hits.push(now);
  dictateHits.set(ip, hits);
  if (dictateHits.size > 5000) dictateHits.clear();
  return hits.length > DICTATE_LIMIT;
}

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['activity', 'entries', 'warnings'],
  properties: {
    activity: {
      type: 'object', additionalProperties: false,
      required: ['mode', 'existingId', 'setId', 'newSetName', 'title', 'workDate'],
      properties: {
        mode: { type: 'string', enum: ['new', 'existing', 'none'] },
        existingId: { type: 'string' },
        setId: { type: 'string' },
        newSetName: { type: 'string' },
        title: { type: 'string' },
        workDate: { type: 'string' }
      }
    },
    entries: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['pupilId', 'heard', 'met', 'markers', 'comment'],
        properties: {
          pupilId: { type: 'string' },
          heard: { type: 'string' },
          met: { type: 'string', enum: ['met', 'not', 'none'] },
          markers: { type: 'array', items: { type: 'string' } },
          comment: { type: 'string' }
        }
      }
    },
    warnings: { type: 'array', items: { type: 'string' } }
  }
};
const DICTATE_SYSTEM = [
  'You turn a UK primary teacher\'s dictated book-marking notes into structured marking records.',
  'The notes came through speech recognition: expect missing punctuation, misheard names ("Zoe" for "Zoey") and filler words.',
  '',
  'Activity: if the teacher asks to create/start a new activity, set mode "new" with the set of books (setId from the sets list; if the subject is not in the list leave setId "" and put the subject in newSetName), a short title in Title case, and workDate as YYYY-MM-DD. Dates are UK day/month; with no year use the year that puts the date on or before today (a date more than two weeks ahead of today means last year). No date said means today.',
  'If they name an existing activity, use mode "existing" and its id. Otherwise mode "none" (the app uses the activity the teacher has open). Unused string fields are "".',
  '',
  'Entries: one per pupil whose book was described, in the order spoken. Match each to a pupil id from the class list, allowing for mishearing; if you cannot tell who it is, use pupilId "" and put what was heard in "heard". Never invent a pupil or merge two.',
  'met: "met" if the objective was met/achieved/exceeded, "not" if not met/working towards, "none" if not said.',
  'markers: short labels for awards or flags such as a gold star or accessing the challenge. Reuse the teacher\'s own marker labels from the list exactly when they fit; otherwise use a short label like "Gold star" or "Challenge".',
  'comment: the teacher\'s written note for that book, in their words: tidy grammar, punctuation and capitals, drop the pupil\'s name at the start and anything already captured as met/not met or a marker, but keep every observation. Empty string if there is nothing else.',
  'warnings: short notes about anything you were unsure of. Words like "next pupil", "save books" or "scratch that" are commands, not notes.'
].join('\n');

function readBody(req, max) {
  return new Promise(function (resolve, reject) {
    let size = 0; const chunks = [];
    req.on('data', function (c) { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}
function sendJSON(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}
async function handleDictate(req, res) {
  const client = dictateClient();
  if (req.method === 'GET') return sendJSON(res, 200, { enabled: !!client });
  if (req.method !== 'POST') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, POST' });
  if (!client) return sendJSON(res, 503, { error: 'Smart mode is not configured on this server.' });

  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) {}
    if (host !== req.headers.host) return sendJSON(res, 403, { error: 'Cross-origin request refused.' });
  }
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return sendJSON(res, 429, { error: 'Too many requests — try again later.' });

  let body;
  try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch (e) { return sendJSON(res, 400, { error: 'Bad request body.' }); }
  const text = String(body.text || '').slice(0, 20000);
  if (!text.trim()) return sendJSON(res, 400, { error: 'Nothing to read.' });
  const list = function (a, n) { return Array.isArray(a) ? a.slice(0, n) : []; };
  const context = {
    today: String(body.today || ''),
    class_list: list(body.pupils, 80).map(function (p) { return { id: String(p.id), name: String(p.name) }; }),
    sets_of_books: list(body.sets, 40).map(function (s) { return { id: String(s.id), name: String(s.name) }; }),
    existing_activities: list(body.activities, 40).map(function (a) { return { id: String(a.id), setId: String(a.setId), title: String(a.title), workDate: String(a.workDate) }; }),
    teacher_marker_labels: list(body.markers, 40).map(String),
    open_activity_id: String(body.activeActivityId || '')
  };

  try {
    const response = await client.beta.messages.create({
      model: DICTATE_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      system: DICTATE_SYSTEM,
      messages: [{
        role: 'user',
        content: '<context>\n' + JSON.stringify(context) + '\n</context>\n\n<dictation>\n' + text + '\n</dictation>'
      }]
    });
    if (response.stop_reason === 'refusal') return sendJSON(res, 502, { error: 'Claude declined to read this note.' });
    if (response.stop_reason === 'max_tokens') return sendJSON(res, 502, { error: 'The note was too long to read in one go.' });
    const block = response.content.find(function (b) { return b.type === 'text'; });
    if (!block) return sendJSON(res, 502, { error: 'No answer from Claude.' });
    return sendJSON(res, 200, { plan: JSON.parse(block.text) });
  } catch (err) {
    const Anthropic = require('@anthropic-ai/sdk');
    const A = Anthropic.default || Anthropic;
    if (err instanceof A.RateLimitError) return sendJSON(res, 429, { error: 'Claude is busy — try again shortly.' });
    if (err instanceof A.AuthenticationError) { console.error('dictate: bad ANTHROPIC_API_KEY'); return sendJSON(res, 503, { error: 'Smart mode is misconfigured.' }); }
    if (err instanceof A.APIError) { console.error('dictate: API error', err.status, err.message); return sendJSON(res, 502, { error: 'Claude could not read the note.' }); }
    if (err instanceof SyntaxError) return sendJSON(res, 502, { error: 'Claude\'s answer could not be read.' });
    console.error('dictate:', err && err.message);
    return sendJSON(res, 502, { error: 'Smart mode failed.' });
  }
}

const server = http.createServer(function (req, res) {
  if (req.url === '/api/dictate' || req.url.indexOf('/api/dictate?') === 0) {
    handleDictate(req, res).catch(function () { try { sendJSON(res, 500, { error: 'Server error.' }); } catch (e) {} });
    return;
  }
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
