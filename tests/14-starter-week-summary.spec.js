/* Mental starters — the week view's way in to score entry, its summary of
   who moved, and the score screen's previous three weeks.

   The week view used to be five rows and a design button; scores could only
   be reached by opening a day's sheet first. These hold the redesign's
   promises: every day has its own "Scores" button, the summary compares
   with the week before, and score entry shows each child's last three weeks
   beside a plain number box that the laptop or iPad keyboard types into. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const PUPILS = [{ id: 'p1', name: 'Ava Bell' }, { id: 'p2', name: 'Ben Cross' }, { id: 'p3', name: 'Cara Dunn' }];

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

const MON = mondayOf();
/* per pupil, one score per weekday for each of the three weeks before this
   one, then Monday and Tuesday of this week */
const HISTORY = {
  p1: { w3: [10, 10, 10, 10, 10], w2: [11, 11, 11, 11, 11], w1: [10, 10, 10, 10, 10], now: [15, 15] },   // up 5
  p2: { w3: [16, 16, 16, 16, 16], w2: [16, 16, 16, 16, 16], w1: [16, 16, 16, 16, 16], now: [16, 16] },   // steady
  p3: { w3: [18, 18, 18, 18, 18], w2: [18, 18, 18, 18, 18], w1: [18, 18, 18, 18, 18], now: [14, 14] }    // down 4
};
function starters() {
  const block = { max: 20, dates: [], scores: {} };
  Object.keys(HISTORY).forEach(pid => {
    block.scores[pid] = {};
    const h = HISTORY[pid];
    [['w3', -21], ['w2', -14], ['w1', -7], ['now', 0]].forEach(([k, off]) => {
      h[k].forEach((v, i) => {
        const d = addDays(MON, off + i);
        block.scores[pid][d] = { v, ipad: v >= 18 && i === 0 };
        if (block.dates.indexOf(d) < 0) block.dates.push(d);
      });
    });
  });
  block.dates.sort();
  return JSON.stringify({ 'Autumn 1': block });
}

async function open(page) {
  await blockExternal(page);
  await seedDevice(page, { roster: PUPILS, extra: { tp_starters: starters() } });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => document.querySelector('#planApp .nav-link') && typeof window.hubOpenStarter === 'function',
    null, { timeout: 10000 });
  await page.evaluate(() => { window.location.hash = '#mental-starters'; });
  await page.waitForTimeout(500);
}

test('the week summary compares with last week and names who moved', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  const sum = page.locator('#tv-starter .stw-summary');
  await expect(sum).toBeVisible();
  await expect(sum.locator('.stw-count.up')).toHaveText('▲ 1 up');
  await expect(sum.locator('.stw-count.down')).toHaveText('▼ 1 down');
  await expect(sum.locator('.stw-panel.rise')).toContainText('Ava Bell');
  await expect(sum.locator('.stw-panel.rise')).toContainText('+5.0');
  await expect(sum.locator('.stw-panel.drop')).toContainText('Cara Dunn');
  await expect(sum.locator('.stw-panel.drop')).toContainText('−4.0');
  await expect(sum.locator('.stw-panel.rise'), 'a steady pupil is not a rise').not.toContainText('Ben Cross');
  expect(errors).toEqual([]);
});

test('every day card has its own way in to score entry', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await expect(page.locator('#tv-starter .stw-card [data-sday]')).toHaveCount(5);
  await expect(page.locator('#tv-starter #enterScores')).toBeVisible();
  await page.click('#tv-starter .stw-card [data-sday="1"]');
  await expect(page.locator('#tv-scores')).toHaveClass(/active/);
  await expect(page.locator('#tv-scores .stc-tab.on')).toContainText('Tue');
  // the back link returns to the week, not to a day sheet never opened
  await page.click('#tv-scores [data-back="starter"]');
  await expect(page.locator('#tv-starter')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('score entry shows each child\'s previous three weeks', async ({ page }) => {
  await open(page);
  await page.click('#tv-starter .stw-card [data-sday="2"]');
  const head = page.locator('#tv-scores .stc-headrow');
  await expect(head).toContainText(new Date(addDays(MON, -21) + 'T12:00').getDate() + ' ');
  const ava = page.locator('#tv-scores .stc-row[data-row="0"]');
  await expect(ava.locator('.stc-week')).toHaveCount(3);
  await expect(ava.locator('.stc-week b')).toHaveText(['10.0', '11.0', '10.0']);
  await expect(ava.locator('.stc-week').first().locator('.stc-bars i')).toHaveCount(5);
});

test('typing a score saves it, flags a dip, and Enter moves down the register', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.click('#tv-starter .stw-card [data-sday="2"]');
  const wed = addDays(MON, 2);

  // Cara's usual is 18: 9 is well below it
  const cara = page.locator('#stc-in-2');
  await page.locator('#stc-in-1').fill('16');
  await page.locator('#stc-in-1').press('Enter');
  await expect(cara).toBeFocused();
  await cara.fill('9');
  await expect(page.locator('#stc-flag-p3')).toContainText('▼ 9 below usual');
  await expect(page.locator('#stcCount')).toHaveText('2 of 3 scored');

  const saved = await page.evaluate(d => {
    const s = JSON.parse(localStorage.getItem('tp_starters'));
    const out = {};
    Object.values(s).forEach(b => ['p2', 'p3'].forEach(p => { if (b.scores[p] && b.scores[p][d]) out[p] = b.scores[p][d].v; }));
    return out;
  }, wed);
  expect(saved).toEqual({ p2: 16, p3: 9 });

  // a number past the paper's length is not kept whole
  await cara.fill('25');
  await expect(cara).toHaveValue('5');
  expect(errors).toEqual([]);
});

test('the iPad toggle sticks without re-rendering the row', async ({ page }) => {
  await open(page);
  await page.click('#tv-starter .stw-card [data-sday="2"]');
  const btn = page.locator('#tv-scores .stc-ipad[data-pid="p1"]');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stc-in-0')).toHaveClass(/is-ipad/);
  const on = await page.evaluate(d => Object.values(JSON.parse(localStorage.getItem('tp_starters')))
    .some(b => b.scores.p1 && b.scores.p1[d] && b.scores.p1[d].ipad), addDays(MON, 2));
  expect(on).toBe(true);
});
