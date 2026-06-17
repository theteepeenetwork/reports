/* ===================================================================
   hub.js — Classroom Hub "Teach / Plan" redesign shell
   ------------------------------------------------------------------
   Recreates the design-handoff prototype on top of the existing
   vanilla-JS app: reuses Store, the shared `roster`, the per-feature
   modules (generator/picker/timetable/seating/groups/charts),
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

  /* Group lookups read the nested Groups tree (js/groups.js, store 'tp_groups').
     groupList() returns a flat list of every group node across all headings. */
  function groupList() { try { return (typeof grpFlatGroups === 'function') ? grpFlatGroups() : []; } catch (e) { return []; } }
  function readingGroupName(pupilId) {
    try { return (typeof grpGroupNameFor === 'function') ? grpGroupNameFor(pupilId) : ''; } catch (e) { return ''; }
  }
  function readingGroups() { return groupList(); }

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
      '<div class="teach-view" id="tv-points"></div>' +
      '<div class="teach-view" id="tv-seats"></div>' +
      '<div class="teach-view" id="tv-groups"></div>';
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
    if (screen === 'points') renderPoints();
    if (screen === 'seats') renderSeats();
    if (screen === 'groups') renderGroupsTeach();
  }

  function topRow() {
    var cls = '';
    try { cls = (typeof tpActiveClassMeta === 'function') ? (tpActiveClassMeta().name || '') : ''; } catch (e) {}
    var classPill = cls ? '<button class="pill pill-ghost" id="teachClassPill" title="Switch class">' + esc(cls) + ' ▾</button>' : '';
    return '<div class="teach-top">' +
      '<span class="teach-date">' + esc(todayLabel()) + '</span>' +
      '<span class="spacer"></span>' +
      classPill +
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
      tile('points', 'zap', 'Points', 'award glow getters fast', '') +
      tile('seats', 'layout-grid', 'Who sits where', 'seating · groups', '') +
      tile('groups', 'book-open', 'Groups', grpCountLabel(), '') +
      tile('glow', 'zap', 'Glow Getters', 'opens full-screen', '', true);

    v.innerHTML = topRow() + glance +
      '<div class="tile-grid">' + tiles + '</div>' +
      '<button class="dock" id="teachDock">' + svg('plus', 22) + ' Quick log</button>';

    document.getElementById('goPlan').onclick = function () { setMode('plan'); };
    var clsPill = document.getElementById('teachClassPill');
    if (clsPill && typeof window.openClassSwitcher === 'function') clsPill.onclick = function () { window.openClassSwitcher(); };
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
  var wbCanvas = null, wbCtx = null;
  /* Pencil / palm arbitration state.
     Every contact is tracked independently by pointerId (wbStrokes / wbErasers) so the pencil
     can never be blocked by leftover state from another pointer — the bug that dropped a pencil
     stroke when a palm was also resting on the board. A pen is always allowed to draw; finger /
     palm touches are rejected while a pencil is in use, and re-enabled once it's been idle. */
  var wbStrokes = {};       // pointerId -> in-progress stroke { pts:[…] }
  var wbErasers = {};       // pointerId -> true while that pointer is erasing
  var wbPenEver = false;    // has a pencil touched the canvas since the whiteboard opened?
  var wbLastPenAt = 0;      // timestamp (ms) of the most recent pen activity
  var WB_PEN_IDLE = 2500;   // ms the pencil must be idle before finger/palm drawing is re-enabled
  function wbDayKey(){ return stDayISO(stCurWeek, stCurDay); }
  function wbQs(){ var d = stWeek(stCurWeek) || []; return d[stCurDay] || []; }
  function wbAnnKey(){ if (wbFocus != null) return wbDayKey() + ':q' + wbFocus; var p = wbPage || 0; return wbDayKey() + ':grid' + (p ? p : ''); }
  function openWhiteboard(){ wbPage = 0; wbFocus = null; wbPopup = null; wbTool = 'pen'; wbPenEver = false; wbLastPenAt = 0; document.getElementById('whiteboard').style.display = 'flex'; renderWhiteboard(); }
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
    var live = []; for (var id in wbStrokes) live.push(wbStrokes[id]);
    var strokes = stLayer(wbAnnKey()).concat(live);
    wbCtx.strokeStyle = '#2f55e0'; wbCtx.lineCap = 'round'; wbCtx.lineJoin = 'round'; wbCtx.lineWidth = Math.max(3, wbCanvas.width / 340);
    strokes.forEach(function (st){ wbCtx.beginPath(); st.pts.forEach(function (p, i){ var x = p[0] * wbCanvas.width, y = p[1] * wbCanvas.height; i ? wbCtx.lineTo(x, y) : wbCtx.moveTo(x, y); }); wbCtx.stroke(); });
  }
  function eraseWB(p){
    var key = wbAnnKey(), list = stLayer(key);
    var hit = function (st){ return st.pts.some(function (q){ return Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.028; }); };
    if (list.some(hit)){ stSetLayer(key, list.filter(function (st){ return !hit(st); })); redrawWB(); }
  }
  /* True when a finger/palm touch must be ignored because the pencil is (or was just) in use.
     Pen and mouse are never blocked. Once a pencil has been seen, touch stays blocked until the
     pencil has been idle for WB_PEN_IDLE ms — so a palm resting through normal writing pauses
     can never start a stroke, but finger drawing returns once the pencil is set down. */
  function wbTouchBlocked(e){
    if (e.pointerType !== 'touch') return false;
    if (!wbPenEver) return false;
    return (Date.now() - wbLastPenAt) < WB_PEN_IDLE;
  }
  /* Expand a pointer event into its coalesced samples so fast pencil strokes stay smooth. */
  function wbSamples(e){
    if (e.getCoalescedEvents){ var c = e.getCoalescedEvents(); if (c && c.length) return c; }
    return [e];
  }
  function setupWBCanvas(){
    wbCanvas = document.getElementById('wbCanvas'); if (!wbCanvas) return; wbCtx = wbCanvas.getContext('2d');
    wbStrokes = {}; wbErasers = {};
    wbCanvas.onpointerdown = function (e){
      if (e.pointerType === 'pen'){
        var firstPen = !wbPenEver; wbPenEver = true; wbLastPenAt = Date.now();
        // First pencil contact: any strokes in progress were finger/palm — drop them so the
        // pencil starts clean. (A pen is never blocked, so it always proceeds below.)
        if (firstPen){ wbStrokes = {}; wbErasers = {}; redrawWB(); }
      } else if (wbTouchBlocked(e)) {
        return;                                  // pencil in use → reject finger / palm outright
      }
      e.preventDefault(); try { wbCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (wbTool === 'rubber'){ wbErasers[e.pointerId] = true; eraseWB(wbPt(e)); return; }
      wbStrokes[e.pointerId] = { pts: [wbPt(e)] };
    };
    wbCanvas.onpointermove = function (e){
      if (e.pointerType === 'pen') wbLastPenAt = Date.now();
      if (wbErasers[e.pointerId]){ wbSamples(e).forEach(function (ev){ eraseWB(wbPt(ev)); }); return; }
      var st = wbStrokes[e.pointerId]; if (!st) return;
      wbSamples(e).forEach(function (ev){ st.pts.push(wbPt(ev)); }); redrawWB();
    };
    var up = function (e){
      if (!e) return;
      if (e.pointerType === 'pen') wbLastPenAt = Date.now();
      try { wbCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
      if (wbErasers[e.pointerId]){ delete wbErasers[e.pointerId]; return; }
      var st = wbStrokes[e.pointerId]; if (!st) return; delete wbStrokes[e.pointerId];
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

    /* Glow Getters award row — only when someone is currently picked and the
       battler award path is available (it is loaded alongside this hub). */
    var glowRow = '';
    if (st.currentId && typeof window.btAward === 'function') {
      var step = (typeof window.btGetStep === 'function') ? window.btGetStep() : 1;
      var pts = (typeof window.btGetPoints === 'function') ? window.btGetPoints(st.currentId) : 0;
      glowRow =
        '<div class="glow-row">' +
          '<button class="glow-minus" id="pickGlowMinus" title="Take a glow getters point">−</button>' +
          '<div class="glow-tally"><span class="glow-n" id="pickGlowN">' + pts + '</span>' +
            '<span class="glow-l">⚡ glow getters points</span></div>' +
          '<button class="glow-plus" id="pickGlowPlus" title="Give a glow getters point">+' + step + '</button>' +
        '</div>';
    }

    v.innerHTML = teachHead('home', 'Home', '<span style="font-size:12.5px;color:var(--faint);font-weight:600">' + counter + '</span>') +
      '<div class="glance" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;border-radius:20px">' +
        '<span style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--faint)">' + (st.currentId ? 'Your turn,' : 'Tap pick to start') + '</span>' +
        '<div style="font-size:52px;font-weight:800;letter-spacing:-.02em;color:var(--teal-700);line-height:1.1">' + esc(name) + '</div>' +
        '<span style="font-size:13px;color:var(--muted)">no repeats until everyone has had a turn</span>' +
        glowRow +
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

    /* Award / remove a glow getters point for the currently picked pupil.
       Mirrors Quick log: silent award (no smartboard-only animations), then
       repaint just the tally so the picked name stays put. */
    var glowMinus = document.getElementById('pickGlowMinus');
    var glowPlus = document.getElementById('pickGlowPlus');
    function pickGlow(sign) {
      var cur = Store.get('tp_picker', {}).currentId;
      if (!cur || typeof window.btAward !== 'function') return;
      var step = (typeof window.btGetStep === 'function') ? window.btGetStep() : 1;
      window.btAward(cur, sign * step, { silent: true, label: 'Pick a name' });
      var n = document.getElementById('pickGlowN');
      if (n && typeof window.btGetPoints === 'function') n.textContent = window.btGetPoints(cur);
      flashSaved();
      toast(pupilName(cur) + ' ' + (sign > 0 ? '+' : '−') + step + ' ⚡');
    }
    if (glowMinus) glowMinus.onclick = function () { pickGlow(-1); };
    if (glowPlus) glowPlus.onclick = function () { pickGlow(1); };
  }

  /* ── Points (quick glow getters point picker — award without the board) ── */
  function renderPoints() {
    var v = document.getElementById('tv-points');
    var list = sortedRoster();
    var step = (typeof window.btGetStep === 'function') ? window.btGetStep() : 1;

    if (!list.length) {
      v.innerHTML = teachHead('home', 'Home', '') +
        '<div class="empty">No pupils yet — add some in Plan › Pupils first.</div>';
      wireBack(v);
      return;
    }

    var cards = list.map(function (p) {
      var pts = (typeof window.btGetPoints === 'function') ? window.btGetPoints(p.id) : 0;
      return '<div class="pts-card">' +
        '<span class="pts-name">' + esc(p.name) + '</span>' +
        '<div class="pts-row">' +
          '<button class="pts-minus" data-pid="' + esc(p.id) + '" data-sign="-1" title="Take a point">−</button>' +
          '<span class="pts-n" id="ptsn-' + esc(p.id) + '">' + pts + '</span>' +
          '<button class="pts-plus" data-pid="' + esc(p.id) + '" data-sign="1" title="Give a point">+' + step + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    v.innerHTML = teachHead('home', 'Home',
        '<button class="pill pill-ghost" id="ptsOpenBoard">Open board ↗</button>') +
      '<div style="margin:2px 0 2px"><div class="eyebrow" style="color:var(--teal-600)">Glow Getters</div>' +
        '<div style="font-size:23px;font-weight:700;letter-spacing:-.02em">Award points</div></div>' +
      '<p style="font-size:12.5px;color:var(--faint);margin:0 0 6px">Tap + or − to award glow getters points — no need to open the full board.</p>' +
      '<div class="pts-grid">' + cards + '</div>';

    wireBack(v);
    var openBoard = document.getElementById('ptsOpenBoard');
    if (openBoard && typeof openBattler === 'function') openBoard.onclick = function () { openBattler(); };

    v.querySelectorAll('.pts-minus, .pts-plus').forEach(function (b) {
      b.onclick = function () {
        var pid = b.dataset.pid, sign = +b.dataset.sign;
        if (typeof window.btAward !== 'function') return;
        window.btAward(pid, sign * step, { silent: true, label: 'Points picker' });
        var n = document.getElementById('ptsn-' + pid);
        if (n && typeof window.btGetPoints === 'function') n.textContent = window.btGetPoints(pid);
        flashSaved();
      };
    });
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

  /* ── Groups (read-only, mirrors Plan › Organise › Groups) ── */
  var GRP_COLORS_T = ['#2f55e0', '#e11d48', '#d99a07', '#6d4bdc', '#1f8a4c', '#5c6a6e'];
  var groupsTeachClosed = {};
  function grpCountLabel() {
    var n = (typeof grpFlatGroups === 'function') ? grpFlatGroups().length : 0;
    return n + (n === 1 ? ' group' : ' groups');
  }
  function renderGroupsTeach() {
    var v = document.getElementById('tv-groups');
    var tree = (typeof grpTree === 'function') ? grpTree() : [];
    var T_SIZES = ['14px', '13.5px', '12.5px', '12px'];

    function countGroups(node) { return node.type === 'group' ? 1 : node.children.reduce(function (a, c) { return a + countGroups(c); }, 0); }

    var body = '';
    (function walk(list, depth) {
      list.forEach(function (node) {
        if (node.type === 'heading') {
          var closed = !!groupsTeachClosed[node.id];
          var n = countGroups(node);
          body += '<button class="grp-tband" data-gtoggle="' + esc(node.id) + '" '
            + 'style="margin:' + (depth === 0 ? '8px' : '0') + ' 0 0 ' + (depth * 14) + 'px;display:flex;align-items:center;gap:7px;width:auto;background:none;border:none;padding:2px 6px 2px 0;cursor:pointer;text-align:left;border-radius:7px;">'
            + '<span style="color:var(--faint);font-size:10px;">' + (closed ? '▶' : '▼') + '</span>'
            + '<span style="font-size:' + T_SIZES[Math.min(depth, 3)] + ';font-weight:' + (depth === 0 ? '800' : '700') + ';letter-spacing:-.01em;color:' + (depth === 0 ? 'var(--ink)' : 'var(--muted)') + ';">' + esc(depth === 0 ? node.name.toUpperCase() : node.name) + '</span>'
            + '<span style="font-size:11.5px;font-weight:600;color:var(--faint);">' + n + (n === 1 ? ' group' : ' groups') + '</span>'
            + '</button>';
          if (!closed) walk(node.children, depth + 1);
        } else {
          var bar = GRP_COLORS_T[node.colorIdx % GRP_COLORS_T.length];
          var known = node.pupilIds.filter(function (pid) { return roster.some(function (p) { return p.id === pid; }); });
          var memberLine = known.length ? known.map(function (p) { return esc(pupilName(p)); }).join(' · ') : 'No children yet';
          body += '<div style="margin-left:' + (depth * 14) + 'px;background:#fff;border:1px solid var(--line);border-left:4px solid ' + bar + ';border-radius:14px;padding:12px 16px;box-shadow:var(--shadow);">'
            + '<div style="display:flex;align-items:baseline;gap:8px;">'
            + '<span style="font-size:16.5px;font-weight:700;letter-spacing:-.01em;">' + esc(node.name) + '</span>'
            + '<span style="flex:1"></span>'
            + '<span style="font-size:11.5px;font-weight:600;color:var(--faint);">' + esc(node.ta || '') + '</span>'
            + '</div>'
            + '<div style="font-size:15px;font-weight:500;color:var(--ink);line-height:1.65;margin-top:3px;">' + memberLine + '</div>'
            + (node.notes ? '<div style="font-size:12px;font-weight:600;color:var(--muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--line-2);">' + esc(node.notes) + '</div>' : '')
            + '</div>';
        }
      });
    })(tree, 0);

    if (!body) body = '<div class="empty">No groups yet — build your outline in Plan › Organise › Groups.</div>';

    v.innerHTML = teachHead('home', 'Home',
        '<span class="pill pill-saved"><span>✓</span> saved</span>' +
        '<button class="pill pill-ghost" id="grpToPlan" style="margin-left:8px">Plan ↗</button>') +
      '<div style="margin:2px 0 4px"><div class="eyebrow" style="color:var(--teal-600)">' + esc(currentHalfTerm()) + '</div>' +
      '<div style="font-size:23px;font-weight:700;letter-spacing:-.02em">Groups</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + body + '</div>' +
      '<p style="font-size:12px;color:var(--faint);text-align:center;margin:6px 0 0">read-only here — edit in Plan › Organise › Groups</p>';

    wireBack(v);
    var toPlan = document.getElementById('grpToPlan');
    if (toPlan) toPlan.onclick = function () {
      setMode('plan'); go('organise');
      try { showSub('orgTabs', 'org-groups'); } catch (e) {}
    };
    v.querySelectorAll('[data-gtoggle]').forEach(function (b) {
      b.onclick = function () { var id = b.dataset.gtoggle; groupsTeachClosed[id] = !groupsTeachClosed[id]; renderGroupsTeach(); };
    });
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
      '<div class="page-header"><h1>Organise</h1><p>Edit your timetable, seating &amp; groups.</p></div>' +
      '<div class="tabs" id="orgTabs"></div>' +
      '<div class="subview" id="org-timetable"></div>' +
      '<div class="subview" id="org-seating"></div>' +
      '<div class="subview" id="org-groups"></div>';
    /* Settings */
    var settings = section('settings');
    settings.innerHTML = '<div class="page-header"><h1>Settings</h1><p>Your profile, plus backup &amp; data.</p></div><div id="settings-profile"></div><div id="settings-data"></div>';

    /* relocate existing content into the aggregators */
    move('#page-assessments', document.getElementById('mb-assessments'));
    move('#page-mental-starters', document.getElementById('mb-starters'));
    move('#page-charts', document.getElementById('mb-charts'));
    move('#page-timetable', document.getElementById('org-timetable'));
    move('#page-seating', document.getElementById('org-seating'));
    move('#page-groups', document.getElementById('org-groups'));
    move('#page-class-list', document.getElementById('manageBody'));
    move('#page-profile', document.getElementById('settings-profile'));
    move('#page-data', document.getElementById('settings-data'));

    /* sub-tabs */
    buildTabs('mbTabs', [['mb-assessments', 'Assessments'], ['mb-starters', 'Starter scores'], ['mb-charts', 'Charts']], function (id) {
      if (id === 'mb-assessments' && typeof asRender === 'function') asRender();
      if (id === 'mb-starters' && typeof msRender === 'function') msRender();
      if (id === 'mb-charts' && typeof chRender === 'function') chRender();
    });
    buildTabs('orgTabs', [['org-timetable', 'Timetable'], ['org-seating', 'Seating & Groups'], ['org-groups', 'Groups']], function (id) {
      if (id === 'org-timetable' && typeof ttRender === 'function') ttRender();
      if (id === 'org-seating' && typeof seatRender === 'function') seatRender();
      if (id === 'org-groups' && typeof grpRender === 'function') grpRender();
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

  /* ===================================================================
     PLAN › PUPIL RECORD  (redesign — "do everything for a pupil")
     One screen: gender, behaviour log with a real note field, allergies,
     medical, key notes, group memberships and the OneDrive SEND/EHCP link.
     Behaviour log = bhData (positive|concern|note) + spData (star) + Glow
     (btAward), each entry carrying an editable note, a `pinned` flag and an
     id so it can be edited / deleted / pinned in place.
     =================================================================== */
  var openPid = null;
  var recFilter = 'all';                 // 'all' | praise | concern | star | glow | note
  var recEhcpEditing = false;            // OneDrive link: input vs linked-row
  var recSheet = { open: false, mode: 'add', type: 'praise', editId: null, note: '', date: '' };
  var REC_DEFAULT_TYPE = 'praise';       // which type the compose sheet opens on
  var REC_PINNED_FIRST = true;           // pinned entries sort above the rest

  /* icon / colour / label per entry type — shared by entries, summary, filters, sheet */
  var REC_META = {
    praise:  { icon: '👍', label: 'Praise',     color: '#1f8a5b' },
    concern: { icon: '⚠',  label: 'Concern',    color: '#e11d48' },
    star:    { icon: '★',  label: 'Star pupil', color: '#b9810f' },
    glow:    { icon: '⚡', label: 'Glow point', color: '#6d4bdc' },
    note:    { icon: '✎',  label: 'Note',       color: '#5c6a6e' }
  };
  function recMeta(k) { return REC_META[k] || REC_META.note; }

  function openRecord(pid) {
    openPid = pid; recFilter = 'all'; recEhcpEditing = false;
    recSheet = { open: false, mode: 'add', type: REC_DEFAULT_TYPE, editId: null, note: '', date: '' };
    go('pupil');
  }

  /* "15 Jun" date label */
  function recFmtDate(iso) {
    var pp = String(iso || '').split('-');
    if (pp.length < 3) return iso || '';
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (+pp[2]) + ' ' + mon[(+pp[1]) - 1];
  }
  function recFirstClause(s, fb) {
    if (!s) return fb;
    var t = String(s).split(/[,.;\n]/)[0].trim();
    return t.length > 28 ? t.slice(0, 26) + '…' : t;
  }

  /* Merge of the two behaviour stores into one editable list. Each item keeps
     its source store + id so edit / delete / pin map straight back. */
  function pupilTimeline(pid) {
    var items = [];
    (bhData || []).filter(function (e) { return e.pupilId === pid; }).forEach(function (e) {
      var glow = e.note && /Battler|Glow|Quick log/i.test(e.note) && e.type === 'positive';
      var type = glow ? 'glow' : (e.type === 'positive' ? 'praise' : (e.type === 'concern' ? 'concern' : 'note'));
      items.push({ id: e.id, store: 'bh', type: type, date: e.date, text: e.note || '', pinned: !!e.pinned });
    });
    (spData || []).filter(function (e) { return e.pupilId === pid; }).forEach(function (e) {
      items.push({ id: e.id, store: 'sp', type: 'star', date: e.date, text: e.reason || '', pinned: !!e.pinned });
    });
    return items;
  }
  function recFindEntry(id) {
    var e = (bhData || []).find(function (x) { return x.id === id; }); if (e) return { store: 'bh', e: e };
    e = (spData || []).find(function (x) { return x.id === id; }); if (e) return { store: 'sp', e: e };
    return null;
  }

  /* Groups this pupil belongs to, with the nearest ancestor heading (the flat
     list doesn't carry the parent, so walk the tree once to find it). */
  function recGroupsFor(pid) {
    var flat = []; try { flat = (typeof grpFlatGroups === 'function') ? grpFlatGroups() : []; } catch (e) {}
    var mine = flat.filter(function (g) { return (g.pupilIds || []).indexOf(pid) !== -1; });
    var headingOf = {};
    try {
      var tree = (typeof grpTree === 'function') ? grpTree() : [];
      (function walk(list, h) {
        (list || []).forEach(function (n) {
          if (n.type === 'heading') walk(n.children, n.name);
          else if (n.type === 'group') headingOf[n.id] = h || '';
        });
      })(tree, '');
    } catch (e) {}
    var colors = window.GRP_COLORS || ['#2f55e0', '#e11d48', '#d99a07', '#6d4bdc', '#1f8a4c', '#5c6a6e'];
    return mine.map(function (g) {
      return { name: g.name, heading: headingOf[g.id] || '', color: colors[(g.colorIdx || 0) % colors.length], ta: g.ta || '' };
    });
  }

  /* persist a profile field (saves; no focus-stealing re-render) */
  function recEdit(field, value) { if (typeof rosEdit === 'function') rosEdit(openPid, field, value); }

  /* grow every auto-grow textarea to fit its content */
  function recAutosizeAll() {
    try {
      document.querySelectorAll('#pupil-root textarea[data-autosize]').forEach(function (t) {
        t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px';
      });
    } catch (e) {}
  }

  /* ── behaviour-log mutations (write the underlying stores, then repaint) ── */
  function recPersistLogs() {
    try { window.bhData = bhData; window.spData = spData; } catch (e) {}
    if (typeof bhSave === 'function') bhSave();
    if (typeof spSave === 'function') spSave();
    flashSaved();
    window.dispatchEvent(new CustomEvent('tp:sync', { detail: { key: 'tp_behaviour', source: 'local' } }));
    renderRecord();
  }
  function recTogglePin(id) {
    var f = recFindEntry(id); if (!f) return;
    f.e.pinned = !f.e.pinned; recPersistLogs();
  }
  function recDeleteEntry(id) {
    var f = recFindEntry(id); if (!f) return;
    var removed = f.e, store = f.store;
    if (store === 'bh') bhData = bhData.filter(function (e) { return e.id !== id; });
    else spData = spData.filter(function (e) { return e.id !== id; });
    recPersistLogs();
    toast('✓ Entry deleted', function () {
      if (store === 'bh') bhData.push(removed); else spData.push(removed);
      recPersistLogs();
    });
  }
  /* create / update an entry from the compose sheet */
  function recApplyEntry(editId, type, text, date, pinned) {
    if (editId) { bhData = bhData.filter(function (e) { return e.id !== editId; }); spData = spData.filter(function (e) { return e.id !== editId; }); }
    if (type === 'star') {
      spData.push({ id: editId || uid(), date: date, pupilId: openPid, reason: text, pinned: !!pinned });
    } else if (type === 'glow') {
      if (editId) bhData.push({ id: editId, date: date, pupilId: openPid, type: 'positive', note: text || 'Glow Getter point', pinned: !!pinned });
      else if (typeof window.btAward === 'function') window.btAward(openPid, 1, { silent: true, label: 'Quick log' });
    } else {
      var bt = type === 'praise' ? 'positive' : (type === 'concern' ? 'concern' : 'note');
      bhData.push({ id: editId || uid(), date: date, pupilId: openPid, type: bt, note: text, pinned: !!pinned });
    }
  }

  /* ── compose / edit sheet ── */
  function recOpenSheet(mode, entry) {
    recSheet = {
      open: true, mode: mode,
      type: entry ? entry.type : REC_DEFAULT_TYPE,
      editId: entry ? entry.id : null,
      note: entry ? (entry.text || '') : '',
      date: entry ? entry.date : todayISO()
    };
    renderRecord();
  }
  function recCloseSheet() { recSheet.open = false; renderRecord(); }
  function recSetSheetType(t) {
    var n = document.getElementById('recNote'); if (n) recSheet.note = n.value;
    var d = document.getElementById('recDate'); if (d) recSheet.date = d.value;
    recSheet.type = t; renderRecord();
  }
  function recSubmitSheet() {
    var n = document.getElementById('recNote'), d = document.getElementById('recDate');
    var text = ((n && n.value) || '').trim();
    var date = (d && d.value) || todayISO();
    var sh = recSheet, pinned = false;
    if (sh.mode === 'edit') { var f = recFindEntry(sh.editId); if (f) pinned = !!f.e.pinned; }
    recApplyEntry(sh.mode === 'edit' ? sh.editId : null, sh.type, text, date, pinned);
    recSheet.open = false;
    recPersistLogs();
    toast(sh.mode === 'edit' ? '✓ Entry updated' : '✓ ' + recMeta(sh.type).label + ' added to log');
  }

  function renderRecord() {
    var root = document.getElementById('pupil-root'); if (!root) return;
    var p = roster.find(function (x) { return x.id === openPid; });
    if (!p) { root.innerHTML = '<div class="empty">Pupil not found. <button class="link" onclick="go(\'pupils\')">Back to Pupils</button></div>'; return; }

    var inits = esc(initials(p.name));
    var tl = pupilTimeline(p.id);
    function countT(t) { return tl.filter(function (e) { return e.type === t; }).length; }

    /* header: gender pill + context chips + sub-line */
    var genderPill = p.gender ? '<span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:#f0f2f5;color:var(--muted)">' + esc(p.gender) + '</span>' : '';
    var chips = [];
    if (p.send && p.send !== 'None') chips.push({ label: p.send, bg: 'var(--gold-50)', color: '#8a6209' });
    if (p.pp) chips.push({ label: 'Pupil Premium', bg: 'var(--teal-50)', color: 'var(--teal-700)' });
    if (p.allergies) chips.push({ label: '⚠ ' + recFirstClause(p.allergyNotes, 'Allergy'), bg: 'var(--coral-50)', color: 'var(--coral-600)' });
    if (p.medical) chips.push({ label: '✚ Medical', bg: 'var(--violet-50)', color: 'var(--violet-600)' });
    var chipsHTML = chips.map(function (c) {
      return '<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:' + c.bg + ';color:' + c.color + '">' + esc(c.label) + '</span>';
    }).join('');
    var starN = countT('star');
    var subLine = starN ? 'star pupil ×' + starN : '';

    /* OneDrive SEND / EHCP plan link — linked row vs editable input */
    var ehcpHasLink = !!(p.ehcpLink && String(p.ehcpLink).trim());
    var ehcpHTML;
    if (ehcpHasLink && !recEhcpEditing) {
      ehcpHTML =
        '<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#f8f9fb;width:100%">' +
          '<span style="width:7px;height:7px;border-radius:50%;background:var(--success);flex:0 0 auto"></span>' +
          '<a href="' + esc(p.ehcpLink) + '" target="_blank" style="font-size:13px;font-weight:700;color:var(--teal-700);text-decoration:none;white-space:nowrap">Open plan ↗</a>' +
          '<span style="display:flex;gap:13px;margin-left:auto">' +
            '<button data-rec="ehcpEdit" style="background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer">Replace</button>' +
            '<button data-rec="ehcpRemove" style="background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:var(--coral-600);cursor:pointer">Remove</button>' +
          '</span>' +
        '</div>';
    } else {
      ehcpHTML = '<input id="recEhcp" value="' + esc(p.ehcpLink || '') + '" placeholder="Paste a OneDrive link…" style="width:100%" />';
    }

    /* groups card */
    var groups = recGroupsFor(p.id);
    var groupsBody = groups.length
      ? '<div style="display:flex;flex-direction:column">' + groups.map(function (g) {
          return '<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--line-2)">' +
            '<span style="width:11px;height:11px;border-radius:50%;background:' + g.color + ';flex:0 0 auto"></span>' +
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:13px;font-weight:700;color:var(--ink)">' + esc(g.name) + '</div>' +
              (g.heading ? '<div style="font-size:11px;color:var(--faint);font-weight:600">' + esc(g.heading) + '</div>' : '') +
            '</div>' +
            (g.ta ? '<span style="font-size:11.5px;color:var(--muted);font-weight:600;white-space:nowrap">' + esc(g.ta) + '</span>' : '') +
          '</div>';
        }).join('') + '</div>'
      : '<div style="font-size:12.5px;color:var(--faint);padding:8px 0 2px">Not in any group yet — add this pupil in Organise › Groups.</div>';

    /* behaviour log: summary, filters, entries */
    var summary = [
      { n: countT('praise'),  label: 'Praise',      color: '#1f8a5b' },
      { n: countT('concern'), label: 'Concern',     color: '#e11d48' },
      { n: countT('star'),    label: 'Star pupil',  color: '#b9810f' },
      { n: countT('glow'),    label: 'Glow points', color: '#6d4bdc' }
    ];
    var summaryHTML = summary.map(function (s) {
      return '<div style="display:flex;flex-direction:column"><span style="font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1;color:' + s.color + '">' + s.n + '</span>' +
        '<span style="font-size:11px;font-weight:600;color:var(--muted);margin-top:3px">' + esc(s.label) + '</span></div>';
    }).join('');

    var fdefs = [['all', 'All'], ['praise', 'Praise'], ['concern', 'Concern'], ['star', 'Star'], ['glow', 'Glow'], ['note', 'Note']];
    var filterHTML = fdefs.map(function (x) {
      var active = recFilter === x[0];
      var bg = active ? 'var(--accent)' : '#fff', col = active ? '#fff' : 'var(--muted)', bc = active ? 'var(--accent)' : 'var(--line)';
      return '<button data-filter="' + x[0] + '" style="padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;background:' + bg + ';color:' + col + ';border:1px solid ' + bc + '">' + x[1] + '</button>';
    }).join('');

    var sorted = tl.slice().sort(function (a, b) {
      if (REC_PINNED_FIRST && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
    var visible = (recFilter === 'all') ? sorted : sorted.filter(function (e) { return e.type === recFilter; });
    var entriesHTML = visible.length ? visible.map(function (e) {
      var m = recMeta(e.type);
      return '<div style="border-left:3px solid ' + m.color + ';padding:11px 0 13px 15px;margin-bottom:5px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:12.5px;font-weight:700;color:' + m.color + '">' + m.icon + ' ' + m.label + '</span>' +
          (e.pinned ? '<span style="font-size:9.5px;font-weight:800;letter-spacing:.05em;color:#8a6209;background:var(--gold-50);padding:1px 7px;border-radius:999px">PINNED</span>' : '') +
          '<span style="margin-left:auto;font-size:11px;color:var(--faint);font-weight:600">' + recFmtDate(e.date) + '</span>' +
        '</div>' +
        '<div style="font-size:13.5px;color:#414851;margin-top:4px;line-height:1.55">' + (e.text ? esc(e.text) : '<span style="color:var(--faint)">No note added.</span>') + '</div>' +
        '<div style="display:flex;gap:16px;margin-top:9px">' +
          '<button data-pin="' + e.id + '" style="background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer">' + (e.pinned ? 'Unpin' : 'Pin') + '</button>' +
          '<button data-edit="' + e.id + '" style="background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer">Edit</button>' +
          '<button data-del="' + e.id + '" style="background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:var(--coral-600);cursor:pointer">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('') : '<div style="color:var(--muted);padding:26px;text-align:center;font-size:12.5px;border:1.5px dashed var(--line);border-radius:12px">Nothing to show here. Tap <b>+ Log something</b> to add the first entry.</div>';

    /* field-card chrome helpers */
    var eyebrow = function (t) { return '<div style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)">' + t + '</div>'; };
    var flabel = function (t) { return '<label style="display:block;font-weight:600;font-size:12px;color:var(--muted);margin:12px 0 5px">' + t + '</label>'; };
    var fieldStyle = 'border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13.5px;background:#fff;color:var(--ink);width:100%;outline:none;font-family:inherit';
    var taStyle = fieldStyle + ';line-height:1.5;overflow:hidden;resize:vertical';
    var ppOn = !!p.pp;

    var sheetHTML = recSheet.open ? recSheetHTML(p, inits) : '';

    root.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--faint);font-weight:600;margin-bottom:16px">' +
        '<button class="link" data-rec="crumb" style="color:var(--teal-700)">Pupils</button><span>›</span><span style="color:var(--muted)">' + esc(p.name) + '</span></div>' +

      /* header card */
      '<div style="display:flex;align-items:center;gap:16px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px;flex-wrap:wrap">' +
        '<div style="width:52px;height:52px;border-radius:50%;background:var(--teal-50);color:var(--teal-700);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:19px;flex:0 0 auto">' + inits + '</div>' +
        '<div style="flex:1;min-width:180px">' +
          '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span style="font-size:21px;font-weight:700;letter-spacing:-.01em;color:var(--ink)">' + esc(p.name) + '</span>' + genderPill + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + chipsHTML + '</div>' +
          (subLine ? '<div style="font-size:12px;color:var(--faint);font-weight:600;margin-top:7px">' + esc(subLine) + '</div>' : '') +
        '</div>' +
        '<button data-rec="log" style="background:var(--accent);color:#fff;border:0;border-radius:11px;padding:11px 17px;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap">+ Log something</button>' +
      '</div>' +

      '<div class="pr-grid">' +

        /* LEFT column */
        '<div>' +
          /* Profile & context */
          '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px">' +
            eyebrow('Profile &amp; context') +
            flabel('Gender') +
            '<select id="recGender" style="' + fieldStyle + '"><option value="">—</option>' +
              '<option value="Boy"' + (p.gender === 'Boy' ? ' selected' : '') + '>Boy</option>' +
              '<option value="Girl"' + (p.gender === 'Girl' ? ' selected' : '') + '>Girl</option></select>' +
            flabel('SEND status') +
            '<select id="recSend" style="' + fieldStyle + '">' +
              ['None', 'SEN Support', 'EHCP'].map(function (o) { return '<option' + ((p.send || 'None') === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' +
            flabel('Pupil Premium') +
            '<button data-rec="pp" style="border:1px solid ' + (ppOn ? '#cdd9f7' : 'var(--line)') + ';background:' + (ppOn ? '#eef2fd' : '#fff') + ';color:' + (ppOn ? 'var(--teal-700)' : 'var(--muted)') + ';border-radius:10px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;width:100%;text-align:left">' + (ppOn ? 'Pupil Premium · Yes' : 'Pupil Premium · No') + '</button>' +
            flabel('OneDrive SEND / EHCP plan link') + ehcpHTML +
          '</div>' +

          /* Groups */
          '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px">' +
            '<div style="display:flex;align-items:baseline;gap:8px;margin:0 0 2px">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)">Groups</div>' +
              '<span style="font-size:11px;color:var(--faint);font-weight:600;margin-left:auto">set in Organise › Groups</span></div>' +
            groupsBody +
          '</div>' +

          /* Health & safety */
          '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px">' +
            eyebrow('Health &amp; safety') +
            flabel('Allergies') +
            '<textarea id="recAllergy" data-autosize="1" placeholder="Allergens, EpiPen location, who is trained…" style="' + taStyle + ';min-height:74px">' + esc(p.allergyNotes || '') + '</textarea>' +
            flabel('Medical / health') +
            '<textarea id="recMedical" data-autosize="1" placeholder="Conditions, medication, when to act…" style="' + taStyle + ';min-height:74px">' + esc(p.medicalNotes || '') + '</textarea>' +
          '</div>' +

          /* Key notes */
          '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:0">' +
            eyebrow('Key notes') +
            '<textarea id="recNotes" data-autosize="1" placeholder="Strategies that work, seating, things to remember…" style="' + taStyle + ';min-height:92px">' + esc(p.notes || '') + '</textarea>' +
          '</div>' +
        '</div>' +

        /* RIGHT column — behaviour log */
        '<div>' +
          '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
              '<div style="font-size:14px;font-weight:700;letter-spacing:-.01em;color:var(--ink)">Behaviour log</div>' +
              '<span style="font-size:11.5px;color:var(--faint);font-weight:600">' + visible.length + ' shown</span>' +
              '<button data-rec="log" style="margin-left:auto;background:var(--accent);color:#fff;border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer">+ Log something</button>' +
            '</div>' +
            '<div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap">' + summaryHTML + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;padding-top:14px;border-top:1px solid var(--line-2)">' + filterHTML + '</div>' +
            '<div>' + entriesHTML + '</div>' +
          '</div>' +
        '</div>' +

      '</div>' + sheetHTML;

    recWire(p);
    recAutosizeAll();
  }

  /* the compose / edit bottom sheet markup (shown inside #pupil-root) */
  function recSheetHTML(p, inits) {
    var sh = recSheet;
    var typeChips = ['praise', 'concern', 'star', 'glow', 'note'].map(function (k) {
      var m = recMeta(k), active = sh.type === k;
      var bg = active ? m.color : '#f5f6f8', col = active ? '#fff' : 'var(--muted)', bc = active ? m.color : 'var(--line)';
      return '<button data-sheettype="' + k + '" style="display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;background:' + bg + ';color:' + col + ';border:1px solid ' + bc + '">' + m.icon + ' ' + m.label + '</button>';
    }).join('');
    var fieldStyle = 'border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13.5px;background:#fff;color:var(--ink);width:100%;outline:none;font-family:inherit';
    return '<div data-rec="sheetBackdrop" style="position:fixed;inset:0;z-index:2000;background:rgba(20,24,29,.45);display:flex;align-items:flex-end;justify-content:center">' +
      '<div data-rec="sheetInner" style="background:#fff;width:100%;max-width:540px;border-radius:20px 20px 0 0;padding:10px 20px 26px;max-height:90vh;overflow-y:auto;box-shadow:0 -10px 40px rgba(20,24,29,.2)">' +
        '<div style="width:38px;height:4px;border-radius:999px;background:var(--line);margin:8px auto 16px"></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
          '<span style="font-size:16px;font-weight:700">' + (sh.mode === 'add' ? 'Log behaviour' : 'Edit entry') + '</span>' +
          '<button data-rec="sheetClose" style="margin-left:auto;background:none;border:0;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600">✕ close</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
          '<div style="width:30px;height:30px;border-radius:50%;background:var(--teal-50);color:var(--teal-700);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">' + inits + '</div>' +
          '<span style="font-size:15px;font-weight:700">' + esc(p.name) + '</span>' +
        '</div>' +
        '<label style="display:block;font-weight:600;font-size:12px;color:var(--muted);margin:0 0 6px">Type</label>' +
        '<div style="display:flex;gap:7px;flex-wrap:wrap">' + typeChips + '</div>' +
        '<label style="display:block;font-weight:600;font-size:12px;color:var(--muted);margin:16px 0 5px">Note <span style="color:var(--faint);font-weight:500">(optional)</span></label>' +
        '<textarea id="recNote" data-autosize="1" placeholder="What happened? Add the detail you\'ll want when you look back…" style="' + fieldStyle + ';min-height:96px;line-height:1.5;resize:vertical">' + esc(sh.note || '') + '</textarea>' +
        '<label style="display:block;font-weight:600;font-size:12px;color:var(--muted);margin:14px 0 5px">Date</label>' +
        '<input id="recDate" type="date" value="' + esc(sh.date || todayISO()) + '" style="' + fieldStyle + '" />' +
        '<button data-rec="sheetSave" style="background:var(--accent);color:#fff;border:0;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;width:100%;margin-top:20px">' + (sh.mode === 'add' ? 'Add to log' : 'Save changes') + '</button>' +
      '</div>' +
    '</div>';
  }

  /* attach all record interactions after each paint */
  function recWire(p) {
    var root = document.getElementById('pupil-root'); if (!root) return;
    function on(sel, ev, fn) { root.querySelectorAll(sel).forEach(function (el) { el.addEventListener(ev, fn); }); }

    on('[data-rec="crumb"]', 'click', function () { go('pupils'); });
    on('[data-rec="log"]', 'click', function () { recOpenSheet('add', null); });

    var gen = document.getElementById('recGender'); if (gen) gen.onchange = function () { recEdit('gender', gen.value); renderRecord(); };
    var snd = document.getElementById('recSend'); if (snd) snd.onchange = function () { recEdit('send', snd.value); renderRecord(); };
    on('[data-rec="pp"]', 'click', function () { recEdit('pp', !p.pp); renderRecord(); });

    /* OneDrive link */
    on('[data-rec="ehcpEdit"]', 'click', function () { recEhcpEditing = true; renderRecord(); });
    on('[data-rec="ehcpRemove"]', 'click', function () { recEdit('ehcpLink', ''); recEhcpEditing = false; renderRecord(); });
    var eh = document.getElementById('recEhcp');
    if (eh) {
      if (recEhcpEditing) { try { eh.focus(); } catch (e) {} }
      eh.onblur = function () { recEdit('ehcpLink', eh.value); recEhcpEditing = false; renderRecord(); };
    }

    /* health / key-notes textareas — save on blur, keep focus while typing */
    var al = document.getElementById('recAllergy');
    if (al) { al.oninput = function () { al.style.height = 'auto'; al.style.height = (al.scrollHeight + 2) + 'px'; };
      al.onchange = function () { recEdit('allergyNotes', al.value); recEdit('allergies', !!al.value.trim()); }; }
    var me = document.getElementById('recMedical');
    if (me) { me.oninput = function () { me.style.height = 'auto'; me.style.height = (me.scrollHeight + 2) + 'px'; };
      me.onchange = function () { recEdit('medicalNotes', me.value); recEdit('medical', !!me.value.trim()); }; }
    var nt = document.getElementById('recNotes');
    if (nt) { nt.oninput = function () { nt.style.height = 'auto'; nt.style.height = (nt.scrollHeight + 2) + 'px'; };
      nt.onchange = function () { recEdit('notes', nt.value); }; }

    /* behaviour-log filters + entry actions */
    on('[data-filter]', 'click', function () { recFilter = this.getAttribute('data-filter'); renderRecord(); });
    on('[data-pin]', 'click', function () { recTogglePin(this.getAttribute('data-pin')); });
    on('[data-edit]', 'click', function () {
      var f = recFindEntry(this.getAttribute('data-edit')); if (!f) return;
      var item = pupilTimeline(openPid).filter(function (x) { return x.id === f.e.id; })[0];
      recOpenSheet('edit', item);
    });
    on('[data-del]', 'click', function () { recDeleteEntry(this.getAttribute('data-del')); });

    /* compose / edit sheet */
    on('[data-rec="sheetBackdrop"]', 'click', function (e) { if (e.target === this) recCloseSheet(); });
    on('[data-rec="sheetClose"]', 'click', function () { recCloseSheet(); });
    on('[data-sheettype]', 'click', function () { recSetSheetType(this.getAttribute('data-sheettype')); });
    on('[data-rec="sheetSave"]', 'click', function () { recSubmitSheet(); });
    var note = document.getElementById('recNote');
    if (note) { note.oninput = function () { recSheet.note = note.value; note.style.height = 'auto'; note.style.height = (note.scrollHeight + 2) + 'px'; }; try { note.focus(); } catch (e) {} }
    var dt = document.getElementById('recDate'); if (dt) dt.onchange = function () { recSheet.date = dt.value; };
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
