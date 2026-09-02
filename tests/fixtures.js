/* =====================================================================
   Test fixtures for Classroom Hub.

   The repo ships a REAL firebase-config.js pointing at a live project, so
   the single most important thing these helpers do is make sure a test run
   can never reach it:

     1. blockFirebase()   aborts every request to the Firebase SDK at the
                          network layer, so the real SDK never loads even in
                          CI, where the runner does have internet.
     2. fakeFirebase()    installs a stand-in `window.firebase` before any
                          page script runs, and records every write.

   Together these let us assert on what the app WOULD have sent to a
   teacher's account without ever sending it.
   ===================================================================== */

const DATA_KEYS = [
  'tp_roster', 'tp_starters', 'tp_star', 'tp_behaviour', 'tp_assess', 'tp_marking',
  'tp_timetable', 'tp_seating', 'tp_groups', 'tp_generator', 'tp_profile', 'tp_battler',
  'tp_report_sel', 'reportBuilderChildren', 'tp_picker', 'tp_starter_cfg',
  'tp_starter_weeks', 'tp_starter_cleared', 'tp_classes'
];

const ROSTER = [
  { id: 'p1', name: 'Ava Bell' },
  { id: 'p2', name: 'Ben Cross' },
  { id: 'p3', name: 'Cleo Dunn' },
  { id: 'p4', name: 'Dev Patel' },
  { id: 'p5', name: 'Esme Hart' },
  { id: 'p6', name: 'Finn Ozer' }
];

/**
 * Make the page hermetic: abort every request that is not the local test
 * server. Two reasons, both important.
 *
 *   1. firebase-config.js points at a REAL project. Without this, a CI run —
 *      which does have internet — would load the live SDK and could reach a
 *      teacher's account. The fake in fakeFirebase() only works if the real
 *      SDK never arrives to overwrite it.
 *   2. Speed. Letting the Google fonts and SDK requests time out on their own
 *      added minutes to a run for no signal whatsoever.
 *
 * Call before page.goto.
 */
async function blockExternal(page) {
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:') || url.startsWith('data:')) {
      return route.continue();
    }
    return route.abort();
  });
}

/**
 * Install a recording stand-in for the Firebase SDK.
 * Exposes on the page:
 *   window.__fb.signIn({uid, email})  – drive the auth callback
 *   window.__fb.signOut()
 *   window.__fb.writes               – every ref().set/update/remove, in order
 *   window.__fb.remote               – the fake account contents
 */
async function fakeFirebase(page, { remote = {} } = {}) {
  await page.addInitScript(({ remote }) => {
    const writes = [];
    let authCb = null;
    const store = JSON.parse(JSON.stringify(remote));

    const pathOf = p => String(p).replace(/^\/+|\/+$/g, '');
    const keyOf = p => pathOf(p).split('/').pop();

    function makeRef(path) {
      return {
        path,
        set(val) { writes.push({ op: 'set', path: pathOf(path), key: keyOf(path), val }); store[keyOf(path)] = val; return Promise.resolve(); },
        update(val) { writes.push({ op: 'update', path: pathOf(path), key: keyOf(path), val }); return Promise.resolve(); },
        remove() { writes.push({ op: 'remove', path: pathOf(path), key: keyOf(path) }); delete store[keyOf(path)]; return Promise.resolve(); },
        child(sub) { return makeRef(pathOf(path) + '/' + sub); },
        on() {}, off() {},
        once() {
          const isKeysRoot = /\/keys$/.test(pathOf(path));
          const val = isKeysRoot ? (Object.keys(store).length ? store : null) : (store[keyOf(path)] || null);
          return Promise.resolve({ val: () => val, key: keyOf(path) });
        }
      };
    }

    window.firebase = {
      apps: [{}],
      initializeApp() { return {}; },
      auth: Object.assign(function () {
        return {
          setPersistence() { return Promise.resolve(); },
          onAuthStateChanged(cb) { authCb = cb; setTimeout(() => cb(null), 0); },
          signOut() { setTimeout(() => authCb && authCb(null), 0); return Promise.resolve(); },
          signInWithEmailAndPassword() { return Promise.resolve(); },
          createUserWithEmailAndPassword() { return Promise.resolve(); }
        };
      }, { Auth: { Persistence: { LOCAL: 'local' } } }),
      database() { return { ref: makeRef }; }
    };

    window.__fb = {
      writes,
      remote: store,
      signIn(user) { if (authCb) authCb({ uid: user.uid, email: user.email || (user.uid + '@example.school') }); },
      signOut() { if (authCb) authCb(null); },
      clearWrites() { writes.length = 0; }
    };
  }, { remote });
}

/** Seed this "device" with a class before the app boots. */
async function seedDevice(page, { roster = ROSTER, owner = null, extra = {} } = {}) {
  await page.addInitScript(({ roster, owner, extra }) => {
    localStorage.setItem('tp_roster', JSON.stringify(roster));
    if (owner) { localStorage.setItem('tp_owner_uid', owner); localStorage.setItem('tp_owner_email', owner + '@example.school'); }
    Object.keys(extra).forEach(k => localStorage.setItem(k, typeof extra[k] === 'string' ? extra[k] : JSON.stringify(extra[k])));
  }, { roster, owner, extra });
}

/** Console/page errors, ignoring the noise of a deliberately blocked SDK. */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/net::|ERR_|Failed to load resource|firebase/i.test(t)) errors.push('console: ' + t);
  });
  return errors;
}

module.exports = { DATA_KEYS, ROSTER, blockExternal, fakeFirebase, seedDevice, collectErrors };
