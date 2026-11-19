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
  await expect(frame.locator('.tbar')).toBeVisible();
  if (!(await frame.locator('.trow').count())) {
    await frame.getByRole('button', { name: '+ Plan the next tests' }).click();
    await frame.locator('#tPlan').getByRole('button', { name: /^Save \d+ tests?$/ }).click();
  }
  await frame.locator('.trow .tacts button[data-a="tMark"]').first().click();
  await expect(frame.locator('.markcard')).toBeVisible();
}

test('Hundred Words shows the active class from the hub and saves under that class', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));

  await expect(frame.locator('#cls')).toHaveText('Year 3');
  /* four tabs and a settings cog; Tests opens first */
  await expect(frame.locator('#nav button')).toHaveText(['Tests', 'Class', 'Pupils', 'Print']);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  /* a class with no tests at all says so, and can still mark one child */
  await expect(frame.locator('#tNone')).toContainText('No tests yet');
  await frame.getByRole('button', { name: 'Mark one child, any words' }).click();
  await expect(frame.locator('.tile')).toHaveCount(100);
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
  await expect(frame.locator('#mTest option:checked')).toHaveText(/ · Whole class · 100 HFW 1–20 \(20 words\)$/);
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
  await frame.getByRole('button', { name: 'Back to all tests' }).click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await expect(frame.locator('.trow').first().locator('.tprog')).toContainText('1 of 2 marked');

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

test('Mark opens from a test; a fully marked test re-opens with its marks, and they can be changed', async ({ page }) => {
  const extra = twoClasses('b');
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {},
    tests: { t1: { date: '2030-01-10', title: '100 HFW 21–30', whole: false, words: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29], pids: ['x2'], createdAt: 5 } }, settings: {} });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));

  /* the past whole-class test is fully marked: Results opens it with the saved marks */
  const past = frame.locator('.day[data-date="2026-10-01"] .trow').nth(0);
  await past.getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  await expect(frame.locator('#mTest option:checked')).toHaveText('1 Oct · Whole class · 100 HFW 1–20 (20 words)');
  await expect(frame.locator('#qDate')).toHaveValue('2026-10-01');
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
  /* ← All tests goes back, and the test shows the new result */
  await frame.locator('#mBack').click();
  await expect(frame.locator('.markcard')).toHaveCount(0);
  await expect(past.locator('.tres')).toContainText('avg 20/20');     // (19 + 20) / 2 = 19.5
  await expect(past.locator('.tacts button').last()).toHaveText('Results');

  /* the top bar lists every test, and "one child, any words" */
  await past.getByRole('button', { name: 'Results' }).click();
  await expect(frame.locator('#mTest option')).toHaveText(['10 Jan · Group · 100 HFW 21–30 (10 words)', '1 Oct · Whole class · 100 HFW 1–20 (20 words)',
    '1 Oct · Group · 100 HFW 21–30 (10 words)', 'One child, any words…']);
  await frame.locator('#mTest').selectOption('t1');
  await expect(frame.locator('#qDate')).toHaveValue('2030-01-10');
  await expect(frame.locator('.pl')).toHaveCount(1);
  await expect(frame.locator('.tile')).toHaveCount(10);
  /* only the last word Nell got wrong last time is flagged */
  await expect(frame.locator('.tile[data-i="25"] .hint')).toHaveText('✗ last time');
  await expect(frame.locator('.tile[data-i="24"] .hint')).toHaveText('✓ last time');
  await frame.locator('.tile[data-i="25"]').click();
  expect((await stored()).sessions['x2_2030-01-10'].words).toEqual({ 25: { s: 'c', src: 'manual' } });
  /* the date in the bar is the test's date: changing it moves the test and its marks */
  await frame.locator('#qDate').fill('2030-01-11');
  await frame.locator('#qDate').blur();
  await expect(frame.locator('#mTest option:checked')).toHaveText('11 Jan · Group · 100 HFW 21–30 (10 words)');
  await expect(frame.locator('.tile[data-i="25"]')).toHaveClass(/\bc\b/);
  const doc = await stored();
  expect(doc.tests.t1.date).toBe('2030-01-11');
  expect(doc.sessions['x2_2030-01-10']).toBeUndefined();
  expect(doc.sessions['x2_2030-01-11'].words).toEqual({ 25: { s: 'c', src: 'manual' } });
  /* an edit made on Tests shows in Mark */
  await frame.locator('body').evaluate(() => { saveTest('t1', { ...findTest('t1'), pids: ['x1', 'x2'] }); });
  await expect(frame.locator('.pl')).toHaveCount(2);
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

  /* "+ Plan the next tests" shows that plan before anything is saved */
  await frame.getByRole('button', { name: '+ Plan the next tests' }).click();
  const form = frame.locator('#tPlan');
  await expect(form).toContainText('100 HFW 41–60');
  await expect(form).toContainText('everyone · current set for 2');
  await expect(form).toContainText('200 HFW 1–10');
  await expect(form.getByRole('button', { name: 'Save 2 tests' })).toBeVisible();
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(frame.locator('#tPlan')).toHaveCount(0);
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

test('Tests: past tests are built from old sessions, and every test keeps Sheets, Script and Mark', async ({ page }) => {
  const errors = collectErrors(page);
  const extra = twoClasses('b');
  const before = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {}, settings: {} });
  extra['tp_hundred_words::b'] = before;
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));

  /* no test was ever saved, yet 1 Oct shows its two tests: the one both children sat, and Nell's own */
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Tests');
  const day = frame.locator('.day[data-date="2026-10-01"]');
  await expect(day.locator('h2')).toHaveText(/^Thursday 1 October( 2026)?$/);   // the year shows once it is no longer this year
  await expect(day.locator('.dayhead .pill')).toHaveText('All marked');
  const rows = day.locator('.trow');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.tname')).toContainText('Whole class100 HFW 1–20');
  await expect(rows.nth(0).locator('.tname')).toContainText('Pink & Red · everyone');
  await expect(rows.nth(0).locator('.tprog')).toContainText('All 2 marked');
  await expect(rows.nth(0).locator('.tres')).toHaveText('avg 19/20 · 1 moved on');     // (18 + 20) / 2; Nell went past both sets
  await expect(rows.nth(1).locator('.tname')).toContainText('Group100 HFW 21–30');
  await expect(rows.nth(1).locator('.tname')).toContainText('Yellow · 1 child');
  await expect(rows.nth(1).locator('.tres')).toHaveText('avg 9/10');
  /* the three actions are there on a past, fully marked test */
  await expect(rows.nth(0).locator('.tacts button')).toHaveText(['Sheets', 'Script', 'Results']);
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')), 'showing past tests rewrites nothing').toBe(before);

  /* they print through the existing generators */
  await frame.locator('body').evaluate(() => { window.__calls = [];
    PDF.testSheets = t => window.__calls.push(['sheets', t.title, t.words.length, t.pids]); PDF.testScript = t => window.__calls.push(['script', t.title, t.words.length]); });
  await rows.nth(0).getByRole('button', { name: 'Sheets' }).click();
  await rows.nth(1).getByRole('button', { name: 'Script' }).click();
  expect(await frame.locator('body').evaluate(() => window.__calls.splice(0))).toEqual([
    ['sheets', 'Whole class · 100 HFW 1–20', 20, ['x1', 'x2']], ['script', 'Group · 100 HFW 21–30', 10]]);

  /* tapping a test shows its words and its children, ticked once marked */
  await rows.nth(0).locator('.tname').click();
  await expect(rows.nth(0).locator('.tname')).toHaveAttribute('aria-expanded', 'true');
  const det = frame.locator('#tDet');
  await expect(det.locator('.wchip')).toHaveCount(20);
  await expect(det.locator('.kid')).toHaveText(['Kit ✓', 'Nell ✓']);
  for (const name of ['Change date', 'Edit words or children', 'Delete test']) await expect(det.getByRole('button', { name })).toBeVisible();
  await det.locator('.kid', { hasText: 'Kit' }).click();
  await expect(frame.locator('#drawer')).toContainText('Kit Marlow');
  await frame.locator('#pClose').click();
  await rows.nth(0).locator('.tname').click();
  await expect(frame.locator('#tDet')).toHaveCount(0);

  /* plan the next tests for a date the teacher picks */
  await frame.getByRole('button', { name: '+ Plan the next tests' }).click();
  await frame.locator('#tPlanDate').fill('2030-01-10');
  await frame.locator('#tPlan').getByRole('button', { name: 'Save 2 tests' }).click();
  const tests = Object.values((await stored()).tests).sort((a, b) => a.createdAt - b.createdAt);
  expect(tests.map(t => [t.date, t.title, t.whole, t.words.length, t.words[0], t.pids])).toEqual([
    ['2030-01-10', '100 HFW 1–20', true, 20, 0, ['x1', 'x2']],        // Kit is on 1–10: most children... both sit it
    ['2030-01-10', '100 HFW 21–30', false, 10, 20, ['x2']]]);
  expect(Object.keys(tests[0]).sort(), 'exactly the documented record').toEqual(['createdAt', 'date', 'pids', 'title', 'whole', 'words']);
  expect((await stored()).sessions, 'planning a test touches no session').toEqual(JSON.parse(before).sessions);

  /* newest first, with a pill for each date, and the same three actions on a test nobody has sat */
  await expect(frame.locator('.day h2')).toHaveText(['Thursday 10 January 2030', /^Thursday 1 October( 2026)?$/]);
  const next = frame.locator('.day[data-date="2030-01-10"]');
  await expect(next.locator('.dayhead .pill')).toHaveText('3 still to mark');
  await expect(next.locator('.trow').nth(0).locator('.tprog')).toContainText('Not marked yet');
  await expect(next.locator('.trow').nth(0).locator('.tres')).toHaveText('—');
  await expect(next.locator('.trow').nth(0).locator('.tacts button')).toHaveText(['Sheets', 'Script', 'Mark']);
  await expect(next.locator('.trow').nth(1).locator('.tacts button')).toHaveText(['Sheets', 'Script', 'Mark']);
  /* planning the same date again adds nothing */
  await frame.getByRole('button', { name: '+ Plan the next tests' }).click();
  await frame.locator('#tPlanDate').fill('2030-01-10');
  await frame.locator('#tPlan').getByRole('button', { name: 'Save 2 tests' }).click();
  await expect(frame.locator('.trow')).toHaveCount(4);

  /* the filters */
  const filters = frame.locator('.tbar .f');
  await expect(filters).toHaveText(['All tests', 'Still to mark', 'Fully marked']);
  await filters.nth(1).click();
  await expect(frame.locator('.day h2')).toHaveText(['Thursday 10 January 2030']);
  await filters.nth(2).click();
  await expect(frame.locator('.day h2')).toHaveText([/^Thursday 1 October( 2026)?$/]);
  await filters.nth(0).click();
  await expect(frame.locator('.trow')).toHaveCount(4);

  /* mark Nell's group test in full: it becomes Results, the whole-class one Carry on marking once started */
  await next.locator('.trow').nth(1).getByRole('button', { name: 'Mark' }).click();
  await expect(frame.locator('#who')).toHaveText('Nell Gwyn');
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await frame.getByRole('button', { name: 'Back to all tests' }).click();
  await expect(next.locator('.trow').nth(1).locator('.tacts button')).toHaveText(['Sheets', 'Script', 'Results']);
  await expect(next.locator('.trow').nth(1).locator('.tres')).toHaveText('avg 10/10 · 1 moved on');
  await next.locator('.trow').nth(0).getByRole('button', { name: 'Mark' }).click();
  await frame.locator('.tile[data-i="0"]').click();
  await frame.locator('#nav button', { hasText: 'Tests' }).click();
  await expect(next.locator('.trow').nth(0).locator('.tacts button')).toHaveText(['Sheets', 'Script', 'Carry on marking']);
  await expect(next.locator('.dayhead .pill')).toHaveText('2 still to mark');

  /* the practice card leads to Print › Practice sheets */
  await frame.getByRole('button', { name: 'Print practice sheets' }).click();
  await expect(frame.locator('#nav button[aria-current="page"]')).toHaveText('Print');
  await expect(frame.locator('#cfgH')).toHaveText('Practice sheets');
  expect(errors).toEqual([]);
});

test('Tests: change the date, edit the words or children, and delete with a confirm', async ({ page }) => {
  const extra = twoClasses('b');
  extra['tp_roster::b'] = JSON.stringify([...OTHER, { id: 'x3', name: 'Tam Lin' }]);
  extra['tp_hundred_words::b'] = JSON.stringify({ sessions: oldSessions(), practice: {}, plans: {},
    tests: { t1: { date: '2030-01-10', title: '100 HFW 21–30', whole: false, words: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29], pids: ['x1', 'x2'], createdAt: 5 } }, settings: {} });
  const frame = await openHW(page, extra);
  const stored = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const row = id => frame.locator(`.trow[data-test="${id}"]`);
  const det = frame.locator('#tDet');

  /* Kit is marked for the saved test, then it turns out it was sat a day later: the marks go with it */
  await row('t1').getByRole('button', { name: 'Mark' }).click();
  await frame.getByRole('button', { name: 'Mark the rest correct' }).click();
  await frame.getByRole('button', { name: /^Next/ }).click();
  await frame.locator('#nav button', { hasText: 'Tests' }).click();
  await expect(row('t1').locator('.tprog')).toContainText('1 of 2 marked');
  await row('t1').locator('.tname').click();
  await expect(det.locator('.kid')).toHaveText(['Kit ✓', 'Nell — not marked']);
  await det.getByRole('button', { name: 'Change date' }).click();
  await expect(det).toContainText('The marks 1 child has for this test move to the new date with it.');
  await frame.locator('#tDate').fill('2030-01-11');
  await det.getByRole('button', { name: 'Save date' }).click();
  await expect(frame.locator('.day[data-date="2030-01-11"] .trow')).toHaveCount(1);
  await expect(frame.locator('.day[data-date="2030-01-10"]')).toHaveCount(0);
  let doc = await stored();
  expect(doc.tests.t1.date).toBe('2030-01-11');
  expect(doc.sessions['x1_2030-01-10']).toBeUndefined();
  expect(Object.keys(doc.sessions['x1_2030-01-11'].words).length).toBe(10);
  await expect(row('t1').locator('.tprog')).toContainText('1 of 2 marked');

  /* edit: add a set of ten and Tam; the marks already entered stay */
  await det.getByRole('button', { name: 'Edit words or children' }).click();
  await det.locator('[role="group"][aria-label="Sets of ten"]').getByRole('button', { name: /Blue/ }).click();
  await det.locator('[role="group"][aria-label="Children"]').getByRole('button', { name: 'Tam Lin' }).click();
  await det.getByRole('button', { name: 'Save test' }).click();
  doc = await stored();
  expect(doc.tests.t1).toMatchObject({ title: '100 HFW 21–40', whole: true, pids: ['x1', 'x2', 'x3'] });
  expect(doc.tests.t1.words.length).toBe(20);
  expect(Object.keys(doc.sessions['x1_2030-01-11'].words).length).toBe(10);
  await expect(row('t1').locator('.tname')).toContainText('Whole class100 HFW 21–40');
  await expect(row('t1').locator('.tprog')).toContainText('Not marked yet');      // Kit now has 10 of its 20 words
  await expect(row('t1').locator('.tacts button').last()).toHaveText('Carry on marking');

  /* delete asks first, and says the marks go too */
  await det.getByRole('button', { name: 'Delete test' }).click();
  await expect(det).toContainText('The marks 1 child has for it are deleted too');
  await det.getByRole('button', { name: 'Cancel' }).click();
  expect((await stored()).tests.t1).toBeTruthy();
  await det.getByRole('button', { name: 'Delete test' }).click();
  await det.getByRole('button', { name: 'Delete test and marks' }).click();
  await expect(row('t1')).toHaveCount(0);
  doc = await stored();
  expect(doc.tests.t1).toBeUndefined();
  expect(doc.sessions['x1_2030-01-11']).toBeUndefined();
  expect(Object.keys(doc.sessions).sort(), 'the old sessions are as they were').toEqual(['x1_2026-10-01', 'x2_2026-10-01']);

  /* a past test gets a record only when the teacher changes it */
  expect(Object.keys(doc.tests || {})).toEqual([]);
  const old = frame.locator('.day[data-date="2026-10-01"] .trow').nth(1);
  await old.locator('.tname').click();
  await det.getByRole('button', { name: 'Edit words or children' }).click();
  await det.locator('[role="group"][aria-label="Children"]').getByRole('button', { name: 'Kit Marlow' }).click();
  await det.getByRole('button', { name: 'Save test' }).click();
  doc = await stored();
  const rec = Object.values(doc.tests);
  expect(rec.length).toBe(1);
  expect(rec[0]).toMatchObject({ date: '2026-10-01', title: '100 HFW 21–30', whole: false, pids: ['x1', 'x2'] });
  expect(doc.sessions['x2_2026-10-01'], 'and its marks stay where they were').toEqual(oldSessions()['x2_2026-10-01']);
  await expect(frame.locator('.day[data-date="2026-10-01"] .trow').nth(1).locator('.tprog')).toContainText('1 of 2 marked');
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
  /* Teach to the class: classMissed(), with how many children, and the posters for those words */
  await expect(frame.locator('section[aria-labelledby="i1"] .wchip')).toHaveText(['was1', 'you1']);
  await frame.locator('section[aria-labelledby="i1"]').getByRole('button', { name: /Word of the day/ }).click();
  await expect(frame.locator('#cfgH')).toHaveText('Word of the day');
  await frame.locator('#nav button', { hasText: 'Class' }).click();
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

test('Pupils: a card each, the four filters, and practice sheets for everyone', async ({ page }) => {
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
  await frame.locator('#nav button', { hasText: 'Class' }).click();
  await frame.locator('table.sg').getByRole('button', { name: 'Nell Gwyn', exact: true }).click();
  await expect(panel.locator('#pName')).toHaveText('Nell Gwyn');
  await panel.locator('#pClose').press('Escape');
  await expect(panel).toBeHidden();

  /* from a child in an open test, too */
  await frame.locator('#nav button', { hasText: 'Tests' }).click();
  await frame.locator('.trow .tname').first().click();
  await frame.locator('#tDet .kid', { hasText: 'Nell' }).click();
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
