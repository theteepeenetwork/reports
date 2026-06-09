/* ============================================================
   generator.js — Mental Starter Question Generator
   Global render: genRender()  ·  Store key: 'tp_generator'
   All identifiers prefixed "gen". No external libraries.

   Design: genBuild() produces an array of plain question
   DESCRIPTORS (params only, persisted). Deterministic
   renderers turn descriptors into HTML/SVG, so a worksheet
   survives reload and reprints identically.
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

  /* ── State ──────────────────────────────────────────────── */
  function genDefaultState(){
    return { v: 3, halfTerm: 'Spring 2', mode: 'worksheet', count: 50, week: false,
             backTables: false, backPick: 'all', backCount: 20, generatedISO: '', days: [] };
  }
  function genLoad(){
    var s = Store.get('tp_generator', null);
    if (!s || typeof s !== 'object') s = genDefaultState();
    if (!GEN_CLOCK[s.halfTerm]) s.halfTerm = 'Spring 2';
    if (s.mode !== 'tables') s.mode = 'worksheet';
    if (!(s.count > 0)) s.count = 50;
    s.week = !!s.week;
    // times-tables-on-the-back of the mental starter (worksheet mode)
    s.backTables = !!s.backTables;
    if (['2', '5', '10', 'all'].indexOf(s.backPick) < 0) s.backPick = 'all';
    if (!(s.backCount > 0)) s.backCount = 20;
    // migrate v1 (single { questions: [] }) -> v2 ({ days: [{label, questions}] })
    if (!Array.isArray(s.days)) s.days = Array.isArray(s.questions) && s.questions.length ? [{ label: '', questions: s.questions }] : [];
    delete s.questions;
    return s;
  }
  function genSave(s){ Store.set('tp_generator', s); }

  /* ── Build: produce question descriptors ────────────────── */
  // a +/- b with a no-negative guard. Returns {op, a, b}.
  function genSigned(a, b){
    var op = genPick(['+', '-']);
    if (op === '-' && b > a){ var t = a; a = b; b = t; } // keep result >= 0
    return { op: op, a: a, b: b };
  }

  function genBuildWorksheet(halfTerm){
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

  function genBuild(halfTerm, mode, count){
    return mode === 'tables' ? genBuildTables(count) : genBuildWorksheet(halfTerm);
  }

  // Build one or five days. Each day = { label, questions, [back] }.
  // opts (worksheet mode only): { backTables, backPick, backCount } adds a
  // times-tables page on the back so it prints back-to-back with the starter.
  function genBuildDays(halfTerm, mode, count, week, opts){
    var labels = week ? GEN_WEEKDAYS : [''];
    return labels.map(function (label){
      var day = { label: label, questions: genBuild(halfTerm, mode, count) };
      if (mode === 'worksheet' && opts && opts.backTables){
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
      }).join('') + '</div><div class="gen-qtext">What time is on the clocks?</div>';
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
      return '&lt;, &gt; or =?<br>' + esc(q.a + ' ' + q.aop + ' ' + q.b) + ' &nbsp;<span class="gen-blank">?</span>&nbsp; ' + esc(q.c + ' + ' + q.d);
    }
  };
  function genRenderQuestion(q){
    var fn = GEN_RENDERERS[q.t];
    return fn ? fn(q) : esc(JSON.stringify(q));
  }

  /* ── Main render ────────────────────────────────────────── */
  // one printable A4 page (front or back). Each .gen-day breaks to a new page.
  function genSheetHTML(label, title, questions, isTables, generatedISO){
    var heading = (label ? '<span class="gen-day-name">' + esc(label) + '</span> · ' : '') + title +
                  (generatedISO ? ' &middot; ' + esc(generatedISO) : '');
    var cells = questions.map(function (q, i){
      return '<div class="gen-q"><span class="gen-num">' + (i + 1) + ')</span><div class="gen-body">' + genRenderQuestion(q) + '</div></div>';
    }).join('');
    return '<div class="card gen-sheet gen-day">' +
      '<h2 class="gen-heading">' + heading + '</h2>' +
      '<div class="gen-grid' + (isTables ? ' gen-grid-tables' : '') + '">' + cells + '</div>' +
    '</div>';
  }

  function genRender(){
    var root = document.getElementById('gen-root');
    if (!root) return;
    var s = genLoad();
    genSave(s); // persist any normalisation / migration

    var htOpts = HALF_TERMS.map(function (h){ return opt(h, h, s.halfTerm); }).join('');
    var controls =
      '<div class="card no-print">' +
        '<div class="tabs">' +
          '<button class="tab' + (s.mode === 'worksheet' ? ' active' : '') + '" onclick="genSetMode(\'worksheet\')">📝 Worksheet (20 Qs)</button>' +
          '<button class="tab' + (s.mode === 'tables' ? ' active' : '') + '" onclick="genSetMode(\'tables\')">✖️ Times tables (2, 5, 10)</button>' +
        '</div>' +
        '<div class="row" style="margin-top:.6rem">' +
          '<div><label>Half term</label><select id="genHalfTerm" onchange="genSetHalfTerm(this.value)" style="min-width:140px">' + htOpts + '</select>' +
            '<div class="hint small" style="font-weight:400">Sets the clock difficulty</div></div>' +
          (s.mode === 'tables'
            ? '<div><label>How many</label><input id="genCount" type="number" min="1" max="100" value="' + s.count + '" onchange="genSetCount(this.value)" style="width:90px" /></div>'
            : '') +
          '<div><label>How many days</label>' +
            '<select id="genWeek" onchange="genSetWeek(this.value)" style="min-width:150px">' +
              opt('0', '1 day', s.week ? '1' : '0') + opt('1', 'Whole week (Mon–Fri)', s.week ? '1' : '0') +
            '</select></div>' +
          '<div class="grow"></div>' +
          '<button onclick="genGenerate()">🎲 Generate new</button>' +
          '<button class="secondary" onclick="window.print()">🖨️ Print</button>' +
        '</div>' +
        (s.mode === 'worksheet'
          ? '<div class="row" style="margin-top:.5rem; align-items:flex-end">' +
              '<label style="display:inline-flex; align-items:center; gap:8px; font-weight:600; cursor:pointer">' +
                '<input type="checkbox"' + (s.backTables ? ' checked' : '') + ' onchange="genSetBackTables(this.checked)" style="width:16px; height:16px"> Times tables on the back' +
              '</label>' +
              (s.backTables
                ? '<div><label>Tables</label><select onchange="genSetBackPick(this.value)" style="min-width:150px">' +
                    opt('2', '2×', s.backPick) + opt('5', '5×', s.backPick) + opt('10', '10×', s.backPick) + opt('all', 'All three (2, 5, 10)', s.backPick) +
                  '</select></div>' +
                  '<div><label>How many questions</label><input type="number" min="1" max="100" value="' + s.backCount + '" onchange="genSetBackCount(this.value)" style="width:90px" /></div>'
                : '') +
            '</div>'
          : '') +
        (s.mode === 'worksheet' ? '<p class="hint small" style="margin-top:.5rem">Clock difficulty for <b>' + esc(s.halfTerm) + '</b>: ' + genClockLabel(s.halfTerm) + '</p>' : '') +
        '<p class="hint small" style="margin-top:.3rem">Each page prints on its own A4 sheet' +
          (s.mode === 'worksheet' && s.backTables ? ' — print double-sided to get the times tables on the back.' : '.') + '</p>' +
      '</div>';

    var body;
    if (!s.days.length){
      body = '<div class="card"><p class="empty">Tap <b>🎲 Generate new</b> to create ' + (s.week ? 'a week of worksheets' : 'a worksheet') + '.</p></div>';
    } else {
      body = s.days.map(function (day){
        var pages = [];
        var frontTitle = (s.mode === 'tables' ? 'Times tables (2, 5, 10)' : 'Mental Starter — ' + esc(s.halfTerm));
        pages.push(genSheetHTML(day.label, frontTitle, day.questions, s.mode === 'tables', s.generatedISO));
        if (day.back && day.back.length){
          pages.push(genSheetHTML(day.label, 'Times tables — ' + genTablesLabel(s.backPick), day.back, true, s.generatedISO));
        }
        return pages.join('');
      }).join('');
    }
    root.innerHTML = controls + body;
  }

  function genClockLabel(ht){
    var names = { 0: "o'clock", 5: '5 past', 10: '10 past', 15: 'quarter past', 20: '20 past', 25: '25 past',
                  30: 'half past', 35: '25 to', 40: '20 to', 45: 'quarter to', 50: '10 to', 55: '5 to' };
    return genClockMinutes(ht).map(function (m){ return names[m]; }).join(', ');
  }

  /* ── Handlers (on window for inline onclick) ────────────── */
  window.genGenerate = function (){
    var s = genLoad();
    s.days = genBuildDays(s.halfTerm, s.mode, s.count, s.week,
      { backTables: s.backTables, backPick: s.backPick, backCount: s.backCount });
    s.generatedISO = (typeof todayISO === 'function') ? todayISO() : '';
    genSave(s); genRender();
  };
  window.genSetMode = function (mode){
    var s = genLoad();
    if (s.mode === mode) return;
    s.mode = (mode === 'tables') ? 'tables' : 'worksheet';
    s.days = []; // worksheet/tables are different shapes; clear until regenerated
    genSave(s); genRender();
  };
  window.genSetHalfTerm = function (v){ var s = genLoad(); s.halfTerm = GEN_CLOCK[v] ? v : s.halfTerm; genSave(s); genRender(); };
  window.genSetCount = function (v){ var s = genLoad(); var n = parseInt(v, 10); s.count = (n > 0 && n <= 100) ? n : 50; genSave(s); };
  window.genSetWeek = function (v){ var s = genLoad(); s.week = (v === '1' || v === 1 || v === true); genSave(s); genRender(); };

  // rebuild the back times-tables page of already-generated days so toggles apply at once
  function genRefreshBacks(s){
    if (s.mode !== 'worksheet' || !s.days.length) return;
    s.days.forEach(function (day){
      if (s.backTables) day.back = genBuildTables(s.backCount, genBasesFor(s.backPick));
      else delete day.back;
    });
  }
  window.genSetBackTables = function (on){ var s = genLoad(); s.backTables = !!on; genRefreshBacks(s); genSave(s); genRender(); };
  window.genSetBackPick = function (v){ var s = genLoad(); s.backPick = (['2','5','10','all'].indexOf(v) >= 0) ? v : 'all'; genRefreshBacks(s); genSave(s); genRender(); };
  window.genSetBackCount = function (v){ var s = genLoad(); var n = parseInt(v, 10); s.backCount = (n > 0 && n <= 100) ? n : 20; genRefreshBacks(s); genSave(s); genRender(); };

  /* expose render + testable helpers */
  window.genRender = genRender;
  window.genBuild = genBuild;
  window.genBuildDays = genBuildDays;
  window.genRenderQuestion = genRenderQuestion;
  window.genHourAngle = genHourAngle;
  window.genMinuteAngle = genMinuteAngle;
  window.genClockMinutes = genClockMinutes;

})();
