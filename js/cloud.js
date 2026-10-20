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

   Never losing data (Oct 2026 — a sign-in on an iPad wiped a laptop):
   - HYDRATING: from sign-in until the account has been pulled onto this
     device, nothing is pushed. Anything the app writes while it resets or
     re-seeds itself (ensureClasses' one-class registry, a default profile)
     stays local and is then replaced by the account.
   - Every push is a transaction. If the key changed in the account since
     this device last synced it, the two versions are MERGED (records
     unioned by id), never overwritten.
   - tp_sync_meta (device-local, never synced) remembers, per key, the
     account timestamp this device last saw and whether it has edits the
     account has not got yet. Edits made offline, or lost to a closed tab
     before they reached the server, are merged in at the next sign-in.
   - Deletions on another device arrive (child_removed).
   - Once a day the account is copied to users/{uid}/snapshots/{date}; the
     cloud chip can restore one.
   ===================================================================== */
(function () {
  var LS = window.localStorage;
  var SYNC_KEYS = (typeof DATA_KEYS !== 'undefined' && Array.isArray(DATA_KEYS)) ? DATA_KEYS
    : ['tp_roster','tp_starters','tp_star','tp_behaviour','tp_assess','tp_marking','tp_timetable',
       'tp_seating','tp_groups','tp_generator','tp_profile','tp_battler','tp_report_sel','reportBuilderChildren',
       'tp_picker','tp_starter_cfg','tp_starter_weeks','tp_starter_cleared','tp_classes','tp_hundred_words','tp_cbm'];

  var CLOUD_VER = 1;   // schema version stamped on every push; readers accept {v,t} and {v,t,ver}
  var CLOUD = { uid:null, email:null, db:null, applying:false, resetting:false, listening:false, hydrating:false,
                wasSignedIn:false, timers:{}, lastSeen:{}, status:'local', offlineDismissed:false, connected:true };
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
    try {
      if ((!SProto || this === LS) && !CLOUD.applying && !CLOUD.resetting && isSyncKey(k)) {
        metaDirty(k, true);                       // remembered until the account has it — survives a closed tab
        if (CLOUD.uid && !CLOUD.hydrating) cloudSchedulePush(k);
      }
    } catch (e) {}
  }
  if (SProto) SProto.setItem = hookedSetItem; else LS.setItem = hookedSetItem;

  function cloudConfigured () {
    return typeof firebaseConfig !== 'undefined' && firebaseConfig &&
      firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf('PASTE_') !== 0 &&
      firebaseConfig.databaseURL && firebaseConfig.databaseURL.indexOf('PASTE_') < 0;
  }

  /* ---- sync meta (device-local; see CONTRACT.md) ----
     { uid, t:{ key: account timestamp last seen }, dirty:{ key: 1 } } */
  var META_KEY = 'tp_sync_meta';
  var META = readMeta();
  function readMeta (){
    try { var m = JSON.parse(LS.getItem(META_KEY) || 'null'); if (m && typeof m === 'object') return { uid: m.uid || null, t: m.t || {}, dirty: m.dirty || {} }; } catch (e) {}
    return { uid: null, t: {}, dirty: {} };
  }
  function saveMeta (){ try { rawSet(META_KEY, JSON.stringify(META)); } catch (e) {} }
  function metaDirty (k, on){
    if (!on && !META.dirty[k]) return;
    if (on) META.dirty[k] = 1; else delete META.dirty[k];
    saveMeta(); if (on && CLOUD.uid && CLOUD.status !== 'syncing') cloudSetStatus(CLOUD.status);
  }
  function metaSeen (k, t){ if (t == null) delete META.t[k]; else META.t[k] = t; saveMeta(); }
  function dirtyCount (){ return Object.keys(META.dirty).length; }

  /* ---- merging two versions of one key ----
     Used only when both sides changed. Objects merge field by field, lists of
     records ({id}) merge by id, lists of plain values are unioned; anything
     else takes this device's version (the edit the teacher just made). A
     record deleted on one device while the other edited the same list can
     come back — the safe direction: a teacher can delete it again, but
     cannot get back a record that was silently dropped. */
  function isObj (x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function recId (x){ return isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number') ? String(x.id) : null; }
  function mergeJSON (remote, local){
    if (isObj(remote) && isObj(local)){
      var out = {};
      Object.keys(remote).forEach(function (k){ out[k] = remote[k]; });
      Object.keys(local).forEach(function (k){ out[k] = (k in remote) ? mergeJSON(remote[k], local[k]) : local[k]; });
      return out;
    }
    if (Array.isArray(remote) && Array.isArray(local)){
      var all = remote.concat(local);
      if (all.length && all.every(function (x){ return recId(x) !== null; })){
        var byId = {}, order = [];
        remote.forEach(function (x){ var id = recId(x); if (!(id in byId)) order.push(id); byId[id] = x; });
        local.forEach(function (x){ var id = recId(x); if (id in byId) byId[id] = mergeJSON(byId[id], x); else { order.push(id); byId[id] = x; } });
        return order.map(function (id){ return byId[id]; });
      }
      if (all.every(function (x){ return x === null || typeof x !== 'object'; })){
        var seen = {}, res = [];
        local.concat(remote).forEach(function (x){ var key = typeof x + ':' + x; if (!seen[key]){ seen[key] = 1; res.push(x); } });
        return res;
      }
    }
    return local;
  }
  function mergeRaw (remoteRaw, localRaw){
    if (remoteRaw == null) return localRaw;
    if (localRaw == null) return remoteRaw;
    try { return JSON.stringify(mergeJSON(JSON.parse(remoteRaw), JSON.parse(localRaw))); } catch (e) { return localRaw; }
  }
  function envRaw (rec){ return (!rec || rec.v == null || rec.v === '') ? null : rec.v; }
  function keyRef (k){ return CLOUD.db.ref('users/' + CLOUD.uid + '/keys/' + k); }

  /* Write k into localStorage from the account side: no push, mirrors + views refresh. */
  function applyLocal (k, raw){
    var oldRaw = LS.getItem(k);
    if (oldRaw === raw) return false;
    CLOUD.applying = true;
    try {
      if (keyBase(k) === 'tp_battler' && raw != null && k === activePhysKey('tp_battler') && typeof ggReplayRemote === 'function' && !CLOUD.hydrating) {
        // active class: animate the point change on this device, then converge to exact state
        var animated = ggReplayRemote(oldRaw, raw);   // award() reactions run while points are still old
        rawSet(k, raw);
        CLOUD.lastSeen[k] = raw;
        if (!animated && typeof ggRender === 'function') ggRender();   // bulk/structural → render exact
        if (typeof renderGlowLaunch === 'function') {               // planner launcher: refresh the points stat
          var act = document.querySelector('.page.active');
          if (act && act.id === 'page-glow') renderGlowLaunch();
        }
        return true;
      }
      if (raw == null) LS.removeItem(k); else rawSet(k, raw);
    } finally { CLOUD.applying = false; }
    CLOUD.lastSeen[k] = raw;
    if (!CLOUD.hydrating) cloudApplyRemote(k);
    return true;
  }

  /* ---- push / pull ---- */
  function cloudSchedulePush (k) {
    clearTimeout(CLOUD.timers[k]);
    CLOUD.timers[k] = setTimeout(function () { delete CLOUD.timers[k]; cloudPush(k); }, 250);
  }
  function cloudPush (k) {
    if (!CLOUD.uid || !CLOUD.db || CLOUD.hydrating) return;
    var uid = CLOUD.uid, readLocal = null, sent = null;
    cloudSetStatus('syncing');
    keyRef(k).transaction(function (cur) {
      readLocal = LS.getItem(k);
      var remoteRaw = envRaw(cur);
      // The account moved since we last synced this key (another device wrote
      // it): merge rather than overwrite. Same timestamp → ours is the edit.
      sent = (cur && cur.t !== META.t[k]) ? mergeRaw(remoteRaw, readLocal) : readLocal;
      if (cur && remoteRaw === sent) return;                       // already there — abort, nothing to write
      CLOUD.lastSeen[k] = sent;
      return { v: sent == null ? '' : sent, t: Date.now(), ver: CLOUD_VER };
    }).then(function (res) {
      if (uid !== CLOUD.uid) return;
      var rec = res && res.snapshot && res.snapshot.val();
      if (LS.getItem(k) === readLocal) {
        // nothing changed locally meanwhile: this device and the account now agree
        if (sent !== readLocal) applyLocal(k, sent);              // a merge brought in the other device's records
        metaSeen(k, rec ? rec.t : null);
        metaDirty(k, false);
      }
      // else: edited again while in flight — that write scheduled another push,
      // and leaving META.t stale makes it merge with what we just wrote.
      cloudSetStatus('synced');
    }).catch(function () { cloudSetStatus('offline'); });
  }
  function cloudIncoming (k, rec) {
    if (!isSyncKey(k) || CLOUD.hydrating) return;
    var raw = envRaw(rec), cur = LS.getItem(k);
    if (rec && rec.v == null) return;
    if (cur === raw) { if (rec) metaSeen(k, rec.t); CLOUD.lastSeen[k] = raw; return; }   // already current (incl. our echo)
    if (META.dirty[k] || CLOUD.timers[k]) {
      // this device has an edit on the way: keep it, take theirs alongside it.
      // The pending push sees the newer account timestamp and merges too.
      var merged = rec ? mergeRaw(raw, cur) : cur;
      if (merged !== cur) applyLocal(k, merged);
      return;
    }
    applyLocal(k, raw);
    metaSeen(k, rec ? rec.t : null);
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
      // objects other code holds by reference: refresh in place
      if (b === 'tp_profile'   && typeof profile !== 'undefined' && profile) refreshInPlace(profile, k);
      if (b === 'tp_seating'   && typeof seatState !== 'undefined' && seatState) refreshInPlace(seatState, k);
    } catch (e) {}
  }
  function refreshInPlace (obj, k){
    var v = JSON.parse(window.localStorage.getItem(k) || '{}');
    if (v && typeof v === 'object') Object.keys(v).forEach(function (f){ obj[f] = v[f]; });
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
    if (e.key === META_KEY) { META = readMeta(); return; }   // the other window (planner / Glow Getters) updated it
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
    // CLOUD.uid is already null by the time a sign-out gets here, so detach the
    // ref we attached — not one rebuilt from the uid.
    if (CLOUD.keysRef){ try { CLOUD.keysRef.off(); } catch (e) {} CLOUD.keysRef = null; }
    CLOUD.listening = false; CLOUD.hydrating = false;
    for (var t in CLOUD.timers){ clearTimeout(CLOUD.timers[t]); }
    CLOUD.timers = {}; CLOUD.lastSeen = {};
  }
  // Wipe this device's class data to empty (UNHOOKED removal → never pushes to the cloud) and blank every view.
  // resetting stays up while the app re-seeds itself (ensureClasses writes a one-class
  // registry): those writes are not the teacher's and must never reach the account.
  function cloudWipeLocalData (){
    CLOUD.resetting = true;
    try {
      syncPhysKeys().forEach(function (k){ try { LS.removeItem(k); } catch (e) {} });   // all classes + registry
      try { LS.removeItem('tp_active_class'); } catch (e) {}                            // back to default
      CLOUD.lastSeen = {};
      META = { uid: null, t: {}, dirty: {} }; try { LS.removeItem(META_KEY); } catch (e) {}
      if (typeof window.appResetState === 'function'){ try { window.appResetState(); } catch (e) {} }
      try { window.dispatchEvent(new CustomEvent('tp:reset')); } catch (e) {}
    } finally { CLOUD.resetting = false; }
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
    syncPhysKeys().forEach(function (k){ if (LS.getItem(k) != null) metaDirty(k, true); });
    cloudStampOwner();
    if (!CLOUD.hydrating) cloudPushDirty();
  };
  /* Restoring a backup: make the account exactly this device's data, key by key
     (no merge — the teacher chose this version). The account as it was is
     saved first as a cloud copy, so the restore can be undone. Keys only in
     the account are left alone. Resolves true once the account has it. */
  window.cloudUploadAll = function (){
    if (!CLOUD.uid || !CLOUD.db || CLOUD.hydrating) return Promise.resolve(false);
    var root = CLOUD.db.ref('users/' + CLOUD.uid), d = new Date();
    var pre = todayStamp() + '-' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + '-before-backup-restore';
    return root.child('keys').once('value').then(function (s){
      return cloudSnapshot(s.val() || {}, pre);
    }).then(function (){
      var t = Date.now(), jobs = [];
      syncPhysKeys().forEach(function (k){
        var raw = LS.getItem(k); if (raw == null) return;
        clearTimeout(CLOUD.timers[k]); delete CLOUD.timers[k];
        CLOUD.lastSeen[k] = raw;
        jobs.push(keyRef(k).set({ v: raw, t: t, ver: CLOUD_VER }).then(function (){ META.t[k] = t; delete META.dirty[k]; }));
      });
      return Promise.all(jobs);
    }).then(function (){ saveMeta(); cloudSetStatus('synced'); return true; });
  };
  function cloudPushDirty (){ Object.keys(META.dirty).forEach(function (k){ if (isSyncKey(k)) cloudPush(k); }); }
  // Remove a single physical key from the cloud (used when a class is deleted).
  window.cloudRemoveKey = function (k){
    metaDirty(k, false); metaSeen(k, null);
    if (!CLOUD.uid || !CLOUD.db) return;
    try { CLOUD.lastSeen[k] = null; keyRef(k).remove(); } catch (e) {}
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
    try {
      CLOUD.db.ref('.info/connected').on('value', function (s) {
        CLOUD.connected = !!s.val();
        if (CLOUD.uid) cloudSetStatus(CLOUD.connected ? (CLOUD.hydrating ? 'syncing' : 'synced') : 'offline');
      });
    } catch (e) {}
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
    var uid = CLOUD.uid, base = CLOUD.db.ref('users/' + uid + '/keys');
    CLOUD.hydrating = true;            // no pushes until the account is on this device
    function attach () {
      if (CLOUD.listening) return;
      CLOUD.listening = true; CLOUD.keysRef = base;
      // child_added fires once per existing key on attach (already current → no-op);
      // child_changed / child_removed keep it live. All echo-guarded in cloudIncoming.
      base.on('child_added',   function (s) { cloudIncoming(s.key, s.val()); });
      base.on('child_changed', function (s) { cloudIncoming(s.key, s.val()); });
      base.on('child_removed', function (s) { cloudIncoming(s.key, null); });
    }
    function done () {
      CLOUD.hydrating = false;
      attach(); cloudSetStatus('synced');
      cloudPushDirty();                // edits this device made that the account has not got
    }
    base.once('value').then(function (snap) {
      if (uid !== CLOUD.uid) return;
      var remote = snap.val() || {};
      var hasRemote = Object.keys(remote).length > 0;
      var owner = cloudOwner(), localData = cloudLocalHasData();
      if (META.uid !== uid) META = { uid: uid, t: {}, dirty: owner === uid ? META.dirty : {} };
      if (hasRemote) {
        // The account is the source of truth. Drop local data first UNLESS it is
        // provably mine (owner stamp === this uid) — so a pull fully REPLACES and no
        // residual key (e.g. tp_battler groups) from a previous teacher can linger.
        // owner===null (unstamped/legacy/offline data) counts as NOT mine → wipe.
        if (owner !== uid) { if (localData) cloudWipeLocalData(); META = { uid: uid, t: {}, dirty: {} }; }
        cloudSnapshot(remote);
        cloudHydrate(remote, owner === uid);
        cloudStampOwner(); done();
      } else if (!localData) {
        // empty account, empty device → start clean, owned by this uid.
        cloudStampOwner(); saveMeta(); done();
      } else if (owner === uid) {
        // empty account but this device's data is already mine → resume + upload it.
        window.cloudAdoptLocal(); done();
      } else {
        // empty account + local data from a DIFFERENT/unknown owner → ASK. NEVER auto-seed.
        // Still hydrating: nothing is pushed until the teacher chooses.
        var go = function (which){
          if (uid !== CLOUD.uid) return;
          if (which === 'account'){ cloudWipeLocalData(); META = { uid: uid, t: {}, dirty: {} }; cloudStampOwner(); saveMeta(); }
          else { window.cloudAdoptLocal(); }                                      // upload this device's data
          done();
        };
        if (typeof window.appPromptAdopt === 'function') {
          window.appPromptAdopt(cloudLocalSummary(), { onUseAccount: function(){ go('account'); }, onKeepUpload: function(){ go('keep'); } });
        } else {
          // No adopt UI (e.g. the Glow Getters window) → privacy default is to CLEAR, never
          // leave a previous teacher's class on screen. The planner offers the keep/use choice.
          go('account');
        }
      }
    }).catch(function () { if (uid !== CLOUD.uid) return; CLOUD.hydrating = false; cloudSetStatus('offline'); attach(); });
  }

  /* Bring the account onto this device in one pass, then refresh every view.
     mine: this device's data belongs to this account, so its unsent edits
     (META.dirty) are kept — merged with the account where both changed. */
  function cloudHydrate (remote, mine){
    var changed = [];
    CLOUD.applying = true;
    try {
      Object.keys(remote).forEach(function (k){
        if (!isSyncKey(k)) return;
        var rec = remote[k], raw = envRaw(rec), cur = LS.getItem(k), next = raw;
        if (mine && META.dirty[k] && cur !== raw) {
          next = (rec && rec.t === META.t[k]) ? cur : mergeRaw(raw, cur);   // account unchanged → ours; both → merge
        } else if (META.dirty[k]) delete META.dirty[k];
        if (next !== cur) { if (next == null) LS.removeItem(k); else rawSet(k, next); changed.push(k); }
        if (next === raw) delete META.dirty[k];
        CLOUD.lastSeen[k] = raw;
        META.t[k] = rec ? rec.t : null;
      });
      // keys here but not in the account
      syncPhysKeys(true).forEach(function (k){
        if (k in remote) return;
        if (mine && (META.dirty[k] || META.t[k] == null)) { META.dirty[k] = 1; return; }   // never uploaded → upload
        if (META.t[k] != null) { LS.removeItem(k); delete META.t[k]; changed.push(k); }     // deleted on another device
      });
    } finally { CLOUD.applying = false; saveMeta(); }
    if (!changed.length) return;
    // every module re-reads its data; the open page redraws once
    var classes = false;
    changed.forEach(function (k){ if (keyBase(k) === 'tp_classes') classes = true; else if (keyIsLive(k)) { cloudRefreshMirrors(k); cloudBroadcast(k, 'cloud'); } });
    if (classes) { handleClassesChange(); cloudBroadcast('tp_classes', 'cloud'); }
    try { if (typeof applyClass === 'function') applyClass(); } catch (e) {}
    try { if (typeof syncPupilSelectors === 'function') syncPupilSelectors(); } catch (e) {}
    try { if (typeof ggRender === 'function' && !document.getElementById('planApp')) ggRender(); } catch (e) {}
  }

  /* ---- daily copy of the account, kept 14 days ----
     users/{uid}/snapshots/{YYYY-MM-DD} = { t, keys }, indexed by
     users/{uid}/snapIndex/{date} = t so listing never downloads a copy. */
  var SNAP_KEEP = 14;
  function todayStamp (){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function cloudSnapshot (remote, name){
    if (!CLOUD.db || !CLOUD.uid) return Promise.resolve();
    var uid = CLOUD.uid, root = CLOUD.db.ref('users/' + uid), id = name || todayStamp(), t = Date.now();
    return root.child('snapIndex/' + id).transaction(function (cur){ return cur ? undefined : t; })
      .then(function (res){
        if (!res || !res.committed) return;
        return root.child('snapshots/' + id).set({ t: t, keys: remote }).then(function (){
          return root.child('snapIndex').once('value').then(function (s){
            var ids = Object.keys(s.val() || {}).sort();
            ids.slice(0, Math.max(0, ids.length - SNAP_KEEP)).forEach(function (old){
              root.child('snapshots/' + old).remove(); root.child('snapIndex/' + old).remove();
            });
          });
        });
      }).catch(function () {});
  }
  window.cloudListSnapshots = function (){
    if (!CLOUD.db || !CLOUD.uid) return Promise.resolve([]);
    return CLOUD.db.ref('users/' + CLOUD.uid + '/snapIndex').once('value').then(function (s){
      var v = s.val() || {}; return Object.keys(v).sort().reverse().map(function (id){ return { id: id, t: v[id] }; });
    });
  };
  /* Put the whole account back to a saved copy. The account as it is now is
     saved first, so a restore can itself be undone. */
  window.cloudRestoreSnapshot = function (id){
    if (!CLOUD.db || !CLOUD.uid) return Promise.reject(new Error('Not signed in'));
    var uid = CLOUD.uid, root = CLOUD.db.ref('users/' + uid);
    var d = new Date(), pre = todayStamp() + '-' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + '-before-restore';
    return root.child('snapshots/' + id).once('value').then(function (s){
      var snap = s.val(); if (!snap || !snap.keys) throw new Error('That copy could not be found.');
      return root.child('keys').once('value').then(function (curSnap){
        var cur = curSnap.val() || {};
        return cloudSnapshot(cur, pre).then(function (){
          var t = Date.now(), jobs = [];
          Object.keys(cur).forEach(function (k){ if (!(k in snap.keys)) jobs.push(root.child('keys/' + k).remove()); });
          Object.keys(snap.keys).forEach(function (k){ jobs.push(root.child('keys/' + k).set({ v: snap.keys[k].v, t: t, ver: CLOUD_VER })); });
          return Promise.all(jobs);
        });
      });
    }).then(function (){
      // this device: take the restored account exactly, then start fresh
      cloudDetach();
      CLOUD.resetting = true;
      try { syncPhysKeys().forEach(function (k){ LS.removeItem(k); }); META = { uid: uid, t: {}, dirty: {} }; saveMeta(); }
      finally { CLOUD.resetting = false; }
      location.reload();
    });
  };

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
    chip.onclick = function () { if (CLOUD.uid) cloudShowAccount(); else cloudOpenAuth(); };
    var host = document.querySelector('.topbar') || document.querySelector('.sb-actions');
    if (host) {
      if (host.classList.contains('topbar')) { var sp = host.querySelector('.tb-spacer'); host.insertBefore(chip, sp ? sp.nextSibling : null); }
      else host.insertBefore(chip, host.firstChild);
    } else { chip.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1500;'; document.body.appendChild(chip); }
    cloudUpdateChip();
  }
  /* Signed-in panel: who, sync state, the daily cloud copies, sign out. */
  function cloudShowAccount () {
    var old = document.getElementById('cloudAcct'); if (old) old.remove();
    var e = function (t){ return typeof esc === 'function' ? esc(t) : String(t); };
    var ov = document.createElement('div'); ov.id = 'cloudAcct'; ov.className = 'show';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:rgba(15,20,28,.55);padding:20px;';
    var n = dirtyCount();
    var state = !CLOUD.connected ? 'Offline — ' + (n ? n + ' change' + (n === 1 ? '' : 's') + ' will upload when this device is back online.' : 'everything on this device is already in your account.')
      : n ? 'Uploading ' + n + ' change' + (n === 1 ? '' : 's') + '…' : 'Everything is saved to your account and shared with your other devices.';
    ov.innerHTML =
      '<div class="gc" style="background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:16px;max-width:420px;width:100%;padding:24px;box-shadow:0 30px 70px rgba(0,0,0,.35)">' +
        '<h3 style="margin:0 0 4px;font-size:19px">' + e(CLOUD.email || 'Signed in') + '</h3>' +
        '<p style="margin:0 0 16px;color:var(--muted);font-size:13px">' + e(state) + '</p>' +
        '<div style="font-weight:700;font-size:13.5px;margin:0 0 4px">Daily copies in the cloud</div>' +
        '<p style="margin:0 0 8px;color:var(--muted);font-size:12.5px">Your whole account is copied once a day (kept for ' + SNAP_KEEP + ' days). Restoring puts every device back to that day; today’s data is copied first, so you can undo it.</p>' +
        '<div id="cloudSnaps" style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:10px;margin:0 0 16px;font-size:13px"><div style="padding:10px;color:var(--muted)">Loading…</div></div>' +
        '<div style="display:flex;gap:10px"><button class="secondary" id="cloudAcctClose" style="flex:1">Close</button>' +
        '<button id="cloudAcctOut" style="flex:1">Switch teacher / sign out</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.onclick = function (ev){ if (ev.target === ov) ov.remove(); };
    document.getElementById('cloudAcctClose').onclick = function (){ ov.remove(); };
    document.getElementById('cloudAcctOut').onclick = function (){
      if (confirm('Sign out of ' + (CLOUD.email || 'this account') + '?\n\nThis clears this device so the next teacher starts clean. Your data stays safe in your account.' +
          (dirtyCount() ? '\n\nWARNING: ' + dirtyCount() + ' change(s) on this device have not reached your account yet. Go online first or they will be lost.' : ''))) {
        ov.remove(); window.cloudSwitchAccount();
      }
    };
    window.cloudListSnapshots().then(function (list){
      var box = document.getElementById('cloudSnaps'); if (!box) return;
      if (!list.length){ box.innerHTML = '<div style="padding:10px;color:var(--muted)">No copies yet — the first is made today.</div>'; return; }
      box.innerHTML = list.map(function (x){
        var when = x.t ? new Date(x.t).toLocaleString([], { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : x.id;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid var(--line)">' +
          '<span style="flex:1">' + e(when) + (/before-restore/.test(x.id) ? ' <span style="color:var(--muted)">(before a restore)</span>' : '') + '</span>' +
          '<button class="secondary" data-snap="' + e(x.id) + '" style="padding:5px 10px;font-size:12.5px">Restore</button></div>';
      }).join('');
      box.firstChild.style.borderTop = '0';
      Array.prototype.forEach.call(box.querySelectorAll('[data-snap]'), function (b){
        b.onclick = function (){
          if (!confirm('Put your whole account back to ' + b.parentNode.firstChild.textContent + '?\n\nEvery device will change. What is there now is copied first, so you can undo this.')) return;
          b.disabled = true; b.textContent = 'Restoring…';
          window.cloudRestoreSnapshot(b.getAttribute('data-snap')).catch(function (err){ alert('Restore failed: ' + (err && err.message || err)); b.disabled = false; b.textContent = 'Restore'; });
        };
      });
    }).catch(function (){ var box = document.getElementById('cloudSnaps'); if (box) box.innerHTML = '<div style="padding:10px;color:var(--muted)">Can’t reach the cloud right now.</div>'; });
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
    else if (s === 'synced') { var n = dirtyCount(); if (n && CLOUD.connected) { label = 'Saving…'; cls = 'busy'; } else { label = cloudDisplayName(); cls = 'ok'; } }
    else if (s === 'offline'){ var w = dirtyCount(); label = w ? 'Offline · ' + w + ' change' + (w === 1 ? '' : 's') + ' to upload' : 'Offline'; cls = 'off'; }
    if (cls) chip.classList.add(cls);
    chip.innerHTML = '<span class="dot"></span>' + (typeof esc === 'function' ? esc(label) : label);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cloudInit);
  else cloudInit();
})();
