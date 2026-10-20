/* =====================================================================
   Signing in on a second device must never damage the account.

   Oct 2026: a teacher signed in on an iPad and their laptop lost its
   classes. The iPad wiped its own (default) data before pulling the
   account, and the wipe re-seeded a one-class registry while signed in —
   which the write hook pushed straight over the account's tp_classes. The
   laptop heard the change, lost every other class from its switcher, and
   only "some came back" later through orphan recovery.

   These tests play the second device against an account that already
   holds a full class, and play another device writing while this one is
   open.
   ===================================================================== */
const { test, expect } = require('@playwright/test');
const { blockExternal, fakeFirebase, seedDevice } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#planApp .nav-link') && typeof ggAward === 'function', null, { timeout: 10000 });
}
const envelope = (v, t) => ({ v: JSON.stringify(v), t: t || 1000, ver: 1 });

const ACCOUNT = {
  tp_classes: envelope([
    { id: 'default', name: '3H', year: 'Year 3', room: '', createdAt: 1 },
    { id: 'c2', name: '4P', year: 'Year 4', room: '', createdAt: 2 }
  ]),
  tp_roster: envelope([{ id: 'r1', name: 'Remote Child' }, { id: 'r2', name: 'Second Child' }]),
  'tp_roster::c2': envelope([{ id: 'q1', name: 'Other Class Child' }]),
  tp_profile: envelope({ name: 'Mr Pearson', title: 'Class teacher', yearGroup: 'Year 3', room: '' }),
  tp_behaviour: envelope([{ id: 'b1', date: '2026-10-01', pupilId: 'r1', type: 'good', note: 'kept' }])
};

test('a fresh device signing in writes nothing to an account that already has data', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');                      // brand-new iPad: defaults only
  await ready(page);

  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(1200);

  const keyWrites = await page.evaluate(() => window.__fb.writes.filter(w => /\/keys\//.test(w.path)));
  expect(keyWrites, 'the new device wrote over the account:\n' + JSON.stringify(keyWrites, null, 2)).toEqual([]);
  const classes = await page.evaluate(() => JSON.parse(window.__fb.remote.tp_classes.v).map(c => c.id));
  expect(classes).toEqual(['default', 'c2']);
});

test('a device holding someone else\'s data pulls the account without pushing its own', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await seedDevice(page, { roster: [{ id: 'l1', name: 'Local Child' }], extra: { tp_profile: { name: 'Old Teacher' } } });
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(1200);

  const keyWrites = await page.evaluate(() => window.__fb.writes.filter(w => /\/keys\//.test(w.path)).map(w => w.key));
  expect(keyWrites).toEqual([]);
  // the account's data is on this device and in the live views
  expect(await page.evaluate(() => roster.map(p => p.name))).toEqual(['Remote Child', 'Second Child']);
  expect(await page.evaluate(() => profile.name)).toBe('Mr Pearson');
  expect(await page.evaluate(() => getClasses().map(c => c.id))).toEqual(['default', 'c2']);
});

test('after pulling, the next local edit keeps everything the account had', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(800);

  // a module saving its in-memory copy: before the fix these held boot defaults
  await page.evaluate(() => { saveProfile(); seatSave(); bhData.push({ id: 'b2', date: '2026-10-02', pupilId: 'r2', type: 'good', note: 'new' }); Store.set('tp_behaviour', bhData); });
  await page.waitForTimeout(800);

  const remote = await page.evaluate(() => window.__fb.remote);
  expect(JSON.parse(remote.tp_profile.v).name).toBe('Mr Pearson');
  expect(JSON.parse(remote.tp_behaviour.v).map(b => b.id)).toEqual(['b1', 'b2']);
});

test('two devices adding records at once both keep their records', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(800);

  // the laptop adds b3 to the account; this device has not heard yet and adds b4
  await page.evaluate(() => {
    window.__fb.hold = true;      // this device hears nothing yet, like a slow connection
    const cur = JSON.parse(window.__fb.remote.tp_behaviour.v);
    cur.push({ id: 'b3', date: '2026-10-03', pupilId: 'r1', type: 'good', note: 'laptop' });
    window.__fb.remoteSet('tp_behaviour', { v: JSON.stringify(cur), t: Date.now(), ver: 1 });
  });
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('tp_behaviour'));
    list.push({ id: 'b4', date: '2026-10-03', pupilId: 'r2', type: 'good', note: 'ipad' });
    localStorage.setItem('tp_behaviour', JSON.stringify(list));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__fb.flush());
  await page.waitForTimeout(300);

  const ids = await page.evaluate(() => JSON.parse(window.__fb.remote.tp_behaviour.v).map(b => b.id).sort());
  expect(ids).toEqual(['b1', 'b3', 'b4']);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_behaviour')).map(b => b.id).sort());
  expect(local).toEqual(['b1', 'b3', 'b4']);
});

test('an edit made offline is uploaded the next time the device signs in', async ({ page }) => {
  await blockExternal(page);
  // account last synced at t=1000; this device made an edit that never reached it
  await fakeFirebase(page, { remote: ACCOUNT });
  await seedDevice(page, {
    owner: 'teacherA',
    roster: [{ id: 'r1', name: 'Remote Child' }, { id: 'r2', name: 'Second Child' }, { id: 'r3', name: 'Added Offline' }],
    extra: { tp_sync_meta: { uid: 'teacherA', t: { tp_roster: 1000 }, dirty: { tp_roster: 1 } } }
  });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(1200);

  const names = await page.evaluate(() => JSON.parse(window.__fb.remote.tp_roster.v).map(p => p.name));
  expect(names).toContain('Added Offline');
});

test('a key deleted on another device is deleted here too', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem('tp_roster::c2'))).not.toBeNull();

  await page.evaluate(() => window.__fb.remoteSet('tp_roster::c2', null));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => localStorage.getItem('tp_roster::c2'))).toBeNull();
});

test('signing in keeps a dated copy of the account in the cloud', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(1200);

  const snaps = await page.evaluate(() => Object.keys(window.__fb.other).filter(p => /\/snapshots\//.test(p)));
  expect(snaps.length).toBe(1);
  const copy = await page.evaluate(p => window.__fb.other[p], snaps[0]);
  expect(Object.keys(copy.keys).sort()).toEqual(Object.keys(ACCOUNT).sort());
});

test('the cloud chip lists the daily copies and restores one', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: ACCOUNT });
  await page.goto('/index.html');
  await ready(page);
  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(800);

  // someone wipes the roster on another device…
  await page.evaluate(() => window.__fb.remoteSet('tp_roster', { v: '[]', t: Date.now(), ver: 1 }));
  await page.click('#cloudChip');
  await expect(page.locator('#cloudSnaps [data-snap]')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/cloud-panel.png' });

  page.on('dialog', d => d.accept());
  await page.evaluate(() => addEventListener('beforeunload', () =>
    sessionStorage.setItem('fbAfter', JSON.stringify({ keys: window.__fb.remote, other: Object.keys(window.__fb.other) }))));
  await Promise.all([page.waitForEvent('load'), page.locator('#cloudSnaps [data-snap]').first().click()]);
  // …and the restore puts it back in the account, keeping a copy of what was there
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('fbAfter')));
  expect(JSON.parse(after.keys.tp_roster.v).length).toBe(2);
  expect(after.other.some(p => /before-restore/.test(p))).toBe(true);
});
