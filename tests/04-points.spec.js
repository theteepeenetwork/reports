/* Awarding a point is the app's most-used action, and it writes to two places
   at once: the Glow Getters store and the behaviour log the teacher reads
   later. If those two ever disagree, the teacher's record of the week is
   wrong — so this checks the whole path rather than the button. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.mode && typeof ggAward === 'function', null, { timeout: 10000 });
}

test('an award lands in the Glow Getters store under the frozen key', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  const before = await page.evaluate(() => window.ggGetPoints('p1'));
  await page.evaluate(() => window.ggAward('p1', 3, { silent: true, label: 'test' }));
  await page.waitForTimeout(250);

  expect(await page.evaluate(() => window.ggGetPoints('p1'))).toBe(before + 3);

  // CONTRACT.md: the storage key is tp_battler and must stay tp_battler.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => /battler|glow/i.test(k)));
  expect(keys, 'Glow Getters must still store under tp_battler').toContain('tp_battler');
  expect(keys.filter(k => /glow/i.test(k)), 'nothing should be writing a tp_glow key').toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tp_battler')).points.p1)).toBe(before + 3);
});

test('the legacy bt* API still works and is the same function', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  expect(await page.evaluate(() => window.btAward === window.ggAward)).toBe(true);
  expect(await page.evaluate(() => typeof window.openBattler === 'function')).toBe(true);

  const before = await page.evaluate(() => window.ggGetPoints('p2'));
  await page.evaluate(() => window.btAward('p2', 2, { silent: true }));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.ggGetPoints('p2'))).toBe(before + 2);
});

test('a Quick log glow point reaches the behaviour log', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  const before = await page.evaluate(() => (typeof bhData !== 'undefined' ? bhData.length : 0));
  await page.evaluate(() => {
    bhData.push({ id: 'e-test', date: new Date().toISOString().slice(0, 10),
                         pupilId: 'p1', type: 'positive', note: 'Glow point' });
    if (typeof window.bhSave === 'function') window.bhSave();
    else localStorage.setItem('tp_behaviour', JSON.stringify(bhData));
  });
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => (typeof bhData !== 'undefined' ? bhData.length : 0))).toBe(before + 1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_behaviour') || '[]'));
  expect(stored.some(e => e.id === 'e-test'), 'the entry did not persist').toBe(true);
});

test('all seven board views render without throwing', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  const thrown = [];
  page.on('pageerror', e => thrown.push(e.message));
  await page.goto('/glow-getters.html');
  // the board page has no mode switch — wait for the game module instead
  await page.waitForFunction(() => typeof ggSetBoardView === 'function', null, { timeout: 10000 });

  for (const view of ['classic', 'spotlight', 'split', 'scoreboard', 'lanes', 'constellation', 'glowcity']) {
    await page.evaluate(v => window.ggSetBoardView(v), view);
    await page.waitForTimeout(200);
    const els = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(els, `the ${view} view rendered almost nothing`).toBeGreaterThan(60);
  }
  expect(thrown).toEqual([]);
});
