/* Hundred Words (#hundred-words → hundred-words.html in a frame).

   The page was written as a claude.ai artifact with its own pupil list.
   In the hub it must use the classes already registered: the active
   class's roster is its pupil list, and what it saves lands in that
   class's own tp_hundred_words key, in the hub window's storage (where
   cloud.js can see it). */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const J = v => JSON.stringify(v);
const OTHER = [{ id: 'x1', name: 'Kit Marlow' }, { id: 'x2', name: 'Nell Gwyn' }];

function twoClasses(active) {
  return {
    tp_classes: J([
      { id: 'default', name: 'Year 2', createdAt: 1 },
      { id: 'b', name: 'Year 3', createdAt: 2 }
    ]),
    tp_active_class: J(active),
    'tp_roster::b': J(OTHER)
  };
}

async function openHW(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { extra });
  await page.goto('/index.html#hundred-words');
  await page.waitForFunction(() => typeof window.activeClassId === 'function', null, { timeout: 10000 });
  await expect(page.locator('#planApp .nav-link[data-page="hundred-words"]')).toBeVisible();
  const frame = page.frameLocator('#hwFrame');
  await expect(frame.locator('#nav button').first()).toBeVisible();
  return frame;
}

test('Hundred Words shows the active class from the hub and saves under that class', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));

  await expect(frame.locator('#cls')).toHaveText('Year 3');
  /* five tabs and a settings cog */
  await expect(frame.locator('#nav button')).toHaveText(['This week', 'Mark', 'Class', 'Pupils', 'Print']);
  /* Mark is by hand only: no photo marking in the hub for now */
  await frame.locator('#nav button', { hasText: 'Mark' }).click();
  await expect(frame.locator('#main')).not.toContainText('Mark photos');
  await expect(frame.locator('#nav button', { hasText: 'Practise' }), 'no practice games in the hub').toHaveCount(0);
  await expect(frame.locator('#nav button', { hasText: 'Review' }), 'no photo review queue in the hub').toHaveCount(0);
  await expect(frame.locator('#qPupil option', { hasText: 'Kit Marlow' })).toHaveCount(1);
  await frame.locator('#nav button', { hasText: 'Class' }).click();
  await expect(frame.locator('#main')).toContainText('Kit Marlow');
  await expect(frame.locator('#main')).toContainText('Nell Gwyn');
  await expect(frame.locator('#main')).not.toContainText('Ava Bell');   // the default class's roster

  /* a pupil added in the hub turns up without a reload */
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('tp_roster::b'));
    r.push({ id: 'x3', name: 'Tam Lin' });
    localStorage.setItem('tp_roster::b', JSON.stringify(r));
  });
  /* `storage` events only reach OTHER documents, which the frame is */
  await expect(frame.locator('#main')).toContainText('Tam Lin');

  /* the settings cog holds what the Class tab used to */
  await frame.locator('#cog').click();
  await expect(frame.locator('#cog')).toHaveAttribute('aria-current', 'page');
  await expect(frame.locator('#clsName')).toHaveValue('Year 3');
  await frame.locator('[data-c="strictCaps"]').check();
  const saved = await page.waitForFunction(() => localStorage.getItem('tp_hundred_words::b'));
  const doc = JSON.parse(await saved.jsonValue());
  expect(doc.settings.main.strictCaps).toBe(true);
  expect(doc.settings.main.className, 'the hub class name is not frozen into the doc').toBeUndefined();
  expect(doc.pupils, 'pupils belong to tp_roster, not to Hundred Words').toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words'))).toBeNull();
  expect(errors).toEqual([]);
});

test('Hundred Words on the default class reads the un-suffixed roster', async ({ page }) => {
  const frame = await openHW(page, twoClasses('default'));
  await expect(frame.locator('#cls')).toHaveText('Year 2');
  await frame.locator('#nav button', { hasText: 'Class' }).click();
  await expect(frame.locator('#main')).toContainText('Ava Bell');
  await expect(frame.locator('#main')).not.toContainText('Kit Marlow');
});

test('Quick check saves each tap, so switching pupil and back keeps the marks', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  await frame.locator('#nav button', { hasText: 'Mark' }).click();
  await frame.locator('#qPupil').selectOption('x1');
  const said = frame.locator('.qgrid button[data-i="4"]');
  await said.click();
  await expect(said).toHaveClass(/q-c/);
  await frame.locator('.qgrid button[data-i="5"]').click();
  await frame.locator('.qgrid button[data-i="5"]').click();     // twice = not yet

  await frame.locator('#qPupil').selectOption('x2');
  await expect(frame.locator('.qgrid button[data-i="4"]')).not.toHaveClass(/q-c/);
  await frame.locator('#qPupil').selectOption('x1');
  await expect(frame.locator('.qgrid button[data-i="4"]')).toHaveClass(/q-c/);
  await expect(frame.locator('.qgrid button[data-i="5"]')).toHaveClass(/q-x/);

  const doc = JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const ses = Object.values(doc.sessions).find(x => x.pupilId === 'x1');
  expect(ses.words['4'].s).toBe('c');
  expect(ses.words['5'].s).toBe('x');

  /* and it survives a reload */
  await page.reload();
  const again = page.frameLocator('#hwFrame');
  await again.locator('#nav button', { hasText: 'Mark' }).click();
  await again.locator('#qPupil').selectOption('x1');
  await expect(again.locator('.qgrid button[data-i="4"]')).toHaveClass(/q-c/);
});

test('This week: sets of ten in order across the three lists, and a whole-class test where most children are', async ({ page }) => {
  /* x1 has all of words 1–40 → on 41–50; x2 has all 100 HFW → on the 200 list */
  const all = n => { const w = {}; for (let i = 0; i < n; i++) w[i] = { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    x1_2026: { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: all(40) },
    x2_2026: { pupilId: 'x2', date: '2026-10-01', kind: 'spelling', words: all(100) },
    x3_2026: { pupilId: 'x3', date: '2026-10-01', kind: 'spelling', words: all(45) }
  }, practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  await expect(page.locator('#planApp .nav-link[data-page="hundred-words"]')).toContainText('Spellings');
  await frame.locator('#nav button', { hasText: 'This week' }).click();
  const plan = await page.frameLocator('#hwFrame').locator('body').evaluate(() =>
    testPlan().tests.map(t => ({ title: t.title, n: t.words.length, target: t.target.length })));
  /* x1 and x3 are both on 41–50: that is the whole-class test; x2 is tested
     on the first set of the next 200 */
  expect(plan[0]).toEqual({ title: 'Whole class · 100 HFW 41–60', n: 20, target: 2 });
  expect(plan[1]).toEqual({ title: 'Group · 200 HFW 1–10', n: 10, target: 1 });
  /* 409 words: 100 + 200 + 109 Year 3/4 common exception words */
  expect(await page.frameLocator('#hwFrame').locator('body').evaluate(() => [WORDS.length, SENT.length, NSETS])).toEqual([409, 409, 41]);

  /* This week is the opening tab: the routine strip, then a card per test,
     the whole-class one first and marked out */
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('This week');
  await expect(frame.locator('.routine .step')).toHaveCount(4);
  await expect(frame.locator('.routine .step.now')).toContainText('2 tests below');
  await expect(frame.locator('.routine')).toContainText('0 of 3 entered');
  const cards = frame.locator('.tests .test');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveClass(/whole/);
  await expect(cards.nth(0)).toContainText('100 HFW 41–60');
  await expect(cards.nth(0)).toContainText('current set for 2 of 3');
  await expect(cards.nth(0).locator('.wchip')).toHaveCount(20);
  await expect(cards.nth(1)).toContainText('Nell');
  for (const label of ['Enter results', 'Answer sheets', 'Dictation script']) {
    await expect(cards.nth(1).getByRole('button', { name: label })).toBeVisible();
  }
  await expect(frame.locator('#main')).toContainText('Teach to the whole class');
  await expect(frame.locator('#main')).toContainText('Needs you');
  await expect(frame.locator('#main')).toContainText('Since last check');

  /* the print buttons call the existing generators with that test */
  await frame.locator('body').evaluate(() => { window.__calls = []; PDF.testSheets = t => window.__calls.push(['sheets', t.title]); PDF.testScript = t => window.__calls.push(['script', t.title]); });
  await cards.nth(1).getByRole('button', { name: 'Answer sheets' }).click();
  await cards.nth(0).getByRole('button', { name: 'Dictation script' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls)).toEqual([['sheets', 'Group · 200 HFW 1–10'], ['script', 'Whole class · 100 HFW 41–60']]);

  /* Enter results opens Mark with that test loaded */
  await cards.nth(0).getByRole('button', { name: 'Enter results' }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Mark');
  await expect(frame.locator('#main')).toContainText('Whole class · 100 HFW 41–60');
});

test('This week: Needs you lists plans due, no gain and children not assessed', async ({ page }) => {
  const words = (n, wrong) => { const w = {}; for (let i = 0; i < n; i++) w[i] = wrong.includes(i) ? { s: 'x', r: i === 4 ? 'sed' : '' } : { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    'x1_2026-09-01': { pupilId: 'x1', date: '2026-09-01', kind: 'spelling', words: words(10, [4, 5]) },
    'x1_2026-09-20': { pupilId: 'x1', date: '2026-09-20', kind: 'spelling', words: words(10, [4, 5]) }
  }, practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  const needs = frame.locator('section[aria-labelledby="needH"]');
  await expect(needs).toContainText('1 plan due a review');
  await expect(needs).toContainText('Kit — no gain since last check');
  await expect(needs).toContainText('2 not assessed yet');
  await expect(frame.locator('section[aria-labelledby="teachH"]')).toContainText('“sed” for said ×2');
  await needs.getByRole('button', { name: /no gain/ }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Pupils');
});

test('Old tab ids land on the tab that replaced them; Practise and Review stay unreachable', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  const body = frame.locator('body');
  const land = id => body.evaluate((_, id) => { setTab(id); return S.tab; }, id);
  expect(await land('tracker')).toBe('class');
  expect(await land('groups')).toBe('week');
  expect(await land('assess')).toBe('mark');
  expect(await land('plans')).toBe('pupils');
  expect(await land('print')).toBe('print');
  const home = await body.evaluate(() => DEFAULT_TAB);
  expect(await land('practise')).toBe(home);
  expect(await land('review')).toBe(home);
  expect(await land('nonsense')).toBe(home);

  /* and a link with an old id in it */
  await blockExternal(page);
  await page.goto('/hundred-words.html#groups');
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('This week');
  await page.goto('/hundred-words.html#practise');
  await page.reload();
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('#main')).not.toContainText('Choose a game');
});
