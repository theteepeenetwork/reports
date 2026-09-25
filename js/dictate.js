/* ===================================================================
   dictate.js — Markbook › Marking › Dictate: the parser
   Owner: Desk (docs/OWNERSHIP.md)

   Turns a spoken (or typed) marking run into a plan the Marking tab can
   apply. Pure: no DOM, no storage, no network — the words never leave the
   device through this file. The UI and the save live in js/marking.js.

     "create new maths activity called partitioning on 25/9, Aurora has
      answered most questions correctly but some struggled with tens as a
      numeral. Not met. Next pupil Zoey answered all questions correctly,
      accessed the challenge, met, given gold star, date and title neat"

   becomes
     activity: { mode:'new', setId:'s_maths', title:'Partitioning', workDate:'2026-09-25' }
     entries:  [ { pupilId, met:'not', markers:[],                        comment:'Has answered…' },
                 { pupilId, met:'met', markers:['Challenge','Gold star'], comment:'Answered all…' } ]

   Speech recognition gives little or no punctuation, so the marking UI
   joins each pause-separated utterance with ". " before it gets here, and
   "next pupil" always starts a new book, whatever follows it.

   Public: window.mkDictate = { parse, command, spokenPunctuation, parseDate }
   =================================================================== */
(function () {
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  /* words that hand over to the next book ("next pupil Zoey …") */
  var HANDOVER = /\b(?:next|then|now|okay|ok|right)(?:\s+(?:pupil|child|book|one|person|up))?\s*$/i;
  var FORCE_NEXT = /^(?:next)\s+(?:pupil|child|book|one|person)$/i;
  /* never fuzzy-match these to a name: they start sentences all the time */
  var STOP = ('her his she he they them the and has have had was is are all some most then next date title ' +
    'titles not met good great needs need but also with work book books did does done got gets given ' +
    'this that very well neat tidy one pupil child next some few lots more less been be of on in at to').split(' ');
  var FILLER = ('given gives give gets get got has have had was were is are she he they it a an the and also ' +
    'awarded award accessed access did do done completed complete attempted attempt tried try earned earn ' +
    'received receive objective target lo learning outcome with so overall therefore been her his their ' +
    'which who has just today well').split(' ');
  var CONTRACTIONS = { arent: "aren't", isnt: "isn't", wasnt: "wasn't", werent: "weren't", didnt: "didn't",
    doesnt: "doesn't", dont: "don't", hasnt: "hasn't", havent: "haven't", cant: "can't", wont: "won't",
    couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", shes: "she's", hes: "he's", theyre: "they're" };

  function pad(n) { return ('0' + n).slice(-2); }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function clean(s) { return String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/'s$/, '').replace(/[^a-z'\-]/g, ''); }

  /* ---------- spoken punctuation ("full stop", "comma", "new line") ---------- */
  function spokenPunctuation(t) {
    return String(t || '')
      .replace(/\s*\b(?:full stop|period)\b\s*/gi, '. ')
      .replace(/\s*\bcomma\b\s*/gi, ', ')
      .replace(/\s*\b(?:new line|new paragraph)\b\s*/gi, '. ')
      .replace(/\s*\bquestion mark\b\s*/gi, '? ')
      .replace(/\s+([.,?])/g, '$1').trim();
  }

  /* ---------- voice commands: an utterance that is (or ends in) one ---------- */
  var COMMANDS = [
    ['save',   /(?:^|\s)(?:save (?:the )?(?:books|marking|them|it all|all)|that'?s all(?: for now)?|finished marking|done marking|all done)$/i, /^(?:save|finished|done)$/i],
    ['undo',   /(?:^|\s)(?:scratch that|undo that|delete that|delete last|remove last(?: pupil| one| book)?)$/i, /^(?:undo|scratch that)$/i],
    ['read',   /(?:^|\s)(?:read (?:it |that |them )?back|read back)$/i, null],
    ['stop',   /(?:^|\s)(?:stop listening|stop dictation|stop dictating|pause listening)$/i, null],
    ['cancel', /(?:^|\s)(?:cancel (?:all|everything|marking)|start again|clear (?:it )?all)$/i, null]
  ];
  /* → { cmd, rest } where rest is the utterance with the command removed */
  function command(utter) {
    var s = String(utter || '').trim().replace(/[.,!?]+$/, '').trim();
    for (var i = 0; i < COMMANDS.length; i++) {
      var c = COMMANDS[i];
      if (c[2] && c[2].test(s)) return { cmd: c[0], rest: '' };
      var m = s.match(c[1]);
      if (m) return { cmd: c[0], rest: s.slice(0, m.index).trim() };
    }
    return null;
  }

  /* ---------- dates: "25/9", "25th September", "Sept 25", "today", "on Monday" ---------- */
  var DATE_RE = new RegExp('^\\s*(?:(?:done |work done )?(?:on|dated|from|for)\\s+)?(?:the\\s+)?(?:' +
    '(\\d{1,2})\\s*[\\/\\-.]\\s*(\\d{1,2})(?:\\s*[\\/\\-.]\\s*(\\d{2,4}))?' +                       // 1-3  25/9(/26)
    '|(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(' + MONTHS.join('|') + ')[a-z]*\\.?(?:\\s+(\\d{4}))?' + // 4-6  25th of September
    '|(' + MONTHS.join('|') + ')[a-z]*\\.?\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?' + // 7-9 September 25th
    '|(today|yesterday)' +                                                                          // 10
    '|(?:last\\s+)?(' + DAYS.join('|') + ')' +                                                      // 11
    ')\\b', 'i');
  function parseDate(str, todayISO) {
    var m = String(str || '').match(DATE_RE);
    if (!m) return null;
    var today = fromISO(todayISO), d = null, y = null;
    if (m[1]) { d = [+m[1], +m[2]]; y = m[3] ? +m[3] : null; }
    else if (m[4]) { d = [+m[4], MONTHS.indexOf(m[5].slice(0, 3).toLowerCase()) + 1]; y = m[6] ? +m[6] : null; }
    else if (m[7]) { d = [+m[8], MONTHS.indexOf(m[7].slice(0, 3).toLowerCase()) + 1]; y = m[9] ? +m[9] : null; }
    else if (m[10]) {
      var t = new Date(today); if (m[10].toLowerCase() === 'yesterday') t.setDate(t.getDate() - 1);
      return { iso: isoOf(t), len: m[0].length };
    } else if (m[11]) {
      var want = DAYS.indexOf(m[11].toLowerCase()), t2 = new Date(today);
      while (t2.getDay() !== want) t2.setDate(t2.getDate() - 1);   // the most recent one, today included
      return { iso: isoOf(t2), len: m[0].length };
    }
    if (!d || d[0] < 1 || d[0] > 31 || d[1] < 1 || d[1] > 12) return null;
    if (y && y < 100) y += 2000;
    if (!y) {
      /* no year said: this year, unless that lands well in the future
         ("25/9" dictated in January means last September) */
      y = today.getFullYear();
      var guess = new Date(y, d[1] - 1, d[0]);
      if (guess - today > 14 * 864e5) y -= 1;
    }
    return { iso: y + '-' + pad(d[1]) + '-' + pad(d[0]), len: m[0].length };
  }

  /* ---------- names ---------- */
  function nameIndex(pupils) {
    var firsts = {};
    pupils.forEach(function (p) { var f = clean(String(p.name).split(/\s+/)[0]); (firsts[f] || (firsts[f] = [])).push(p); });
    return pupils.map(function (p) {
      var parts = String(p.name).trim().split(/\s+/).map(clean).filter(Boolean);
      return { p: p, parts: parts, first: parts[0], uniqueFirst: (firsts[parts[0]] || []).length === 1 };
    });
  }
  /* try to read a pupil's name starting at words[i] */
  function matchName(idx, words, i, allowFuzzy) {
    var best = null;
    idx.forEach(function (n) {
      var k = n.parts.length;
      /* full name */
      if (k > 1 && i + k <= words.length) {
        var ok = true;
        for (var j = 0; j < k; j++) if (words[i + j].lw !== n.parts[j]) { ok = false; break; }
        if (ok && (!best || best.len < k)) best = { pupilId: n.p.id, len: k };
      }
      /* first name + surname initial ("Ava B") */
      if (k > 1 && i + 1 < words.length && words[i].lw === n.first && words[i + 1].lw === n.parts[k - 1].charAt(0) && (!best || best.len < 2))
        best = { pupilId: n.p.id, len: 2 };
    });
    if (best) return best;
    var w = words[i].lw;
    var byFirst = idx.filter(function (n) { return n.first === w; });
    if (byFirst.length === 1) return { pupilId: byFirst[0].p.id, len: 1 };
    if (byFirst.length > 1) return { pupilId: null, len: 1, heard: words[i].w, choices: byFirst.map(function (n) { return n.p.id; }) };
    if (!allowFuzzy || w.length < 3 || STOP.indexOf(w) >= 0) return null;
    /* speech gets names slightly wrong ("Zoe" for "Zoey"): one edit, same first letter */
    var near = idx.filter(function (n) {
      return n.uniqueFirst && n.first.charAt(0) === w.charAt(0) && lev(n.first, w) <= (n.first.length >= 7 ? 2 : 1);
    });
    if (near.length === 1) return { pupilId: near[0].p.id, len: 1, fuzzy: true, heard: words[i].w };
    return null;
  }
  function tokenize(text) {
    var out = [], re = /[A-Za-z][A-Za-z'’\-]*/g, m;
    while ((m = re.exec(text))) out.push({ w: m[0], lw: clean(m[0]), start: m.index, end: m.index + m[0].length });
    return out;
  }

  /* ---------- markers & outcomes ---------- */
  function markerRules(quick) {
    var rules = [];
    var star = (quick || []).find(function (q) { return /\bstar\b/i.test(q); });
    var chal = (quick || []).find(function (q) { return /\bchallenge\b/i.test(q); });
    rules.push({ label: star || 'Gold star', re: /\b(?:gold(?:en)?\s+star|star\s+award|a\s+star)\b/i });
    rules.push({ label: chal || 'Challenge', re: /\bchallenges?\b/i, neg: /\b(?:not|didn'?t|did not|no|never|couldn'?t|wasn'?t)\b[^.]{0,30}\bchallenge/i });
    (quick || []).forEach(function (q) {
      var core = String(q).replace(/[.!?]+$/, '').trim();
      if (!core || core === star || core === chal) return;
      if (/^(?:met the objective|working towards it)$/i.test(core)) return;   // those are outcomes, not markers
      rules.push({ label: q, re: new RegExp('\\b' + core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'i') });
    });
    return rules;
  }
  var NOT_RE = /\b(?:not\s+(?:yet\s+)?met|(?:has|have)n'?t\s+met|(?:has|have)\s+not\s+met|did\s*n'?t\s+meet|did\s+not\s+meet|not\s+(?:yet\s+)?achieved|working\s+towards?(?:\s+(?:it|the objective))?|not\s+quite\s+(?:there|met))\b/i;
  var MET_RE = /\b(?:met|achieved|exceed(?:ed|ing)|greater\s+depth)\b/i;

  /* one clause → { met, markers, keep (text left once the control words go) } */
  function readClause(text, rules) {
    var met = null, markers = [], rest = text;
    if (NOT_RE.test(rest)) { met = 'not'; rest = rest.replace(new RegExp(NOT_RE.source, 'gi'), ' '); }
    else if (MET_RE.test(rest)) met = 'met';
    rules.forEach(function (r) {
      if (r.re.test(rest) && !(r.neg && r.neg.test(text))) { markers.push(r.label); rest = rest.replace(new RegExp(r.re.source, 'gi'), ' '); }
    });
    /* a clause that was only control words ("met", "given gold star",
       "accessed the challenge") is dropped from the written comment; one with
       anything else in it stays whole, so the teacher's sentence survives */
    var left = rest.replace(new RegExp(MET_RE.source, 'gi'), ' ').toLowerCase().split(/[^a-z']+/)
      .filter(function (w) { return w && FILLER.indexOf(w) < 0; });
    var standalone = /^\s*(?:and\s+|but\s+|so\s+)?(?:she\s+|he\s+|they\s+)?(?:has\s+)?(?:not\s+(?:yet\s+)?met|met)\s*$/i.test(text);
    var keep = (left.length && !standalone) ? (met === 'not' ? text.replace(new RegExp(NOT_RE.source + '\\s*', 'gi'), '').trim() || text : text) : '';
    /* "…as a numeral not met her date…" (no punctuation): if the outcome
       sat mid-clause it was cut out above; tidy the double space it left */
    return { met: met, markers: markers, keep: keep.replace(/\s{2,}/g, ' ').trim() };
  }
  function tidyComment(clauses) {
    var s = clauses.map(function (c, i) { return c.text + (i < clauses.length - 1 ? (c.delim === ',' ? ',' : '.') : ''); }).join(' ');
    s = s.replace(/^[\s,.;:]*(?:and|but|so)\b\s*/i, '').replace(/\s+([,.])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    s = s.replace(/\b([a-z]+)\b/gi, function (w) { var c = CONTRACTIONS[w.toLowerCase()]; return c ? (w.charAt(0) === w.charAt(0).toUpperCase() ? cap(c) : c) : w; });
    s = s.replace(/([.!?]\s+)([a-z])/g, function (_, a, b) { return a + b.toUpperCase(); });
    s = cap(s);
    if (s && !/[.!?]$/.test(s)) s += '.';
    return s;
  }

  /* ---------- the activity header ---------- */
  var HEAD_RE = /\b(?:create|make|start|add|set\s+up|begin)\b(?:\s+(?:a|an|the))?(?:\s+new)?\s+((?:[a-z]+\s+){0,3}?)(?:activity|piece\s+of\s+work|task|lesson)\b/i;
  var HEAD_RE2 = /\bnew\s+((?:[a-z]+\s+){0,3}?)(?:activity|piece\s+of\s+work|task|lesson)\b/i;
  function matchSet(words, sets) {
    var w = String(words || '').toLowerCase().replace(/\b(?:a|an|the|new|my|our|books?)\b/g, ' ').trim().replace(/\s+/g, ' ');
    if (!w) return { word: '' };
    var s = sets.find(function (x) { return x.name.toLowerCase() === w; }) ||
            sets.find(function (x) { var n = x.name.toLowerCase(); return n.indexOf(w) === 0 || w.indexOf(n) === 0; }) ||
            sets.find(function (x) { return x.name.toLowerCase().split(/\s+/).indexOf(w) >= 0; }) ||
            (w === 'math' || w === 'numeracy' ? sets.find(function (x) { return /^maths?$/i.test(x.name); }) : null) ||
            (w === 'literacy' || w === 'writing' ? sets.find(function (x) { return /^english$/i.test(x.name); }) : null);
    return { set: s || null, word: w };
  }
  function readHeader(text, ctx, idx) {
    var m = text.match(HEAD_RE) || text.match(HEAD_RE2);
    if (!m) return null;
    var start = m.index, pos = m.index + m[0].length;
    var setM = matchSet(m[1], ctx.sets);
    var rest = text.slice(pos);
    var date = null;
    /* "… activity in English called …" */
    var inM = rest.match(/^\s*(?:in|for)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)\b/i);
    if (inM && !setM.set) { var s2 = matchSet(inM[1], ctx.sets); if (s2.set) { setM = s2; pos += inM[0].length; rest = text.slice(pos); } }
    var d0 = parseDate(rest, ctx.today);
    if (d0) { date = d0.iso; pos += d0.len; rest = text.slice(pos); }
    var cm = rest.match(/^\s*(?:called|named|titled|on|about|:)?\s*/i);
    pos += cm[0].length; rest = text.slice(pos);
    /* title: up to a date, punctuation, "next pupil", or a pupil's name */
    var words = tokenize(rest), end = rest.length;
    for (var i = 0; i < words.length; i++) {
      var before = rest.slice(0, words[i].start);
      if (/[.,;:!?]/.test(before)) { end = before.search(/[.,;:!?]/); break; }
      if (i > 0 && parseDate(rest.slice(words[i].start), ctx.today) && /^(?:on|dated|from|for|today|yesterday|done)$/i.test(words[i].lw)) { end = words[i].start; break; }
      if (i > 0 && /^\d/.test(rest.slice(words[i - 1].end).trim())) { end = words[i - 1].end; break; }
      if (i > 0 && (matchName(idx, words, i, false) || (words[i].lw === 'next' && words[i + 1] && FORCE_NEXT.test('next ' + words[i + 1].lw)))) { end = words[i].start; break; }
      if (i >= 8) { end = words[i].start; break; }
    }
    if (!words.length) end = 0;
    var dm = rest.slice(0, end).match(/\s+(\d{1,2}\s*[\/\-.]\s*\d{1,2}(?:\s*[\/\-.]\s*\d{2,4})?)\s*$/);
    if (dm && !date) { var dd = parseDate(dm[1], ctx.today); if (dd) { date = dd.iso; end -= dm[0].length; } }
    var title = cap(rest.slice(0, end).trim().replace(/[.,;:]+$/, ''));
    pos += end; rest = text.slice(pos);
    if (!date) { var d1 = parseDate(rest.replace(/^[\s,]+/, ''), ctx.today); if (d1) { date = d1.iso; pos += rest.length - rest.replace(/^[\s,]+/, '').length + d1.len; } }
    return { start: start, end: pos, title: title, date: date, set: setM.set, setWord: setM.word };
  }

  /* ---------- parse ---------- */
  /* ctx = { pupils:[{id,name}], sets:[{id,name}], activities:[{id,setId,title,workDate}],
             markers:[quick-marker text], activeSetId, activeActivityId, today:'YYYY-MM-DD' } */
  function parse(raw, ctx) {
    ctx = ctx || {};
    ctx.pupils = ctx.pupils || []; ctx.sets = ctx.sets || []; ctx.activities = ctx.activities || [];
    ctx.today = ctx.today || isoOf(new Date());
    var text = spokenPunctuation(raw).replace(/\s+/g, ' ').trim();
    var idx = nameIndex(ctx.pupils);
    var rules = markerRules(ctx.markers);
    var plan = { activity: null, entries: [], unmatched: [], warnings: [] };

    /* 1. the activity */
    var h = readHeader(text, ctx, idx), body = text;
    if (h) {
      body = (text.slice(0, h.start) + ' ' + text.slice(h.end)).replace(/^[\s,.;:]+/, '');
      var setId = h.set ? h.set.id : (h.setWord ? null : ctx.activeSetId);
      var newSetName = (!h.set && h.setWord) ? cap(h.setWord) : '';
      var title = h.title || '';
      var workDate = h.date || ctx.today;
      var same = setId && title ? ctx.activities.find(function (a) {
        return a.setId === setId && a.title.toLowerCase() === title.toLowerCase() && a.workDate === workDate;
      }) : null;
      plan.activity = same
        ? { mode: 'existing', id: same.id, setId: same.setId, title: same.title, workDate: same.workDate }
        : { mode: 'new', setId: setId, newSetName: newSetName, title: title, workDate: workDate };
      if (!title) plan.warnings.push('I heard a new activity but no title — add one before saving.');
      if (newSetName) plan.warnings.push('“' + newSetName + '” isn’t one of your sets of books — a new set will be made.');
      if (!h.date) plan.warnings.push('No date of work heard — using today.');
    } else {
      /* "marking partitioning" — an existing activity named in the opening words */
      var lead = text.slice(0, 80).toLowerCase();
      var named = ctx.activities.filter(function (a) { return a.title && new RegExp('\\b' + a.title.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(lead); })
        .sort(function (a, b) { return (b.setId === ctx.activeSetId) - (a.setId === ctx.activeSetId) || String(b.workDate).localeCompare(String(a.workDate)); })[0];
      var act = named || ctx.activities.find(function (a) { return a.id === ctx.activeActivityId; });
      if (named) {
        var t = named.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        body = text.replace(new RegExp('^\\s*(?:(?:carry on|continue|keep)\\s+)?(?:marking|mark|activity)?\\s*' + t + '\\b[\\s,.:;]*', 'i'), '');
      }
      plan.activity = act ? { mode: 'existing', id: act.id, setId: act.setId, title: act.title, workDate: act.workDate } : null;
      if (!act) plan.warnings.push('No activity yet — say “create new maths activity called …”, or pick one on the left.');
    }

    /* 2. split the rest into one segment per book */
    var words = tokenize(body), segs = [], cur = null, forceAt = -1;
    for (var i = 0; i < words.length; i++) {
      if (words[i].lw === 'next' && words[i + 1] && FORCE_NEXT.test('next ' + words[i + 1].lw)) { forceAt = i + 2; }
      var gap = body.slice(i ? words[i - 1].end : 0, words[i].start);
      var boundary = i === 0 || /[.,;:!?]/.test(gap) || i === forceAt ||
        HANDOVER.test(body.slice(Math.max(0, words[i].start - 24), words[i].start).trim());
      var m = matchName(idx, words, i, boundary);
      if (i === forceAt && !m) m = { pupilId: null, len: 1, heard: words[i].w };
      if (!m) continue;
      if (!(boundary || !cur)) continue;                               // "…helped Zoey…" is a note, not a new book
      if (cur && m.pupilId && m.pupilId === cur.pupilId && i !== forceAt) continue;   // same child again
      /* cut: walk back over "next pupil" / "then" so they don't end up in a comment */
      var cut = words[i].start, j = i - 1;
      while (j >= 0 && /^(?:next|then|now|okay|ok|right|pupil|child|book|one|person|up)$/.test(words[j].lw) &&
             !/[.,;:!?]/.test(body.slice(words[j].end, j + 1 < words.length ? words[j + 1].start : body.length))) { cut = words[j].start; j--; }
      if (cur) cur.end = cut; else if (body.slice(0, cut).replace(/[\s.,;:]+/g, '')) plan.unmatched.push(body.slice(0, cut).trim());
      cur = { pupilId: m.pupilId, heard: m.heard || words.slice(i, i + m.len).map(function (w) { return w.w; }).join(' '),
              fuzzy: !!m.fuzzy, choices: m.choices || null, start: words[i + m.len - 1].end, end: body.length };
      segs.push(cur);
      i += m.len - 1;
    }
    if (!segs.length && body.replace(/[\s.,;:]+/g, '')) plan.unmatched.push(body.trim());

    /* 3. read each book */
    segs.forEach(function (s) {
      var seg = body.slice(s.start, s.end).replace(/^[\s,.;:'’s]*(?=\S)/, function (x) { return /^'|^’/.test(x) ? x : x.replace(/[,.;:]/g, ''); }).trim();
      var parts = seg.split(/([.;!?]+|,)/), clauses = [], met = null, markers = [];
      for (var k = 0; k < parts.length; k += 2) {
        var c = (parts[k] || '').trim(); if (!c) continue;
        var r = readClause(c, rules);
        if (r.met) met = r.met;                                   // the last thing said wins
        r.markers.forEach(function (x) { if (markers.indexOf(x) < 0) markers.push(x); });
        if (r.keep) clauses.push({ text: r.keep, delim: (parts[k + 1] || '.').trim().charAt(0) });
      }
      plan.entries.push({ pupilId: s.pupilId, heard: s.heard, fuzzy: s.fuzzy, choices: s.choices,
                          met: met, markers: markers, comment: tidyComment(clauses), raw: seg });
    });
    /* the same child twice → one book, notes merged */
    var seen = {};
    plan.entries = plan.entries.filter(function (e) {
      if (!e.pupilId) return true;
      var prev = seen[e.pupilId];
      if (!prev) { seen[e.pupilId] = e; return true; }
      if (e.met) prev.met = e.met;
      e.markers.forEach(function (x) { if (prev.markers.indexOf(x) < 0) prev.markers.push(x); });
      if (e.comment) prev.comment = prev.comment ? prev.comment + ' ' + e.comment : e.comment;
      return false;
    });
    return plan;
  }

  window.mkDictate = { parse: parse, command: command, spokenPunctuation: spokenPunctuation, parseDate: parseDate };
})();
