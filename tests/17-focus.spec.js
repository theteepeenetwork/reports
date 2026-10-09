/* Focus Remote (focus.html + /api/focus on server.js).

   The watch fetches a URL; the iPad page, listening on the event stream,
   must start the timer, move the class points and show slide changes. The
   relay lives in server.js, so this spec runs the real server rather than
   the static test server. */
const { test, expect } = require('@playwright/test');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const ROOM = 'testroom_ABCDEFGHIJ12';
let port, proc;

function call(p, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method }, res => {
      let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject); req.end();
  });
}

/* a port the OS says is free, from a range Chrome never blocks (it refuses
   5060/5061, 6000, 10080 …), so parallel workers can't collide */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer().on('error', reject);
    s.listen(20000 + Math.floor(Math.random() * 20000), '127.0.0.1', () => {
      const p = s.address().port; s.close(() => resolve(p));
    });
  }).catch(() => freePort());
}

test.beforeAll(async () => {
  port = await freePort();
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(port) }), stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await call('/healthz'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
});
test.afterAll(() => { proc && proc.kill(); });

test('the relay answers the watch in one line and refuses bad links', async () => {
  const room = 'relay_' + Date.now() + '_abcdefgh';
  expect((await call('/api/focus/short/toggle')).status).toBe(404);
  expect((await call('/api/focus/' + room + '/explode')).status).toBe(404);
  expect((await call('/api/focus/' + room + '/toggle')).body).toMatch(/^Timer started/);
  expect((await call('/api/focus/' + room + '/start')).body).toMatch(/^Already running/);
  expect((await call('/api/focus/' + room + '/toggle', 'POST')).body).toMatch(/^Stopped · 0:0\d/);
  expect((await call('/api/focus/' + room + '/plus?n=3')).body).toMatch(/^\+3 · 3 class points/);
  expect((await call('/api/focus/' + room + '/minus?n=9')).body).toMatch(/^−9 · 0 class points/);
  expect((await call('/api/focus/' + room + '/next')).body).toBe('Next slide (no clicker connected)');
});

test('the iPad page follows the watch', async ({ page }) => {
  await page.addInitScript(r => { try { localStorage.setItem('focus_room', JSON.stringify(r)); localStorage.setItem('focus_points', '7'); } catch (e) {} }, ROOM);
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  /* the server had no count, so the iPad put its own back */
  await expect(page.locator('#big')).toHaveText('7');

  await call(`/api/focus/${ROOM}/plus`);
  await expect(page.locator('#big')).toHaveText('8');
  await call(`/api/focus/${ROOM}/minus?n=2`);
  await expect(page.locator('#big')).toHaveText('6');

  await call(`/api/focus/${ROOM}/toggle`);
  await expect(page.locator('body')).toHaveClass(/alert/);
  await expect(page.locator('#big')).toHaveText(/^0:0\d$/);
  await expect(page.locator('#chipPoints')).toHaveText('6');

  await call(`/api/focus/${ROOM}/toggle`);
  await expect(page.locator('body')).not.toHaveClass(/alert/);
  await expect(page.locator('#tally')).toContainText('1 time');
  await expect(page.locator('#big')).toHaveText('6');

  await call(`/api/focus/${ROOM}/next`);
  await expect(page.locator('#toast')).toContainText('Next slide');

  /* the on-screen buttons go through the same relay */
  await page.click('.ctl [data-cmd="plus"]');
  await expect(page.locator('#big')).toHaveText('7');
  expect(await page.evaluate(() => localStorage.getItem('focus_points'))).toBe('7');
});

test('a new device asks for the link instead of inventing one', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await expect(page.locator('#joinBox')).toBeVisible();
  await expect(page.locator('#begin')).toBeHidden();
  /* pasting a watch shortcut's URL puts this device on that link */
  await page.fill('#firstInput', `http://example.org/api/focus/${ROOM}/toggle`);
  await page.click('#firstJoin');
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch · ' + ROOM.slice(0, 4));
  expect(page.url()).toContain('room=' + ROOM);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('focus_room')))).toBe(ROOM);
});

test('long-polling follows the watch when a stream cannot get through', async ({ page }) => {
  const room = 'poll_' + Date.now() + '_abcdefghij';
  await page.goto(`http://127.0.0.1:${port}/focus.html?poll=1&room=${room}`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  expect((await call(`/api/focus/${room}/toggle`)).body).toBe('Timer started');   // the poller counts as a screen
  await expect(page.locator('body')).toHaveClass(/alert/);
  await call(`/api/focus/${room}/toggle`);
  await expect(page.locator('body')).not.toHaveClass(/alert/);
});
