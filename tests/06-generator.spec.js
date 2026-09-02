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
    'words', 'seq', 'tensones', 'arith', 'arith', 'future', 'seq', 'placeval',
    'arith', 'arith', 'step', 'step', 'compare', 'times', 'times',
    'divide', 'divide', 'arith', 'arith', 'arith'
  ]);
  for (const qs of runs) expect(qs.map(q => q.t)).toEqual(shape);

  // No clocks — Autumn 1 has not taught them yet.
  for (const qs of runs) {
    expect(qs.some(q => q.t === 'clock'), 'Autumn 1 must not contain a clock question').toBe(false);
  }
  expect(await page.evaluate(() => window.genUsesClocks('Autumn 1'))).toBe(false);
  expect(await page.evaluate(() => window.genUsesClocks('Spring 2'))).toBe(true);
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
