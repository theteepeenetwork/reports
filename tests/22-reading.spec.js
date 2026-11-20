/* 1:1 Reading tracker (js/reading.js).

   What these hold:
     1. A session saves under tp_reading_log with roster ids only, empty
        fields left out, and every rating as 0 / 1 / 2.
     2. Each step says what it looks like, and the line follows the tap.
     3. Edit retires the old record (del: 1) and adds a new one, and an edit
        never follows a change of pupil; delete keeps the record with del: 1
        and Undo sets del: 0. All of this is so a cloud merge, which keeps
        dropped fields and unions word lists, cannot undo a correction.
     4. Whole class puts never-heard first, then the longest wait.
     5. Last time's next step and the words that keep coming up are shown
        before the next session starts. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const KEY = 'tp_reading_log';
const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const iso = back => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };

async function open(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { extra: extra || {} });
  await page.goto('/index.html#reading');
  await page.waitForFunction(() => document.querySelector('#planApp .nav-link') && typeof window.rdRender === 'function', null, { timeout: 10000 });
  await page.evaluate(() => { if (location.hash !== '#reading') location.hash = '#reading'; window.rdRender(); });
}

test('reading: a session saves with words, ratings and guidance', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('.nav-link[data-page="reading"]')).toHaveText(/Reading/);
  await page.locator('#rdPupil').selectOption('p1');
  await expect(page.locator('.rd-last')).toContainText('No sessions logged yet');

  await page.locator('[data-rdf="date"]').fill('2026-11-16');
  await page.locator('#rdBook').fill('The Big Carrot');
  await page.locator('#rdBand').selectOption('Yellow');
  await page.locator('[data-rdpick="fit:right"]').click();
  await page.locator('#rdL_blended').fill('ship');
  await page.locator('#rdL_blended').press('Enter');
  await page.locator('#rdL_blended').fill('frog, chip');
  await page.locator('#rdL_blended').press('Enter');
  await expect(page.locator('#rdL_blended')).toBeFocused();
  await page.locator('#rdL_stuck').fill('night');          /* left typed, not entered: Save still takes it */
  await page.locator('[data-rdpick="strategy:sounds"]').click();

  /* the guidance line follows the step */
  const punct = page.locator('[data-rdrate="flu.punct"]');
  await punct.locator('[data-rdstep="0"]').click();
  await expect(punct.locator('.rd-guide')).toHaveText('Reads straight through full stops.');
  await punct.locator('[data-rdstep="1"]').click();
  await expect(punct.locator('.rd-guide')).toContainText('Pauses at full stops');
  await page.locator('[data-rdrate="flu.pace"] [data-rdstep="2"]').click();
  await page.locator('[data-rdrate="comp.retell"] [data-rdstep="2"]').click();
  await page.locator('[data-rdrate="comp.retell"] [data-rdstep="2"]').click();   /* again clears it */
  await page.locator('[data-rdrate="comp.infer"] [data-rdstep="0"]').click();
  await page.locator('#rdGuide').check();
  await expect(punct.locator('.rd-guide span')).toHaveCount(3);
  await expect(page.locator('#rdBook')).toHaveValue('The Big Carrot');           /* typing survives every redraw */

  await page.locator('#rdNextStep').fill('Practise igh words');
  await page.locator('#rdSave').click();
  await expect(page.locator('.rd-flash')).toContainText('Saved for Ava Bell');

  const s = await saved(page);
  expect(s.sessions).toHaveLength(1);
  const r = s.sessions[0];
  expect(r).toMatchObject({ pupilId: 'p1', date: '2026-11-16', book: 'The Big Carrot', band: 'Yellow', fit: 'right',
    blended: ['ship', 'frog', 'chip'], stuck: ['night'], strategy: 'sounds', flu: { pace: 2, punct: 1 }, comp: { infer: 0 }, next: 'Practise igh words' });
  expect(r.id).toBeTruthy();
  expect(r.note).toBeUndefined();
  expect(r.comp.retell).toBeUndefined();
  expect(JSON.stringify(s)).not.toContain('Ava');

  /* the form is clear again, and last time is shown first */
  await expect(page.locator('#rdBook')).toHaveValue('');
  await expect(page.locator('.rd-last')).toContainText('Practise igh words');
  expect(await page.evaluate(() => DATA_KEYS.indexOf('tp_reading_log') >= 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('reading: edit replaces the record; delete keeps it hidden and Undo restores it', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { [KEY]: { sessions: [
    { id: 's1', pupilId: 'p1', date: iso(9), book: 'Old Book', stuck: ['Night', 'could'], gpcs: ['igh'], flu: { pace: 0 }, next: 'Older step' },
    { id: 's2', pupilId: 'p1', date: iso(2), book: 'New Book', band: 'Blue', stuck: ['night'], gpcs: ['igh'], flu: { pace: 1 }, next: 'Newer step' }
  ] } });
  await page.locator('#rdPupil').selectOption('p1');
  /* before starting: last next step, and what has come up twice */
  await expect(page.locator('.rd-last')).toContainText('Newer step');
  await expect(page.locator('.rd-last')).toContainText('night ×2');
  await expect(page.locator('.rd-last')).toContainText('igh ×2');
  await expect(page.locator('.rd-last')).not.toContainText('could');

  await page.getByRole('button', { name: 'One child' }).click();
  await expect(page.locator('.rd-session')).toHaveCount(2);
  await expect(page.locator('.rd-session').first()).toContainText('New Book');

  await page.locator('[data-rdedit="s2"]').click();
  await expect(page.locator('.rd-editing')).toBeVisible();
  await expect(page.locator('#rdBook')).toHaveValue('New Book');
  await page.locator('#rdBook').fill('Newer Book');
  await page.locator('[data-rdrm="stuck:0"]').click();
  await page.locator('#rdSave').click();
  let s = await saved(page);
  expect(s.sessions).toHaveLength(3);
  expect(s.sessions.find(x => x.id === 's2')).toMatchObject({ del: 1, book: 'New Book', stuck: ['night'] });
  const e = s.sessions.find(x => !x.del && x.book === 'Newer Book');
  expect(e.id).not.toBe('s2');
  expect(e.pupilId).toBe('p1');
  expect(e.stuck).toBeUndefined();
  expect(e.band).toBe('Blue');
  await expect(page.locator('.rd-session').first()).toContainText('Newer Book');

  await page.locator('[data-rddel="s1"]').click();
  await expect(page.locator('.rd-session')).toHaveCount(1);
  s = await saved(page);
  expect(s.sessions.find(x => x.id === 's1').del).toBe(1);
  await page.locator('#rdUndo').click();
  await expect(page.locator('.rd-session')).toHaveCount(2);
  s = await saved(page);
  expect(s.sessions.find(x => x.id === 's1').del).toBe(0);

  /* an edit left open does not follow a change of pupil */
  await page.locator('[data-rdedit="s1"]').click();
  await expect(page.locator('#rdBook')).toHaveValue('Old Book');
  await page.locator('#rdPupil').selectOption('p2');
  await expect(page.locator('.rd-editing')).toHaveCount(0);
  await expect(page.locator('#rdBook')).toHaveValue('');
  await page.locator('#rdSave').click();
  s = await saved(page);
  expect(s.sessions.find(x => x.id === 's1')).toMatchObject({ pupilId: 'p1', book: 'Old Book', del: 0 });
  expect(s.sessions.filter(x => x.pupilId === 'p2')).toHaveLength(1);
  expect(s.sessions.find(x => x.pupilId === 'p2').book).toBeUndefined();
  expect(errors).toEqual([]);
});

test('reading: whole class puts never heard first, then the longest wait', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { [KEY]: { sessions: [
    { id: 'a', pupilId: 'p1', date: iso(1), band: 'Green', flu: { pace: 2, expr: 1, punct: 0 } },
    { id: 'b', pupilId: 'p2', date: iso(20) },
    { id: 'c', pupilId: 'p3', date: iso(8) },
    { id: 'd', pupilId: 'p4', date: iso(0) },
    { id: 'e', pupilId: 'p5', date: iso(3), del: 1 },
    { id: 'f', pupilId: 'p6', date: iso(3) }
  ] } });
  await page.getByRole('button', { name: 'Whole class' }).click();
  const order = await page.locator('[data-rdrow]').evaluateAll(rows => rows.map(r => r.dataset.rdrow));
  expect(order).toEqual(['p5', 'p2', 'p3', 'p6', 'p1', 'p4']);
  await expect(page.locator('[data-rdrow="p5"]')).toContainText('Not yet heard');
  await expect(page.locator('[data-rdrow="p2"] td.rd-late')).toHaveText('20 !');
  await expect(page.locator('[data-rdrow="p3"] td.rd-due')).toHaveText('8');
  await expect(page.locator('[data-rdrow="p4"]')).toContainText('Today');
  await expect(page.locator('[data-rdrow="p1"]')).toContainText('Green');
  await expect(page.locator('[data-rdrow="p1"] .rd-pill')).toHaveText(['Secure', 'Sometimes', 'Not yet']);

  await page.locator('[data-rdopen="p1"]').click();
  await expect(page.locator('#rdPupil')).toHaveValue('p1');
  await expect(page.locator('.rd-session')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('reading: permanent ids, and the pure parts', async ({ page }) => {
  await open(page);
  const rd = await page.evaluate(() => ({
    flu: RD.FLU.map(f => f.id), comp: RD.COMP.map(f => f.id), guides: RD.FLU.concat(RD.COMP, [RD.SELF]).every(f => f.g.length === 3),
    bands: RD.BANDS.slice(0, 3).map(b => b.n),
    rec: RD.recurring([{ stuck: ['Said', 'was'] }, { stuck: ['said', 'said'] }, { stuck: ['was'] }, { stuck: ['said'] }, {}], 'stuck'),
    words: RD.splitWords(' ship,  frog chip; '),
    days: RD.daysSince('2026-03-28', '2026-03-30')      /* across the BST change */
  }));
  expect(rd.flu).toEqual(['pace', 'expr', 'punct']);
  expect(rd.comp).toEqual(['retell', 'retrieve', 'infer', 'predict', 'vocab']);
  expect(rd.guides).toBe(true);
  expect(rd.bands).toEqual(['Pink', 'Red', 'Yellow']);
  expect(rd.rec).toEqual([{ w: 'Said', n: 3 }, { w: 'was', n: 2 }]);
  expect(rd.words).toEqual(['ship', 'frog', 'chip']);
  expect(rd.days).toBe(2);
});
