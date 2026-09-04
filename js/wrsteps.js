/* ============================================================
   wrsteps.js — White Rose Maths Year 2 small steps
   Owner: Board (docs/OWNERSHIP.md) · loaded BEFORE js/generator.js

   The scheme, transcribed from White Rose Education's own
   published schemes of learning (2022 edition) — the four
   Autumn/Spring/Summer term documents at
   assets.whiteroseeducation.com/new-schemes/. Block and step
   titles are verbatim so they match a teacher's planning.

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
  function q(s){ return { t: 'prompt', s: s }; }

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

  /* ── Blocks, in the order the scheme teaches them ───────── */
  var WR_BLOCKS = [
    { id:'a1', term:'Autumn', n:1, title:'Place value' },
    { id:'a2', term:'Autumn', n:2, title:'Addition and subtraction' },
    { id:'a3', term:'Autumn', n:3, title:'Shape' },
    { id:'b1', term:'Spring', n:1, title:'Money' },
    { id:'b2', term:'Spring', n:2, title:'Multiplication and division' },
    { id:'b3', term:'Spring', n:3, title:'Length and height' },
    { id:'b4', term:'Spring', n:4, title:'Mass, capacity and temperature' },
    { id:'c1', term:'Summer', n:1, title:'Fractions' },
    { id:'c2', term:'Summer', n:2, title:'Time' },
    { id:'c3', term:'Summer', n:3, title:'Statistics' },
    { id:'c4', term:'Summer', n:4, title:'Position and direction' }
  ];

  var NEEDS_PICTURE = 'Needs a picture or apparatus — not a written starter question.';
  var NEEDS_DRAWING = 'The child has to draw it, so there is nothing to ask on a starter sheet.';

  /* ── The steps ──────────────────────────────────────────── */
  var WR_STEPS = [

    /* ---- Autumn 1 · Place value ---------------------------- */
    { id:'a1.1',  block:'a1', n:1,  title:'Numbers to 20',
      gen:function(){ return P([ q('Write <b>' + R(10,20) + '</b> in words.'),
                                 { t:'seq', start:R(1,16), step:1, len:4, blank:R(1,2) },
                                 q('What is one more than ' + R(10,19) + '?') ]); } },
    { id:'a1.2',  block:'a1', n:2,  title:'Count objects to 100 by making 10s',
      gen:function(){ var t = R(2,9); return q('There are ' + t + ' full tens and ' + R(1,9) + ' ones. What is the number?'); } },
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
                      return q(n + ' = ' + t + ' + <span class="gen-blank">?</span>'); } },
    { id:'a1.8',  block:'a1', n:8,  title:'Write numbers to 100 in expanded form',
      gen:function(){ var n = td(); return q('Write ' + n + ' as tens add ones.'); } },
    { id:'a1.9',  block:'a1', n:9,  title:'10s on the number line to 100',
      gen:function(){ return { t:'seq', start:R(1,4)*10, step:10, len:4, blank:R(1,2) }; } },
    { id:'a1.10', block:'a1', n:10, title:'10s and 1s on the number line to 100',
      gen:function(){ return { t:'seq', start:R(11,60), step:P([1,10]), len:4, blank:R(1,2) }; } },
    { id:'a1.11', block:'a1', n:11, title:'Estimate numbers on a number line',
      gen:function(){ var a = R(0,4)*10, b = a + 10;
                      return q('A number is halfway between ' + a + ' and ' + b + '. What is it?'); } },
    { id:'a1.12', block:'a1', n:12, title:'Compare objects', gen:null, why:NEEDS_PICTURE },
    { id:'a1.13', block:'a1', n:13, title:'Compare numbers',
      gen:function(){ var p = two(10,99); return q('&lt;, &gt; or =?<br>' + p[0] + ' <span class="gen-blank">?</span> ' + p[1]); } },
    { id:'a1.14', block:'a1', n:14, title:'Order objects and numbers',
      gen:function(){ var a = shuffle([R(10,39), R(40,69), R(70,99)]);
                      return q('Put in order, smallest first:<br>' + a.join(', ')); } },
    { id:'a1.15', block:'a1', n:15, title:'Count in 2s, 5s and 10s',
      gen:function(){ var s = P([2,5,10]); return { t:'seq', start:s * R(1,6), step:s, len:4, blank:R(1,2) }; } },
    { id:'a1.16', block:'a1', n:16, title:'Count in 3s',
      gen:function(){ return { t:'seq', start:3 * R(1,6), step:3, len:4, blank:R(1,2) }; } },

    /* ---- Autumn 2 · Addition and subtraction ---------------- */
    { id:'a2.1',  block:'a2', n:1,  title:'Bonds to 10',
      gen:function(){ var a = R(1,9); return { t:'missing', a:a, b:10-a, sum:10, blank:P(['a','b']) }; } },
    { id:'a2.2',  block:'a2', n:2,  title:'Fact families – addition and subtraction bonds within 20',
      gen:function(){ var a = R(2,9), b = R(2,20-a);
                      return q('Write the fact family for ' + a + ', ' + b + ' and ' + (a+b) + '.'); } },
    { id:'a2.3',  block:'a2', n:3,  title:'Related facts',
      gen:function(){ var a = R(2,8), b = R(2,8);
                      return q('If ' + a + ' + ' + b + ' = ' + (a+b) + ', what is ' + (a*10) + ' + ' + (b*10) + '?'); } },
    { id:'a2.4',  block:'a2', n:4,  title:'Bonds to 100 (tens)',
      gen:function(){ var t = R(1,9)*10; return { t:'missing', a:t, b:100-t, sum:100, blank:P(['a','b']) }; } },
    { id:'a2.5',  block:'a2', n:5,  title:'Add and subtract 1s',
      gen:function(){ var a = R(20,90); return { t:'arith', a:a, b:R(1,3), op:P(['+','-']) }; } },
    { id:'a2.6',  block:'a2', n:6,  title:'Add by making 10',
      gen:function(){ var a = R(6,9); return { t:'arith', a:a, b:R(11-a, 9), op:'+' }; } },
    { id:'a2.7',  block:'a2', n:7,  title:'Add three 1-digit numbers',
      gen:function(){ return { t:'arith3', a:R(1,9), b:R(1,9), c:R(1,9) }; } },
    { id:'a2.8',  block:'a2', n:8,  title:'Add to the next 10',
      gen:function(){ var n = R(2,9)*10 + R(1,9); return q(n + ' + <span class="gen-blank">?</span> = ' + (Math.ceil(n/10)*10)); } },
    { id:'a2.9',  block:'a2', n:9,  title:'Add across a 10',
      gen:function(){ var a = R(2,8)*10 + R(5,9); return { t:'arith', a:a, b:R(10 - (a%10), 9), op:'+' }; } },
    { id:'a2.10', block:'a2', n:10, title:'Subtract across 10',
      gen:function(){ var a = R(2,9)*10 + R(1,4); return { t:'arith', a:a, b:R((a%10)+1, 9), op:'-' }; } },
    { id:'a2.11', block:'a2', n:11, title:'Subtract from a 10',
      gen:function(){ return { t:'arith', a:R(2,9)*10, b:R(1,9), op:'-' }; } },
    { id:'a2.12', block:'a2', n:12, title:'Subtract a 1-digit number from a 2-digit number (across a 10)',
      gen:function(){ var a = R(2,9)*10 + R(1,4); return { t:'arith', a:a, b:R((a%10)+1, 9), op:'-' }; } },
    { id:'a2.13', block:'a2', n:13, title:'10 more, 10 less',
      gen:function(){ var n = R(11,89); return q(P([n + ' + 10 =', n + ' - 10 =', 'Ten more than ' + n + '?', 'Ten less than ' + n + '?'])); } },
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
      gen:function(){ return q('Is a ' + P(SHAPES_3D).name + ' a 2-D or a 3-D shape?'); } },
    { id:'a3.2',  block:'a3', n:2,  title:'Count sides on 2-D shapes',
      gen:function(){ return { t:'shape', shape:P(SHAPES_2D).name, ask:'sides' }; } },
    { id:'a3.3',  block:'a3', n:3,  title:'Count vertices on 2-D shapes',
      gen:function(){ return { t:'shape', shape:P(SHAPES_2D).name, ask:'vertices' }; } },
    { id:'a3.4',  block:'a3', n:4,  title:'Draw 2-D shapes', gen:null, why:NEEDS_DRAWING },
    { id:'a3.5',  block:'a3', n:5,  title:'Lines of symmetry on shapes',
      gen:function(){ return q('How many lines of symmetry does a ' + P(['square','rectangle','equilateral triangle','regular hexagon']) + ' have?'); } },
    { id:'a3.6',  block:'a3', n:6,  title:'Use lines of symmetry to complete shapes', gen:null, why:NEEDS_DRAWING },
    { id:'a3.7',  block:'a3', n:7,  title:'Sort 2-D shapes',
      gen:function(){ var s = P(SHAPES_2D); return q('Name a 2-D shape with more sides than a ' + s.name + '.'); } },
    { id:'a3.8',  block:'a3', n:8,  title:'Count faces on 3-D shapes',
      gen:function(){ return q('How many faces does a ' + P(SHAPES_3D).name + ' have?'); } },
    { id:'a3.9',  block:'a3', n:9,  title:'Count edges on 3-D shapes',
      gen:function(){ return q('How many edges does a ' + P(SHAPES_3D).name + ' have?'); } },
    { id:'a3.10', block:'a3', n:10, title:'Count vertices on 3-D shapes',
      gen:function(){ return q('How many vertices does a ' + P(SHAPES_3D).name + ' have?'); } },
    { id:'a3.11', block:'a3', n:11, title:'Sort 3-D shapes',
      gen:function(){ return q('Name a 3-D shape with no flat faces.'); } },
    { id:'a3.12', block:'a3', n:12, title:'Make patterns with 2-D and 3-D shapes', gen:null, why:NEEDS_PICTURE },

    /* ---- Spring 1 · Money ---------------------------------- */
    { id:'b1.1',  block:'b1', n:1,  title:'Count money – pence',
      gen:function(){ var c = P(COINS), n = R(2,5); return q('What is the total of ' + n + ' ' + c + 'p coins?'); } },
    { id:'b1.2',  block:'b1', n:2,  title:'Count money – pounds (notes and coins)',
      gen:function(){ var v = P([5,10,20]), n = R(2,4); return q('What is the total of ' + n + ' £' + v + ' notes?'); } },
    { id:'b1.3',  block:'b1', n:3,  title:'Count money – pounds and pence',
      gen:function(){ return q('£' + R(1,5) + ' and ' + R(10,90) + 'p. How much altogether, in pence?'); } },
    { id:'b1.4',  block:'b1', n:4,  title:'Choose notes and coins',
      gen:function(){ return q('Which two coins make ' + P([7,11,15,25,30,60,70]) + 'p?'); } },
    { id:'b1.5',  block:'b1', n:5,  title:'Make the same amount',
      gen:function(){ var c = P([10,20,50]); return q('How many 2p coins are the same as ' + c + 'p?'); } },
    { id:'b1.6',  block:'b1', n:6,  title:'Compare amounts of money',
      gen:function(){ var p = two(15,95); return q('Which is more, ' + p[0] + 'p or ' + p[1] + 'p?'); } },
    { id:'b1.7',  block:'b1', n:7,  title:'Calculate with money',
      gen:function(){ var a = R(10,50), b = R(10, 99-a); return q(a + 'p + ' + b + 'p = ?'); } },
    { id:'b1.8',  block:'b1', n:8,  title:'Make a pound',
      gen:function(){ var t = R(1,9)*10; return q(t + 'p + <span class="gen-blank">?</span> = £1'); } },
    { id:'b1.9',  block:'b1', n:9,  title:'Find change',
      gen:function(){ var c = R(15,95); return q('I spend ' + c + 'p and pay with £1. What is my change?'); } },
    { id:'b1.10', block:'b1', n:10, title:'Two-step problems',
      gen:function(){ var a = R(10,40), b = R(10,40); return q('I buy a ' + a + 'p pen and a ' + b + 'p rubber. What change from £1?'); } },

    /* ---- Spring 2 · Multiplication and division ------------- */
    { id:'b2.1',  block:'b2', n:1,  title:'Recognise equal groups',
      gen:function(){ var g = R(2,5), n = P([2,5,10]); return q('There are ' + g + ' groups of ' + n + '. How many altogether?'); } },
    { id:'b2.2',  block:'b2', n:2,  title:'Make equal groups',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q('Make ' + (n*g) + ' into groups of ' + n + '. How many groups?'); } },
    { id:'b2.3',  block:'b2', n:3,  title:'Add equal groups',
      gen:function(){ var n = P([2,5,10]), g = R(3,4);
                      return q(new Array(g + 1).join(n + ' + ').slice(0, -3) + ' ='); } },
    { id:'b2.4',  block:'b2', n:4,  title:'Introduce the multiplication symbol',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q(g + ' groups of ' + n + ' = ' + g + ' × <span class="gen-blank">?</span>'); } },
    { id:'b2.5',  block:'b2', n:5,  title:'Multiplication sentences',
      gen:function(){ return { t:'times', base:P([2,5,10]), by:R(1,12) }; } },
    { id:'b2.6',  block:'b2', n:6,  title:'Use arrays',
      gen:function(){ var r = R(2,5), c = P([2,5,10]); return q('An array has ' + r + ' rows of ' + c + '. How many in total?'); } },
    { id:'b2.7',  block:'b2', n:7,  title:'Make equal groups – grouping',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q((n*g) + ' put into groups of ' + n + '. How many groups?'); } },
    { id:'b2.8',  block:'b2', n:8,  title:'Make equal groups – sharing',
      gen:function(){ var n = P([2,5,10]), g = R(2,6); return q((n*g) + ' shared between ' + g + '. How many each?'); } },
    { id:'b2.9',  block:'b2', n:9,  title:'The 2 times-table',
      gen:function(){ return { t:'times', base:2, by:R(1,12) }; } },
    { id:'b2.10', block:'b2', n:10, title:'Divide by 2',
      gen:function(){ return { t:'divide', base:2, by:R(1,12) }; } },
    { id:'b2.11', block:'b2', n:11, title:'Doubling and halving',
      gen:function(){ var n = R(1,20); return P([ q('Double ' + n + '?'), { t:'half', n:n } ]); } },
    { id:'b2.12', block:'b2', n:12, title:'Odd and even numbers',
      gen:function(){ return q('Is ' + R(10,99) + ' odd or even?'); } },
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
      gen:function(){ var p = two(10,99); return q('Which is longer, ' + p[0] + 'cm or ' + p[1] + 'cm?'); } },
    { id:'b3.4',  block:'b3', n:4,  title:'Order lengths and heights',
      gen:function(){ var a = shuffle([R(10,39), R(40,69), R(70,99)]);
                      return q('Order shortest first:<br>' + a.join('cm, ') + 'cm'); } },
    { id:'b3.5',  block:'b3', n:5,  title:'Four operations with lengths and heights',
      gen:function(){ var a = R(20,60), b = R(5, 39); return q('A ribbon is ' + a + 'cm. I cut off ' + b + 'cm. How much is left?'); } },

    /* ---- Spring 4 · Mass, capacity and temperature ---------- */
    { id:'b4.1',  block:'b4', n:1,  title:'Compare mass',
      gen:function(){ var p = two(10,99); return q('Which is heavier, ' + p[0] + 'g or ' + p[1] + 'g?'); } },
    { id:'b4.2',  block:'b4', n:2,  title:'Measure in grams', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'b4.3',  block:'b4', n:3,  title:'Measure in kilograms', gen:null, why:'Needs scales and a real object to weigh.' },
    { id:'b4.4',  block:'b4', n:4,  title:'Four operations with mass',
      gen:function(){ var a = R(100,500), b = R(50,300); return q('A bag holds ' + a + 'g. I add ' + b + 'g. What is the mass now?'); } },
    { id:'b4.5',  block:'b4', n:5,  title:'Compare volume and capacity',
      gen:function(){ var p = two(100,900); return q('Which holds more, ' + p[0] + 'ml or ' + p[1] + 'ml?'); } },
    { id:'b4.6',  block:'b4', n:6,  title:'Measure in millilitres', gen:null, why:'Needs a measuring jug.' },
    { id:'b4.7',  block:'b4', n:7,  title:'Measure in litres', gen:null, why:'Needs a measuring jug.' },
    { id:'b4.8',  block:'b4', n:8,  title:'Four operations with volume and capacity',
      gen:function(){ var a = R(100,900); return q('A jug holds 1 litre. It has ' + a + 'ml in it. How much more fits?'); } },
    { id:'b4.9',  block:'b4', n:9,  title:'Temperature',
      gen:function(){ var a = R(5,25), d = R(2,9); return q('It is ' + a + '°C. It warms by ' + d + '°C. What is the temperature now?'); } },

    /* ---- Summer 1 · Fractions ------------------------------ */
    { id:'c1.1',  block:'c1', n:1,  title:'Introduction to parts and whole',
      gen:function(){ var p = R(2,4); return q('A cake is cut into ' + p + ' equal parts. How many parts make the whole?'); } },
    { id:'c1.2',  block:'c1', n:2,  title:'Equal and unequal parts',
      gen:function(){ return q('A shape is split into ' + R(2,6) + ' parts, all the same size. Are the parts equal or unequal?'); } },
    { id:'c1.3',  block:'c1', n:3,  title:'Recognise a half',
      gen:function(){ return q('How many halves make one whole?'); } },
    { id:'c1.4',  block:'c1', n:4,  title:'Find a half',
      gen:function(){ return { t:'half', n:R(2,20) }; } },
    { id:'c1.5',  block:'c1', n:5,  title:'Recognise a quarter',
      gen:function(){ return q('How many quarters make one whole?'); } },
    { id:'c1.6',  block:'c1', n:6,  title:'Find a quarter',
      gen:function(){ var n = R(1,10)*4; return q('What is a quarter of ' + n + '?'); } },
    { id:'c1.7',  block:'c1', n:7,  title:'Recognise a third',
      gen:function(){ return q('How many thirds make one whole?'); } },
    { id:'c1.8',  block:'c1', n:8,  title:'Find a third',
      gen:function(){ var n = R(1,10)*3; return q('What is a third of ' + n + '?'); } },
    { id:'c1.9',  block:'c1', n:9,  title:'Find the whole',
      gen:function(){ var h = R(2,12); return q('Half of a number is ' + h + '. What is the number?'); } },
    { id:'c1.10', block:'c1', n:10, title:'Unit fractions',
      gen:function(){ var d = P([2,3,4]); return q('Which is the unit fraction: 1/' + d + ' or ' + R(2, d) + '/' + d + '?'); } },
    { id:'c1.11', block:'c1', n:11, title:'Non-unit fractions',
      gen:function(){ var n = R(1,10)*4; return q('What is 3/4 of ' + n + '?'); } },
    { id:'c1.12', block:'c1', n:12, title:'Recognise the equivalence of a half and two-quarters',
      gen:function(){ return q('2/4 is the same as which fraction?'); } },
    { id:'c1.13', block:'c1', n:13, title:'Recognise three-quarters',
      gen:function(){ return q('How many quarters are in three-quarters?'); } },
    { id:'c1.14', block:'c1', n:14, title:'Find three-quarters',
      gen:function(){ var n = R(1,8)*4; return q('What is three-quarters of ' + n + '?'); } },
    { id:'c1.15', block:'c1', n:15, title:'Count in fractions up to a whole',
      gen:function(){ return q('1/4, 2/4, <span class="gen-blank">?</span>, 4/4'); } },

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
      gen:function(){ return P([ q('How many minutes are in an hour?'),
                                 q('How many minutes are in half an hour?'),
                                 q('How many minutes are in a quarter of an hour?') ]); } },
    { id:'c2.7',  block:'c2', n:7,  title:'Hours in a day',
      gen:function(){ return P([ q('How many hours are in a day?'), { t:'future', unit:'day', n:R(1,7) } ]); } },

    /* ---- Summer 3 · Statistics ----------------------------- */
    { id:'c3.1',  block:'c3', n:1,  title:'Make tally charts',
      gen:function(){ var n = R(6,19), f = Math.floor(n/5), r = n % 5;
                      var t = new Array(f + 1).join('||||̸ ') + new Array(r + 1).join('|');
                      return q('What number is this tally?<br><span style="letter-spacing:2px">' + t.trim() + '</span>'); } },
    { id:'c3.2',  block:'c3', n:2,  title:'Tables', gen:null, why:NEEDS_PICTURE },
    { id:'c3.3',  block:'c3', n:3,  title:'Block diagrams', gen:null, why:NEEDS_PICTURE },
    { id:'c3.4',  block:'c3', n:4,  title:'Draw pictograms (1–1)', gen:null, why:NEEDS_DRAWING },
    { id:'c3.5',  block:'c3', n:5,  title:'Interpret pictograms (1–1)', gen:null, why:NEEDS_PICTURE },
    { id:'c3.6',  block:'c3', n:6,  title:'Draw pictograms (2, 5 and 10)', gen:null, why:NEEDS_DRAWING },
    { id:'c3.7',  block:'c3', n:7,  title:'Interpret pictograms (2, 5 and 10)',
      gen:function(){ var v = P([2,5,10]), s = R(3,8);
                      return q('On a pictogram each picture stands for ' + v + '. What do ' + s + ' pictures show?'); } },

    /* ---- Summer 4 · Position and direction ----------------- */
    { id:'c4.1',  block:'c4', n:1,  title:'Language of position', gen:null, why:NEEDS_PICTURE },
    { id:'c4.2',  block:'c4', n:2,  title:'Describe movement', gen:null, why:NEEDS_PICTURE },
    { id:'c4.3',  block:'c4', n:3,  title:'Describe turns',
      gen:function(){ return P([ q('How many quarter turns make a full turn?'),
                                 q('How many quarter turns make a half turn?'),
                                 q('A quarter turn clockwise from facing north. Which way are you facing?') ]); } },
    { id:'c4.4',  block:'c4', n:4,  title:'Describe movement and turns', gen:null, why:NEEDS_PICTURE },
    { id:'c4.5',  block:'c4', n:5,  title:'Shape patterns with turns', gen:null, why:NEEDS_PICTURE }
  ];

  /* ── Lookup ─────────────────────────────────────────────── */
  var WR_BY_ID = {};
  WR_STEPS.forEach(function (s){ WR_BY_ID[s.id] = s; });

  function wrStep(id){ return WR_BY_ID[id] || null; }
  function wrBlock(id){
    for (var i = 0; i < WR_BLOCKS.length; i++) if (WR_BLOCKS[i].id === id) return WR_BLOCKS[i];
    return null;
  }
  /* A step's full label, as a teacher would say it:
     "Autumn 2 · Addition and subtraction · Step 1 Bonds to 10" */
  function wrLabel(id){
    var s = wrStep(id); if (!s) return '';
    var b = wrBlock(s.block); if (!b) return s.title;
    return b.term + ' ' + b.n + ' · ' + b.title + ' · Step ' + s.n + ' ' + s.title;
  }
  function wrShortLabel(id){
    var s = wrStep(id); if (!s) return '';
    return 'Step ' + s.n + ' ' + s.title;
  }
  function wrIsAvailable(id){ var s = wrStep(id); return !!(s && typeof s.gen === 'function'); }

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

})();
