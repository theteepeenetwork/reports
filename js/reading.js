/* ============================================================
   reading.js — 1:1 READING tracker (#reading)
   Owner: Desk (docs/OWNERSHIP.md) · loads after helpers.js / roster.js

   Log each time a child is heard read: the book, the words they blended,
   the words they got stuck on, how they decoded, how fluent it sounded and
   what they understood. Three views:
     Log a session   the form, with last time's next step shown first
     One child       their history and what keeps tripping them up
     Whole class     who was heard when, longest wait first

   Every judgement is the same three steps — Not yet / Sometimes / Secure —
   and each step has a line saying what it looks like (GUIDE below).

   STORE  tp_reading_log  (per class; in DATA_KEYS; see docs/CONTRACT.md)
     { sessions: [ { id, pupilId, date: 'YYYY-MM-DD',
         book, band, pages, fit: 'easy'|'right'|'hard',
         blended: [word], stuck: [word], gpcs: [grapheme], tricky: [word],
         strategy: 'sounds'|'head'|'sight'|'guess', selfCorrect: 0|1|2,
         flu:  { pace, expr, punct },                       each 0|1|2
         comp: { retell, retrieve, infer, predict, vocab }, each 0|1|2, absent = not asked
         note, next, updatedAt, del? } ] }
   Only id, pupilId and date are always there; read everything else with a
   default. A deleted session keeps its record with del: 1, so a merge with
   another device cannot bring it back. Band, strategy, fit and rating ids
   are permanent: add, never rename. Names are never stored, only roster ids.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'tp_reading_log';
  var STEPS = ['Not yet', 'Sometimes', 'Secure'];
  var BANDS = [['Pink', '#f2a7c3'], ['Red', '#e04b4b'], ['Yellow', '#f4d13d'], ['Blue', '#4b8ee0'], ['Green', '#43b16a'],
               ['Orange', '#f28a35'], ['Turquoise', '#29b3ae'], ['Purple', '#8d5cc7'], ['Gold', '#c9a227'], ['White', '#f4f4f4'],
               ['Lime', '#b5d334'], ['Free reader', '#7a7f8a']].map(function (b) { return { n: b[0], c: b[1] }; });
  var FITS = [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']];
  var STRATS = [['sounds', 'Sounds out aloud'], ['head', 'Blends in their head'], ['sight', 'Reads on sight'], ['guess', 'Guesses from picture or first letter']];

  /* what each step looks like: [not yet, sometimes, secure] */
  var FLU = [
    { id: 'pace', t: 'Pace', g: ['Word by word, with long gaps.', 'Short phrases, with some stops and starts.', 'Smooth, close to talking speed.'] },
    { id: 'expr', t: 'Expression', g: ['Flat, the same tone throughout.', 'Changes voice for some speech or questions.', 'Voice matches the meaning and the character.'] },
    { id: 'punct', t: 'Punctuation', g: ['Reads straight through full stops.', 'Pauses at full stops, misses commas, ? and !', 'Pauses and changes tone for . , ? and !'] }
  ];
  var SELF = { id: 'selfCorrect', t: 'Self-correction', g: ['Reads on past mistakes.', 'Goes back when it stops making sense.', 'Notices and fixes a mistake straight away.'] };
  var COMP = [
    { id: 'retell', t: 'Retell', g: ['Needs a prompt for each event.', 'Retells the main events, the order may slip.', 'Retells in order, with key details.'] },
    { id: 'retrieve', t: 'Retrieval', g: ['Cannot find the answer in the text.', 'Finds it when prompted to look back.', 'Finds or recalls the answer unprompted.'] },
    { id: 'infer', t: 'Inference', g: ['Answers only what is stated.', 'Gives a sensible idea, cannot say why.', 'Explains how they know from the text or pictures.'] },
    { id: 'predict', t: 'Prediction', g: ['Guesses, not linked to the story.', 'A plausible guess, not tied to what has happened.', 'Predicts from what has happened so far.'] },
    { id: 'vocab', t: 'Vocabulary', g: ['Skips unknown words without noticing.', 'Notices an unknown word and asks.', 'Works out or explains a word from the context.'] }
  ];
  var LISTS = { blended: 'Words they blended', stuck: 'Words they got stuck on', gpcs: 'Graphemes missed', tricky: 'Tricky words missed' };
  var WINDOW_DAYS = 42;   /* "recent" = the last six weeks */

  /* ── dates (local parts, never toISOString — BST midnight rolls back) ── */
  function isoOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function todayISO() { return isoOf(new Date()); }
  function dateOf(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longD(s) { return dateOf(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function shortD(s) { return dateOf(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function daysSince(iso, today) { return Math.round((dateOf(today || todayISO()) - dateOf(iso)) / 86400000); }

  /* ── store ────────────────────────────────────────────── */
  function load() { var s = Store.get(KEY, null) || {}; return { sessions: Array.isArray(s.sessions) ? s.sessions : [] }; }
  function save(s) { Store.set(KEY, s); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function isStep(v) { return v === 0 || v === 1 || v === 2; }

  /* ── pure parts ───────────────────────────────────────── */
  /* a child's sessions, newest first */
  function sessionsFor(state, pid) {
    return state.sessions.filter(function (s) { return s && !s.del && s.pupilId === pid && s.date; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0); });
  }
  /* things in `field` that turn up in two or more sessions, most often first */
  function recurring(list, field) {
    var n = {}, shown = {};
    list.forEach(function (s) {
      var seen = {};
      arr(s[field]).forEach(function (w) { var k = String(w).trim().toLowerCase(); if (!k || seen[k]) return; seen[k] = 1; n[k] = (n[k] || 0) + 1; if (!shown[k]) shown[k] = String(w).trim(); });
    });
    return Object.keys(n).filter(function (k) { return n[k] >= 2; }).sort(function (a, b) { return n[b] - n[a] || (a < b ? -1 : 1); })
      .map(function (k) { return { w: shown[k], n: n[k] }; });
  }
  /* one row per child; never heard first, then the longest wait */
  function classRows(state, pupils, today) {
    today = today || todayISO();
    return pupils.map(function (p) {
      var list = sessionsFor(state, p.id), last = list[0] || null;
      var banded = list.filter(function (s) { return s.band; })[0];
      var rated = list.filter(function (s) { return s.flu && FLU.some(function (f) { return isStep(s.flu[f.id]); }); })[0];
      return { id: p.id, name: p.name, last: last ? last.date : null, days: last ? daysSince(last.date, today) : null,
        recent: list.filter(function (s) { var d = daysSince(s.date, today); return d >= 0 && d < WINDOW_DAYS; }).length,
        band: banded ? banded.band : '', flu: rated ? rated.flu : null, stuck: recurring(list, 'stuck').slice(0, 3) };
    }).sort(function (a, b) {
      if (a.days == null || b.days == null) return a.days == null ? (b.days == null ? 0 : -1) : 1;
      return b.days - a.days;
    });
  }
  /* the draft as a stored record: empty fields are left out */
  function toRecord(d, pid) {
    var r = { id: d.id || uid(), pupilId: pid, date: d.date || todayISO(), updatedAt: Date.now() };
    ['book', 'pages', 'note', 'next'].forEach(function (k) { var v = String(d[k] || '').trim(); if (v) r[k] = v; });
    ['band', 'fit', 'strategy'].forEach(function (k) { if (d[k]) r[k] = d[k]; });
    Object.keys(LISTS).forEach(function (k) { if (arr(d[k]).length) r[k] = d[k].slice(); });
    if (isStep(d.selfCorrect)) r.selfCorrect = d.selfCorrect;
    [['flu', FLU], ['comp', COMP]].forEach(function (g) {
      var o = {}; g[1].forEach(function (f) { if (d[g[0]] && isStep(d[g[0]][f.id])) o[f.id] = d[g[0]][f.id]; });
      if (Object.keys(o).length) r[g[0]] = o;
    });
    return r;
  }
  function splitWords(text) { return String(text || '').split(/[,;\s]+/).map(function (w) { return w.trim(); }).filter(Boolean); }

  /* ── view state (device-local, not data) ──────────────── */
  var view = 'log', pupilId = null, draft = null, showGuide = false, flash = '', undoId = null;
  function blank() { return { id: null, date: todayISO(), book: '', band: '', pages: '', fit: '', blended: [], stuck: [], gpcs: [], tricky: [], strategy: '', selfCorrect: null, flu: {}, comp: {}, note: '', next: '' }; }
  function draftOf(s) {
    var d = blank(); d.id = s.id; d.date = s.date;
    ['book', 'band', 'pages', 'fit', 'strategy', 'note', 'next'].forEach(function (k) { d[k] = s[k] || ''; });
    Object.keys(LISTS).forEach(function (k) { d[k] = arr(s[k]).slice(); });
    d.selfCorrect = isStep(s.selfCorrect) ? s.selfCorrect : null;
    d.flu = Object.assign({}, s.flu || {}); d.comp = Object.assign({}, s.comp || {});
    return d;
  }

  function host() { return document.getElementById('page-reading'); }
  function pupils() { return typeof sortedRoster === 'function' ? sortedRoster() : (window.roster || []); }
  function nameOf(pid) { var p = pupils().filter(function (x) { return x.id === pid; })[0]; return p ? p.name : ''; }
  function bandDot(n) { var b = BANDS.filter(function (x) { return x.n === n; })[0]; return b ? '<span class="rd-dot" style="background:' + b.c + '"></span>' : ''; }
  function pill(v, label) { return isStep(v) ? '<span class="rd-pill rd-s' + v + '">' + (label ? esc(label) + ': ' : '') + STEPS[v] + '</span>' : ''; }
  function chips(list, cls) { return arr(list).map(function (w) { return '<span class="rd-chip ' + cls + '">' + esc(w) + '</span>'; }).join(''); }
  function getRate(path) { var p = path.split('.'); return p.length === 1 ? draft[p[0]] : (draft[p[0]] || {})[p[1]]; }
  function setRate(path, v) {
    var p = path.split('.');
    if (p.length === 1) { draft[p[0]] = v; return; }
    if (!draft[p[0]]) draft[p[0]] = {};
    if (v == null) delete draft[p[0]][p[1]]; else draft[p[0]][p[1]] = v;
  }

  /* typed text lives in the DOM until the next redraw: pull it into the draft first */
  function readInputs() {
    var h = host(); if (!h || !draft) return;
    h.querySelectorAll('[data-rdf]').forEach(function (el) { draft[el.dataset.rdf] = el.value; });
    h.querySelectorAll('[data-rdlist]').forEach(function (el) { addWords(el.dataset.rdlist, el.value); el.value = ''; });
  }
  function addWords(field, text) {
    splitWords(text).forEach(function (w) {
      if (!draft[field].some(function (x) { return x.toLowerCase() === w.toLowerCase(); })) draft[field].push(w);
    });
  }

  function render() {
    var h = host(); if (!h) return;
    var list = pupils();
    if (!pupilId || !list.some(function (p) { return p.id === pupilId; })) pupilId = list.length ? list[0].id : null;
    if (!draft) draft = blank();
    h.innerHTML =
      '<div class="page-header"><h1>Reading</h1>' +
      '<p>Log each time you hear a child read: the book, the words they blended, the words they got stuck on, and how it sounded.</p></div>' +
      '<div class="cbm-tabs rd-tabs rd-noprint">' + [['log', 'Log a session'], ['child', 'One child'], ['class', 'Whole class']].map(function (t) {
        return '<button type="button" class="cbm-tab' + (view === t[0] ? ' active' : '') + '" data-rdview="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="rdBody"></div>';
    h.querySelectorAll('[data-rdview]').forEach(function (b) { b.onclick = function () { go(b.dataset.rdview); }; });
    if (!list.length) { document.getElementById('rdBody').innerHTML = '<div class="card empty">Add pupils on the Pupils page first.</div>'; return; }
    if (view === 'class') renderClass(); else if (view === 'child') renderChild(); else renderLog();
  }
  function go(v) { readInputs(); view = v; flash = ''; if (v !== 'child') undoId = null; render(); }

  function whoBar(extra) {
    var list = pupils(), idx = list.map(function (p) { return p.id; }).indexOf(pupilId), state = load();
    return '<div class="rd-who rd-noprint"><button type="button" class="secondary small" id="rdPrev" aria-label="Previous pupil"' + (idx <= 0 ? ' disabled' : '') + '>‹</button>' +
      '<select id="rdPupil" aria-label="Pupil">' + list.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === pupilId ? ' selected' : '') + '>' + esc(p.name) + ' (' + sessionsFor(state, p.id).length + ')</option>'; }).join('') + '</select>' +
      '<button type="button" class="secondary small" id="rdNext" aria-label="Next pupil"' + (idx >= list.length - 1 ? ' disabled' : '') + '>›</button>' + (extra || '') + '</div>';
  }
  function wireWho() {
    var list = pupils(), idx = list.map(function (p) { return p.id; }).indexOf(pupilId);
    function to(pid) { readInputs(); pupilId = pid; flash = ''; undoId = null; render(); }
    document.getElementById('rdPupil').onchange = function (e) { to(e.target.value); };
    document.getElementById('rdPrev').onclick = function () { if (idx > 0) to(list[idx - 1].id); };
    document.getElementById('rdNext').onclick = function () { if (idx < list.length - 1) to(list[idx + 1].id); };
  }

  /* ── log a session ────────────────────────────────────── */
  function rateRow(path, def) {
    var v = getRate(path);
    var guide = showGuide
      ? def.g.map(function (g, i) { return '<span class="' + (v === i ? 'on' : '') + '"><b>' + STEPS[i] + '</b> ' + esc(g) + '</span>'; }).join('')
      : (isStep(v) ? esc(def.g[v]) : '<i>Tap one. Tap it again to clear.</i>');
    return '<div class="rd-rate" data-rdrate="' + path + '"><div class="rd-rate-t">' + esc(def.t) + '</div>' +
      '<div class="rd-steps" role="group" aria-label="' + esc(def.t) + '">' + STEPS.map(function (s, i) {
        return '<button type="button" class="rd-step rd-s' + i + (v === i ? ' active' : '') + '" data-rdstep="' + i + '" aria-pressed="' + (v === i) + '">' + s + '</button>'; }).join('') + '</div>' +
      '<div class="rd-guide' + (showGuide ? ' all' : '') + '">' + guide + '</div></div>';
  }
  function listBox(field, cls, ph) {
    return '<div class="rd-field"><label for="rdL_' + field + '">' + LISTS[field] + '</label>' +
      '<div class="rd-chips">' + draft[field].map(function (w, i) {
        return '<span class="rd-chip ' + cls + '">' + esc(w) + '<button type="button" data-rdrm="' + field + ':' + i + '" aria-label="Remove ' + esc(w) + '">×</button></span>'; }).join('') +
      '<input type="text" id="rdL_' + field + '" data-rdlist="' + field + '" placeholder="' + ph + '" autocapitalize="off" autocomplete="off" spellcheck="false"></div></div>';
  }
  function choice(field, opts) {
    return '<div class="rd-steps">' + opts.map(function (o) {
      return '<button type="button" class="rd-step' + (draft[field] === o[0] ? ' active' : '') + '" data-rdpick="' + field + ':' + o[0] + '" aria-pressed="' + (draft[field] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function lastTime(state) {
    var list = sessionsFor(state, pupilId).filter(function (s) { return s.id !== draft.id; });
    if (!list.length) return '<div class="rd-last">No sessions logged yet for <b>' + esc(nameOf(pupilId)) + '</b>.</div>';
    var s = list[0], st = recurring(list, 'stuck'), gp = recurring(list, 'gpcs');
    return '<div class="rd-last"><b>Last heard ' + esc(shortD(s.date)) + '</b>' + (s.book ? ' · ' + esc(s.book) : '') + (s.band ? ' · ' + bandDot(s.band) + esc(s.band) : '') +
      (s.next ? '<div><span class="rd-lab">Next step</span> ' + esc(s.next) + '</div>' : '') +
      (st.length ? '<div><span class="rd-lab">Keeps getting stuck on</span> ' + chips(st.map(function (x) { return x.w + ' ×' + x.n; }), 'no') + '</div>' : '') +
      (gp.length ? '<div><span class="rd-lab">Graphemes to revisit</span> ' + chips(gp.map(function (x) { return x.w + ' ×' + x.n; }), 'no') + '</div>' : '') + '</div>';
  }
  function renderLog() {
    var body = document.getElementById('rdBody'), state = load(), d = draft, list = pupils();
    var idx = list.map(function (p) { return p.id; }).indexOf(pupilId);
    body.innerHTML =
      '<div class="card">' + whoBar('<label class="rd-date">Date <input type="date" data-rdf="date" value="' + esc(d.date) + '"></label>' +
        '<span class="grow"></span><label class="rd-toggle"><input type="checkbox" id="rdGuide"' + (showGuide ? ' checked' : '') + '> Show what each step looks like</label>') +
        (d.id ? '<div class="rd-editing">Editing the session from ' + esc(longD(d.date)) + '. <button type="button" class="secondary small" id="rdCancel">Cancel</button></div>' : '') +
        (flash ? '<div class="rd-flash" role="status">' + esc(flash) + '</div>' : '') + lastTime(state) + '</div>' +

      '<div class="card"><h3>Book</h3><div class="rd-grid">' +
        '<div class="rd-field wide"><label for="rdBook">Title</label><input type="text" id="rdBook" data-rdf="book" value="' + esc(d.book) + '"></div>' +
        '<div class="rd-field"><label for="rdBand">Band</label><select id="rdBand" data-rdf="band"><option value="">—</option>' + BANDS.map(function (b) {
          return '<option' + (d.band === b.n ? ' selected' : '') + '>' + b.n + '</option>'; }).join('') + '</select></div>' +
        '<div class="rd-field"><label for="rdPages">Pages</label><input type="text" id="rdPages" data-rdf="pages" placeholder="e.g. 4–11" value="' + esc(d.pages) + '"></div>' +
        '</div><div class="rd-field"><label>How the book fitted</label>' + choice('fit', FITS) + '</div></div>' +

      '<div class="card"><h3>Words</h3><p class="cbm-hint">Type a word and press Enter, or several with commas.</p>' +
        listBox('blended', 'ok', 'e.g. ship, frog') + listBox('stuck', 'no', 'e.g. night, could') + '</div>' +

      '<div class="card"><h3>Decoding</h3><div class="rd-field"><label>Mostly</label>' + choice('strategy', STRATS) + '</div>' +
        listBox('gpcs', 'no', 'e.g. igh, a-e') + listBox('tricky', 'no', 'e.g. said, was') + rateRow('selfCorrect', SELF) + '</div>' +

      '<div class="card"><h3>Fluency</h3>' + FLU.map(function (f) { return rateRow('flu.' + f.id, f); }).join('') + '</div>' +

      '<div class="card"><h3>Comprehension</h3><p class="cbm-hint">Rate only what you asked about. Leave the rest blank.</p>' +
        COMP.map(function (f) { return rateRow('comp.' + f.id, f); }).join('') + '</div>' +

      '<div class="card"><div class="rd-field"><label for="rdNote">Note</label><textarea id="rdNote" data-rdf="note" rows="2" placeholder="What you noticed. Keep safeguarding and medical detail out of here.">' + esc(d.note) + '</textarea></div>' +
        '<div class="rd-field"><label for="rdNextStep">Next step</label><input type="text" id="rdNextStep" data-rdf="next" placeholder="Shown at the top next time you hear them read" value="' + esc(d.next) + '"></div>' +
        '<div class="rd-actions"><button type="button" id="rdSave">' + (d.id ? 'Save changes' : 'Save session') + '</button>' +
        (!d.id && idx < list.length - 1 ? '<button type="button" class="secondary" id="rdSaveNext">Save and next child</button>' : '') + '</div></div>';

    wireWho();
    document.getElementById('rdGuide').onchange = function (e) { readInputs(); showGuide = e.target.checked; renderLog(); };
    var cancel = document.getElementById('rdCancel'); if (cancel) cancel.onclick = function () { draft = blank(); view = 'child'; render(); };
    body.querySelectorAll('.rd-rate').forEach(function (row) {
      row.querySelectorAll('[data-rdstep]').forEach(function (b) {
        b.onclick = function () {
          var path = row.dataset.rdrate, v = +b.dataset.rdstep;
          readInputs(); setRate(path, getRate(path) === v ? null : v); redraw('[data-rdrate="' + path + '"] [data-rdstep="' + v + '"]');
        };
      });
    });
    body.querySelectorAll('[data-rdpick]').forEach(function (b) {
      b.onclick = function () {
        var p = b.dataset.rdpick.split(':'); readInputs(); draft[p[0]] = draft[p[0]] === p[1] ? '' : p[1]; redraw('[data-rdpick="' + b.dataset.rdpick + '"]');
      };
    });
    body.querySelectorAll('[data-rdrm]').forEach(function (b) {
      b.onclick = function () { var p = b.dataset.rdrm.split(':'); readInputs(); draft[p[0]].splice(+p[1], 1); redraw('#rdL_' + p[0]); };
    });
    body.querySelectorAll('[data-rdlist]').forEach(function (el) {
      el.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (el.value.trim()) { readInputs(); redraw('#rdL_' + el.dataset.rdlist); } }
        else if (e.key === 'Backspace' && !el.value && draft[el.dataset.rdlist].length) { readInputs(); draft[el.dataset.rdlist].pop(); redraw('#rdL_' + el.dataset.rdlist); }
      };
    });
    document.getElementById('rdSave').onclick = function () { commit(false); };
    var sn = document.getElementById('rdSaveNext'); if (sn) sn.onclick = function () { commit(true); };
  }
  /* redraw the form where it stands, and put the focus back */
  function redraw(focusSel) {
    var y = window.scrollY; flash = ''; renderLog(); window.scrollTo(0, y);
    var el = focusSel && host().querySelector(focusSel); if (el) el.focus({ preventScroll: true });
  }
  function commit(andNext) {
    readInputs();
    var state = load(), rec = toRecord(draft, pupilId), i = state.sessions.map(function (s) { return s.id; }).indexOf(rec.id);
    var was = !!draft.id, list = pupils(), idx = list.map(function (p) { return p.id; }).indexOf(pupilId);
    if (i >= 0) state.sessions[i] = rec; else state.sessions.push(rec);
    save(state);
    flash = (was ? 'Changes saved for ' : 'Saved for ') + nameOf(pupilId) + ', ' + shortD(rec.date) + '.';
    draft = blank();
    if (was) view = 'child'; else if (andNext && idx < list.length - 1) pupilId = list[idx + 1].id;
    render(); window.scrollTo(0, 0);
  }

  /* ── one child: what keeps coming up, then every session ── */
  function sessionCard(s) {
    var fit = FITS.filter(function (f) { return f[0] === s.fit; })[0], strat = STRATS.filter(function (x) { return x[0] === s.strategy; })[0];
    function row(lab, html) { return html ? '<div class="rd-row"><span class="rd-lab">' + lab + '</span> ' + html + '</div>' : ''; }
    function rates(defs, o) { return defs.map(function (f) { return pill((o || {})[f.id], f.t); }).join(''); }
    return '<div class="card rd-session" data-rdsession="' + esc(s.id) + '"><div class="rd-session-h"><b>' + esc(longD(s.date)) + '</b>' +
      '<span>' + [s.book ? esc(s.book) : '', s.band ? bandDot(s.band) + esc(s.band) : '', s.pages ? 'pp. ' + esc(s.pages) : '', fit ? fit[1] : ''].filter(Boolean).join(' · ') + '</span><span class="grow"></span>' +
      '<button type="button" class="secondary small rd-noprint" data-rdedit="' + esc(s.id) + '">Edit</button>' +
      '<button type="button" class="secondary small rd-noprint" data-rddel="' + esc(s.id) + '">Delete</button></div>' +
      row('Blended', chips(s.blended, 'ok')) + row('Stuck on', chips(s.stuck, 'no')) + row('Graphemes missed', chips(s.gpcs, 'no')) + row('Tricky words missed', chips(s.tricky, 'no')) +
      row('Decoding', [strat ? esc(strat[1]) : '', pill(s.selfCorrect, SELF.t)].filter(Boolean).join(' ')) +
      row('Fluency', rates(FLU, s.flu)) + row('Comprehension', rates(COMP, s.comp)) +
      row('Note', s.note ? esc(s.note) : '') + row('Next step', s.next ? esc(s.next) : '') + '</div>';
  }
  function renderChild() {
    var body = document.getElementById('rdBody'), state = load(), list = sessionsFor(state, pupilId), today = todayISO();
    var recent = list.filter(function (s) { var d = daysSince(s.date, today); return d >= 0 && d < WINDOW_DAYS; }).length;
    var bands = [], oldest = list.slice().reverse();
    oldest.forEach(function (s) { if (s.band && bands[bands.length - 1] !== s.band) bands.push(s.band); });
    function rec(lab, field) { var r = recurring(list, field); return r.length ? '<div class="rd-row"><span class="rd-lab">' + lab + '</span> ' + chips(r.map(function (x) { return x.w + ' ×' + x.n; }), 'no') + '</div>' : ''; }
    var trend = FLU.map(function (f) {
      var seq = oldest.filter(function (s) { return s.flu && isStep(s.flu[f.id]); }).slice(-8);
      return seq.length ? '<div class="rd-row"><span class="rd-lab">' + f.t + '</span> ' + seq.map(function (s) {
        return '<span class="rd-pill rd-s' + s.flu[f.id] + '" title="' + esc(shortD(s.date)) + '">' + STEPS[s.flu[f.id]] + '</span>'; }).join('<span class="rd-arrow">›</span>') + '</div>' : '';
    }).join('');
    body.innerHTML =
      '<div class="card">' + whoBar('<span class="grow"></span><button type="button" class="rd-noprint" id="rdNew">Log a session</button>') +
        '<h3 class="rd-print-name">' + esc(nameOf(pupilId)) + '</h3>' +
        (flash ? '<div class="rd-flash rd-noprint" role="status">' + esc(flash) + (undoId ? ' <button type="button" class="secondary small" id="rdUndo">Undo</button>' : '') + '</div>' : '') +
        (list.length
          ? '<p class="rd-sum"><b>' + list.length + '</b> session' + (list.length === 1 ? '' : 's') + ' · <b>' + recent + '</b> in the last six weeks · last heard <b>' + esc(shortD(list[0].date)) + '</b></p>' +
            (bands.length ? '<div class="rd-row"><span class="rd-lab">Bands</span> ' + bands.map(function (b) { return bandDot(b) + esc(b); }).join('<span class="rd-arrow">›</span>') + '</div>' : '') +
            trend + rec('Keeps getting stuck on', 'stuck') + rec('Graphemes to revisit', 'gpcs') + rec('Tricky words to revisit', 'tricky') +
            (list[0].next ? '<div class="rd-row"><span class="rd-lab">Next step</span> ' + esc(list[0].next) + '</div>' : '')
          : '<p class="empty">No reading sessions logged yet.</p>') +
      '</div>' + list.map(sessionCard).join('');
    wireWho();
    document.getElementById('rdNew').onclick = function () { draft = blank(); view = 'log'; flash = ''; undoId = null; render(); };
    var u = document.getElementById('rdUndo');
    if (u) u.onclick = function () {
      var s = load(); s.sessions.forEach(function (x) { if (x.id === undoId) { delete x.del; x.updatedAt = Date.now(); } });
      save(s); undoId = null; flash = ''; renderChild();
    };
    body.querySelectorAll('[data-rdedit]').forEach(function (b) {
      b.onclick = function () { var s = list.filter(function (x) { return x.id === b.dataset.rdedit; })[0]; if (s) { draft = draftOf(s); view = 'log'; flash = ''; undoId = null; render(); window.scrollTo(0, 0); } };
    });
    body.querySelectorAll('[data-rddel]').forEach(function (b) {
      b.onclick = function () {
        var s = load(), hit = s.sessions.filter(function (x) { return x.id === b.dataset.rddel; })[0]; if (!hit) return;
        hit.del = 1; hit.updatedAt = Date.now(); save(s);
        undoId = hit.id; flash = 'Deleted the session from ' + shortD(hit.date) + '.'; renderChild(); window.scrollTo(0, 0);
      };
    });
  }

  /* ── whole class: who is due ──────────────────────────── */
  function renderClass() {
    var body = document.getElementById('rdBody'), rows = classRows(load(), pupils(), todayISO());
    body.innerHTML =
      '<div class="card"><p class="cbm-hint" style="margin-top:0">Longest wait first. Tap a name to see that child.</p>' +
      '<div class="table-wrap"><table class="rd-table"><thead><tr><th class="name">Pupil</th><th>Last heard</th><th>Days</th><th title="Sessions in the last six weeks">6 weeks</th><th>Band</th>' +
        FLU.map(function (f) { return '<th>' + f.t + '</th>'; }).join('') + '<th class="name">Keeps getting stuck on</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var due = r.days == null ? 'rd-never' : r.days >= 14 ? 'rd-late' : r.days >= 7 ? 'rd-due' : '';
        return '<tr data-rdrow="' + esc(r.id) + '"><td class="name"><button type="button" class="rd-name" data-rdopen="' + esc(r.id) + '">' + esc(r.name) + '</button></td>' +
          '<td>' + (r.last ? esc(shortD(r.last)) : 'Not yet heard') + '</td>' +
          '<td class="' + due + '">' + (r.days == null ? '—' : r.days === 0 ? 'Today' : r.days + (r.days >= 14 ? ' !' : '')) + '</td>' +
          '<td>' + r.recent + '</td><td>' + (r.band ? bandDot(r.band) + esc(r.band) : '') + '</td>' +
          FLU.map(function (f) { return '<td>' + pill((r.flu || {})[f.id]) + '</td>'; }).join('') +
          '<td class="name">' + chips(r.stuck.map(function (x) { return x.w + ' ×' + x.n; }), 'no') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    body.querySelectorAll('[data-rdopen]').forEach(function (b) { b.onclick = function () { pupilId = b.dataset.rdopen; view = 'child'; render(); }; });
  }

  window.addEventListener('tp:sync', function () { var h = host(); if (h && h.classList.contains('active')) { readInputs(); render(); } });
  window.addEventListener('tp:reset', function () { pupilId = null; draft = null; flash = ''; undoId = null; var h = host(); if (h) h.innerHTML = ''; });

  window.rdRender = render;
  /* pure parts, for tests */
  window.RD = { KEY: KEY, STEPS: STEPS, BANDS: BANDS, FLU: FLU, SELF: SELF, COMP: COMP, sessionsFor: sessionsFor, recurring: recurring,
    classRows: classRows, daysSince: daysSince, toRecord: toRecord, splitWords: splitWords };
})();
