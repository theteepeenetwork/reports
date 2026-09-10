/* White Rose Year 2 small steps, and the per-slot question picker.

   The catalogue in js/wrsteps.js is transcribed from White Rose Education's
   published 2022 schemes of learning. A teacher plans from those documents, so
   a step that is missing, renumbered or retitled here is worse than useless —
   it quietly disagrees with the planning on their desk. The counts below come
   from the source PDFs and are the point of the first test.

   The second thing worth guarding is that every step which claims to produce a
   question actually produces a printable one, every time, not just on a lucky
   roll. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function open(page) {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.wrBuild === 'function' && typeof window.genBuild === 'function',
    null, { timeout: 10000 });
}

/* Straight from the White Rose schemes of learning. If the catalogue and this
   table disagree, one of them is wrong and a teacher will find out the hard
   way. */
const BLOCKS = [
  ['a1', 'Autumn', 1, 'Place value', 16],
  ['a2', 'Autumn', 2, 'Addition and subtraction', 21],
  ['a3', 'Autumn', 3, 'Shape', 12],
  ['b1', 'Spring', 1, 'Money', 10],
  ['b2', 'Spring', 2, 'Multiplication and division', 17],
  ['b3', 'Spring', 3, 'Length and height', 5],
  ['b4', 'Spring', 4, 'Mass, capacity and temperature', 9],
  ['c1', 'Summer', 1, 'Fractions', 15],
  ['c2', 'Summer', 2, 'Time', 7],
  ['c3', 'Summer', 3, 'Statistics', 7],
  ['c4', 'Summer', 4, 'Position and direction', 5]
];

test('the catalogue matches the published Year 2 scheme', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => ({
    blocks: window.WR_BLOCKS.map(b => [b.id, b.term, b.n, b.title]),
    counts: window.WR_BLOCKS.map(b => window.WR_STEPS.filter(s => s.block === b.id).length),
    total: window.WR_STEPS.length
  }));

  expect(got.blocks).toEqual(BLOCKS.map(b => b.slice(0, 4)));
  expect(got.counts, 'a block has gained or lost a step').toEqual(BLOCKS.map(b => b[4]));
  expect(got.total).toBe(BLOCKS.reduce((a, b) => a + b[4], 0));
});

test('steps are numbered 1..n within their block, with no gaps or repeats', async ({ page }) => {
  await open(page);
  const problems = await page.evaluate(() => {
    const bad = [];
    window.WR_BLOCKS.forEach(b => {
      const ns = window.WR_STEPS.filter(s => s.block === b.id).map(s => s.n);
      ns.forEach((n, i) => { if (n !== i + 1) bad.push(b.id + ' step ' + n + ' is at position ' + (i + 1)); });
    });
    const ids = window.WR_STEPS.map(s => s.id);
    ids.forEach((id, i) => { if (ids.indexOf(id) !== i) bad.push('duplicate id ' + id); });
    return bad;
  });
  expect(problems).toEqual([]);
});

test('every step either builds a question or says why it cannot', async ({ page }) => {
  await open(page);
  const silent = await page.evaluate(() =>
    window.WR_STEPS.filter(s => typeof s.gen !== 'function' && !s.why).map(s => s.id));
  expect(silent, 'a step is unavailable with no reason shown to the teacher').toEqual([]);

  // The split is worth knowing about: if a future edit quietly drops a
  // generator, this is what catches it.
  const usable = await page.evaluate(() => window.WR_STEPS.filter(s => typeof s.gen === 'function').length);
  expect(usable).toBe(105);
});

test('every buildable step produces a printable question, every time', async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(() => {
    const problems = [];
    window.WR_STEPS.filter(s => typeof s.gen === 'function').forEach(s => {
      for (let i = 0; i < 60; i++) {
        const d = window.wrBuild(s.id);
        if (!d || !d.t) { problems.push(s.id + ' returned nothing'); break; }
        const html = window.genRenderQuestion(d);
        if (!html || !String(html).trim()) { problems.push(s.id + ' rendered empty'); break; }
        // an unrendered descriptor falls through to JSON, which is the tell
        // that a type has no renderer
        if (String(html).indexOf('"t":') >= 0) { problems.push(s.id + ' has no renderer for ' + d.t); break; }
        if (/undefined|NaN|null/.test(String(html))) { problems.push(s.id + ' rendered "' + html + '"'); break; }
      }
    });
    return problems;
  });
  expect(bad).toEqual([]);
});

test('no step asks a Year 2 child for a negative answer or a number past 100', async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(() => {
    const problems = [];
    window.WR_STEPS.filter(s => typeof s.gen === 'function').forEach(st => {
      for (let i = 0; i < 60; i++) {
        const q = window.wrBuild(st.id);
        if (q.t === 'arith') {
          const ans = q.op === '+' ? q.a + q.b : q.a - q.b;
          if (ans < 0) { problems.push(st.id + ': ' + q.a + ' ' + q.op + ' ' + q.b + ' = ' + ans); break; }
          if (ans > 100) { problems.push(st.id + ': ' + q.a + ' ' + q.op + ' ' + q.b + ' = ' + ans); break; }
        }
        if (q.t === 'seq') {
          const last = q.start + q.step * (q.len - 1);
          if (last < 0) { problems.push(st.id + ': sequence reaches ' + last); break; }
        }
        if (q.t === 'times' && q.base * q.by > 120) { problems.push(st.id + ': ' + q.base + '×' + q.by); break; }
      }
    });
    return problems;
  });
  expect(bad).toEqual([]);
});

test('a single clock is not asked about in the plural', async ({ page }) => {
  // The clock renderer was written for the preset, which draws three. A step
  // that draws one was still asking "What time is on the clocks?".
  await open(page);
  const [one, many] = await page.evaluate(() => [
    window.genRenderQuestion({ t: 'clock', items: [{ h: 3, m: 15 }] }),
    window.genRenderQuestion({ t: 'clock', items: [{ h: 3, m: 15 }, { h: 9, m: 0 }] })
  ]);
  expect(one).toContain('on the clock?');
  expect(one).not.toContain('clocks?');
  expect(many).toContain('on the clocks?');
});

test('a chosen step lands in the slot you chose, and the rest come from the preset', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const slots = new Array(20).fill(null);
    slots[0] = 'a2.1';    // Bonds to 10
    slots[4] = 'b2.9';    // The 2 times-table
    const qs = window.genBuildSteps('Autumn 1', slots);
    return {
      len: qs.length,
      q1: qs[0],
      q5: qs[4],
      // slot 2 was left alone, so it should match the Autumn 1 preset's shape
      q2type: qs[1].t
    };
  });

  expect(out.len).toBe(20);
  expect(out.q1.t, 'Bonds to 10 should be a missing-number question').toBe('missing');
  expect(out.q1.sum).toBe(10);
  expect(out.q5.t).toBe('times');
  expect(out.q5.base).toBe(2);
  expect(out.q2type, 'an unset slot should fall back to the Autumn 1 preset').toBe('seq');
});

test('an unset slot, an unknown step and an apparatus step all fall back rather than print a gap', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const slots = new Array(20).fill(null);
    slots[1] = 'no.such.step';
    slots[2] = 'c4.1';    // Language of position — needs a picture
    const qs = window.genBuildSteps('Autumn 1', slots);
    return qs.map(q => window.genRenderQuestion(q)).map(h => String(h).trim());
  });
  expect(out.length).toBe(20);
  expect(out.filter(h => !h), 'a slot printed an empty box').toEqual([]);
});

test('slots survive a save and reload, and a bad saved value is discarded', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const bad = ['a2.1', 42, null, 'nope', {}, 'b2.9'];
    const fixed = window.genNormaliseSlots(bad);
    return { len: fixed.length, first: fixed[0], junk: [fixed[1], fixed[3], fixed[4]], kept: fixed[5] };
  });
  expect(out.len).toBe(20);
  expect(out.first).toBe('a2.1');
  expect(out.junk, 'a number, an unknown id and an object should all become null').toEqual([null, null, null]);
  expect(out.kept).toBe('b2.9');
});

/* Open Mental Starters' design step with "Choose steps" selected — where the
   step picker lives since the Question Generator became this screen. */
async function openStepPicker(page) {
  await page.evaluate(() => {
    localStorage.setItem('tp_starter_cfg', JSON.stringify({ qCount: 20, mode: 'steps', xtb: true }));
    window.location.hash = '#mental-starters';
  });
  await page.waitForTimeout(400);
  await page.click("#tv-starter #designWeek");
  await page.waitForTimeout(400);
}

test('the picker offers every step, and greys the ones needing apparatus', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await openStepPicker(page);

  const picker = page.locator('#tv-design .gen-slots');
  await expect(picker).toBeVisible();
  expect(await picker.locator('select').count(), 'one selector per question').toBe(20);

  const first = picker.locator('select').first();
  expect(await first.locator('option').count(), 'every step should be offered').toBe(125); // 124 + the preset option
  expect(await first.locator('optgroup').count()).toBe(11);
  expect(await first.locator('option[disabled]').count(), 'apparatus steps should be greyed, not hidden').toBe(19);
  await expect(first.locator('option[disabled]').first()).toContainText('needs apparatus');
  /* A closed select shows only the option text, so the block has to be in it. */
  await expect(first.locator('option[value="c2.2"]'), 'a set slot would not say which block it came from')
    .toContainText('Sum2 · 2. Quarter past and quarter to');
  expect(errors).toEqual([]);
});

test('a bookmarked #generator lands on the design step that replaced it', async ({ page }) => {
  /* Audit finding 7 was that a redesign stranded live pages: #page-generator
     rendered fully but was in neither PLAN_NAV nor the hash whitelist, so a
     feature shipped onto it was invisible. It is not a page at all now — its
     controls are Mental Starters' design step — so what has to hold is that
     the hash a teacher bookmarked still arrives somewhere real, and that the
     CONTROLS are there. A section can be "visible" holding only a heading. */
  await open(page);
  await page.waitForTimeout(300);

  expect(await page.locator('.nav-link[data-page="generator"]').count(),
    'the retired page is back in the sidebar').toBe(0);

  await page.evaluate(() => { window.location.hash = '#generator'; });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (document.querySelector('.page.active') || {}).id))
    .toBe('page-mental-starters');

  await page.click('#tv-starter #designWeek');
  await page.waitForTimeout(400);
  await expect(page.locator('#tv-design [data-mode="steps"]'),
    'the design step opened but its controls are not there').toBeVisible();
  await expect(page.locator('#tv-design [data-count="20"]')).toBeVisible();
});

test('Mental Starters is linked, and its page carries the starter flow', async ({ page }) => {
  /* This test used to assert the opposite. buildPlan() still moves the score
     TABLE into Markbook › Starter scores, so for a while #page-mental-starters
     was an empty husk and linking to it would have opened a blank page.

     The Sep 2026 redesign gave the page the flow Teach used to own — pick a
     week, open a day, show it on the board — so the link is correct now. The
     assertion that matters is unchanged in spirit: a linked page must have
     something on it. Checking the week CHIPS, not the section, because a
     section can be "visible" while holding nothing but a leftover heading. */
  await open(page);
  await page.waitForTimeout(300);

  const link = page.locator('.nav-link[data-page="mental-starters"]');
  await expect(link, 'Mental Starters has no link in the sidebar').toHaveCount(1);
  await link.click();
  await page.waitForTimeout(400);

  await expect(page.locator('#tv-starter .wk-chip').first(),
    'the page opened but the starter flow is not on it').toBeVisible();

  /* the score table is still Markbook's, not this page's */
  expect(await page.evaluate(() => document.querySelectorAll('#page-mental-starters #msTable').length),
    'the score table came back to this page — it belongs in Markbook').toBe(0);
});

test('a chosen step reaches the saved week, not just a preview', async ({ page }) => {
  /* The point of folding the generator in. It used to write to tp_generator
     and print from there, so a teacher could choose steps all day and the
     week Mental Starters actually served was still the half-term preset.
     Generate & save has to put the chosen step on the day sheet. */
  const errors = collectErrors(page);
  await open(page);
  await page.evaluate(() => {
    localStorage.setItem('tp_starter_cfg', JSON.stringify({
      qCount: 20, mode: 'steps', xtb: false,
      slots: ['b2.13'].concat(new Array(19).fill(null))   // The 10 times-table
    }));
    window.location.hash = '#mental-starters';
  });
  await page.waitForTimeout(400);

  await page.click('#tv-starter #designWeek');
  await page.waitForTimeout(300);
  await expect(page.locator('#tv-design .ms-count'), 'the chosen slot was not carried in')
    .toContainText('1 of 20 set');

  await page.click('#tv-design #msSave');
  await page.waitForTimeout(500);

  const saved = await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('tp_starter_weeks') || '{}');
    const days = w[Object.keys(w).sort().pop()] || [];
    return days.map(d => window.genRenderQuestion(d[0]));
  });
  expect(saved.length, 'a week is five days').toBe(5);
  saved.forEach(q => expect(q, 'a day was built without the chosen step').toContain('10 ×'));

  await page.click('#tv-starter [data-day="0"]');
  await page.waitForTimeout(400);
  await expect(page.locator('#tv-day .ds-q').first(),
    'the sheet a teacher prints does not show the chosen step').toContainText('10 ×');
  expect(errors).toEqual([]);
});
