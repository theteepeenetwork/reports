/* Mental starters on the board, one question at a time.

   Marking one by one, the teacher works the answer out on the board: the
   whole board is squared paper and the question sits in the top left, clear
   of the top and the side, so it is never under the ink. The 100 square and
   × tables float over it and can be dragged and resized; each remembers
   where it was put. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function openBoardOneAtATime(page) {
  await blockExternal(page);
  await seedDevice(page, { extra: { tp_starter_cfg: { qCount: 20, xtb: false } } });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => document.querySelector('#planApp .nav-link') && typeof window.hubOpenStarter === 'function',
    null, { timeout: 10000 });
  await page.evaluate(() => { window.location.hash = '#mental-starters'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.hubOpenStarter());
  await page.waitForTimeout(400);
  await page.click('#tv-day #toBoard');
  await page.click('#wbFocusFirst');
}

test('one at a time: squared paper everywhere, the question top left', async ({ page }) => {
  const errors = collectErrors(page);
  await openBoardOneAtATime(page);

  const stage = await page.locator('#wbStage').boundingBox();
  const q = await page.locator('.wb-focus-q').boundingBox();
  expect(q.x - stage.x, 'question should sit clear of the left edge').toBeGreaterThanOrEqual(24);
  expect(q.y - stage.y, 'question should sit clear of the top').toBeGreaterThanOrEqual(24);
  expect(q.y - stage.y, 'question should be at the top, not centred').toBeLessThan(stage.height / 4);

  const paper = await page.evaluate(() => {
    const f = document.querySelector('.wb-focus');
    const r = f.getBoundingClientRect(), s = document.getElementById('wbStage').getBoundingClientRect();
    return { grid: getComputedStyle(f).backgroundImage.includes('linear-gradient'), fills: r.width === s.width && r.height === s.height };
  });
  expect(paper.grid, 'the board should be squared').toBe(true);
  expect(paper.fills, 'the squares should cover the whole board').toBe(true);
  expect(errors).toEqual([]);
});

test('the 100 square and × tables can be moved and resized, and stay put', async ({ page }) => {
  const errors = collectErrors(page);
  await openBoardOneAtATime(page);

  for (const [btn, kind] of [['#wb100', '100 square'], ['#wbTimes', '× tables']]) {
    await page.click(btn);
    const pop = page.locator('#wbPop');
    await expect(pop).toContainText(kind);
    const before = await pop.boundingBox();

    /* move: drag the header left and down */
    const head = await page.locator('#wbPopHead').boundingBox();
    await page.mouse.move(head.x + 40, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(head.x - 260, head.y + 90, { steps: 6 });
    await page.mouse.up();
    const moved = await pop.boundingBox();
    expect(moved.x).toBeLessThan(before.x - 200);
    expect(moved.y).toBeGreaterThan(before.y + 60);

    /* resize: drag the corner out — it stays square, so the cells grow */
    const grip = await page.locator('#wbPopSize').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 120, grip.y + 120, { steps: 6 });
    await page.mouse.up();
    const grown = await pop.boundingBox();
    expect(grown.width).toBeGreaterThan(moved.width + 80);
    const cell = await page.locator('.wb-cell').first().boundingBox();
    expect(Math.abs(cell.width - cell.height)).toBeLessThan(2);

    /* close and reopen: it comes back where it was left, at the size it was left */
    await page.click('#wbPopX');
    await expect(pop).toHaveCount(0);
    await page.click(btn);
    const back = await pop.boundingBox();
    expect(Math.abs(back.x - grown.x)).toBeLessThan(2);
    expect(Math.abs(back.width - grown.width)).toBeLessThan(2);
    await page.click('#wbPopX');
  }
  expect(errors).toEqual([]);
});

test('a popup can never be dragged off the board', async ({ page }) => {
  await openBoardOneAtATime(page);
  await page.click('#wb100');
  const head = await page.locator('#wbPopHead').boundingBox();
  await page.mouse.move(head.x + 40, head.y + 10);
  await page.mouse.down();
  await page.mouse.move(head.x + 4000, head.y - 4000, { steps: 4 });
  await page.mouse.up();
  const stage = await page.locator('#wbStage').boundingBox();
  const pop = await page.locator('#wbPop').boundingBox();
  expect(pop.x + pop.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  expect(pop.y).toBeGreaterThanOrEqual(stage.y - 1);
});
