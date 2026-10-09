/* Focus Remote (focus.html + /api/focus on server.js).

   The watch fetches a URL; the iPad page, listening on the event stream,
   must start the timer, move the class points and show slide changes. The
   relay lives in server.js, so this spec runs the real server rather than
   the static test server. */
const { test, expect } = require('@playwright/test');
const http = require('http');
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

test.beforeAll(async () => {
  port = 4800 + Math.floor(Math.random() * 400);
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
