/* Mental Starter (CBM) — js/cbm.js.

   What these hold:
     1. It is a page of its own. Mental Starters keeps its nav row, and nothing
        on the CBM page writes to tp_starters or any tp_starter_* key.
     2. Score entry is what a teacher has time for at the register: "17 yn" is
        the score plus the teacher's two marks, b is a blank, "abs" is absent,
        and an entry it cannot read is not saved.
     3. The decision rules: the two marked questions are one from each half and
        never the same slot twice in a week; a mark you made wrong stays in the
        practice box for three sheets; a child never checked on a skill still
        gets an estimate from the class and their own strength.
     4. Scaling back: two hard sheets (under half right, or a blank in the
        second half) gives a child a shorter sheet of simple calculations, two
        good ones grows it, and past 18 they rejoin the full sheet.
     5. The class set prints one personalised A4 page per child, the same every
        time, with shorter sheets for the children who have one. */
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

/* The last n school days before today, oldest first, built in the page. */
const PAST_DAYS = `(n => { const out = []; const x = new Date(); x.setHours(0,0,0,0);
  while (out.length < n) { x.setDate(x.getDate() - 1); if (x.getDay() % 6) out.unshift(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); }
  return out; })`;

test('a separate nav row; Mental Starters is still there and untouched', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('.nav-link[data-page="cbm"]')).toHaveText(/Mental Starter \(CBM\)/);
  await expect(page.locator('.nav-link[data-page="mental-starters"]')).toHaveText(/Mental Starters/);
  await expect(page.locator('#page-cbm')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.getByLabel('Score and marks for Ava Bell').fill('17 yn');
  await page.getByLabel('Score and marks for Ava Bell').press('Enter');
  await expect(page.getByLabel('Score and marks for Ben Cross')).toBeFocused();
  await page.getByLabel('Score and marks for Ben Cross').fill('abs');
  await page.getByLabel('Score and marks for Ben Cross').press('Enter');
  await page.getByLabel('Score and marks for Cleo Dunn').fill('12 yb');
  await page.getByLabel('Score and marks for Cleo Dunn').press('Enter');
  await page.getByLabel('Score and marks for Dev Patel').fill('25');
  await page.getByLabel('Score and marks for Dev Patel').press('Enter');
  await expect(page.getByLabel('Score and marks for Dev Patel')).toHaveClass(/bad/);
  await expect(page.locator('#cbmCount')).toHaveText(`3 of ${ROSTER.length} entered`);
  await expect(page.locator('tr[data-pid="p3"] .cbm-score')).toContainText('blank');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_cbm')));
  const day = saved.days[Object.keys(saved.days)[0]];
  expect(day.qs).toHaveLength(20);
  expect(day.qs.every(q => typeof q.k === 'string')).toBe(true);
  expect(day.audit[0]).toBeLessThan(10);
  expect(day.audit[1]).toBeGreaterThanOrEqual(10);
  expect(day.marks.p1).toEqual({ s: 17, a: [1, 0] });
  expect(day.marks.p2).toEqual({ x: 1 });
  expect(day.marks.p3).toEqual({ s: 12, a: [1, -1] });
  expect(day.marks.p4).toBeUndefined();

  const starterKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => /^tp_starter/.test(k)));
  expect(starterKeys).toEqual([]);
  expect(errors).toEqual([]);
});

test('marks tapped before the score are kept, but are not a result', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  const row = page.locator('tr[data-pid="p1"]');
  const first = row.locator('.cbm-mark').first();
  await first.click();
  await expect(first).toHaveText('✓');
  await first.click(); await expect(first).toHaveText('✗');
  await first.click(); await expect(first).toHaveText('–');
  const r = await page.evaluate(() => {
    const s = window.CBM.load(), d = Object.keys(s.days)[0];
    return { mark: s.days[d].marks.p1, sessions: window.CBM.sessions(s, 'p1', '9999-01-01', 5).length };
  });
  expect(r.mark).toEqual({ a: [-1, null] });
  expect(r.sessions).toBe(0);
});

test('parsing, audit rotation, the practice box and inferred estimates', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(10);
    days.forEach(d => { C.makeDay(s, d); });
    // Everyone scores 15 with both marks right, except p1, whose first mark on day 0 is wrong.
    days.forEach((d, n) => roster.forEach(p => { s.days[d].marks[p.id] = { s: 15, a: [p.id === 'p1' && n === 0 ? 0 : 1, 1] }; }));
    const k0 = s.days[days[0]].qs[s.days[days[0]].audit[0]].k;
    const at = i => C.analyse(s, days[i], 14);
    const weekOf = d => { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toDateString(); };
    const repeats = days.some((d, i) => days.slice(0, i).some(e => weekOf(e) === weekOf(d) && s.days[e].audit.some(a => s.days[d].audit.includes(a))));
    const halves = days.every(d => s.days[d].audit[0] < 10 && s.days[d].audit[1] >= 10);
    // a skill never checked for anyone: the estimate still exists, and is lower for a weaker child
    const s2 = { ht: null, slots: s.slots, support: {}, days: {} }, d2 = days.slice(-3);
    d2.forEach(d => { const day = C.makeDay(s2, d); day.marks.p1 = { s: 19, a: [1, 1] }; day.marks.p2 = { s: 8, a: [0, 0] }; });
    const an2 = C.analyse(s2, d2[2], 14), unchecked = s2.days[d2[2]].qs.map(q => q.k).find(k => !an2.cls[k]);
    return {
      parse: [C.parseEntry('17 yn'), C.parseEntry('0 bb'), C.parseEntry('abs'), C.parseEntry('21'), C.parseEntry(''), C.parseEntry('12 y', 12)],
      repeats, halves,
      open1: C.openState(at(1), 'p1', k0), open3: C.openState(at(3), 'p1', k0),
      strong: C.estimate(an2, 'p1', unchecked).p, weak: C.estimate(an2, 'p2', unchecked).p
    };
  }, PAST_DAYS);
  expect(r.parse[0]).toMatchObject({ s: 17, a: [1, 0], x: false, bad: [] });
  expect(r.parse[1]).toMatchObject({ s: 0, a: [-1, -1] });
  expect(r.parse[2]).toMatchObject({ x: true });
  expect(r.parse[3].bad).toEqual(['21']);
  expect(r.parse[4]).toEqual({ empty: true });
  expect(r.parse[5]).toMatchObject({ s: 12, a: [1] });
  expect(r.repeats).toBe(false);
  expect(r.halves).toBe(true);
  expect(r.open1.open).toBe(true);     // one sheet after the mistake: still practising
  expect(r.open3.open).toBe(false);    // three sheets later: done
  expect(r.strong).toBeGreaterThan(r.weak + 0.15);
});

test('practice box: the mark you made wrong first, four different skills, none before any results', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), d0 = eval(PAST)(1)[0];
    const day = C.makeDay(s, d0);
    roster.forEach(p => { day.marks[p.id] = { s: 16, a: [1, 1] }; });
    day.marks.p1 = { s: 14, a: [1, 0] };
    const an = C.analyse(s, d0, 14), keys = day.qs.map(q => q.k);
    return { p1: C.chooseTargets(an, 'p1', keys), none: C.chooseTargets(an, 'nobody', keys), wrongK: keys[day.audit[1]] };
  }, PAST_DAYS);
  expect(r.none).toEqual([]);
  expect(r.p1).toHaveLength(4);
  expect(new Set(r.p1.map(t => t.k)).size).toBe(4);
  expect(r.p1[0]).toEqual({ k: r.wrongK, y: 'miss' });
});

test('scaling back: shorter sheet after two hard ones, grows after two good ones, rejoins past 18', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(20), out = {};
    // days 0–1: p1 gets 6/20 and leaves the second-half question blank; the rest are fine
    [0, 1].forEach(n => { const day = C.makeDay(s, days[n]); roster.forEach(p => { day.marks[p.id] = p.id === 'p1' ? { s: 6, a: [1, -1] } : { s: 17, a: [1, 1] }; }); });
    const d2 = C.makeDay(s, days[2]), sh = d2.sheets.p1;
    out.first = sh && { n: sh.qs.length, fd: sh.qs.filter(q => q.k.startsWith('fd:')).length, audit: sh.audit, rung: sh.rung };
    out.others = Object.keys(d2.sheets).filter(pid => pid !== 'p1');
    // two good shorter sheets running → two more questions and a rung up
    const good = n => { const day = n === 2 ? d2 : C.makeDay(s, days[n]); const len = (day.sheets.p1 || day).qs.length;
      roster.forEach(p => { day.marks[p.id] = p.id === 'p1' ? { s: len, a: [1, 1] } : { s: 17, a: [1, 1] }; }); return day; };
    good(2); good(3);
    const d4 = C.makeDay(s, days[4]);
    out.grown = { n: d4.sheets.p1.qs.length, rung: d4.sheets.p1.rung };
    // keep thriving until they rejoin the full sheet
    let n = 4, rejoined = null;
    while (n < 19 && !rejoined) { good(n); n++; const day = C.makeDay(s, days[n]); if (!day.sheets.p1) rejoined = days[n]; }
    out.rejoined = !!rejoined;
    // the teacher can always force the full sheet
    s.support.p1 = { mode: 'full' };
    out.forced = C.supportPlan(s, 'p1', days[19]).on;
    return out;
  }, PAST_DAYS);
  expect(r.first).toBeTruthy();
  expect(r.first.n).toBe(8);                       // 6 right → start at 8, finishable
  expect(r.first.fd).toBeGreaterThanOrEqual(5);    // mostly simple calculations
  expect(r.first.audit[1]).toBeGreaterThanOrEqual(4);   // one mark in their second half
  expect(r.others).toEqual([]);
  expect(r.grown.n).toBe(10);
  expect(r.grown.rung).toBe(r.first.rung + 1);
  expect(r.rejoined).toBe(true);
  expect(r.forced).toBe(false);
});

test('class set: one personalised A4 page per child, shorter sheets included, identical on reprint', async ({ page }) => {
  await open(page);
  await page.evaluate(PAST => {
    const C = window.CBM, s = C.load();
    eval(PAST)(2).forEach(d => { const day = C.makeDay(s, d); roster.forEach((p, i) => { day.marks[p.id] = p.id === 'p1' ? { s: 5, a: [0, -1] } : { s: 12 + i, a: [1, i % 2] }; }); });
    C.save(s); window.cbmRender();
  }, PAST_DAYS);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await expect(page.locator('tr[data-pid="p1"] .cbm-sup')).toBeVisible();
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  const first = await page.locator('#starterPrint').innerHTML();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('#starterPrint .cbm-sheet')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-sheet-short')).toHaveCount(1);
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

  await page.getByRole('button', { name: 'Answers for shorter sheets' }).click();
  await expect(page.locator('#starterPrint .cbm-ansslip')).toHaveCount(1);
});

test('progress: the support table lists the child and the setting sticks', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(PAST => {
    const C = window.CBM, s = C.load();
    eval(PAST)(3).forEach(d => { const day = C.makeDay(s, d); roster.forEach(p => { day.marks[p.id] = p.id === 'p2' ? { s: 4, a: [0, -1] } : { s: 18, a: [1, 1] }; }); });
    C.save(s);
  }, PAST_DAYS);
  await page.getByRole('button', { name: 'Progress' }).click();
  const row = page.locator('tr[data-spid="p2"]');
  await expect(row).toContainText('Ben Cross');
  await expect(row).toContainText('questions');
  await row.getByLabel('Sheet for Ben Cross').selectOption('full');
  await expect(page.locator('tr[data-spid="p2"]')).toContainText('Full sheet');
  expect(await page.evaluate(() => window.CBM.load().support.p2.mode)).toBe('full');
  expect(errors).toEqual([]);
});

test('a made sheet can be swapped for a fresh set of questions; scores entered for it are cleared', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.locator('tr[data-pid="p1"] .cbm-in').fill('17 yn');
  await page.locator('tr[data-pid="p1"] .cbm-in').press('Enter');
  const before = await page.evaluate(() => { const s = window.CBM.load(), d = Object.keys(s.days)[0]; return JSON.stringify(s.days[d].qs); });
  page.once('dialog', d => d.accept());
  await page.locator('.cbm-qlist summary').click();
  await page.getByRole('button', { name: 'Make a new set of questions' }).click();
  const after = await page.evaluate(() => { const s = window.CBM.load(), d = Object.keys(s.days)[0]; return { qs: s.days[d].qs, v: s.days[d].v, marks: s.days[d].marks }; });
  expect(after.v).toBe(1);
  expect(after.qs).toHaveLength(20);
  expect(JSON.stringify(after.qs)).not.toBe(before);
  expect(after.qs.map(q => q.k)).toEqual(JSON.parse(before).map(q => q.k));   // same skills, new numbers
  expect(after.marks).toEqual({});
  await expect(page.locator('tr[data-pid="p1"] .cbm-in')).toHaveValue('');
});

test('×tables on the back: off by default, turned on in Set up, one page after each child, same tables for everyone', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  expect(await page.evaluate(() => window.CBM.load().xt)).toEqual({ on: false, pick: 'all', count: 50 });
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.getByLabel('×tables on the back').check();
  await page.locator('#cbmXtPick').selectOption('5');
  await page.locator('#cbmXtCount').selectOption('30');
  expect(await page.evaluate(() => window.CBM.load().xt)).toEqual({ on: true, pick: '5', count: 30 });

  await page.locator('.cbm-tab[data-view="today"]').click();
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  const tables = page.locator('#starterPrint .gen-grid-tables');
  await expect(tables).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint > .gen-day')).toHaveCount(ROSTER.length * 2);
  // each child's tables page comes straight after their sheet, so it lands on the back
  await expect(page.locator('#starterPrint > .gen-day').nth(1)).toContainText(ROSTER[0].name);
  await expect(page.locator('#starterPrint > .gen-day').nth(1)).toContainText('Times tables — 5×');
  await expect(tables.first().locator('.gen-q')).toHaveCount(30);
  const grids = await tables.evaluateAll(els => els.map(e => e.innerHTML));
  expect(new Set(grids).size).toBe(1);

  await page.getByRole('button', { name: 'Print ×tables only' }).click();
  await expect(page.locator('#starterPrint .gen-grid-tables')).toHaveCount(1);
  expect(await page.locator('#starterPrint .gen-grid-tables').innerHTML()).toBe(grids[0]);
  expect(errors).toEqual([]);
});
