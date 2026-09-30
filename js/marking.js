/* ===================================================================
   marking.js — Markbook › Marking tab
   Recreates the "Marking" design (Marking.dc.html handoff):
     • named sets of books (create / rename / remove)
     • dated activities listed against every pupil
     • two dates kept separate: date of work vs date marked (today)
     • per-pupil "mark today", met / not-met outcome, last-marked flag
     • sort by Name / Date marked / Met–not met
     • a reusable comment bank in a centred popup (search, favourites,
       recent, subject filter, usage counts, type-to-save, auto-capital
       + full stop on save)
   Stored under 'tp_marking' (per-class, cloud-synced like other features).
   Public entry point: window.mkRender() — called by the Markbook tab.
   =================================================================== */
(function () {
  var MK_KEY = 'tp_marking';
  var mk = null;                 // in-memory mirror of the store
  /* transient UI state (not persisted) */
  var ui = { manage: false, showActForm: false, newSet: '', newActTitle: '', newActDate: '',
             editingPupil: null, draft: '', bankFilter: 'subject', search: '' };

  /* ---------- helpers ---------- */
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fmt(iso) { if (!iso) return ''; var p = String(iso).split('-'); var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return (+p[2]) + ' ' + m[(+p[1]) - 1]; }
  function ini(name) { return String(name || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function uid(pfx) { mk.seq = (mk.seq || 100) + 1; return pfx + mk.seq + '_' + Math.random().toString(36).slice(2, 6); }
  function normalize(s) { s = (s || '').trim(); if (!s) return ''; s = s.charAt(0).toUpperCase() + s.slice(1); if (!/[.!?]$/.test(s)) s += '.'; return s; }
  function smartAppend(d, p) { d = (d || '').trim(); p = (p || '').trim(); if (!d) return normalize(p); if (!/[.!?]$/.test(d)) d += '.'; return normalize(d + ' ' + p); }
  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return; } } catch (e) {}
    try { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {}
  }
  var mkLastAuto = '';   // last auto-generated class summary (for the Rebuild button)

  /* Everything the class feedback sheet shows for one activity:
     outcomes (met / not met / marked with no outcome / not marked yet),
     markers, and the written comments grouped by js/feedback.js into
     "common feedback" (two or more children) and individual notes. */
  function sheetData(act) {
    var P = pupils(), mks = mk.marks[act.id] || {};
    var d = { met: [], not: [], noOutcome: [], unmarked: [], markers: [], themes: [], individual: [], metOf: {}, total: P.length };
    var markerMap = {}, items = [], byId = {};
    P.forEach(function (p) {
      var rec = mks[p.id] || {};
      byId[p.id] = p;
      d.metOf[p.id] = rec.met || null;
      if (rec.met === 'met') d.met.push(p);
      else if (rec.met === 'not') d.not.push(p);
      else if (rec.markedDate) d.noOutcome.push(p);
      else d.unmarked.push(p);
      (rec.markers || []).forEach(function (t) { (markerMap[t] || (markerMap[t] = [])).push(p); });
      if (rec.comment) items.push({ id: p.id, name: p.name, comment: rec.comment });
    });
    d.marked = P.length - d.unmarked.length;
    d.markers = Object.keys(markerMap).sort(function (a, b) { return markerMap[b].length - markerMap[a].length || a.localeCompare(b); })
      .map(function (t) { return { label: String(t).replace(/[.!?]+$/, ''), pupils: markerMap[t] }; });
    var g = window.mkFeedback ? window.mkFeedback.group(items) : { themes: [], individual: items.map(function (i) { return { id: i.id, text: i.comment }; }) };
    d.themes = g.themes.map(function (t) { return { label: t.label, examples: t.examples, pupils: t.ids.map(function (id) { return byId[id]; }) }; });
    d.individual = g.individual.map(function (x) { return { pupil: byId[x.id], text: x.text }; });
    return d;
  }
  function namesOf(list) { return list.map(function (p) { return p.name; }).join(', '); }
  function autoSummary(d) {
    var L = [];
    L.push('Met (' + d.met.length + '): ' + (namesOf(d.met) || '—'));
    L.push('Not met (' + d.not.length + '): ' + (namesOf(d.not) || '—'));
    if (d.noOutcome.length) L.push('Marked, no outcome (' + d.noOutcome.length + '): ' + namesOf(d.noOutcome));
    if (d.unmarked.length) L.push('Not marked yet (' + d.unmarked.length + '): ' + namesOf(d.unmarked));
    if (d.themes.length) { L.push(''); L.push('Common feedback:'); d.themes.forEach(function (t) { L.push('• ' + t.label + ' (' + t.pupils.length + '): ' + namesOf(t.pupils)); }); }
    if (d.markers.length) { L.push(''); L.push('Awards & markers:'); d.markers.forEach(function (m) { L.push('• ' + m.label + ' (' + m.pupils.length + '): ' + namesOf(m.pupils)); }); }
    if (d.individual.length) { L.push(''); L.push('Individual notes:'); d.individual.forEach(function (x) { L.push('• ' + x.pupil.name + ': ' + x.text); }); }
    return L.join('\n');
  }
  function pupils() { return (typeof sortedRoster === 'function') ? sortedRoster() : ((typeof roster !== 'undefined' && roster) ? roster.slice() : []); }

  /* ---------- store ---------- */
  function defaults() {
    return {
      sets: [
        { id: 's_maths', name: 'Maths' }, { id: 's_eng', name: 'English' },
        { id: 's_read', name: 'Reading Journal' }, { id: 's_topic', name: 'Topic' }
      ],
      activeSetId: 's_maths',
      activities: [],
      activeActivityId: null,
      marks: {},              // marks[activityId][pupilId] = { markedDate, met, comment }
      lastMarked: {},         // lastMarked[setId][pupilId] = iso
      bank: [
        { id: 'b1', text: 'Met the objective.', subject: 'General', fav: true, uses: 6 },
        { id: 'b2', text: 'Lovely clear method shown.', subject: 'Maths', fav: false, uses: 3 },
        { id: 'b3', text: 'Remember to line up the columns.', subject: 'Maths', fav: false, uses: 2 },
        { id: 'b4', text: 'Check your full stops.', subject: 'English', fav: false, uses: 4 },
        { id: 'b5', text: 'Lovely use of adjectives.', subject: 'English', fav: true, uses: 5 },
        { id: 'b6', text: 'Great effort today.', subject: 'General', fav: true, uses: 9 },
        { id: 'b7', text: 'Have another go at the tricky ones.', subject: 'General', fav: false, uses: 2 }
      ],
      sort: 'name', seq: 100,
      summaries: {},
      quickButtons: [
        { id: 'q1', text: 'Met the objective.' },
        { id: 'q2', text: 'Working towards it.' },
        { id: 'q3', text: 'Needs more practice.' },
        { id: 'q4', text: 'Excellent effort.' }
      ]
    };
  }
  function load() {
    var d = defaults();
    var s = (typeof Store !== 'undefined') ? Store.get(MK_KEY, null) : null;
    if (s && typeof s === 'object') {
      ['sets', 'activeSetId', 'activities', 'activeActivityId', 'marks', 'lastMarked', 'bank', 'sort', 'seq', 'quickButtons', 'summaries'].forEach(function (k) {
        if (s[k] !== undefined) d[k] = s[k];
      });
    }
    if (!Array.isArray(d.sets) || !d.sets.length) d.sets = defaults().sets;
    if (!d.sets.some(function (x) { return x.id === d.activeSetId; })) d.activeSetId = d.sets[0].id;
    mk = d;
    ensureActivity();
  }
  function save() {
    if (typeof Store !== 'undefined') Store.set(MK_KEY, mk);
    try { window.dispatchEvent(new CustomEvent('tp:sync', { detail: { key: MK_KEY, source: 'local' } })); } catch (e) {}
  }
  function activeSet() { return mk.sets.find(function (x) { return x.id === mk.activeSetId; }) || mk.sets[0] || null; }
  function setActivities() { return mk.activities.filter(function (a) { return a.setId === mk.activeSetId; }); }
  function ensureActivity() {
    var list = setActivities();
    if (!list.some(function (a) { return a.id === mk.activeActivityId; })) mk.activeActivityId = list.length ? list[0].id : null;
  }
  function activeActivity() { return mk.activities.find(function (a) { return a.id === mk.activeActivityId; }) || null; }

  /* reset hook — called by appResetState() after an account wipe */
  window.mkReset = function () { mk = null; load(); if (document.getElementById('mb-marking')) mkRender(); };

  /* expose marking writes for the Teach Quick Log ("Mark activity") flow */
  window.mkData = function () { return mk; };
  window.mkActivitiesForActiveSet = function () { load(); return setActivities().map(function (a) { return { id: a.id, title: a.title, workDate: a.workDate }; }); };
  window.mkBankForActiveSet = function () {
    load(); var set = activeSet(); var name = set ? set.name : '';
    return mk.bank.filter(function (b) { return b.subject === name || b.subject === 'General'; })
      .sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.uses || 0) - (a.uses || 0); })
      .slice(0, 6).map(function (b) { return b.text; });
  };
  /* Write a comment + mark today against an activity for one or many pupils.
     Used by the Teach Quick Log confirm screen. */
  window.mkLogActivity = function (activityId, pupilIds, comment) {
    load();
    var act = mk.activities.find(function (a) { return a.id === activityId; });
    if (!act) return null;
    var today = todayISO();
    var txt = normalize(comment);
    var m = mk.marks[activityId] || (mk.marks[activityId] = {});
    var L = mk.lastMarked[act.setId] || (mk.lastMarked[act.setId] = {});
    (pupilIds || []).forEach(function (pid) {
      var r = m[pid] || (m[pid] = {});
      if (txt) r.comment = txt;
      r.markedDate = today;
      L[pid] = today;
    });
    save();
    if (document.getElementById('mb-marking')) mkRender();
    return act.title;
  };

  /* ---------- toast ---------- */
  function toast(msg) {
    var el = document.getElementById('mkToast');
    if (!el) { el = document.createElement('div'); el.id = 'mkToast'; el.className = 'mk-toast'; document.body.appendChild(el); }
    el.textContent = '✓ ' + msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ===================================================================
     RENDER — Marking tab body
     =================================================================== */
  function mkRender() {
    var host = document.getElementById('mb-marking');
    if (!host) return;
    load();   // always read fresh — keeps in step with class switches & cloud sync

    var P = pupils();
    var set = activeSet();
    var setName = set ? set.name : '';

    /* --- sets bar --- */
    var setChips;
    if (ui.manage) {
      setChips = mk.sets.map(function (st) {
        return '<span class="mk-setedit">' +
          '<input class="mk-setname" data-rename="' + st.id + '" value="' + E(st.name) + '">' +
          '<button class="mk-setx" data-removeset="' + st.id + '" title="Remove set">✕</button></span>';
      }).join('');
    } else {
      setChips = mk.sets.map(function (st) {
        return '<button class="mk-set' + (st.id === mk.activeSetId ? ' active' : '') + '" data-set="' + st.id + '">' + E(st.name) + '</button>';
      }).join('');
    }
    var setsBar =
      '<div class="mk-bar">' +
        '<span class="mk-barlbl">SET OF BOOKS</span>' + setChips +
        '<span class="mk-newset">' +
          '<input class="mk-newsetin" id="mkNewSet" placeholder="New set…" value="' + E(ui.newSet) + '">' +
          '<button class="mk-newsetadd" id="mkAddSet">+</button></span>' +
        '<span class="mk-spacer"></span>' +
        '<button class="mk-dictbtn' + (ui.dictOpen ? ' on' : '') + (ui.dictListening ? ' live' : '') + '" id="mkDictBtn">' +
          (ui.dictListening ? '● Recording — stop' : '🎤 Dictate marking') + '</button>' +
        '<button class="secondary small" id="mkManage">' + (ui.manage ? '✓ Done' : 'Rename / remove') + '</button>' +
      '</div>';

    /* --- activities column --- */
    var acts = setActivities().map(function (a) {
      var mks = mk.marks[a.id] || {};
      var cnt = P.filter(function (p) { return mks[p.id] && mks[p.id].markedDate; }).length;
      var pct = P.length ? Math.round(cnt / P.length * 100) : 0;
      return '<div class="mk-act' + (a.id === mk.activeActivityId ? ' active' : '') + '" data-act="' + a.id + '">' +
        '<button class="mk-actx" data-removeact="' + a.id + '" title="Delete activity">✕</button>' +
        '<div class="mk-act-title">' + E(a.title) + '</div>' +
        '<div class="mk-act-date">work done · ' + E(fmt(a.workDate)) + '</div>' +
        '<div class="mk-prog"><span class="mk-prog-track"><span class="mk-prog-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="mk-prog-lbl">' + cnt + '/' + P.length + '</span></div>' +
      '</div>';
    }).join('');
    var actForm = ui.showActForm
      ? '<div class="mk-actform">' +
          '<input id="mkActTitle" class="mk-actform-in" placeholder="Title — e.g. Subtraction" value="' + E(ui.newActTitle) + '">' +
          '<div class="mk-actform-row"><span class="mk-actform-lbl">Date of work</span>' +
            '<input type="date" id="mkActDate" value="' + E(ui.newActDate || todayISO()) + '"></div>' +
          '<div class="mk-actform-btns"><button id="mkAddAct">Create</button>' +
            '<button class="secondary" id="mkActCancel">Cancel</button></div>' +
        '</div>'
      : '<button class="mk-addact" id="mkActOpen">+ New activity</button>';
    var activitiesCol =
      '<div class="mk-actcol card">' +
        '<div class="mk-actcol-head">' + E(setName) + ' — activities</div>' +
        acts + actForm +
      '</div>';

    /* --- marking list --- */
    var act = activeActivity();
    var listCol;
    if (act) {
      var mks = mk.marks[act.id] || {};
      var lm = mk.lastMarked[mk.activeSetId] || {};
      var today = todayISO();
      var markedCount = P.filter(function (p) { return mks[p.id] && mks[p.id].markedDate; }).length;

      var rows = P.map(function (p) {
        var rec = mks[p.id] || {};
        var marked = !!rec.markedDate;
        var last = lm[p.id] || null;
        var met = rec.met || null;
        var hasC = !!(rec.comment && rec.comment.length);
        return {
          p: p, marked: marked, last: last, met: met, hasC: hasC,
          _date: rec.markedDate || null, _metW: (met === 'not' ? 0 : (met == null ? 1 : 2)),
          comment: rec.comment || '', markers: rec.markers || []
        };
      });
      if (mk.sort === 'name') rows.sort(function (a, b) { return a.p.name.localeCompare(b.p.name); });
      else if (mk.sort === 'date') rows.sort(function (a, b) { if (!a._date && !b._date) return a.p.name.localeCompare(b.p.name); if (!a._date) return -1; if (!b._date) return 1; return a._date.localeCompare(b._date); });
      else if (mk.sort === 'met') rows.sort(function (a, b) { return a._metW - b._metW || a.p.name.localeCompare(b.p.name); });

      var rowsHTML = rows.map(function (r) {
        return '<div class="mk-row">' +
          '<span class="mk-ava">' + E(ini(r.p.name)) + '</span>' +
          '<span class="mk-name">' + E(r.p.name) + '</span>' +
          '<span class="mk-last' + (r.last ? '' : ' never') + '">' + (r.last ? E(fmt(r.last)) : 'never') + '</span>' +
          '<button class="mk-mark' + (r.marked ? ' on' : '') + '" data-mark="' + r.p.id + '">' + (r.marked ? '✓ ' + E(fmt(r._date)) : 'tap to mark') + '</button>' +
          '<span class="mk-met">' +
            '<button class="mk-met-y' + (r.met === 'met' ? ' on' : '') + '" data-met="' + r.p.id + '" title="Met">✓</button>' +
            '<button class="mk-met-n' + (r.met === 'not' ? ' on' : '') + '" data-not="' + r.p.id + '" title="Not met">✗</button>' +
          '</span>' +
          '<span class="mk-commentwrap">' +
            r.markers.map(function (mtxt) { return '<span class="mk-mk">' + E(mtxt) + '</span>'; }).join('') +
            '<button class="mk-comment' + (r.hasC ? ' has' : '') + '" data-comment="' + r.p.id + '">' + (r.hasC ? E(r.comment) : (r.markers.length ? '+ note' : '+ comment')) + '</button>' +
          '</span>' +
        '</div>';
      }).join('');

      function sortBtn(key, label) { return '<button class="mk-sortbtn' + (mk.sort === key ? ' on' : '') + '" data-sort="' + key + '">' + label + '</button>'; }

      listCol =
        '<div class="mk-list card">' +
          '<div class="mk-list-head"><span class="mk-list-title">' + E(act.title) + '</span>' +
            '<span class="mk-list-count">' + markedCount + '/' + P.length + ' marked</span>' +
            '<span class="mk-spacer"></span>' +
            '<button class="mk-fbtoggle" id="mkFbToggle">' + (ui.feedbackOpen ? '✕ Hide feedback sheet' : '📋 Class feedback sheet') + '</button></div>' +
          '<div class="mk-datepills">' +
            '<span class="mk-pill">Date of work <b>' + E(fmt(act.workDate)) + '</b></span>' +
            '<span class="mk-pill marked">Date marked <b>today · ' + E(fmt(today)) + '</b></span>' +
          '</div>' +
          '<div class="mk-sortbar"><span class="mk-sortlbl">Sort by</span>' +
            sortBtn('name', 'Name A–Z') + sortBtn('date', 'Date marked') + sortBtn('met', 'Met / not met') +
          '</div>' +
          '<div class="mk-table">' +
            '<div class="mk-thead"><span class="mk-ava"></span><span class="mk-name">Pupil</span>' +
              '<span class="mk-last">Last</span><span class="mk-mark">Mark</span>' +
              '<span class="mk-met">Met?</span><span class="mk-comment">Comment</span></div>' +
            (P.length ? rowsHTML : '<div class="mk-empty">No pupils yet. Add your class in Plan › Pupils › Manage class.</div>') +
          '</div>' +
        '</div>';
    } else {
      listCol = '<div class="mk-list card"><div class="mk-empty big">No activity selected. Create one on the left to start marking.</div></div>';
    }

    var feedback = (act && ui.feedbackOpen) ? buildFeedback(act) : '';
    host.innerHTML = setsBar + (ui.dictOpen ? '<div id="mkDict"></div>' : '') +
      '<div class="mk-cols">' + activitiesCol + listCol + '</div>' + feedback;
    wire(host);
    if (ui.dictOpen) renderDict();
  }
  window.mkRender = mkRender;

  /* ---------- class feedback sheet ---------- */
  function chipsHTML(list, d) {
    return list.length
      ? list.map(function (p) {
          var m = d.metOf[p.id];
          return '<span class="mk-sh-name' + (m === 'met' ? ' met' : m === 'not' ? ' not' : '') + '">' +
            (m === 'met' ? '✓ ' : m === 'not' ? '✗ ' : '') + E(p.name) + '</span>';
        }).join('')
      : '<span class="mk-sh-none">—</span>';
  }
  /* one HTML body for the screen and the printout */
  function sheetBody(act, d, summary) {
    var set = mk.sets.find(function (x) { return x.id === act.setId; });
    function box(cls, label, list) {
      return '<div class="mk-sh-box ' + cls + '"><div class="mk-sh-boxhead">' + label + ' <b>' + list.length + '</b></div>' +
        '<div class="mk-sh-names">' + chipsHTML(list, { metOf: {} }) + '</div></div>';
    }
    var outcomes = '<div class="mk-sh-outcomes">' +
      box('met', '✓ Met', d.met) + box('not', '✗ Not met', d.not) +
      (d.noOutcome.length ? box('none', 'Marked, no outcome', d.noOutcome) : '') +
      (d.unmarked.length ? box('todo', 'Not marked yet', d.unmarked) : '') + '</div>';
    var themes = d.themes.length
      ? d.themes.map(function (t, i) {
          return '<div class="mk-sh-theme"><div class="mk-sh-themehead"><span class="mk-sh-themelabel">' + E(t.label) + '</span>' +
              '<span class="mk-sh-count">' + t.pupils.length + ' children</span></div>' +
            '<div class="mk-sh-names">' + chipsHTML(t.pupils, d) + '</div>' +
            (t.examples.length > 1 ? '<details class="mk-sh-said"><summary>How it was worded</summary>' +
              t.examples.map(function (x) { return '<div>“' + E(x) + '”</div>'; }).join('') + '</details>' : '') +
          '</div>';
        }).join('')
      : '<div class="mk-sh-empty">No shared feedback yet — it appears here once two or more children have a similar comment.</div>';
    var markers = d.markers.length
      ? d.markers.map(function (m) { return '<div class="mk-sh-row"><span class="mk-sh-rowlabel">' + E(m.label) + '</span><div class="mk-sh-names">' + chipsHTML(m.pupils, d) + '</div></div>'; }).join('')
      : '';
    var indiv = d.individual.length
      ? d.individual.map(function (x) { return '<div class="mk-sh-row"><span class="mk-sh-rowlabel">' + chipsHTML([x.pupil], d) + '</span><span class="mk-sh-note">' + E(x.text) + '</span></div>'; }).join('')
      : '';
    return '<div class="mk-sh-title">Class feedback · ' + E(act.title) + '</div>' +
      '<div class="mk-sh-sub">' + E(set ? set.name : '') + ' · work done ' + E(fmt(act.workDate)) + ' · ' + d.marked + ' of ' + d.total + ' books marked</div>' +
      '<div class="mk-sh-h">Outcomes</div>' + outcomes +
      '<div class="mk-sh-h">Common feedback <span class="mk-sh-hint">similar comments grouped</span></div>' + themes +
      (markers ? '<div class="mk-sh-h">Awards &amp; markers</div>' + markers : '') +
      (indiv ? '<div class="mk-sh-h">Individual notes</div>' + indiv : '') +
      (summary ? '<div class="mk-sh-h">Class summary</div><div class="mk-sh-summary">' + E(summary) + '</div>' : '');
  }
  function buildFeedback(act) {
    var d = sheetData(act);
    mkLastAuto = autoSummary(d);
    if (ui.summaryActId !== act.id) { ui.summaryActId = act.id; ui.summaryDraft = (mk.summaries && mk.summaries[act.id]) || ''; }
    return '<div class="mk-fbpanel mk-sheet card" id="mkSheet">' +
      '<div class="mk-fbhead"><span class="mk-sh-kicker">📋 Class feedback sheet</span><span class="mk-spacer"></span>' +
        '<button id="mkFbPrint">🖨 Print</button>' +
        '<button class="secondary" id="mkFbCopy">Copy as text</button>' +
        '<button class="mk-modal-x" id="mkFbClose" title="Close">✕</button></div>' +
      sheetBody(act, d, '') +
      '<div class="mk-sh-h">Class summary <span class="mk-sh-hint">optional — printed with the sheet</span>' +
        '<button class="mk-fblink" id="mkFbRebuild">↻ Fill in from the sheet</button></div>' +
      '<textarea id="mkSummary" class="mk-fbsummary" placeholder="Anything to say to the whole class, or a note for yourself. ↻ fills it in from the sheet above.">' + E(ui.summaryDraft) + '</textarea>' +
      '<div class="mk-fbbtns"><button class="secondary" id="mkFbSave">Save summary</button></div>' +
    '</div>';
  }
  function printSheet(act) {
    var c = document.getElementById('starterPrint');
    if (!c) { toast('Printing isn’t available here'); return; }
    var d = sheetData(act);
    c.innerHTML = '<div class="mk-sheet mk-sheet-print">' + sheetBody(act, d, ui.summaryActId === act.id ? ui.summaryDraft : (mk.summaries || {})[act.id]) + '</div>';
    window.print();   // hub.js empties #starterPrint on afterprint
  }
  function openSheet() {
    if (!activeActivity()) { toast('Pick an activity first'); return; }
    ui.feedbackOpen = true; mkRender();
    var el = document.getElementById('mkSheet');
    if (el && el.scrollIntoView) try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }

  /* ---------- event wiring ---------- */
  function wire(host) {
    /* sets */
    host.querySelectorAll('[data-set]').forEach(function (b) {
      b.onclick = function () {
        mk.activeSetId = b.dataset.set; ui.editingPupil = null; ensureActivity(); save(); mkRender();
      };
    });
    host.querySelectorAll('[data-rename]').forEach(function (inp) {
      inp.onchange = function () { var t = mk.sets.find(function (x) { return x.id === inp.dataset.rename; }); if (t) { t.name = inp.value.trim() || t.name; save(); } };
    });
    host.querySelectorAll('[data-removeset]').forEach(function (b) {
      b.onclick = function () {
        if (mk.sets.length <= 1) { toast('Keep at least one set'); return; }
        var id = b.dataset.removeset;
        mk.sets = mk.sets.filter(function (x) { return x.id !== id; });
        mk.activities = mk.activities.filter(function (a) { return a.setId !== id; });
        if (mk.activeSetId === id) { mk.activeSetId = mk.sets[0].id; ensureActivity(); }
        save(); mkRender();
      };
    });
    var ns = host.querySelector('#mkNewSet');
    if (ns) ns.oninput = function () { ui.newSet = ns.value; };
    var addSet = host.querySelector('#mkAddSet');
    if (addSet) addSet.onclick = function () {
      var v = (ui.newSet || '').trim(); if (!v) return;
      var id = uid('s'); mk.sets.push({ id: id, name: v }); mk.activeSetId = id; mk.activeActivityId = null;
      ui.newSet = ''; save(); mkRender();
    };
    if (ns) ns.onkeydown = function (e) { if (e.key === 'Enter' && addSet) addSet.click(); };
    var dictBtn = host.querySelector('#mkDictBtn');
    if (dictBtn) dictBtn.onclick = function () {
      if (ui.dictOpen && ui.dictListening) { stopRecording(); return; }   // "● Recording" stops, and Claude takes over
      ui.dictOpen = !ui.dictOpen;
      mkRender();
    };
    var manage = host.querySelector('#mkManage');
    if (manage) manage.onclick = function () { ui.manage = !ui.manage; mkRender(); };

    /* activities */
    host.querySelectorAll('[data-act]').forEach(function (c) {
      c.onclick = function () { mk.activeActivityId = c.dataset.act; ui.editingPupil = null; save(); mkRender(); };
    });
    host.querySelectorAll('[data-removeact]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); var id = b.dataset.removeact;
        mk.activities = mk.activities.filter(function (x) { return x.id !== id; });
        delete mk.marks[id];
        if (mk.activeActivityId === id) ensureActivity();
        save(); mkRender();
      };
    });
    var actOpen = host.querySelector('#mkActOpen');
    if (actOpen) actOpen.onclick = function () { ui.showActForm = true; ui.newActDate = ui.newActDate || todayISO(); mkRender(); };
    var actCancel = host.querySelector('#mkActCancel');
    if (actCancel) actCancel.onclick = function () { ui.showActForm = false; ui.newActTitle = ''; mkRender(); };
    var actTitle = host.querySelector('#mkActTitle');
    if (actTitle) { actTitle.oninput = function () { ui.newActTitle = actTitle.value; }; setTimeout(function () { try { actTitle.focus(); } catch (e) {} }, 0); }
    var actDate = host.querySelector('#mkActDate');
    if (actDate) actDate.onchange = function () { ui.newActDate = actDate.value; };
    var addAct = host.querySelector('#mkAddAct');
    if (addAct) addAct.onclick = function () {
      var v = (ui.newActTitle || '').trim(); if (!v) { toast('Give the activity a title'); return; }
      var id = uid('a');
      mk.activities.push({ id: id, setId: mk.activeSetId, title: v, workDate: ui.newActDate || todayISO() });
      mk.activeActivityId = id; ui.newActTitle = ''; ui.showActForm = false;
      save(); mkRender();
    };
    if (actTitle) actTitle.onkeydown = function (e) { if (e.key === 'Enter' && addAct) addAct.click(); };

    /* marking rows */
    host.querySelectorAll('[data-mark]').forEach(function (b) { b.onclick = function () { markToggle(b.dataset.mark); }; });
    host.querySelectorAll('[data-met]').forEach(function (b) { b.onclick = function () { setMet(b.dataset.met, 'met'); }; });
    host.querySelectorAll('[data-not]').forEach(function (b) { b.onclick = function () { setMet(b.dataset.not, 'not'); }; });
    host.querySelectorAll('[data-comment]').forEach(function (b) { b.onclick = function () { openEditor(b.dataset.comment); }; });
    host.querySelectorAll('[data-sort]').forEach(function (b) { b.onclick = function () { mk.sort = b.dataset.sort; save(); mkRender(); }; });

    /* class feedback sheet */
    var fbT = host.querySelector('#mkFbToggle');
    if (fbT) fbT.onclick = function () { if (ui.feedbackOpen) { ui.feedbackOpen = false; mkRender(); } else openSheet(); };
    var fbC = host.querySelector('#mkFbClose');
    if (fbC) fbC.onclick = function () { ui.feedbackOpen = false; mkRender(); };
    var sumTa = host.querySelector('#mkSummary');
    if (sumTa) sumTa.oninput = function () { ui.summaryDraft = sumTa.value; };
    var fbR = host.querySelector('#mkFbRebuild');
    if (fbR) fbR.onclick = function () { ui.summaryDraft = mkLastAuto; if (sumTa) sumTa.value = mkLastAuto; };
    var fbS = host.querySelector('#mkFbSave');
    if (fbS) fbS.onclick = function () { if (!mk.summaries) mk.summaries = {}; mk.summaries[ui.summaryActId] = ui.summaryDraft; save(); toast('Class summary saved'); };
    var fbCopy = host.querySelector('#mkFbCopy');
    if (fbCopy) fbCopy.onclick = function () {
      var act = activeActivity(); if (!act) return;
      copyText(act.title + '\n\n' + mkLastAuto + (ui.summaryDraft ? '\n\nClass summary:\n' + ui.summaryDraft : ''));
      toast('Feedback sheet copied');
    };
    var fbP = host.querySelector('#mkFbPrint');
    if (fbP) fbP.onclick = function () { var act = activeActivity(); if (act) printSheet(act); };
  }

  function markToggle(pid) {
    var act = activeActivity(); if (!act) return;
    var today = todayISO();
    var m = mk.marks[act.id] || (mk.marks[act.id] = {});
    var r = m[pid] || (m[pid] = {});
    if (r.markedDate) { r.markedDate = null; }
    else { r.markedDate = today; var L = mk.lastMarked[mk.activeSetId] || (mk.lastMarked[mk.activeSetId] = {}); L[pid] = today; }
    save(); mkRender();
  }
  function setMet(pid, val) {
    var act = activeActivity(); if (!act) return;
    var today = todayISO();
    var m = mk.marks[act.id] || (mk.marks[act.id] = {});
    var r = m[pid] || (m[pid] = {});
    r.met = (r.met === val ? null : val);
    if (r.met && !r.markedDate) { r.markedDate = today; var L = mk.lastMarked[mk.activeSetId] || (mk.lastMarked[mk.activeSetId] = {}); L[pid] = today; }
    save(); mkRender();
  }

  /* ===================================================================
     COMMENT EDITOR — centred popup over the page (no scroll jump)
     =================================================================== */
  function openEditor(pid) {
    var act = activeActivity(); if (!act) return;
    var rec = (mk.marks[act.id] || {})[pid] || {};
    ui.editingPupil = pid; ui.draft = rec.comment || ''; ui.bankFilter = 'subject'; ui.search = '';
    renderEditor();
  }
  function closeEditor() {
    ui.editingPupil = null; ui.draft = '';
    var bd = document.getElementById('mkBack'); if (bd) bd.remove();
  }
  function bankList() {
    var set = activeSet(); var name = set ? set.name : '';
    var q = (ui.search || '').toLowerCase();
    var list = mk.bank.slice();
    if (q) list = list.filter(function (b) { return b.text.toLowerCase().indexOf(q) >= 0; });
    else if (ui.bankFilter === 'fav') list = list.filter(function (b) { return b.fav; });
    else if (ui.bankFilter === 'recent') list = list.slice().sort(function (a, b) { return (b.uses || 0) - (a.uses || 0); }).slice(0, 6);
    else if (ui.bankFilter === 'subject') list = list.filter(function (b) { return b.subject === name || b.subject === 'General'; });
    if (!q && (ui.bankFilter === 'all' || ui.bankFilter === 'subject')) list.sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.uses || 0) - (a.uses || 0); });
    return list;
  }
  function renderBank() {
    var wrap = document.getElementById('mkBankList'); if (!wrap) return;
    var list = bankList();
    wrap.innerHTML = list.length ? list.map(function (b) {
      return '<div class="mk-bankrow" data-insert="' + b.id + '">' +
        '<button class="mk-fav' + (b.fav ? ' on' : '') + '" data-fav="' + b.id + '">' + (b.fav ? '★' : '☆') + '</button>' +
        '<span class="mk-banktext">' + E(b.text) + '</span>' +
        '<span class="mk-bankuses">' + (b.uses || 0) + '×</span></div>';
    }).join('') : '<div class="mk-empty">No matches — type above, then “Save to my bank”.</div>';
    wrap.querySelectorAll('[data-insert]').forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest('[data-fav]')) return;
        var b = mk.bank.find(function (x) { return x.id === row.dataset.insert; }); if (!b) return;
        ui.draft = smartAppend(ui.draft, b.text); b.uses = (b.uses || 0) + 1;
        var ta = document.getElementById('mkDraft'); if (ta) ta.value = ui.draft;
        save(); renderBank();
      };
    });
    wrap.querySelectorAll('[data-fav]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var t = mk.bank.find(function (x) { return x.id === b.dataset.fav; }); if (t) t.fav = !t.fav;
        save(); renderBank();
      };
    });
  }
  function renderEditor() {
    var act = activeActivity();
    var p = pupils().find(function (x) { return x.id === ui.editingPupil; });
    if (!act || !p) return;
    var set = activeSet(); var setName = set ? set.name : '';
    var tabs = [['all', 'All'], ['fav', '★ Fav'], ['recent', 'Recent'], ['subject', setName || 'Subject']].map(function (t) {
      return '<button class="mk-banktab' + (ui.bankFilter === t[0] && !ui.search ? ' on' : '') + '" data-banktab="' + t[0] + '">' + E(t[1]) + '</button>';
    }).join('');

    /* permanent customisable quick markers (defined by the teacher).
       Tapping one toggles that marker on the child for this activity. */
    var qb = mk.quickButtons || [];
    var appliedMarkers = ((mk.marks[act.id] || {})[ui.editingPupil] || {}).markers || [];
    var qbHTML;
    if (ui.qbEdit) {
      qbHTML = qb.map(function (b) {
        return '<span class="mk-qbedit"><input class="mk-qbname" data-qbrename="' + b.id + '" value="' + E(b.text) + '">' +
          '<button class="mk-setx" data-qbremove="' + b.id + '" title="Remove marker">✕</button></span>';
      }).join('') +
        '<span class="mk-newset"><input class="mk-newsetin" id="mkQbNew" placeholder="New marker…">' +
        '<button class="mk-newsetadd" id="mkQbAdd">+</button></span>';
    } else {
      qbHTML = qb.length
        ? qb.map(function (b) { var on = appliedMarkers.indexOf(b.text) >= 0; return '<button class="mk-qbtn' + (on ? ' on' : '') + '" data-qbins="' + b.id + '">' + (on ? '✓ ' : '') + E(b.text) + '</button>'; }).join('')
        : '<span class="mk-qbempty">No quick markers yet — add your own →</span>';
    }
    var qbRow =
      '<div class="mk-qbrow"><span class="mk-qblbl">Quick markers</span>' + qbHTML +
        '<span class="mk-spacer"></span>' +
        '<button class="mk-qbtoggle" id="mkQbEdit">' + (ui.qbEdit ? '✓ Done' : '✎ Edit') + '</button></div>';

    var old = document.getElementById('mkBack'); if (old) old.remove();
    var bd = document.createElement('div');
    bd.className = 'mk-back'; bd.id = 'mkBack';
    bd.innerHTML =
      '<div class="mk-modal" id="mkModal">' +
        '<div class="mk-modal-head"><span class="mk-modal-title">Comment · ' + E(p.name) + '</span>' +
          '<span class="mk-modal-ctx">' + E(setName + ' · ' + act.title) + '</span><span class="mk-spacer"></span>' +
          '<button class="mk-modal-x" id="mkEditClose">✕</button></div>' +
        qbRow +
        '<textarea id="mkDraft" class="mk-draft" placeholder="Type a comment… (auto-capital + full stop on save)">' + E(ui.draft) + '</textarea>' +
        '<button class="mk-savebank" id="mkSaveBank">+ Save this phrase to my bank</button>' +
        '<div class="mk-bankhead"><span>Insert from your bank</span><span class="mk-hr"></span></div>' +
        '<div class="mk-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#99a1ab" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>' +
          '<input id="mkSearch" placeholder="search phrases…" value="' + E(ui.search) + '"></div>' +
        '<div class="mk-banktabs">' + tabs + '</div>' +
        '<div class="mk-banklist" id="mkBankList"></div>' +
        '<div class="mk-modal-btns"><button id="mkSaveComment">Save comment &amp; mark today</button>' +
          '<button class="secondary" id="mkEditCancel">Cancel</button></div>' +
      '</div>';
    document.body.appendChild(bd);
    renderBank();

    /* quick markers: tapping toggles the marker on the child (saved + stamped
       today), not the comment text; ✎ Edit toggles add / rename / remove */
    bd.querySelectorAll('[data-qbins]').forEach(function (b) {
      b.onclick = function () {
        var act2 = activeActivity(); if (!act2 || !ui.editingPupil) return;
        var t = (mk.quickButtons || []).find(function (x) { return x.id === b.dataset.qbins; });
        if (!t) return;
        var today = todayISO();
        var m = mk.marks[act2.id] || (mk.marks[act2.id] = {});
        var r = m[ui.editingPupil] || (m[ui.editingPupil] = {});
        if (!r.markers) r.markers = [];
        var i = r.markers.indexOf(t.text);
        var removing = i >= 0;
        if (removing) { r.markers.splice(i, 1); }
        else {
          r.markers.push(t.text);
          if (!r.markedDate) { r.markedDate = today; var L = mk.lastMarked[mk.activeSetId] || (mk.lastMarked[mk.activeSetId] = {}); L[ui.editingPupil] = today; }
        }
        save(); mkRender(); renderEditor();
        toast(removing ? 'Marker removed' : 'Marker added · marked today');
      };
    });
    var qbEditBtn = document.getElementById('mkQbEdit');
    if (qbEditBtn) qbEditBtn.onclick = function () { ui.qbEdit = !ui.qbEdit; renderEditor(); };
    bd.querySelectorAll('[data-qbrename]').forEach(function (inp) {
      inp.onchange = function () { var t = (mk.quickButtons || []).find(function (x) { return x.id === inp.dataset.qbrename; }); if (t) { t.text = inp.value.trim() || t.text; save(); } };
    });
    bd.querySelectorAll('[data-qbremove]').forEach(function (b) {
      b.onclick = function () { mk.quickButtons = (mk.quickButtons || []).filter(function (x) { return x.id !== b.dataset.qbremove; }); save(); renderEditor(); };
    });
    var qbNew = document.getElementById('mkQbNew');
    var qbAdd = document.getElementById('mkQbAdd');
    if (qbAdd) qbAdd.onclick = function () {
      var v = (qbNew && qbNew.value || '').trim(); if (!v) return;
      if (!mk.quickButtons) mk.quickButtons = [];
      mk.quickButtons.push({ id: uid('q'), text: v });
      save(); renderEditor();
    };
    if (qbNew) qbNew.onkeydown = function (e) { if (e.key === 'Enter' && qbAdd) qbAdd.click(); };

    bd.addEventListener('click', function (e) { if (e.target === bd) closeEditor(); });
    document.getElementById('mkEditClose').onclick = closeEditor;
    document.getElementById('mkEditCancel').onclick = closeEditor;
    var ta = document.getElementById('mkDraft');
    ta.oninput = function () { ui.draft = ta.value; };
    setTimeout(function () { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }, 0);
    var sr = document.getElementById('mkSearch');
    sr.oninput = function () { ui.search = sr.value; renderBank(); };
    bd.querySelectorAll('[data-banktab]').forEach(function (b) {
      b.onclick = function () { ui.bankFilter = b.dataset.banktab; ui.search = ''; if (sr) sr.value = ''; refreshTabs(); renderBank(); };
    });
    document.getElementById('mkSaveBank').onclick = function () {
      var txt = normalize(ui.draft); if (!txt) { toast('Type a phrase first'); return; }
      if (mk.bank.some(function (b) { return b.text.toLowerCase() === txt.toLowerCase(); })) { toast('Already in your bank'); return; }
      mk.bank.push({ id: uid('b'), text: txt, subject: setName, fav: false, uses: 1 });
      save(); renderBank(); toast('Saved to your bank');
    };
    document.getElementById('mkSaveComment').onclick = function () {
      var act2 = activeActivity(); if (!act2 || !ui.editingPupil) return;
      var txt = normalize(ui.draft);
      var today = todayISO();
      var m = mk.marks[act2.id] || (mk.marks[act2.id] = {});
      var r = m[ui.editingPupil] || (m[ui.editingPupil] = {});
      r.comment = txt;
      if (!r.markedDate) { r.markedDate = today; var L = mk.lastMarked[mk.activeSetId] || (mk.lastMarked[mk.activeSetId] = {}); L[ui.editingPupil] = today; }
      save(); closeEditor(); mkRender(); toast('Comment saved · marked today');
    };
  }
  function refreshTabs() {
    var bd = document.getElementById('mkBack'); if (!bd) return;
    bd.querySelectorAll('[data-banktab]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.banktab === ui.bankFilter && !ui.search);
    });
  }

  /* ===================================================================
     DICTATE — record, stop, and Claude fills in the table
     Nothing is worked out while the teacher talks. The box only records:
       tap Start (browsers insist on that one tap), talk through the whole
       set — "create new maths activity called partitioning on 25/9 …
       Aurora … not met … next pupil Zoey …" — then tap Stop or say
       "finished marking".
     At Stop the whole recording goes to Claude (server.js /api/dictate)
     with the class list, the sets, the activities and the teacher's
     markers, plus the recogniser's OTHER guesses for every phrase. Speech
     recognition mishears names and marking vocabulary; the alternatives
     and the class list are what let Claude work out "so we" → Zoey and
     "tennis numeral" → "tens as a numeral". It fills in the table
     straight away and lists what it had to guess, with one Undo.
     When Claude isn't available (not signed in, or not set up on the
     server) the on-device reader in js/dictate.js does the same job, less
     well with names.
     Writes the same tp_marking records as tapping the rows.
     =================================================================== */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var rec = null, interim = '', recEnding = false;
  /* phase: idle → recording → stopping → working → idle (with a result) */
  var dict = { phase: 'idle', segments: [], edited: false, startedAt: 0, timer: null, smartAvail: null, result: null };
  ui.dictText = '';

  function dictCtx() {
    return {
      pupils: pupils().map(function (p) { return { id: p.id, name: p.name }; }),
      sets: mk.sets.map(function (s) { return { id: s.id, name: s.name }; }),
      activities: mk.activities.map(function (a) { return { id: a.id, setId: a.setId, title: a.title, workDate: a.workDate }; }),
      markers: (mk.quickButtons || []).map(function (q) { return q.text; }),
      activeSetId: mk.activeSetId, activeActivityId: mk.activeActivityId, today: todayISO()
    };
  }
  function pupilName(id) { var p = pupils().find(function (x) { return x.id === id; }); return p ? p.name : ''; }
  function setName(id) { var s = mk.sets.find(function (x) { return x.id === id; }); return s ? s.name : ''; }

  function speak(text) {
    var synth = window.speechSynthesis;
    if (!synth || !text) return;
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 1.05;
      var v = (synth.getVoices() || []).find(function (x) { return /^en-GB/i.test(x.lang); }); if (v) u.voice = v;
      synth.cancel(); synth.speak(u);
    } catch (e) {}
  }

  /* ---------- recording ---------- */
  function startRecording() {
    if (dict.phase === 'working') return;
    if (!SR) {
      toast('This browser can’t record — tap in the box and use your keyboard’s 🎤, then “Fill in the table”');
      var ta = document.getElementById('mkDictText'); if (ta) ta.focus();
      return;
    }
    checkSmart();
    if (dict.edited) { dict.segments = []; dict.edited = false; }   // typed text has no alternatives
    dict.phase = 'recording'; dict.startedAt = Date.now(); ui.dictListening = true;
    clearInterval(dict.timer);
    dict.timer = setInterval(function () { var t = document.getElementById('mkDictClock'); if (t) t.textContent = clock(); }, 1000);
    mkRender();
    startEngine();
  }
  function clock() { var s = Math.floor((Date.now() - dict.startedAt) / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function startEngine() {
    if (!SR || rec || dict.phase !== 'recording') return;
    var r = new SR();
    r.lang = 'en-GB'; r.continuous = true; r.interimResults = true;
    r.maxAlternatives = 5;              // the other guesses go to Claude as evidence
    r.onresult = function (e) {
      interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) {
          var alts = [];
          for (var j = 0; j < res.length; j++) { var t = String(res[j].transcript || '').trim(); if (t && alts.indexOf(t) < 0) alts.push(t); }
          heard(alts);
        } else interim += res[0].transcript;
      }
      showLive();
    };
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        toast(e.error === 'audio-capture' ? 'No microphone found' : 'Microphone permission was refused — allow it in the browser to dictate');
        dict.phase = 'idle'; ui.dictListening = false; clearInterval(dict.timer); mkRender();
      }
    };
    r.onend = function () {
      rec = null; interim = '';
      if (dict.phase === 'recording') { setTimeout(startEngine, 150); return; }   // Chrome stops after a silence
      if (dict.phase === 'stopping') process();
    };
    rec = r;
    try { r.start(); } catch (e) { rec = null; }
  }
  /* one finished phrase, with the recogniser's alternatives */
  function heard(alts) {
    if (!alts.length) return;
    var c = window.mkDictate ? window.mkDictate.command(alts[0]) : null;
    var end = c && (c.cmd === 'finish' || c.cmd === 'stop' || c.cmd === 'save');
    var best = end ? c.rest : alts[0];
    if (best) {
      var cur = (ui.dictText || '').replace(/\s+$/, '');
      ui.dictText = cur ? cur + (/[.,;:!?]$/.test(cur) ? ' ' : '. ') + best : best;
      dict.segments.push({ best: best, alts: end ? [best] : alts });
    }
    if (end) stopRecording();
  }
  function showLive() {
    var ta = document.getElementById('mkDictText');
    if (ta) { ta.value = ui.dictText + (interim ? (ui.dictText ? ' ' : '') + interim : ''); ta.scrollTop = ta.scrollHeight; }
  }
  function stopRecording() {
    if (dict.phase !== 'recording') return;
    dict.phase = 'stopping'; ui.dictListening = false; clearInterval(dict.timer);
    mkRender();
    if (rec) {
      try { rec.stop(); } catch (e) { rec = null; }
      /* stop() delivers the last phrase, then onend runs process(); don't wait forever */
      setTimeout(function () { if (dict.phase === 'stopping') { rec = null; process(); } }, 2500);
    }
    if (!rec) process();
  }

  /* ---------- Claude takes over ---------- */
  function process() {
    if (dict.phase === 'working') return;
    var text = (ui.dictText || '').trim();
    if (!text) { dict.phase = 'idle'; mkRender(); toast('Nothing was heard — try again a little closer to the microphone'); return; }
    load();
    dict.phase = 'working'; mkRender();
    var segs = dict.edited ? [] : dict.segments;
    checkSmart().then(function () {
      var viaClaude = smartReady();
      return (viaClaude ? smartParse(text, segs) : Promise.resolve(localParse(text)))
        .then(function (plan) { finish(plan, viaClaude, ''); })
        .catch(function (e) { finish(localParse(text), false, (e && e.userMessage) || 'Claude couldn’t be reached, so this device read your notes instead — check the names.'); });
    });
  }
  function localParse(text) {
    var plan = window.mkDictate.parse(text, dictCtx());
    plan.corrections = plan.entries.filter(function (e) { return e.pupilId && e.fuzzy; })
      .map(function (e) { return { heard: e.heard, meant: pupilName(e.pupilId) }; });
    plan.entries.forEach(function (e) { e.nameGuessed = !!e.fuzzy; });
    return plan;
  }
  function finish(plan, viaClaude, note) {
    var before = JSON.stringify(mk);
    var res = applyPlan(plan);
    dict.phase = 'idle';
    if (res.error) {
      dict.result = { error: res.error };
      mkRender(); speak(res.error); return;
    }
    dict.result = {
      actId: res.act.id, title: res.act.title, set: setName(res.act.setId), workDate: res.act.workDate,
      saved: res.saved, skipped: res.skipped, corrections: plan.corrections || [],
      warnings: (plan.warnings || []).concat((plan.unmatched || []).map(function (u) { return 'Not attached to a child: “' + u + '”'; })),
      viaClaude: viaClaude, note: note, transcript: ui.dictText, segments: dict.segments, undo: before
    };
    ui.dictText = ''; dict.segments = []; dict.edited = false;
    mkRender();
    var n = res.saved.length, check = dict.result.corrections.length + res.skipped.length;
    speak('Marked ' + n + (n === 1 ? ' book' : ' books') + ' for ' + res.act.title + '.' +
      (check ? ' ' + check + (check === 1 ? ' thing' : ' things') + ' to check on screen.' : ''));
  }
  function undoLast() {
    var r = dict.result; if (!r || !r.undo) return;
    if (typeof Store !== 'undefined') Store.set(MK_KEY, JSON.parse(r.undo));
    mk = null; load(); save();
    ui.dictText = r.transcript; dict.segments = r.segments || []; dict.edited = false;
    dict.result = null;
    mkRender();
    toast('Undone — your notes are back in the box');
  }
  /* a book Claude couldn't put a name to: the teacher picks the child */
  function assignSkipped(i, pupilId) {
    var r = dict.result; if (!r || !r.skipped[i] || !pupilId) return;
    var act = mk.activities.find(function (a) { return a.id === r.actId; }); if (!act) return;
    var e = r.skipped[i];
    var out = applyPlan({ activity: { mode: 'existing', id: act.id }, entries: [Object.assign({}, e, { pupilId: pupilId })] });
    if (out.error) { toast(out.error); return; }
    r.skipped.splice(i, 1);
    r.saved.push(Object.assign({}, e, { pupilId: pupilId }));
    mkRender();
  }

  /* ---------- saving ---------- */
  function applyPlan(plan) {
    load();
    var a = plan && plan.activity;
    if (!a) return { error: 'I couldn’t tell which activity this is. Pick one on the left, or start with “create new maths activity called …”, then try again.' };
    var act = null;
    if (a.mode === 'existing') act = mk.activities.find(function (x) { return x.id === a.id; });
    if (!act) {
      if (!a.title) return { error: 'I heard a new activity but no title. Say “… activity called …” and try again.' };
      var setId = a.setId && mk.sets.some(function (s) { return s.id === a.setId; }) ? a.setId : null;
      if (!setId && a.newSetName) {
        var ex = mk.sets.find(function (s) { return s.name.toLowerCase() === a.newSetName.toLowerCase(); });
        if (ex) setId = ex.id; else { setId = uid('s'); mk.sets.push({ id: setId, name: a.newSetName }); }
      }
      setId = setId || mk.activeSetId;
      act = mk.activities.find(function (x) { return x.setId === setId && x.title.toLowerCase() === a.title.toLowerCase() && x.workDate === a.workDate; });
      if (!act) { act = { id: uid('a'), setId: setId, title: a.title, workDate: a.workDate || todayISO() }; mk.activities.push(act); }
    }
    mk.activeSetId = act.setId; mk.activeActivityId = act.id;
    var today = todayISO();
    var m = mk.marks[act.id] || (mk.marks[act.id] = {});
    var L = mk.lastMarked[act.setId] || (mk.lastMarked[act.setId] = {});
    var saved = [], skipped = [];
    var known = {}; pupils().forEach(function (p) { known[p.id] = 1; });
    (plan.entries || []).forEach(function (e) {
      if (!e.pupilId || !known[e.pupilId]) { skipped.push(e); return; }
      var r = m[e.pupilId] || (m[e.pupilId] = {});
      if (e.met) r.met = e.met;
      (e.markers || []).forEach(function (t) {
        if (!r.markers) r.markers = [];
        if (r.markers.indexOf(t) < 0) r.markers.push(t);
        if (!mk.quickButtons) mk.quickButtons = [];
        if (!mk.quickButtons.some(function (q) { return q.text === t; })) mk.quickButtons.push({ id: uid('q'), text: t });
      });
      var c = normalize(e.comment || '');
      if (c) r.comment = !r.comment ? c : (r.comment.indexOf(c) >= 0 ? r.comment : smartAppend(r.comment, c));
      if (!r.markedDate) r.markedDate = today;
      L[e.pupilId] = today;
      saved.push(e);
    });
    save();
    return { act: act, saved: saved, skipped: skipped };
  }

  /* ---------- Claude (server.js /api/dictate) ---------- */
  function signedIn() { return !!(window.CLOUD && window.CLOUD.uid && window.firebase && window.firebase.auth); }
  function smartReady() { return !!dict.smartAvail && signedIn(); }
  function idToken() {
    try {
      var u = window.firebase.auth().currentUser;
      return u ? u.getIdToken() : Promise.reject(new Error('not signed in'));
    } catch (e) { return Promise.reject(e); }
  }
  /* asks the server once whether Claude is switched on; Stop waits for the answer */
  function checkSmart() {
    if (dict.smartCheck) return dict.smartCheck;
    if (!window.fetch || location.protocol === 'file:') { dict.smartAvail = false; return (dict.smartCheck = Promise.resolve(false)); }
    dict.smartCheck = fetch('api/dictate', { method: 'GET', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { dict.smartAvail = !!(j && j.enabled); var n = document.getElementById('mkDictVia'); if (n) n.innerHTML = viaLine(); return dict.smartAvail; })
      .catch(function () { dict.smartAvail = false; return false; });
    return dict.smartCheck;
  }
  function smartParse(text, segments) {
    var ctx = dictCtx();
    return idToken().then(function (token) { return fetch('api/dictate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ text: text, segments: segments || [], pupils: ctx.pupils, sets: ctx.sets, markers: ctx.markers, today: ctx.today,
        activeSetId: ctx.activeSetId, activeActivityId: ctx.activeActivityId, activities: ctx.activities.slice(-40) })
    }); }).then(function (r) {
      if (r.ok) return r.json();
      /* the server's own words for a refused sign-in or allow-list */
      return r.json().catch(function () { return {}; }).then(function (j) {
        var err = new Error('HTTP ' + r.status);
        if (j && j.error) err.userMessage = j.error + ' This device read your notes instead — check the names.';
        throw err;
      });
    }).then(function (j) {
      var o = j && j.plan; if (!o) throw new Error('no plan');
      var ids = {}; ctx.pupils.forEach(function (p) { ids[p.id] = 1; });
      var acts = {}; ctx.activities.forEach(function (a) { acts[a.id] = a; });
      var sets = {}; ctx.sets.forEach(function (s) { sets[s.id] = 1; });
      var a = o.activity || {}, activity = null;
      if (a.mode === 'existing' && acts[a.existingId]) { var x = acts[a.existingId]; activity = { mode: 'existing', id: x.id, setId: x.setId, title: x.title, workDate: x.workDate }; }
      else if (a.mode === 'new') activity = { mode: 'new', setId: sets[a.setId] ? a.setId : null, newSetName: sets[a.setId] ? '' : (a.newSetName || ''), title: a.title || '', workDate: /^\d{4}-\d\d-\d\d$/.test(a.workDate) ? a.workDate : ctx.today };
      else { var cur = acts[ctx.activeActivityId]; if (cur) activity = { mode: 'existing', id: cur.id, setId: cur.setId, title: cur.title, workDate: cur.workDate }; }
      return {
        activity: activity, unmatched: [], warnings: o.warnings || [],
        corrections: (o.corrections || []).filter(function (c) { return c && c.heard && c.meant && c.heard.toLowerCase() !== c.meant.toLowerCase(); }),
        entries: (o.entries || []).map(function (e) {
          return { pupilId: ids[e.pupilId] ? e.pupilId : null, heard: e.heard || '', nameGuessed: !!e.nameGuessed,
                   met: e.met === 'met' || e.met === 'not' ? e.met : null,
                   markers: (e.markers || []).filter(Boolean), comment: e.comment || '', raw: e.comment || '' };
        })
      };
    });
  }

  /* ---------- the panel ---------- */
  function viaLine() {
    if (smartReady()) return 'Claude reads your notes when you stop, and works out anything misheard.';
    if (dict.smartAvail && !signedIn()) return 'Sign in so Claude can read your notes — until then this device does it, and it is less accurate with names.';
    return 'This device reads your notes when you stop. It is less accurate with misheard names than Claude.';
  }
  function resultHTML() {
    var r = dict.result; if (!r) return '';
    if (r.error) return '<div class="mk-dictres bad"><b>Nothing was filled in.</b> ' + E(r.error) + '</div>';
    var opts = pupils();
    var check = '';
    if (r.corrections.length) {
      check += '<div class="mk-dictres-h">' + (r.viaClaude ? 'Claude’s guesses at what was misheard — check these' : 'Names matched by sound — check these') + '</div>' +
        '<div class="mk-dictfix">' + r.corrections.map(function (c) {
          return '<div><span class="mk-dictfix-heard">“' + E(c.heard) + '”</span> → <b>' + E(c.meant) + '</b></div>';
        }).join('') + '</div>';
    }
    if (r.skipped.length) {
      check += '<div class="mk-dictres-h">Whose book is this?</div>' + r.skipped.map(function (e, i) {
        return '<div class="mk-dictskip"><div><span class="mk-dictfix-heard">heard “' + E(e.heard || '?') + '”</span>' +
            (e.comment ? ' — ' + E(e.comment) : '') + '</div>' +
          '<select data-skip="' + i + '"><option value="">Choose the child…</option>' +
            opts.map(function (p) { return '<option value="' + E(p.id) + '">' + E(p.name) + '</option>'; }).join('') + '</select></div>';
      }).join('');
    }
    if (r.warnings.length) check += r.warnings.map(function (w) { return '<div class="mk-dictwarn">' + E(w) + '</div>'; }).join('');
    var rows = r.saved.map(function (e) {
      return '<span class="mk-sh-name' + (e.met === 'met' ? ' met' : e.met === 'not' ? ' not' : '') + (e.nameGuessed ? ' guessed' : '') + '"' +
        (e.nameGuessed ? ' title="Name worked out from “' + E(e.heard) + '”"' : '') + '>' +
        (e.met === 'met' ? '✓ ' : e.met === 'not' ? '✗ ' : '') + E(pupilName(e.pupilId)) + (e.nameGuessed ? ' ?' : '') + '</span>';
    }).join('');
    return '<div class="mk-dictres">' +
      '<div class="mk-dictres-top"><div><b>✓ ' + r.saved.length + (r.saved.length === 1 ? ' book' : ' books') + ' filled in</b> · ' +
          E(r.title) + ' <span class="mk-dictmsg-meta">' + E(r.set) + ' · work done ' + E(fmt(r.workDate)) + (r.viaClaude ? ' · read by Claude' : ' · read on this device') + '</span></div>' +
        '<span class="mk-spacer"></span><button class="secondary" id="mkDictUndo">↶ Undo</button>' +
        '<button id="mkDictSheet">📋 Class feedback sheet</button></div>' +
      (r.note ? '<div class="mk-dictwarn">' + E(r.note) + '</div>' : '') +
      '<div class="mk-sh-names">' + rows + '</div>' +
      check +
      '<details class="mk-dictheard-all"><summary>What was heard</summary><div>' + E(r.transcript) + '</div></details>' +
    '</div>';
  }
  function renderDict() {
    var host = document.getElementById('mkDict'); if (!host) return;
    checkSmart();
    var ph = dict.phase;
    host.className = 'mk-dict card' + (ph === 'recording' ? ' live' : '');
    var top;
    if (ph === 'recording') {
      top = '<div class="mk-dictstatus live"><span class="mk-dictdot"></span><div class="mk-dictstatus-t"><b>Recording</b> <span id="mkDictClock">' + clock() + '</span>' +
          '<div class="mk-dicthint">Talk through the books. Tap Stop or say “finished marking” when you’re done.</div></div>' +
        '<button class="mk-dictmic on" id="mkDictMic">■ Stop</button></div>';
    } else if (ph === 'stopping' || ph === 'working') {
      top = '<div class="mk-dictstatus"><span class="mk-dictspin"></span><div class="mk-dictstatus-t"><b>' +
        (smartReady() ? 'Claude is reading your notes and filling in the table…' : 'Reading your notes and filling in the table…') + '</b></div></div>';
    } else {
      top = '<div class="mk-dictstatus"><div class="mk-dictstatus-t"><b>' + (SR ? 'Press record and talk through the books.' : 'This browser can’t record.') + '</b>' +
          '<div class="mk-dicthint">' + (SR ? 'Start with the activity — “new maths activity called partitioning on 25/9” — then each child’s name and your notes.'
            : 'Tap in the box below and use your keyboard’s 🎤, then “Fill in the table”.') + '</div></div>' +
        (SR ? '<button class="mk-dictmic" id="mkDictMic">🎤 Record</button>' : '') + '</div>';
    }
    var busy = ph !== 'idle';
    host.innerHTML =
      '<div class="mk-dicthead"><span class="mk-dicttitle">🎤 Dictate marking</span><span class="mk-spacer"></span>' +
        '<button class="mk-modal-x" id="mkDictClose" title="Close">✕</button></div>' +
      top +
      '<textarea id="mkDictText" class="mk-dicttext" rows="' + (ph === 'recording' ? 5 : 3) + '"' + (busy ? ' readonly' : '') +
        ' placeholder="' + (SR ? 'What you say appears here. You can also type or paste notes.' : 'Type or dictate your notes here.') + '">' + E(ui.dictText) + '</textarea>' +
      (ph === 'idle' && (ui.dictText || '').trim() ? '<div class="mk-dictgo"><button id="mkDictGo">Fill in the table</button>' +
        '<button class="mk-fblink danger" id="mkDictClear">Clear</button></div>' : '') +
      '<div class="mk-dictvia" id="mkDictVia">' + viaLine() + '</div>' +
      resultHTML() +
      '<div class="mk-dictnote">Recording uses your browser’s speech recognition: Chrome and Edge send the audio to Google or Microsoft to turn it into text, so the names you say go with it; Safari on iPad and iPhone can do it on the device.' +
        (smartReady() ? ' Claude receives the text and your class list.' : '') + '</div>';
    wireDict(host);
    showLive();
  }
  function wireDict(host) {
    var x = host.querySelector('#mkDictClose');
    if (x) x.onclick = function () { if (dict.phase === 'recording') stopRecording(); ui.dictOpen = false; mkRender(); };
    var mic = host.querySelector('#mkDictMic'); if (mic) mic.onclick = function () { if (dict.phase === 'recording') stopRecording(); else startRecording(); };
    var ta = host.querySelector('#mkDictText');
    if (ta) ta.oninput = function () { if (dict.phase !== 'idle') return; ui.dictText = ta.value; dict.edited = true; var g = document.getElementById('mkDictGo'); if (!g && ta.value.trim()) renderDictKeepCaret(ta); };
    var go = host.querySelector('#mkDictGo'); if (go) go.onclick = function () { process(); };
    var cl = host.querySelector('#mkDictClear'); if (cl) cl.onclick = function () { ui.dictText = ''; dict.segments = []; dict.edited = false; mkRender(); };
    var un = host.querySelector('#mkDictUndo'); if (un) un.onclick = undoLast;
    var sh = host.querySelector('#mkDictSheet'); if (sh) sh.onclick = openSheet;
    host.querySelectorAll('[data-skip]').forEach(function (s) { s.onchange = function () { assignSkipped(+s.dataset.skip, s.value); }; });
  }
  /* typing into an empty box shows "Fill in the table" without losing the caret */
  function renderDictKeepCaret(ta) {
    var pos = ta.selectionStart; renderDict();
    var t = document.getElementById('mkDictText'); if (t) { t.focus(); try { t.setSelectionRange(pos, pos); } catch (e) {} }
  }

  /* Test / automation hooks: a finished phrase (with alternatives), stop, or text to read. */
  window.mkDictUtter = function (t, alts) {
    if (!ui.dictOpen) { ui.dictOpen = true; mkRender(); }
    if (dict.phase === 'idle') { dict.phase = 'recording'; dict.startedAt = Date.now(); ui.dictListening = true; mkRender(); }
    heard(alts && alts.length ? alts : [t]);
    showLive();
  };
  window.mkDictStop = function () { stopRecording(); };
  window.mkDictOpen = function (text) {
    ui.dictOpen = true; ui.dictText = text || ''; dict.segments = []; dict.edited = true; dict.result = null;
    if (document.getElementById('mb-marking')) mkRender();
  };
  window.mkDictProcess = function () { process(); };
  window.mkDictState = function () { return { phase: dict.phase, result: dict.result && { error: dict.result.error, saved: (dict.result.saved || []).length, skipped: (dict.result.skipped || []).length, corrections: dict.result.corrections, viaClaude: dict.result.viaClaude } }; };

  /* Siri / Shortcuts: index.html?dictate=<text>#markbook opens Marking with the
     text in the box; &save=1 fills in the table straight away. */
  function fromLink() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var text = q.get('dictate'); if (!text) return;
    var autosave = q.get('save') === '1';
    try { q.delete('dictate'); q.delete('save'); var rest = q.toString(); history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + '#markbook'); } catch (e) {}
    var tries = 0;
    (function go() {
      var tab = document.querySelector('#mbTabs [data-sub="mb-marking"]');
      if (!tab) { if (++tries < 50) setTimeout(go, 100); return; }
      if (typeof window.go === 'function') window.go('markbook');
      tab.click();
      window.mkDictOpen(text);
      if (autosave) process();
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(fromLink, 0); });
  else setTimeout(fromLink, 0);

  /* ---------- multi-device / cloud sync redraw ---------- */
  window.addEventListener('tp:sync', function (e) {
    var key = e && e.detail && e.detail.key;
    var base = (typeof tpKeyBase === 'function' && key) ? tpKeyBase(key) : key;
    if (e && e.detail && e.detail.source === 'local') return;     // our own write
    if (base && base !== MK_KEY && base !== 'tp_roster') return;   // unrelated change
    if (!document.getElementById('mb-marking')) { mk = null; return; }
    load();
    var sub = document.getElementById('mb-marking');
    if (sub && sub.classList.contains('active')) mkRender();
  });

  load();
})();
