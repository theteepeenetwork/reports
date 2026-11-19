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
/* Mark is reached from a test on the Tests tab */
async function openMark(frame) {
  await frame.locator('#nav button', { hasText: 'Tests' }).click();
  await frame.locator('.tests .test').first().getByRole('button', { name: 'Enter results' }).click();
  await expect(frame.locator('.markcard')).toBeVisible();
}

test('Hundred Words shows the active class from the hub and saves under that class', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));

  await expect(frame.locator('#cls')).toHaveText('Year 3');
  /* four tabs and a settings cog; Tests opens first */
  await expect(frame.locator('#nav button')).toHaveText(['Tests', 'Class', 'Pupils', 'Print']);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  /* Mark opens from a test and sits under Tests. It is by hand only: no photo marking in the hub for now */
  await openMark(frame);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await expect(frame.locator('#main')).not.toContainText('Mark photos');
  await expect(frame.locator('#nav button', { hasText: 'Practise' }), 'no practice games in the hub').toHaveCount(0);
  await expect(frame.locator('#nav button', { hasText: 'Review' }), 'no photo review queue in the hub').toHaveCount(0);
  await expect(frame.locator('.pl', { hasText: 'Kit Marlow' })).toHaveCount(1);
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

test('Mark saves each tap, so switching pupil and back keeps the marks', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  await openMark(frame);
  /* nobody is assessed, so the whole-class test on words 1–20 is loaded */
  await expect(frame.locator('#mTest option:checked')).toHaveText('Whole class · 100 HFW 1–20 (20 words)');
  await expect(frame.locator('.tile')).toHaveCount(20);
  await frame.locator('.pl[data-id="x1"]').click();
  const said = frame.locator('.tile[data-i="4"]');
  await said.click();
  await expect(said).toHaveClass(/\bc\b/);
  await frame.locator('.tile[data-i="5"]').click();
  await frame.locator('.tile[data-i="5"]').click();     // twice = not yet

  await frame.locator('.pl[data-id="x2"]').click();
  await expect(frame.locator('.tile[data-i="4"]')).not.toHaveClass(/\bc\b/);
  await frame.locator('.pl[data-id="x1"]').click();
  await expect(frame.locator('.tile[data-i="4"]')).toHaveClass(/\bc\b/);
  await expect(frame.locator('.tile[data-i="5"]')).toHaveClass(/\bx\b/);
  await expect(frame.locator('.pl[data-id="x1"] .st')).toHaveText('2/20');

  const doc = JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const ses = Object.values(doc.sessions).find(x => x.pupilId === 'x1');
  expect(ses.words['4'].s).toBe('c');
  expect(ses.words['5'].s).toBe('x');
  expect(ses.kind).toBe('spelling');
  /* the record is the shape it always was */
  expect(Object.keys(ses).sort()).toEqual(['date', 'kind', 'photos', 'pupilId', 'updatedAt', 'words']);

  /* and it survives a reload */
  await page.reload();
  const again = page.frameLocator('#hwFrame');
  await openMark(again);
  await again.locator('.pl[data-id="x1"]').click();
  await expect(again.locator('.tile[data-i="4"]')).toHaveClass(/\bc\b/);
});

test('Mark: the tap cycle, Mark the rest correct, what they wrote, and Next pupil', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  await openMark(frame);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')) || '{"sessions":{}}').sessions;
  const tile = frame.locator('.tile[data-i="0"]');
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');

  /* once: correct · twice: not yet · three times: clear */
  await expect(tile).toHaveAttribute('aria-label', 'the, not marked');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-label', 'the, correct');
  await expect(frame.locator('#mScore')).toHaveText('1/20');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-label', 'the, not yet');
  await expect(frame.locator('#mScore')).toHaveText('0/20');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-label', 'the, not marked');
  await expect.poll(async () => Object.keys(await stored()).length, 'a session with nothing in it is removed').toBe(0);

  /* the words of the set the child is on are outlined */
  await expect(frame.locator('.tile.focus')).toHaveCount(10);

  /* said is wrong and they wrote "sed"; the rest are right */
  const said = frame.locator('.tile[data-i="4"]');
  await said.click(); await said.click();
  await frame.getByRole('button', { name: 'Add what they wrote' }).click();
  await frame.locator('#wr4').fill('sed');
  await frame.locator('#wr4').blur();
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await expect(frame.locator('#mScore')).toHaveText('19/20');
  await expect(frame.locator('.tile.c')).toHaveCount(19);
  await expect(said, 'the rest, not the ones already marked').toHaveClass(/\bx\b/);
  await expect(frame.locator('.pl[data-id="x1"] .st')).toHaveText('✓ done');
  const ses = Object.values(await stored())[0];
  expect(ses.words['4']).toEqual({ s: 'x', src: 'manual', r: 'sed' });
  expect(Object.keys(ses.words).length).toBe(20);

  /* Next pupil; the last child's button goes back to Tests */
  await frame.getByRole('button', { name: 'Next: Nell →' }).click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await expect(frame.locator('.pl[data-id="x2"]')).toHaveAttribute('aria-current', 'true');
  await expect(frame.locator('#mScore')).toHaveText('0/20');
  await expect(frame.locator('.tile.c, .tile.x')).toHaveCount(0);
  await expect(frame.locator('.plist .phead')).toContainText('1 done');
  await frame.getByRole('button', { name: 'Back to Tests' }).click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await expect(frame.locator('.routine')).toContainText('1 of 2 entered');

  /* Kit got 9/10 on 1–10, so is still on it: "✗ last time" shows from tomorrow's check */
  await openMark(frame);
  await frame.locator('#mTest').selectOption('one');
  await expect(frame.locator('.tile')).toHaveCount(100);
  await frame.locator('#qDate').fill('2030-01-01');
  await frame.locator('.pl[data-id="x1"]').click();
  await expect(frame.locator('.tile[data-i="4"] .hint')).toHaveText('✗ last time');
  await expect(frame.locator('.tile[data-i="3"] .hint')).toHaveText('✓ last time');
  await frame.getByRole('button', { name: 'Reading' }).click();
  await frame.locator('.tile[data-i="4"]').click();
  expect((await stored())['x1_2030-01-01']).toMatchObject({ kind: 'reading', date: '2030-01-01', pupilId: 'x1' });
});

test('Tests: sets of ten in order across the three lists, and a whole-class test where most children are', async ({ page }) => {
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
  await frame.locator('#nav button', { hasText: 'Tests' }).click();
  const plan = await page.frameLocator('#hwFrame').locator('body').evaluate(() =>
    testPlan().tests.map(t => ({ title: t.title, n: t.words.length, target: t.target.length })));
  /* x1 and x3 are both on 41–50: that is the whole-class test; x2 is tested
     on the first set of the next 200 */
  expect(plan[0]).toEqual({ title: 'Whole class · 100 HFW 41–60', n: 20, target: 2 });
  expect(plan[1]).toEqual({ title: 'Group · 200 HFW 1–10', n: 10, target: 1 });
  /* 409 words: 100 + 200 + 109 Year 3/4 common exception words */
  expect(await page.frameLocator('#hwFrame').locator('body').evaluate(() => [WORDS.length, SENT.length, NSETS])).toEqual([409, 409, 41]);

  /* Tests is the opening tab: the routine strip, then a card per test,
     the whole-class one first and marked out */
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
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
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await expect(frame.locator('.markcard')).toBeVisible();
  await expect(frame.locator('#main')).toContainText('Whole class · 100 HFW 41–60');
});

test('Tests: Needs you lists plans due, no gain and children not assessed', async ({ page }) => {
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

test('Class: band columns, set by set, and a square opens its ten words', async ({ page }) => {
  /* x1: 1–10 all right, 8/10 on 11–20 (was, you wrong); x2 has all 100; x3 not assessed */
  const words = (n, wrong = []) => { const w = {}; for (let i = 0; i < n; i++) w[i] = wrong.includes(i) ? { s: 'x', r: i === 10 ? 'woz' : '' } : { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    'x1_2026-10-01': { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: words(20, [10, 11]) },
    'x2_2026-10-01': { pupilId: 'x2', date: '2026-10-01', kind: 'spelling', words: words(100) }
  }, practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  await frame.locator('#nav button', { hasText: 'Class' }).click();

  /* the list switch and four tiles */
  await expect(frame.locator('.seg[aria-label="Word list"] button')).toHaveText(['100 HFW', 'Next 200 HFW', 'Y3/4 exception words']);
  const tiles = frame.locator('.stat4 .stat');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.nth(0)).toContainText('59/100');        // (18 + 100) / 2
  await expect(tiles.nth(3)).toContainText('Nell → Next 200 HFW');
  await expect(frame.locator('#main')).toContainText('2 of 3 assessed');

  /* where everyone is: one column per band, names open the pupil panel */
  await expect(frame.locator('.bandcol')).toHaveCount(10);
  await expect(frame.locator('.bandcol[data-set="1"] .nm')).toHaveText(['Kit']);
  await expect(frame.locator('.bandcol[data-set="0"] .nm')).toHaveText(['Tam']);
  await expect(frame.locator('#main')).toContainText('1 child has moved on past this list');
  await expect(frame.locator('section[aria-labelledby="i2"]')).toContainText('was → “woz”');
  await frame.locator('.bandcol[data-set="1"] .nm').click();
  await expect(frame.locator('#drawer')).toContainText('Kit Marlow');
  await page.keyboard.press('Escape');
  await frame.locator('#drawer').evaluate(() => { S.ui.pupil = null; doRender(); });

  /* set by set: ✓ for 10/10, n on the set they're on, empty if not reached */
  const row = frame.locator('table.sg tbody tr', { hasText: 'Kit Marlow' });
  await expect(row.locator('.cell')).toHaveCount(10);
  await expect(row.locator('.cell').nth(0)).toHaveText('✓');
  await expect(row.locator('.cell').nth(1)).toHaveText('8');
  await expect(row.locator('.cell').nth(1)).toHaveAttribute('aria-label', 'Kit Marlow, Red 11–20: 8 out of 10, working on it');
  await expect(row.locator('.cell').nth(2)).toHaveText('');
  await expect(row.locator('.sc')).toContainText('18');
  await expect(frame.locator('table.sg tbody tr', { hasText: 'Nell Gwyn' }).locator('.cell.d')).toHaveCount(10);
  await expect(frame.locator('table.sg tbody tr', { hasText: 'Tam Lin' }).locator('.cell.n')).toHaveCount(10);

  /* a square shows that set's ten words underneath, right or wrong */
  await expect(frame.locator('#sqbar')).toHaveCount(0);
  await row.locator('.cell').nth(1).click();
  const bar = frame.locator('#sqbar');
  await expect(bar).toContainText('Kit Marlow · Red 11–20 · 8/10');
  await expect(bar.locator('button.wchip')).toHaveCount(10);
  await expect(bar.locator('button.wchip.ok')).toHaveCount(8);
  await expect(bar.locator('button.wchip.no')).toHaveText([/^was/, /^you/]);

  /* a word there keeps the Correct today / Not yet today controls */
  await bar.locator('button.wchip', { hasText: 'was' }).click();
  await expect(bar.locator('.cellbar')).toContainText('wrote “woz”');
  await bar.getByRole('button', { name: 'Correct today' }).click();
  await expect(bar).toContainText('9/10');
  await expect(row.locator('.cell').nth(1)).toHaveText('9');
  const today = await frame.locator('body').evaluate(() => localDate());
  const doc = JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  expect(doc.sessions['x1_' + today].words['10']).toEqual({ s: 'c', src: 'manual' });
  await bar.locator('.cellbar').getByRole('button', { name: 'Close' }).click();
  await expect(bar.locator('.cellbar')).toHaveCount(0);
  await bar.getByRole('button', { name: 'Close' }).click();
  await expect(frame.locator('#sqbar')).toHaveCount(0);

  /* the word-by-word grid is still the A3 print and the CSV, for the list on show */
  await frame.locator('.seg[aria-label="Word list"] button', { hasText: 'Next 200 HFW' }).click();
  await expect(frame.locator('.bandcol')).toHaveCount(20);
  await expect(frame.locator('.bandcol[data-set="10"] .nm')).toHaveText(['Nell']);
  await frame.locator('body').evaluate(() => { window.__calls = []; PDF.grid = () => window.__calls.push('grid:' + S.ui.print.list); PDF.csv = () => window.__calls.push('csv'); });
  await frame.getByRole('button', { name: 'A3 class grid' }).click();
  await frame.getByRole('button', { name: 'Spreadsheet (CSV)' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls)).toEqual(['grid:1', 'csv']);
  expect(await frame.locator('body').evaluate(() => S.ui.print.list), 'Print keeps its own list, so its pages and bands still match it').toBe(0);
});

test('Pupils: a card each, the four filters, and practice books for everyone', async ({ page }) => {
  /* Kit: no gain, wrote "sed", plan overdue · Nell: gaining, practised "the" to the top of the ladder · Tam: not assessed */
  const words = (n, wrong = []) => { const w = {}; for (let i = 0; i < n; i++) w[i] = wrong.includes(i) ? { s: 'x', r: i === 4 ? 'sed' : '' } : { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    'x1_2026-09-01': { pupilId: 'x1', date: '2026-09-01', kind: 'spelling', words: words(10, [4, 5]) },
    'x1_2026-09-20': { pupilId: 'x1', date: '2026-09-20', kind: 'spelling', words: words(10, [4, 5]) },
    'x2_2026-09-01': { pupilId: 'x2', date: '2026-09-01', kind: 'spelling', words: words(10, [0, 1, 2]) },
    'x2_2026-09-20': { pupilId: 'x2', date: '2026-09-20', kind: 'spelling', words: words(20, [0, 15]) }
  }, practice: { x2: { boxes: { 0: 3 }, log: [] } }, plans: { x2: { reviewDate: '2099-01-01' } }, settings: {} });
  const frame = await openHW(page, extra);
  await frame.locator('#nav button', { hasText: 'Pupils' }).click();

  const filters = frame.locator('.f');
  await expect(filters).toHaveText(['Everyone · 3', 'Review due · 1', 'No gain · 1', 'Ready to re-check · 1']);
  const cards = frame.locator('.pcards .pc');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('.pn')).toHaveText(['Kit Marlow', 'Nell Gwyn', 'Tam Lin']);

  const kit = cards.nth(0);
  await expect(kit).toContainText('Review due');
  await expect(kit).toContainText('Pink · 1–10 · 8/10 · 8/100 no gain');
  await expect(kit.locator('.wchip')).toHaveText(['said', 'in', 'was']);     // focus shrinks to 3 after no gain
  await expect(kit).toContainText('Most common: Sounded out or another attempt');
  const nell = cards.nth(1);
  await expect(nell).toContainText('Review 1 Jan');
  await expect(nell).toContainText('18/100 +11');
  await expect(nell.locator('.wchip').first()).toHaveText('the');
  await expect(cards.nth(2)).toContainText('Not assessed yet');

  await filters.nth(1).click();
  await expect(filters.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.locator('.pn')).toHaveText(['Kit Marlow']);
  await filters.nth(2).click();
  await expect(cards.locator('.pn')).toHaveText(['Kit Marlow']);
  await filters.nth(3).click();
  await expect(cards.locator('.pn')).toHaveText(['Nell Gwyn']);
  await filters.nth(0).click();
  await expect(cards).toHaveCount(3);

  await frame.locator('body').evaluate(() => { window.__calls = []; PDF.books = (pids, f) => window.__calls.push([pids, f]); });
  await frame.getByRole('button', { name: 'Practice books for everyone' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls)).toEqual([[['x1', 'x2', 'x3'], 'practice-books.pdf']]);

  /* a card opens that child */
  await nell.click();
  await expect(frame.locator('#drawer')).toContainText('Nell Gwyn');
});

test('Pupil panel: opens from any name, steps to the next child, and holds the plan, prints and checks', async ({ page }) => {
  const words = (n, wrong = []) => { const w = {}; for (let i = 0; i < n; i++) w[i] = wrong.includes(i) ? { s: 'x', r: i === 4 ? 'sed' : '' } : { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    'x1_2026-09-01': { pupilId: 'x1', date: '2026-09-01', kind: 'spelling', words: words(10, [4, 5]) },
    'x1_2026-09-20': { pupilId: 'x1', date: '2026-09-20', kind: 'spelling', words: words(10, [4, 5]) },
    'x2_2026-09-20': { pupilId: 'x2', date: '2026-09-20', kind: 'spelling', words: words(20, [15]) }
  }, practice: { x1: { boxes: { 4: 2 }, log: [] } }, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  const panel = frame.locator('#drawer');
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  await expect(panel).toBeHidden();

  /* from a Pupils card */
  await frame.locator('#nav button', { hasText: 'Pupils' }).click();
  await frame.locator('.pc', { hasText: 'Kit Marlow' }).click();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('role', 'dialog');
  await expect(panel.locator('#pName')).toHaveText('Kit Marlow');
  await expect(panel.locator('#pClose')).toBeFocused();
  /* top: band, three stats, and why the focus set changed */
  await expect(panel).toContainText('Pink · 100 HFW 1–10 (8/10)');
  await expect(panel.locator('.mini')).toHaveCount(3);
  await expect(panel.locator('.mini').nth(0)).toHaveText('8/100correct');
  await expect(panel.locator('.mini.bad')).toHaveText('0since last check');
  await expect(panel.locator('#pNote')).toContainText('No gain since the last check, so the focus set is down to 3 words');
  /* focus words with the ladder, then revisit and next up */
  await expect(panel.locator('.fw .wd')).toHaveText(['said', 'in', 'was']);
  await expect(panel.locator('.fw').first().locator('.lad')).toHaveAttribute('aria-label', 'Practising');
  await expect(panel.locator('section[aria-labelledby="f1"]')).toContainText('Next up');
  /* what they wrote, and the pattern */
  await expect(panel.locator('section[aria-labelledby="f2"] .wchip').first()).toHaveText('sedsaid');
  await expect(panel.locator('section[aria-labelledby="f2"]')).toContainText('Pattern: sounded out or another attempt (1)');
  /* the plan, focus size, review date, success */
  await expect(panel.locator('section[aria-labelledby="f3"]')).toContainText('Smaller steps');
  await expect(panel.locator('section[aria-labelledby="f3"]')).toContainText('Success looks like: Kit spells said, in, was correctly in two separate checks.');
  await panel.locator('#pfx1').selectOption('8');
  await expect(panel.locator('.fw')).toHaveCount(8);
  await expect(panel.locator('#pNote')).toContainText('You set the focus size to 8 words');
  await panel.locator('#prx1').fill('2031-02-03');
  await panel.locator('#pn_x1').fill('TA on Tuesdays');
  await panel.locator('#pn_x1').blur();
  await expect.poll(async () => (await stored()).plans.x1 && (await stored()).plans.x1.notes).toBe('TA on Tuesdays');
  const plan = (await stored()).plans.x1;
  expect(plan).toMatchObject({ focusN: 8, reviewDate: '2031-02-03', notes: 'TA on Tuesdays' });
  expect(Object.keys(plan).sort()).toEqual(['focusN', 'notes', 'reviewDate', 'updated']);

  /* prints call the existing generators for this child */
  await frame.locator('body').evaluate(() => { window.__calls = [];
    PDF.books = (p, f) => window.__calls.push(['books', p, f]); PDF.cards = (g, f) => window.__calls.push(['cards', g.length, f]); PDF.targeted = p => window.__calls.push(['targeted', p]); });
  await panel.getByRole('button', { name: 'Practice book', exact: true }).click();
  await panel.getByRole('button', { name: 'Flash cards' }).click();
  await panel.getByRole('button', { name: 'Check sheet' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls)).toEqual([
    ['books', ['x1'], 'practice-book-kit-marlow.pdf'], ['cards', 1, 'flash-cards-kit-marlow.pdf'], ['targeted', ['x1']]]);

  /* checks: a chart, and the list behind a disclosure, with delete */
  await expect(panel.locator('.bars div')).toHaveCount(2);
  const checks = panel.locator('section[aria-labelledby="f5"] details');
  await expect(checks.locator('summary')).toHaveText('2 checks — view or delete');
  await expect(checks.getByRole('button', { name: 'Delete' }).first()).toBeHidden();
  await checks.locator('summary').click();
  await checks.getByRole('button', { name: 'Delete' }).first().click();
  await expect(checks.getByRole('button', { name: 'Confirm delete' })).toBeVisible();
  await checks.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(checks.locator('summary')).toHaveText('1 check — view or delete');
  expect(Object.keys((await stored()).sessions).sort()).toEqual(['x1_2026-09-01', 'x2_2026-09-20']);

  /* next and previous pupil, round the class */
  await panel.getByRole('button', { name: 'Next pupil' }).click();
  await expect(panel.locator('#pName')).toHaveText('Nell Gwyn');
  await panel.getByRole('button', { name: 'Next pupil' }).click();
  await expect(panel.locator('#pName')).toHaveText('Tam Lin');
  await expect(panel.locator('#pNote')).toContainText('Not checked yet');
  await panel.getByRole('button', { name: 'Next pupil' }).click();
  await expect(panel.locator('#pName')).toHaveText('Kit Marlow');
  await panel.getByRole('button', { name: 'Previous pupil' }).click();
  await expect(panel.locator('#pName')).toHaveText('Tam Lin');

  /* closing: the button, and Escape */
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
  await frame.locator('#nav button', { hasText: 'Class' }).click();
  await frame.locator('table.sg').getByRole('button', { name: 'Nell Gwyn', exact: true }).click();
  await expect(panel.locator('#pName')).toHaveText('Nell Gwyn');
  await panel.locator('#pClose').press('Escape');
  await expect(panel).toBeHidden();
});

test('Print: eight things in three groups, one set of options at a time, each calling its generator', async ({ page }) => {
  /* x1 on 41–50 with x3 (whole class), x2 on the next 200; x1 has practised "some" to the top of the ladder */
  const all = n => { const w = {}; for (let i = 0; i < n; i++) w[i] = { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    x1_2026: { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: all(40) },
    x2_2026: { pupilId: 'x2', date: '2026-10-01', kind: 'spelling', words: all(100) },
    x3_2026: { pupilId: 'x3', date: '2026-10-01', kind: 'spelling', words: all(45) }
  }, practice: { x1: { boxes: { 40: 3 }, log: [] } }, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  await frame.locator('#nav button', { hasText: 'Print' }).click();

  await expect(frame.locator('.pmenu .grp')).toHaveText(['For Thursday’s test', 'For practice', 'For the wall and records']);
  await expect(frame.locator('.pmenu .it b')).toHaveText(['Answer sheets', 'Dictation script', 'Targeted check sheets',
    'Daily practice books', 'Flash cards', 'Practice sheets', 'Word of the day', 'Class record']);

  /* every generator is replaced by a recorder: nothing here changes how a PDF is made */
  const body = frame.locator('body');
  await body.evaluate(() => { window.__calls = []; const rec = (k, f) => { PDF[k] = (...a) => window.__calls.push([k, ...f(...a)]); };
    rec('testSheets', t => [t.title]); rec('testScript', t => [t.title]); rec('sheets', () => [S.ui.print.list, S.ui.print.pages.slice(), S.ui.print.named, S.ui.print.pids.slice()]);
    rec('script', () => [S.ui.print.list]); rec('targeted', p => [p, S.ui.print.targetN]); rec('books', (p, f) => [p, f, S.ui.print.bookDays]);
    rec('stackLevels', (l, f) => [l, f]); rec('stackPupils', (p, f) => [p, f]); rec('cards', (g, f) => [g.map(x => x.label), f, S.ui.print.cardSize, S.ui.print.cardSent]);
    rec('acts', (g, f) => [g.map(x => x.label), f, S.ui.print.acts.slice()]); rec('wotd', () => []); rec('grid', () => [S.ui.print.list]); rec('csv', () => []); });
  const calls = async () => body.evaluate(() => window.__calls.splice(0));
  const pick = name => frame.locator('.pmenu .it', { hasText: name }).click();
  const opt = (group, name) => frame.locator(`#popts [role="group"][aria-label="${group}"]`).getByRole('button', { name, exact: true }).click();
  const labels = () => frame.locator('#popts .optl');
  const go = () => frame.locator('#printGo').click();

  /* Answer sheets: a test, every test, or pages of a whole list */
  await expect(frame.locator('.pmenu .it[aria-current="true"] b')).toHaveText('Answer sheets');
  await expect(labels()).toHaveText(['Which test']);
  await expect(frame.locator('#pout')).toContainText('3 sheets, each with a child’s name · 100 HFW 41–60');
  await expect(frame.locator('#ppaper')).toHaveText('A4 · boxes numbered 1–20');
  await go();
  expect(await calls()).toEqual([['testSheets', 'Whole class · 100 HFW 41–60']]);
  await opt('Which test', 'All 2');
  await go();
  expect(await calls()).toEqual([['testSheets', 'Whole class · 100 HFW 41–60'], ['testSheets', 'Group · 200 HFW 1–10']]);
  await opt('Which test', 'A whole list');
  await expect(labels()).toHaveText(['Which test', 'Word list', 'Pages', 'Names']);
  await opt('Pages', 'Words 1–20');                      // off
  await opt('Names', 'Each child’s name on');
  await expect(labels()).toHaveText(['Which test', 'Word list', 'Pages', 'Names', 'Who']);
  await expect(frame.locator('#pout')).toContainText('12 sheets · 4 pages for each of 3 children');
  await go();
  expect(await calls()).toEqual([['sheets', 0, [1, 2, 3, 4], true, ['x1', 'x2', 'x3']]]);

  /* Dictation script */
  await pick('Dictation script');
  await expect(labels()).toHaveText(['Which test']);
  await opt('Which test', 'Group · 200 HFW 1–10');
  await go();
  await opt('Which test', 'A whole list');
  await frame.locator('#popts .seg[aria-label="Word list"] button', { hasText: 'Next 200 HFW' }).click();
  await go();
  expect(await calls()).toEqual([['testScript', 'Group · 200 HFW 1–10'], ['script', 1]]);

  /* Targeted check sheets: opens on the children ready to re-check */
  await pick('Targeted check sheets');
  await expect(labels()).toHaveText(['Who', 'Words each']);
  await expect(frame.locator('#pout')).toHaveText('1 sheet, each with its script');
  await opt('Words each', '20');
  await go();
  await opt('Who', 'Choose children');
  await opt('Children', 'Nell Gwyn');
  await opt('Children', 'Tam Lin');
  await go();
  expect(await calls()).toEqual([['targeted', ['x1'], 20], ['targeted', ['x2', 'x3'], 20]]);

  /* Daily practice books */
  await pick('Daily practice books');
  await expect(labels()).toHaveText(['Who', 'How long']);
  await expect(frame.locator('#pout')).toHaveText('3 books · 1 week');
  await expect(frame.locator('#ppaper')).toHaveText('A4, cut to A5 · stack and cut');
  await opt('How long', '2 weeks');
  await go();
  expect(await calls()).toEqual([['books', ['x1', 'x2', 'x3'], 'practice-books.pdf', 10]]);

  /* Flash cards: by band or by child, stacked or sheet by sheet */
  await pick('Flash cards');
  await opt('Whose words', 'A band');
  await expect(labels()).toHaveText(['Whose words', 'Word list', 'Bands', 'Layout', 'Per page', 'Sentence on the card']);
  await frame.locator('#popts .seg[aria-label="Word list"] button', { hasText: '100 HFW' }).first().click();
  await go();
  await opt('Whose words', 'Each child’s focus');
  await expect(labels()).toHaveText(['Whose words', 'Who', 'Cards per child', 'Layout', 'Per page', 'Sentence on the card']);
  await go();
  await opt('Layout', 'Sheet by sheet');
  await opt('Per page', '4 large');
  await opt('Sentence on the card', 'Yes');
  await go();
  expect(await calls()).toEqual([['stackLevels', [0], 'level-flash-cards-stack-and-cut.pdf'], ['stackPupils', ['x1', 'x2', 'x3'], 'flash-cards-stack-and-cut.pdf'],
    ['cards', ['Kit', 'Nell', 'Tam'], 'pupil-flash-cards.pdf', 4, true]]);

  /* Practice sheets */
  await pick('Practice sheets');
  await expect(labels()).toHaveText(['Activities', 'Whose words', 'Who']);
  await opt('Activities', 'Word search');                // off
  await go();
  expect(await calls()).toEqual([['acts', ['Kit Marlow', 'Nell Gwyn', 'Tam Lin'], 'practice-sheets.pdf', ['lcwc', 'trace', 'missing', 'sentences']]]);

  /* Word of the day has nothing to set */
  await pick('Word of the day');
  await expect(labels()).toHaveCount(0);
  await expect(frame.locator('#ppaper')).toHaveText('A4 landscape');
  await go();
  expect(await calls()).toEqual([['wotd']]);

  /* Class record: A3 or CSV */
  await pick('Class record');
  await expect(labels()).toHaveText(['Word list', 'Format']);
  await expect(frame.locator('#printGo')).toHaveText('Download PDF');
  await go();
  await opt('Format', 'Spreadsheet (CSV)');
  await expect(frame.locator('#printGo')).toHaveText('Download CSV');
  await go();
  expect(await calls()).toEqual([['grid', 0], ['csv']]);
});

test('Old tab ids land on the screen that replaced them; Practise and Review stay unreachable', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  const body = frame.locator('body');
  const land = id => body.evaluate((_, id) => { setTab(id); return S.tab; }, id);
  /* the first design's ids, and "week" from the Nov 2026 redesign */
  expect(await land('tracker')).toBe('class');
  expect(await land('groups')).toBe('tests');
  expect(await land('week')).toBe('tests');
  expect(await land('assess')).toBe('mark');
  expect(await land('quick')).toBe('mark');
  expect(await land('mark')).toBe('mark');
  expect(await land('plans')).toBe('pupils');
  expect(await land('print')).toBe('print');
  expect(await land('settings')).toBe('settings');
  const home = await body.evaluate(() => DEFAULT_TAB);
  expect(home).toBe('tests');
  expect(await land('practise')).toBe(home);
  expect(await land('review')).toBe(home);
  expect(await land('nonsense')).toBe(home);

  /* and a link with an old id in it */
  await blockExternal(page);
  await page.goto('/hundred-words.html#groups');
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await page.goto('/hundred-words.html#week');
  await page.reload();
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await page.goto('/hundred-words.html#assess');
  await page.reload();
  await expect(page.locator('#nav button[aria-current="page"]'), 'Mark sits under Tests').toHaveText('Tests');
  await page.goto('/hundred-words.html#practise');
  await page.reload();
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('#main')).not.toContainText('Choose a game');
});

/* A real account's data from before this redesign: it must load as it is, and
   every child's results must come out exactly as they did then. */
test('Data saved before the Tests redesign loads unchanged and gives every pupil the same results', async ({ page }) => {
  const errors = collectErrors(page);
  const snap = require('./data/hundred-words-before-tests.json');
  const before = JSON.stringify(snap.data);
  const frame = await openHW(page, { tp_hundred_words: before });
  const body = frame.locator('body');
  const results = () => body.evaluate(() => {
    const out = {};
    for (const id of pupilIds()) {
      const s = summary(id), p = buildPlan(id);
      out[id] = {
        states: s.ws.map(w => ({ none: '.', known: 'k', secure: 'S', notyet: 'n', slipped: 's', review: '?' }[w.st])).join(''),
        known: s.known, secure: s.secure, review: s.review, assessed: s.assessed, lastDate: s.lastDate, prevKnown: s.prevKnown, delta: s.delta,
        level: s.level, knownIn: s.knownIn, setDone: s.setDone, next: s.next, checks: s.sessions.length,
        focus: p.focus, revisit: p.revisit, nextUp: p.nextUp, focusN: p.focusN, ready: p.ready, plateau: p.plateau, gains: p.gains,
        reviewDate: p.assessed ? p.reviewDate : null, criteria: p.criteria, patterns: Object.fromEntries(Object.entries(p.pats).map(([k, v]) => [k, v.n])),
        cards: childCards(id), planWords: planWords(id)
      };
    }
    const tp = testPlan();
    return { pupils: out, testPlan: tp.tests.map(t => ({ whole: t.whole, title: t.title, words: t.words, pids: t.pids, target: t.target })), classMissed: classMissed(pupilIds().map(id => [id, summary(id)])).slice(0, 12) };
  });
  await expect(frame.locator('#main .panel').first()).toBeVisible();
  expect(Object.keys((await results()).pupils).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  expect(await results()).toEqual(snap.expected);

  /* looking at every screen writes nothing: the stored value is byte for byte what it was */
  for (const tab of ['Class', 'Pupils', 'Print', 'Tests']) {
    await frame.locator('#nav button', { hasText: tab }).click();
    await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText(tab);
  }
  await frame.locator('#cog').click();
  await frame.locator('.pcards, #clsName').first().waitFor();
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words'))).toBe(before);
  expect(await results()).toEqual(snap.expected);
  expect(errors).toEqual([]);
});
