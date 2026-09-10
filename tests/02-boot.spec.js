/* The app has to open, with and without a class already on the device.

   There used to be two surfaces here (Teach and Plan) and this file checked
   both. The Sep 2026 navigation redesign removed Teach: one sidebar, and Glow
   Getters is a window you put on the board rather than a mode you enter. What
   is still worth guarding is that the sidebar is BUILT — js/hub.js is the only
   source of it now, so if it fails there is no navigation at all. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

async function ready(page) {
  await page.waitForFunction(
    () => document.querySelector('#planApp .nav-link') && typeof ggAward === 'function',
    null, { timeout: 10000 });
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

test('the sidebar is built, and every row it offers has somewhere to go', async ({ page }) => {
  /* PLAN_NAV is now the single source of both the sidebar and the hash
     whitelist. A row whose page does not exist is exactly the failure this
     redesign was fixing (the Question Generator and Name Picker rendered
     fully but had no way in), so check the rows against the DOM rather than
     against a list copied out of the source. */
  await blockExternal(page);
  await seedDevice(page);
  const errors = collectErrors(page);
  await page.goto('/index.html');
  await ready(page);

  await expect(page.locator('#quickLogBtn'), 'Quick log is the sidebar action').toBeVisible();

  const orphans = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('#planApp .nav-link')];
    const bad = [];
    for (const b of rows) {
      if (b.dataset.external) continue;          // opens its own window, not a page
      location.hash = b.dataset.page;
      await new Promise(r => setTimeout(r, 120));
      const active = (document.querySelector('.page.active') || {}).id;
      if (active !== 'page-' + b.dataset.page) bad.push(b.dataset.page + ' → ' + active);
    }
    return bad;
  });
  expect(orphans, 'a sidebar row that does not open its own page').toEqual([]);
  expect(errors).toEqual([]);
});

test('Glow Getters opens its own window from the sidebar and the board control', async ({ page }) => {
  await blockExternal(page);
  await seedDevice(page);
  await page.goto('/index.html');
  await ready(page);

  /* The sidebar row is marked external: it must open glow-getters.html and
     leave the current page where it is, not route to #glow. */
  const opened = await page.evaluate(() => {
    const before = location.hash;
    let url = null;
    const real = window.open;
    window.open = u => { url = u; return { closed: false }; };
    document.querySelector('.nav-link[data-external]').click();
    window.open = real;
    return { url, moved: location.hash !== before };
  });
  expect(opened.url).toBe('glow-getters.html');
  expect(opened.moved, 'the external row navigated instead of opening a window').toBe(false);

  /* And the board control still offers it, alongside the starter sheet. */
  await expect(page.locator('[data-board-open]:visible')).toBeVisible();
  await page.click('[data-board-open]:visible');
  await expect(page.locator('#bdSheet [data-board="glow"]')).toBeVisible();
  await expect(page.locator('#bdSheet [data-board="starter"]')).toBeVisible();
  await page.keyboard.press('Escape');
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
