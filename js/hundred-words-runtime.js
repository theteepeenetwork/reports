/* =====================================================================
   hundred-words-runtime.js — the storage behind hundred-words.html.

   Hundred Words was written as a claude.ai artifact: it asks
   window.claude.use() for a document database ("db") and a file saver
   ("downloads"), and drops to a view-only mode when there is no such
   thing. This file supplies both, so the page runs unchanged inside
   Classroom Hub. It must load before the page's own script.

   Storage: the whole database is ONE JSON value in localStorage under
   tp_hundred_words (per class, so it is suffixed like tp_roster — see
   classkeys.js). Being a DATA_KEYS entry is what gets it synced, backed
   up, and wiped on sign-out with everything else.

   The page normally runs in an <iframe> on #hundred-words. Writes go
   through the PARENT's localStorage when there is one: cloud.js hooks
   Storage.prototype.setItem in the hub's realm, and the iframe's own
   Storage.prototype is a different object, so a write made here would
   never reach the cloud. Remote changes arrive back as `storage` events.

   Pupils are NOT Hundred Words' own: the "pupils" collection is a
   read-only view of the hub's class list for the active class
   (tp_roster), so every class already registered in the hub — and every
   pupil added on the Pupils page — appears here with the same id. Marks
   are keyed by those ids. Switching class reloads the page, which then
   reads that class's roster and that class's tp_hundred_words.

   Not provided: "sample" (photo marking and written summaries by
   Claude) and "assets" (keeping the photo). The page already hides or
   explains both when they are missing; Quick check enters marks by hand.
   ===================================================================== */
(function () {
  'use strict';

  var BASE = 'tp_hundred_words';
  var host = window;
  try { if (window.parent !== window && window.parent.localStorage && window.parent.tpPhysicalKey) host = window.parent; } catch (e) { host = window; }
  var LS = host.localStorage;
  function phys(base) { return typeof host.tpPhysicalKey === 'function' ? host.tpPhysicalKey(base) : base; }
  var KEY = phys(BASE), ROSTER_KEY = phys('tp_roster');

  function empty() { return { sessions: {}, practice: {}, plans: {}, settings: {} }; }
  function read() {
    var d;
    try { d = JSON.parse(LS.getItem(KEY)); } catch (e) { d = null; }
    var out = empty();
    if (d && typeof d === 'object') Object.keys(out).forEach(function (c) { if (d[c] && typeof d[c] === 'object') out[c] = d[c]; });
    return out;
  }
  /* the hub's class list → { id: { name } } */
  function readPupils() {
    var r;
    try { r = JSON.parse(LS.getItem(ROSTER_KEY)); } catch (e) { r = null; }
    var out = {};
    (Array.isArray(r) ? r : []).forEach(function (p) {
      if (p && p.id && p.name) out[p.id] = { name: String(p.name) };
    });
    return out;
  }
  /* the class name defaults to the hub's name for this class */
  function className() {
    try { var m = host.tpActiveClassMeta && host.tpActiveClassMeta(); return (m && m.name) || ''; } catch (e) { return ''; }
  }
  var data = read(), pupils = readPupils();

  function write() {
    try { LS.setItem(KEY, JSON.stringify(data)); }
    catch (e) { var err = new Error('quota'); err.code = 'quota_exceeded'; throw err; }
  }

  var listeners = [];   // { col, id|null, cb }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function coll(col) {
    if (col === 'pupils') return pupils;
    if (col === 'settings') {
      var m = Object.assign({}, data.settings.main);
      if (!m.className) m.className = className();
      return { main: m };
    }
    return data[col] || {};
  }
  function emit(l) {
    var c = coll(l.col);
    if (l.id == null) {
      l.cb({ docs: Object.keys(c).map(function (id) { var v = c[id]; return { id: id, data: function () { return clone(v); } }; }) });
    } else {
      var v = c[l.id];
      l.cb({ id: l.id, exists: v !== undefined, data: function () { return clone(v); } });
    }
  }
  function emitAll(col) { listeners.forEach(function (l) { if (!col || l.col === col) emit(l); }); }
  function listen(l) {
    listeners.push(l);
    setTimeout(function () { emit(l); }, 0);
    return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
  }
  function split(path) {
    var p = String(path).split('/');
    if (p.length !== 2 || !p[0] || !p[1]) throw new Error('bad path ' + path);
    return p;
  }

  var db = {
    collection: function (col) {
      return { onSnapshot: function (cb) { return listen({ col: col, id: null, cb: cb }); } };
    },
    doc: function (path) {
      var p = split(path), col = p[0], id = p[1];
      return {
        onSnapshot: function (cb) { return listen({ col: col, id: id, cb: cb }); },
        set: function (v) {
          return new Promise(function (resolve) {
            if (col === 'pupils') { emitAll(col); resolve(); return; }   // the class list is edited on the Pupils page
            v = clone(v);
            /* the page saves the whole settings doc; don't freeze the
               hub's class name into it, or a rename would never show */
            if (col === 'settings' && v && v.className === className()) delete v.className;
            (data[col] = data[col] || {})[id] = v;
            write(); emitAll(col); resolve();
          });
        },
        delete: function () {
          return new Promise(function (resolve) {
            if (col === 'pupils') { emitAll(col); resolve(); return; }
            if (data[col]) delete data[col][id];
            write(); emitAll(col); resolve();
          });
        }
      };
    }
  };

  /* another device (via cloud.js), another tab, a backup restore, or a
     sign-out wipe changed the value underneath us */
  window.addEventListener('storage', function (e) {
    if (e.key === null || e.key === 'tp_active_class') { location.reload(); return; }
    if (e.key === ROSTER_KEY) { pupils = readPupils(); emitAll('pupils'); return; }
    if (e.key === 'tp_classes') { emitAll('settings'); return; }
    if (e.key !== KEY) return;
    data = read(); emitAll();
  });

  var downloads = {
    save: function (o) {
      return new Promise(function (resolve) {
        var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = o.filename || 'download';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve();
      });
    }
  };

  var APIS = { db: db, downloads: downloads };
  window.claude = window.claude || {};
  window.claude.use = function (name) {
    if (APIS[name]) return Promise.resolve(APIS[name]);
    var e = new Error(name + ' is not available in Classroom Hub'); e.code = 'not_granted';
    return Promise.reject(e);
  };
  window.HW_KEY = KEY;
  /* lets the page send the teacher to the hub's class list */
  window.hwHub = host === window ? null : {
    openPupils: function () { try { host.location.hash = 'pupils'; } catch (e) {} }
  };
})();
