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
/* Mark is reached from a test on the Check tab, in its Class & group tests mode */
async function openMark(frame) {
  await frame.locator('#nav button', { hasText: 'Check' }).click();
  await frame.locator('#mode-tests').click();
  await expect(frame.locator('#cList')).toBeVisible();
  if (!(await frame.locator('.trow').count())) {
    await frame.getByRole('button', { name: 'Plan the test' }).click();
    await frame.locator('#tPlan').getByRole('button', { name: /^Create \d+ tests?$/ }).click();
  }
  await frame.locator('.trow .tacts button[data-a="tMark"]').first().click();
  await expect(frame.locator('.markcard')).toBeVisible();
}
/* a date under Earlier tests, opened to show its tests */
async function earlier(frame, date) {
  const day = frame.locator(`#tEarlier .eday[data-date="${date}"]`);
  if ((await day.locator('.eline').getAttribute('aria-expanded')) !== 'true') await day.locator('.eline').click();
  await expect(day.locator('.eline')).toHaveAttribute('aria-expanded', 'true');
  return day;
}

test('Hundred Words shows the active class from the hub and saves under that class', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));

  await expect(frame.locator('#cls')).toHaveText('Year 3');
  /* three tabs and a settings cog; Check opens first */
  await expect(frame.locator('#nav button')).toHaveText(['Check', 'Progress', 'Print']);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  /* a class with no tests at all is offered the next one, and can still check one child */
  await expect(frame.locator('#tNext')).toContainText('Not planned yet');
  await expect(frame.locator('#tEarlier')).toHaveCount(0);
  await frame.getByRole('button', { name: /^1:1 check/ }).click();
  await expect(frame.locator('.tile')).toHaveCount(100);
  /* Mark opens from a test and sits under Tests. It is by hand only: no photo marking in the hub for now */
  await openMark(frame);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  await expect(frame.locator('#main')).not.toContainText('Mark photos');
  await expect(frame.locator('#nav button', { hasText: 'Practise' }), 'no practice games in the hub').toHaveCount(0);
  await expect(frame.locator('#nav button', { hasText: 'Review' }), 'no photo review queue in the hub').toHaveCount(0);
  await expect(frame.locator('.pl', { hasText: 'Kit Marlow' })).toHaveCount(1);
  await frame.locator('#nav button', { hasText: 'Progress' }).click();
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

  /* the settings cog: class name, capitals, apostrophes, voice, how levels work */
  await frame.locator('#cog').click();
  await expect(frame.locator('#cog')).toHaveAttribute('aria-current', 'page');
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveCount(0);
  await expect(frame.locator('#clsName')).toHaveValue('Year 3');
  await expect(frame.getByLabel('Require capitals for I, I’m, Mr and Mrs')).toBeVisible();
  await expect(frame.getByLabel('Accept it’s, don’t and I’m without the apostrophe')).toBeVisible();
  await expect(frame.locator('#voiceSel, #main p:has-text("can’t speak words aloud")').first()).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'How levels work' })).toBeVisible();
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
  await frame.locator('#nav button', { hasText: 'Progress' }).click();
  await expect(frame.locator('#main')).toContainText('Ava Bell');
  await expect(frame.locator('#main')).not.toContainText('Kit Marlow');
});

test('Mark saves each tap, so switching pupil and back keeps the marks', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  await openMark(frame);
  /* nobody is assessed, so the whole-class test on words 1–20 is loaded */
  await expect(frame.locator('#mTitle')).toHaveText(/^Every tap saves · Thu \d+ \w+ · Whole class 100 HFW 1–20$/);
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

test('Mark a test: opens from a planned test, every tap saves to the session for the test’s date, and Next goes round', async ({ page }) => {
  const errors = collectErrors(page);
  const extra = twoClasses('b');
  /* Kit has 1–10, so is working on 11–20; Nell is on 1–10. Kit also has a mark on the test's date that is not one of its words */
  const ten = {}; for (let i = 0; i < 10; i++) ten[i] = { s: 'c' };
  extra['tp_hundred_words::b'] = JSON.stringify({ practice: {}, plans: {}, settings: {}, sessions: {
    'x1_2026-10-01': { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: ten },
    'x1_2030-01-10': { pupilId: 'x1', date: '2030-01-10', kind: 'spelling', words: { 55: { s: 'x', src: 'manual', r: 'wot' } }, photos: [], updatedAt: 1 } },
    tests: { t1: { date: '2030-01-10', title: '100 HFW 1–20', whole: true, words: Array.from({ length: 20 }, (_, i) => i), pids: ['x1', 'x2'], createdAt: 1 } } });
  const frame = await openHW(page, extra);
  const sessions = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'))).sessions;
  const kit = async () => (await sessions())['x1_2030-01-10'];
  const row = frame.locator('.trow[data-test="t1"]');

  /* Mark, on the planned test's row */
  await expect(row.locator('.tprog')).toContainText('Not marked yet');
  await row.getByRole('button', { name: 'Mark', exact: true }).click();
  expect(await frame.locator('body').evaluate(() => [checkView(), S.tab, location.hash])).toEqual(['mark', 'mark', '#mark']);
  /* the mode cards stay on top; then back, and what is being marked */
  await expect(frame.locator('.modes .mode')).toHaveCount(2);
  await expect(frame.locator('#mode-tests')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('#mBack')).toHaveText('← Back to tests');
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Thu 10 Jan · Whole class 100 HFW 1–20');
  /* left: the children in the test */
  const list = frame.getByRole('region', { name: 'Children in this test' });
  await expect(list.locator('.phead')).toHaveText('2 children0 done');
  await expect(list.locator('.pl')).toHaveText(['Kit Marlow', 'Nell Gwyn']);
  await expect(list.locator('.pl .dot')).toHaveCount(2);
  await expect(list.locator('.pl[data-id="x1"]')).toHaveAttribute('aria-current', 'true');
  await expect(list.locator('.pl[data-id="x2"]')).toHaveAttribute('aria-current', 'false');
  /* right: the child, band and set, the score, the hint, and the test's words five to a row */
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');
  await expect(frame.locator('#mLevel')).toHaveText('Red · working on 100 HFW 11–20 · 0/10');
  await expect(frame.locator('#mLevel .dot')).toHaveCount(1);
  await expect(frame.locator('#mScore')).toHaveText('0/20');
  await expect(frame.locator('#mMarked')).toHaveText('0 marked');
  await expect(frame.locator('.markcard .note')).toHaveText('Tap once: ✓ correct · twice: ✗ not yet · three times: clear. Blue outline = the set they’re working on.');
  const tiles = frame.locator('.tiles .tile');
  await expect(tiles).toHaveCount(20);
  await expect(tiles.locator('.n')).toHaveText(Array.from({ length: 20 }, (_, i) => String(i + 1)));
  /* five to a row; three once the page is phone width (the class project's frame is under 760px) */
  expect(await frame.locator('.tiles').evaluate(el => [getComputedStyle(el).gridTemplateColumns.split(' ').length, innerWidth > 760 ? 5 : 3])).toEqual(await frame.locator('body').evaluate(() => innerWidth > 760 ? [5, 5] : [3, 3]));
  expect(await tiles.evaluateAll(els => els.every(e => e.tagName === 'BUTTON' && e.type === 'button' && e.getBoundingClientRect().height >= 44))).toBe(true);
  /* nothing else: no test picker, date, kind switch, list picker, "what they wrote", delete or "last time" */
  await expect(frame.locator('#mTest, #qDate, #mDel, .markbar, .tile .hint, .wrote, [data-a="qkind"], [data-a="qList"], [data-a="qClear"], [data-a="qWroteToggle"]')).toHaveCount(0);
  await expect(frame.locator('.markcard button:not(.tile)')).toHaveText(['Mark the rest correct', 'Next: Nell →']);

  /* the blue outline: only unmarked words of the set the child is working on (Kit: 11–20) */
  const outlined = () => frame.locator('.tile.focus').evaluateAll(els => els.map(e => +e.dataset.i));
  expect(await outlined()).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  const blue = await frame.locator('.tile[data-i="10"]').evaluate(el => getComputedStyle(el).borderTopColor);
  expect(await frame.locator('.tile[data-i="9"]').evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(blue);

  /* once: correct — saved at once, to the session for (Kit, the test's date), in the shape a quick check writes */
  const was = frame.locator('.tile[data-i="10"]');
  await expect(was).toHaveAttribute('aria-label', 'was, not marked');
  await was.click();
  await expect(was).toHaveAttribute('aria-label', 'was, correct');
  await expect(was.locator('.tk')).toHaveText('✓');
  await expect(was, 'the keyboard stays on the word').toBeFocused();
  await expect(frame.locator('#mScore')).toHaveText('1/20');
  await expect(frame.locator('#mMarked')).toHaveText('1 marked');
  let ses = await kit();
  expect(Object.keys(ses).sort()).toEqual(['date', 'kind', 'photos', 'pupilId', 'updatedAt', 'words']);
  expect(ses).toMatchObject({ pupilId: 'x1', date: '2030-01-10', kind: 'spelling', photos: [] });
  expect(ses.words).toEqual({ 10: { s: 'c', src: 'manual' }, 55: { s: 'x', src: 'manual', r: 'wot' } });      // the mark from elsewhere that day is untouched
  expect(Object.keys(await sessions()).sort(), 'no other session is written').toEqual(['x1_2026-10-01', 'x1_2030-01-10']);
  expect(await outlined(), 'a marked word loses the outline').toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
  await expect(list.locator('.pl[data-id="x1"] .st')).toHaveText('1/20');
  await expect(list.locator('.pl[data-id="x1"] .st')).not.toHaveClass(/done/);
  /* twice: not yet */
  await was.click();
  await expect(was).toHaveAttribute('aria-label', 'was, not yet');
  await expect(was.locator('.tk')).toHaveText('✗');
  await expect(frame.locator('#mScore')).toHaveText('0/20');
  await expect(frame.locator('#mMarked')).toHaveText('1 marked');
  expect((await kit()).words).toEqual({ 10: { s: 'x', src: 'manual' }, 55: { s: 'x', src: 'manual', r: 'wot' } });
  /* three times: clear — the word leaves the session, and it is outlined again */
  await was.click();
  await expect(was).toHaveAttribute('aria-label', 'was, not marked');
  await expect(was.locator('.tk')).toHaveText('');
  expect((await kit()).words).toEqual({ 55: { s: 'x', src: 'manual', r: 'wot' } });
  expect(await outlined()).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  await expect(list.locator('.pl[data-id="x1"] .st')).toHaveText('');

  /* Mark the rest correct: only the unmarked ones; what was typed for a word already marked stays */
  await frame.locator('body').evaluate(() => { const s = S.sessions['x1_2030-01-10']; saveDoc('sessions', 'x1_2030-01-10', { ...s, words: { ...s.words, 4: { s: 'x', src: 'manual', r: 'sed' } } }); });
  await expect(frame.locator('.tile[data-i="4"]')).toHaveClass(/\bx\b/);
  await expect(list.locator('.pl[data-id="x1"] .st')).toHaveText('1/20');
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await expect(frame.locator('#mScore')).toHaveText('19/20');
  await expect(frame.locator('#mMarked')).toHaveText('20 marked');
  await expect(frame.locator('.tile.c')).toHaveCount(19);
  await expect(frame.locator('.tile.focus')).toHaveCount(0);
  ses = await kit();
  expect(ses.words['4']).toEqual({ s: 'x', src: 'manual', r: 'sed' });
  expect(ses.words['0']).toEqual({ s: 'c', src: 'manual' });
  expect(ses.words['55']).toEqual({ s: 'x', src: 'manual', r: 'wot' });
  expect(Object.keys(ses.words).length).toBe(21);
  await expect(list.locator('.pl[data-id="x1"] .st')).toHaveText('✓ done');
  await expect(list.locator('.pl[data-id="x1"] .st')).toHaveClass(/done/);
  await expect(list.locator('.phead')).toContainText('1 done');
  await expect(frame.locator('#mLevel'), 'said is not yet, so Kit is back on 1–10: the rules are the same as ever').toHaveText('Pink · working on 100 HFW 1–10 · 9/10');

  /* Next moves on, and goes round from the last child */
  await frame.getByRole('button', { name: 'Next: Nell →' }).click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await expect(list.locator('.pl[data-id="x2"]')).toHaveAttribute('aria-current', 'true');
  await expect(frame.locator('#mLevel')).toHaveText('Pink · working on 100 HFW 1–10 · 0/10');
  await expect(frame.locator('#mScore')).toHaveText('0/20');
  await expect(frame.locator('.tile.c, .tile.x')).toHaveCount(0);
  expect(await outlined(), 'Nell is on 1–10').toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await expect(frame.getByRole('button', { name: 'Next: Kit →' })).toBeFocused();
  await frame.locator('.tile[data-i="0"]').click();
  expect((await sessions())['x2_2030-01-10'].words).toEqual({ 0: { s: 'c', src: 'manual' } });
  expect((await kit()).words['0'], 'Kit’s marks are his own').toEqual({ s: 'c', src: 'manual' });
  await frame.getByRole('button', { name: 'Next: Kit →' }).click();
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');
  await expect(frame.locator('#mScore')).toHaveText('19/20');
  /* a child's button opens them */
  await list.locator('.pl[data-id="x2"]').click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await expect(frame.locator('.tile[data-i="0"]')).toHaveClass(/\bc\b/);
  /* clearing a child's only mark removes the session it would leave empty */
  await frame.locator('.tile[data-i="0"]').click();
  await frame.locator('.tile[data-i="0"]').click();
  await expect(frame.locator('.tile[data-i="0"]')).toHaveAttribute('aria-label', 'the, not marked');
  expect(Object.keys(await sessions()).sort(), 'a session with nothing in it is removed').toEqual(['x1_2026-10-01', 'x1_2030-01-10']);

  /* back on the list the row has caught up */
  await frame.locator('#mBack').click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  expect(await frame.locator('body').evaluate(() => [checkView(), location.hash])).toEqual(['list', '#check']);
  await expect(row.locator('.tprog')).toContainText('1 of 2 marked');
  await expect(row.locator('.tacts button')).toHaveText(['Print sheets', 'Carry on marking', '⋯']);
  await expect(frame.locator('.day[data-date="2030-01-10"] .dayhead .pill')).toHaveText('1 child still to mark');
  /* Carry on marking opens the same screen with the marks there */
  await row.getByRole('button', { name: 'Carry on marking' }).click();
  await expect(frame.locator('#mScore')).toHaveText('19/20');
  await expect(frame.locator('.tile.x .wd')).toHaveText(['said']);
  expect(errors).toEqual([]);
});

test('Marking a test, then Progress: ten out of ten on their set moves a child up a set', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));
  const progress = async () => { await frame.locator('#nav button', { hasText: 'Progress' }).click(); await expect(frame.locator('table.sg')).toBeVisible(); };
  /* nobody has been checked: both children are in the first band's column, with no set done */
  await progress();
  await expect(frame.locator('.bandcol[data-set="0"] .nm')).toHaveText(['Kit', 'Nell']);
  await expect(frame.locator('.bandcol[data-set="1"] .nm')).toHaveCount(0);
  await expect(frame.locator('table.sg tbody tr', { hasText: 'Kit Marlow' }).locator('.cell.d')).toHaveCount(0);
  const before = await frame.locator('body').evaluate(() => [summary('x1').level, summary('x2').level]);
  expect(before).toEqual([0, 0]);

  /* plan the whole-class test (1–20) and mark Kit's current set, 1–10, all correct */
  await openMark(frame);
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');
  await expect(frame.locator('#mLevel')).toHaveText('Pink · working on 100 HFW 1–10 · 0/10');
  for (let i = 0; i < 9; i++) await frame.locator(`.tile[data-i="${i}"]`).click();
  await expect(frame.locator('#mLevel'), 'nine of ten is not the set').toHaveText('Pink · working on 100 HFW 1–10 · 9/10');
  await frame.locator('.tile[data-i="9"]').click();
  await expect(frame.locator('#mScore')).toHaveText('10/20');
  await expect(frame.locator('#mLevel')).toHaveText('Red · working on 100 HFW 11–20 · 0/10');
  /* the outline follows them to the set they are on now */
  expect(await frame.locator('.tile.focus').evaluateAll(els => els.map(e => +e.dataset.i))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  /* Nell gets one wrong in hers */
  await frame.getByRole('button', { name: 'Next: Nell →' }).click();
  for (let i = 0; i < 10; i++) await frame.locator(`.tile[data-i="${i}"]`).click();
  await frame.locator('.tile[data-i="4"]').click();       // ✓ → ✗

  /* Progress has caught up: Kit is in the next band's column, with a set done; Nell has not moved */
  await progress();
  await expect(frame.locator('.bandcol[data-set="1"] .nm')).toHaveText(['Kit']);
  await expect(frame.locator('.bandcol[data-set="0"] .nm')).toHaveText(['Nell']);
  await expect(frame.locator('table.sg tbody tr', { hasText: 'Kit Marlow' }).locator('.cell.d')).toHaveCount(1);
  await expect(frame.locator('table.sg tbody tr', { hasText: 'Nell Gwyn' }).locator('.cell.d')).toHaveCount(0);
  await expect(frame.locator('.stat4 .stat').nth(0)).toContainText('10/100');        // (10 + 9) / 2, rounded
  await expect(frame.locator('#main')).toContainText('2 of 2 assessed');
  expect(await frame.locator('body').evaluate(() => [summary('x1').level, summary('x2').level])).toEqual([1, 0]);
  /* and the test itself counts Kit as having moved on */
  expect(await frame.locator('body').evaluate(() => { const t = allTests()[0], lv = levelsBy('x1')[t.date]; return lv; })).toEqual([0, 1]);
  expect(errors).toEqual([]);
});

test('Mark a test at phone width: the children are a strip, the words three to a row, and nothing runs off the side', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const frame = await openPlan(page), body = frame.locator('body');
  await frame.locator('#tPlan').getByRole('button', { name: /^Create \d+ tests?$/ }).click();
  await frame.locator('.trow [data-a="tMark"]').first().click();
  await expect(frame.locator('.markcard')).toBeVisible();
  expect(await body.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator('.tiles').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
  /* eight children in one row that scrolls inside its card, each a 44px target */
  expect(await frame.locator('.pls').evaluate(e => getComputedStyle(e).flexDirection === 'row' && e.scrollWidth > e.clientWidth)).toBe(true);
  expect(await frame.locator('.pl, .tile, .markcard .btn, #mBack').evaluateAll(els => els.every(e => e.offsetHeight >= 44 && e.offsetWidth >= 44))).toBe(true);
  /* Next brings the open child into view in the strip */
  /* each Next is a render on the next frame: wait for the strip to show the child it moved to before pressing again */
  const current = () => frame.locator('.pl[aria-current="true"]').evaluate(e => [...e.parentElement.children].indexOf(e));
  const seen = () => frame.locator('.pls').evaluate(sc => { const a = sc.getBoundingClientRect(), b = sc.querySelector('.pl[aria-current="true"]').getBoundingClientRect(); return b.left >= a.left - 1 && b.left < a.right; });
  for (let k = 1; k <= 6; k++) { await frame.locator('#mNext').click(); await expect.poll(current, 'Next ' + k).toBe(k); }
  expect(await frame.locator('.pls').evaluate(sc => sc.scrollLeft), 'the strip has scrolled to them').toBeGreaterThan(0);
  await expect.poll(seen).toBe(true);
  await frame.locator('.tile').first().click();
  await expect(frame.locator('.tile').first()).toHaveClass(/\bc\b/);
  await expect.poll(current).toBe(6);
  await expect.poll(seen).toBe(true);
  expect(await body.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('The 1:1 check still has the date, Spelling or Reading, what they wrote and “last time”', async ({ page }) => {
  const extra = twoClasses('b');
  const w = {}; for (let i = 0; i < 10; i++) w[i] = { s: i === 4 ? 'x' : 'c', src: 'manual' };
  extra['tp_hundred_words::b'] = JSON.stringify({ practice: {}, plans: {}, settings: {}, sessions: { 'x1_2026-10-01': { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: w, photos: [], updatedAt: 1 } } });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'))).sessions;
  /* Kit got 9/10 on 1–10, so is still on it: "✗ last time" shows from a later check */
  await frame.locator('#mode-one').click();
  await expect(frame.locator('.tile')).toHaveCount(100);
  await frame.locator('#qDate').fill('2030-01-01');
  await frame.locator('.pl[data-id="x1"]').click();
  await expect(frame.locator('.tile.focus')).toHaveCount(10);
  await expect(frame.locator('.tile[data-i="4"] .hint')).toHaveText('✗ last time');
  await expect(frame.locator('.tile[data-i="3"] .hint')).toHaveText('✓ last time');
  await frame.getByRole('button', { name: 'Reading' }).click();
  const said = frame.locator('.tile[data-i="4"]');
  await said.click(); await said.click();
  await frame.getByRole('button', { name: 'Add what they wrote' }).click();
  await frame.locator('#wr4').fill('sed');
  await frame.locator('#wr4').blur();
  await expect.poll(async () => ((await stored())['x1_2030-01-01'] || {}).words).toEqual({ 4: { s: 'x', src: 'manual', r: 'sed' } });
  expect((await stored())['x1_2030-01-01']).toMatchObject({ kind: 'reading', date: '2030-01-01', pupilId: 'x1' });
});

test('Mark opens from a test; a fully marked test re-opens with its marks, and they can be changed', async ({ page }) => {
  const extra = twoClasses('b');
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {},
    tests: { t1: { date: '2030-01-10', title: '100 HFW 21–30', whole: false, words: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29], pids: ['x2'], createdAt: 5 } }, settings: {} });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));

  /* the past whole-class test is fully marked: Results opens it with the saved marks */
  const past = (await earlier(frame, '2026-10-01')).locator('.trow').nth(0);
  await past.getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Thu 1 Oct · Whole class 100 HFW 1–20');
  await expect(frame.locator('.pl')).toHaveCount(2);
  await expect(frame.locator('.pl .st')).toHaveText(['✓ done', '✓ done']);
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');
  await expect(frame.locator('#mScore')).toHaveText('18/20');
  await expect(frame.locator('.tile.x .wd')).toHaveText(['said', 'they']);
  /* change a mark: said was right after all */
  await frame.locator('.tile[data-i="4"]').click();       // ✗ → clear
  await frame.locator('.tile[data-i="4"]').click();       // → ✓
  await expect(frame.locator('#mScore')).toHaveText('19/20');
  const ses = (await stored()).sessions['x1_2026-10-01'];
  expect(ses.words['4'].s).toBe('c');
  expect(ses.date).toBe('2026-10-01');
  expect(Object.keys(ses.words).length).toBe(20);
  /* ← Back to tests goes back, and the test shows the new result */
  await frame.locator('#mBack').click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(past.locator('.tprog')).toContainText('All 2 marked');
  await expect(past.locator('.tacts button')).toHaveText(['Print sheets', 'Results', '⋯']);

  /* a planned test opens from its own row, with only its children and words */
  await frame.locator('.trow[data-test="t1"]').getByRole('button', { name: 'Mark', exact: true }).click();
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Thu 10 Jan · Group 100 HFW 21–30');
  await expect(frame.locator('.pl')).toHaveCount(1);
  await expect(frame.locator('.tile')).toHaveCount(10);
  await expect(frame.locator('.tile .n')).toHaveText(['21', '22', '23', '24', '25', '26', '27', '28', '29', '30']);
  await expect(frame.locator('.tile .hint'), 'no "last time" on a test').toHaveCount(0);
  await frame.locator('.tile[data-i="25"]').click();
  expect((await stored()).sessions['x2_2030-01-10'].words).toEqual({ 25: { s: 'c', src: 'manual' } });
  /* the test's date is no longer changed from Mark; moveTest() still moves a test and its marks, and Mark follows */
  await frame.locator('body').evaluate(() => { moveTest(findTest('t1'), '2030-01-11'); });
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Fri 11 Jan · Group 100 HFW 21–30');
  await expect(frame.locator('.tile[data-i="25"]')).toHaveClass(/\bc\b/);
  const doc = await stored();
  expect(doc.tests.t1.date).toBe('2030-01-11');
  expect(doc.sessions['x2_2030-01-10']).toBeUndefined();
  expect(doc.sessions['x2_2030-01-11'].words).toEqual({ 25: { s: 'c', src: 'manual' } });
  /* an edit made on Tests shows in Mark */
  await frame.locator('body').evaluate(() => { saveTest('t1', { ...findTest('t1'), pids: ['x1', 'x2'] }); });
  await expect(frame.locator('.pl')).toHaveCount(2);
});

test('Mark: a past test stays open and re-markable after its first word is cleared, and moveTest() still moves it with its marks', async ({ page }) => {
  const extra = twoClasses('b');
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  /* Nell's own past test, 21–30: clear its first word, so the test worked out from the sessions now starts at 22 */
  await (await earlier(frame, '2026-10-01')).locator('.trow').nth(1).getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('.tile')).toHaveCount(10);
  await frame.locator('.tile[data-i="20"]').click();      // ✓ → ✗
  await frame.locator('.tile[data-i="20"]').click();      // → clear
  await expect(frame.locator('.tile[data-i="20"]')).toHaveAttribute('aria-label', 'that, not marked');
  await expect(frame.locator('.tile')).toHaveCount(10);
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Thu 1 Oct · Group 100 HFW 21–30');
  /* it can be marked again, on the same date */
  await frame.locator('.tile[data-i="20"]').click();
  await expect(frame.locator('.tile[data-i="20"]')).toHaveAttribute('aria-label', 'that, correct');
  expect((await stored()).sessions['x2_2026-10-01'].words['20']).toEqual({ s: 'c', src: 'manual' });
  await frame.locator('.tile[data-i="20"]').click();
  await frame.locator('.tile[data-i="20"]').click();      // clear again
  await expect(frame.locator('.tile.c, .tile.x')).toHaveCount(9);
  expect(Object.keys((await stored()).tests || {}), 'marking a past test saves no record').toEqual([]);
  /* Mark has no date field for a test now. moveTest() is kept: the test as it was opened moves, to the day
     both children sat 1–20 — Nell has no marks for 21–30 words there */
  const snap = () => frame.locator('body').evaluate(() => ({ ...S.ui.quick.snap, date: S.ui.date }));
  await frame.locator('body').evaluate((_, t) => { S.ui.quick.testId = moveTest(t, '2026-10-02'); S.ui.date = '2026-10-02'; render(); }, await snap());
  await expect(frame.locator('.tile.c, .tile.x')).toHaveCount(9);
  let doc = await stored();
  expect(Object.keys(doc.sessions['x2_2026-10-02'].words).length, 'the nine marks went with the test').toBe(9);
  expect(Object.keys(doc.sessions['x2_2026-10-01'].words).length, 'and 1–20 stayed').toBe(20);
  const rec = Object.values(doc.tests);
  expect(rec.length).toBe(1);
  expect(rec[0]).toMatchObject({ date: '2026-10-02', title: '100 HFW 21–30', pids: ['x2'] });
  expect(rec[0].words.length).toBe(10);
  /* and moveClashes() still names the children whose marks a move would replace */
  await frame.locator('body').evaluate(() => { S.sessions['x2_2026-10-05'] = { pupilId: 'x2', date: '2026-10-05', kind: 'spelling', words: { 25: { s: 'x', src: 'manual' } }, photos: [], updatedAt: 1 }; memo = {}; });
  expect(await frame.locator('body').evaluate(() => moveClashes(findTest(S.ui.quick.testId), '2026-10-05'))).toEqual(['x2']);
  expect(await frame.locator('body').evaluate(() => moveClashes(findTest(S.ui.quick.testId), '2026-10-06'))).toEqual([]);
});

test('The test plan: sets of ten in order across the three lists, and a whole-class test where most children are', async ({ page }) => {
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
  const plan = await page.frameLocator('#hwFrame').locator('body').evaluate(() =>
    testPlan().tests.map(t => ({ title: t.title, n: t.words.length, target: t.target.length })));
  /* x1 and x3 are both on 41–50: that is the whole-class test; x2 is tested
     on the first set of the next 200 */
  expect(plan[0]).toEqual({ title: 'Whole class · 100 HFW 41–60', n: 20, target: 2 });
  expect(plan[1]).toEqual({ title: 'Group · 200 HFW 1–10', n: 10, target: 1 });
  /* 409 words: 100 + 200 + 109 Year 3/4 common exception words */
  expect(await page.frameLocator('#hwFrame').locator('body').evaluate(() => [WORDS.length, SENT.length, NSETS])).toEqual([409, 409, 41]);

  /* "Plan the test" shows that plan before anything is saved, under the mode cards */
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await expect(frame.locator('.mode')).toHaveCount(2);
  await expect(frame.locator('#cList')).toHaveCount(0);
  const form = frame.locator('#tPlan');
  await expect(form.locator('#pSum')).toContainText('Words 41–60 · Green & Orange');
  await expect(form.locator('#pSum')).toContainText('The set they’re working on for 2 of 3 children. Everyone else sits it too.');
  await expect(form.locator('#pSum')).toContainText('100 high frequency words');
  await expect(form).toContainText('200 HFW 1–10');
  await expect(form.getByRole('button', { name: 'Create 2 tests' })).toBeVisible();
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(frame.locator('#tPlan')).toHaveCount(0);
  await expect(frame.locator('#cList')).toBeVisible();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'))).tests, 'nothing saved by looking').toBeUndefined();
});

/* x1 and x2 sat words 1–20 on 1 Oct, before tests were stored; x2 also sat 21–30 */
function oldSessions() {
  const words = (a, b, wrong = []) => { const w = {}; for (let i = a; i < b; i++) w[i] = { s: wrong.includes(i) ? 'x' : 'c', src: 'manual' }; return w; };
  return {
    'x1_2026-10-01': { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: words(0, 20, [4, 12]), photos: [], updatedAt: 1 },
    'x2_2026-10-01': { pupilId: 'x2', date: '2026-10-01', kind: 'spelling', words: { ...words(0, 20), ...words(20, 30, [25]) }, photos: [], updatedAt: 1 }
  };
}

test('Check: the next-test card, planned tests by date, a row from not marked to all marked, ⋯, and earlier tests', async ({ page }) => {
  const errors = collectErrors(page);
  const extra = twoClasses('b');
  const before = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {}, settings: {} });
  extra['tp_hundred_words::b'] = before;
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));

  /* nothing is planned: a dashed card names the next test's day (the planner's Thursday) and offers to plan it */
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  const nextDay = await frame.locator('body').evaluate(() => dayName(nextThursday()));
  expect(nextDay).toMatch(/^Thursday \d+ \w+$/);
  await expect(frame.locator('#tNext h2')).toHaveText('Next test: ' + nextDay);
  await expect(frame.locator('#tNext')).toContainText('Not planned yet. Planning shows which words the whole class will do, and who needs a smaller group test.');
  await expect(frame.locator('#tNext').getByRole('button', { name: 'Plan the test' })).toBeVisible();
  await expect(frame.locator('.day[data-date]'), 'no planned date yet').toHaveCount(0);
  await expect(frame.getByRole('button', { name: '+ Plan another test' })).toHaveCount(0);

  /* no test was ever saved, yet 1 Oct is under Earlier tests, one line for the date: the test both children sat, and Nell's own */
  const line = frame.locator('#tEarlier .eday[data-date="2026-10-01"] .eline');
  await expect(frame.locator('#tEarlier h2')).toHaveText('Earlier tests');
  await expect(line.locator('.et')).toHaveText(/^Thu,? 1 Oct( 2026)? · Whole class 100 HFW 1–20 · Group 100 HFW 21–30$/);   // the year shows once it is no longer this year
  await expect(line.locator('.pill')).toHaveText('All marked');
  await expect(line).toHaveAttribute('aria-expanded', 'false');
  await expect(frame.locator('.trow')).toHaveCount(0);
  /* the line opens to the same rows a planned test has, so a past test can still be printed, re-marked or deleted */
  const day = await earlier(frame, '2026-10-01');
  const rows = day.locator('.trow');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.tname')).toContainText('Whole class100 HFW 1–20');
  await expect(rows.nth(0).locator('.tname')).toContainText('Everyone · Pink & Red words');
  await expect(rows.nth(0).locator('.tprog')).toContainText('All 2 marked');
  await expect(rows.nth(1).locator('.tname')).toContainText('Group100 HFW 21–30');
  await expect(rows.nth(1).locator('.tname .muted')).toHaveText('Nell');
  await expect(rows.nth(0).locator('.tacts button')).toHaveText(['Print sheets', 'Results', '⋯']);
  await expect(rows.nth(0).getByRole('button', { name: 'Results' }), 'fully marked: Results is not the primary button').not.toHaveClass(/primary/);
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')), 'showing past tests rewrites nothing').toBe(before);

  /* Print sheets and the dictation script go through the existing generators; the script is under ⋯ */
  await frame.locator('body').evaluate(() => { window.__calls = [];
    PDF.testSheets = t => window.__calls.push(['sheets', t.title, t.words.length, t.pids]); PDF.testScript = t => window.__calls.push(['script', t.title, t.words.length]); });
  await rows.nth(0).getByRole('button', { name: 'Print sheets' }).click();
  const more = rows.nth(1).locator('.tmore');
  await expect(more).toHaveAttribute('aria-label', 'More for 100 HFW 21–30: dictation script, delete');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(frame.locator('.tmenu')).toHaveCount(0);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(more, 'the focus stays on ⋯').toBeFocused();
  await expect(frame.locator('.tmenu button')).toHaveText(['Dictation script', 'Delete test']);
  await frame.locator('.tmenu').getByRole('button', { name: 'Dictation script' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls.splice(0))).toEqual([
    ['sheets', 'Whole class · 100 HFW 1–20', 20, ['x1', 'x2']], ['script', 'Group · 100 HFW 21–30', 10]]);
  /* one menu at a time, and ⋯ again closes it */
  await rows.nth(0).locator('.tmore').click();
  await expect(frame.locator('.tmenu')).toHaveCount(1);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await rows.nth(0).locator('.tmore').click();
  await expect(frame.locator('.tmenu')).toHaveCount(0);

  /* what the spec does not list is not on this screen */
  await expect(frame.locator('.tbar, .f, #tDet, .tres, .pcard')).toHaveCount(0);
  for (const name of ['Change date', 'Edit words or children', 'Print practice sheets', 'All tests', 'Still to mark']) await expect(frame.getByRole('button', { name })).toHaveCount(0);

  /* plan the next tests for a date the teacher picks */
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await expect(frame.locator('#tPlanDate')).toHaveValue(await frame.locator('body').evaluate(() => nextThursday()));
  await frame.locator('#tPlanDate').fill('2030-01-10');
  await frame.locator('#tPlan').getByRole('button', { name: 'Create 2 tests' }).click();
  const tests = Object.values((await stored()).tests).sort((a, b) => a.createdAt - b.createdAt);
  expect(tests.map(t => [t.date, t.title, t.whole, t.words.length, t.words[0], t.pids])).toEqual([
    ['2030-01-10', '100 HFW 1–20', true, 20, 0, ['x1', 'x2']],        // Kit is on 1–10: most children... both sit it
    ['2030-01-10', '100 HFW 21–30', false, 10, 20, ['x2']]]);
  expect(Object.keys(tests[0]).sort(), 'exactly the documented record').toEqual(['createdAt', 'date', 'pids', 'title', 'whole', 'words']);
  expect((await stored()).sessions, 'planning a test touches no session').toEqual(JSON.parse(before).sessions);

  /* planned: a card for the date, with a pill for the children still to mark; the next-test card has gone */
  await expect(frame.locator('#cList')).toBeVisible();
  await expect(frame.locator('#tNext')).toHaveCount(0);
  const next = frame.locator('.day[data-date="2030-01-10"]');
  await expect(next.locator('h2')).toHaveText('Thursday 10 January 2030');
  const pill = next.locator('.dayhead .pill');
  await expect(pill).toHaveText('2 children still to mark');       // Kit and Nell: Nell is in both tests, and is one child
  await expect(pill).toHaveClass(/\brev\b/);
  const whole = next.locator('.trow').nth(0), group = next.locator('.trow').nth(1);
  await expect(whole.locator('.tname .pill')).toHaveText('Whole class');
  await expect(whole.locator('.tname')).toContainText('Everyone · Pink & Red words');
  await expect(group.locator('.tname .pill')).toHaveText('Group');
  await expect(group.locator('.tname .muted')).toHaveText('Nell');
  for (const r of [whole, group]) {
    await expect(r.locator('.tprog')).toContainText('Not marked yet');
    await expect(r.locator('.tacts button')).toHaveText(['Print sheets', 'Mark', '⋯']);
    await expect(r.getByRole('button', { name: 'Mark' })).toHaveClass(/primary/);
  }
  await expect(next.getByRole('button', { name: '+ Plan another test' })).toBeVisible();
  await expect(frame.locator('#tEarlier .eday')).toHaveCount(1);
  /* planning the same date again adds nothing */
  await next.getByRole('button', { name: '+ Plan another test' }).click();
  await expect(frame.locator('#tPlanDate'), 'that Thursday is taken, so the one after is offered').not.toHaveValue('2030-01-10');
  await frame.locator('#tPlanDate').fill('2030-01-10');
  await frame.locator('#tPlan').getByRole('button', { name: 'Create 2 tests' }).click();
  await expect(next.locator('.trow')).toHaveCount(2);

  /* a row goes Not marked yet → x of y marked → All y marked, and its button Mark → Carry on marking → Results */
  await group.getByRole('button', { name: 'Mark' }).click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await frame.locator('#mBack').click();
  await expect(group.locator('.tprog')).toContainText('All 1 marked');
  await expect(group.locator('.bar i')).toHaveClass(/full/);
  await expect(group.locator('.tacts button')).toHaveText(['Print sheets', 'Results', '⋯']);
  await expect(pill, 'Nell still has the whole-class test to mark').toHaveText('2 children still to mark');
  await whole.getByRole('button', { name: 'Mark' }).click();
  await expect(frame.locator('#who')).toHaveText('Kit Marlow');
  await frame.locator('.tile[data-i="0"]').click();
  await frame.locator('#nav button', { hasText: 'Check' }).click();
  await expect(whole.locator('.tprog'), 'one word is not a marked child').toContainText('Not marked yet');
  await expect(whole.locator('.tacts button')).toHaveText(['Print sheets', 'Carry on marking', '⋯']);
  await whole.getByRole('button', { name: 'Carry on marking' }).click();
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await frame.locator('#mBack').click();
  await expect(whole.locator('.tprog')).toContainText('1 of 2 marked');
  await expect(whole.locator('.bar')).toHaveAttribute('aria-label', '1 of 2 marked');
  await expect(whole.getByRole('button', { name: 'Carry on marking' })).toHaveClass(/primary/);
  await expect(pill).toHaveText('1 child still to mark');
  await whole.getByRole('button', { name: 'Carry on marking' }).click();
  await frame.getByRole('button', { name: /^Next/ }).click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await frame.locator('#mBack').click();
  await expect(whole.locator('.tprog')).toContainText('All 2 marked');
  await expect(whole.locator('.tacts button')).toHaveText(['Print sheets', 'Results', '⋯']);
  await expect(pill).toHaveText('All marked');
  await expect(pill).toHaveClass(/\bok\b/);
  /* with everything dated today or later marked, the next test is offered again; the marked one stays listed */
  await expect(frame.locator('#tNext h2')).toHaveText('Next test: ' + nextDay);
  await expect(next.locator('.trow')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Check: a past date stays on the main list while it is being marked, then drops to Earlier tests', async ({ page }) => {
  const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ten = Array.from({ length: 10 }, (_, i) => i), marks = Object.fromEntries(ten.map(i => [i, { s: 'c', src: 'manual' }]));
  const T = (date, pids) => ({ date, title: '100 HFW 1–10', whole: true, words: ten, pids, createdAt: 1 });
  const ses = (pid, date) => ({ [pid + '_' + date]: { pupilId: pid, date, kind: 'spelling', words: marks, photos: [], updatedAt: 1 } });
  const extra = twoClasses('b');
  extra['tp_hundred_words::b'] = JSON.stringify({ practice: {}, plans: {}, settings: {},
    /* three days ago: Kit marked, Nell not. Five days ago: both marked. Three weeks ago: Nell never marked. */
    sessions: { ...ses('x1', day(-3)), ...ses('x1', day(-5)), ...ses('x2', day(-5)), ...ses('x1', day(-21)) },
    tests: { recent: T(day(-3), ['x1', 'x2']), done: T(day(-5), ['x1', 'x2']), old: T(day(-21), ['x1', 'x2']) } });
  const frame = await openHW(page, extra);
  /* nothing is dated today or later, so the next test is offered, above the one still being marked */
  await expect(frame.locator('#tNext')).toBeVisible();
  await expect(frame.locator('.day[data-date]')).toHaveCount(1);
  const open = frame.locator(`.day[data-date="${day(-3)}"]`);
  await expect(open.locator('.dayhead .pill')).toHaveText('1 child still to mark');
  await expect(open.locator('.trow .tprog')).toContainText('1 of 2 marked');
  await expect(open.getByRole('button', { name: 'Carry on marking' })).toBeVisible();
  /* newest first under Earlier tests, each with its pill */
  await expect(frame.locator('#tEarlier .eday')).toHaveCount(2);
  await expect(frame.locator('#tEarlier .eday').nth(0)).toHaveAttribute('data-date', day(-5));
  await expect(frame.locator('#tEarlier .eday .pill')).toHaveText(['All marked', '1 child still to mark']);
  /* and the old unfinished one can still be marked from there */
  await (await earlier(frame, day(-21))).getByRole('button', { name: 'Carry on marking' }).click();
  await expect(frame.locator('.pl .st')).toHaveText(['✓ done', '']);
});

test('Check: the two mode cards head every Check screen, and switch at once', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));
  const cards = frame.locator('.modes .mode'), tests = frame.locator('#mode-tests'), one = frame.locator('#mode-one');
  const pressed = async (a, b) => { await expect(cards).toHaveCount(2); await expect(tests).toHaveAttribute('aria-pressed', a); await expect(one).toHaveAttribute('aria-pressed', b); };
  /* the list: Class & group tests is the default */
  await expect(frame.getByRole('group', { name: 'How are you checking?' })).toBeVisible();
  await expect(tests).toHaveText('Class & group testsYou read the words out; children write them');
  await expect(one).toHaveText('1:1 checkOne child with you; tap each word');
  expect(await cards.evaluateAll(els => els.map(e => e.tagName + e.type))).toEqual(['BUTTONbutton', 'BUTTONbutton']);
  await pressed('true', 'false');
  await expect(frame.locator('#cList')).toBeVisible();
  expect(await frame.locator('body').evaluate(() => [S.ui.check.mode, checkView(), S.tab])).toEqual(['tests', 'list', 'check']);
  /* planning */
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await pressed('true', 'false');
  await expect(frame.locator('#tPlan')).toBeVisible();
  expect(await frame.locator('body').evaluate(() => checkView())).toBe('plan');
  await frame.getByRole('button', { name: '← Back to tests' }).click();
  await expect(frame.locator('#cList')).toBeVisible();
  /* the 1:1 check: the marking screen for one child and any words, dated today */
  await one.click();
  await pressed('false', 'true');
  await expect(one, 'the focus stays on the card').toBeFocused();
  await expect(frame.locator('#cList')).toHaveCount(0);
  await expect(frame.locator('.tile')).toHaveCount(100);
  await expect(frame.locator('#mTest option:checked')).toHaveText('One child, any words…');
  await expect(frame.locator('#qDate')).toHaveValue(await frame.locator('body').evaluate(() => localDate()));
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  expect(await frame.locator('body').evaluate(() => [S.ui.check.mode, checkView()])).toEqual(['one', 'one']);
  /* a mark made here is saved, and the card takes you straight back to the tests */
  await frame.locator('.tile[data-i="0"]').click();
  await tests.click();
  await pressed('true', 'false');
  await expect(frame.locator('#cList')).toBeVisible();
  /* marking a test */
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await frame.locator('#tPlan').getByRole('button', { name: /^Create \d+ tests?$/ }).click();
  await expect(frame.locator('#toast')).toContainText(/^1 test created for /);
  await frame.locator('.trow [data-a="tMark"]').first().click();
  await pressed('true', 'false');
  await expect(frame.locator('.tile')).toHaveCount(20);
  expect(await frame.locator('body').evaluate(() => [checkView(), S.tab, location.hash])).toEqual(['mark', 'mark', '#mark']);
  /* from marking a test straight to the 1:1 check and back to the list */
  await one.click();
  await pressed('false', 'true');
  await expect(frame.locator('.tile')).toHaveCount(100);
  await tests.click();
  await expect(frame.locator('#cList')).toBeVisible();
  await expect(frame.locator('.trow')).toHaveCount(1);
  /* the mode is not stored: the page opens on Class & group tests */
  expect(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')))).sort(), 'no key for the mode').toEqual(['plans', 'practice', 'sessions', 'settings', 'tests']);
  await one.click();
  await page.reload();
  const again = page.frameLocator('#hwFrame');
  await expect(again.locator('#mode-tests')).toHaveAttribute('aria-pressed', 'true');
  await expect(again.locator('#cList')).toBeVisible();
  /* other tabs do not carry the cards */
  await again.locator('#nav button', { hasText: 'Progress' }).click();
  await expect(again.locator('.modes')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Tests: moving a test never replaces marks, keeps marks another test shares, and an empty test cannot be marked', async ({ page }) => {
  const w = (a, b, v) => { const o = {}; for (let i = a; i < b; i++) o[i] = { s: v, src: 'manual' }; return o; };
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    /* Kit: all of 1–20 right on the 10th; 1–10 wrong on the 11th */
    'x1_2030-01-10': { pupilId: 'x1', date: '2030-01-10', kind: 'spelling', words: w(0, 20, 'c'), photos: [], updatedAt: 1 },
    'x1_2030-01-11': { pupilId: 'x1', date: '2030-01-11', kind: 'spelling', words: w(0, 10, 'x'), photos: [], updatedAt: 1 }
  }, practice: {}, plans: {}, tests: {
    a: { date: '2030-01-10', title: '100 HFW 1–10', whole: false, words: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], pids: ['x1'], createdAt: 1 },
    b: { date: '2030-01-10', title: '100 HFW 1–20', whole: false, words: Array.from({ length: 20 }, (_, i) => i), pids: ['x1'], createdAt: 2 },
    gone: { date: '2030-01-10', title: '100 HFW 21–30', whole: false, words: [20, 21], pids: ['left-the-class'], createdAt: 3 }
  }, settings: {} });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const row = id => frame.locator(`.trow[data-test="${id}"]`);

  /* a test whose children have all left can't be marked or printed: Mark would otherwise offer the whole class */
  await expect(row('gone').locator('.tname .muted')).toHaveText('No children');
  await row('gone').locator('[data-a="tMark"]').click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(frame.locator('#toast')).toContainText('This test has no children');

  /* moving test "a" onto the 11th would replace Kit's marks there: moveClashes() says so (Mark no longer has a date to change) */
  await row('a').getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('#qDate')).toHaveCount(0);
  expect(await frame.locator('body').evaluate(() => moveClashes(findTest('a'), '2030-01-11'))).toEqual(['x1']);
  /* onto a free day it moves, and Mark follows it */
  expect(await frame.locator('body').evaluate(() => moveClashes(findTest('a'), '2030-01-12'))).toEqual([]);
  await frame.locator('body').evaluate(() => { moveTest(findTest('a'), '2030-01-12'); });
  await expect(frame.locator('#mTitle')).toHaveText('Every tap saves · Sat 12 Jan · Group 100 HFW 1–10');
  await expect(frame.locator('.tile.c')).toHaveCount(10);
  const doc = await stored();
  expect(doc.tests.a.date).toBe('2030-01-12');
  expect(doc.sessions['x1_2030-01-11'].words['0'].s).toBe('x');
  expect(Object.keys(doc.sessions['x1_2030-01-12'].words).length).toBe(10);
  /* test "b" is still on the 10th and shares words 1–10: its marks were copied, not taken */
  expect(Object.keys(doc.sessions['x1_2030-01-10'].words).length).toBe(20);
  await frame.locator('#mBack').click();
  await expect(row('b').locator('.tprog')).toContainText('All 1 marked');
  await expect(row('a').locator('.tprog')).toContainText('All 1 marked');
  await expect(frame.locator('.day[data-date] h2')).toHaveText(['Thursday 10 January 2030', 'Saturday 12 January 2030']);   // soonest first
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
  await frame.locator('#nav button', { hasText: 'Progress' }).click();

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
  /* Teach to the class: classMissed(), with how many children, and the posters for those words */
  await expect(frame.locator('section[aria-labelledby="i1"] .wchip')).toHaveText(['was1', 'you1']);
  await frame.locator('section[aria-labelledby="i1"]').getByRole('button', { name: /Word of the day/ }).click();
  await expect(frame.locator('#cfgH')).toHaveText('Word of the day');
  await frame.locator('#nav button', { hasText: 'Progress' }).click();
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
  await expect(bar).toBeInViewport();
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

/* No tab opens the Pupils view since Check · Progress · Print: its filters move to Progress.
   Until they do, this drives the kept view directly, for the plan and filter rules behind it. */
test('Pupils view (kept, no tab): a card each, the four filters, and practice sheets for everyone', async ({ page }) => {
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
  await expect(frame.locator('#nav button', { hasText: 'Pupils' }), 'the Pupils tab has gone').toHaveCount(0);
  await frame.locator('body').evaluate(() => { S.tab = 'pupils'; render(); });

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

  /* a card opens that child */
  await nell.click();
  await expect(frame.locator('#drawer')).toContainText('Nell Gwyn');
  await frame.locator('#pClose').click();

  /* Practice sheets for everyone opens Print › Practice sheets with everyone chosen, even after a few were picked there */
  await frame.locator('body').evaluate(() => { S.ui.print.who.practice = 'pick'; S.ui.print.pids = ['x1']; S.ui.print.actsFor = 'levels'; });
  await expect(frame.getByRole('button', { name: /Practice books/ }), 'Daily practice books has left Pupils').toHaveCount(0);
  await frame.getByRole('button', { name: 'Practice sheets for everyone' }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Print');
  await expect(frame.locator('#cfgH')).toHaveText('Practice sheets');
  await expect(frame.locator('#popts [role="group"][aria-label="Who"] button[aria-pressed="true"]')).toHaveText('Everyone (3)');
  await expect(frame.locator('#popts [role="group"][aria-label="Whose words"] button[aria-pressed="true"]')).toHaveText('Each child’s focus');
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

  /* from a name on Progress */
  await frame.locator('#nav button', { hasText: 'Progress' }).click();
  await frame.locator('table.sg').getByRole('button', { name: 'Kit Marlow', exact: true }).click();
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
    PDF.cards = (g, f) => window.__calls.push(['cards', g.length, f]); PDF.targeted = p => window.__calls.push(['targeted', p]); });
  await expect(panel.locator('section[aria-labelledby="f4"] .btn')).toHaveText(['Practice sheets', 'Flash cards', 'Check sheet']);
  await panel.getByRole('button', { name: 'Flash cards' }).click();
  await panel.getByRole('button', { name: 'Check sheet' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls)).toEqual([['cards', 1, 'flash-cards-kit-marlow.pdf'], ['targeted', ['x1']]]);

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
  await frame.locator('#nav button', { hasText: 'Progress' }).click();
  await frame.locator('table.sg').getByRole('button', { name: 'Nell Gwyn', exact: true }).click();
  await expect(panel.locator('#pName')).toHaveText('Nell Gwyn');
  await panel.locator('#pClose').press('Escape');
  await expect(panel).toBeHidden();

  await frame.locator('table.sg').getByRole('button', { name: 'Nell Gwyn', exact: true }).click();
  await expect(panel.locator('#pName')).toHaveText('Nell Gwyn');

  /* Practice sheets closes the panel and opens Print › Practice sheets for that child alone */
  await panel.getByRole('button', { name: 'Practice sheets' }).click();
  await expect(panel).toBeHidden();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Print');
  await expect(frame.locator('#cfgH')).toHaveText('Practice sheets');
  await expect(frame.locator('#popts [role="group"][aria-label="Who"] button[aria-pressed="true"]')).toHaveText('Choose children');
  await expect(frame.locator('#popts [role="group"][aria-label="Children"] button[aria-pressed="true"]')).toHaveText(['Nell Gwyn']);
});

test('Print: seven things in three groups, one set of options at a time, each calling its generator', async ({ page }) => {
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

  await expect(frame.locator('.pmenu .grp')).toHaveText(['For the test', 'For practice', 'For the wall and records']);
  /* "Daily practice books" is gone: Practice sheets builds the book */
  await expect(frame.locator('.pmenu .it b')).toHaveText(['Answer sheets', 'Dictation script', 'Targeted check sheets',
    'Practice sheets', 'Flash cards', 'Word of the day', 'Class record']);

  /* every generator is replaced by a recorder: nothing here changes how a PDF is made */
  const body = frame.locator('body');
  await body.evaluate(() => { window.__calls = []; const rec = (k, f) => { PDF[k] = (...a) => window.__calls.push([k, ...f(...a)]); };
    rec('testSheets', t => [t.title]); rec('testScript', t => [t.title]); rec('sheets', () => [S.ui.print.list, S.ui.print.pages.slice(), S.ui.print.named, S.ui.print.pids.slice()]);
    rec('script', () => [S.ui.print.list]); rec('targeted', p => [p, S.ui.print.targetN]); rec('books', (p, f) => [p, f, S.ui.print.bookDays, S.ui.print.acts.slice()]); rec('bandBooks', (l, f) => [l, f, S.ui.print.bookDays, S.ui.print.acts.slice()]);
    const card = () => [S.ui.print.cardSize, S.ui.print.cardSent, cardsPerChild()];
    rec('stackLevels', (l, f) => [l, f, ...card()]); rec('stackPupils', (p, f) => [p, f, ...card()]); rec('cards', (g, f) => [g.map(x => x.label + ':' + x.items.length), f, ...card()]);
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

  /* Practice sheets: the practice book builder. It opens as the daily A5 book, for everyone */
  await pick('Practice sheets');
  await expect(labels()).toHaveText(['Activities to include', 'Layout', 'How long', 'Whose words', 'Who']);
  const ticks = frame.locator('#popts [role="group"][aria-label="Activities to include"] button');
  await expect(ticks).toHaveText(['Look, say, cover, write, check', 'Trace and write', 'Missing letters', 'Wordsearch', 'Sentences', 'Bingo boards']);
  await expect(ticks.and(frame.locator('[aria-pressed="true"]'))).toHaveText(['Look, say, cover, write, check', 'Trace and write', 'Missing letters']);
  await expect(frame.locator('#pout')).toHaveText('3 books · 1 week · 3 activities');
  await expect(frame.locator('#ppaper')).toHaveText('A4 · A5 books print two to a page, then one cut');
  await go();
  expect(await calls()).toEqual([['books', ['x1', 'x2', 'x3'], 'practice-books.pdf', 5, ['lcwc', 'trace', 'missing']]]);
  /* other activities and another length; who can be the children due a review */
  await opt('Activities to include', 'Trace and write');          // off
  await opt('Activities to include', 'Wordsearch');               // on
  await opt('Activities to include', 'Sentences');                // on
  await opt('How long', '2 weeks');
  await expect(frame.locator('#popts [role="group"][aria-label="Who"] button')).toHaveText(['Everyone (3)', /^Review due \(\d\)$/, 'Choose children']);
  await opt('Who', 'Choose children');
  await opt('Children', 'Tam Lin');                               // off: Nell and Tam were picked for the check sheets
  await expect(frame.locator('#pout')).toHaveText('1 book · 2 weeks · 4 activities');
  await go();
  expect(await calls()).toEqual([['books', ['x2'], 'practice-books.pdf', 10, ['lcwc', 'missing', 'wordsearch', 'sentences']]]);
  /* just look, say, cover, write, check for a day: the page the daily books always printed. The last tick can't be taken off */
  for (const a of ['Missing letters', 'Wordsearch', 'Sentences']) await opt('Activities to include', a);
  await opt('Activities to include', 'Look, say, cover, write, check');
  await expect(ticks.and(frame.locator('[aria-pressed="true"]'))).toHaveText(['Look, say, cover, write, check']);
  await opt('How long', '1 day');
  await opt('Who', 'Everyone (3)');
  await go();
  expect(await calls()).toEqual([['books', ['x1', 'x2', 'x3'], 'practice-books.pdf', 1, ['lcwc']]]);
  /* A4 sheets: no "How long", and the practice-sheet generator */
  await opt('Activities to include', 'Missing letters');
  await opt('Layout', 'A4 sheets');
  await expect(labels()).toHaveText(['Activities to include', 'Layout', 'Whose words', 'Who']);
  await expect(frame.locator('#pout')).toHaveText('3 packs of A4 sheets · 2 activities');
  await expect(frame.locator('#ppaper')).toHaveText('A4');
  await go();
  expect(await calls()).toEqual([['acts', ['Kit Marlow', 'Nell Gwyn', 'Tam Lin'], 'practice-sheets.pdf', ['lcwc', 'missing']]]);
  /* a band's words instead of each child's (the Next 200 list is still chosen): as sheets, and as a book to copy */
  await opt('Whose words', 'A band');
  await expect(labels()).toHaveText(['Activities to include', 'Layout', 'Whose words', 'Word list', 'Bands']);
  await opt('Bands', 'Red 11–20');
  await go();
  await opt('Layout', 'A5 book · stack and cut');
  await expect(labels()).toHaveText(['Activities to include', 'Layout', 'How long', 'Whose words', 'Word list', 'Bands']);
  await expect(frame.locator('#pout')).toHaveText('2 books to copy, one for each band · 1 day · 2 activities');
  await go();
  expect(await calls()).toEqual([['acts', ['', ''], 'practice-sheets.pdf', ['lcwc', 'missing']], ['bandBooks', [10, 11], 'band-practice-books.pdf', 1, ['lcwc', 'missing']]]);

  /* Flash cards keeps every option it had */
  await pick('Flash cards');
  await expect(frame.locator('#popts [role="group"][aria-label="Whose words"] button')).toHaveText(['Each child’s focus', 'A band']);
  await opt('Whose words', 'Each child’s focus');
  await expect(labels()).toHaveText(['Whose words', 'Who', 'Cards per child', 'Layout', 'Size', 'Dictation sentence']);
  await expect(frame.locator('#popts [role="group"][aria-label="Cards per child"] button')).toHaveText(['3', '4', '5', '6', '8', '10', '12', '15', '20']);
  await expect(frame.locator('#popts [role="group"][aria-label="Layout"] button')).toHaveText(['Stack and cut', 'Sheet by sheet']);
  await expect(frame.locator('#popts [role="group"][aria-label="Size"] button')).toHaveText(['10 per page', '4 large per page']);
  /* each child's next words, stacked: 10 a page, no sentence, 10 cards each */
  await go();
  expect(await calls()).toEqual([['stackPupils', ['x1', 'x2', 'x3'], 'flash-cards-stack-and-cut.pdf', 10, false, 10]]);
  /* cards per child is still a saved setting */
  await opt('Cards per child', '5');
  await expect(frame.locator('#pout')).toHaveText('5 cards each for 3 children');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'))).settings.main.cardsPerChild).toBe(5);
  /* sheet by sheet, 4 large, with the dictation sentence, for chosen children */
  await opt('Layout', 'Sheet by sheet');
  await opt('Size', '4 large per page');
  await opt('Dictation sentence', 'Yes');
  await expect(frame.locator('#ppaper')).toHaveText('A4 · 4 to a page');
  await go();
  expect(await calls()).toEqual([['cards', ['Kit:5', 'Nell:5', 'Tam:5'], 'pupil-flash-cards.pdf', 4, true, 5]]);
  await opt('Who', 'Choose children');
  await opt('Children', 'Nell Gwyn');                             // off: she was picked for practice sheets
  await opt('Children', 'Tam Lin');
  await go();
  expect(await calls()).toEqual([['cards', ['Tam:5'], 'pupil-flash-cards.pdf', 4, true, 5]]);
  /* by band: stacked into identical packs, or sheet by sheet */
  await opt('Whose words', 'A band');
  await expect(labels()).toHaveText(['Whose words', 'Word list', 'Bands', 'Layout', 'Size', 'Dictation sentence']);
  await go();
  await opt('Layout', 'Stack and cut');
  await opt('Size', '10 per page');
  await opt('Dictation sentence', 'No');
  await expect(frame.locator('#pout')).toHaveText('20 cards · 2 bands · 10 identical packs');
  await go();
  expect(await calls()).toEqual([['cards', [':10', ':10'], 'flash-cards.pdf', 4, true, 5], ['stackLevels', [10, 11], 'level-flash-cards-stack-and-cut.pdf', 10, false, 5]]);

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
  expect(await calls()).toEqual([['grid', 1], ['csv']]);       // the Next 200 list is still chosen

  /* once tests are saved, Print offers those: the next date's */
  await body.evaluate(() => { const tp = testPlan().tests;
    saveTest('old', { date: '2026-10-08', title: '100 HFW 1–10', whole: true, words: tp[0].words.slice(0, 10), pids: tp[0].pids, createdAt: 1 });
    saveTest('nxt', { date: '2031-03-06', title: '100 HFW 41–60', whole: true, words: tp[0].words, pids: tp[0].pids, createdAt: 2 });
    saveTest('nx2', { date: '2031-03-06', title: '200 HFW 1–10', whole: false, words: tp[1].words, pids: tp[1].pids, createdAt: 3 }); });
  await pick('Answer sheets');
  await expect(frame.locator('#popts [role="group"][aria-label="Which test"] button')).toHaveText(['Whole class · 100 HFW 41–60', 'Group · 200 HFW 1–10', 'All 2', 'A whole list']);
  await expect(frame.locator('.pcfg')).toContainText(/These are the tests for Thu,? 6 Mar\./);
  await opt('Which test', 'Group · 200 HFW 1–10');
  await go();
  expect(await calls()).toEqual([['testSheets', 'Group · 200 HFW 1–10']]);
});

/* The practice book is built from the two generators that were there before:
   ticking only look, say, cover, write, check gives the old daily book, page for page. */
test('Practice sheets: the A5 book is the old daily book plus the ticked activities', async ({ page }) => {
  const all = n => { const w = {}; for (let i = 0; i < n; i++) w[i] = { s: 'c' }; return w; };
  const extra = twoClasses('b');
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    x1_2026: { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: all(40) } }, practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  const n = await frame.locator('body').evaluate(() => ({
    old5: bookPages('x1', 5).length, lcwc5: bookPages('x1', 5, ['lcwc']).length, three5: bookPages('x1', 5, ['lcwc', 'trace', 'missing']).length,
    noLcwc10: bookPages('x1', 10, ['wordsearch', 'sentences']).length, day1: bookPages('x1', 1, ['lcwc']).length, day1two: bookPages('x1', 1, ['lcwc', 'trace']).length,
    band: bandBookPages(3, 5, ['lcwc', 'bingo']).length, unassessed: bookPages('x2', 5, ['lcwc', 'trace']).length }));
  /* cover + a page a day; + one more activity page a day when others are ticked */
  expect(n).toEqual({ old5: 6, lcwc5: 6, three5: 11, noLcwc10: 11, day1: 1, day1two: 2, band: 11, unassessed: 11 });
  /* every page of a book draws (the PDF tool itself is not loaded in tests) */
  const drawn = await frame.locator('body').evaluate(() => {
    const ink = fn => { const { cv, c } = cpage(); drawHalves(c, [fn, null]); const d = c.getImageData(60, 60, 1100, 760).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 140) n++; return n > 300; };
    return [...bookPages('x1', 5, ['lcwc', 'trace', 'missing', 'wordsearch', 'sentences', 'bingo']), ...bandBookPages(0, 1, ['missing'])].map(ink);
  });
  expect(drawn.length).toBe(12);
  expect(drawn.every(Boolean), 'no blank page').toBe(true);
});

test('With every list finished there is no test, and Mark is still one tap away', async ({ page }) => {
  const extra = twoClasses('b');
  const all = {}; for (let i = 0; i < 409; i++) all[i] = { s: 'c' };
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: {
    'x1_2026-10-01': { pupilId: 'x1', date: '2026-10-01', kind: 'spelling', words: all },
    'x2_2026-10-01': { pupilId: 'x2', date: '2026-10-01', kind: 'spelling', words: all } }, practice: {}, plans: {}, settings: {} });
  const frame = await openHW(page, extra);
  expect(await frame.locator('body').evaluate(() => testPlan().tests.length)).toBe(0);
  /* nothing is offered to plan */
  await expect(frame.locator('#tNext')).toContainText('Every child has finished every list');
  await expect(frame.locator('#tNext button')).toHaveCount(0);
  /* the past test is listed, so Mark opens from it, and from there for any child and any words */
  await (await earlier(frame, '2026-10-01')).locator('.trow').first().getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('.markcard')).toBeVisible();
  await expect(frame.locator('#mLevel')).toHaveText('Every list complete');
  await expect(frame.locator('.tile.focus')).toHaveCount(0);
  /* the 1:1 check card is always there, and is dated today, not the date of the test just opened */
  await frame.locator('#mode-one').click();
  await expect(frame.locator('#mode-one')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('.pl')).toHaveCount(2);
  await expect(frame.locator('#mTest option:checked')).toHaveText('One child, any words…');
  await expect(frame.locator('#qDate')).toHaveValue(await frame.locator('body').evaluate(() => localDate()));
  await frame.locator('#mode-tests').click();
  await expect(frame.locator('#cList')).toBeVisible();
});

test('Old tab ids land on the tab that replaced them; Pupils, Practise and Review stay unreachable', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  const body = frame.locator('body');
  const land = id => body.evaluate((_, id) => { setTab(id); return S.tab; }, id);
  /* every id the page has used -> [the screen it opens, the tab that is lit] */
  const OLD = {
    /* the first design */
    tracker: ['progress', 'Progress'], groups: ['check', 'Check'], assess: ['mark', 'Check'], plans: ['progress', 'Progress'],
    /* the Nov 2026 redesign: This week · Mark · Class · Pupils · Print, then Tests · Class · Pupils · Print */
    week: ['check', 'Check'], quick: ['mark', 'Check'], plan: ['progress', 'Progress'],
    tests: ['check', 'Check'], class: ['progress', 'Progress'], pupils: ['progress', 'Progress'],
    /* and today's */
    check: ['check', 'Check'], progress: ['progress', 'Progress'], print: ['print', 'Print'], mark: ['mark', 'Check']
  };
  for (const [id, [screen]] of Object.entries(OLD)) expect(await land(id), id).toBe(screen);
  expect(await land('settings')).toBe('settings');
  const home = await body.evaluate(() => DEFAULT_TAB);
  expect(home).toBe('check');
  expect(await land('practise')).toBe(home);
  expect(await land('review')).toBe(home);
  expect(await land('nonsense')).toBe(home);
  /* a button inside the page that still carries an old id works too */
  await body.evaluate(() => { const b = document.createElement('button'); b.id = 'oldTab'; b.dataset.a = 'tab'; b.dataset.k = 'pupils'; document.getElementById('main').appendChild(b); });
  await frame.locator('#oldTab').click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Progress');
  await expect(frame.locator('table.sg')).toBeVisible();

  /* and a link with an old id in it: the right tab is lit and its screen is showing */
  await blockExternal(page);
  const SHOWS = { check: '#cList', progress: 'table.sg', print: '.pmenu', mark: '.markcard' };
  for (const [id, [screen, lit]] of Object.entries(OLD)) {
    await page.goto('/hundred-words.html#' + id);
    await page.reload();
    await expect(page.locator('#nav button[aria-current="page"]'), '#' + id).toHaveText(lit);
    await expect(page.locator('#nav button[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(SHOWS[screen]).first(), '#' + id).toBeVisible();
    await expect(page.locator('.pcards'), 'the old Pupils cards are not a screen').toHaveCount(0);
  }
  await page.goto('/hundred-words.html#settings');
  await page.reload();
  await expect(page.locator('#cog')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveCount(0);
  await page.goto('/hundred-words.html#practise');
  await page.reload();
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  await expect(page.locator('#main')).not.toContainText('Choose a game');

  /* following a link while the page is open (hashchange) */
  await page.evaluate(() => { location.hash = '#pupils'; });
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('Progress');
  await page.evaluate(() => { location.hash = '#tests'; });
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveText('Check');
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
  for (const tab of ['Progress', 'Print', 'Check']) {
    await frame.locator('#nav button', { hasText: tab }).click();
    await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText(tab);
  }
  await frame.locator('#cog').click();
  await frame.locator('.pcards, #clsName').first().waitFor();
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words'))).toBe(before);
  expect(await results()).toEqual(snap.expected);
  expect(errors).toEqual([]);
});

/* ----- deleting a test: under ⋯ on its row in the list (Mark has no delete) ----- */
const DEL_WORDS = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
const delMarks = () => Object.fromEntries(DEL_WORDS.map((i, k) => [i, { s: k < 8 ? 'c' : 'x' }]));
function delSeed(over) {
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ practice: {}, plans: {}, settings: {},
    sessions: { 'x1_2030-01-10': { pupilId: 'x1', date: '2030-01-10', kind: 'spelling', words: delMarks(), photos: [], updatedAt: 7 } },
    tests: { t1: { date: '2030-01-10', title: '100 HFW 21–30', whole: false, words: DEL_WORDS, pids: ['x1', 'x2'], createdAt: 5 } }, ...over });
  return extra;
}
async function delOpen(page, over) {
  const extra = delSeed(over);
  const before = JSON.parse(extra['tp_hundred_words::b']);
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const toMark = async () => { await frame.locator('.trow[data-test="t1"] [data-a="tMark"]').click(); await expect(frame.locator('.markcard')).toBeVisible(); };
  /* ⋯ on the test's row, then Delete test */
  const more = frame.locator('.trow[data-test="t1"] .tmore');
  const toMenu = async () => { if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click(); await expect(frame.locator('.tmenu')).toBeVisible(); };
  return { frame, before, stored, toMark, toMenu, more, dlg: frame.getByRole('alertdialog') };
}
const onTests = async frame => {
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Check');
  await expect(frame.locator('#cList')).toBeVisible();
  await expect(frame.locator('#mode-tests')).toHaveAttribute('aria-pressed', 'true');
};

for (const from of ['Tests']) {
  test(`Delete test from ${from}: keep the marks, or delete them too, each with a toast and Undo`, async ({ page }) => {
    const errors = collectErrors(page);
    const { frame, before, stored, toMark, toMenu, more, dlg } = await delOpen(page);
    const opener = more;
    const ask = async () => {
      /* Cancel leaves you where you were; a delete or an Undo ends on the list */
      { await toMenu(); await frame.locator('.tmenu').getByRole('button', { name: 'Delete test', exact: true }).click(); }
      await expect(dlg).toBeVisible();
    };

    /* the inline confirm names the test and says how many children have marks; the focus moves to it */
    await ask();
    await expect(dlg.locator('#delH')).toHaveText('Delete “100 HFW 21–30”? 1 child has marks from it.');
    await expect(dlg.getByRole('button')).toHaveText(['Delete test, keep the marks', 'Delete test and its marks', 'Cancel']);
    await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    if (from === 'Tests') await expect(frame.locator('.tmenu'), 'the confirm takes the menu’s place, in the list').toHaveCount(0);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(opener, 'Cancel hands the focus back').toBeFocused();
    expect(await stored()).toEqual(before);

    /* keep the marks: only the record goes, and the session still counts */
    await ask();
    await dlg.getByRole('button', { name: 'Delete test, keep the marks' }).click();
    await onTests(frame);
    await expect(frame.locator('#toast')).toContainText('Test deleted. Its marks still count.');
    await expect(frame.locator('.trow[data-test="t1"]')).toHaveCount(0);
    let doc = await stored();
    expect(doc.tests.t1).toBeUndefined();
    expect(doc.sessions).toEqual(before.sessions);
    /* nothing recorded becomes unreachable: the marks are an earlier test on that date now */
    await expect(frame.locator('#tEarlier .eday[data-date="2030-01-10"] .et')).toContainText('Group 100 HFW 21–30');
    await frame.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(frame.locator('.trow[data-test="t1"]')).toHaveCount(1);
    await expect(frame.locator('#toast')).toHaveText('Test put back');
    expect(await stored()).toEqual(before);

    /* delete the marks too */
    await ask();
    await dlg.getByRole('button', { name: 'Delete test and its marks' }).click();
    await onTests(frame);
    await expect(frame.locator('#toast')).toContainText('Test and its marks deleted');
    await expect(frame.locator('.trow')).toHaveCount(0);
    await expect(frame.locator('#tEarlier')).toHaveCount(0);
    doc = await stored();
    expect(doc.tests.t1).toBeUndefined();
    expect(doc.sessions['x1_2030-01-10']).toBeUndefined();
    /* Undo puts back exactly what was removed: the record and the session */
    await frame.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(frame.locator('.trow[data-test="t1"] .tprog')).toContainText('1 of 2 marked');
    expect(await stored()).toEqual(before);
    expect(Object.keys(await page.evaluate(() => ({ ...localStorage }))).filter(k => /hundred/.test(k)), 'no new storage keys').toEqual(['tp_hundred_words::b']);
    expect(errors).toEqual([]);
  });
}

test('Delete test with nothing marked: only Delete test and Cancel; Mark has no delete', async ({ page }) => {
  const { frame, before, stored, toMark, toMenu, dlg } = await delOpen(page, { sessions: {} });
  await toMenu();
  await frame.locator('.tmenu').getByRole('button', { name: 'Delete test', exact: true }).click();
  await expect(dlg.locator('#delH')).toHaveText('Delete “100 HFW 21–30”? Nothing has been marked for it yet.');
  await expect(dlg.getByRole('button')).toHaveText(['Delete test', 'Cancel']);
  await dlg.getByRole('button', { name: 'Cancel' }).click();

  /* Mark does not offer it: delete lives under ⋯ */
  await toMark();
  await expect(frame.locator('#mDel')).toHaveCount(0);
  await expect(frame.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await frame.locator('#mBack').click();
  await toMenu();
  await frame.locator('.tmenu').getByRole('button', { name: 'Delete test', exact: true }).click();
  await expect(dlg.getByRole('button')).toHaveText(['Delete test', 'Cancel']);
  await dlg.getByRole('button', { name: 'Delete test' }).click();
  await onTests(frame);
  await expect(frame.locator('#toast')).toContainText('Test deleted');
  expect((await stored()).tests.t1).toBeUndefined();
  await frame.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('.trow[data-test="t1"]')).toHaveCount(1);
  expect(await stored()).toEqual(before);
});

/* Both choices, from ⋯ on the list, and what Progress shows afterwards.
   Two tests on one day: the group test (Kit and Nell, words 1–10) and the
   whole-class test (Kit and Tam, words 1–20). Kit's and Nell's 1–10 are
   marked; Kit's are the whole-class test's marks too. */
test('Delete with both choices: kept marks still count on Progress; deleted marks go, but never ones another test uses', async ({ page }) => {
  const errors = collectErrors(page);
  const ten = Array.from({ length: 10 }, (_, i) => i), right = () => Object.fromEntries(ten.map(i => [i, { s: 'c', src: 'manual' }]));
  const ses = pid => ({ pupilId: pid, date: '2030-01-10', kind: 'spelling', words: right(), photos: [], updatedAt: 3 });
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  const before = { practice: {}, plans: {}, settings: {},
    sessions: { 'x1_2030-01-10': ses('x1'), 'x2_2030-01-10': ses('x2') },
    tests: { grp: { date: '2030-01-10', title: '100 HFW 1–10', whole: false, words: ten, pids: ['x1', 'x2'], createdAt: 1 },
      all: { date: '2030-01-10', title: '100 HFW 1–20', whole: true, words: Array.from({ length: 20 }, (_, i) => i), pids: ['x1', 'x3'], createdAt: 2 } } };
  extra['tp_hundred_words::b'] = JSON.stringify(before);
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const dlg = frame.getByRole('alertdialog'), row = frame.locator('.trow[data-test="grp"]');
  const ask = async () => { await row.locator('.tmore').click(); await frame.locator('.tmenu').getByRole('button', { name: 'Delete test' }).click(); await expect(dlg).toBeVisible(); };
  /* how many sets of ten Progress shows a child has finished */
  const doneSets = async name => { await frame.locator('#nav button', { hasText: 'Progress' }).click();
    await expect(frame.locator('table.sg')).toBeVisible();
    const n = await frame.locator('table.sg tbody tr', { hasText: name }).locator('.cell.d').count();
    await frame.locator('#nav button', { hasText: 'Check' }).click(); await expect(frame.locator('#cList')).toBeVisible(); return n; };
  expect([await doneSets('Kit Marlow'), await doneSets('Nell Gwyn'), await doneSets('Tam Lin')]).toEqual([1, 1, 0]);

  /* 1. Delete test, keep the marks */
  await expect(row.locator('.tprog')).toContainText('All 2 marked');
  await ask();
  await expect(dlg.locator('#delH')).toHaveText('Delete “100 HFW 1–10”? 2 children have marks from it.');
  await expect(dlg).toContainText('Marks another test also uses are kept either way.');
  await expect(dlg.getByRole('button')).toHaveText(['Delete test, keep the marks', 'Delete test and its marks', 'Cancel']);
  await dlg.getByRole('button', { name: 'Delete test, keep the marks' }).click();
  await expect(frame.locator('#toast')).toContainText('Test deleted. Its marks still count.');
  await expect(frame.locator('#toast')).toHaveAttribute('role', 'status');
  await expect(row).toHaveCount(0);
  let doc = await stored();
  expect(Object.keys(doc.tests)).toEqual(['all']);
  expect(doc.sessions, 'the sessions are untouched').toEqual(before.sessions);
  expect([await doneSets('Kit Marlow'), await doneSets('Nell Gwyn')], 'and the marks still count on Progress').toEqual([1, 1]);
  /* Nell's marks belong to no saved test now: they are listed as an earlier test, so they can still be seen and re-marked */
  await expect(frame.locator('#tEarlier .eday[data-date="2030-01-10"] .et')).toContainText('Group 100 HFW 1–10');
  /* put the record back for the second half */
  await frame.locator('body').evaluate((_, t) => { saveTest('grp', t); }, before.tests.grp);
  await expect(row).toHaveCount(1);
  expect(await stored()).toEqual(before);

  /* 2. Delete test and its marks */
  await ask();
  await dlg.getByRole('button', { name: 'Delete test and its marks' }).click();
  await expect(frame.locator('#toast')).toContainText('Test and its marks deleted');
  await expect(row).toHaveCount(0);
  doc = await stored();
  expect(Object.keys(doc.tests)).toEqual(['all']);
  expect(doc.sessions['x2_2030-01-10'], 'Nell’s marks were only this test’s: gone').toBeUndefined();
  expect(doc.sessions['x1_2030-01-10'], 'Kit’s are the whole-class test’s too: kept, exactly').toEqual(before.sessions['x1_2030-01-10']);
  await expect(frame.locator('.trow[data-test="all"] .tprog')).toContainText('Not marked yet');      // Kit has 10 of its 20 words
  await expect(frame.locator('.trow[data-test="all"]').getByRole('button', { name: 'Carry on marking' })).toBeVisible();
  await expect(frame.locator('#tEarlier')).toHaveCount(0);
  /* Undo puts back exactly what was taken */
  await frame.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  await expect(row).toHaveCount(1);
  expect(await stored()).toEqual(before);
  await ask();
  await dlg.getByRole('button', { name: 'Delete test and its marks' }).click();
  await expect(row).toHaveCount(0);
  expect([await doneSets('Kit Marlow'), await doneSets('Nell Gwyn')], 'Progress: Kit keeps the set, Nell is back to none').toEqual([1, 0]);
  expect(errors).toEqual([]);
});

test('Delete test and its marks never removes marks another test uses', async ({ page }) => {
  /* t2 is on the same day and covers Kit and the same ten words; Nell is only in t1 */
  const nell = { pupilId: 'x2', date: '2030-01-10', kind: 'spelling', words: delMarks(), photos: [], updatedAt: 8 };
  const base = JSON.parse(delSeed()['tp_hundred_words::b']);
  const { frame, before, stored, toMenu, dlg } = await delOpen(page, {
    sessions: { ...base.sessions, 'x2_2030-01-10': nell },
    tests: { ...base.tests, t2: { date: '2030-01-10', title: '100 HFW 21–40', whole: false, words: [...DEL_WORDS, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39], pids: ['x1', 'x3'], createdAt: 6 } } });
  await toMenu();
  await frame.locator('.tmenu').getByRole('button', { name: 'Delete test', exact: true }).click();
  await expect(dlg).toContainText('2 children have marks from it');
  await expect(dlg).toContainText('Marks another test also uses are kept either way.');
  await dlg.getByRole('button', { name: 'Delete test and its marks' }).click();
  await onTests(frame);
  const doc = await stored();
  expect(Object.keys(doc.tests)).toEqual(['t2']);
  expect(doc.sessions['x1_2030-01-10'], 'Kit’s marks are still t2’s').toEqual(before.sessions['x1_2030-01-10']);
  expect(doc.sessions['x2_2030-01-10']).toBeUndefined();
  await frame.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('.trow[data-test="t1"]')).toHaveCount(1);
  expect(await stored()).toEqual(before);
});

test('An Undo from the example class is gone once the example class is left', async ({ page }) => {
  const extra = twoClasses('b');
  extra['tp_roster::b'] = '[]';
  const frame = await openHW(page, extra);
  await frame.getByRole('button', { name: 'Explore an example class' }).click();
  /* its tests are all past ones, under Earlier tests */
  await frame.locator('#tEarlier .eline').first().click();
  await frame.locator('.trow .tmore').first().click();
  await frame.locator('.tmenu').getByRole('button', { name: 'Delete test', exact: true }).click();
  await frame.getByRole('alertdialog').getByRole('button', { name: 'Delete test and its marks' }).click();
  await expect(frame.locator('#toast').getByRole('button', { name: 'Undo' })).toBeVisible();
  await frame.getByRole('button', { name: 'Start my own class' }).click();
  await expect(frame.locator('#toast')).toBeEmpty();
  /* and nothing from the example class reached this class's own data */
  const doc = JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')) || '{}');
  expect(Object.keys(doc.sessions || {})).toEqual([]);
});

/* ----- Plan a test ----- */
/* eight children: Abe on 1–10, Bea and Cal on 11–20, Dee, Eli and Fay on 21–30, Gus on 41–50, Hal on the next 200 */
const PLAN_KIDS = [['a1', 'Abe Ash', 0], ['a2', 'Bea Birch', 1], ['a3', 'Cal Cedar', 1], ['a4', 'Dee Elm', 2], ['a5', 'Eli Fir', 2], ['a6', 'Fay Gorse', 2], ['a7', 'Gus Holly', 4], ['a8', 'Hal Ivy', 10]];
function planClass(settings) {
  const extra = twoClasses('b'), sessions = {};
  extra['tp_roster::b'] = J(PLAN_KIDS.map(([id, name]) => ({ id, name })));
  for (const [id, , lv] of PLAN_KIDS) { if (!lv) continue; const words = {}; for (let i = 0; i < lv * 10; i++) words[i] = { s: 'c' };
    sessions[id + '_2026'] = { pupilId: id, date: '2026-10-01', kind: 'spelling', words }; }
  extra['tp_hundred_words::b'] = J({ sessions, practice: {}, plans: {}, settings: settings ? { main: settings } : {} });
  return extra;
}
async function openPlan(page, settings) {
  const frame = await openHW(page, planClass(settings));
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await expect(frame.locator('#tPlan')).toBeVisible();
  return frame;
}
const pressedSets = frame => frame.locator('#pCols .pcol[aria-pressed="true"]').evaluateAll(els => els.map(e => +e.dataset.g));
const storedB = async page => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));

test('Plan a test opens on what testPlan() proposes: its start, settings.wholeN words, and its group tests', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openPlan(page), body = frame.locator('body');
  const tp = await body.evaluate(() => testPlan().tests.map(t => ({ whole: t.whole, sets: t.sets, words: t.words, pids: t.pids, target: t.target.length, label: setsLabel(t.sets) })));
  expect(tp.map(t => t.label)).toEqual(['100 HFW 11–30', '100 HFW 1–10', '100 HFW 41–50', '200 HFW 1–10']);
  const day = await body.evaluate(() => [fmtDay(nextTestDate()).replace(',', ''), dayName(nextTestDate()), nextTestDate()]);

  await expect(frame.getByRole('button', { name: '← Back to tests' })).toBeVisible();
  await expect(frame.locator('#pWhole .pstep')).toHaveText(`1 · The whole-class test · ${day[0]}`);
  await expect(frame.locator('#pWhole h2')).toHaveText('Everyone sits the same words');
  await expect(frame.locator('#pWhole .psub')).toHaveText('Each bar is how many children are working on that set of ten. Tap a set to start the test there.');
  /* 10 / 20 / 30 / 40, on settings.wholeN (20 when it has never been set) */
  const len = frame.getByRole('group', { name: 'How many words' });
  await expect(len.locator('button')).toHaveText(['10', '20', '30', '40']);
  await expect(len.locator('button[aria-pressed="true"]')).toHaveText('20');
  /* one column per set of ten in the list the test is in; the bar counts the children whose current set it is */
  await expect(frame.locator('#pList button[aria-pressed="true"]')).toHaveText('100 HFW');
  const cols = frame.locator('#pCols .pcol');
  await expect(cols).toHaveCount(10);
  await expect(cols.locator('.pn')).toHaveText(['1', '2', '3', '–', '1', '–', '–', '–', '–', '–']);
  await expect(cols.locator('.pband')).toHaveText(['Pink', 'Red', 'Yellow', 'Blue', 'Green', 'Orange', 'Turquoise', 'Purple', 'Gold', 'White']);
  await expect(cols.locator('.prange').first()).toHaveText('1–10');
  await expect(cols.nth(1)).toHaveAttribute('aria-label', 'Red 11 to 20: 2 children. Start the test here.');
  await expect(cols.nth(0)).toHaveAttribute('aria-label', 'Pink 1 to 10: 1 child. Start the test here.');
  expect(await cols.locator('.pbar i').evaluateAll(els => els.slice(0, 4).map(e => e.style.height)), 'bars are scaled to the largest count').toEqual(['33%', '67%', '100%', '4%']);
  /* the window is where testPlan() starts the whole-class test */
  await expect.poll(() => pressedSets(frame)).toEqual(tp[0].sets);
  expect(tp[0].sets).toEqual([1, 2]);
  await expect(frame.locator('#pSum')).toContainText('Words 11–30 · Red & Yellow');
  await expect(frame.locator('#pSum')).toContainText('The set they’re working on for 5 of 8 children. Everyone else sits it too.');
  expect(await frame.locator('#pWords .wchip').allTextContents()).toEqual(await body.evaluate((el, w) => w.map(i => WORDS[i]), tp[0].words));
  expect(await frame.locator('#pWords .wchip').first().evaluate(e => getComputedStyle(e).fontFamily)).toContain('Andika');
  /* the group tests are testPlan()'s, for the three children the window does not cover */
  await expect(frame.locator('#pGroups .pstep')).toHaveText('2 · Group tests');
  await expect(frame.locator('#pGroups h2')).toHaveText('For the 3 children not working on those words');
  const sw = frame.getByRole('switch', { name: 'Add group tests' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await sw.evaluate(e => [e.tagName, e.offsetWidth >= 44, e.offsetHeight >= 44])).toEqual(['BUTTON', true, true]);
  await expect(frame.locator('#pGList .pgrow')).toHaveText(['Group · 100 HFW 1–10Abe10 words', 'Group · 100 HFW 41–50Gus10 words', 'Group · 200 HFW 1–10Hal10 words']);
  await expect(frame.locator('#pTotal')).toHaveText(`4 tests on ${day[1]}: the whole class + 3 groups`);
  await expect(frame.locator('#pFoot')).toContainText('You can delete or re-plan from the test list.');
  await expect(frame.getByLabel('Date of the tests')).toHaveValue(day[2]);
  await expect(frame.locator('#pFoot button')).toHaveText(['Cancel', 'Create 4 tests']);
  await expect(frame.locator('#pCreate')).toHaveClass(/primary/);
  /* every control is a 44px target */
  expect(await frame.locator('#tPlan button').evaluateAll(els => els.filter(e => e.offsetWidth < 44 || e.offsetHeight < 44).map(e => e.textContent))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Plan a test: the length opens on settings.wholeN, and changing it here does not change the setting', async ({ page }) => {
  const frame = await openPlan(page, { wholeN: 30 }), body = frame.locator('body');
  const before = await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'));
  const len = frame.getByRole('group', { name: 'How many words' });
  await expect(len.locator('button[aria-pressed="true"]')).toHaveText('30');
  await expect.poll(() => pressedSets(frame)).toEqual(await body.evaluate(() => testPlan().tests[0].sets));
  await expect.poll(() => pressedSets(frame)).toEqual([0, 1, 2]);
  await expect(frame.locator('#pSum')).toContainText('Words 1–30 · Pink & Red & Yellow');
  await expect(frame.locator('#pSum')).toContainText('for 6 of 8 children');
  await expect(frame.locator('#pWords .wchip')).toHaveCount(30);
  await expect(frame.locator('#pCreate')).toHaveText('Create 3 tests');

  /* 10 words: the plan is testPlan({len:10}) — one set, where most children are */
  await len.getByRole('button', { name: '10' }).click();
  await expect(len.locator('button[aria-pressed="true"]')).toHaveText('10');
  await expect(len.getByRole('button', { name: '10' }), 'the focus stays on the button').toBeFocused();
  await expect.poll(() => pressedSets(frame)).toEqual(await body.evaluate(() => testPlan({ len: 10 }).tests[0].sets));
  await expect.poll(() => pressedSets(frame)).toEqual([2]);
  await expect(frame.locator('#pSum')).toContainText('Words 21–30 · Yellow');
  await expect(frame.locator('#pSum')).toContainText('for 3 of 8 children');
  await expect(frame.locator('#pWords .wchip')).toHaveCount(10);
  await expect(frame.locator('#pGroups h2')).toHaveText('For the 5 children not working on those words');
  await expect(frame.locator('#pGList .pgrow')).toHaveText(['Group · 100 HFW 1–20Abe, Bea, Cal20 words', 'Group · 100 HFW 41–50Gus10 words', 'Group · 200 HFW 1–10Hal10 words']);
  await expect(frame.locator('#pCreate')).toHaveText('Create 4 tests');
  /* 40 words */
  await len.getByRole('button', { name: '40' }).click();
  await expect.poll(() => pressedSets(frame)).toEqual([0, 1, 2, 3]);
  await expect(frame.locator('#pSum')).toContainText('Words 1–40 · Pink & Red & Yellow & Blue');
  await expect(frame.locator('#pWords .wchip')).toHaveCount(40);
  await expect(frame.locator('#pGList .pgrow')).toHaveCount(2);
  await expect(frame.locator('#pCreate')).toHaveText('Create 3 tests');
  /* a start that was tapped is kept when the length changes, moved back only so the test fits in the list */
  await frame.locator('#pCols .pcol[data-g="8"]').click();
  await expect.poll(() => pressedSets(frame)).toEqual([6, 7, 8, 9]);
  await len.getByRole('button', { name: '20' }).click();
  await expect.poll(() => pressedSets(frame)).toEqual([8, 9]);

  /* the setting is untouched, and so is everything else that is stored */
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b'))).toBe(before);
  expect(await body.evaluate(() => S.settings.wholeN)).toBe(30);
  /* the choice lasts for the visit: planning again opens on the setting */
  await frame.getByRole('button', { name: 'Cancel' }).click();
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await expect(len.locator('button[aria-pressed="true"]')).toHaveText('30');
  await expect.poll(() => pressedSets(frame)).toEqual([0, 1, 2]);
});

test('Plan a test: tapping a set moves the start, and the summary, words, covered count and groups follow', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openPlan(page), body = frame.locator('body');
  const col = g => frame.locator(`#pCols .pcol[data-g="${g}"]`);
  await col(4).click();
  await expect.poll(() => pressedSets(frame)).toEqual([4, 5]);
  await expect(col(4), 'the focus stays on the set that was tapped').toBeFocused();
  await expect(frame.locator('#pSum')).toContainText('Words 41–60 · Green & Orange');
  await expect(frame.locator('#pSum')).toContainText('for 1 of 8 children');
  expect(await frame.locator('#pWords .wchip').allTextContents()).toEqual(await body.evaluate(() => WORDS.slice(40, 60)));
  await expect(frame.locator('#pGroups h2')).toHaveText('For the 7 children not working on those words');
  /* the lowest remaining set, paired with the next when children are waiting on it */
  await expect(frame.locator('#pGList .pgrow')).toHaveText(['Group · 100 HFW 1–20Abe, Bea, Cal20 words', 'Group · 100 HFW 21–30Dee, Eli, Fay10 words', 'Group · 200 HFW 1–10Hal10 words']);
  await expect(frame.locator('#pTotal')).toContainText(/^4 tests on .*: the whole class \+ 3 groups$/);
  /* all of it is testPlan({start,len}) */
  expect(await body.evaluate(() => testPlan({ start: 4, len: 20 }).tests.map(t => [t.whole, t.title, t.pids.length, t.target.length])))
    .toEqual([[true, 'Whole class · 100 HFW 41–60', 8, 1], [false, 'Group · 100 HFW 1–20', 3, 3], [false, 'Group · 100 HFW 21–30', 3, 3], [false, 'Group · 200 HFW 1–10', 1, 1]]);

  /* the last set: the start is moved back so 20 words fit in the list */
  await col(9).click();
  await expect.poll(() => pressedSets(frame)).toEqual([8, 9]);
  await expect(frame.locator('#pSum')).toContainText('Words 81–100 · Gold & White');
  await expect(frame.locator('#pSum')).toContainText('for 0 of 8 children');
  await expect(frame.locator('#pGroups h2')).toHaveText('For the 8 children not working on those words');
  await expect(frame.locator('#pGList .pgrow')).toHaveCount(4);
  await expect(frame.locator('#pCreate')).toHaveText('Create 5 tests');

  /* another list: its own sets of ten, and the test stays put until one is tapped */
  await frame.locator('#pList').getByRole('button', { name: 'Next 200 HFW' }).click();
  await expect(frame.locator('#pCols .pcol')).toHaveCount(20);
  await expect.poll(() => pressedSets(frame)).toEqual([]);
  await expect(frame.locator('#pElse')).toHaveText('The test is set to start at 100 HFW 81–90. Tap a set here to move it.');
  await expect(frame.locator('#pSum')).toContainText('Words 81–100 · Gold & White');
  await expect(col(10)).toHaveAttribute('aria-label', 'Pink 1 to 10: 1 child. Start the test here.');
  await col(10).click();
  await expect.poll(() => pressedSets(frame)).toEqual([10, 11]);
  await expect(frame.locator('#pElse')).toHaveCount(0);
  await expect(frame.locator('#pSum')).toContainText('Words 1–20 · Pink & Red');
  await expect(frame.locator('#pSum')).toContainText('Next 200 high frequency words');
  await expect(frame.locator('#pSum')).toContainText('for 1 of 8 children');
  expect(await frame.locator('#pWords .wchip').allTextContents()).toEqual(await body.evaluate(() => WORDS.slice(100, 120)));
  await col(29).click();
  await expect.poll(() => pressedSets(frame), 'the last set of the 200 list').toEqual([28, 29]);
  await frame.locator('#pList').getByRole('button', { name: 'Y3/4 exception words' }).click();
  await expect(frame.locator('#pCols .pcol')).toHaveCount(11);
  await col(40).click();
  await expect.poll(() => pressedSets(frame)).toEqual([39, 40]);
  await expect(frame.locator('#pSum')).toContainText('Words 91–109');
  await expect(frame.locator('#pWords .wchip')).toHaveCount(19);
  expect((await storedB(page)).tests, 'nothing is saved until Create').toBeUndefined();
  expect(errors).toEqual([]);
});

test('Plan a test: group tests can be switched off, with a warning, and then only the whole-class test is created', async ({ page }) => {
  const frame = await openPlan(page);
  const sw = frame.getByRole('switch', { name: 'Add group tests' });
  await expect(frame.locator('#pWarn')).toHaveCount(0);
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(sw, 'the focus stays on the switch').toBeFocused();
  await expect(frame.locator('#pGList')).toHaveCount(0);
  await expect(frame.locator('#pWarn')).toHaveText('These 3 children will sit the whole-class test only, so they can’t move on this week.');
  await expect(frame.locator('#pTotal')).toContainText(/^1 test on [A-Z][a-z]+day \d+ [A-Z][a-z]+( \d{4})?$/);
  await expect(frame.locator('#pCreate')).toHaveText('Create 1 test');
  /* the keyboard works it too, and it comes back on */
  await sw.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(frame.locator('#pGList .pgrow')).toHaveCount(3);
  await expect(frame.locator('#pCreate')).toHaveText('Create 4 tests');
  await sw.click();
  await frame.getByLabel('Date of the tests').fill('2030-01-10');
  await frame.locator('#pCreate').click();
  await expect(frame.locator('#toast')).toHaveText('1 test created for Thursday 10 January 2030');
  const tests = Object.values((await storedB(page)).tests);
  expect(tests.map(t => [t.date, t.title, t.whole, t.words.length, t.pids.length])).toEqual([['2030-01-10', '100 HFW 11–30', true, 20, 8]]);
  await expect(frame.locator('.day[data-date="2030-01-10"] .trow')).toHaveCount(1);
});

test('Plan a test: Create saves the whole-class test and the group tests for the date, and returns to the list', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openPlan(page), body = frame.locator('body');
  const before = await storedB(page);
  await frame.locator('#pCols .pcol[data-g="4"]').click();
  await frame.getByLabel('Date of the tests').fill('2030-01-10');
  await expect(frame.locator('#pWhole .pstep')).toHaveText('1 · The whole-class test · Thu 10 Jan');
  await expect(frame.locator('#pTotal')).toHaveText('4 tests on Thursday 10 January 2030: the whole class + 3 groups');
  const plan = await body.evaluate(() => testPlan({ start: 4, len: 20 }).tests.map(t => ({ date: '2030-01-10', title: setsLabel(t.sets), whole: t.whole, words: t.words, pids: t.pids })));
  await frame.getByRole('button', { name: 'Create 4 tests' }).click();
  await expect(frame.locator('#toast')).toHaveText('4 tests created for Thursday 10 January 2030');
  await expect(frame.locator('#tPlan')).toHaveCount(0);
  await expect(frame.locator('#cList')).toBeVisible();

  const doc = await storedB(page), tests = Object.values(doc.tests).sort((a, b) => a.createdAt - b.createdAt);
  expect(tests.map(({ createdAt, ...t }) => t)).toEqual(plan);
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  expect(tests.map(t => [t.date, t.title, t.whole, t.words, t.pids])).toEqual([
    ['2030-01-10', '100 HFW 41–60', true, range(40, 60), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']],
    ['2030-01-10', '100 HFW 1–20', false, range(0, 20), ['a1', 'a2', 'a3']],
    ['2030-01-10', '100 HFW 21–30', false, range(20, 30), ['a4', 'a5', 'a6']],
    ['2030-01-10', '200 HFW 1–10', false, range(100, 110), ['a8']]]);
  for (const t of tests) expect(Object.keys(t).sort(), 'exactly the documented record').toEqual(['createdAt', 'date', 'pids', 'title', 'whole', 'words']);
  expect(doc.sessions, 'planning writes no marks').toEqual(before.sessions);
  expect(doc.settings).toEqual(before.settings);

  /* the list shows them under their date */
  const day = frame.locator('.day[data-date="2030-01-10"]');
  await expect(day.locator('h2')).toHaveText('Thursday 10 January 2030');
  await expect(day.locator('.trow .tname b')).toHaveText(['100 HFW 41–60', '100 HFW 1–20', '100 HFW 21–30', '200 HFW 1–10']);
  await expect(day.locator('.trow .tname .pill')).toHaveText(['Whole class', 'Group', 'Group', 'Group']);
  await expect(day.locator('.trow').nth(1).locator('.tname .muted')).toHaveText('Abe, Bea, Cal');
  await expect(day.locator('.dayhead .pill')).toHaveText('8 children still to mark');

  /* planning again opens fresh — testPlan()'s start, the next free Thursday — and Cancel saves nothing */
  await day.getByRole('button', { name: '+ Plan another test' }).click();
  await expect.poll(() => pressedSets(frame)).toEqual([1, 2]);
  await expect(frame.getByLabel('Date of the tests')).not.toHaveValue('2030-01-10');
  await frame.locator('#pFoot').getByRole('button', { name: 'Cancel' }).click();
  await expect(frame.locator('#cList')).toBeVisible();
  expect(Object.keys((await storedB(page)).tests)).toHaveLength(4);
  expect(errors).toEqual([]);
});

test('Plan a test: when the whole-class test covers every child there are no group tests to add', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));     // Kit and Nell, neither checked yet: both on 1–10
  await frame.getByRole('button', { name: 'Plan the test' }).click();
  await expect(frame.locator('#pSum')).toContainText('for 2 of 2 children');
  await expect(frame.locator('#pGroups h2')).toHaveText('Everyone is working on those words');
  await expect(frame.locator('#pNone')).toHaveText('No group tests are needed: the whole-class test covers the set every child is working on.');
  await expect(frame.getByRole('switch')).toHaveCount(0);
  await expect(frame.locator('#pGList, #pWarn')).toHaveCount(0);
  await expect(frame.locator('#pCreate')).toHaveText('Create 1 test');
});

test('Plan a test at phone width: the sets scroll inside their card and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const frame = await openPlan(page), body = frame.locator('body');
  const fits = () => body.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await fits()).toBe(true);
  expect(await frame.locator('#pCols .pcol').evaluateAll(els => els.every(e => e.offsetWidth >= 44 && e.offsetHeight >= 44))).toBe(true);
  expect(await frame.locator('.pscroll').evaluate(e => e.scrollWidth > e.clientWidth), 'the sets scroll inside the card').toBe(true);
  /* the chosen sets are inside the visible part of the strip, and stay there when the screen is redrawn */
  const shown = g => frame.locator('.pscroll').evaluate((sc, g) => { const a = sc.getBoundingClientRect(), b = sc.querySelector(`.pcol[data-g="${g}"]`).getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1; }, g);
  expect(await shown(1)).toBe(true);
  await frame.locator('#pCols .pcol[data-g="9"]').click();
  await expect.poll(() => pressedSets(frame)).toEqual([8, 9]);
  expect(await shown(9)).toBe(true);
  await frame.getByRole('switch', { name: 'Add group tests' }).click();
  await expect(frame.locator('#pWarn')).toBeVisible();
  expect(await shown(8), 'the start of the test is brought into view').toBe(true);
  expect(await fits()).toBe(true);
});

/* testPlan() now takes an optional start and length. Called with no
   arguments it must give exactly what it always gave: the copy below is the
   function as it was before the change, word for word, and the two are
   compared on the example class, on data saved before the redesign, and on
   classes spread across the lists, for every whole-class length.
   The copy is named testPlan, so inside originalTestPlan() `testPlan()` is
   the original and `window.testPlan()` is the page's. */
function originalTestPlan() {
  function testPlan(){
    const ids=pupilIds(),lv={};for(const id of ids)lv[id]=summary(id).level;
    const active=ids.filter(id=>lv[id]<NSETS),W=Math.max(1,Math.round((+S.settings.wholeN||20)/10));
    const tests=[];
    if(!active.length)return {tests,lv,W};
    let best=-1,bestN=-1;
    /* windows start on a set someone is on, so the test begins where they are */
    for(const g of [...new Set(active.map(id=>lv[id]))].sort((a,b)=>a-b)){const n=active.filter(id=>lv[id]>=g&&lv[id]<g+W).length;if(n>bestN){best=g;bestN=n}}
    const sets=[];for(let g=best;g<Math.min(best+W,NSETS);g++)sets.push(g);
    const inWhole=active.filter(id=>lv[id]>=best&&lv[id]<best+W);
    tests.push({whole:true,sets,words:sets.flatMap(setWords),pids:ids,target:inWhole,title:`Whole class · ${setsLabel(sets)}`});
    let rest=active.filter(id=>!inWhole.includes(id)).sort((a,b)=>lv[a]-lv[b]);
    while(rest.length){const g=lv[rest[0]];const two=rest.some(id=>lv[id]===g+1)&&g+1<NSETS&&listIdxOf(g*10)===listIdxOf((g+1)*10);
      const gs=two?[g,g+1]:[g],pids=rest.filter(id=>gs.includes(lv[id]));
      tests.push({whole:false,sets:gs,words:gs.flatMap(setWords),pids,target:pids,title:`Group · ${setsLabel(gs)}`});
      rest=rest.filter(id=>!pids.includes(id))}
    return {tests,lv,W};
  }
  const had = S.settings.wholeN, out = [];
  for (const n of [undefined, 10, 20, 30, 40, 25, 0, 'x']) {
    if (n === undefined) delete S.settings.wholeN; else S.settings.wholeN = n;
    out.push({ wholeN: String(n), then: JSON.stringify(testPlan()), now: JSON.stringify(window.testPlan()), empty: JSON.stringify(window.testPlan({})) });
  }
  if (had === undefined) delete S.settings.wholeN; else S.settings.wholeN = had;
  return out;
}
async function sameAsOriginal(frame, what) {
  const rows = await frame.locator('body').evaluate(originalTestPlan);
  expect(rows).toHaveLength(8);
  for (const r of rows) {
    expect(JSON.parse(r.now), `${what}, wholeN ${r.wholeN}`).toEqual(JSON.parse(r.then));
    expect(r.now, `${what}, wholeN ${r.wholeN}: the same, key for key and in the same order`).toBe(r.then);
    expect(r.empty, `${what}, wholeN ${r.wholeN}: testPlan({})`).toBe(r.then);
  }
  return rows.map(r => JSON.parse(r.now));
}
test('testPlan() with no arguments gives exactly what it gave before it took a start and a length', async ({ page }) => {
  const errors = collectErrors(page);
  /* data saved before the redesign */
  const snap = require('./data/hundred-words-before-tests.json');
  let frame = await openHW(page, { tp_hundred_words: JSON.stringify(snap.data) });
  const old = await sameAsOriginal(frame, 'the snapshot');
  expect(old[0].tests.map(t => ({ whole: t.whole, title: t.title, words: t.words, pids: t.pids, target: t.target })), 'and still what was recorded then').toEqual(snap.expected.testPlan);
  /* the example class: 24 children across the first hundred words */
  await frame.locator('body').evaluate(() => loadDemo());
  await expect(frame.locator('#banner')).toContainText('Example class');
  const demo = await sameAsOriginal(frame, 'the example class');
  expect(demo[0].tests.length).toBeGreaterThan(1);
  expect(Object.keys(demo[0].lv)).toHaveLength(24);
  /* the example class later on: children moved on by different amounts, some into the next lists and some finished */
  for (const step of [1, 3, 7, 13]) {
    await frame.locator('body').evaluate((el, step) => { pupilIds().forEach((id, k) => { const n = Math.min(WORDS.length, (summary(id).level + (k % 5) * step) * 10), words = {};
      for (let i = 0; i < n; i++) words[i] = { s: 'c' }; S.sessions[id + '_later'] = { pupilId: id, date: '2026-11-0' + (1 + step % 9), kind: 'spelling', words }; });
      memo = {}; }, step);
    await sameAsOriginal(frame, `the example class moved on by ${step}`);
  }
  expect(await frame.locator('body').evaluate(() => pupilIds().filter(id => summary(id).level >= NSETS).length), 'some children have finished every list').toBeGreaterThan(0);
  expect(await frame.locator('body').evaluate(() => new Set(pupilIds().map(id => Math.min(2, listIdxOf(Math.min(summary(id).level, NSETS - 1) * 10)))).size), 'and the rest are spread over all three').toBe(3);
  expect(errors).toEqual([]);
});
test('testPlan() with no arguments: the same as before for children at the ends of lists, and with nobody checked', async ({ page }) => {
  let frame = await openHW(page, planClass());
  const eight = await sameAsOriginal(frame, 'eight children');
  expect(eight[0].tests.map(t => t.title)).toEqual(['Whole class · 100 HFW 11–30', 'Group · 100 HFW 1–10', 'Group · 100 HFW 41–50', 'Group · 200 HFW 1–10']);
  /* with no start given the whole-class test may run on into the next list, as it always could; a start that is given keeps it inside one list */
  const ends = await frame.locator('body').evaluate(() => { const all = n => { const w = {}; for (let i = 0; i < n; i++) w[i] = { s: 'c' }; return w; };
    for (const k of Object.keys(S.sessions)) delete S.sessions[k];
    pupilIds().forEach((id, k) => { S.sessions[id + '_z'] = { pupilId: id, date: '2026-10-01', kind: 'spelling', words: all(k < 6 ? 90 : 400) }; }); memo = {};
    return [testPlan().tests.map(t => t.title), testPlan({ start: 9 }).tests.map(t => t.title), testPlan({ start: 9, len: 10 }).tests.map(t => t.title)]; });
  expect(ends).toEqual([['Whole class · 100 HFW 91–100 and 200 HFW 1–10', 'Group · Y3/4 CEW 101–109'], ['Whole class · 100 HFW 81–100', 'Group · Y3/4 CEW 101–109'], ['Whole class · 100 HFW 91–100', 'Group · Y3/4 CEW 101–109']]);
  await sameAsOriginal(frame, 'children at the ends of lists');
  await frame.locator('body').evaluate(() => { for (const k of Object.keys(S.sessions)) delete S.sessions[k]; memo = {}; });
  const none = await sameAsOriginal(frame, 'nobody checked yet');
  expect(none[0].tests.map(t => t.title)).toEqual(['Whole class · 100 HFW 1–20']);
});
