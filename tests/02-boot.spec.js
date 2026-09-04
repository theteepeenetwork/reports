/* The app has to open. Both surfaces, at a smartboard laptop's width and a
   tablet's, with and without a class already on the device. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(() => document.body.dataset.mode && typeof ggAward === 'function', null, { timeout: 10000 });
}

test('boots clean with no class on the device', async ({ page }) => {
  await blockExternal(page);
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await ready(page);
  expect(errors).toEqual([]);
  await expect(page.locator('#planApp .page.active')).toHaveCount(1);
});

test('boots clean with a class on the device', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await ready(page);
  expect(errors).toEqual([]);
});

test('both surfaces render, and each can reach the other', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await ready(page);

  await page.evaluate(() => window.hubSetMode('plan'));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.body.dataset.mode)).toBe('plan');
  await expect(page.locator('#openTeach')).toBeVisible();

  await page.evaluate(() => window.hubSetMode('teach'));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.body.dataset.mode)).toBe('teach');
  await expect(page.locator('#goPlan')).toBeVisible();

  expect(errors).toEqual([]);
});

test('Glow Getters is reachable from both surfaces', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  for (const mode of ['plan', 'teach']) {
    await page.evaluate(m => window.hubSetMode(m), mode);
    await page.waitForTimeout(500);
    await expect(page.locator('[data-board-open]:visible'), `no board control on the ${mode} surface`).toBeVisible();
    await page.click('[data-board-open]:visible');
    await expect(page.locator('#bdSheet [data-board="glow"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
});

test('a bookmarked #battler still resolves after the rename', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html#battler');
  await ready(page);
  await page.evaluate(() => { location.hash = 'battler'; });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (document.querySelector('.page.active') || {}).id)).toBe('page-glow');
});

/* Cache-busting.

   server.js serves everything but HTML with `public, max-age=31536000`, so a
   script tag without a ?v= is cached for a year. That is not theoretical: on
   4 Sep 2026 a change to js/hub.js deployed correctly and did not reach the
   browser, because js/hub.js had no version and the year-old copy won. The
   file was right on the server and wrong in every returning teacher's browser.

   Anything served from this origin and cached that hard has to carry a
   version, or editing it does nothing for the people already using the app. */
test('every local script and stylesheet is cache-busted', async ({ page }) => {
  await blockExternal(page);
  await page.goto('/index.html');

  const unversioned = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(el => {
      const url = el.getAttribute('src') || el.getAttribute('href');
      if (!url || /^https?:/i.test(url)) return;   // CDNs are versioned in the path
      if (!/\?v=/.test(url)) out.push(url);
    });
    return out;
  });

  expect(unversioned, 'these would be served from a stale cache after an edit').toEqual([]);
});
