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
const https = require('https');
const crypto = require('crypto');
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
   public:
     - a signed-in teacher only: every POST carries the Firebase ID token
       the page already holds, verified here against Google's published
       signing keys (see verifyIdToken below);
     - DICTATE_ALLOWED_EMAILS narrows that further. Anyone can register an
       account on the sign-in screen, so a sign-in check alone keeps out
       strangers who never bothered, not strangers who did. Set it to the
       school's addresses: "a@school.org, b@school.org" or "@school.org";
     - same-origin browsers only, a 256 KB body cap, and a per-teacher
       hourly limit.
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
/* ---------- Firebase ID tokens, verified without firebase-admin ----------
   A Firebase ID token is an RS256 JWT. Google publishes the certificates it
   signs them with; the checks below are the ones Firebase documents for
   verifying a token with a third-party JWT library:
   https://firebase.google.com/docs/auth/admin/verify-id-tokens */
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { keys: null, until: 0, pending: null };

/* The project id lives in firebase-config.js, the file the page itself
   loads, so the server can never disagree with the browser about which
   project signs its teachers in. FIREBASE_PROJECT_ID overrides it. */
function firebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const src = fs.readFileSync(path.join(ROOT, 'firebase-config.js'), 'utf8');
    const m = src.match(/projectId\s*:\s*["']([^"']+)["']/);
    return m && m[1].indexOf('PASTE_') !== 0 ? m[1] : '';
  } catch (e) { return ''; }
}
const PROJECT_ID = firebaseProjectId();

function allowedEmail(email) {
  const list = String(process.env.DICTATE_ALLOWED_EMAILS || '').split(',')
    .map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  if (!list.length) return true;
  email = String(email || '').toLowerCase();
  if (!email) return false;
  return list.some(function (a) { return a.charAt(0) === '@' ? email.endsWith(a) : email === a; });
}

function googleCerts() {
  if (certCache.keys && Date.now() < certCache.until) return Promise.resolve(certCache.keys);
  if (certCache.pending) return certCache.pending;
  certCache.pending = new Promise(function (resolve, reject) {
    https.get(CERTS_URL, { timeout: 5000 }, function (r) {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', function (c) { body += c; });
      r.on('end', function () {
        try {
          if (r.statusCode !== 200) throw new Error('HTTP ' + r.statusCode);
          const keys = JSON.parse(body);
          const age = /max-age=(\d+)/.exec(r.headers['cache-control'] || '');
          certCache.keys = keys;
          certCache.until = Date.now() + (age ? Number(age[1]) : 3600) * 1000;
          resolve(keys);
        } catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  }).finally(function () { certCache.pending = null; });
  return certCache.pending;
}

function b64urlJSON(part) { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); }

/* → the token's claims, or throws. `certs` is injectable for tests. */
async function verifyIdToken(token, projectId, certs) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = b64urlJSON(parts[0]), claims = b64urlJSON(parts[1]);
  if (header.alg !== 'RS256') throw new Error('wrong algorithm');
  const keys = certs || await googleCerts();
  const pem = keys[header.kid];
  if (!pem) throw new Error('unknown signing key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
    crypto.createPublicKey(pem), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad signature');
  const now = Math.floor(Date.now() / 1000), skew = 300;
  if (claims.aud !== projectId) throw new Error('wrong audience');
  if (claims.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('wrong issuer');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw new Error('no subject');
  if (!(claims.exp > now - skew)) throw new Error('expired');
  if (!(claims.iat <= now + skew)) throw new Error('issued in the future');
  if (!(claims.auth_time <= now + skew)) throw new Error('authenticated in the future');
  return claims;
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
  required: ['activity', 'entries', 'corrections', 'warnings'],
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
        required: ['pupilId', 'heard', 'nameGuessed', 'met', 'markers', 'comment'],
        properties: {
          pupilId: { type: 'string' },
          heard: { type: 'string' },
          nameGuessed: { type: 'boolean' },
          met: { type: 'string', enum: ['met', 'not', 'none'] },
          markers: { type: 'array', items: { type: 'string' } },
          comment: { type: 'string' }
        }
      }
    },
    corrections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['heard', 'meant'],
        properties: { heard: { type: 'string' }, meant: { type: 'string' } }
      }
    },
    warnings: { type: 'array', items: { type: 'string' } }
  }
};
const DICTATE_SYSTEM = [
  'You fill in a UK primary teacher\'s marking records from notes they dictated while marking a set of exercise books.',
  '',
  'The notes came through a browser\'s speech recognition, which mishears a lot. Your first job is to work out what the teacher actually said.',
  '- Punctuation is missing or wrong; pauses may appear as full stops.',
  '- Names are often misheard or split: "Zoe" or "so we" for Zoey, "aurora" lower-case, "Ben cross" for Ben Cross, "Fin" for Finn. The class list is the only set of possible names: match every name to it by sound, not spelling.',
  '- Other words are misheard as similar-sounding ones: "tennis numeral" for "tens as a numeral", "partition in" for "partitioning", "met" as "mat" or "mess", "not met" as "not mad", "gold star" as "goal star", "challenge" as "chalets". Choose the reading that makes sense for marking primary-school work in this subject.',
  '- Where the transcript includes <alternatives> for a phrase, they are the recogniser\'s other guesses at the same words. Use them as evidence: the right reading is often in the alternatives, not the top guess.',
  '- The teacher may correct themselves ("scratch that", "sorry, I meant", "no, not met"). Apply the correction and drop what it replaced. "Next pupil", "next", "finished marking" and similar are just the teacher moving on.',
  '',
  'Activity: if the teacher starts a new activity ("create new maths activity called partitioning on 25/9"), set mode "new" with the set of books (setId from the sets list; if the subject is not in the list leave setId "" and put the subject in newSetName), a short title in Title case, and workDate as YYYY-MM-DD. Dates are UK day/month; with no year use the year that puts the date on or before today (a date more than two weeks ahead of today means last year). No date said means today. If they name an existing activity, use mode "existing" and its id. Otherwise mode "none" (the app uses the activity the teacher has open). Unused string fields are "".',
  '',
  'Entries: one per child whose book was described, in the order spoken. pupilId from the class list. "heard" is the name as the transcript had it. nameGuessed is true when the transcript did not plainly say that child\'s name and you matched it by sound or context. If you cannot choose between children, or the name matches no one, use pupilId "" rather than guess. Never invent a child, and never put two books under one child.',
  'met: "met" if the objective was met/achieved/exceeded, "not" if not met/working towards, "none" if not said.',
  'markers: short labels for awards or flags such as a gold star or accessing the challenge. Reuse the teacher\'s own marker labels from the list exactly when they fit; otherwise a short label like "Gold star" or "Challenge".',
  'comment: the teacher\'s note for that book, as the teacher meant it: corrected words, tidy grammar, punctuation and capitals, no child\'s name at the start, and nothing already captured as met/not met or a marker, but keep every observation. Do not add anything the teacher did not say. Empty string if there is nothing else.',
  '',
  'corrections: every place where you read a misheard word or name as something else, as {heard, meant} (e.g. {"heard": "tennis numeral", "meant": "tens as a numeral"}, {"heard": "so we", "meant": "Zoey Jones"}). The teacher checks these, so include every one and nothing else.',
  'warnings: short notes about anything you could not work out, such as a book whose child you could not identify.'
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
  const enabled = !!client && !!PROJECT_ID;
  if (req.method === 'GET') return sendJSON(res, 200, { enabled: enabled, signIn: true });
  if (req.method !== 'POST') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, POST' });
  if (!enabled) return sendJSON(res, 503, { error: 'Smart mode is not configured on this server.' });

  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) {}
    if (host !== req.headers.host) return sendJSON(res, 403, { error: 'Cross-origin request refused.' });
  }
  const auth = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!auth) return sendJSON(res, 401, { error: 'Sign in to use smart mode.' });
  let claims;
  try { claims = await verifyIdToken(auth[1], PROJECT_ID); }
  catch (e) {
    if (/HTTP|timeout|ENOTFOUND|ECONN/.test(e.message)) { console.error('dictate: could not fetch Google signing keys:', e.message); return sendJSON(res, 503, { error: 'Could not check your sign-in — try again shortly.' }); }
    return sendJSON(res, 401, { error: 'Your sign-in has expired — sign in again to use smart mode.' });
  }
  if (!allowedEmail(claims.email)) return sendJSON(res, 403, { error: 'This account is not allowed to use smart mode.' });
  if (rateLimited(claims.sub)) return sendJSON(res, 429, { error: 'Too many requests — try again later.' });

  let body;
  try { body = JSON.parse(await readBody(req, 256 * 1024)); } catch (e) { return sendJSON(res, 400, { error: 'Bad request body.' }); }
  const text = String(body.text || '').slice(0, 20000);
  /* the recogniser's other guesses for each phrase, when the page has them */
  const segs = Array.isArray(body.segments) ? body.segments.slice(0, 400) : [];
  const alternatives = segs.map(function (sg) {
    const alts = Array.isArray(sg && sg.alts) ? sg.alts.slice(0, 5).map(function (a) { return String(a).slice(0, 400); }) : [];
    return alts.length > 1 ? '<phrase>\n' + alts.map(function (a, i) { return (i ? 'or: ' : '') + a; }).join('\n') + '\n</phrase>' : '';
  }).filter(Boolean).join('\n').slice(0, 30000);
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
        content: '<context>\n' + JSON.stringify(context) + '\n</context>\n\n<dictation>\n' + text + '\n</dictation>' +
          (alternatives ? '\n\n<alternatives>\nThe recogniser\'s other guesses, phrase by phrase, top guess first:\n' + alternatives + '\n</alternatives>' : '')
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

/* =====================================================================
   /api/focus/<room>/<command> — the relay behind Focus Remote (focus.html)

   The teacher's Apple Watch runs a Shortcut that fetches a URL here; the
   iPad showing focus.html is listening on /events and reacts (sound, timer,
   class points); a slide-clicker helper on the classroom computer listens
   on the same stream and presses Page Down / Page Up.

     GET|POST …/<room>/toggle|start|stop       off-task timer
     GET|POST …/<room>/plus|minus[?n=3]        class points
     GET|POST …/<room>/next|prev               slides
     GET|POST …/<room>/countdown?m=5 (or ?s=30) a countdown, up to 90 min
     GET|POST …/<room>/cancel                  stop the countdown
     GET|POST …/<room>/state                   no change; a status line
     GET|POST …/<room>/set?points=N[&ifEmpty=1] the iPad seeding its count
     GET      …/<room>/events[?role=screen|clicker|remote]   SSE stream
     GET      …/<room>/wait?seq=N&id=…&role=…   long-poll: JSON state as soon
                                                as seq ≠ N, or after 20 s

   Two ways to listen because school networks differ. Some web filters cut
   or buffer a long-lived stream, so a screen whose stream goes quiet falls
   back to long-polling, which looks like ordinary short requests. Every
   20 s the stream also repeats the state as a heartbeat (same seq, so no
   listener treats it as a new press), which is how a screen notices a
   stream that has silently died.

   Replies are one short line of plain text, because that is what a Shortcut
   shows on the watch. The room key (16–64 url-safe characters, made by the
   iPad) is the only credential: there is no pupil data here, only a timer and
   a number. State lives in memory, so a redeploy forgets it — the iPad keeps
   the points in its own storage and puts them back (`set … ifEmpty`).
   ===================================================================== */
const FOCUS_ROOM = /^[A-Za-z0-9_-]{16,64}$/;
const FOCUS_CMDS = ['state', 'toggle', 'start', 'stop', 'plus', 'minus', 'next', 'prev', 'set', 'countdown', 'cancel'];
const focusRooms = new Map();
const focusHits = new Map();

function focusRoom(id) {
  let r = focusRooms.get(id);
  if (!r) {
    if (focusRooms.size >= 1000) {
      for (const [k, v] of focusRooms) if (!v.clients.size) { focusRooms.delete(k); break; }
    }
    r = { alert: false, since: 0, points: null, cd: null, seq: 0, last: null, clients: new Set(), waiters: new Set(), pollers: new Map() };
    focusRooms.set(id, r);
  }
  r.touched = Date.now();
  return r;
}
/* stream listeners, plus long-pollers seen in the last 30 s */
function focusCount(r, role) {
  let n = 0; const fresh = Date.now() - 30e3;
  r.clients.forEach(function (c) { if (c.role === role) n++; });
  r.pollers.forEach(function (p, id) { if (p.at < fresh) r.pollers.delete(id); else if (p.role === role) n++; });
  return n;
}
function focusPublic(r) {
  /* a countdown is forgotten a minute after it ends; screens show "time's up" themselves */
  if (r.cd && r.cd.until < Date.now() - 60e3) r.cd = null;
  return { alert: r.alert, since: r.since, points: r.points, cd: r.cd, seq: r.seq, last: r.last, now: Date.now(),
    screens: focusCount(r, 'screen'), clickers: focusCount(r, 'clicker') };
}
function focusBroadcast(r) {
  const state = JSON.stringify(focusPublic(r));
  r.clients.forEach(function (c) { c.res.write('data: ' + state + '\n\n'); });
  const waiting = Array.from(r.waiters); r.waiters.clear();
  waiting.forEach(function (w) { w(state); });
}
function focusClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}
function focusPointsLine(r) { return (r.points || 0) + ' class point' + (r.points === 1 ? '' : 's'); }

/* → the reply line. Mutates the room and broadcasts when anything changed. */
function focusApply(r, cmd, q) {
  const now = Date.now();
  const n = Math.min(Math.max(parseInt(q.get('n'), 10) || 1, 1), 50);
  let msg;
  if (cmd === 'toggle') cmd = r.alert ? 'stop' : 'start';
  switch (cmd) {
    case 'state':
      return (r.alert ? 'Timer running · ' + focusClock(now - r.since) : 'Calm · ' + focusPointsLine(r)) +
        (r.cd && r.cd.until > now ? ' · countdown ' + focusClock(r.cd.until - now) : '');
    case 'countdown': {
      const m = parseFloat(q.get('m')), sec = parseInt(q.get('s'), 10);
      const secs = Math.round(m > 0 ? m * 60 : sec > 0 ? sec : 0);
      if (!(secs >= 5 && secs <= 5400)) return 'Give a time: countdown?m=5 (up to 90 minutes)';
      r.cd = { until: now + secs * 1000, total: secs * 1000 };
      r.last = { cmd: 'countdown', at: now, secs: secs };
      msg = focusClock(secs * 1000) + ' countdown started'; break;
    }
    case 'cancel':
      if (!r.cd || r.cd.until <= now) return 'No countdown running';
      r.cd = null; r.last = { cmd: 'cancel', at: now };
      msg = 'Countdown cancelled'; break;
    case 'start':
      if (r.alert) return 'Already running · ' + focusClock(now - r.since);
      r.alert = true; r.since = now; r.last = { cmd: 'start', at: now };
      msg = 'Timer started'; break;
    case 'stop': {
      if (!r.alert) return 'Timer is not running';
      const ms = now - r.since;
      r.alert = false; r.last = { cmd: 'stop', at: now, ms: ms };
      msg = 'Stopped · ' + focusClock(ms); break;
    }
    case 'plus':
      r.points = (r.points || 0) + n; r.last = { cmd: 'plus', at: now, n: n };
      msg = '+' + n + ' · ' + focusPointsLine(r); break;
    case 'minus':
      r.points = Math.max(0, (r.points || 0) - n); r.last = { cmd: 'minus', at: now, n: n };
      msg = '−' + n + ' · ' + focusPointsLine(r); break;
    case 'next': case 'prev':
      r.last = { cmd: cmd, at: now };
      msg = cmd === 'next' ? 'Next slide' : 'Back a slide';
      if (!focusCount(r, 'clicker')) msg += ' (no clicker connected)';
      break;
    case 'set': {
      const p = parseInt(q.get('points'), 10);
      if (!(p >= 0 && p <= 99999)) return 'Bad points value';
      if (q.get('ifEmpty') && r.points !== null) return focusPointsLine(r);
      r.points = p; r.last = { cmd: 'set', at: now };
      msg = focusPointsLine(r); break;
    }
  }
  r.seq++;
  focusBroadcast(r);
  if (!focusCount(r, 'screen') && cmd !== 'next' && cmd !== 'prev' && cmd !== 'set') msg += ' — but no screen is open on this link';
  return msg;
}

function handleFocus(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, 'Bad request'); }
  const parts = url.pathname.split('/');            // ['', 'api', 'focus', room, cmd]
  const room = parts[3], cmd = parts[4];
  const text = function (code, body) {
    send(res, code, body, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  };
  if (parts.length !== 5 || !FOCUS_ROOM.test(room || '')) return text(404, 'Unknown remote link');
  if (req.method !== 'GET' && req.method !== 'POST') return text(405, 'Method not allowed');

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const hits = (focusHits.get(ip) || []).filter(function (t) { return now - t < 60e3; });
  hits.push(now); focusHits.set(ip, hits);
  if (focusHits.size > 5000) focusHits.clear();
  if (hits.length > 240) return text(429, 'Too many presses — wait a moment');

  const r = focusRoom(room);
  if (cmd === 'events') {
    if (req.method !== 'GET') return text(405, 'Method not allowed');
    if (r.clients.size >= 30) return text(429, 'Too many screens on this link');
    const role = ['screen', 'clicker', 'remote'].indexOf(url.searchParams.get('role')) >= 0 ? url.searchParams.get('role') : 'screen';
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff'
    });
    /* 2 KB of padding first: some proxies hold a response until that much arrives */
    res.write(':' + ' '.repeat(2048) + '\nretry: 2000\n\n');
    const client = { res: res, role: role };
    r.clients.add(client);
    focusBroadcast(r);                               // the newcomer's first state, and everyone's new counts
    req.on('close', function () { r.clients.delete(client); r.touched = Date.now(); focusBroadcast(r); });
    return;
  }
  if (cmd === 'wait') {
    const role = ['screen', 'clicker', 'remote'].indexOf(url.searchParams.get('role')) >= 0 ? url.searchParams.get('role') : 'screen';
    const id = String(url.searchParams.get('id') || ip).slice(0, 40);
    const seen = !r.pollers.has(id);
    r.pollers.set(id, { role: role, at: now });
    if (seen) focusBroadcast(r);                   // a new listener changes the counts
    const reply = function (state) {
      clearTimeout(timer); r.waiters.delete(reply);
      sendJSON(res, 200, JSON.parse(state));
    };
    const timer = setTimeout(function () { reply(JSON.stringify(focusPublic(r))); }, 20000);
    req.on('close', function () { clearTimeout(timer); r.waiters.delete(reply); });
    if (String(r.seq) !== url.searchParams.get('seq')) return reply(JSON.stringify(focusPublic(r)));
    r.waiters.add(reply);
    return;
  }
  if (FOCUS_CMDS.indexOf(cmd) < 0) return text(404, 'Unknown command');
  return text(200, focusApply(r, cmd, url.searchParams));
}
/* the heartbeat: repeat the state down every stream (see above), and forget
   rooms idle for a fortnight */
setInterval(function () {
  const stale = Date.now() - 14 * 86400e3;
  focusRooms.forEach(function (r, id) {
    if (!r.clients.size && !r.waiters.size && r.touched < stale) { focusRooms.delete(id); return; }
    if (!r.clients.size) return;
    const state = JSON.stringify(focusPublic(r));
    r.clients.forEach(function (c) { c.res.write('data: ' + state + '\n\n'); });
  });
}, 20000).unref();

const server = http.createServer(function (req, res) {
  if (req.url.indexOf('/api/focus/') === 0) return handleFocus(req, res);
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

/* exported for tests; running the file directly starts the server */
module.exports = { verifyIdToken: verifyIdToken, allowedEmail: allowedEmail };
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', function () {
    console.log('Classroom Hub listening on ' + PORT);
    /* say why smart mode is off, so a missing variable isn't a mystery */
    const why = !process.env.ANTHROPIC_API_KEY ? 'no ANTHROPIC_API_KEY on this service'
      : !dictateClient() ? '@anthropic-ai/sdk is not installed'
      : !PROJECT_ID ? 'no Firebase project id (firebase-config.js or FIREBASE_PROJECT_ID)' : '';
    console.log('Dictation smart mode: ' + (why ? 'OFF — ' + why : 'ON, for ' +
      (process.env.DICTATE_ALLOWED_EMAILS ? 'DICTATE_ALLOWED_EMAILS' : 'any signed-in teacher (set DICTATE_ALLOWED_EMAILS to narrow it)')));
  });
}
