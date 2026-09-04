/* Class management.

   Mark lost sight of a whole class in production on 2 Sep 2026. He deleted a
   class he no longer needed; the app fell back to an empty `default` instead
   of the class he still had, the switcher had no way back, and 36KB of roster
   and starter weeks sat unreachable under `tp_roster::cmqa2mbh65v1`. The data
   was never gone — nothing could see it.

   These tests are the shape of that failure. Each one fails against the code
   as it was before the fix; see the commit message for the verification. */
const { test, expect } = require('@playwright/test');
const { blockExternal, seedDevice, collectErrors } = require('./fixtures');

const OTHER = [
  { id: 'x1', name: 'Kit Marlow' },
  { id: 'x2', name: 'Nell Gwyn' }
];

async function ready(page) {
  await page.waitForFunction(() => typeof window.activeClassId === 'function', null, { timeout: 10000 });
}

/* Boot with a registry and per-class keys already in place. `extra` is written
   raw, so a test can build the exact broken state it wants to assert on. */
async function open(page, extra = {}) {
  await blockExternal(page);
  await seedDevice(page, { extra });
  await page.goto('/index.html');
  await ready(page);
}

const J = v => JSON.stringify(v);

/* Two registered classes: 'default' (empty) and 'b' (a roster of its own).
   The device is sitting in 'b'. */
function twoClasses() {
  return {
    tp_classes: J([
      { id: 'default', name: 'Year 2', room: 'Class 6', createdAt: 1 },
      { id: 'b', name: 'Year 3', room: 'Class 7', createdAt: 2 }
    ]),
    tp_active_class: J('b'),
    'tp_roster::b': J(OTHER)
  };
}

test('deleting the class you are in leaves you on a survivor, not an empty default', async ({ page }) => {
  // Three classes, sitting in 'c'. Deleting 'c' must not strand us on
  // 'default', which holds nothing — it must land on a class with data.
  await open(page, {
    tp_classes: J([
      { id: 'default', name: 'Year 2', createdAt: 1 },
      { id: 'b', name: 'Year 3', createdAt: 2 },
      { id: 'c', name: 'Year 4', createdAt: 3 }
    ]),
    tp_active_class: J('c'),
    tp_roster: J([]),                       // 'default' holds nothing
    'tp_roster::b': J(OTHER),
    'tp_roster::c': J([{ id: 'z1', name: 'Doomed Pupil' }])
  });

  const after = await page.evaluate(() => {
    deleteClass('c');
    return { active: activeClassId(), ids: getClasses().map(c => c.id) };
  });

  expect(after.ids, 'the deleted class should be out of the registry').toEqual(['default', 'b']);
  expect(after.active, 'deleting the active class dropped us on an empty default').not.toBe('default');
  expect(after.active).toBe('b');

  // and the survivor's pupils are actually reachable from where we landed
  const names = await page.evaluate(() => Store.get('tp_roster', []).map(p => p.name));
  expect(names).toEqual(['Kit Marlow', 'Nell Gwyn']);
});

test('deleting a class you are NOT in leaves you where you were', async ({ page }) => {
  await open(page, twoClasses());
  const active = await page.evaluate(() => { deleteClass('default'); return activeClassId(); });
  // 'default' is undeletable by design, so this is really asserting we did not
  // move the pointer as a side effect of trying.
  expect(active).toBe('b');
});

test('a class whose registry entry is missing is recovered, not stranded', async ({ page }) => {
  /* Exactly Mark's state: data under '::lost', no registry row for it, no
     active pointer at all — so activeClassId() falls back to 'default'. */
  await open(page, {
    tp_classes: J([{ id: 'default', name: 'Year 2', room: 'Class 6', createdAt: 1 }]),
    tp_roster: J([]),                       // 'default' is an empty shell, as Mark's was
    'tp_roster::lost': J(OTHER),
    'tp_starter_weeks::lost': J({ w1: 'some work' })
  });

  const state = await page.evaluate(() => ({
    ids: getClasses().map(c => c.id),
    active: activeClassId(),
    roster: Store.get('tp_roster', []).map(p => p.name)
  }));

  expect(state.ids, 'the orphaned class was never put back in the registry').toContain('lost');
  // The active class held nothing and exactly one orphan had pupils, so the
  // app should have moved us there rather than showing an empty room.
  expect(state.active, 'we were left in an empty class with data sitting next door').toBe('lost');
  expect(state.roster).toEqual(['Kit Marlow', 'Nell Gwyn']);
});

test('recovery puts an orphan back in reach without hijacking a class that has pupils', async ({ page }) => {
  // Active class has its own roster, so recovery must register the orphan but
  // leave the teacher exactly where they were.
  await open(page, {
    tp_classes: J([{ id: 'default', name: 'Year 2', createdAt: 1 }]),
    tp_roster: J([{ id: 'd1', name: 'Present Pupil' }]),
    'tp_roster::lost': J(OTHER)
  });

  const state = await page.evaluate(() => ({
    ids: getClasses().map(c => c.id),
    active: activeClassId(),
    roster: Store.get('tp_roster', []).map(p => p.name)
  }));

  expect(state.ids, 'the orphan should be reachable from the switcher').toContain('lost');
  expect(state.active, 'recovery moved a teacher who had not lost anything').toBe('default');
  expect(state.roster).toEqual(['Present Pupil']);
});

test('recovery does not fire when nothing is orphaned', async ({ page }) => {
  await open(page, twoClasses());
  const state = await page.evaluate(() => ({
    ids: getClasses().map(c => c.id),
    active: activeClassId()
  }));
  expect(state.ids).toEqual(['default', 'b']);
  expect(state.active).toBe('b');
});

test('a backup taken in one class restores you to that class', async ({ page }) => {
  /* The recovery path reproduced the bug: tp_active_class is not a DATA_KEY,
     so an export omitted it and an import always landed on 'default'. */
  await open(page, twoClasses());

  const dump = await page.evaluate(() => window.buildBackup());
  expect(dump._meta.activeClass, 'the export does not record which class it was taken in').toBe('b');

  // Wipe the pointer, as a restore onto a fresh device would leave it.
  await page.evaluate(() => localStorage.removeItem('tp_active_class'));
  const restored = await page.evaluate(d => { window.applyBackup(d); return activeClassId(); }, dump);
  expect(restored, 'restoring a backup dropped us on default').toBe('b');
});

test('a backup naming a class that is not in it does not move you', async ({ page }) => {
  await open(page, twoClasses());
  const restored = await page.evaluate(() => {
    window.applyBackup({ _meta: { activeClass: 'nosuchclass' }, tp_roster: [] });
    return activeClassId();
  });
  expect(restored, 'a stale backup pointer should be ignored, not followed').toBe('b');
});

test('the switcher never labels a class Active when no class is really active', async ({ page }) => {
  /* activeClassId() answers 'default' when the pointer is absent, so the row
     for 'default' used to wear an "Active" pill and offer no way out. */
  await open(page, {
    tp_classes: J([{ id: 'default', name: 'Year 2', createdAt: 1 }]),
    tp_roster: J([{ id: 'd1', name: 'Present Pupil' }])
  });

  await page.evaluate(() => { localStorage.removeItem('tp_active_class'); window.openClassSwitcher(); });
  const panel = page.locator('#tpClassSwitch');
  await expect(panel).toBeVisible();
  expect(await panel.locator('.tpcs-use').count(), 'no row offered a way to switch').toBeGreaterThan(0);
  await expect(panel, 'a class was marked Active while no class was active').not.toContainText('Active');
});

test('every control in the switcher is actually readable', async ({ page }) => {
  /* app.css sets `button { color: #fff }` for the solid teal default, so any
     button that overrides `background` to white and forgets `color` renders
     white-on-white. That is what happened to "Use ▸": present in the DOM, the
     right size, wired to the right handler, and invisible. It is the real
     reason a teacher cannot switch class. */
  await open(page, twoClasses());
  await page.evaluate(() => window.openClassSwitcher());
  await expect(page.locator('#tpClassSwitch')).toBeVisible();

  const invisible = await page.evaluate(() =>
    [...document.querySelectorAll('#tpClassSwitch button')]
      .map(b => { const c = getComputedStyle(b); return { text: b.textContent.trim(), color: c.color, bg: c.backgroundColor }; })
      .filter(b => b.color === b.bg));

  expect(invisible, 'a control is the same colour as what it sits on').toEqual([]);
});

test('the switcher can be reached without knowing the logo is a button', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, twoClasses());
  await page.evaluate(() => window.hubSetMode('plan'));
  await page.waitForTimeout(300);

  const opener = page.locator('#tpClassOpen');
  await expect(opener, 'no labelled control opens the class switcher').toBeVisible();
  await opener.click();
  await expect(page.locator('#tpClassSwitch')).toBeVisible();
  expect(errors).toEqual([]);
});
