/* A saved week of starters is a teacher's planning, not a cache.

   Two bugs, both found by a teacher rather than by this suite, both with the
   same shape: something other than "Generate & save" changed what was on the
   board.

     1. stEnsureCurrent() used to rebuild an untouched current week whenever
        its length no longer matched tp_starter_cfg.qCount. That was a
        migration for old 10-question weeks, and it was harmless while qCount
        lived in a corner of the week screen. Once the Sep 2026 redesign moved
        qCount onto the design step, changing Per day while designing NEXT
        week silently replaced THIS week's five saved sets.

     2. The board control forced the selected week back to this Monday every
        time, so a teacher who had just designed next week put last week's
        questions on the board — and on a Sunday, the previous Friday's.

   The rule these tests hold: a saved week changes ONLY through Generate &
   save, and Show on board opens the week the teacher is working in. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function open(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { extra: extra });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => document.querySelector('#planApp .nav-link') && typeof window.hubOpenStarter === 'function',
    null, { timeout: 10000 });
  await page.evaluate(() => { window.location.hash = '#mental-starters'; });
  await page.waitForTimeout(400);
}

/* The Monday of the week containing today, computed the way hub.js does it —
   local date parts, never toISOString(), which rolls a BST midnight back a
   day. Tests that hard-code a date rot; this does not. */
function mondayOf(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  const p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  const p = v => String(v).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

const firstQuestions = page => page.evaluate(() => {
  const w = JSON.parse(localStorage.getItem('tp_starter_weeks') || '{}');
  const out = {};
  Object.keys(w).forEach(k => { out[k] = { len: w[k][0].length, q1: window.genRenderQuestion(w[k][0][0]) }; });
  return out;
});

test('changing the per-day count does not rewrite a week already saved', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { tp_starter_cfg: { qCount: 20, xtb: true } });

  const before = await firstQuestions(page);
  const week = mondayOf();
  expect(before[week], 'this week should have been generated on first open').toBeTruthy();
  expect(before[week].len).toBe(20);

  /* The teacher opens the design step and picks a shorter sheet, but does not
     press Generate & save — they change their mind and go back. */
  await page.click('#tv-starter #designWeek');
  await page.waitForTimeout(300);
  await page.click('#tv-design [data-count="10"]');
  await page.waitForTimeout(300);
  await page.click('#tv-design #msCancel');
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tp_starter_cfg')).qCount)).toBe(10);
  expect(await firstQuestions(page), 'the saved week was rebuilt behind the teacher').toEqual(before);

  /* And it survives a reload, which is where stEnsureCurrent() runs. */
  await page.reload();
  await page.waitForTimeout(800);
  expect(await firstQuestions(page), 'a reload rebuilt the saved week').toEqual(before);
  expect(errors).toEqual([]);
});

test('Generate & save is the one thing that does replace the week', async ({ page }) => {
  /* The mirror of the test above: the guard must not have frozen the feature. */
  await open(page, { tp_starter_cfg: { qCount: 20, xtb: true } });
  const before = await firstQuestions(page);
  const week = mondayOf();

  await page.click('#tv-starter #designWeek');
  await page.waitForTimeout(300);
  await page.click('#tv-design [data-count="10"]');
  await page.waitForTimeout(300);
  await page.click('#tv-design #msSave');
  await page.waitForTimeout(600);

  const after = await firstQuestions(page);
  expect(after[week].len, 'Generate & save did not apply the new length').toBe(10);
  expect(before[week].len).toBe(20);
});

test('a week you have generated is reachable with a term of history saved', async ({ page }) => {
  /* Reported by a teacher: "can't move on to the next week even though I knew
     I had generated it." The week chips render oldest-first in a horizontally
     scrolling row with no scrollbar and no arrows, so on a device holding a
     term of weeks the row opened at scrollLeft 0 — three months ago — and both
     the selected week and the one just designed sat off the right-hand edge
     with nothing on screen to say they existed. */
  const errors = collectErrors(page);
  const week = mondayOf();
  const next = addDays(week, 7);

  /* A term of saved weeks, plus next week already designed. */
  const weeks = {};
  const day = [{ t: 'sum', op: '+', a: 2, b: 3 }];
  for (let i = 14; i >= -1; i--) weeks[addDays(week, -7 * i)] = [day, day, day, day, day];
  await open(page, { tp_starter_weeks: weeks, tp_starter_cfg: { qCount: 20, xtb: false } });

  const seen = await page.evaluate(sel => {
    const strip = document.getElementById('wkChips');
    const box = strip.getBoundingClientRect();
    const inView = k => {
      const c = strip.querySelector(`[data-wk="${k}"]`);
      if (!c) return 'missing';
      const r = c.getBoundingClientRect();
      return r.left >= box.left - 1 && r.right <= box.right + 1;
    };
    return { thisWeek: inView(sel.week), next: inView(sel.next), newWeek: !!document.getElementById('newWeek').offsetParent };
  }, { week, next });

  expect(seen.thisWeek, 'the selected week is off screen when the page opens').toBe(true);
  expect(seen.next, 'the week just designed is off screen and unreachable').toBe(true);
  expect(seen.newWeek, '⊕ new week scrolled off the end with the chips').toBe(true);

  /* And one tap moves a week, whatever the scroll position. */
  await page.click('#wkNext');
  await page.waitForTimeout(300);
  const selected = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#wkChips [data-wk]')].find(x => x.style.cssText.includes('2px solid'));
    return c && c.dataset.wk;
  });
  expect(selected, '› did not move to the following week').toBe(next);
  expect(errors).toEqual([]);
});

test('Show on board opens the week the teacher is working in', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, { tp_starter_cfg: { qCount: 20, xtb: false } });

  /* Design and save NEXT week, the way ⊕ new week does. */
  const next = addDays(mondayOf(), 7);
  await page.click('#tv-starter #newWeek');
  await page.waitForTimeout(300);
  await page.click(`.nw-gen[data-k="${next}"]`);
  await page.waitForTimeout(400);
  await page.click('#tv-design #msSave');
  await page.waitForTimeout(600);

  const saved = await firstQuestions(page);
  expect(saved[next], 'next week was not saved').toBeTruthy();

  /* Now the board control. It must land on the week just designed, not snap
     back to this Monday. */
  await page.evaluate(() => window.hubOpenStarter());
  await page.waitForTimeout(600);

  const shown = await page.evaluate(() => {
    const q = document.querySelector('#tv-day .ds-q .ds-text');
    return { panel: document.querySelector('#tv-day').classList.contains('active'), q1: q && q.textContent.trim() };
  });
  expect(shown.panel, 'the board control did not open the day sheet').toBe(true);
  expect(shown.q1, 'the board showed a different week than the one being worked on')
    .toBe(saved[next].q1.replace(/<[^>]*>/g, '').trim());
  expect(errors).toEqual([]);
});
