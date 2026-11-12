/* ============================================================
   MENTAL STARTER (CBM): deeper forms of a skill.

   A child who is secure on a skill is not moved on to next year's work;
   they get the SAME skill asked in a way that needs reasoning: spot the
   mistake, true or false, a balance, work backwards, compare without
   working it all out, a short problem. The forms follow the kinds of
   question White Rose use for reasoning and problem solving, written
   here from scratch: our wording, our names, our numbers, no pictures.

   cbmDeep(k, q, box) → a question, or null when the skill has no deeper
   form (clocks, shapes and measures need a picture to reason about).
     k    the class skill: a White Rose step id or 'pre:<set>:<slot>'
     q    its plain question, already built (the numbers are reused, so
          the deeper form stays inside the step's own range)
     box  true for the practice box, which is not marked, so a question
          with many right answers is allowed there

   On the sheet every form has ONE short answer the teacher can tick: a
   number, a symbol, True/False, a name. At most two short sentences.
   It is called inside cbm.js's seeded build (Math.random is swapped), so
   the same child gets the same question on a reprint.
   ============================================================ */
(function () {
  'use strict';

  function R(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function P(a) { return a[Math.floor(Math.random() * a.length)]; }
  var BOX = '<span class="gen-blank">?</span>';
  var NAMES = ['Sam', 'Ali', 'Mia', 'Zara', 'Leo', 'Ben', 'Eva', 'Noor', 'Kai', 'Ivy'];
  var THINGS = ['stickers', 'marbles', 'cards', 'beads', 'shells'];
  function two() { var a = P(NAMES), b = P(NAMES); while (b === a) b = P(NAMES); return [a, b]; }
  /* f names the form: tests check each form's answer, and it is harmless on the sheet */
  function q(f, s, ans) { return { t: 'prompt', s: s, ans: String(ans), f: f }; }
  function cmp(f, a, aop, b, c, bop, d) { return { t: 'compare', a: a, aop: aop, b: b, c: c, bop: bop, d: d, f: f }; }
  function calc(a, op, b) { return op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b; }
  function sym(l, r) { return l < r ? '<' : l > r ? '>' : '='; }
  function words(n) { return typeof window.genAnswer === 'function' ? String(window.genAnswer({ t: 'words', n: n })) : String(n); }
  function pick(list, right) {
    list = list.filter(function (x, i) { return x !== right && x >= 0 && x === Math.round(x) && list.indexOf(x) === i; });
    return list.length ? P(list) : right + 1;
  }

  /* The wrong answers children really give: the other operation, a ten out,
     one out, and the two classic regrouping slips. */
  function wrongArith(a, op, b) {
    var r = calc(a, op, b), c = [r + 10, r - 10, r + 1, r - 1];
    if (op === '+') {
      c.push(Math.abs(a - b));
      if (a % 10 + b % 10 >= 10 && a >= 10) c.push((Math.floor(a / 10) + Math.floor(b / 10)) * 10 + (a % 10 + b % 10) % 10);   // forgot the ten
    } else {
      c.push(a + b);
      if (a % 10 < b % 10) c.push((Math.floor(a / 10) - Math.floor(b / 10)) * 10 + (b % 10 - a % 10));                          // took the smaller digit from the larger
    }
    return pick(c, r);
  }

  /* ── by question type ─────────────────────────────────── */
  function arith(x, box) {
    var a = +x.a, b = +x.b, op = x.op, r = calc(a, op, b), n = two(), th = P(THINGS), forms = [];
    if (op !== '+' && op !== '-') return null;
    var plus = op === '+';
    forms.push(function () { return q('mistake', n[0] + ' says ' + a + ' ' + op + ' ' + b + ' = ' + wrongArith(a, op, b) + '. What is the right answer?', r); });
    forms.push(function () { var ok = Math.random() < 0.5; return q('truefalse', 'True or false?<br>' + a + ' ' + op + ' ' + b + ' = ' + (ok ? r : wrongArith(a, op, b)), ok ? 'True' : 'False'); });
    forms.push(function () {
      return plus ? q('backwards', 'I think of a number. I add ' + b + ' and get ' + r + '. What was my number?', a)
                  : q('backwards', 'I think of a number. I take away ' + b + ' and get ' + r + '. What was my number?', a);
    });
    if (b >= 1) forms.push(function () {
      return plus ? q('more', n[0] + ' has ' + a + ' ' + th + '. ' + n[1] + ' has ' + b + ' more. How many has ' + n[1] + '?', r)
                  : q('more', n[0] + ' has ' + a + ' ' + th + '. ' + n[1] + ' has ' + b + ' fewer. How many has ' + n[1] + '?', r);
    });
    if (plus && b >= 2) forms.push(function () { var d = R(1, Math.min(3, b - 1)); return q('balance', a + ' + ' + b + ' = ' + BOX + ' + ' + (a + d), b - d); });
    if (!plus && a + 3 <= 100) forms.push(function () { var d = R(1, 3); return q('balance', a + ' - ' + b + ' = ' + BOX + ' - ' + (b + d), a + d); });
    forms.push(function () {
      var kind = R(0, 2), d = P([-2, -1, 1, 2]);
      if (kind === 0 && b + d >= 0 && (plus || a - (b + d) >= 0)) return cmp('compare', a, op, b, a, op, b + d);
      if (kind === 1 && (!plus || a >= b)) return cmp('compare', a, op, b, a, plus ? '-' : '+', b);
      return plus ? cmp('compare', a, op, b, b, op, a)                          // the same sum the other way round
                  : cmp('compare', a, op, b, a + 1, op, b + 1);                 // the same difference, one along
    });
    if (box) {
      forms = [function () {
        return plus ? q('open', 'Write three different additions that make ' + r + '.', 'e.g. ' + (r - 1) + ' + 1, ' + (r - 2) + ' + 2, ' + (r - 10 >= 0 ? (r - 10) + ' + 10' : r + ' + 0'))
                    : q('open', 'Write two numbers with a difference of ' + r + '. Can you find three pairs?', 'e.g. ' + (r + 1) + ' and 1, ' + (r + 10) + ' and 10');
      }].concat(forms.slice(0, 3));
    }
    return P(forms)();
  }

  function arith3(x) {
    var a = +x.a, b = +x.b, c = +x.c, r = a + b + c, n = P(NAMES);
    return P([
      function () { return q('missing', a + ' + ' + BOX + ' + ' + c + ' = ' + r, b); },
      function () { return q('missing', BOX + ' + ' + b + ' + ' + c + ' = ' + r, a); },
      function () { return q('mistake', n + ' says ' + a + ' + ' + b + ' + ' + c + ' = ' + pick([r + 1, r - 1, r + 10, a + b], r) + '. What is the right answer?', r); },
      function () { var ok = Math.random() < 0.5; return q('truefalse', 'True or false?<br>' + a + ' + ' + b + ' + ' + c + ' = ' + c + ' + ' + (ok ? a + b : a + b + 1), ok ? 'True' : 'False'); }
    ])();
  }

  function missing(x) {
    var a = +x.a, b = +x.b, s = +x.sum, n = P(NAMES), th = P(THINGS);
    var forms = [
      function () { return q('backwards', n + ' has some ' + th + ' and gets ' + b + ' more. Now there are ' + s + '. How many at the start?', a); },
      function () { var ok = Math.random() < 0.5; return q('truefalse', 'True or false?<br>' + a + ' + ' + (ok ? b : pick([b + 1, b - 1, b + 10], b)) + ' = ' + s, ok ? 'True' : 'False'); },
      function () { return q('backwards', s + ' - ' + BOX + ' = ' + a, b); }
    ];
    if (b >= 1) forms.push(function () { return q('balance', a + ' + ' + BOX + ' = ' + (a + 1) + ' + ' + (b - 1), b); });
    return P(forms)();
  }

  var COIN = { 2: 1, 5: 1, 10: 1 };
  function times(x) {
    var base = +x.base, by = +x.by, r = base * by, n = two(), th = P(THINGS);
    var forms = [
      function () { return q('mistake', n[0] + ' says ' + base + ' × ' + by + ' = ' + pick([base + by, base * (by + 1), base * (by - 1), r + 1], r) + '. What is the right answer?', r); },
      function () { var ok = Math.random() < 0.5; return q('truefalse', 'True or false?<br>' + base + ' × ' + by + ' = ' + (ok ? r : pick([base + by, base * (by + 1), r - 1], r)), ok ? 'True' : 'False'); },
      function () { return q('backwards', BOX + ' × ' + base + ' = ' + r, by); },
      function () { var m = R(1, Math.max(1, r)), d = P([-2, 0, 0, 2]); return cmp('compare', base, '×', by, m, '+', Math.max(0, r - m + d)); },
      function () { return q('groups', 'There are ' + by + ' bags with ' + base + ' ' + th + ' in each. How many ' + th + ' altogether?', r); }
    ];
    if (COIN[base]) forms.push(function () { return q('coins', n[0] + ' has ' + by + ' coins. They are all ' + base + 'p coins. How much money is that?', r + 'p'); });
    if (base === 2) forms.push(function () { return q('twice', n[0] + ' has ' + by + ' ' + th + '. ' + n[1] + ' has twice as many. How many has ' + n[1] + '?', r); });
    return P(forms)();
  }

  function divide(x) {
    var base = +x.base, by = +x.by, D = base * by, n = P(NAMES), th = P(THINGS);
    var forms = [
      function () { return q('mistake', n + ' says ' + D + ' ÷ ' + base + ' = ' + pick([by + 1, by - 1, D - base, by + base], by) + '. What is the right answer?', by); },
      function () { var ok = Math.random() < 0.5; return q('truefalse', 'True or false?<br>' + D + ' ÷ ' + base + ' = ' + (ok ? by : pick([by + 1, by - 1, by + 2], by)), ok ? 'True' : 'False'); },
      function () { return q('backwards', BOX + ' ÷ ' + base + ' = ' + by, D); },
      function () { return q('share', n + ' shares some ' + th + ' equally between ' + base + ' friends. They get ' + by + ' each. How many ' + th + ' were there?', D); }
    ];
    if (COIN[base]) forms.push(function () { return q('coins', n + ' has ' + D + 'p in ' + base + 'p coins. How many coins is that?', by); });
    return P(forms)();
  }

  function half(x) {
    var n = +x.n;
    return P([
      function () { return q('whole', 'Half of a number is ' + n + '. What is the number?', n * 2); },
      function () { return q('backwards', 'I double a number and get ' + (n * 2) + '. What was my number?', n); }
    ])();
  }

  /* tens and ones, regrouped: 5 tens and 18 ones */
  function regroup(n) {
    var t = Math.floor(n / 10), o = n % 10;
    if (t < 2) return q('regroup', 'A number has ' + t + ' ten' + (t === 1 ? '' : 's') + ' and ' + (o + 10) + ' ones. What is the number?', n + 10);
    return P([
      function () { return q('regroup', n + ' = ' + (t - 1) + ' ten' + (t - 1 === 1 ? '' : 's') + ' and ' + BOX + ' ones', o + 10); },
      function () { return q('regroup', (t - 1) + ' ten' + (t - 1 === 1 ? '' : 's') + ' and ' + (o + 10) + ' ones. What is the number?', n); },
      function () { return q('expanded', BOX + ' = ' + o + ' + ' + (t * 10), n); },
      function () { return q('regroup', n + ' = ' + ((t - 1) * 10) + ' + ' + BOX, o + 10); }
    ])();
  }

  function seq(x) {
    var start = +x.start, step = +x.step, len = x.len || 4, i, terms = [];
    for (i = 0; i < len; i++) terms.push(start + step * i);
    var forms = [function () {
      var at = R(1, len - 1), bad = terms.slice(); bad[at] = terms[at] + P(step === 1 || step === -1 ? [10, 5] : [1, -1]);
      return q('wrongterm', 'One number is wrong. Which one?<br>' + bad.join(', '), bad[at]);
    }];
    if (Math.abs(step) > 1 && step > 0) forms.push(function () {
      var yes = Math.random() < 0.5, far = start + step * R(len + 1, len + 4), n = yes ? far : far + R(1, step - 1);
      return q('willsay', P(NAMES) + ' counts in ' + step + 's from ' + start + '. Will ' + n + ' be said? Yes or no?', yes ? 'Yes' : 'No');
    });
    return P(forms)();
  }

  var BY_TYPE = {
    arith: arith, arith3: arith3, missing: missing, times: times, divide: divide, half: half, seq: seq,
    /* a number line needs its picture; the deeper form is the same counting, written out */
    numline: function (x) { var st = +x.step === 10 ? 10 : P([1, 10]); return seq({ start: Math.min(+x.at, st === 10 ? 60 : 95), step: st, len: 4 }); },
    placeval: function (x) { var n = x.tens * 10 + x.ones; return n >= 11 && n <= 89 ? regroup(n) : null; },
    tensones: function (x) { return x.n >= 11 && x.n <= 89 ? regroup(+x.n) : null; },
    partition: function (x) { return x.n >= 11 && x.n <= 89 ? regroup(+x.n) : null; },
    words: function (x) { var n = +x.n; return n >= 10 && n <= 89 ? q('words', 'Write in words the number that is 10 more than ' + n + '.', words(n + 10)) : null; },
    step: function (x) {
      var n = +x.n, by = +x.by, less = x.dir === 'less', r = less ? n - by : n + by;
      return q('backwards', r + ' is ' + by + ' ' + (less ? 'less' : 'more') + ' than ' + BOX, n);
    }
  };

  /* ── by step: the ones built as text, where the type says nothing ── */
  var UK = [200, 100, 50, 20, 10, 5, 2, 1];
  function fewest(p) { var n = 0; UK.forEach(function (c) { while (p >= c) { p -= c; n++; } }); return n; }
  function frac(n, d) { return n + '/' + d; }
  var BY_STEP = {
    'a1.2': function () { var t = R(2, 7), o = R(11, 18); return q('regroup', 'There are ' + t + ' tens and ' + o + ' ones. What is the number?', t * 10 + o); },
    'a1.8': function () { return regroup(R(2, 8) * 10 + R(1, 9)); },
    'a1.7': function () { return regroup(R(2, 8) * 10 + R(1, 9)); },
    'a2.3': function () {
      var a = R(2, 8), b = R(1, 9 - a), ok = Math.random() < 0.5;
      return P([
        function () { return q('truefalse', 'True or false?<br>' + (a * 10) + ' + ' + (b * 10) + ' = ' + (ok ? (a + b) * 10 : P([(a + b) * 100, a + b])), ok ? 'True' : 'False'); },
        function () { return q('backwards', (a * 10) + ' + ' + BOX + ' = ' + ((a + b) * 10), b * 10); }
      ])();
    },
    'a2.8': function () { var n = R(2, 8) * 10 + R(3, 8), d = R(1, 2); return q('balance', n + ' + ' + (10 - n % 10) + ' = ' + BOX + ' + ' + (n - d), 10 - n % 10 + d); },
    'a2.13': function () { var n = R(21, 79), more = Math.random() < 0.5; return q('backwards', n + ' is 10 ' + (more ? 'more' : 'less') + ' than ' + BOX, more ? n - 10 : n + 10); },
    'b2.2': function () { return groupsCompare(); },
    'a1.13': function () {
      var t = R(2, 7), o = R(10, 18), n = t * 10 + o + P([-10, -1, 0, 0, 1, 10]);
      return q('compare', '&lt;, &gt; or =?<br>' + t + ' tens and ' + o + ' ones ' + BOX + ' ' + n, sym(t * 10 + o, n));
    },
    'a1.14': function () {
      var a = R(1, 8), b = R(a + 1, 9), list = [a * 10 + b, b * 10 + a, a * 10, b * 10], i, j, t;
      for (i = list.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = list[i]; list[i] = list[j]; list[j] = t; }
      return q('order', 'Put in order, greatest first:<br>' + list.join(', '), list.slice().sort(function (x, y) { return y - x; }).join(', '));
    },
    'b1.1': function () { var c = P([2, 5, 10, 20]), n = R(3, 6); return q('whichcoin', P(NAMES) + ' has ' + n + ' coins, all the same. They make ' + (c * n) + 'p. Which coin is it?', c + 'p'); },
    'b1.3': function () { var p = R(11, 99); return q('fewest', 'What is the fewest coins you can use to make ' + p + 'p?', fewest(p)); },
    'b1.4': function () { var p = R(11, 99); return q('fewest', 'What is the fewest coins you can use to make ' + p + 'p?', fewest(p)); },
    'b1.5': function () { var p = P([12, 15, 25, 30, 35, 60, 70, 75]); return q('fewest', 'What is the fewest coins you can use to make ' + p + 'p?', fewest(p)); },
    'b1.6': function () {
      var l = R(1, 3), p = R(5, 60), n = l * 100 + p + P([-100, -10, 0, 0, 10, 100]);
      return q('compare', '&lt;, &gt; or =?<br>£' + l + ' and ' + p + 'p ' + BOX + ' ' + n + 'p', sym(l * 100 + p, n));
    },
    'b1.7': function () { var a = R(10, 50), b = R(10, 99 - a); return q('backwards', P(NAMES) + ' buys two things and spends ' + (a + b) + 'p. One costs ' + a + 'p. What does the other cost?', b + 'p'); },
    'b1.8': function () { var c = P([2, 5, 10, 20, 50]); return q('whichcoin', (100 / c) + ' coins, all the same, make £1. Which coin is it?', c + 'p'); },
    'b1.9': function () { var c = R(15, 95); return q('backwards', 'I pay with £1 and get ' + (100 - c) + 'p change. How much did I spend?', c + 'p'); },
    'b2.1': function () { return groupsCompare(); },
    'b2.3': function () { return groupsCompare(); },
    'b2.6': function () { return groupsCompare(); },
    'b2.4': function () { var g = R(2, 6), n = P([2, 5, 10]); return times({ base: n, by: g }); },
    'b2.5': function () { var g = R(2, 6), n = P([2, 5, 10]); return times({ base: n, by: g }); },
    'b2.7': function () { var n = P([2, 5, 10]), g = R(2, 6); return divide({ base: n, by: g }); },
    'b2.8': function () { var n = P([2, 5, 10]), g = R(2, 6); return divide({ base: g, by: n }); },
    'b2.11': function () { return half({ n: R(3, 12) }); },
    'b2.12': function () {
      var kinds = [['an odd number', 'an odd number', 'even'], ['an odd number', 'an even number', 'odd'], ['an even number', 'an even number', 'even']], k = P(kinds);
      return q('oddeven', 'I add ' + k[0] + ' and ' + k[1] + '. Is the answer odd or even?', k[2]);
    },
    'c1.4': function () { return P([function () { return half({ n: R(3, 12) }); }, moreOf])(); },
    'c1.6': function () { var p = R(2, 10); return P([function () { return q('whole', 'A quarter of a number is ' + p + '. What is the number?', p * 4); }, moreOf])(); },
    'c1.8': function () { var p = P([2, 4, 6, 8]); return q('backwards', 'A third of a number is ' + p + '. What is half of the number?', p * 3 / 2); },
    'c1.9': function () {
      var p = R(2, 8), n = two(), d = P([3, 4]);
      return P([
        function () { return q('whole', 'A ' + (d === 3 ? 'third' : 'quarter') + ' of a number is ' + p + '. What is the number?', p * d); },
        function () { return q('bigger', p + ' is half of ' + n[0] + '\'s number and a quarter of ' + n[1] + '\'s number. Who has the bigger number?', n[1]); }
      ])();
    },
    'c1.10': function () { var n = P([12, 24]), fs = [[1, 2], [1, 3], [1, 4]], f = P(fs); return q('backwards', frac(f[0], f[1]) + ' of a number is ' + (n / f[1]) + '. What is the number?', n); },
    'c1.11': function () { var p = R(1, 6) * 3; return q('whole', frac(3, 4) + ' of a number is ' + p + '. What is the number?', p / 3 * 4); },
    'c1.12': function () { var n = R(2, 10) * 4; return q('balance', frac(1, 2) + ' of ' + n + ' = ' + frac(2, 4) + ' of ' + BOX, n); },
    'c1.14': function () { var n = R(2, 10) * 4; return q('left', P(NAMES) + ' has ' + n + ' sweets and eats ' + frac(3, 4) + ' of them. How many are left?', n / 4); }
  };
  function groupsCompare() {
    var g = R(2, 6), n = P([2, 5, 10]), h = R(2, 6), m = P([2, 5, 10]);
    return q('compare', '&lt;, &gt; or =?<br>' + g + ' groups of ' + n + ' ' + BOX + ' ' + h + ' groups of ' + m, sym(g * n, h * m));
  }
  function moreOf() {
    var a = R(2, 6) * 4, b = P([a / 2, a / 2 + 2, a / 2 - 2, a]), x = a / 4, y = b / 2;
    if (b % 2 || b <= 0) { b = a; y = b / 2; }
    return q('moreof', 'Which is more: ' + frac(1, 4) + ' of ' + a + ' or ' + frac(1, 2) + ' of ' + b + '?', x === y ? 'They are equal' : x > y ? frac(1, 4) + ' of ' + a : frac(1, 2) + ' of ' + b);
  }

  function cbmDeep(k, q0, box) {
    if (!q0) return null;
    var fn = BY_STEP[String(k)], out = null;
    if (fn) out = fn();
    else if (BY_TYPE[q0.t]) out = BY_TYPE[q0.t](q0, !!box);
    return out || null;
  }

  window.cbmDeep = cbmDeep;
  window.CBM_DEEP = { fewest: fewest };
})();
