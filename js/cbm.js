/* ============================================================
   cbm.js — MENTAL STARTER (CBM)
   Owner: Desk (docs/OWNERSHIP.md) · loads AFTER wrsteps.js and generator.js

   A second, separate morning starter built on curriculum-based
   measurement. Mental Starters (hub.js / starters.js) is untouched:
   this page has its own store, its own sheets and its own scores.

   THE ROUTINE
     1. Everyone gets the same 20 questions. Each slot is a fixed skill
        (a White Rose small step, or the half-term set's question for that
        position), with fresh numbers every day — so the sheet is a CBM
        probe, and "Q7" means the same skill all week.
     2. Children self-mark against the answers on the board.
     3. At the register each child calls their total and the numbers they
        got WRONG: "18, four and nine". The teacher types "4 9".
     4. The teacher live-marks the same TWO questions in every book while
        the class works — chosen by the app, never announced. Those two are
        an audit of each child's self-marking, called back as "yes no" and
        typed as "yn" after the wrong numbers.
     5. Every sheet carries a box of 4 practice questions chosen for that
        child from what the results show.

   WHY IT IS BUILT THIS WAY (the research it leans on)
     • Short, frequent mixed probes across the year's content: CBM — Deno
       (1985); Fuchs & Fuchs (1986) meta-analysis, effect ≈ 0.7.
     • A breakdown by skill, not just a score: Fuchs, Fuchs, Hamlett &
       Stecker (1990, 1991) — skills analysis improved teacher planning and
       pupil gains over score graphs alone.
     • Decision rules, because CBM only helps when teaching changes in
       response to it: Stecker, Fuchs & Fuchs (2005). Hence RETEACH/SECURE.
     • Item-level self-marking can be accurate: Sadler & Good (2006). It is
       least accurate for young and lower-attaining pupils (Ross, 2006;
       Brown & Harris, 2013) — hence the two audited questions and a
       per-child trust weight.
     • Targets stay until correct on two separate later days: successive
       relearning — Rawson & Dunlosky (2011, 2022).
     • Four different skills in the box, not four of one: interleaving —
       Rohrer et al. (2020).

   STORE  tp_cbm  (per class; in DATA_KEYS; see docs/CONTRACT.md)
     { ht: null | 'Autumn 1' … ,            // null = work it out from the date
       slots: (stepId|null)[20],             // the probe's blueprint
       days: { [iso]: {
         qs:    Question[20],                // descriptors, each with k (skill key)
         audit: [i, j],                      // 0-based slots the teacher marks
         marks: { [pid]: { w:[qNo…], a:[1|0|null, 1|0|null] } | { x:1 } },
         tg:    { [pid]: [{ k, y }] }        // the targets printed that day
       } } }
   A skill key is a step id ('a2.3') or 'pre:<set>:<slot>' for a slot left
   on the half-term set. Target QUESTIONS are not stored: they are rebuilt
   from a seed (day + pupil + skill), so a reprint is identical and the
   store stays small.
   ============================================================ */
(function () {
  'use strict';

  var N = 20;
  var KEY = 'tp_cbm';
  var RETEACH = 0.6;       // class below this on a skill → reteach it to everyone
  var SECURE = 0.9;        // at or above → secure
  var TARGETS = 4;
  var CLEAR_DAYS = 2;      // correct on this many separate later days clears a target
  var LOOKBACK = 28;       // days of evidence a target or estimate looks at
  var HALF_LIFE = 14;      // days for a result's weight to halve
  var PRIOR = 2;           // strength of the class rate as a child's starting point

  /* ── dates (local parts, never toISOString — BST midnight rolls back) ── */
  function isoOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); }
  function todayISO() { return isoOf(new Date()); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function mondayOf(s) { var d = parseISO(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); }
  function fullDate(s) { return parseISO(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }

  function halfTermFor(s) {
    var d = parseISO(s), m = d.getMonth() + 1, day = d.getDate();
    if (m >= 9 && m <= 10) return 'Autumn 1';
    if (m >= 11) return 'Autumn 2';
    if (m === 1 || (m === 2 && day < 20)) return 'Spring 1';
    if (m <= 3) return 'Spring 2';
    if (m <= 5) return 'Summer 1';
    return 'Summer 2';
  }

  /* ── seeded randomness, so a sheet rebuilt from a seed is identical ── */
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* The question builders call Math.random directly. Swapping it for the
     length of one build is what makes them reproducible without touching
     generator.js or wrsteps.js. */
  function withSeed(seed, fn) {
    var orig = Math.random; Math.random = seeded(seed);
    try { return fn(); } finally { Math.random = orig; }
  }

  /* ── store ────────────────────────────────────────────── */
  function normSlots(raw) {
    var out = [];
    for (var i = 0; i < N; i++) {
      var id = Array.isArray(raw) ? raw[i] : null;
      out.push(typeof id === 'string' && window.wrStep && window.wrStep(id) ? id : null);
    }
    return out;
  }
  function load() {
    var s = Store.get(KEY, null) || {};
    return { ht: typeof s.ht === 'string' ? s.ht : null, slots: normSlots(s.slots),
             days: s.days && typeof s.days === 'object' ? s.days : {} };
  }
  function save(s) { Store.set(KEY, s); }
  function htOf(state, iso) { return state.ht || halfTermFor(iso || todayISO()); }

  /* ── skills ───────────────────────────────────────────── */
  function setName(ht) { return typeof window.genSetName === 'function' ? window.genSetName(ht) : ht; }
  function slotKey(state, i, ht) {
    var id = state.slots[i];
    if (id && window.wrIsAvailable && window.wrIsAvailable(id)) return id;
    return 'pre:' + setName(ht) + ':' + i;
  }
  function presetQ(set, i) { var qs = window.genBuild ? window.genBuild(set, 'preset', N) : []; return qs[i] || { t: 'prompt', s: '', ans: '' }; }
  function buildKey(k, seed) {
    return withSeed(seed, function () {
      if (k.indexOf('pre:') === 0) { var p = k.split(':'); return presetQ(p[1], +p[2]); }
      return (window.wrBuild && window.wrBuild(k)) || { t: 'prompt', s: '', ans: '' };
    });
  }

  var TYPE_LABEL = {
    arith: null, arith3: 'Adding three numbers', half: 'Halving', times: 'Times tables', divide: 'Division',
    clock: 'Telling the time', placeval: 'Tens and ones', missing: 'Missing numbers', words: 'Numbers in words',
    shape: 'Properties of shape', future: 'Days and dates', compare: 'Comparing numbers', seq: 'Number sequences',
    tensones: 'Tens and ones', partition: 'Partitioning', step: 'More and less', prompt: 'Question'
  };
  var labelCache = {};
  function keyLabel(k) {
    if (labelCache[k]) return labelCache[k];
    var out;
    if (k.indexOf('pre:') === 0) {
      var p = k.split(':'), q = withSeed('label', function () { return presetQ(p[1], +p[2]); });
      var t = q.t === 'arith' ? (q.op === '-' ? 'Subtraction' : 'Addition') : (TYPE_LABEL[q.t] || 'Question');
      out = t + ' (Q' + (+p[2] + 1) + ')';
    } else {
      out = (window.wrShortLabel ? window.wrShortLabel(k) : k).replace(/^Step \d+ /, '');
    }
    return (labelCache[k] = out);
  }
  function keyTitle(k) { return k.indexOf('pre:') === 0 ? keyLabel(k) + ' — ' + k.split(':')[1] + ' set' : (window.wrLabel ? window.wrLabel(k) : k); }
  function nextStep(k) {
    var steps = window.WR_STEPS || [], i;
    for (i = 0; i < steps.length; i++) if (steps[i].id === k) break;
    for (i = i + 1; i < steps.length; i++) if (typeof steps[i].gen === 'function') return steps[i].id;
    return null;
  }

  function buildDay(state, iso) {
    var ht = htOf(state, iso), set = setName(ht);
    return withSeed('cbm:' + iso, function () {
      var base = window.genBuild ? window.genBuild(ht, 'preset', N) : [];
      var out = [];
      for (var i = 0; i < N; i++) {
        var k = slotKey(state, i, ht), q = null;
        if (k.indexOf('pre:') !== 0) q = window.wrBuild ? window.wrBuild(k) : null;
        if (!q) { q = base[i] || { t: 'prompt', s: '', ans: '' }; k = 'pre:' + set + ':' + i; }
        q = JSON.parse(JSON.stringify(q)); q.k = k;
        out.push(q);
      }
      return out;
    });
  }

  /* ── entry: "4 9 yn" → wrong 4 and 9, audit ✓ ✗ ──────────── */
  function parseEntry(str) {
    var s = String(str || '').trim().toLowerCase();
    if (!s) return { empty: true };
    var toks = s.split(/[\s,;/]+/).filter(Boolean), w = [], a = [], bad = [], x = false, none = false;
    toks.forEach(function (t) {
      if (t === 'abs' || t === 'absent' || t === 'a') x = true;
      else if (t === '0' || t === 'none' || t === '-' || t === '—' || t === 'all') none = true;
      else if (/^[yn✓✗]{1,2}$/.test(t)) t.split('').forEach(function (c) { a.push(c === 'y' || c === '✓' ? 1 : 0); });
      else if (/^\d+$/.test(t) && +t >= 1 && +t <= N) { if (w.indexOf(+t) < 0) w.push(+t); }
      else bad.push(t);
    });
    w.sort(function (p, q) { return p - q; });
    return { x: x, w: w, a: a.length ? a.slice(0, 2) : null, none: none, bad: bad };
  }

  /* ── analysis ─────────────────────────────────────────── */
  /* One row per pupil per question per day, in [from, to]. `ok` is the best
     evidence: the teacher's mark where there is one, otherwise the child's. */
  function results(state, from, to) {
    var out = [];
    Object.keys(state.days).sort().forEach(function (d) {
      if (d < from || d > to) return;
      var day = state.days[d], qs = day.qs || [], audit = day.audit || [];
      Object.keys(day.marks || {}).forEach(function (pid) {
        var m = day.marks[pid];
        if (!m || m.x || !Array.isArray(m.w)) return;
        for (var i = 0; i < qs.length; i++) {
          var self = m.w.indexOf(i + 1) >= 0 ? 0 : 1, ai = audit.indexOf(i);
          var t = ai >= 0 && m.a ? m.a[ai] : null;
          if (t === 0 || t === 1) out.push({ d: d, pid: pid, i: i, k: qs[i].k, ok: t, src: 'audit', self: self });
          else out.push({ d: d, pid: pid, i: i, k: qs[i].k, ok: self, src: 'self', self: self });
        }
      });
    });
    return out;
  }

  function analyse(state, to, windowDays) {
    windowDays = windowDays || 14;
    var look = Math.max(LOOKBACK, windowDays);
    var rs = results(state, addDays(to, -(look - 1)), to);
    var winFrom = addDays(to, -(windowDays - 1));
    var cls = {}, trust = {}, byPid = {};
    rs.forEach(function (r) {
      if (r.d >= winFrom) {
        var c = cls[r.k] || (cls[r.k] = { n: 0, ok: 0 });
        c.n++; c.ok += r.ok;
      }
      var t = trust[r.pid] || (trust[r.pid] = { agree: 0, total: 0, over: 0, under: 0 });
      if (r.src === 'audit') {
        t.total++;
        if (r.self === r.ok) t.agree++; else if (r.self === 1) t.over++; else t.under++;
      }
      var p = byPid[r.pid] || (byPid[r.pid] = {});
      (p[r.k] || (p[r.k] = [])).push(r);
    });
    Object.keys(cls).forEach(function (k) { cls[k].rate = cls[k].ok / cls[k].n; });
    /* Trust starts as if three audits had agreed, so one slip on day one
       does not halve a child's weight. Only OVER-claiming (ticking a wrong
       answer) costs trust: a child who says they got one wrong is believed. */
    Object.keys(trust).forEach(function (pid) {
      var t = trust[pid];
      t.t = Math.max(0.25, Math.min(1, (t.agree + 3) / (t.total + 3)));
      t.flag = t.over >= 2 && t.over / t.total >= 0.25;
    });
    return { to: to, cls: cls, trust: trust, byPid: byPid, windowDays: windowDays };
  }

  function trustOf(an, pid) { return an.trust[pid] || { agree: 0, total: 0, over: 0, under: 0, t: 1, flag: false }; }

  /* A child's chance of getting a skill right: the class rate as a weak
     prior, moved by their own results, recent ones counting more. A self-
     marked tick counts at the child's trust; a cross or a teacher's mark at
     full weight. */
  function estimate(an, pid, k) {
    var c = an.cls[k], pc = c && c.n ? c.rate : 0.8;
    var rs = (an.byPid[pid] || {})[k] || [], tr = trustOf(an, pid).t, a = 0, n = 0;
    rs.forEach(function (r) {
      var w = Math.pow(0.5, daysBetween(r.d, an.to) / HALF_LIFE) * (r.src === 'self' && r.ok === 1 ? tr : 1);
      a += w * r.ok; n += w;
    });
    return { p: (PRIOR * pc + a) / (PRIOR + n), n: rs.length, right: rs.filter(function (r) { return r.ok; }).length };
  }

  /* Successive relearning: open from the latest miss until correct on
     CLEAR_DAYS separate later days. A self-marked tick only counts towards
     clearing from a child whose self-marking has held up. */
  function openState(an, pid, k) {
    var rs = ((an.byPid[pid] || {})[k] || []).slice().sort(function (x, y) { return x.d < y.d ? -1 : 1; });
    var tr = trustOf(an, pid).t, byDay = {}, days = [];
    rs.forEach(function (r) {
      if (!(r.d in byDay)) { byDay[r.d] = { ok: true, firm: false }; days.push(r.d); }
      if (!r.ok) byDay[r.d].ok = false;
      if (r.src === 'audit' || tr >= 0.6) byDay[r.d].firm = true;
    });
    var lastMiss = null;
    days.forEach(function (d) { if (!byDay[d].ok) lastMiss = d; });
    if (!lastMiss) return { open: false, lastMiss: null, cleared: 0 };
    var cleared = days.filter(function (d) { return d > lastMiss && byDay[d].ok && byDay[d].firm; }).length;
    return { open: cleared < CLEAR_DAYS, lastMiss: lastMiss, cleared: cleared };
  }

  var WHY = { miss: 'got it wrong recently', 'class': 'class focus', low: 'not secure yet', stretch: 'challenge', keep: 'keep it sharp' };

  /* The four for one child on `iso`, from evidence BEFORE that day.
     keys: the day's 20 skill keys, in slot order. */
  function chooseTargets(an, pid, keys) {
    var mine = an.byPid[pid];
    if (!mine || !Object.keys(mine).length) return [];
    var uniq = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    var est = {}; uniq.forEach(function (k) { est[k] = estimate(an, pid, k); });
    Object.keys(mine).forEach(function (k) { if (!est[k]) est[k] = estimate(an, pid, k); });
    var out = [], have = {};
    function add(k, y) { if (out.length < TARGETS && !have[k]) { have[k] = 1; out.push({ k: k, y: y }); } }

    // 1. open targets: missed and not yet relearned
    Object.keys(est).map(function (k) { return { k: k, o: openState(an, pid, k), e: est[k] }; })
      .filter(function (x) { return x.o.open; })
      .sort(function (x, y) { return x.e.p - y.e.p || (x.o.lastMiss < y.o.lastMiss ? 1 : -1); })
      .forEach(function (x) { add(x.k, 'miss'); });
    // 2. what the whole class is weak on, unless this child is secure on it
    uniq.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH && est[k].p < SECURE; })
      .sort(function (x, y) { return an.cls[x].rate - an.cls[y].rate; })
      .forEach(function (k) { add(k, 'class'); });
    // 3. anything not yet secure for them
    uniq.filter(function (k) { return est[k].p < SECURE; })
      .sort(function (x, y) { return est[x].p - est[y].p; })
      .forEach(function (k) { add(k, 'low'); });
    // 4. secure on everything: the next small step on from what they know best
    uniq.filter(function (k) { return k.indexOf('pre:') !== 0 && est[k].n >= 2; })
      .sort(function (x, y) { return est[y].p - est[x].p; })
      .forEach(function (k) { var nx = nextStep(k); if (nx && uniq.indexOf(nx) < 0) add(nx, 'stretch'); });
    // 5. still short (a sheet of preset slots): their least-secure ones
    uniq.slice().sort(function (x, y) { return est[x].p - est[y].p; }).forEach(function (k) { add(k, 'keep'); });
    return out;
  }

  /* The two questions the teacher marks today. Favour skills the class gets
     wrong (where a self-marked tick is most likely to be wrong) and slots not
     audited lately; never the same slot twice in a week. */
  function pickAudit(state, iso) {
    var day = state.days[iso], keys = day ? day.qs.map(function (q) { return q.k; }) : buildDay(state, iso).map(function (q) { return q.k; });
    var an = analyse(state, addDays(iso, -1), 14), mon = mondayOf(iso), rnd = seeded('audit:' + iso);
    var thisWeek = {}, lately = {};
    Object.keys(state.days).forEach(function (d) {
      if (d >= iso) return;
      (state.days[d].audit || []).forEach(function (i) {
        if (d >= mon) thisWeek[i] = 1;
        if (daysBetween(d, iso) <= 10) lately[i] = 1;
      });
    });
    var scored = keys.map(function (k, i) {
      var c = an.cls[k], rate = c && c.n ? c.rate : 0.75;
      return { i: i, k: k, s: (thisWeek[i] ? -10 : 0) + (1 - rate) + (lately[i] ? 0 : 0.3) + rnd() * 0.25 };
    }).sort(function (x, y) { return y.s - x.s; });
    var out = [];
    scored.forEach(function (x) { if (out.length < 2 && !out.some(function (o) { return keys[o] === x.k; })) out.push(x.i); });
    return out.sort(function (a, b) { return a - b; });
  }

  function makeDay(state, iso) {
    var day = { qs: buildDay(state, iso), audit: [], marks: {}, tg: {} };
    state.days[iso] = day;
    day.audit = pickAudit(state, iso);
    return day;
  }

  function targetsForDay(state, iso, pid) {
    var day = state.days[iso];
    if (day.tg && day.tg[pid]) return day.tg[pid];
    var an = analyse(state, addDays(iso, -1), 14);
    return chooseTargets(an, pid, day.qs.map(function (q) { return q.k; }));
  }
  function freezeTargets(state, iso) {
    var day = state.days[iso], an = analyse(state, addDays(iso, -1), 14), keys = day.qs.map(function (q) { return q.k; });
    day.tg = {};
    roster.forEach(function (p) { day.tg[p.id] = chooseTargets(an, p.id, keys); });
  }

  /* ===================================================================
     SCREEN
     =================================================================== */
  var view = 'today', curDay = null, windowDays = 14;

  function GRQ(q) { return typeof window.genRenderQuestion === 'function' ? window.genRenderQuestion(q) : esc(q.s || ''); }
  function ans(q, iso) { return typeof window.genAnswer === 'function' ? window.genAnswer(q, iso) : (q.ans || ''); }
  function host() { return document.getElementById('page-cbm'); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function band(p) { return p >= SECURE ? 'sec' : p >= 0.75 ? 'ok' : p >= RETEACH ? 'mid' : 'low'; }

  function render() {
    var h = host(); if (!h) return;
    if (!curDay) curDay = todayISO();
    h.innerHTML =
      '<div class="page-header"><h1>Mental Starter (CBM)</h1>' +
      '<p>Same 20 questions for everyone. Children self-mark and call out the numbers they got wrong; you mark the same two questions in every book to check their marking. Each sheet ends with four questions chosen for that child.</p></div>' +
      '<div class="cbm-tabs">' + [['today', 'Today'], ['progress', 'Progress'], ['setup', 'Set up']].map(function (t) {
        return '<button type="button" class="cbm-tab' + (view === t[0] ? ' active' : '') + '" data-view="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><div id="cbmBody"></div>';
    h.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { view = b.dataset.view; render(); }; });
    if (!roster.length) { document.getElementById('cbmBody').innerHTML = '<div class="card empty">Add pupils on the Pupils page first.</div>'; return; }
    if (view === 'progress') renderProgress(); else if (view === 'setup') renderSetup(); else renderToday();
  }

  /* ── Today ────────────────────────────────────────────── */
  function renderToday() {
    var state = load(), day = state.days[curDay], body = document.getElementById('cbmBody');
    var nav = '<div class="cbm-daynav"><button type="button" class="secondary small" data-shift="-1" aria-label="Previous day">‹</button>' +
      '<input type="date" id="cbmDate" value="' + curDay + '"><button type="button" class="secondary small" data-shift="1" aria-label="Next day">›</button>' +
      '<b>' + esc(fullDate(curDay)) + '</b>' + (curDay === todayISO() ? '<span class="cbm-pill">Today</span>' : '') + '</div>';
    if (!day) {
      body.innerHTML = nav + '<div class="card cbm-empty"><h3>No sheet for this day yet</h3>' +
        '<p>Making it builds the 20 questions from <b>Set up</b> (' + esc(htOf(state, curDay)) + ') and picks the two you will mark.</p>' +
        '<button type="button" id="cbmMake">Make the sheet</button></div>';
      wireNav(body);
      document.getElementById('cbmMake').onclick = function () { var s = load(); makeDay(s, curDay); save(s); renderToday(); };
      return;
    }
    var a = day.audit, qa = a.map(function (i) { return 'Q' + (i + 1); });
    var entered = enteredCount(day);
    var rows = sortedRoster().map(function (p) { return rowHTML(state, day, p); }).join('');
    body.innerHTML = nav +
      '<div class="cbm-audit"><div><div class="cbm-k">Mark these two in every book — don\'t tell the class which</div>' +
        '<div class="cbm-auditq">' + a.map(function (i) { return '<span><b>Q' + (i + 1) + '</b> ' + esc(keyLabel(day.qs[i].k)) + ' <em>' + esc(ans(day.qs[i], curDay)) + '</em></span>'; }).join('') + '</div></div>' +
        '<div class="cbm-actions">' +
          '<button type="button" id="cbmPrintAll">Print class set</button>' +
          '<button type="button" class="secondary" id="cbmPrintOne">Print one blank sheet</button>' +
          '<button type="button" class="secondary" id="cbmBoard">Answers on the board</button>' +
        '</div></div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Scores</h3><span class="cbm-count" id="cbmCount">' + entered + ' of ' + roster.length + ' entered</span></div>' +
        '<p class="cbm-hint">Type the question numbers they got <b>wrong</b>: <code>4 9</code>. <code>0</code> = all right, <code>abs</code> = absent, blank = not done. ' +
        'Add your two marks as <code>yn</code> (' + qa.join(' then ') + ') or tap them. Enter moves to the next child.</p>' +
        '<div class="table-wrap"><table class="cbm-table"><thead><tr><th class="name">Pupil</th><th>Wrong</th><th>' + qa[0] + '</th><th>' + qa[1] + '</th><th class="num">Score</th><th>Practice box</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>' +
      '<details class="card cbm-qlist"><summary>Today\'s 20 questions and answers</summary><ol>' +
        day.qs.map(function (q, i) { return '<li' + (a.indexOf(i) >= 0 ? ' class="is-audit"' : '') + '><span class="cbm-qtext">' + GRQ(q) + '</span><span class="cbm-qans">' + esc(ans(q, curDay)) + '</span><span class="cbm-qskill" title="' + esc(keyTitle(q.k)) + '">' + esc(keyLabel(q.k)) + '</span></li>'; }).join('') +
      '</ol><div class="cbm-qtools"><button type="button" class="secondary small" id="cbmRetarget">Recalculate practice boxes</button>' +
        '<button type="button" class="danger small" id="cbmDelete">Delete this sheet</button></div></details>';
    wireNav(body);
    wireRows(body);
    document.getElementById('cbmPrintAll').onclick = function () { printSheets(true); };
    document.getElementById('cbmPrintOne').onclick = function () { printSheets(false); };
    document.getElementById('cbmBoard').onclick = showAnswers;
    document.getElementById('cbmRetarget').onclick = function () { var s = load(); s.days[curDay].tg = {}; save(s); renderToday(); };
    document.getElementById('cbmDelete').onclick = function () {
      var has = enteredCount(day);
      if (!confirm('Delete the sheet for ' + fullDate(curDay) + (has ? ' and the ' + has + ' scores entered for it' : '') + '?')) return;
      var s = load(); delete s.days[curDay]; save(s); renderToday();
    };
  }

  function wireNav(body) {
    body.querySelectorAll('[data-shift]').forEach(function (b) {
      b.onclick = function () {
        var d = addDays(curDay, +b.dataset.shift), wd = parseISO(d).getDay();
        if (wd === 6) d = addDays(d, +b.dataset.shift > 0 ? 2 : -1);
        else if (wd === 0) d = addDays(d, +b.dataset.shift > 0 ? 1 : -2);
        curDay = d; renderToday();
      };
    });
    var di = document.getElementById('cbmDate');
    if (di) di.onchange = function () { if (di.value) { curDay = di.value; renderToday(); } };
  }

  function scored(m) { return !!(m && (m.x || Array.isArray(m.w))); }
  function enteredCount(day) { return roster.filter(function (p) { return scored(day.marks[p.id]); }).length; }
  function entryText(m) { if (!scored(m)) return ''; if (m.x) return 'abs'; return m.w.length ? m.w.join(' ') : '0'; }
  function auditBtn(m, j) {
    var v = m && !m.x && m.a ? m.a[j] : null;
    return '<button type="button" class="cbm-mark' + (v === 1 ? ' yes' : v === 0 ? ' no' : '') + '" data-aj="' + j + '"' + (m && m.x ? ' disabled' : '') +
      ' aria-label="Your mark for this question">' + (v === 1 ? '✓' : v === 0 ? '✗' : '·') + '</button>';
  }
  function scoreHTML(day, m) {
    if (!scored(m)) return '<span class="muted">—</span>';
    if (m.x) return '<span class="muted">absent</span>';
    var over = (m.a || []).some(function (v, j) { return v === 0 && m.w.indexOf(day.audit[j] + 1) < 0; });
    return '<b>' + (N - m.w.length) + '</b>' + (over ? ' <span class="cbm-flag" title="You marked one of your two wrong, but they had it ticked">ticked a wrong one</span>' : '');
  }
  function boxHTML(state, day, pid) {
    var tg = day.tg && day.tg[pid] ? day.tg[pid] : targetsForDay(state, curDay, pid);
    if (!tg.length) return '<span class="muted small">after the first scores</span>';
    return tg.map(function (t) { return '<span class="cbm-tg cbm-tg-' + t.y + '" title="' + esc(keyTitle(t.k) + ' — ' + WHY[t.y]) + '">' + esc(keyLabel(t.k)) + '</span>'; }).join('');
  }
  function rowHTML(state, day, p) {
    var m = day.marks[p.id];
    return '<tr data-pid="' + p.id + '"><td class="name">' + esc(p.name) + '</td>' +
      '<td><input class="cbm-in" type="text" inputmode="text" autocomplete="off" value="' + esc(entryText(m)) + '" placeholder="e.g. 4 9" aria-label="Wrong questions for ' + esc(p.name) + '"></td>' +
      '<td>' + auditBtn(m, 0) + '</td><td>' + auditBtn(m, 1) + '</td>' +
      '<td class="num cbm-score">' + scoreHTML(day, m) + '</td><td class="cbm-box-cell">' + boxHTML(state, day, p.id) + '</td></tr>';
  }

  function wireRows(body) {
    function refresh(tr) {
      var s = load(), day = s.days[curDay], p = roster.find(function (x) { return x.id === tr.dataset.pid; });
      // update the cells in place: replacing the row would pull the focused input out
      // from under the browser, which fires its change event a second time mid-update
      var m = day.marks[p.id], td = tr.children, input = tr.querySelector('.cbm-in');
      input.value = entryText(m); input.classList.remove('bad'); input.title = '';
      td[2].innerHTML = auditBtn(m, 0); td[3].innerHTML = auditBtn(m, 1);
      td[4].innerHTML = scoreHTML(day, m); td[5].innerHTML = boxHTML(s, day, p.id);
      document.getElementById('cbmCount').textContent = enteredCount(day) + ' of ' + roster.length + ' entered';
    }
    function commit(input) {
      var tr = input.closest('tr'), pid = tr.dataset.pid, s = load(), day = s.days[curDay], prev = day.marks[pid];
      var r = parseEntry(input.value);
      input.classList.toggle('bad', !!(r.bad && r.bad.length));
      if (r.bad && r.bad.length) { input.title = 'Not understood: ' + r.bad.join(' '); return null; }
      var keepA = prev && !prev.x && prev.a ? prev.a : null;
      if (r.empty) {
        // the teacher's marks can arrive before the child's score: keep them, but it is not a result yet
        if (keepA && keepA.some(function (v) { return v != null; })) day.marks[pid] = { a: keepA };
        else delete day.marks[pid];
      } else if (r.x) day.marks[pid] = { x: 1 };
      else day.marks[pid] = { w: r.w, a: r.a || keepA || [null, null] };
      save(s);
      return pid;
    }
    body.querySelectorAll('.cbm-table tbody').forEach(function (tb) {
      tb.addEventListener('change', function (e) {
        if (!e.target.classList.contains('cbm-in')) return;
        var tr = e.target.closest('tr');
        if (commit(e.target)) refresh(tr);
      });
      tb.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !e.target.classList.contains('cbm-in')) return;
        e.preventDefault();
        var tr = e.target.closest('tr');
        if (!commit(e.target)) return;
        refresh(tr);
        var next = tr.nextElementSibling;
        if (next) next.querySelector('.cbm-in').focus(); else e.target.blur();
      });
      tb.addEventListener('click', function (e) {
        var b = e.target.closest('.cbm-mark'); if (!b || b.disabled) return;
        var tr = b.closest('tr'), pid = tr.dataset.pid, s = load(), day = s.days[curDay], m = day.marks[pid], j = +b.dataset.aj;
        if (!m) m = day.marks[pid] = { a: [null, null] };
        if (m.x) return;
        if (!m.a) m.a = [null, null];
        m.a[j] = m.a[j] === null || m.a[j] === undefined ? 1 : m.a[j] === 1 ? 0 : null;
        save(s); refresh(tr);
      });
    });
  }

  /* ── Answers on the board ─────────────────────────────── */
  function showAnswers() {
    var day = load().days[curDay]; if (!day) return;
    var ov = document.getElementById('cbmAnswers');
    if (!ov) { ov = document.createElement('div'); ov.id = 'cbmAnswers'; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="cbm-ans-top"><b>Answers · ' + esc(fullDate(curDay)) + '</b><button type="button" id="cbmAnsClose">Close</button></div>' +
      '<ol class="cbm-ans-grid">' + day.qs.map(function (q) { return '<li><span>' + esc(ans(q, curDay)) + '</span></li>'; }).join('') + '</ol>';
    ov.style.display = 'flex';
    function close() { ov.style.display = 'none'; document.removeEventListener('keydown', esc_); }
    function esc_(e) { if (e.key === 'Escape') close(); }
    document.getElementById('cbmAnsClose').onclick = close;
    document.addEventListener('keydown', esc_);
  }

  /* ── Print ────────────────────────────────────────────── */
  function sheetHTML(day, iso, name, targets, pid) {
    var cells = day.qs.map(function (q, i) { return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('');
    var box = '';
    if (targets && targets.length) {
      box = '<div class="cbm-pbox"><div class="cbm-pbox-h">My ' + targets.length + ' to practise</div><div class="cbm-pbox-grid">' +
        targets.map(function (t, i) {
          var q = buildKey(t.k, 'cbm:' + iso + ':' + pid + ':' + t.k);
          return '<div class="gen-q"><span class="gen-num">' + 'abcd'.charAt(i) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>';
        }).join('') + '</div></div>';
    }
    return '<div class="card gen-sheet gen-day cbm-sheet"><h2 class="gen-heading">' + (name ? '<span class="gen-day-name">' + esc(name) + '</span> · ' : '') +
      esc(fullDate(iso)) + ' · Mental Starter</h2><div class="gen-grid">' + cells + '</div>' + box + '</div>';
  }
  function printSheets(personal) {
    var s = load(), day = s.days[curDay]; if (!day) return;
    var html = '';
    if (personal) {
      if (!day.tg || !Object.keys(day.tg).length) { freezeTargets(s, curDay); save(s); }
      sortedRoster().forEach(function (p) {
        if (!day.tg[p.id]) day.tg[p.id] = targetsForDay(s, curDay, p.id);
        html += sheetHTML(day, curDay, p.name, day.tg[p.id], p.id);
      });
      save(s);
    } else html = sheetHTML(day, curDay, '', null, '');
    var c = document.getElementById('starterPrint');
    if (!c) { c = document.createElement('div'); c.id = 'starterPrint'; document.body.appendChild(c); }
    c.innerHTML = html;
    window.print();
    if (view === 'today') renderToday();
  }

  /* ── Progress ─────────────────────────────────────────── */
  function renderProgress() {
    var state = load(), body = document.getElementById('cbmBody');
    var dates = Object.keys(state.days).sort(), last = dates.filter(function (d) { return d <= todayISO(); }).pop();
    if (!last) { body.innerHTML = '<div class="card empty">No sheets yet. Make one on <b>Today</b>.</div>'; return; }
    var an = analyse(state, todayISO(), windowDays);
    var latest = state.days[last], keys = latest.qs.map(function (q) { return q.k; });
    Object.keys(an.cls).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });

    var reteach = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH; }).sort(function (a, b) { return an.cls[a].rate - an.cls[b].rate; });
    var secure = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate >= SECURE; });
    var checks = sortedRoster().filter(function (p) { return trustOf(an, p.id).flag; });
    function chips(list, empty, fmt) { return list.length ? list.map(fmt).join('') : '<span class="muted small">' + empty + '</span>'; }

    var head = '<tr><th class="name">Pupil</th>' + keys.map(function (k, i) {
      return '<th class="cbm-hk" title="' + esc(keyTitle(k)) + '"><span>' + esc(keyLabel(k)) + '</span></th>';
    }).join('') + '<th title="Your two marks that agreed with theirs">Self-marking</th><th>Practice box next</th></tr>';
    var classRow = '<tr class="cbm-classrow"><td class="name">Class</td>' + keys.map(function (k) {
      var c = an.cls[k]; return c ? '<td class="cbm-cell b-' + band(c.rate) + '" title="' + esc(keyLabel(k) + ': ' + c.ok + ' of ' + c.n + ' right') + '">' + pct(c.rate) + '</td>' : '<td class="cbm-cell">·</td>';
    }).join('') + '<td></td><td></td></tr>';
    var nextKeys = latest.qs.map(function (q) { return q.k; });
    var rows = sortedRoster().map(function (p) {
      var t = trustOf(an, p.id);
      var cells = keys.map(function (k) {
        var e = estimate(an, p.id, k), o = openState(an, p.id, k);
        if (!e.n) return '<td class="cbm-cell">·</td>';
        return '<td class="cbm-cell b-' + band(e.p) + (o.open ? ' is-open' : '') + '" title="' + esc(p.name + ' · ' + keyLabel(k) + ': ' + e.right + ' of ' + e.n + ' right' + (o.open ? ' — practising until right on ' + CLEAR_DAYS + ' more days (' + o.cleared + ' so far)' : '')) + '">' + (e.right + '/' + e.n) + '</td>';
      }).join('');
      var tg = chooseTargets(an, p.id, nextKeys);
      return '<tr><td class="name">' + esc(p.name) + '</td>' + cells +
        '<td class="cbm-trust">' + (t.total ? t.agree + '/' + t.total : '<span class="muted">—</span>') + (t.flag ? ' <span class="cbm-flag">check</span>' : '') + '</td>' +
        '<td class="cbm-box-cell">' + (tg.length ? tg.map(function (x) { return '<span class="cbm-tg cbm-tg-' + x.y + '" title="' + esc(WHY[x.y]) + '">' + esc(keyLabel(x.k)) + '</span>'; }).join('') : '<span class="muted small">—</span>') + '</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="cbm-daynav"><label for="cbmWin">Looking at</label><select id="cbmWin">' +
        [[7, 'the last week'], [14, 'the last 2 weeks'], [28, 'the last 4 weeks'], [91, 'the last term']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === windowDays ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="cbm-cards">' +
        '<div class="card cbm-card"><h3>Reteach to the class</h3><p class="cbm-hint">Under ' + pct(RETEACH) + ' right across the class.</p>' + chips(reteach, 'Nothing below ' + pct(RETEACH) + '.', function (k) { return '<span class="cbm-chip low" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + ' · ' + pct(an.cls[k].rate) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Secure</h3><p class="cbm-hint">' + pct(SECURE) + ' or more right. Could leave the sheet for a harder step.</p>' + chips(secure, 'Nothing secure yet.', function (k) { return '<span class="cbm-chip sec" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Check their self-marking</h3><p class="cbm-hint">Ticked answers you marked wrong at least twice.</p>' + chips(checks, 'No one.', function (p) { var t = trustOf(an, p.id); return '<span class="cbm-chip mid">' + esc(p.name) + ' · ' + t.over + ' of ' + t.total + '</span>'; }) + '</div>' +
      '</div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Skill by skill</h3><span class="cbm-legend"><i class="b-low"></i>under 60% <i class="b-mid"></i>60–74% <i class="b-ok"></i>75–89% <i class="b-sec"></i>90%+ <i class="is-open"></i>practising</span></div>' +
        '<p class="cbm-hint">Each cell is right/answered. Colour is the best estimate for that child: their own results, recent ones counting more, pulled towards the class while there are only a few.</p>' +
        '<div class="table-wrap"><table class="cbm-grid"><thead>' + head + '</thead><tbody>' + classRow + rows + '</tbody></table></div></div>';
    document.getElementById('cbmWin').onchange = function (e) { windowDays = +e.target.value; renderProgress(); };
  }

  /* ── Set up ───────────────────────────────────────────── */
  function renderSetup() {
    var state = load(), body = document.getElementById('cbmBody'), ht = htOf(state);
    var picker = typeof window.genStepPicker === 'function' ? window.genStepPicker(state.slots, ht) : '';
    body.innerHTML =
      '<div class="card"><div class="cbm-setrow"><div><label for="cbmHT">Half term</label><select id="cbmHT">' +
        '<option value="">Work it out from the date (' + esc(halfTermFor(todayISO())) + ')</option>' +
        HALF_TERMS.map(function (h) { return '<option' + (state.ht === h ? ' selected' : '') + '>' + h + '</option>'; }).join('') +
      '</select></div><div class="grow"></div><button type="button" class="secondary" id="cbmCopy">Copy the questions from Mental Starters</button></div>' +
      '<p class="cbm-hint">Each slot stays the same skill every day, with new numbers, so results build up skill by skill. Changes apply to sheets made from now on.</p>' +
      picker + '</div>' +
      '<details class="card cbm-why"><summary>How it decides, and the research behind it</summary>' +
        '<ul>' +
        '<li><b>The sheet is a CBM probe:</b> short, mixed and frequent (Deno, 1985; Fuchs &amp; Fuchs, 1986).</li>' +
        '<li><b>Results by skill, not just a total:</b> skills analysis helped teachers plan and pupils gain more than score graphs alone (Fuchs, Fuchs, Hamlett &amp; Stecker, 1990, 1991).</li>' +
        '<li><b>Fixed rules for acting on it:</b> under ' + pct(RETEACH) + ' across the class → reteach; ' + pct(SECURE) + '+ → secure. CBM only helps when teaching changes in response (Stecker, Fuchs &amp; Fuchs, 2005).</li>' +
        '<li><b>Self-marking, checked:</b> pupils can mark accurately (Sadler &amp; Good, 2006) but young children are the least accurate (Ross, 2006; Brown &amp; Harris, 2013). Your two marks replace theirs on those questions; a child who ticks wrong answers has their ticks counted for less until they improve. A cross is always believed.</li>' +
        '<li><b>A practice question stays until it is right on ' + CLEAR_DAYS + ' separate later days</b> (successive relearning: Rawson &amp; Dunlosky, 2011, 2022).</li>' +
        '<li><b>Four different skills, mixed:</b> interleaved practice (Rohrer et al., 2020). Order: questions they got wrong → what the class is weak on → anything not secure → the next small step (a challenge) once everything is secure.</li>' +
        '<li><b>Your two questions:</b> picked from skills the class gets wrong, where a self-marked tick is most likely to be wrong, and never the same slot twice in a week.</li>' +
        '</ul></details>';
    document.getElementById('cbmHT').onchange = function (e) { var s = load(); s.ht = e.target.value || null; save(s); renderSetup(); };
    document.getElementById('cbmCopy').onclick = function () {
      var cfg = Store.get('tp_starter_cfg', null) || {};
      var s = load(); s.slots = normSlots(cfg.slots); save(s); renderSetup();
    };
    body.querySelectorAll('[data-slot]').forEach(function (sel) {
      sel.onchange = function () { var s = load(); s.slots[+sel.dataset.slot] = sel.value || null; save(s); renderSetup(); };
    });
    var clr = body.querySelector('[data-gen-clear]');
    if (clr) clr.onclick = function () { var s = load(); s.slots = normSlots([]); save(s); renderSetup(); };
  }

  window.addEventListener('tp:sync', function () { var h = host(); if (h && h.classList.contains('active')) render(); });

  window.cbmRender = render;
  /* pure parts, for tests */
  window.CBM = {
    parseEntry: parseEntry, buildDay: buildDay, makeDay: makeDay, pickAudit: pickAudit,
    results: results, analyse: analyse, estimate: estimate, openState: openState,
    chooseTargets: chooseTargets, keyLabel: keyLabel, halfTermFor: halfTermFor,
    load: load, save: save, buildKey: buildKey
  };
})();
