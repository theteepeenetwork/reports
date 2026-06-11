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
  var LS = window.localStorage;
  var SYNC_KEYS = (typeof DATA_KEYS !== 'undefined' && Array.isArray(DATA_KEYS)) ? DATA_KEYS
    : ['tp_roster','tp_starters','tp_star','tp_behaviour','tp_assess','tp_timetable',
       'tp_seating','tp_groups','tp_generator','tp_profile','tp_battler','tp_report_sel','reportBuilderChildren',
       'tp_picker','tp_starter_cfg','tp_starter_weeks','tp_starter_cleared','tp_classes'];

  var CLOUD_VER = 1;   // schema version stamped on every push; readers accept {v,t} and {v,t,ver}
  var CLOUD = { uid:null, email:null, db:null, applying:false, resetting:false, listening:false,
                wasSignedIn:false, timers:{}, lastSeen:{}, status:'local', offlineDismissed:false };
  window.CLOUD = CLOUD;

  /* ---- multi-class key routing (classkeys.js is loaded first) ----
     Physical keys may be class-suffixed (e.g. tp_roster::c2). A key is syncable
     if it (or its pre-'::' base) is a sync key. The Firebase path is the exact
     physical key — rules accept any $key, so no schema change is needed. */
  function keyBase (k){ return (typeof tpKeyBase === 'function') ? tpKeyBase(k) : k; }
  function isSyncKey (k){ return SYNC_KEYS.indexOf(k) >= 0 || SYNC_KEYS.indexOf(keyBase(k)) >= 0; }
  function activePhysKey (base){ return (typeof tpPhysicalKey === 'function') ? tpPhysicalKey(base) : base; }
  function isPerClassBase (base){ return (typeof TP_PER_CLASS !== 'undefined') && TP_PER_CLASS.indexOf(base) >= 0; }
  /* Is this physical key relevant to the live UI? (active class, or a shared key) */
  function keyIsLive (k){ var b = keyBase(k); return isPerClassBase(b) ? (activePhysKey(b) === k) : true; }
  /* All physical localStorage keys whose base is a sync key (across every class).
     excludeRegistry skips the auto-seeded tp_classes so a fresh device still
     reads as "no data" for the adopt/owner decision. */
  function syncPhysKeys (excludeRegistry){
    var out = [];
    for (var i = 0; i < LS.length; i++){
      var k = LS.key(i); if (!k) continue;
      var b = keyBase(k);
      if (SYNC_KEYS.indexOf(k) < 0 && SYNC_KEYS.indexOf(b) < 0) continue;
      if (excludeRegistry && b === 'tp_classes') continue;
      out.push(k);
    }
    return out;
  }
  /* A class was deleted (possibly on another device): recover if it was active. */
  function handleClassesChange (){
    try {
      if (typeof activeClassId !== 'function' || typeof tpClasses !== 'function') return;
      var id = activeClassId(), cs = tpClasses();
      if (id !== 'default' && cs.length && !cs.some(function (c){ return c && c.id === id; })){
        if (typeof setActiveClass === 'function') setActiveClass('default');
        else { try { LS.removeItem('tp_active_class'); } catch (e) {} }
        location.reload();
      }
    } catch (e) {}
  }

  /* ---- write-through hook ----
     Override Storage.prototype.setItem (NOT localStorage.setItem — assigning to
     the instance is treated as a stored key in some browsers). Catches every
     write, incl. Store.set and direct setItem (e.g. the report builder). */
  var SProto = (window.Storage && window.Storage.prototype) ? window.Storage.prototype : null;
  var origSetItem = SProto ? SProto.setItem : LS.setItem.bind(LS);
  function rawSet(k, v){ if (SProto) origSetItem.call(LS, k, v); else origSetItem(k, v); }
  function hookedSetItem(k, v){
    if (SProto) origSetItem.call(this, k, v); else origSetItem(k, v);
    try { if ((!SProto || this === LS) && CLOUD.uid && !CLOUD.applying && !CLOUD.resetting && isSyncKey(k)) cloudSchedulePush(k); } catch (e) {}
  }
  if (SProto) SProto.setItem = hookedSetItem; else LS.setItem = hookedSetItem;

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
    CLOUD.db.ref('users/' + CLOUD.uid + '/keys/' + k).set({ v: raw == null ? '' : raw, t: Date.now(), ver: CLOUD_VER })
      .then(function () { cloudSetStatus('synced'); })
      .catch(function () { cloudSetStatus('offline'); });
  }
  function cloudIncoming (k, rec) {
    if (!isSyncKey(k) || !rec || rec.v == null) return;
    var raw = rec.v === '' ? null : rec.v;
    if (raw === CLOUD.lastSeen[k]) return;                 // our own echo
    if (window.localStorage.getItem(k) === raw) return;    // already current
    CLOUD.applying = true;
    var oldRaw = window.localStorage.getItem(k);
    if (keyBase(k) === 'tp_battler' && raw != null) {
      if (k === activePhysKey('tp_battler') && typeof btReplayRemote === 'function') {
        // active class: animate the point change on this device, then converge to exact state
        var animated = btReplayRemote(oldRaw, raw);   // award() reactions run while points are still old
        rawSet(k, raw);                                // exact remote state (badges/tables/config) — no push (applying)
        CLOUD.lastSeen[k] = raw;
        if (!animated && typeof btRender === 'function') btRender();   // bulk/structural → render exact
        if (typeof renderBattlerLaunch === 'function') {               // planner launcher: refresh the points stat
          var act = document.querySelector('.page.active');
          if (act && act.id === 'page-battler') renderBattlerLaunch();
        }
        CLOUD.applying = false;
        return;
      }
      // a non-active class's battler changed — store it, but never animate/render here
      rawSet(k, raw); CLOUD.lastSeen[k] = raw; CLOUD.applying = false; return;
    }
    if (raw == null) LS.removeItem(k); else rawSet(k, raw);
    CLOUD.applying = false;
    CLOUD.lastSeen[k] = raw;
    cloudApplyRemote(k);
  }

  /* ---- refresh in-memory state + re-render after a remote change ---- */
  function cloudRefreshMirrors (k) {
    if (!keyIsLive(k)) return;             // an inactive class changed — leave live mirrors alone
    var b = keyBase(k);
    try {
      if (b === 'tp_roster'    && typeof roster !== 'undefined') roster = JSON.parse(window.localStorage.getItem(k) || '[]');
      if (b === 'tp_starters'  && typeof msData !== 'undefined') msData = JSON.parse(window.localStorage.getItem(k) || '{}');
      if (b === 'tp_star'      && typeof spData !== 'undefined') spData = JSON.parse(window.localStorage.getItem(k) || '[]');
      if (b === 'tp_behaviour' && typeof bhData !== 'undefined') bhData = JSON.parse(window.localStorage.getItem(k) || '[]');
      if (b === 'tp_assess'    && typeof asData !== 'undefined') asData = JSON.parse(window.localStorage.getItem(k) || '{}');
    } catch (e) {}
  }
  function cloudApplyRemote (k) {
    if (keyBase(k) === 'tp_classes') handleClassesChange();
    if (!keyIsLive(k)) return;             // inactive class: localStorage already updated, no UI work
    cloudRefreshMirrors(k);
    cloudBroadcast(k, 'cloud');
  }
  /* one path out: every context listens for 'tp:sync' and redraws itself. */
  function cloudBroadcast (k, source) {
    try { window.dispatchEvent(new CustomEvent('tp:sync', { detail: { key: k, source: source } })); } catch (e) {}
  }

  /* same-device, cross-window changes (e.g. planner writes tp_roster, the Glow
     Getters window hears it). The browser has already updated this window's
     localStorage before the event fires, so just refresh mirrors + broadcast. */
  window.addEventListener('storage', function (e) {
    if (!e.key || !isSyncKey(e.key) || CLOUD.applying) return;
    if (keyBase(e.key) === 'tp_classes') handleClassesChange();
    if (!keyIsLive(e.key)) return;
    cloudRefreshMirrors(e.key);
    cloudBroadcast(e.key, 'storage');
  });

  /* ====================================================================
     MULTI-USER: owner stamp, hard session reset, account switching.
     The Storage hook only overrides setItem, so LS.removeItem() never
     pushes — but we also raise CLOUD.resetting as belt-and-braces so no
     incidental write during a reset can wipe the cloud account.
     ==================================================================== */
  function cloudDisplayName (){
    try { var p = JSON.parse(LS.getItem('tp_profile') || '{}'); if (p && (p.name || p.displayName)) return (p.name || p.displayName); } catch (e) {}
    return CLOUD.email ? CLOUD.email.split('@')[0] : 'Synced';
  }
  function cloudKnownEmails (){ try { var a = JSON.parse(LS.getItem('tp_known_emails') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function cloudRememberEmail (email){
    if (!email) return; try { var a = cloudKnownEmails().filter(function (e){ return e !== email; }); a.unshift(email);
      rawSet('tp_known_emails', JSON.stringify(a.slice(0, 6))); } catch (e) {}
  }
  function cloudOwner ()      { try { return LS.getItem('tp_owner_uid'); } catch (e) { return null; } }
  function cloudStampOwner () { try { rawSet('tp_owner_uid', CLOUD.uid); rawSet('tp_owner_email', CLOUD.email || ''); } catch (e) {} }
  function cloudLocalHasData (){ return syncPhysKeys(true).length > 0; }   // ignore the auto-seeded tp_classes
  function cloudLocalSummary (){
    var keys = syncPhysKeys(true).length, names = 0;
    try { var r = JSON.parse(LS.getItem(activePhysKey('tp_roster')) || '[]'); names = Array.isArray(r) ? r.length : 0; } catch (e) {}
    return { keys: keys, names: names };
  }
  function cloudDetach (){
    if (CLOUD.db && CLOUD.uid){ try { CLOUD.db.ref('users/' + CLOUD.uid + '/keys').off(); } catch (e) {} }
    CLOUD.listening = false;
    for (var t in CLOUD.timers){ clearTimeout(CLOUD.timers[t]); }
    CLOUD.timers = {}; CLOUD.lastSeen = {};
  }
  // Wipe this device's class data to empty (UNHOOKED removal → never pushes to the cloud) and blank every view.
  function cloudWipeLocalData (){
    CLOUD.resetting = true;
    try {
      syncPhysKeys().forEach(function (k){ try { LS.removeItem(k); } catch (e) {} });   // all classes + registry
      try { LS.removeItem('tp_active_class'); } catch (e) {}                            // back to default
    } finally { CLOUD.resetting = false; }
    CLOUD.lastSeen = {};
    if (typeof window.appResetState === 'function'){ try { window.appResetState(); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('tp:reset')); } catch (e) {}
  }
  // Hard reset: drop listeners, owner stamp and all local data. Used on a real sign-out / switch.
  window.resetSession = function (){
    cloudDetach();
    try { LS.removeItem('tp_owner_uid'); LS.removeItem('tp_owner_email'); } catch (e) {}
    cloudWipeLocalData();
  };
  // Explicit "upload this device's data into the signed-in account".
  window.cloudAdoptLocal = function (){
    if (!CLOUD.uid || !CLOUD.db) return;
    syncPhysKeys().forEach(function (k){ if (LS.getItem(k) != null) cloudPush(k); });   // upload every class
    cloudStampOwner();
  };
  // Remove a single physical key from the cloud (used when a class is deleted).
  window.cloudRemoveKey = function (k){
    if (!CLOUD.uid || !CLOUD.db) return;
    try { CLOUD.lastSeen[k] = null; CLOUD.db.ref('users/' + CLOUD.uid + '/keys/' + k).remove(); } catch (e) {}
  };
  window.cloudSwitchAccount = function (){
    if (typeof firebase === 'undefined' || !firebase.apps.length){ if (typeof window.resetSession === 'function') window.resetSession(); cloudShowGate(); return; }
    firebase.auth().signOut();   // onAuthStateChanged(null) → resetSession + gate (see cloudInit)
  };

  /* ---- auth lifecycle ---- */
  function cloudInit () {
    cloudInjectUI();
    if (!cloudConfigured() || typeof firebase === 'undefined') { cloudSetStatus('local'); return; }
    try { firebase.initializeApp(firebaseConfig); } catch (e) {}
    try { firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    CLOUD.db = firebase.database();
    cloudSetStatus('signin');
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) { CLOUD.uid = user.uid; CLOUD.email = user.email; CLOUD.wasSignedIn = true; cloudOnSignedIn(); }
      else {
        var didSignOut = CLOUD.wasSignedIn;   // true only on a real sign-out transition, NOT the initial no-user load
        CLOUD.uid = null; CLOUD.email = null; CLOUD.wasSignedIn = false;
        cloudOnSignedOut(didSignOut);
      }
    });
  }
  function cloudOnSignedIn () {
    cloudHideGate(); cloudRememberEmail(CLOUD.email); cloudUpdateChip(); cloudSetStatus('syncing');
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
      var hasRemote = remote && Object.keys(remote).length;
      var owner = cloudOwner(), localData = cloudLocalHasData();
      if (hasRemote) {
        // The account is the source of truth. Drop local data first UNLESS it is
        // provably mine (owner stamp === this uid) — so a pull fully REPLACES and no
        // residual key (e.g. tp_battler groups) from a previous teacher can linger.
        // owner===null (unstamped/legacy/offline data) counts as NOT mine → wipe.
        if (owner !== CLOUD.uid && localData) cloudWipeLocalData();
        cloudStampOwner(); attach(); cloudSetStatus('synced');
      } else if (!localData) {
        // empty account, empty device → start clean, owned by this uid.
        cloudStampOwner(); attach(); cloudSetStatus('synced');
      } else if (owner === CLOUD.uid) {
        // empty account but this device's data is already mine → resume + upload it.
        attach(); window.cloudAdoptLocal(); cloudSetStatus('synced');
      } else {
        // empty account + local data from a DIFFERENT/unknown owner → ASK. NEVER auto-seed.
        attach(); cloudSetStatus('synced');
        var go = function (which){
          if (which === 'account'){ cloudWipeLocalData(); cloudStampOwner(); }   // account is empty → start empty, now mine
          else { window.cloudAdoptLocal(); }                                      // upload this device's data
        };
        if (typeof window.appPromptAdopt === 'function') {
          window.appPromptAdopt(cloudLocalSummary(), { onUseAccount: function(){ go('account'); }, onKeepUpload: function(){ go('keep'); } });
        } else {
          // No adopt UI (e.g. the Glow Getters window) → privacy default is to CLEAR, never
          // leave a previous teacher's class on screen. The planner offers the keep/use choice.
          go('account');
        }
      }
    }).catch(function () { cloudSetStatus('offline'); attach(); });
  }
  function cloudOnSignedOut (didSignOut) {
    CLOUD.listening = false;
    if (didSignOut && typeof window.resetSession === 'function') window.resetSession();   // clear only on a genuine sign-out
    cloudUpdateChip(); cloudSetStatus('signin'); if (!CLOUD.offlineDismissed) cloudShowGate();
  }

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
      '<input id="cloudEmail" type="email" placeholder="Email" autocomplete="username" list="cloudEmails" />' +
      '<datalist id="cloudEmails"></datalist>' +
      '<input id="cloudPw" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" />' +
      '<div class="ce" id="cloudErr"></div>' +
      '<div class="crow"><button class="secondary" onclick="cloudRegister()">Register</button>' +
      '<button onclick="cloudLogin()">Sign in</button></div>' +
      '<button class="clink" onclick="cloudUseOffline()">Use this device offline</button></div>';
    document.body.appendChild(gate);

    // place the status chip: planner topbar, else the window header, else float
    var chip = document.createElement('button'); chip.id = 'cloudChip'; chip.type = 'button';
    chip.onclick = function () {
      if (CLOUD.uid) {
        if (confirm('Signed in as ' + (CLOUD.email || 'this account') + '.\n\nSwitch teacher / sign out? This clears this device\'s class so the next teacher starts clean. Your data stays safe in your account.'))
          window.cloudSwitchAccount();
      } else cloudOpenAuth();
    };
    var host = document.querySelector('.topbar') || document.querySelector('.sb-actions');
    if (host) {
      if (host.classList.contains('topbar')) { var sp = host.querySelector('.tb-spacer'); host.insertBefore(chip, sp ? sp.nextSibling : null); }
      else host.insertBefore(chip, host.firstChild);
    } else { chip.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1500;'; document.body.appendChild(chip); }
    cloudUpdateChip();
  }
  function cloudShowGate () {
    var dl = document.getElementById('cloudEmails');
    if (dl) dl.innerHTML = cloudKnownEmails().map(function (e){ return '<option value="' + (typeof esc === 'function' ? esc(e) : e) + '">'; }).join('');
    var g = document.getElementById('cloudGate'); if (g) g.classList.add('show');
  }
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
    else if (s === 'synced') { label = cloudDisplayName(); cls = 'ok'; }
    else if (s === 'offline'){ label = 'Offline'; cls = 'off'; }
    if (cls) chip.classList.add(cls);
    chip.innerHTML = '<span class="dot"></span>' + (typeof esc === 'function' ? esc(label) : label);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cloudInit);
  else cloudInit();
})();
