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
    out.others = Object.keys(d3.sheets).filter(pid => pid !== 'p1' && (d3.sheets[pid].drop || d3.sheets[pid].qs || Object.values(d3.sheets[pid].ks || {}).some(k => k.indexOf('dp:') !== 0)));
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
    out.others = Object.keys(d2.sheets).filter(pid => pid !== 'p1' && (d2.sheets[pid].drop || d2.sheets[pid].qs || Object.values(d2.sheets[pid].ks || {}).some(k => k.indexOf('dp:') !== 0)));
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
  expect(await page.evaluate(() => window.CBM.load().xt)).toEqual({ on: false, pick: 'all', count: 50, mode: 'grid', per: false });
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.getByLabel('×tables on the back').check();
  await page.locator('#cbmXtPick').selectOption('5');
  await page.locator('#cbmXtCount').selectOption('30');
  expect(await page.evaluate(() => window.CBM.load().xt)).toEqual({ on: true, pick: '5', count: 30, mode: 'grid', per: false });

  await page.locator('.cbm-tab[data-view="today"]').click();
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  const tables = page.locator('#starterPrint .gen-grid-tables');
  await expect(tables).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-paper > .gen-day')).toHaveCount(ROSTER.length * 2);
  // each child's tables page comes straight after their sheet, so it lands on the back
  await expect(page.locator('#starterPrint .cbm-paper > .gen-day').nth(1)).toContainText(ROSTER[0].name);
  await expect(page.locator('#starterPrint .cbm-paper > .gen-day').nth(1)).toContainText('Times tables — 5×');
  await expect(tables.first().locator('.gen-q')).toHaveCount(30);
  const grids = await tables.evaluateAll(els => els.map(e => e.innerHTML));
  expect(new Set(grids).size).toBe(1);

  await page.getByRole('button', { name: 'Print ×tables only' }).click();
  await expect(page.locator('#starterPrint .gen-grid-tables')).toHaveCount(1);
  expect(await page.locator('#starterPrint .gen-grid-tables').innerHTML()).toBe(grids[0]);
  expect(errors).toEqual([]);
});

test('Set up is a list: a drop-down for each question and an example of it beside', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByRole('button', { name: 'Set up' }).click();
  const rows = page.locator('.cbm-picker .gen-slot');
  await expect(rows).toHaveCount(20);
  await expect(page.locator('.cbm-picker .gen-slot select')).toHaveCount(20);
  const egs = await page.locator('.cbm-picker .cbm-eg .cbm-egq').evaluateAll(els => els.map(e => e.innerHTML.trim()));
  expect(egs).toHaveLength(20);
  egs.forEach(h => { expect(h.length).toBeGreaterThan(0); expect(h).not.toMatch(/undefined|NaN/); });

  /* choosing a skill changes that row's example, and only that row's */
  const step = await page.evaluate(() => window.WR_STEPS.filter(s => s.block === 'a2' && typeof s.gen === 'function')[0].id);
  const before = await rows.nth(0).locator('.cbm-eg').innerHTML(), second = await rows.nth(1).locator('.cbm-eg').innerHTML();
  await rows.nth(0).locator('select').selectOption(step);
  expect(await page.evaluate(() => window.CBM.load().slots[0])).toBe(step);
  expect(await rows.nth(0).locator('.cbm-eg').innerHTML()).not.toBe(before);
  expect(await rows.nth(1).locator('.cbm-eg').innerHTML()).toBe(second);
  await expect(page.locator('.cbm-picker .ms-count')).toHaveText('1 of 20 set');
  expect(errors).toEqual([]);
});

test('the number of questions is yours to choose, up to 20; made days keep their length', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(WR_SLOTS);
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.locator('#cbmN').selectOption('12');
  await expect(page.locator('.cbm-picker .gen-slot')).toHaveCount(12);
  await expect(page.locator('.cbm-picker .ms-count')).toHaveText('12 of 12 set');
  expect(await page.evaluate(() => window.CBM.load().n)).toBe(12);

  await page.locator('.cbm-tab[data-view="today"]').click();
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await expect(page.getByRole('button', { name: 'All 12 on the board' })).toBeVisible();
  const made = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), iso = Object.keys(s.days)[0], d = s.days[iso];
    return { n: d.qs.length, audit: d.audit, mine: C.sheetQs(d, iso, 'p1').length };
  });
  expect(made.n).toBe(12);
  expect(made.mine).toBe(12);
  expect(made.audit[0]).toBeLessThan(6);
  expect(made.audit[1]).toBeGreaterThanOrEqual(6);
  expect(made.audit[1]).toBeLessThan(12);

  /* back to 20: the hidden rows kept their choices, and the day made at 12 is still 12 */
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.locator('#cbmN').selectOption('20');
  await expect(page.locator('.cbm-picker .gen-slot')).toHaveCount(20);
  await expect(page.locator('.cbm-picker .ms-count')).toHaveText('20 of 20 set');
  expect(await page.evaluate(() => { const s = window.CBM.load(); return Object.values(s.days)[0].qs.length; })).toBe(12);

  /* an odd number still gives one marked question in each half; nonsense reads as 20 */
  const odd = await page.evaluate(() => {
    const C = window.CBM, s = C.load(); s.n = 9; const d = C.makeDay(s, '2031-03-03');
    s.n = 3; C.save(s);
    return { n: d.qs.length, audit: d.audit, bad: C.load().n };
  });
  expect(odd.n).toBe(9);
  expect(odd.audit[0]).toBeLessThan(5);
  expect(odd.audit[1]).toBeGreaterThanOrEqual(5);
  expect(odd.audit[1]).toBeLessThan(9);
  expect(odd.bad).toBe(20);
  expect(errors).toEqual([]);
});

test('changing the number: a child on the whole sheet follows it; a child cut back keeps theirs, within it', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(10), out = {};
    const mark = (day, p1) => roster.forEach(p => { day.marks[p.id] = { a: p.id === 'p1' ? p1 : [1, 1] }; });
    const len = (d, pid) => C.sheetPlan(d, pid).slots.length;
    for (let i = 0; i < 6; i++) mark(C.makeDay(s, days[i]), [1, -1]);        // 20 20 18 18 16 16
    const d6 = C.makeDay(s, days[6]); out.cut = len(d6, 'p1'); mark(d6, [1, 1]);
    s.n = 16; const d7 = C.makeDay(s, days[7]);
    out.at16 = [d7.qs.length, len(d7, 'p1'), len(d7, 'p2')]; mark(d7, [1, 1]);
    s.n = 12; const d8 = C.makeDay(s, days[8]);
    out.at12 = [d8.qs.length, len(d8, 'p1'), len(d8, 'p2')]; mark(d8, [1, 1]);
    s.n = 20; const d9 = C.makeDay(s, days[9]);
    out.at20 = [d9.qs.length, len(d9, 'p1'), len(d9, 'p2')];
    return out;
  }, PAST_DAYS);
  expect(r.cut).toBe(14);
  expect(r.at16).toEqual([16, 14, 16]);
  expect(r.at12).toEqual([12, 12, 12]);
  expect(r.at20).toEqual([20, 20, 20]);            // on the whole sheet at 12, so on the whole sheet at 20
});


/* ── going deeper ─────────────────────────────────────── */
test('deeper questions: every one is well formed, short, and has the right answer', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const C = window.CBM, calc = (a, op, b) => op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
    const keys = window.WR_STEPS.filter(s => typeof s.gen === 'function' && window.wrBlock(s.block).year === 2).map(s => s.id)
      .concat(C.buildDay(C.load(), '2030-01-07').map(q => q.k));
    const bad = [], forms = {}; let n = 0, deepKeys = 0;
    keys.forEach(k => {
      if (!C.canDeep(k)) return; deepKeys++;
      for (let i = 0; i < 200; i++) ['dp:', 'do:'].forEach(pre => {
        const d = C.buildKey(pre + k, 's' + i); n++;
        if (!d.f) return;                                   // this build had no deeper form: the class question, checked elsewhere
        forms[d.f] = 1;
        const txt = d.t === 'prompt' ? String(d.s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(d), fail = m => bad.push(k + ' ' + d.f + ' ' + m + ': ' + txt);
        const ans = String(window.genAnswer(d, '2030-01-07'));
        if (!txt || ans === '' || /undefined|NaN/.test(txt + ans)) fail('junk');
        if (d.f === 'open' && pre === 'dp:') fail('open on the sheet');
        if (d.t === 'prompt') {
          if (txt.length > 120) fail('long');
          let m;
          if (d.f === 'mistake' && (m = txt.match(/says (\d+) ([+\-×÷]) (\d+)(?: \+ (\d+))? = (\d+)\./))) {
            const right = m[4] ? +m[1] + +m[3] + +m[4] : calc(+m[1], m[2], +m[3]);
            if (String(right) !== ans || +m[5] === right) fail('mistake');
          }
          if (d.f === 'truefalse' && (m = txt.match(/(\d+) ([+\-×÷]) (\d+) = (\d+)$/)) && (calc(+m[1], m[2], +m[3]) === +m[4]) !== (ans === 'True')) fail('true/false');
          if (d.f === 'backwards' && (m = txt.match(/I add (\d+) and get (\d+)/)) && +m[2] - +m[1] !== +ans) fail('backwards');
          if (d.f === 'balance' && (m = txt.match(/^(\d+) ([+\-]) (\d+) = \? ([+\-]) (\d+)$/)) && calc(+ans, m[4], +m[5]) !== calc(+m[1], m[2], +m[3])) fail('balance');
        } else if (d.t === 'compare') {
          if (calc(d.a, d.aop, d.b) < 0 || calc(d.c, d.bop, d.d) < 0) fail('negative');
        } else fail('type');
      });
    });
    return { bad: bad.slice(0, 8), n, deepKeys, forms: Object.keys(forms), clock: C.canDeep('c2.1'), fd: C.canDeep('fd:add10') };
  });
  expect(r.bad).toEqual([]);
  expect(r.deepKeys).toBeGreaterThan(60);
  expect(r.forms).toEqual(expect.arrayContaining(['mistake', 'truefalse', 'backwards', 'balance', 'compare', 'more', 'fewest', 'whole', 'regroup', 'open']));
  expect(r.clock).toBe(false);                       // needs a picture: stays the class question
  expect(r.fd).toBe(false);
});

test('a child whose marks are nearly all right goes deeper: five a sheet at most, own numbers, and a wrong mark brings that question back', async ({ page }) => {
  await open(page);
  await page.evaluate(WR_SLOTS);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(26), out = { perSheet: [] };
    s.support.p2 = { mode: 'num' }; s.support.p3 = { mode: 'full' };
    const deepOf = (d, pid) => Object.values((d.sheets[pid] || {}).ks || {}).filter(k => k.indexOf('dp:') === 0);
    const lvDeep = pid => Object.keys(s.lv[pid] || {}).filter(c => s.lv[pid][c] < 0);
    const allRight = d => roster.forEach(p => { d.marks[p.id] = { a: [1, 1] }; });
    let hit = null, i = 0;
    for (; i < 12; i++) {
      const d = C.makeDay(s, days[i]);
      out.perSheet.push(deepOf(d, 'p1').length);
      if (i === 11) { out.stored = Object.keys(d.sheets.p1 || {}); out.num = deepOf(d, 'p2').length + (s.lv.p2 ? 1 : 0); out.full = deepOf(d, 'p3').length; }
      allRight(d);
    }
    out.total = lvDeep('p1').length;
    // p1 and p4 on the same deeper slot have different numbers; a rebuild is identical
    const dl = s.days[days[11]], a = C.sheetQs(dl, days[11], 'p1'), pl = C.sheetPlan(dl, 'p1'), j = pl.slots.findIndex(x => x.k.indexOf('dp:') === 0);
    out.label = C.keyLabel(pl.slots[j].k);
    out.same = JSON.stringify(C.buildKey(pl.slots[j].k, 'x:p1')) === JSON.stringify(C.buildKey(pl.slots[j].k, 'x:p1'));
    out.differ = [1, 2, 3, 4, 5, 6].some(n => JSON.stringify(C.buildKey(pl.slots[j].k, 'x:p1:' + n)) !== JSON.stringify(C.buildKey(pl.slots[j].k, 'x:p4:' + n)));
    out.rendered = a.map(q => window.genRenderQuestion(q)).join(' ');
    // mark right until one of the two marked questions is a deeper one for p1, then mark that wrong
    for (; i < 24 && !hit; i++) {
      const d = C.makeDay(s, days[i]), p = C.sheetPlan(d, 'p1'); allRight(d);
      const k = p.audit.findIndex(pos => p.slots[pos].k.indexOf('dp:') === 0);
      if (k >= 0) { hit = p.slots[p.audit[k]].c; d.marks.p1 = { a: k === 0 ? [0, 1] : [1, 0] }; }
    }
    out.hit = !!hit;
    if (hit) {
      const d = C.makeDay(s, days[i]), p = C.sheetPlan(d, 'p1'); allRight(d);
      out.backNow = !(s.lv.p1 && s.lv.p1[hit]);
      out.others = lvDeep('p1').length;                 // the rest stay deeper
      const again = p.audit.some(pos => p.slots[pos].c === hit);          // marked right on it today: it may go deeper again
      C.makeDay(s, days[i + 1]);
      out.stillBack = again || !(s.lv.p1 && s.lv.p1[hit]);

    }
    // marks that stop being nearly all right: no deeper questions at all (a fresh class)
    const t = C.load(), deepT = () => Object.keys(t.lv.p1 || {}).filter(c => t.lv.p1[c] < 0).length;
    out.fall = [];
    for (let n = 0; n < 11; n++) { const d = C.makeDay(t, days[n]); out.fall.push(deepT()); roster.forEach(p => { d.marks[p.id] = { a: n < 7 ? [1, 1] : [0, 0] }; }); }
    return out;
  }, PAST_DAYS);
  expect(r.fall[7]).toBeGreaterThan(5);                     // 14 marks, all right
  expect(r.fall[8]).toBeGreaterThan(0);                     // 14 of 16: still above the line to stay
  expect(r.fall[10]).toBe(0);                               // 14 of 20: no longer
  expect(Math.max(...r.perSheet)).toBeLessThanOrEqual(5);
  expect(Math.max(...r.perSheet)).toBeGreaterThanOrEqual(3);
  expect(r.perSheet.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);   // nothing before twelve marks
  expect(r.total).toBeGreaterThan(5);                       // more skills than a sheet carries: a different few each day
  expect(r.stored).toEqual(['ks']);
  expect(r.num).toBe(0);
  expect(r.full).toBe(0);
  expect(r.label).toMatch(/ · deeper$/);
  expect(r.same).toBe(true);
  expect(r.differ).toBe(true);
  expect(r.rendered).not.toMatch(/undefined|NaN|dp:/);
  expect(r.hit).toBe(true);
  expect(r.backNow).toBe(true);
  expect(r.stillBack).toBe(true);
  expect(r.others).toBeGreaterThan(5);
});

test('practice box: a child with no wrong marks gets four deeper questions; a wrong mark still comes first', async ({ page }) => {
  await open(page);
  await page.evaluate(WR_SLOTS);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(8);
    for (let i = 0; i < 6; i++) { const d = C.makeDay(s, days[i]); roster.forEach(p => { d.marks[p.id] = { a: p.id === 'p2' && i === 5 ? [0, 1] : [1, 1] }; }); }
    const d = C.makeDay(s, days[6]);
    const an = C.analyse(s, days[5], 28), tg = pid => { const pl = C.sheetPlan(d, pid), cmap = {}; pl.slots.forEach(x => { cmap[x.k] = x.c; }); return C.chooseTargets(an, pid, pl.slots.map(x => x.k), 4, false, cmap); };
    const mine = tg('p1'), q = C.buildKey(mine[0].k, 'box');
    return { mine, p2: tg('p2'), text: window.genRenderQuestion(q) + ' ' + window.genAnswer(q, days[6]) };
  }, PAST_DAYS);
  expect(r.mine).toHaveLength(4);
  expect(r.mine.every(x => x.y === 'stretch' && x.k.indexOf('do:') === 0)).toBe(true);
  expect(r.p2[0].y).toBe('miss');
  expect(r.text).not.toMatch(/undefined|NaN/);
});

test('who is on what: colours on Progress only, by the next sheet, with a letter as well as a colour', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(WR_SLOTS);
  const unit = await page.evaluate(() => {
    const C = window.CBM, keys = C.buildDay(C.load(), '2030-01-07').map(q => q.k), uniq = keys.filter((k, i) => keys.indexOf(k) === i);
    const backable = uniq.filter(k => C.stepBack(k, 1)), deepable = uniq.filter(k => C.canDeep(k));
    const lv = (list, n, v) => { const o = {}; list.slice(0, n).forEach(k => { o[k] = v; }); return o; };
    const st = (plan) => { const x = C.stageOf(Object.assign({ mode: 'auto', n: keys.length, lv: {}, why: '' }, plan), keys); return [x.id, x.back, x.deep]; };
    const per = k => keys.filter(x => x === k).length;                  // a skill can fill more than one slot
    return {
      cls: st({}), num: st({ mode: 'num', n: 12 })[0],
      back1: st({ lv: lv(backable, 1, 1) }), back1n: per(backable[0]),
      back3: st({ lv: lv(backable, 3, 1) })[0],
      fewer: st({ n: keys.length - 2 })[0], both: st({ n: keys.length - 2, lv: lv(backable, 3, 2) })[0],
      deep: st({ lv: lv(deepable, 6, -1) }), deep1: st({ lv: lv(deepable, 1, -1) })[0] === 'deeper' && per(deepable[0]) < 3
    };
  });
  expect(unit.cls).toEqual(['class', 0, 0]);
  expect(unit.num).toBe('easier');
  expect(unit.back1[0]).toBe(unit.back1n >= 3 ? 'easier' : 'class');     // one or two questions back: still blue, with a ↓
  expect(unit.back1[1]).toBe(unit.back1n);
  expect(unit.back3).toBe('easier');
  expect(unit.fewer).toBe('fewer');
  expect(unit.both).toBe('easier');                                      // most support first
  expect(unit.deep[0]).toBe('deeper');
  expect(unit.deep[2]).toBe(5);                                          // what the sheet will carry, not every skill
  expect(unit.deep1).toBe(false);

  /* in the page: p2 numbers only, p3 not finishing, the rest marked right */
  await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(6);
    s.support.p2 = { mode: 'num' };
    days.forEach(iso => { const d = C.makeDay(s, iso); roster.forEach(p => { d.marks[p.id] = { a: p.id === 'p3' ? [1, -1] : [1, 1] }; }); });
    C.makeDay(s, (() => { const x = new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); })());
    C.save(s); window.cbmRender();
  }, PAST_DAYS);
  await expect(page.locator('.cbm-stage')).toHaveCount(0);               // Today: nothing coloured
  await page.locator('.cbm-tab[data-view="progress"]').click();
  const card = page.locator('.cbm-stages');
  await expect(card.locator('.cbm-st-col')).toHaveCount(4);                 // a column a stage, a name a line
  await expect(card.locator('.cbm-st-col li')).toHaveCount(ROSTER.length);
  await expect(card.locator('.cbm-st-easier .cbm-st-title')).toHaveText('EEasier questions');
  await expect(card.locator('.cbm-st-fewer .cbm-st-title')).toHaveText('FFewer questions');
  await expect(card.locator('.cbm-st-deeper .cbm-st-title')).toHaveText('CChallenge');
  await expect(card.locator('.cbm-st-easier li')).toHaveCount(1);
  await expect(card.locator('.cbm-st-easier li i')).toContainText('numbers only');
  await expect(card.locator('.cbm-st-fewer li')).toHaveCount(1);
  await expect(card.locator('.cbm-st-fewer li i')).toContainText('Qs');
  expect(await card.locator('.cbm-st-deeper li').count()).toBeGreaterThan(0);
  const counts = await card.locator('.cbm-st-count').evaluateAll(els => els.map(e => +e.textContent));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(ROSTER.length);
  /* a heading keeps its own colour whatever the app's buttons do */
  const head = card.locator('.cbm-st-easier .cbm-st-head');
  await head.hover();
  expect(await head.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(251, 213, 213)');
  await head.click();                                                       // the tables below: only those children
  await expect(page.locator('.cbm-grid tbody tr')).toHaveCount(2);          // the class row and that child
  await expect(page.locator('.cbm-stages .cbm-st-col li')).toHaveCount(ROSTER.length);
  expect(await page.locator('.cbm-stages .cbm-st-easier .cbm-st-head').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(251, 213, 213)');
  await page.locator('.cbm-stages .cbm-st-easier .cbm-st-head').click();
  await expect(page.locator('.cbm-grid tbody tr')).toHaveCount(ROSTER.length + 1);

  /* nothing a child sees carries it: the sheets, the marking list, Today */
  await page.locator('.cbm-tab[data-view="today"]').click();
  await expect(page.locator('.cbm-stage')).toHaveCount(0);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  expect(await page.evaluate(() => document.body.innerHTML.includes('cbm-stage'))).toBe(false);
  await page.getByRole('button', { name: 'Print marking list' }).click();
  expect(await page.evaluate(() => document.body.innerHTML.includes('cbm-stage'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Set up shows the deeper question under the example, where a skill has one', async ({ page }) => {
  await open(page);
  await page.evaluate(WR_SLOTS);
  await page.getByRole('button', { name: 'Set up' }).click();
  const n = await page.locator('.cbm-picker .cbm-egdeep').count();
  expect(n).toBeGreaterThan(10);
  const txt = await page.locator('.cbm-picker .cbm-egdeep').allInnerTexts();
  txt.forEach(t => { expect(t).toMatch(/^Deeper/i); expect(t).not.toMatch(/undefined|NaN/); });
  await expect(page.locator('.cbm-picker .cbm-eg .cbm-egq')).toHaveCount(20);
});

test('a skill stepped back after one slip comes forward again after three sheets with no further wrong mark', async ({ page }) => {
  await open(page);
  await page.evaluate(WR_SLOTS);
  const r = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(8), out = { depth: [] };
    const mark = (d, p1) => roster.forEach(p => { d.marks[p.id] = { a: p.id === 'p1' ? p1 : [1, 1] }; });
    mark(C.makeDay(s, days[0]), [1, 1]); mark(C.makeDay(s, days[1]), [1, 1]);
    const d2 = C.makeDay(s, days[2]), c = C.sheetPlan(d2, 'p1').slots[C.sheetPlan(d2, 'p1').audit[0]].c;
    mark(d2, [0, 1]);                                       // one slip on c
    let touched = false;
    for (let i = 3; i < 8; i++) {
      const d = C.makeDay(s, days[i]), pl = C.sheetPlan(d, 'p1');
      out.depth.push((s.lv.p1 || {})[c] || 0);
      if (pl.audit.some(pos => pl.slots[pos].c === c)) touched = true;      // marked on it again: the marks rule applies instead
      mark(d, [1, 1]);
    }
    out.touched = touched;
    return out;
  }, PAST_DAYS);
  expect(r.depth[0]).toBe(1);                               // the sheet after the slip: one step back
  if (!r.touched) {
    expect(r.depth.slice(0, 3)).toEqual([1, 1, 1]);         // practised for three sheets
    expect(r.depth[3]).toBe(0);                             // then the class question again
    expect(r.depth[4]).toBe(0);
  }
});

test('printing: every child\'s questions and practice box fit one side of A4, so the ×tables land on the back', async ({ page }) => {
  await open(page);
  /* about the longest sheet there is: clocks, number lines and blocks, deeper questions, a practice box */
  const made = await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(8);
    s.slots = Array.from({ length: 20 }, (_, i) => ['c2.3', 'a1.10', 'c2.5', 'a1.4', 'a2.19'][i % 5]);     // clocks, lines, blocks
    s.xt = { on: true, pick: 'all', count: 100 };
    days.forEach(iso => { const d = C.makeDay(s, iso); roster.forEach(p => { d.marks[p.id] = { a: [1, p.id === 'p2' ? 0 : 1] }; }); });
    const x = new Date(), today = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    const d = C.makeDay(s, today);
    C.save(s); window.cbmRender(); window.print = () => {};
    return { deep: Object.values(d.sheets).filter(sh => Object.values(sh.ks || {}).some(k => k.indexOf('dp:') === 0)).length };
  }, PAST_DAYS);
  expect(made.deep).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Print class set' }).click();
  await page.emulateMedia({ media: 'print' });
  const r = await page.evaluate(() => {
    const ruler = document.createElement('div'); ruler.style.cssText = 'height:100mm;width:1px;position:absolute'; document.body.appendChild(ruler);
    const mm = ruler.getBoundingClientRect().height / 100; ruler.remove();
    const sheets = [...document.querySelectorAll('#starterPrint .cbm-sheet')];
    return { n: sheets.length, tallest: Math.max(...sheets.map(s => s.getBoundingClientRect().height / mm)),
             boxes: sheets.filter(s => s.querySelector('.cbm-pbox')).length, widths: [...new Set(sheets.map(s => Math.round(s.getBoundingClientRect().width / mm)))],
             ks: sheets.map(s => +(s.style.getPropertyValue('--k') || 1)), smallest: Math.min(...sheets.map(s => parseFloat(getComputedStyle(s.querySelector('.gen-q')).fontSize))) };
  });
  expect(r.n).toBe(ROSTER.length);
  expect(r.boxes).toBe(ROSTER.length);
  expect(r.widths).toEqual([192]);
  expect(r.tallest).toBeLessThanOrEqual(279);                 // one side of A4 inside the page margins
  expect(Math.min(...r.ks)).toBeLessThan(1);                  // these were too long, and were turned down to fit
  expect(Math.min(...r.ks)).toBeGreaterThanOrEqual(0.5);
  /* the real thing: as a PDF, a sheet and its ×tables page for every child and nothing else */
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages).toBe(ROSTER.length * 2);
});

test('printing: an ordinary sheet is not shrunk', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print one blank sheet' }).click();
  const k = await page.evaluate(() => document.querySelector('#starterPrint .cbm-sheet').style.getPropertyValue('--k'));
  expect(k).toBe('');
});


test('children mark their own: each child\'s answers as a strip on the back page, still one page, nothing entered', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  expect(await page.evaluate(() => window.CBM.load().sm)).toBe(false);
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.getByLabel('Children mark their own answers').check();
  await page.getByLabel('×tables on the back').check();
  await page.locator('#cbmXtCount').selectOption('100');
  expect(await page.evaluate(() => window.CBM.load().sm)).toBe(true);
  await page.evaluate(PAST => {
    const C = window.CBM, s = C.load(), days = eval(PAST)(3);
    days.forEach(iso => { const d = C.makeDay(s, iso); roster.forEach(p => { d.marks[p.id] = { a: [1, 0] }; }); });
    C.save(s);
  }, PAST_DAYS);
  await page.locator('.cbm-tab[data-view="today"]').click();
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  await expect(page.locator('#starterPrint .cbm-strip')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-sheet .cbm-strip')).toHaveCount(0);        // never on the side they write on
  const r = await page.evaluate(() => {
    const C = window.CBM, s = C.load(), iso = Object.keys(s.days).sort().pop(), d = s.days[iso];
    const strips = [...document.querySelectorAll('#starterPrint .cbm-strip')];
    const first = [...strips[0].querySelectorAll('.cbm-strip-list:not(.cbm-strip-box) .cbm-strip-a')].map(e => e.textContent.replace(/^\d+\)\s*/, ''));
    const want = C.sheetQs(d, iso, roster[0].id).map(q => String(window.genAnswer(q, iso)));
    return { first, want, box: strips[0].querySelectorAll('.cbm-strip-box .cbm-strip-a').length, pbox: document.querySelectorAll('#starterPrint .cbm-sheet')[0].querySelectorAll('.cbm-pbox .gen-q').length,
             differ: new Set(strips.map(e => e.textContent)).size > 1, marks: Object.keys(d.marks).length, text: strips.map(e => e.textContent).join(' ') };
  });
  expect(r.first).toEqual(r.want);                          // this child's own answers, in order
  expect(r.box).toBe(r.pbox);                               // and their practice box's
  expect(r.differ).toBe(true);
  expect(r.marks).toBe(0);                                  // printing answers enters nothing
  expect(r.text).not.toMatch(/undefined|NaN/);
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(ROSTER.length * 2);   // 100 tables and the strip: still one back page
  await page.emulateMedia({ media: 'screen' });

  /* without ×tables the back page is just the strip; the blank sheet and the board never carry answers */
  await page.evaluate(() => { const s = window.CBM.load(); s.xt.on = false; window.CBM.save(s); window.cbmRender(); });
  await page.getByRole('button', { name: 'Print class set' }).click();
  await expect(page.locator('#starterPrint .cbm-backpage')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .gen-grid-tables')).toHaveCount(0);
  await expect(page.locator('#starterPrint .cbm-backpage').first()).toContainText('Mental Starter answers');
  await page.getByRole('button', { name: 'Print one blank sheet' }).click();
  await expect(page.locator('#starterPrint .cbm-strip')).toHaveCount(0);
  expect(errors).toEqual([]);
});


/* ── Times tables: one record per child; the Multiples page moves it on ── */
test('Multiples: two ✓ in a row moves a child on, every third page is a revisit, ✗✗ on a revisit learns it again', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const r = await page.evaluate(`(() => {
    const C = window.CBM, days = ${PAST_DAYS}(12), s = C.load();
    s.xt = { on: true, pick: 'all', count: 50, mode: 'mult', per: false };
    const steps = [];
    // each day: fix the table as printing would, then mark p1 with the given mark
    const go = (d, m) => { s.days[d] = { qs: [], audit: [], sheets: {}, marks: {}, tg: {}, ind: 1 };
      C.freezeTables(s, d); if (m != null) s.days[d].xm = { p1: m }; steps.push(s.days[d].mt.p1); };
    go(days[0], 1); go(days[1], 1);          // 10, 10 → got 10
    go(days[2], 1); go(days[3], 1);          // 5, 5 → got 5; learning 2
    go(days[4], null); go(days[5], null);    // 2, 2
    go(days[6], 1);                          // a revisit: 10, seen longest ago
    go(days[7], null); go(days[8], null);    // 2, 2
    go(days[9], 0);                          // revisit 5: ✗
    go(days[10], 0);                         // 5 again on the next sheet: ✗ again → learning 5
    go(days[11], null);
    const st = C.tablesState(s, 'p1');
    return { steps, on: st.on, got: Object.keys(st.got).map(Number), p2: s.days[days[0]].mt.p2 };
  })()`);
  expect(r.steps).toEqual([10, 10, 5, 5, 2, 2, 10, 2, 2, 5, 5, 5]);
  expect(r.on).toBe(5);
  expect(r.got).toEqual([10]);
  expect(r.p2).toBe(10);       // a child with no record starts on 10s
  expect(errors).toEqual([]);
});

test('Multiples page: every table makes one connected path, a true sort, and no holes; same date and table, same page', async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(() => {
    const C = window.CBM, out = [];
    ['2026-11-02', '2026-11-03', '2026-11-04'].forEach(d => C.ORDER.forEach(n => {
      const m = C.multiplesFor(d, n);
      if (JSON.stringify(m) !== JSON.stringify(C.multiplesFor(d, n))) out.push(n + ' not repeatable');
      if (m.sort.length !== 18 || m.sort.some(x => (x.v % n === 0) !== x.m) || new Set(m.sort.map(x => x.v)).size !== 18) out.push(n + ' sort');
      // the multiples in the grid are exactly the path, and it joins the top row to the bottom
      const on = (r, c) => m.grid[r][c] % n === 0, seen = {}, todo = [];
      for (let c = 0; c < 8; c++) if (on(0, c)) { seen['0:' + c] = 1; todo.push([0, c]); }
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (on(r, c) !== !!m.path[r + ':' + c]) out.push(n + ' path cell');
      while (todo.length) { const [r, c] = todo.pop(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a, b]) => { const k = (r + a) + ':' + (c + b);
        if (r + a >= 0 && r + a < 8 && c + b >= 0 && c + b < 8 && !seen[k] && on(r + a, c + b)) { seen[k] = 1; todo.push([r + a, c + b]); } }); }
      if (![0,1,2,3,4,5,6,7].some(c => seen['7:' + c])) out.push(n + ' path broken');
      if (Object.keys(seen).length !== Object.keys(m.path).length) out.push(n + ' stray multiple');
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (m.path[r + ':' + c] && m.path[r + ':' + (c + 1)] && m.path[(r + 1) + ':' + c] && m.path[(r + 1) + ':' + (c + 1)]) out.push(n + ' path not one wide');
      // no fact twice: the twelve calculations use twelve different multipliers
      const by = m.calcs.concat(m.easy).map(q => q.by);
      if (new Set(by).size !== 12) out.push(n + ' repeated fact ' + by);
      if (m.seqs.some(row => row.some(x => x.v < 0) || row.filter(x => x.g).length < 2)) out.push(n + ' seq');
      if (m.calcs.concat(m.easy).some(q => q.s.indexOf('_') < 0 || !(q.a >= 0))) out.push(n + ' calc');
    }));
    return out;
  });
  expect(bad).toEqual([]);
});

test('Multiples on the back: each child gets their own table, the mark is one tap, the marking list has a key per table', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByRole('button', { name: 'Set up' }).click();
  await page.getByLabel('×tables on the back').check();
  await page.locator('#cbmXtMode').selectOption('mult');
  await expect(page.locator('#cbmXtPick')).toHaveCount(0);
  // p2 already has 10s and 5s
  await page.evaluate(() => { const s = window.CBM.load(); window.CBM.moveOnto(s, 'p2', 2); window.CBM.save(s); });

  await page.locator('.cbm-tab[data-view="today"]').click();
  await page.getByRole('button', { name: 'Make the sheet' }).click();
  await expect(page.locator('tr[data-pid="p1"] .cbm-xmt')).toHaveText('×10');
  await expect(page.locator('tr[data-pid="p2"] .cbm-xmt')).toHaveText('×2');
  const xm = page.locator('tr[data-pid="p1"] .cbm-xm');
  await xm.click(); await expect(xm).toHaveText('✓');
  await xm.click(); await expect(xm).toHaveText('✗');
  await xm.click(); await expect(xm).toHaveText('·');
  await xm.click();
  // a Multiples mark is not one of the teacher's two
  await expect(page.locator('#cbmCount')).toHaveText(`0 of ${ROSTER.length} entered`);

  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'Print class set' }).click();
  await expect(page.locator('#starterPrint .cbm-mpage')).toHaveCount(ROSTER.length);
  await expect(page.locator('#starterPrint .cbm-paper > .gen-day').nth(1)).toContainText('Multiples of TEN');
  const tabs = await page.locator('#starterPrint .cbm-mpage').evaluateAll(els => els.map(e => e.dataset.table));
  expect(tabs).toContain('2');
  await page.getByRole('button', { name: 'Print marking list' }).click();
  await expect(page.locator('#starterPrint .cbm-mkey')).toHaveCount(new Set(tabs).size);
  expect(errors).toEqual([]);
});

test('The square reads the same record: own tables when chosen, the class pick when not; Progress moves children by hand', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const r = await page.evaluate(`(() => {
    const C = window.CBM, d = ${PAST_DAYS}(1)[0], s = C.load();
    s.xt = { on: true, pick: 'all', count: 40, mode: 'grid', per: false };
    const cls = C.squareFor(s, d, 'p1');
    C.moveOnto(s, 'p1', 5);
    const before = C.squareFor(s, d, 'p1');
    s.xt.per = true;
    const own = C.squareFor(s, d, 'p1');
    return { cls: cls.label, before: before.label, own: own.label, bases: [...new Set(own.qs.map(q => q.base))].sort((a, b) => a - b), n: own.qs.length };
  })()`);
  expect(r.cls).toBe(r.before);            // per off: the class pick, unchanged
  expect(r.own).toBe('5×, 10×');
  expect(r.bases).toEqual([5, 10]);
  expect(r.n).toBe(40);

  await page.evaluate(() => { const s = window.CBM.load(); s.xt = { on: true, pick: 'all', count: 50, mode: 'grid', per: true }; window.CBM.save(s); });
  await page.getByRole('button', { name: 'Progress' }).click();
  const row = page.locator('tr[data-xpid="p1"]');
  await row.locator('[data-xon]').selectOption('4');
  expect(await page.evaluate(() => { const st = window.CBM.tablesState(window.CBM.load(), 'p1'); return [st.on, Object.keys(st.got).map(Number).sort((a, b) => a - b)]; })).toEqual([4, [2, 5, 10]]);
  await page.locator('tr[data-xpid="p1"] [data-xgot="5"]').click();
  expect(await page.evaluate(() => Object.keys(window.CBM.tablesState(window.CBM.load(), 'p1').got).map(Number).sort((a, b) => a - b))).toEqual([2, 10]);
  await page.locator('tr[data-xpid="p2"] .cbm-xtsel').check();
  await page.locator('tr[data-xpid="p3"] .cbm-xtsel').check();
  await page.locator('#cbmXtBulk').selectOption('8');
  await page.locator('#cbmXtBulkGo').click();
  expect(await page.evaluate(() => ['p2', 'p3'].map(p => window.CBM.tablesState(window.CBM.load(), p).on))).toEqual([8, 8]);
  expect(errors).toEqual([]);
});
