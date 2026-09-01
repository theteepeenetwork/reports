/* The four-branch owner-stamp decision in CONTRACT.md. This is what runs on a
   shared iPad when the next teacher signs in, and getting it wrong either
   shows one teacher another's class or silently overwrites somebody's data.
   The rule that must never break: NEVER auto-seed an empty account from a
   device whose data belongs to someone else. Ask. */
const { test, expect } = require('@playwright/test');
const { blockExternal, fakeFirebase, seedDevice } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.mode && typeof ggAward === 'function', null, { timeout: 10000 });
}

const envelope = v => ({ v: JSON.stringify(v), t: Date.now(), ver: 1 });

test('branch 1 — a non-empty account is the source of truth and is pulled, never seeded', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page, { remote: { tp_roster: envelope([{ id: 'r1', name: 'Remote Child' }]) } });
  await seedDevice(page, { roster: [{ id: 'l1', name: 'Local Child' }] });   // different owner (unstamped)
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherB' }));
  await page.waitForTimeout(1200);

  const wrote = await page.evaluate(() => window.__fb.writes.filter(w => w.op === 'set' && w.key === 'tp_roster'));
  expect(wrote, 'the device uploaded over a non-empty account').toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('tp_owner_uid'))).toBe('teacherB');
});

test('branch 2 — an empty account plus my own stamped device uploads silently', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page);
  await seedDevice(page, { owner: 'teacherA' });
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherA' }));
  await page.waitForTimeout(1200);

  const uploaded = await page.evaluate(() => window.__fb.writes.map(w => w.key));
  expect(uploaded, 'resuming my own device should upload it').toContain('tp_roster');
});

test('branch 3 — an empty account plus someone else\'s data must ASK, never auto-seed', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page);
  await seedDevice(page, { owner: 'teacherA' });        // device belongs to A…
  await page.goto('/index.html');
  await ready(page);

  const asked = await page.evaluate(() => new Promise(resolve => {
    const original = window.appPromptAdopt;
    window.appPromptAdopt = function (summary, handlers) { resolve(summary); };
    window.__fb.signIn({ uid: 'teacherB' });            // …but B signs in
    setTimeout(() => resolve(null), 2500);
  }));

  expect(asked, 'the app auto-seeded instead of asking').not.toBeNull();
  expect(asked.names, 'the prompt should say how many pupils are at risk').toBeGreaterThan(0);

  const uploaded = await page.evaluate(() => window.__fb.writes.filter(w => w.op === 'set').map(w => w.key));
  expect(uploaded, 'nothing may be uploaded before the teacher answers').not.toContain('tp_roster');
});

test('branch 4 — an empty account and an empty device just starts clean', async ({ page }) => {
  await blockExternal(page);
  await fakeFirebase(page);
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => window.__fb.signIn({ uid: 'teacherC' }));
  await page.waitForTimeout(1200);

  expect(await page.evaluate(() => localStorage.getItem('tp_owner_uid'))).toBe('teacherC');
});
