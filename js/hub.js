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
  function mondayOf(d) {
    d = d ? new Date(d) : new Date();
    var off = (d.getDay() + 6) % 7;            // 0 = Monday
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off);
    return d.toISOString().slice(0, 10);
  }
  function addDaysISO(iso, n) { var d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function fmtWB(iso) { var d = new Date(iso); return 'w/b ' + d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'long' }); }
  function fmtWBShort(iso) { var d = new Date(iso); return 'w/b ' + d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'short' }); }
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
     STARTER SETS  (week-keyed; generator supplies content)
     =================================================================== */
  function starterSets() { return Store.get('tp_starter_sets', {}); }
  function saveSets(s) { Store.set('tp_starter_sets', s); }
  function currentSet() { return starterSets()[mondayOf()] || null; }
  function generateSet(weekISO, confirmReplace) {
    var sets = starterSets();
    if (sets[weekISO] && confirmReplace && !confirm('Replace the saved set for ' + fmtWB(weekISO) + '? This cannot be undone.')) return false;
    var ht = currentHalfTerm();
    var days = (typeof window.genBuildDays === 'function')
      ? window.genBuildDays(ht, 'worksheet', 10, false, {})
      : null;
    sets[weekISO] = { days: days, generatedISO: todayISO(), max: 22, halfTerm: ht };
    saveSets(sets); flashSaved();
    return true;
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
      '<div class="teach-view" id="tv-board"></div>' +
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
    if (screen === 'starter') renderStarterHome();
    if (screen === 'board') renderBoard2();
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

    var set = currentSet();
    var starterStatus = set ? "this week's set ready ✓" : 'tap to set this week';
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

  /* ── Starter home ── */
  function renderStarterHome() {
    var v = document.getElementById('tv-starter');
    var sets = starterSets();
    var cur = mondayOf();
    var weeks = [];
    for (var i = 3; i >= 1; i--) weeks.push(addDaysISO(cur, -7 * i));
    weeks.push(cur);
    var chips = weeks.map(function (w) {
      var has = !!sets[w], isCur = w === cur;
      if (isCur) return '<button class="week-chip active" data-week="' + w + '" style="border:2px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer">' + fmtWBShort(w) + ' · this week</button>';
      return '<button class="week-chip" data-week="' + w + '" style="border:1px solid var(--line);background:var(--card);color:var(--faint);border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:pointer">' + fmtWBShort(w) + (has ? ' ✓' : '') + '</button>';
    }).join('');
    chips += '<button class="week-chip" id="newSet" style="border:1px dashed var(--faint);background:var(--card);color:var(--muted);border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:pointer">⊕ new set</button>';

    var set = sets[cur];
    var preview;
    if (set && set.days && set.days[0]) {
      var qs = set.days[0].questions || [];
      preview = '<div style="flex:1;border:1px solid var(--line-2);border-radius:12px;padding:14px;background:var(--card);min-height:120px;overflow:auto">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        qs.slice(0, 6).map(function (q, i) {
          return '<div style="display:flex;gap:8px;align-items:flex-start;font-size:15px"><b style="color:var(--teal-700)">' + (i + 1) + ')</b><div>' + (typeof window.genRenderQuestion === 'function' ? window.genRenderQuestion(q) : '…') + '</div></div>';
        }).join('') + '</div></div>';
    } else {
      preview = '<div style="flex:1;border:1px solid var(--line-2);border-radius:12px;background:repeating-linear-gradient(45deg,#f7f8fa 0 8px,#fdfdfe 8px 16px);display:flex;align-items:center;justify-content:center;color:var(--faint);text-align:center;padding:16px;min-height:120px">No set saved for this week yet — tap “⊕ new set”.</div>';
    }
    var count = set && set.days && set.days[0] ? (set.days[0].questions || []).length : 0;

    v.innerHTML = teachHead('home', 'Home', '<span class="pill pill-saved"><span>✓</span> saved</span>') +
      '<div><span class="glance eyebrow" style="display:none"></span>' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--teal-600)">' + esc(currentHalfTerm()) + '</div>' +
      '<div style="font-size:23px;font-weight:700;letter-spacing:-.02em">Starter</div></div>' +
      '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px">' + chips + '</div>' +
      '<div class="glance" style="flex:1;display:flex;flex-direction:column;gap:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<b style="font-size:14.5px">This week\'s questions</b>' +
          (set ? '<button id="regen" style="font-size:12px;color:var(--faint);font-weight:600;background:none;border:0;cursor:pointer">⋯ regenerate</button>' : '') + '</div>' +
        preview +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted);font-weight:600">' +
          '<span style="background:var(--page);border-radius:999px;padding:4px 11px">' + count + ' questions</span>' +
          '<span style="background:var(--page);border-radius:999px;padding:4px 11px">out of ' + (set ? set.max : 22) + '</span>' +
          '<span style="background:var(--gold-50);color:var(--gold-600);border-radius:999px;padding:4px 11px">📱 rewards on</span>' +
        '</div></div>' +
      '<div style="display:flex;gap:10px">' +
        '<button class="dock" id="goBoard" style="flex:1.4' + (set ? '' : ';opacity:.5') + '">Project on board</button>' +
        '<button id="goScores" style="flex:1;background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:16px;padding:18px;font-size:15.5px;font-weight:700">Enter scores</button>' +
      '</div>';
    wireBack(v);
    v.querySelectorAll('[data-week]').forEach(function (b) {
      b.onclick = function () { var w = b.dataset.week; if (!starterSets()[w]) { if (confirm('Generate a starter set for ' + fmtWB(w) + '?')) { generateSet(w, false); renderStarterHome(); } } };
    });
    var ns = document.getElementById('newSet'); if (ns) ns.onclick = function () { if (generateSet(mondayOf(), true)) renderStarterHome(); };
    var rg = document.getElementById('regen'); if (rg) rg.onclick = function () { if (generateSet(mondayOf(), true)) renderStarterHome(); };
    document.getElementById('goBoard').onclick = function () { if (currentSet()) teachGo('board'); else if (generateSet(mondayOf(), false)) teachGo('board'); };
    document.getElementById('goScores').onclick = function () { teachGo('scores'); };
  }

  /* ── Board view (numbered cards + pencil layer + squares) ── */
  var boardSquare = null;
  function renderBoard2() {
    var v = document.getElementById('tv-board');
    var set = currentSet();
    var qs = (set && set.days && set.days[0] && set.days[0].questions) || [];
    var cards = qs.map(function (q, i) {
      return '<div class="board-q" style="position:relative;border:1px solid var(--line);border-radius:12px;padding:14px 14px 14px 52px;min-height:64px;font-size:21px;font-weight:700;display:flex;align-items:center">' +
        '<span style="position:absolute;left:12px;top:12px;width:28px;height:28px;border-radius:8px;background:var(--teal-50);color:var(--teal-700);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">' + (i + 1) + '</span>' +
        '<div>' + (typeof window.genRenderQuestion === 'function' ? window.genRenderQuestion(q) : '') + '</div></div>';
    }).join('');
    v.innerHTML = teachHead('starter', 'Starter', '<span style="font-size:12px;color:var(--faint);font-weight:600">Apple Pencil to annotate</span>') +
      '<div style="position:relative;flex:1;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden">' +
        '<div id="boardScroll" style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px;position:relative">' +
          (cards || '<div class="empty">No questions — generate a set first.</div>') +
          '<canvas id="boardInk" style="position:absolute;inset:0;pointer-events:none"></canvas>' +
        '</div>' +
        '<div id="boardSquare"></div>' +
        '<div style="display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid var(--line-2);background:var(--page);flex-wrap:wrap">' +
          '<button id="tPen" style="background:var(--teal-50);border:1.5px solid var(--teal-600);color:var(--teal-700);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700">✏ Pen</button>' +
          '<button id="tRub" style="background:var(--card);border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600">Rubber</button>' +
          '<button id="tClr" style="background:var(--card);border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600">Clear</button>' +
          '<span style="flex:1"></span>' +
          '<button id="t100" style="background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700">▦ 100</button>' +
          '<button id="tTimes" style="background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700">▦ ×</button>' +
        '</div>' +
      '</div>';
    wireBack(v);
    setupInk();
    document.getElementById('t100').onclick = function () { boardSquare = boardSquare === 'hundred' ? null : 'hundred'; renderSquare(); };
    document.getElementById('tTimes').onclick = function () { boardSquare = boardSquare === 'times' ? null : 'times'; renderSquare(); };
    document.getElementById('tClr').onclick = function () { clearInk(); toast('Board cleared — annotations also wipe overnight automatically'); };
    document.getElementById('tRub').onclick = function () { inkMode = inkMode === 'rub' ? 'pen' : 'rub'; document.getElementById('tRub').style.background = inkMode === 'rub' ? 'var(--coral-50)' : 'var(--card)'; };
    renderSquare();
  }

  /* ink layer: persists strokes per ISO date; reads today only */
  var inkMode = 'pen', inkDrawing = false, inkStrokes = [], inkCur = null, inkCanvas = null, inkCtx = null;
  function inkStore() { return Store.get('tp_board_ink', {}); }
  function setupInk() {
    inkCanvas = document.getElementById('boardInk'); if (!inkCanvas) return;
    var scroll = document.getElementById('boardScroll');
    function size() { inkCanvas.width = scroll.scrollWidth; inkCanvas.height = scroll.scrollHeight; redrawInk(); }
    inkCtx = inkCanvas.getContext('2d');
    inkStrokes = (inkStore()[todayISO()] || []);
    setTimeout(size, 30);
    scroll.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'pen') return;       // finger taps fall through to buttons/cards
      inkDrawing = true; inkCur = { color: '#2f55e0', erase: inkMode === 'rub', pts: [] };
      addPt(e); e.preventDefault();
    });
    scroll.addEventListener('pointermove', function (e) { if (inkDrawing && e.pointerType === 'pen') { addPt(e); redrawInk(); } });
    window.addEventListener('pointerup', function () { if (inkDrawing) { inkDrawing = false; if (inkCur && inkCur.pts.length) inkStrokes.push(inkCur); inkCur = null; persistInk(); } });
  }
  function addPt(e) { var r = inkCanvas.getBoundingClientRect(); inkCur.pts.push({ x: e.clientX - r.left, y: e.clientY - r.top }); }
  function redrawInk() {
    if (!inkCtx) return; inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    var all = inkStrokes.concat(inkCur ? [inkCur] : []);
    all.forEach(function (s) {
      inkCtx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      inkCtx.strokeStyle = s.color; inkCtx.lineWidth = s.erase ? 18 : 3; inkCtx.lineCap = 'round'; inkCtx.lineJoin = 'round';
      inkCtx.beginPath();
      s.pts.forEach(function (p, i) { i ? inkCtx.lineTo(p.x, p.y) : inkCtx.moveTo(p.x, p.y); });
      inkCtx.stroke();
    });
    inkCtx.globalCompositeOperation = 'source-over';
  }
  function persistInk() { var st = inkStore(); st[todayISO()] = inkStrokes; Store.set('tp_board_ink', st); }
  function clearInk() { inkStrokes = []; persistInk(); redrawInk(); }
  function renderSquare() {
    var host = document.getElementById('boardSquare'); if (!host) return;
    if (!boardSquare) { host.innerHTML = ''; return; }
    var rows = '';
    for (var r = 0; r < 10; r++) { var cells = '';
      for (var c = 0; c < 10; c++) { var val = boardSquare === 'hundred' ? (r * 10 + c + 1) : ((r + 1) * (c + 1)); cells += '<td style="border:1px solid var(--line-2);padding:2px 3px;text-align:center;font-size:10px;color:var(--muted)">' + val + '</td>'; }
      rows += '<tr>' + cells + '</tr>'; }
    host.innerHTML = '<div style="position:absolute;right:18px;top:64px;width:240px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 40px rgba(20,24,29,.25);overflow:hidden;z-index:5">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line-2);background:var(--page)">' +
        '<b style="font-size:12px;color:var(--teal-700)' + (boardSquare === 'hundred' ? ';border-bottom:2px solid var(--teal-600)' : '') + '">100 square</b>' +
        '<b style="font-size:12px;color:var(--' + (boardSquare === 'times' ? 'teal-700' : 'faint') + ')' + (boardSquare === 'times' ? ';border-bottom:2px solid var(--teal-600)' : '') + '">× tables</b>' +
        '<span style="flex:1"></span><button id="sqX" style="background:none;border:0;color:var(--faint);font-size:12px">✕</button></div>' +
      '<table style="border-collapse:collapse;width:100%">' + rows + '</table></div>';
    document.getElementById('sqX').onclick = function () { boardSquare = null; renderSquare(); };
    host.querySelectorAll('b').forEach(function (b, i) { b.style.cursor = 'pointer'; b.onclick = function () { boardSquare = i === 0 ? 'hundred' : 'times'; renderSquare(); }; });
  }

  /* ── Score entry (writes into Mental Starters store, today's column) ── */
  var scoreSel = 0;
  function starterBlock() {
    var ht = currentHalfTerm();
    if (!msData[ht]) msData[ht] = { max: 22, dates: [], scores: {} };
    var b = msData[ht];
    var d = todayISO();
    if (b.dates.indexOf(d) === -1) { b.dates.push(d); b.dates.sort(); }
    return b;
  }
  function renderScores() {
    var v = document.getElementById('tv-scores');
    var b = starterBlock(); var d = todayISO();
    var list = sortedRoster();
    if (!list.length) { v.innerHTML = teachHead('starter', 'Starter', '') + '<div class="empty">Add pupils in Plan › Pupils first.</div>'; wireBack(v); return; }
    var rows = list.map(function (p, i) {
      var cell = (b.scores[p.id] && b.scores[p.id][d]) || {};
      var sel = i === scoreSel;
      var val = cell.v != null ? cell.v : (sel ? '|' : '—');
      return '<div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2)">' +
        '<span style="flex:1;font-weight:600;font-size:14.5px">' + esc(p.name) + '</span>' +
        '<button class="score-cell" data-i="' + i + '" data-pid="' + p.id + '" style="width:64px;text-align:center;border-radius:10px;font-weight:700;font-size:14px;padding:' + (sel ? '8px 0;border:2px solid var(--teal-600);background:var(--teal-50);color:var(--teal-700)' : '9px 0;border:1px solid var(--line);background:var(--card);color:var(--ink)') + '">' + esc(String(val)) + '</button>' +
        '<button class="ipad-tog" data-pid="' + p.id + '" style="border-radius:10px;padding:8px 13px;font-size:13px;' + (cell.ipad ? 'border:1.5px solid var(--gold-600);background:var(--gold-100)' : 'border:1px solid var(--line);background:var(--card);opacity:.35') + '">📱</button>' +
        '</div>';
    }).join('');
    var pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫', '↵'].map(function (k) {
      return '<button class="pad" data-k="' + k + '" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 0;font-size:16px;font-weight:700;color:var(--ink)">' + k + '</button>';
    }).join('');
    v.innerHTML = teachHead('starter', 'Starter', '<span class="pill pill-saved"><span>✓</span> saved · today\'s column auto-created</span>') +
      '<div style="flex:1;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px 14px;min-height:0">' + rows + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px">' + pad + '</div>';
    wireBack(v);
    v.querySelectorAll('.score-cell').forEach(function (b2) { b2.onclick = function () { scoreSel = +b2.dataset.i; renderScores(); }; });
    v.querySelectorAll('.ipad-tog').forEach(function (b2) { b2.onclick = function () { toggleIpad(b2.dataset.pid); }; });
    v.querySelectorAll('.pad').forEach(function (b2) { b2.onclick = function () { padKey(b2.dataset.k); }; });
  }
  function padKey(k) {
    var b = starterBlock(); var d = todayISO(); var list = sortedRoster();
    var p = list[scoreSel]; if (!p) return;
    if (k === '↵') { scoreSel = Math.min(scoreSel + 1, list.length - 1); renderScores(); return; }
    if (!b.scores[p.id]) b.scores[p.id] = {};
    if (!b.scores[p.id][d]) b.scores[p.id][d] = { v: null, ipad: false };
    var cur = b.scores[p.id][d].v;
    cur = cur == null ? '' : String(cur);
    var next = k === '⌫' ? cur.slice(0, -1) : (cur.length >= 2 ? cur : cur + k);
    b.scores[p.id][d].v = next === '' ? null : Number(next);
    if (typeof msSave === 'function') msSave(); flashSaved();
    renderScores();
  }
  function toggleIpad(pid) {
    var b = starterBlock(); var d = todayISO();
    if (!b.scores[pid]) b.scores[pid] = {};
    if (!b.scores[pid][d]) b.scores[pid][d] = { v: null, ipad: false };
    b.scores[pid][d].ipad = !b.scores[pid][d].ipad;
    if (typeof msSave === 'function') msSave(); flashSaved(); renderScores();
  }

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
    if (!starterSets()[addDaysISO(monday, 7)]) n.push({ b: "Next week's starter", t: ' not set yet', go: '__teach_starter', link: 'Starter ›' });
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
    buildTeachShell();
    buildPlan();

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
