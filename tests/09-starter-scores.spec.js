/* Mental starter scores — the "last 5" column.

   Entering this morning's score is the moment a teacher can notice that a
   child who is usually 18 has just got 6. The table carries every date, but by
   half-term you are scanning sideways to answer "is this normal for them?".
   These guard the small amount of judgement in that column: which five scores
   it shows, and which of them it marks. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const PUPILS = [{ id: 'p1', name: 'Ava Bell' }, { id: 'p2', name: 'Ben Cross' }];

/* dates is a plain list; scores maps pupil -> date -> value (null = absent). */
function starters(scores, dates) {
  const block = { max: 20, dates: dates, scores: {} };
  Object.keys(scores).forEach(pid => {
    block.scores[pid] = {};
    Object.keys(scores[pid]).forEach(d => { block.scores[pid][d] = { v: scores[pid][d], ipad: false }; });
  });
  return JSON.stringify({ 'Summer 2': block });
}

async function open(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { roster: PUPILS, extra: extra });
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.msRecent === 'function', null, { timeout: 10000 });
  /* buildPlan() moves the starter cards into Markbook's "Starter scores" tab,
     so that is where a teacher actually enters scores -- #page-mental-starters
     is left as an empty heading. Driving the real route here means these tests
     fail if that re-homing ever changes. */
  await page.evaluate(() => window.hubSetMode('plan'));
  await page.waitForTimeout(300);
  await page.locator('.nav-link[data-page="markbook"]').click();
  await page.waitForTimeout(300);
  await page.locator('#mbTabs button', { hasText: 'Starter scores' }).click();
  await page.waitForTimeout(400);
}

const D = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-08', '2026-09-09'];

test('the column shows the five most recent scores, oldest first', async ({ page }) => {
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 11, [D[1]]: 12, [D[2]]: 13, [D[3]]: 14, [D[4]]: 15, [D[5]]: 16, [D[6]]: 17 } }, D) });
  const vals = await page.evaluate(() => window.msRecent('p1', 5).map(r => r.v));
  expect(vals, 'should be the last five, in date order').toEqual([13, 14, 15, 16, 17]);
});

test('a day the child missed is skipped, not shown as a gap', async ({ page }) => {
  // An absence is not a score. Padding the row with blanks would push a real
  // score out of the five and make the pattern harder to read, not easier.
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 8, [D[1]]: 9, [D[2]]: null, [D[3]]: 10, [D[4]]: 11, [D[6]]: 12 } }, D) });
  const vals = await page.evaluate(() => window.msRecent('p1', 5).map(r => r.v));
  expect(vals).toEqual([8, 9, 10, 11, 12]);
});

test('a score well below the child\'s own middle is marked', async ({ page }) => {
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 18, [D[1]]: 17, [D[2]]: 6, [D[3]]: 19, [D[4]]: 18 } }, D) });
  const flags = await page.evaluate(() => window.msOutliers([18, 17, 6, 19, 18], 20));
  expect(flags, 'the 6 should be the only thing marked').toEqual([0, 0, -1, 0, 0]);

  const cell = page.locator('#recent-p1');
  await expect(cell).toContainText('6 ▼');
  await expect(cell).toContainText('18');
});

test('a score well above is marked too — a jump is worth a look as much as a dip', async ({ page }) => {
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 4, [D[1]]: 5, [D[2]]: 3, [D[3]]: 19, [D[4]]: 5 } }, D) });
  const flags = await page.evaluate(() => window.msOutliers([4, 5, 3, 19, 5], 20));
  expect(flags).toEqual([0, 0, 0, 1, 0]);
  await expect(page.locator('#recent-p1')).toContainText('19 ▲');
});

test('a steady week is not marked at all', async ({ page }) => {
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 15, [D[1]]: 16, [D[2]]: 14, [D[3]]: 17, [D[4]]: 15 } }, D) });
  const flags = await page.evaluate(() => window.msOutliers([15, 16, 14, 17, 15], 20));
  expect(flags, 'ordinary variation must not cry wolf').toEqual([0, 0, 0, 0, 0]);
  await expect(page.locator('#recent-p1'), 'nothing should be flagged').not.toContainText('▼');
  await expect(page.locator('#recent-p1')).not.toContainText('▲');
});

test('the baseline is the median, and it matters in both directions', async ({ page }) => {
  /* Why median and not mean. Rather than assert it, this computes what a
     mean-based version would have said and shows the two differ. */
  await open(page);
  const meanFlags = (vals, max) => {
    const m = vals.reduce((a, c) => a + c, 0) / vals.length;
    const gap = Math.max(4, Math.round((max || 20) * 0.25));
    return vals.map(v => v <= m - gap ? -1 : (v >= m + gap ? 1 : 0));
  };

  // Two bad mornings in a week. The mean is dragged down to 12.8, far enough
  // that the child's THREE ORDINARY 20s get marked as unusually high.
  const twoDips = [20, 20, 2, 20, 2];
  expect(await page.evaluate(v => window.msOutliers(v, 20), twoDips)).toEqual([0, 0, -1, 0, -1]);
  expect(meanFlags(twoDips, 20), 'a mean would call this child\'s normal score remarkable')
    .toEqual([1, 1, -1, 1, -1]);

  // And the reverse: a single dip pulls the mean down towards itself until it
  // no longer looks like a dip at all.
  const oneDip = [12, 12, 12, 12, 7];
  expect(await page.evaluate(v => window.msOutliers(v, 20), oneDip)).toEqual([0, 0, 0, 0, -1]);
  expect(meanFlags(oneDip, 20), 'a mean would miss this dip entirely').toEqual([0, 0, 0, 0, 0]);
});

test('fewer than three scores marks nothing — there is no normal yet', async ({ page }) => {
  await open(page);
  const flags = await page.evaluate(() => window.msOutliers([2, 19], 20));
  expect(flags).toEqual([0, 0]);
});

test('the threshold follows the length of the paper', async ({ page }) => {
  await open(page);
  // On a 40-mark paper, being 5 below the middle is ordinary; on a 12-mark one
  // the floor of 4 marks applies instead of a quarter.
  const big = await page.evaluate(() => window.msOutliers([30, 25, 30, 28, 30], 40));
  expect(big, '5 off on a 40-mark paper is not remarkable').toEqual([0, 0, 0, 0, 0]);
  const small = await page.evaluate(() => window.msOutliers([10, 11, 5, 10, 11], 12));
  expect(small, 'on a short paper the 4-mark floor still catches a real dip').toEqual([0, 0, -1, 0, 0]);
});

test('typing a score updates that pupil\'s last five without a reload', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 18, [D[1]]: 17, [D[2]]: 19, [D[3]]: 18 } }, D.slice(0, 5)) });
  await expect(page.locator('#recent-p1')).not.toContainText('▼');

  await page.evaluate(d => window.msSet('p1', d, '5'), D[4]);
  await page.waitForTimeout(200);
  await expect(page.locator('#recent-p1'), 'the new score should appear and be flagged').toContainText('5 ▼');
  expect(errors).toEqual([]);
});

test('the column is actually on screen where scores are entered', async ({ page }) => {
  /* Every other test here reads the DOM, which passes whether or not a teacher
     can see the thing. This one insists it is visible on the real route. */
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 18, [D[1]]: 17, [D[2]]: 6, [D[3]]: 19, [D[4]]: 18 } }, D) });
  await expect(page.locator('#msTable'), 'the score table is not on screen').toBeVisible();
  await expect(page.locator('#recent-p1'), 'the last-5 column is not on screen').toBeVisible();
  await expect(page.locator('#msTable th', { hasText: 'Last 5' })).toBeVisible();
});

test('a pupil with no scores yet shows a dash, not an error', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { tp_starters: starters({ p1: { [D[0]]: 12 } }, D.slice(0, 3)) });
  await expect(page.locator('#recent-p2')).toContainText('—');
  expect(errors).toEqual([]);
});
