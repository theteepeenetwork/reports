/* Markbook › Marking — the class feedback sheet at the end of a set.

   What a teacher wants from it: who met the objective and who didn't, and
   which children got the same feedback even though no two comments are ever
   worded the same. The grouping must never put opposite feedback together
   ("neat" with "not as neat", praise with a next step, "all" with "most"),
   because the sheet is what the next lesson gets planned from. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const PUPILS = ['Aurora Smith', 'Zoey Jones', 'Ben Cross', 'Cleo Dunn', 'Dev Patel', 'Esme Hart', 'Finn Ozer', 'Grace Lee']
  .map((name, i) => ({ id: 'p' + i, name }));

async function open(page) {
  await page.clock.setFixedTime(new Date('2026-09-28T10:00:00'));
  await blockExternal(page);
  await seedDevice(page, { roster: PUPILS });
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.mkDictUtter === 'function' && window.mkFeedback && document.querySelector('#mbTabs'), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.locator('.nav-link[data-page="markbook"]').click();
  await page.locator('#mbTabs button', { hasText: 'Marking' }).click();
  await page.waitForTimeout(200);
}

/* A set of eight books, spoken the way speech recognition delivers it:
   one call per pause, no punctuation, ending with "finished marking". */
const SET = [
  'create new maths activity called partitioning on 25/9',
  'Aurora has answered most questions correctly but some struggled with tens as a numeral', 'not met',
  "her date and titles aren't as neat as they could be",
  'next pupil Zoe has answered all questions correctly accessed the challenge met given gold star date and title neat',
  'next pupil Ben struggled with the tens numerals', 'not met', 'date and title neat',
  'next pupil Cleo answered all the questions correctly', 'met', 'accessed the challenge',
  'next pupil Dev found writing tens as numerals tricky', 'working towards', 'untidy date and title',
  'next pupil Esme lovely use of the part whole model', 'met gold star',
  'next pupil Finn needs to use a ruler for the part whole model', 'not met',
  'finished marking'
];

test('similar comments are grouped; opposite feedback never is', async ({ page }) => {
  await open(page);
  const g = await page.evaluate(() => window.mkFeedback.group([
    { id: 'a', comment: "Has answered most questions correctly but some struggled with tens as a numeral. Her date and titles aren't as neat as they could be." },
    { id: 'b', comment: 'Struggled with the tens numerals. Date and title neat.' },
    { id: 'z', comment: 'Has answered all questions correctly, date and title neat.' },
    { id: 'c', comment: 'Answered all the questions correctly.' },
    { id: 'd', comment: 'Found writing tens as numerals tricky. Untidy date and title.' },
    { id: 'e', comment: 'Lovely use of the part-whole model.' },
    { id: 'f', comment: 'Needs to use a ruler for the part whole model.' }
  ]));
  const find = ids => g.themes.find(t => JSON.stringify(t.ids.slice().sort()) === JSON.stringify(ids));
  expect(find(['a', 'b', 'd']), 'three ways of saying "struggled with tens"').toBeTruthy();
  expect(find(['c', 'z']), '"all questions correct"').toBeTruthy();
  expect(find(['b', 'z']), '"date and title neat"').toBeTruthy();
  expect(find(['a', 'd']), '"not neat" is its own group').toBeTruthy();
  /* never together */
  expect(g.themes.some(t => t.ids.includes('e') && t.ids.includes('f')), 'praise and a next step').toBe(false);
  expect(g.themes.some(t => /correct/i.test(t.label) && t.ids.includes('a')), '"most" joined "all"').toBe(false);
  expect(g.themes.find(t => /neat/i.test(t.label) && t.ids.includes('b')).ids).not.toContain('a');
  /* what is left of each comment is still there, not lost */
  expect(g.individual.find(x => x.id === 'a').text).toMatch(/most questions correctly/i);
  expect(g.individual.map(x => x.id).sort()).toEqual(['a', 'e', 'f']);
});

test('"finished marking" saves the set and opens the class feedback sheet', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  for (const u of SET) await page.evaluate(t => window.mkDictUtter(t), u);
  await page.waitForTimeout(400);

  const sheet = page.locator('#mkSheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.mk-sh-title')).toHaveText('Class feedback · Partitioning');
  await expect(sheet.locator('.mk-sh-sub')).toContainText('7 of 8 books marked');

  const box = cls => sheet.locator('.mk-sh-box.' + cls + ' .mk-sh-name');
  await expect(box('met')).toHaveText(['Cleo Dunn', 'Esme Hart', 'Zoey Jones']);
  /* Dev was "working towards", which is not met */
  await expect(box('not')).toHaveText(['Aurora Smith', 'Ben Cross', 'Dev Patel', 'Finn Ozer']);
  await expect(box('todo')).toHaveText(['Grace Lee']);
  expect(await page.evaluate(() => {
    const mk = JSON.parse(localStorage.getItem('tp_marking'));
    const a = mk.activities.find(x => x.title === 'Partitioning');
    return mk.marks[a.id].p4.met;
  })).toBe('not');

  const theme = label => sheet.locator('.mk-sh-theme', { hasText: label });
  await expect(theme('tens').locator('.mk-sh-name')).toHaveText(['✗ Aurora Smith', '✗ Ben Cross', '✗ Dev Patel']);
  await expect(theme('Answered all').locator('.mk-sh-name')).toHaveText(['✓ Cleo Dunn', '✓ Zoey Jones']);
  await expect(sheet.locator('.mk-sh-row', { hasText: 'Gold star' }).locator('.mk-sh-name')).toHaveText(['✓ Esme Hart', '✓ Zoey Jones']);
  /* the praise and the next step about the part-whole model stay apart */
  await expect(sheet.locator('.mk-sh-theme', { hasText: 'part' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the sheet prints on its own and the summary fills in from it', async ({ page }) => {
  await open(page);
  for (const u of SET) await page.evaluate(t => window.mkDictUtter(t), u);
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = document.getElementById('starterPrint').innerHTML; }; });

  await page.locator('#mkFbRebuild').click();
  await expect(page.locator('#mkSummary')).toHaveValue(/Met \(3\): Cleo Dunn, Esme Hart, Zoey Jones/);
  await expect(page.locator('#mkSummary')).toHaveValue(/Common feedback:\n• Struggled with the tens numerals \(3\)/);
  await page.locator('#mkFbSave').click();

  await page.locator('#mkFbPrint').click();
  const printed = await page.evaluate(() => window.__printed);
  expect(printed).toContain('Class feedback · Partitioning');
  expect(printed).toContain('Struggled with the tens numerals');
  expect(printed, 'the saved summary prints too').toContain('Class summary');
});

test('the dictation panel says what is waiting to be saved', async ({ page }) => {
  await open(page);
  await page.locator('#mkDictBtn').click();
  await expect(page.locator('#mkDictSave')).toBeDisabled();
  await page.evaluate(() => {
    window.mkDictUtter('create new maths activity called rounding on 26/9');
    window.mkDictUtter('Aurora rounded to the nearest ten met');
    window.mkDictUtter('next pupil Fred rounded down every time');
  });
  await expect(page.locator('.mk-dictstep').first()).toContainText('Rounding');
  await expect(page.locator('#mkDictSave')).toHaveText('✓ Save 1 book (1 left out)');
  await expect(page.locator('.mk-dictcards-h')).toHaveText(/not saved yet/i);
  await expect(page.locator('.mk-dictentry.bad')).toContainText('pick who this is');

  /* the help lists what can be said, including the new end-of-set command */
  await page.locator('#mkDictHelp').click();
  await expect(page.locator('.mk-dicthelp')).toContainText('Finished marking');
});
