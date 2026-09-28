/* ===================================================================
   feedback.js — Markbook › Marking: group similar comments
   Owner: Desk (docs/OWNERSHIP.md)

   The class feedback sheet needs "which children got the same feedback",
   but teachers never write the same sentence twice:

     Aurora  "Has answered most questions correctly but some struggled with
              tens as a numeral. Her date and title aren't as neat as they
              could be."
     Ben     "Struggled with the tens numerals. Date and title neat."
     Zoey    "Has answered all questions correctly, date and title neat."

   So each comment is split into its separate points (sentences, commas,
   "but"), each point is reduced to its content words, and points that share
   most of their words are grouped — here "struggled with tens as a numeral"
   (Aurora, Ben) and "date and title neat" (Ben, Zoey).

   Three things never group, however many words they share, because they
   are different feedback: a point with a "not" against one without ("neat"
   vs "not as neat"), a next step against praise ("needs to use a ruler for
   the part-whole model" vs "lovely use of the part-whole model"), and
   points about a different amount ("all questions" vs "most questions").

   Pure: no DOM, no storage, no network. Public: window.mkFeedback.group()
   =================================================================== */
(function () {
  var STOP = ('a an the and or of to in on at for with as by from into onto about up down out over is are was were be ' +
    'been being am has have had do does did doing it its this that these those she he they her his their them him hers ' +
    'i we you your our my me so very quite really just also still then than there here which who whom what when where ' +
    'how could would should can will may might must shall one ones bit lot lots much more less been get got gets getting ' +
    'well good great nice lovely today work book books piece page time made make makes making both each own same such ' +
    'pupil child children class').split(' ');
  var NEG = /^(?:not|no|never|without|nothing|nobody|neither|nor|cannot|cant|dont|doesnt|didnt|isnt|arent|wasnt|werent|hasnt|havent|hadnt|wont|wouldnt|couldnt|shouldnt)$/;
  /* a next step, not an observation */
  var TARGET = /^(?:need|needs|needed|should|must|remember|ensure|next|target|targets|careful|improve|practise|practice)$/;
  var QUANT = { all: 'all', every: 'all', everything: 'all', each: 'all', entire: 'all', whole: 'all',
                most: 'most', majority: 'most', mostly: 'most',
                some: 'some', few: 'some', several: 'some', couple: 'some', half: 'some', many: 'some',
                none: 'none' };
  /* words speech and teachers use interchangeably */
  var SYN = { tidy: 'neat', tidily: 'neat', neatly: 'neat', neater: 'neat', messy: 'untidy', scruffy: 'untidy',
              right: 'correct', correctly: 'correct', accurate: 'correct', accurately: 'correct',
              wrong: 'incorrect', incorrectly: 'incorrect', errors: 'mistake', error: 'mistake', mistakes: 'mistake',
              sums: 'question', sum: 'question', questions: 'question', calculations: 'question', problems: 'question',
              heading: 'title', headings: 'title', titles: 'title', underlined: 'underline', underlining: 'underline',
              difficult: 'struggle', difficulty: 'struggle', tricky: 'struggle',
              hard: 'struggle', struggled: 'struggle', struggling: 'struggle', struggles: 'struggle',
              completed: 'finish', complete: 'finish', finished: 'finish', finishing: 'finish',
              attempted: 'try', attempt: 'try', tried: 'try', trying: 'try' };

  function stem(w) {
    if (SYN[w]) return SYN[w];
    if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    if (SYN[w]) return SYN[w];
    if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 5 && /ly$/.test(w)) w = w.slice(0, -2);
    if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);   // struggle / struggled / struggling → struggl
    return w;
  }
  function tokens(text) {
    var words = String(text || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
    var set = {}, neg = false, target = false, quant = null, n = 0;
    words.forEach(function (w) {
      if (NEG.test(w)) { neg = !neg; return; }
      if (TARGET.test(w)) { target = true; return; }
      if (QUANT[w]) { quant = QUANT[w]; return; }
      if (STOP.indexOf(w) >= 0 || w.length < 2) return;
      var s = stem(w);
      if (s === 'untidy') { neg = !neg; s = 'neat'; }            // "untidy" is "not neat"
      if (s === 'incorrect') { neg = !neg; s = 'correct'; }
      if (!set[s]) { set[s] = 1; n++; }
    });
    return { set: set, n: n, neg: neg, target: target, quant: quant };
  }
  function similarity(a, b) {
    if (a.neg !== b.neg) return 0;                               // "neat" vs "not neat"
    if (a.target !== b.target) return 0;                         // a next step vs praise
    if (a.quant && b.quant && a.quant !== b.quant) return 0;     // "all" vs "most"
    var inter = 0;
    for (var k in a.set) if (b.set[k]) inter++;
    var union = a.n + b.n - inter;
    if (!union) return 0;
    if (inter < 2 && !(a.n === 1 && b.n === 1 && inter === 1)) return 0;   // one shared word is a coincidence
    return inter / union;
  }

  /* "has answered most questions correctly" → "Answered most questions correctly" */
  function tidy(t) {
    t = String(t || '').trim().replace(/[.,;:!?]+$/, '')
      .replace(/^(?:and|but|so|also|however)\s+/i, '')
      .replace(/^(?:she|he|they)\s+/i, '')
      .replace(/^(?:has|have|had|is|was|were)\s+(?=\w+(?:ed|en|ing)\b)/i, '');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }
  function splitPoints(comment) {
    return String(comment || '').split(/[.;!?]+|,|\s(?=\bbut\b)|\s(?=\bhowever\b)/i)
      .map(function (s) { return s.trim().replace(/^(?:but|however)\s+/i, ''); })
      .filter(function (s) { return s && tokens(s).n; });
  }

  var THRESHOLD = 0.5;

  /* items: [{ id, name, comment, met? }]
     → { themes: [{ label, ids, examples }], individual: [{ id, text }] }
     themes are shared by two or more children, largest first; individual is
     what is left of each child's comment once the shared points are taken out. */
  function group(items) {
    var points = [];
    (items || []).forEach(function (it) {
      splitPoints(it.comment).forEach(function (text) { points.push({ id: it.id, text: text, tok: tokens(text) }); });
    });
    var clusters = [];
    points.forEach(function (p) {
      var best = null, bestScore = 0;
      clusters.forEach(function (c) {
        var s = 0;
        c.points.forEach(function (q) { s += similarity(p.tok, q.tok); });
        s /= c.points.length;
        if (s > bestScore) { bestScore = s; best = c; }
      });
      if (best && bestScore >= THRESHOLD) best.points.push(p);
      else clusters.push({ points: [p] });
    });

    var shared = [];
    var themes = [];
    clusters.forEach(function (c) {
      var ids = [];
      c.points.forEach(function (p) { if (ids.indexOf(p.id) < 0) ids.push(p.id); });
      if (ids.length < 2) return;
      /* label: the point most like the others; the shorter on a tie */
      var medoid = c.points.slice().sort(function (a, b) {
        function score(x) { var s = 0; c.points.forEach(function (q) { if (q !== x) s += similarity(x.tok, q.tok); }); return s; }
        return score(b) - score(a) || a.text.length - b.text.length;
      })[0];
      var examples = [];
      c.points.forEach(function (p) { var t = tidy(p.text); if (examples.indexOf(t) < 0) examples.push(t); });
      themes.push({ label: tidy(medoid.text), ids: ids, examples: examples });
      c.points.forEach(function (p) { shared.push(p); });
    });
    themes.sort(function (a, b) { return b.ids.length - a.ids.length || a.label.localeCompare(b.label); });

    var individual = [];
    (items || []).forEach(function (it) {
      var left = points.filter(function (p) { return p.id === it.id && shared.indexOf(p) < 0; })
        .map(function (p) { return tidy(p.text); });
      if (left.length) individual.push({ id: it.id, text: left.join('. ') + '.' });
    });
    return { themes: themes, individual: individual };
  }

  window.mkFeedback = { group: group, similarity: function (a, b) { return similarity(tokens(a), tokens(b)); } };
})();
