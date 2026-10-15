/* Mental Starter (CBM) — js/cbm.js.

   What these hold:
     1. It is a page of its own. Mental Starters keeps its nav row, and nothing
        on the CBM page writes to tp_starters or any tp_starter_* key.
     2. Score entry: "4 9 yn" saves wrong 4 and 9 plus the teacher's two marks,
        "abs" is absent, and an entry it cannot read is not saved.
     3. The decision rules the research asks for: a child who ticks wrong
        answers is flagged and trusted less; a practice question stays until it
        is right on two separate later days; the audited pair never repeats a
        slot within a week.
     4. The class set prints one personalised A4 page per child, the same
        every time it is printed. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors, ROSTER } = require('./fixtures');

async function open(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { extra: extra || {} });
  await page.goto('/index.html#cbm');
  await page.waitForFunction(() => document.querySelector('#planApp .nav-link') && window.CBM && typeof window.cbmRender === 'function',
    null, { timeout: 10000 });
  await page.evaluate(() => { if (location.hash !== '#cbm') location.hash = '#cbm'; window.cbmRender(); });
}

function isoDay(offset) {
  const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + offset);
  const p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

test('a separate nav row; Mental Starters is still there and untouched', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('.nav-link[data-page="cbm"]')).toHaveText(/Mental Starter \(CBM\)/);
  await expect(page.locator('.nav-link[data-page="mental-starters"]')).toHaveText(/Mental Starters/);
  await expect(page.locator('#page-cbm')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.getByLabel('Wrong questions for Ava Bell').fill('4 9 yn');
  await page.getByLabel('Wrong questions for Ava Bell').press('Enter');
  await expect(page.getByLabel('Wrong questions for Ben Cross')).toBeFocused();
  await page.getByLabel('Wrong questions for Ben Cross').fill('abs');
  await page.getByLabel('Wrong questions for Ben Cross').press('Enter');
  await page.getByLabel('Wrong questions for Cleo Dunn').fill('3 banana');
  await page.getByLabel('Wrong questions for Cleo Dunn').press('Enter');
  await expect(page.getByLabel('Wrong questions for Cleo Dunn')).toHaveClass(/bad/);
  await expect(page.locator('#cbmCount')).toHaveText(`2 of ${ROSTER.length} entered`);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_cbm')));
  const day = saved.days[Object.keys(saved.days)[0]];
  expect(day.qs).toHaveLength(20);
  expect(day.qs.every(q => typeof q.k === 'string')).toBe(true);
  expect(day.audit).toHaveLength(2);
  expect(day.marks.p1).toEqual({ w: [4, 9], a: [1, 0] });
  expect(day.marks.p2).toEqual({ x: 1 });
  expect(day.marks.p3).toBeUndefined();

  const starterKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => /^tp_starter/.test(k)));
  expect(starterKeys).toEqual([]);
  expect(errors).toEqual([]);
});

test('a teacher mark tapped before the score is kept, but is not a result', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  const row = page.locator('tr[data-pid="p1"]');
  await row.locator('.cbm-mark').first().click();
  await expect(row.locator('.cbm-mark').first()).toHaveText('✓');
  const r = await page.evaluate(() => {
    const s = window.CBM.load(), d = Object.keys(s.days)[0];
    return { mark: s.days[d].marks.p1, results: window.CBM.results(s, d, d).length };
  });
  expect(r.mark).toEqual({ a: [1, null] });
  expect(r.results).toBe(0);
});

test('decision rules: trust, successive relearning, audit rotation', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), days = [];
    const x = new Date(); x.setHours(0, 0, 0, 0);
    while (days.length < 10) { x.setDate(x.getDate() - 1); if (x.getDay() % 6) days.unshift(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); }
    days.forEach(d => { C.makeDay(s, d); });
    // p1 misses Q1 on day 0, then is right on days 1 and 2 → cleared.
    // p2 misses Q1 on day 0, is right on day 1, misses again on day 2 → open.
    // p3 says every answer is right; the teacher's two marks say otherwise.
    days.forEach((d, n) => {
      const day = s.days[d];
      day.marks.p1 = { w: n === 0 ? [1] : [], a: [null, null] };
      day.marks.p2 = { w: n === 0 || n >= 2 ? [1] : [], a: [null, null] };
      day.marks.p3 = { w: [], a: [0, 0] };
    });
    const an = C.analyse(s, days[2], 14);
    const k0 = s.days[days[0]].qs[0].k;
    const sameWeekRepeats = days.some((d, i) => days.slice(0, i).some(e => {
      const sameWeek = (dd => { const t = new Date(dd); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toDateString(); });
      return sameWeek(e) === sameWeek(d) && s.days[e].audit.some(a => s.days[d].audit.includes(a));
    }));
    return {
      p1: C.openState(an, 'p1', k0), p2: C.openState(an, 'p2', k0),
      trust: an.trust.p3, sameWeekRepeats,
      parse: [C.parseEntry('4 9 yn'), C.parseEntry('0'), C.parseEntry('abs'), C.parseEntry('21'), C.parseEntry('')]
    };
  });
  expect(r.p1.open).toBe(false);
  expect(r.p1.cleared).toBe(2);
  expect(r.p2.open).toBe(true);
  expect(r.trust.flag).toBe(true);
  expect(r.trust.over).toBeGreaterThanOrEqual(2);
  expect(r.trust.t).toBeLessThan(1);
  expect(r.sameWeekRepeats).toBe(false);
  expect(r.parse[0]).toMatchObject({ w: [4, 9], a: [1, 0], x: false });
  expect(r.parse[1]).toMatchObject({ w: [], none: true });
  expect(r.parse[2]).toMatchObject({ x: true });
  expect(r.parse[3].bad).toEqual(['21']);
  expect(r.parse[4]).toEqual({ empty: true });
});

test('targets: wrong answers first, four distinct skills, none before any results', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), d0 = (() => { const x = new Date(); x.setDate(x.getDate() - 1); while (!(x.getDay() % 6)) x.setDate(x.getDate() - 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); })();
    const day = C.makeDay(s, d0);
    day.marks.p1 = { w: [5, 12], a: [null, null] };
    roster.forEach(p => { if (p.id !== 'p1') day.marks[p.id] = { w: [], a: [null, null] }; });
    const an = C.analyse(s, d0, 14), keys = day.qs.map(q => q.k);
    return { p1: C.chooseTargets(an, 'p1', keys), none: C.chooseTargets(an, 'nobody', keys), k5: keys[4], k12: keys[11] };
  });
  expect(r.none).toEqual([]);
  expect(r.p1).toHaveLength(4);
  expect(new Set(r.p1.map(t => t.k)).size).toBe(4);
  expect(r.p1.slice(0, 2).map(t => t.y)).toEqual(['miss', 'miss']);
  expect(r.p1.slice(0, 2).map(t => t.k).sort()).toEqual([r.k5, r.k12].sort());
});

test('class set: one personalised A4 page per child, identical on reprint', async ({ page }) => {
  const yesterday = isoDay(-1);
  await open(page);
  await page.evaluate(d => {
    const C = window.CBM, s = C.load(), day = C.makeDay(s, d);
    roster.forEach((p, i) => { day.marks[p.id] = { w: [1 + i, 10 + i], a: [null, null] }; });
    C.save(s); window.cbmRender();
  }, yesterday);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  const first = await page.locator('#starterPrint').innerHTML();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('#starterPrint .cbm-sheet')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-pbox')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-sheet').first().locator('.gen-heading')).toContainText(ROSTER[0].name);

  // A4 portrait at 9mm margins leaves 279mm of height; each sheet must fit it
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 726, height: 1054 });   // 192mm × 279mm at 96dpi
  const tallest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#starterPrint .cbm-sheet')].map(e => e.getBoundingClientRect().height)));
  expect(tallest).toBeLessThanOrEqual(1054);
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Print class set' }).click();
  expect(await page.locator('#starterPrint').innerHTML()).toBe(first);
});
