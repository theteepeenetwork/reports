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

/* A synthetic pointer event on the ink canvas — pointerType lets a test be a pencil or a finger. */
async function poke(page, type, x, y, pointerType) {
  await page.evaluate(([type, x, y, pointerType]) => {
    document.getElementById('wbCanvas').dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: pointerType === 'touch' ? 7 : 3, pointerType,
      clientX: x, clientY: y, isPrimary: true }));
  }, [type, x, y, pointerType]);
}

test('the pointer shows only while touching: at the nib for a pencil, above a finger', async ({ page }) => {
  const errors = collectErrors(page);
  await openBoardOneAtATime(page);
  await page.click('#wbPtr');
  const ptr = page.locator('#wbPointer');
  await expect(ptr).toBeHidden();

  const st = await page.locator('#wbStage').boundingBox();
  const x = st.x + 400, y = st.y + 300;
  await poke(page, 'pointerdown', x, y, 'pen');
  await expect(ptr).toBeVisible();
  let b = await ptr.boundingBox();
  expect(Math.abs(b.x - x)).toBeLessThan(2);
  expect(Math.abs(b.y - y)).toBeLessThan(2);
  expect(b.width, 'bigger than a mouse cursor').toBeGreaterThan(36);
  await poke(page, 'pointermove', x + 50, y + 20, 'pen');
  b = await ptr.boundingBox();
  expect(Math.abs(b.x - (x + 50))).toBeLessThan(2);
  await poke(page, 'pointerup', x + 50, y + 20, 'pen');
  await expect(ptr).toBeHidden();

  /* a finger: the arrow sits up and to the left, clear of the fingertip */
  /* once a pencil has touched, fingers are palm-rejected until the board reopens */
  await page.click('#wbExit');
  await page.click('#tv-day #toBoard');
  await page.click('#wbPtr');
  await poke(page, 'pointerdown', x, y, 'touch');
  await expect(page.locator('#wbPointer')).toBeVisible();
  b = await page.locator('#wbPointer').boundingBox();
  expect(b.y + b.height, 'the whole arrow is above the finger').toBeLessThan(y);
  await poke(page, 'pointerup', x, y, 'touch');
  await expect(page.locator('#wbPointer')).toBeHidden();

  /* it sits above the 100 square */
  await page.click('#wb100');
  const pop = await page.locator('#wbPop').boundingBox();
  await poke(page, 'pointerdown', pop.x + pop.width / 2, pop.y + pop.height * 0.7, 'touch');
  const pb = await page.locator('#wbPointer').boundingBox();
  const onTop = await page.evaluate(([x, y]) => {   // it ignores hits, so let it take one just to ask what is on top
    const p = document.getElementById('wbPointer'); p.style.pointerEvents = 'auto';
    const hit = !!document.elementFromPoint(x, y).closest('#wbPointer'); p.style.pointerEvents = ''; return hit;
  }, [pb.x + 6, pb.y + 12]);
  await poke(page, 'pointerup', 0, 0, 'touch');
  expect(onTop, 'pointer is drawn over the 100 square').toBe(true);
  expect(errors).toEqual([]);
});

test('the pen writes on the 100 square, and that ink clears on the next question', async ({ page }) => {
  const errors = collectErrors(page);
  await openBoardOneAtATime(page);
  await page.click('#wb100');
  const cell = await page.locator('.wb-cell').nth(44).boundingBox();
  const cx = cell.x + cell.width / 2, cy = cell.y + cell.height / 2;
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).id, [cx, cy]);
  expect(top, 'the ink canvas is over the grid').toBe('wbCanvas');

  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 30, { steps: 5 }); await page.mouse.up();
  const inked = () => page.evaluate(([x, y]) => {
    const c = document.getElementById('wbCanvas'), r = c.getBoundingClientRect(), k = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * k) - 6, Math.round((y - r.top) * k) - 6, 12, 12).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false;
  }, [cx + 30, cy + 15]);
  expect(await inked()).toBe(true);

  /* the header still drags the square, and its ink goes with it */
  const head = await page.locator('#wbPopHead').boundingBox();
  await page.mouse.move(head.x + 40, head.y + head.height / 2); await page.mouse.down();
  await page.mouse.move(head.x - 160, head.y + head.height / 2, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(50);
  expect(await inked(), 'ink left behind where the square was').toBe(false);

  await page.click('#wbFocusNext');
  await page.waitForTimeout(80);
  const any = await page.evaluate(() => {
    const c = document.getElementById('wbCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false;
  });
  expect(any, 'the next question starts clean').toBe(false);
  expect(errors).toEqual([]);
});

test('an answers page follows the last question, one at a time and in the grid', async ({ page }) => {
  const errors = collectErrors(page);
  await openBoardOneAtATime(page);
  for (let i = 0; i < 20; i++) await page.click('#wbFocusNext');
  await expect(page.locator('.wb-answers')).toBeVisible();
  await expect(page.locator('.wb-ans')).toHaveCount(20);
  const answers = await page.locator('.wb-ans-a').allTextContents();
  expect(answers.filter(a => a === '—' || a === ''), 'every question has an answer').toEqual([]);

  /* arithmetic answers are right */
  const qs = await page.evaluate(() => [...document.querySelectorAll('.wb-ans')].map(el => [el.querySelector('.wb-ans-q').textContent, el.querySelector('.wb-ans-a').textContent]));
  for (const [q, a] of qs) {
    const m = q.match(/^(\d+) ([+\-×]) (\d+) =$/);
    if (m) expect(+a).toBe(m[2] === '+' ? +m[1] + +m[3] : m[2] === '-' ? m[1] - m[3] : m[1] * m[3]);
  }

  await page.click('#wbFocusAll');
  await expect(page.locator('.wb-answers'), 'grid view keeps the answers page').toBeVisible();
  await page.click('#wbPagePrev');
  await expect(page.locator('.wb-grid')).toBeVisible();
  await page.click('#wbPageNext');
  await expect(page.locator('.wb-answers')).toBeVisible();
  expect(errors).toEqual([]);
});
