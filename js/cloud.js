/* =====================================================================
   cloud.js — Firebase login + instant multi-device sync engine.

   Runs in BOTH the planner (index.html) and the Glow Getters window
   (glow-getters.html). Fully defensive: if Firebase isn't configured or
   the SDK didn't load, it no-ops and the app stays 100% local/offline.

   How it works:
   - Email/password auth (registration + login), session persisted LOCAL
     so it sticks across reloads and is shared same-origin (the Glow
     Getters window auto-signs-in if the planner on that browser is in).
   - Every write to a synced localStorage key is debounce-pushed to
     Realtime DB at  users/{uid}/keys/{key}  (we hook localStorage.setItem
     so it catches Store.set AND direct setItem like the report builder).
   - A listener pulls remote changes back into localStorage + re-renders,
     with an echo-guard so a device never re-pushes what it just received.
   ===================================================================== */
(function () {
  var origSetItem = window.localStorage.setItem.bind(window.localStorage);

  var SYNC_KEYS = (typeof DATA_KEYS !== 'undefined' && Array.isArray(DATA_KEYS)) ? DATA_KEYS
    : ['tp_roster','tp_starters','tp_star','tp_behaviour','tp_assess','tp_timetable',
       'tp_seating','tp_reading_groups','tp_generator','tp_profile','tp_battler','reportBuilderChildren'];

  var CLOUD = { uid:null, email:null, db:null, applying:false, listening:false,
                timers:{}, lastSeen:{}, status:'local', offlineDismissed:false };
  window.CLOUD = CLOUD;

  /* ---- write-through hook (installed immediately) ---- */
  window.localStorage.setItem = function (k, v) {
    origSetItem(k, v);
    if (CLOUD.uid && !CLOUD.applying && SYNC_KEYS.indexOf(k) >= 0) cloudSchedulePush(k);
  };

  function cloudConfigured () {
    return typeof firebaseConfig !== 'undefined' && firebaseConfig &&
      firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf('PASTE_') !== 0 &&
      firebaseConfig.databaseURL && firebaseConfig.databaseURL.indexOf('PASTE_') < 0;
  }

  /* ---- push / pull ---- */
  function cloudSchedulePush (k) {
    clearTimeout(CLOUD.timers[k]);
    CLOUD.timers[k] = setTimeout(function () { cloudPush(k); }, 250);
  }
  function cloudPush (k) {
    if (!CLOUD.uid || !CLOUD.db) return;
    var raw = window.localStorage.getItem(k);
    CLOUD.lastSeen[k] = raw;
    cloudSetStatus('syncing');
    CLOUD.db.ref('users/' + CLOUD.uid + '/keys/' + k).set({ v: raw == null ? '' : raw, t: Date.now() })
      .then(function () { cloudSetStatus('synced'); })
      .catch(function () { cloudSetStatus('offline'); });
  }
  function cloudIncoming (k, rec) {
    if (SYNC_KEYS.indexOf(k) < 0 || !rec || rec.v == null) return;
    var raw = rec.v === '' ? null : rec.v;
    if (raw === CLOUD.lastSeen[k]) return;                 // our own echo
    if (window.localStorage.getItem(k) === raw) return;    // already current
    CLOUD.applying = true;
    if (raw == null) window.localStorage.removeItem(k); else origSetItem(k, raw);
    CLOUD.applying = false;
    CLOUD.lastSeen[k] = raw;
    cloudApplyRemote(k);
  }

  /* ---- refresh in-memory state + re-render after a remote change ---- */
  function cloudApplyRemote (k) {
    try {
      if (k === 'tp_roster'      && typeof roster  !== 'undefined') roster  = JSON.parse(window.localStorage.getItem('tp_roster')   || '[]');
      if (k === 'tp_starters'    && typeof msData  !== 'undefined') msData  = JSON.parse(window.localStorage.getItem('tp_starters') || '{}');
      if (k === 'tp_star'        && typeof spData  !== 'undefined') spData  = JSON.parse(window.localStorage.getItem('tp_star')     || '[]');
      if (k === 'tp_behaviour'   && typeof bhData  !== 'undefined') bhData  = JSON.parse(window.localStorage.getItem('tp_behaviour')|| '[]');
      if (k === 'tp_assess'      && typeof asData  !== 'undefined') asData  = JSON.parse(window.localStorage.getItem('tp_assess')   || '{}');
    } catch (e) {}
    cloudRerender(k);
  }
  function cloudRerender (k) {
    try {
      if (typeof btRender === 'function' && typeof renderPage !== 'function') { btRender(); return; } // Glow Getters window
      if (typeof syncPupilSelectors === 'function') syncPupilSelectors();
      var active = document.querySelector('.page.active');
      var pageId = active ? active.id.replace('page-', '') : null;
      if (pageId && typeof renderPage === 'function') renderPage(pageId);
    } catch (e) {}
  }

  /* ---- auth lifecycle ---- */
  function cloudInit () {
    cloudInjectUI();
    if (!cloudConfigured() || typeof firebase === 'undefined') { cloudSetStatus('local'); return; }
    try { firebase.initializeApp(firebaseConfig); } catch (e) {}
    try { firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    CLOUD.db = firebase.database();
    cloudSetStatus('signin');
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) { CLOUD.uid = user.uid; CLOUD.email = user.email; cloudOnSignedIn(); }
      else { CLOUD.uid = null; CLOUD.email = null; cloudOnSignedOut(); }
    });
  }
  function cloudOnSignedIn () {
    cloudHideGate(); cloudUpdateChip(); cloudSetStatus('syncing');
    var base = CLOUD.db.ref('users/' + CLOUD.uid + '/keys');
    function attach () {
      if (CLOUD.listening) return;
      CLOUD.listening = true;
      // child_added fires once per existing key on attach → pulls the account down;
      // child_changed keeps it live. Both are echo-guarded in cloudIncoming.
      base.on('child_added',   function (s) { cloudIncoming(s.key, s.val()); });
      base.on('child_changed', function (s) { cloudIncoming(s.key, s.val()); });
    }
    base.once('value').then(function (snap) {
      var remote = snap.val();
      if (!remote || !Object.keys(remote).length) {
        // brand-new account → seed it ONCE from this device. Never bulk-push afterwards.
        SYNC_KEYS.forEach(function (k) { if (window.localStorage.getItem(k) != null) cloudPush(k); });
      }
      // otherwise the account is the source of truth; the listeners pull it down.
      attach();
      cloudSetStatus('synced');
    }).catch(function () { cloudSetStatus('offline'); attach(); });
  }
  function cloudOnSignedOut () { cloudUpdateChip(); cloudSetStatus('signin'); if (!CLOUD.offlineDismissed) cloudShowGate(); }

  window.cloudRegister = function () { cloudAuth(true); };
  window.cloudLogin    = function () { cloudAuth(false); };
  function cloudAuth (isRegister) {
    var em = document.getElementById('cloudEmail'), pw = document.getElementById('cloudPw'),
        err = document.getElementById('cloudErr');
    if (!em || !pw) return;
    var email = (em.value || '').trim(), pass = pw.value || '';
    if (!email || pass.length < 6) { err.textContent = 'Enter an email and a password of at least 6 characters.'; return; }
    err.textContent = 'Please wait…';
    var fn = isRegister ? 'createUserWithEmailAndPassword' : 'signInWithEmailAndPassword';
    firebase.auth()[fn](email, pass)
      .then(function () { err.textContent = ''; })
      .catch(function (e) { err.textContent = (e && e.message) ? e.message.replace('Firebase: ', '') : 'Sign-in failed.'; });
  }
  window.cloudLogout = function () {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    firebase.auth().signOut().then(function () { CLOUD.offlineDismissed = false; });
  };
  window.cloudUseOffline = function () { CLOUD.offlineDismissed = true; cloudHideGate(); cloudSetStatus(CLOUD.uid ? 'synced' : 'signin'); };
  window.cloudOpenAuth = function () { CLOUD.offlineDismissed = false; cloudShowGate(); };

  /* ---- minimal UI (injected; uses host CSS tokens) ---- */
  function cloudInjectUI () {
    if (document.getElementById('cloud-css')) return;
    var css = document.createElement('style'); css.id = 'cloud-css';
    css.textContent =
      '#cloudChip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;cursor:pointer;' +
        'padding:6px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--muted);}' +
      '#cloudChip .dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:0 0 auto;}' +
      '#cloudChip.ok .dot{background:#16a34a;} #cloudChip.busy .dot{background:var(--gold-600);} #cloudChip.off .dot{background:var(--coral-600);}' +
      '#cloudGate{position:fixed;inset:0;z-index:2000;display:none;align-items:center;justify-content:center;background:rgba(15,20,28,.55);padding:20px;}' +
      '#cloudGate.show{display:flex;}' +
      '#cloudGate .gc{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:16px;max-width:380px;width:100%;padding:24px;box-shadow:0 30px 70px rgba(0,0,0,.35);font-family:inherit;}' +
      '#cloudGate h3{margin:0 0 4px;font-size:19px;} #cloudGate p{margin:0 0 16px;color:var(--muted);font-size:13px;}' +
      '#cloudGate input{width:100%;margin:0 0 10px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--card);color:var(--ink);}' +
      '#cloudGate .grow{width:100%;} #cloudGate .ce{color:var(--coral-600);font-size:12.5px;min-height:18px;margin:2px 0 8px;}' +
      '#cloudGate .crow{display:flex;gap:10px;} #cloudGate .crow button{flex:1;}' +
      '#cloudGate .clink{display:block;margin-top:14px;text-align:center;color:var(--muted);font-size:12.5px;background:none;border:0;cursor:pointer;width:100%;}';
    document.head.appendChild(css);

    var gate = document.createElement('div'); gate.id = 'cloudGate';
    gate.innerHTML =
      '<div class="gc"><h3>Sign in to sync</h3>' +
      '<p>Log in to use your class on every device — points sync instantly between your iPad and the smartboard.</p>' +
      '<input id="cloudEmail" type="email" placeholder="Email" autocomplete="username" />' +
      '<input id="cloudPw" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" />' +
      '<div class="ce" id="cloudErr"></div>' +
      '<div class="crow"><button class="secondary" onclick="cloudRegister()">Register</button>' +
      '<button onclick="cloudLogin()">Sign in</button></div>' +
      '<button class="clink" onclick="cloudUseOffline()">Use this device offline</button></div>';
    document.body.appendChild(gate);

    // place the status chip: planner topbar, else the window header, else float
    var chip = document.createElement('button'); chip.id = 'cloudChip'; chip.type = 'button';
    chip.onclick = function () { if (CLOUD.uid) { if (confirm('Sign out of ' + (CLOUD.email || 'this account') + '?')) cloudLogout(); } else cloudOpenAuth(); };
    var host = document.querySelector('.topbar') || document.querySelector('.sb-actions');
    if (host) {
      if (host.classList.contains('topbar')) { var sp = host.querySelector('.tb-spacer'); host.insertBefore(chip, sp ? sp.nextSibling : null); }
      else host.insertBefore(chip, host.firstChild);
    } else { chip.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1500;'; document.body.appendChild(chip); }
    cloudUpdateChip();
  }
  function cloudShowGate () { var g = document.getElementById('cloudGate'); if (g) g.classList.add('show'); }
  function cloudHideGate () { var g = document.getElementById('cloudGate'); if (g) g.classList.remove('show'); }
  function cloudUpdateChip () {
    var chip = document.getElementById('cloudChip'); if (!chip) return;
    if (!cloudConfigured()) { chip.style.display = 'none'; return; }
    chip.style.display = '';
  }
  function cloudSetStatus (s) {
    CLOUD.status = s;
    var chip = document.getElementById('cloudChip'); if (!chip) return;
    chip.classList.remove('ok', 'busy', 'off');
    var label = '', cls = '';
    if (s === 'local')  { label = 'Local only'; }
    else if (s === 'signin') { label = 'Sign in to sync'; }
    else if (s === 'syncing'){ label = 'Syncing…'; cls = 'busy'; }
    else if (s === 'synced') { label = (CLOUD.email ? CLOUD.email.split('@')[0] : 'Synced'); cls = 'ok'; }
    else if (s === 'offline'){ label = 'Offline'; cls = 'off'; }
    if (cls) chip.classList.add(cls);
    chip.innerHTML = '<span class="dot"></span>' + (typeof esc === 'function' ? esc(label) : label);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cloudInit);
  else cloudInit();
})();
