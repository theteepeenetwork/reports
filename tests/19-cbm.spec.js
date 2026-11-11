/* Mental Starter (CBM) — js/cbm.js.

   What these hold:
     1. It is a page of its own. Mental Starters keeps its nav row, and nothing
        on the CBM page writes to tp_starters or any tp_starter_* key.
     2. Entry is two taps a child: the teacher's two marks (right / wrong /
        blank) or Absent. Nothing is typed and no score out of 20 is kept.
     3. Every child has the same 20 skills with their own numbers, rebuilt from
        a seed and never stored, so a reprint is identical and the store stays
        small.
     4. The decision rules read only the teacher's marks: the two marked
        questions are one from each half and never the same slot twice in a
        week; a mark made wrong stays in the practice box for three sheets; a
        child never checked on a skill still gets an estimate.
     5. Wrong answers step a skill back one White Rose step at a time (at most
        five skills a sheet, only on new marks) and forward again; blanks on
        the second mark shorten the sheet by two. Neither does the other's job,
        and nobody lands on number facts unless set to Numbers only.
     6. Days made before all this (shared numbers, scores, whole shorter
        sheets) still render and still count.
     7. The class set prints one personalised A4 page per child; the marking
        list has every child's own two answers; the board gets the weakest
        skills first. */
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

/* Twenty White Rose steps in the slots (Year 2 addition and subtraction), so there is a path back. */
const WR_SLOTS = `(() => { const ids = window.WR_STEPS.filter(s => s.block === 'a2' && typeof s.gen === 'function').map(s => s.id);
  const s = window.CBM.load(); s.slots = Array.from({ length: 20 }, (_, i) => ids[ids.length - 1 - (i % ids.length)]); window.CBM.save(s); })()`;

test('a separate nav row; entry is two taps or Absent, nothing typed, no score kept', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('.nav-link[data-page="cbm"]')).toHaveText(/Mental Starter \(CBM\)/);
  await expect(page.locator('.nav-link[data-page="mental-starters"]')).toHaveText(/Mental Starters/);
  await expect(page.locator('#page-cbm')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await expect(page.locator('.cbm-table input')).toHaveCount(0);
  const mark = (pid, j) => page.locator(`tr[data-pid="${pid}"] .cbm-mark`).nth(j);
  await mark('p1', 0).click();                                  // ✓
  await mark('p1', 1).click(); await mark('p1', 1).click();     // ✗
  await page.locator('tr[data-pid="p2"] .cbm-abs').click();
  await expect(mark('p2', 0)).toBeDisabled();
  await mark('p3', 0).click();                                  // one mark only: not an entry yet
  await expect(page.locator('#cbmCount')).toHaveText(`2 of ${ROSTER.length} entered`);
  // each child's own answer sits beside the mark
  await expect(page.locator('tr[data-pid="p1"] .cbm-markans')).toHaveCount(2);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_cbm')));
  const day = saved.days[Object.keys(saved.days)[0]];
  expect(day.ind).toBe(1);
  expect(day.qs).toHaveLength(20);
  expect(day.qs.every(q => typeof q.k === 'string')).toBe(true);
  expect(day.audit[0]).toBeLessThan(10);
  expect(day.audit[1]).toBeGreaterThanOrEqual(10);
  expect(day.marks.p1).toEqual({ a: [1, 0] });
  expect(day.marks.p2).toEqual({ x: 1 });
  expect(day.marks.p3).toEqual({ a: [1, null] });
  expect(day.marks.p4).toBeUndefined();

  // Absent again takes it off
  await page.locator('tr[data-pid="p2"] .cbm-abs').click();
  expect(await page.evaluate(() => { const s = window.CBM.load(); return s.days[Object.keys(s.days)[0]].marks.p2; })).toBeUndefined();

  const starterKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => /^tp_starter/.test(k)));
  expect(starterKeys).toEqual([]);
  expect(errors).toEqual([]);
});

test('a mark cycles right, wrong, blank, clear; one mark alone is kept but is not a result', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  const first = page.locator('tr[data-pid="p1"] .cbm-mark').first();
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
  await first.click(); await expect(first).toHaveText('·');
  expect(await page.evaluate(() => { const s = window.CBM.load(); return s.days[Object.keys(s.days)[0]].marks.p1; })).toBeUndefined();
});

test('audit rotation, the practice box and inferred estimates, from marks alone', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(10);
    days.forEach(d => { C.makeDay(s, d); });
    // Both marks right for everyone, except p1, whose first mark on day 0 is wrong.
    days.forEach((d, n) => roster.forEach(p => { s.days[d].marks[p.id] = { a: [p.id === 'p1' && n === 0 ? 0 : 1, 1] }; }));
    const k0 = s.days[days[0]].qs[s.days[days[0]].audit[0]].k;
    const at = i => C.analyse(s, days[i], 14);
    const weekOf = d => { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toDateString(); };
    const repeats = days.some((d, i) => days.slice(0, i).some(e => weekOf(e) === weekOf(d) && s.days[e].audit.some(a => s.days[d].audit.includes(a))));
    const halves = days.every(d => s.days[d].audit[0] < 10 && s.days[d].audit[1] >= 10);
    // a skill never checked for anyone: the estimate still exists, and is lower for a weaker child
    const s2 = { ht: null, slots: s.slots, support: {}, lv: {}, days: {} }, d2 = days.slice(-3);
    d2.forEach(d => { const day = C.makeDay(s2, d); day.marks.p1 = { a: [1, 1] }; day.marks.p2 = { a: [0, 0] }; });
    const an2 = C.analyse(s2, d2[2], 14), unchecked = s2.days[d2[2]].qs.map(q => q.k).find(k => !an2.cls[k]);
    return {
      repeats, halves,
      open1: C.openState(at(1), 'p1', k0), open3: C.openState(at(3), 'p1', k0),
      strong: C.estimate(an2, 'p1', unchecked).p, weak: C.estimate(an2, 'p2', unchecked).p,
      scored: [C.isScored({ a: [1, 0] }), C.isScored({ a: [1, null] }), C.isScored({ x: 1 }), C.isScored({ s: 12, a: [null, null] }), C.isScored(undefined)]
    };
  }, PAST_DAYS);
  expect(r.repeats).toBe(false);
  expect(r.halves).toBe(true);
  expect(r.open1.open).toBe(true);     // one sheet after the mistake: still practising
  expect(r.open3.open).toBe(false);    // three sheets later: done
  expect(r.strong).toBeGreaterThan(r.weak + 0.15);
  expect(r.scored).toEqual([true, false, true, true, false]);
});

test('practice box: the mark you made wrong first, four different skills, none before any results', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), d0 = eval(PAST)(1)[0];
    const day = C.makeDay(s, d0);
    roster.forEach(p => { day.marks[p.id] = { a: [1, 1] }; });
    day.marks.p1 = { a: [1, 0] };
    const an = C.analyse(s, d0, 14), keys = day.qs.map(q => q.k);
    return { p1: C.chooseTargets(an, 'p1', keys), none: C.chooseTargets(an, 'nobody', keys), wrongK: keys[day.audit[1]] };
  }, PAST_DAYS);
  expect(r.none).toEqual([]);
  expect(r.p1).toHaveLength(4);
  expect(new Set(r.p1.map(t => t.k)).size).toBe(4);
  expect(r.p1[0]).toEqual({ k: r.wrongK, y: 'miss' });
});

test('every child has the same skills with their own numbers; nothing per child is stored', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(([PAST, SLOTS]) => {
    eval(SLOTS);
    const C = window.CBM, s = C.load(), d = eval(PAST)(1)[0], day = C.makeDay(s, d);
    const text = pid => C.sheetQs(day, d, pid).map(q => window.genRenderQuestion(q));
    const a = C.sheetQs(day, d, 'p1'), b = C.sheetQs(day, d, 'p2');
    return {
      sameSkills: a.every((q, i) => q.k === b[i].k && q.k === day.qs[i].k),
      differ: text('p1').filter((t, i) => t !== text('p2')[i]).length,
      again: JSON.stringify(text('p1')) === JSON.stringify(C.sheetQs(JSON.parse(JSON.stringify(day)), d, 'p1').map(q => window.genRenderQuestion(q))),
      clean: !/\b(y\d\.)?[abc]\d+\.\d+\b|undefined|NaN/.test(text('p1').concat(text('p2')).join(' ')),   // no step id or hole in a question
      sheets: day.sheets, bytes: JSON.stringify(day).length - JSON.stringify(day.qs).length
    };
  }, [PAST_DAYS, WR_SLOTS]);
  expect(r.sameSkills).toBe(true);
  expect(r.differ).toBeGreaterThanOrEqual(15);     // different numbers in (nearly) every question
  expect(r.clean).toBe(true);
  expect(r.again).toBe(true);
  expect(r.sheets).toEqual({});                    // nothing differs from the class yet: nothing stored
  expect(r.bytes).toBeLessThan(200);
});

test('wrong answers step skills back one step at a time, at most five a sheet, only on new marks, and forward again', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(([PAST, SLOTS]) => {
    eval(SLOTS);
    const C = window.CBM, s = C.load(), days = eval(PAST)(40), out = {};
    const mark = (day, p1) => roster.forEach(p => { day.marks[p.id] = { a: p.id === 'p1' ? p1 : [1, 1] }; });
    const depths = () => Object.values(s.lv.p1 || {});
    // three days of both marks wrong for p1; everyone else right
    [0, 1, 2].forEach(n => mark(C.makeDay(s, days[n]), [0, 0]));
    out.before = depths().length;                               // 4 marks by day 2's sheet: nothing moved before that
    const d3 = C.makeDay(s, days[3]), sh = d3.sheets.p1 || {};
    out.first = { ks: sh.ks || {}, drop: sh.drop || [], depths: depths(), len: C.sheetPlan(d3, 'p1').slots.length };
    out.oneStep = Object.keys(sh.ks || {}).every(i => sh.ks[i] === C.stepBack(d3.qs[i].k, 1));
    out.noFacts = C.sheetPlan(d3, 'p1').slots.every(x => !x.k.startsWith('fd:'));
    out.others = Object.keys(d3.sheets).filter(pid => pid !== 'p1');
    // the next sheet made with no new marks in between does not step again
    const lvThen = JSON.stringify(s.lv.p1);
    C.makeDay(s, days[4]);
    out.held = JSON.stringify(s.lv.p1) === lvThen;
    // wrong again on days 3 and 4: deeper, but still one step per sheet
    mark(d3, [0, 0]); C.makeDay(s, days[4]);
    out.second = { max: Math.max(...depths()), n: depths().length };
    mark(s.days[days[4]], [0, 0]);
    // then right every day: the steps come back
    let n = 5, peak = depths().reduce((a, b) => a + b, 0);
    for (; n < 39; n++) { mark(C.makeDay(s, days[n]), [1, 1]); peak = Math.max(peak, depths().reduce((a, b) => a + b, 0)); if (!depths().length && n > 8) break; }
    out.peak = peak; out.end = depths().reduce((a, b) => a + b, 0); out.daysToRecover = n - 5;
    // "Always the class questions" wins
    s.support.p1 = { mode: 'full' }; s.lv.p1 = { [d3.qs[0].k]: 2 };
    const dz = C.makeDay(s, days[39]);
    out.forced = dz.sheets.p1 === undefined && !s.lv.p1;
    return out;
  }, [PAST_DAYS, WR_SLOTS]);
  expect(r.before).toBeLessThanOrEqual(5);
  expect(Object.keys(r.first.ks).length).toBeGreaterThanOrEqual(1);
  expect(r.first.depths.length).toBeLessThanOrEqual(10);        // at most five a sheet, two sheets in
  expect(Math.max(...r.first.depths)).toBeLessThanOrEqual(2);
  expect(r.oneStep || Math.max(...r.first.depths) === 2).toBe(true);
  expect(r.first.len).toBe(20);                                  // wrong answers never shorten the sheet
  expect(r.first.drop).toEqual([]);
  expect(r.noFacts).toBe(true);                                  // never onto number facts
  expect(r.others).toEqual([]);
  expect(r.held).toBe(true);
  expect(r.second.max).toBeLessThanOrEqual(3);
  expect(r.end).toBeLessThan(r.peak);                            // right marks bring the steps back
  expect(r.forced).toBe(true);
});

test('the way back: one step at a time in the year; into the year before by meaning, not onto its last step', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const C = window.CBM, steps = window.WR_STEPS.filter(s => typeof s.gen === 'function');
    const yr = id => window.wrBlock(window.wrStep(id).block).year, title = id => id ? 'Y' + yr(id) + ' ' + window.wrStep(id).title : null;
    const byTitle = (y, t) => steps.find(s => yr(s.id) === y && s.title === t).id;
    const bad = steps.filter(s => { const p = C.backPath(s.id); return new Set(p).size !== p.length || p.some((id, i) => i && yr(id) > yr(p[i - 1])); }).map(s => s.id);
    return {
      inYear: C.stepBack('a2.16', 1), inYear2: C.stepBack('a2.16', 2),
      bonds: title(C.stepBack('a2.1', 1)),
      y3bonds: title(C.stepBack(byTitle(3, 'Apply number bonds within 10'), 1)),
      y4add: title(C.stepBack(byTitle(4, 'Add and subtract 1s, 10s, 100s and 1,000s'), 1)),
      groups: title(C.stepBack(byTitle(2, 'Recognise equal groups'), 1)),
      shapes: title(C.stepBack(byTitle(2, 'Recognise 2-D and 3-D shapes'), 1)),
      preset: C.stepBack('pre:Autumn 1:3', 1), bad
    };
  });
  expect(r.inYear).toBe('a2.15');
  expect(r.inYear2).toBe('a2.14');
  // Year 2 opens by going over Year 1: the step before "Bonds to 10" is the one before Year 1's "Number bonds to 10"
  expect(r.bonds).toBe('Y1 Systematic number bonds within 10');
  expect(r.y3bonds).toBe('Y1 Systematic number bonds within 10');
  expect(r.y4add).toBe('Y3 Apply number bonds within 10');     // not "Make decisions", the end of Year 3
  expect(r.groups).toBe('Y1 Count in 5s');
  expect(r.shapes).toMatch(/^Y1 /);                             // the first step of all still has a way back
  expect(r.preset).toBeNull();
  expect(r.bad).toEqual([]);                                    // no loops, and never forward a year
});

test('a blank on the second mark shortens the sheet by two and puts it back; it is never the two you mark', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(8), out = {};
    const mark = (day, p1) => roster.forEach(p => { day.marks[p.id] = { a: p.id === 'p1' ? p1 : [1, 1] }; });
    [0, 1].forEach(n => mark(C.makeDay(s, days[n]), [1, -1]));
    const d2 = C.makeDay(s, days[2]), pl = C.sheetPlan(d2, 'p1');
    out.len = pl.slots.length; out.drop = d2.sheets.p1.drop; out.audit = d2.audit;
    out.auditSkills = pl.audit.map(j => pl.slots[j].i);
    out.stored = Object.keys(d2.sheets.p1).sort();
    out.others = Object.keys(d2.sheets).filter(pid => pid !== 'p1');
    // still blank twice at 18 → 16
    mark(d2, [1, -1]); mark(C.makeDay(s, days[3]), [1, -1]);
    out.shorter = C.sheetPlan(C.makeDay(s, days[4]), 'p1').slots.length;
    // two with no blanks → two back
    mark(s.days[days[4]], [1, 1]); mark(C.makeDay(s, days[5]), [0, 1]);
    out.back = C.sheetPlan(C.makeDay(s, days[6]), 'p1').slots.length;
    return out;
  }, PAST_DAYS);
  expect(r.len).toBe(18);
  expect(r.drop).toHaveLength(2);
  expect(r.drop.some(i => r.audit.includes(i))).toBe(false);
  expect(r.auditSkills).toEqual(r.audit);
  expect(r.stored).toEqual(['drop', 'why']);       // which slots, never the questions
  expect(r.others).toEqual([]);
  expect(r.shorter).toBe(16);
  expect(r.back).toBe(18);
});

test('numbers only: a sheet of number facts with nothing to read, moved by your marks', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(4);
    s.support.p1 = { mode: 'support' };              // the old "always shorter sheet" now means numbers only
    const d0 = C.makeDay(s, days[0]), a = d0.sheets.p1, newK = C.LADDER[a.rung];
    const html = a.qs.map(q => window.genRenderQuestion(q)).join(' | ');
    roster.forEach(p => { d0.marks[p.id] = { a: [1, 1] }; });
    const d1 = C.makeDay(s, days[1]); roster.forEach(p => { d1.marks[p.id] = { a: [1, 1] }; });
    const d2 = C.makeDay(s, days[2]);
    return {
      n: a.qs.length, lv: a.lv, rung: newK, keys: a.qs.map(q => q.k), html,
      newMissing: a.qs.some(q => q.k === newK && (q.t === 'missing' || q.t === 'prompt')),
      knownMissing: a.qs.filter(q => q.k !== newK && (q.t === 'missing' || q.t === 'prompt')).length,
      firstThreeKnown: a.qs.slice(0, 3).every(q => q.k !== newK),
      auditNew: a.audit.some(i => a.qs[i].k === newK),
      up: d2.sheets.p1.rung - a.rung,
      mode: C.planFor(s, 'p1', days[3], C.analyse(s, days[2], 28), d2.qs.map(q => q.k)).mode,
      // a rung saved by the first ladder (no lv) still means the same skill
      old: C.rungOf({ rung: 1 }), oldTen: C.rungOf({ rung: 7 })
    };
  }, PAST_DAYS);
  expect(r.n).toBe(12);
  expect(r.lv).toBe(2);
  expect(r.rung).toBe('fd:add10');
  expect(r.keys.every(k => k.startsWith('fd:'))).toBe(true);
  expect(r.html.replace(/<span class="gen-blank">\?<\/span>/g, '?')).toMatch(/^[\d\s+\-=?,|×÷]+$/);   // digits, symbols, the blank box
  expect(r.newMissing).toBe(false);
  expect(r.knownMissing).toBeGreaterThan(0);
  expect(r.firstThreeKnown).toBe(true);
  expect(r.auditNew).toBe(true);
  expect(r.up).toBe(1);                 // both marks right two sheets running: a step harder
  expect(r.mode).toBe('num');
  expect(r.old).toBe(4);                // old rung 1 = adding within 10
  expect(r.oldTen).toBe(10);            // old rung 7 = add or take away 10
  expect(errors).toEqual([]);
});

test('a day made before individual sheets still renders and still counts', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const r = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), d = Object.keys(s.days)[0] || new Date().toLocaleDateString('en-CA');
    const day = C.makeDay(s, d);
    delete day.ind;                                                    // as saved in October
    day.sheets = { p2: { qs: day.qs.slice(0, 8).map(q => ({ t: 'arith', a: 2, op: '+', b: 3, k: 'fd:add10' })), audit: [2, 6], rung: 1, why: 'old' } };
    day.marks = { p1: { s: 17, a: [1, 0] }, p2: { s: 4, a: [0, -1] }, p3: { w: [1, 2] } };
    C.save(s); window.cbmRender();
    const rs = C.results(s, d, d), ss = C.sessions(s, 'p2', '9999-01-01', 5);
    return { rows: rs.length, p2k: rs.filter(x => x.pid === 'p2').map(x => x.k), sess: ss[0], p3: C.isScored(day.marks.p3) };
  });
  expect(r.rows).toBe(4);
  expect(r.p2k).toEqual(['fd:add10', 'fd:add10']);
  expect(r.sess).toMatchObject({ len: 8, num: true, wrong: 1, late: true });
  expect(r.p3).toBe(true);
  await expect(page.locator('#cbmCount')).toHaveText(`3 of ${ROSTER.length} entered`);
  await expect(page.locator('tr[data-pid="p2"] .cbm-sup')).toHaveText('8 Qs');
  await expect(page.locator('tr[data-pid="p1"] .cbm-mark').first()).toHaveText('✓');
  await expect(page.locator('tr[data-pid="p1"] .cbm-markans')).toHaveCount(0);     // shared numbers: the answer is in the heading
  await page.locator('.cbm-tab[data-view="progress"]').click();
  await expect(page.locator('.cbm-grid')).toBeVisible();
  expect(errors).toEqual([]);
});

test('class set: one personalised A4 page per child, identical on reprint; the marking list has each child\'s own answers', async ({ page }) => {
  await open(page);
  await page.evaluate(([PAST, SLOTS]) => {
    eval(SLOTS);
    const C = window.CBM, s = C.load();
    s.support.p1 = { mode: 'num' };
    eval(PAST)(2).forEach(d => { const day = C.makeDay(s, d); roster.forEach((p, i) => { day.marks[p.id] = { a: [1, i % 2] }; }); });
    C.save(s); window.cbmRender();
  }, [PAST_DAYS, WR_SLOTS]);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await expect(page.locator('tr[data-pid="p1"] .cbm-sup')).toContainText('numbers');
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  const first = await page.locator('#starterPrint').innerHTML();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('#starterPrint .cbm-sheet')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-sheet-short')).toHaveCount(1);
  await expect(page.locator('#starterPrint .cbm-pbox')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-sheet').first().locator('.gen-heading')).toContainText(ROSTER[0].name);
  // no two children's pages are the same
  const grids = await page.locator('#starterPrint .cbm-sheet > .gen-grid').evaluateAll(els => els.map(e => e.innerHTML));
  expect(new Set(grids).size).toBe(ROSTER.length);

  // A4 portrait at 9mm margins leaves 279mm of height; each sheet must fit it
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 726, height: 1054 });   // 192mm × 279mm at 96dpi
  const tallest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#starterPrint .cbm-sheet')].map(e => e.getBoundingClientRect().height)));
  expect(tallest).toBeLessThanOrEqual(1054);
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Print class set' }).click();
  expect(await page.locator('#starterPrint').innerHTML()).toBe(first);

  await page.getByRole('button', { name: 'Print marking list' }).click();
  await expect(page.locator('#starterPrint .cbm-marklist tbody tr')).toHaveCount(ROSTER.length);
  const list = await page.locator('#starterPrint .cbm-marklist tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('b')].map(b => b.textContent)));
  const want = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), d = Object.keys(s.days).sort().pop(), day = s.days[d];
    return sortedRoster().map(p => { const pl = C.sheetPlan(day, p.id), qs = C.sheetQs(day, d, p.id); return pl.audit.map(i => window.genAnswer(qs[i], d)); });
  });
  expect(list).toEqual(want);
  expect(list.every(a => a.length === 2 && a.every(Boolean))).toBe(true);
  // and the same answers are on screen beside each child's marks
  const onScreen = await page.locator('.cbm-table tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('.cbm-markans')].map(e => e.textContent)));
  expect(onScreen).toEqual(want);
});

test('progress: who is stepped back and to what; the setting sticks; back to class questions', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(([PAST, SLOTS]) => {
    eval(SLOTS);
    const C = window.CBM, s = C.load();
    eval(PAST)(4).forEach(d => { const day = C.makeDay(s, d); roster.forEach(p => { day.marks[p.id] = { a: p.id === 'p2' ? [0, 0] : [1, 1] }; }); });
    C.save(s);
  }, [PAST_DAYS, WR_SLOTS]);
  await page.locator('.cbm-tab[data-view="progress"]').click();
  const row = page.locator('tr[data-spid="p2"]');
  await expect(row).toContainText('Ben Cross');
  await expect(row).toContainText('20 questions');
  await expect(row).toContainText('a step or more back');
  await expect(row.locator('.cbm-steplist li').first()).toContainText('→');
  await expect(page.locator('.cbm-grid .cbm-back').first()).toBeVisible();

  await row.getByRole('button', { name: 'Back to class questions' }).click();
  expect(await page.evaluate(() => window.CBM.load().lv.p2)).toBeUndefined();

  // a child who is not listed can still be set
  await page.locator('.cbm-supall summary').click();
  await page.locator('#cbmSupPid').selectOption('p4');
  await page.locator('#cbmSupMode').selectOption('num');
  await page.locator('#cbmSupSet').click();
  const p4 = page.locator('tr[data-spid="p4"]');
  await expect(p4).toContainText('numbers only');
  await p4.getByLabel('Sheet for Dev Patel').selectOption('full');
  await expect(page.locator('tr[data-spid="p4"]')).toContainText('the class questions');
  expect(await page.evaluate(() => window.CBM.load().support.p4.mode)).toBe('full');
  expect(errors).toEqual([]);
});

test('the board models the skills the class gets wrong, weakest first, with its own ink', async ({ page }) => {
  await open(page);
  const want = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(2);
    // day 0: everyone wrong on the first mark; day 1: half wrong on the first mark
    days.forEach((d, n) => { const day = C.makeDay(s, d); roster.forEach((p, i) => { day.marks[p.id] = { a: [n === 0 ? 0 : i % 2, 1] }; }); });
    const today = C.makeDay(s, new Date().toLocaleDateString('en-CA'));
    C.save(s);
    window.__board = null; window.hubOpenBoard = o => { window.__board = o; };
    window.cbmRender();
    const k0 = s.days[days[0]].qs[s.days[days[0]].audit[0]].k, k1 = s.days[days[1]].qs[s.days[days[1]].audit[0]].k;
    return { k0, k1, onToday: today.qs.some(q => q.k === k0) };
  }, PAST_DAYS);
  expect(want.onToday).toBe(true);
  await expect(page.locator('.cbm-focus .cbm-chip').first()).toContainText('0%');
  await page.getByRole('button', { name: 'Model the focus skills' }).click();
  const b = await page.evaluate(() => ({ ks: window.__board.qs.map(q => q.k), key: window.__board.key, iso: window.__board.iso }));
  expect(b.ks[0]).toBe(want.k0);
  expect(b.ks[1]).toBe(want.k1);
  expect(b.key).toBe('cbm:' + b.iso + ':focus');
  await page.getByRole('button', { name: 'All 20 on the board' }).click();
  expect(await page.evaluate(() => ({ n: window.__board.qs.length, key: window.__board.key === 'cbm:' + window.__board.iso }))).toEqual({ n: 20, key: true });
});

test('a made sheet can be swapped for a fresh set of questions; marks entered for it are cleared', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  const m = page.locator('tr[data-pid="p1"] .cbm-mark');
  await m.nth(0).click(); await m.nth(1).click();
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
  await expect(page.locator('tr[data-pid="p1"] .cbm-mark').first()).toHaveText('·');
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
