/* Mental starter question sets.

   The generator used to have one hardcoded recipe. It now has a named set per
   half-term, so the things worth guarding are: the right set comes out for the
   right half-term, both sets produce 20 renderable questions, the Autumn 1
   maths stays inside the range Year 2 has actually been taught in September,
   and worksheets saved before the change still print. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => typeof window.genBuild === 'function', null, { timeout: 10000 });
}

async function open(page) {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);
}

// Build the same set many times so range assertions see the tails, not one lucky roll.
async function sample(page, halfTerm, runs) {
  return page.evaluate(([ht, n]) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(window.genBuild(ht, 'worksheet', 20));
    return out;
  }, [halfTerm, runs]);
}

test('each half-term resolves to a question set, and only Autumn 1 differs', async ({ page }) => {
  await open(page);
  const map = await page.evaluate(() =>
    ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2']
      .reduce((acc, h) => (acc[h] = window.genSetName(h), acc), {}));

  expect(map['Autumn 1'], 'Autumn 1 must use its own set').toBe('Autumn 1');
  for (const h of ['Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2']) {
    expect(map[h], `${h} should still fall back to the original set`).toBe('Spring 2');
  }
});

test('both sets build 20 questions that all render to something', async ({ page }) => {
  await open(page);
  for (const ht of ['Autumn 1', 'Spring 2']) {
    const runs = await sample(page, ht, 30);
    for (const qs of runs) {
      expect(qs, `${ht} should be 20 questions`).toHaveLength(20);
      const html = await page.evaluate(list => list.map(q => window.genRenderQuestion(q)), qs);
      html.forEach((h, i) => {
        expect(h, `${ht} q${i + 1} rendered empty`).toBeTruthy();
        // an unknown descriptor falls through to JSON — that is the bug this catches
        expect(h, `${ht} q${i + 1} has no renderer`).not.toContain('"t":');
      });
    }
  }
});

test('Autumn 1 asks what the September sheet asks', async ({ page }) => {
  await open(page);
  const runs = await sample(page, 'Autumn 1', 40);

  // The shape of the sheet: same question types in the same slots every time.
  const shape = runs[0].map(q => q.t);
  expect(shape).toEqual([
    // 1-10: arithmetic only, two of them sequences
    'arith', 'seq', 'arith', 'arith', 'step', 'seq', 'arith', 'arith', 'step', 'arith',
    // 11-17: the named slots, in Mark's order
    'placeval', 'partition', 'words', 'times', 'tensones', 'future', 'compare',
    // 18-20: add or take away within 100
    'arith', 'arith', 'arith'
  ]);
  for (const qs of runs) expect(qs.map(q => q.t)).toEqual(shape);

  // No clocks — Autumn 1 has not taught them yet.
  for (const qs of runs) {
    expect(qs.some(q => q.t === 'clock'), 'Autumn 1 must not contain a clock question').toBe(false);
  }
  expect(await page.evaluate(() => window.genUsesClocks('Autumn 1'))).toBe(false);
  expect(await page.evaluate(() => window.genUsesClocks('Spring 2'))).toBe(true);

  // Question 7 adds a multiple of ten. Capping the first ten at fifty makes it
  // easy to leave no room and roll "+ 0", which is not a question.
  for (const qs of runs) {
    const m = qs[6].b;
    expect(m % 10, `q7 adds ${m}, which is not a multiple of ten`).toBe(0);
    expect(m, 'q7 rolled "+ 0" - there was no room left below fifty').toBeGreaterThanOrEqual(10);
  }

  // Days of the week reach a full week, not five days.
  for (const qs of runs) {
    expect(qs[15].n, 'q16 should ask up to a week ahead').toBeLessThanOrEqual(7);
    expect(qs[15].n).toBeGreaterThanOrEqual(1);
  }
});

test('Autumn 1 never asks for maths beyond what has been taught', async ({ page }) => {
  await open(page);
  const runs = await sample(page, 'Autumn 1', 120);
  const tables = [2, 5, 10];

  for (const qs of runs) {
    qs.forEach((q, i) => {
      const where = `q${i + 1} (${q.t})`;

      if (q.t === 'arith') {
        expect(q.a, `${where} negative operand`).toBeGreaterThanOrEqual(0);
        expect(q.b, `${where} negative operand`).toBeGreaterThanOrEqual(0);
        const answer = q.op === '+' ? q.a + q.b : q.a - q.b;
        // Year 2 autumn works within 100 and does not go below zero.
        expect(answer, `${where} answer ${answer} is negative`).toBeGreaterThanOrEqual(0);
        expect(answer, `${where} answer ${answer} goes past 100`).toBeLessThanOrEqual(100);
      }

      if (q.t === 'times' || q.t === 'divide') {
        expect(tables, `${where} uses the ${q.base} times table`).toContain(q.base);
        expect(q.by).toBeGreaterThanOrEqual(1);
        expect(q.by).toBeLessThanOrEqual(12);
      }

      if (q.t === 'compare') {
        expect(tables).toContain(q.b);
        expect(tables).toContain(q.d);
      }

      if (q.t === 'seq') {
        // the blank must be a real term in the sequence, and stay positive
        expect(q.blank).toBeGreaterThanOrEqual(0);
        expect(q.blank).toBeLessThan(q.len);
        const last = q.start + q.step * (q.len - 1);
        expect(last, `${where} counts below zero`).toBeGreaterThanOrEqual(0);
      }

      if (q.t === 'tensones') {
        // both digits must be worth asking about
        expect(q.n).toBeGreaterThanOrEqual(10);
        expect(q.n).toBeLessThanOrEqual(99);
      }

      if (q.t === 'words') {
        expect(q.n).toBeGreaterThanOrEqual(0);
        expect(q.n, 'September word-writing should stay small').toBeLessThanOrEqual(30);
      }
    });
  }
});

/* Questions 1-10 are arithmetic only, and every number a child reads or writes
   there -- including every answer -- is under fifty. Only the three arithmetic
   types are readable here; returning null for anything else is what makes this
   a guard rather than a formality. Put a word problem, a clock or a times table
   in the first ten and the test fails, instead of quietly passing because
   nothing knew how to read it. */
function numbersIn(q) {
  switch (q.t) {
    case 'seq':   return Array.from({ length: q.len }, (_, i) => q.start + q.step * i);
    case 'arith': return [q.a, q.b, q.op === '+' ? q.a + q.b : q.a - q.b];
    case 'step':  return [q.n, q.by, q.dir === 'less' ? q.n - q.by : q.n + q.by];
    default:      return null;
  }
}

test('the first ten Autumn 1 questions are arithmetic, and stay under fifty', async ({ page }) => {
  await open(page);
  const runs = await sample(page, 'Autumn 1', 120);

  for (const qs of runs) {
    qs.slice(0, 10).forEach((q, i) => {
      const where = `q${i + 1} (${q.t})`;
      const nums = numbersIn(q);
      expect(nums, `${where} is not arithmetic - questions 1-10 must be`).not.toBeNull();
      for (const n of nums) {
        expect(n, `${where} uses ${n}, which is not under fifty`).toBeLessThan(50);
        expect(n, `${where} uses ${n}, which is negative`).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

/* A question with a zero in it is a wasted line on the sheet. "35 - 0" and
   "0 + 30" are arithmetic and inside every range, so the range guards above
   pass them happily; this is the one that does not. */
test('no Autumn 1 question is a freebie', async ({ page }) => {
  await open(page);
  const runs = await sample(page, 'Autumn 1', 120);

  for (const qs of runs) {
    qs.forEach((q, i) => {
      const where = `q${i + 1} (${q.t})`;

      if (q.t === 'arith') {
        const answer = q.op === '+' ? q.a + q.b : q.a - q.b;
        expect(q.a, `${where} is "${q.a} ${q.op} ${q.b}"`).toBeGreaterThanOrEqual(1);
        expect(q.b, `${where} is "${q.a} ${q.op} ${q.b}"`).toBeGreaterThanOrEqual(1);
        expect(answer, `${where} answers zero`).toBeGreaterThanOrEqual(1);
      }

      // Partitioning 80 into 80 + 0 is not partitioning.
      if (q.t === 'partition') {
        expect(q.n % 10, `${where} asks to partition ${q.n}, which has no ones`).toBeGreaterThanOrEqual(1);
        expect(Math.floor(q.n / 10), `${where} asks to partition ${q.n}, which has no tens`).toBeGreaterThanOrEqual(1);
      }

      // "How many ones in 20?" has no answer. Both digits must be real.
      if (q.t === 'tensones') {
        expect(q.n % 10, `${where} asks about ${q.n}, which has no ones`).toBeGreaterThanOrEqual(1);
        expect(Math.floor(q.n / 10), `${where} asks about ${q.n}, which has no tens`).toBeGreaterThanOrEqual(1);
      }
    });

    // 18-20 must be able to take away properly, not just shave a digit off.
    // Across 120 sheets some subtraction has to reach double figures; if the
    // second number is always capped by what is left below 100, none does.
    const tail = qs.slice(17);
    expect(tail.every(q => q.t === 'arith')).toBe(true);
  }

  const subs = runs.flatMap(qs => qs.slice(17)).filter(q => q.op === '-');
  expect(subs.length, 'no subtractions in 120 sheets of q18-20').toBeGreaterThan(0);
  expect(Math.max(...subs.map(q => q.b)), 'every q18-20 subtraction takes away a tiny amount')
    .toBeGreaterThan(20);
});

test('the blank in a sequence is a blank, not the answer', async ({ page }) => {
  await open(page);
  const html = await page.evaluate(() =>
    window.genRenderQuestion({ t: 'seq', start: 20, step: -2, len: 4, blank: 2 }));
  expect(html).toContain('gen-blank');
  expect(html).toContain('20');
  expect(html).toContain('18');
  expect(html).toContain('14');
  expect(html, 'the blanked term must not be printed').not.toContain('16');
});

test('worksheets saved before question sets existed still print', async ({ page }) => {
  await open(page);
  // A 'compare' descriptor from the old code had no bop; it always meant '+'.
  const legacy = await page.evaluate(() =>
    window.genRenderQuestion({ t: 'compare', a: 30, aop: '-', b: 4, c: 12, d: 9 }));
  expect(legacy).toContain('30 - 4');
  expect(legacy, 'a legacy compare must still read as addition on the right').toContain('12 + 9');
});

test('picking a half-term changes the questions on the page', async ({ page }) => {
  await open(page);
  const errors = collectErrors(page);
  await page.evaluate(() => window.hubSetMode('plan'));
  await page.evaluate(() => { window.location.hash = '#generator'; });
  await page.waitForTimeout(400);

  await page.evaluate(() => { window.genSetHalfTerm('Autumn 1'); window.genGenerate(); });
  await page.waitForTimeout(300);
  await expect(page.locator('#gen-root')).toContainText('Autumn 1');
  await expect(page.locator('#gen-root'), 'the clock hint should be gone for Autumn 1')
    .toContainText('no clock question in this set');
  expect(await page.locator('#gen-root .gen-clock').count(), 'Autumn 1 drew a clock').toBe(0);

  await page.evaluate(() => { window.genSetHalfTerm('Spring 2'); window.genGenerate(); });
  await page.waitForTimeout(300);
  expect(await page.locator('#gen-root .gen-clock').count(), 'Spring 2 lost its clocks').toBeGreaterThan(0);

  expect(errors).toEqual([]);
});
