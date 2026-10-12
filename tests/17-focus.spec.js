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
const { blockExternal } = require('./fixtures');

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
  await blockExternal(page);
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

test('without an account, a new device asks for the link instead of inventing one', async ({ page }) => {
  await blockExternal(page);
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
  await blockExternal(page);
  await page.goto(`http://127.0.0.1:${port}/focus.html?poll=1&room=${room}`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  expect((await call(`/api/focus/${room}/toggle`)).body).toBe('Timer started');   // the poller counts as a screen
  await expect(page.locator('body')).toHaveClass(/alert/);
  await call(`/api/focus/${room}/toggle`);
  await expect(page.locator('body')).not.toHaveClass(/alert/);
});

/* ---------- the account's link ----------
   A stand-in for the Firebase SDK, just the parts focus.html uses: a signed-in
   user and the one node users/{uid}/focus, with transaction() and live
   on('value'). `account` is that node's starting value. */
async function signedIn(page, { uid = 'teacher-1', account = null, local = null } = {}) {
  await blockExternal(page);
  await page.addInitScript(({ uid, account, local }) => {
    if (local) localStorage.setItem('focus_room', JSON.stringify(local));
    let node = account; const watchers = []; const writes = [];
    const fire = () => watchers.forEach(cb => cb({ val: () => node }));
    window.firebaseConfig = { apiKey: 'test', databaseURL: 'https://x', projectId: 'p' };
    window.firebase = {
      apps: [{}],
      initializeApp() {},
      auth: () => ({ onAuthStateChanged(cb) { setTimeout(() => cb(uid ? { uid, email: uid + '@school.org' } : null), 0); }, currentUser: uid ? { uid } : null }),
      database: () => ({ ref(path) {
        return {
          transaction(fn) { const v = fn(node); if (v !== undefined) { node = v; writes.push({ path, v }); setTimeout(fire, 0); } return Promise.resolve({ committed: v !== undefined }); },
          on(_, cb) { watchers.push(cb); setTimeout(() => cb({ val: () => node }), 0); },
          off() {},
          set(v) { node = v; writes.push({ path, v }); setTimeout(fire, 0); return Promise.resolve(); }
        };
      } })
    };
    window.__focusWrites = writes;
    /* the real firebase-config.js must not replace the stand-in config */
    Object.defineProperty(window, 'firebaseConfig', { value: window.firebaseConfig, writable: false });
  }, { uid, account, local });
}

test('the first screen on an account keeps the link it had, for the whole account', async ({ page }) => {
  const mine = 'mine_' + Date.now() + '_abcdefghij';
  await signedIn(page, { local: mine });
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch · ' + mine.slice(0, 4));
  const writes = await page.evaluate(() => window.__focusWrites);
  expect(writes).toEqual([{ path: 'users/teacher-1/focus', v: expect.objectContaining({ room: mine }) }]);
});

test('every other screen on the account follows the account link, whatever it had', async ({ page }) => {
  const acct = 'acct_' + Date.now() + '_abcdefghij';
  await signedIn(page, { account: { room: acct, t: 1 }, local: 'stale_link_000000000000' });
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch · ' + acct.slice(0, 4));
  expect(await page.evaluate(() => window.__focusWrites.length), 'never overwrites the account link').toBe(0);
  /* and the watch, pressing the account link, reaches it */
  expect((await call(`/api/focus/${acct}/toggle`)).body).toBe('Timer started');
  await expect(page.locator('body')).toHaveClass(/alert/);
});

test('a fresh device signed in gets the account link without asking', async ({ page }) => {
  const acct = 'fresh_' + Date.now() + '_abcdefghij';
  await signedIn(page, { account: { room: acct, t: 1 } });
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await expect(page.locator('#begin')).toBeVisible();
  await expect(page.locator('#joinBox')).toBeHidden();
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText(acct.slice(0, 4));
});

test('pasting a watch link in settings makes it the account link', async ({ page }) => {
  const acct = 'old_' + Date.now() + '_abcdefghijk';
  const watch = 'watch_' + Date.now() + '_abcdefghij';
  await signedIn(page, { account: { room: acct, t: 1 } });
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await page.click('#openSettings');
  await expect(page.locator('#linkTitle')).toHaveText('Your account’s link');
  page.once('dialog', d => d.accept());
  await page.fill('#joinInput', `https://hub.example/api/focus/${watch}/toggle`);
  await page.click('#joinBtn');
  await expect(page.locator('#link')).toContainText(watch.slice(0, 4));
  const writes = await page.evaluate(() => window.__focusWrites);
  expect(writes.pop().v.room).toBe(watch);
});

test('signed out on a new device, it asks you to sign in rather than making a link', async ({ page }) => {
  await signedIn(page, { uid: null });
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await expect(page.locator('#acctActions')).toBeVisible();
  await expect(page.locator('#begin')).toBeHidden();
  await page.click('#useLinkInstead');
  await expect(page.locator('#joinBox')).toBeVisible();
  expect(await page.evaluate(() => window.__focusWrites.length)).toBe(0);
});

test('a countdown from the watch fills the screen and ends with "time\'s up"', async ({ page }) => {
  const room = 'cd_' + Date.now() + '_abcdefghijkl';
  await blockExternal(page);
  await page.goto(`http://127.0.0.1:${port}/focus.html?room=${room}`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  expect((await call(`/api/focus/${room}/countdown?m=2`)).body).toBe('2:00 countdown started');
  await expect(page.locator('#kicker')).toHaveText('Countdown');
  await expect(page.locator('#big')).toHaveText(/^(2:00|1:5\d)$/);
  expect((await call(`/api/focus/${room}/state`)).body).toMatch(/countdown 1:5\d|countdown 2:00/);
  /* the off-task timer takes the screen; the countdown carries on in a chip */
  await call(`/api/focus/${room}/toggle`);
  await expect(page.locator('#kicker')).toHaveText('Back to learning');
  await expect(page.locator('#cdChip')).toBeVisible();
  await call(`/api/focus/${room}/toggle`);
  expect((await call(`/api/focus/${room}/cancel`)).body).toBe('Countdown cancelled');
  await expect(page.locator('#kicker')).toHaveText('Class points');
  /* a short one, from the on-screen buttons' endpoint, runs out */
  await call(`/api/focus/${room}/countdown?s=5`);
  await expect(page.locator('#kicker')).toHaveText('Countdown');
  await expect(page.locator('#kicker')).toHaveText('Time’s up', { timeout: 8000 });
  expect((await call(`/api/focus/${room}/countdown?m=500`)).body).toMatch(/^Give a time/);
});

/* ---------- Glow Getters ----------
   A stand-in for the account with a whole path tree, so Focus can read the
   class list, a roster and the Glow Getters blob, and write group points. */
async function glowAccount(page, tree) {
  await blockExternal(page);
  await page.addInitScript(tree => {
    /* kept in sessionStorage so a reload is a second screen on the same account */
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem('__acct')); } catch (e) {}
    const store = saved || tree, watchers = {}, writes = [];
    const keep = () => { try { sessionStorage.setItem('__acct', JSON.stringify(store)); } catch (e) {} };
    const fire = path => (watchers[path] || []).forEach(cb => cb({ val: () => store[path] === undefined ? null : store[path] }));
    window.firebaseConfig = { apiKey: 'test', databaseURL: 'https://x', projectId: 'p' };
    Object.defineProperty(window, 'firebaseConfig', { value: window.firebaseConfig, writable: false });
    window.firebase = {
      apps: [{}], initializeApp() {},
      auth: () => ({ onAuthStateChanged(cb) { setTimeout(() => cb({ uid: 'u1', email: 'u1@school.org' }), 0); }, currentUser: { uid: 'u1' } }),
      database: () => ({ ref(path) {
        return {
          on(_, cb) { (watchers[path] = watchers[path] || []).push(cb); setTimeout(() => cb({ val: () => store[path] === undefined ? null : store[path] }), 0); },
          off() { delete watchers[path]; },
          transaction(fn) {
            const v = fn(store[path] === undefined ? null : store[path]);
            if (v !== undefined) { store[path] = v; writes.push({ path, v }); keep(); setTimeout(() => fire(path), 0); }
            return Promise.resolve({ committed: v !== undefined });
          },
          set(v) { store[path] = v; writes.push({ path, v }); setTimeout(() => fire(path), 0); return Promise.resolve(); }
        };
      } })
    };
    /* another device (the board) changing the account */
    window.__acct = { store, writes, put(path, v) { store[path] = v; fire(path); } };
  }, tree);
}
const K = 'users/u1/keys/';
const blob = s => ({ v: JSON.stringify(s), t: 1 });
function glowTree(room) {
  return {
    'users/u1/focus': { room, t: 1 },
    [K + 'tp_classes']: blob([{ id: 'default', name: 'Year 2' }]),
    [K + 'tp_roster']: blob([{ id: 'p1', name: 'Ava Bell' }, { id: 'p2', name: 'Ben Cross' }, { id: 'p3', name: 'Cleo Dunn' }]),
    [K + 'tp_battler']: blob({ step: 1, minPoints: 5, startPoints: 10, maxPoints: '', points: { p1: 12, p2: 10, p3: 7 },
      tables: [{ id: 'gPurple', name: 'Purple group', pupilIds: ['p1', 'p2'] }], daily: {}, recent: [] })
  };
}
const battler = page => page.evaluate(k => JSON.parse(window.__acct.store[k].v), K + 'tp_battler');

test('a group point from the watch lands once in Glow Getters and shows the group', async ({ page }) => {
  const room = 'glow_' + Date.now() + '_abcdefghij';
  await glowAccount(page, glowTree(room));
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  /* the screen told the server the names, so the watch hears which group */
  await expect.poll(async () => (await call(`/api/focus/${room}/group?id=gPurple&n=1`)).body, { timeout: 5000 })
    .toBe('+ Purple group');
  await expect(page.locator('#kicker')).toHaveText('Purple group');
  await expect(page.locator('#big')).toHaveText('+1');
  await expect(page.locator('body')).toHaveClass(/award/);
  await expect.poll(async () => (await battler(page)).points).toEqual({ p1: 13, p2: 11, p3: 7 });
  const s = await battler(page);
  expect(s.recent.map(r => r.pid).sort()).toEqual(['p1', 'p2']);
  expect(Object.values(s.daily)[0]).toEqual({ p1: 1, p2: 1 });
  /* back to class points after about five seconds */
  await expect(page.locator('#kicker')).toHaveText('Class points', { timeout: 8000 });
  /* a second screen on the same account, seeing the same event, never applies it again */
  await page.reload();
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  await page.waitForTimeout(1500);
  expect((await battler(page)).points).toEqual({ p1: 13, p2: 11, p3: 7 });
  expect((await battler(page)).focusApplied).toBeGreaterThan(0);
});

test('a point given on the board shows the child or the group for five seconds', async ({ page }) => {
  const room = 'board_' + Date.now() + '_abcdefghij';
  await glowAccount(page, glowTree(room));
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  await page.waitForTimeout(300);
  const put = points => page.evaluate(([k, points]) => {
    const s = JSON.parse(window.__acct.store[k].v); s.points = points;
    window.__acct.put(k, { v: JSON.stringify(s), t: Date.now() });
  }, [K + 'tp_battler', points]);
  await put({ p1: 12, p2: 10, p3: 6 });                       // Cleo −1
  await expect(page.locator('#kicker')).toHaveText('Cleo Dunn');
  await expect(page.locator('#big')).toHaveText('−1');
  await expect(page.locator('body')).toHaveClass(/down/);
  await put({ p1: 14, p2: 12, p3: 6 });                       // the group, +2 each
  await expect(page.locator('#kicker')).toHaveText('Purple group', { timeout: 8000 });
  await expect(page.locator('#big')).toHaveText('+2');
});

test('settings list a + and − watch link for every group', async ({ page }) => {
  const room = 'links_' + Date.now() + '_abcdefghij';
  await glowAccount(page, glowTree(room));
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  await page.click('#openSettings');
  await expect(page.locator('#groupUrls .row')).toHaveCount(2);
  await expect(page.locator('#groupUrls')).toContainText(`/api/focus/${room}/group?id=gPurple&n=1`);
  await expect(page.locator('#groupUrls')).toContainText(`/api/focus/${room}/group?id=gPurple&n=-1`);
});

test('only the class open in the Hub on this device is shown and listed', async ({ page }) => {
  const room = 'active_' + Date.now() + '_abcdefghij';
  const tree = glowTree(room);
  tree[K + 'tp_classes'] = blob([{ id: 'default', name: 'Year 2' }, { id: 'c3', name: 'Year 3' }]);
  tree[K + 'tp_roster::c3'] = blob([{ id: 'q1', name: 'Dev Patel' }]);
  tree[K + 'tp_battler::c3'] = blob({ step: 1, points: { q1: 10 }, tables: [{ id: 'gGreen', name: 'Green table', pupilIds: ['q1'] }] });
  await page.addInitScript(() => localStorage.setItem('tp_active_class', JSON.stringify('c3')));
  await glowAccount(page, tree);
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  await page.waitForTimeout(300);
  const bump = (key, points) => page.evaluate(([k, points]) => {
    const s = JSON.parse(window.__acct.store[k].v); s.points = points;
    window.__acct.put(k, { v: JSON.stringify(s), t: Date.now() });
  }, [key, points]);
  await bump(K + 'tp_battler', { p1: 13, p2: 10, p3: 7 });    // Year 2: not the open class
  await page.waitForTimeout(600);
  await expect(page.locator('#kicker')).toHaveText('Class points');
  await bump(K + 'tp_battler::c3', { q1: 11 });                // Year 3: shown
  await expect(page.locator('#kicker')).toHaveText('Dev Patel');
  await page.click('#openSettings');
  await expect(page.locator('#groupUrls .row')).toHaveCount(2);
  await expect(page.locator('#groupUrls')).toContainText('Green table');
  await expect(page.locator('#groupUrls')).not.toContainText('Purple group');
});

test('a watch link for another class\'s group gives nothing', async ({ page }) => {
  const room = 'indep_' + Date.now() + '_abcdefghij';
  const tree = glowTree(room);
  tree[K + 'tp_classes'] = blob([{ id: 'default', name: 'Year 2' }, { id: 'c3', name: 'Year 3' }]);
  tree[K + 'tp_battler::c3'] = blob({ step: 1, points: { q1: 10 }, tables: [{ id: 'gGreen', name: 'Green table', pupilIds: ['q1'] }] });
  await page.addInitScript(() => localStorage.setItem('tp_active_class', JSON.stringify('c3')));
  await glowAccount(page, tree);
  await page.goto(`http://127.0.0.1:${port}/focus.html`);
  await page.click('#begin');
  await expect(page.locator('#link')).toContainText('Ready for your watch');
  await expect.poll(async () => (await call(`/api/focus/${room}/group?id=gPurple&n=1`)).body, { timeout: 5000 })
    .toBe('Not in the class open on the Focus screen — no points given');
  await page.waitForTimeout(800);
  expect((await battler(page)).points).toEqual({ p1: 12, p2: 10, p3: 7 });
  expect((await call(`/api/focus/${room}/group?id=gGreen&n=1`)).body).toBe('+ Green table');
  await expect(page.locator('#kicker')).toHaveText('Green table');
});
