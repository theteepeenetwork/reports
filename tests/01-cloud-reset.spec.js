/* =====================================================================
   THE ONE THAT MATTERS.

   docs/CONTRACT.md names this hazard by hand and nothing guarded it until
   now. cloudPush() writes a deletion as `{ v: '' }` — not a remove — so a
   single stray push during a sign-out blanks that key in the account, and
   the next device to sync pulls the blank down over good data. A teacher
   loses a term of behaviour records and nobody finds out until somebody
   goes looking for data that is no longer there.

   resetSession() therefore clears local data through an UNHOOKED
   removeItem (the Storage.prototype.setItem hook never sees it) and raises
   CLOUD.resetting as belt-and-braces. These tests assert the outcome
   rather than the mechanism: after a sign-out, the account is untouched.
   ===================================================================== */
const { test, expect } = require('@playwright/test');
const { DATA_KEYS, blockExternal, fakeFirebase, seedDevice } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.mode && typeof ggAward === 'function', null, { timeout: 10000 });
}

test.describe('sign-out must never write to the cloud', () => {

  test('a sign-out pushes nothing at all', async ({ page }) => {
    await blockExternal(page);
    await fakeFirebase(page);
    // owner === the uid we sign in as → the "resuming my own device" branch,
    // which uploads. That gives us a realistic, fully-synced starting point.
    await seedDevice(page, { owner: 'teacherA', extra: { tp_battler: { points: { p1: 14 } } } });

    await page.goto('/index.html');
    await ready(page);

    await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
    await page.waitForTimeout(500);          // let the adopt-upload settle

    const uploaded = await page.evaluate(() => window.__fb.writes.length);
    expect(uploaded, 'the signed-in device should have uploaded its class').toBeGreaterThan(0);

    await page.evaluate(() => window.__fb.clearWrites());
    await page.evaluate(() => window.__fb.signOut());
    // cloudSchedulePush debounces by 250ms — wait well past it, so a push
    // that was going to fire has every chance to.
    await page.waitForTimeout(1200);

    const after = await page.evaluate(() => window.__fb.writes);
    expect(after, 'a sign-out must not write to the account:\n' + JSON.stringify(after, null, 2)).toEqual([]);
  });

  test('no key is blanked with {v:""} on the way out', async ({ page }) => {
    await blockExternal(page);
    await fakeFirebase(page);
    await seedDevice(page, { owner: 'teacherA' });
    await page.goto('/index.html');
    await ready(page);
    await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__fb.clearWrites());
    await page.evaluate(() => window.__fb.signOut());
    await page.waitForTimeout(1200);

    const blanked = await page.evaluate(() =>
      window.__fb.writes.filter(w => w.op === 'set' && w.val && w.val.v === '').map(w => w.key));
    expect(blanked, 'these keys were emptied in the account by a sign-out').toEqual([]);
  });

  test('the account contents survive a sign-out unchanged', async ({ page }) => {
    await blockExternal(page);
    await fakeFirebase(page);
    await seedDevice(page, { owner: 'teacherA', extra: { tp_battler: { points: { p1: 14, p2: 7 } } } });
    await page.goto('/index.html');
    await ready(page);
    await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => JSON.stringify(window.__fb.remote));
    await page.evaluate(() => window.__fb.signOut());
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => JSON.stringify(window.__fb.remote));

    expect(after, 'the remote account changed during a sign-out').toBe(before);
  });

  test('the sign-out still clears this device, so the next teacher sees nothing', async ({ page }) => {
    await blockExternal(page);
    await fakeFirebase(page);
    await seedDevice(page, { owner: 'teacherA' });
    await page.goto('/index.html');
    await ready(page);
    await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__fb.signOut());
    await page.waitForTimeout(600);

    // tp_classes is re-seeded immediately as an EMPTY registry, and
    // tp_known_emails is a deliberately non-synced device-local key (CONTRACT.md).
    // Everything that could identify a child must be gone.
    const KEEP = ['tp_classes', 'tp_known_emails'];
    const left = await page.evaluate(
      ([keys, keep]) => keys.filter(k => localStorage.getItem(k) !== null && keep.indexOf(k) < 0),
      [DATA_KEYS, KEEP]);
    expect(left, 'pupil data was left on the device after a sign-out').toEqual([]);

    const registry = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_classes') || '[]'));
    const pupilsLeft = registry.reduce((n, c) => n + ((c && c.pupils) ? c.pupils.length : 0), 0);
    expect(pupilsLeft, 'the re-seeded class registry still holds pupils').toBe(0);
    const stamp = await page.evaluate(() => localStorage.getItem('tp_owner_uid'));
    expect(stamp, 'the owner stamp should be cleared too').toBeNull();
  });
});
