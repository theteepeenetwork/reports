/* ============================================================
   generator.js — Mental Starter question builders
   All identifiers prefixed "gen". No external libraries.

   This was a page of its own (#generator, genRender, the store
   'tp_generator') whose output never reached a week — it printed
   worksheets nobody's Mental Starters week ever saw. The Sep 2026
   redesign made it the DESIGN step of Mental Starters instead, so
   what is left here is the part that was always the point: builders
   that turn choices into question descriptors, and the step picker's
   markup. hub.js owns the screen and the config now.

   Design: genBuild() produces an array of plain question
   DESCRIPTORS (params only, persisted). Deterministic
   renderers turn descriptors into HTML/SVG, so a worksheet
   survives reload and reprints identically.

   QUESTION SETS
   Each half-term maps to a named question set (GEN_SET_FOR).
   A set is a recipe function returning 20 descriptors, listed
   in GEN_SETS. Two exist today:

     'Autumn 1' — start of Year 2. Numbers to 100, tens and
                  ones, counting on in 1s and back in 2s,
                  bonds to 100, 2/5/10 tables and division.
                  No clocks. From Mark's September sheet.
     'Spring 2' — the original recipe: clocks, halving,
                  shapes, three-number addition. Everything
                  taught by the back half of the year.

   Half-terms with no entry in GEN_SET_FOR fall back to
   'Spring 2', so adding 'Autumn 2' later means writing one
   recipe and adding one line to each map — nothing else.

   ADDING A QUESTION TYPE: push a descriptor {t:'yourtype',...}
   from a recipe and add a matching renderer to GEN_RENDERERS.
   Descriptors are persisted, so never repurpose a field name
   on an existing type — old saved worksheets still carry it.
   ============================================================ */

(function () {

  /* ── Random helpers ─────────────────────────────────────── */
  function genRand(a, b){ return Math.floor(Math.random() * (b - a + 1)) + a; }
  function genPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  /* ── Clock difficulty per half-term (allowed minutes) ───── */
  var GEN_CLOCK = {
    'Autumn 1': [0],
    'Autumn 2': [0, 30],
    'Spring 1': [0, 30],
    'Spring 2': [0, 15, 30, 45],
    'Summer 1': [0, 5, 10, 15, 20, 25, 30, 45],
    'Summer 2': [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  };
  function genClockMinutes(halfTerm){ return GEN_CLOCK[halfTerm] || GEN_CLOCK['Spring 2']; }

  var GEN_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  /* ── Question sets ──────────────────────────────────────── */
  // Which named set each half-term uses. Anything absent -> GEN_SET_DEFAULT.
  var GEN_SET_DEFAULT = 'Spring 2';
  var GEN_SET_FOR = {
    'Autumn 1': 'Autumn 1'
  };
  function genSetName(halfTerm){ return GEN_SET_FOR[halfTerm] || GEN_SET_DEFAULT; }
  // Sets that draw analogue clocks — the clock-difficulty control only
  // means anything for these, so the UI hides the hint for the others.
  var GEN_SET_USES_CLOCKS = { 'Spring 2': true };
  function genUsesClocks(halfTerm){ return !!GEN_SET_USES_CLOCKS[genSetName(halfTerm)]; }


  /* State lives in tp_starter_cfg now (hub.js): mode, slots, qCount,
     xtb/xtPick/xtCount. There is no generator store — a set of questions
     is only ever saved as part of a week in tp_starter_weeks. */

  /* ── Build: produce question descriptors ────────────────── */
  // a +/- b with a no-negative guard. Returns {op, a, b}.
  function genSigned(a, b){
    var op = genPick(['+', '-']);
    if (op === '-' && b > a){ var t = a; a = b; b = t; } // keep result >= 0
    return { op: op, a: a, b: b };
  }

  /* Add or take away within 100, with both halves worth doing:
     never a zero operand, never a negative or zero answer, and a
     subtraction can take away as much as the first number allows. */
  function genWithin100(){
    if (genPick(['+', '-']) === '+'){
      var a = genRand(1, 89);
      return { t: 'arith', a: a, b: genRand(2, 100 - a), op: '+' };
    }
    var x = genRand(12, 100);
    return { t: 'arith', a: x, b: genRand(2, x - 1), op: '-' };
  }

  /* ── Set: 'Spring 2' ─────────────────────────────────────
     The original recipe, unchanged. Reflects what has been
     taught by the back half of Year 2: clocks, halving,
     2-D shape properties, three-number addition. */
  function genSetSpring2(halfTerm){
    var clk = genClockMinutes(halfTerm);
    var shapes = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'];
    var a, b, c, n, s;
    var q = [];

    // 1
    a = genRand(5, 10); q.push({ t: 'arith', a: a, b: genRand(0, a), op: '+' });
    // 2
    a = genRand(5, 10); q.push({ t: 'arith', a: a, b: genRand(0, a), op: '-' });
    // 3
    a = genRand(10, 20); q.push({ t: 'arith', a: a, b: genRand(1, a), op: '-' });
    // 4
    a = genRand(10, 20); q.push({ t: 'arith', a: a, b: genRand(0, a), op: '+' });
    // 5 — three clocks
    q.push({ t: 'clock', items: [
      { h: genRand(1, 12), m: genPick(clk) },
      { h: genRand(1, 12), m: genPick(clk) },
      { h: genRand(1, 12), m: genPick(clk) }
    ] });
    // 6
    a = genRand(10, 50); q.push({ t: 'arith', a: a, b: genRand(0, a), op: '-' });
    // 7 — a +/- (multiple of 10); regenerate if a===0
    do { a = 50 - genRand(0, 50); } while (a === 0);
    var m = genRand(0, Math.floor(a / 10)) * 10;
    var op7 = genPick(['+', '-']);
    if (op7 === '-' && m > a) op7 = '+';
    q.push({ t: 'arith', a: a, b: m, op: op7 });
    // 8 — a + b + c
    q.push({ t: 'arith3', a: genRand(1, 9), b: genRand(0, 9), c: genRand(0, 9) });
    // 9
    a = genRand(20, 50); s = genSigned(a, genRand(0, a)); q.push({ t: 'arith', a: s.a, b: s.b, op: s.op });
    // 10, 11 — 2n / 2
    q.push({ t: 'half', n: genRand(1, 15) });
    q.push({ t: 'half', n: genRand(1, 15) });
    // 12 — place value
    q.push({ t: 'placeval', tens: genRand(1, 9), ones: genRand(1, 9) });
    // 13 — missing number
    a = genRand(10, 50); b = genRand(9, a);
    q.push({ t: 'missing', a: a, b: b, sum: a + b, blank: genPick(['a', 'b']) });
    // 14 — write in words
    q.push({ t: 'words', n: genRand(20, 100) });
    // 15 — shape
    q.push({ t: 'shape', shape: genPick(shapes), ask: genPick(['vertices', 'sides']) });
    // 16 — calendar
    q.push({ t: 'future', unit: genPick(['day', 'month']), n: genRand(1, 12) });
    // 17 — comparison
    a = genRand(10, 50); s = genSigned(a, genRand(1, a));
    q.push({ t: 'compare', a: s.a, b: s.b, aop: s.op, c: genRand(10, 50), d: genRand(1, 50) });
    // 18
    a = genRand(20, 100); s = genSigned(a, genRand(10, a)); q.push({ t: 'arith', a: s.a, b: s.b, op: s.op });
    // 19
    a = genRand(50, 100); s = genSigned(a, genRand(10, a)); q.push({ t: 'arith', a: s.a, b: s.b, op: s.op });
    // 20
    a = genRand(50, 100); s = genSigned(a, genRand(10, a)); q.push({ t: 'arith', a: s.a, b: s.b, op: s.op });

    return q;
  }

  /* ── Set: 'Autumn 1' ─────────────────────────────────────
     From Mark's "Mental starter Autumn September" sheet,
     reordered to his layout of 2 Sep 2026.

     Questions 1-10 are arithmetic only -- eight calculations
     and two sequences -- and stay under fifty: every number a
     child reads or writes there, and every answer, is 49 or
     less. That half is meant to be done unaided.

     Questions 11-20 carry everything that is not a
     calculation, then finish on three within 100. Slots 11-17
     are fixed by name (blocks, partition, words, times table,
     tens/ones, days, comparison), so changing one means
     changing the shape assertion in the test too.

     Guarded by tests/06-generator.spec.js. */
  function genSetAutumn1(){
    var TABLES = [2, 5, 10];        // the tables taught in Year 2
    var STEPS  = [2, 3, 4, 5];      // "two/three/four/five more than"
    var a, b, m;
    var q = [];

    /* ── 1-10: arithmetic only, everything under fifty ───── */

    // 1 — subtraction within 20
    a = genRand(10, 20); q.push({ t: 'arith', a: a, b: genRand(1, a - 1), op: '-' });
    // 2 — count on in ones, third term blank:  n, n+1, ___, n+3
    q.push({ t: 'seq', start: genRand(1, 20), step: 1, len: 4, blank: 2 });
    // 3 — addition, teens plus up to 20
    q.push({ t: 'arith', a: genRand(10, 20), b: genRand(1, 20), op: '+' });
    // 4 — subtraction within 50
    a = genRand(20, 49); q.push({ t: 'arith', a: a, b: genRand(1, a - 1), op: '-' });
    // 5 — two/three/four/five more than
    q.push({ t: 'step', n: genRand(10, 44), by: genPick(STEPS), dir: 'more' });
    // 6 — count back in twos, third term blank:  n, n-2, ___, n-6
    q.push({ t: 'seq', start: genRand(20, 49), step: -2, len: 4, blank: 2 });
    // 7 — add a multiple of ten. Picking the ten FIRST keeps it a real
    //     question: choosing the start first leaves no room above 39
    //     and forces "+ 0".
    m = genRand(1, 4) * 10;
    b = genRand(1, 49 - m);
    q.push({ t: 'arith', a: b, b: m, op: '+' });
    // 8 — subtract ten. From 11, not 10, or the sheet asks "10 - 10".
    q.push({ t: 'arith', a: genRand(11, 49), b: 10, op: '-' });
    // 9 — two/three/four/five less than. Floor at STEPS' largest so the
    //     answer cannot go below zero whichever step is drawn.
    q.push({ t: 'step', n: genRand(10, 49), by: genPick(STEPS), dir: 'less' });
    // 10 — addition within 50
    a = genRand(1, 44); q.push({ t: 'arith', a: a, b: genRand(1, 49 - a), op: '+' });

    /* ── 11-20: everything that is not a calculation, then
          three within 100 ────────────────────────────────── */

    // 11 — what number is this (base-10 blocks, up to 99)
    q.push({ t: 'placeval', tens: genRand(1, 9), ones: genRand(1, 9) });
    // 12 — partition a two-digit number into tens and ones. Both digits
    //      non-zero, or the sheet asks a child to partition 80 into 80 + 0.
    q.push({ t: 'partition', n: genRand(1, 9) * 10 + genRand(1, 9) });
    // 13 — write a number in words. Kept small: Mark moved this
    //      question, he did not ask for a wider range.
    q.push({ t: 'words', n: genRand(0, 30) });
    // 14 — multiplication
    q.push({ t: 'times', base: genPick(TABLES), by: genRand(1, 12) });
    // 15 — how many tens / ones, up to 100. Built from two non-zero
    //      digits: drawing 10-99 at random allows 20, and "how many
    //      ones in 20?" is not a question.
    q.push({ t: 'tensones', n: genRand(1, 9) * 10 + genRand(1, 9),
             part: genPick(['tens', 'ones']) });
    // 16 — what day is it in x days, up to a week
    q.push({ t: 'future', unit: 'day', n: genRand(1, 7) });
    // 17 — more than, less than or equal to: two products
    q.push({ t: 'compare',
             a: genRand(1, 12), aop: '×', b: genPick(TABLES),
             c: genRand(1, 12), bop: '×', d: genPick(TABLES) });
    // 18, 19, 20 — add or take away within 100.
    //      The operation is chosen first on purpose. Drawing the first
    //      number and then capping the second at what is left below 100
    //      starves subtraction: 88 could only ever take away 12 or less,
    //      so the sheet kept ending on "88 - 1".
    q.push(genWithin100());
    q.push(genWithin100());
    q.push(genWithin100());

    return q;
  }

  /* ── The registry the rest of the file talks to ──────────── */
  var GEN_SETS = {
    'Autumn 1': genSetAutumn1,
    'Spring 2': genSetSpring2
  };
  function genBuildWorksheet(halfTerm){
    var fn = GEN_SETS[genSetName(halfTerm)] || GEN_SETS[GEN_SET_DEFAULT];
    return fn(halfTerm);
  }

  // which times-table bases a "pick" maps to
  function genBasesFor(pick){
    if (pick === '2') return [2];
    if (pick === '5') return [5];
    if (pick === '10') return [10];
    return [2, 5, 10];
  }
  function genTablesLabel(pick){
    if (pick === '2') return '2×';
    if (pick === '5') return '5×';
    if (pick === '10') return '10×';
    return '2, 5 & 10×';
  }
  function genBuildTables(count, bases){
    bases = (bases && bases.length) ? bases : [2, 5, 10];
    var q = [];
    for (var i = 0; i < count; i++) q.push({ t: 'times', base: genPick(bases), by: genRand(1, 10) });
    return q;
  }

  var GEN_SLOTS = 20;

  function genEmptySlots(){
    var a = [], i;
    for (i = 0; i < GEN_SLOTS; i++) a.push(null);
    return a;
  }
  /* Accept anything and return exactly GEN_SLOTS entries, each either a step
     id that still exists or null. A step removed from the scheme, or a slot
     saved when the sheet was a different length, becomes null rather than an
     empty box on a printed sheet. */
  function genNormaliseSlots(raw){
    var out = genEmptySlots(), i, id;
    if (!Array.isArray(raw)) return out;
    for (i = 0; i < GEN_SLOTS; i++){
      id = raw[i];
      out[i] = (typeof id === 'string' && window.wrStep && window.wrStep(id)) ? id : null;
    }
    return out;
  }

  /* Steps mode: each slot is a chosen White Rose step, and any slot left unset
     -- or set to a step with no written form -- falls back to what the
     half-term preset would have put there. So switching to steps mode shows a
     familiar sheet, and every override is visible against it. */
  function genBuildSteps(halfTerm, slots){
    var base = genBuildWorksheet(halfTerm);
    var out = [], i, made;
    slots = genNormaliseSlots(slots);
    for (i = 0; i < GEN_SLOTS; i++){
      made = slots[i] && window.wrBuild ? window.wrBuild(slots[i]) : null;
      out.push(made || base[i] || { t: 'prompt', s: '' });
    }
    return out;
  }

  function genBuild(halfTerm, mode, count, slots){
    if (mode === 'tables') return genBuildTables(count);
    if (mode === 'steps')  return genBuildSteps(halfTerm, slots);
    return genBuildWorksheet(halfTerm);
  }

  // Build one or five days. Each day = { label, questions, [back] }.
  // opts (worksheet mode only): { backTables, backPick, backCount } adds a
  // times-tables page on the back so it prints back-to-back with the starter.
  function genBuildDays(halfTerm, mode, count, week, opts){
    var labels = week ? GEN_WEEKDAYS : [''];
    var slots = opts && opts.slots;
    return labels.map(function (label){
      var day = { label: label, questions: genBuild(halfTerm, mode, count, slots) };
      // The back page of times tables belongs to any 20-question starter,
      // whether the questions came from a preset or from chosen steps.
      if (mode !== 'tables' && opts && opts.backTables){
        day.back = genBuildTables(opts.backCount, genBasesFor(opts.backPick));
      }
      return day;
    });
  }

  /* ── SVG: analogue clock ────────────────────────────────── */
  function genHourAngle(h, m){ return ((h % 12) + m / 60) * 30; }
  function genMinuteAngle(m){ return m * 6; }
  function genHand(deg, len, cx, cy){
    var r = (deg - 90) * Math.PI / 180;
    return { x: cx + len * Math.cos(r), y: cy + len * Math.sin(r) };
  }
  function genClockSVG(item){
    var cx = 50, cy = 50, R = 45;
    var ticks = '', nums = '';
    for (var i = 0; i < 12; i++){
      var d = i * 30, p1 = genHand(d, R, cx, cy), p2 = genHand(d, R - (i % 3 === 0 ? 7 : 4), cx, cy);
      ticks += '<line x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '" stroke="#374151" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }
    for (var n = 1; n <= 12; n++){
      var a = n * 30 * Math.PI / 180;
      var nx = cx + 34 * Math.sin(a), ny = cy - 34 * Math.cos(a);
      nums += '<text x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#111827">' + n + '</text>';
    }
    var hh = genHand(genHourAngle(item.h, item.m), 22, cx, cy);
    var mm = genHand(genMinuteAngle(item.m), 33, cx, cy);
    return '<svg class="gen-clock" viewBox="0 0 100 100" role="img" aria-label="clock">' +
      '<circle cx="50" cy="50" r="' + R + '" fill="#fff" stroke="#111827" stroke-width="2.5"/>' +
      ticks + nums +
      '<line x1="50" y1="50" x2="' + hh.x.toFixed(1) + '" y2="' + hh.y.toFixed(1) + '" stroke="#111827" stroke-width="3.5" stroke-linecap="round"/>' +
      '<line x1="50" y1="50" x2="' + mm.x.toFixed(1) + '" y2="' + mm.y.toFixed(1) + '" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="50" cy="50" r="2.5" fill="#111827"/>' +
      '</svg>';
  }

  /* ── SVG: base-10 / Dienes place-value blocks ───────────── */
  function genBlocksSVG(tens, ones){
    var rodW = 12, rodH = 64, gap = 4, pad = 6;
    var perRow = 3, unit = 14, ugap = 3;
    var tensW = tens * (rodW + gap);
    var oneCols = Math.min(ones, perRow);
    var onesW = oneCols * (unit + ugap) + 10;
    var W = pad * 2 + tensW + onesW, H = pad * 2 + rodH;
    var s = '<svg class="gen-blocks" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="base ten blocks">';
    var x = pad, i, y;
    // ten-rods
    for (i = 0; i < tens; i++){
      s += '<rect x="' + x + '" y="' + pad + '" width="' + rodW + '" height="' + rodH + '" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.2"/>';
      for (var j = 1; j < 10; j++){
        y = pad + j * (rodH / 10);
        s += '<line x1="' + x + '" y1="' + y.toFixed(1) + '" x2="' + (x + rodW) + '" y2="' + y.toFixed(1) + '" stroke="#1d4ed8" stroke-width="0.6"/>';
      }
      x += rodW + gap;
    }
    // ones units (bottom-aligned grid)
    var ox = pad + tensW + 10;
    for (i = 0; i < ones; i++){
      var col = i % perRow, row = Math.floor(i / perRow);
      var ux = ox + col * (unit + ugap);
      var uy = pad + rodH - unit - row * (unit + ugap);
      s += '<rect x="' + ux + '" y="' + uy.toFixed(1) + '" width="' + unit + '" height="' + unit + '" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="1.2"/>';
    }
    return s + '</svg>';
  }

  /* ── Deterministic renderers (descriptor -> HTML) ───────── */
  var GEN_RENDERERS = {
    arith: function (q){ return esc(q.a + ' ' + q.op + ' ' + q.b + ' ='); },
    arith3: function (q){ return esc(q.a + ' + ' + q.b + ' + ' + q.c + ' ='); },
    half: function (q){ return esc((q.n * 2) + ' ÷ 2 ='); },
    times: function (q){ return esc(q.base + ' × ' + q.by + ' ='); },
    clock: function (q){
      return '<div class="gen-clocks">' + q.items.map(function (it, i){
        return '<div class="gen-clock-wrap"><div class="gen-clock-label">' + 'ABC'.charAt(i) + '</div>' + genClockSVG(it) + '</div>';
      }).join('') + '</div><div class="gen-qtext">What time is on the clock' +
        (q.items.length === 1 ? '' : 's') + '?</div>';
    },
    placeval: function (q){
      return '<div class="gen-qtext">What number is this?</div>' + genBlocksSVG(q.tens, q.ones);
    },
    missing: function (q){
      var box = '<span class="gen-blank">?</span>';
      return q.blank === 'a'
        ? box + ' + ' + esc(q.b) + ' = ' + esc(q.sum)
        : esc(q.a) + ' + ' + box + ' = ' + esc(q.sum);
    },
    words: function (q){ return 'Write <b>' + esc(q.n) + '</b> in words.'; },
    shape: function (q){ return 'How many ' + esc(q.ask) + ' does a ' + esc(q.shape) + ' have?'; },
    future: function (q){
      var u = q.n === 1 ? q.unit : q.unit + 's';
      return 'What ' + esc(q.unit) + ' is it in ' + esc(q.n) + ' ' + esc(u) + '?';
    },
    compare: function (q){
      // bop is newer than this type; worksheets saved before it existed
      // have no bop and were always '+', so that is the fallback.
      var bop = q.bop || '+';
      return '&lt;, &gt; or =?<br>' + esc(q.a + ' ' + q.aop + ' ' + q.b) + ' &nbsp;<span class="gen-blank">?</span>&nbsp; ' + esc(q.c + ' ' + bop + ' ' + q.d);
    },
    divide: function (q){ return esc((q.base * q.by) + ' ÷ ' + q.base + ' ='); },
    // n, n+step, ___, n+3step  — one term replaced by a blank
    seq: function (q){
      var len = q.len || 4, out = [], i;
      for (i = 0; i < len; i++){
        out.push(i === q.blank ? '<span class="gen-blank">?</span>' : esc(q.start + q.step * i));
      }
      return out.join(', ');
    },
    tensones: function (q){ return 'How many ' + esc(q.part) + ' in ' + esc(q.n) + '?'; },
    /* A question composed as a string when it was generated. Deliberately NOT
       escaped: the markup is ours (from js/wrsteps.js), never a teacher's or a
       child's input, and it carries <b> and the blank span. Nothing typed by a
       user ever reaches this type -- if that ever changes, escape it here. */
    prompt: function (q){ return String(q.s == null ? '' : q.s); },
    partition: function (q){
      var box = '<span class="gen-blank">?</span>';
      return 'Partition:<br>' + esc(q.n) + ' = ' + box + ' + ' + box;
    },
    step: function (q){
      var words = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };
      return esc(words[q.by] || q.by) + ' ' + (q.dir === 'less' ? 'less' : 'more') + ' than ' + esc(q.n) + '?';
    }
  };
  function genRenderQuestion(q){
    var fn = GEN_RENDERERS[q.t];
    return fn ? fn(q) : esc(JSON.stringify(q));
  }

  /* ── Step picker ────────────────────────────────────────── */
  /* A closed <select> shows only the chosen option's own text, never its
     optgroup, so the block has to be inside the label or a set slot reads
     "2. Quarter past and quarter to" with no clue which block that is. */
  function genBlockCode(b){ return b.term.slice(0, 3) + b.n; }

  function genStepOptions(chosen, setName){
    var out = ['<option value="">— use the ' + esc(setName) + ' question —</option>'];
    (window.WR_BLOCKS || []).forEach(function (b){
      var steps = (window.WR_STEPS || []).filter(function (st){ return st.block === b.id; });
      if (!steps.length) return;
      out.push('<optgroup label="' + esc(b.term + ' ' + b.n + ' · ' + b.title) + '">');
      steps.forEach(function (st){
        var usable = typeof st.gen === 'function';
        out.push('<option value="' + esc(st.id) + '"' +
          (st.id === chosen ? ' selected' : '') +
          (usable ? '' : ' disabled') + '>' +
          esc(genBlockCode(b) + ' · ' + st.n + '. ' + st.title + (usable ? '' : '  (needs apparatus)')) + '</option>');
      });
      out.push('</optgroup>');
    });
    return out.join('');
  }

  /* The step picker, re-hosted. It used to sit on the generator page and call
     genSetSlot/genClearSlots directly; it is now rendered inside Mental
     Starters' design step, so it emits hooks (data-slot, data-gen-clear) and
     the screen that shows it does the wiring. Markup only — no state. */
  function genStepPicker(slots, halfTerm){
    var setName = genSetName(halfTerm);
    slots = genNormaliseSlots(slots);
    var rows = [], i;
    for (i = 0; i < GEN_SLOTS; i++){
      rows.push('<div class="gen-slot"><span class="gen-slot-n">' + (i + 1) + ')</span>' +
        '<select class="gen-slot-pick" data-slot="' + i + '">' + genStepOptions(slots[i], setName) + '</select>' +
      '</div>');
    }
    var chosen = slots.filter(Boolean).length;
    return '<div class="ms-steps">' +
      '<div class="ms-steps-head"><b>Question by question</b><span class="grow"></span>' +
        '<span class="ms-count">' + chosen + ' of ' + GEN_SLOTS + ' set</span>' +
        '<button type="button" class="ms-link" data-gen-clear>Clear all</button></div>' +
      '<div class="gen-slots">' + rows.join('') + '</div>' +
      '<p class="ms-hint">White Rose Year 2 small steps. Any slot left alone uses the <b>' +
        esc(setName) + '</b> question for that position. Choices are kept for the next week you design.</p>' +
    '</div>';
  }

  /* expose the builders + testable helpers. No render: the screen is
     Mental Starters' design step, in js/hub.js. */
  window.genBuild = genBuild;
  window.genBuildDays = genBuildDays;
  window.genBuildTables = genBuildTables;
  window.genBasesFor = genBasesFor;
  window.genTablesLabel = genTablesLabel;
  window.genStepPicker = genStepPicker;
  window.genRenderQuestion = genRenderQuestion;
  window.genHourAngle = genHourAngle;
  window.genMinuteAngle = genMinuteAngle;
  window.genClockMinutes = genClockMinutes;
  window.genSetName = genSetName;
  window.genBuildSteps = genBuildSteps;
  window.genNormaliseSlots = genNormaliseSlots;
  window.GEN_SLOTS = GEN_SLOTS;
  window.genUsesClocks = genUsesClocks;

})();
