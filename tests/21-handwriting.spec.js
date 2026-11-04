/* Handwriting checker (js/handwriting.js) and Mental Starter (CBM) on the board.

   What these hold:
     1. Handwriting is a page of its own. Tapping a letter goes green → red →
        clear, and each mark keeps the "Assessed on" date. The whole-class grid
        writes the same records.
     2. The checklist is Oak's order and its ids are permanent.
     3. CBM's "Go through on the board" opens the Mental Starters whiteboard with
        the day's 20 questions, one at a time, then the answers; its ink is kept
        under cbm:<iso>, apart from Mental Starters' own days. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function open(page, hash, ready) {
  await blockExternal(page);
  await seedDevice(page, {});
  await page.goto('/index.html#' + hash);
  await page.waitForFunction(ready, null, { timeout: 10000 });
}

test('handwriting: tap cycles green, red, clear, and keeps the assessed date', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, 'handwriting', () => document.querySelector('#planApp .nav-link') && typeof window.hwRender === 'function');
  await page.evaluate(() => { if (location.hash !== '#handwriting') location.hash = '#handwriting'; window.hwRender(); });
  await expect(page.locator('.nav-link[data-page="handwriting"]')).toHaveText(/Handwriting/);

  await page.locator('#hwDate').fill('2026-10-12');
  await page.locator('#hwDate').dispatchEvent('change');
  const tile = () => page.locator('[data-hwi="l:i"]');
  await tile().click();
  await expect(tile()).toHaveClass(/hw-ok/);
  await expect(tile()).toContainText('12/10');
  await tile().click();
  await expect(tile()).toHaveClass(/hw-no/);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_handwriting')));
  expect(saved.marks.p1['l:i']).toEqual({ s: 0, d: '2026-10-12' });
  await tile().click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_handwriting')));
  expect(saved.marks.p1).toBeUndefined();

  /* the class grid writes the same records */
  await page.getByRole('button', { name: 'Whole class' }).click();
  await page.locator('[data-hwsec="joins"]').click();
  await page.locator('.hw-cell[data-hwp="p2"][data-hwi="j:id"]').click();
  await expect(page.locator('.hw-cell[data-hwp="p2"][data-hwi="j:id"]')).toHaveClass(/hw-ok/);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_handwriting')));
  expect(saved.marks.p2['j:id']).toEqual({ s: 1, d: '2026-10-12' });

  const synced = await page.evaluate(() => DATA_KEYS.indexOf('tp_handwriting') >= 0);
  expect(synced).toBe(true);
  expect(errors).toEqual([]);
});

test('handwriting: Oak order, permanent ids', async ({ page }) => {
  await open(page, 'handwriting', () => !!window.HW);
  const hw = await page.evaluate(() => window.HW.SECTIONS.map(s => ({ id: s.id, ids: s.groups.flatMap(g => g.items.map(i => i.id)) })));
  expect(hw.map(s => s.id)).toEqual(['lower', 'caps', 'nums', 'joins']);
  expect(hw[0].ids.slice(0, 6)).toEqual(['l:i', 'l:l', 'l:t', 'l:u', 'l:y', 'l:j']);
  expect(hw[0].ids).toHaveLength(26);
  expect(hw[1].ids).toHaveLength(26);
  expect(hw[2].ids).toHaveLength(11);
  expect(hw[3].ids.slice(0, 3)).toEqual(['j:id', 'j:ig', 'j:ed']);
  expect(hw[3].ids).toContain('j:rt');
});

test('CBM: the day\'s 20 questions go on the whiteboard, one at a time, then the answers', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, 'cbm', () => document.querySelector('#planApp .nav-link') && typeof window.cbmRender === 'function' && typeof window.hubOpenBoard === 'function');
  await page.evaluate(() => { if (location.hash !== '#cbm') location.hash = '#cbm'; window.cbmRender(); });
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.getByRole('button', { name: 'Go through on the board' }).click();
  await expect(page.locator('#whiteboard')).toBeVisible();
  await expect(page.locator('.wb-top')).toContainText('Mental Starter (CBM)');
  await expect(page.locator('#wbPrevDay, #wbNextDay')).toHaveCount(0);
  await page.locator('#wbFocusFirst').click();
  await expect(page.locator('.wb-toolbar')).toContainText('1 / 20');
  for (let i = 0; i < 20; i++) await page.locator('#wbFocusNext').click();
  await expect(page.locator('.wb-answers-grid .wb-ans')).toHaveCount(20);

  /* ink goes under cbm:<iso>, not a Mental Starters day */
  await page.locator('#wbFocusPrev').click();
  const box = await page.locator('#wbCanvas').boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260, { steps: 5 }); await page.mouse.up();
  await page.locator('#wbExit').click();
  await expect(page.locator('#whiteboard')).toBeHidden();
  await expect(page.locator('#page-cbm')).toHaveClass(/active/);
  const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tp_starter_ann') || '{}')));
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^cbm:\d{4}-\d{2}-\d{2}:q19$/);
  expect(errors).toEqual([]);
});
