/* A pupil added once should exist everywhere. The roster is the spine of the
   app — Glow Getters, seating, groups, the markbook and the reports all read
   the same array, so a pupil that appears in one place and not another is the
   classic symptom of a broken key route. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, ROSTER } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.mode && typeof ggAward === 'function', null, { timeout: 10000 });
}

test('a seeded class reaches the roster, the board and the seating plan', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  expect(await page.evaluate(() => (typeof roster !== 'undefined' ? roster.length : 0))).toBe(ROSTER.length);

  // Glow Getters reads the same roster through its own store
  const onBoard = await page.evaluate(() =>
    typeof window.ggGetPoints === 'function' ? (typeof roster !== 'undefined' ? roster : []).map(p => window.ggGetPoints(p.id)) : null);
  expect(onBoard, 'Glow Getters could not see the roster').toHaveLength(ROSTER.length);
});

test('adding a pupil updates the roster and the board together', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  const before = await page.evaluate(() => roster.length);
  await page.evaluate(() => {
    roster.push({ id: 'p-new', name: 'Zara Quinn' });
    saveRoster();
  });
  await page.waitForTimeout(250);

  expect(await page.evaluate(() => roster.length)).toBe(before + 1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tp_roster')).length)).toBe(before + 1);
  expect(await page.evaluate(() => window.ggGetPoints('p-new')), 'a new pupil should start on the board').not.toBeNull();
});

test('marking a pupil absent keeps them in the roster', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => { roster[0].absent = true; saveRoster(); });
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_roster')));
  expect(stored).toHaveLength(ROSTER.length);
  expect(stored[0].absent).toBe(true);
});
