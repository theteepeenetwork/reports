/* ============================================================
   wrsteps.js — White Rose Maths small steps, Year 1 to Year 6
   Owner: Board (docs/OWNERSHIP.md) · loaded BEFORE js/generator.js

   The scheme, transcribed from White Rose Education's own
   published schemes of learning (2022 edition) — the
   Autumn/Spring/Summer term documents for each year. Block and
   step titles are verbatim so they match a teacher's planning.
   Every block carries its `year`; Year 2 came first and keeps
   bare ids ('a1.1'), every other year's ids are 'yN.'-prefixed
   ('y4.b2.3').

   Each step carries a `gen` that returns ONE question descriptor
   for the mental starter, or null when the step cannot honestly
   become a written question without apparatus or a picture (you
   cannot ask a child to measure a pencil on a printed sheet).
   Steps with gen:null still appear in the picker, greyed, with
   `why` explaining it — a teacher planning from the scheme should
   see the whole scheme, not a silently filtered version.

   STEP IDS ARE PERSISTED. A saved worksheet stores the id of the
   step in each slot, so ids never change meaning. Add steps; do
   not renumber them.

   Descriptors are the same currency generator.js uses. Most steps
   here emit {t:'prompt', s:'...'} — a composed question string —
   because the app prints a sheet and never marks it, so a baked
   string reprints identically and costs nothing. The richer types
   (clock, placeval, seq, arith…) are used wherever the renderer
   draws something a string cannot.
   ============================================================ */
(function () {

  function R(lo, hi){ return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function P(a){ return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a){
    var c = a.slice(), i, j, t;
    for (i = c.length - 1; i > 0; i--){ j = Math.floor(Math.random() * (i + 1)); t = c[i]; c[i] = c[j]; c[j] = t; }
    return c;
  }
  function two(lo, hi){ var a = R(lo, hi), b = R(lo, hi); while (b === a) b = R(lo, hi); return [a, b]; }
  /* A two-digit number with both digits non-zero — "how many ones in 40?"
     and "partition 40 into 40 + 0" are not questions. */
  function td(){ return R(1, 9) * 10 + R(1, 9); }
  /* ans is the answer the board's answer page shows — plain text, never markup. */
  function q(s, ans){ return { t: 'prompt', s: s, ans: String(ans) }; }

  var WORDS = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  var SHAPES_2D = [
    { name:'triangle', sides:3 }, { name:'square', sides:4 }, { name:'rectangle', sides:4 },
    { name:'pentagon', sides:5 }, { name:'hexagon', sides:6 }, { name:'octagon', sides:8 }
  ];
  var SHAPES_3D = [
    { name:'cube', faces:6, edges:12, vertices:8 },
    { name:'cuboid', faces:6, edges:12, vertices:8 },
    { name:'square-based pyramid', faces:5, edges:8, vertices:5 },
    { name:'triangular prism', faces:5, edges:9, vertices:6 },
    { name:'cylinder', faces:3, edges:2, vertices:0 },
    { name:'cone', faces:2, edges:1, vertices:1 },
    { name:'sphere', faces:1, edges:0, vertices:0 }
  ];
  var COINS = [1, 2, 5, 10, 20, 50];

  /* ════════════════════════════════════════════════════════
     YEAR 2 — the first year transcribed. Its ids are the bare
     ones ('a1', 'a1.1') because saved worksheets already hold
     them; every other year's ids carry a 'yN.' prefix.
     ════════════════════════════════════════════════════════ */

  /* ── Blocks, in the order the scheme teaches them ───────── */
  var Y2_BLOCKS = [
    { year:2, id:'a1', term:'Autumn', n:1, title:'Place value' },
    { year:2, id:'a2', term:'Autumn', n:2, title:'Addition and subtraction' },
    { year:2, id:'a3', term:'Autumn', n:3, title:'Shape' },
    { year:2, id:'b1', term:'Spring', n:1, title:'Money' },
    { year:2, id:'b2', term:'Spring', n:2, title:'Multiplication and division' },
    { year:2, id:'b3', term:'Spring', n:3, title:'Length and height' },
    { year:2, id:'b4', term:'Spring', n:4, title:'Mass, capacity and temperature' },
    { year:2, id:'c1', term:'Summer', n:1, title:'Fractions' },
    { year:2, id:'c2', term:'Summer', n:2, title:'Time' },
    { year:2, id:'c3', term:'Summer', n:3, title:'Statistics' },
    { year:2, id:'c4', term:'Summer', n:4, title:'Position and direction' }
  ];

  var NEEDS_PICTURE = 'Needs a picture or apparatus — not a written starter question.';
  var NEEDS_DRAWING = 'The child has to draw it, so there is nothing to ask on a starter sheet.';

  /* ── The steps ──────────────────────────────────────────── */
  var Y2_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'a1.1',  block:'a1', n:1,  title:'Numbers to 20',
      gen:function(){ var w = R(10,20), m = R(10,19);
                      return P([ { t:'words', n:w },
                                 { t:'seq', start:R(1,16), step:1, len:4, blank:R(1,2) },
                                 q('What is one more than ' + m + '?', m + 1) ]); } },
    { id:'a1.2',  block:'a1', n:2,  title:'Count objects to 100 by making 10s',
      gen:function(){ var t = R(2,9), o = R(1,9); return q('There are ' + t + ' full tens and ' + o + ' ones. What is the number?', t*10 + o); } },
    { id:'a1.3',  block:'a1', n:3,  title:'Recognise tens and ones',
      gen:function(){ return { t:'tensones', n:td(), part:P(['tens','ones']) }; } },
    { id:'a1.4',  block:'a1', n:4,  title:'Use a place value chart',
      gen:function(){ return { t:'placeval', tens:R(1,9), ones:R(1,9) }; } },
    { id:'a1.5',  block:'a1', n:5,  title:'Partition numbers to 100',
      gen:function(){ return { t:'partition', n:td() }; } },
    { id:'a1.6',  block:'a1', n:6,  title:'Write numbers to 100 in words',
      gen:function(){ return { t:'words', n:R(20,99) }; } },
    { id:'a1.7',  block:'a1', n:7,  title:'Flexibly partition numbers to 100',
      gen:function(){ var n = td(), t = R(1, Math.floor(n/10) - 1) * 10;
                      return q(n + ' = ' + t + ' + <span class="gen-blank">?</span>', n - t); } },
    { id:'a1.8',  block:'a1', n:8,  title:'Write numbers to 100 in expanded form',
      gen:function(){ var n = td(); return q('Write ' + n + ' as tens add ones.', (n - n%10) + ' + ' + n%10); } },
    { id:'a1.9',  block:'a1', n:9,  title:'10s on the number line to 100',
      gen:function(){ return { t:'seq', start:R(1,4)*10, step:10, len:4, blank:R(1,2) }; } },
    { id:'a1.10', block:'a1', n:10, title:'10s and 1s on the number line to 100',
      gen:function(){ return { t:'seq', start:R(11,60), step:P([1,10]), len:4, blank:R(1,2) }; } },
    { id:'a1.11', block:'a1', n:11, title:'Estimate numbers on a number line',
      gen:function(){ var a = R(0,4)*10, b = a + 10;
                      return q('A number is halfway between ' + a + ' and ' + b + '. What is it?', a + 5); } },
    { id:'a1.12', block:'a1', n:12, title:'Compare objects', gen:null, why:NEEDS_PICTURE },
    { id:'a1.13', block:'a1', n:13, title:'Compare numbers',
      gen:function(){ var p = two(10,99); return q('&lt;, &gt; or =?<br>' + p[0] + ' <span class="gen-blank">?</span> ' + p[1], p[0] < p[1] ? '<' : '>'); } },
    { id:'a1.14', block:'a1', n:14, title:'Order objects and numbers',
      gen:function(){ var a = shuffle([R(10,39), R(40,69), R(70,99)]);
                      return q('Put in order, smallest first:<br>' + a.join(', '), a.slice().sort(function (x, y){ return x - y; }).join(', ')); } },
    { id:'a1.15', block:'a1', n:15, title:'Count in 2s, 5s and 10s',
      gen:function(){ var s = P([2,5,10]); return { t:'seq', start:s * R(1,6), step:s, len:4, blank:R(1,2) }; } },
    { id:'a1.16', block:'a1', n:16, title:'Count in 3s',
      gen:function(){ return { t:'seq', start:3 * R(1,6), step:3, len:4, blank:R(1,2) }; } },

    /* ---- Autumn 2 · Addition and subtraction ---------------- */
    { id:'a2.1',  block:'a2', n:1,  title:'Bonds to 10',
      gen:function(){ var a = R(1,9); return { t:'missing', a:a, b:10-a, sum:10, blank:P(['a','b']) }; } },
    { id:'a2.2',  block:'a2', n:2,  title:'Fact families – addition and subtraction bonds within 20',
      gen:function(){ var a = R(2,9), b = R(2,20-a);
                      return q('Write the fact family for ' + a + ', ' + b + ' and ' + (a+b) + '.',
                               a + ' + ' + b + ' = ' + (a+b) + ', ' + b + ' + ' + a + ' = ' + (a+b) + ', ' +
                               (a+b) + ' - ' + a + ' = ' + b + ', ' + (a+b) + ' - ' + b + ' = ' + a); } },
    { id:'a2.3',  block:'a2', n:3,  title:'Related facts',
      gen:function(){ var a = R(2,8), b = R(2,8);
                      return q('If ' + a + ' + ' + b + ' = ' + (a+b) + ', what is ' + (a*10) + ' + ' + (b*10) + '?', (a+b)*10); } },
    { id:'a2.4',  block:'a2', n:4,  title:'Bonds to 100 (tens)',
      gen:function(){ var t = R(1,9)*10; return { t:'missing', a:t, b:100-t, sum:100, blank:P(['a','b']) }; } },
    { id:'a2.5',  block:'a2', n:5,  title:'Add and subtract 1s',
      gen:function(){ var a = R(20,90); return { t:'arith', a:a, b:R(1,3), op:P(['+','-']) }; } },
    { id:'a2.6',  block:'a2', n:6,  title:'Add by making 10',
      gen:function(){ var a = R(6,9); return { t:'arith', a:a, b:R(11-a, 9), op:'+' }; } },
    { id:'a2.7',  block:'a2', n:7,  title:'Add three 1-digit numbers',
      gen:function(){ return { t:'arith3', a:R(1,9), b:R(1,9), c:R(1,9) }; } },
    { id:'a2.8',  block:'a2', n:8,  title:'Add to the next 10',
      gen:function(){ var n = R(2,9)*10 + R(1,9); return q(n + ' + <span class="gen-blank">?</span> = ' + (Math.ceil(n/10)*10), Math.ceil(n/10)*10 - n); } },
    { id:'a2.9',  block:'a2', n:9,  title:'Add across a 10',
      gen:function(){ var a = R(2,8)*10 + R(5,9); return { t:'arith', a:a, b:R(10 - (a%10), 9), op:'+' }; } },
    { id:'a2.10', block:'a2', n:10, title:'Subtract across 10',
      gen:function(){ var a = R(2,9)*10 + R(1,4); return { t:'arith', a:a, b:R((a%10)+1, 9), op:'-' }; } },
    { id:'a2.11', block:'a2', n:11, title:'Subtract from a 10',
      gen:function(){ return { t:'arith', a:R(2,9)*10, b:R(1,9), op:'-' }; } },
    { id:'a2.12', block:'a2', n:12, title:'Subtract a 1-digit number from a 2-digit number (across a 10)',
      gen:function(){ var a = R(2,9)*10 + R(1,4); return { t:'arith', a:a, b:R((a%10)+1, 9), op:'-' }; } },
    { id:'a2.13', block:'a2', n:13, title:'10 more, 10 less',
      gen:function(){ var n = R(11,89);
                      return P([q(n + ' + 10 =', n + 10), q(n + ' - 10 =', n - 10), q('Ten more than ' + n + '?', n + 10), q('Ten less than ' + n + '?', n - 10)]); } },
    { id:'a2.14', block:'a2', n:14, title:'Add and subtract 10s',
      // The multiple of ten is chosen first and the start drawn from what is
      // left. Drawing the start first lets 79 + 30 through, which is past 100.
      gen:function(){ var m = R(1,3)*10;
                      return P([true,false]) ? { t:'arith', a:R(20, 100 - m), b:m, op:'+' }
                                             : { t:'arith', a:R(20 + m, 100), b:m, op:'-' }; } },
    { id:'a2.15', block:'a2', n:15, title:'Add two 2-digit numbers (not across a 10)',
      gen:function(){ var o = R(1,4); return { t:'arith', a:R(1,4)*10 + o, b:R(1,4)*10 + R(1, 9-o), op:'+' }; } },
    { id:'a2.16', block:'a2', n:16, title:'Add two 2-digit numbers (across a 10)',
      gen:function(){ var o = R(5,9); return { t:'arith', a:R(1,4)*10 + o, b:R(1,4)*10 + R(10-o, 9), op:'+' }; } },
    { id:'a2.17', block:'a2', n:17, title:'Subtract two 2-digit numbers (not across a 10)',
      gen:function(){ var o = R(5,9), t = R(4,9);
                      return { t:'arith', a:t*10 + o, b:R(1, t-1)*10 + R(1, o), op:'-' }; } },
    { id:'a2.18', block:'a2', n:18, title:'Subtract two 2-digit numbers (across a 10)',
      gen:function(){ var o = R(1,4), t = R(4,9);
                      return { t:'arith', a:t*10 + o, b:R(1, t-2)*10 + R(o+1, 9), op:'-' }; } },
    { id:'a2.19', block:'a2', n:19, title:'Mixed addition and subtraction',
      gen:function(){ if (P([true,false])){ var a = R(10,89); return { t:'arith', a:a, b:R(2, 99-a), op:'+' }; }
                      var x = R(20,99); return { t:'arith', a:x, b:R(2, x-1), op:'-' }; } },
    { id:'a2.20', block:'a2', n:20, title:'Compare number sentences',
      gen:function(){ return { t:'compare', a:R(2,20), aop:'+', b:R(2,20), c:R(2,20), bop:'+', d:R(2,20) }; } },
    { id:'a2.21', block:'a2', n:21, title:'Missing number problems',
      gen:function(){ var a = R(2,40), b = R(2,40); return { t:'missing', a:a, b:b, sum:a+b, blank:P(['a','b']) }; } },

    /* ---- Autumn 3 · Shape ---------------------------------- */
    { id:'a3.1',  block:'a3', n:1,  title:'Recognise 2-D and 3-D shapes',
      gen:function(){ return q('Is a ' + P(SHAPES_3D).name + ' a 2-D or a 3-D shape?', '3-D'); } },
    { id:'a3.2',  block:'a3', n:2,  title:'Count sides on 2-D shapes',
      gen:function(){ return { t:'shape', shape:P(SHAPES_2D).name, ask:'sides' }; } },
    { id:'a3.3',  block:'a3', n:3,  title:'Count vertices on 2-D shapes',
      gen:function(){ return { t:'shape', shape:P(SHAPES_2D).name, ask:'vertices' }; } },
    { id:'a3.4',  block:'a3', n:4,  title:'Draw 2-D shapes', gen:null, why:NEEDS_DRAWING },
    { id:'a3.5',  block:'a3', n:5,  title:'Lines of symmetry on shapes',
      gen:function(){ var s = P([['square',4],['rectangle',2],['equilateral triangle',3],['regular hexagon',6]]);
                      return q('How many lines of symmetry does a ' + s[0] + ' have?', s[1]); } },
    { id:'a3.6',  block:'a3', n:6,  title:'Use lines of symmetry to complete shapes', gen:null, why:NEEDS_DRAWING },
    { id:'a3.7',  block:'a3', n:7,  title:'Sort 2-D shapes',
      gen:function(){ var s = P(SHAPES_2D), more = SHAPES_2D.filter(function (x){ return x.sides > s.sides; })[0];
                      return q('Name a 2-D shape with more sides than a ' + s.name + '.', 'e.g. ' + (more ? more.name : 'decagon')); } },
    { id:'a3.8',  block:'a3', n:8,  title:'Count faces on 3-D shapes',
      gen:function(){ var s = P(SHAPES_3D); return q('How many faces does a ' + s.name + ' have?', s.faces); } },
    { id:'a3.9',  block:'a3', n:9,  title:'Count edges on 3-D shapes',
      gen:function(){ var s = P(SHAPES_3D); return q('How many edges does a ' + s.name + ' have?', s.edges); } },
    { id:'a3.10', block:'a3', n:10, title:'Count vertices on 3-D shapes',
      gen:function(){ var s = P(SHAPES_3D); return q('How many vertices does a ' + s.name + ' have?', s.vertices); } },
    { id:'a3.11', block:'a3', n:11, title:'Sort 3-D shapes',
      gen:function(){ return q('Name a 3-D shape with no flat faces.', 'sphere'); } },
    { id:'a3.12', block:'a3', n:12, title:'Make patterns with 2-D and 3-D shapes', gen:null, why:NEEDS_PICTURE },

    /* ---- Spring 1 · Money ---------------------------------- */
    { id:'b1.1',  block:'b1', n:1,  title:'Count money – pence',
      gen:function(){ var c = P(COINS), n = R(2,5); return q('What is the total of ' + n + ' ' + c + 'p coins?', n*c + 'p'); } },
    { id:'b1.2',  block:'b1', n:2,  title:'Count money – pounds (notes and coins)',
      gen:function(){ var v = P([5,10,20]), n = R(2,4); return q('What is the total of ' + n + ' £' + v + ' notes?', '£' + n*v); } },
    { id:'b1.3',  block:'b1', n:3,  title:'Count money – pounds and pence',
      gen:function(){ var l = R(1,5), p = R(10,90); return q('£' + l + ' and ' + p + 'p. How much altogether, in pence?', l*100 + p + 'p'); } },
    { id:'b1.4',  block:'b1', n:4,  title:'Choose notes and coins',
      gen:function(){ var c = P([[7,'5p + 2p'],[11,'10p + 1p'],[15,'10p + 5p'],[25,'20p + 5p'],[30,'20p + 10p'],[60,'50p + 10p'],[70,'50p + 20p']]);
                      return q('Which two coins make ' + c[0] + 'p?', c[1]); } },
    { id:'b1.5',  block:'b1', n:5,  title:'Make the same amount',
      gen:function(){ var c = P([10,20,50]); return q('How many 2p coins are the same as ' + c + 'p?', c / 2); } },
    { id:'b1.6',  block:'b1', n:6,  title:'Compare amounts of money',
      gen:function(){ var p = two(15,95); return q('Which is more, ' + p[0] + 'p or ' + p[1] + 'p?', Math.max(p[0], p[1]) + 'p'); } },
    { id:'b1.7',  block:'b1', n:7,  title:'Calculate with money',
      gen:function(){ var a = R(10,50), b = R(10, 99-a); return q(a + 'p + ' + b + 'p = ?', a + b + 'p'); } },
    { id:'b1.8',  block:'b1', n:8,  title:'Make a pound',
      gen:function(){ var t = R(1,9)*10; return q(t + 'p + <span class="gen-blank">?</span> = £1', 100 - t + 'p'); } },
    { id:'b1.9',  block:'b1', n:9,  title:'Find change',
      gen:function(){ var c = R(15,95); return q('I spend ' + c + 'p and pay with £1. What is my change?', 100 - c + 'p'); } },
    { id:'b1.10', block:'b1', n:10, title:'Two-step problems',
      gen:function(){ var a = R(10,40), b = R(10,40); return q('I buy a ' + a + 'p pen and a ' + b + 'p rubber. What change from £1?', 100 - a - b + 'p'); } },

    /* ---- Spring 2 · Multiplication and division ------------- */
    { id:'b2.1',  block:'b2', n:1,  title:'Recognise equal groups',
      gen:function(){ var g = R(2,5), n = P([2,5,10]); return q('There are ' + g + ' groups of ' + n + '. How many altogether?', g*n); } },
    { id:'b2.2',  block:'b2', n:2,  title:'Make equal groups',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q('Make ' + (n*g) + ' into groups of ' + n + '. How many groups?', g); } },
    { id:'b2.3',  block:'b2', n:3,  title:'Add equal groups',
      gen:function(){ var n = P([2,5,10]), g = R(3,4);
                      return q(new Array(g + 1).join(n + ' + ').slice(0, -3) + ' =', n*g); } },
    { id:'b2.4',  block:'b2', n:4,  title:'Introduce the multiplication symbol',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q(g + ' groups of ' + n + ' = ' + g + ' × <span class="gen-blank">?</span>', n); } },
    { id:'b2.5',  block:'b2', n:5,  title:'Multiplication sentences',
      gen:function(){ return { t:'times', base:P([2,5,10]), by:R(1,12) }; } },
    { id:'b2.6',  block:'b2', n:6,  title:'Use arrays',
      gen:function(){ var r = R(2,5), c = P([2,5,10]); return q('An array has ' + r + ' rows of ' + c + '. How many in total?', r*c); } },
    { id:'b2.7',  block:'b2', n:7,  title:'Make equal groups – grouping',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q((n*g) + ' put into groups of ' + n + '. How many groups?', g); } },
    { id:'b2.8',  block:'b2', n:8,  title:'Make equal groups – sharing',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q((n*g) + ' shared between ' + g + '. How many each?', n); } },
    { id:'b2.9',  block:'b2', n:9,  title:'The 2 times-table',
      gen:function(){ return { t:'times', base:2, by:R(1,12) }; } },
    { id:'b2.10', block:'b2', n:10, title:'Divide by 2',
      gen:function(){ return { t:'divide', base:2, by:R(1,12) }; } },
    { id:'b2.11', block:'b2', n:11, title:'Doubling and halving',
      gen:function(){ var n = R(1,20); return P([ q('Double ' + n + '?', n*2), { t:'half', n:n } ]); } },
    { id:'b2.12', block:'b2', n:12, title:'Odd and even numbers',
      gen:function(){ var n = R(10,99); return q('Is ' + n + ' odd or even?', n % 2 ? 'odd' : 'even'); } },
    { id:'b2.13', block:'b2', n:13, title:'The 10 times-table',
      gen:function(){ return { t:'times', base:10, by:R(1,12) }; } },
    { id:'b2.14', block:'b2', n:14, title:'Divide by 10',
      gen:function(){ return { t:'divide', base:10, by:R(1,12) }; } },
    { id:'b2.15', block:'b2', n:15, title:'The 5 times-table',
      gen:function(){ return { t:'times', base:5, by:R(1,12) }; } },
    { id:'b2.16', block:'b2', n:16, title:'Divide by 5',
      gen:function(){ return { t:'divide', base:5, by:R(1,12) }; } },
    { id:'b2.17', block:'b2', n:17, title:'The 5 and 10 times-tables',
      gen:function(){ return { t:'times', base:P([5,10]), by:R(1,12) }; } },

    /* ---- Spring 3 · Length and height ---------------------- */
    { id:'b3.1',  block:'b3', n:1,  title:'Measure in centimetres', gen:null, why:'Needs a ruler and a real object to measure.' },
    { id:'b3.2',  block:'b3', n:2,  title:'Measure in metres', gen:null, why:'Needs a metre stick and a real object to measure.' },
    { id:'b3.3',  block:'b3', n:3,  title:'Compare lengths and heights',
      gen:function(){ var p = two(10,99); return q('Which is longer, ' + p[0] + 'cm or ' + p[1] + 'cm?', Math.max(p[0], p[1]) + 'cm'); } },
    { id:'b3.4',  block:'b3', n:4,  title:'Order lengths and heights',
      gen:function(){ var a = shuffle([R(10,39), R(40,69), R(70,99)]);
                      return q('Order shortest first:<br>' + a.join('cm, ') + 'cm', a.slice().sort(function (x, y){ return x - y; }).join('cm, ') + 'cm'); } },
    { id:'b3.5',  block:'b3', n:5,  title:'Four operations with lengths and heights',
      gen:function(){ var a = R(20,60), b = R(5, Math.min(39, a - 5)); return q('A ribbon is ' + a + 'cm. I cut off ' + b + 'cm. How much is left?', a - b + 'cm'); } },

    /* ---- Spring 4 · Mass, capacity and temperature ---------- */
    { id:'b4.1',  block:'b4', n:1,  title:'Compare mass',
      gen:function(){ var p = two(10,99); return q('Which is heavier, ' + p[0] + 'g or ' + p[1] + 'g?', Math.max(p[0], p[1]) + 'g'); } },
    { id:'b4.2',  block:'b4', n:2,  title:'Measure in grams', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'b4.3',  block:'b4', n:3,  title:'Measure in kilograms', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'b4.4',  block:'b4', n:4,  title:'Four operations with mass',
      gen:function(){ var a = R(100,500), b = R(50,300); return q('A bag holds ' + a + 'g. I add ' + b + 'g. What is the mass now?', a + b + 'g'); } },
    { id:'b4.5',  block:'b4', n:5,  title:'Compare volume and capacity',
      gen:function(){ var p = two(100,900); return q('Which holds more, ' + p[0] + 'ml or ' + p[1] + 'ml?', Math.max(p[0], p[1]) + 'ml'); } },
    { id:'b4.6',  block:'b4', n:6,  title:'Measure in millilitres', gen:null, why:'Needs a measuring jug.' },
    { id:'b4.7',  block:'b4', n:7,  title:'Measure in litres', gen:null, why:'Needs a measuring jug.' },
    { id:'b4.8',  block:'b4', n:8,  title:'Four operations with volume and capacity',
      gen:function(){ var a = R(100,900); return q('A jug holds 1 litre. It has ' + a + 'ml in it. How much more fits?', 1000 - a + 'ml'); } },
    { id:'b4.9',  block:'b4', n:9,  title:'Temperature',
      gen:function(){ var a = R(5,25), d = R(2,9); return q('It is ' + a + '°C. It warms by ' + d + '°C. What is the temperature now?', a + d + '°C'); } },

    /* ---- Summer 1 · Fractions ------------------------------ */
    { id:'c1.1',  block:'c1', n:1,  title:'Introduction to parts and whole',
      gen:function(){ var p = R(2,4); return q('A cake is cut into ' + p + ' equal parts. How many parts make the whole?', p); } },
    { id:'c1.2',  block:'c1', n:2,  title:'Equal and unequal parts',
      gen:function(){ return q('A shape is split into ' + R(2,6) + ' parts, all the same size. Are the parts equal or unequal?', 'equal'); } },
    { id:'c1.3',  block:'c1', n:3,  title:'Recognise a half',
      gen:function(){ return q('How many halves make one whole?', 2); } },
    { id:'c1.4',  block:'c1', n:4,  title:'Find a half',
      gen:function(){ return { t:'half', n:R(2,20) }; } },
    { id:'c1.5',  block:'c1', n:5,  title:'Recognise a quarter',
      gen:function(){ return q('How many quarters make one whole?', 4); } },
    { id:'c1.6',  block:'c1', n:6,  title:'Find a quarter',
      gen:function(){ var n = R(1,10)*4; return q('What is a quarter of ' + n + '?', n / 4); } },
    { id:'c1.7',  block:'c1', n:7,  title:'Recognise a third',
      gen:function(){ return q('How many thirds make one whole?', 3); } },
    { id:'c1.8',  block:'c1', n:8,  title:'Find a third',
      gen:function(){ var n = R(1,10)*3; return q('What is a third of ' + n + '?', n / 3); } },
    { id:'c1.9',  block:'c1', n:9,  title:'Find the whole',
      gen:function(){ var h = R(2,12); return q('Half of a number is ' + h + '. What is the number?', h * 2); } },
    { id:'c1.10', block:'c1', n:10, title:'Unit fractions',
      gen:function(){ var d = P([2,3,4]); return q('Which is the unit fraction: 1/' + d + ' or ' + R(2, d) + '/' + d + '?', '1/' + d); } },
    { id:'c1.11', block:'c1', n:11, title:'Non-unit fractions',
      gen:function(){ var n = R(1,10)*4; return q('What is 3/4 of ' + n + '?', n / 4 * 3); } },
    { id:'c1.12', block:'c1', n:12, title:'Recognise the equivalence of a half and two-quarters',
      gen:function(){ return q('2/4 is the same as which fraction?', '1/2'); } },
    { id:'c1.13', block:'c1', n:13, title:'Recognise three-quarters',
      gen:function(){ return q('How many quarters are in three-quarters?', 3); } },
    { id:'c1.14', block:'c1', n:14, title:'Find three-quarters',
      gen:function(){ var n = R(1,8)*4; return q('What is three-quarters of ' + n + '?', n / 4 * 3); } },
    { id:'c1.15', block:'c1', n:15, title:'Count in fractions up to a whole',
      gen:function(){ return q('1/4, 2/4, <span class="gen-blank">?</span>, 4/4', '3/4'); } },

    /* ---- Summer 2 · Time ----------------------------------- */
    { id:'c2.1',  block:'c2', n:1,  title:"O'clock and half past",
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:P([0,30]) }] }; } },
    { id:'c2.2',  block:'c2', n:2,  title:'Quarter past and quarter to',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:P([15,45]) }] }; } },
    { id:'c2.3',  block:'c2', n:3,  title:'Tell the time past the hour',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:P([5,10,15,20,25]) }] }; } },
    { id:'c2.4',  block:'c2', n:4,  title:'Tell the time to the hour',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:P([35,40,45,50,55]) }] }; } },
    { id:'c2.5',  block:'c2', n:5,  title:'Tell the time to 5 minutes',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:P([0,5,10,15,20,25,30,35,40,45,50,55]) }] }; } },
    { id:'c2.6',  block:'c2', n:6,  title:'Minutes in an hour',
      gen:function(){ return P([ q('How many minutes are in an hour?', 60),
                                 q('How many minutes are in half an hour?', 30),
                                 q('How many minutes are in a quarter of an hour?', 15) ]); } },
    { id:'c2.7',  block:'c2', n:7,  title:'Hours in a day',
      gen:function(){ return P([ q('How many hours are in a day?', 24), { t:'future', unit:'day', n:R(1,7) } ]); } },

    /* ---- Summer 3 · Statistics ----------------------------- */
    { id:'c3.1',  block:'c3', n:1,  title:'Make tally charts',
      gen:function(){ var n = R(6,19), f = Math.floor(n/5), r = n % 5;
                      var t = new Array(f + 1).join('||||̸ ') + new Array(r + 1).join('|');
                      return q('What number is this tally?<br><span style="letter-spacing:2px">' + t.trim() + '</span>', n); } },
    { id:'c3.2',  block:'c3', n:2,  title:'Tables', gen:null, why:NEEDS_PICTURE },
    { id:'c3.3',  block:'c3', n:3,  title:'Block diagrams', gen:null, why:NEEDS_PICTURE },
    { id:'c3.4',  block:'c3', n:4,  title:'Draw pictograms (1–1)', gen:null, why:NEEDS_DRAWING },
    { id:'c3.5',  block:'c3', n:5,  title:'Interpret pictograms (1–1)', gen:null, why:NEEDS_PICTURE },
    { id:'c3.6',  block:'c3', n:6,  title:'Draw pictograms (2, 5 and 10)', gen:null, why:NEEDS_DRAWING },
    { id:'c3.7',  block:'c3', n:7,  title:'Interpret pictograms (2, 5 and 10)',
      gen:function(){ var v = P([2,5,10]), s = R(3,8);
                      return q('On a pictogram each picture stands for ' + v + '. What do ' + s + ' pictures show?', v * s); } },

    /* ---- Summer 4 · Position and direction ----------------- */
    { id:'c4.1',  block:'c4', n:1,  title:'Language of position', gen:null, why:NEEDS_PICTURE },
    { id:'c4.2',  block:'c4', n:2,  title:'Describe movement', gen:null, why:NEEDS_PICTURE },
    { id:'c4.3',  block:'c4', n:3,  title:'Describe turns',
      gen:function(){ return P([ q('How many quarter turns make a full turn?', 4),
                                 q('How many quarter turns make a half turn?', 2),
                                 q('A quarter turn clockwise from facing north. Which way are you facing?', 'east') ]); } },
    { id:'c4.4',  block:'c4', n:4,  title:'Describe movement and turns', gen:null, why:NEEDS_PICTURE },
    { id:'c4.5',  block:'c4', n:5,  title:'Shape patterns with turns', gen:null, why:NEEDS_PICTURE }
  ];

  /* ════════════════════════════════════════════════════════
     YEAR 1 — White Rose 2022 schemes of learning, the fourteen
     block documents at assets.whiteroseeducation.com/new-schemes/
     ("Y1 Autumn Block 1 SOL Place value within 10.pdf" and so on).
     Numbers stay within 20 for most of the year, 50 in Spring 3
     and 100 in Summer 4 — never past 100, never below 0.
     ════════════════════════════════════════════════════════ */

  /* n copies of a symbol, spaced so a child can point and count. */
  function y1row(n, ch){ return new Array(n + 1).join((ch || '★') + ' ').trim(); }
  /* A ten frame in text: two rows of five, filled then empty. */
  function y1frame(n){
    var s = '', i;
    for (i = 0; i < 10; i++){ s += (i < n ? '●' : '○') + (i === 4 ? '<br>' : ' '); }
    return '<span style="letter-spacing:3px">' + s.trim() + '</span>';
  }
  /* <, > or = between two numbers, as the answer text. */
  function y1cmp(a, b){ return a < b ? '<' : a > b ? '>' : '='; }
  function y1asc(a){ return a.slice().sort(function (x, y){ return x - y; }); }
  var Y1_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var Y1_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var Y1_ORD = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'];
  var Y1_NAMES = ['Sam','Jo','Eva','Mo','Amir','Rosie','Jack','Kim','Tom','Dora'];

  var Y1_BLOCKS = [
    { year:1, id:'y1.a1', term:'Autumn', n:1, title:'Place value (within 10)' },
    { year:1, id:'y1.a2', term:'Autumn', n:2, title:'Addition and subtraction (within 10)' },
    { year:1, id:'y1.a3', term:'Autumn', n:3, title:'Shape' },
    { year:1, id:'y1.b1', term:'Spring', n:1, title:'Place value (within 20)' },
    { year:1, id:'y1.b2', term:'Spring', n:2, title:'Addition and subtraction (within 20)' },
    { year:1, id:'y1.b3', term:'Spring', n:3, title:'Place value (within 50)' },
    { year:1, id:'y1.b4', term:'Spring', n:4, title:'Length and height' },
    { year:1, id:'y1.b5', term:'Spring', n:5, title:'Mass and volume' },
    { year:1, id:'y1.c1', term:'Summer', n:1, title:'Multiplication and division' },
    { year:1, id:'y1.c2', term:'Summer', n:2, title:'Fractions' },
    { year:1, id:'y1.c3', term:'Summer', n:3, title:'Position and direction' },
    { year:1, id:'y1.c4', term:'Summer', n:4, title:'Place value (within 100)' },
    { year:1, id:'y1.c5', term:'Summer', n:5, title:'Money' },
    { year:1, id:'y1.c6', term:'Summer', n:6, title:'Time' }
  ];

  var Y1_STEPS = [

    /* ---- Autumn 1 · Place value (within 10) ----------------- */
    { id:'y1.a1.1',  block:'y1.a1', n:1,  title:'Sort objects',
      gen:function(){ var g = P([ [['apple','banana','pear','grape','plum'], ['dog','car','sock','chair']],
                                  [['dog','cat','horse','sheep','duck'], ['apple','bus','hat','spoon']],
                                  [['car','bus','train','bike','lorry'], ['pear','cat','cup','shoe']] ]);
                      var three = shuffle(g[0]).slice(0, 3), odd = P(g[1]);
                      return q('Which one does not belong?<br>' + shuffle(three.concat([odd])).join(', '), odd); } },
    { id:'y1.a1.2',  block:'y1.a1', n:2,  title:'Count objects',
      gen:function(){ var n = R(3,10); return q('How many stars?<br>' + y1row(n), n); } },
    { id:'y1.a1.3',  block:'y1.a1', n:3,  title:'Count objects from a larger group',
      gen:function(){ var n = R(3,7); return q('Ring ' + n + ' of the stars.<br>' + y1row(R(n + 2, 10)), n + ' stars ringed'); } },
    { id:'y1.a1.4',  block:'y1.a1', n:4,  title:'Represent objects',
      gen:function(){ var n = R(1,10); return q('How many counters are on the ten frame?<br>' + y1frame(n), n); } },
    { id:'y1.a1.5',  block:'y1.a1', n:5,  title:'Recognise numbers as words',
      gen:function(){ var n = R(1,10);
                      return P([ { t:'words', n:n }, q('Write <b>' + WORDS[n - 1] + '</b> as a number.', n) ]); } },
    { id:'y1.a1.6',  block:'y1.a1', n:6,  title:'Count on from any number',
      gen:function(){ return { t:'seq', start:R(0,6), step:1, len:4, blank:R(1,3) }; } },
    { id:'y1.a1.7',  block:'y1.a1', n:7,  title:'1 more',
      gen:function(){ return { t:'step', n:R(0,9), by:1, dir:'more' }; } },
    { id:'y1.a1.8',  block:'y1.a1', n:8,  title:'Count backwards within 10',
      gen:function(){ return { t:'seq', start:R(4,10), step:-1, len:4, blank:R(1,3) }; } },
    { id:'y1.a1.9',  block:'y1.a1', n:9,  title:'1 less',
      gen:function(){ return { t:'step', n:R(1,10), by:1, dir:'less' }; } },
    { id:'y1.a1.10', block:'y1.a1', n:10, title:'Compare groups by matching',
      gen:function(){ var p = two(2,8);
                      return q('Match them up. Are there more stars or more dots?<br>' + y1row(p[0]) + '<br>' + y1row(p[1], '●'),
                               p[0] > p[1] ? 'stars' : 'dots'); } },
    { id:'y1.a1.11', block:'y1.a1', n:11, title:'Fewer, more, same',
      gen:function(){ var a = R(2,8), b = P([true,false]) ? a : R(2,8);
                      return q('Does A have fewer, more or the same as B?<br>A: ' + y1row(a) + '<br>B: ' + y1row(b),
                               a < b ? 'fewer' : a > b ? 'more' : 'the same'); } },
    { id:'y1.a1.12', block:'y1.a1', n:12, title:'Less than, greater than, equal to',
      gen:function(){ var a = R(0,10), b = P([true,false,false]) ? a : R(0,10);
                      return q('Is ' + a + ' less than, greater than or equal to ' + b + '?',
                               a < b ? 'less than' : a > b ? 'greater than' : 'equal to'); } },
    { id:'y1.a1.13', block:'y1.a1', n:13, title:'Compare numbers',
      gen:function(){ var a = R(0,10), b = P([true,false,false,false]) ? a : R(0,10);
                      return q('&lt;, &gt; or =?<br>' + a + ' <span class="gen-blank">?</span> ' + b, y1cmp(a, b)); } },
    { id:'y1.a1.14', block:'y1.a1', n:14, title:'Order objects and numbers',
      gen:function(){ var a = shuffle([0,1,2,3,4,5,6,7,8,9,10]).slice(0, 3);
                      return q('Put in order, smallest first:<br>' + a.join(', '), y1asc(a).join(', ')); } },
    { id:'y1.a1.15', block:'y1.a1', n:15, title:'The number line',
      gen:function(){ var a = R(0,8);
                      return q('On a number line, which number is between ' + a + ' and ' + (a + 2) + '?', a + 1); } },

    /* ---- Autumn 2 · Addition and subtraction (within 10) ----- */
    { id:'y1.a2.1',  block:'y1.a2', n:1,  title:'Introduce parts and wholes',
      gen:function(){ var a = R(1,6), b = R(1, 10 - a);
                      return q('There are ' + a + ' red cubes and ' + b + ' blue cubes. How many cubes in the whole?', a + b); } },
    { id:'y1.a2.2',  block:'y1.a2', n:2,  title:'Part-whole model',
      gen:function(){ var w = R(4,10), p = R(1, w - 1);
                      return q('Whole: ' + w + '<br>Part: ' + p + ' &nbsp; Part: <span class="gen-blank">?</span>', w - p); } },
    { id:'y1.a2.3',  block:'y1.a2', n:3,  title:'Write number sentences',
      gen:function(){ var a = R(2,6), b = R(1, 10 - a);
                      return q(a + ' red cars and ' + b + ' blue cars. Write the number sentence.', a + ' + ' + b + ' = ' + (a + b)); } },
    { id:'y1.a2.4',  block:'y1.a2', n:4,  title:'Fact families – addition facts',
      gen:function(){ var a = R(1,4), b = R(a + 1, 10 - a);
                      return q(a + ' + ' + b + ' = ' + (a + b) + '<br>' + b + ' + ' + a + ' = <span class="gen-blank">?</span>', a + b); } },
    { id:'y1.a2.5',  block:'y1.a2', n:5,  title:'Number bonds within 10',
      gen:function(){ var s = R(4,9), a = R(0,s); return { t:'missing', a:a, b:s - a, sum:s, blank:P(['a','b']) }; } },
    { id:'y1.a2.6',  block:'y1.a2', n:6,  title:'Systematic number bonds within 10',
      gen:function(){ var s = R(5,10);
                      return q('Carry on the pattern:<br>0 + ' + s + ' = ' + s + ', 1 + ' + (s - 1) + ' = ' + s + ', 2 + ' + (s - 2) + ' = ' + s +
                               ', <span class="gen-blank">?</span> + <span class="gen-blank">?</span> = ' + s, '3 + ' + (s - 3)); } },
    { id:'y1.a2.7',  block:'y1.a2', n:7,  title:'Number bonds to 10',
      gen:function(){ var a = R(0,10); return { t:'missing', a:a, b:10 - a, sum:10, blank:P(['a','b']) }; } },
    { id:'y1.a2.8',  block:'y1.a2', n:8,  title:'Addition – add together',
      gen:function(){ var a = R(1,8); return { t:'arith', a:a, b:R(1, 10 - a), op:'+' }; } },
    { id:'y1.a2.9',  block:'y1.a2', n:9,  title:'Addition – add more',
      gen:function(){ var a = R(2,8), b = R(1, 10 - a);
                      return q('There are ' + a + ' birds in a tree. ' + b + ' more come. How many birds now?', a + b); } },
    { id:'y1.a2.10', block:'y1.a2', n:10, title:'Addition problems',
      gen:function(){ var n = P(Y1_NAMES), a = R(1,7), b = R(1, 10 - a);
                      return q(n + ' has ' + a + ' sweets. Dad gives ' + n + ' ' + b + ' more. How many sweets now?', a + b); } },
    { id:'y1.a2.11', block:'y1.a2', n:11, title:'Find a part',
      gen:function(){ var s = R(4,10), a = R(1, s - 1); return { t:'missing', a:a, b:s - a, sum:s, blank:P(['a','b']) }; } },
    { id:'y1.a2.12', block:'y1.a2', n:12, title:'Subtraction – find a part',
      gen:function(){ var w = R(4,10), r = R(2, w - 1);
                      return q('There are ' + w + ' cubes. ' + r + ' are red and the rest are blue. How many are blue?', w - r); } },
    { id:'y1.a2.13', block:'y1.a2', n:13, title:'Fact families – the eight facts',
      gen:function(){ var a = R(1,4), b = R(a + 1, 10 - a), s = a + b;
                      return P([ q(a + ' + ' + b + ' = ' + s + '<br>' + s + ' − ' + b + ' = <span class="gen-blank">?</span>', a),
                                 q(a + ' + ' + b + ' = ' + s + '<br>' + s + ' − ' + a + ' = <span class="gen-blank">?</span>', b),
                                 q(a + ' + ' + b + ' = ' + s + '<br>' + s + ' = ' + b + ' + <span class="gen-blank">?</span>', a) ]); } },
    { id:'y1.a2.14', block:'y1.a2', n:14, title:'Subtraction – take away/cross out (How many left?)',
      gen:function(){ var w = R(4,9), t = R(1, w - 1);
                      return q('Cross out ' + t + '. How many are left?<br>' + y1row(w), w - t); } },
    { id:'y1.a2.15', block:'y1.a2', n:15, title:'Subtraction – take away (How many left?)',
      gen:function(){ var w = R(3,10), t = R(1, w - 1);
                      return P([ { t:'arith', a:w, b:t, op:'-' },
                                 q('There are ' + w + ' cakes. ' + t + ' are eaten. How many are left?', w - t) ]); } },
    { id:'y1.a2.16', block:'y1.a2', n:16, title:'Subtraction on a number line',
      gen:function(){ var s = R(4,10), j = R(1,4);
                      return q('Start at ' + s + ' on a number line. Jump back ' + j + '. Where do you land?', s - j); } },
    { id:'y1.a2.17', block:'y1.a2', n:17, title:'Add or subtract 1 or 2',
      gen:function(){ var b = R(1,2);
                      return P([true,false]) ? { t:'arith', a:R(0, 10 - b), b:b, op:'+' }
                                             : { t:'arith', a:R(b, 10), b:b, op:'-' }; } },

    /* ---- Autumn 3 · Shape ---------------------------------- */
    { id:'y1.a3.1',  block:'y1.a3', n:1,  title:'Recognise and name 3-D shapes',
      gen:function(){ var s = P([['a ball','sphere'],['a dice','cube'],['a tin of beans','cylinder'],
                                 ['a cereal box','cuboid'],['an ice-cream cone','cone'],['a football','sphere']]);
                      return q('What 3-D shape is ' + s[0] + '?', s[1]); } },
    { id:'y1.a3.2',  block:'y1.a3', n:2,  title:'Sort 3-D shapes',
      gen:function(){ var s = P([['cube','no'],['cuboid','no'],['sphere','yes'],['cylinder','yes'],['cone','yes'],['pyramid','no']]);
                      return q('Can a ' + s[0] + ' roll?', s[1]); } },
    { id:'y1.a3.3',  block:'y1.a3', n:3,  title:'Recognise and name 2-D shapes',
      gen:function(){ var s = P([['3 straight sides','triangle'],['4 equal straight sides','square'],
                                 ['one curved side and no corners','circle'],['2 long sides and 2 short sides','rectangle']]);
                      return q('Which 2-D shape has ' + s[0] + '?', s[1]); } },
    { id:'y1.a3.4',  block:'y1.a3', n:4,  title:'Sort 2-D shapes',
      gen:function(){ var s = P([ [['triangle','square','rectangle'],'circle','has no straight sides'],
                                  [['square','rectangle','circle'],'triangle','has 3 sides'],
                                  [['triangle','circle','triangle'],'rectangle','has 4 sides'] ]);
                      return q('Which shape ' + s[2] + '?<br>' + shuffle(s[0].concat([s[1]])).join(', '), s[1]); } },
    { id:'y1.a3.5',  block:'y1.a3', n:5,  title:'Patterns with 2-D and 3-D shapes',
      gen:function(){ var sh = shuffle(['circle','square','triangle','rectangle','cube','sphere']);
                      var unit = P([ [sh[0], sh[1]], [sh[0], sh[1], sh[2]], [sh[0], sh[0], sh[1]] ]);
                      var shown = R(unit.length + 1, 2 * unit.length + 1), seq = [], i;
                      for (i = 0; i < shown; i++) seq.push(unit[i % unit.length]);
                      return q('What comes next?<br>' + seq.join(', ') + ', <span class="gen-blank">?</span>', unit[shown % unit.length]); } },

    /* ---- Spring 1 · Place value (within 20) ---------------- */
    { id:'y1.b1.1',  block:'y1.b1', n:1,  title:'Count within 20',
      gen:function(){ return P([true,false]) ? { t:'seq', start:R(5,17), step:1, len:4, blank:R(1,3) }
                                             : { t:'seq', start:R(8,20), step:-1, len:4, blank:R(1,3) }; } },
    { id:'y1.b1.2',  block:'y1.b1', n:2,  title:'Understand 10',
      gen:function(){ var a = R(1,9);
                      return P([ q('How many ones make 1 ten?', 10), { t:'missing', a:a, b:10 - a, sum:10, blank:'b' },
                                 q('10 is 1 ten and <span class="gen-blank">?</span> ones.', 0) ]); } },
    { id:'y1.b1.3',  block:'y1.b1', n:3,  title:'Understand 11, 12 and 13',
      gen:function(){ var o = R(1,3);
                      return P([ q('1 ten and ' + o + ' ones is <span class="gen-blank">?</span>', 10 + o),
                                 q((10 + o) + ' = 10 + <span class="gen-blank">?</span>', o) ]); } },
    { id:'y1.b1.4',  block:'y1.b1', n:4,  title:'Understand 14, 15 and 16',
      gen:function(){ var o = R(4,6);
                      return P([ q('1 ten and ' + o + ' ones is <span class="gen-blank">?</span>', 10 + o),
                                 q((10 + o) + ' = 10 + <span class="gen-blank">?</span>', o) ]); } },
    { id:'y1.b1.5',  block:'y1.b1', n:5,  title:'Understand 17, 18 and 19',
      gen:function(){ var o = R(7,9);
                      return P([ q('1 ten and ' + o + ' ones is <span class="gen-blank">?</span>', 10 + o),
                                 q((10 + o) + ' = 10 + <span class="gen-blank">?</span>', o) ]); } },
    { id:'y1.b1.6',  block:'y1.b1', n:6,  title:'Understand 20',
      gen:function(){ return P([ q('How many tens make 20?', 2), q('10 + <span class="gen-blank">?</span> = 20', 10),
                                 q('20 is 2 tens and <span class="gen-blank">?</span> ones.', 0) ]); } },
    { id:'y1.b1.7',  block:'y1.b1', n:7,  title:'1 more and 1 less',
      gen:function(){ return P([true,false]) ? { t:'step', n:R(9,19), by:1, dir:'more' }
                                             : { t:'step', n:R(11,20), by:1, dir:'less' }; } },
    { id:'y1.b1.8',  block:'y1.b1', n:8,  title:'The number line to 20',
      gen:function(){ var a = R(9,18);
                      return q('On a number line, which number is between ' + a + ' and ' + (a + 2) + '?', a + 1); } },
    { id:'y1.b1.9',  block:'y1.b1', n:9,  title:'Use a number line to 20',
      gen:function(){ var s = R(8,16), j = R(2, 20 - s);
                      if (P([true,false])) return q('Start at ' + s + ' on a number line. Jump on ' + j + '. Where do you land?', s + j);
                      s = R(12,20); j = R(2,6);
                      return q('Start at ' + s + ' on a number line. Jump back ' + j + '. Where do you land?', s - j); } },
    { id:'y1.b1.10', block:'y1.b1', n:10, title:'Estimate on a number line to 20',
      gen:function(){ var n = P([1,2,3,4,6,7,8,9,11,12,13,14,16,17,18,19]);
                      if (n < 10) return q('A number line goes from 0 to 10. Is ' + n + ' nearer to 0 or to 10?', n < 5 ? 0 : 10);
                      return q('A number line goes from 10 to 20. Is ' + n + ' nearer to 10 or to 20?', n < 15 ? 10 : 20); } },
    { id:'y1.b1.11', block:'y1.b1', n:11, title:'Compare numbers to 20',
      gen:function(){ var p = two(0,20); return q('&lt;, &gt; or =?<br>' + p[0] + ' <span class="gen-blank">?</span> ' + p[1], y1cmp(p[0], p[1])); } },
    { id:'y1.b1.12', block:'y1.b1', n:12, title:'Order numbers to 20',
      gen:function(){ var a = [], n;
                      while (a.length < 4){ n = R(0,20); if (a.indexOf(n) < 0) a.push(n); }
                      var up = P([true,false]), s = y1asc(a); if (!up) s.reverse();
                      return q('Put in order, ' + (up ? 'smallest' : 'greatest') + ' first:<br>' + a.join(', '), s.join(', ')); } },

    /* ---- Spring 2 · Addition and subtraction (within 20) ----- */
    { id:'y1.b2.1',  block:'y1.b2', n:1,  title:'Add by counting on within 20',
      gen:function(){ var a = R(8,17); return { t:'arith', a:a, b:R(1, Math.min(4, 20 - a)), op:'+' }; } },
    { id:'y1.b2.2',  block:'y1.b2', n:2,  title:'Add ones using number bonds',
      // 1x + y with no crossing of 20: 13 + 4 uses 3 + 4.
      gen:function(){ var x = R(1,8); return { t:'arith', a:10 + x, b:R(1, 9 - x), op:'+' }; } },
    { id:'y1.b2.3',  block:'y1.b2', n:3,  title:'Find and make number bonds to 20',
      gen:function(){ var a = R(1,19); return { t:'missing', a:a, b:20 - a, sum:20, blank:P(['a','b']) }; } },
    { id:'y1.b2.4',  block:'y1.b2', n:4,  title:'Doubles',
      gen:function(){ var n = R(1,10); return P([ q('Double ' + n + '?', n * 2), q(n + ' + ' + n + ' =', n * 2) ]); } },
    { id:'y1.b2.5',  block:'y1.b2', n:5,  title:'Near doubles',
      gen:function(){ var n = R(2,9);
                      return q('If ' + n + ' + ' + n + ' = ' + (2 * n) + ', what is ' + n + ' + ' + (n + 1) + '?', 2 * n + 1); } },
    { id:'y1.b2.6',  block:'y1.b2', n:6,  title:'Subtract ones using number bonds',
      // 1x − y with y ≤ x, so 17 − 4 uses 7 − 4 and never crosses 10.
      gen:function(){ var x = R(2,9); return { t:'arith', a:10 + x, b:R(1, x), op:'-' }; } },
    { id:'y1.b2.7',  block:'y1.b2', n:7,  title:'Subtraction – counting back',
      gen:function(){ var a = R(11,20); return { t:'arith', a:a, b:R(1,4), op:'-' }; } },
    { id:'y1.b2.8',  block:'y1.b2', n:8,  title:'Subtraction – finding the difference',
      gen:function(){ var p = two(3,20), hi = Math.max(p[0], p[1]), lo = Math.min(p[0], p[1]);
                      return q('What is the difference between ' + hi + ' and ' + lo + '?', hi - lo); } },
    { id:'y1.b2.9',  block:'y1.b2', n:9,  title:'Related facts',
      gen:function(){ var a = R(1,5), b = R(1, 9 - a);
                      return P([ q('If ' + a + ' + ' + b + ' = ' + (a + b) + ', what is 1' + a + ' + ' + b + '?', 10 + a + b),
                                 q('If ' + (a + b) + ' − ' + b + ' = ' + a + ', what is 1' + (a + b) + ' − ' + b + '?', 10 + a) ]); } },
    { id:'y1.b2.10', block:'y1.b2', n:10, title:'Missing number problems',
      gen:function(){ var s = R(11,20), a = R(1, s - 1);
                      return P([ { t:'missing', a:a, b:s - a, sum:s, blank:P(['a','b']) },
                                 q('<span class="gen-blank">?</span> − ' + a + ' = ' + (s - a), s) ]); } },

    /* ---- Spring 3 · Place value (within 50) ---------------- */
    { id:'y1.b3.1',  block:'y1.b3', n:1,  title:'Count from 20 to 50',
      gen:function(){ return P([true,false]) ? { t:'seq', start:R(20,47), step:1, len:4, blank:R(1,3) }
                                             : { t:'seq', start:R(23,50), step:-1, len:4, blank:R(1,3) }; } },
    { id:'y1.b3.2',  block:'y1.b3', n:2,  title:'20, 30, 40 and 50',
      gen:function(){ var t = R(2,5);
                      return P([ q('How many tens in ' + t * 10 + '?', t), q(t + ' tens is <span class="gen-blank">?</span>', t * 10),
                                 { t:'seq', start:10 * R(1,2), step:10, len:4, blank:R(1,3) } ]); } },
    { id:'y1.b3.3',  block:'y1.b3', n:3,  title:'Count by making groups of tens',
      gen:function(){ var t = R(2,4), o = R(1,9);
                      return q('There are ' + t + ' groups of ten and ' + o + ' more. How many altogether?', t * 10 + o); } },
    { id:'y1.b3.4',  block:'y1.b3', n:4,  title:'Groups of tens and ones',
      gen:function(){ return { t:'tensones', n:R(2,4) * 10 + R(1,9), part:P(['tens','ones']) }; } },
    { id:'y1.b3.5',  block:'y1.b3', n:5,  title:'Partition into tens and ones',
      gen:function(){ return { t:'partition', n:R(2,4) * 10 + R(1,9) }; } },
    { id:'y1.b3.6',  block:'y1.b3', n:6,  title:'The number line to 50',
      gen:function(){ var a = R(20,47);
                      return q('On a number line, which number is between ' + a + ' and ' + (a + 2) + '?', a + 1); } },
    { id:'y1.b3.7',  block:'y1.b3', n:7,  title:'Estimate on a number line to 50',
      gen:function(){ var t = R(2,4) * 10, o = P([1,2,3,4,6,7,8,9]);
                      return q('Is ' + (t + o) + ' nearer to ' + t + ' or to ' + (t + 10) + '?', o < 5 ? t : t + 10); } },
    { id:'y1.b3.8',  block:'y1.b3', n:8,  title:'1 more, 1 less',
      gen:function(){ return P([true,false]) ? { t:'step', n:R(20,49), by:1, dir:'more' }
                                             : { t:'step', n:R(21,50), by:1, dir:'less' }; } },

    /* ---- Spring 4 · Length and height ---------------------- */
    { id:'y1.b4.1',  block:'y1.b4', n:1,  title:'Compare lengths and heights',
      gen:function(){ var p = two(3,15), w = P(['longer','shorter']);
                      return q('A pencil is ' + p[0] + ' cubes long. A crayon is ' + p[1] + ' cubes long. Which is ' + w + '?',
                               (w === 'longer') === (p[0] > p[1]) ? 'the pencil' : 'the crayon'); } },
    { id:'y1.b4.2',  block:'y1.b4', n:2,  title:'Measure length using objects',
      gen:function(){ var a = R(6,12), b = R(2, a - 1);
                      return q('A book is ' + a + ' paper clips long. A pen is ' + b + ' paper clips long. How many paper clips longer is the book?', a - b); } },
    { id:'y1.b4.3',  block:'y1.b4', n:3,  title:'Measure length in centimetres', gen:null, why:'Needs a ruler and a real object to measure.' },

    /* ---- Spring 5 · Mass and volume ------------------------ */
    { id:'y1.b5.1',  block:'y1.b5', n:1,  title:'Heavier and lighter',
      gen:function(){ var p = P([['an elephant','a mouse'],['a car','a bike'],['a brick','a feather'],['a bag of potatoes','an apple'],['a horse','a cat']]),
                          w = P(['heavier','lighter']), o = shuffle(p);
                      return q('Which is ' + w + ', ' + o[0] + ' or ' + o[1] + '?', w === 'heavier' ? p[0] : p[1]); } },
    { id:'y1.b5.2',  block:'y1.b5', n:2,  title:'Measure mass',
      gen:function(){ var a = R(3,9), b = R(2,9);
                      return q('An apple balances ' + a + ' cubes. A pear balances ' + b + ' cubes. How many cubes balance them both?', a + b); } },
    { id:'y1.b5.3',  block:'y1.b5', n:3,  title:'Compare mass',
      gen:function(){ var p = two(3,15), w = P(['heavier','lighter']);
                      return q('A ball balances ' + p[0] + ' cubes. A toy car balances ' + p[1] + ' cubes. Which is ' + w + '?',
                               (w === 'heavier') === (p[0] > p[1]) ? 'the ball' : 'the toy car'); } },
    { id:'y1.b5.4',  block:'y1.b5', n:4,  title:'Full and empty',
      gen:function(){ var s = P([['A glass with nothing in it is','empty'],['A jug filled right to the top is','full'],
                                 ['A bottle with no water left is','empty'],['A cup filled to the brim is','full']]);
                      return q(s[0] + ' full or empty?', s[1]); } },
    { id:'y1.b5.5',  block:'y1.b5', n:5,  title:'Compare volume',
      gen:function(){ var p = two(2,10), w = P(['more','less']);
                      return q('Jug A has ' + p[0] + ' cups of water. Jug B has ' + p[1] + ' cups. Which jug has ' + w + ' water?',
                               (w === 'more') === (p[0] > p[1]) ? 'Jug A' : 'Jug B'); } },
    { id:'y1.b5.6',  block:'y1.b5', n:6,  title:'Measure capacity',
      gen:function(){ var c = R(5,10), f = R(1, c - 1);
                      return q('A jug holds ' + c + ' cups of water. It has ' + f + ' cups in it. How many more cups will fill it?', c - f); } },
    { id:'y1.b5.7',  block:'y1.b5', n:7,  title:'Compare capacity',
      gen:function(){ var p = two(2,12), w = P(['more','less']);
                      return q('A bucket holds ' + p[0] + ' cups. A bowl holds ' + p[1] + ' cups. Which holds ' + w + '?',
                               (w === 'more') === (p[0] > p[1]) ? 'the bucket' : 'the bowl'); } },

    /* ---- Summer 1 · Multiplication and division ------------- */
    { id:'y1.c1.1',  block:'y1.c1', n:1,  title:'Count in 2s',
      gen:function(){ return { t:'seq', start:2 * R(0,7), step:2, len:4, blank:R(1,3) }; } },
    { id:'y1.c1.2',  block:'y1.c1', n:2,  title:'Count in 10s',
      gen:function(){ return { t:'seq', start:10 * R(0,7), step:10, len:4, blank:R(1,3) }; } },
    { id:'y1.c1.3',  block:'y1.c1', n:3,  title:'Count in 5s',
      gen:function(){ return { t:'seq', start:5 * R(0,7), step:5, len:4, blank:R(1,3) }; } },
    { id:'y1.c1.4',  block:'y1.c1', n:4,  title:'Recognise equal groups',
      gen:function(){ var n = R(2,5), g = [n, n, n], eq = P([true,false]);
                      if (!eq) g[R(0,2)] = n + P([-1,1]);
                      return q('Three plates have ' + g.join(', ') + ' cakes. Are the groups equal?', eq ? 'yes' : 'no'); } },
    { id:'y1.c1.5',  block:'y1.c1', n:5,  title:'Add equal groups',
      gen:function(){ var n = P([2,5,10]), g = R(2,4);
                      return q(new Array(g + 1).join(n + ' + ').slice(0, -3) + ' =', n * g); } },
    { id:'y1.c1.6',  block:'y1.c1', n:6,  title:'Make arrays',
      gen:function(){ var r = R(2,4), c = P([2,5,10]); return q('An array has ' + r + ' rows of ' + c + '. How many altogether?', r * c); } },
    { id:'y1.c1.7',  block:'y1.c1', n:7,  title:'Make doubles',
      gen:function(){ var n = R(1,10); return q('Double ' + n + '?', n * 2); } },
    { id:'y1.c1.8',  block:'y1.c1', n:8,  title:'Make equal groups – grouping',
      gen:function(){ var n = P([2,5,10]), g = R(2,5); return q(n * g + ' put into groups of ' + n + '. How many groups?', g); } },
    { id:'y1.c1.9',  block:'y1.c1', n:9,  title:'Make equal groups – sharing',
      gen:function(){ var g = R(2,4), e = R(1,5); return q(g * e + ' sweets shared equally between ' + g + ' children. How many each?', e); } },

    /* ---- Summer 2 · Fractions ------------------------------ */
    { id:'y1.c2.1',  block:'y1.c2', n:1,  title:'Recognise a half of an object or a shape',
      gen:function(){ return P([ q('A pizza is cut into 2 equal parts. What is each part called?', 'a half'),
                                 q('How many halves make a whole?', 2),
                                 q('A shape is cut into 2 parts that are not the same size. Is each part a half?', 'no') ]); } },
    { id:'y1.c2.2',  block:'y1.c2', n:2,  title:'Find a half of an object or a shape',
      gen:function(){ return P([ q('A cake is cut in half. How many equal pieces are there?', 2),
                                 q('An apple is cut in half. One half is eaten. How many halves are left?', 1),
                                 q('A square is folded in half. How many equal parts are there?', 2) ]); } },
    { id:'y1.c2.3',  block:'y1.c2', n:3,  title:'Recognise a half of a quantity',
      gen:function(){ var h = R(1,8), b = P([h, h + R(1,3)]);
                      return q('There are ' + (h + b) + ' sweets. ' + h + ' are red and ' + b + ' are green. Are half of them red?', h === b ? 'yes' : 'no'); } },
    { id:'y1.c2.4',  block:'y1.c2', n:4,  title:'Find a half of a quantity',
      gen:function(){ var n = 2 * R(1,10); return q('What is half of ' + n + '?', n / 2); } },
    { id:'y1.c2.5',  block:'y1.c2', n:5,  title:'Recognise a quarter of an object or a shape',
      gen:function(){ return P([ q('A pizza is cut into 4 equal parts. What is each part called?', 'a quarter'),
                                 q('How many quarters make a whole?', 4),
                                 q('A shape is cut into 4 parts that are not the same size. Is each part a quarter?', 'no') ]); } },
    { id:'y1.c2.6',  block:'y1.c2', n:6,  title:'Find a quarter of an object or a shape',
      gen:function(){ var e = R(1,3);
                      return P([ q('A square is cut into quarters. How many equal parts are there?', 4),
                                 q('A cake is cut into quarters. ' + e + (e === 1 ? ' quarter is' : ' quarters are') + ' eaten. How many quarters are left?', 4 - e) ]); } },
    { id:'y1.c2.7',  block:'y1.c2', n:7,  title:'Recognise a quarter of a quantity',
      gen:function(){ var e = R(1,5);
                      return P([ q(4 * e + ' counters are put into 4 equal groups. What fraction is one group?', 'a quarter'),
                                 q(4 * e + ' counters are put into 4 equal groups. How many in one quarter?', e) ]); } },
    { id:'y1.c2.8',  block:'y1.c2', n:8,  title:'Find a quarter of a quantity',
      gen:function(){ var n = 4 * R(1,5); return q('What is a quarter of ' + n + '?', n / 4); } },

    /* ---- Summer 3 · Position and direction ----------------- */
    { id:'y1.c3.1',  block:'y1.c3', n:1,  title:'Describe turns',
      gen:function(){ return P([ q('How many quarter turns make a full turn?', 4),
                                 q('How many quarter turns make a half turn?', 2),
                                 q('How many half turns make a full turn?', 2) ]); } },
    { id:'y1.c3.2',  block:'y1.c3', n:2,  title:'Describe position – left and right',
      gen:function(){ var r = shuffle(['cat','dog','hen','pig','cow']).slice(0, 3), side = P(['left','right']);
                      return q('In this row: ' + r.join(', ') + '<br>What is to the ' + side + ' of the ' + r[1] + '?', side === 'left' ? r[0] : r[2]); } },
    { id:'y1.c3.3',  block:'y1.c3', n:3,  title:'Describe position – forwards and backwards',
      gen:function(){ var s = R(6,14), j = R(2,5), f = P([true,false]);
                      return q('Sam is on ' + s + ' on a number track. He moves ' + (f ? 'forwards ' : 'backwards ') + j + '. Where is he now?', f ? s + j : s - j); } },
    { id:'y1.c3.4',  block:'y1.c3', n:4,  title:'Describe position – above and below',
      gen:function(){ var c = shuffle(['red','blue','green','yellow']), on = P([true,false]);
                      return q('In a tower, the ' + c[0] + ' block is ' + (on ? 'on top of' : 'underneath') + ' the ' + c[1] +
                               ' block. Is the ' + c[1] + ' block above or below the ' + c[0] + ' block?', on ? 'below' : 'above'); } },
    { id:'y1.c3.5',  block:'y1.c3', n:5,  title:'Ordinal numbers',
      gen:function(){ var k = R(0,8), r = shuffle(Y1_NAMES).slice(0, 3), i = R(0,2);
                      return P([ q('What comes after ' + Y1_ORD[k] + '?', Y1_ORD[k + 1]),
                                 q('In a race ' + r[0] + ' is 1st, ' + r[1] + ' is 2nd and ' + r[2] + ' is 3rd. Who is ' + Y1_ORD[i] + '?', r[i]) ]); } },

    /* ---- Summer 4 · Place value (within 100) --------------- */
    { id:'y1.c4.1',  block:'y1.c4', n:1,  title:'Count from 50 to 100',
      gen:function(){ return P([true,false]) ? { t:'seq', start:R(50,97), step:1, len:4, blank:R(1,3) }
                                             : { t:'seq', start:R(53,100), step:-1, len:4, blank:R(1,3) }; } },
    { id:'y1.c4.2',  block:'y1.c4', n:2,  title:'Tens to 100',
      gen:function(){ var t = R(1,10);
                      return P([ q('How many tens in ' + t * 10 + '?', t), q(t + ' tens is <span class="gen-blank">?</span>', t * 10) ]); } },
    { id:'y1.c4.3',  block:'y1.c4', n:3,  title:'Partition into tens and ones',
      gen:function(){ return { t:'partition', n:R(5,9) * 10 + R(1,9) }; } },
    { id:'y1.c4.4',  block:'y1.c4', n:4,  title:'The number line to 100',
      gen:function(){ var a = R(50,97), t = R(5,9) * 10;
                      return P([ q('On a number line, which number is between ' + a + ' and ' + (a + 2) + '?', a + 1),
                                 q('Which number is halfway between ' + t + ' and ' + (t + 10) + '?', t + 5) ]); } },
    { id:'y1.c4.5',  block:'y1.c4', n:5,  title:'1 more, 1 less',
      gen:function(){ return P([true,false]) ? { t:'step', n:R(50,99), by:1, dir:'more' }
                                             : { t:'step', n:R(51,100), by:1, dir:'less' }; } },
    { id:'y1.c4.6',  block:'y1.c4', n:6,  title:'Compare numbers with the same number of tens',
      gen:function(){ var t = R(1,9) * 10, p = two(0,9);
                      return q('&lt;, &gt; or =?<br>' + (t + p[0]) + ' <span class="gen-blank">?</span> ' + (t + p[1]), y1cmp(p[0], p[1])); } },
    { id:'y1.c4.7',  block:'y1.c4', n:7,  title:'Compare any two numbers',
      gen:function(){ var p = two(1,100); return q('&lt;, &gt; or =?<br>' + p[0] + ' <span class="gen-blank">?</span> ' + p[1], y1cmp(p[0], p[1])); } },

    /* ---- Summer 5 · Money ---------------------------------- */
    { id:'y1.c5.1',  block:'y1.c5', n:1,  title:'Unitising',
      gen:function(){ var b = R(2,9);
                      return P([ q('A 10p coin is worth the same as how many 1p coins?', 10),
                                 q('A bag holds 10 pencils. How many pencils are in ' + b + ' bags?', b * 10),
                                 q('A box holds 2 shoes. How many shoes are in ' + b + ' boxes?', b * 2) ]); } },
    { id:'y1.c5.2',  block:'y1.c5', n:2,  title:'Recognise coins',
      gen:function(){ var c = shuffle(['1p','2p','5p','10p','20p','50p','£1','£2']).slice(0, 2);
                      var v = function (s){ return s.charAt(0) === '£' ? 100 * +s.slice(1) : +s.slice(0, -1); };
                      return q('Which coin is worth more, ' + c[0] + ' or ' + c[1] + '?', v(c[0]) > v(c[1]) ? c[0] : c[1]); } },
    { id:'y1.c5.3',  block:'y1.c5', n:3,  title:'Recognise notes',
      gen:function(){ var p = two(0,3), n = [5,10,20,50];
                      return q('Which note is worth more, £' + n[p[0]] + ' or £' + n[p[1]] + '?', '£' + Math.max(n[p[0]], n[p[1]])); } },
    { id:'y1.c5.4',  block:'y1.c5', n:4,  title:'Count in coins',
      gen:function(){ var c = P([1,2,5,10]), k = R(2, c === 10 ? 9 : 10);
                      return q('How much are ' + WORDS[k - 1] + ' ' + c + 'p coins?', c * k + 'p'); } },

    /* ---- Summer 6 · Time ----------------------------------- */
    { id:'y1.c6.1',  block:'y1.c6', n:1,  title:'Before and after',
      gen:function(){ var p = P([['breakfast','lunch'],['lunch','dinner'],['putting on socks','putting on shoes'],['waking up','going to school'],['brushing teeth','going to bed']]),
                          w = P(['first','second']), o = shuffle(p);
                      return q('Which comes ' + w + ': ' + o[0] + ' or ' + o[1] + '?', w === 'first' ? p[0] : p[1]); } },
    { id:'y1.c6.2',  block:'y1.c6', n:2,  title:'Days of the week',
      gen:function(){ var i = R(0,6);
                      return P([ q('What day comes after ' + Y1_DAYS[i] + '?', Y1_DAYS[(i + 1) % 7]),
                                 q('What day comes before ' + Y1_DAYS[i] + '?', Y1_DAYS[(i + 6) % 7]),
                                 q('How many days are in a week?', 7) ]); } },
    { id:'y1.c6.3',  block:'y1.c6', n:3,  title:'Months of the year',
      gen:function(){ var i = R(0,11);
                      return P([ q('What month comes after ' + Y1_MONTHS[i] + '?', Y1_MONTHS[(i + 1) % 12]),
                                 q('What month comes before ' + Y1_MONTHS[i] + '?', Y1_MONTHS[(i + 11) % 12]),
                                 q('How many months are in a year?', 12) ]); } },
    { id:'y1.c6.4',  block:'y1.c6', n:4,  title:'Hours, minutes and seconds',
      gen:function(){ var u = shuffle(['1 second','1 minute','1 hour']).slice(0, 2), w = P(['longer','shorter']), rank = { '1 second':0, '1 minute':1, '1 hour':2 };
                      return P([ q('Which is ' + w + ', ' + u[0] + ' or ' + u[1] + '?',
                                   (w === 'longer') === (rank[u[0]] > rank[u[1]]) ? u[0] : u[1]),
                                 q('How many minutes are in an hour?', 60),
                                 q('How many seconds are in a minute?', 60) ]); } },
    { id:'y1.c6.5',  block:'y1.c6', n:5,  title:'Tell the time to the hour',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:0 }] }; } },
    { id:'y1.c6.6',  block:'y1.c6', n:6,  title:'Tell the time to the half hour',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:30 }] }; } }
  ];

  /* ════════════════════════════════════════════════════════
     YEAR 3 — White Rose 2022 small steps, from the published
     "Small steps" pages for Autumn, Spring and Summer.
     Numbers run to 1,000; times-tables are 2, 3, 4, 5, 8 and 10.
     ════════════════════════════════════════════════════════ */

  /* 1000 -> '1,000'. White Rose writes 4-digit numbers with a comma. */
  function y3fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* Whole pence -> '£3.45'. Money is kept in pence so there is no float noise. */
  function y3gbp(p){ var r = p % 100; return '£' + Math.floor(p / 100) + '.' + (r < 10 ? '0' : '') + r; }
  /* 7, 5 -> '7:05' — the 12-hour digital clock Year 3 reads. */
  function y3clock(h, m){ return h + ':' + (m < 10 ? '0' : '') + m; }
  /* 135 -> '2 hours 15 minutes'. */
  function y3hm(mins){
    var h = Math.floor(mins / 60), m = mins % 60, out = [];
    if (h) out.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) out.push(m + (m === 1 ? ' minute' : ' minutes'));
    return out.join(' ');
  }
  /* A 3-digit number with all three digits different and non-zero, so
     "what is the value of the 4?" has exactly one answer. */
  function y3digits(){ var d = shuffle([1,2,3,4,5,6,7,8,9]).slice(0, 3); return d; }
  var Y3_ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  var Y3_PARTS = ['', '', 'halves','thirds','quarters','fifths','sixths','sevenths','eighths','ninths','tenths'];
  var Y3_BLANK = '<span class="gen-blank">?</span>';

  var Y3_BLOCKS = [
    { year:3, id:'y3.a1', term:'Autumn', n:1, title:'Place value' },
    { year:3, id:'y3.a2', term:'Autumn', n:2, title:'Addition and subtraction' },
    { year:3, id:'y3.a3', term:'Autumn', n:3, title:'Multiplication and division A' },
    { year:3, id:'y3.b1', term:'Spring', n:1, title:'Multiplication and division B' },
    { year:3, id:'y3.b2', term:'Spring', n:2, title:'Length and perimeter' },
    { year:3, id:'y3.b3', term:'Spring', n:3, title:'Fractions A' },
    { year:3, id:'y3.b4', term:'Spring', n:4, title:'Mass and capacity' },
    { year:3, id:'y3.c1', term:'Summer', n:1, title:'Fractions B' },
    { year:3, id:'y3.c2', term:'Summer', n:2, title:'Money' },
    { year:3, id:'y3.c3', term:'Summer', n:3, title:'Time' },
    { year:3, id:'y3.c4', term:'Summer', n:4, title:'Shape' },
    { year:3, id:'y3.c5', term:'Summer', n:5, title:'Statistics' }
  ];

  var Y3_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'y3.a1.1',  block:'y3.a1', n:1,  title:'Represent numbers to 100',
      gen:function(){ var t = R(1,9), o = R(1,9); return q('What number has ' + t + ' tens and ' + o + ' ones?', t*10 + o); } },
    { id:'y3.a1.2',  block:'y3.a1', n:2,  title:'Partition numbers to 100',
      gen:function(){ var n = td(); return q(n + ' = ' + (n - n%10) + ' + ' + Y3_BLANK, n % 10); } },
    { id:'y3.a1.3',  block:'y3.a1', n:3,  title:'Number line to 100',
      gen:function(){ var a = R(0,9)*10; return q('Which number is halfway between ' + a + ' and ' + (a + 10) + '?', a + 5); } },
    { id:'y3.a1.4',  block:'y3.a1', n:4,  title:'Hundreds',
      gen:function(){ var h = R(1,9);
                      return P([ q('How many hundreds are in ' + h*100 + '?', h),
                                 q(h*10 + ' tens = ' + Y3_BLANK, h*100) ]); } },
    { id:'y3.a1.5',  block:'y3.a1', n:5,  title:'Represent numbers to 1,000',
      gen:function(){ var h = R(2,9), t = R(0,9), o = R(0,9);
                      return q('What number has ' + h + ' hundreds, ' + t + ' tens and ' + o + ' ones?', h*100 + t*10 + o); } },
    { id:'y3.a1.6',  block:'y3.a1', n:6,  title:'Partition numbers to 1,000',
      gen:function(){ var d = y3digits(), n = d[0]*100 + d[1]*10 + d[2];
                      return q(n + ' = ' + d[0]*100 + ' + ' + Y3_BLANK + ' + ' + d[2], d[1]*10); } },
    // Borrow one hundred: 463 = 300 + 160 + 3.
    { id:'y3.a1.7',  block:'y3.a1', n:7,  title:'Flexible partitioning of numbers to 1,000',
      gen:function(){ var h = R(2,9), t = R(1,9), o = R(1,9), n = h*100 + t*10 + o;
                      return q(n + ' = ' + (h-1)*100 + ' + ' + Y3_BLANK + ' + ' + o, (t + 10)*10); } },
    { id:'y3.a1.8',  block:'y3.a1', n:8,  title:'Hundreds, tens and ones',
      gen:function(){ var d = y3digits(), n = d[0]*100 + d[1]*10 + d[2], i = R(0,2);
                      return q('What is the value of the ' + d[i] + ' in ' + n + '?', d[i] * [100,10,1][i]); } },
    { id:'y3.a1.9',  block:'y3.a1', n:9,  title:'Find 1, 10 or 100 more or less',
      gen:function(){ var n = R(101,899), d = P([1,10,100]), more = P([true,false]);
                      return q(d + ' ' + (more ? 'more' : 'less') + ' than ' + n + '?', more ? n + d : n - d); } },
    { id:'y3.a1.10', block:'y3.a1', n:10, title:'Number line to 1,000',
      gen:function(){ return P([ { t:'seq', start:R(1,6)*100, step:100, len:4, blank:R(1,2) },
                                 { t:'seq', start:R(10,95)*10, step:10, len:4, blank:R(1,2) } ]); } },
    { id:'y3.a1.11', block:'y3.a1', n:11, title:'Estimate on a number line to 1,000',
      gen:function(){ var a = R(0,9)*100; return q('Which number is halfway between ' + a + ' and ' + y3fmt(a + 100) + '?', a + 50); } },
    // Same hundreds digit half the time, so the tens have to be looked at.
    { id:'y3.a1.12', block:'y3.a1', n:12, title:'Compare numbers to 1,000',
      gen:function(){ var h = R(1,9), a = h*100 + R(0,99), b = P([true,false]) ? h*100 + R(0,99) : R(100,999);
                      while (b === a) b = h*100 + R(0,99);
                      return q('&lt;, &gt; or =?<br>' + a + ' ' + Y3_BLANK + ' ' + b, a < b ? '<' : '>'); } },
    { id:'y3.a1.13', block:'y3.a1', n:13, title:'Order numbers to 1,000',
      gen:function(){ var a = shuffle([R(100,399), R(400,699), R(700,999)]);
                      return q('Put in order, smallest first:<br>' + a.join(', '), a.slice().sort(function (x, y){ return x - y; }).join(', ')); } },
    { id:'y3.a1.14', block:'y3.a1', n:14, title:'Count in 50s',
      gen:function(){ return { t:'seq', start:50 * R(1,12), step:50, len:4, blank:R(1,2) }; } },

    /* ---- Autumn 2 · Addition and subtraction ---------------- */
    { id:'y3.a2.1',  block:'y3.a2', n:1,  title:'Apply number bonds within 10',
      gen:function(){ var a = R(1,8), b = R(1, 9 - a), m = P([10,100]);
                      return q('If ' + a + ' + ' + b + ' = ' + (a+b) + ', what is ' + a*m + ' + ' + b*m + '?', (a+b)*m); } },
    { id:'y3.a2.2',  block:'y3.a2', n:2,  title:'Add and subtract 1s',
      gen:function(){ var o = R(1,8), n = R(1,9)*100 + R(0,9)*10 + o;
                      return P([true,false]) ? { t:'arith', a:n, b:R(1, 9 - o), op:'+' }
                                             : { t:'arith', a:n, b:R(1, o), op:'-' }; } },
    { id:'y3.a2.3',  block:'y3.a2', n:3,  title:'Add and subtract 10s',
      gen:function(){ var t = R(1,8), n = R(1,9)*100 + t*10 + R(0,9);
                      return P([true,false]) ? { t:'arith', a:n, b:R(1, 9 - t)*10, op:'+' }
                                             : { t:'arith', a:n, b:R(1, t)*10, op:'-' }; } },
    { id:'y3.a2.4',  block:'y3.a2', n:4,  title:'Add and subtract 100s',
      gen:function(){ var h = R(2,8), n = h*100 + R(0,99);
                      return P([true,false]) ? { t:'arith', a:n, b:R(1, 9 - h)*100, op:'+' }
                                             : { t:'arith', a:n, b:R(1, h - 1)*100, op:'-' }; } },
    { id:'y3.a2.5',  block:'y3.a2', n:5,  title:'Spot the pattern',
      gen:function(){ var a = R(2,7), b = R(1, 9 - a);
                      return P([ q(a + ' + ' + b + ' = ' + (a+b) + '<br>' + a*10 + ' + ' + b*10 + ' = ' + (a+b)*10 + '<br>' + a*100 + ' + ' + b*100 + ' = ' + Y3_BLANK, (a+b)*100),
                                 q((a+b) + ' - ' + a + ' = ' + b + '<br>' + (a+b)*10 + ' - ' + a*10 + ' = ' + b*10 + '<br>' + (a+b)*100 + ' - ' + a*100 + ' = ' + Y3_BLANK, b*100) ]); } },
    { id:'y3.a2.6',  block:'y3.a2', n:6,  title:'Add 1s across a 10',
      gen:function(){ var o = R(3,9), n = R(1,9)*100 + R(0,8)*10 + o; return { t:'arith', a:n, b:R(10 - o, 9), op:'+' }; } },
    { id:'y3.a2.7',  block:'y3.a2', n:7,  title:'Add 10s across a 100',
      gen:function(){ var t = R(3,9), n = R(1,8)*100 + t*10 + R(0,9); return { t:'arith', a:n, b:R(10 - t, 9)*10, op:'+' }; } },
    { id:'y3.a2.8',  block:'y3.a2', n:8,  title:'Subtract 1s across a 10',
      gen:function(){ var o = R(0,7), n = R(1,9)*100 + R(1,9)*10 + o; return { t:'arith', a:n, b:R(o + 1, 9), op:'-' }; } },
    { id:'y3.a2.9',  block:'y3.a2', n:9,  title:'Subtract 10s across a 100',
      gen:function(){ var t = R(0,7), n = R(2,9)*100 + t*10 + R(0,9); return { t:'arith', a:n, b:R(t + 1, 9)*10, op:'-' }; } },
    { id:'y3.a2.10', block:'y3.a2', n:10, title:'Make connections',
      gen:function(){ var a = R(3,9), b = R(11 - a, 9), t = R(1,8)*10;
                      return P([ q('If ' + a + ' + ' + b + ' = ' + (a+b) + ', what is ' + (t + a) + ' + ' + b + '?', t + a + b),
                                 q('If ' + (a+b) + ' - ' + b + ' = ' + a + ', what is ' + (t + a + b) + ' - ' + b + '?', t + a) ]); } },
    /* Column methods: each pair is built digit by digit so the step's
       exchange (or lack of one) is exactly what the child meets. */
    { id:'y3.a2.11', block:'y3.a2', n:11, title:'Add two numbers (no exchange)',
      gen:function(){ var h = R(1,7), t = R(0,8), o = R(0,8);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, 9-h)*100 + R(0, 9-t)*10 + R(1, 9-o), op:'+' }; } },
    { id:'y3.a2.12', block:'y3.a2', n:12, title:'Subtract two numbers (no exchange)',
      gen:function(){ var h = R(2,9), t = R(1,9), o = R(1,9);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, h-1)*100 + R(0, t)*10 + R(0, o), op:'-' }; } },
    { id:'y3.a2.13', block:'y3.a2', n:13, title:'Add two numbers (across a 10)',
      gen:function(){ var h = R(1,7), t = R(0,7), o = R(2,9);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, 9-h)*100 + R(0, 8-t)*10 + R(10-o, 9), op:'+' }; } },
    { id:'y3.a2.14', block:'y3.a2', n:14, title:'Add two numbers (across a 100)',
      gen:function(){ var h = R(1,6), t = R(2,9), o = R(0,8);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, 8-h)*100 + R(10-t, 9)*10 + R(0, 9-o), op:'+' }; } },
    { id:'y3.a2.15', block:'y3.a2', n:15, title:'Subtract two numbers (across a 10)',
      gen:function(){ var h = R(2,9), t = R(1,9), o = R(0,8);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, h-1)*100 + R(0, t-1)*10 + R(o+1, 9), op:'-' }; } },
    { id:'y3.a2.16', block:'y3.a2', n:16, title:'Subtract two numbers (across a 100)',
      gen:function(){ var h = R(2,9), t = R(0,8), o = R(0,9);
                      return { t:'arith', a:h*100 + t*10 + o, b:R(1, h-1)*100 + R(t+1, 9)*10 + R(0, o), op:'-' }; } },
    { id:'y3.a2.17', block:'y3.a2', n:17, title:'Add 2-digit and 3-digit numbers',
      gen:function(){ var a = R(100,899), b = R(11,99); return P([true,false]) ? { t:'arith', a:a, b:b, op:'+' } : { t:'arith', a:b, b:a, op:'+' }; } },
    { id:'y3.a2.18', block:'y3.a2', n:18, title:'Subtract a 2-digit number from a 3-digit number',
      gen:function(){ return { t:'arith', a:R(120,999), b:R(11,99), op:'-' }; } },
    { id:'y3.a2.19', block:'y3.a2', n:19, title:'Complements to 100',
      gen:function(){ var n = R(1,9)*10 + R(1,9); return q(n + ' + ' + Y3_BLANK + ' = 100', 100 - n); } },
    // Each number sits 1–19 from a hundred, so rounding to the nearest 100 is unambiguous.
    { id:'y3.a2.20', block:'y3.a2', n:20, title:'Estimate answers',
      gen:function(){ var x = R(2,5), y = R(1,4), a = x*100 + P([-1,1])*R(1,19), b = y*100 + P([-1,1])*R(1,19);
                      return q('Round to the nearest 100 to estimate:<br>' + a + ' + ' + b, (x*100) + ' + ' + (y*100) + ' = ' + (x+y)*100); } },
    { id:'y3.a2.21', block:'y3.a2', n:21, title:'Inverse operations',
      gen:function(){ var a = R(100,500), b = R(100,400);
                      return P([ q(Y3_BLANK + ' - ' + b + ' = ' + a, a + b), q(Y3_BLANK + ' + ' + b + ' = ' + (a + b), a) ]); } },
    { id:'y3.a2.22', block:'y3.a2', n:22, title:'Make decisions',
      gen:function(){ var a = R(250,800), b = R(100, a - 50), c = R(100,400), d = R(100,400);
                      return P([ q('A shop has ' + a + ' apples. It sells ' + b + '. How many are left?', a - b),
                                 q('A school has ' + c + ' girls and ' + d + ' boys. How many children altogether?', c + d) ]); } },

    /* ---- Autumn 3 · Multiplication and division A ----------- */
    { id:'y3.a3.1',  block:'y3.a3', n:1,  title:'Multiplication – equal groups',
      gen:function(){ var g = R(2,6), n = P([2,3,4,5,10]); return q('There are ' + g + ' groups of ' + n + '. How many altogether?', g*n); } },
    { id:'y3.a3.2',  block:'y3.a3', n:2,  title:'Use arrays',
      gen:function(){ var r = R(2,6), c = P([2,3,4,5,10]); return q('An array has ' + r + ' rows of ' + c + '. How many in total?', r*c); } },
    { id:'y3.a3.3',  block:'y3.a3', n:3,  title:'Multiples of 2',
      gen:function(){ var n = R(11,99); return q('Is ' + n + ' a multiple of 2?', n % 2 ? 'no' : 'yes'); } },
    { id:'y3.a3.4',  block:'y3.a3', n:4,  title:'Multiples of 5 and 10',
      gen:function(){ var n = R(2,19)*5 + P([0,0,R(1,4)]), m = P([5,10]);
                      return q('Is ' + n + ' a multiple of ' + m + '?', n % m ? 'no' : 'yes'); } },
    { id:'y3.a3.5',  block:'y3.a3', n:5,  title:'Sharing and grouping',
      gen:function(){ var n = P([2,3,4,5]), g = R(2,6);
                      return P([ q((n*g) + ' shared equally between ' + g + '. How many each?', n),
                                 q((n*g) + ' put into groups of ' + n + '. How many groups?', g) ]); } },
    { id:'y3.a3.6',  block:'y3.a3', n:6,  title:'Multiply by 3',
      gen:function(){ return { t:'times', base:3, by:R(1,12) }; } },
    { id:'y3.a3.7',  block:'y3.a3', n:7,  title:'Divide by 3',
      gen:function(){ return { t:'divide', base:3, by:R(1,12) }; } },
    { id:'y3.a3.8',  block:'y3.a3', n:8,  title:'The 3 times-table',
      gen:function(){ var b = R(1,12);
                      return P([ { t:'times', base:3, by:b }, { t:'divide', base:3, by:b }, q(Y3_BLANK + ' × 3 = ' + 3*b, b) ]); } },
    { id:'y3.a3.9',  block:'y3.a3', n:9,  title:'Multiply by 4',
      gen:function(){ return { t:'times', base:4, by:R(1,12) }; } },
    { id:'y3.a3.10', block:'y3.a3', n:10, title:'Divide by 4',
      gen:function(){ return { t:'divide', base:4, by:R(1,12) }; } },
    { id:'y3.a3.11', block:'y3.a3', n:11, title:'The 4 times-table',
      gen:function(){ var b = R(1,12);
                      return P([ { t:'times', base:4, by:b }, { t:'divide', base:4, by:b }, q(Y3_BLANK + ' × 4 = ' + 4*b, b) ]); } },
    { id:'y3.a3.12', block:'y3.a3', n:12, title:'Multiply by 8',
      gen:function(){ return { t:'times', base:8, by:R(1,12) }; } },
    { id:'y3.a3.13', block:'y3.a3', n:13, title:'Divide by 8',
      gen:function(){ return { t:'divide', base:8, by:R(1,12) }; } },
    { id:'y3.a3.14', block:'y3.a3', n:14, title:'The 8 times-table',
      gen:function(){ var b = R(1,12);
                      return P([ { t:'times', base:8, by:b }, { t:'divide', base:8, by:b }, q(Y3_BLANK + ' × 8 = ' + 8*b, b) ]); } },
    { id:'y3.a3.15', block:'y3.a3', n:15, title:'The 2, 4 and 8 times-tables',
      gen:function(){ var b = R(1,12), m = P([2,4,8]);
                      return P([ { t:'times', base:m, by:b }, { t:'divide', base:m, by:b },
                                 q('If 2 × ' + b + ' = ' + 2*b + ', what is 4 × ' + b + '?', 4*b) ]); } },

    /* ---- Spring 1 · Multiplication and division B ----------- */
    { id:'y3.b1.1',  block:'y3.b1', n:1,  title:'Multiples of 10',
      gen:function(){ var a = P([2,3,4,5,8]), t = R(2,9)*10;
                      return P([ { t:'arith', a:a, b:t, op:'×' }, q((a*t) + ' ÷ ' + a + ' =', t) ]); } },
    { id:'y3.b1.2',  block:'y3.b1', n:2,  title:'Related calculations',
      gen:function(){ var a = P([2,3,4,5,8]), b = R(2,9);
                      return P([ q('If ' + a + ' × ' + b + ' = ' + a*b + ', what is ' + a + ' × ' + b*10 + '?', a*b*10),
                                 q('If ' + a*b + ' ÷ ' + a + ' = ' + b + ', what is ' + a*b*10 + ' ÷ ' + a + '?', b*10) ]); } },
    { id:'y3.b1.3',  block:'y3.b1', n:3,  title:'Reasoning about multiplication',
      gen:function(){ return { t:'compare', a:P([2,3,4,5,8,10]), aop:'×', b:R(2,10), c:P([2,3,4,5,8,10]), bop:'×', d:R(2,10) }; } },
    { id:'y3.b1.4',  block:'y3.b1', n:4,  title:'Multiply a 2-digit number by a 1-digit number – no exchange',
      gen:function(){ var m = P([2,3,4]), lim = Math.floor(9 / m); return { t:'arith', a:R(1,lim)*10 + R(1,lim), b:m, op:'×' }; } },
    { id:'y3.b1.5',  block:'y3.b1', n:5,  title:'Multiply a 2-digit number by a 1-digit number – with exchange',
      gen:function(){ var m = P([3,4,5,8]), n;
                      do { n = R(12, m === 8 ? 12 : 25); } while ((n % 10) * m < 10);
                      return { t:'arith', a:n, b:m, op:'×' }; } },
    { id:'y3.b1.6',  block:'y3.b1', n:6,  title:'Link multiplication and division',
      gen:function(){ var a = P([3,4,5,8]), b = R(2,12); return q('If ' + b + ' × ' + a + ' = ' + a*b + ', what is ' + a*b + ' ÷ ' + a + '?', b); } },
    // 2 × 34 = 68, so 68 ÷ 2 splits cleanly into 60 ÷ 2 and 8 ÷ 2.
    { id:'y3.b1.7',  block:'y3.b1', n:7,  title:'Divide a 2-digit number by a 1-digit number – no exchange',
      gen:function(){ var d = P([2,3,4]), lim = Math.floor(9 / d), qq = R(1,lim)*10 + R(1,lim);
                      return { t:'divide', base:d, by:qq }; } },
    // Tens digit does not divide exactly (52 ÷ 4 -> 40 + 12), so it has to be re-partitioned.
    { id:'y3.b1.8',  block:'y3.b1', n:8,  title:'Divide a 2-digit number by a 1-digit number – flexible partitioning',
      gen:function(){ var d = P([3,4,5]), qq, n;
                      do { qq = R(11, Math.floor(99 / d)); n = d*qq; } while (Math.floor(n/10) % d === 0);
                      return { t:'divide', base:d, by:qq }; } },
    { id:'y3.b1.9',  block:'y3.b1', n:9,  title:'Divide a 2-digit number by a 1-digit number – with remainders',
      gen:function(){ var d = P([2,3,4,5]), n; do { n = R(13,99); } while (n % d === 0);
                      return q(n + ' ÷ ' + d + ' =', Math.floor(n / d) + ' r ' + (n % d)); } },
    { id:'y3.b1.10', block:'y3.b1', n:10, title:'Scaling',
      gen:function(){ var a = R(2,10), k = P([2,3,4,5]);
                      return q('A tower is ' + a + ' cm tall. Another is ' + k + ' times as tall. How tall is it?', a*k + ' cm'); } },
    { id:'y3.b1.11', block:'y3.b1', n:11, title:'How many ways?',
      gen:function(){ var t = R(2,5), b = R(2,4);
                      return q('There are ' + t + ' tops and ' + b + ' pairs of trousers. How many different outfits can you make?', t*b); } },

    /* ---- Spring 2 · Length and perimeter -------------------- */
    { id:'y3.b2.1',  block:'y3.b2', n:1,  title:'Measure in metres and centimetres', gen:null, why:'Needs a metre stick or tape measure and something real to measure.' },
    { id:'y3.b2.2',  block:'y3.b2', n:2,  title:'Measure in millimetres', gen:null, why:'Needs a ruler and something real to measure.' },
    { id:'y3.b2.3',  block:'y3.b2', n:3,  title:'Measure in centimetres and millimetres', gen:null, why:'Needs a ruler and something real to measure.' },
    { id:'y3.b2.4',  block:'y3.b2', n:4,  title:'Metres, centimetres and millimetres',
      gen:function(){ return P([ q('How many millimetres are in 1 cm?', '10 mm'),
                                 q('How many centimetres are in 1 m?', '100 cm'),
                                 q('How many millimetres are in 1 m?', '1,000 mm') ]); } },
    { id:'y3.b2.5',  block:'y3.b2', n:5,  title:'Equivalent lengths (metres and centimetres)',
      gen:function(){ var m = R(1,9), c = R(1,99);
                      return P([ q(m + ' m = ' + Y3_BLANK + ' cm', m*100 + ' cm'),
                                 q(m + ' m ' + c + ' cm = ' + Y3_BLANK + ' cm', m*100 + c + ' cm') ]); } },
    { id:'y3.b2.6',  block:'y3.b2', n:6,  title:'Equivalent lengths (centimetres and millimetres)',
      gen:function(){ var c = R(1,20), m = R(1,9);
                      return P([ q(c + ' cm = ' + Y3_BLANK + ' mm', c*10 + ' mm'),
                                 q(c + ' cm ' + m + ' mm = ' + Y3_BLANK + ' mm', c*10 + m + ' mm') ]); } },
    { id:'y3.b2.7',  block:'y3.b2', n:7,  title:'Compare lengths',
      gen:function(){ var a = R(101,399), b; do { b = R(101,399); } while (b === a);
                      return q('Which is longer: ' + Math.floor(a/100) + ' m ' + a%100 + ' cm or ' + b + ' cm?',
                               a > b ? Math.floor(a/100) + ' m ' + a%100 + ' cm' : b + ' cm'); } },
    { id:'y3.b2.8',  block:'y3.b2', n:8,  title:'Add lengths',
      gen:function(){ var a = R(15,85), b = R(10,99); return q(a + ' cm + ' + b + ' cm = ' + Y3_BLANK, a + b + ' cm'); } },
    { id:'y3.b2.9',  block:'y3.b2', n:9,  title:'Subtract lengths',
      gen:function(){ var b = R(5,95), a = R(b + 5, 199);
                      return P([ q('1 m - ' + b + ' cm = ' + Y3_BLANK + ' cm', 100 - b + ' cm'),
                                 q(a + ' cm - ' + b + ' cm = ' + Y3_BLANK, a - b + ' cm') ]); } },
    { id:'y3.b2.10', block:'y3.b2', n:10, title:'What is perimeter?',
      gen:function(){ var s = R(2,9);
                      return P([ q('What is the name for the distance all the way around the edge of a shape?', 'perimeter'),
                                 q('A square has sides of ' + s + ' cm. What is its perimeter?', 4*s + ' cm') ]); } },
    { id:'y3.b2.11', block:'y3.b2', n:11, title:'Measure perimeter', gen:null, why:'Needs a drawn shape and a ruler to measure its sides.' },
    { id:'y3.b2.12', block:'y3.b2', n:12, title:'Calculate perimeter',
      gen:function(){ var l = R(3,12), w = R(2, l - 1);
                      return q('A rectangle is ' + l + ' cm long and ' + w + ' cm wide. What is its perimeter?', 2*(l + w) + ' cm'); } },

    /* ---- Spring 3 · Fractions A ----------------------------- */
    { id:'y3.b3.1',  block:'y3.b3', n:1,  title:'Understand the denominators of unit fractions',
      gen:function(){ var d = R(2,10); return q('A pizza is cut into ' + d + ' equal slices. What fraction is one slice?', '1/' + d); } },
    { id:'y3.b3.2',  block:'y3.b3', n:2,  title:'Compare and order unit fractions',
      gen:function(){ var p = two(2,10); return q('Which is bigger, 1/' + p[0] + ' or 1/' + p[1] + '?', '1/' + Math.min(p[0], p[1])); } },
    { id:'y3.b3.3',  block:'y3.b3', n:3,  title:'Understand the numerators of non-unit fractions',
      gen:function(){ var d = R(3,10), n = R(2, d - 1);
                      return q('A bar is split into ' + d + ' equal parts. ' + n + ' parts are shaded. What fraction is shaded?', n + '/' + d); } },
    { id:'y3.b3.4',  block:'y3.b3', n:4,  title:'Understand the whole',
      gen:function(){ var d = R(3,10), n = R(1, d - 1);
                      return P([ q('A shape is split into ' + d + ' equal parts. ' + n + '/' + d + ' is shaded. What fraction is not shaded?', (d - n) + '/' + d),
                                 q('How many ' + Y3_PARTS[d] + ' make one whole?', d) ]); } },
    { id:'y3.b3.5',  block:'y3.b3', n:5,  title:'Compare and order non-unit fractions',
      gen:function(){ var d = R(5,12), p = two(1, d - 1);
                      return q('Which is bigger, ' + p[0] + '/' + d + ' or ' + p[1] + '/' + d + '?', Math.max(p[0], p[1]) + '/' + d); } },
    { id:'y3.b3.6',  block:'y3.b3', n:6,  title:'Fractions and scales',
      gen:function(){ var d = R(2,10); return q('A scale from 0 to 1 is split into ' + d + ' equal parts. What is each part worth?', '1/' + d); } },
    { id:'y3.b3.7',  block:'y3.b3', n:7,  title:'Fractions on a number line',
      gen:function(){ var d = R(3,10), k = R(1, d - 1);
                      return q('A number line from 0 to 1 is split into ' + d + ' equal parts. What fraction is at mark ' + k + ' from 0?', k + '/' + d); } },
    { id:'y3.b3.8',  block:'y3.b3', n:8,  title:'Count in fractions on a number line',
      gen:function(){ var d = R(5,10), s = R(1, d - 3), b = R(1,2), out = [], i;
                      for (i = 0; i < 4; i++) out.push(i === b ? Y3_BLANK : (s + i) + '/' + d);
                      return q(out.join(', '), (s + b) + '/' + d); } },
    { id:'y3.b3.9',  block:'y3.b3', n:9,  title:'Equivalent fractions on a number line',
      gen:function(){ var f = P([[1,2,4],[1,2,6],[1,2,8],[1,2,10],[1,3,6],[2,3,6],[1,4,8],[3,4,8],[1,5,10],[2,5,10]]), k = f[2] / f[1];
                      return q(f[0] + '/' + f[1] + ' = ' + Y3_BLANK + '/' + f[2], f[0]*k); } },
    { id:'y3.b3.10', block:'y3.b3', n:10, title:'Equivalent fractions as bar models',
      gen:function(){ var f = P([[1,2],[1,3],[2,3],[1,4],[3,4],[1,5]]), k = R(2,4);
                      return q(f[0]*k + '/' + f[1]*k + ' = ' + Y3_BLANK + '/' + f[1], f[0]); } },

    /* ---- Spring 4 · Mass and capacity ----------------------- */
    { id:'y3.b4.1',  block:'y3.b4', n:1,  title:'Use scales', gen:null, why:'Reading a scale needs the scale drawn.' },
    { id:'y3.b4.2',  block:'y3.b4', n:2,  title:'Measure mass in grams', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'y3.b4.3',  block:'y3.b4', n:3,  title:'Measure mass in kilograms and grams', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'y3.b4.4',  block:'y3.b4', n:4,  title:'Equivalent masses (kilograms and grams)',
      gen:function(){ var k = R(1,9), g = R(1,9)*100;
                      return P([ q(k + ' kg = ' + Y3_BLANK + ' g', y3fmt(k*1000) + ' g'),
                                 q(k + ' kg ' + g + ' g = ' + Y3_BLANK + ' g', y3fmt(k*1000 + g) + ' g') ]); } },
    { id:'y3.b4.5',  block:'y3.b4', n:5,  title:'Compare mass',
      gen:function(){ var a = R(11,39)*100, b; do { b = R(11,39)*100; } while (b === a);
                      var as = Math.floor(a/1000) + ' kg ' + a%1000 + ' g';
                      if (a % 1000 === 0) as = (a/1000) + ' kg';
                      return q('Which is heavier: ' + as + ' or ' + y3fmt(b) + ' g?', a > b ? as : y3fmt(b) + ' g'); } },
    { id:'y3.b4.6',  block:'y3.b4', n:6,  title:'Add and subtract mass',
      gen:function(){ var a = R(1,6)*50 + 100, b = R(1,8)*50;
                      return P([ q(a + ' g + ' + b + ' g = ' + Y3_BLANK, a + b + ' g'),
                                 q('1 kg - ' + a + ' g = ' + Y3_BLANK + ' g', 1000 - a + ' g') ]); } },
    { id:'y3.b4.7',  block:'y3.b4', n:7,  title:'Measure capacity and volume in millilitres', gen:null, why:'Needs a measuring jug.' },
    { id:'y3.b4.8',  block:'y3.b4', n:8,  title:'Measure capacity and volume in litres and millilitres', gen:null, why:'Needs a measuring jug.' },
    { id:'y3.b4.9',  block:'y3.b4', n:9,  title:'Equivalent capacities and volumes (litres and millilitres)',
      gen:function(){ var l = R(1,9), m = R(1,19)*50;
                      return P([ q(l + ' l = ' + Y3_BLANK + ' ml', y3fmt(l*1000) + ' ml'),
                                 q(l + ' l ' + m + ' ml = ' + Y3_BLANK + ' ml', y3fmt(l*1000 + m) + ' ml') ]); } },
    { id:'y3.b4.10', block:'y3.b4', n:10, title:'Compare capacity and volume',
      gen:function(){ var l = R(1,4), m; do { m = R(5,49)*100; } while (m === l*1000);
                      return q('Which is more: ' + l + ' l or ' + y3fmt(m) + ' ml?', l*1000 > m ? l + ' l' : y3fmt(m) + ' ml'); } },
    { id:'y3.b4.11', block:'y3.b4', n:11, title:'Add and subtract capacity and volume',
      gen:function(){ var a = R(2,9)*50, b = R(1,8)*50;
                      return P([ q(a + ' ml + ' + b + ' ml = ' + Y3_BLANK, a + b + ' ml'),
                                 q('A jug holds 1 l. It has ' + a + ' ml in it. How much more will fit?', 1000 - a + ' ml') ]); } },

    /* ---- Summer 1 · Fractions B ----------------------------- */
    { id:'y3.c1.1',  block:'y3.c1', n:1,  title:'Add fractions',
      gen:function(){ var d = R(4,12), a = R(1, d - 2), b = R(1, d - 1 - a);
                      return q(a + '/' + d + ' + ' + b + '/' + d + ' =', (a + b) + '/' + d); } },
    { id:'y3.c1.2',  block:'y3.c1', n:2,  title:'Subtract fractions',
      gen:function(){ var d = R(4,12), a = R(2, d - 1), b = R(1, a - 1);
                      return q(a + '/' + d + ' - ' + b + '/' + d + ' =', (a - b) + '/' + d); } },
    { id:'y3.c1.3',  block:'y3.c1', n:3,  title:'Partition the whole',
      gen:function(){ var d = R(3,12), a = R(1, d - 1); return q('1 = ' + a + '/' + d + ' + ' + Y3_BLANK, (d - a) + '/' + d); } },
    { id:'y3.c1.4',  block:'y3.c1', n:4,  title:'Unit fractions of a set of objects',
      gen:function(){ var d = P([2,3,4,5,8,10]), k = R(2,10); return q('What is 1/' + d + ' of ' + d*k + '?', k); } },
    { id:'y3.c1.5',  block:'y3.c1', n:5,  title:'Non-unit fractions of a set of objects',
      gen:function(){ var d = P([3,4,5,8,10]), n = R(2, d - 1), k = R(2,10); return q('What is ' + n + '/' + d + ' of ' + d*k + '?', n*k); } },
    { id:'y3.c1.6',  block:'y3.c1', n:6,  title:'Reasoning with fractions of an amount',
      gen:function(){ var d = P([2,3,4,5,10]), k = R(2,12);
                      return q('1/' + d + ' of a number is ' + k + '. What is the number?', d*k); } },

    /* ---- Summer 2 · Money ----------------------------------- */
    { id:'y3.c2.1',  block:'y3.c2', n:1,  title:'Pounds and pence',
      gen:function(){ var l = R(1,9), p = R(1,99);
                      return q('Write ' + l + ' pound' + (l === 1 ? '' : 's') + ' and ' + p + 'p using £.', y3gbp(l*100 + p)); } },
    { id:'y3.c2.2',  block:'y3.c2', n:2,  title:'Convert pounds and pence',
      gen:function(){ var p = R(101,999);
                      return P([ q(p + 'p = £' + Y3_BLANK, y3gbp(p)), q(y3gbp(p) + ' = ' + Y3_BLANK + 'p', p + 'p') ]); } },
    { id:'y3.c2.3',  block:'y3.c2', n:3,  title:'Add money',
      gen:function(){ var a = R(105,450), b = R(105,450); return q(y3gbp(a) + ' + ' + y3gbp(b) + ' =', y3gbp(a + b)); } },
    { id:'y3.c2.4',  block:'y3.c2', n:4,  title:'Subtract money',
      gen:function(){ var a = R(300,950), b = R(105, a - 50); return q(y3gbp(a) + ' - ' + y3gbp(b) + ' =', y3gbp(a - b)); } },
    { id:'y3.c2.5',  block:'y3.c2', n:5,  title:'Find change',
      gen:function(){ var paid = P([100,200,500,1000]), cost = R(Math.floor(paid/4), paid - 5);
                      return q('Something costs ' + (cost < 100 ? cost + 'p' : y3gbp(cost)) + '. I pay with a £' + paid/100 + (paid === 100 ? ' coin' : paid === 200 ? ' coin' : ' note') + '. How much change?',
                               paid - cost < 100 ? (paid - cost) + 'p' : y3gbp(paid - cost)); } },

    /* ---- Summer 3 · Time ------------------------------------ */
    { id:'y3.c3.1',  block:'y3.c3', n:1,  title:'Roman numerals to 12',
      gen:function(){ var n = R(1,12);
                      return P([ q('Write ' + n + ' in Roman numerals.', Y3_ROMAN[n]), q('What number is ' + Y3_ROMAN[n] + '?', n) ]); } },
    { id:'y3.c3.2',  block:'y3.c3', n:2,  title:'Tell the time to 5 minutes',
      gen:function(){ return { t:'clock', items:[{ h:R(1,12), m:R(0,11)*5 }] }; } },
    // The drawn clock has no minute marks, so to-the-minute is asked in words.
    { id:'y3.c3.3',  block:'y3.c3', n:3,  title:'Tell the time to the minute',
      gen:function(){ var h = R(1,12), m; do { m = R(1,29); } while (m % 5 === 0);
                      return P([ q('Write ' + m + ' minutes past ' + h + ' as a digital time.', y3clock(h, m)),
                                 q('Write ' + m + ' minutes to ' + (h % 12 + 1) + ' as a digital time.', y3clock(h, 60 - m)) ]); } },
    { id:'y3.c3.4',  block:'y3.c3', n:4,  title:'Read time on a digital clock',
      gen:function(){ var h = R(1,12), m = R(1,11)*5, nx = h % 12 + 1;
                      var w = m === 15 ? 'quarter past ' + h : m === 30 ? 'half past ' + h : m === 45 ? 'quarter to ' + nx :
                              m < 30 ? m + ' minutes past ' + h : (60 - m) + ' minutes to ' + nx;
                      return q('A digital clock shows ' + y3clock(h, m) + '. Say the time in words.', w); } },
    { id:'y3.c3.5',  block:'y3.c3', n:5,  title:'Use am and pm',
      gen:function(){ var e = P([['eat breakfast at 8:00','am'],['go to bed at 8:00 at night','pm'],['arrive at school at 8:45','am'],
                                 ['eat tea at 5:30','pm'],['go home from school at 3:15','pm'],['wake up at 7:00','am']]);
                      return q('I ' + e[0] + '. Is that am or pm?', e[1]); } },
    { id:'y3.c3.6',  block:'y3.c3', n:6,  title:'Years, months and days',
      gen:function(){ var m = P([['January',31],['March',31],['April',30],['May',31],['June',30],['July',31],
                                 ['August',31],['September',30],['October',31],['November',30],['December',31]]);
                      return P([ q('How many months are in a year?', 12),
                                 q('How many days are in a year that is not a leap year?', 365),
                                 q('How many days are in a leap year?', 366),
                                 q('How many days are in ' + m[0] + '?', m[1]) ]); } },
    { id:'y3.c3.7',  block:'y3.c3', n:7,  title:'Days and hours',
      gen:function(){ var d = R(2,4);
                      return P([ q('How many hours are in a day?', 24),
                                 q('How many hours are in ' + d + ' days?', 24*d),
                                 q(24*d + ' hours = ' + Y3_BLANK + ' days', d) ]); } },
    { id:'y3.c3.8',  block:'y3.c3', n:8,  title:'Hours and minutes – use start and end times',
      gen:function(){ var h = R(1,10), s = R(0,4)*5, l = R(2,7)*5, e = s + l;
                      return q('A lesson starts at ' + y3clock(h, s) + ' and lasts ' + l + ' minutes. What time does it end?', y3clock(h, e)); } },
    { id:'y3.c3.9',  block:'y3.c3', n:9,  title:'Hours and minutes – use durations',
      gen:function(){ var h = R(1,10), s = R(0,4)*5, l = R(2,7)*5;
                      return q('A film starts at ' + y3clock(h, s) + ' and ends at ' + y3clock(h, s + l) + '. How long is it?', l + ' minutes'); } },
    { id:'y3.c3.10', block:'y3.c3', n:10, title:'Minutes and seconds',
      gen:function(){ var m = R(2,5), s = R(1,11)*5;
                      return P([ q('How many seconds are in a minute?', 60),
                                 q(m + ' minutes = ' + Y3_BLANK + ' seconds', 60*m),
                                 q('1 minute ' + s + ' seconds = ' + Y3_BLANK + ' seconds', 60 + s) ]); } },
    { id:'y3.c3.11', block:'y3.c3', n:11, title:'Units of time',
      gen:function(){ var m = R(1,2), s; do { s = R(5,17)*10; } while (s === 60*m);
                      return q('Which is longer: ' + s + ' seconds or ' + m + ' minute' + (m === 1 ? '' : 's') + '?',
                               s > 60*m ? s + ' seconds' : m + ' minute' + (m === 1 ? '' : 's')); } },
    { id:'y3.c3.12', block:'y3.c3', n:12, title:'Solve problems with time',
      gen:function(){ var l = P([15,20,30,45]), n = R(2,4);
                      return q('A lesson lasts ' + l + ' minutes. How long are ' + n + ' lessons altogether?', y3hm(l*n)); } },

    /* ---- Summer 4 · Shape ----------------------------------- */
    { id:'y3.c4.1',  block:'y3.c4', n:1,  title:'Turns and angles',
      gen:function(){ return P([ q('How many right angles make a full turn?', 4),
                                 q('How many right angles make a half turn?', 2),
                                 q('How many right angles make a three-quarter turn?', 3),
                                 q('Face north and make a quarter turn clockwise. Which way are you facing?', 'east'),
                                 q('Face east and make a half turn. Which way are you facing?', 'west') ]); } },
    { id:'y3.c4.2',  block:'y3.c4', n:2,  title:'Right angles',
      gen:function(){ return P([ q('How many right angles does a square have?', 4),
                                 q('How many right angles does a rectangle have?', 4),
                                 q('How many right angles make a straight line?', 2) ]); } },
    { id:'y3.c4.3',  block:'y3.c4', n:3,  title:'Compare angles',
      gen:function(){ return P([ q('What is an angle smaller than a right angle called?', 'acute'),
                                 q('What is an angle bigger than a right angle (but less than a straight line) called?', 'obtuse') ]); } },
    { id:'y3.c4.4',  block:'y3.c4', n:4,  title:'Measure and draw accurately', gen:null, why:NEEDS_DRAWING },
    { id:'y3.c4.5',  block:'y3.c4', n:5,  title:'Horizontal and vertical',
      gen:function(){ var e = P([['a flagpole standing upright','vertical'],['the top of a table','horizontal'],
                                 ['the line where the sea meets the sky','horizontal'],['the side of a door frame','vertical']]);
                      return q('Is ' + e[0] + ' horizontal or vertical?', e[1]); } },
    { id:'y3.c4.6',  block:'y3.c4', n:6,  title:'Parallel and perpendicular',
      gen:function(){ return P([ q('Lines that never meet and stay the same distance apart are called what?', 'parallel'),
                                 q('Lines that meet at a right angle are called what?', 'perpendicular'),
                                 q('How many pairs of parallel sides does a rectangle have?', 2) ]); } },
    { id:'y3.c4.7',  block:'y3.c4', n:7,  title:'Recognise and describe 2-D shapes',
      gen:function(){ var s = P([['triangle',3],['quadrilateral',4],['pentagon',5],['hexagon',6],['octagon',8]]);
                      return P([ q('How many sides does a ' + s[0] + ' have?', s[1]),
                                 q('A 2-D shape has ' + s[1] + ' straight sides. What is it called?', s[0]) ]); } },
    { id:'y3.c4.8',  block:'y3.c4', n:8,  title:'Draw polygons', gen:null, why:NEEDS_DRAWING },
    { id:'y3.c4.9',  block:'y3.c4', n:9,  title:'Recognise and describe 3-D shapes',
      gen:function(){ var s = P(SHAPES_3D.slice(0, 4)), k = P(['faces','edges','vertices']);
                      return P([ q('How many ' + k + ' does a ' + s.name + ' have?', s[k]),
                                 q('Which 3-D shape has 6 square faces?', 'cube') ]); } },
    { id:'y3.c4.10', block:'y3.c4', n:10, title:'Make 3-D shapes', gen:null, why:'Needs straws, cubes or modelling materials to build the shape.' },

    /* ---- Summer 5 · Statistics ------------------------------ */
    { id:'y3.c5.1',  block:'y3.c5', n:1,  title:'Interpret pictograms',
      gen:function(){ var v = P([2,4,10]), s = R(2,6), half = P([true,false]);
                      return q('On a pictogram one symbol stands for ' + v + '. What do ' + s + (half ? ' and a half' : '') + ' symbols show?', v*s + (half ? v/2 : 0)); } },
    { id:'y3.c5.2',  block:'y3.c5', n:2,  title:'Draw pictograms',
      gen:function(){ var v = P([2,4,5,10]), k = R(2,8);
                      return q('One symbol stands for ' + v + '. How many symbols do you draw to show ' + v*k + '?', k); } },
    { id:'y3.c5.3',  block:'y3.c5', n:3,  title:'Interpret bar charts', gen:null, why:NEEDS_PICTURE },
    { id:'y3.c5.4',  block:'y3.c5', n:4,  title:'Draw bar charts', gen:null, why:NEEDS_DRAWING },
    { id:'y3.c5.5',  block:'y3.c5', n:5,  title:'Collect and represent data',
      gen:function(){ var n = R(6,24), f = Math.floor(n/5), r = n % 5;
                      var t = new Array(f + 1).join('||||̸ ') + new Array(r + 1).join('|');
                      return q('What number does this tally show?<br><span style="letter-spacing:2px">' + t.trim() + '</span>', n); } },
    { id:'y3.c5.6',  block:'y3.c5', n:6,  title:'Two-way tables', gen:null, why:'Needs a two-way table to read from.' }
  ];

  /* ════════════════════════════════════════════════════════
     YEAR 4
     ════════════════════════════════════════════════════════ */

  /* ── Year 4 helpers ─────────────────────────────────────── */
  /* 4372 -> '4,372', the way White Rose writes numbers. */
  function y4fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* Decimals are held as whole numbers of tenths or hundredths and only
     turned into a string here, so float noise never reaches a sheet.
     y4dec(347, 2) -> '3.47'; y4dec(40, 2) -> '0.4'; y4dec(30, 1) -> '3'. */
  function y4dec(n, places){
    var s = String(n);
    while (s.length <= places) s = '0' + s;
    var w = s.slice(0, s.length - places), f = s.slice(s.length - places).replace(/0+$/, '');
    return f ? w + '.' + f : w;
  }
  /* Pence -> '£3.05'. Money always keeps two places. */
  function y4gbp(p){ var r = p % 100; return '£' + Math.floor(p / 100) + '.' + (r < 10 ? '0' : '') + r; }
  function y4roman(n){
    var v = [100,90,50,40,10,9,5,4,1], s = ['C','XC','L','XL','X','IX','V','IV','I'], out = '', i;
    for (i = 0; i < v.length; i++) while (n >= v[i]){ out += s[i]; n -= v[i]; }
    return out;
  }
  /* How many columns exchange in a + b, and in a - b (a >= b). */
  function y4carries(a, b){
    var c = 0, n = 0;
    while (a > 0 || b > 0){ var s = a % 10 + b % 10 + c; c = s >= 10 ? 1 : 0; n += c; a = Math.floor(a / 10); b = Math.floor(b / 10); }
    return n;
  }
  function y4borrows(a, b){
    var c = 0, n = 0;
    while (a > 0 || b > 0){ var d = a % 10 - b % 10 - c; c = d < 0 ? 1 : 0; n += c; a = Math.floor(a / 10); b = Math.floor(b / 10); }
    return n;
  }
  /* Two 4-digit numbers whose sum stays within 9,999 (or a > b for
     subtraction) and which need exactly `want` exchanges ('2+' = two or more). */
  function y4pair(op, want){
    var a, b, k, i;
    for (i = 0; i < 2000; i++){
      a = R(1000, 9999); b = R(1000, 9999);
      if (op === '+'){ if (a + b > 9999) continue; k = y4carries(a, b); }
      else { if (a <= b) continue; k = y4borrows(a, b); }
      if (want === '2+' ? k >= 2 : k === want) return [a, b];
    }
    return op === '+' ? [2345, 1432] : [5876, 2341];   // never reached in practice
  }
  /* A mixed number as text: y4mixed(2, 3, 5) -> '2 3/5'; no fraction part -> '2'. */
  function y4mixed(w, n, d){ return n === 0 ? String(w) : (w ? w + ' ' : '') + n + '/' + d; }
  /* 'a' or 'an' before a shape name: an octagon, an equilateral triangle. */
  function y4a(w){ return (/^[aeio]/.test(w) ? 'an ' : 'a ') + w; }
  /* 1 hundred, 3 hundreds. */
  function y4pl(n, w){ return n + ' ' + (n === 1 ? w : w + 's'); }
  var Y4_POLYGONS = [['triangle',3],['quadrilateral',4],['pentagon',5],['hexagon',6],['heptagon',7],['octagon',8],['nonagon',9],['decagon',10]];

  /* ── Blocks, in the order the scheme teaches them ───────── */
  var Y4_BLOCKS = [
    { year:4, id:'y4.a1', term:'Autumn', n:1, title:'Place value' },
    { year:4, id:'y4.a2', term:'Autumn', n:2, title:'Addition and subtraction' },
    { year:4, id:'y4.a3', term:'Autumn', n:3, title:'Area' },
    { year:4, id:'y4.a4', term:'Autumn', n:4, title:'Multiplication and division A' },
    { year:4, id:'y4.b1', term:'Spring', n:1, title:'Multiplication and division B' },
    { year:4, id:'y4.b2', term:'Spring', n:2, title:'Length and perimeter' },
    { year:4, id:'y4.b3', term:'Spring', n:3, title:'Fractions' },
    { year:4, id:'y4.b4', term:'Spring', n:4, title:'Decimals A' },
    { year:4, id:'y4.c1', term:'Summer', n:1, title:'Decimals B' },
    { year:4, id:'y4.c2', term:'Summer', n:2, title:'Money' },
    { year:4, id:'y4.c3', term:'Summer', n:3, title:'Time' },
    { year:4, id:'y4.c4', term:'Summer', n:4, title:'Shape' },
    { year:4, id:'y4.c5', term:'Summer', n:5, title:'Statistics' },
    { year:4, id:'y4.c6', term:'Summer', n:6, title:'Position and direction' }
  ];

  /* ── The steps ──────────────────────────────────────────── */
  var Y4_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'y4.a1.1',  block:'y4.a1', n:1,  title:'Represent numbers to 1,000',
      gen:function(){ var h = R(1,9), t = R(0,9), o = R(1,9);
                      return q('What number has ' + y4pl(h,'hundred') + ', ' + y4pl(t,'ten') + ' and ' + y4pl(o,'one') + '?', h*100 + t*10 + o); } },
    { id:'y4.a1.2',  block:'y4.a1', n:2,  title:'Partition numbers to 1,000',
      gen:function(){ var h = R(1,9), t = R(1,9), o = R(1,9);
                      return q((h*100 + t*10 + o) + ' = ' + h*100 + ' + <span class="gen-blank">?</span> + ' + o, t*10); } },
    { id:'y4.a1.3',  block:'y4.a1', n:3,  title:'Number line to 1,000',
      gen:function(){ var s = P([10,50,100]), st = s * R(1, Math.floor(900 / s) - 4);
                      return { t:'seq', start:st, step:s, len:4, blank:R(1,2) }; } },
    { id:'y4.a1.4',  block:'y4.a1', n:4,  title:'Thousands',
      gen:function(){ var k = R(2,9);
                      return P([ q(y4fmt(k*1000) + ' is how many hundreds?', k*10),
                                 q('How many thousands are in ' + y4fmt(k*1000) + '?', k),
                                 q('How many hundreds make 1,000?', 10) ]); } },
    { id:'y4.a1.5',  block:'y4.a1', n:5,  title:'Represent numbers to 10,000',
      gen:function(){ var th = R(1,9), h = R(0,9), t = R(0,9), o = R(0,9);
                      return q('What number has ' + y4pl(th,'thousand') + ', ' + y4pl(h,'hundred') + ', ' + y4pl(t,'ten') + ' and ' + y4pl(o,'one') + '?',
                               y4fmt(th*1000 + h*100 + t*10 + o)); } },
    { id:'y4.a1.6',  block:'y4.a1', n:6,  title:'Partition numbers to 10,000',
      gen:function(){ var p = [R(1,9)*1000, R(1,9)*100, R(1,9)*10, R(1,9)], k = R(0,3), n = p[0]+p[1]+p[2]+p[3];
                      var parts = p.map(function (x, i){ return i === k ? '<span class="gen-blank">?</span>' : y4fmt(x); });
                      return q(y4fmt(n) + ' = ' + parts.join(' + '), y4fmt(p[k])); } },
    { id:'y4.a1.7',  block:'y4.a1', n:7,  title:'Flexible partitioning of numbers to 10,000',
      // Take one thousand off the thousands part: the rest must hold 1,000 + the remainder.
      gen:function(){ var th = R(2,9), rest = R(101,999), n = th*1000 + rest;
                      return q(y4fmt(n) + ' = ' + y4fmt((th-1)*1000) + ' + <span class="gen-blank">?</span>', y4fmt(1000 + rest)); } },
    { id:'y4.a1.8',  block:'y4.a1', n:8,  title:'Find 1, 10, 100, 1,000 more or less',
      gen:function(){ var n = R(1100,8899), d = P([1,10,100,1000]), more = P([true,false]);
                      return q('What is ' + y4fmt(d) + (more ? ' more' : ' less') + ' than ' + y4fmt(n) + '?', y4fmt(more ? n + d : n - d)); } },
    { id:'y4.a1.9',  block:'y4.a1', n:9,  title:'Number line to 10,000',
      // Built as a string, not 'seq', so the numbers get their commas.
      gen:function(){ var s = P([100,500,1000]), st = s * R(1, Math.floor(9000 / s) - 4), b = R(1,2), out = [], i;
                      for (i = 0; i < 4; i++) out.push(i === b ? '<span class="gen-blank">?</span>' : y4fmt(st + s*i));
                      return q(out.join(', '), y4fmt(st + s*b)); } },
    { id:'y4.a1.10', block:'y4.a1', n:10, title:'Estimate on a number line to 10,000',
      gen:function(){ if (P([true,false])){ var a = R(1,8)*1000;
                        return q('What number is halfway between ' + y4fmt(a) + ' and ' + y4fmt(a + 1000) + '?', y4fmt(a + 500)); }
                      var b = R(10,88)*100;
                      return q('What number is halfway between ' + y4fmt(b) + ' and ' + y4fmt(b + 200) + '?', y4fmt(b + 100)); } },
    { id:'y4.a1.11', block:'y4.a1', n:11, title:'Compare numbers to 10,000',
      gen:function(){ var p = two(1000,9999);
                      return q('&lt;, &gt; or =?<br>' + y4fmt(p[0]) + ' <span class="gen-blank">?</span> ' + y4fmt(p[1]), p[0] < p[1] ? '<' : '>'); } },
    { id:'y4.a1.12', block:'y4.a1', n:12, title:'Order numbers to 10,000',
      gen:function(){ var th = R(2,8), a = shuffle([th*1000 + R(0,999), (th-1)*1000 + R(0,999), (th+1)*1000 + R(0,999)]);
                      return q('Put in order, smallest first:<br>' + a.map(y4fmt).join(', '),
                               a.slice().sort(function (x, y){ return x - y; }).map(y4fmt).join(', ')); } },
    { id:'y4.a1.13', block:'y4.a1', n:13, title:'Roman numerals',
      gen:function(){ var n = R(4,100);
                      return P([true,false]) ? q('Write ' + n + ' in Roman numerals.', y4roman(n))
                                             : q('What number is ' + y4roman(n) + '?', n); } },
    { id:'y4.a1.14', block:'y4.a1', n:14, title:'Round to the nearest 10',
      gen:function(){ var n = R(101,999); while (n % 10 === 0) n = R(101,999);
                      return q('Round ' + n + ' to the nearest 10.', Math.round(n / 10) * 10); } },
    { id:'y4.a1.15', block:'y4.a1', n:15, title:'Round to the nearest 100',
      gen:function(){ var n = R(1001,9899); while (n % 100 === 0) n = R(1001,9899);
                      return q('Round ' + y4fmt(n) + ' to the nearest 100.', y4fmt(Math.round(n / 100) * 100)); } },
    { id:'y4.a1.16', block:'y4.a1', n:16, title:'Round to the nearest 1,000',
      gen:function(){ var n = R(1001,9499); while (n % 1000 === 0) n = R(1001,9499);
                      return q('Round ' + y4fmt(n) + ' to the nearest 1,000.', y4fmt(Math.round(n / 1000) * 1000)); } },
    { id:'y4.a1.17', block:'y4.a1', n:17, title:'Round to the nearest 10, 100 or 1,000',
      gen:function(){ var n = R(1001,9499), to = P([10,100,1000]); while (n % 10 === 0) n = R(1001,9499);
                      return q('Round ' + y4fmt(n) + ' to the nearest ' + y4fmt(to) + '.', y4fmt(Math.round(n / to) * to)); } },

    /* ---- Autumn 2 · Addition and subtraction ---------------- */
    { id:'y4.a2.1',  block:'y4.a2', n:1,  title:'Add and subtract 1s, 10s, 100s and 1,000s',
      // Change one column by an amount that stays inside that column: no exchange.
      gen:function(){ var n = R(1,8)*1000 + R(1,8)*100 + R(1,8)*10 + R(1,8), pv = P([1,10,100,1000]),
                          d = Math.floor(n / pv) % 10, add = P([true,false]), k = add ? R(1, 9 - d) : R(1, d);
                      return q(y4fmt(n) + (add ? ' + ' : ' − ') + y4fmt(k*pv) + ' =', y4fmt(add ? n + k*pv : n - k*pv)); } },
    { id:'y4.a2.2',  block:'y4.a2', n:2,  title:'Add up to two 4-digit numbers – no exchange',
      gen:function(){ var p = y4pair('+', 0); return q(y4fmt(p[0]) + ' + ' + y4fmt(p[1]) + ' =', y4fmt(p[0] + p[1])); } },
    { id:'y4.a2.3',  block:'y4.a2', n:3,  title:'Add two 4-digit numbers – one exchange',
      gen:function(){ var p = y4pair('+', 1); return q(y4fmt(p[0]) + ' + ' + y4fmt(p[1]) + ' =', y4fmt(p[0] + p[1])); } },
    { id:'y4.a2.4',  block:'y4.a2', n:4,  title:'Add two 4-digit numbers – more than one exchange',
      gen:function(){ var p = y4pair('+', '2+'); return q(y4fmt(p[0]) + ' + ' + y4fmt(p[1]) + ' =', y4fmt(p[0] + p[1])); } },
    { id:'y4.a2.5',  block:'y4.a2', n:5,  title:'Subtract two 4-digit numbers – no exchange',
      gen:function(){ var p = y4pair('-', 0); return q(y4fmt(p[0]) + ' − ' + y4fmt(p[1]) + ' =', y4fmt(p[0] - p[1])); } },
    { id:'y4.a2.6',  block:'y4.a2', n:6,  title:'Subtract two 4-digit numbers – one exchange',
      gen:function(){ var p = y4pair('-', 1); return q(y4fmt(p[0]) + ' − ' + y4fmt(p[1]) + ' =', y4fmt(p[0] - p[1])); } },
    { id:'y4.a2.7',  block:'y4.a2', n:7,  title:'Subtract two 4-digit numbers – more than one exchange',
      gen:function(){ var p = y4pair('-', '2+'); return q(y4fmt(p[0]) + ' − ' + y4fmt(p[1]) + ' =', y4fmt(p[0] - p[1])); } },
    { id:'y4.a2.8',  block:'y4.a2', n:8,  title:'Efficient subtraction',
      // Subtracting just under a thousand: the child should adjust, not column-subtract.
      gen:function(){ var a = R(4,9)*1000, b = R(1,3)*1000 - R(1,3);
                      return q(y4fmt(a) + ' − ' + y4fmt(b) + ' =', y4fmt(a - b)); } },
    { id:'y4.a2.9',  block:'y4.a2', n:9,  title:'Estimate answers',
      // Hundreds digit kept away from 4/5 so each number rounds clearly.
      gen:function(){ function near(){ return R(1,4)*1000 + P([0,1,2,3,6,7,8,9])*100 + R(0,99); }
                      var a = near(), b = near();
                      return q('Estimate ' + y4fmt(a) + ' + ' + y4fmt(b) + ' by rounding each number to the nearest 1,000.',
                               y4fmt(Math.round(a / 1000) * 1000 + Math.round(b / 1000) * 1000)); } },
    { id:'y4.a2.10', block:'y4.a2', n:10, title:'Checking strategies',
      gen:function(){ var b = R(1000,4999), c = R(1000,4999), a = b + c;
                      return q(y4fmt(a) + ' − ' + y4fmt(b) + ' = ' + y4fmt(c) + '<br>Write an addition that checks this.',
                               y4fmt(c) + ' + ' + y4fmt(b) + ' = ' + y4fmt(a)); } },

    /* ---- Autumn 3 · Area ----------------------------------- */
    { id:'y4.a3.1',  block:'y4.a3', n:1,  title:'What is area?',
      gen:function(){ var n = R(6,20); return q('A shape is covered by ' + n + ' squares with no gaps. What is its area?', n + ' squares'); } },
    { id:'y4.a3.2',  block:'y4.a3', n:2,  title:'Count squares',
      gen:function(){ var r = R(2,6), c = R(3,8); return q('A rectangle is ' + r + ' rows of ' + c + ' squares. What is its area?', r*c + ' squares'); } },
    { id:'y4.a3.3',  block:'y4.a3', n:3,  title:'Make shapes',
      gen:function(){ var a = R(2,6), b = R(2,6);
                      return q('You make a rectangle with an area of ' + a*b + ' squares. It is ' + a + ' squares wide. How long is it?', b + ' squares'); } },
    { id:'y4.a3.4',  block:'y4.a3', n:4,  title:'Compare areas',
      gen:function(){ var p = two(8,30);
                      return q('Shape A covers ' + p[0] + ' squares. Shape B covers ' + p[1] + ' squares. Which has the greater area?', p[0] > p[1] ? 'A' : 'B'); } },

    /* ---- Autumn 4 · Multiplication and division A ----------- */
    { id:'y4.a4.1',  block:'y4.a4', n:1,  title:'Multiples of 3',
      gen:function(){ var n = R(10,40);
                      return P([ { t:'seq', start:3 * R(2,8), step:3, len:4, blank:R(1,3) },
                                 q('Is ' + n + ' a multiple of 3?', n % 3 ? 'no' : 'yes') ]); } },
    { id:'y4.a4.2',  block:'y4.a4', n:2,  title:'Multiply and divide by 6',
      gen:function(){ return P([ { t:'times', base:6, by:R(1,12) }, { t:'divide', base:6, by:R(1,12) } ]); } },
    { id:'y4.a4.3',  block:'y4.a4', n:3,  title:'6 times-table and division facts',
      gen:function(){ var k = R(2,12); return P([ { t:'times', base:6, by:k }, { t:'divide', base:6, by:k },
                                                  q(k + ' × <span class="gen-blank">?</span> = ' + 6*k, 6) ]); } },
    { id:'y4.a4.4',  block:'y4.a4', n:4,  title:'Multiply and divide by 9',
      gen:function(){ return P([ { t:'times', base:9, by:R(1,12) }, { t:'divide', base:9, by:R(1,12) } ]); } },
    { id:'y4.a4.5',  block:'y4.a4', n:5,  title:'9 times-table and division facts',
      gen:function(){ var k = R(2,12); return P([ { t:'times', base:9, by:k }, { t:'divide', base:9, by:k },
                                                  q(k + ' × <span class="gen-blank">?</span> = ' + 9*k, 9) ]); } },
    { id:'y4.a4.6',  block:'y4.a4', n:6,  title:'The 3, 6 and 9 times-tables',
      gen:function(){ var b = P([3,6,9]); return P([ { t:'times', base:b, by:R(1,12) }, { t:'divide', base:b, by:R(1,12) } ]); } },
    { id:'y4.a4.7',  block:'y4.a4', n:7,  title:'Multiply and divide by 7',
      gen:function(){ return P([ { t:'times', base:7, by:R(1,12) }, { t:'divide', base:7, by:R(1,12) } ]); } },
    { id:'y4.a4.8',  block:'y4.a4', n:8,  title:'7 times-table and division facts',
      gen:function(){ var k = R(2,12); return P([ { t:'times', base:7, by:k }, { t:'divide', base:7, by:k },
                                                  q(k + ' × <span class="gen-blank">?</span> = ' + 7*k, 7) ]); } },
    { id:'y4.a4.9',  block:'y4.a4', n:9,  title:'11 times-table and division facts',
      gen:function(){ return P([ { t:'times', base:11, by:R(1,12) }, { t:'divide', base:11, by:R(1,12) } ]); } },
    { id:'y4.a4.10', block:'y4.a4', n:10, title:'12 times-table and division facts',
      gen:function(){ return P([ { t:'times', base:12, by:R(1,12) }, { t:'divide', base:12, by:R(1,12) } ]); } },
    { id:'y4.a4.11', block:'y4.a4', n:11, title:'Multiply by 1 and 0',
      gen:function(){ var n = R(2,99), z = P([0,1]); return P([ q(n + ' × ' + z + ' =', n*z), q(z + ' × ' + n + ' =', n*z) ]); } },
    { id:'y4.a4.12', block:'y4.a4', n:12, title:'Divide a number by 1 and itself',
      gen:function(){ var n = R(2,99); return P([ q(n + ' ÷ 1 =', n), q(n + ' ÷ ' + n + ' =', 1) ]); } },
    { id:'y4.a4.13', block:'y4.a4', n:13, title:'Multiply three numbers',
      gen:function(){ var a = R(2,5), b = R(2,5), c = P([2,5,10]); return q(a + ' × ' + b + ' × ' + c + ' =', a*b*c); } },

    /* ---- Spring 1 · Multiplication and division B ----------- */
    { id:'y4.b1.1',  block:'y4.b1', n:1,  title:'Factor pairs',
      gen:function(){ var a = R(2,9), b = R(2,9); return q(a*b + ' = ' + a + ' × <span class="gen-blank">?</span>', b); } },
    { id:'y4.b1.2',  block:'y4.b1', n:2,  title:'Use factor pairs',
      // 14 × 5 = 7 × 2 × 5 = 7 × 10: the factor pair of 14 makes it easy.
      gen:function(){ var k = R(6,24); return q((2*k) + ' × 5 = ' + k + ' × 2 × 5 = <span class="gen-blank">?</span>', k*10); } },
    { id:'y4.b1.3',  block:'y4.b1', n:3,  title:'Multiply by 10',
      gen:function(){ var n = R(12,999); return q(n + ' × 10 =', y4fmt(n*10)); } },
    { id:'y4.b1.4',  block:'y4.b1', n:4,  title:'Multiply by 100',
      gen:function(){ var n = R(2,99); return q(n + ' × 100 =', y4fmt(n*100)); } },
    { id:'y4.b1.5',  block:'y4.b1', n:5,  title:'Divide by 10',
      gen:function(){ var n = R(12,999); return q(y4fmt(n*10) + ' ÷ 10 =', n); } },
    { id:'y4.b1.6',  block:'y4.b1', n:6,  title:'Divide by 100',
      gen:function(){ var n = R(2,99); return q(y4fmt(n*100) + ' ÷ 100 =', n); } },
    { id:'y4.b1.7',  block:'y4.b1', n:7,  title:'Related facts – multiplication and division',
      gen:function(){ var a = R(2,9), b = R(2,9);
                      return P([ q(a + ' × ' + b + ' = ' + a*b + ', so ' + a*10 + ' × ' + b + ' =', a*b*10),
                                 q(a + ' × ' + b + ' = ' + a*b + ', so ' + a*b*10 + ' ÷ ' + b + ' =', a*10) ]); } },
    { id:'y4.b1.8',  block:'y4.b1', n:8,  title:'Informal written methods for multiplication',
      gen:function(){ var t = R(1,4), o = R(1,9), m = R(2,6);
                      return q((t*10 + o) + ' × ' + m + ' = ' + t*10 + ' × ' + m + ' + ' + o + ' × ' + m + ' = <span class="gen-blank">?</span>', (t*10 + o)*m); } },
    { id:'y4.b1.9',  block:'y4.b1', n:9,  title:'Multiply a 2-digit number by a 1-digit number',
      gen:function(){ var a = R(12,99), b = R(2,9); return q(a + ' × ' + b + ' =', a*b); } },
    { id:'y4.b1.10', block:'y4.b1', n:10, title:'Multiply a 3-digit number by a 1-digit number',
      gen:function(){ var a = R(102,999), b = R(2,9); return q(a + ' × ' + b + ' =', y4fmt(a*b)); } },
    { id:'y4.b1.11', block:'y4.b1', n:11, title:'Divide a 2-digit number by a 1-digit number (1)',
      // No exchange: each digit divides on its own, e.g. 84 ÷ 4.
      gen:function(){ var d = R(2,4), t = R(1, Math.floor(9 / d)), o = R(1, Math.floor(9 / d));
                      return q((t*d*10 + o*d) + ' ÷ ' + d + ' =', t*10 + o); } },
    { id:'y4.b1.12', block:'y4.b1', n:12, title:'Divide a 2-digit number by a 1-digit number (2)',
      // With an exchange: the tens digit does not divide exactly (e.g. 72 ÷ 3); never a remainder.
      gen:function(){ var d, a, n, i;
                      for (i = 0; i < 200; i++){ d = R(3,8); a = R(11, Math.floor(99 / d)); n = a*d;
                        if (Math.floor(n / 10) % d !== 0 && Math.floor(n / 10) >= d) break; }
                      return q(n + ' ÷ ' + d + ' =', a); } },
    { id:'y4.b1.13', block:'y4.b1', n:13, title:'Divide a 3-digit number by a 1-digit number',
      gen:function(){ var d = R(2,9), a = R(Math.ceil(100 / d), Math.floor(999 / d)); return q(a*d + ' ÷ ' + d + ' =', a); } },
    { id:'y4.b1.14', block:'y4.b1', n:14, title:'Correspondence problems',
      gen:function(){ var a = R(2,6), b = R(2,6);
                      return q('There are ' + a + ' tops and ' + b + ' pairs of trousers. How many different outfits can be made?', a*b); } },
    { id:'y4.b1.15', block:'y4.b1', n:15, title:'Efficient multiplication',
      gen:function(){ var k = R(2,9);
                      return P([ q('25 × ' + k + ' × 4 =', k*100), q(k + ' × 99 =', k*99), q('5 × ' + k + ' × 2 =', k*10) ]); } },

    /* ---- Spring 2 · Length and perimeter ------------------- */
    { id:'y4.b2.1',  block:'y4.b2', n:1,  title:'Measure in kilometres and metres',
      gen:function(){ var k = R(2,9);
                      return P([ q('How many metres are in ' + k + ' km?', y4fmt(k*1000) + ' m'),
                                 q('How many metres are in half a kilometre?', '500 m'),
                                 q('How many metres are in 1 km?', '1,000 m') ]); } },
    { id:'y4.b2.2',  block:'y4.b2', n:2,  title:'Equivalent lengths (kilometres and metres)',
      gen:function(){ var k = R(1,9), m = R(1,9)*100;
                      return P([ q(k + ' km ' + m + ' m = <span class="gen-blank">?</span> m', y4fmt(k*1000 + m) + ' m'),
                                 q(y4fmt(k*1000 + m) + ' m = <span class="gen-blank">?</span> km <span class="gen-blank">?</span> m', k + ' km ' + m + ' m') ]); } },
    { id:'y4.b2.3',  block:'y4.b2', n:3,  title:'Perimeter on a grid', gen:null, why:NEEDS_PICTURE },
    { id:'y4.b2.4',  block:'y4.b2', n:4,  title:'Perimeter of a rectangle',
      gen:function(){ var p = two(2,15); return q('A rectangle is ' + p[0] + ' cm long and ' + p[1] + ' cm wide. What is its perimeter?', 2*(p[0] + p[1]) + ' cm'); } },
    { id:'y4.b2.5',  block:'y4.b2', n:5,  title:'Perimeter of rectilinear shapes', gen:null, why:NEEDS_PICTURE },
    { id:'y4.b2.6',  block:'y4.b2', n:6,  title:'Find missing lengths in rectilinear shapes',
      gen:function(){ var whole = R(8,20), part = R(2, whole - 2);
                      return q('An L-shape has a bottom edge of ' + whole + ' cm. The two top edges add up to the same. One top edge is ' + part + ' cm. How long is the other?', whole - part + ' cm'); } },
    { id:'y4.b2.7',  block:'y4.b2', n:7,  title:'Calculate perimeter of rectilinear shapes',
      // An L-shape (one corner cut out) has the same perimeter as the rectangle around it.
      gen:function(){ var a = R(6,15), b = R(4,10);
                      return q('An L-shape is made by cutting a corner out of a ' + a + ' cm by ' + b + ' cm rectangle. What is its perimeter?', 2*(a + b) + ' cm'); } },
    { id:'y4.b2.8',  block:'y4.b2', n:8,  title:'Perimeter of regular polygons',
      gen:function(){ var s = P(Y4_POLYGONS.slice(2)), l = R(2,12);
                      return q('A regular ' + s[0] + ' has sides of ' + l + ' cm. What is its perimeter?', s[1]*l + ' cm'); } },
    { id:'y4.b2.9',  block:'y4.b2', n:9,  title:'Perimeter of polygons',
      gen:function(){ var a = R(3,9), b = R(4,10), c = R(Math.max(a,b) - Math.min(a,b) + 1, a + b - 1);
                      return q('A triangle has sides of ' + a + ' cm, ' + b + ' cm and ' + c + ' cm. What is its perimeter?', a + b + c + ' cm'); } },

    /* ---- Spring 3 · Fractions ------------------------------ */
    { id:'y4.b3.1',  block:'y4.b3', n:1,  title:'Understand the whole',
      gen:function(){ var d = R(3,10), n = R(1, d-1);
                      return P([ q('How many ' + ['','','halves','thirds','quarters','fifths','sixths','sevenths','eighths','ninths','tenths'][d] + ' make one whole?', d),
                                 q(n + '/' + d + ' of a shape is shaded. What fraction is not shaded?', (d - n) + '/' + d) ]); } },
    { id:'y4.b3.2',  block:'y4.b3', n:2,  title:'Count beyond 1',
      gen:function(){ var d = P([3,5]), s = R(d-2, d), out = [], i, b = 3;
                      for (i = 0; i < 4; i++){ var v = s + i; out.push(i === b ? '<span class="gen-blank">?</span>' : y4mixed(Math.floor(v / d), v % d, d)); }
                      var a = s + b; return q('Count on: ' + out.join(', '), y4mixed(Math.floor(a / d), a % d, d)); } },
    { id:'y4.b3.3',  block:'y4.b3', n:3,  title:'Partition a mixed number',
      gen:function(){ var d = R(3,9), n = R(1, d-1), w = R(1,5);
                      return q(y4mixed(w, n, d) + ' = ' + w + ' + <span class="gen-blank">?</span>', n + '/' + d); } },
    { id:'y4.b3.4',  block:'y4.b3', n:4,  title:'Number lines with mixed numbers',
      gen:function(){ var d = P([3,4,5,8,10]), w = R(1,6), k = R(1, d-1);
                      return q('A number line from ' + w + ' to ' + (w+1) + ' is split into ' + d + ' equal parts. What is mark ' + k + ' after ' + w + '?', y4mixed(w, k, d)); } },
    { id:'y4.b3.5',  block:'y4.b3', n:5,  title:'Compare and order mixed numbers',
      gen:function(){ var d = R(3,9), w = R(1,5), p = two(1, d-1);
                      var a = P([true,false]) ? [y4mixed(w, p[0], d), y4mixed(w, p[1], d), p[0] > p[1]]
                                              : [y4mixed(w, p[0], d), y4mixed(w + 1, p[1], d), false];
                      return q('Which is greater, ' + a[0] + ' or ' + a[1] + '?', a[2] ? a[0] : a[1]); } },
    { id:'y4.b3.6',  block:'y4.b3', n:6,  title:'Understand improper fractions',
      gen:function(){ var d = R(2,8), w = R(2,4);
                      return q('How many ' + ['','','halves','thirds','quarters','fifths','sixths','sevenths','eighths'][d] + ' make ' + w + ' wholes?', w*d); } },
    { id:'y4.b3.7',  block:'y4.b3', n:7,  title:'Convert mixed numbers to improper fractions',
      gen:function(){ var d = R(2,9), n = R(1, d-1), w = R(1,4);
                      return q('Write ' + y4mixed(w, n, d) + ' as an improper fraction.', (w*d + n) + '/' + d); } },
    { id:'y4.b3.8',  block:'y4.b3', n:8,  title:'Convert improper fractions to mixed numbers',
      gen:function(){ var d = R(2,9), n = R(1, d-1), w = R(1,4);
                      return q('Write ' + (w*d + n) + '/' + d + ' as a mixed number.', y4mixed(w, n, d)); } },
    { id:'y4.b3.9',  block:'y4.b3', n:9,  title:'Equivalent fractions on a number line',
      gen:function(){ var f = P([[1,2],[1,4],[3,4],[1,3],[2,3],[1,5]]), m = P([2,3,4]);
                      return q(f[0] + '/' + f[1] + ' = <span class="gen-blank">?</span>/' + f[1]*m, f[0]*m); } },
    { id:'y4.b3.10', block:'y4.b3', n:10, title:'Equivalent fraction families',
      gen:function(){ var d = R(2,6), n = R(1, d-1), m = R(2,5);
                      return P([ q(n + '/' + d + ' = ' + n*m + '/<span class="gen-blank">?</span>', d*m),
                                 q(n + '/' + d + ' = <span class="gen-blank">?</span>/' + d*m, n*m) ]); } },
    { id:'y4.b3.11', block:'y4.b3', n:11, title:'Add two or more fractions',
      gen:function(){ var d = R(8,12), a = R(1,3), b = R(1,3), c = R(1, d - a - b - 1);
                      return P([ q(a + '/' + d + ' + ' + b + '/' + d + ' + ' + c + '/' + d + ' =', (a+b+c) + '/' + d),
                                 q(a + '/' + d + ' + ' + (b+c) + '/' + d + ' =', (a+b+c) + '/' + d) ]); } },
    { id:'y4.b3.12', block:'y4.b3', n:12, title:'Add fractions and mixed numbers',
      gen:function(){ var d = R(4,9), a = R(1, d-2), b = R(1, d-1-a), w = R(1,5);
                      return q(y4mixed(w, a, d) + ' + ' + b + '/' + d + ' =', y4mixed(w, a + b, d)); } },
    { id:'y4.b3.13', block:'y4.b3', n:13, title:'Subtract two fractions',
      gen:function(){ var d = R(4,12), a = R(2, d-1), b = R(1, a-1);
                      return q(a + '/' + d + ' − ' + b + '/' + d + ' =', (a - b) + '/' + d); } },
    { id:'y4.b3.14', block:'y4.b3', n:14, title:'Subtract from whole amounts',
      gen:function(){ var d = R(3,10), n = R(1, d-1), w = R(1,4);
                      return q(w + ' − ' + n + '/' + d + ' =', y4mixed(w - 1, d - n, d)); } },
    { id:'y4.b3.15', block:'y4.b3', n:15, title:'Subtract from mixed numbers',
      gen:function(){ var d = R(4,10), a = R(2, d-1), b = R(1, a-1), w = R(1,5);
                      return q(y4mixed(w, a, d) + ' − ' + b + '/' + d + ' =', y4mixed(w, a - b, d)); } },

    /* ---- Spring 4 · Decimals A ----------------------------- */
    { id:'y4.b4.1',  block:'y4.b4', n:1,  title:'Tenths as fractions',
      gen:function(){ var t = R(1,9);
                      return P([ q('Write 0.' + t + ' as a fraction.', t + '/10'), q('How many tenths make one whole?', 10) ]); } },
    { id:'y4.b4.2',  block:'y4.b4', n:2,  title:'Tenths as decimals',
      gen:function(){ var t = R(1,9); return q('Write ' + t + '/10 as a decimal.', '0.' + t); } },
    { id:'y4.b4.3',  block:'y4.b4', n:3,  title:'Tenths on a place value chart',
      gen:function(){ var o = R(1,9), t = R(1,9); return q(y4pl(o,'one') + ' and ' + y4pl(t,'tenth') + '. What is the number?', o + '.' + t); } },
    { id:'y4.b4.4',  block:'y4.b4', n:4,  title:'Tenths on a number line',
      gen:function(){ var s = R(1,40), b = R(1,2), out = [], i;
                      for (i = 0; i < 4; i++) out.push(i === b ? '<span class="gen-blank">?</span>' : y4dec(s + i, 1));
                      return q('Count in tenths: ' + out.join(', '), y4dec(s + b, 1)); } },
    { id:'y4.b4.5',  block:'y4.b4', n:5,  title:'Divide a 1-digit number by 10',
      gen:function(){ var n = R(1,9); return q(n + ' ÷ 10 =', '0.' + n); } },
    { id:'y4.b4.6',  block:'y4.b4', n:6,  title:'Divide a 2-digit number by 10',
      gen:function(){ var n = R(11,99); while (n % 10 === 0) n = R(11,99); return q(n + ' ÷ 10 =', y4dec(n, 1)); } },
    { id:'y4.b4.7',  block:'y4.b4', n:7,  title:'Hundredths as fractions',
      gen:function(){ var h = R(1,99); while (h % 10 === 0) h = R(1,99);
                      return P([ q('Write ' + y4dec(h, 2) + ' as a fraction.', h + '/100'), q('How many hundredths make one tenth?', 10) ]); } },
    { id:'y4.b4.8',  block:'y4.b4', n:8,  title:'Hundredths as decimals',
      gen:function(){ var h = R(1,99); while (h % 10 === 0) h = R(1,99); return q('Write ' + h + '/100 as a decimal.', y4dec(h, 2)); } },
    { id:'y4.b4.9',  block:'y4.b4', n:9,  title:'Hundredths on a place value chart',
      gen:function(){ var o = R(0,9), t = R(1,9), h = R(1,9);
                      return q(y4pl(o,'one') + ', ' + y4pl(t,'tenth') + ' and ' + y4pl(h,'hundredth') + '. What is the number?', y4dec(o*100 + t*10 + h, 2)); } },
    { id:'y4.b4.10', block:'y4.b4', n:10, title:'Divide a 1- or 2-digit number by 100',
      gen:function(){ var n = P([R(1,9), R(11,99)]); return q(n + ' ÷ 100 =', y4dec(n, 2)); } },

    /* ---- Summer 1 · Decimals B ----------------------------- */
    { id:'y4.c1.1',  block:'y4.c1', n:1,  title:'Make a whole with tenths',
      gen:function(){ var t = R(1,9); return q('0.' + t + ' + <span class="gen-blank">?</span> = 1', y4dec(10 - t, 1)); } },
    { id:'y4.c1.2',  block:'y4.c1', n:2,  title:'Make a whole with hundredths',
      gen:function(){ var h = R(11,89); while (h % 10 === 0) h = R(11,89);
                      return q(y4dec(h, 2) + ' + <span class="gen-blank">?</span> = 1', y4dec(100 - h, 2)); } },
    { id:'y4.c1.3',  block:'y4.c1', n:3,  title:'Partition decimals',
      gen:function(){ var o = R(1,9), t = R(1,9), h = R(1,9), n = o*100 + t*10 + h, k = R(0,2);
                      var parts = [String(o), '0.' + t, '0.0' + h], ans = parts[k];
                      parts[k] = '<span class="gen-blank">?</span>';
                      return q(y4dec(n, 2) + ' = ' + parts.join(' + '), ans); } },
    { id:'y4.c1.4',  block:'y4.c1', n:4,  title:'Flexibly partition decimals',
      // Take one tenth from the tenths part: the rest must hold 0.1 more hundredths.
      gen:function(){ var o = R(1,9), t = R(2,9), h = R(1,9), n = o*100 + t*10 + h;
                      return q(y4dec(n, 2) + ' = ' + o + ' + 0.' + (t-1) + ' + <span class="gen-blank">?</span>', y4dec(10 + h, 2)); } },
    { id:'y4.c1.5',  block:'y4.c1', n:5,  title:'Compare decimals',
      gen:function(){ var a = R(101,999), b = R(101,999); while (b === a) b = R(101,999);
                      // y4dec drops a trailing 0, so 1-dp and 2-dp numbers get compared too (4.3 vs 4.27).
                      return q('&lt;, &gt; or =?<br>' + y4dec(a, 2) + ' <span class="gen-blank">?</span> ' + y4dec(b, 2), a < b ? '<' : '>'); } },
    { id:'y4.c1.6',  block:'y4.c1', n:6,  title:'Order decimals',
      gen:function(){ var w = R(0,5), a = shuffle([w*100 + R(1,30), w*100 + R(31,60), w*100 + R(61,99)]);
                      return q('Put in order, smallest first:<br>' + a.map(function (x){ return y4dec(x, 2); }).join(', '),
                               a.slice().sort(function (x, y){ return x - y; }).map(function (x){ return y4dec(x, 2); }).join(', ')); } },
    { id:'y4.c1.7',  block:'y4.c1', n:7,  title:'Round to the nearest whole number',
      gen:function(){ var n = R(11,199); while (n % 10 === 0) n = R(11,199);
                      return q('Round ' + y4dec(n, 1) + ' to the nearest whole number.', Math.floor((n + 5) / 10)); } },
    { id:'y4.c1.8',  block:'y4.c1', n:8,  title:'Halves and quarters as decimals',
      gen:function(){ var f = P([['1/2','0.5'],['1/4','0.25'],['3/4','0.75']]), w = R(1,5);
                      return P([ q('Write ' + f[0] + ' as a decimal.', f[1]),
                                 q('Write ' + f[1] + ' as a fraction.', f[0]),
                                 q('Write ' + w + ' ' + f[0] + ' as a decimal.', w + f[1].slice(1)) ]); } },

    /* ---- Summer 2 · Money ---------------------------------- */
    { id:'y4.c2.1',  block:'y4.c2', n:1,  title:'Write money using decimals',
      gen:function(){ var l = R(1,9), p = R(1,99); return q('Write ' + y4pl(l,'pound') + ' and ' + p + 'p using a decimal point.', y4gbp(l*100 + p)); } },
    { id:'y4.c2.2',  block:'y4.c2', n:2,  title:'Convert between pounds and pence',
      gen:function(){ var p = R(101,999);
                      return P([ q('How many pence is ' + y4gbp(p) + '?', p + 'p'), q('Write ' + p + 'p in pounds.', y4gbp(p)) ]); } },
    { id:'y4.c2.3',  block:'y4.c2', n:3,  title:'Compare amounts of money',
      gen:function(){ var a = R(101,999), b = R(101,999); while (b === a) b = R(101,999);
                      return q('Which is more, ' + y4gbp(a) + ' or ' + b + 'p?', a > b ? y4gbp(a) : b + 'p'); } },
    { id:'y4.c2.4',  block:'y4.c2', n:4,  title:'Estimate with money',
      // Pence kept away from 50 so each amount rounds clearly.
      gen:function(){ function amt(){ return R(1,8)*100 + P([R(1,35), R(65,99)]); }
                      var a = amt(), b = amt();
                      return P([ q('Round ' + y4gbp(a) + ' to the nearest pound.', '£' + Math.round(a / 100)),
                                 q('Estimate ' + y4gbp(a) + ' + ' + y4gbp(b) + ' to the nearest pound.', '£' + (Math.round(a / 100) + Math.round(b / 100))) ]); } },
    { id:'y4.c2.5',  block:'y4.c2', n:5,  title:'Calculate with money',
      gen:function(){ var a = R(105,495), b = R(105,495), c = R(105,995);
                      return P([ q(y4gbp(a) + ' + ' + y4gbp(b) + ' =', y4gbp(a + b)),
                                 q('I pay for a ' + y4gbp(c) + ' book with a £10 note. What is my change?', y4gbp(1000 - c)) ]); } },
    { id:'y4.c2.6',  block:'y4.c2', n:6,  title:'Solve problems with money',
      gen:function(){ var n = R(2,5), c = R(11,49)*5;
                      return q(n + ' pens cost ' + y4gbp(c) + ' each. How much do they cost altogether?', y4gbp(n*c)); } },

    /* ---- Summer 3 · Time ----------------------------------- */
    { id:'y4.c3.1',  block:'y4.c3', n:1,  title:'Years, months, weeks and days',
      gen:function(){ var k = R(2,9);
                      return P([ q('How many days are in ' + k + ' weeks?', k*7),
                                 q('How many months are in ' + k + ' years?', k*12),
                                 q('How many days are in a leap year?', 366),
                                 q('How many weeks are in a year?', 52) ]); } },
    { id:'y4.c3.2',  block:'y4.c3', n:2,  title:'Hours, minutes and seconds',
      gen:function(){ var k = R(2,9), m = P([15,20,30,45]);
                      return P([ q('How many seconds are in ' + k + ' minutes?', k*60),
                                 q('How many minutes are in ' + k + ' hours?', k*60),
                                 q('How many minutes are in ' + k + ' hours ' + m + ' minutes?', k*60 + m) ]); } },
    { id:'y4.c3.3',  block:'y4.c3', n:3,  title:'Convert between analogue and digital times',
      gen:function(){ var h = R(1,12), m = P([5,10,15,20,25,30,35,40,45,50,55]), next = h % 12 + 1;
                      var w = m === 15 ? 'quarter past ' + h : m === 30 ? 'half past ' + h : m === 45 ? 'quarter to ' + next
                            : m < 30 ? m + ' minutes past ' + h : (60 - m) + ' minutes to ' + next;
                      return q('Write ' + w + ' as a digital time.', h + ':' + (m < 10 ? '0' : '') + m); } },
    { id:'y4.c3.4',  block:'y4.c3', n:4,  title:'Convert to the 24-hour clock',
      gen:function(){ var h = R(1,11), m = R(0,11)*5, pm = P([true,false]), mm = (m < 10 ? '0' : '') + m;
                      var hh = pm ? h + 12 : h;
                      return q('Write ' + h + ':' + mm + (pm ? ' pm' : ' am') + ' as a 24-hour time.', (hh < 10 ? '0' : '') + hh + ':' + mm); } },
    { id:'y4.c3.5',  block:'y4.c3', n:5,  title:'Convert from the 24-hour clock',
      gen:function(){ var hh = R(1,23), m = R(0,11)*5, mm = (m < 10 ? '0' : '') + m;
                      var h = hh > 12 ? hh - 12 : hh, pm = hh >= 12;
                      return q('Write ' + (hh < 10 ? '0' : '') + hh + ':' + mm + ' as a 12-hour time (am or pm).', h + ':' + mm + (pm ? ' pm' : ' am')); } },

    /* ---- Summer 4 · Shape ---------------------------------- */
    { id:'y4.c4.1',  block:'y4.c4', n:1,  title:'Understand angles as turns',
      gen:function(){ var t = P([['a full turn',4],['a half turn',2],['a three-quarter turn',3],['a quarter turn',1]]);
                      return q('How many right angles are in ' + t[0] + '?', t[1]); } },
    { id:'y4.c4.2',  block:'y4.c4', n:2,  title:'Identify angles',
      gen:function(){ return P([ q('An angle smaller than a right angle is called…?', 'acute'),
                                 q('An angle bigger than a right angle but smaller than a straight line is called…?', 'obtuse'),
                                 q('Is a quarter turn an acute, right or obtuse angle?', 'right') ]); } },
    { id:'y4.c4.3',  block:'y4.c4', n:3,  title:'Compare and order angles', gen:null, why:NEEDS_PICTURE },
    { id:'y4.c4.4',  block:'y4.c4', n:4,  title:'Triangles',
      gen:function(){ var t = P([['all three sides equal','equilateral'],['exactly two sides equal','isosceles'],
                                 ['no equal sides','scalene'],['one right angle','right-angled']]);
                      return q('What do we call a triangle with ' + t[0] + '?', t[1]); } },
    { id:'y4.c4.5',  block:'y4.c4', n:5,  title:'Quadrilaterals',
      gen:function(){ var t = P([['exactly one pair of parallel sides','trapezium'],
                                 ['four equal sides and four right angles','square'],
                                 ['four equal sides and no right angles','rhombus'],
                                 ['four right angles and only opposite sides equal','rectangle']]);
                      return q('Name the quadrilateral with ' + t[0] + '.', t[1]); } },
    { id:'y4.c4.6',  block:'y4.c4', n:6,  title:'Polygons',
      gen:function(){ var s = P(Y4_POLYGONS); return q('How many sides does ' + y4a(s[0]) + ' have?', s[1]); } },
    { id:'y4.c4.7',  block:'y4.c4', n:7,  title:'Lines of symmetry',
      gen:function(){ var s = P([['square',4],['rectangle',2],['equilateral triangle',3],['regular pentagon',5],
                                 ['regular hexagon',6],['regular octagon',8],['isosceles triangle',1],['scalene triangle',0]]);
                      return q('How many lines of symmetry does ' + y4a(s[0]) + ' have?', s[1]); } },
    { id:'y4.c4.8',  block:'y4.c4', n:8,  title:'Complete a symmetric figure', gen:null, why:NEEDS_DRAWING },

    /* ---- Summer 5 · Statistics ----------------------------- */
    { id:'y4.c5.1',  block:'y4.c5', n:1,  title:'Interpret charts', gen:null, why:NEEDS_PICTURE },
    { id:'y4.c5.2',  block:'y4.c5', n:2,  title:'Comparison, sum and difference',
      gen:function(){ var p = two(12,48);
                      return P([ q('A bar chart shows ' + p[0] + ' red cars and ' + p[1] + ' blue cars. How many cars altogether?', p[0] + p[1]),
                                 q('A bar chart shows ' + p[0] + ' red cars and ' + p[1] + ' blue cars. What is the difference?', Math.abs(p[0] - p[1])) ]); } },
    { id:'y4.c5.3',  block:'y4.c5', n:3,  title:'Interpret line graphs', gen:null, why:'Needs a line graph to read.' },
    { id:'y4.c5.4',  block:'y4.c5', n:4,  title:'Draw line graphs', gen:null, why:NEEDS_DRAWING },

    /* ---- Summer 6 · Position and direction ----------------- */
    { id:'y4.c6.1',  block:'y4.c6', n:1,  title:'Describe position using coordinates', gen:null, why:'Needs a grid with points on it.' },
    { id:'y4.c6.2',  block:'y4.c6', n:2,  title:'Plot coordinates', gen:null, why:NEEDS_DRAWING },
    { id:'y4.c6.3',  block:'y4.c6', n:3,  title:'Draw 2-D shapes on a grid',
      gen:function(){ var x = R(1,4), y = R(1,4), s = R(2,4);
                      return q('A square has vertices at (' + x + ', ' + y + '), (' + x + ', ' + (y+s) + ') and (' + (x+s) + ', ' + (y+s) + '). Where is the fourth vertex?',
                               '(' + (x+s) + ', ' + y + ')'); } },
    { id:'y4.c6.4',  block:'y4.c6', n:4,  title:'Translate on a grid',
      gen:function(){ var x = R(1,6), y = R(1,6), r = R(1,4), u = R(1,4);
                      return q('The point (' + x + ', ' + y + ') moves ' + r + ' right and ' + u + ' up. What are its new coordinates?', '(' + (x+r) + ', ' + (y+u) + ')'); } },
    { id:'y4.c6.5',  block:'y4.c6', n:5,  title:'Describe translation on a grid',
      gen:function(){ var x = R(1,5), y = R(4,9), r = R(1,4), d = R(1,3);
                      return q('A point moves from (' + x + ', ' + y + ') to (' + (x+r) + ', ' + (y-d) + '). Describe the translation.', r + ' right, ' + d + ' down'); } }
  ];

  /* ════════════════════════════════════════════════════════
     YEAR 5
     ════════════════════════════════════════════════════════ */

  /* ── Year 5 helpers ─────────────────────────────────────
     Numbers to 1,000,000 are printed with commas as White Rose
     writes them. Decimals are always held as whole numbers of
     tenths / hundredths / thousandths and only formatted at the
     end, so 0.1 + 0.2 never prints as 0.30000000000000004. */
  function y5fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* A real minus sign for negative numbers. */
  function y5neg(n){ return n < 0 ? '−' + y5fmt(-n) : y5fmt(n); }
  /* n counted in units of 10^-dp, printed with exactly dp places: y5dec(305, 2) = '3.05'. */
  function y5dec(n, dp){
    var neg = n < 0, s = String(Math.abs(n)), p = Math.pow(10, dp);
    if (!dp) return (neg ? '−' : '') + y5fmt(Math.abs(n));
    while (s.length <= dp) s = '0' + s;
    return (neg ? '−' : '') + y5fmt(Math.floor(Math.abs(n) / p)) + '.' + s.slice(-dp);
  }
  /* The same with trailing zeros dropped: y5num(350, 2) = '3.5', y5num(300, 2) = '3'. */
  function y5num(n, dp){
    var s = y5dec(n, dp);
    return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  }
  function y5gcd(a, b){ while (b){ var t = b; b = a % b; a = t; } return a; }
  /* n/d as a mixed number: 11/4 -> '2 3/4', 8/4 -> '2', 3/4 -> '3/4'. */
  function y5mixed(n, d){
    var w = Math.floor(n / d), r = n % d;
    return r ? (w ? w + ' ' + r + '/' + d : r + '/' + d) : String(w);
  }
  /* An answer for n/d: improper results also shown as a mixed number, and a
     simplified form added when one exists, so the answer page never marks a
     correct unsimplified answer as the only one. mixedOnly skips the improper form. */
  function y5ans(n, d, mixedOnly){
    var g = y5gcd(n, d), s;
    if (n % d === 0) return String(n / d);
    s = (n > d && !mixedOnly) ? n + '/' + d + ' = ' + y5mixed(n, d) : y5mixed(n, d);
    if (g > 1) s += ' (= ' + y5mixed(n / g, d / g) + ')';
    return s;
  }
  function y5roman(n){
    var v = [1000,900,500,400,100,90,50,40,10,9,5,4,1],
        r = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'], s = '', i;
    for (i = 0; i < v.length; i++) while (n >= v[i]){ s += r[i]; n -= v[i]; }
    return s;
  }
  var Y5_ONES = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve',
                 'thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  var Y5_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function y5words99(n){ return n < 20 ? Y5_ONES[n] : Y5_TENS[Math.floor(n/10)] + (n % 10 ? '-' + Y5_ONES[n % 10] : ''); }
  function y5words999(n){
    var h = Math.floor(n / 100), r = n % 100;
    return h ? Y5_ONES[h] + ' hundred' + (r ? ' and ' + y5words99(r) : '') : y5words99(r);
  }
  /* British English, 1 to 999,999: 'three hundred and four thousand and twelve'. */
  function y5words(n){
    var th = Math.floor(n / 1000), r = n % 1000;
    if (!th) return y5words999(r);
    return y5words999(th) + ' thousand' + (r ? (r < 100 ? ' and ' : ' ') + y5words999(r) : '');
  }
  /* A number in [lo, hi] and one of its digits that appears only once in it,
     so "the value of the 7" can never mean two different places. */
  function y5digit(lo, hi){
    for (;;){
      var n = R(lo, hi), s = String(n), i = R(0, s.length - 1), d = s.charAt(i);
      if (d !== '0' && s.indexOf(d) === s.lastIndexOf(d))
        return { n:n, d:+d, value:+d * Math.pow(10, s.length - 1 - i) };
    }
  }
  /* Round a whole number to the nearest p (halves round up). */
  function y5round(n, p){ return Math.floor((n + p / 2) / p) * p; }
  /* Minutes after midnight as a 24-hour time, 14:05. */
  function y5hm(m){ var h = Math.floor(m / 60) % 24, mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  /* 'a square', 'an octagon' — and 'An octagon' at the start of a sentence. */
  function y5a(w, cap){ var a = /^[aeiou]/i.test(w) ? 'an ' : 'a '; return (cap ? a.charAt(0).toUpperCase() + a.slice(1) : a) + w; }
  function y5cmp(a, b){ return a < b ? '<' : a > b ? '>' : '='; }
  var Y5_BLANK = '<span class="gen-blank">?</span>';
  var Y5_PLACE = ['ones','tens','hundreds','thousands','ten thousands','hundred thousands'];
  var Y5_SOLIDS = [
    { name:'cube', faces:6, edges:12, vertices:8 },
    { name:'cuboid', faces:6, edges:12, vertices:8 },
    { name:'square-based pyramid', faces:5, edges:8, vertices:5 },
    { name:'triangular-based pyramid', faces:4, edges:6, vertices:4 },
    { name:'triangular prism', faces:5, edges:9, vertices:6 },
    { name:'pentagonal prism', faces:7, edges:15, vertices:10 },
    { name:'hexagonal prism', faces:8, edges:18, vertices:12 },
    { name:'pentagonal pyramid', faces:6, edges:10, vertices:6 }
  ];
  /* Key fraction / decimal / percentage equivalences Year 5 learns by heart. */
  var Y5_FDP = [
    ['1/2','0.5','50%'], ['1/4','0.25','25%'], ['3/4','0.75','75%'], ['1/5','0.2','20%'],
    ['2/5','0.4','40%'], ['3/5','0.6','60%'], ['4/5','0.8','80%'], ['1/10','0.1','10%'],
    ['3/10','0.3','30%'], ['7/10','0.7','70%'], ['1/20','0.05','5%'], ['1/100','0.01','1%']
  ];

  /* ── Blocks, in the order the scheme teaches them ───────── */
  var Y5_BLOCKS = [
    { year:5, id:'y5.a1', term:'Autumn', n:1, title:'Place value' },
    { year:5, id:'y5.a2', term:'Autumn', n:2, title:'Addition and subtraction' },
    { year:5, id:'y5.a3', term:'Autumn', n:3, title:'Multiplication and division A' },
    { year:5, id:'y5.a4', term:'Autumn', n:4, title:'Fractions A' },
    { year:5, id:'y5.b1', term:'Spring', n:1, title:'Multiplication and division B' },
    { year:5, id:'y5.b2', term:'Spring', n:2, title:'Fractions B' },
    { year:5, id:'y5.b3', term:'Spring', n:3, title:'Decimals and percentages' },
    { year:5, id:'y5.b4', term:'Spring', n:4, title:'Perimeter and area' },
    { year:5, id:'y5.b5', term:'Spring', n:5, title:'Statistics' },
    { year:5, id:'y5.c1', term:'Summer', n:1, title:'Shape' },
    { year:5, id:'y5.c2', term:'Summer', n:2, title:'Position and direction' },
    { year:5, id:'y5.c3', term:'Summer', n:3, title:'Decimals' },
    { year:5, id:'y5.c4', term:'Summer', n:4, title:'Negative numbers' },
    { year:5, id:'y5.c5', term:'Summer', n:5, title:'Converting units' },
    { year:5, id:'y5.c6', term:'Summer', n:6, title:'Volume' }
  ];

  /* ── The steps ──────────────────────────────────────────── */
  var Y5_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'y5.a1.1',  block:'y5.a1', n:1,  title:'Roman numerals to 1,000',
      gen:function(){ var n = R(40,1000);
                      return P([true,false]) ? q('Write ' + y5roman(n) + ' as a number.', n)
                                             : q('Write ' + y5fmt(n) + ' in Roman numerals.', y5roman(n)); } },
    { id:'y5.a1.2',  block:'y5.a1', n:2,  title:'Numbers to 10,000',
      gen:function(){ var x = y5digit(1000,9999); return q('What is the value of the ' + x.d + ' in ' + y5fmt(x.n) + '?', y5fmt(x.value)); } },
    { id:'y5.a1.3',  block:'y5.a1', n:3,  title:'Numbers to 100,000',
      gen:function(){ var x = y5digit(10000,99999); return q('What is the value of the ' + x.d + ' in ' + y5fmt(x.n) + '?', y5fmt(x.value)); } },
    { id:'y5.a1.4',  block:'y5.a1', n:4,  title:'Numbers to 1,000,000',
      gen:function(){ var x = y5digit(100000,999999); return q('What is the value of the ' + x.d + ' in ' + y5fmt(x.n) + '?', y5fmt(x.value)); } },
    { id:'y5.a1.5',  block:'y5.a1', n:5,  title:'Read and write numbers to 1,000,000',
      gen:function(){ var n = R(1,999)*1000 + P([0, R(1,99), R(100,999)]);
                      return q('Write in digits:<br>' + y5words(n), y5fmt(n)); } },
    { id:'y5.a1.6',  block:'y5.a1', n:6,  title:'Powers of 10',
      gen:function(){ var i = R(0,4), j = R(i+1,6);
                      return q('How many ' + y5fmt(Math.pow(10,i)) + 's make ' + y5fmt(Math.pow(10,j)) + '?', y5fmt(Math.pow(10, j-i))); } },
    { id:'y5.a1.7',  block:'y5.a1', n:7,  title:'10/100/1,000/10,000/100,000 more or less',
      gen:function(){ var n = R(100000,899999), p = P([10,100,1000,10000,100000]), up = P([true,false]);
                      return q('What is ' + y5fmt(p) + (up ? ' more' : ' less') + ' than ' + y5fmt(n) + '?', y5fmt(up ? n + p : n - p)); } },
    { id:'y5.a1.8',  block:'y5.a1', n:8,  title:'Partition numbers to 1,000,000',
      // Every digit 1-9 so no part is a "+ 0" the child has to invent.
      gen:function(){ var parts = [], i, b = R(1,5), n = 0;
                      for (i = 5; i >= 0; i--){ parts.push(R(1,9) * Math.pow(10,i)); n += parts[parts.length-1]; }
                      var ans = parts[b];
                      return q(y5fmt(n) + ' = ' + parts.map(function (p, k){ return k === b ? Y5_BLANK : y5fmt(p); }).join(' + '), y5fmt(ans)); } },
    { id:'y5.a1.9',  block:'y5.a1', n:9,  title:'Number line to 1,000,000',
      gen:function(){ var s = P([10000,100000]), a = R(1, s === 100000 ? 8 : 98) * s;
                      return q('What number is halfway between ' + y5fmt(a) + ' and ' + y5fmt(a + s) + '?', y5fmt(a + s/2)); } },
    { id:'y5.a1.10', block:'y5.a1', n:10, title:'Compare and order numbers to 100,000',
      gen:function(){ var a = R(11000,89999), b = a + P([-1,1]) * P([1,10,100,1000]) * R(1,9);
                      return q('&lt;, &gt; or =?<br>' + y5fmt(a) + ' ' + Y5_BLANK + ' ' + y5fmt(b), y5cmp(a, b)); } },
    { id:'y5.a1.11', block:'y5.a1', n:11, title:'Compare and order numbers to 1,000,000',
      // Same first two digits, so the child has to look further along to order them.
      gen:function(){ var base = R(10,98)*10000, a = [];
                      while (a.length < 3){ var x = base + R(0,9999); if (a.indexOf(x) < 0) a.push(x); }
                      return q('Put in order, smallest first:<br>' + a.map(y5fmt).join(', '),
                               a.slice().sort(function (x, y){ return x - y; }).map(y5fmt).join(', ')); } },
    { id:'y5.a1.12', block:'y5.a1', n:12, title:'Round to the nearest 10, 100 or 1,000',
      gen:function(){ var n = R(1001,9999), p = P([10,100,1000]);
                      return q('Round ' + y5fmt(n) + ' to the nearest ' + y5fmt(p) + '.', y5fmt(y5round(n, p))); } },
    { id:'y5.a1.13', block:'y5.a1', n:13, title:'Round within 100,000',
      gen:function(){ var n = R(10001,99999), p = P([100,1000,10000]);
                      return q('Round ' + y5fmt(n) + ' to the nearest ' + y5fmt(p) + '.', y5fmt(y5round(n, p))); } },
    { id:'y5.a1.14', block:'y5.a1', n:14, title:'Round within 1,000,000',
      gen:function(){ var n = R(100001,999999), p = P([1000,10000,100000]);
                      return q('Round ' + y5fmt(n) + ' to the nearest ' + y5fmt(p) + '.', y5fmt(y5round(n, p))); } },

    /* ---- Autumn 2 · Addition and subtraction ---------------- */
    { id:'y5.a2.1',  block:'y5.a2', n:1,  title:'Mental strategies',
      // Adding or taking 999 / 1,999 … — add or take the thousand, then adjust by 1.
      gen:function(){ var a = R(3000,8999), k = R(1, Math.floor(a/1000) - 1), b = k*1000 - 1;
                      return P([true,false]) ? q(y5fmt(a) + ' + ' + y5fmt(b) + ' =', y5fmt(a + b))
                                             : q(y5fmt(a) + ' − ' + y5fmt(b) + ' =', y5fmt(a - b)); } },
    { id:'y5.a2.2',  block:'y5.a2', n:2,  title:'Add whole numbers with more than four digits',
      gen:function(){ var a = R(10000,59999), b = R(10000,39999); return q(y5fmt(a) + ' + ' + y5fmt(b) + ' =', y5fmt(a + b)); } },
    { id:'y5.a2.3',  block:'y5.a2', n:3,  title:'Subtract whole numbers with more than four digits',
      gen:function(){ var a = R(40000,99999), b = R(10000, a - 1000); return q(y5fmt(a) + ' − ' + y5fmt(b) + ' =', y5fmt(a - b)); } },
    { id:'y5.a2.4',  block:'y5.a2', n:4,  title:'Round to check answers',
      gen:function(){ var a, b, ra, rb, add = P([true,false]);
                      do { a = R(1000,9999); b = R(1000,9999); if (!add && b > a){ var t = a; a = b; b = t; }
                           ra = y5round(a,1000); rb = y5round(b,1000); } while (!add && ra - rb <= 0);
                      return q('Estimate ' + y5fmt(a) + (add ? ' + ' : ' − ') + y5fmt(b) + ' by rounding each number to the nearest 1,000.',
                               y5fmt(ra) + (add ? ' + ' : ' − ') + y5fmt(rb) + ' = ' + y5fmt(add ? ra + rb : ra - rb)); } },
    { id:'y5.a2.5',  block:'y5.a2', n:5,  title:'Inverse operations (addition and subtraction)',
      gen:function(){ var b = R(1000,9999), c = R(1000,9999);
                      return P([true,false]) ? q(Y5_BLANK + ' − ' + y5fmt(b) + ' = ' + y5fmt(c), y5fmt(b + c))
                                             : q(Y5_BLANK + ' + ' + y5fmt(b) + ' = ' + y5fmt(b + c), y5fmt(c)); } },
    { id:'y5.a2.6',  block:'y5.a2', n:6,  title:'Multi-step addition and subtraction problems',
      gen:function(){ var a = R(30,90)*1000, b = R(5000, a/2), c = R(1000, a - b - 1000);
                      return q('A stadium has ' + y5fmt(a) + ' seats. ' + y5fmt(b) + ' tickets are sold on Monday and ' + y5fmt(c) + ' on Tuesday. How many seats are left?', y5fmt(a - b - c)); } },
    { id:'y5.a2.7',  block:'y5.a2', n:7,  title:'Compare calculations',
      gen:function(){ var a = R(1000,9000), p = two(100,999), add = P([true,false]);
                      if (!R(0,4)) return q('&lt;, &gt; or =?<br>' + y5fmt(a) + ' + ' + p[0] + ' ' + Y5_BLANK + ' ' + p[0] + ' + ' + y5fmt(a), '=');
                      var op = add ? ' + ' : ' − ', x = add ? a + p[0] : a - p[0], y = add ? a + p[1] : a - p[1];
                      return q('&lt;, &gt; or =?<br>' + y5fmt(a) + op + p[0] + ' ' + Y5_BLANK + ' ' + y5fmt(a) + op + p[1], y5cmp(x, y)); } },
    { id:'y5.a2.8',  block:'y5.a2', n:8,  title:'Find missing numbers',
      gen:function(){ if (P([true,false])){ var t = P([1000,10000,100000]), a = R(t/10, t - 1);
                                            return q(y5fmt(a) + ' + ' + Y5_BLANK + ' = ' + y5fmt(t), y5fmt(t - a)); }
                      var b = R(1000,5000), c = R(1000,5000); return q(Y5_BLANK + ' − ' + y5fmt(b) + ' = ' + y5fmt(c), y5fmt(b + c)); } },

    /* ---- Autumn 3 · Multiplication and division A ----------- */
    { id:'y5.a3.1',  block:'y5.a3', n:1,  title:'Multiples',
      gen:function(){ var m = R(3,12), n = m * R(3,12) + P([0,0,R(1,m-1)]);
                      return q('Is ' + n + ' a multiple of ' + m + '?', n % m ? 'no' : 'yes'); } },
    { id:'y5.a3.2',  block:'y5.a3', n:2,  title:'Common multiples',
      gen:function(){ var p, l;
                      do { p = two(2,12); l = p[0] * p[1] / y5gcd(p[0], p[1]); } while (l > 60 || l === p[0] || l === p[1]);
                      return q('What is the lowest common multiple of ' + p[0] + ' and ' + p[1] + '?', l); } },
    { id:'y5.a3.3',  block:'y5.a3', n:3,  title:'Factors',
      gen:function(){ var n = P([12,16,18,20,24,28,30,32,36,40,42,45,48]), f = [], i;
                      for (i = 1; i <= n; i++) if (n % i === 0) f.push(i);
                      return q('List all the factors of ' + n + '.', f.join(', ')); } },
    { id:'y5.a3.4',  block:'y5.a3', n:4,  title:'Common factors',
      gen:function(){ var p, i, f;
                      do { p = two(6,48); } while (y5gcd(p[0], p[1]) < 2);
                      f = []; for (i = 1; i <= p[0]; i++) if (p[0] % i === 0 && p[1] % i === 0) f.push(i);
                      return q('List the common factors of ' + p[0] + ' and ' + p[1] + '.', f.join(', ')); } },
    { id:'y5.a3.5',  block:'y5.a3', n:5,  title:'Prime numbers',
      gen:function(){ var n = R(11,99), f = 2; while (n % f) f++;
                      return q('Is ' + n + ' a prime number?', f === n ? 'yes' : 'no (' + n + ' = ' + f + ' × ' + (n / f) + ')'); } },
    { id:'y5.a3.6',  block:'y5.a3', n:6,  title:'Square numbers',
      gen:function(){ var n = R(2,12);
                      return P([ q(n + '<sup>2</sup> =', n*n),
                                 q('Which number multiplied by itself makes ' + n*n + '?', n) ]); } },
    { id:'y5.a3.7',  block:'y5.a3', n:7,  title:'Cube numbers',
      gen:function(){ var n = P([1,2,3,4,5,10]); return q(n + '<sup>3</sup> =', y5fmt(n*n*n)); } },
    { id:'y5.a3.8',  block:'y5.a3', n:8,  title:'Multiply by 10, 100 and 1,000',
      gen:function(){ var n = R(2,999), p = P([10,100,1000]); return q(y5fmt(n) + ' × ' + y5fmt(p) + ' =', y5fmt(n * p)); } },
    { id:'y5.a3.9',  block:'y5.a3', n:9,  title:'Divide by 10, 100 and 1,000',
      // Whole-number answers only; dividing into decimals is Summer 3.
      gen:function(){ var k = R(2,999), p = P([10,100,1000]); return q(y5fmt(k * p) + ' ÷ ' + y5fmt(p) + ' =', y5fmt(k)); } },
    { id:'y5.a3.10', block:'y5.a3', n:10, title:'Multiples of 10, 100 and 1,000',
      gen:function(){ var i = R(1,3), j = R(0, 3 - i), a = R(2,9) * Math.pow(10,i), b = R(2,9) * Math.pow(10,j);
                      return q(y5fmt(a) + ' × ' + y5fmt(b) + ' =', y5fmt(a * b)); } },

    /* ---- Autumn 4 · Fractions A ---------------------------- */
    { id:'y5.a4.1',  block:'y5.a4', n:1,  title:'Find fractions equivalent to a unit fraction',
      gen:function(){ var d = R(2,10), k = R(2,6); return q('1/' + d + ' = ' + Y5_BLANK + '/' + (d*k), k); } },
    { id:'y5.a4.2',  block:'y5.a4', n:2,  title:'Find fractions equivalent to a non-unit fraction',
      gen:function(){ var d = R(3,10), n = R(2,d-1), k = R(2,5);
                      return P([true,false]) ? q(n + '/' + d + ' = ' + Y5_BLANK + '/' + (d*k), n*k)
                                             : q(n + '/' + d + ' = ' + (n*k) + '/' + Y5_BLANK, d*k); } },
    { id:'y5.a4.3',  block:'y5.a4', n:3,  title:'Recognise equivalent fractions',
      gen:function(){ var d = R(3,8), n = R(1,d-1), k = R(2,4), eq = P([true,false]), m = n*k + (eq ? 0 : P([-1,1]));
                      return q('Are ' + n + '/' + d + ' and ' + m + '/' + (d*k) + ' equivalent?', eq ? 'yes' : 'no'); } },
    { id:'y5.a4.4',  block:'y5.a4', n:4,  title:'Convert improper fractions to mixed numbers',
      gen:function(){ var d = R(2,9), n = R(1,4)*d + R(1,d-1); return q('Write ' + n + '/' + d + ' as a mixed number.', y5mixed(n, d)); } },
    { id:'y5.a4.5',  block:'y5.a4', n:5,  title:'Convert mixed numbers to improper fractions',
      gen:function(){ var d = R(2,9), w = R(1,5), r = R(1,d-1); return q('Write ' + w + ' ' + r + '/' + d + ' as an improper fraction.', (w*d + r) + '/' + d); } },
    { id:'y5.a4.6',  block:'y5.a4', n:6,  title:'Compare fractions less than 1',
      // Denominators where one is a multiple of the other, as the scheme does.
      gen:function(){ var d = R(2,6), k = P([2,3]), D = d*k, a, b;
                      do { a = R(1,d-1); b = R(1,D-1); } while (a*k === b);
                      var f = shuffle([[a + '/' + d, a*k], [b + '/' + D, b]]);
                      return q('Which is greater, ' + f[0][0] + ' or ' + f[1][0] + '?', f[0][1] > f[1][1] ? f[0][0] : f[1][0]); } },
    { id:'y5.a4.7',  block:'y5.a4', n:7,  title:'Order fractions less than 1',
      gen:function(){ var fam = P([[2,4,8],[3,6,12],[5,10,20],[4,8,16]]), L = fam[2], f, i, n;
                      do { f = []; for (i = 0; i < 3; i++){ n = R(1, fam[i]-1); f.push({ s:n + '/' + fam[i], v:n * L / fam[i] }); } }
                      while (f[0].v === f[1].v || f[1].v === f[2].v || f[0].v === f[2].v);
                      f = shuffle(f);
                      return q('Put in order, smallest first:<br>' + f.map(function (x){ return x.s; }).join(', '),
                               f.slice().sort(function (x, y){ return x.v - y.v; }).map(function (x){ return x.s; }).join(', ')); } },
    { id:'y5.a4.8',  block:'y5.a4', n:8,  title:'Compare and order fractions greater than 1',
      gen:function(){ var d = R(2,5), k = P([2,3]), D = d*k, n, w, r, A, B;
                      do { n = R(d+1, 3*d-1); w = R(1,2); r = R(1,D-1); A = n*k; B = w*D + r; } while (n % d === 0 || A === B);
                      var f = shuffle([[n + '/' + d, A], [w + ' ' + r + '/' + D, B]]);
                      return q('Which is greater, ' + f[0][0] + ' or ' + f[1][0] + '?', f[0][1] > f[1][1] ? f[0][0] : f[1][0]); } },
    { id:'y5.a4.9',  block:'y5.a4', n:9,  title:'Add and subtract fractions with the same denominator',
      gen:function(){ var d = R(5,12), a = R(1,d-2), b = R(1,d-1-a);
                      return P([true,false]) ? q(a + '/' + d + ' + ' + b + '/' + d + ' =', y5ans(a + b, d))
                                             : q((a + b) + '/' + d + ' − ' + b + '/' + d + ' =', y5ans(a, d)); } },
    { id:'y5.a4.10', block:'y5.a4', n:10, title:'Add fractions within 1',
      gen:function(){ var d = R(2,5), k = P([2,3]), D = d*k, a, b;
                      do { a = R(1,d-1); b = R(1,D-1); } while (a*k + b >= D);
                      var t = shuffle([a + '/' + d, b + '/' + D]);
                      return q(t[0] + ' + ' + t[1] + ' =', y5ans(a*k + b, D)); } },
    { id:'y5.a4.11', block:'y5.a4', n:11, title:'Add fractions with total greater than 1',
      gen:function(){ var d = R(2,5), k = P([2,3]), D = d*k, a, b;
                      do { a = R(1,d-1); b = R(1,D-1); } while (a*k + b <= D);
                      var t = shuffle([a + '/' + d, b + '/' + D]);
                      return q(t[0] + ' + ' + t[1] + ' =', y5ans(a*k + b, D)); } },
    { id:'y5.a4.12', block:'y5.a4', n:12, title:'Add to a mixed number',
      gen:function(){ var d = R(3,9), w = R(1,5), a = R(1,d-1), b = R(1,d-1);
                      return q(w + ' ' + a + '/' + d + ' + ' + b + '/' + d + ' =', y5ans(w*d + a + b, d, true)); } },
    { id:'y5.a4.13', block:'y5.a4', n:13, title:'Add two mixed numbers',
      gen:function(){ var d = R(3,9), w = R(1,4), v = R(1,4), a = R(1,d-1), b = R(1,d-1);
                      return q(w + ' ' + a + '/' + d + ' + ' + v + ' ' + b + '/' + d + ' =', y5ans((w + v)*d + a + b, d, true)); } },
    { id:'y5.a4.14', block:'y5.a4', n:14, title:'Subtract fractions',
      gen:function(){ var d = R(2,5), k = P([2,3]), D = d*k, a, b;
                      do { a = R(2,D-1); b = R(1,d-1); } while (a <= b*k);
                      return q(a + '/' + D + ' − ' + b + '/' + d + ' =', y5ans(a - b*k, D)); } },
    { id:'y5.a4.15', block:'y5.a4', n:15, title:'Subtract from a mixed number',
      gen:function(){ var d = R(4,9), w = R(1,5), a = R(2,d-1), b = R(1,a-1);
                      return q(w + ' ' + a + '/' + d + ' − ' + b + '/' + d + ' =', y5ans(w*d + a - b, d, true)); } },
    { id:'y5.a4.16', block:'y5.a4', n:16, title:'Subtract from a mixed number – breaking the whole',
      gen:function(){ var d = R(4,9), w = R(2,5), a = R(1,d-2), b = R(a+1,d-1);
                      return q(w + ' ' + a + '/' + d + ' − ' + b + '/' + d + ' =', y5ans(w*d + a - b, d, true)); } },
    { id:'y5.a4.17', block:'y5.a4', n:17, title:'Subtract two mixed numbers',
      gen:function(){ var d = R(3,9), w = R(3,6), v = R(1,w-1), a = R(1,d-1), b = R(1,d-1);
                      return q(w + ' ' + a + '/' + d + ' − ' + v + ' ' + b + '/' + d + ' =', y5ans((w*d + a) - (v*d + b), d, true)); } },

    /* ---- Spring 1 · Multiplication and division B ----------- */
    { id:'y5.b1.1',  block:'y5.b1', n:1,  title:'Multiply up to a 4-digit number by a 1-digit number',
      gen:function(){ var a = R(1000,9999), b = R(2,9); return q(y5fmt(a) + ' × ' + b + ' =', y5fmt(a * b)); } },
    { id:'y5.b1.2',  block:'y5.b1', n:2,  title:'Multiply a 2-digit number by a 2-digit number (area model)',
      gen:function(){ var a = R(12,39), b = R(11,19);
                      return q(a + ' × ' + b + ' = ' + a + ' × 10 + ' + a + ' × ' + (b - 10) + ' = ' + Y5_BLANK, a * b); } },
    { id:'y5.b1.3',  block:'y5.b1', n:3,  title:'Multiply a 2-digit number by a 2-digit number',
      gen:function(){ var a = R(12,99), b = R(12,99); return q(a + ' × ' + b + ' =', y5fmt(a * b)); } },
    { id:'y5.b1.4',  block:'y5.b1', n:4,  title:'Multiply a 3-digit number by a 2-digit number',
      gen:function(){ var a = R(102,999), b = R(12,99); return q(a + ' × ' + b + ' =', y5fmt(a * b)); } },
    { id:'y5.b1.5',  block:'y5.b1', n:5,  title:'Multiply a 4-digit number by a 2-digit number',
      gen:function(){ var a = R(1002,9999), b = R(12,99); return q(y5fmt(a) + ' × ' + b + ' =', y5fmt(a * b)); } },
    { id:'y5.b1.6',  block:'y5.b1', n:6,  title:'Solve problems with multiplication',
      gen:function(){ var a = R(12,48), b = R(12,45);
                      return q('A box holds ' + a + ' pencils. How many pencils are in ' + b + ' boxes?', y5fmt(a * b)); } },
    { id:'y5.b1.7',  block:'y5.b1', n:7,  title:'Short division',
      gen:function(){ var d = R(2,9), k = R(Math.ceil(100/d), Math.floor(999/d)); return q((k*d) + ' ÷ ' + d + ' =', k); } },
    { id:'y5.b1.8',  block:'y5.b1', n:8,  title:'Divide a 4-digit number by a 1-digit number',
      gen:function(){ var d = R(2,9), k = R(Math.ceil(1000/d), Math.floor(9999/d)); return q(y5fmt(k*d) + ' ÷ ' + d + ' =', y5fmt(k)); } },
    { id:'y5.b1.9',  block:'y5.b1', n:9,  title:'Divide with remainders',
      gen:function(){ var d = R(3,9), n; do { n = R(100,999); } while (n % d === 0);
                      return q(n + ' ÷ ' + d + ' =', Math.floor(n/d) + ' r ' + (n % d)); } },
    { id:'y5.b1.10', block:'y5.b1', n:10, title:'Efficient division',
      // Divisors that reward a shortcut: halve twice for 4, halve three times for 8, ÷10 then ×2 for 5.
      gen:function(){ var d = P([4,5,8]), k = R(25,999); return q(y5fmt(k*d) + ' ÷ ' + d + ' =', y5fmt(k)); } },
    { id:'y5.b1.11', block:'y5.b1', n:11, title:'Solve problems with multiplication and division',
      gen:function(){ var b = R(3,8), e = P([6,12,24]), c = R(2,9), d = R(3,9), each = R(12,99);
                      return P([ q('A crate holds ' + b + ' boxes of ' + e + ' eggs. How many eggs are in ' + c + ' crates?', y5fmt(b*e*c)),
                                 q('£' + y5fmt(d*each) + ' is shared equally between ' + d + ' people. How much does each get?', '£' + each) ]); } },

    /* ---- Spring 2 · Fractions B ---------------------------- */
    { id:'y5.b2.1',  block:'y5.b2', n:1,  title:'Multiply a unit fraction by an integer',
      gen:function(){ var d = R(3,12), m = R(2,d+4); return q('1/' + d + ' × ' + m + ' =', y5ans(m, d)); } },
    { id:'y5.b2.2',  block:'y5.b2', n:2,  title:'Multiply a non-unit fraction by an integer',
      gen:function(){ var d = R(3,10), n = R(2,d-1), m = R(2,5); return q(n + '/' + d + ' × ' + m + ' =', y5ans(n*m, d)); } },
    { id:'y5.b2.3',  block:'y5.b2', n:3,  title:'Multiply a mixed number by an integer',
      gen:function(){ var d = R(2,8), w = R(1,4), r = R(1,d-1), m = R(2,5);
                      return q(w + ' ' + r + '/' + d + ' × ' + m + ' =', y5ans((w*d + r)*m, d, true)); } },
    { id:'y5.b2.4',  block:'y5.b2', n:4,  title:'Calculate a fraction of a quantity',
      gen:function(){ var d = R(3,10), n = R(1,d-1), k = R(2,12); return q('What is ' + n + '/' + d + ' of ' + (d*k) + '?', n*k); } },
    { id:'y5.b2.5',  block:'y5.b2', n:5,  title:'Fraction of an amount',
      gen:function(){ var d = R(3,10), n = R(2,d-1), k = R(5,40), u = P([['£','',''],['','',' kg'],['','',' m'],['','',' ml']]);
                      return q('Find ' + n + '/' + d + ' of ' + u[0] + (d*k) + u[2] + '.', u[0] + (n*k) + u[2]); } },
    { id:'y5.b2.6',  block:'y5.b2', n:6,  title:'Find the whole',
      gen:function(){ var d = R(3,10), n = R(2,d-1), k = R(2,12);
                      return q(n + '/' + d + ' of a number is ' + (n*k) + '. What is the number?', d*k); } },
    { id:'y5.b2.7',  block:'y5.b2', n:7,  title:'Use fractions as operators',
      gen:function(){ var d = R(2,10), n = R(1,d-1), k = R(2,12);
                      return P([true,false]) ? q(n + '/' + d + ' × ' + (d*k) + ' =', n*k) : q((d*k) + ' × ' + n + '/' + d + ' =', n*k); } },

    /* ---- Spring 3 · Decimals and percentages ---------------- */
    { id:'y5.b3.1',  block:'y5.b3', n:1,  title:'Decimals up to 2 decimal places',
      gen:function(){ var x; do { x = y5digit(101,999); } while (x.value >= 100 || String(x.n).charAt(0) === String(x.d));
                      // x.n read as hundredths: digit place 1 = tenths, 0 = hundredths.
                      var name = x.value >= 10 ? 'tenths' : 'hundredths';
                      return q('What is the value of the ' + x.d + ' in ' + y5dec(x.n, 2) + '?', x.d + ' ' + name + ' (' + y5num(x.value, 2) + ')'); } },
    { id:'y5.b3.2',  block:'y5.b3', n:2,  title:'Equivalent fractions and decimals (tenths)',
      gen:function(){ var n = R(1,9), w = P([0,0,R(1,5)]);
                      return P([true,false]) ? q('Write ' + (w ? w + ' ' : '') + n + '/10 as a decimal.', y5dec(w*10 + n, 1))
                                             : q('Write ' + y5dec(w*10 + n, 1) + ' as a fraction.', (w ? w + ' ' : '') + n + '/10'); } },
    { id:'y5.b3.3',  block:'y5.b3', n:3,  title:'Equivalent fractions and decimals (hundredths)',
      gen:function(){ var n; do { n = R(1,99); } while (n % 10 === 0);
                      return P([true,false]) ? q('Write ' + n + '/100 as a decimal.', y5dec(n, 2))
                                             : q('Write ' + y5dec(n, 2) + ' as a fraction.', n + '/100'); } },
    { id:'y5.b3.4',  block:'y5.b3', n:4,  title:'Equivalent fractions and decimals',
      gen:function(){ var f = P(Y5_FDP);
                      return P([true,false]) ? q('Write ' + f[0] + ' as a decimal.', f[1])
                                             : q('Write ' + f[1] + ' as a fraction in its simplest form.', f[0]); } },
    { id:'y5.b3.5',  block:'y5.b3', n:5,  title:'Thousandths as fractions',
      gen:function(){ var n; do { n = R(1,999); } while (n % 10 === 0);
                      return q('Write ' + y5dec(n, 3) + ' as a fraction.', n + '/1000'); } },
    { id:'y5.b3.6',  block:'y5.b3', n:6,  title:'Thousandths as decimals',
      gen:function(){ var n; do { n = R(1,999); } while (n % 10 === 0);
                      return q('Write ' + n + '/1000 as a decimal.', y5dec(n, 3)); } },
    { id:'y5.b3.7',  block:'y5.b3', n:7,  title:'Thousandths on a place value chart',
      gen:function(){ var x; do { x = y5digit(1001,9999); } while (x.value >= 1000);
                      var name = x.value >= 100 ? 'tenths' : x.value >= 10 ? 'hundredths' : 'thousandths';
                      return q('What is the value of the ' + x.d + ' in ' + y5dec(x.n, 3) + '?', x.d + ' ' + name + ' (' + y5num(x.value, 3) + ')'); } },
    { id:'y5.b3.8',  block:'y5.b3', n:8,  title:'Order and compare decimals (same number of decimal places)',
      gen:function(){ var dp = P([1,2]), lo = Math.pow(10,dp), p;
                      do { p = two(lo + 1, lo*10 - 1); } while (p[0] % 10 === 0 || p[1] % 10 === 0);
                      return q('&lt;, &gt; or =?<br>' + y5dec(p[0], dp) + ' ' + Y5_BLANK + ' ' + y5dec(p[1], dp), y5cmp(p[0], p[1])); } },
    { id:'y5.b3.9',  block:'y5.b3', n:9,  title:'Order and compare any decimals with up to 3 decimal places',
      // One number each with 1, 2 and 3 decimal places, all between 0 and 1, held in thousandths.
      gen:function(){ var a, b, c;
                      do { a = R(1,9)*100; b = R(10,99)*10; c = R(100,999); } while (b % 100 === 0 || c % 10 === 0 || a === b || a === c || b === c);
                      var v = shuffle([a, b, c]);
                      return q('Put in order, smallest first:<br>' + v.map(function (x){ return y5num(x, 3); }).join(', '),
                               v.slice().sort(function (x, y){ return x - y; }).map(function (x){ return y5num(x, 3); }).join(', ')); } },
    { id:'y5.b3.10', block:'y5.b3', n:10, title:'Round to the nearest whole number',
      gen:function(){ var dp = P([1,2]), p = Math.pow(10,dp), n; do { n = R(p + 1, 20*p - 1); } while (n % p === 0);
                      return q('Round ' + y5dec(n, dp) + ' to the nearest whole number.', y5round(n, p) / p); } },
    { id:'y5.b3.11', block:'y5.b3', n:11, title:'Round to 1 decimal place',
      gen:function(){ var n; do { n = R(101,1999); } while (n % 10 === 0);
                      return q('Round ' + y5dec(n, 2) + ' to 1 decimal place.', y5dec(y5round(n, 10) / 10, 1)); } },
    { id:'y5.b3.12', block:'y5.b3', n:12, title:'Understand percentages',
      gen:function(){ var n = R(1,99);
                      return P([ q(n + ' out of 100 squares are shaded. What percentage is shaded?', n + '%'),
                                 q(n + '% of a 100 square is shaded. What percentage is not shaded?', (100 - n) + '%') ]); } },
    { id:'y5.b3.13', block:'y5.b3', n:13, title:'Percentages as fractions',
      gen:function(){ var n = R(1,99); return q('Write ' + n + '% as a fraction.', y5ans(n, 100)); } },
    { id:'y5.b3.14', block:'y5.b3', n:14, title:'Percentages as decimals',
      gen:function(){ var n = R(1,99); return P([true,false]) ? q('Write ' + n + '% as a decimal.', y5num(n, 2))
                                                              : q('Write ' + y5num(n, 2) + ' as a percentage.', n + '%'); } },
    { id:'y5.b3.15', block:'y5.b3', n:15, title:'Equivalent fractions, decimals and percentages',
      gen:function(){ var f = P(Y5_FDP), p = two(0,2), as = ['a fraction in its simplest form', 'a decimal', 'a percentage'];
                      return q('Write ' + f[p[0]] + ' as ' + as[p[1]] + '.', f[p[1]]); } },

    /* ---- Spring 4 · Perimeter and area ---------------------- */
    { id:'y5.b4.1',  block:'y5.b4', n:1,  title:'Perimeter of rectangles',
      gen:function(){ var p = two(3,20);
                      return P([true,false]) ? q('A rectangle is ' + p[0] + ' cm long and ' + p[1] + ' cm wide. What is its perimeter?', 2*(p[0] + p[1]) + ' cm')
                                             : q('A rectangle has a perimeter of ' + 2*(p[0] + p[1]) + ' cm. One side is ' + p[0] + ' cm. How long is the other side?', p[1] + ' cm'); } },
    { id:'y5.b4.2',  block:'y5.b4', n:2,  title:'Perimeter of rectilinear shapes', gen:null, why:NEEDS_PICTURE },
    { id:'y5.b4.3',  block:'y5.b4', n:3,  title:'Perimeter of polygons',
      gen:function(){ var s = P([['equilateral triangle',3],['square',4],['regular pentagon',5],['regular hexagon',6],['regular octagon',8]]), l = R(2,12);
                      return P([true,false]) ? q(y5a(s[0], true) + ' has sides of ' + l + ' cm. What is its perimeter?', s[1]*l + ' cm')
                                             : q(y5a(s[0], true) + ' has a perimeter of ' + s[1]*l + ' cm. How long is each side?', l + ' cm'); } },
    { id:'y5.b4.4',  block:'y5.b4', n:4,  title:'Area of rectangles',
      gen:function(){ var a = R(2,12), b = R(2,12);
                      return P([true,false]) ? q('A rectangle is ' + a + ' cm by ' + b + ' cm. What is its area?', a*b + ' cm²')
                                             : q('A rectangle has an area of ' + a*b + ' cm². One side is ' + a + ' cm. How long is the other side?', b + ' cm'); } },
    { id:'y5.b4.5',  block:'y5.b4', n:5,  title:'Area of compound shapes',
      gen:function(){ var a = R(4,10), b = R(3,8), c = R(2,6), d = R(2,5);
                      return q('A shape is made of two rectangles, ' + a + ' cm × ' + b + ' cm and ' + c + ' cm × ' + d + ' cm, that do not overlap. What is its area?', (a*b + c*d) + ' cm²'); } },
    { id:'y5.b4.6',  block:'y5.b4', n:6,  title:'Estimate area', gen:null, why:'Needs a shape drawn on squared paper to count.' },

    /* ---- Spring 5 · Statistics ----------------------------- */
    { id:'y5.b5.1',  block:'y5.b5', n:1,  title:'Draw line graphs', gen:null, why:NEEDS_DRAWING },
    { id:'y5.b5.2',  block:'y5.b5', n:2,  title:'Read and interpret line graphs', gen:null, why:'Needs a line graph to read from.' },
    { id:'y5.b5.3',  block:'y5.b5', n:3,  title:'Read and interpret tables',
      gen:function(){ var days = ['Mon','Tue','Wed','Thu'], v = [R(12,49), R(12,49), R(12,49), R(12,49)], mx = Math.max.apply(null, v), mn = Math.min.apply(null, v);
                      var t = 'Books borrowed — ' + days.map(function (d, i){ return d + ': ' + v[i]; }).join(', ') + '.<br>';
                      return P([true,false]) || mx === mn ? q(t + 'How many books were borrowed altogether?', v[0] + v[1] + v[2] + v[3])
                                                          : q(t + 'What is the difference between the most and the fewest?', mx - mn); } },
    { id:'y5.b5.4',  block:'y5.b5', n:4,  title:'Two-way tables', gen:null, why:'Needs a two-way table to read from.' },
    { id:'y5.b5.5',  block:'y5.b5', n:5,  title:'Read and interpret timetables',
      gen:function(){ var dep = R(84,192)*5, dur = R(2,11)*5;
                      return q('A bus leaves the park at ' + y5hm(dep) + ' and reaches the station at ' + y5hm(dep + dur) + '. How long is the journey?', dur + ' minutes'); } },

    /* ---- Summer 1 · Shape ---------------------------------- */
    { id:'y5.c1.1',  block:'y5.c1', n:1,  title:'Understand and use degrees',
      gen:function(){ var t = P([['a full turn',360],['a half turn',180],['a quarter turn',90],['a three-quarter turn',270]]);
                      return q('How many degrees are in ' + t[0] + '?', t[1] + '°'); } },
    { id:'y5.c1.2',  block:'y5.c1', n:2,  title:'Classify angles',
      gen:function(){ var a; do { a = R(5,355); } while (a === 90 || a === 180);
                      return q('Is an angle of ' + a + '° acute, obtuse or reflex?', a < 90 ? 'acute' : a < 180 ? 'obtuse' : 'reflex'); } },
    { id:'y5.c1.3',  block:'y5.c1', n:3,  title:'Estimate angles', gen:null, why:'Needs a drawn angle to estimate.' },
    { id:'y5.c1.4',  block:'y5.c1', n:4,  title:'Measure angles up to 180°', gen:null, why:'Needs a protractor and a drawn angle.' },
    { id:'y5.c1.5',  block:'y5.c1', n:5,  title:'Draw lines and angles accurately', gen:null, why:NEEDS_DRAWING },
    { id:'y5.c1.6',  block:'y5.c1', n:6,  title:'Calculate angles around a point',
      gen:function(){ var a = R(40,170), b = R(40, 300 - a);
                      return q('Three angles meet at a point. Two are ' + a + '° and ' + b + '°. What is the third?', (360 - a - b) + '°'); } },
    { id:'y5.c1.7',  block:'y5.c1', n:7,  title:'Calculate angles on a straight line',
      gen:function(){ var a = R(15,165); return q('Two angles on a straight line. One is ' + a + '°. What is the other?', (180 - a) + '°'); } },
    { id:'y5.c1.8',  block:'y5.c1', n:8,  title:'Lengths and angles in shapes',
      gen:function(){ var s = R(3,15), l = R(3,15), w = R(2, l);
                      return P([ q('What size is each angle in a rectangle?', '90°'),
                                 q('A square has a perimeter of ' + 4*s + ' cm. How long is each side?', s + ' cm'),
                                 q('A rectangle has a perimeter of ' + 2*(l + w) + ' cm. Its length is ' + l + ' cm. What is its width?', w + ' cm') ]); } },
    { id:'y5.c1.9',  block:'y5.c1', n:9,  title:'Regular and irregular polygons',
      // Equal sides alone do not make a polygon regular (a rhombus), so the
      // regular case always states the angles are equal too.
      gen:function(){ var s = P([['pentagon',5],['hexagon',6],['octagon',8],['quadrilateral',4]]), l = R(3,9), k = R(0,2), sides = [], i;
                      if (k === 0) return q(y5a(s[0], true) + ' has all sides ' + l + ' cm and all angles equal. Is it regular or irregular?', 'regular');
                      if (k === 1) return q(y5a(s[0], true) + ' has all sides ' + l + ' cm, but its angles are not all equal. Is it regular or irregular?', 'irregular');
                      for (i = 0; i < s[1]; i++) sides.push(l);
                      sides[s[1] - 1] = l + R(1,3);
                      return q(y5a(s[0], true) + ' has sides of ' + sides.join(' cm, ') + ' cm. Is it regular or irregular?', 'irregular'); } },
    { id:'y5.c1.10', block:'y5.c1', n:10, title:'3-D shapes',
      gen:function(){ var s = P(Y5_SOLIDS), k = P(['faces','edges','vertices']); return q('How many ' + k + ' does a ' + s.name + ' have?', s[k]); } },

    /* ---- Summer 2 · Position and direction ------------------ */
    { id:'y5.c2.1',  block:'y5.c2', n:1,  title:'Read and plot coordinates', gen:null, why:'Needs a coordinate grid.' },
    { id:'y5.c2.2',  block:'y5.c2', n:2,  title:'Problem solving with coordinates',
      gen:function(){ var x1 = R(0,6), x2 = R(x1 + 2, 10), y1 = R(0,6), y2 = R(y1 + 2, 10);
                      var c = shuffle([[x1,y1],[x2,y1],[x2,y2],[x1,y2]]), f = function (p){ return '(' + p[0] + ', ' + p[1] + ')'; };
                      return q('Three corners of a rectangle are ' + f(c[0]) + ', ' + f(c[1]) + ' and ' + f(c[2]) + '. What is the fourth?', f(c[3])); } },
    { id:'y5.c2.3',  block:'y5.c2', n:3,  title:'Translation', gen:null, why:'Needs a shape on a grid to translate.' },
    { id:'y5.c2.4',  block:'y5.c2', n:4,  title:'Translation with coordinates',
      gen:function(){ var x = R(2,8), y = R(2,8), dx = R(1,6), dy = R(1,6), l = P([true,false]) && dx <= x, d = P([true,false]) && dy <= y;
                      return q('The point (' + x + ', ' + y + ') is translated ' + dx + (l ? ' left' : ' right') + ' and ' + dy + (d ? ' down' : ' up') + '. Where is it now?',
                               '(' + (l ? x - dx : x + dx) + ', ' + (d ? y - dy : y + dy) + ')'); } },
    { id:'y5.c2.5',  block:'y5.c2', n:5,  title:'Lines of symmetry',
      gen:function(){ var s = P([['square',4],['rectangle',2],['equilateral triangle',3],['isosceles triangle',1],['regular pentagon',5],
                                 ['regular hexagon',6],['regular octagon',8],['rhombus',2],['kite',1]]);
                      return q('How many lines of symmetry does ' + y5a(s[0]) + ' have?', s[1]); } },
    { id:'y5.c2.6',  block:'y5.c2', n:6,  title:'Reflection in horizontal and vertical lines',
      gen:function(){ var d = R(2,6), side = P(['left','right','above','below']), opp = { left:'right', right:'left', above:'below', below:'above' };
                      var line = (side === 'left' || side === 'right') ? 'vertical' : 'horizontal';
                      return q('A point is ' + d + ' squares ' + side + (line === 'vertical' ? ' of' : '') + ' a ' + line + ' mirror line. Where is its reflection?',
                               d + ' squares ' + opp[side] + (line === 'vertical' ? ' of' : '') + ' the mirror line'); } },

    /* ---- Summer 3 · Decimals ------------------------------- */
    { id:'y5.c3.1',  block:'y5.c3', n:1,  title:'Use known facts to add and subtract decimals within 1',
      gen:function(){ var dp = P([1,2]), top = Math.pow(10,dp) - 1, a = R(1, top - 1), b = R(1, top - a);
                      return P([true,false]) ? q(y5num(a, dp) + ' + ' + y5num(b, dp) + ' =', y5num(a + b, dp))
                                             : q(y5num(a + b, dp) + ' − ' + y5num(b, dp) + ' =', y5num(a, dp)); } },
    { id:'y5.c3.2',  block:'y5.c3', n:2,  title:'Complements to 1',
      gen:function(){ var dp = P([1,2,2]), p = Math.pow(10,dp), n; do { n = R(1, p - 1); } while (dp === 2 && n % 10 === 0);
                      return q(y5num(n, dp) + ' + ' + Y5_BLANK + ' = 1', y5num(p - n, dp)); } },
    { id:'y5.c3.3',  block:'y5.c3', n:3,  title:'Add and subtract decimals across 1',
      gen:function(){ if (P([true,false])){ var a = R(2,9), b = R(11 - a, 9); return q(y5num(a, 1) + ' + ' + y5num(b, 1) + ' =', y5num(a + b, 1)); }
                      var c = R(11,18), d = R(c - 9, 9); return q(y5num(c, 1) + ' − ' + y5num(d, 1) + ' =', y5num(c - d, 1)); } },
    { id:'y5.c3.4',  block:'y5.c3', n:4,  title:'Add decimals with the same number of decimal places',
      gen:function(){ var dp = P([1,2]), p = Math.pow(10,dp), a, b;
                      do { a = R(p + 1, 9*p); b = R(p + 1, 9*p); } while (a % 10 === 0 || b % 10 === 0);
                      return q(y5dec(a, dp) + ' + ' + y5dec(b, dp) + ' =', y5num(a + b, dp)); } },
    { id:'y5.c3.5',  block:'y5.c3', n:5,  title:'Subtract decimals with the same number of decimal places',
      gen:function(){ var dp = P([1,2]), p = Math.pow(10,dp), x;
                      do { x = two(p + 1, 9*p); } while (x[0] % 10 === 0 || x[1] % 10 === 0);
                      var a = Math.max(x[0], x[1]), b = Math.min(x[0], x[1]);
                      return q(y5dec(a, dp) + ' − ' + y5dec(b, dp) + ' =', y5num(a - b, dp)); } },
    { id:'y5.c3.6',  block:'y5.c3', n:6,  title:'Add decimals with different numbers of decimal places',
      gen:function(){ var a = R(11,99), b; do { b = R(101,999); } while (b % 10 === 0);
                      var t = shuffle([y5dec(a, 1), y5dec(b, 2)]);
                      return q(t[0] + ' + ' + t[1] + ' =', y5num(a*10 + b, 2)); } },
    { id:'y5.c3.7',  block:'y5.c3', n:7,  title:'Subtract decimals with different numbers of decimal places',
      gen:function(){ var a = R(30,99), b; do { b = R(101, a*10 - 1); } while (b % 10 === 0);
                      return q(y5dec(a, 1) + ' − ' + y5dec(b, 2) + ' =', y5num(a*10 - b, 2)); } },
    { id:'y5.c3.8',  block:'y5.c3', n:8,  title:'Efficient strategies for adding and subtracting decimals',
      // x.99 is one hundredth short of a whole: add or take the whole, then adjust.
      gen:function(){ if (P([true,false])){ var k = R(2,8), b = R(101,899); return q(y5dec(k*100 - 1, 2) + ' + ' + y5dec(b, 2) + ' =', y5num(k*100 - 1 + b, 2)); }
                      var c = R(500,999), j = R(1, Math.floor(c/100) - 1); return q(y5dec(c, 2) + ' − ' + y5dec(j*100 - 1, 2) + ' =', y5num(c - (j*100 - 1), 2)); } },
    { id:'y5.c3.9',  block:'y5.c3', n:9,  title:'Decimal sequences',
      // Held in hundredths: steps of 0.1, 0.2, 0.3, 0.5, 0.05 or 0.25.
      gen:function(){ var s = P([10,20,30,50,5,25]), down = P([true,false]), start = R(1,30)*5 + (down ? 4*s : 0), terms = [], i, b = R(1,3);
                      for (i = 0; i < 5; i++) terms.push(down ? start - i*s : start + i*s);
                      return q(terms.map(function (t, k){ return k === b ? Y5_BLANK : y5num(t, 2); }).join(', '), y5num(terms[b], 2)); } },
    { id:'y5.c3.10', block:'y5.c3', n:10, title:'Multiply by 10, 100 and 1,000',
      gen:function(){ var n; do { n = R(101,999); } while (n % 10 === 0);
                      var p = P([10,100,1000]); return q(y5dec(n, 2) + ' × ' + y5fmt(p) + ' =', y5num(n*p, 2)); } },
    { id:'y5.c3.11', block:'y5.c3', n:11, title:'Divide by 10, 100 and 1,000',
      gen:function(){ var n; do { n = R(2,999); } while (n % 10 === 0);
                      var e = R(1,3); return q(n + ' ÷ ' + y5fmt(Math.pow(10,e)) + ' =', y5num(n, e)); } },
    { id:'y5.c3.12', block:'y5.c3', n:12, title:'Multiply and divide decimals – missing values',
      gen:function(){ var n; do { n = R(101,999); } while (n % 10 === 0);
                      var p = P([10,100,1000]);
                      return P([true,false]) ? q(y5dec(n, 2) + ' × ' + Y5_BLANK + ' = ' + y5num(n*p, 2), y5fmt(p))
                                             : q(Y5_BLANK + ' ÷ ' + y5fmt(p) + ' = ' + y5dec(n, 2), y5num(n*p, 2)); } },

    /* ---- Summer 4 · Negative numbers ----------------------- */
    { id:'y5.c4.1',  block:'y5.c4', n:1,  title:'Understand negative numbers',
      gen:function(){ var t = R(1,8), f = R(t + 1, t + 9);
                      return q('The temperature is ' + t + '°C. It falls by ' + f + ' degrees. What is the temperature now?', y5neg(t - f) + '°C'); } },
    { id:'y5.c4.2',  block:'y5.c4', n:2,  title:'Count through zero in 1s',
      gen:function(){ var down = P([true,false]), start = down ? R(2,4) : -R(2,4), terms = [], i, b = R(1,4);
                      for (i = 0; i < 6; i++) terms.push(down ? start - i : start + i);
                      return q(terms.map(function (t, k){ return k === b ? Y5_BLANK : y5neg(t); }).join(', '), y5neg(terms[b])); } },
    { id:'y5.c4.3',  block:'y5.c4', n:3,  title:'Count through zero in multiples',
      gen:function(){ var s = P([2,3,5,10,25,50,100]), down = P([true,false]), start = (down ? 1 : -1) * s * R(1,3), terms = [], i, b = R(1,4);
                      for (i = 0; i < 6; i++) terms.push(down ? start - i*s : start + i*s);
                      return q(terms.map(function (t, k){ return k === b ? Y5_BLANK : y5neg(t); }).join(', '), y5neg(terms[b])); } },
    { id:'y5.c4.4',  block:'y5.c4', n:4,  title:'Compare and order negative numbers',
      gen:function(){ var v = [], n;
                      while (v.length < 4){ n = v.length < 2 ? -R(1,15) : R(-15,15); if (v.indexOf(n) < 0) v.push(n); }
                      v = shuffle(v);
                      return q('Put in order, smallest first:<br>' + v.map(y5neg).join(', '), v.slice().sort(function (x, y){ return x - y; }).map(y5neg).join(', ')); } },
    { id:'y5.c4.5',  block:'y5.c4', n:5,  title:'Find the difference',
      gen:function(){ var a = -R(1,12), b = R(1,15);
                      return q('What is the difference between ' + y5neg(a) + '°C and ' + b + '°C?', (b - a) + '°C'); } },

    /* ---- Summer 5 · Converting units ----------------------- */
    { id:'y5.c5.1',  block:'y5.c5', n:1,  title:'Kilograms and kilometres',
      gen:function(){ var t = R(11,99), u = P([['kg','g'],['km','m']]);
                      return P([true,false]) ? q(y5num(t, 1) + ' ' + u[0] + ' = ' + Y5_BLANK + ' ' + u[1], y5fmt(t*100) + ' ' + u[1])
                                             : q(y5fmt(t*100) + ' ' + u[1] + ' = ' + Y5_BLANK + ' ' + u[0], y5num(t, 1) + ' ' + u[0]); } },
    { id:'y5.c5.2',  block:'y5.c5', n:2,  title:'Millimetres and millilitres',
      gen:function(){ if (P([true,false])){ var mm = R(12,99);
                                            return P([true,false]) ? q(y5num(mm, 1) + ' cm = ' + Y5_BLANK + ' mm', mm + ' mm')
                                                                   : q(mm + ' mm = ' + Y5_BLANK + ' cm', y5num(mm, 1) + ' cm'); }
                      var ml = R(2,95)*100;
                      return P([true,false]) ? q(y5num(ml, 3) + ' litres = ' + Y5_BLANK + ' ml', y5fmt(ml) + ' ml')
                                             : q(y5fmt(ml) + ' ml = ' + Y5_BLANK + ' litres', y5num(ml, 3) + ' litres'); } },
    { id:'y5.c5.3',  block:'y5.c5', n:3,  title:'Convert units of length',
      gen:function(){ var u = P([['m','cm',2],['km','m',3]]), n = R(Math.pow(10,u[2]) + 1, 9*Math.pow(10,u[2]));
                      return P([true,false]) ? q(y5num(n, u[2]) + ' ' + u[0] + ' = ' + Y5_BLANK + ' ' + u[1], y5fmt(n) + ' ' + u[1])
                                             : q(y5fmt(n) + ' ' + u[1] + ' = ' + Y5_BLANK + ' ' + u[0], y5num(n, u[2]) + ' ' + u[0]); } },
    { id:'y5.c5.4',  block:'y5.c5', n:4,  title:'Convert between metric and imperial units',
      // The approximate equivalences are given in the question, as White Rose does.
      gen:function(){ var i = R(2,8)*2, m = R(2,6)*5, f = R(2,6), lb = R(2,5);
                      return P([ q('1 inch is about 2.5 cm. About how many centimetres is ' + i + ' inches?', y5num(i*25, 1) + ' cm'),
                                 q('5 miles is about 8 km. About how many kilometres is ' + m + ' miles?', (m/5*8) + ' km'),
                                 q('There are 12 inches in a foot. How many inches are in ' + f + ' feet?', 12*f + ' inches'),
                                 q('There are 16 ounces in a pound. How many ounces are in ' + lb + ' pounds?', 16*lb + ' ounces') ]); } },
    { id:'y5.c5.5',  block:'y5.c5', n:5,  title:'Convert units of time',
      gen:function(){ var n = R(2,9), h = R(1,4), m = R(1,59);
                      return P([ q('How many seconds are in ' + n + ' minutes?', 60*n),
                                 q('How many days are in ' + n + ' weeks?', 7*n),
                                 q('How many months are in ' + n + ' years?', 12*n),
                                 q((h*60 + m) + ' minutes = ' + Y5_BLANK + ' hours ' + Y5_BLANK + ' minutes', h + (h > 1 ? ' hours ' : ' hour ') + m + (m > 1 ? ' minutes' : ' minute')) ]); } },
    { id:'y5.c5.6',  block:'y5.c5', n:6,  title:'Calculate with timetables',
      gen:function(){ var dep = R(84,216)*5, dur = R(15,95);
                      return q('A train leaves at ' + y5hm(dep) + '. The journey takes ' + dur + ' minutes. What time does it arrive?', y5hm(dep + dur)); } },

    /* ---- Summer 6 · Volume --------------------------------- */
    { id:'y5.c6.1',  block:'y5.c6', n:1,  title:'Cubic centimetres',
      gen:function(){ var l = R(2,5), c = R(2,8);
                      return q('A cuboid is built from ' + l + ' layers of ' + c + ' centimetre cubes. What is its volume?', l*c + ' cm³'); } },
    { id:'y5.c6.2',  block:'y5.c6', n:2,  title:'Compare volume',
      gen:function(){ var a, b, c, d; do { a = R(2,5); b = R(3,9); c = R(2,5); d = R(3,9); } while (a*b === c*d);
                      return q('Shape A is ' + a + ' layers of ' + b + ' cm cubes. Shape B is ' + c + ' layers of ' + d + ' cm cubes. Which has the greater volume?',
                               (a*b > c*d ? 'A' : 'B') + ' (' + Math.max(a*b, c*d) + ' cm³)'); } },
    { id:'y5.c6.3',  block:'y5.c6', n:3,  title:'Estimate volume', gen:null, why:NEEDS_PICTURE },
    { id:'y5.c6.4',  block:'y5.c6', n:4,  title:'Estimate capacity',
      gen:function(){ var c = P([['a teaspoon','5 ml',['50 ml','500 ml']],['a mug','300 ml',['30 ml','3 litres']],
                                 ['a bucket','10 litres',['100 ml','100 litres']],['a bath','200 litres',['2 litres','2,000 litres']],
                                 ['a can of drink','330 ml',['33 ml','33 litres']]]);
                      return q('Which is the best estimate for the capacity of ' + c[0] + ': ' + shuffle([c[1]].concat(c[2])).join(', ') + '?', c[1]); } }
  ];

  /* ════════════════════════════════════════════════════════
     YEAR 6
     Transcribed from White Rose's own "Small steps" pages
     (© White Rose Maths/Education 2022) for the Autumn, Spring
     and Summer terms. The Summer "Themed projects, consolidation
     and problem solving" block has no numbered steps, so it is
     not listed.
     ════════════════════════════════════════════════════════ */

  /* ── Year 6 helpers ─────────────────────────────────────── */
  var Y6_MINUS = '−';
  /* 1234567 -> "1,234,567"; negatives get a proper minus sign. */
  function y6fmt(n){
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? Y6_MINUS : '') + s;
  }
  /* An integer count of 10^-dp units, written as a decimal with no
     float arithmetic: y6dec(345, 2) -> "3.45", y6dec(250, 2) -> "2.5". */
  function y6dec(n, dp){
    var neg = n < 0, a = Math.abs(n), p = Math.pow(10, dp);
    var w = Math.floor(a / p), f = String(a % p);
    while (f.length < dp) f = '0' + f;
    f = f.replace(/0+$/, '');
    return (neg ? Y6_MINUS : '') + y6fmt(w) + (f ? '.' + f : '');
  }
  /* Pence -> "45p" or "£3.05". */
  function y6money(p){
    if (p < 100) return p + 'p';
    var r = p % 100; return '£' + y6fmt(Math.floor(p / 100)) + '.' + (r < 10 ? '0' : '') + r;
  }
  function y6gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ var t = a % b; a = b; b = t; } return a; }
  function y6lcm(a, b){ return a / y6gcd(a, b) * b; }
  /* n/d in simplest form, as a proper fraction, whole or mixed number. */
  function y6mixed(n, d){
    var g = y6gcd(n, d); n /= g; d /= g;
    if (d === 1) return String(n);
    if (n < d) return n + '/' + d;
    return Math.floor(n / d) + ' ' + (n % d) + '/' + d;
  }
  /* A random proper fraction n/d already in simplest form. */
  function y6proper(dlo, dhi){
    var d = R(dlo, dhi), n = R(1, d - 1);
    while (y6gcd(n, d) !== 1) n = R(1, d - 1);
    return [n, d];
  }
  /* A digit string of k distinct non-zero digits, so "the value of
     the 7" never has two answers. */
  function y6digits(k){ return shuffle([1,2,3,4,5,6,7,8,9]).slice(0, k); }
  var Y6_ONES = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve',
                 'thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  var Y6_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function y6under100(n){ return n < 20 ? Y6_ONES[n] : Y6_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + Y6_ONES[n % 10] : ''); }
  function y6under1000(n){
    var h = Math.floor(n / 100), r = n % 100;
    return (h ? Y6_ONES[h] + ' hundred' + (r ? ' and ' : '') : '') + (r ? y6under100(r) : '');
  }
  /* 4206053 -> "four million, two hundred and six thousand and fifty-three" */
  function y6words(n){
    var m = Math.floor(n / 1000000), t = Math.floor(n / 1000) % 1000, u = n % 1000, out = [];
    if (m) out.push(y6under1000(m) + ' million');
    if (t) out.push(y6under1000(t) + ' thousand');
    var s = out.join(', ');
    if (u) s += out.length ? (u < 100 ? ' and ' : ', ') + y6under1000(u) : y6under1000(u);
    return s;
  }
  var Y6_BLANK = '<span class="gen-blank">?</span>';

  var Y6_BLOCKS = [
    { year:6, id:'y6.a1', term:'Autumn', n:1, title:'Place value' },
    { year:6, id:'y6.a2', term:'Autumn', n:2, title:'Addition, subtraction, multiplication and division' },
    { year:6, id:'y6.a3', term:'Autumn', n:3, title:'Fractions A' },
    { year:6, id:'y6.a4', term:'Autumn', n:4, title:'Fractions B' },
    { year:6, id:'y6.a5', term:'Autumn', n:5, title:'Converting units' },
    { year:6, id:'y6.b1', term:'Spring', n:1, title:'Ratio' },
    { year:6, id:'y6.b2', term:'Spring', n:2, title:'Algebra' },
    { year:6, id:'y6.b3', term:'Spring', n:3, title:'Decimals' },
    { year:6, id:'y6.b4', term:'Spring', n:4, title:'Fractions, decimals and percentages' },
    { year:6, id:'y6.b5', term:'Spring', n:5, title:'Area, perimeter and volume' },
    { year:6, id:'y6.b6', term:'Spring', n:6, title:'Statistics' },
    { year:6, id:'y6.c1', term:'Summer', n:1, title:'Shape' },
    { year:6, id:'y6.c2', term:'Summer', n:2, title:'Position and direction' }
  ];

  var Y6_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'y6.a1.1', block:'y6.a1', n:1, title:'Numbers to 1,000,000',
      gen:function(){ var d = y6digits(6), i = R(0,5), n = +d.join('');
                      return q('What is the value of the ' + d[i] + ' in ' + y6fmt(n) + '?', y6fmt(d[i] * Math.pow(10, 5 - i))); } },
    { id:'y6.a1.2', block:'y6.a1', n:2, title:'Numbers to 10,000,000',
      gen:function(){ var d = y6digits(7), i = R(0,6), n = +d.join('');
                      return q('What is the value of the ' + d[i] + ' in ' + y6fmt(n) + '?', y6fmt(d[i] * Math.pow(10, 6 - i))); } },
    { id:'y6.a1.3', block:'y6.a1', n:3, title:'Read and write numbers to 10,000,000',
      // Some zero digits on purpose: placing the zeros is the hard part.
      gen:function(){ var n = R(1,9)*1000000 + R(0,9)*100000 + R(0,1)*R(1,9)*10000 + R(0,9)*1000 + R(0,1)*R(1,9)*100 + R(0,99);
                      return q('Write in digits:<br>' + y6words(n), y6fmt(n)); } },
    { id:'y6.a1.4', block:'y6.a1', n:4, title:'Powers of 10',
      gen:function(){ var a = R(1,4), b = R(1, 6 - a);
                      var u = P([['tens',1],['hundreds',2],['thousands',3]]), e = R(u[1] + 1, 7);
                      return P([ q(y6fmt(Math.pow(10, a)) + ' × ' + y6fmt(Math.pow(10, b)) + ' =', y6fmt(Math.pow(10, a + b))),
                                 q('How many ' + u[0] + ' are in ' + y6fmt(Math.pow(10, e)) + '?', y6fmt(Math.pow(10, e - u[1]))) ]); } },
    { id:'y6.a1.5', block:'y6.a1', n:5, title:'Number line to 10,000,000',
      gen:function(){ var s = P([1000000, 100000, 10000]), a = R(1,9) * s;
                      return q('What number is halfway between ' + y6fmt(a) + ' and ' + y6fmt(a + s) + '?', y6fmt(a + s / 2)); } },
    { id:'y6.a1.6', block:'y6.a1', n:6, title:'Compare and order any integers',
      // Same millions digit so the child has to look past the first column.
      gen:function(){ if (R(1,4) === 1){ var p = two(-20, 20);
                        return q('&lt;, &gt; or =?<br>' + y6fmt(p[0]) + ' ' + Y6_BLANK + ' ' + y6fmt(p[1]), p[0] < p[1] ? '<' : '>'); }
                      var m = R(1,9) * 1000000, x = two(0, 999999);
                      return q('&lt;, &gt; or =?<br>' + y6fmt(m + x[0]) + ' ' + Y6_BLANK + ' ' + y6fmt(m + x[1]), x[0] < x[1] ? '<' : '>'); } },
    { id:'y6.a1.7', block:'y6.a1', n:7, title:'Round any integer',
      gen:function(){ var n = R(1000000, 9999999), t = P([[10,'10'],[100,'100'],[1000,'1,000'],[10000,'10,000'],[100000,'100,000'],[1000000,'1,000,000']]);
                      return q('Round ' + y6fmt(n) + ' to the nearest ' + t[1] + '.', y6fmt(Math.round(n / t[0]) * t[0])); } },
    { id:'y6.a1.8', block:'y6.a1', n:8, title:'Negative numbers',
      gen:function(){ var a = R(2,12), b = R(a + 1, a + 12), c = R(2,9);
                      return P([ q('The temperature is ' + Y6_MINUS + a + '°C. It rises by ' + b + '°C. What is it now?', (b - a) + '°C'),
                                 q('What is the difference between ' + Y6_MINUS + a + ' and ' + c + '?', a + c),
                                 q(c + ' − ' + (c + a) + ' =', Y6_MINUS + a) ]); } },

    /* ---- Autumn 2 · Addition, subtraction, multiplication and division */
    { id:'y6.a2.1', block:'y6.a2', n:1, title:'Add and subtract integers',
      gen:function(){ var a = R(10000, 499999), b = R(10000, 499999);
                      return P([true,false]) ? q(y6fmt(a) + ' + ' + y6fmt(b) + ' =', y6fmt(a + b))
                                             : q(y6fmt(a + b) + ' − ' + y6fmt(b) + ' =', y6fmt(a)); } },
    { id:'y6.a2.2', block:'y6.a2', n:2, title:'Common factors',
      gen:function(){ var g = R(2,9), m = R(1,6), n = R(2,7);
                      while (n === m || y6gcd(m, n) !== 1) n = R(2,7);
                      return q('What is the highest common factor of ' + g*m + ' and ' + g*n + '?', g); } },
    { id:'y6.a2.3', block:'y6.a2', n:3, title:'Common multiples',
      gen:function(){ var p = two(2,12); return q('What is the lowest common multiple of ' + p[0] + ' and ' + p[1] + '?', y6lcm(p[0], p[1])); } },
    { id:'y6.a2.4', block:'y6.a2', n:4, title:'Rules of divisibility',
      gen:function(){ var d = P([3,4,6,9]), n = R(100, 999) * d + (P([true,false]) ? 0 : R(1, d - 1));
                      return q('Is ' + y6fmt(n) + ' divisible by ' + d + '?', n % d === 0 ? 'yes' : 'no'); } },
    { id:'y6.a2.5', block:'y6.a2', n:5, title:'Primes to 100',
      gen:function(){ var pr = P([11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97]);
                      var cs = shuffle([21,27,33,39,49,51,57,63,69,77,81,87,91,93]).slice(0, 3);
                      return q('Which of these is a prime number?<br>' + shuffle(cs.concat([pr])).join(', '), pr); } },
    { id:'y6.a2.6', block:'y6.a2', n:6, title:'Square and cube numbers',
      gen:function(){ if (P([true,false])){ var s = R(2,12); return q(s + '<sup>2</sup> =', s * s); }
                      var c = R(2,6); return q(c + '<sup>3</sup> =', c * c * c); } },
    { id:'y6.a2.7', block:'y6.a2', n:7, title:'Multiply up to a 4-digit number by a 2-digit number',
      gen:function(){ var a = R(100, 2999), b = R(12, 39); return q(y6fmt(a) + ' × ' + b + ' =', y6fmt(a * b)); } },
    { id:'y6.a2.8', block:'y6.a2', n:8, title:'Solve problems with multiplication',
      gen:function(){ var a = R(12, 48), b = R(13, 45), it = P(['pencils','stickers','biscuits','cards']);
                      return q('A box holds ' + a + ' ' + it + '. How many ' + it + ' are in ' + b + ' boxes?', y6fmt(a * b)); } },
    { id:'y6.a2.9', block:'y6.a2', n:9, title:'Short division',
      gen:function(){ var d = R(3,9), x = R(Math.ceil(1000 / d), Math.floor(9999 / d));
                      return q(y6fmt(x * d) + ' ÷ ' + d + ' =', y6fmt(x)); } },
    { id:'y6.a2.10', block:'y6.a2', n:10, title:'Division using factors',
      gen:function(){ var f = P([[12,'3 × 4'],[14,'2 × 7'],[15,'3 × 5'],[16,'2 × 8'],[18,'2 × 9'],[24,'4 × 6'],[25,'5 × 5'],[28,'4 × 7'],[32,'4 × 8'],[35,'5 × 7']]), x = R(11, 30);
                      return q('Use ' + f[0] + ' = ' + f[1] + ' to work out ' + y6fmt(f[0] * x) + ' ÷ ' + f[0] + '.', x); } },
    { id:'y6.a2.11', block:'y6.a2', n:11, title:'Introduction to long division',
      gen:function(){ var d = R(11, 35), x = R(Math.max(3, Math.ceil(100 / d)), Math.floor(999 / d));
                      return q(x * d + ' ÷ ' + d + ' =', x); } },
    { id:'y6.a2.12', block:'y6.a2', n:12, title:'Long division with remainders',
      gen:function(){ var d = R(11, 25), x = R(Math.ceil(100 / d), Math.floor(900 / d)), r = R(1, d - 1);
                      return q(y6fmt(x * d + r) + ' ÷ ' + d + ' =', x + ' r ' + r); } },
    { id:'y6.a2.13', block:'y6.a2', n:13, title:'Solve problems with division',
      // The remainder is the point: a part-full coach is still a coach.
      gen:function(){ var c = P([24,32,36,45,48,52]), n = R(4, 15) * c + R(1, c - 1);
                      return q(n + ' people go on a trip. Each coach holds ' + c + '. How many coaches are needed?', Math.ceil(n / c)); } },
    { id:'y6.a2.14', block:'y6.a2', n:14, title:'Solve multi-step problems',
      gen:function(){ var a = R(2,4), pa = R(5,9), b = R(2,3), pb = R(1,4), cost = a*pa + b*pb;
                      return q('I buy ' + a + ' books at £' + pa + ' each and ' + b + ' pens at £' + pb + ' each. How much change from £50?', '£' + (50 - cost)); } },
    { id:'y6.a2.15', block:'y6.a2', n:15, title:'Order of operations',
      gen:function(){ var a = R(2,20), b = R(2,9), c = R(2,9);
                      return P([ q(a + ' + ' + b + ' × ' + c + ' =', a + b * c),
                                 q('(' + a + ' + ' + b + ') × ' + c + ' =', (a + b) * c),
                                 q(b * c + a + ' − ' + b + ' × ' + c + ' =', a),
                                 q(a * c + ' ÷ ' + c + ' + ' + b + ' =', a + b) ]); } },
    { id:'y6.a2.16', block:'y6.a2', n:16, title:'Mental calculations and estimation',
      gen:function(){ var x = R(2,6), y = R(1,3), a = x*1000 + P([R(-30,-2), R(2,30)]), b = y*1000 + P([R(-30,-2), R(2,30)]);
                      return q('Estimate by rounding to the nearest 1,000:<br>' + y6fmt(a) + ' + ' + y6fmt(b), y6fmt((x + y) * 1000)); } },
    { id:'y6.a2.17', block:'y6.a2', n:17, title:'Reason from known facts',
      gen:function(){ var a = R(12, 39), b = R(11, 29), p = a * b, k = 'If ' + a + ' × ' + b + ' = ' + y6fmt(p) + ', what is ';
                      return P([ q(k + a + ' × ' + (b + 1) + '?', y6fmt(p + a)),
                                 q(k + y6fmt(p) + ' ÷ ' + b + '?', a),
                                 q(k + a * 10 + ' × ' + b + '?', y6fmt(p * 10)) ]); } },

    /* ---- Autumn 3 · Fractions A ----------------------------- */
    { id:'y6.a3.1', block:'y6.a3', n:1, title:'Equivalent fractions and simplifying',
      gen:function(){ var f = y6proper(3, 9), k = R(2, 6);
                      return q('Simplify ' + f[0]*k + '/' + f[1]*k + '.', f[0] + '/' + f[1]); } },
    { id:'y6.a3.2', block:'y6.a3', n:2, title:'Equivalent fractions on a number line',
      gen:function(){ var f = y6proper(2, 6), k = R(2, 4), parts = f[1] * k;
                      return q('A number line from 0 to 1 is split into ' + parts + ' equal parts. Which mark is at ' + f[0] + '/' + f[1] + '?',
                               'mark ' + f[0]*k + ' (' + f[0]*k + '/' + parts + ')'); } },
    { id:'y6.a3.3', block:'y6.a3', n:3, title:'Compare and order (denominator)',
      gen:function(){ var d = R(2, 6), k = R(2, 3), D = d * k, a = R(1, d - 1), b = R(1, D - 1);
                      while (b === a * k) b = R(1, D - 1);
                      return q('Which is greater, ' + a + '/' + d + ' or ' + b + '/' + D + '?', a * k > b ? a + '/' + d : b + '/' + D); } },
    { id:'y6.a3.4', block:'y6.a3', n:4, title:'Compare and order (numerator)',
      gen:function(){ var n = R(1, 5), p = two(n + 1, 12);
                      return q('Which is greater, ' + n + '/' + p[0] + ' or ' + n + '/' + p[1] + '?', n + '/' + Math.min(p[0], p[1])); } },
    { id:'y6.a3.5', block:'y6.a3', n:5, title:'Add and subtract simple fractions',
      // One denominator is a multiple of the other.
      gen:function(){ var d = R(2, 5), D = d * R(2, 3), a = R(1, d - 1), b = R(1, D - 1);
                      if (P([true,false]) || a * D / d === b) return q(a + '/' + d + ' + ' + b + '/' + D + ' =', y6mixed(a * D / d + b, D));
                      var x = a * D / d;
                      return x > b ? q(a + '/' + d + ' − ' + b + '/' + D + ' =', y6mixed(x - b, D))
                                   : q(b + '/' + D + ' − ' + a + '/' + d + ' =', y6mixed(b - x, D)); } },
    { id:'y6.a3.6', block:'y6.a3', n:6, title:'Add and subtract any two fractions',
      gen:function(){ var d = two(2, 7), f = [R(1, d[0] - 1), R(1, d[1] - 1)], L = d[0] * d[1];
                      var x = f[0] * d[1], y = f[1] * d[0];
                      if (P([true,false]) || x === y) return q(f[0] + '/' + d[0] + ' + ' + f[1] + '/' + d[1] + ' =', y6mixed(x + y, L));
                      return x > y ? q(f[0] + '/' + d[0] + ' − ' + f[1] + '/' + d[1] + ' =', y6mixed(x - y, L))
                                   : q(f[1] + '/' + d[1] + ' − ' + f[0] + '/' + d[0] + ' =', y6mixed(y - x, L)); } },
    { id:'y6.a3.7', block:'y6.a3', n:7, title:'Add mixed numbers',
      gen:function(){ var d = two(2, 6), w = [R(1, 4), R(1, 4)], f = [R(1, d[0] - 1), R(1, d[1] - 1)], L = d[0] * d[1];
                      var tot = (w[0] * d[0] + f[0]) * d[1] + (w[1] * d[1] + f[1]) * d[0];
                      return q(w[0] + ' ' + f[0] + '/' + d[0] + ' + ' + w[1] + ' ' + f[1] + '/' + d[1] + ' =', y6mixed(tot, L)); } },
    { id:'y6.a3.8', block:'y6.a3', n:8, title:'Subtract mixed numbers',
      // The first whole part is at least 2 bigger, so the answer is positive.
      gen:function(){ var d = two(2, 6), b = R(1, 3), a = R(b + 2, 7), f = [R(1, d[0] - 1), R(1, d[1] - 1)], L = d[0] * d[1];
                      var diff = (a * d[0] + f[0]) * d[1] - (b * d[1] + f[1]) * d[0];
                      return q(a + ' ' + f[0] + '/' + d[0] + ' − ' + b + ' ' + f[1] + '/' + d[1] + ' =', y6mixed(diff, L)); } },
    { id:'y6.a3.9', block:'y6.a3', n:9, title:'Multi-step problems',
      // Two different unit fractions from 1/2..1/8 always sum to less than 1.
      gen:function(){ var d = two(2, 8), L = d[0] * d[1];
                      return q('Tom eats 1/' + d[0] + ' of a pizza and Sam eats 1/' + d[1] + '. What fraction of the pizza is left?', y6mixed(L - d[0] - d[1], L)); } },

    /* ---- Autumn 4 · Fractions B ----------------------------- */
    { id:'y6.a4.1', block:'y6.a4', n:1, title:'Multiply fractions by integers',
      gen:function(){ var f = y6proper(3, 9), k = R(2, 6); return q(f[0] + '/' + f[1] + ' × ' + k + ' =', y6mixed(f[0] * k, f[1])); } },
    { id:'y6.a4.2', block:'y6.a4', n:2, title:'Multiply fractions by fractions',
      gen:function(){ var a = y6proper(2, 6), b = y6proper(2, 6);
                      return q(a[0] + '/' + a[1] + ' × ' + b[0] + '/' + b[1] + ' =', y6mixed(a[0] * b[0], a[1] * b[1])); } },
    { id:'y6.a4.3', block:'y6.a4', n:3, title:'Divide a fraction by an integer',
      // The numerator is a multiple of the divisor, so it divides straight.
      gen:function(){ var k = R(2, 4), m = R(1, 3), n = k * m, d = R(n + 1, 13);
                      return q(n + '/' + d + ' ÷ ' + k + ' =', y6mixed(m, d)); } },
    { id:'y6.a4.4', block:'y6.a4', n:4, title:'Divide any fraction by an integer',
      gen:function(){ var f = y6proper(2, 7), k = R(2, 5); return q(f[0] + '/' + f[1] + ' ÷ ' + k + ' =', y6mixed(f[0], f[1] * k)); } },
    { id:'y6.a4.5', block:'y6.a4', n:5, title:'Mixed questions with fractions',
      gen:function(){ var a = y6proper(2, 6), b = y6proper(2, 6), k = R(2, 5);
                      return P([ q(a[0] + '/' + a[1] + ' + ' + b[0] + '/' + b[1] + ' =', y6mixed(a[0] * b[1] + b[0] * a[1], a[1] * b[1])),
                                 q(a[0] + '/' + a[1] + ' × ' + b[0] + '/' + b[1] + ' =', y6mixed(a[0] * b[0], a[1] * b[1])),
                                 q(a[0] + '/' + a[1] + ' ÷ ' + k + ' =', y6mixed(a[0], a[1] * k)) ]); } },
    { id:'y6.a4.6', block:'y6.a4', n:6, title:'Fraction of an amount',
      gen:function(){ var f = y6proper(3, 9), k = R(2, 12); return q('What is ' + f[0] + '/' + f[1] + ' of ' + f[1] * k + '?', f[0] * k); } },
    { id:'y6.a4.7', block:'y6.a4', n:7, title:'Fraction of an amount – find the whole',
      gen:function(){ var f = y6proper(3, 9), k = R(2, 12);
                      return q(f[0] + '/' + f[1] + ' of a number is ' + f[0] * k + '. What is the number?', f[1] * k); } },

    /* ---- Autumn 5 · Converting units ------------------------ */
    { id:'y6.a5.1', block:'y6.a5', n:1, title:'Metric measures',
      gen:function(){ var f = P([['millimetres','a centimetre',10],['centimetres','a metre',100],['metres','a kilometre',1000],
                                 ['grams','a kilogram',1000],['millilitres','a litre',1000],['millimetres','a metre',1000]]);
                      return q('How many ' + f[0] + ' are in ' + f[1] + '?', y6fmt(f[2])); } },
    { id:'y6.a5.2', block:'y6.a5', n:2, title:'Convert metric measures',
      // Values are held in whole small units, so no float ever appears.
      gen:function(){ var u = P([['km','m',1000,3],['kg','g',1000,3],['l','ml',1000,3],['m','cm',100,2],['cm','mm',10,1]]), z = u[3];
                      if (P([true,false])){ var t = R(11, 99); // tenths of the big unit
                        return q(y6dec(t, 1) + ' ' + u[0] + ' = ' + Y6_BLANK + ' ' + u[1], y6fmt(t * u[2] / 10) + ' ' + u[1]); }
                      var s = R(u[2] + 1, u[2] * 9);
                      return q(y6fmt(s) + ' ' + u[1] + ' = ' + Y6_BLANK + ' ' + u[0], y6dec(s, z) + ' ' + u[0]); } },
    { id:'y6.a5.3', block:'y6.a5', n:3, title:'Calculate with metric measures',
      gen:function(){ var u = P([['kg','g'],['km','m'],['l','ml']]), a = R(11, 49), b = R(1, 19) * 50;
                      return q(y6dec(a, 1) + ' ' + u[0] + ' + ' + b + ' ' + u[1] + ' = ' + Y6_BLANK + ' ' + u[1], y6fmt(a * 100 + b) + ' ' + u[1]); } },
    { id:'y6.a5.4', block:'y6.a5', n:4, title:'Miles and kilometres',
      gen:function(){ var k = R(2, 12);
                      return P([true,false]) ? q('5 miles ≈ 8 km. About how many km is ' + 5 * k + ' miles?', 8 * k + ' km')
                                             : q('5 miles ≈ 8 km. About how many miles is ' + 8 * k + ' km?', 5 * k + ' miles'); } },
    { id:'y6.a5.5', block:'y6.a5', n:5, title:'Imperial measures',
      gen:function(){ var f = P([['inches','feet',12],['feet','yards',3],['ounces','pounds',16],['pints','gallons',8],['pounds','stone',14]]), n = R(2, 6);
                      return q('How many ' + f[0] + ' are in ' + n + ' ' + f[1] + '?<br>(1 ' + (f[1] === 'feet' ? 'foot' : f[1] === 'stone' ? 'stone' : f[1].slice(0, -1)) + ' = ' + f[2] + ' ' + f[0] + ')', n * f[2] + ' ' + f[0]); } },

    /* ---- Spring 1 · Ratio ----------------------------------- */
    { id:'y6.b1.1', block:'y6.b1', n:1, title:'Add or multiply?',
      gen:function(){ var e = R(2, 4), c = R(3, 9);
                      return q('1 cake needs ' + e + ' eggs. How many eggs are needed for ' + c + ' cakes?', e * c); } },
    { id:'y6.b1.2', block:'y6.b1', n:2, title:'Use ratio language',
      gen:function(){ var p = two(2, 5), k = R(2, 6);
                      return q('For every ' + p[0] + ' red beads there are ' + p[1] + ' blue beads. There are ' + p[0] * k + ' red beads. How many blue beads?', p[1] * k); } },
    { id:'y6.b1.3', block:'y6.b1', n:3, title:'Introduction to the ratio symbol',
      gen:function(){ var p = two(2, 9); return q('There are ' + p[0] + ' cats and ' + p[1] + ' dogs. Write the ratio of cats to dogs.', p[0] + ' : ' + p[1]); } },
    { id:'y6.b1.4', block:'y6.b1', n:4, title:'Ratio and fractions',
      gen:function(){ var a = R(1, 5), b = R(2, 7); while (b === a || y6gcd(a, b) !== 1) b = R(2, 7);
                      return q('Red to blue counters are in the ratio ' + a + ' : ' + b + '. What fraction of the counters are red?', a + '/' + (a + b)); } },
    { id:'y6.b1.5', block:'y6.b1', n:5, title:'Scale drawing',
      gen:function(){ var s = P([2,5,10,20,50]), c = R(2, 9);
                      return q('On a map, 1 cm represents ' + s + ' km. A road is ' + c + ' cm long on the map. How long is the real road?', s * c + ' km'); } },
    { id:'y6.b1.6', block:'y6.b1', n:6, title:'Use scale factors',
      gen:function(){ var p = two(2, 9), k = R(2, 5);
                      return q('A ' + p[0] + ' cm by ' + p[1] + ' cm rectangle is enlarged by scale factor ' + k + '. What is the new longer side?', k * Math.max(p[0], p[1]) + ' cm'); } },
    { id:'y6.b1.7', block:'y6.b1', n:7, title:'Similar shapes',
      gen:function(){ var a = R(2, 6), k = R(2, 4), b = R(a + 1, 12);
                      return q('Shapes A and B are similar. A side of ' + a + ' cm on A is ' + a * k + ' cm on B. A side of ' + b + ' cm on A is how long on B?', b * k + ' cm'); } },
    { id:'y6.b1.8', block:'y6.b1', n:8, title:'Ratio problems',
      gen:function(){ var p = two(1, 7), k = R(2, 9);
                      return q('Share ' + (p[0] + p[1]) * k + ' in the ratio ' + p[0] + ' : ' + p[1] + '. What is the larger share?', Math.max(p[0], p[1]) * k); } },
    { id:'y6.b1.9', block:'y6.b1', n:9, title:'Proportion problems',
      gen:function(){ var u = R(12, 30), a = R(3, 6), b = R(2, 9); while (b === a) b = R(2, 9);
                      return q(a + ' pens cost ' + y6money(u * a) + '. How much do ' + b + ' pens cost?', y6money(u * b)); } },
    { id:'y6.b1.10', block:'y6.b1', n:10, title:'Recipes',
      gen:function(){ var per = R(2, 10) * 25, a = P([2, 4, 5]), b = P([3, 6, 8, 10]); while (b === a) b = P([3, 6, 8, 10]);
                      return q('A recipe for ' + a + ' people uses ' + per * a + ' g of flour. How much flour for ' + b + ' people?', y6fmt(per * b) + ' g'); } },

    /* ---- Spring 2 · Algebra --------------------------------- */
    { id:'y6.b2.1', block:'y6.b2', n:1, title:'1-step function machines',
      gen:function(){ var x = R(2, 12), op = P([['×', R(2, 9)], ['+', R(5, 50)]]), out = op[0] === '×' ? x * op[1] : x + op[1];
                      return P([true,false]) ? q('Input ' + x + ' → ' + op[0] + ' ' + op[1] + ' → output?', out)
                                             : q('Input ? → ' + op[0] + ' ' + op[1] + ' → output ' + out + '. What was the input?', x); } },
    { id:'y6.b2.2', block:'y6.b2', n:2, title:'2-step function machines',
      gen:function(){ var x = R(2, 10), m = R(2, 6), a = R(1, 20), out = x * m + a;
                      return P([true,false]) ? q('Input ' + x + ' → × ' + m + ' → + ' + a + ' → output?', out)
                                             : q('Input ? → × ' + m + ' → + ' + a + ' → output ' + out + '. What was the input?', x); } },
    { id:'y6.b2.3', block:'y6.b2', n:3, title:'Form expressions',
      gen:function(){ var m = R(2, 9), a = R(1, 15);
                      return P([ q('Write an expression: multiply n by ' + m + ', then add ' + a + '.', m + 'n + ' + a),
                                 q('Write an expression: add ' + a + ' to n, then multiply by ' + m + '.', m + '(n + ' + a + ')'),
                                 q('Write an expression: ' + a + ' less than n.', 'n − ' + a) ]); } },
    { id:'y6.b2.4', block:'y6.b2', n:4, title:'Substitution',
      gen:function(){ var v = R(2, 12), m = R(2, 9), a = R(1, 20);
                      return q('If a = ' + v + ', what is ' + m + 'a + ' + a + '?', m * v + a); } },
    { id:'y6.b2.5', block:'y6.b2', n:5, title:'Formulae',
      gen:function(){ var s = R(3, 15), c = R(2, 9), n = R(2, 9), f = R(5, 30);
                      return P([ q('The perimeter of a square is P = 4s. Find P when s = ' + s + ' cm.', 4 * s + ' cm'),
                                 q('Cost in £: C = ' + c + 'n + ' + f + '. Find C when n = ' + n + '.', '£' + (c * n + f)) ]); } },
    { id:'y6.b2.6', block:'y6.b2', n:6, title:'Form equations',
      gen:function(){ var x = R(2, 12), m = R(2, 6), a = R(1, 15);
                      return q('I think of a number n, multiply it by ' + m + ' and add ' + a + '. The answer is ' + (m * x + a) + '. Write this as an equation.', m + 'n + ' + a + ' = ' + (m * x + a)); } },
    { id:'y6.b2.7', block:'y6.b2', n:7, title:'Solve 1-step equations',
      gen:function(){ var x = R(2, 30), a = R(5, 60), m = R(2, 9);
                      return P([ q('x + ' + a + ' = ' + (x + a) + '. What is x?', x),
                                 q(m + 'x = ' + m * x + '. What is x?', x),
                                 q('x − ' + a + ' = ' + x + '. What is x?', x + a) ]); } },
    { id:'y6.b2.8', block:'y6.b2', n:8, title:'Solve 2-step equations',
      gen:function(){ var x = R(2, 12), m = R(2, 9), a = R(1, 20);
                      return q(m + 'x + ' + a + ' = ' + (m * x + a) + '. What is x?', x); } },
    { id:'y6.b2.9', block:'y6.b2', n:9, title:'Find pairs of values',
      gen:function(){ var a = R(1, 8), m = R(2, 4), b = R(1, 15);
                      return q(m + 'a + b = ' + (m * a + b) + '. If a = ' + a + ', what is b?', b); } },
    { id:'y6.b2.10', block:'y6.b2', n:10, title:'Solve problems with two unknowns',
      gen:function(){ var b = R(1, 12), a = R(b + 1, 20);
                      return q('a + b = ' + (a + b) + ' and a − b = ' + (a - b) + '. Find a and b.', 'a = ' + a + ', b = ' + b); } },

    /* ---- Spring 3 · Decimals -------------------------------- */
    { id:'y6.b3.1', block:'y6.b3', n:1, title:'Place value within 1',
      gen:function(){ var d = y6digits(3), i = R(0, 2);
                      return q('What is the value of the ' + d[i] + ' in 0.' + d.join('') + '?', y6dec(d[i], i + 1)); } },
    { id:'y6.b3.2', block:'y6.b3', n:2, title:'Place value – integers and decimals',
      gen:function(){ var d = y6digits(5), i = R(0, 4);
                      return q('What is the value of the ' + d[i] + ' in ' + d[0] + d[1] + d[2] + '.' + d[3] + d[4] + '?',
                               i < 3 ? y6fmt(d[i] * Math.pow(10, 2 - i)) : y6dec(d[i], i - 2)); } },
    { id:'y6.b3.3', block:'y6.b3', n:3, title:'Round decimals',
      gen:function(){ var n = R(1001, 29999); while (n % 10 === 0) n = R(1001, 29999); // thousandths, 3 real dp
                      var t = P([['the nearest whole number', 1000, 0], ['1 decimal place', 100, 1], ['2 decimal places', 10, 2]]);
                      // Integer half-up rounding; trailing zeros kept (3.0, not 3).
                      var r = String(Math.floor((n + t[1] / 2) / t[1])), w;
                      if (t[2]){ while (r.length <= t[2]) r = '0' + r; w = r.slice(0, -t[2]) + '.' + r.slice(-t[2]); } else w = r;
                      return q('Round ' + y6dec(n, 3) + ' to ' + t[0] + '.', w); } },
    { id:'y6.b3.4', block:'y6.b3', n:4, title:'Add and subtract decimals',
      gen:function(){ var a = R(101, 999), b = R(11, 899); // hundredths
                      return P([true,false]) ? q(y6dec(a, 2) + ' + ' + y6dec(b, 2) + ' =', y6dec(a + b, 2))
                                             : q(y6dec(a + b, 2) + ' − ' + y6dec(b, 2) + ' =', y6dec(a, 2)); } },
    { id:'y6.b3.5', block:'y6.b3', n:5, title:'Multiply by 10, 100 and 1,000',
      gen:function(){ var n = R(11, 9999), p = P([10, 100, 1000]); // n thousandths
                      return q(y6dec(n, 3) + ' × ' + y6fmt(p) + ' =', y6dec(n * p, 3)); } },
    { id:'y6.b3.6', block:'y6.b3', n:6, title:'Divide by 10, 100 and 1,000',
      // n is in tenths only when the answer stays within 3 decimal places.
      gen:function(){ var z = P([1, 2, 3]), t = z < 3 && P([true,false]) ? 1 : 0, n = R(11, 9999);
                      return q(y6dec(n, t) + ' ÷ ' + y6fmt(Math.pow(10, z)) + ' =', y6dec(n, t + z)); } },
    { id:'y6.b3.7', block:'y6.b3', n:7, title:'Multiply decimals by integers',
      gen:function(){ var dp = P([1, 2]), n = dp === 1 ? R(11, 99) : R(101, 999), k = R(2, 9);
                      return q(y6dec(n, dp) + ' × ' + k + ' =', y6dec(n * k, dp)); } },
    { id:'y6.b3.8', block:'y6.b3', n:8, title:'Divide decimals by integers',
      // Answer in tenths; re-drawn until the dividend is a real decimal (not 12 ÷ 3).
      gen:function(){ var k = R(2, 9), r = R(11, 99); while ((r * k) % 10 === 0) r = R(11, 99);
                      return q(y6dec(r * k, 1) + ' ÷ ' + k + ' =', y6dec(r, 1)); } },
    { id:'y6.b3.9', block:'y6.b3', n:9, title:'Multiply and divide decimals in context',
      gen:function(){ var p = R(105, 495), k = R(3, 8);
                      return P([true,false]) ? q('A pen costs ' + y6money(p) + '. How much do ' + k + ' pens cost?', y6money(p * k))
                                             : q(y6money(p * k) + ' is shared equally between ' + k + ' people. How much does each get?', y6money(p)); } },

    /* ---- Spring 4 · Fractions, decimals and percentages ----- */
    { id:'y6.b4.1', block:'y6.b4', n:1, title:'Decimal and fraction equivalents',
      gen:function(){ var d = P([2, 4, 5, 10, 20, 25, 50]), n = R(1, d - 1), h = n * 100 / d;
                      return P([true,false]) ? q('Write ' + y6dec(h, 2) + ' as a fraction in its simplest form.', y6mixed(n, d))
                                             : q('Write ' + y6mixed(n, d) + ' as a decimal.', y6dec(h, 2)); } },
    { id:'y6.b4.2', block:'y6.b4', n:2, title:'Fractions as division',
      gen:function(){ var a = R(1, 11), b = R(2, 8); while (a === b || a % b === 0) a = R(1, 11);
                      return q(a + ' pizzas are shared equally between ' + b + ' people. How much pizza does each person get?', y6mixed(a, b)); } },
    { id:'y6.b4.3', block:'y6.b4', n:3, title:'Understand percentages',
      gen:function(){ var s = R(1, 99);
                      return P([true,false]) ? q(s + ' out of 100 squares are shaded. What percentage is shaded?', s + '%')
                                             : q(s + '% of a grid is shaded. What percentage is not shaded?', 100 - s + '%'); } },
    { id:'y6.b4.4', block:'y6.b4', n:4, title:'Fractions to percentages',
      gen:function(){ var d = P([2, 4, 5, 10, 20, 25, 50]), n = R(1, d - 1);
                      return q('Write ' + y6mixed(n, d) + ' as a percentage.', n * 100 / d + '%'); } },
    { id:'y6.b4.5', block:'y6.b4', n:5, title:'Equivalent fractions, decimals and percentages',
      gen:function(){ var p = R(1, 99);
                      return P([ q('Write ' + y6dec(p, 2) + ' as a percentage.', p + '%'),
                                 q('Write ' + p + '% as a decimal.', y6dec(p, 2)),
                                 q('Write ' + p + '% as a fraction in its simplest form.', y6mixed(p, 100)) ]); } },
    { id:'y6.b4.6', block:'y6.b4', n:6, title:'Order fractions, decimals and percentages',
      // All three are held as whole percentages; three distinct values.
      gen:function(){ var d = P([2, 4, 5, 10, 20]), n = R(1, d - 1), f = n * 100 / d, x = R(5, 95), y = R(5, 95);
                      while (x === f) x = R(5, 95);
                      while (y === f || y === x) y = R(5, 95);
                      var items = shuffle([[f, y6mixed(n, d)], [x, y6dec(x, 2)], [y, y + '%']]);
                      var top = items.slice().sort(function (a, b){ return b[0] - a[0]; })[0];
                      return q('Which is the greatest?<br>' + items.map(function (i){ return i[1]; }).join(', '), top[1]); } },
    { id:'y6.b4.7', block:'y6.b4', n:7, title:'Percentage of an amount – one step',
      gen:function(){ var t = P([[50, 2], [25, 4], [10, 10], [20, 5], [1, 100]]), k = R(2, 30);
                      return q('What is ' + t[0] + '% of ' + y6fmt(t[1] * k) + '?', k); } },
    { id:'y6.b4.8', block:'y6.b4', n:8, title:'Percentage of an amount – multi-step',
      // Multiples of 20 times multiples of 5% always give a whole number.
      gen:function(){ var p = P([5, 15, 30, 35, 40, 45, 60, 65, 70, 75, 90]), n = R(1, 20) * 20;
                      return q('What is ' + p + '% of ' + n + '?', p * n / 100); } },
    { id:'y6.b4.9', block:'y6.b4', n:9, title:'Percentages – missing values',
      gen:function(){ var t = P([[50, 2], [25, 4], [10, 10], [20, 5]]), k = R(2, 20);
                      return P([true,false]) ? q(t[0] + '% of a number is ' + k + '. What is the number?', t[1] * k)
                                             : q('What percentage of ' + t[1] * k + ' is ' + k + '?', t[0] + '%'); } },

    /* ---- Spring 5 · Area, perimeter and volume -------------- */
    { id:'y6.b5.1', block:'y6.b5', n:1, title:'Shapes – same area',
      gen:function(){ var s = R(2, 6) * 2;
                      return q('A rectangle ' + s / 2 + ' cm by ' + s * 2 + ' cm has the same area as a square. How long is a side of the square?', s + ' cm'); } },
    { id:'y6.b5.2', block:'y6.b5', n:2, title:'Area and perimeter',
      gen:function(){ var p = two(2, 12);
                      return P([true,false]) ? q('A rectangle is ' + p[0] + ' cm by ' + p[1] + ' cm. What is its area?', p[0] * p[1] + ' cm²')
                                             : q('A rectangle is ' + p[0] + ' cm by ' + p[1] + ' cm. What is its perimeter?', 2 * (p[0] + p[1]) + ' cm'); } },
    { id:'y6.b5.3', block:'y6.b5', n:3, title:'Area of a triangle – counting squares', gen:null, why:NEEDS_PICTURE },
    { id:'y6.b5.4', block:'y6.b5', n:4, title:'Area of a right-angled triangle',
      gen:function(){ var b = R(2, 8) * 2, h = R(3, 12);
                      return q('A right-angled triangle has a base of ' + b + ' cm and a height of ' + h + ' cm. What is its area?', b * h / 2 + ' cm²'); } },
    { id:'y6.b5.5', block:'y6.b5', n:5, title:'Area of any triangle',
      gen:function(){ var b = R(3, 15), h = R(2, 7) * 2;
                      return q('A triangle has a base of ' + b + ' cm and a perpendicular height of ' + h + ' cm. What is its area?', b * h / 2 + ' cm²'); } },
    { id:'y6.b5.6', block:'y6.b5', n:6, title:'Area of a parallelogram',
      gen:function(){ var b = R(3, 15), h = R(2, 12);
                      return q('A parallelogram has a base of ' + b + ' cm and a perpendicular height of ' + h + ' cm. What is its area?', b * h + ' cm²'); } },
    { id:'y6.b5.7', block:'y6.b5', n:7, title:'Volume – counting cubes',
      gen:function(){ var l = R(2, 6), w = R(2, 5), h = R(2, 4);
                      return q('A cuboid is built from 1 cm cubes: ' + l + ' long, ' + w + ' wide and ' + h + ' high. How many cubes?', l * w * h); } },
    { id:'y6.b5.8', block:'y6.b5', n:8, title:'Volume of a cuboid',
      gen:function(){ var l = R(2, 12), w = R(2, 8), h = R(2, 6);
                      return P([true,false]) ? q('What is the volume of a cuboid ' + l + ' cm × ' + w + ' cm × ' + h + ' cm?', l * w * h + ' cm³')
                                             : q('A cuboid has a volume of ' + l * w * h + ' cm³. It is ' + l + ' cm long and ' + w + ' cm wide. How high is it?', h + ' cm'); } },

    /* ---- Spring 6 · Statistics ------------------------------ */
    { id:'y6.b6.1', block:'y6.b6', n:1, title:'Line graphs', gen:null, why:NEEDS_PICTURE },
    { id:'y6.b6.2', block:'y6.b6', n:2, title:'Dual bar charts', gen:null, why:NEEDS_PICTURE },
    { id:'y6.b6.3', block:'y6.b6', n:3, title:'Read and interpret pie charts',
      gen:function(){ var f = P([['half', 2], ['a quarter', 4], ['an eighth', 8], ['a third', 3]]), k = R(2, 12);
                      return q('A pie chart shows ' + f[1] * k + ' children. ' + f[0].charAt(0).toUpperCase() + f[0].slice(1) + ' of the pie is football. How many children chose football?', k); } },
    { id:'y6.b6.4', block:'y6.b6', n:4, title:'Pie charts with percentages',
      gen:function(){ var p = P([10, 20, 25, 30, 40, 50, 75]), n = R(1, 8) * 100;
                      return q('A pie chart shows ' + n + ' people. ' + p + '% chose red. How many people chose red?', p * n / 100); } },
    { id:'y6.b6.5', block:'y6.b6', n:5, title:'Draw pie charts',
      // Totals that divide 360, so every sector angle is whole.
      gen:function(){ var t = P([12, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90]), c = R(1, t - 1);
                      return q(t + ' children are surveyed and ' + c + ' choose blue. What angle is the blue sector of a pie chart?', 360 / t * c + '°'); } },
    { id:'y6.b6.6', block:'y6.b6', n:6, title:'The mean',
      // Deviations from the mean come in +d/−d pairs, so every value is positive.
      gen:function(){ var m = R(5, 20), k = R(3, 5), xs = [], i, d;
                      for (i = 0; i + 1 < k; i += 2){ d = R(1, 4); xs.push(m + d, m - d); }
                      if (xs.length < k) xs.push(m);
                      return q('What is the mean of ' + shuffle(xs).join(', ') + '?', m); } },

    /* ---- Summer 1 · Shape ----------------------------------- */
    { id:'y6.c1.1', block:'y6.c1', n:1, title:'Measure and classify angles',
      gen:function(){ var a = P([R(10, 85), 90, R(95, 175), R(185, 350)]);
                      return q('Is an angle of ' + a + '° acute, right, obtuse or reflex?', a < 90 ? 'acute' : a === 90 ? 'right' : a < 180 ? 'obtuse' : 'reflex'); } },
    { id:'y6.c1.2', block:'y6.c1', n:2, title:'Calculate angles',
      gen:function(){ var a = R(15, 165), b = R(20, 340);
                      return P([true,false]) ? q('Two angles lie on a straight line. One is ' + a + '°. What is the other?', 180 - a + '°')
                                             : q('Two angles meet at a point. One is ' + b + '°. What is the other?', 360 - b + '°'); } },
    { id:'y6.c1.3', block:'y6.c1', n:3, title:'Vertically opposite angles',
      gen:function(){ var a = R(20, 160); while (a === 90) a = R(20, 160);
                      return P([true,false]) ? q('Two straight lines cross. One angle is ' + a + '°. What is the vertically opposite angle?', a + '°')
                                             : q('Two straight lines cross. One angle is ' + a + '°. What is the angle next to it?', 180 - a + '°'); } },
    { id:'y6.c1.4', block:'y6.c1', n:4, title:'Angles in a triangle',
      gen:function(){ var a = R(20, 100), b = R(20, 160 - a);
                      return q('A triangle has angles of ' + a + '° and ' + b + '°. What is the third angle?', 180 - a - b + '°'); } },
    { id:'y6.c1.5', block:'y6.c1', n:5, title:'Angles in a triangle – special cases',
      gen:function(){ var t = R(10, 80) * 2, r = R(15, 75);
                      return P([ q('What size is each angle in an equilateral triangle?', '60°'),
                                 q('An isosceles triangle has a top angle of ' + t + '°. What size is each of the other two angles?', (180 - t) / 2 + '°'),
                                 q('A right-angled triangle has an angle of ' + r + '°. What is the third angle?', 90 - r + '°') ]); } },
    { id:'y6.c1.6', block:'y6.c1', n:6, title:'Angles in a triangle – missing angles',
      gen:function(){ var b = R(20, 85);
                      return q('In an isosceles triangle, one of the two equal angles is ' + b + '°. What is the third angle?', 180 - 2 * b + '°'); } },
    { id:'y6.c1.7', block:'y6.c1', n:7, title:'Angles in a quadrilateral',
      gen:function(){ var a, b, c, d;
                      do { a = R(50, 140); b = R(50, 140); c = R(50, 140); d = 360 - a - b - c; } while (d < 30 || d > 170);
                      return q('A quadrilateral has angles of ' + a + '°, ' + b + '° and ' + c + '°. What is the fourth angle?', d + '°'); } },
    { id:'y6.c1.8', block:'y6.c1', n:8, title:'Angles in polygons',
      gen:function(){ var s = P([['triangle', 3], ['quadrilateral', 4], ['pentagon', 5], ['hexagon', 6], ['octagon', 8], ['decagon', 10]]);
                      if (s[1] < 5 || P([true,false])) return q('What do the interior angles of a ' + s[0] + ' add up to?', y6fmt((s[1] - 2) * 180) + '°');
                      return q('What size is each interior angle of a regular ' + s[0] + '?', (s[1] - 2) * 180 / s[1] + '°'); } },
    { id:'y6.c1.9', block:'y6.c1', n:9, title:'Circles',
      gen:function(){ var r = R(2, 25);
                      return P([true,false]) ? q('A circle has a radius of ' + r + ' cm. What is its diameter?', 2 * r + ' cm')
                                             : q('A circle has a diameter of ' + 2 * r + ' cm. What is its radius?', r + ' cm'); } },
    { id:'y6.c1.10', block:'y6.c1', n:10, title:'Draw shapes accurately', gen:null, why:'Needs a ruler and protractor to draw — nothing to ask on a starter sheet.' },
    { id:'y6.c1.11', block:'y6.c1', n:11, title:'Nets of 3-D shapes',
      gen:function(){ var s = P([['6 squares', 'cube'], ['1 square and 4 triangles', 'square-based pyramid'],
                                 ['2 triangles and 3 rectangles', 'triangular prism'], ['2 circles and 1 rectangle', 'cylinder'],
                                 ['4 triangles', 'triangular-based pyramid (tetrahedron)']]);
                      return q('A net is made of ' + s[0] + '. What 3-D shape does it fold into?', s[1]); } },

    /* ---- Summer 2 · Position and direction ------------------ */
    { id:'y6.c2.1', block:'y6.c2', n:1, title:'The first quadrant',
      gen:function(){ var x = two(0, 9), y = two(0, 9), a = Math.min(x[0], x[1]), b = Math.max(x[0], x[1]), c = Math.min(y[0], y[1]), d = Math.max(y[0], y[1]);
                      return q('Three vertices of a rectangle are (' + a + ', ' + c + '), (' + b + ', ' + c + ') and (' + b + ', ' + d + '). What is the fourth?', '(' + a + ', ' + d + ')'); } },
    { id:'y6.c2.2', block:'y6.c2', n:2, title:'Read and plot points in four quadrants',
      gen:function(){ var x = R(1, 9), y = R(1, 9), lr = P([1, -1]), ud = P([1, -1]);
                      return q('A point is ' + x + ' ' + (lr > 0 ? 'right' : 'left') + ' of the origin and ' + y + ' ' + (ud > 0 ? 'up' : 'down') + '. What are its coordinates?',
                               '(' + y6fmt(lr * x) + ', ' + y6fmt(ud * y) + ')'); } },
    { id:'y6.c2.3', block:'y6.c2', n:3, title:'Solve problems with coordinates',
      gen:function(){ var a = R(-8, 2), c = R(-8, 2), s = R(3, 6), b = a + s, d = c + s;
                      return q('A square has vertices at (' + y6fmt(a) + ', ' + y6fmt(c) + '), (' + y6fmt(b) + ', ' + y6fmt(c) + ') and (' + y6fmt(b) + ', ' + y6fmt(d) + '). What is the fourth vertex?',
                               '(' + y6fmt(a) + ', ' + y6fmt(d) + ')'); } },
    { id:'y6.c2.4', block:'y6.c2', n:4, title:'Translations',
      gen:function(){ var x = R(-5, 5), y = R(-5, 5), h = R(1, 6), v = R(1, 6), lr = P([1, -1]), ud = P([1, -1]);
                      return q('(' + y6fmt(x) + ', ' + y6fmt(y) + ') is translated ' + h + ' ' + (lr > 0 ? 'right' : 'left') + ' and ' + v + ' ' + (ud > 0 ? 'up' : 'down') + '. Where is it now?',
                               '(' + y6fmt(x + lr * h) + ', ' + y6fmt(y + ud * v) + ')'); } },
    { id:'y6.c2.5', block:'y6.c2', n:5, title:'Reflections',
      gen:function(){ var x = R(1, 9) * P([1, -1]), y = R(1, 9) * P([1, -1]), ax = P(['x', 'y']);
                      return q('Reflect (' + y6fmt(x) + ', ' + y6fmt(y) + ') in the ' + ax + '-axis. What are the new coordinates?',
                               ax === 'x' ? '(' + y6fmt(x) + ', ' + y6fmt(-y) + ')' : '(' + y6fmt(-x) + ', ' + y6fmt(y) + ')'); } }
  ];

  /* ── The whole scheme, Year 1 to Year 6 ─────────────────────
     Order matters: Mental Starter's progress tracking moves a child on
     to the next buildable step in WR_STEPS, so the last step of one year
     leads into the first of the next. */
  var WR_YEARS = [1, 2, 3, 4, 5, 6];
  var WR_BLOCKS = [].concat(Y1_BLOCKS, Y2_BLOCKS, Y3_BLOCKS, Y4_BLOCKS, Y5_BLOCKS, Y6_BLOCKS);
  var WR_STEPS  = [].concat(Y1_STEPS,  Y2_STEPS,  Y3_STEPS,  Y4_STEPS,  Y5_STEPS,  Y6_STEPS);

  /* ── Lookup ─────────────────────────────────────────────── */
  var WR_BY_ID = {};
  WR_STEPS.forEach(function (s){ WR_BY_ID[s.id] = s; });

  function wrStep(id){ return WR_BY_ID[id] || null; }
  function wrBlock(id){
    for (var i = 0; i < WR_BLOCKS.length; i++) if (WR_BLOCKS[i].id === id) return WR_BLOCKS[i];
    return null;
  }
  /* A step's full label, as a teacher would say it:
     "Year 2 · Autumn 2 · Addition and subtraction · Step 1 Bonds to 10" */
  function wrLabel(id){
    var s = wrStep(id); if (!s) return '';
    var b = wrBlock(s.block); if (!b) return s.title;
    return 'Year ' + b.year + ' · ' + b.term + ' ' + b.n + ' · ' + b.title + ' · Step ' + s.n + ' ' + s.title;
  }
  function wrShortLabel(id){
    var s = wrStep(id); if (!s) return '';
    return 'Step ' + s.n + ' ' + s.title;
  }
  function wrIsAvailable(id){ var s = wrStep(id); return !!(s && typeof s.gen === 'function'); }

  /* ── Years ──────────────────────────────────────────────── */
  function wrYearOf(id){ var s = wrStep(id), b = s && wrBlock(s.block); return b ? b.year : null; }
  function wrBlocksForYear(y){ return WR_BLOCKS.filter(function (b){ return b.year === +y; }); }
  function wrStepsForYear(y){
    var ids = {};
    wrBlocksForYear(y).forEach(function (b){ ids[b.id] = true; });
    return WR_STEPS.filter(function (s){ return ids[s.block]; });
  }
  /* A class's year group is free text ("Year 4", "Y4", "Yr 5/6", "4").
     Returns the first year 1-6 it names, or null -- a mixed class reads as
     its younger year, which the teacher can change in the picker. */
  function wrYearFromText(str){
    var m = String(str == null ? '' : str).match(/(?:^|[^0-9])([1-6])(?![0-9])/);
    return m ? +m[1] : null;
  }

  /* Build one descriptor for a step. Returns null for a step that has no
     written form -- callers fall back rather than printing an empty box. */
  function wrBuild(id){
    var s = wrStep(id);
    if (!s || typeof s.gen !== 'function') return null;
    try { return s.gen() || null; } catch (e) { return null; }
  }

  window.WR_BLOCKS = WR_BLOCKS;
  window.WR_STEPS = WR_STEPS;
  window.wrStep = wrStep;
  window.wrBlock = wrBlock;
  window.wrLabel = wrLabel;
  window.wrShortLabel = wrShortLabel;
  window.wrIsAvailable = wrIsAvailable;
  window.wrBuild = wrBuild;
  window.WR_YEARS = WR_YEARS;
  window.wrYearOf = wrYearOf;
  window.wrBlocksForYear = wrBlocksForYear;
  window.wrStepsForYear = wrStepsForYear;
  window.wrYearFromText = wrYearFromText;

})();
