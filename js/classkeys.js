/* ============================================================
   classkeys.js — multi-class key routing (load FIRST, before Store)

   Classroom Hub stores each class's data under suffixed localStorage
   keys: e.g. tp_roster::<classId>. The first ("default") class keeps
   un-suffixed keys for backward compatibility, so nothing moves.

   This file is self-contained (no dependency on Store) and is loaded
   at the very top of <head> in index.html AND glow-getters.html so the
   routing exists before any inline Store / mirror code runs, and so the
   Glow Getters window routes identically. cloud.js also reuses it.

   Exposes on window:
     TP_PER_CLASS, TP_SHARED         — base-key classification
     TP_ACTIVE_KEY, TP_CLASSES_KEY, TP_DEFAULT_ID
     tpKeyBase(k)                    — strip '::suffix' → base
     tpPhysicalKey(base)             — base → physical key for active class
     tpIsPerClass(base)
     tpActiveClassId()
     tpClasses()                     — the registry array
     tpActiveClassMeta()             — { name, year, room } of active class
   ============================================================ */
(function () {

  var SEP = '::';
  var DEFAULT_ID = 'default';
  var ACTIVE_KEY = 'tp_active_class';
  var CLASSES_KEY = 'tp_classes';

  /* Per-class bases. NOTE: deliberately a superset of DATA_KEYS — tp_picker
     and tp_starter_* are real per-class data that aren't (yet) in DATA_KEYS,
     and tp_reading_groups is the legacy groups-migration source. */
  var PER_CLASS = [
    'tp_roster', 'tp_starters', 'tp_star', 'tp_behaviour', 'tp_assess',
    'tp_seating', 'tp_groups', 'tp_generator', 'tp_battler', 'tp_report_sel',
    'reportBuilderChildren', 'tp_picker', 'tp_starter_cfg', 'tp_starter_weeks',
    'tp_starter_cleared', 'tp_starter_ann', 'tp_reading_groups'
  ];

  /* Shared across all classes (never suffixed, still synced). */
  var SHARED = ['tp_timetable', 'tp_profile', 'tp_classes'];

  /* Raw localStorage read with JSON parse (values are written JSON-encoded
     by Store.set, so read them the same way). Never throws. */
  function readJSON(k, def) {
    try {
      var v = JSON.parse(localStorage.getItem(k));
      return v === null ? def : v;
    } catch (e) { return def; }
  }

  function tpKeyBase(k) {
    if (!k) return k;
    var i = k.indexOf(SEP);
    return i < 0 ? k : k.slice(0, i);
  }

  function tpIsPerClass(base) { return PER_CLASS.indexOf(base) >= 0; }

  function tpActiveClassId() {
    var id = readJSON(ACTIVE_KEY, DEFAULT_ID);
    return (typeof id === 'string' && id) ? id : DEFAULT_ID;
  }

  /* base → physical key. Per-class bases get suffixed unless we're on the
     legacy 'default' class. Shared/device-local/unknown keys pass through. */
  function tpPhysicalKey(base) {
    if (PER_CLASS.indexOf(base) < 0) return base;
    var id = tpActiveClassId();
    return (!id || id === DEFAULT_ID) ? base : base + SEP + id;
  }

  function tpClasses() {
    var arr = readJSON(CLASSES_KEY, null);
    return Array.isArray(arr) ? arr : [];
  }

  function tpActiveClassMeta() {
    var id = tpActiveClassId();
    var c = tpClasses().filter(function (x) { return x && x.id === id; })[0];
    return c ? { name: c.name || '', year: c.year || '', room: c.room || '' }
             : { name: '', year: '', room: '' };
  }

  window.TP_PER_CLASS = PER_CLASS;
  window.TP_SHARED = SHARED;
  window.TP_SEP = SEP;
  window.TP_ACTIVE_KEY = ACTIVE_KEY;
  window.TP_CLASSES_KEY = CLASSES_KEY;
  window.TP_DEFAULT_ID = DEFAULT_ID;
  window.tpKeyBase = tpKeyBase;
  window.tpIsPerClass = tpIsPerClass;
  window.tpPhysicalKey = tpPhysicalKey;
  window.tpActiveClassId = tpActiveClassId;
  window.tpClasses = tpClasses;
  window.tpActiveClassMeta = tpActiveClassMeta;

}());
