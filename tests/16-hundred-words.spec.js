/* Hundred Words (#hundred-words → hundred-words.html in a frame).

   The page was written as a claude.ai artifact with its own pupil list.
   In the hub it must use the classes already registered: the active
   class's roster is its pupil list, and what it saves lands in that
   class's own tp_hundred_words key, in the hub window's storage (where
   cloud.js can see it). */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const J = v => JSON.stringify(v);
const OTHER = [{ id: 'x1', name: 'Kit Marlow' }, { id: 'x2', name: 'Nell Gwyn' }];

function twoClasses(active) {
  return {
    tp_classes: J([
      { id: 'default', name: 'Year 2', createdAt: 1 },
      { id: 'b', name: 'Year 3', createdAt: 2 }
    ]),
    tp_active_class: J(active),
    'tp_roster::b': J(OTHER)
  };
}

async function openHW(page, extra) {
  await blockExternal(page);
  await seedDevice(page, { extra });
  await page.goto('/index.html#hundred-words');
  await page.waitForFunction(() => typeof window.activeClassId === 'function', null, { timeout: 10000 });
  await expect(page.locator('#planApp .nav-link[data-page="hundred-words"]')).toBeVisible();
  const frame = page.frameLocator('#hwFrame');
  await expect(frame.locator('#nav button').first()).toBeVisible();
  return frame;
}

test('Hundred Words shows the active class from the hub and saves under that class', async ({ page }) => {
  const errors = collectErrors(page);
  const frame = await openHW(page, twoClasses('b'));

  await expect(frame.locator('#cls')).toHaveText('Year 3');
  /* Assess is Quick check only: no photo marking in the hub for now */
  await frame.locator('#nav button', { hasText: 'Assess' }).click();
  await expect(frame.locator('#main')).not.toContainText('Mark photos');
  await expect(frame.locator('#qPupil option', { hasText: 'Kit Marlow' })).toHaveCount(1);
  await frame.locator('#nav button', { hasText: 'Tracker' }).click();
  await expect(frame.locator('#main')).toContainText('Kit Marlow');
  await expect(frame.locator('#main')).toContainText('Nell Gwyn');
  await expect(frame.locator('#main')).not.toContainText('Ava Bell');   // the default class's roster

  /* a pupil added in the hub turns up without a reload */
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('tp_roster::b'));
    r.push({ id: 'x3', name: 'Tam Lin' });
    localStorage.setItem('tp_roster::b', JSON.stringify(r));
  });
  /* `storage` events only reach OTHER documents, which the frame is */
  await expect(frame.locator('#main')).toContainText('Tam Lin');

  await frame.locator('#nav button', { hasText: 'Class' }).click();
  await frame.locator('[data-c="strictCaps"]').check();
  const saved = await page.waitForFunction(() => localStorage.getItem('tp_hundred_words::b'));
  const doc = JSON.parse(await saved.jsonValue());
  expect(doc.settings.main.strictCaps).toBe(true);
  expect(doc.settings.main.className, 'the hub class name is not frozen into the doc').toBeUndefined();
  expect(doc.pupils, 'pupils belong to tp_roster, not to Hundred Words').toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem('tp_hundred_words'))).toBeNull();
  expect(errors).toEqual([]);
});

test('Hundred Words on the default class reads the un-suffixed roster', async ({ page }) => {
  const frame = await openHW(page, twoClasses('default'));
  await expect(frame.locator('#cls')).toHaveText('Year 2');
  await expect(frame.locator('#main')).toContainText('Ava Bell');
  await expect(frame.locator('#main')).not.toContainText('Kit Marlow');
});

test('Quick check saves each tap, so switching pupil and back keeps the marks', async ({ page }) => {
  const frame = await openHW(page, twoClasses('b'));
  await frame.locator('#nav button', { hasText: 'Assess' }).click();
  await frame.locator('#qPupil').selectOption('x1');
  const said = frame.locator('.qgrid button[data-i="4"]');
  await said.click();
  await expect(said).toHaveClass(/q-c/);
  await frame.locator('.qgrid button[data-i="5"]').click();
  await frame.locator('.qgrid button[data-i="5"]').click();     // twice = not yet

  await frame.locator('#qPupil').selectOption('x2');
  await expect(frame.locator('.qgrid button[data-i="4"]')).not.toHaveClass(/q-c/);
  await frame.locator('#qPupil').selectOption('x1');
  await expect(frame.locator('.qgrid button[data-i="4"]')).toHaveClass(/q-c/);
  await expect(frame.locator('.qgrid button[data-i="5"]')).toHaveClass(/q-x/);

  const doc = JSON.parse(await page.evaluate(() => localStorage.getItem('tp_hundred_words::b')));
  const ses = Object.values(doc.sessions).find(x => x.pupilId === 'x1');
  expect(ses.words['4'].s).toBe('c');
  expect(ses.words['5'].s).toBe('x');

  /* and it survives a reload */
  await page.reload();
  const again = page.frameLocator('#hwFrame');
  await again.locator('#nav button', { hasText: 'Assess' }).click();
  await again.locator('#qPupil').selectOption('x1');
  await expect(again.locator('.qgrid button[data-i="4"]')).toHaveClass(/q-c/);
});
