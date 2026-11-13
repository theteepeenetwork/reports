/* ============================================================
   cbm.js — MENTAL STARTER (CBM)
   Owner: Desk (docs/OWNERSHIP.md) · loads AFTER wrsteps.js and generator.js

   A second, separate morning starter built on curriculum-based
   measurement. Mental Starters (hub.js / starters.js) is untouched:
   this page has its own store, its own sheets and its own marks.

   THE ROUTINE
     1. Everyone gets the same 20 SKILLS, each child with their OWN NUMBERS.
        Each slot is a fixed skill (a White Rose small step, or the half-term
        set's question for that position), so "Q7" means the same skill all
        week — and a neighbour's answer is no use to anyone.
     2. While they work, the teacher live-marks the SAME TWO questions in
        every book, chosen by the app and never announced: one from the
        first half of the sheet and one from the second. Each child's two
        answers are on screen beside their name and on a printed marking list.
     3. The teacher taps the two marks in: right, wrong or left blank. Nothing
        else is entered. Children do not mark their own work and no score out
        of 20 is kept: at this age self-marking is the least reliable evidence
        there is (Ross, 2006; Brown & Harris, 2013), and it was being copied.
     4. The board is for teaching, not marking: a model version of each
        question (numbers nobody has), the skills the class gets wrong first.
     5. Every sheet carries a box of practice questions chosen for that child.

   WHERE THE DETAIL COMES FROM — sampling, not marking everything
     Each day the class answers 2 audited questions each, a different pair
     every day. Over a fortnight every skill has been checked across the
     whole class (matrix sampling), and every child has a growing record of
     checked answers. A child's chance on a skill they have not been checked
     on yet is inferred from two things the app does know: how hard the class
     finds that skill (from everyone's checked answers) and how strong this
     child is overall (all their checked answers) — the idea behind item
     response theory (Rasch). Each checked answer then moves that child's
     estimate for that one skill.

   WHEN A CHILD IS NOT GETTING THEM RIGHT — stepped, not dropped
     Two different problems get two different answers (Haring & Eaton, 1978;
     Daly et al., 1997).
     WRONG ANSWERS step that one skill back, one small step at a time, along
     the White Rose order for its topic (and on into the year before). A mark
     on the step a child is on decides it: wrong, one step back; right, one
     step forward — two right running if they were marked wrong on the step
     above. A skill with no mark goes by how the child is doing overall: back
     when their chance on it is under 60%, forward when their chance on the
     harder step reaches 75%; that guess never overrides a mark. Never more
     than one step between sheets, never more than 5 skills on one sheet,
     never more than 6 steps back, and only on new marks —
     so a child ends up on work at their level (Gickling & Armstrong, 1978;
     Burns, 2004) by a staircase, not a cliff (Levitt, 1971).
     BLANKS on the second of the two mean not finishing: two of the last three
     takes two questions away (the ones they are most secure on); two sheets
     with no blanks puts two back.
     NUMBERS ONLY is a per-child setting for a child who cannot yet read the
     questions: a sheet of number facts — numbers and symbols, no words —
     that works up the ladder below, about a third the rung being learned and
     the rest known facts, half of them as missing numbers.

   THE RESEARCH (also in the Set up tab)
     CBM — Deno (1985); Fuchs & Fuchs (1986). Skills analysis — Fuchs,
     Fuchs, Hamlett & Stecker (1990, 1991). Decision rules — Stecker, Fuchs
     & Fuchs (2005). Matrix sampling — Shoemaker (1973). Self-assessment
     accuracy — Ross (2006); Brown & Harris (2013). Spaced retrieval —
     Cepeda et al. (2006). Interleaving — Rohrer et al. (2020). Instructional
     vs frustration level — Gickling & Armstrong (1978); Burns (2004);
     VanDerHeyden & Burns (2005). The success rate that learning is fastest
     at — Wilson et al. (2019). Stepping back through the curriculum to find
     the level — Hosp, Hosp & Howell (2016). One step at a time — Levitt
     (1971). Accuracy and pace as separate problems — Haring & Eaton (1978);
     Daly et al. (1997). Worked examples — Sweller & Cooper (1985);
     Rosenshine (2012). Easy items mixed in raise completion — Skinner
     (2002). Contingent, fading support — Wood, Bruner & Ross (1976); van de
     Pol, Volman & Beishuizen (2010). Numbers-only sheets: reading
     difficulty depresses maths scores — Fuchs, Fuchs & Prentice (2004);
     number facts first, in this order — DfE (2020) ready-to-progress
     criteria, EEF (2017); Baroody (2006); mostly known items with a few new
     — Burns (2004); Codding, Burns & Lukito (2011).

   STORE  tp_cbm  (per class; in DATA_KEYS; see docs/CONTRACT.md)
     { ht: null | 'Autumn 1' … ,                // null = work it out from the date
       slots: (stepId|null)[20],                 // the probe's blueprint
       xt: { on:boolean, pick:'2'|'5'|'10'|'all', count:number },  // ×tables back page
       support: { [pid]: { mode:'auto'|'full'|'num', rung?, rungAt?, lv?, lvAt? } },
       lv: { [pid]: { [class skill]: steps back } },   // where each child is on each skill
       days: { [iso]: {
         qs:     Question[20],                   // the model version, each with k (skill key)
         audit:  [i, j],                         // 0-based slots the teacher marks
         ind:    1,                              // every child has their own numbers
         sheets: { [pid]: { ks?: { [slot]: skill }, drop?: slot[], why? }      // differences from the class
                         | { qs, audit, rung, lv, why } },                     // a numbers-only sheet, whole
         marks:  { [pid]: { a:[m, m] } | { x:1 } },
         tg:     { [pid]: [{ k, y }] }           // the practice box printed that day
       } } }
   a = the teacher's two marks: 1 right, 0 wrong, -1 blank, null not given.
   A child with no entry in sheets has the class's 20 skills. Their numbers
   are never stored: every question is rebuilt from a seed (day, child,
   slot), so a reprint is identical. Days made before Nov 2026 have no ind:
   everyone shared day.qs, sheets held whole shorter sheets, and marks also
   carry s (the child's own score; w in the first version) — still read as
   an entry, no longer used.
   A skill key is a step id ('a2.3'), 'pre:<set>:<slot>' for a slot left on
   the half-term set, or 'fd:<name>' for a foundation calculation.
   A rung is an index into LADDER when lv is 2, and into the first ladder
   (OLD_LADDER) when lv is missing. support.lvAt is the date of the last
   marks the steps back were worked out from.
   ============================================================ */
(function () {
  'use strict';

  var N = 20;              // the most questions a sheet can have; state.n is how many the class gets
  var N_MIN = 6;
  var KEY = 'tp_cbm';
  var RETEACH = 0.6;       // class below this on a skill → reteach it to everyone
  var SECURE = 0.9;        // at or above → secure
  var TARGETS = 4, SUP_TARGETS = 2;
  var KEEP_SHEETS = 3;     // a checked mistake stays in the box for this many sheets
  var LOOKBACK = 42;       // days of evidence an estimate looks at
  var HALF_LIFE = 21;      // days for a checked answer's weight to halve
  var PRIOR = 2;           // how many checked answers the inferred chance is worth
  var SUP_MIN = 6;         // the fewest questions a sheet is cut back to
  var NUM_START = 12;      // a numbers-only child's first sheet
  var MIN_MARKS = 4;       // checked answers before any skill is stepped
  var MAX_DOWN = 5;        // skills that may step back on one sheet: a stagger, not a cliff
  var MAX_BACK = 6;        // the furthest any one skill steps back; past that it needs a teacher, not an easier question
  var RECOVER_PRIOR = 0.7; // …and only for a child this likely to manage the step above: a gap over RETEACH, so it does not go back and forth
  var RECOVER_SHEETS = 3;  // sheets with no further wrong mark before a stepped-back skill comes forward again
  var UP_PRIOR = 0.75;     // with no mark to go on: likely right this often on the harder step → step forward
  var DEEP_MARKS = 12;     // marks before a child's questions go deeper
  var DEEP_RATE = 0.85;    // of their own marks right, to start
  var DEEP_STAY = 0.78;    // and to stay: a gap, so one wrong mark does not flip them out and in
  var MAX_UP = 5;          // the most deeper questions a sheet carries
  var STEP_EASE = 0.5;     // how much easier one step back is taken to be (logits)

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
  /* Seeded on the day, so every child's back page — and a reprint — is the same. */
  function tablesFor(iso, xt) {
    var bases = typeof window.genBasesFor === 'function' ? window.genBasesFor(xt.pick) : [2, 5, 10];
    if (!bases.length) bases = [2, 5, 10];
    var rnd = seeded('cbm:' + iso + ':xt:' + xt.pick), out = [];
    for (var i = 0; i < xt.count; i++) out.push({ t: 'times', base: bases[Math.floor(rnd() * bases.length)], by: 1 + Math.floor(rnd() * 12) });
    return out;
  }
  function tablesLabel(pick) { return typeof window.genTablesLabel === 'function' ? window.genTablesLabel(pick) : pick; }
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
  /* The ×tables back page, as Mental Starters has it: off unless the teacher
     turns it on, so sheets printed before it existed are unchanged. */
  var XT_PICKS = ['2', '5', '10', 'all'], XT_COUNTS = [20, 30, 40, 50, 60, 80, 100];
  function normXt(x) {
    x = x && typeof x === 'object' ? x : {};
    return { on: x.on === true, pick: XT_PICKS.indexOf(x.pick) >= 0 ? x.pick : 'all',
             count: XT_COUNTS.indexOf(x.count) >= 0 ? x.count : 50 };
  }
  function normN(n) { n = Math.round(+n); return n >= N_MIN && n <= N ? n : N; }
  function load() {
    var s = Store.get(KEY, null) || {};
    return { ht: typeof s.ht === 'string' ? s.ht : null, slots: normSlots(s.slots),
             yr: s.yr >= 1 && s.yr <= 6 ? s.yr : null,   // White Rose year the picker shows; null = the class's
             xt: normXt(s.xt),
             sm: s.sm === true,                          // children mark their own: an answer strip on each back page
             n: normN(s.n),                              // questions on the class sheet, 6–20
             support: s.support && typeof s.support === 'object' ? s.support : {},
             lv: s.lv && typeof s.lv === 'object' ? s.lv : {},   // { [pid]: { [class skill]: steps back } }
             days: s.days && typeof s.days === 'object' ? s.days : {} };
  }
  function save(s) { Store.set(KEY, s); }
  function htOf(state, iso) { return state.ht || halfTermFor(iso || todayISO()); }
  /* mode: 'auto' | 'full' (always the class questions) | 'num' (numbers only; 'support' before Nov 2026) */
  function supportOf(state, pid) {
    var o = state.support[pid]; o = o && typeof o === 'object' ? o : {};
    o.mode = o.mode === 'full' ? 'full' : (o.mode === 'num' || o.mode === 'support') ? 'num' : 'auto';
    return o;
  }

  /* ── foundation ladder ────────────────────────────────── */
  /* The number facts a child below age-related expectations works up, for
     when the full sheet is too much. Every question is numbers and symbols
     only, so a child who cannot yet read the class questions can still show
     what they know (Fuchs, Fuchs & Prentice, 2004). The order follows the
     DfE ready-to-progress criteria for Years 1–2 and the order children
     learn the facts in (Baroody, 2006): counting, add or take 1, facts
     within 5, within 10, bonds to 10, doubles, teen numbers, add or take
     10, then across 10.

     Each rung gives the numbers of one calculation; fdQ turns it into a
     question. 'std' is the plain form (4 + 3 = ?), 'miss' a missing number
     (? + 3 = 7). A rung is first met in the plain form and only turns up as
     missing numbers once it is below the one being learned — acquisition
     before generalisation (Haring & Eaton, 1978).

     Ids are persisted: append to FD, never reorder or rename. The ORDER is
     LADDER; a rung saved before LADDER (no lv) is read through OLD_LADDER. */
  function R(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function P(a) { return a[Math.floor(Math.random() * a.length)]; }
  function add(a, b) { return { a: a, op: '+', b: b }; }
  function sub(a, b) { return { a: a, op: '-', b: b }; }
  var FD = [
    { id: 'fd:more1', label: 'Add or take away 1', gen: function () { return P([0, 1]) ? add(R(1, 9), 1) : sub(R(2, 10), 1); } },
    { id: 'fd:add10', label: 'Adding within 10', gen: function () { var a = R(1, 8); return add(a, R(1, 10 - a)); } },
    { id: 'fd:sub10', label: 'Taking away within 10', gen: function () { var a = R(3, 10); return sub(a, R(1, a - 1)); } },
    { id: 'fd:bond10', label: 'Number bonds to 10', miss: true, gen: function () { var a = R(1, 9); return add(a, 10 - a); } },
    { id: 'fd:double', label: 'Doubles', gen: function () { var a = R(1, 10); return add(a, a); } },
    { id: 'fd:add20', label: 'Adding to a teen number', gen: function () { var o = R(1, 7); return add(10 + o, R(1, 9 - o)); } },
    { id: 'fd:sub20', label: 'Taking away from a teen number', gen: function () { var o = R(2, 9); return sub(10 + o, R(1, o - 1)); } },
    { id: 'fd:ten', label: 'Add or take away 10', gen: function () { return P([0, 1]) ? add(R(1, 89), 10) : sub(R(11, 99), 10); } },
    { id: 'fd:addx', label: 'Adding across 10', gen: function () { var a = R(5, 9); return add(a, R(11 - a, 9)); } },
    { id: 'fd:subx', label: 'Taking away across 10', gen: function () { var b = R(3, 9); return sub(R(11, 9 + b), b); } },
    { id: 'fd:count', label: 'Counting on and back', seq: true, gen: function () {
        return P([0, 1]) ? { t: 'seq', start: R(0, 16), step: 1, len: 4, blank: R(1, 3) } : { t: 'seq', start: R(4, 20), step: -1, len: 4, blank: R(1, 3) }; } },
    { id: 'fd:add5', label: 'Adding within 5', gen: function () { var a = R(1, 4); return add(a, R(1, 5 - a)); } },
    { id: 'fd:sub5', label: 'Taking away within 5', gen: function () { var a = R(2, 5); return sub(a, R(1, a - 1)); } }
  ];
  var FD_BY = {}; FD.forEach(function (f) { FD_BY[f.id] = f; });
  var LADDER = ['fd:count', 'fd:more1', 'fd:add5', 'fd:sub5', 'fd:add10', 'fd:sub10', 'fd:bond10', 'fd:double',
                'fd:add20', 'fd:sub20', 'fd:ten', 'fd:addx', 'fd:subx'];
  var OLD_LADDER = ['fd:more1', 'fd:add10', 'fd:sub10', 'fd:bond10', 'fd:double', 'fd:add20', 'fd:sub20', 'fd:ten', 'fd:addx', 'fd:subx'];
  var LV = 2;
  var START_RUNG = LADDER.indexOf('fd:add10');   // most children a little behind can add within 10: a first sheet they finish
  var LOW_START = LADDER.indexOf('fd:add5');     // ...and one a long way behind starts on facts within 5
  function fdIndex(k) { return LADDER.indexOf(k); }
  function isFd(k) { return String(k).indexOf('fd:') === 0; }
  function clampRung(r) { return Math.max(0, Math.min(LADDER.length - 1, r | 0)); }
  /* a saved rung, on today's ladder */
  function rungOf(o) {
    if (!o || o.rung == null) return null;
    if (o.lv === LV) return clampRung(o.rung);
    return LADDER.indexOf(OLD_LADDER[Math.max(0, Math.min(OLD_LADDER.length - 1, o.rung | 0))]);
  }
  function rungLabel(r) { return r == null ? '' : FD_BY[LADDER[clampRung(r)]].label; }
  /* one question for a foundation skill, in the plain or the missing-number form */
  var BOX = '<span class="gen-blank">?</span>';
  function fdQ(k, form) {
    var f = FD_BY[k]; if (!f) return { t: 'prompt', s: '', ans: '' };
    var c = f.gen();
    if (f.seq) return c;
    if (!(f.miss || form === 'miss')) return { t: 'arith', a: c.a, op: c.op, b: c.b };
    var r = c.op === '+' ? c.a + c.b : c.a - c.b, left = P([0, 1]);
    if (c.op === '+') return { t: 'missing', a: c.a, b: c.b, sum: r, blank: left ? 'a' : 'b' };
    return left ? { t: 'prompt', s: BOX + ' - ' + c.b + ' = ' + r, ans: String(c.a) }
                : { t: 'prompt', s: c.a + ' - ' + BOX + ' = ' + r, ans: String(c.b) };
  }

  /* ── skills ───────────────────────────────────────────── */
  function setName(ht) { return typeof window.genSetName === 'function' ? window.genSetName(ht) : ht; }
  function slotKey(state, i, ht) {
    var id = state.slots[i];
    if (id && window.wrIsAvailable && window.wrIsAvailable(id)) return id;
    return 'pre:' + setName(ht) + ':' + i;
  }
  function presetQ(set, i) { var qs = window.genBuild ? window.genBuild(set, 'preset', N) : []; return qs[i] || { t: 'prompt', s: '', ans: '' }; }
  function plainQ(k) {
    if (k.indexOf('pre:') === 0) { var p = k.split(':'); return presetQ(p.slice(1, -1).join(':'), +p[p.length - 1]); }
    if (isFd(k)) return fdQ(k, 'std');
    return (window.wrBuild && window.wrBuild(k)) || { t: 'prompt', s: '', ans: '' };
  }
  /* A deeper form of a class skill (js/cbmdeep.js): 'dp:<skill>' on the sheet,
     one checkable answer; 'do:<skill>' in the practice box, where a question
     with many answers is allowed. Not a new skill and not next year's work:
     the same step, asked so that it needs reasoning. */
  function isDeep(k) { k = String(k); return k.indexOf('dp:') === 0 || k.indexOf('do:') === 0; }
  function baseOf(k) { return isDeep(k) ? String(k).slice(3) : k; }
  var deepMemo = {};
  function canDeep(c) {
    if (deepMemo[c] != null) return deepMemo[c];
    var ok = false;
    if (typeof window.cbmDeep === 'function' && !isFd(c) && !isDeep(c)) {
      try { ok = !!withSeed('deep?', function () { return window.cbmDeep(c, plainQ(c), false); }); } catch (e) { ok = false; }
    }
    return (deepMemo[c] = ok);
  }
  function buildKey(k, seed) {
    return withSeed(seed, function () {
      if (!isDeep(k)) return plainQ(k);
      var b = baseOf(k), q = plainQ(b);
      return (typeof window.cbmDeep === 'function' && window.cbmDeep(b, q, String(k).charAt(1) === 'o')) || q;   // no deeper form after all: the class question
    });
  }

  var TYPE_LABEL = {
    arith3: 'Adding three numbers', half: 'Halving', times: 'Times tables', divide: 'Division',
    clock: 'Telling the time', placeval: 'Tens and ones', numline: 'Number line', missing: 'Missing numbers', words: 'Numbers in words',
    shape: 'Properties of shape', future: 'Days and dates', compare: 'Comparing numbers', seq: 'Number sequences',
    tensones: 'Tens and ones', partition: 'Partitioning', step: 'More and less', prompt: 'Question'
  };
  var labelCache = {};
  function keyLabel(k) {
    if (labelCache[k]) return labelCache[k];
    var out;
    if (isDeep(k)) out = keyLabel(baseOf(k)) + ' · deeper';
    else if (isFd(k)) out = FD_BY[k] ? FD_BY[k].label : k;
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
    if (isDeep(k)) return keyTitle(baseOf(k)) + ' — a deeper question on the same step';
    if (isFd(k)) return 'Simple calculation: ' + keyLabel(k);
    return k.indexOf('pre:') === 0 ? keyLabel(k) + ' — ' + k.split(':')[1] + ' set' : (window.wrLabel ? window.wrLabel(k) : k);
  }
  function nextStep(k) {
    k = baseOf(k);
    if (isFd(k)) { var f = fdIndex(k); return f >= 0 && f < LADDER.length - 1 ? LADDER[f + 1] : null; }
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
      for (var i = 0, n = normN(state.n); i < n; i++) {
        var k = slotKey(state, i, ht), q = null;
        if (k.indexOf('pre:') !== 0) q = window.wrBuild ? window.wrBuild(k) : null;
        if (!q) { q = base[i] || { t: 'prompt', s: '', ans: '' }; k = 'pre:' + set + ':' + i; }
        q = JSON.parse(JSON.stringify(q)); q.k = k;
        out.push(q);
      }
      return out;
    });
  }

  /* ── stepping back through White Rose ─────────────────── */
  /* The way back from a class question is the scheme's own order: the
     buildable steps of the same topic within the year, one at a time. A slot
     left on the half-term preset has no path and stays where it is.

     Crossing into the year before needs care, because each year opens a
     topic by going over last year's ground: Year 2 "Bonds to 10" is Year 1
     "Number bonds to 10" again, not the step after the end of Year 1.
     Stepping from the first step of a year onto the LAST step of the year
     before would often make the question harder. So the way in is by
     meaning: find the step in the year before that this one repeats (by
     its title), and carry on from the step before THAT. Only when nothing
     in the year before resembles it — it is new ground — does the path join
     the end of last year's topic. Titles are White Rose's own, so this is a
     good guide and not a guarantee: tests/19-cbm.spec.js pins the crossings
     that matter most. */
  var topics = null, stepAt = null, backMemo = {};
  function topicOf(blockId) {
    var b = window.wrBlock ? window.wrBlock(blockId) : null;
    return b ? String(b.title).replace(/\s*\(.*\)\s*$/, '').replace(/\s+[AB]$/, '') : '';
  }
  function buildTopics() {
    topics = {}; stepAt = {};
    (window.WR_STEPS || []).forEach(function (st) {
      if (typeof st.gen !== 'function') return;
      var b = window.wrBlock ? window.wrBlock(st.block) : null, t = topicOf(st.block); if (!b || !t) return;
      var years = topics[t] || (topics[t] = {}), list = years[b.year] || (years[b.year] = []);
      stepAt[st.id] = { t: t, y: b.year, i: list.length, words: titleWords(st.title) }; list.push(st.id);
    });
  }
  /* A title as a set of words: "Number bonds to 10" → number, bond, to, 10.
     The small words stay — "to 10" and "within 10" are different steps. */
  var SMALL = { to: 1, within: 1, of: 1, 'in': 1, by: 1, from: 1, 'with': 1, on: 1, up: 1, into: 1, as: 1, is: 1, or: 1, 'for': 1,
                number: 1, use: 1, using: 1, what: 1, how: 1, many: 1 };
  function titleWords(title) {
    var out = {};
    String(title).toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(function (w) {
      if (!w || w === 'the' || w === 'a' || w === 'an' || w === 'and') return;
      if (w.length > 3 && /^[a-z]+s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
      out[w] = 1;
    });
    return out;
  }
  /* Two ways for a step to be last year's step again.
     close: nearly the same title ("Bonds to 10" / "Number bonds to 10").
     loose: one title's telling words all sit inside the other's, two or more
     of them ("Add and subtract 1s, 10s, 100s and 1,000s" / "Add and subtract
     1s") — the same idea with more or less said about it. */
  function close(a, b) {
    var ka = Object.keys(a), both = ka.filter(function (w) { return b[w]; }).length, all = ka.length + Object.keys(b).length - both;
    return all ? both / all : 0;
  }
  function loose(a, b) {
    var ka = Object.keys(a).filter(function (w) { return !SMALL[w]; }), kb = Object.keys(b).filter(function (w) { return !SMALL[w]; });
    var both = ka.filter(function (w) { return b[w]; }).length, least = Math.min(ka.length, kb.length);
    return both >= 2 && least ? both / least : 0;
  }
  var CLOSE = 0.6, LOOSE = 0.66;
  /* the step in a year's list that k repeats, or null. Ties go to the earlier, easier one. */
  function sameStep(words, list) {
    var best = null, score = 0;
    list.forEach(function (id) { var sc = close(words, stepAt[id].words); if (sc >= CLOSE && sc > score) { best = id; score = sc; } });
    if (best) return best;
    list.forEach(function (id) { var sc = loose(words, stepAt[id].words); if (sc >= LOOSE && sc > score) { best = id; score = sc; } });
    return best;
  }
  /* the step before k: earlier in the year's topic, else the way into the year before */
  function prevStep(k) {
    if (!topics) buildTopics();
    var at = stepAt[k]; if (!at) return null;
    var years = topics[at.t];
    if (at.i > 0) return years[at.y][at.i - 1];
    for (var y = at.y - 1; y >= 1; y--) {
      var list = years[y]; if (!list || !list.length) continue;
      var same = sameStep(at.words, list);
      // nothing before last year's version of it: last year's version is the step back
      return same ? (prevStep(same) || same) : list[list.length - 1];
    }
    return null;
  }
  /* k and the steps behind it, nearest first */
  function backPath(k) {
    if (backMemo[k]) return backMemo[k];
    var out = [k], cur = k;
    while (out.length <= MAX_BACK + 1 && (cur = prevStep(cur))) out.push(cur);
    return (backMemo[k] = out);
  }
  /* the skill d small steps before k, or null when the path runs out */
  function stepBack(k, d) {
    if (!d) return k;
    if (d < 0) return canDeep(k) ? 'dp:' + k : null;          // the other way: the same step, deeper
    return backPath(k)[d] || null;
  }
  function depthOf(c, k) { if (isDeep(k)) return -1; var i = backPath(c).indexOf(k); return i > 0 ? i : 0; }

  /* ── sheets and marks ─────────────────────────────────── */
  /* What one child was asked on a day, without building the questions:
     slots [{ i: the class slot, k: the skill asked, c: the slot's class skill }]
     and audit, the positions in slots of the teacher's two.
       · a day with ind: everyone has their own numbers. sheets[pid] holds only
         what differs from the class (ks: stepped slots, drop: slots left out);
         a numbers-only child's sheet is stored whole, as before.
       · an older day: the class sheet, or a stored shorter sheet. */
  function sheetPlan(day, pid) {
    var sh = day.sheets && day.sheets[pid];
    if (sh && sh.qs) return { own: true, num: true, rung: rungOf(sh), why: sh.why || '', audit: sh.audit || [], qs: sh.qs,
                              slots: sh.qs.map(function (q, i) { return { i: i, k: q.k, c: q.k }; }) };
    if (!day.ind) return { own: false, audit: day.audit || [], qs: day.qs, slots: day.qs.map(function (q, i) { return { i: i, k: q.k, c: q.k }; }) };
    var drop = (sh && sh.drop) || [], ks = (sh && sh.ks) || {}, slots = [];
    day.qs.forEach(function (q, i) { if (drop.indexOf(i) < 0) slots.push({ i: i, k: ks[i] || q.k, c: q.k }); });
    var audit = [];
    (day.audit || []).forEach(function (a) { for (var j = 0; j < slots.length; j++) if (slots[j].i === a) audit.push(j); });
    return { own: true, ind: true, why: (sh && sh.why) || '', slots: slots, audit: audit };
  }
  /* On an individual sheet the second of the two is the "did they get that
     far" question wherever it sits; on older sheets it is a second-half slot. */
  function isLate(pl, j) { return pl.ind ? j === 1 : pl.audit[j] >= pl.slots.length / 2; }
  /* The child's questions. Individual sheets are rebuilt from the seed, never
     stored: 20 questions for 30 children every day would fill the store. */
  var qsCache = {}, qsCacheN = 0;
  function sheetQs(day, iso, pid) {
    var pl = sheetPlan(day, pid);
    if (pl.qs) return pl.qs;
    var key = iso + '|' + (day.v || 0) + '|' + pid + '|' + pl.slots.map(function (x) { return x.i + ':' + x.k; }).join(',');
    if (qsCache[key]) return qsCache[key];
    if (qsCacheN++ > 400) { qsCache = {}; qsCacheN = 0; }
    return (qsCache[key] = pl.slots.map(function (x) {
      var q = JSON.parse(JSON.stringify(buildKey(x.k, seedOf(iso, day.v) + ':' + pid + ':' + x.i)));
      q.k = x.k; return q;   // nothing else: descriptors already use a, b, c, d for their numbers
    }));
  }
  /* An entry is the teacher's two marks, or absent. Older days also carry
     the child's own score (s, or w in the first version): still an entry,
     no longer used for anything. */
  function isScored(m) { return !!(m && (m.x || typeof m.s === 'number' || Array.isArray(m.w) || (m.a && m.a[0] != null && m.a[1] != null))); }

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
  /* One row per checked question per pupil per day. k is the skill asked, c
     the class skill it stands in for. ok: 1 right, 0 wrong, null blank (not
     reached — no evidence about the skill). */
  function results(state, from, to) {
    var out = [];
    Object.keys(state.days).sort().forEach(function (d) {
      if (d < from || d > to) return;
      var day = state.days[d];
      Object.keys(day.marks || {}).forEach(function (pid) {
        var m = day.marks[pid];
        if (!m || m.x || !m.a) return;
        var pl = sheetPlan(day, pid);
        pl.audit.forEach(function (pos, j) {
          var v = m.a[j], x = pl.slots[pos]; if (!x || (v !== 0 && v !== 1 && v !== -1)) return;
          out.push({ d: d, pid: pid, i: pos, k: x.k, c: x.c, ok: v === -1 ? null : v, late: isLate(pl, j) });
        });
      });
    });
    return out;
  }

  /* Each child's marked sheets, newest first: how long it was, what the two
     marks were, and whether the late one was left blank. */
  function sessions(state, pid, before, n) {
    var out = [];
    Object.keys(state.days).sort().reverse().forEach(function (d) {
      if (d >= before || out.length >= n) return;
      var day = state.days[d], m = day.marks && day.marks[pid];
      if (!isScored(m) || m.x) return;
      var pl = sheetPlan(day, pid), a = m.a || [];
      var x = { d: d, len: pl.slots.length, full: (day.qs || []).length || N, num: !!pl.num, rung: pl.num ? pl.rung : null, right: 0, wrong: 0, blank: false, late: false };
      pl.audit.forEach(function (pos, j) {
        if (a[j] === 1) x.right++; else if (a[j] === 0) x.wrong++;
        else if (a[j] === -1) { x.blank = true; if (isLate(pl, j)) x.late = true; }
      });
      out.push(x);
    });
    return out;
  }

  /* Everything is read from the teacher's marks. The class's success on a
     skill says how hard it is; each child gets one number, th, for how they
     compare with the class across every skill they were checked on — a
     Rasch fit (Rasch, 1960), pulled towards the class when marks are few so
     one morning does not decide everything. A question a few steps back is
     taken to be STEP_EASE easier per step. */
  function analyse(state, to, windowDays) {
    windowDays = windowDays || 14;
    var look = Math.max(LOOKBACK, windowDays), from = addDays(to, -(look - 1)), winFrom = addDays(to, -(windowDays - 1));
    var rs = results(state, from, to), cls = {}, byPid = {}, kids = {};
    function kid(pid) { return kids[pid] || (kids[pid] = { aN: 0, aOk: 0, blanks: 0, sheets: [], th: 0, rows: [] }); }
    rs.forEach(function (r) {
      var c = kid(r.pid);
      if (r.ok === null) { if (r.d >= winFrom) c.blanks++; return; }
      if (r.d >= winFrom) { var x = cls[r.k] || (cls[r.k] = { n: 0, ok: 0 }); x.n++; x.ok += r.ok; }
      c.aN++; c.aOk += r.ok; c.rows.push(r);
      var p = byPid[r.pid] || (byPid[r.pid] = {});
      (p[r.k] || (p[r.k] = [])).push(r);
    });
    Object.keys(cls).forEach(function (k) { cls[k].rate = cls[k].ok / cls[k].n; });
    Object.keys(state.days).sort().forEach(function (d) {
      if (d < from || d > to) return;
      var day = state.days[d];
      Object.keys(day.marks || {}).forEach(function (pid) { var m = day.marks[pid]; if (isScored(m) && !m.x) kid(pid).sheets.push(d); });
    });
    function smooth(x) { return logit((x.ok + 0.75 * 2) / (x.n + 2)); }
    function ease(k, c) {
      if (!c && isDeep(k)) c = baseOf(k);
      // a step back is only ever sat by the children who needed it, so its own marks say
      // nothing about how hard it is for the class: it is the class step, eased per step
      if (c && c !== k) { var y = cls[c]; return (y && y.n ? smooth(y) : logit(0.75)) + STEP_EASE * depthOf(c, k); }
      var x = cls[k];
      return x && x.n ? smooth(x) : logit(0.75);
    }
    Object.keys(kids).forEach(function (pid) {
      var c = kids[pid], th = 0, it, g, h;
      for (it = 0; it < 8; it++) {
        g = -th; h = -1;
        c.rows.forEach(function (r) {
          var w = Math.pow(0.5, daysBetween(r.d, to) / HALF_LIFE), p = sigmoid(ease(r.k, r.c) + th);
          g += w * (r.ok - p); h -= w * p * (1 - p);
        });
        th -= g / h;
      }
      c.th = Math.max(-3, Math.min(3, th));
      delete c.rows;
    });
    return { to: to, cls: cls, byPid: byPid, kids: kids, ease: ease, windowDays: windowDays };
  }
  function kidOf(an, pid) { return an.kids[pid] || { aN: 0, aOk: 0, th: 0, sheets: [], blanks: 0 }; }

  /* A child's chance of getting a skill right: how hard the class finds it,
     shifted by how this child compares with the class, then moved by their
     own checked answers on that skill — recent ones counting more. c is the
     class skill k stands in for, when k is a step back from it. */
  function estimate(an, pid, k, c) {
    var p0 = sigmoid(an.ease(k, c) + kidOf(an, pid).th);
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
     keys: the skills on the child's sheet, in order; cmap: the class skill
     each stands in for. */
  function chooseTargets(an, pid, keys, max, supported, cmap) {
    max = max || TARGETS; cmap = cmap || {};
    var kd = kidOf(an, pid);
    if (!kd.aN && !kd.sheets.length) return [];
    var uniq = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    var est = {}; uniq.forEach(function (k) { est[k] = estimate(an, pid, k, cmap[k]); });
    // a numbers-only child's box stays on the ladder: no class questions to read
    Object.keys(an.byPid[pid] || {}).forEach(function (k) { if (!est[k] && (!supported || isFd(k))) est[k] = estimate(an, pid, k); });
    var out = [], have = {};
    function add(k, y) { if (out.length < max && !have[k]) { have[k] = 1; out.push({ k: k, y: y }); } }

    // 1. what you marked wrong, for their next few sheets
    Object.keys(est).map(function (k) { return { k: k, o: openState(an, pid, k), e: est[k] }; })
      .filter(function (x) { return x.o.open; })
      .sort(function (x, y) { return x.o.miss < y.o.miss ? 1 : x.o.miss > y.o.miss ? -1 : x.e.p - y.e.p; })
      .forEach(function (x) { add(x.k, 'miss'); });
    /* no mark of yours wrong in the last fortnight, and enough marks to say so:
       the box is all challenge, not "least secure of what is left" */
    var clean = !supported && kd.aN >= MIN_MARKS && !Object.keys(an.byPid[pid] || {}).some(function (k) {
      return an.byPid[pid][k].some(function (r) { return !r.ok && daysBetween(r.d, an.to) <= 14; }); });
    // 2. what the whole class is weak on (not on a numbers-only sheet: wrong practice there)
    if (!supported && !clean) uniq.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH && est[k].p < SECURE; })
      .sort(function (x, y) { return an.cls[x].rate - an.cls[y].rate; })
      .forEach(function (k) { add(k, 'class'); });
    // 3. what they are most likely to get wrong
    if (!clean) uniq.filter(function (k) { return est[k].p < 0.8; })
      .sort(function (x, y) { return est[x].p - est[y].p; })
      .forEach(function (k) { add(k, 'low'); });
    /* 4. likely secure on all of it: their strongest skills, asked deeper
       (js/cbmdeep.js). Only where a skill has no deeper form, the next small
       step on. Never deeper on a skill they are working a step back on. */
    uniq.slice().sort(function (x, y) { return est[y].p - est[x].p; }).forEach(function (k) {
      var b = baseOf(k), back = !isDeep(k) && cmap[k] && cmap[k] !== k;
      if (!supported && !back && canDeep(b)) { add('do:' + b, 'stretch'); return; }
      if (k.indexOf('pre:') === 0 || isDeep(k)) return;
      var nx = nextStep(k); if (nx && uniq.indexOf(nx) < 0) add(nx, 'stretch');
    });
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
    var half = Math.ceil(keys.length / 2), first = best(0, half, null);
    return [first, best(half, keys.length, first)];
  }

  /* The skills to model on the board: what the class gets wrong most, from
     the teacher's marks. Slots of day.qs, weakest first. */
  function focusSlots(an, day) {
    var seen = {}, c = [];
    day.qs.forEach(function (q, i) { var x = an.cls[q.k]; if (seen[q.k] || !x || x.n < 3) return; seen[q.k] = 1; c.push({ i: i, rate: x.rate }); });
    c.sort(function (x, y) { return x.rate - y.rate || x.i - y.i; });
    var low = c.filter(function (x) { return x.rate < RETEACH; }).slice(0, 6);
    if (!low.length) low = c.filter(function (x) { return x.rate < SECURE; }).slice(0, 3);
    return low.map(function (x) { return x.i; });
  }

  /* ── each child's next sheet ──────────────────────────── */
  /* Two different problems, two different answers (Haring & Eaton, 1978;
     Daly et al., 1997):
       · WRONG answers → that skill steps back one small step, towards work
         at the child's level (Gickling & Armstrong, 1978; Burns, 2004).
       · BLANKS on the second of the two → not finishing → fewer questions.
     The rules are fixed in advance (Stecker, Fuchs & Fuchs, 2005), and a
     skill never moves more than one step between sheets (Levitt, 1971). */

  /* How many questions. run: the child's sheets at the current length, newest
     first. Two of the last three with the late mark blank takes two away;
     two running with no blank puts two back. */
  function lengthPlan(run, cur, lo, hi) {
    hi = hi || N;
    if (cur > lo && run.slice(0, 3).filter(function (x) { return x.late; }).length >= 2)
      return { n: Math.max(lo, cur - 2), why: 'Your second question left blank on 2 of the last ' + Math.min(3, run.length) + ' sheets: 2 fewer questions' };
    if (cur < hi && run.length >= 2 && !run[0].blank && !run[1].blank)
      return { n: Math.min(hi, cur + 2), why: 'No blanks two sheets running: 2 more questions' };
    return { n: cur, why: cur < hi ? 'Holding at ' + cur + ' questions' : '' };
  }
  function runAt(xs, test) { var out = []; for (var i = 0; i < xs.length && test(xs[i]); i++) out.push(xs[i]); return out; }

  /* What a child's sheet made on iso would be. Pure: planSheets saves it.
     classKeys: the day's class skills. */
  function planFor(state, pid, iso, an, classKeys) {
    var sup = supportOf(state, pid), mode = sup.mode, all = sessions(state, pid, iso, 8), cur, run, lp;
    var M = classKeys && classKeys.length ? classKeys.length : N, lo = Math.min(SUP_MIN, M);   // the class's length, and the shortest a sheet goes
    if (mode === 'num') {
      var mine = all.filter(function (x) { return x.num; }), last = mine[0];
      cur = Math.max(lo, Math.min(M, last ? last.len : NUM_START));
      var rung = last && last.rung != null ? last.rung : START_RUNG;
      run = runAt(mine, function (x) { return x.len === last.len && x.rung === rung; });
      lp = lengthPlan(run, cur, lo, M);
      var why = lp.why, two = run.slice(0, 2);
      if (two.length === 2 && two.every(function (x) { return x.right && !x.wrong && !x.blank; })) { rung++; why = 'Your marks all right two sheets running: a step harder'; }
      else if (two.length === 2 && two.every(function (x) { return x.wrong; })) { rung--; why = 'A mark wrong two sheets running: a step easier'; }
      // the teacher's Easier / Harder wins until a sheet is made after it
      if (sup.rung != null && sup.rungAt && (!last || sup.rungAt >= last.d)) { rung = rungOf(sup); why = (why ? why + ' · ' : '') + 'step set by you'; }
      return { mode: mode, n: lp.n, rung: clampRung(rung), why: why || 'Numbers only, set by you', lv: {}, moved: [] };
    }
    var lv = {}, moved = [], lvAt = sup.lvAt || null;
    if (mode === 'full') return { mode: mode, n: M, why: 'Class questions, set by you', lv: lv, moved: moved, lvAt: lvAt };
    var own = all.filter(function (x) { return !x.num; });
    /* a child on the whole sheet stays on the whole sheet when its length changes;
       a child already cut back keeps their length, within the class's */
    cur = !own[0] || own[0].len >= own[0].full ? M : Math.max(lo, Math.min(M, own[0].len));
    lp = lengthPlan(runAt(own, function (x) { return x.len === own[0].len; }), cur, lo, M);
    Object.keys(state.lv[pid] || {}).forEach(function (c) { if (state.lv[pid][c]) lv[c] = state.lv[pid][c]; });   // above 0: steps back; -1: the deeper form
    var kd = kidOf(an, pid), latest = kd.sheets.length ? kd.sheets[kd.sheets.length - 1] : null;
    /* Only on new evidence: making three sheets ahead must not step three
       times. For each skill, k is the step the child is on and hk the step
       above it.
         · BACK one step: a new wrong mark on k. Or, with no new mark, when
           how they are doing overall puts their chance on k under 60%.
         · FORWARD one step: a new right mark on k — two right running if
           they were marked wrong on hk, so "one wrong back, two right
           forward" settles where they get about 70% right (Levitt, 1971).
           Or, with no marks either way, when their chance on hk is 75%+.
           Or after RECOVER_SHEETS sheets with no further wrong mark on it.
       A guess from the overall picture never overrides a mark: it cannot
       send a child forward onto a step they were marked wrong on, or back
       from one they were marked right on.
         · DEEPER is decided for the child, not skill by skill, and afresh at
           every sheet: a child with DEEP_MARKS marks, DEEP_RATE of them right,
           is working deeper, and stays so until fewer than DEEP_STAY are.
           (Deeper questions are harder, so their marks pull that rate down by
           themselves.) It goes by the child's own marks and not the model's
           guess, because the class's rate on a skill comes only from the
           children still sitting it, which flatters it. While they are, every
           class question with a deeper form can be asked that way, except one
           whose last mark, plain or deeper, was wrong. The sheet carries a
           few of them (deepCap), different ones each day. Depth, not next
           year's work. */
    if (kd.aN >= MIN_MARKS && latest && !(lvAt && lvAt >= latest)) {
      var downs = [], since = lvAt || '', mine = an.byPid[pid] || {};
      var wasDeep = Object.keys(lv).some(function (c) { return lv[c] < 0; });
      Object.keys(lv).forEach(function (c) { if (lv[c] < 0) delete lv[c]; });
      var marksOn = function (key) { return (mine[key] || []).slice().sort(function (x, y) { return x.d < y.d ? 1 : -1; }); };   // newest first
      var uniq = classKeys.filter(function (c, i) { return classKeys.indexOf(c) === i; });
      uniq.forEach(function (c) {
        var d = lv[c] || 0, k = stepBack(c, d);
        if (!k) { delete lv[c]; d = 0; k = c; }
        var on = marksOn(k), fresh = on[0] && on[0].d > since ? on[0] : null;
        var hk = d > 0 ? stepBack(c, d - 1) : null, above = hk ? marksOn(hk)[0] : null, wrongAbove = !!(above && !above.ok);
        var canDown = d < MAX_BACK && stepBack(c, d + 1);
        function up() { if (d > 1) lv[c] = d - 1; else delete lv[c]; moved.push({ c: c, to: d - 1 }); }
        /* Time served: any one skill is only marked about once a fortnight, so
           waiting for a right mark on it would leave a child a step back for
           weeks after one slip. RECOVER_SHEETS sheets practising the easier
           step with no further wrong mark on this skill brings it forward one
           step — unless how they are doing overall says the step above is
           still beyond them, which is what would send it straight back. */
        var recovered = false;
        if (hk) {
          var lastWrong = '';
          for (var b = 0; b <= d; b++) marksOn(stepBack(c, b) || '').forEach(function (r) { if (!r.ok && r.d > lastWrong) lastWrong = r.d; });
          recovered = !!lastWrong && kd.sheets.filter(function (x) { return x > lastWrong; }).length >= RECOVER_SHEETS &&
            estimate(an, pid, hk, c).prior >= RECOVER_PRIOR;
        }
        if (fresh && !fresh.ok) { if (canDown) downs.push({ c: c, d: d, p: 0 }); }
        else if (fresh) { if (hk && (!wrongAbove || (on[1] && on[1].ok) || recovered)) up(); }
        else if (recovered) up();
        else if (hk && !wrongAbove && !(on[0] && !on[0].ok) && estimate(an, pid, hk, c).prior >= UP_PRIOR) up();
        else if (canDown && !(on[0] && on[0].ok)) {
          var p0 = estimate(an, pid, k, c).prior;
          if (p0 < RETEACH) downs.push({ c: c, d: d, p: p0 });
        }
      });
      downs.sort(function (x, y) { return x.p - y.p; }).slice(0, MAX_DOWN).forEach(function (x) { lv[x.c] = x.d + 1; moved.push({ c: x.c, to: x.d + 1 }); });
      var rate = kd.aN ? kd.aOk / kd.aN : 0;
      if (kd.aN >= DEEP_MARKS && rate >= (wasDeep ? DEEP_STAY : DEEP_RATE)) uniq.forEach(function (c) {
        if (lv[c] || !canDeep(c)) return;
        var last = marksOn(c).concat(marksOn('dp:' + c)).sort(function (x, y) { return x.d < y.d ? 1 : -1; })[0];
        if (!(last && !last.ok)) lv[c] = -1;
      });
      lvAt = latest;
    }
    return { mode: mode, n: lp.n, why: lp.why, lv: lv, moved: moved, lvAt: lvAt };
  }

  /* What is stored for a child on the class's questions: the stepped slots
     and the slots left out. Nothing at all when their sheet is the class's
     with their own numbers. The ones left out are what they are most secure
     on — never one of the teacher's two. */
  function deepCap(len) { return Math.max(2, Math.min(MAX_UP, Math.round(len / 4))); }
  function steppedSheet(day, pid, plan, an, iso) {
    var ks = {}, drop = [], sh = {}, deep = [];
    day.qs.forEach(function (q, i) {
      var d = plan.lv[q.k] || 0, k = d ? stepBack(q.k, d) : null;
      if (k && d < 0) deep.push({ i: i, k: k }); else if (k) ks[i] = k;
    });
    /* A sheet carries a few deeper questions, not twenty: they take longer to
       read. A child secure on more than that has a different few each day. */
    var cap = deepCap(day.qs.length), rnd = seeded('deep:' + (iso || '') + ':' + pid);
    deep.map(function (x) { return { x: x, r: rnd() }; }).sort(function (a, b) { return a.r - b.r; }).slice(0, cap)
      .forEach(function (o) { ks[o.x.i] = o.x.k; });
    if (plan.n < day.qs.length) {
      drop = day.qs.map(function (q, i) { return { i: i, p: estimate(an, pid, ks[i] || q.k, q.k).p }; })
        .filter(function (x) { return day.audit.indexOf(x.i) < 0; })
        .sort(function (x, y) { return y.p - x.p || y.i - x.i; })
        .slice(0, day.qs.length - plan.n).map(function (x) { return x.i; }).sort(function (a, b) { return a - b; });
    }
    if (Object.keys(ks).length) sh.ks = ks;
    if (drop.length) { sh.drop = drop; sh.why = plan.why; }
    return Object.keys(sh).length ? sh : null;
  }

  /* A supported child's own sheet: numbers and symbols only. About 70% known
     facts from the rungs just below (half as missing numbers), 30% the rung
     being learned in its plain form. Known facts open the sheet, so it starts
     with success (Skinner, 2002), and the new ones are spread through the
     rest rather than bunched (Burns, 2004). At the bottom rung there is
     nothing below, so it is all counting. */
  function buildSupportSheet(day, iso, pid, plan, an) {
    var n = plan.n, rung = plan.rung, newK = LADDER[rung];
    var nNew = rung ? Math.max(2, Math.round(n * 0.3)) : n, nKnown = n - nNew;
    var span = Math.min(rung, 3);             // review the three rungs below, nearest most
    var seen = {}, idx = 0;
    function fd(k, form) {
      var q, tries = 0, seed = seedOf(iso, day.v) + ':' + pid + ':' + idx;
      do { q = withSeed(seed + ':' + tries, function () { return fdQ(k, form); }); tries++; } while (seen[JSON.stringify(q)] && tries < 8);
      seen[JSON.stringify(q)] = 1; idx++;
      q.k = k; return q;
    }
    var known = [], fresh = [], j;
    for (j = 0; j < nKnown; j++) known.push(fd(LADDER[rung - 1 - (j % span)], Math.floor(j / span) % 2 ? 'miss' : 'std'));   // first pass plain, then missing numbers
    for (j = 0; j < nNew; j++) fresh.push(fd(newK, 'std'));
    // warm up on up to three known, then spread the new ones evenly through the rest
    var qs = known.splice(0, Math.min(3, known.length)), rest = known.length + fresh.length, placed = 0;
    for (j = 0; j < rest; j++) {
      var due = fresh.length && (!known.length || Math.floor((j + 1) * nNew / rest) > placed);
      if (due) { qs.push(fresh.shift()); placed++; } else qs.push(known.shift());
    }
    // the teacher's two: one of the new rung from the second half (a blank there = not finishing), and one more
    var half = qs.length / 2, audit = [];
    function pick(test) { for (var i = qs.length - 1; i >= 0; i--) if (audit.length < 2 && audit.indexOf(i) < 0 && test(qs[i], i)) { audit.push(i); return; } }
    pick(function (q, i) { return i >= half && q.k === newK; });
    pick(function (q, i) { return i < half && q.k === newK; });
    pick(function (q, i) { return i >= half; });
    pick(function () { return true; });
    return { qs: qs, audit: audit.sort(function (a, b) { return a - b; }), rung: rung, lv: LV, why: plan.why };
  }

  function planSheets(state, iso, onlyUnmarked) {
    var day = state.days[iso], an = analyse(state, addDays(iso, -1), 28);
    var classKeys = day.qs.map(function (q) { return q.k; });
    if (!day.sheets) day.sheets = {};
    roster.forEach(function (p) {
      if (onlyUnmarked && day.marks[p.id]) return;
      var plan = planFor(state, p.id, iso, an, classKeys), sh;
      if (plan.mode === 'num') sh = buildSupportSheet(day, iso, p.id, plan, an);
      else {
        if (Object.keys(plan.lv).length) state.lv[p.id] = plan.lv; else delete state.lv[p.id];
        if (plan.lvAt) { var o = supportOf(state, p.id); o.lvAt = plan.lvAt; state.support[p.id] = o; }
        sh = steppedSheet(day, p.id, plan, an, iso);
      }
      if (sh) day.sheets[p.id] = sh; else delete day.sheets[p.id];
    });
  }

  function makeDay(state, iso, v) {
    var day = { qs: buildDay(state, iso, v), audit: [], sheets: {}, marks: {}, tg: {}, ind: 1 };
    if (v) day.v = v;
    state.days[iso] = day;
    day.audit = pickAudit(state, iso);
    planSheets(state, iso, false);
    return day;
  }

  function targetsFor(an, day, pid) {
    var pl = sheetPlan(day, pid), cmap = {};
    pl.slots.forEach(function (x) { cmap[x.k] = x.c; });
    return chooseTargets(an, pid, pl.slots.map(function (x) { return x.k; }), pl.num ? SUP_TARGETS : TARGETS, !!pl.num, cmap);
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
      '<p>The same skills for everyone, with different numbers on every child\'s sheet. You mark the same two questions in every book and tap them in. From those marks alone the app works out who can do what, steps a question back for a child who is not ready for it, and picks each child\'s practice questions.</p></div>' +
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
        '<p>Making it builds the ' + state.n + ' questions from <b>Set up</b> (' + esc(htOf(state, curDay)) + ') with different numbers for every child, picks the two you will mark, and steps a question back for any child your marks show is not ready for it.</p>' +
        '<button type="button" id="cbmMake">Make the sheet</button></div>';
      wireNav(body);
      document.getElementById('cbmMake').onclick = function () { var s = load(); makeDay(s, curDay); save(s); renderToday(); };
      return;
    }
    var a = day.audit, qa = qNums(day), an = analyse(state, curDay, 14), focus = focusSlots(an, day);
    var rows = sortedRoster().map(function (p) { return rowHTML(state, day, p); }).join('');
    var board = typeof window.hubOpenBoard === 'function';
    body.innerHTML = nav +
      '<div class="cbm-audit"><div><div class="cbm-k">Mark these two in every book — don\'t tell the class which</div>' +
        '<div class="cbm-auditq">' + a.map(function (i) { return '<span><b>Q' + (i + 1) + '</b> ' + esc(keyLabel(day.qs[i].k)) + (day.ind ? '' : ' <em>' + esc(ans(day.qs[i], curDay)) + '</em>') + '</span>'; }).join('') + '</div>' +
        (day.ind ? '<div class="cbm-supq">Every child has their own numbers. Their two answers are beside their name below, and on the marking list.</div>' : '') +
        (focus.length ? '<div class="cbm-focus"><span class="cbm-k">Model on the board</span>' + focus.map(function (i) {
          var k = day.qs[i].k; return '<span class="cbm-chip low" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + ' · ' + pct(an.cls[k].rate) + '</span>'; }).join('') + '</div>' : '') +
        '</div><div class="cbm-actions">' +
          '<button type="button" id="cbmPrintAll">Print class set</button>' +
          '<button type="button" class="secondary" id="cbmPrintMark">Print marking list</button>' +
          (board && focus.length ? '<button type="button" class="secondary" id="cbmWbFocus">Model the focus skills</button>' : '') +
          (board ? '<button type="button" class="secondary" id="cbmWb">All ' + day.qs.length + ' on the board</button>' : '') +
          '<button type="button" class="secondary" id="cbmPrintOne">Print one blank sheet</button>' +
          (state.xt.on ? '<button type="button" class="secondary" id="cbmPrintXt">Print ×tables only</button>' : '') +
        '</div></div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Your marks</h3><span class="cbm-count" id="cbmCount">' + enteredCount(day) + ' of ' + roster.length + ' entered</span></div>' +
        '<p class="cbm-hint">Tap each mark: <b>✓</b> right, <b>✗</b> wrong, <b>–</b> left blank. The answer beside it is that child\'s own. Nothing else is entered.</p>' +
        '<div class="table-wrap"><table class="cbm-table"><thead><tr><th class="name">Pupil</th><th>' + qa[0] + '</th><th>' + qa[1] + '</th><th></th><th>Practice box</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>' +
      '<details class="card cbm-qlist"><summary>Today\'s ' + day.qs.length + ' questions — the model version, with answers</summary>' +
        '<p class="cbm-hint">The same skills as every child\'s sheet, with numbers nobody has. This is what goes on the board.</p><ol>' +
        day.qs.map(function (q, i) { return '<li' + (a.indexOf(i) >= 0 ? ' class="is-audit"' : '') + '><span class="cbm-qtext">' + GRQ(q) + '</span><span class="cbm-qans">' + esc(ans(q, curDay)) + '</span><span class="cbm-qskill" title="' + esc(keyTitle(q.k)) + '">' + esc(keyLabel(q.k)) + '</span></li>'; }).join('') +
      '</ol><div class="cbm-qtools">' + (day.ind ? '<button type="button" class="secondary small" id="cbmRetarget" title="For children with nothing entered yet">Rebuild sheets and practice boxes</button>' : '') +
        '<button type="button" class="secondary small" id="cbmRegen">Make a new set of questions</button>' +
        '<button type="button" class="danger small" id="cbmDelete">Delete this sheet</button></div></details>';
    wireNav(body);
    wireRows(body);
    document.getElementById('cbmPrintAll').onclick = function () { printSheets(true); };
    document.getElementById('cbmPrintOne').onclick = function () { printSheets(false); };
    document.getElementById('cbmPrintMark').onclick = printMarking;
    /* The Mental Starters whiteboard: one at a time on squared paper, pen and rubber, then the
       answers page. Ink is kept per day (tp_starter_ann, 'cbm:<iso>:…'); the focus list keeps
       its own, because its question 1 is not the sheet's question 1. */
    function openBoard(qs, key, title) {
      window.hubOpenBoard({ qs: qs, iso: curDay, key: key, title: title + ' · ' + shortDate(curDay), sub: fullDate(curDay), onClose: renderToday });
    }
    var wb = document.getElementById('cbmWb'); if (wb) wb.onclick = function () { openBoard(day.qs, 'cbm:' + curDay, 'Mental Starter (CBM)'); };
    var wf = document.getElementById('cbmWbFocus'); if (wf) wf.onclick = function () {
      openBoard(focus.map(function (i) { return day.qs[i]; }), 'cbm:' + curDay + ':focus', 'Focus skills');
    };
    var px = document.getElementById('cbmPrintXt'); if (px) px.onclick = function () { toPrint(tablesHTML(curDay, load().xt, '')); };
    var rt = document.getElementById('cbmRetarget'); if (rt) rt.onclick = function () {
      var s = load(), d = s.days[curDay];
      planSheets(s, curDay, true);
      Object.keys(d.tg || {}).forEach(function (pid) { if (!d.marks[pid]) delete d.tg[pid]; });
      save(s); renderToday();
    };
    document.getElementById('cbmRegen').onclick = function () {
      var has = enteredCount(day);
      if (!confirm('Replace the ' + day.qs.length + ' questions for ' + fullDate(curDay) + ' with a fresh set' + (has ? '? The marks entered for ' + has + ' children will be cleared.' : '?'))) return;
      var s = load(); makeDay(s, curDay, (s.days[curDay].v || 0) + 1); save(s); clearBoardInk(curDay); renderToday();
    };
    document.getElementById('cbmDelete').onclick = function () {
      var has = enteredCount(day);
      if (!confirm('Delete the sheet for ' + fullDate(curDay) + (has ? ' and the marks entered for ' + has + ' children' : '') + '?')) return;
      var s = load(); delete s.days[curDay]; save(s); clearBoardInk(curDay); renderToday();
    };
  }

  /* The board's ink for a day (tp_starter_ann, 'cbm:<iso>:…') belongs to that day's questions:
     a new set or a deleted sheet must not show the old working over different questions. */
  function clearBoardInk(iso) {
    var a = Store.get('tp_starter_ann', null); if (!a || typeof a !== 'object') return;
    var pre = 'cbm:' + iso + ':', hit = false;
    Object.keys(a).forEach(function (k) { if (k.indexOf(pre) === 0) { delete a[k]; hit = true; } });
    if (hit) Store.set('tp_starter_ann', a);
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
  var MARK = { '1': ['yes', '✓'], '0': ['no', '✗'], '-1': ['blank', '–'] };
  /* one of the teacher's two for one child: the tap button, and that child's own answer */
  function auditBtn(day, pid, j) {
    var m = day.marks[pid], pl = sheetPlan(day, pid), pos = pl.audit[j], v = m && !m.x && m.a ? m.a[j] : null, mk = MARK[String(v)];
    if (pos == null) return '';
    var q = pl.own ? sheetQs(day, curDay, pid)[pos] : null;
    return '<button type="button" class="cbm-mark' + (mk ? ' ' + mk[0] : '') + '" data-aj="' + j + '"' + (m && m.x ? ' disabled' : '') +
      ' aria-label="Your mark for Q' + (pos + 1) + '">' + (mk ? mk[1] : '·') + '</button>' +
      (pos !== day.audit[j] ? '<span class="cbm-markq">Q' + (pos + 1) + '</span>' : '') +
      (q ? '<span class="cbm-markans" title="' + esc(keyTitle(q.k)) + '">' + esc(ans(q, curDay)) + '</span>' : '');
  }
  function absBtn(day, pid) {
    var x = !!(day.marks[pid] && day.marks[pid].x);
    return '<button type="button" class="cbm-abs' + (x ? ' on' : '') + '" aria-pressed="' + x + '">Absent</button>';
  }
  function boxHTML(state, day, pid) {
    var tg = day.tg && day.tg[pid] ? day.tg[pid] : targetsForDay(state, curDay, pid);
    if (!tg.length) return '<span class="muted small">after your first marks</span>';
    return tg.map(function (t) { return '<span class="cbm-tg cbm-tg-' + t.y + '" title="' + esc(keyTitle(t.k) + ' — ' + WHY[t.y]) + '">' + esc(keyLabel(t.k)) + '</span>'; }).join('');
  }
  /* what is different about this child's sheet, beside their name */
  function tagsHTML(day, pid) {
    var pl = sheetPlan(day, pid), out = '';
    if (pl.num) return ' <span class="cbm-sup" title="' + esc((pl.why ? pl.why + ' · ' : '') + rungLabel(pl.rung)) + '">' + (day.ind ? 'numbers · ' : '') + pl.slots.length + ' Qs</span>';
    if (pl.slots.length < day.qs.length) out += ' <span class="cbm-sup" title="' + esc(pl.why) + '">' + pl.slots.length + ' Qs</span>';
    var st = pl.slots.filter(function (x) { return x.k !== x.c; });
    if (st.length) out += ' <span class="cbm-sup cbm-stepped" title="' + esc(st.map(function (x) { return 'Q' + (pl.slots.indexOf(x) + 1) + ' ' + keyLabel(x.c) + ' → ' + keyLabel(x.k); }).join('\n')) + '">' + st.length + ' stepped back</span>';
    return out;
  }
  function rowHTML(state, day, p) {
    return '<tr data-pid="' + p.id + '"><td class="name">' + esc(p.name) + tagsHTML(day, p.id) + '</td>' +
      '<td class="cbm-markcell">' + auditBtn(day, p.id, 0) + '</td><td class="cbm-markcell">' + auditBtn(day, p.id, 1) + '</td>' +
      '<td class="cbm-abscell">' + absBtn(day, p.id) + '</td><td class="cbm-box-cell">' + boxHTML(state, day, p.id) + '</td></tr>';
  }

  function wireRows(body) {
    function refresh(tr) {
      var s = load(), day = s.days[curDay], pid = tr.dataset.pid, td = tr.children;
      td[1].innerHTML = auditBtn(day, pid, 0); td[2].innerHTML = auditBtn(day, pid, 1);
      td[3].innerHTML = absBtn(day, pid); td[4].innerHTML = boxHTML(s, day, pid);
      document.getElementById('cbmCount').textContent = enteredCount(day) + ' of ' + roster.length + ' entered';
    }
    body.querySelectorAll('.cbm-table tbody').forEach(function (tb) {
      tb.addEventListener('click', function (e) {
        var b = e.target.closest('.cbm-mark, .cbm-abs'); if (!b || b.disabled) return;
        var tr = b.closest('tr'), pid = tr.dataset.pid, s = load(), day = s.days[curDay], m = day.marks[pid];
        if (b.classList.contains('cbm-abs')) {
          if (m && m.x) delete day.marks[pid]; else day.marks[pid] = { x: 1 };
        } else {
          var j = +b.dataset.aj;
          if (!m) m = day.marks[pid] = { a: [null, null] };
          if (!m.a) m.a = [null, null];
          var v = m.a[j];
          m.a[j] = v === 1 ? 0 : v === 0 ? -1 : v === -1 ? null : 1;    // · → ✓ → ✗ → blank → ·
          if (m.a[0] == null && m.a[1] == null && typeof m.s !== 'number' && !Array.isArray(m.w)) delete day.marks[pid];
        }
        save(s); refresh(tr);
      });
    });
  }

  /* ── Print ────────────────────────────────────────────── */
  function boxQ(t, iso, pid) { return buildKey(t.k, 'cbm:' + iso + ':' + pid + ':' + t.k); }
  /* For a class whose children mark their own (Set up): that child's answers,
     to fold under or cut off the foot of the back page. Each child's numbers
     are their own, so the answers cannot go on the board. Nothing a child
     marks is entered or used; the teacher's two marks still decide everything. */
  function stripHTML(day, iso, pid, targets) {
    var qs = sheetQs(day, iso, pid);
    var item = function (n, q) { return '<span class="cbm-strip-a"><b>' + n + ')</b> ' + esc(ans(q, iso)) + '</span>'; };
    return '<div class="cbm-strip"><div class="cbm-strip-cut">fold under or cut off</div><div class="cbm-strip-h">Answers</div><div class="cbm-strip-list">' +
      qs.map(function (q, i) { return item(i + 1, q); }).join('') + '</div>' +
      (targets && targets.length ? '<div class="cbm-strip-list cbm-strip-box">' + targets.map(function (t, i) { return item('abcd'.charAt(i), boxQ(t, iso, pid)); }).join('') + '</div>' : '') + '</div>';
  }
  /* The back of a child's sheet: the ×tables, their answer strip, or both. Always one page. */
  function backHTML(day, iso, s, name, pid, targets) {
    var strip = s.sm && pid ? stripHTML(day, iso, pid, targets) : '';
    if (!s.xt.on && !strip) return '';
    if (!strip) return tablesHTML(iso, s.xt, name);
    var head = '<h2 class="gen-heading">' + (name ? '<span class="gen-day-name">' + esc(name) + '</span> · ' : '') + esc(fullDate(iso)) +
      (s.xt.on ? ' · Times tables — ' + esc(tablesLabel(s.xt.pick)) : ' · Mental Starter answers') + '</h2>';
    var cells = s.xt.on ? '<div class="gen-grid gen-grid-tables">' + tablesFor(iso, s.xt).map(function (q, i) {
      return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('') + '</div>' : '';
    return '<div class="card gen-sheet gen-day cbm-backpage">' + head + cells + strip + '</div>';
  }
  function sheetHTML(day, iso, name, targets, pid) {
    var qs = pid ? sheetQs(day, iso, pid) : day.qs, short = qs.length <= 14;
    var cells = qs.map(function (q, i) { return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('');
    var box = '';
    if (targets && targets.length) {
      box = '<div class="cbm-pbox"><div class="cbm-pbox-h">My ' + targets.length + ' to practise</div><div class="cbm-pbox-grid">' +
        targets.map(function (t, i) {
          var q = boxQ(t, iso, pid);
          return '<div class="gen-q"><span class="gen-num">' + 'abcd'.charAt(i) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>';
        }).join('') + '</div></div>';
    }
    // every sheet looks alike — same heading, no label — a short one is just bigger
    return '<div class="card gen-sheet gen-day cbm-sheet' + (short ? ' cbm-sheet-short' : '') + '"><h2 class="gen-heading">' + (name ? '<span class="gen-day-name">' + esc(name) + '</span> · ' : '') +
      esc(fullDate(iso)) + ' · Mental Starter</h2><div class="gen-grid">' + cells + '</div>' + box + '</div>';
  }
  function tablesHTML(iso, xt, name) {
    var cells = tablesFor(iso, xt).map(function (q, i) { return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + GRQ(q) + '</div></div>'; }).join('');
    // the Mental Starters back page exactly: no cbm-sheet sizing, which would crowd 100 questions
    return '<div class="card gen-sheet gen-day"><h2 class="gen-heading">' + (name ? '<span class="gen-day-name">' + esc(name) + '</span> · ' : '') +
      esc(fullDate(iso)) + ' · Times tables — ' + esc(tablesLabel(xt.pick)) + '</h2><div class="gen-grid gen-grid-tables">' + cells + '</div></div>';
  }
  /* Every sheet on one side of A4, whatever is on it. Deeper questions and
     pictures make some children's sheets longer than others; a sheet that ran
     onto a second page pushed its practice box over, and the ×tables page
     after it onto the wrong side of the paper. So the sheets are laid out
     off-screen at the paper's width (css/cbm.css .cbm-paper), each one is
     measured, and one that is too tall has its type, spacing and pictures
     turned down a little at a time (--k) until it fits. */
  var PAGE_MM = 279, FIT_MIN = 0.5;            // A4 less the page margins; below half size it is not a sheet any more
  function fitSheets(c) {
    var sheets = c.querySelectorAll('.cbm-paper .cbm-sheet, .cbm-paper .cbm-backpage'); if (!sheets.length) return;
    var was = c.getAttribute('style') || '';
    c.setAttribute('style', 'display:block !important;position:absolute;left:-20000px;top:0;visibility:hidden');
    var ruler = document.createElement('div'); ruler.style.cssText = 'height:100mm;width:1px'; c.appendChild(ruler);
    var limit = ruler.getBoundingClientRect().height / 100 * PAGE_MM * 0.97;          // 3% spare: paper is not a screen
    c.removeChild(ruler);
    Array.prototype.forEach.call(sheets, function (sh) {
      var k = 1;
      while (sh.getBoundingClientRect().height > limit && k > FIT_MIN) { k = Math.round((k - 0.03) * 100) / 100; sh.style.setProperty('--k', k); }
    });
    if (was) c.setAttribute('style', was); else c.removeAttribute('style');
  }
  function toPrint(html) {
    var c = document.getElementById('starterPrint');
    if (!c) { c = document.createElement('div'); c.id = 'starterPrint'; document.body.appendChild(c); }
    c.innerHTML = '<div class="cbm-paper">' + html + '</div>';
    fitSheets(c);
    window.print();
  }
  function printSheets(personal) {
    var s = load(), day = s.days[curDay]; if (!day) return;
    // each child's ×tables page follows their sheet, so it prints double-sided onto the back
    var html = '', back = function (name, pid, tg) { return backHTML(day, curDay, s, name, pid, tg); };
    if (personal) {
      if (!day.tg || !Object.keys(day.tg).length) freezeTargets(s, curDay);
      sortedRoster().forEach(function (p) {
        if (!day.tg[p.id]) day.tg[p.id] = targetsForDay(s, curDay, p.id);
        html += sheetHTML(day, curDay, p.name, day.tg[p.id], p.id) + back(p.name, p.id, day.tg[p.id]);
      });
      save(s);
    } else html = sheetHTML(day, curDay, '', null, '') + back('');
    toPrint(html);
    if (view === 'today') renderToday();
  }
  /* Every child's numbers are their own, so the two answers the teacher needs
     are different in every book: one page to carry round the room. */
  function printMarking() {
    var day = load().days[curDay]; if (!day) return;
    var rows = sortedRoster().map(function (p) {
      var pl = sheetPlan(day, p.id), qs = sheetQs(day, curDay, p.id);
      return '<tr><td class="name">' + esc(p.name) + '</td>' + [0, 1].map(function (j) {
        var pos = pl.audit[j];
        return pos == null ? '<td></td>' : '<td><span class="cbm-ml-q">Q' + (pos + 1) + '</span> <b>' + esc(ans(qs[pos], curDay)) + '</b></td><td class="cbm-ml-box"></td>';
      }).join('') + '</tr>';
    }).join('');
    toPrint('<div class="card gen-sheet gen-day cbm-marklist"><h2 class="gen-heading">Marking list · ' + esc(fullDate(curDay)) + '</h2>' +
      '<table><thead><tr><th class="name">Pupil</th><th>First</th><th></th><th>Second</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  /* ── Progress ─────────────────────────────────────────── */
  function renderProgress() {
    var state = load(), body = document.getElementById('cbmBody');
    var dates = Object.keys(state.days).sort(), last = dates.filter(function (d) { return d <= todayISO(); }).pop();
    if (!last) { body.innerHTML = '<div class="card empty">No sheets yet. Make one on <b>Today</b>.</div>'; return; }
    var an = analyse(state, todayISO(), windowDays);
    var latest = state.days[last], keys = latest.qs.map(function (q) { return q.k; });
    // other class skills checked in the window; not the steps back or the number facts individual children were given
    var wasClass = {};
    dates.forEach(function (d) { state.days[d].qs.forEach(function (q) { wasClass[q.k] = 1; }); });
    Object.keys(an.cls).forEach(function (k) { if (keys.indexOf(k) < 0 && wasClass[k]) keys.push(k); });
    keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    var checked = keys.filter(function (k) { return an.cls[k]; }).length;
    function depth(pid, k) { return supportOf(state, pid).mode === 'auto' ? ((state.lv[pid] || {})[k] || 0) : 0; }

    var reteach = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate < RETEACH; }).sort(function (a, b) { return an.cls[a].rate - an.cls[b].rate; });
    var secure = keys.filter(function (k) { var c = an.cls[k]; return c && c.n >= 5 && c.rate >= SECURE; });
    var back = sortedRoster().map(function (p) { return { p: p, n: keys.filter(function (k) { return depth(p.id, k) > 0; }).length }; }).filter(function (x) { return x.n; });
    var deepKids = sortedRoster().map(function (p) { return { p: p, n: keys.filter(function (k) { return depth(p.id, k) < 0 && canDeep(k); }).length }; }).filter(function (x) { return x.n; });
    var stages = stagesFor(state);
    function chips(list, empty, fmt) { return list.length ? list.map(fmt).join('') : '<span class="muted small">' + empty + '</span>'; }

    var head = '<tr><th class="name">Pupil</th>' + keys.map(function (k) {
      return '<th class="cbm-hk" title="' + esc(keyTitle(k)) + '"><span>' + esc(keyLabel(k)) + '</span></th>';
    }).join('') + '<th title="How many of your marks were right">Your marks</th><th>Practice box next</th></tr>';
    var classRow = '<tr class="cbm-classrow"><td class="name">Class</td>' + keys.map(function (k) {
      var c = an.cls[k], n = roster.filter(function (p) { return depth(p.id, k) > 0; }).length;
      var tip = keyLabel(k) + ': ' + (c ? c.ok + ' of ' + c.n + ' checked answers right' : 'not checked yet') + (n ? ' · ' + n + ' working a step or more back' : '');
      return '<td class="cbm-cell' + (c ? ' b-' + band(c.rate) : '') + '" title="' + esc(tip) + '">' + (c ? pct(c.rate) : '·') + '</td>';
    }).join('') + '<td></td><td></td></tr>';
    var rows = sortedRoster().filter(function (p) { return !stageFilter || stages[p.id].id === stageFilter; }).map(function (p) {
      var kd = kidOf(an, p.id);
      var cells = keys.map(function (k) {
        if (!kd.aN) return '<td class="cbm-cell">·</td>';
        var d = depth(p.id, k), e = estimate(an, p.id, k, k), o = openState(an, p.id, k);
        var tip = p.name + ' · ' + keyLabel(k) + ': ' + (e.n ? e.right + ' of ' + e.n + ' checked right, ' : 'not checked yet, ') + 'about ' + pct(e.p) + ' likely' +
          (d > 0 ? ' — working ' + d + ' step' + (d > 1 ? 's' : '') + ' back: ' + keyLabel(stepBack(k, d) || k) : d < 0 ? ' — on deeper questions for this skill' : '') + (o.open ? ' — in their practice box' : '');
        return '<td class="cbm-cell b-' + band(e.p) + (e.n ? '' : ' is-guess') + (o.open ? ' is-open' : '') + (d > 0 ? ' is-back' : d < 0 ? ' is-deep' : '') + '" title="' + esc(tip) + '">' + (e.n ? e.right + '/' + e.n : pct(e.p)) + (d > 0 ? '<i class="cbm-back">↓' + d + '</i>' : d < 0 ? '<i class="cbm-back cbm-up">↑</i>' : '') + '</td>';
      }).join('');
      var tg = targetsFor(an, latest, p.id);
      return '<tr><td class="name">' + stagePill(p.name, stages[p.id]) + '</td>' + cells +
        '<td class="cbm-trust">' + (kd.aN ? kd.aOk + '/' + kd.aN : '—') + '</td>' +
        '<td class="cbm-box-cell">' + (tg.length ? tg.map(function (x) { return '<span class="cbm-tg cbm-tg-' + x.y + '" title="' + esc(WHY[x.y]) + '">' + esc(keyLabel(x.k)) + '</span>'; }).join('') : '<span class="muted small">—</span>') + '</td></tr>';
    }).join('');

    body.innerHTML =
      '<div class="cbm-daynav"><label for="cbmWin">Looking at</label><select id="cbmWin">' +
        [[7, 'the last week'], [14, 'the last 2 weeks'], [28, 'the last 4 weeks'], [91, 'the last term']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === windowDays ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><span class="muted small">' + checked + ' of ' + keys.length + ' skills checked so far</span></div>' +
      stageCard(stages) +
      supportHTML(state, latest, stages) +
      '<div class="cbm-cards">' +
        '<div class="card cbm-card"><h3>Reteach to the class</h3><p class="cbm-hint">Under ' + pct(RETEACH) + ' of your marks right across the class.</p>' + chips(reteach, 'Nothing below ' + pct(RETEACH) + '.', function (k) { return '<span class="cbm-chip low" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + ' · ' + pct(an.cls[k].rate) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Secure</h3><p class="cbm-hint">' + pct(SECURE) + ' or more right. Could leave the sheet for a harder step.</p>' + chips(secure, 'Nothing secure yet.', function (k) { return '<span class="cbm-chip sec" title="' + esc(keyTitle(k)) + '">' + esc(keyLabel(k)) + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Working a step or more back</h3><p class="cbm-hint">Children whose sheet has an earlier step in place of a class question.</p>' + chips(back, 'No one.', function (x) { return '<span class="cbm-chip mid">' + esc(x.p.name) + ' · ' + x.n + ' skill' + (x.n > 1 ? 's' : '') + '</span>'; }) + '</div>' +
        '<div class="card cbm-card"><h3>Working deeper</h3><p class="cbm-hint">Children whose sheet has a reasoning question in place of a class question they are secure on.</p>' + chips(deepKids, 'No one yet.', function (x) { return '<span class="cbm-chip sec">' + esc(x.p.name) + ' · ' + x.n + ' skill' + (x.n > 1 ? 's' : '') + '</span>'; }) + '</div>' +
      '</div>' +
      '<div class="card"><div class="cbm-entryhead"><h3>Skill by skill</h3><span class="cbm-legend"><i class="b-low"></i>under 60% <i class="b-mid"></i>60–74% <i class="b-ok"></i>75–89% <i class="b-sec"></i>90%+ <i class="is-open"></i>in practice box</span></div>' +
        '<p class="cbm-hint"><b>3/4</b> = your marks on that skill (right/checked). A pale <i>70%</i> = not checked yet for that child; worked out from how hard the class finds it and how they compare with the class. <b>↓2</b> = that child is working two steps back on it; <b>↑</b> = on deeper questions for it. Each mark you make firms it up.</p>' +
        '<div class="table-wrap"><table class="cbm-grid"><thead>' + head + '</thead><tbody>' + classRow + rows + '</tbody></table></div></div>';
    document.getElementById('cbmWin').onchange = function (e) { windowDays = +e.target.value; renderProgress(); };
    body.querySelectorAll('[data-stagepick]').forEach(function (b) {
      b.onclick = function () { stageFilter = stageFilter === b.dataset.stagepick ? null : b.dataset.stagepick; renderProgress(); };
    });
    wireSupport(body, latest);
  }

  /* What stage a child's NEXT sheet is at, for the teacher's eyes only: this
     is shown on Progress and nowhere a child could see it (not the sheets,
     not Today, not the marking list). One stage each, most support first.
     Three questions, not one, tip a child into Easier or Challenge: a single
     question a step back is ordinary movement, and colouring it would turn
     the whole class red or green within a fortnight. */
  var STAGES = [['easier', 'Easier questions', 'E'], ['fewer', 'Fewer questions', 'F'], ['class', 'Class questions', ''], ['deeper', 'Challenge', 'C']];
  var STAGE_AT = 3;
  function stageOf(plan, classKeys) {
    var M = classKeys.length, back = 0, deep = 0;
    if (plan.mode !== 'num') classKeys.forEach(function (c) {
      var d = plan.lv[c] || 0;
      if (d > 0 && stepBack(c, d)) back++; else if (d < 0 && canDeep(c)) deep++;
    });
    deep = Math.min(deep, deepCap(M));
    var short = plan.n < M, id = plan.mode === 'num' || back >= STAGE_AT ? 'easier' : short ? 'fewer' : deep >= Math.min(STAGE_AT, deepCap(M)) ? 'deeper' : 'class';
    var why = plan.mode === 'num' ? 'Numbers only, set by you'
      : id === 'easier' ? back + ' questions a step or more back'
      : id === 'fewer' ? (plan.why || plan.n + ' questions')
      : id === 'deeper' ? deep + ' deeper questions on the next sheet'
      : 'The class questions' + (back ? ', ' + back + ' a step back' : '') + (deep ? ', ' + deep + ' deeper' : '');
    return { id: id, back: back, deep: deep, n: plan.n, short: short, num: plan.mode === 'num', why: why };
  }
  function stagePill(name, st) {
    var meta = STAGES.filter(function (x) { return x[0] === st.id; })[0];
    var extra = (st.id !== 'easier' && st.back ? '<i class="cbm-st-x">↓' + st.back + '</i>' : '') + (st.id !== 'deeper' && st.deep ? '<i class="cbm-st-x">↑' + st.deep + '</i>' : '') +
      (st.id === 'easier' && st.short ? '<i class="cbm-st-x">' + st.n + ' Qs</i>' : '');
    return '<span class="cbm-stage cbm-stage-' + st.id + '" data-stage="' + st.id + '" title="' + esc(meta[1] + ': ' + st.why) + '">' + esc(name) + (meta[2] ? '<b>' + meta[2] + '</b>' : '') + '</span>' + extra;
  }
  var stageFilter = null;
  function stagesFor(state) {
    var next = addDays(todayISO(), 1), an = analyse(state, todayISO(), 28), keys = nextKeys(state), out = {};
    roster.forEach(function (p) { out[p.id] = stageOf(planFor(state, p.id, next, an, keys), keys); });
    return out;
  }
  /* One column a stage, a name a line: who is on what at a glance. The
     heading of a column is also the filter for the tables underneath. */
  var STAGE_SAYS = { easier: 'Numbers only, or ' + STAGE_AT + ' or more questions a step back', fewer: 'Not finishing: a shorter sheet',
                     'class': 'The class questions', deeper: STAGE_AT + ' or more deeper questions' };
  function stageNote(st) {
    var bits = [];
    if (st.id === 'easier') bits.push(st.num ? 'numbers only' : st.back + ' back');
    if (st.short) bits.push(st.n + ' Qs');
    if (st.id !== 'easier' && st.back) bits.push('↓' + st.back);
    if (st.id !== 'deeper' && st.deep) bits.push('↑' + st.deep);
    return bits.join(' · ');
  }
  function stageCard(stages) {
    var cols = STAGES.map(function (x) {
      var kids = sortedRoster().filter(function (p) { return stages[p.id].id === x[0]; });
      return '<div class="cbm-st-col cbm-st-' + x[0] + (stageFilter === x[0] ? ' is-on' : '') + '">' +
        '<button type="button" class="cbm-st-head" data-stagepick="' + x[0] + '" aria-pressed="' + (stageFilter === x[0]) + '" title="Show only these children in the tables below">' +
          '<span class="cbm-st-title">' + (x[2] ? '<b>' + x[2] + '</b>' : '') + esc(x[1]) + '</span><span class="cbm-st-count">' + kids.length + '</span></button>' +
        '<p class="cbm-st-says">' + esc(STAGE_SAYS[x[0]]) + '</p>' +
        (kids.length ? '<ul>' + kids.map(function (p) {
          var st = stages[p.id], note = stageNote(st);
          return '<li data-stage="' + st.id + '" title="' + esc(st.why) + '"><span>' + esc(p.name) + '</span>' + (note ? '<i>' + esc(note) + '</i>' : '') + '</li>'; }).join('') + '</ul>'
          : '<p class="cbm-st-none">No one</p>') + '</div>';
    }).join('');
    return '<div class="card cbm-stages"><div class="cbm-entryhead"><h3>Who is on what</h3><span class="muted small">their next sheet · only shown here, never on a sheet</span></div>' +
      '<div class="cbm-st-cols">' + cols + '</div>' +
      '<p class="cbm-hint">Beside a name: <b>8 Qs</b> the length of their sheet, <b>↓2</b> questions a step back, <b>↑1</b> deeper questions. Tap a heading to show only those children in the tables below' + (stageFilter ? '; tap it again to show everyone' : '') + '.</p></div>';
  }

  /* Whose next sheet is not simply the class's, and why. */
  function nextKeys(state) { return buildDay(state, addDays(todayISO(), 1)).map(function (q) { return q.k; }); }
  function supportHTML(state, latest, stages) {
    var next = addDays(todayISO(), 1), an = analyse(state, todayISO(), 28), classKeys = nextKeys(state);
    var busy = Object.keys(state.days).filter(function (d) { return d <= todayISO() && daysBetween(d, todayISO()) < 10 && enteredCount(state.days[d]) >= roster.length / 2; });
    var rows = sortedRoster().map(function (p) {
      var recent = sessions(state, p.id, next, 5), plan = planFor(state, p.id, next, an, classKeys);
      var stepped = classKeys.filter(function (c, i) { return classKeys.indexOf(c) === i && plan.lv[c] > 0; });
      var deeper = plan.mode === 'num' ? [] : classKeys.filter(function (c, i) { return classKeys.indexOf(c) === i && plan.lv[c] < 0 && canDeep(c); });
      var missing = busy.filter(function (d) { return !isScored(state.days[d].marks[p.id]); }).length;
      if (!(plan.mode !== 'auto' || stepped.length || deeper.length || plan.n < classKeys.length || missing >= 2)) return '';
      if (stageFilter && stages && stages[p.id].id !== stageFilter) return '';
      var hist = recent.slice().reverse().map(function (x) {
        var t = new Array(x.right + 1).join('✓') + new Array(x.wrong + 1).join('✗') + (x.blank ? '–' : '');
        return '<span class="cbm-sess' + (x.wrong || x.late ? ' hard' : x.right === 2 ? ' good' : '') + '" title="' + esc(shortDate(x.d) + ': ' + x.len + ' questions' + (x.late ? ', your second question left blank' : '')) + '">' + (t || '·') + '</span>';
      }).join('');
      var nextTxt = '<b>' + plan.n + ' questions</b> · ' + (plan.mode === 'num' ? 'numbers only · ' + esc(rungLabel(plan.rung))
        : stepped.length ? stepped.length + ' skill' + (stepped.length > 1 ? 's' : '') + ' a step or more back' : 'the class questions') +
        (deeper.length ? ' · ' + Math.min(deeper.length, deepCap(classKeys.length)) + ' deeper' + (deeper.length > deepCap(classKeys.length) ? ' (from ' + deeper.length + ' skills, a different few each day)' : '') : '');
      var list = stepped.length ? '<ul class="cbm-steplist">' + stepped.map(function (c) {
        return '<li>' + esc(keyLabel(c)) + ' → <b>' + esc(keyLabel(stepBack(c, plan.lv[c]) || c)) + '</b>' + (plan.lv[c] > 1 ? ' <span class="muted">(' + plan.lv[c] + ' steps)</span>' : '') + '</li>'; }).join('') + '</ul>' : '';
      if (deeper.length) list += '<ul class="cbm-steplist cbm-deeplist">' + deeper.map(function (c) { return '<li>' + esc(keyLabel(c)) + ' <b>↑ deeper</b></li>'; }).join('') + '</ul>';
      return '<tr data-spid="' + p.id + '"><td class="name">' + (stages ? stagePill(p.name, stages[p.id]) : esc(p.name)) + '</td><td>' + (hist || '<span class="muted small">no marks</span>') +
        (missing >= 2 ? ' <span class="cbm-flag" title="Days most of the class were marked and this child was not">not marked ' + missing + '×</span>' : '') + '</td>' +
        '<td>' + nextTxt + (plan.why ? '<div class="cbm-why1">' + esc(plan.why) + '</div>' : '') + list + '</td>' +
        '<td class="cbm-supctl"><select data-mode aria-label="Sheet for ' + esc(p.name) + '">' +
          [['auto', 'Automatic'], ['full', 'Always the class questions'], ['num', 'Numbers only']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === plan.mode ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          (plan.mode === 'num' ? '<button type="button" class="secondary small" data-rung="-1" title="Simpler calculations">Easier</button><button type="button" class="secondary small" data-rung="1" title="Harder calculations">Harder</button>' : '') +
          (stepped.length || deeper.length ? '<button type="button" class="secondary small" data-reset title="Put every skill back to the class question">Back to class questions</button>' : '') +
        '</td></tr>';
    }).join('');
    var all = '<details class="cbm-supall"><summary>Change another child\'s setting</summary><div class="cbm-setrow"><select id="cbmSupPid" aria-label="Pupil">' +
      sortedRoster().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select><select id="cbmSupMode" aria-label="Setting">' +
      '<option value="auto">Automatic</option><option value="full">Always the class questions</option><option value="num">Numbers only</option></select>' +
      '<button type="button" class="secondary small" id="cbmSupSet">Set</button></div></details>';
    return '<div class="card cbm-support"><div class="cbm-entryhead"><h3>Stepped back, shorter, deeper, or numbers only</h3></div>' +
      '<p class="cbm-hint">Only your two marks decide this. <b>A wrong answer</b> steps that skill back one small step along the White Rose order — never more than one step between sheets, no more than ' + MAX_DOWN + ' skills at once, and never past ' + MAX_BACK + ' steps — and right answers on the easier step bring it forward again (two running, if they were wrong on the step above), as do ' + RECOVER_SHEETS + ' sheets with no further wrong mark on that skill. Skills you have not marked follow how the child is doing overall. ' +
      '<b>Your second question left blank</b> on two of the last three sheets means not finishing: two fewer questions, put back after two sheets with no blanks. <b>Deeper</b>: a child with ' + DEEP_MARKS + ' or more marks, ' + pct(DEEP_RATE) + ' of them right, gets up to ' + MAX_UP + ' of the class questions as reasoning questions on the same skill (spot the mistake, true or false, work backwards), different ones each day, and keeps them while ' + pct(DEEP_STAY) + ' of their marks are right. A skill whose last mark was wrong stays as the class question. <b>Numbers only</b> is for a child who cannot read the questions yet. Changes here apply to the next sheet you make.</p>' +
      (rows ? '<div class="table-wrap"><table class="cbm-suptable"><thead><tr><th class="name">Pupil</th><th>Last marks</th><th>Next sheet</th><th>Setting</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<p class="muted small">' + (stageFilter ? 'No one at this stage has anything to show here.' : 'Everyone is on the class questions, all ' + classKeys.length + '.') + '</p>') + all + '</div>';
  }
  function wireSupport(body, latest) {
    function setMode(pid, mode) { var s = load(), o = supportOf(s, pid); o.mode = mode; s.support[pid] = o; save(s); renderProgress(); }
    body.querySelectorAll('tr[data-spid]').forEach(function (tr) {
      var pid = tr.dataset.spid, sel = tr.querySelector('[data-mode]');
      sel.onchange = function () { setMode(pid, sel.value); };
      tr.querySelectorAll('[data-rung]').forEach(function (b) {
        b.onclick = function () {
          var s = load(), next = addDays(todayISO(), 1), o = supportOf(s, pid);
          var plan = planFor(s, pid, next, analyse(s, todayISO(), 28), nextKeys(s));
          o.rung = clampRung(plan.rung + +b.dataset.rung); o.lv = LV; o.rungAt = todayISO(); s.support[pid] = o; save(s); renderProgress();
        };
      });
      var rs = tr.querySelector('[data-reset]');
      // lvAt: the marks already in must not step them straight back again
      if (rs) rs.onclick = function () { var s = load(), o = supportOf(s, pid); delete s.lv[pid]; o.lvAt = todayISO(); s.support[pid] = o; save(s); renderProgress(); };
    });
    var set = document.getElementById('cbmSupSet');
    if (set) set.onclick = function () { setMode(document.getElementById('cbmSupPid').value, document.getElementById('cbmSupMode').value); };
  }

  /* ── Set up ───────────────────────────────────────────── */
  function renderSetup() {
    var state = load(), body = document.getElementById('cbmBody'), ht = htOf(state);
    var picker = typeof window.genStepPicker === 'function' ? window.genStepPicker(state.slots, ht, state.yr) : '';
    var nOpts = ''; for (var n = N_MIN; n <= N; n++) nOpts += '<option value="' + n + '"' + (state.n === n ? ' selected' : '') + '>' + n + '</option>';
    body.innerHTML =
      '<div class="card"><div class="cbm-setrow"><div><label for="cbmHT">Half term</label><select id="cbmHT">' +
        '<option value="">Work it out from the date (' + esc(halfTermFor(todayISO())) + ')</option>' +
        HALF_TERMS.map(function (h) { return '<option' + (state.ht === h ? ' selected' : '') + '>' + h + '</option>'; }).join('') +
      '</select></div><div><label for="cbmN">Questions on the sheet</label><select id="cbmN">' + nOpts + '</select></div>' +
      '<div class="grow"></div><button type="button" class="secondary" id="cbmCopy">Copy the questions from Mental Starters</button></div>' +
      '<p class="cbm-hint">Each question stays the same skill every day, with new numbers, so your marks build up skill by skill. Choose the skill on the left; the example on the right is what it looks like on the sheet, and under it the deeper question a child who is secure on it gets instead. Changes apply to sheets made from now on.</p>' +
      '<div class="cbm-picker">' + picker + '</div></div>' +
      '<div class="card"><div class="cbm-setrow"><label class="cbm-xton"><input type="checkbox" id="cbmXt"' + (state.xt.on ? ' checked' : '') + '> ×tables on the back</label>' +
        (state.xt.on
          ? '<div><label for="cbmXtPick">Tables</label><select id="cbmXtPick">' + XT_PICKS.map(function (v) {
              return '<option value="' + v + '"' + (state.xt.pick === v ? ' selected' : '') + '>' + esc(v === 'all' ? '2, 5, 10' : v + '×') + '</option>'; }).join('') + '</select></div>' +
            '<div><label for="cbmXtCount">Questions</label><select id="cbmXtCount">' + XT_COUNTS.map(function (n) {
              return '<option value="' + n + '"' + (state.xt.count === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'
          : '') +
      '</div><p class="cbm-hint">A page of times tables printed after each child\'s sheet, so it goes on the back when you print double-sided. Not marked or scored here. Applies to any sheet you print, including ones already made.</p></div>' +
      '<div class="card"><div class="cbm-setrow"><label class="cbm-xton"><input type="checkbox" id="cbmSm"' + (state.sm ? ' checked' : '') + '> Children mark their own answers</label></div>' +
        '<p class="cbm-hint">Every child has different numbers, so the answers cannot go on the board. With this on, each child\'s own answers print as a strip at the foot of the back of their sheet (under the ×tables, if those are on), to fold under or cut off and hand back when it is time to mark. Nothing the children mark is entered or used: sheets, stepping and who is on what still go by your two marks only.</p></div>' +
      '<details class="card cbm-why"><summary>How it decides, and the research behind it</summary>' +
        '<ul>' +
        '<li><b>The sheet is a CBM probe:</b> short, mixed and frequent (Deno, 1985; Fuchs &amp; Fuchs, 1986).</li>' +
        '<li><b>Two marks a day, a different two each day:</b> matrix sampling (Shoemaker, 1973). After a fortnight every skill has been checked across the class, and every child has a growing record of checked answers — for two taps each.</li>' +
        '<li><b>Filling the gaps:</b> a child\'s chance on a skill not yet checked for them is worked out from how hard the class finds it and how they compare with the class — the idea behind item response theory (Rasch). Each of your marks then moves it. Only your marks count.</li>' +
        '<li><b>Results by skill, with fixed rules:</b> skills analysis helped teachers plan and pupils gain (Fuchs, Fuchs, Hamlett &amp; Stecker, 1990, 1991), and CBM only helps when teaching changes in response (Stecker, Fuchs &amp; Fuchs, 2005). Under ' + pct(RETEACH) + ' → reteach; ' + pct(SECURE) + '+ → secure.</li>' +
        '<li><b>Practice box:</b> what you marked wrong stays for their next ' + KEEP_SHEETS + ' sheets, spaced over separate days (Cepeda et al., 2006), mixed with other skills rather than four of one (Rohrer et al., 2020).</li>' +
        '<li><b>Their own numbers, no self-marking:</b> every child has the same skills with different numbers, so nothing can be copied and your marks show what that child can do. Different numbers for the same skill are how CBM is meant to be repeated (Fuchs &amp; Fuchs, 1986). No score is kept: young children\'s marking of their own work is the least reliable evidence there is (Ross, 2006; Brown &amp; Harris, 2013).</li>' +
        '<li><b>Stepping a skill back:</b> work that is mostly wrong teaches little, and so does work that is far too easy; children learn fastest when they get most, not all, of it right (Gickling &amp; Armstrong, 1978; Burns, 2004; Wilson et al., 2019). So a wrong mark moves that one question back one small step along the White Rose order for its topic, and right marks on the easier step move it forward again: one wrong back, two right forward, which settles where a child gets about 70% right. Any one skill is only marked about once a fortnight, so a skill also comes forward after ' + RECOVER_SHEETS + ' sheets practising the easier step with no further wrong mark, unless the child\'s marks overall say the harder step is still beyond them. A skill you have not marked goes by how the child is doing overall: back when their chance on it is under ' + pct(RETEACH) + ', forward when their chance on the harder step reaches ' + pct(UP_PRIOR) + '; that never overrides a mark of yours. One step at a time, no more than ' + MAX_DOWN + ' skills on one sheet, and only when there are new marks: finding the level by small moves rather than one big one (Levitt, 1971; Hosp, Hosp &amp; Howell, 2016), with the rule fixed in advance rather than decided sheet by sheet (Stecker, Fuchs &amp; Fuchs, 2005).</li>' +
        '<li><b>Going deeper, not further on:</b> a child who is secure on a skill is not moved on to later work; the same step is asked so that it needs reasoning — spot the mistake, true or false, a balance, work backwards, compare without working it all out. That is the mastery approach the scheme itself takes: depth before acceleration (NCETM, 2014; DfE, 2020), with reasoning and problem solving as the stretch. It goes by the child\'s own marks: ' + DEEP_MARKS + ' or more, ' + pct(DEEP_RATE) + ' of them right, and it lasts while ' + pct(DEEP_STAY) + ' are; a skill whose last mark was wrong stays as the class question. No more than ' + MAX_UP + ' on a sheet, because they take longer to read. The questions are written for this app; they follow the kinds of question White Rose use and copy none of them.</li>' +
        '<li><b>Not finishing is a different problem:</b> a child who gets them right but runs out of time needs fewer questions, not easier ones (Haring &amp; Eaton, 1978; Daly et al., 1997). Your second question left blank on two of the last three sheets takes two questions away; two sheets with no blanks puts them back.</li>' +
        '<li><b>The board:</b> a model version of each question, the ones the class gets wrong first, for you to work through — worked examples are how a method is best shown (Sweller &amp; Cooper, 1985; Rosenshine, 2012).</li>' +
        '<li><b>Numbers only</b> (a setting on Progress, for a child who cannot read the questions yet): numbers and symbols only, because a child who cannot read the question cannot show the maths they know (Fuchs, Fuchs &amp; Prentice, 2004). Fluent number facts come first (EEF, 2017; DfE ready-to-progress criteria, 2020), in the order children learn them: counting, add or take 1, facts within 5, within 10, bonds to 10, doubles, teen numbers, add or take 10, then across 10 (Baroody, 2006). About a third of the sheet is the step they are learning; the rest is the steps just below it, half as missing numbers (? + 3 = 7) — mostly known with a few new (Burns, 2004; Codding, Burns &amp; Lukito, 2011), starting with ones they know (Skinner, 2002).</li>' +
        '<li><b>Your two questions:</b> one from each half of the sheet, so a blank on the second shows who is not getting that far; within each half, skills the class gets wrong, never the same slot twice in a week.</li>' +
        '</ul></details>';
    /* The picker is Mental Starters' (js/generator.js), shown here as a list:
       only the questions this sheet has, each with an example beside it. The
       example's numbers are fixed, so it changes only when its skill does. */
    var list = body.querySelector('.cbm-picker .gen-slots');
    if (list) {
      var set = 0;
      Array.prototype.forEach.call(list.querySelectorAll('.gen-slot'), function (row, i) {
        if (i >= state.n) { row.parentNode.removeChild(row); return; }
        var k = slotKey(state, i, ht), q = buildKey(k, 'cbm:eg:' + i), eg = document.createElement('div');
        if (k.indexOf('pre:') !== 0) set++;
        eg.className = 'cbm-eg';
        var dq = canDeep(k) ? buildKey('dp:' + k, 'cbm:eg:' + i) : null;
        eg.innerHTML = '<div class="cbm-egrow"><span class="cbm-egq">' + GRQ(q) + '</span><span class="cbm-ega">' + esc(ans(q, todayISO())) + '</span></div>' +
          (dq ? '<div class="cbm-egrow cbm-egdeep" title="What a child who is secure on this gets instead"><span class="cbm-egdq"><b>Deeper</b> ' + GRQ(dq) + '</span><span class="cbm-ega">' + esc(ans(dq, todayISO())) + '</span></div>' : '');
        row.appendChild(eg);
      });
      list.insertAdjacentHTML('beforebegin', '<div class="cbm-eghead"><span>Skill</span><span>Example, with its answer</span></div>');
      var cnt = body.querySelector('.cbm-picker .ms-count'); if (cnt) cnt.textContent = set + ' of ' + state.n + ' set';
      var hint = body.querySelector('.cbm-picker .ms-hint');
      if (hint) hint.innerHTML = 'White Rose small steps. A question left alone uses the <b>' + esc(setName(ht)) + '</b> question for that position.';
    }
    document.getElementById('cbmN').onchange = function (e) { var s = load(); s.n = normN(e.target.value); save(s); renderSetup(); };
    document.getElementById('cbmHT').onchange = function (e) { var s = load(); s.ht = e.target.value || null; save(s); renderSetup(); };
    document.getElementById('cbmCopy').onclick = function () {
      var cfg = Store.get('tp_starter_cfg', null) || {};
      var s = load(); s.slots = normSlots(cfg.slots); s.yr = cfg.wrYear >= 1 && cfg.wrYear <= 6 ? cfg.wrYear : null;   // null: follow the class, as the starter does
      s.xt = normXt({ on: cfg.xtb !== false, pick: cfg.xtPick, count: cfg.xtCount });   // its back page too (on unless turned off, as there)
      save(s); renderSetup();
    };
    body.querySelectorAll('[data-slot]').forEach(function (sel) {
      sel.onchange = function () { var s = load(); s.slots[+sel.dataset.slot] = sel.value || null; save(s); renderSetup(); };
    });
    var clr = body.querySelector('[data-gen-clear]');
    if (clr) clr.onclick = function () { var s = load(); s.slots = normSlots([]); save(s); renderSetup(); };
    var yr = body.querySelector('[data-gen-year]');
    if (yr) yr.onchange = function () { var s = load(); s.yr = +yr.value; save(s); renderSetup(); };
    document.getElementById('cbmSm').onchange = function (e) { var s = load(); s.sm = e.target.checked; save(s); renderSetup(); };
    document.getElementById('cbmXt').onchange = function (e) { var s = load(); s.xt.on = e.target.checked; save(s); renderSetup(); };
    var xp = document.getElementById('cbmXtPick'); if (xp) xp.onchange = function () { var s = load(); s.xt.pick = xp.value; save(s); renderSetup(); };
    var xc = document.getElementById('cbmXtCount'); if (xc) xc.onchange = function () { var s = load(); s.xt.count = +xc.value; save(s); renderSetup(); };
  }

  window.addEventListener('tp:sync', function () { var h = host(); if (h && h.classList.contains('active')) render(); });

  window.cbmRender = render;
  /* pure parts, for tests */
  window.CBM = {
    parseEntry: parseEntry, buildDay: buildDay, makeDay: makeDay, pickAudit: pickAudit,
    results: results, sessions: sessions, analyse: analyse, estimate: estimate, openState: openState,
    chooseTargets: chooseTargets, planFor: planFor, planSheets: planSheets, sheetPlan: sheetPlan, sheetQs: sheetQs,
    stepBack: stepBack, backPath: backPath, stageOf: stageOf, canDeep: canDeep, focusSlots: focusSlots, isScored: isScored,
    keyLabel: keyLabel, tablesFor: tablesFor, halfTermFor: halfTermFor, load: load, save: save, buildKey: buildKey, FD: FD, LADDER: LADDER, rungOf: rungOf, fdQ: fdQ
  };
})();
