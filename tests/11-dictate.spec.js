/* Markbook › Marking › Dictate — marking a set of books by voice.

   The promise to the teacher is "mark the whole set without touching the
   device", so these drive it the way the microphone does: one utterance at a
   time through mkDictUtter(), the same entry point speech recognition calls,
   including the spoken "scratch that" and "save books". The recognition
   itself can't run headless; everything after the words arrive is covered.

   The tap-to-mark rows stay the record: dictation writes the same
   tp_marking fields (markedDate, met, markers, comment), so the last test
   checks the two work on one book. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const PUPILS = [
  { id: 'p1', name: 'Aurora Smith' },
  { id: 'p2', name: 'Zoey Jones' },
  { id: 'p3', name: 'Ben Cross' }
];
const TODAY = '2026-09-25';

async function open(page, url) {
  await page.clock.setFixedTime(new Date(TODAY + 'T10:00:00'));
  await blockExternal(page);
  await seedDevice(page, { roster: PUPILS });
  await page.goto(url || '/index.html');
  await page.waitForFunction(() => typeof window.mkDictOpen === 'function' && document.querySelector('#mbTabs'), null, { timeout: 10000 });
  await page.waitForTimeout(300);
}
async function openMarking(page) {
  await page.locator('.nav-link[data-page="markbook"]').click();
  await page.waitForTimeout(200);
  await page.locator('#mbTabs button', { hasText: 'Marking' }).click();
  await page.waitForTimeout(200);
}
const marking = page => page.evaluate(() => JSON.parse(localStorage.getItem('tp_marking') || 'null'));
function activity(mk, title) { return mk.activities.find(a => a.title === title); }

const EXAMPLE = 'create new maths activity called partitioning on 25/9, Aurora has answered most questions correctly ' +
  'but some struggled with tens as a numeral. Not met. Her date and titles arent as neat as they could be. ' +
  'Next pupil Zoey has answered all questions correctly, accessed the challenge, met, given gold star, date and title neat';

test('the teacher’s own example becomes one activity and two marked books', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await openMarking(page);
  await page.locator('#mkDictBtn').click();
  await page.locator('#mkDictText').fill(EXAMPLE);
  await expect(page.locator('.mk-dictentry')).toHaveCount(2);
  await page.locator('#mkDictSave').click();
  await page.waitForTimeout(200);

  const mk = await marking(page);
  const act = activity(mk, 'Partitioning');
  expect(act, 'activity created').toBeTruthy();
  expect(act.workDate).toBe('2026-09-25');
  expect(mk.sets.find(s => s.id === act.setId).name).toBe('Maths');

  const aurora = mk.marks[act.id].p1, zoey = mk.marks[act.id].p2;
  expect(aurora.met).toBe('not');
  expect(aurora.markedDate).toBe(TODAY);
  expect(aurora.comment).toBe("Has answered most questions correctly but some struggled with tens as a numeral. Her date and titles aren't as neat as they could be.");
  expect(zoey.met).toBe('met');
  expect(zoey.markers.sort()).toEqual(['Challenge', 'Gold star']);
  expect(zoey.comment).toBe('Has answered all questions correctly, date and title neat.');
  expect(mk.marks[act.id].p3, 'Ben was not dictated').toBeUndefined();
  expect(mk.lastMarked[act.setId].p1).toBe(TODAY);
  /* the new markers join the quick markers so they can be toggled by tap later */
  expect(mk.quickButtons.map(q => q.text)).toEqual(expect.arrayContaining(['Gold star', 'Challenge']));

  await expect(page.locator('.mk-list-title')).toHaveText('Partitioning');
  await expect(page.locator('.mk-list-count')).toHaveText('2/3 marked');
  expect(errors).toEqual([]);
});

test('a whole set, hands-free: utterances, "scratch that" and "save books"', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await openMarking(page);
  /* no punctuation, as speech recognition delivers it; each call is one pause */
  for (const u of [
    'create new maths activity called column addition on the 24th of September',
    'Aurora carried the tens correctly met',
    'next pupil Zoe got muddled with the ones',
    'scratch that',
    'next pupil Zoe got muddled with the ones not met',
    'next pupil Ben excellent effort gold star met',
    'save books'
  ]) {
    await page.evaluate(t => window.mkDictUtter(t), u);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(200);

  const mk = await marking(page);
  const act = activity(mk, 'Column addition');
  expect(act.workDate).toBe('2026-09-24');
  const m = mk.marks[act.id];
  expect(m.p1.met).toBe('met');
  expect(m.p2.met, '"Zoe" is heard as Zoey').toBe('not');
  expect(m.p2.comment).toBe('Got muddled with the ones.');
  expect(m.p3.met).toBe('met');
  /* "excellent effort" is one of the teacher's own quick markers */
  expect(m.p3.markers.sort()).toEqual(['Excellent effort.', 'Gold star']);
  /* after saving, the box is empty and ready for the next set */
  await expect(page.locator('#mkDictText')).toHaveValue('');
  await expect(page.locator('.mk-dictmsg')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('a name it cannot match is left on screen, not guessed', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.evaluate(() => {
    window.mkDictUtter('create new english activity called setting description on 23/9');
    window.mkDictUtter('Ben lovely adjectives met');
    window.mkDictUtter('next pupil Fred needs capital letters');
    window.mkDictUtter('save books');
  });
  await page.waitForTimeout(200);
  const mk = await marking(page);
  const act = activity(mk, 'Setting description');
  expect(Object.keys(mk.marks[act.id])).toEqual(['p3']);
  await expect(page.locator('#mkDictText')).toHaveValue(/Fred/);
  await expect(page.locator('.mk-dictentry.bad')).toHaveCount(1);
});

test('dictation and tap-to-mark write the same record', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.evaluate(() => { window.mkDictOpen('create new topic activity called rivers on 22/9. Ben labelled the river well'); window.mkDictSave(); });
  await page.waitForTimeout(200);
  /* the book is marked, no outcome yet — the teacher taps ✓ on the row */
  const row = page.locator('.mk-row', { hasText: 'Ben Cross' });
  await expect(row.locator('.mk-mark')).toHaveClass(/on/);
  await row.locator('[data-met]').click();
  const mk = await marking(page);
  const r = mk.marks[activity(mk, 'Rivers').id].p3;
  expect(r.met).toBe('met');
  expect(r.comment).toBe('Labelled the river well.');
});

test('a Siri Shortcut link fills and saves the dictation', async ({ page }) => {
  const text = 'create new maths activity called fractions on 21/9. Aurora met gold star. Next pupil Zoey not met, halves and quarters mixed up';
  await open(page, '/index.html?dictate=' + encodeURIComponent(text) + '&save=1#markbook');
  await page.waitForTimeout(500);
  const mk = await marking(page);
  const act = activity(mk, 'Fractions');
  expect(act).toBeTruthy();
  expect(mk.marks[act.id].p1.markers).toEqual(['Gold star']);
  expect(mk.marks[act.id].p2.met).toBe('not');
  expect(mk.marks[act.id].p2.comment).toBe('Halves and quarters mixed up.');
  expect(await page.evaluate(() => location.search), 'the link is not re-applied on reload').toBe('');
});
