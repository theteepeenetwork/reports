/* ============================================================
   cbm.js — MENTAL STARTER (CBM)
   Owner: Desk (docs/OWNERSHIP.md) · loads AFTER wrsteps.js and generator.js

   A second, separate morning starter built on curriculum-based
   measurement. Mental Starters (hub.js / starters.js) is untouched:
   this page has its own store, its own sheets and its own scores.

   THE ROUTINE — about ten seconds a child at the register
     1. Everyone gets the same 20 questions. Each slot is a fixed skill
        (a White Rose small step, or the half-term set's question for that
        position) with fresh numbers every day, so "Q7" means the same skill
        all week.
     2. Children self-mark against the answers on the board.
     3. While they work, the teacher live-marks the SAME TWO questions in
        every book, chosen by the app and never announced: one from the
        first half of the sheet and one from the second.
     4. At the register each child calls their score and the teacher's two
        marks: "seventeen, yes no". Typed as 17 yn (b = left blank).
     5. Every sheet carries a box of practice questions chosen for that child.

   WHERE THE DETAIL COMES FROM — sampling, not marking everything
     Each day the class answers 2 audited questions each, a different pair
     every day. Over a fortnight every skill has been checked across the
     whole class (matrix sampling), and every child has a growing record of
     checked answers. A child's chance on a skill they have not been checked
     on yet is inferred from two things the app does know: how hard the class
     finds that skill (from everyone's checked answers) and how strong this
     child is overall (their checked answers and their own scores) — the
     idea behind item response theory (Rasch). Each checked answer then moves
     that child's estimate for that one skill.

   SCALING BACK — a child who is not finishing or is finding it too hard
     Struggling on a sheet: under half right, or a BLANK on the teacher's
     second-half question (they did not get that far). Two of the last three
     sheets like that moves the child to a SUPPORTED sheet of their own:
     fewer questions, mostly simple calculations from the foundation ladder
     below, plus the class questions they are most likely to get right. It is
     rebuilt every day from how they did: two good sheets running (85%+, no
     blanks) adds two questions and moves them up a rung; two hard ones takes
     two away and moves them down. Past 18 questions they rejoin the full
     sheet.

   THE RESEARCH (also in the Set up tab)
     CBM — Deno (1985); Fuchs & Fuchs (1986). Skills analysis — Fuchs,
     Fuchs, Hamlett & Stecker (1990, 1991). Decision rules — Stecker, Fuchs
     & Fuchs (2005). Matrix sampling — Shoemaker (1973). Self-assessment
     accuracy — Ross (2006); Brown & Harris (2013). Spaced retrieval —
     Cepeda et al. (2006). Interleaving — Rohrer et al. (2020). Instructional
     vs frustration level — Gickling & Armstrong (1978); Burns (2004);
     VanDerHeyden & Burns (2005). Easy items mixed in raise completion —
     Skinner (2002). Contingent, fading support — Wood, Bruner & Ross (1976);
     van de Pol, Volman & Beishuizen (2010).

   STORE  tp_cbm  (per class; in DATA_KEYS; see docs/CONTRACT.md)
     { ht: null | 'Autumn 1' … ,                // null = work it out from the date
       slots: (stepId|null)[20],                 // the probe's blueprint
       support: { [pid]: { mode:'auto'|'full'|'support', rung?, rungAt? } },
       days: { [iso]: {
         qs:     Question[20],                   // each with k (skill key)
         audit:  [i, j],                         // 0-based slots the teacher marks
         sheets: { [pid]: { qs, audit, rung, why } },   // a supported child's own sheet
         marks:  { [pid]: { s, a:[m, m] } | { x:1 } | { a } },
         tg:     { [pid]: [{ k, y }] }           // the practice box printed that day
       } } }
   s = the child's score; a = the teacher's two marks: 1 right, 0 wrong,
   -1 blank, null not given. { a } alone is marks waiting for a score.
   Marks saved by the first version carry w (wrong questions) instead of s;
   they read as s = length − w.length.
   A skill key is a step id ('a2.3'), 'pre:<set>:<slot>' for a slot left on
   the half-term set, or 'fd:<name>' for a foundation calculation. Practice
   questions are rebuilt from a seed, so a reprint is identical and nothing
   extra is stored.
   ============================================================ */
(function () {
  'use strict';

  var N = 20;
  var KEY = 'tp_cbm';
  var RETEACH = 0.6;       // class below this on a skill → reteach it to everyone
  var SECURE = 0.9;        // at or above → secure
  var TARGETS = 4, SUP_TARGETS = 2;
  var KEEP_SHEETS = 3;     // a checked mistake stays in the box for this many sheets
  var LOOKBACK = 42;       // days of evidence an estimate looks at
  var HALF_LIFE = 21;      // days for a checked answer's weight to halve
  var PRIOR = 2;           // how many checked answers the inferred chance is worth
  var SUP_MIN = 6, SUP_START_MAX = 14, SUP_MAX = 18;

  /* ── dates (local parts, never toISOString — BST midnight rolls back) ── */
  function isoOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); }
  function todayISO() { return isoOf(new Date()); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function mondayOf(s) { var d = parseISO(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); }
  function fullDate(s) { return parseISO(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function shortDate(s) { return parseISO(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }); }

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
     length of one build makes them reproducible without touching
     generator.js or wrsteps.js. */
  function withSeed(seed, fn) {
    var orig = Math.random; Math.random = seeded(seed);
    try { return fn(); } finally { Math.random = orig; }
  }
  function logit(p) { p = Math.min(0.97, Math.max(0.03, p)); return Math.log(p / (1 - p)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

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
             support: s.support && typeof s.support === 'object' ? s.support : {},
             days: s.days && typeof s.days === 'object' ? s.days : {} };
  }
  function save(s) { Store.set(KEY, s); }
  function htOf(state, iso) { return state.ht || halfTermFor(iso || todayISO()); }
  function supportOf(state, pid) { var o = state.support[pid]; return o && typeof o === 'object' ? o : { mode: 'auto' }; }

  /* ── foundation ladder ────────────────────────────────── */
  /* Simple calculations, easiest first, for a child the full sheet is too
     much for. Descriptors use the generator's own types, so they render and
     answer like every other question. Ids are persisted: append, never
     reorder or rename. */
  function R(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function P(a) { return a[Math.floor(Math.random() * a.length)]; }
  var FD = [
    { id: 'fd:more1', label: 'One more, one less', gen: function () { return { t: 'step', n: R(2, 19), by: 1, dir: P(['more', 'less']) }; } },
    { id: 'fd:add10', label: 'Adding within 10', gen: function () { var a = R(1, 8); return { t: 'arith', a: a, b: R(1, 10 - a), op: '+' }; } },
    { id: 'fd:sub10', label: 'Taking away within 10', gen: function () { var a = R(3, 10); return { t: 'arith', a: a, b: R(1, a - 1), op: '-' }; } },
    { id: 'fd:bond10', label: 'Number bonds to 10', gen: function () { var a = R(1, 9); return { t: 'missing', a: a, b: 10 - a, sum: 10, blank: P(['a', 'b']) }; } },
    { id: 'fd:double', label: 'Doubles', gen: function () { var a = R(1, 10); return { t: 'arith', a: a, b: a, op: '+' }; } },
    { id: 'fd:add20', label: 'Adding to a teen number', gen: function () { var o = R(1, 7); return { t: 'arith', a: 10 + o, b: R(1, 9 - o), op: '+' }; } },
    { id: 'fd:sub20', label: 'Taking away from a teen number', gen: function () { var o = R(2, 9); return { t: 'arith', a: 10 + o, b: R(1, o - 1), op: '-' }; } },
    { id: 'fd:ten', label: '10 more, 10 less', gen: function () { return { t: 'step', n: R(11, 89), by: 10, dir: P(['more', 'less']) }; } },
    { id: 'fd:addx', label: 'Adding across 10', gen: function () { var a = R(5, 9); return { t: 'arith', a: a, b: R(11 - a, 9), op: '+' }; } },
    { id: 'fd:subx', label: 'Taking away across 10', gen: function () { var b = R(3, 9); return { t: 'arith', a: R(11, 9 + b), b: b, op: '-' }; } }
  ];
  var START_RUNG = 1;      // adding within 10: most Year 2 children can, which makes a first supported sheet finishable
  function fdIndex(k) { for (var i = 0; i < FD.length; i++) if (FD[i].id === k) return i; return -1; }
  function isFd(k) { return String(k).indexOf('fd:') === 0; }
  function clampRung(r) { return Math.max(0, Math.min(FD.length - 1, r | 0)); }

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
      if (isFd(k)) { var f = FD[fdIndex(k)]; return f ? f.gen() : { t: 'prompt', s: '', ans: '' }; }
      return (window.wrBuild && window.wrBuild(k)) || { t: 'prompt', s: '', ans: '' };
    });
  }

  var TYPE_LABEL = {
    arith3: 'Adding three numbers', half: 'Halving', times: 'Times tables', divide: 'Division',
    clock: 'Telling the time', placeval: 'Tens and ones', missing: 'Missing numbers', words: 'Numbers in words',
    shape: 'Properties of shape', future: 'Days and dates', compare: 'Comparing numbers', seq: 'Number sequences',
    tensones: 'Tens and ones', partition: 'Partitioning', step: 'More and less', prompt: 'Question'
  };
  var labelCache = {};
  function keyLabel(k) {
    if (labelCache[k]) return labelCache[k];
    var out;
    if (isFd(k)) out = fdIndex(k) >= 0 ? FD[fdIndex(k)].label : k;
    else if (k.indexOf('pre:') === 0) {
      var p = k.split(':'), q = withSeed('label', function () { return presetQ(p[1], +p[2]); });
      var t = q.t === 'arith' ? (q.op === '-' ? 'Subtraction' : 'Addition') : (TYPE_LABEL[q.t] || 'Question');
      out = t + ' (Q' + (+p[2] + 1) + ')';
    } else {
      out = (window.wrShortLabel ? window.wrShortLabel(k) : k).replace(/^Step \d+ /, '');
    }
    return (labelCache[k] = out);
  }
  function keyTitle(k) {
    if (isFd(k)) return 'Simple calculation: ' + keyLabel(k);
    return k.indexOf('pre:') === 0 ? keyLabel(k) + ' — ' + k.split(':')[1] + ' set' : (window.wrLabel ? window.wrLabel(k) : k);
  }
  function nextStep(k) {
    if (isFd(k)) { var f = fdIndex(k); return f >= 0 && f < FD.length - 1 ? FD[f + 1].id : null; }
    var steps = window.WR_STEPS || [], i;
    for (i = 0; i < steps.length; i++) if (steps[i].id === k) break;
    for (i = i + 1; i < steps.length; i++) if (typeof steps[i].gen === 'function') return steps[i].id;
    return null;
  }

  function seedOf(iso, v) { return 'cbm:' + iso + (v ? '#' + v : ''); }   // v: how many times the day has been remade
  function buildDay(state, iso, v) {
    var ht = htOf(state, iso), set = setName(ht);
    return withSeed(seedOf(iso, v), function () {
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

  /* ── marks ────────────────────────────────────────────── */
  function sheetOf(day, pid) { return (day.sheets && day.sheets[pid]) || day; }
  function scoreOf(m, len) {
    if (!m || m.x) return null;
    if (typeof m.s === 'number') return m.s;
    if (Array.isArray(m.w)) return Math.max(0, len - m.w.length);   // first-version marks
    return null;
  }
  function isScored(m) { return !!(m && (m.x || typeof m.s === 'number' || Array.isArray(m.w))); }

  /* "17 yn" → score 17, teacher's marks ✓ ✗. b or - is a blank. */
  function parseEntry(str, max) {
    max = max || N;
    var s = String(str || '').trim().toLowerCase();
    if (!s) return { empty: true };
    var toks = s.split(/[\s,;/]+/).filter(Boolean), score = null, a = [], bad = [], x = false;
    toks.forEach(function (t) {
      if (t === 'abs' || t === 'absent') x = true;
      else if (/^\d+$/.test(t) && score === null && +t <= max) score = +t;
      else if (/^[ynb✓✗–-]{1,2}$/.test(t)) t.split('').forEach(function (c) { a.push(c === 'y' || c === '✓' ? 1 : (c === 'n' || c === '✗') ? 0 : -1); });
      else bad.push(t);
    });
    if (a.length > 2) bad.push('only two marks');
    return { x: x, s: score, a: a.length ? a.slice(0, 2) : null, bad: bad };
  }

  /* ── evidence ─────────────────────────────────────────── */
  /* One row per checked question per pupil per day. ok: 1 right, 0 wrong,
     null blank (not reached — no evidence about the skill). */
  function results(state, from, to) {
    var out = [];
    Object.keys(state.days).sort().forEach(function (d) {
      if (d < from || d > to) return;
      var day = state.days[d];
      Object.keys(day.marks || {}).forEach(function (pid) {
        var m = day.marks[pid];
        if (!m || m.x || !m.a) return;
        var sh = sheetOf(day, pid);
        (sh.audit || []).forEach(function (i, j) {
          var v = m.a[j]; if (v !== 0 && v !== 1 && v !== -1) return;
          out.push({ d: d, pid: pid, i: i, k: sh.qs[i].k, ok: v === -1 ? null : v, late: i >= sh.qs.length / 2 });
        });
      });
    });
    return out;
  }

  /* Each child's sheets, newest first: score, how much of it was right, and
     whether the teacher's marks found a blank. */
  function sessions(state, pid, before, n) {
    var out = [];
    Object.keys(state.days).sort().reverse().forEach(function (d) {
      if (d >= before || out.length >= n) return;
      var day = state.days[d], m = day.marks && day.marks[pid], sh = sheetOf(day, pid), len = sh.qs.length;
      var sc = scoreOf(m, len); if (sc === null) return;
      var a = m.a || [], blank = (sh.audit || []).some(function (i, j) { return a[j] === -1; });
      var blankLate = (sh.audit || []).some(function (i, j) { return a[j] === -1 && i >= len / 2; });
      out.push({ d: d, len: len, s: sc, rate: sc / len, blank: blank, blankLate: blankLate, sup: sh !== day, rung: sh.rung });
    });
    return out;
  }

  function analyse(state, to, windowDays) {
    windowDays = windowDays || 14;
    var look = Math.max(LOOKBACK, windowDays), from = addDays(to, -(look - 1)), winFrom = addDays(to, -(windowDays - 1));
    var rs = results(state, from, to), cls = {}, byPid = {}, kids = {};
    function kid(pid) { return kids[pid] || (kids[pid] = { aN: 0, aOk: 0, sN: 0, sSum: 0, blanks: 0, sheets: [] }); }
    rs.forEach(function (r) {
      var c = kid(r.pid);
      if (r.ok === null) { if (r.d >= winFrom) c.blanks++; return; }
      if (r.d >= winFrom) { var x = cls[r.k] || (cls[r.k] = { n: 0, ok: 0 }); x.n++; x.ok += r.ok; }
      c.aN++; c.aOk += r.ok;
      var p = byPid[r.pid] || (byPid[r.pid] = {});
      (p[r.k] || (p[r.k] = [])).push(r);
    });
    Object.keys(cls).forEach(function (k) { cls[k].rate = cls[k].ok / cls[k].n; });
    Object.keys(state.days).sort().forEach(function (d) {
      if (d < from || d > to) return;
      var day = state.days[d];
      Object.keys(day.marks || {}).forEach(function (pid) {
        var sh = sheetOf(day, pid), sc = scoreOf(day.marks[pid], sh.qs.length);
        if (sc === null) return;
        var c = kid(pid); c.sheets.push(d);
        // a supported sheet's score says little about the class sheet, so only full sheets inform ability
        if (sh === day) { c.sN++; c.sSum += sc / sh.qs.length; }
      });
    });
    /* Overall strength: checked answers count fully; the child's own scores
       count as up to six checked answers' worth, because self-marking is
       useful but not reliable at this age. A weak 75% starting point stops
       one morning deciding everything. */
    var total = 0, count = 0;
    Object.keys(kids).forEach(function (pid) {
      var c = kids[pid], sr = c.sN ? c.sSum / c.sN : null, ws = c.sN ? Math.min(6, c.sN * 2) : 0;
      c.self = sr; c.audit = c.aN ? c.aOk / c.aN : null;
      c.rate = (c.aOk + ws * (sr || 0) + 0.75) / (c.aN + ws + 1);
      // self-marking that runs well ahead of what the teacher's marks find
      c.flag = c.aN >= 6 && sr !== null && sr - c.audit >= 0.25;
      total += c.rate; count++;
    });
    return { to: to, cls: cls, byPid: byPid, kids: kids, classRate: count ? total / count : 0.75, windowDays: windowDays };
  }
  function kidOf(an, pid) { return an.kids[pid] || { aN: 0, aOk: 0, sN: 0, rate: an.classRate, self: null, audit: null, flag: false, sheets: [], blanks: 0 }; }

  /* A child's chance of getting a skill right. Start from how hard the class
     finds it, shifted by how this child compares with the class (a Rasch-style
     ability × difficulty guess), then let their own checked answers on that
     skill move it — recent ones counting more. */
  function estimate(an, pid, k) {
    var c = an.cls[k], kd = kidOf(an, pid);
    var diff = c && c.n ? (c.ok + 0.75 * 2) / (c.n + 2) : 0.75;
    var p0 = sigmoid(logit(diff) + logit(kd.rate) - logit(an.classRate));
    var rs = (an.byPid[pid] || {})[k] || [], a = 0, n = 0;
    rs.forEach(function (r) { var w = Math.pow(0.5, daysBetween(r.d, an.to) / HALF_LIFE); a += w * r.ok; n += w; });
    return { p: (PRIOR * p0 + a) / (PRIOR + n), prior: p0, n: rs.length, right: rs.filter(function (r) { return r.ok; }).length };
  }

  /* A checked mistake stays in the practice box for the child's next
     KEEP_SHEETS sheets — practice spread over separate days — unless a later
     check on that skill comes back right. */
  function openState(an, pid, k) {
    var rs = ((an.byPid[pid] || {})[k] || []).slice().sort(function (x, y) { return x.d < y.d ? -1 : 1; });
    var miss = null; rs.forEach(function (r) { if (!r.ok) miss = r.d; });
    if (!miss) return { open: false };
    if (rs.some(function (r) { return r.d > miss && r.ok; })) return { open: false, miss: miss, fixed: true };
    var since = kidOf(an, pid).sheets.filter(function (d) { return d > miss; }).length;
    return { open: since < KEEP_SHEETS, miss: miss, left: KEEP_SHEETS - since };
  }

  var WHY = { miss: 'you marked it wrong recently', 'class': 'class focus', low: 'likely to find it hard', stretch: 'challenge', keep: 'keep it sharp' };

  /* The practice box for one child, from evidence before the day.
     keys: the skill keys on the child's sheet, in order. */
  function chooseTargets(an, pid, keys, max, supported) {
    max = max || TARGETS;
    var kd = kidOf(an, pid);
    if (!kd.aN && !kd.sN && !kd.sheets.length) return [];
    var uniq = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    var est = {}; uniq.forEach(function (k) { est[k] = estimate(an, pid, k); });
    Object.keys(an.byPid[pid] || {}).forEach(function (k) { if (!est[k]) est[k] = estimate(an, pid, k); });
    var out = [], have = {};
    function add(k, y) { if (out.length < max && !have[k]) { have[k] = 1; out.push({ k: k, y: y }); } }

    // 1. what you marked wrong, for their next few sheets
    Object.keys(est).map(function (k) { return { k: k, o: openState(an, pid, k), e: est[k] }; })
      .filter(function (x) { return x.o.open; })
      .sort(function (x, y) { return x.o.miss < y.o.miss ? 1 : x.o.miss > y.o.miss ? -1 : x.e.p - y.e.p; })
      .forEach(function (x) { add(x.k, 'miss'); });
    // 2. what the whole class is weak on (not on a supported sheet: wrong practice there)
    if (!supported) uniq.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH && est[k].p < SECURE; })
      .sort(function (x, y) { return an.cls[x].rate - an.cls[y].rate; })
      .forEach(function (k) { add(k, 'class'); });
    // 3. what they are most likely to get wrong
    uniq.filter(function (k) { return est[k].p < 0.8; })
      .sort(function (x, y) { return est[x].p - est[y].p; })
      .forEach(function (k) { add(k, 'low'); });
    // 4. likely secure on all of it: the next small step on from their strongest
    uniq.filter(function (k) { return k.indexOf('pre:') !== 0; })
      .sort(function (x, y) { return est[y].p - est[x].p; })
      .forEach(function (k) { var nx = nextStep(k); if (nx && uniq.indexOf(nx) < 0) add(nx, 'stretch'); });
    // 5. still short: the least secure of the rest
    uniq.slice().sort(function (x, y) { return est[x].p - est[y].p; }).forEach(function (k) { add(k, 'keep'); });
    return out;
  }

  /* The two questions the teacher marks today: one from each half of the
     sheet, so a blank on the second shows who is not getting that far. Within
     each half, favour skills the class gets wrong and slots not checked
     lately; never the same slot twice in a week. */
  function pickAudit(state, iso) {
    var day = state.days[iso], keys = (day ? day.qs : buildDay(state, iso)).map(function (q) { return q.k; });
    var an = analyse(state, addDays(iso, -1), 14), mon = mondayOf(iso), rnd = seeded('audit:' + iso + (day && day.v ? '#' + day.v : ''));
    var thisWeek = {}, lately = {};
    Object.keys(state.days).forEach(function (d) {
      if (d >= iso) return;
      (state.days[d].audit || []).forEach(function (i) {
        if (d >= mon) thisWeek[i] = 1;
        if (daysBetween(d, iso) <= 10) lately[i] = 1;
      });
    });
    function best(lo, hi, not) {
      var top = null;
      for (var i = lo; i < hi; i++) {
        if (not != null && keys[i] === keys[not]) continue;
        var c = an.cls[keys[i]], rate = c && c.n ? c.rate : 0.75;
        var sc = (thisWeek[i] ? -10 : 0) + (1 - rate) + (lately[i] ? 0 : 0.3) + rnd() * 0.25;
        if (!top || sc > top.s) top = { i: i, s: sc };
      }
      return top ? top.i : lo;
    }
    var first = best(0, keys.length / 2, null);
    return [first, best(keys.length / 2, keys.length, first)];
  }

  /* ── scaling back ─────────────────────────────────────── */
  /* Frustration vs instructional level, read from what is collected anyway:
     under half right, or a blank where the teacher marked the second half. */
  function struggled(x) { return x.rate < 0.5 || x.blankLate; }
  function thrived(x) { return x.rate >= 0.85 && !x.blank; }

  function supportPlan(state, pid, iso) {
    var sup = supportOf(state, pid), mode = sup.mode || 'auto';
    if (mode === 'full') return { on: false, n: N, why: 'You set the full sheet' };
    var recent = sessions(state, pid, iso, 3), last = recent[0];
    var cur = last && last.sup ? last.len : N;
    var rung = last && last.sup && last.rung != null ? last.rung : START_RUNG;
    var plan;
    if (cur >= N) {
      var hard = recent.filter(struggled).length;
      if (mode !== 'support' && !(recent.length >= 2 && hard >= 2)) return { on: false, n: N, why: '' };
      // start just above what they actually got right, so the first sheet is finishable
      var got = recent.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
      var med = got.length ? got[Math.floor((got.length - 1) / 2)] : 10;
      var n0 = med + 2; n0 -= n0 % 2;
      plan = { on: true, n: Math.max(SUP_MIN, Math.min(SUP_START_MAX, n0)), rung: START_RUNG,
               why: mode === 'support' ? 'You set a shorter sheet' : 'Under half right, or not reaching the second half, on ' + hard + ' of the last ' + recent.length + ' sheets' };
    } else {
      var two = recent.slice(0, 2).filter(function (x) { return x.sup && x.len === cur && x.rung === rung; });
      plan = { on: true, n: cur, rung: rung, why: 'Holding: ' + cur + ' questions' };
      if (two.length === 2 && two.every(thrived)) plan = { on: true, n: cur + 2, rung: rung + 1, why: 'Two good sheets running: 2 more questions, a step harder' };
      else if (two.length === 2 && two.every(struggled)) plan = { on: true, n: Math.max(SUP_MIN, cur - 2), rung: rung - 1, why: 'Still too much twice running: 2 fewer questions, a step easier' };
      if (plan.n > SUP_MAX) {
        if (mode !== 'support') return { on: false, n: N, why: 'Ready for the full sheet again' };
        plan.n = SUP_MAX;
      }
    }
    // the teacher's Easier / Harder wins until a sheet is made after it
    if (sup.rung != null && sup.rungAt && (!last || !last.sup || sup.rungAt >= last.d)) { plan.rung = sup.rung; plan.why += ' · ladder set by you'; }
    plan.rung = clampRung(plan.rung);
    return plan;
  }

  /* A supported child's own sheet: easy known calculations first (momentum),
     then the rung they are learning interleaved with the class questions they
     are most likely to get right. Roughly 40% known · 30% new · 30% class. */
  function buildSupportSheet(day, iso, pid, plan, an) {
    var n = plan.n, rung = plan.rung;
    var nKnown = rung ? Math.round(n * 0.4) : 0, nReach = Math.round(n * 0.3), nNew = n - nKnown - nReach;
    var reach = day.qs.map(function (q, i) { return { i: i, k: q.k, p: estimate(an, pid, q.k).p }; })
      .filter(function (x, j, arr) { return arr.findIndex(function (y) { return y.k === x.k; }) === j; })
      .sort(function (x, y) { return y.p - x.p || x.i - y.i; }).slice(0, nReach);
    var seen = {}, idx = 0;
    function fd(k) {
      var q, tries = 0;
      do { q = buildKey(k, seedOf(iso, day.v) + ':' + pid + ':' + idx + ':' + tries); tries++; } while (seen[JSON.stringify(q)] && tries < 8);
      seen[JSON.stringify(q)] = 1; idx++;
      q.k = k; return q;
    }
    var qs = [], fresh = [], cls = [], j;
    for (j = 0; j < nKnown; j++) qs.push(fd(FD[rung - 1 - (j % rung)].id));
    for (j = 0; j < nNew; j++) fresh.push(fd(FD[rung].id));
    reach.forEach(function (x) { cls.push(JSON.parse(JSON.stringify(day.qs[x.i]))); });
    while (fresh.length || cls.length) { if (fresh.length) qs.push(fresh.shift()); if (cls.length) qs.push(cls.shift()); }
    // the teacher's two: one from the second half (a blank there = not finishing) and one of the new rung
    var half = qs.length / 2, audit = [];
    function pick(test) { for (var i = qs.length - 1; i >= 0; i--) if (audit.length < 2 && audit.indexOf(i) < 0 && test(qs[i], i)) { audit.push(i); return; } }
    pick(function (q, i) { return i >= half && !isFd(q.k); });
    pick(function (q, i) { return i >= half; });
    pick(function (q) { return q.k === FD[rung].id; });
    pick(function () { return true; });
    return { qs: qs, audit: audit.sort(function (a, b) { return a - b; }), rung: rung, why: plan.why };
  }

  function planSheets(state, iso, onlyUnmarked) {
    var day = state.days[iso], an = analyse(state, addDays(iso, -1), 28);
    if (!day.sheets) day.sheets = {};
    roster.forEach(function (p) {
      if (onlyUnmarked && day.marks[p.id]) return;
      var plan = supportPlan(state, p.id, iso);
      if (plan.on) day.sheets[p.id] = buildSupportSheet(day, iso, p.id, plan, an);
      else delete day.sheets[p.id];
    });
  }

  function makeDay(state, iso, v) {
    var day = { qs: buildDay(state, iso, v), audit: [], sheets: {}, marks: {}, tg: {} };
    if (v) day.v = v;
    state.days[iso] = day;
    day.audit = pickAudit(state, iso);
    planSheets(state, iso, false);
    return day;
  }

  function targetsFor(an, day, pid) {
    var sh = sheetOf(day, pid), sup = sh !== day;
    return chooseTargets(an, pid, sh.qs.map(function (q) { return q.k; }), sup ? SUP_TARGETS : TARGETS, sup);
  }
  function targetsForDay(state, iso, pid) {
    var day = state.days[iso];
    if (day.tg && day.tg[pid]) return day.tg[pid];
    return targetsFor(analyse(state, addDays(iso, -1), 28), day, pid);
  }
  function freezeTargets(state, iso) {
    var day = state.days[iso], an = analyse(state, addDays(iso, -1), 28);
    day.tg = {};
    roster.forEach(function (p) { day.tg[p.id] = targetsFor(an, day, p.id); });
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
  function qNums(sh) { return sh.audit.map(function (i) { return 'Q' + (i + 1); }); }

  function render() {
    var h = host(); if (!h) return;
    if (!curDay) curDay = todayISO();
    h.innerHTML =
      '<div class="page-header"><h1>Mental Starter (CBM)</h1>' +
      '<p>Same 20 questions for most of the class. You mark the same two questions in every book; at the register each child calls their score and your two marks. Over time the app works out who can do what, scales the sheet back for anyone it is too much for, and picks each child\'s practice questions.</p></div>' +
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
        '<p>Making it builds the 20 questions from <b>Set up</b> (' + esc(htOf(state, curDay)) + '), picks the two you will mark, and makes a shorter sheet for any child the full one has been too much for.</p>' +
        '<button type="button" id="cbmMake">Make the sheet</button></div>';
      wireNav(body);
      document.getElementById('cbmMake').onclick = function () { var s = load(); makeDay(s, curDay); save(s); renderToday(); };
      return;
    }
    var a = day.audit, qa = qNums(day);
    var sup = sortedRoster().filter(function (p) { return day.sheets && day.sheets[p.id]; });
    var rows = sortedRoster().map(function (p) { return rowHTML(state, day, p); }).join('');
    body.innerHTML = nav +
      '<div class="cbm-audit"><div><div class="cbm-k">Mark these two in every book — don\'t tell the class which</div>' +
        '<div class="cbm-auditq">' + a.map(function (i) { return '<span><b>Q' + (i + 1) + '</b> ' + esc(keyLabel(day.qs[i].k)) + ' <em>' + esc(ans(day.qs[i], curDay)) + '</em></span>'; }).join('') + '</div>' +
        (sup.length ? '<div class="cbm-supq">Shorter sheets: ' + sup.map(function (p) { return '<span><b>' + esc(p.name) + '</b> ' + qNums(day.sheets[p.id]).join(' & ') + '</span>'; }).join('') + '</div>' : '') +
        '</div><div class="cbm-actions">' +
          '<button type="button" id="cbmPrintAll">Print class set</button>' +
          '<button type="button" class="secondary" id="cbmPrintOne">Print one blank sheet</button>' +
          '<button type="button" class="secondary" id="cbmBoard">Answers on the board</button>' +
          (sup.length ? '<button type="button" class="secondary" id="cbmPrintAns">Answers for shorter sheets</button>' : '') +
        '</div></div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Scores</h3><span class="cbm-count" id="cbmCount">' + enteredCount(day) + ' of ' + roster.length + ' entered</span></div>' +
        '<p class="cbm-hint">Type their score and your two marks: <code>17 yn</code>. <code>y</code> right, <code>n</code> wrong, <code>b</code> left blank. <code>abs</code> = absent. ' +
        'Or type the score and tap the marks. Enter moves to the next child.</p>' +
        '<div class="table-wrap"><table class="cbm-table"><thead><tr><th class="name">Pupil</th><th>Score &amp; marks</th><th>' + qa[0] + '</th><th>' + qa[1] + '</th><th class="num">Score</th><th>Practice box</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>' +
      '<details class="card cbm-qlist"><summary>Today\'s 20 questions and answers</summary><ol>' +
        day.qs.map(function (q, i) { return '<li' + (a.indexOf(i) >= 0 ? ' class="is-audit"' : '') + '><span class="cbm-qtext">' + GRQ(q) + '</span><span class="cbm-qans">' + esc(ans(q, curDay)) + '</span><span class="cbm-qskill" title="' + esc(keyTitle(q.k)) + '">' + esc(keyLabel(q.k)) + '</span></li>'; }).join('') +
      '</ol><div class="cbm-qtools"><button type="button" class="secondary small" id="cbmRetarget" title="For children with nothing entered yet">Rebuild shorter sheets and practice boxes</button>' +
        '<button type="button" class="secondary small" id="cbmRegen">Make a new set of questions</button>' +
        '<button type="button" class="danger small" id="cbmDelete">Delete this sheet</button></div></details>';
    wireNav(body);
    wireRows(body);
    document.getElementById('cbmPrintAll').onclick = function () { printSheets(true); };
    document.getElementById('cbmPrintOne').onclick = function () { printSheets(false); };
    document.getElementById('cbmBoard').onclick = showAnswers;
    var pa = document.getElementById('cbmPrintAns'); if (pa) pa.onclick = printSupportAnswers;
    document.getElementById('cbmRetarget').onclick = function () {
      var s = load(), d = s.days[curDay];
      planSheets(s, curDay, true);
      Object.keys(d.tg || {}).forEach(function (pid) { if (!d.marks[pid]) delete d.tg[pid]; });
      save(s); renderToday();
    };
    document.getElementById('cbmRegen').onclick = function () {
      var has = enteredCount(day);
      if (!confirm('Replace the 20 questions for ' + fullDate(curDay) + ' with a fresh set' + (has ? '? The ' + has + ' scores entered for this sheet will be cleared.' : '?'))) return;
      var s = load(); makeDay(s, curDay, (s.days[curDay].v || 0) + 1); save(s); renderToday();
    };
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

  function enteredCount(day) { return roster.filter(function (p) { return isScored(day.marks[p.id]); }).length; }
  function entryText(day, pid) { var m = day.marks[pid]; if (!isScored(m)) return ''; if (m.x) return 'abs'; return String(scoreOf(m, sheetOf(day, pid).qs.length)); }
  var MARK = { '1': ['yes', '✓'], '0': ['no', '✗'], '-1': ['blank', '–'] };
  function auditBtn(day, pid, j) {
    var m = day.marks[pid], sh = sheetOf(day, pid), v = m && !m.x && m.a ? m.a[j] : null, mk = MARK[String(v)];
    return '<button type="button" class="cbm-mark' + (mk ? ' ' + mk[0] : '') + '" data-aj="' + j + '"' + (m && m.x ? ' disabled' : '') +
      ' aria-label="Your mark for Q' + (sh.audit[j] + 1) + '">' + (mk ? mk[1] : '·') + '</button>' +
      (sh !== day ? '<span class="cbm-markq">Q' + (sh.audit[j] + 1) + '</span>' : '');
  }
  function scoreHTML(day, pid) {
    var m = day.marks[pid], len = sheetOf(day, pid).qs.length;
    if (!isScored(m)) return '<span class="muted">—</span>';
    if (m.x) return '<span class="muted">absent</span>';
    var blank = (m.a || []).some(function (v) { return v === -1; });
    return '<b>' + scoreOf(m, len) + '</b><span class="muted">/' + len + '</span>' + (blank ? ' <span class="cbm-flag cbm-flag-blank" title="One of your two was left blank">blank</span>' : '');
  }
  function boxHTML(state, day, pid) {
    var tg = day.tg && day.tg[pid] ? day.tg[pid] : targetsForDay(state, curDay, pid);
    if (!tg.length) return '<span class="muted small">after the first scores</span>';
    return tg.map(function (t) { return '<span class="cbm-tg cbm-tg-' + t.y + '" title="' + esc(keyTitle(t.k) + ' — ' + WHY[t.y]) + '">' + esc(keyLabel(t.k)) + '</span>'; }).join('');
  }
  function rowHTML(state, day, p) {
    var sh = day.sheets && day.sheets[p.id];
    return '<tr data-pid="' + p.id + '"><td class="name">' + esc(p.name) +
        (sh ? ' <span class="cbm-sup" title="' + esc(sh.why + ' · ' + FD[sh.rung].label) + '">' + sh.qs.length + ' Qs</span>' : '') + '</td>' +
      '<td><input class="cbm-in" type="text" inputmode="text" autocomplete="off" value="' + esc(entryText(day, p.id)) + '" placeholder="e.g. 17 yn" aria-label="Score and marks for ' + esc(p.name) + '"></td>' +
      '<td class="cbm-markcell">' + auditBtn(day, p.id, 0) + '</td><td class="cbm-markcell">' + auditBtn(day, p.id, 1) + '</td>' +
      '<td class="num cbm-score">' + scoreHTML(day, p.id) + '</td><td class="cbm-box-cell">' + boxHTML(state, day, p.id) + '</td></tr>';
  }

  function wireRows(body) {
    function refresh(tr) {
      var s = load(), day = s.days[curDay], pid = tr.dataset.pid, td = tr.children, input = tr.querySelector('.cbm-in');
      // update the cells in place: replacing the row would pull the focused input out
      // from under the browser, which fires its change event a second time mid-update
      input.value = entryText(day, pid); input.classList.remove('bad'); input.title = '';
      td[2].innerHTML = auditBtn(day, pid, 0); td[3].innerHTML = auditBtn(day, pid, 1);
      td[4].innerHTML = scoreHTML(day, pid); td[5].innerHTML = boxHTML(s, day, pid);
      document.getElementById('cbmCount').textContent = enteredCount(day) + ' of ' + roster.length + ' entered';
    }
    function commit(input) {
      var tr = input.closest('tr'), pid = tr.dataset.pid, s = load(), day = s.days[curDay], prev = day.marks[pid];
      var len = sheetOf(day, pid).qs.length, r = parseEntry(input.value, len);
      var bad = r.bad && r.bad.length;
      input.classList.toggle('bad', !!bad);
      if (bad) { input.title = 'Not understood: ' + r.bad.join(' ') + ' (score out of ' + len + ', then y / n / b)'; return null; }
      var keepA = prev && !prev.x && prev.a ? prev.a : [null, null];
      var a = r.a ? [r.a[0], r.a.length > 1 ? r.a[1] : keepA[1]] : keepA;
      if (r.empty || (r.s === null && !r.x)) {
        // marks can arrive before the score: keep them, but they are not a result yet
        if (a.some(function (v) { return v != null; })) day.marks[pid] = { a: a };
        else delete day.marks[pid];
      } else if (r.x) day.marks[pid] = { x: 1 };
      else day.marks[pid] = { s: r.s, a: a };
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
        var tr = b.closest('tr'), pid = tr.dataset.pid, s = load(), day = s.days[curDay], j = +b.dataset.aj;
        var m = day.marks[pid] || (day.marks[pid] = { a: [null, null] });
        if (m.x) return;
        if (!m.a) m.a = [null, null];
        var v = m.a[j];
        m.a[j] = v === 1 ? 0 : v === 0 ? -1 : v === -1 ? null : 1;    // · → ✓ → ✗ → blank → ·
        save(s); refresh(tr);
      });
    });
  }

  /* ── Answers ──────────────────────────────────────────── */
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
    var sh = pid ? sheetOf(day, pid) : day, short = sh !== day;
    var cells = sh.qs.map(function (q, i) { return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('');
    var box = '';
    if (targets && targets.length) {
      box = '<div class="cbm-pbox"><div class="cbm-pbox-h">My ' + targets.length + ' to practise</div><div class="cbm-pbox-grid">' +
        targets.map(function (t, i) {
          var q = buildKey(t.k, 'cbm:' + iso + ':' + pid + ':' + t.k);
          return '<div class="gen-q"><span class="gen-num">' + 'abcd'.charAt(i) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>';
        }).join('') + '</div></div>';
    }
    // a shorter sheet looks like everyone else's — same heading, no label — just bigger and fewer
    return '<div class="card gen-sheet gen-day cbm-sheet' + (short ? ' cbm-sheet-short' : '') + '"><h2 class="gen-heading">' + (name ? '<span class="gen-day-name">' + esc(name) + '</span> · ' : '') +
      esc(fullDate(iso)) + ' · Mental Starter</h2><div class="gen-grid">' + cells + '</div>' + box + '</div>';
  }
  function toPrint(html) {
    var c = document.getElementById('starterPrint');
    if (!c) { c = document.createElement('div'); c.id = 'starterPrint'; document.body.appendChild(c); }
    c.innerHTML = html;
    window.print();
  }
  function printSheets(personal) {
    var s = load(), day = s.days[curDay]; if (!day) return;
    var html = '';
    if (personal) {
      if (!day.tg || !Object.keys(day.tg).length) freezeTargets(s, curDay);
      sortedRoster().forEach(function (p) {
        if (!day.tg[p.id]) day.tg[p.id] = targetsForDay(s, curDay, p.id);
        html += sheetHTML(day, curDay, p.name, day.tg[p.id], p.id);
      });
      save(s);
    } else html = sheetHTML(day, curDay, '', null, '');
    toPrint(html);
    if (view === 'today') renderToday();
  }
  /* Shorter sheets have their own questions, so the board's answers do not
     fit them: one page of answer strips for whoever marks those. */
  function printSupportAnswers() {
    var day = load().days[curDay]; if (!day) return;
    var html = sortedRoster().filter(function (p) { return day.sheets && day.sheets[p.id]; }).map(function (p) {
      var sh = day.sheets[p.id];
      return '<div class="cbm-ansslip"><b>' + esc(p.name) + '</b><ol>' + sh.qs.map(function (q, i) {
        return '<li' + (sh.audit.indexOf(i) >= 0 ? ' class="is-audit"' : '') + '>' + esc(ans(q, curDay)) + '</li>';
      }).join('') + '</ol></div>';
    }).join('');
    toPrint('<div class="card gen-sheet gen-day cbm-ansslips"><h2 class="gen-heading">Answers for shorter sheets · ' + esc(fullDate(curDay)) + '</h2>' + html + '</div>');
  }

  /* ── Progress ─────────────────────────────────────────── */
  function renderProgress() {
    var state = load(), body = document.getElementById('cbmBody');
    var dates = Object.keys(state.days).sort(), last = dates.filter(function (d) { return d <= todayISO(); }).pop();
    if (!last) { body.innerHTML = '<div class="card empty">No sheets yet. Make one on <b>Today</b>.</div>'; return; }
    var an = analyse(state, todayISO(), windowDays);
    var latest = state.days[last], keys = latest.qs.map(function (q) { return q.k; });
    Object.keys(an.cls).forEach(function (k) { if (keys.indexOf(k) < 0 && !isFd(k)) keys.push(k); });
    keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    var checked = keys.filter(function (k) { return an.cls[k]; }).length;

    var reteach = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH; }).sort(function (a, b) { return an.cls[a].rate - an.cls[b].rate; });
    var secure = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate >= SECURE; });
    var checks = sortedRoster().filter(function (p) { return kidOf(an, p.id).flag; });
    function chips(list, empty, fmt) { return list.length ? list.map(fmt).join('') : '<span class="muted small">' + empty + '</span>'; }

    var head = '<tr><th class="name">Pupil</th>' + keys.map(function (k) {
      return '<th class="cbm-hk" title="' + esc(keyTitle(k)) + '"><span>' + esc(keyLabel(k)) + '</span></th>';
    }).join('') + '<th title="Their own average score beside how many of your marks were right">Self-marked · your marks</th><th>Practice box next</th></tr>';
    var classRow = '<tr class="cbm-classrow"><td class="name">Class</td>' + keys.map(function (k) {
      var c = an.cls[k]; return c ? '<td class="cbm-cell b-' + band(c.rate) + '" title="' + esc(keyLabel(k) + ': ' + c.ok + ' of ' + c.n + ' checked answers right') + '">' + pct(c.rate) + '</td>' : '<td class="cbm-cell" title="Not checked yet">·</td>';
    }).join('') + '<td></td><td></td></tr>';
    var rows = sortedRoster().map(function (p) {
      var kd = kidOf(an, p.id);
      var cells = keys.map(function (k) {
        if (!kd.aN && !kd.sN) return '<td class="cbm-cell">·</td>';
        var e = estimate(an, p.id, k), o = openState(an, p.id, k);
        var tip = p.name + ' · ' + keyLabel(k) + ': ' + (e.n ? e.right + ' of ' + e.n + ' checked right, ' : 'not checked yet, ') + 'about ' + pct(e.p) + ' likely' + (o.open ? ' — in their practice box' : '');
        return '<td class="cbm-cell b-' + band(e.p) + (e.n ? '' : ' is-guess') + (o.open ? ' is-open' : '') + '" title="' + esc(tip) + '">' + (e.n ? e.right + '/' + e.n : pct(e.p)) + '</td>';
      }).join('');
      var tg = targetsFor(an, latest, p.id);
      return '<tr><td class="name">' + esc(p.name) + (latest.sheets && latest.sheets[p.id] ? ' <span class="cbm-sup">' + latest.sheets[p.id].qs.length + ' Qs</span>' : '') + '</td>' + cells +
        '<td class="cbm-trust">' + (kd.self != null ? pct(kd.self) : '—') + ' · ' + (kd.aN ? kd.aOk + '/' + kd.aN : '—') + (kd.flag ? ' <span class="cbm-flag">check</span>' : '') + '</td>' +
        '<td class="cbm-box-cell">' + (tg.length ? tg.map(function (x) { return '<span class="cbm-tg cbm-tg-' + x.y + '" title="' + esc(WHY[x.y]) + '">' + esc(keyLabel(x.k)) + '</span>'; }).join('') : '<span class="muted small">—</span>') + '</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="cbm-daynav"><label for="cbmWin">Looking at</label><select id="cbmWin">' +
        [[7, 'the last week'], [14, 'the last 2 weeks'], [28, 'the last 4 weeks'], [91, 'the last term']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === windowDays ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><span class="muted small">' + checked + ' of ' + keys.length + ' skills checked so far</span></div>' +
      supportHTML(state) +
      '<div class="cbm-cards">' +
        '<div class="card cbm-card"><h3>Reteach to the class</h3><p class="cbm-hint">Under ' + pct(RETEACH) + ' of your marks right across the class.</p>' + chips(reteach, 'Nothing below ' + pct(RETEACH) + '.', function (k) { return '<span class="cbm-chip low" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + ' · ' + pct(an.cls[k].rate) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Secure</h3><p class="cbm-hint">' + pct(SECURE) + ' or more right. Could leave the sheet for a harder step.</p>' + chips(secure, 'Nothing secure yet.', function (k) { return '<span class="cbm-chip sec" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Check their self-marking</h3><p class="cbm-hint">Their own scores run well ahead of your marks (6+ marks).</p>' + chips(checks, 'No one.', function (p) { var kd = kidOf(an, p.id); return '<span class="cbm-chip mid">' + esc(p.name) + ' · ' + pct(kd.self) + ' vs ' + pct(kd.audit) + '</span>'; }) + '</div>' +
      '</div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Skill by skill</h3><span class="cbm-legend"><i class="b-low"></i>under 60% <i class="b-mid"></i>60–74% <i class="b-ok"></i>75–89% <i class="b-sec"></i>90%+ <i class="is-open"></i>in practice box</span></div>' +
        '<p class="cbm-hint"><b>3/4</b> = your marks on that skill (right/checked). A pale <i>70%</i> = not checked yet for that child; worked out from how hard the class finds it and how they compare with the class. Each mark you make firms it up.</p>' +
        '<div class="table-wrap"><table class="cbm-grid"><thead>' + head + '</thead><tbody>' + classRow + rows + '</tbody></table></div></div>';
    document.getElementById('cbmWin').onchange = function (e) { windowDays = +e.target.value; renderProgress(); };
    wireSupport(body);
  }

  /* Who the full sheet is too much for, and what happens next. */
  function supportHTML(state) {
    var next = addDays(todayISO(), 1);
    var busy = Object.keys(state.days).filter(function (d) { return d <= todayISO() && daysBetween(d, todayISO()) < 10 && enteredCount(state.days[d]) >= roster.length / 2; });
    var rows = sortedRoster().map(function (p) {
      var recent = sessions(state, p.id, next, 5), plan = supportPlan(state, p.id, next), mode = supportOf(state, p.id).mode || 'auto';
      var hard = recent.slice(0, 3).filter(struggled).length;
      var missing = busy.filter(function (d) { return !isScored(state.days[d].marks[p.id]); }).length;
      if (!(plan.on || mode !== 'auto' || hard >= 1 || missing >= 2)) return '';
      var hist = recent.slice().reverse().map(function (x) {
        return '<span class="cbm-sess' + (struggled(x) ? ' hard' : thrived(x) ? ' good' : '') + '" title="' + esc(shortDate(x.d) + ': ' + x.s + ' of ' + x.len + (x.blankLate ? ', blank in the second half' : x.blank ? ', a blank' : '')) + '">' + x.s + '/' + x.len + (x.blank ? '<i>b</i>' : '') + '</span>';
      }).join('');
      var nextTxt = plan.on ? '<b>' + plan.n + ' questions</b> · ' + esc(FD[plan.rung].label) : 'Full sheet';
      return '<tr data-spid="' + p.id + '"><td class="name">' + esc(p.name) + '</td><td>' + (hist || '<span class="muted small">no scores</span>') +
        (missing >= 2 ? ' <span class="cbm-flag" title="Days most of the class gave a score and this child did not">no score ' + missing + '×</span>' : '') + '</td>' +
        '<td>' + nextTxt + '<div class="cbm-why1">' + esc(plan.why || (hard ? 'Watching: ' + hard + ' hard sheet' + (hard > 1 ? 's' : '') + ' of the last 3' : '')) + '</div></td>' +
        '<td class="cbm-supctl"><select data-mode aria-label="Sheet for ' + esc(p.name) + '">' +
          [['auto', 'Automatic'], ['full', 'Always full sheet'], ['support', 'Always shorter sheet']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === mode ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          (plan.on ? '<button type="button" class="secondary small" data-rung="-1" title="Simpler calculations">Easier</button><button type="button" class="secondary small" data-rung="1" title="Harder calculations">Harder</button>' : '') +
        '</td></tr>';
    }).join('');
    return '<div class="card cbm-support"><div class="cbm-entryhead"><h3>Not finishing, or finding it hard</h3></div>' +
      '<p class="cbm-hint">A hard sheet is under half right, or a blank where you marked the second half. Two of the last three moves a child to a shorter sheet of simple calculations; two good sheets running (85%+, no blanks) adds two questions and a step, and past ' + SUP_MAX + ' they rejoin the full sheet. Changes here apply to the next sheet you make.</p>' +
      (rows ? '<div class="table-wrap"><table class="cbm-suptable"><thead><tr><th class="name">Pupil</th><th>Last sheets</th><th>Next sheet</th><th>Setting</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<p class="muted small">Everyone is managing the full sheet.</p>') + '</div>';
  }
  function wireSupport(body) {
    body.querySelectorAll('tr[data-spid]').forEach(function (tr) {
      var pid = tr.dataset.spid, sel = tr.querySelector('[data-mode]');
      sel.onchange = function () { var s = load(), o = supportOf(s, pid); o.mode = sel.value; s.support[pid] = o; save(s); renderProgress(); };
      tr.querySelectorAll('[data-rung]').forEach(function (b) {
        b.onclick = function () {
          var s = load(), plan = supportPlan(s, pid, addDays(todayISO(), 1)), o = supportOf(s, pid);
          o.rung = clampRung(plan.rung + +b.dataset.rung); o.rungAt = todayISO(); s.support[pid] = o; save(s); renderProgress();
        };
      });
    });
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
      '<p class="cbm-hint">Each slot stays the same skill every day, with new numbers, so your marks build up skill by skill. Changes apply to sheets made from now on.</p>' +
      picker + '</div>' +
      '<details class="card cbm-why"><summary>How it decides, and the research behind it</summary>' +
        '<ul>' +
        '<li><b>The sheet is a CBM probe:</b> short, mixed and frequent (Deno, 1985; Fuchs &amp; Fuchs, 1986).</li>' +
        '<li><b>Two marks a day, a different two each day:</b> matrix sampling (Shoemaker, 1973). After a fortnight every skill has been checked across the class, and every child has a growing record of checked answers — for ten seconds each at the register.</li>' +
        '<li><b>Filling the gaps:</b> a child\'s chance on a skill not yet checked for them is worked out from how hard the class finds it and how they compare with the class — the idea behind item response theory (Rasch). Each of your marks then moves it. Their own scores count, but less than your marks, because young children\'s self-marking is the least reliable (Ross, 2006; Brown &amp; Harris, 2013).</li>' +
        '<li><b>Results by skill, with fixed rules:</b> skills analysis helped teachers plan and pupils gain (Fuchs, Fuchs, Hamlett &amp; Stecker, 1990, 1991), and CBM only helps when teaching changes in response (Stecker, Fuchs &amp; Fuchs, 2005). Under ' + pct(RETEACH) + ' → reteach; ' + pct(SECURE) + '+ → secure.</li>' +
        '<li><b>Practice box:</b> what you marked wrong stays for their next ' + KEEP_SHEETS + ' sheets, spaced over separate days (Cepeda et al., 2006), mixed with other skills rather than four of one (Rohrer et al., 2020).</li>' +
        '<li><b>Shorter sheets:</b> work pitched at frustration level — too much, mostly wrong — loses attention and teaches little; at instructional level children finish and learn (Gickling &amp; Armstrong, 1978; Burns, 2004; VanDerHeyden &amp; Burns, 2005). Starting with easy calculations they know raises how much children attempt (Skinner, 2002). Support is added and taken away in response to how they do (contingent, fading support: Wood, Bruner &amp; Ross, 1976; van de Pol et al., 2010).</li>' +
        '<li><b>Your two questions:</b> one from each half of the sheet, so a blank on the second shows who is not getting that far; within each half, skills the class gets wrong, never the same slot twice in a week.</li>' +
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
    results: results, sessions: sessions, analyse: analyse, estimate: estimate, openState: openState,
    chooseTargets: chooseTargets, supportPlan: supportPlan, planSheets: planSheets,
    keyLabel: keyLabel, halfTermFor: halfTermFor, load: load, save: save, buildKey: buildKey, FD: FD
  };
})();
