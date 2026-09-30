/* Markbook › Marking › Dictate — record, stop, and the table fills itself in.

   Nothing happens while the teacher talks; at Stop the whole recording is
   read — by Claude through /api/dictate when the teacher is signed in and the
   server has it switched on, otherwise by the on-device reader — and the
   marking table is filled in straight away, with one Undo.

   Speech recognition can't run headless, so these feed finished phrases
   through mkDictUtter(), the same path the recogniser's results take,
   including the "other guesses" it hears for each phrase. The Claude tests
   stand in for the server with page.route and check both what the page sends
   (the text, the alternatives, the sign-in token) and what it does with the
   answer. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const PUPILS = [
  { id: 'p1', name: 'Aurora Smith' },
  { id: 'p2', name: 'Zoey Jones' },
  { id: 'p3', name: 'Ben Cross' }
];
const TODAY = '2026-09-25';

async function open(page, { url, claude } = {}) {
  await page.clock.setFixedTime(new Date(TODAY + 'T10:00:00'));
  await blockExternal(page);
  if (claude) await claude(page);
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
const settled = page => page.waitForFunction(() => window.mkDictState().phase === 'idle' && window.mkDictState().result, null, { timeout: 5000 });

/* a stand-in for a signed-in teacher: the page asks Firebase for a token */
async function signIn(page) {
  await page.evaluate(() => {
    window.CLOUD.uid = 'teacher-1';
    window.firebase = { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('id-token-123') } }) };
  });
}

const EXAMPLE = 'create new maths activity called partitioning on 25/9, Aurora has answered most questions correctly ' +
  'but some struggled with tens as a numeral. Not met. Her date and titles arent as neat as they could be. ' +
  'Next pupil Zoey has answered all questions correctly, accessed the challenge, met, given gold star, date and title neat';

test('recording is only recording; at Stop the table fills itself in', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await openMarking(page);
  await page.locator('#mkDictBtn').click();
  await expect(page.locator('#mkDictMic')).toHaveText('🎤 Record');

  for (const u of [
    'create new maths activity called column addition on the 24th of September',
    'Aurora carried the tens correctly met',
    'next pupil Zoe got muddled with the ones not met'
  ]) await page.evaluate(t => window.mkDictUtter(t), u);

  /* while recording nothing is worked out: the words are there, the table is not */
  await expect(page.locator('#mkDictText')).toHaveValue(/Aurora carried the tens correctly met\. next pupil Zoe/);
  await expect(page.locator('.mk-dictres')).toHaveCount(0);
  expect(await marking(page)).toBeNull();

  await page.evaluate(() => window.mkDictUtter('next pupil Ben excellent effort gold star met finished marking'));
  await settled(page);

  const mk = await marking(page);
  const act = activity(mk, 'Column addition');
  expect(act.workDate).toBe('2026-09-24');
  const m = mk.marks[act.id];
  expect(m.p1.met).toBe('met');
  expect(m.p2.met, '"Zoe" is Zoey').toBe('not');
  expect(m.p2.comment).toBe('Got muddled with the ones.');
  expect(m.p3.markers.sort()).toEqual(['Excellent effort.', 'Gold star']);
  /* the box is empty for the next set; the result says what was done */
  await expect(page.locator('#mkDictText')).toHaveValue('');
  await expect(page.locator('.mk-dictres-top')).toContainText('3 books filled in');
  await expect(page.locator('.mk-dictfix'), 'the guessed name is listed to check').toContainText('“Zoe” → Zoey Jones');
  expect(errors).toEqual([]);
});

test('the teacher’s own example, typed, fills in one activity and two books', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.locator('#mkDictBtn').click();
  await page.locator('#mkDictText').fill(EXAMPLE);
  await page.locator('#mkDictGo').click();
  await settled(page);

  const mk = await marking(page);
  const act = activity(mk, 'Partitioning');
  expect(act.workDate).toBe('2026-09-25');
  expect(mk.sets.find(s => s.id === act.setId).name).toBe('Maths');
  const aurora = mk.marks[act.id].p1, zoey = mk.marks[act.id].p2;
  expect(aurora.met).toBe('not');
  expect(aurora.comment).toBe("Has answered most questions correctly but some struggled with tens as a numeral. Her date and titles aren't as neat as they could be.");
  expect(zoey.met).toBe('met');
  expect(zoey.markers.sort()).toEqual(['Challenge', 'Gold star']);
  expect(zoey.comment).toBe('Has answered all questions correctly, date and title neat.');
  await expect(page.locator('.mk-list-count')).toHaveText('2/3 marked');
});

test('Claude gets the alternatives and the class list, fills in the table, and lists its guesses', async ({ page }) => {
  let sent = null, auth = null;
  const claude = async p => {
    await p.route('**/api/dictate', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { enabled: true, signIn: true } });
      sent = route.request().postDataJSON(); auth = route.request().headers().authorization;
      return route.fulfill({ json: { plan: {
        activity: { mode: 'new', existingId: '', setId: 's_maths', newSetName: '', title: 'Partitioning', workDate: '2026-09-25' },
        entries: [
          { pupilId: 'p1', heard: 'Aurora', nameGuessed: false, met: 'not', markers: [], comment: 'Struggled with tens as a numeral.' },
          { pupilId: 'p2', heard: 'so we', nameGuessed: true, met: 'met', markers: ['Gold star'], comment: 'All correct.' },
          { pupilId: '', heard: 'Fred', nameGuessed: false, met: 'none', markers: [], comment: 'Tidy work.' }
        ],
        corrections: [{ heard: 'tennis numeral', meant: 'tens as a numeral' }, { heard: 'so we', meant: 'Zoey Jones' }],
        warnings: []
      } } });
    });
  };
  await open(page, { claude });
  await signIn(page);
  await openMarking(page);
  await page.locator('#mkDictBtn').click();
  await expect(page.locator('#mkDictVia')).toContainText('Claude reads your notes');

  await page.evaluate(() => {
    window.mkDictUtter('new maths activity called partitioning on 25/9');
    window.mkDictUtter('aurora struggled with tennis numeral not met', ['aurora struggled with tennis numeral not met', 'Aurora struggled with tens as a numeral not met']);
    window.mkDictUtter('next pupil so we all correct met goal star', ['next pupil so we all correct met goal star', 'next pupil Zoey all correct met gold star']);
    window.mkDictUtter('next pupil Fred tidy work');
    window.mkDictStop();
  });
  await settled(page);

  expect(auth).toBe('Bearer id-token-123');
  expect(sent.text).toContain('aurora struggled with tennis numeral not met');
  expect(sent.segments[1].alts, 'the other guesses go to Claude').toContain('Aurora struggled with tens as a numeral not met');
  expect(sent.pupils.map(p => p.name)).toEqual(['Aurora Smith', 'Ben Cross', 'Zoey Jones']);

  const mk = await marking(page);
  const act = activity(mk, 'Partitioning');
  expect(mk.marks[act.id].p1.comment).toBe('Struggled with tens as a numeral.');
  expect(mk.marks[act.id].p2.markers).toEqual(['Gold star']);
  await expect(page.locator('.mk-dictres-top')).toContainText('2 books filled in');
  await expect(page.locator('.mk-dictres-top')).toContainText('read by Claude');
  await expect(page.locator('.mk-dictfix')).toContainText('“tennis numeral” → tens as a numeral');
  await expect(page.locator('.mk-sh-name.guessed')).toHaveText('✓ Zoey Jones ?');

  /* Fred isn't in the class: the teacher says whose book it was */
  await expect(page.locator('.mk-dictskip')).toContainText('heard “Fred”');
  await page.locator('[data-skip="0"]').selectOption('p3');
  const after = await marking(page);
  expect(after.marks[act.id].p3.comment).toBe('Tidy work.');
  await expect(page.locator('.mk-dictskip')).toHaveCount(0);
});

test('if Claude can’t be reached, this device reads the notes and says so', async ({ page }) => {
  const claude = async p => p.route('**/api/dictate', route =>
    route.request().method() === 'GET' ? route.fulfill({ json: { enabled: true, signIn: true } }) : route.fulfill({ status: 502, json: { error: 'Claude could not read the note.' } }));
  await open(page, { claude });
  await signIn(page);
  await openMarking(page);
  await page.evaluate(() => { window.mkDictUtter('new maths activity called rounding on 25/9'); window.mkDictUtter('Ben rounded correctly met finished marking'); });
  await settled(page);
  const mk = await marking(page);
  expect(mk.marks[activity(mk, 'Rounding').id].p3.met).toBe('met');
  await expect(page.locator('.mk-dictres')).toContainText('This device read your notes instead');
});

test('Undo puts the table back and the notes back in the box', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.evaluate(() => {
    window.mkDictOpen('create new topic activity called rivers on 22/9. Ben labelled the river well, met');
    window.mkDictProcess();
  });
  await settled(page);
  expect(activity(await marking(page), 'Rivers')).toBeTruthy();
  await page.locator('#mkDictUndo').click();
  const mk = await marking(page);
  expect(activity(mk, 'Rivers'), 'the activity it created is gone').toBeFalsy();
  await expect(page.locator('#mkDictText')).toHaveValue(/Ben labelled the river well/);
});

test('a book it can’t put a name to is never guessed', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.evaluate(() => { window.mkDictOpen('create new english activity called setting description on 23/9. Ben lovely adjectives met. Next pupil Fred needs capital letters'); window.mkDictProcess(); });
  await settled(page);
  const mk = await marking(page);
  expect(Object.keys(mk.marks[activity(mk, 'Setting description').id])).toEqual(['p3']);
  await expect(page.locator('.mk-dictskip')).toContainText('heard “Fred”');
});

test('dictation and tap-to-mark write the same record', async ({ page }) => {
  await open(page);
  await openMarking(page);
  await page.evaluate(() => { window.mkDictOpen('create new topic activity called rivers on 22/9. Ben labelled the river well'); window.mkDictProcess(); });
  await settled(page);
  const row = page.locator('.mk-row', { hasText: 'Ben Cross' });
  await expect(row.locator('.mk-mark')).toHaveClass(/on/);
  await row.locator('[data-met]').click();
  const mk = await marking(page);
  const r = mk.marks[activity(mk, 'Rivers').id].p3;
  expect(r.met).toBe('met');
  expect(r.comment).toBe('Labelled the river well.');
});

test('a Siri Shortcut link fills in the table', async ({ page }) => {
  const text = 'create new maths activity called fractions on 21/9. Aurora met gold star. Next pupil Zoey not met, halves and quarters mixed up';
  await open(page, { url: '/index.html?dictate=' + encodeURIComponent(text) + '&save=1#markbook' });
  await settled(page);
  const mk = await marking(page);
  const act = activity(mk, 'Fractions');
  expect(mk.marks[act.id].p1.markers).toEqual(['Gold star']);
  expect(mk.marks[act.id].p2.comment).toBe('Halves and quarters mixed up.');
  expect(await page.evaluate(() => location.search), 'the link is not re-applied on reload').toBe('');
});
