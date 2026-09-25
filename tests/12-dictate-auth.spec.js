/* /api/dictate — the sign-in check on smart mode.

   Smart mode spends money on every call and sends a class list to Anthropic,
   so the server only answers a teacher it can identify: a Firebase ID token,
   verified against the signing keys, from an allowed address. These run in
   Node against server.js itself; no browser and no network. The keys are
   generated here and handed to verifyIdToken() in place of Google's. */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { verifyIdToken, allowedEmail } = require('../server.js');

const PROJECT = 'classplanner-test';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CERTS = { k1: publicKey.export({ type: 'spki', format: 'pem' }) };

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function sign(claims, { kid = 'k1', key = privateKey, alg = 'RS256' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({
    aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT,
    sub: 'teacher-uid', iat: now - 10, auth_time: now - 10, exp: now + 3600, email: 'miss.hart@school.org'
  }, claims);
  const head = b64({ alg: alg, kid: kid, typ: 'JWT' }) + '.' + b64(body);
  return head + '.' + crypto.sign('RSA-SHA256', Buffer.from(head), key).toString('base64url');
}

test('a genuine token is accepted and its claims returned', async () => {
  const claims = await verifyIdToken(sign({}), PROJECT, CERTS);
  expect(claims.sub).toBe('teacher-uid');
  expect(claims.email).toBe('miss.hart@school.org');
});

test('tokens that are forged, stale or for another project are refused', async () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const now = Math.floor(Date.now() / 1000);
  const bad = {
    'signed with someone else’s key': sign({}, { key: other }),
    'an unknown key id': sign({}, { kid: 'nope' }),
    'another Firebase project': sign({ aud: 'someone-else' }),
    'the wrong issuer': sign({ iss: 'https://evil.example/' + PROJECT }),
    'expired an hour ago': sign({ exp: now - 3600 }),
    'issued tomorrow': sign({ iat: now + 86400 }),
    'no subject': sign({ sub: '' }),
    'not a JWT at all': 'hello'
  };
  for (const [why, token] of Object.entries(bad)) {
    await expect(verifyIdToken(token, PROJECT, CERTS), why).rejects.toThrow();
  }
  /* a payload edited after signing */
  const parts = sign({}).split('.');
  parts[1] = b64(Object.assign(JSON.parse(Buffer.from(parts[1], 'base64url')), { sub: 'someone-else' }));
  await expect(verifyIdToken(parts.join('.'), PROJECT, CERTS), 'tampered payload').rejects.toThrow('bad signature');
});

test('DICTATE_ALLOWED_EMAILS takes addresses and @domains', () => {
  const was = process.env.DICTATE_ALLOWED_EMAILS;
  try {
    delete process.env.DICTATE_ALLOWED_EMAILS;
    expect(allowedEmail('anyone@anywhere.com'), 'unset means any signed-in teacher').toBe(true);
    process.env.DICTATE_ALLOWED_EMAILS = 'head@other.org, @school.org';
    expect(allowedEmail('Miss.Hart@School.org')).toBe(true);
    expect(allowedEmail('head@other.org')).toBe(true);
    expect(allowedEmail('someone@other.org')).toBe(false);
    expect(allowedEmail('x@notschool.org.evil.com')).toBe(false);
    expect(allowedEmail(''), 'a token with no email').toBe(false);
  } finally {
    if (was === undefined) delete process.env.DICTATE_ALLOWED_EMAILS; else process.env.DICTATE_ALLOWED_EMAILS = was;
  }
});

test('the endpoint refuses a request without a valid sign-in', async () => {
  const port = 4300 + Math.floor(Math.random() * 500);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(port), ANTHROPIC_API_KEY: 'sk-test-not-used', FIREBASE_PROJECT_ID: PROJECT }),
    stdio: 'ignore'
  });
  try {
    const call = (method, headers) => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/dictate', method, headers }, res => {
        let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }));
      });
      req.on('error', reject);
      if (method === 'POST') req.end(JSON.stringify({ text: 'Aurora met', pupils: [{ id: 'p1', name: 'Aurora' }] })); else req.end();
    });
    for (let i = 0; i < 50; i++) { try { await call('GET', {}); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }

    expect((await call('GET', {})).body).toEqual({ enabled: true, signIn: true });
    const none = await call('POST', { 'Content-Type': 'application/json' });
    expect(none.status).toBe(401);
    /* garbage fails before the server ever needs Google's keys */
    const junk = await call('POST', { 'Content-Type': 'application/json', Authorization: 'Bearer not.a.token' });
    expect(junk.status).toBe(401);
  } finally {
    proc.kill();
  }
});
