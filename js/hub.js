/* ===================================================================
   hub.js — Classroom Hub "Teach / Plan" redesign shell
   ------------------------------------------------------------------
   Recreates the design-handoff prototype on top of the existing
   vanilla-JS app: reuses Store, the shared `roster`, the per-feature
   modules (generator/picker/timetable/seating/reading-groups/charts),
   and the existing data stores (tp_starters, tp_star, tp_behaviour,
   tp_assess, tp_battler …). Glow Getters (battler) is untouched —
   Quick log awards points via the public window.btAward path.

   Store keys added here:
     tp_mode          'teach' | 'plan'  (per device)
     tp_starter_sets  { 'YYYY-MM-DD'(Monday): {days,generatedISO,max} }
     tp_board_ink     { 'YYYY-MM-DD': [strokes] }  (today only is read)
   =================================================================== */
(function () {
  'use strict';

  /* ── small local icons (the existing iconSVG set covers the rest) ── */
  function ico(name, size) {
    size = size || 18;
    var P = {
      plus: '<path d="M12 5v14M5 12h14"/>',
      chevron: '<path d="M9 6l6 6-6 6"/>',
      back: '<path d="M15 6l-6 6 6 6"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      play: '<path d="M7 4l13 8-13 8z"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  }
  function svg(name, size) {
    if (typeof ICONS !== 'undefined' && ICONS[name] && typeof iconSVG === 'function') return iconSVG(name, size);
    return ico(name, size);
  }

  /* ── date / week helpers ─────────────────────────────────────────── */
  var DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function todayLabel() { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  /* LOCAL-date helpers — never use toISOString() for date keys (it is UTC and
     rolls a BST/forward-offset midnight back to the previous day). */
  function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parseISO(iso) { var p = String(iso).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function todayKey() { return isoLocal(new Date()); }
  function mondayOf(d) {
    d = d ? (typeof d === 'string' ? parseISO(d) : new Date(d)) : new Date();
    var off = (d.getDay() + 6) % 7;            // 0 = Monday
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off);
    return isoLocal(d);
  }
  function addDaysISO(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
  function fmtWB(iso) { var d = parseISO(iso); return 'w/b ' + d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'long' }); }
  function fmtWBShort(iso) { var d = parseISO(iso); return 'w/b ' + d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'short' }); }
  function isThisWeek(iso) { return mondayOf(iso) === mondayOf(); }

  /* ── current half-term (matches the Mental Starters store) ───────── */
  function currentHalfTerm() {
    // prefer the half-term that already holds the most recent date column
    var best = null, bestDate = '';
    try {
      Object.keys(msData || {}).forEach(function (ht) {
        (msData[ht].dates || []).forEach(function (d) { if (d > bestDate) { bestDate = d; best = ht; } });
      });
    } catch (e) {}
    if (best) return best;
    var m = new Date().getMonth();            // 0=Jan
    if (m >= 8 && m <= 9) return 'Autumn 1';
    if (m >= 10) return 'Autumn 2';
    if (m <= 1) return 'Spring 1';
    if (m === 2) return 'Spring 2';
    if (m === 3 || m === 4) return 'Summer 1';
    return 'Summer 2';
  }
  function currentAssessTerm() {
    var m = new Date().getMonth();
    if (m === 8) return 'Baseline';
    if (m >= 9 && m <= 11) return 'Autumn';
    if (m >= 0 && m <= 2) return 'Spring';
    return 'Summer';
  }

  /* ===================================================================
     SAVED PILL
     =================================================================== */
  var savedT = null;
  function flashSaved() {
    document.querySelectorAll('.pill.pill-saved').forEach(function (p) {
      p.classList.add('is-saving'); p.firstChild && (p.innerHTML = '<span>⏳</span> saving…');
    });
    clearTimeout(savedT);
    savedT = setTimeout(function () {
      document.querySelectorAll('.pill.pill-saved').forEach(function (p) { p.classList.remove('is-saving'); p.innerHTML = '<span>✓</span> saved'; });
    }, 600);
  }

  /* ===================================================================
     TOAST + UNDO
     =================================================================== */
  var toastT = null, undoFn = null;
  function toast(msg, undo) {
    var el = document.getElementById('qlToast'); if (!el) return;
    undoFn = undo || null;
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button class="undo" id="qlUndo">Undo</button>' : '');
    el.classList.add('show');
    if (undo) document.getElementById('qlUndo').onclick = function () { try { undoFn(); } catch (e) {} hideToast(); };
    clearTimeout(toastT);
    toastT = setTimeout(hideToast, 4500);
  }
  function hideToast() { var el = document.getElementById('qlToast'); if (el) el.classList.remove('show'); undoFn = null; }

  /* ===================================================================
     QUICK LOG  (who → what → logged, 2 taps)
     =================================================================== */
  var ACTIONS = [
    { key: 'praise',  icon: '👍', label: 'Praise',            cls: 'praise',  tl: 'praise' },
    { key: 'concern', icon: '⚠',  label: 'Concern',           cls: 'concern', tl: 'concern' },
    { key: 'star',    icon: '★',  label: 'Star pupil today',  cls: 'star',    tl: 'star' },
    { key: 'glow',    icon: '⚡', label: 'Glow Getter point',  cls: 'glow',    tl: 'glow' },
    { key: 'note',    icon: '✎',  label: 'Note',              cls: 'note',    tl: 'note' }
  ];

  function readingGroupName(pupilId) {
    try {
      var data = Store.get('tp_reading_groups', { groups: [] });
      var g = (data.groups || []).find(function (g) { return (g.pupilIds || []).indexOf(pupilId) !== -1; });
      return g ? g.name : '';
    } catch (e) { return ''; }
  }
  function readingGroups() { try { return (Store.get('tp_reading_groups', { groups: [] }).groups) || []; } catch (e) { return []; } }

  function openQuickLog(prefillId) {
    var bd = document.getElementById('qlBackdrop');
    bd.classList.add('open');
    if (prefillId) qlWhat(prefillId);
    else qlWho();
  }
  function closeQuickLog() { document.getElementById('qlBackdrop').classList.remove('open'); }

  function qlWho() {
    var sheet = document.getElementById('qlSheet');
    var groups = readingGroups();
    var special = '<button class="ql-chip special" data-special="class">Whole class</button>';
    groups.forEach(function (g) { special += '<button class="ql-chip special" data-group="' + g.id + '">' + esc(g.name) + ' (group)</button>'; });
    var chips = sortedRoster().map(function (p) {
      return '<button class="ql-chip" data-pid="' + p.id + '">' + esc(p.name) + '</button>';
    }).join('');
    sheet.innerHTML =
      '<div class="ql-grab"></div>' +
      '<div class="ql-head"><span class="ql-title">Who?</span><span class="spacer"></span>' +
        '<button class="ql-x" id="qlClose">✕ close</button></div>' +
      (roster.length ? '<div class="ql-special">' + special + '</div><div class="ql-grid">' + chips + '</div>'
                     : '<p class="empty">Add pupils in Plan › Pupils › Manage class first.</p>');
    document.getElementById('qlClose').onclick = closeQuickLog;
    sheet.querySelectorAll('[data-pid]').forEach(function (b) { b.onclick = function () { qlWhat(b.dataset.pid); }; });
    sheet.querySelectorAll('[data-special]').forEach(function (b) { b.onclick = function () { qlWhat('__class__'); }; });
    sheet.querySelectorAll('[data-group]').forEach(function (b) { b.onclick = function () { qlWhat('__group__:' + b.dataset.group); }; });
  }

  function targetIds(who) {
    if (who === '__class__') return roster.map(function (p) { return p.id; });
    if (who.indexOf('__group__:') === 0) {
      var g = readingGroups().find(function (g) { return g.id === who.slice(10); });
      return (g && g.pupilIds) || [];
    }
    return [who];
  }
  function targetLabel(who) {
    if (who === '__class__') return 'the class';
    if (who.indexOf('__group__:') === 0) { var g = readingGroups().find(function (g) { return g.id === who.slice(10); }); return g ? g.name : 'the group'; }
    return pupilName(who);
  }

  function qlWhat(who) {
    var sheet = document.getElementById('qlSheet');
    var name = targetLabel(who);
    var single = who.indexOf('__') !== 0;
    var avatar = single ? initials(name) : '∗';
    var rows = ACTIONS.map(function (a) {
      return '<button class="ql-action" data-act="' + a.key + '">' +
        '<span class="ai ' + a.cls + '">' + a.icon + '</span>' +
        '<span class="al">' + a.label + '</span></button>';
    }).join('');
    sheet.innerHTML =
      '<div class="ql-grab"></div>' +
      '<div class="ql-who"><span class="ql-avatar">' + esc(avatar) + '</span>' +
        '<div><span class="ql-who-name">' + esc(name) + '</span> ' +
        '<span class="ql-who-sub">— what happened?</span></div>' +
        '<span class="spacer"></span><button class="ql-x" id="qlBack">‹ back</button></div>' +
      '<div class="ql-actions">' + rows + '</div>';
    document.getElementById('qlBack').onclick = qlWho;
    sheet.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () { logIt(who, b.dataset.act); };
    });
  }

  function logIt(who, actKey) {
    var act = ACTIONS.find(function (a) { return a.key === actKey; });
    var ids = targetIds(who);
    var written = [];                          // for undo
    var date = todayISO();
    ids.forEach(function (pid) {
      if (act.key === 'praise' || act.key === 'concern' || act.key === 'note') {
        var type = act.key === 'praise' ? 'positive' : (act.key === 'concern' ? 'concern' : 'note');
        var entry = { id: uid(), date: date, pupilId: pid, type: type, note: '' };
        bhData.push(entry); written.push({ store: 'bh', id: entry.id });
      } else if (act.key === 'star') {
        var s = { id: uid(), date: date, pupilId: pid, reason: '' };
        spData.push(s); written.push({ store: 'sp', id: s.id });
      } else if (act.key === 'glow') {
        if (typeof window.btAward === 'function') { window.btAward(pid, 1, { silent: true, label: 'Quick log' }); written.push({ store: 'glow', id: pid }); }
      }
    });
    if (typeof bhSave === 'function') bhSave();
    if (typeof spSave === 'function') spSave();
    closeQuickLog();
    flashSaved();
    window.dispatchEvent(new CustomEvent('tp:sync', { detail: { key: 'tp_behaviour', source: 'local' } }));
    var lbl = targetLabel(who);
    toast('✓ ' + act.label + ' logged for ' + lbl, function () { undoWrites(written); });
  }

  function undoWrites(written) {
    written.forEach(function (w) {
      if (w.store === 'bh') bhData = bhData.filter(function (e) { return e.id !== w.id; });
      else if (w.store === 'sp') spData = spData.filter(function (e) { return e.id !== w.id; });
      else if (w.store === 'glow' && typeof window.btAward === 'function') window.btAward(w.id, -1, { silent: true });
    });
    try { window.bhData = bhData; window.spData = spData; } catch (e) {}
    if (typeof bhSave === 'function') bhSave();
    if (typeof spSave === 'function') spSave();
    window.dispatchEvent(new CustomEvent('tp:sync', { detail: { key: 'tp_behaviour', source: 'local' } }));
    flashSaved();
  }
  window.hubQuickLog = openQuickLog;

  /* ===================================================================
     TIMETABLE → now / next glance
     =================================================================== */
  function todayPeriods() {
    var tt = Store.get('tp_timetable', null);
    if (!tt || !tt.periods) return [];
    var dk = DAY_KEYS[new Date().getDay()];
    if (dk === 'Sun' || dk === 'Sat') dk = 'Mon';     // weekend → preview Monday
    return tt.periods.map(function (p) {
      var m = String(p.label).match(/^(\d{1,2}):(\d{2})\s*(.*)$/);
      var hr = m ? +m[1] : null;
      if (hr != null && hr < 8) hr += 12;        // UK primary afternoons (1:00–7:00 → PM)
      var mins = m ? hr * 60 + (+m[2]) : null;
      var timeTxt = m ? m[1] + ':' + m[2] : '';
      var subject = (p.cells && p.cells[dk]) || (m ? m[3] : p.label) || '';
      var isBreak = /break|lunch|play|dinner|register/i.test(p.label + ' ' + subject);
      return { mins: mins, time: timeTxt, subject: subject.trim(), isBreak: isBreak };
    }).filter(function (p) { return p.mins != null; }).sort(function (a, b) { return a.mins - b.mins; });
  }
  function nowNext() {
    var ps = todayPeriods();
    if (!ps.length) return null;
    var now = new Date().getHours() * 60 + new Date().getMinutes();
    var cur = null, nxt = null;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].mins <= now && (i + 1 >= ps.length || ps[i + 1].mins > now)) { cur = ps[i]; nxt = ps[i + 1] || null; break; }
    }
    if (!cur) { cur = ps[0]; nxt = ps[1] || null; }     // before school → show first
    return { now: cur, next: nxt, untilTime: nxt ? nxt.time : '' };
  }

  /* ===================================================================
     STARTER WEEKS — 5 sets (Mon–Fri) per week beginning; ONE renderer
     tp_starter_weeks : { [mondayISO]: Question[][] }   // exactly 5 day arrays
     tp_starter_ann   : { [dayISO+':'+view]: Stroke[] } // normalised 0..1, persists
     tp_starter_cfg   : { qCount:10|15|20, xtb:boolean }
     Scores reuse the Mental Starters store (msData), keyed by the day's date.
     =================================================================== */
  var stCurWeek = mondayOf(), stCurDay = 0;
  function stCfg() { var c = Store.get('tp_starter_cfg', null) || {}; return { qCount: [10, 15, 20].indexOf(c.qCount) >= 0 ? c.qCount : 20, xtb: c.xtb !== false, xtCount: (c.xtCount > 0 ? c.xtCount : 50) }; }
  function stSaveCfg(c) { Store.set('tp_starter_cfg', c); }
  function stWeeks() { return Store.get('tp_starter_weeks', {}); }
  function stSaveWeeks(w) { Store.set('tp_starter_weeks', w); }
  function stWeek(monday) { return stWeeks()[monday] || null; }
  function stDayISO(monday, i) { return addDaysISO(monday, i); }
  function stBuildDay(qCount) {
    var ht = currentHalfTerm();
    var qs = (typeof window.genBuild === 'function') ? window.genBuild(ht, 'worksheet', 20) : [];
    return qs.slice(0, qCount);                          // 10 / 15 / 20, sliced from the real generator
  }
  function stGenerateWeek(monday, qCount) {
    var w = stWeeks(), days = [];
    for (var i = 0; i < 5; i++) days.push(stBuildDay(qCount));   // five DIFFERENT sheets
    w[monday] = days; stSaveWeeks(w); stUnclear(monday); flashSaved(); return days;
  }
  function stFreshDay(monday, i, qCount) {
    var w = stWeeks(); if (!w[monday]) { stGenerateWeek(monday, qCount); w = stWeeks(); }
    w[monday][i] = stBuildDay(qCount); stSaveWeeks(w); flashSaved(); return w[monday][i];
  }
  /* one-time fix: weeks saved under the old UTC bug were keyed to the Sunday
     before the real Monday — shift each Sunday-keyed week +1 day onto its Monday. */
  function stMigrateDates() {
    var w = stWeeks(), changed = false;
    Object.keys(w).forEach(function (k) {
      if (parseISO(k).getDay() === 0) {                 // Sunday key
        var nk = addDaysISO(k, 1);
        if (!w[nk]) w[nk] = w[k];
        delete w[k]; changed = true;
      }
    });
    if (changed) stSaveWeeks(w);
  }
  function stWeekTouched(monday) { for (var i = 0; i < 5; i++) { var d = stDayISO(monday, i); if (stDayHasAnn(d)) return true; } return false; }
  function stClearWeekAnn(monday) { for (var i = 0; i < 5; i++) stClearDay(stDayISO(monday, i)); }
  /* "cleared" weeks: emptied on purpose, so they stay empty (no auto-regen) and
     become available again in the ⊕ new week sheet. Scores are never touched. */
  function stCleared() { return Store.get('tp_starter_cleared', []); }
  function stMarkCleared(m) { var c = stCleared(); if (c.indexOf(m) < 0) { c.push(m); Store.set('tp_starter_cleared', c); } }
  function stUnclear(m) { var c = stCleared(), i = c.indexOf(m); if (i >= 0) { c.splice(i, 1); Store.set('tp_starter_cleared', c); } }
  function stClearWeek(monday) { var w = stWeeks(); delete w[monday]; stSaveWeeks(w); stClearWeekAnn(monday); stMarkCleared(monday); }
  function stEnsureCurrent() {
    var m = mondayOf(), w = stWeek(m), qc = stCfg().qCount;
    if (!w) { if (stCleared().indexOf(m) < 0) stGenerateWeek(m, qc); return; }   // respect an explicit Clear
    // bring an untouched current week up to the configured length (e.g. old 10-default → 20)
    var touched = w.some(function (_, i) { var d = stDayISO(m, i); return stDayHasAnn(d) || stDayHasScores(d); });
    if (!touched && (w[0] || []).length !== qc) stGenerateWeek(m, qc);
  }
  /* annotation layers (per day AND per view) */
  function stAnn() { return Store.get('tp_starter_ann', {}); }
  function stSaveAnn(a) { Store.set('tp_starter_ann', a); }
  function stLayer(key) { return stAnn()[key] || []; }
  function stSetLayer(key, strokes) { var a = stAnn(); if (strokes && strokes.length) a[key] = strokes; else delete a[key]; stSaveAnn(a); }
  function stDayHasAnn(dayISO) { var a = stAnn(); return Object.keys(a).some(function (k) { return k.indexOf(dayISO + ':') === 0 && a[k] && a[k].length; }); }
  function stClearDay(dayISO) { var a = stAnn(); Object.keys(a).forEach(function (k) { if (k.indexOf(dayISO + ':') === 0) delete a[k]; }); stSaveAnn(a); }
  /* scores live in msData (the Mental Starters store), keyed by the day's date */
  function stScoreBlock() { var ht = currentHalfTerm(); if (!msData[ht]) msData[ht] = { max: 22, dates: [], scores: {} }; return msData[ht]; }
  function stDayHasScores(dayISO) {
    var b = stScoreBlock();
    return Object.keys(b.scores || {}).some(function (pid) { return b.scores[pid][dayISO] && b.scores[pid][dayISO].v != null; });
  }
  /* deterministic ×tables back page (16 items seeded from the day's date) */
  function stSeed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function stTablesFor(dayISO, count) {
    count = count > 0 ? count : 50;
    var rnd = stSeed(dayISO + ':xt'), bases = [2, 3, 4, 5, 6, 10], out = [];
    for (var i = 0; i < count; i++) out.push({ t: 'times', base: bases[Math.floor(rnd() * bases.length)], by: 1 + Math.floor(rnd() * 12) });
    return out;
  }

  /* ===================================================================
     TEACH MODE
     =================================================================== */
  var teachScreen = 'home';
  function buildTeachShell() {
    var t = document.getElementById('teach');
    t.innerHTML =
      '<div class="teach-view active" id="tv-home"></div>' +
      '<div class="teach-view" id="tv-starter"></div>' +
      '<div class="teach-view" id="tv-day"></div>' +
      '<div class="teach-view" id="tv-scores"></div>' +
      '<div class="teach-view" id="tv-pick"></div>' +
      '<div class="teach-view" id="tv-seats"></div>';
  }
  function teachGo(screen) {
    teachScreen = screen;
    document.querySelectorAll('.teach-view').forEach(function (v) { v.classList.remove('active'); });
    var el = document.getElementById('tv-' + screen); if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    if (screen === 'home') renderTeachHome();
    if (screen === 'starter') renderStarterWeek();
    if (screen === 'day') renderDayView();
    if (screen === 'scores') renderScores();
    if (screen === 'pick') renderPick();
    if (screen === 'seats') renderSeats();
  }

  function topRow() {
    return '<div class="teach-top">' +
      '<span class="teach-date">' + esc(todayLabel()) + '</span>' +
      '<span class="spacer"></span>' +
      '<span class="pill pill-saved"><span>✓</span> saved</span>' +
      '<button class="pill pill-ghost" id="goPlan">Plan ↗</button></div>';
  }

  function renderTeachHome() {
    var v = document.getElementById('tv-home');
    var nn = nowNext();
    var glance = nn
      ? '<div class="glance">' +
          '<div class="glance-now"><span class="eyebrow">Now</span>' +
            '<span class="glance-subject">' + esc(nn.now.subject || '—') + '</span>' +
            (nn.untilTime ? '<span class="glance-until">until ' + esc(nn.untilTime) + '</span>' : '') + '</div>' +
          '<div class="glance-next"><span class="eyebrow">Next</span>' +
            '<span class="nxt">' + esc(nn.next ? nn.next.subject : 'End of day') + '</span></div>' +
        '</div>'
      : '<div class="glance"><div class="glance-now"><span class="eyebrow">Today</span>' +
          '<span class="glance-subject">No timetable yet</span></div>' +
          '<div class="glance-next"><span class="nxt">Set it up in Plan › Organise › Timetable</span></div></div>';

    var set = stWeek(mondayOf());
    var starterStatus = set ? "this week's 5 sets saved ✓" : 'tap to set this week';
    var picker = Store.get('tp_picker', { picked: [] });
    var pickStatus = (picker.picked ? picker.picked.length : 0) + ' of ' + roster.length + ' had a turn';

    var tiles =
      tile('starter', 'calculator', 'Starter', starterStatus, set ? 'ok' : '') +
      tile('pick', 'target', 'Pick a name', pickStatus, '') +
      tile('seats', 'layout-grid', 'Who sits where', 'seating · groups', '') +
      tile('glow', 'zap', 'Glow Getters', 'opens full-screen', '', true);

    v.innerHTML = topRow() + glance +
      '<div class="tile-grid">' + tiles + '</div>' +
      '<button class="dock" id="teachDock">' + svg('plus', 22) + ' Quick log</button>';

    document.getElementById('goPlan').onclick = function () { setMode('plan'); };
    document.getElementById('teachDock').onclick = function () { openQuickLog(); };
    v.querySelectorAll('[data-tile]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.tile;
        if (k === 'glow') { openBattler(); return; }
        teachGo(k);
      };
    });
  }
  function tile(key, icon, label, status, statusCls, violet) {
    return '<button class="tile' + (violet ? ' violet' : '') + '" data-tile="' + key + '">' +
      '<span class="tile-icon">' + svg(icon, 22) + '</span>' +
      '<span class="tile-foot"><span class="tile-label">' + esc(label) + '</span>' +
      '<span class="tile-status ' + (statusCls || '') + '">' + esc(status) + '</span></span></button>';
  }

  function teachHead(backTo, backLabel, rightHTML) {
    return '<div class="teach-head"><button class="back-link" data-back="' + backTo + '">' + svg('back', 16) + esc(backLabel) + '</button>' +
      '<span class="spacer" style="flex:1"></span>' + (rightHTML || '') + '</div>';
  }
  function wireBack(v) { v.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = function () { teachGo(b.dataset.back); }; }); }

  function GRQ(q){ return (typeof window.genRenderQuestion === 'function') ? window.genRenderQuestion(q) : esc(JSON.stringify(q)); }
  function chunk(arr, n){ var out = []; for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
  function stDayShort(monday, i){ var d = parseISO(stDayISO(monday, i)); return ['Mon','Tue','Wed','Thu','Fri'][i] + ' ' + d.getDate(); }
  function stDayFull(monday, i){ return parseISO(stDayISO(monday, i)).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' }); }
  function qPreview(qs){
    return qs.slice(0, 3).map(function (q){
      return String(GRQ(q)).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').replace(' =', '').trim();
    }).join('  ·  ') + '  …';
  }

  /* ── Week view (teach screen 'starter') ── */
  function renderStarterWeek(){
    stEnsureCurrent();
    var v = document.getElementById('tv-starter');
    var cfg = stCfg(), thisMon = mondayOf(), weeks = stWeeks();
    var keys = Object.keys(weeks).filter(function (k) { return parseISO(k).getDay() === 1; });   // Mondays only
    if (keys.indexOf(thisMon) < 0) keys.push(thisMon);
    if (keys.indexOf(stCurWeek) < 0) keys.push(stCurWeek);
    keys.sort();
    var chips = keys.map(function (k){
      var sel = k === stCurWeek, suffix = k === thisMon ? ' · this week' : (k < thisMon ? ' ✓' : '');
      var style = sel ? 'border:2px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700);font-weight:700;padding:6px 14px'
                      : 'border:1px solid var(--line);background:var(--card);color:var(--muted);font-weight:600;padding:7px 14px';
      return '<button class="wk-chip" data-wk="' + k + '" style="border-radius:999px;font-size:12.5px;white-space:nowrap;cursor:pointer;' + style + '">' + fmtWBShort(k) + suffix + '</button>';
    }).join('');
    chips += '<button class="wk-chip" id="newWeek" style="border:1px dashed var(--faint);background:var(--card);color:var(--muted);border-radius:999px;padding:7px 14px;font-size:12.5px;white-space:nowrap;cursor:pointer">⊕ new week</button>';

    var days = weeks[stCurWeek] || [];
    var rows = [0,1,2,3,4].map(function (i){
      var dayISO = stDayISO(stCurWeek, i), qs = days[i] || [], isToday = dayISO === todayKey();
      var hasAnn = stDayHasAnn(dayISO), hasSc = stDayHasScores(dayISO), status, scol;
      if (hasAnn || hasSc){ var parts = []; if (hasAnn) parts.push('✏ annotated'); if (hasSc) parts.push('✓ scores'); status = parts.join(' · '); scol = 'var(--success)'; }
      else if (isToday){ status = 'tap to open'; scol = 'var(--teal-700)'; }
      else { status = 'not used yet'; scol = 'var(--faint)'; }
      var rowStyle = isToday ? 'border:2px solid var(--teal-600);background:var(--teal-50);box-shadow:0 4px 14px rgba(47,85,224,.12)'
                             : 'border:1px solid var(--line);background:var(--card);box-shadow:0 4px 14px rgba(20,24,29,.04)';
      return '<button class="day-row" data-day="' + i + '" style="' + rowStyle + '">' +
        '<span style="flex:1;min-width:0;text-align:left">' +
          '<span class="dr-label">' + stDayShort(stCurWeek, i) + (isToday ? ' · today' : '') + '</span>' +
          '<span class="dr-prev">' + esc(qs.length ? qPreview(qs) : 'no set yet') + '</span></span>' +
        '<span class="dr-status" style="color:' + scol + '">' + esc(status) + '</span></button>';
    }).join('');

    var hasWeek = !!weeks[stCurWeek];
    var xtbBtn = '<button id="xtbToggle" style="border-radius:12px;padding:11px 14px;font-size:13px;text-align:left;cursor:pointer;' + (cfg.xtb ? 'border:1.5px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700);font-weight:700' : 'border:1px solid var(--line);background:var(--card);color:var(--muted);font-weight:600') + '">' + (cfg.xtb ? '☑' : '☐') + ' ×tables on the back of every sheet</button>' +
      (cfg.xtb ? '<div style="display:flex;align-items:center;gap:10px;padding:0 4px"><label style="margin:0;flex:1">How many ×tables questions</label>' +
        '<select id="xtCount" style="width:110px">' + [10, 20, 30, 40, 50, 60, 80, 100].map(function (n){ return '<option value="' + n + '"' + (cfg.xtCount === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' : '');
    var body = hasWeek
      ? '<div style="display:flex;flex-direction:column;gap:10px">' + rows + '</div>' +
        '<button id="replaceWeek" class="secondary" style="width:100%;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700">⟳ Replace all 5 sets</button>' +
        xtbBtn +
        '<button id="printWeek" style="background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:14px;padding:14px;font-size:14px;font-weight:700">🖨 Print all 5 days</button>' +
        '<button id="clearWeek" class="danger" style="width:100%;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700">🧹 Clear week</button>'
      : '<div class="empty">No sets saved for ' + esc(fmtWB(stCurWeek)) + ' yet. Tap “⊕ new week” above to choose questions per day — or generate now (scores you already entered are kept).</div>' +
        '<button id="genThisWeek" class="dock">⊕ Generate ' + (stCurWeek === thisMon ? 'this week' : esc(fmtWBShort(stCurWeek))) + '</button>';

    v.innerHTML = teachHead('home', 'Home', '<span class="pill pill-saved"><span>✓</span> saved</span>') +
      '<div><div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--teal-600)">' + esc(currentHalfTerm()) + '</div>' +
      '<div style="font-size:23px;font-weight:700;letter-spacing:-.02em">Starter</div>' +
      '<div style="font-size:12.5px;color:var(--faint)">Pick a week, then a day — sheet, whiteboard or scores.</div></div>' +
      '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px">' + chips + '</div>' +
      body;
    wireBack(v);
    v.querySelectorAll('[data-wk]').forEach(function (b){ b.onclick = function (){ stCurWeek = b.dataset.wk; stCurDay = (stCurWeek === thisMon) ? Math.min((new Date().getDay() + 6) % 7, 4) : 0; renderStarterWeek(); }; });
    document.getElementById('newWeek').onclick = openNewWeek;
    if (hasWeek) {
      v.querySelectorAll('[data-day]').forEach(function (b){ b.onclick = function (){ stCurDay = +b.dataset.day; teachGo('day'); }; });
      document.getElementById('xtbToggle').onclick = function (){ var c = stCfg(); c.xtb = !c.xtb; stSaveCfg(c); renderStarterWeek(); };
      var xc = document.getElementById('xtCount'); if (xc) xc.onchange = function (){ var c = stCfg(); c.xtCount = +xc.value; stSaveCfg(c); renderStarterWeek(); };
      document.getElementById('replaceWeek').onclick = function (){
        if (!confirm('Replace all five sets for ' + fmtWB(stCurWeek) + ' with fresh questions?' + (stWeekTouched(stCurWeek) ? ' This week has whiteboard annotations — they will be cleared too.' : '') + ' This cannot be undone.')) return;
        stClearWeekAnn(stCurWeek); stGenerateWeek(stCurWeek, stCfg().qCount); renderStarterWeek();
        toast('✓ 5 fresh sets saved to ' + fmtWB(stCurWeek));
      };
      document.getElementById('printWeek').onclick = function (){ stPrintWeek(stCurWeek); };
      document.getElementById('clearWeek').onclick = function (){
        if (!confirm('Clear the sets for ' + fmtWB(stCurWeek) + '? This removes the questions and whiteboard annotations so you can generate a new week for that date. Scores you have already entered are kept.')) return;
        stClearWeek(stCurWeek); renderStarterWeek();
        toast('✓ Cleared ' + fmtWB(stCurWeek) + ' — use ⊕ new week to generate fresh sets');
      };
    } else {
      document.getElementById('genThisWeek').onclick = function (){ stGenerateWeek(stCurWeek, stCfg().qCount); renderStarterWeek(); toast('✓ 5 fresh sets saved to ' + fmtWB(stCurWeek)); };
    }
  }

  /* ── New week bottom sheet ── */
  function openNewWeek(){ document.getElementById('stBackdrop').classList.add('open'); renderNewWeek(); }
  function closeNewWeek(){ document.getElementById('stBackdrop').classList.remove('open'); }
  function renderNewWeek(){
    var cfg = stCfg();
    var counts = [10,15,20].map(function (n){ var sel = cfg.qCount === n;
      return '<button class="nw-count" data-n="' + n + '" style="border-radius:999px;padding:6px 15px;font-size:13px;cursor:pointer;' + (sel ? 'border:2px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700);font-weight:700' : 'border:1px solid var(--line);background:var(--card);color:var(--muted);font-weight:600') + '">' + n + '</button>';
    }).join('');
    var weeks = stWeeks(), opts = [], thisMon = mondayOf();
    for (var i = 0; i <= 4 && opts.length < 4; i++){ var k = addDaysISO(thisMon, 7 * i); if (!weeks[k]) opts.push(k); }   // current (if cleared) + upcoming
    var rows = opts.map(function (k){
      var tag = k === thisMon ? ' — this week' : (k === addDaysISO(thisMon, 7) ? ' — next week' : '');
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-top:1px solid var(--line-2)"><span style="font-size:13.5px;font-weight:600">' + fmtWB(k) + tag + '</span><button class="nw-gen" data-k="' + k + '" style="background:none;border:0;color:var(--teal-600);font-weight:700;font-size:13px;cursor:pointer">generate &amp; save ›</button></div>';
    }).join('') || '<p class="hint small">All weeks already have sets.</p>';
    document.getElementById('stSheet').innerHTML =
      '<div class="ql-grab"></div>' +
      '<div class="ql-head"><span class="ql-title">New week of starters</span><span class="spacer"></span><button class="ql-x" id="nwClose">✕</button></div>' +
      '<p style="font-size:13px;color:var(--muted);margin:0 0 12px">Five fresh sets — one each for Monday to Friday — saved to the week beginning you pick.</p>' +
      '<label style="margin:0 0 6px">Questions per day</label><div style="display:flex;gap:8px;margin-bottom:6px">' + counts + '</div>' +
      rows +
      '<p class="hint small" style="margin-top:12px">A saved set never changes unless you explicitly regenerate it.</p>';
    document.getElementById('nwClose').onclick = closeNewWeek;
    document.querySelectorAll('.nw-count').forEach(function (b){ b.onclick = function (){ var c = stCfg(); c.qCount = +b.dataset.n; stSaveCfg(c); renderNewWeek(); }; });
    document.querySelectorAll('.nw-gen').forEach(function (b){ b.onclick = function (){ var k = b.dataset.k; stGenerateWeek(k, stCfg().qCount); stCurWeek = k; stCurDay = 0; closeNewWeek(); renderStarterWeek(); toast('✓ 5 fresh sets saved to ' + fmtWB(k)); }; });
  }

  /* ── Day view — the printable sheet (teach screen 'day') ── */
  function renderDayView(){
    var v = document.getElementById('tv-day');
    var days = stWeek(stCurWeek);
    if (!days) {   // week was cleared — don't silently regenerate; offer to generate
      v.innerHTML = teachHead('starter', fmtWB(stCurWeek), '') +
        '<div class="empty">No set saved for ' + esc(fmtWB(stCurWeek)) + '.</div>' +
        '<button class="dock" id="genFromDay">⊕ Generate this week</button>';
      wireBack(v);
      document.getElementById('genFromDay').onclick = function (){ stGenerateWeek(stCurWeek, stCfg().qCount); renderDayView(); toast('✓ 5 fresh sets saved to ' + fmtWB(stCurWeek)); };
      return;
    }
    var qs = days[stCurDay] || [], dayISO = stDayISO(stCurWeek, stCurDay);
    var isToday = dayISO === todayKey(), hasAnn = stDayHasAnn(dayISO), cfg = stCfg();
    var badge = isToday ? '<span style="font-size:11px;font-weight:700;background:var(--teal-50);color:var(--teal-700);border-radius:999px;padding:3px 10px">today</span>'
              : (hasAnn ? '<span style="font-size:11px;font-weight:700;background:var(--success-50);color:var(--success);border-radius:999px;padding:3px 10px">✏ annotated</span>' : '');
    var cells = qs.map(function (q, i){ return '<div class="ds-q"><span class="ds-num">' + (i + 1) + '</span><div class="ds-text">' + GRQ(q) + '</div></div>'; }).join('');
    var xt = '';
    if (cfg.xtb){ var xts = stTablesFor(dayISO, cfg.xtCount);
      xt = '<div class="ds-divider">back of sheet · ×tables</div><div class="ds-xtgrid">' +
        xts.map(function (q, i){ return '<div class="ds-xt"><span class="ds-xtn">' + (i + 1) + '</span>' + GRQ(q) + '</div>'; }).join('') + '</div>';
    }
    var note = 'this is exactly the A4 sheet that prints — same questions, same layout' + (cfg.xtb ? ' · ×tables on the back' : '');
    v.innerHTML = teachHead('starter', fmtWB(stCurWeek),
        '<button class="back-link" id="freshDay" style="color:var(--muted)">⟳ fresh set</button><button class="pill pill-ghost" id="printDay" style="margin-left:6px">🖨 Print</button>') +
      '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:21px;font-weight:700;letter-spacing:-.01em">' + esc(stDayFull(stCurWeek, stCurDay)) + '</span>' + badge + '</div>' +
      '<div class="ds-sheet">' +
        '<div class="ds-sheethead"><b>Mental Starter</b><span>name ________&nbsp;&nbsp;date ________</span></div>' +
        '<div class="ds-grid">' + cells + '</div>' + xt +
      '</div>' +
      '<p class="hint small" style="text-align:center;margin:0">' + note + '</p>' +
      '<div style="display:flex;gap:10px">' +
        '<button class="dock" id="toBoard" style="flex:1.5">▶ Display on Whiteboard</button>' +
        '<button id="toScores" style="flex:1;background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:16px;padding:16px;font-size:15px;font-weight:700">Enter scores</button>' +
      '</div>';
    wireBack(v);
    document.getElementById('freshDay').onclick = function (){
      if ((stDayHasAnn(dayISO) || stDayHasScores(dayISO)) && !confirm('This day has annotations or scores. Generate a fresh set anyway? The old questions will be gone.')) return;
      stFreshDay(stCurWeek, stCurDay, stCfg().qCount); renderDayView(); toast('✓ Fresh questions for ' + stDayShort(stCurWeek, stCurDay) + ' — the old set is gone');
    };
    document.getElementById('printDay').onclick = function (){ stPrintDay(stCurWeek, stCurDay); };
    document.getElementById('toBoard').onclick = function (){ openWhiteboard(); };
    document.getElementById('toScores').onclick = function (){ teachGo('scores'); };
  }

  /* ── Whiteboard mode (full-screen takeover) ── */
  var wbTool = 'pen', wbPage = 0, wbFocus = null, wbPopup = null;
  var wbCanvas = null, wbCtx = null, wbLive = null, wbErasing = false, wbPenActive = false;
  function wbDayKey(){ return stDayISO(stCurWeek, stCurDay); }
  function wbQs(){ var d = stWeek(stCurWeek) || []; return d[stCurDay] || []; }
  function wbAnnKey(){ if (wbFocus != null) return wbDayKey() + ':q' + wbFocus; var p = wbPage || 0; return wbDayKey() + ':grid' + (p ? p : ''); }
  function openWhiteboard(){ wbPage = 0; wbFocus = null; wbPopup = null; wbTool = 'pen'; document.getElementById('whiteboard').style.display = 'flex'; renderWhiteboard(); }
  function closeWhiteboard(){ document.getElementById('whiteboard').style.display = 'none'; teachGo('day'); }
  function tbStyle(on){ return on ? 'background:var(--teal-50);border:1.5px solid var(--teal-600);color:var(--teal-700);font-weight:700' : ''; }
  function renderWhiteboard(){
    var wb = document.getElementById('whiteboard'), qs = wbQs(), pages = Math.max(1, Math.ceil(qs.length / 10)), grid = wbFocus == null, stage;
    if (grid){
      var page = Math.min(wbPage, pages - 1), pageQs = qs.slice(page * 10, page * 10 + 10);
      stage = '<div class="wb-grid">' + pageQs.map(function (q, i){ return '<div class="wb-card"><span class="wb-num">' + (page * 10 + i + 1) + '</span><div class="wb-q">' + GRQ(q) + '</div></div>'; }).join('') + '</div>';
    } else {
      stage = '<div class="wb-focus"><span class="wb-num big">' + (wbFocus + 1) + '</span><div class="wb-q big">' + GRQ(qs[wbFocus]) + '</div></div>';
    }
    var pager = (grid && pages > 1) ? '<button class="wb-tb" id="wbPagePrev">‹</button><span class="wb-pagelbl">page ' + (Math.min(wbPage, pages - 1) + 1) + ' / ' + pages + '</span><button class="wb-tb" id="wbPageNext">›</button>' : '';
    var modeBtn = grid ? '<button class="wb-tb" id="wbFocusFirst">1 at a time ›</button>'
                       : '<button class="wb-tb" id="wbFocusPrev">‹</button><span class="wb-pagelbl">' + (wbFocus + 1) + ' / ' + qs.length + '</span><button class="wb-tb" id="wbFocusNext">›</button><button class="wb-tb" id="wbFocusAll">⊞ all</button>';
    wb.innerHTML =
      '<div class="wb-top">' +
        '<button class="wb-tb" id="wbExit">✕ exit</button>' +
        '<b style="font-size:15px">' + stDayShort(stCurWeek, stCurDay) + '</b>' +
        '<span style="font-size:12.5px;color:var(--faint)">' + fmtWB(stCurWeek) + '</span>' +
        '<span style="flex:1"></span>' +
        '<span class="wb-airplay">📡 AirPlay · classroom board</span>' +
        (stCurDay > 0 ? '<button class="wb-tb" id="wbPrevDay">‹ ' + stDayShort(stCurWeek, stCurDay - 1) + '</button>' : '') +
        (stCurDay < 4 ? '<button class="wb-tb" id="wbNextDay">' + stDayShort(stCurWeek, stCurDay + 1) + ' ›</button>' : '') +
      '</div>' +
      '<div class="wb-stage" id="wbStage">' + stage + '<canvas id="wbCanvas"></canvas>' + (wbPopup ? wbPopupHTML() : '') + '</div>' +
      '<div class="wb-toolbar">' +
        '<button class="wb-tb" id="wbPen" style="' + tbStyle(wbTool === 'pen') + '">✏ Pen</button>' +
        '<button class="wb-tb" id="wbRub" style="' + tbStyle(wbTool === 'rubber') + '">◌ Rubber</button>' +
        '<button class="wb-tb" id="wbClear">Clear all</button>' +
        '<span style="flex:1"></span>' +
        '<button class="wb-tb" id="wb100" style="' + tbStyle(wbPopup === 'hundred') + '">▦ 100 square</button>' +
        '<button class="wb-tb" id="wbTimes" style="' + tbStyle(wbPopup === 'times') + '">▦ × tables</button>' +
        pager + modeBtn +
      '</div>';
    document.getElementById('wbExit').onclick = closeWhiteboard;
    var pd = document.getElementById('wbPrevDay'); if (pd) pd.onclick = function (){ stCurDay--; wbPage = 0; wbFocus = null; renderWhiteboard(); };
    var nd = document.getElementById('wbNextDay'); if (nd) nd.onclick = function (){ stCurDay++; wbPage = 0; wbFocus = null; renderWhiteboard(); };
    document.getElementById('wbPen').onclick = function (){ wbTool = 'pen'; renderWhiteboard(); };
    document.getElementById('wbRub').onclick = function (){ wbTool = 'rubber'; renderWhiteboard(); };
    document.getElementById('wbClear').onclick = function (){ stClearDay(wbDayKey()); redrawWB(); toast('✓ Board cleared for ' + stDayShort(stCurWeek, stCurDay) + ' — annotations otherwise keep forever'); };
    document.getElementById('wb100').onclick = function (){ wbPopup = wbPopup === 'hundred' ? null : 'hundred'; renderWhiteboard(); };
    document.getElementById('wbTimes').onclick = function (){ wbPopup = wbPopup === 'times' ? null : 'times'; renderWhiteboard(); };
    var pp = document.getElementById('wbPagePrev'); if (pp) pp.onclick = function (){ wbPage = Math.max(0, wbPage - 1); renderWhiteboard(); };
    var pn = document.getElementById('wbPageNext'); if (pn) pn.onclick = function (){ wbPage = Math.min(pages - 1, wbPage + 1); renderWhiteboard(); };
    var ff = document.getElementById('wbFocusFirst'); if (ff) ff.onclick = function (){ wbFocus = Math.min(wbPage, pages - 1) * 10; renderWhiteboard(); };
    var fp = document.getElementById('wbFocusPrev'); if (fp) fp.onclick = function (){ wbFocus = Math.max(0, wbFocus - 1); renderWhiteboard(); };
    var fn = document.getElementById('wbFocusNext'); if (fn) fn.onclick = function (){ wbFocus = Math.min(qs.length - 1, wbFocus + 1); renderWhiteboard(); };
    var fa = document.getElementById('wbFocusAll'); if (fa) fa.onclick = function (){ wbPage = Math.floor(wbFocus / 10); wbFocus = null; renderWhiteboard(); };
    var px = document.getElementById('wbPopX'); if (px) px.onclick = function (){ wbPopup = null; renderWhiteboard(); };
    setupWBCanvas();
  }
  function wbPopupHTML(){
    var label = wbPopup === 'hundred' ? '100 square' : '× tables', cells = '';
    if (wbPopup === 'hundred'){ for (var n = 1; n <= 100; n++) cells += '<span class="wb-cell">' + n + '</span>'; }
    else { for (var r = 1; r <= 10; r++) for (var c = 1; c <= 10; c++){ cells += '<span class="wb-cell' + ((r === 1 || c === 1) ? ' hdr' : '') + '">' + (r * c) + '</span>'; } }
    return '<div class="wb-popup"><div class="wb-popup-head"><b>' + label + '</b><button id="wbPopX">✕</button></div><div class="wb-popup-grid">' + cells + '</div></div>';
  }
  function wbPt(e){ var r = wbCanvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
  function sizeWB(){ if (!wbCanvas) return; var r = wbCanvas.getBoundingClientRect(); if (!r.width || !r.height) return; var dpr = window.devicePixelRatio || 1; wbCanvas.width = Math.round(r.width * dpr); wbCanvas.height = Math.round(r.height * dpr); redrawWB(); }
  function redrawWB(){
    if (!wbCtx) return; wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
    var strokes = stLayer(wbAnnKey()).concat(wbLive ? [wbLive] : []);
    wbCtx.strokeStyle = '#2f55e0'; wbCtx.lineCap = 'round'; wbCtx.lineJoin = 'round'; wbCtx.lineWidth = Math.max(3, wbCanvas.width / 340);
    strokes.forEach(function (st){ wbCtx.beginPath(); st.pts.forEach(function (p, i){ var x = p[0] * wbCanvas.width, y = p[1] * wbCanvas.height; i ? wbCtx.lineTo(x, y) : wbCtx.moveTo(x, y); }); wbCtx.stroke(); });
  }
  function eraseWB(p){
    var key = wbAnnKey(), list = stLayer(key);
    var hit = function (st){ return st.pts.some(function (q){ return Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.028; }); };
    if (list.some(hit)){ stSetLayer(key, list.filter(function (st){ return !hit(st); })); redrawWB(); }
  }
  function setupWBCanvas(){
    wbCanvas = document.getElementById('wbCanvas'); if (!wbCanvas) return; wbCtx = wbCanvas.getContext('2d'); wbLive = null;
    wbCanvas.onpointerdown = function (e){
      if (e.pointerType === 'pen') wbPenActive = true;
      if (e.pointerType === 'touch' && wbPenActive) return;          // palm rejection
      e.preventDefault(); try { wbCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (wbTool === 'rubber'){ wbErasing = true; eraseWB(wbPt(e)); return; }
      wbLive = { pts: [wbPt(e)] };
    };
    wbCanvas.onpointermove = function (e){
      if (e.pointerType === 'touch' && wbPenActive) return;
      if (wbErasing){ eraseWB(wbPt(e)); return; }
      if (!wbLive) return; wbLive.pts.push(wbPt(e)); redrawWB();
    };
    var up = function (e){
      if (e && e.pointerType === 'pen') wbPenActive = false;
      if (wbErasing){ wbErasing = false; return; }
      if (!wbLive) return; var st = wbLive; wbLive = null;
      if (st.pts.length < 2) st.pts.push([st.pts[0][0] + 0.003, st.pts[0][1] + 0.003]);
      var key = wbAnnKey(); stSetLayer(key, stLayer(key).concat([st])); redrawWB();
    };
    wbCanvas.onpointerup = up; wbCanvas.onpointercancel = up;
    setTimeout(sizeWB, 30);
  }

  /* ── Score entry (per open day; writes to the Mental Starters store) ── */
  var scoreSel = 0;
  function scoreDayISO(){ return stDayISO(stCurWeek, stCurDay); }
  function ensureScoreCol(){ var b = stScoreBlock(), d = scoreDayISO(); if (b.dates.indexOf(d) < 0){ b.dates.push(d); b.dates.sort(); } return b; }
  function renderScores(){
    var v = document.getElementById('tv-scores'), b = ensureScoreCol(), d = scoreDayISO(), list = sortedRoster();
    if (!list.length){ v.innerHTML = teachHead('day', stDayShort(stCurWeek, stCurDay), '') + '<div class="empty">Add pupils in Plan › Pupils first.</div>'; wireBack(v); return; }
    var rows = list.map(function (p, i){
      var cell = (b.scores[p.id] && b.scores[p.id][d]) || {}, sel = i === scoreSel, val = cell.v != null ? cell.v : (sel ? '|' : '—');
      return '<div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)"><span style="flex:1;font-weight:600;font-size:14.5px">' + esc(p.name) + '</span>' +
        '<button class="score-cell" data-i="' + i + '" style="width:64px;text-align:center;border-radius:10px;font-weight:700;font-size:14px;padding:' + (sel ? '8px 0;border:2px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700)' : '9px 0;border:1px solid var(--line);background:var(--card);color:var(--ink)') + '">' + esc(String(val)) + '</button>' +
        '<button class="ipad-tog" data-pid="' + p.id + '" style="border-radius:10px;padding:8px 13px;font-size:13px;' + (cell.ipad ? 'border:1.5px solid var(--gold-600);background:var(--gold-100)' : 'border:1px solid var(--line);background:var(--card);opacity:.35') + '">📱</button></div>';
    }).join('');
    var pad = ['1','2','3','4','5','6','7','8','9','0','⌫','↵'].map(function (k){ return '<button class="pad" data-k="' + k + '" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 0;font-size:16px;font-weight:700;color:var(--ink)">' + k + '</button>'; }).join('');
    v.innerHTML = teachHead('day', stDayShort(stCurWeek, stCurDay), '<span class="pill pill-saved"><span>✓</span> saved · ' + stDayShort(stCurWeek, stCurDay) + ' column</span>') +
      '<div style="flex:1;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px 14px;min-height:0">' + rows + '</div>' +
      '<p class="hint small" style="margin:0;text-align:center">Tap a pupil, then tap the keypad — or just type on your keyboard (↵ / ↓ moves to the next pupil).</p>' +
      '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px">' + pad + '</div>';
    wireBack(v);
    v.querySelectorAll('.score-cell').forEach(function (b2){ b2.onclick = function (){ scoreSel = +b2.dataset.i; renderScores(); }; });
    v.querySelectorAll('.ipad-tog').forEach(function (b2){ b2.onclick = function (){ toggleIpad(b2.dataset.pid); }; });
    v.querySelectorAll('.pad').forEach(function (b2){ b2.onclick = function (){ padKey(b2.dataset.k); }; });
  }
  function padKey(k){
    var b = ensureScoreCol(), d = scoreDayISO(), list = sortedRoster(), p = list[scoreSel]; if (!p) return;
    if (k === '↵'){ scoreSel = Math.min(scoreSel + 1, list.length - 1); renderScores(); return; }
    if (!b.scores[p.id]) b.scores[p.id] = {};
    if (!b.scores[p.id][d]) b.scores[p.id][d] = { v: null, ipad: false };
    var cur = b.scores[p.id][d].v; cur = cur == null ? '' : String(cur);
    var next = k === '⌫' ? cur.slice(0, -1) : (cur.length >= 2 ? cur : cur + k);
    b.scores[p.id][d].v = next === '' ? null : Number(next);
    if (typeof msSave === 'function') msSave(); flashSaved(); renderScores();
  }
  function toggleIpad(pid){
    var b = ensureScoreCol(), d = scoreDayISO();
    if (!b.scores[pid]) b.scores[pid] = {};
    if (!b.scores[pid][d]) b.scores[pid][d] = { v: null, ipad: false };
    b.scores[pid][d].ipad = !b.scores[pid][d].ipad;
    if (typeof msSave === 'function') msSave(); flashSaved(); renderScores();
  }

  /* ── Print (one renderer; reuses the existing .gen-day A4 print CSS) ── */
  function stSheetHTML(label, title, questions, isTables){
    var cells = questions.map(function (q, i){ return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('');
    return '<div class="card gen-sheet gen-day"><h2 class="gen-heading">' + (label ? '<span class="gen-day-name">' + esc(label) + '</span> · ' : '') + esc(title) + '</h2><div class="gen-grid' + (isTables ? ' gen-grid-tables' : '') + '">' + cells + '</div></div>';
  }
  function stPrintHTML(html){ var c = document.getElementById('starterPrint'); c.innerHTML = html; window.print(); }
  function stDayPagesHTML(monday, i){
    var days = stWeek(monday) || [], qs = days[i] || [], dayISO = stDayISO(monday, i), cfg = stCfg(), label = stDayFull(monday, i), html = '';
    html += stSheetHTML(label, 'Mental Starter — ' + currentHalfTerm(), qs, false);   // all questions on one A4 page
    if (cfg.xtb) html += stSheetHTML(label, 'Times tables', stTablesFor(dayISO, cfg.xtCount), true);
    return html;
  }
  function stPrintDay(monday, i){ stPrintHTML(stDayPagesHTML(monday, i)); }
  function stPrintWeek(monday){ var html = ''; for (var i = 0; i < 5; i++) html += stDayPagesHTML(monday, i); stPrintHTML(html); }

  /* ── Pick a name (uses the tp_picker store, no-repeats) ── */
  function renderPick() {
    var v = document.getElementById('tv-pick');
    var st = Store.get('tp_picker', { noRepeats: true, picked: [], currentId: null });
    var name = st.currentId ? pupilName(st.currentId) : '—';
    var counter = (st.picked ? st.picked.length : 0) + ' of ' + roster.length + ' had a turn';
    v.innerHTML = teachHead('home', 'Home', '<span style="font-size:12.5px;color:var(--faint);font-weight:600">' + counter + '</span>') +
      '<div class="glance" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;border-radius:20px">' +
        '<span style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--faint)">' + (st.currentId ? 'Your turn,' : 'Tap pick to start') + '</span>' +
        '<div style="font-size:52px;font-weight:800;letter-spacing:-.02em;color:var(--teal-700);line-height:1.1">' + esc(name) + '</div>' +
        '<span style="font-size:13px;color:var(--muted)">no repeats until everyone has had a turn</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<button class="dock" id="pickBtn" style="flex:1.4">Pick someone</button>' +
        '<button id="pickReset" style="flex:1;background:var(--card);border:1px solid var(--line);color:var(--muted);border-radius:16px;padding:17px;font-size:15px;font-weight:700">Start afresh</button>' +
      '</div>';
    wireBack(v);
    document.getElementById('pickBtn').onclick = function () {
      var st = Store.get('tp_picker', { noRepeats: true, picked: [], currentId: null });
      var remaining = roster.filter(function (p) { return (st.picked || []).indexOf(p.id) === -1; });
      if (!remaining.length) { toast('Everyone has had a turn — start afresh!'); return; }
      var pick = remaining[Math.floor(Math.random() * remaining.length)];
      st.picked = (st.picked || []).concat(pick.id); st.currentId = pick.id; st.noRepeats = true;
      Store.set('tp_picker', st); flashSaved(); renderPick();
    };
    document.getElementById('pickReset').onclick = function () {
      var st = Store.get('tp_picker', {}); st.picked = []; st.currentId = null; Store.set('tp_picker', st); renderPick();
    };
  }

  /* ── Who sits where (read-only from seating store) ── */
  function renderSeats() {
    var v = document.getElementById('tv-seats');
    var seat = Store.get('tp_seating', null);
    var cards = '';
    if (seat && seat.groups && seat.groups.length) {
      cards = seat.groups.map(function (g, i) {
        var names = g.map(function (id) { return pupilName(id); }).join(' · ');
        return tableCard('Table ' + (i + 1), names || '—');
      }).join('');
    } else {
      // fall back to 6 tables of 5 from the roster
      var list = sortedRoster();
      for (var i = 0; i < Math.max(1, Math.ceil(list.length / 5)); i++) {
        cards += tableCard('Table ' + (i + 1), list.slice(i * 5, i * 5 + 5).map(function (p) { return p.name; }).join(' · ') || '—');
      }
    }
    v.innerHTML = teachHead('home', 'Home', '<span style="font-size:12px;color:var(--faint);font-weight:600">read-only here — rearrange in Plan › Organise</span>') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start">' + cards + '</div>';
    wireBack(v);
  }
  function tableCard(label, names) {
    return '<div class="glance" style="border-radius:14px;padding:12px 14px"><b style="font-size:13px;color:var(--teal-700);display:block;margin-bottom:6px">' + esc(label) + '</b>' +
      '<span style="font-size:13px;color:var(--muted);line-height:1.6">' + esc(names) + '</span></div>';
  }

  /* ===================================================================
     PLAN MODE — sidebar regroup + aggregator pages
     =================================================================== */
  var PLAN_NAV = [
    { page: 'today', label: 'Today', icon: 'home' },
    { page: 'pupils', label: 'Pupils', icon: 'users' },
    { page: 'markbook', label: 'Markbook', icon: 'bar-chart-2' },
    { page: 'organise', label: 'Organise', icon: 'layout-grid' },
    { page: 'reports', label: 'Reports', icon: 'file-text' }
  ];

  function move(fromSel, to) {
    var src = document.querySelector(fromSel); if (!src || !to) return;
    Array.prototype.slice.call(src.children).forEach(function (c) { if (!c.classList.contains('page-header')) to.appendChild(c); });
  }

  function buildPlan() {
    /* sidebar: Open Teach button + 6-item nav + Settings gear */
    var nav = document.querySelector('#planApp .navwrap');
    nav.innerHTML =
      '<button class="open-teach" id="openTeach">' + svg('play', 16) + ' Open Teach</button>' +
      PLAN_NAV.map(function (n) {
        return '<button class="nav-link" data-page="' + n.page + '"><span class="ico">' + svg(n.icon, 18) + '</span> <span>' + n.label + '</span>' +
          (n.page === 'pupils' ? '<span class="count" id="navClassCount"></span>' : '') + '</button>';
      }).join('');
    document.getElementById('openTeach').onclick = function () { setMode('teach'); };

    var foot = document.querySelector('#planApp .sidefoot');
    foot.removeAttribute('onclick'); foot.style.cursor = 'default';
    if (!foot.querySelector('.gear')) {
      var gear = document.createElement('button'); gear.className = 'gear'; gear.title = 'Settings'; gear.innerHTML = svg('gear', 18);
      gear.onclick = function () { go('settings'); }; foot.appendChild(gear);
    }
    var who = foot.querySelector('#sideWho'); if (who && who.parentNode) { who.parentNode.style.cursor = 'pointer'; who.parentNode.onclick = function () { go('settings'); }; }

    var content = document.querySelector('#planApp .content');
    function section(id) { var s = document.createElement('section'); s.className = 'page'; s.id = 'page-' + id; content.appendChild(s); return s; }

    /* Today */
    var today = section('today'); today.innerHTML = '<div id="today-root"></div>';
    /* Pupils */
    var pupils = section('pupils');
    pupils.innerHTML = '<div id="pupils-root"></div>' +
      '<div id="manageClass" class="card" style="display:none;margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Manage class</h2><button class="secondary small" id="closeManage">Close</button></div><div id="manageBody"></div></div>';
    /* Pupil record */
    var pupil = section('pupil'); pupil.innerHTML = '<div id="pupil-root"></div>';
    /* Markbook */
    var mb = section('markbook');
    mb.innerHTML =
      '<div class="page-header"><h1>Markbook</h1><p>Assessments, mental-starter scores and progress charts in one place. Pupil names link to their record.</p></div>' +
      '<div class="tabs" id="mbTabs"></div>' +
      '<div class="subview" id="mb-assessments"></div>' +
      '<div class="subview" id="mb-starters"></div>' +
      '<div class="subview" id="mb-charts"></div>';
    /* Organise */
    var org = section('organise');
    org.innerHTML =
      '<div class="page-header"><h1>Organise</h1><p>Edit your timetable, seating &amp; groups and reading groups.</p></div>' +
      '<div class="tabs" id="orgTabs"></div>' +
      '<div class="subview" id="org-timetable"></div>' +
      '<div class="subview" id="org-seating"></div>' +
      '<div class="subview" id="org-reading"></div>';
    /* Settings */
    var settings = section('settings');
    settings.innerHTML = '<div class="page-header"><h1>Settings</h1><p>Your profile, plus backup &amp; data.</p></div><div id="settings-profile"></div><div id="settings-data"></div>';

    /* relocate existing content into the aggregators */
    move('#page-assessments', document.getElementById('mb-assessments'));
    move('#page-mental-starters', document.getElementById('mb-starters'));
    move('#page-charts', document.getElementById('mb-charts'));
    move('#page-timetable', document.getElementById('org-timetable'));
    move('#page-seating', document.getElementById('org-seating'));
    move('#page-reading-groups', document.getElementById('org-reading'));
    move('#page-class-list', document.getElementById('manageBody'));
    move('#page-profile', document.getElementById('settings-profile'));
    move('#page-data', document.getElementById('settings-data'));

    /* sub-tabs */
    buildTabs('mbTabs', [['mb-assessments', 'Assessments'], ['mb-starters', 'Starter scores'], ['mb-charts', 'Charts']], function (id) {
      if (id === 'mb-assessments' && typeof asRender === 'function') asRender();
      if (id === 'mb-starters' && typeof msRender === 'function') msRender();
      if (id === 'mb-charts' && typeof chRender === 'function') chRender();
    });
    buildTabs('orgTabs', [['org-timetable', 'Timetable'], ['org-seating', 'Seating & Groups'], ['org-reading', 'Reading Groups']], function (id) {
      if (id === 'org-timetable' && typeof ttRender === 'function') ttRender();
      if (id === 'org-seating' && typeof seatRender === 'function') seatRender();
      if (id === 'org-reading' && typeof rgGroupsRender === 'function') rgGroupsRender();
    });

    /* manage-class panel toggle */
    document.getElementById('closeManage').onclick = function () { document.getElementById('manageClass').style.display = 'none'; };

    /* rebind nav clicks (replaced DOM) */
    document.querySelectorAll('#planApp .nav-link').forEach(function (b) { b.onclick = function () { go(b.dataset.page); }; });
  }

  function buildTabs(hostId, tabs, onShow) {
    var host = document.getElementById(hostId); if (!host) return;
    host._tabs = tabs; host._onShow = onShow;
    host.innerHTML = tabs.map(function (t, i) { return '<button class="tab' + (i === 0 ? ' active' : '') + '" data-sub="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('');
    host.querySelectorAll('[data-sub]').forEach(function (b) { b.onclick = function () { showSub(hostId, b.dataset.sub); }; });
    showSub(hostId, tabs[0][0]);
  }
  function showSub(hostId, subId) {
    var host = document.getElementById(hostId);
    host.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.sub === subId); });
    var parent = host.parentNode;
    parent.querySelectorAll('.subview').forEach(function (s) { s.classList.toggle('active', s.id === subId); });
    if (host._onShow) host._onShow(subId);
  }

  /* ── Plan › Today ── */
  function weekCounts() {
    var monday = mondayOf();
    var c = { star: 0, praise: 0, concern: 0, glow: 0 };
    (spData || []).forEach(function (e) { if (mondayOf(e.date) === monday) c.star++; });
    (bhData || []).forEach(function (e) {
      if (mondayOf(e.date) !== monday) return;
      var glow = e.note && /Battler|Glow|Quick log/i.test(e.note) && e.type === 'positive';
      if (e.type === 'positive') { glow ? c.glow++ : c.praise++; }
      else if (e.type === 'concern') c.concern++;
    });
    return c;
  }
  function buildNudges() {
    var n = [];
    var term = currentAssessTerm();
    var block = (asData && asData[term]) || {};
    var entered = roster.filter(function (p) { var r = block[p.id] || {}; return (Number(r.num1) || Number(r.num2)); }).length;
    if (roster.length && entered < roster.length) n.push({ b: term + ' marks', t: ' — ' + entered + ' of ' + roster.length + ' entered', go: 'markbook', link: 'Markbook ›' });
    var monday = mondayOf();
    var concerns = (bhData || []).filter(function (e) { return e.type === 'concern' && mondayOf(e.date) === monday; }).length;
    if (concerns) n.push({ b: concerns + ' concern' + (concerns === 1 ? '' : 's'), t: ' this week to review', go: 'pupils', link: 'Pupils ›' });
    var starThisWeek = (spData || []).some(function (e) { return mondayOf(e.date) === monday; });
    if (roster.length && !starThisWeek) n.push({ b: 'Star pupil', t: ' not chosen this week', go: 'pupils', link: 'Pupils ›' });
    if (!stWeek(addDaysISO(monday, 7))) n.push({ b: "Next week's starter", t: ' not set yet', go: '__teach_starter', link: 'Starter ›' });
    return n;
  }
  function renderToday() {
    var root = document.getElementById('today-root'); if (!root) return;
    var nn = nowNext();
    var ps = todayPeriods();
    var now = new Date().getHours() * 60 + new Date().getMinutes();
    var ttHTML = ps.length ? ps.map(function (p, i) {
      var isNow = nn && nn.now && p.mins === nn.now.mins;
      return '<div class="tt-row' + (isNow ? ' now' : (p.isBreak ? ' break' : '')) + '"><span class="t">' + esc(p.time) + '</span><span>' + esc(p.subject || '—') + (isNow ? ' · now' : '') + '</span></div>';
    }).join('') : '<div class="empty">No timetable yet — add one in Organise.</div>';

    var nudges = buildNudges();
    var nudgeHTML = nudges.length ? nudges.map(function (x) {
      return '<div class="nudge"><b>' + esc(x.b) + esc(x.t) + '</b><button class="go" data-go="' + x.go + '">' + esc(x.link) + '</button></div>';
    }).join('') : '<div class="empty" style="padding:18px">All caught up — nothing needs doing ✓</div>';

    var c = weekCounts();
    var greet = (new Date().getHours() < 12 ? 'Good morning' : (new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'));
    var eyebrow = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + currentHalfTerm();

    root.innerHTML =
      '<div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">' +
        '<div><div class="eyebrow">' + esc(eyebrow) + '</div><h1 style="margin:4px 0 0">' + greet + ' — here\'s your day</h1></div>' +
        '<span class="pill pill-saved" style="font-size:12px;padding:5px 11px"><span>✓</span> All changes saved</span></div>' +
      '<div class="today-grid">' +
        '<div class="card"><h2>Today\'s timetable</h2><div class="tt-list">' + ttHTML + '</div></div>' +
        '<div class="card"><h2>Needs doing</h2>' + nudgeHTML + '</div>' +
        '<div class="card"><h2>This week so far</h2>' +
          '<div class="weekcount star"><span class="n">' + c.star + '</span><span class="l">★ star pupil</span></div>' +
          '<div class="weekcount praise"><span class="n">' + c.praise + '</span><span class="l">👍 praise notes</span></div>' +
          '<div class="weekcount concern"><span class="n">' + c.concern + '</span><span class="l">⚠ concerns</span></div>' +
          '<div class="weekcount glow"><span class="n">' + c.glow + '</span><span class="l">⚡ Glow Getter points</span></div>' +
          '<p class="hint small" style="margin-top:10px">live — includes anything logged in Teach</p>' +
        '</div></div>';
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { var g = b.dataset.go; if (g === '__teach_starter') { setMode('teach'); teachGo('starter'); } else go(g); };
    });
  }

  /* ── Plan › Pupils ── */
  function pupilSub(p) {
    var bits = [];
    if (p.send && p.send !== 'None') bits.push(p.send === 'EHCP' ? 'EHCP' : 'SEND');
    if (p.pp) bits.push('PP');
    var rg = readingGroupName(p.id); if (rg) bits.push(rg);
    return bits.join(' · ');
  }
  function renderPupils() {
    var root = document.getElementById('pupils-root'); if (!root) return;
    var list = sortedRoster();
    var grid = list.length ? list.map(function (p) {
      return '<button class="pupil-card" data-pid="' + p.id + '"><span class="nm">' + esc(p.name) + '</span><span class="sub">' + esc(pupilSub(p)) + '</span></button>';
    }).join('') : '<div class="empty">No pupils yet. Use “Manage class ›”.</div>';

    function glCard(title, cls, badge, kind, rows) {
      return '<div class="gl-card"><div class="gl-head"><span class="gl-title">' + title + '</span><span class="gl-badge ' + cls + '">' + badge + '</span></div>' +
        (rows || '<div class="hint small">None recorded</div>') + '</div>';
    }
    function rowsFor(filter, detail) {
      var r = list.filter(filter);
      if (!r.length) return '';
      return r.map(function (p) { return '<div class="gl-row"><span class="nm" data-pid="' + p.id + '">' + esc(p.name) + '</span><span class="det">' + esc(detail(p)) + '</span></div>'; }).join('');
    }
    var send = rowsFor(function (p) { return p.send && p.send !== 'None'; }, function (p) { return p.send + (p.notes ? '' : ''); });
    var pp = rowsFor(function (p) { return p.pp; }, function () { return 'Pupil Premium'; });
    var allergy = rowsFor(function (p) { return p.allergies; }, function (p) { return p.allergyNotes || 'allergy'; });
    var health = rowsFor(function (p) { return p.medical; }, function (p) { return p.medicalNotes || 'medical'; });
    var sendN = list.filter(function (p) { return p.send && p.send !== 'None'; }).length;
    var ppN = list.filter(function (p) { return p.pp; }).length;
    var alN = list.filter(function (p) { return p.allergies; }).length;
    var heN = list.filter(function (p) { return p.medical; }).length;

    root.innerHTML =
      '<div class="page-header" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<h1 style="margin:0">Pupils <span style="font-size:15px;color:var(--faint);font-weight:600">· ' + list.length + '</span></h1>' +
        '<button id="manageBtn" style="background:var(--teal-50);color:var(--teal-600);border:0">Manage class ›</button></div>' +
      '<div class="pupil-grid">' + grid + '</div>' +
      '<div style="margin:26px 0 12px"><div style="display:flex;align-items:baseline;gap:10px"><h2 style="font-size:16px;margin:0">Class at a glance</h2>' +
        '<span class="hint small">key context in one view — tap a name for the full record</span></div></div>' +
      '<div class="glance-cards">' +
        glCard('SEND', 'send', sendN, 'send', send) +
        glCard('Pupil Premium', 'pp', ppN, 'pp', pp) +
        glCard('Allergies', 'allergy', alN, 'allergy', allergy) +
        glCard('Health', 'health', heN, 'health', health) +
      '</div>';
    root.querySelectorAll('[data-pid]').forEach(function (b) { b.onclick = function () { openRecord(b.dataset.pid); }; });
    document.getElementById('manageBtn').onclick = function () {
      var m = document.getElementById('manageClass'); m.style.display = 'block';
      if (typeof rosRender === 'function') rosRender();
      m.scrollIntoView({ behavior: 'smooth' });
    };
    var el = document.getElementById('navClassCount'); if (el) el.textContent = list.length || '';
  }

  /* ── Plan › Pupil record ── */
  var openPid = null;
  function openRecord(pid) { openPid = pid; go('pupil'); }
  function pupilTimeline(pid) {
    var items = [];
    (bhData || []).filter(function (e) { return e.pupilId === pid; }).forEach(function (e) {
      var glow = e.note && /Battler|Glow|Quick log/i.test(e.note) && e.type === 'positive';
      var kind = glow ? 'glow' : (e.type === 'positive' ? 'praise' : (e.type === 'concern' ? 'concern' : 'note'));
      items.push({ date: e.date, kind: kind, label: glow ? 'Glow Getter point' : (kind === 'praise' ? 'Praise' : kind === 'concern' ? 'Concern' : 'Note'), note: e.note });
    });
    (spData || []).filter(function (e) { return e.pupilId === pid; }).forEach(function (e) { items.push({ date: e.date, kind: 'star', label: 'Star pupil', note: e.reason }); });
    return items.sort(function (a, b) { return b.date.localeCompare(a.date); });
  }
  function termMarks(pid) {
    var out = [];
    ASSESS_TERMS.forEach(function (t) {
      var r = (asData[t] || {})[pid] || {};
      var num = (Number(r.num1) || 0) + (Number(r.num2) || 0);
      out.push({ term: t, val: num });
    });
    return out;
  }
  function starterAvg(pid) {
    var vals = [];
    Object.keys(msData || {}).forEach(function (ht) {
      var row = (msData[ht].scores || {})[pid] || {};
      Object.keys(row).forEach(function (d) { if (row[d] && row[d].v != null) vals.push(row[d].v); });
    });
    if (!vals.length) return null;
    return (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1);
  }
  function renderRecord() {
    var root = document.getElementById('pupil-root'); if (!root) return;
    var p = roster.find(function (x) { return x.id === openPid; });
    if (!p) { root.innerHTML = '<div class="empty">Pupil not found. <button class="link" onclick="go(\'pupils\')">Back to Pupils</button></div>'; return; }
    var chips = '';
    if (p.send && p.send !== 'None') chips += '<span class="chip send">' + esc(p.send) + '</span>';
    if (p.pp) chips += '<span class="chip pp">Pupil Premium</span>';
    if (p.allergies) chips += '<span class="chip allergy">⚠ ' + esc(p.allergyNotes ? p.allergyNotes.split(/[,.;]/)[0] : 'allergy') + '</span>';
    if (p.ehcpLink) chips += '<span class="chip ehcp">EHCP plan</span>';
    var rg = readingGroupName(p.id);
    var starCount = (spData || []).filter(function (e) { return e.pupilId === p.id; }).length;
    var sub = [rg && (rg + ' (reading)'), 'star pupil ×' + starCount].filter(Boolean).join(' · ');

    var tl = pupilTimeline(p.id);
    var tlHTML = tl.length ? tl.map(function (e) {
      return '<div class="tl-item ' + e.kind + '"><div class="tl-top"><span class="tl-kind">' + esc(e.label) + '</span><span class="tl-date">' + fmtDate(e.date) + '</span></div>' +
        (e.note ? '<div class="tl-note">' + esc(e.note) + '</div>' : '') + '</div>';
    }).join('') : '<div class="empty">Nothing logged yet. Use “Log something”.</div>';

    var marks = termMarks(p.id);
    var maxv = Math.max(10, Math.max.apply(null, marks.map(function (m) { return m.val; })));
    var ramp = ['#dde4fb', '#b5c4f4', '#6b86ec', '#2f55e0'];
    var marksHTML = marks.map(function (m, i) {
      return '<div class="termbar"><div class="lab"><span>' + esc(m.term) + '</span><span>' + (m.val || '—') + '</span></div>' +
        '<div class="track"><div class="fill" style="width:' + Math.round((m.val / maxv) * 100) + '%;background:' + ramp[i] + '"></div></div></div>';
    }).join('');
    var avg = starterAvg(p.id);

    root.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--faint);font-weight:600;margin-bottom:14px">' +
        '<button class="link" id="crumb">Pupils</button> › ' + esc(p.name) + '</div>' +
      '<div class="card rec-head">' +
        '<span class="rec-avatar">' + esc(initials(p.name)) + '</span>' +
        '<div style="flex:1;min-width:200px"><span class="rec-name">' + esc(p.name) + '</span>' +
          '<div class="rec-chips">' + chips + '</div>' +
          (sub ? '<div class="hint small" style="margin-top:4px">' + esc(sub) + '</div>' : '') +
          (p.ehcpLink ? ' <a href="' + esc(p.ehcpLink) + '" target="_blank" class="link">EHCP plan ↗</a>' : '') +
        '</div>' +
        '<button id="logBtn" style="background:var(--teal-600);color:#fff">' + svg('plus', 16) + ' Log something</button>' +
      '</div>' +
      '<div class="rec-grid">' +
        '<div class="card"><h2>Context</h2>' +
          ctxField(p, 'send', 'SEND status', ['None', 'SEN Support', 'EHCP']) +
          '<label>OneDrive SEND / EHCP plan link</label><input value="' + esc(p.ehcpLink || '') + '" placeholder="Paste OneDrive link" onchange="rosEdit(\'' + p.id + '\',\'ehcpLink\',this.value)" />' +
          '<label>Allergies</label><textarea onchange="rosEdit(\'' + p.id + '\',\'allergyNotes\',this.value);rosEdit(\'' + p.id + '\',\'allergies\',!!this.value)" placeholder="Allergens, EpiPen location…">' + esc(p.allergyNotes || '') + '</textarea>' +
          '<label>Medical / health</label><textarea onchange="rosEdit(\'' + p.id + '\',\'medicalNotes\',this.value);rosEdit(\'' + p.id + '\',\'medical\',!!this.value)" placeholder="Conditions, medication…">' + esc(p.medicalNotes || '') + '</textarea>' +
          '<label>Key notes</label><textarea onchange="rosEdit(\'' + p.id + '\',\'notes\',this.value)" placeholder="Strategies that work, context…">' + esc(p.notes || '') + '</textarea>' +
        '</div>' +
        '<div class="card"><h2>Timeline</h2><div class="timeline">' + tlHTML + '</div></div>' +
        '<div class="card"><h2>Marks</h2>' + marksHTML +
          '<p class="hint small" style="margin-top:10px">starter average <b style="color:var(--ink)">' + (avg != null ? avg + ' / 22' : '—') + '</b></p>' +
          '<button class="link" id="toMarkbook">open in Markbook ›</button></div>' +
      '</div>';
    document.getElementById('crumb').onclick = function () { go('pupils'); };
    document.getElementById('logBtn').onclick = function () { openQuickLog(p.id); };
    document.getElementById('toMarkbook').onclick = function () { go('markbook'); };
  }
  function ctxField(p, field, label, opts) {
    return '<label>' + label + '</label><select onchange="rosEdit(\'' + p.id + '\',\'' + field + '\',this.value)">' +
      opts.map(function (o) { return '<option' + (p[field] === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
  }

  /* ===================================================================
     NAVIGATION WIRING (extend the existing renderPage)
     =================================================================== */
  function hubRenderPage(page) {
    if (page === 'today') renderToday();
    else if (page === 'pupils') renderPupils();
    else if (page === 'pupil') renderRecord();
    else if (page === 'markbook') { var h = document.getElementById('mbTabs'); if (h) { var sub = h.querySelector('.tab.active'); showSub('mbTabs', sub ? sub.dataset.sub : 'mb-assessments'); } }
    else if (page === 'organise') { var h2 = document.getElementById('orgTabs'); if (h2) { var s2 = h2.querySelector('.tab.active'); showSub('orgTabs', s2 ? s2.dataset.sub : 'org-timetable'); } }
    else if (page === 'settings') { if (typeof renderProfile === 'function') renderProfile(); }
  }

  /* ===================================================================
     MODE
     =================================================================== */
  function deviceDefaultMode() {
    var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    return (coarse || window.innerWidth < 1024) ? 'teach' : 'plan';
  }
  function setMode(m) {
    Store.set('tp_mode', m);
    document.body.dataset.mode = m;
    window.scrollTo(0, 0);
    if (m === 'teach') teachGo(teachScreen || 'home');
    else { var hash = location.hash.replace('#', ''); var valid = ['today', 'pupils', 'pupil', 'markbook', 'organise', 'reports', 'settings'].indexOf(hash) !== -1; go(valid ? hash : 'today'); }
  }
  window.hubSetMode = setMode;

  /* ===================================================================
     BOOT
     =================================================================== */
  function init() {
    stMigrateDates();
    buildTeachShell();
    buildPlan();

    /* extra shared DOM: new-week sheet, whiteboard overlay, print container */
    document.body.insertAdjacentHTML('beforeend',
      '<div class="ql-backdrop" id="stBackdrop"><div class="ql-sheet" id="stSheet"></div></div>' +
      '<div id="whiteboard"></div>' +
      '<div id="starterPrint"></div>');
    var stb = document.getElementById('stBackdrop');
    if (stb) stb.addEventListener('click', function (e) { if (e.target === stb) closeNewWeek(); });
    window.addEventListener('resize', function () { if (document.getElementById('whiteboard').style.display === 'flex') sizeWB(); });
    window.addEventListener('afterprint', function () { var c = document.getElementById('starterPrint'); if (c) c.innerHTML = ''; });

    /* physical-keyboard entry on the score sheet (laptop / iPad keyboard) */
    document.addEventListener('keydown', function (e) {
      if (document.body.dataset.mode !== 'teach') return;
      var sv = document.getElementById('tv-scores'); if (!sv || !sv.classList.contains('active')) return;
      var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (/^[0-9]$/.test(e.key)) { padKey(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { padKey('⌫'); e.preventDefault(); }
      else if (e.key === 'Enter') { padKey('↵'); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { scoreSel = Math.min(scoreSel + 1, sortedRoster().length - 1); renderScores(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { scoreSel = Math.max(0, scoreSel - 1); renderScores(); e.preventDefault(); }
    });

    /* tap the dimmed backdrop (outside the sheet) to dismiss Quick log */
    var bd = document.getElementById('qlBackdrop');
    if (bd) bd.addEventListener('click', function (e) { if (e.target === bd) closeQuickLog(); });

    /* wrap the existing renderPage so new pages render too */
    var orig = window.renderPage;
    window.renderPage = function (page) { try { if (orig) orig(page); } catch (e) {} hubRenderPage(page); };

    /* re-render Teach when shared data changes */
    window.addEventListener('tp:sync', function () { if (document.body.dataset.mode === 'teach') teachGo(teachScreen); });

    var mode = Store.get('tp_mode', null) || deviceDefaultMode();
    document.body.dataset.mode = mode;
    if (mode === 'teach') teachGo('home');
    else { var hash = location.hash.replace('#', ''); var valid = ['today', 'pupils', 'pupil', 'markbook', 'organise', 'reports', 'settings'].indexOf(hash) !== -1; showPage(valid ? hash : 'today'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
