/* A Note in a pupil's behaviour log can be flagged for follow-up with an
   optional by-date. Outstanding follow-ups sit in their own card on Class at
   a glance, go red once the date has passed, and leave the card when ticked
   as actioned. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

function iso(offsetDays) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#planApp .nav-link'), null, { timeout: 10000 });
}

test('a note can be logged with a follow-up and a by-date', async ({ page }) => {
  const errors = collectErrors(page);
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html#pupils');
  await ready(page);

  await page.locator('#pupils-root .pupil-card', { hasText: 'Ava Bell' }).click();
  await page.locator('#pupil-root [data-rec="log"]').first().click();
  await page.locator('[data-sheettype="note"]').click();
  await expect(page.locator('#recFollowUpBy')).toHaveCount(0);
  await page.locator('#recNote').fill('Check reading book is home');
  await page.locator('#recFollowUp').check();
  await page.locator('#recFollowUpBy').fill(iso(3));
  await page.locator('[data-rec="sheetSave"]').click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_behaviour')).find(e => e.type === 'note'));
  expect(saved).toMatchObject({ pupilId: 'p1', note: 'Check reading book is home', followUp: true, followUpBy: iso(3), actioned: false });
  await expect(page.locator('#pupil-root [data-recfu]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Class at a glance lists outstanding follow-ups, red when overdue, gone when actioned', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page, { extra: { tp_behaviour: [
    { id: 'n1', date: iso(-5), pupilId: 'p1', type: 'note', note: 'Overdue one', followUp: true, followUpBy: iso(-1), actioned: false },
    { id: 'n2', date: iso(-2), pupilId: 'p2', type: 'note', note: 'Due later', followUp: true, followUpBy: iso(4), actioned: false },
    { id: 'n3', date: iso(-2), pupilId: 'p3', type: 'note', note: 'No date', followUp: true, followUpBy: '', actioned: false },
    { id: 'n4', date: iso(-2), pupilId: 'p4', type: 'note', note: 'Done already', followUp: true, followUpBy: iso(-3), actioned: true },
    { id: 'n5', date: iso(-2), pupilId: 'p5', type: 'note', note: 'Plain note' }
  ] } });
  await page.goto('/index.html#pupils');
  await ready(page);

  const card = page.locator('.gl-card', { has: page.locator('.gl-title', { hasText: 'Follow-up' }) });
  await expect(card.locator('.gl-fu')).toHaveCount(3);
  await expect(card.locator('.gl-badge')).toHaveText('3');
  await expect(card.locator('.gl-fu.overdue')).toHaveCount(1);
  await expect(card.locator('.gl-fu.overdue')).toContainText('Overdue one');
  const red = await card.locator('.gl-fu.overdue .fu-txt').evaluate(el => getComputedStyle(el).color);
  const plain = await card.locator('.gl-fu:not(.overdue) .fu-txt').first().evaluate(el => getComputedStyle(el).color);
  expect(red).not.toBe(plain);

  await card.locator('[data-glfu="n1"]').click();
  await expect(card.locator('.gl-fu')).toHaveCount(2);
  await expect(card.locator('.gl-fu.overdue')).toHaveCount(0);
  const n1 = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_behaviour')).find(e => e.id === 'n1'));
  expect(n1.actioned).toBe(true);
});
