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

  /* Roll every pupil's outcome / markers / comment for an activity into
     columns (label + the names underneath) plus grouped written comments. */
  function aggregate(act) {
    var P = pupils(), mks = mk.marks[act.id] || {};
    var metNames = [], notNames = [], markerMap = {}, commentMap = {};
    P.forEach(function (p) {
      var rec = mks[p.id] || {};
      if (rec.met === 'met') metNames.push(p.name);
      else if (rec.met === 'not') notNames.push(p.name);
      (rec.markers || []).forEach(function (t) { (markerMap[t] || (markerMap[t] = [])).push(p.name); });
      if (rec.comment) (commentMap[rec.comment] || (commentMap[rec.comment] = [])).push(p.name);
    });
    var cols = [];
    if (metNames.length) cols.push({ label: '✓ Met', cls: 'met', names: metNames });
    if (notNames.length) cols.push({ label: '✗ Not met', cls: 'not', names: notNames });
    Object.keys(markerMap).sort(function (a, b) { return markerMap[b].length - markerMap[a].length || a.localeCompare(b); })
      .forEach(function (t) { cols.push({ label: t, cls: 'mk', names: markerMap[t] }); });
    return { cols: cols, commentMap: commentMap };
  }
  function autoSummary(agg) {
    var lines = agg.cols.map(function (c) { return c.label.replace(/^[✓✗]\s*/, '') + ': ' + c.names.join(', '); });
    var ck = Object.keys(agg.commentMap);
    if (ck.length) { lines.push(''); lines.push('Comments:'); ck.forEach(function (t) { lines.push('“' + t + '” — ' + agg.commentMap[t].join(', ')); }); }
    return lines.join('\n');
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
          (ui.dictListening ? '● Listening' : '🎤 Dictate marking') + '</button>' +
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
            '<button class="mk-fbtoggle" id="mkFbToggle">' + (ui.feedbackOpen ? '✕ Hide feedback' : '📋 Class feedback') + '</button></div>' +
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

  /* ---------- whole-class feedback panel ---------- */
  function buildFeedback(act) {
    var agg = aggregate(act);
    mkLastAuto = autoSummary(agg);
    if (ui.summaryActId !== act.id) { ui.summaryActId = act.id; ui.summaryDraft = (mk.summaries && mk.summaries[act.id]) || mkLastAuto; }

    var colsHTML = agg.cols.length
      ? agg.cols.map(function (c) {
          return '<div class="mk-fbcol"><div class="mk-fbcol-head ' + c.cls + '">' + E(c.label) + ' <span class="mk-fbn">' + c.names.length + '</span></div>' +
            c.names.map(function (n) { return '<div class="mk-fbname">' + E(n) + '</div>'; }).join('') + '</div>';
        }).join('')
      : '<div class="mk-empty">No outcomes or markers recorded yet — mark some pupils to see them grouped here.</div>';

    var ck = Object.keys(agg.commentMap);
    var commentsHTML = ck.length
      ? ck.map(function (t) { return '<div class="mk-fbcomment"><div class="mk-fbctext">“' + E(t) + '”</div><div class="mk-fbcnames">' + E(agg.commentMap[t].join(', ')) + '</div></div>'; }).join('')
      : '<div class="mk-empty">No written comments yet.</div>';

    return '<div class="mk-fbpanel card">' +
      '<div class="mk-fbhead"><span class="mk-fbtitle">Whole-class feedback · ' + E(act.title) + '</span>' +
        '<span class="mk-spacer"></span><button class="mk-modal-x" id="mkFbClose">✕</button></div>' +
      '<div class="mk-fbsub">Markers &amp; outcomes</div>' +
      '<div class="mk-fbcols">' + colsHTML + '</div>' +
      '<div class="mk-fbsub">Written comments</div>' +
      '<div class="mk-fbcomments">' + commentsHTML + '</div>' +
      '<div class="mk-fbsub">Class summary <button class="mk-fblink" id="mkFbRebuild">↻ Rebuild from above</button></div>' +
      '<textarea id="mkSummary" class="mk-fbsummary" placeholder="A whole-class summary — auto-built from the markers, outcomes and comments above. Edit freely, then Save or Copy.">' + E(ui.summaryDraft) + '</textarea>' +
      '<div class="mk-fbbtns"><button id="mkFbSave">Save summary</button><button class="secondary" id="mkFbCopy">Copy</button></div>' +
    '</div>';
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
      if (ui.dictOpen && ui.dictListening) { stopListening(); return; }
      ui.dictOpen = !ui.dictOpen;
      if (!ui.dictOpen) stopListening(true);
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

    /* whole-class feedback panel */
    var fbT = host.querySelector('#mkFbToggle');
    if (fbT) fbT.onclick = function () { ui.feedbackOpen = !ui.feedbackOpen; mkRender(); };
    var fbC = host.querySelector('#mkFbClose');
    if (fbC) fbC.onclick = function () { ui.feedbackOpen = false; mkRender(); };
    var sumTa = host.querySelector('#mkSummary');
    if (sumTa) sumTa.oninput = function () { ui.summaryDraft = sumTa.value; };
    var fbR = host.querySelector('#mkFbRebuild');
    if (fbR) fbR.onclick = function () { ui.summaryDraft = mkLastAuto; if (sumTa) sumTa.value = mkLastAuto; };
    var fbS = host.querySelector('#mkFbSave');
    if (fbS) fbS.onclick = function () { if (!mk.summaries) mk.summaries = {}; mk.summaries[ui.summaryActId] = ui.summaryDraft; save(); toast('Class summary saved'); };
    var fbCopy = host.querySelector('#mkFbCopy');
    if (fbCopy) fbCopy.onclick = function () { copyText(ui.summaryDraft || ''); toast('Summary copied'); };
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
     DICTATE — mark a whole set of books by voice, hands-free
     One tap starts the microphone (browsers insist on that one). After
     it, everything is spoken:
        "create new maths activity called partitioning on 25/9"
        "Aurora answered most questions … not met"   "next pupil Zoey …"
        "scratch that"  "read back"  "save books"  "stop listening"
     The parser is js/dictate.js and runs on the device. Smart mode (off
     by default) asks Claude, through server.js, to read the note at save.
     Everything is written to the same tp_marking records the rows above
     use, so the tap-to-mark list and dictation stay one markbook.
     =================================================================== */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var rec = null, interim = '', recStopping = false;
  var dict = { utterances: [], spokenCount: 0, spokenAct: '', smartAvail: null, busy: false };
  ui.dictSpeak = true; ui.dictText = ''; ui.dictPlan = null; ui.dictLog = []; ui.dictFix = {};
  try { ui.dictSmart = localStorage.getItem('mk_dict_smart') === '1'; } catch (e) { ui.dictSmart = false; }

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
  function firstName(id) { return pupilName(id).split(/\s+/)[0]; }
  function setName(id) { var s = mk.sets.find(function (x) { return x.id === id; }); return s ? s.name : ''; }

  function reparse() {
    if (!window.mkDictate || !(ui.dictText || '').trim()) { ui.dictPlan = null; return null; }
    var plan = window.mkDictate.parse(ui.dictText, dictCtx());
    /* a name the teacher has already fixed by hand stays fixed while they keep talking */
    plan.entries.forEach(function (e) { var k = String(e.heard || '').toLowerCase(); if (!e.pupilId && ui.dictFix[k]) e.pupilId = ui.dictFix[k]; });
    ui.dictPlan = plan;
    return plan;
  }

  /* ---------- speaking back ---------- */
  function speak(text, then) {
    var synth = window.speechSynthesis;
    if (!ui.dictSpeak || !synth || !text) { if (then) then(); return; }
    /* stop listening while we talk, or the microphone hears us and writes it down */
    var wasListening = ui.dictListening;
    if (rec) { recStopping = true; try { rec.abort(); } catch (e) {} }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    var v = (synth.getVoices() || []).find(function (x) { return /^en-GB/i.test(x.lang); }); if (v) u.voice = v;
    u.rate = 1.05;
    var done = false;
    function after() { if (done) return; done = true; if (wasListening && ui.dictListening) startEngine(); if (then) then(); }
    u.onend = after; u.onerror = after;
    setTimeout(after, 1500 + text.length * 90);   // some browsers never fire onend
    try { synth.cancel(); synth.speak(u); } catch (e) { after(); }
  }
  function describe(e) {
    var bits = [e.pupilId ? firstName(e.pupilId) : 'unknown pupil “' + (e.heard || '?') + '”'];
    if (e.met === 'met') bits.push('met'); else if (e.met === 'not') bits.push('not met');
    e.markers.forEach(function (m) { bits.push(String(m).replace(/[.!?]+$/, '')); });
    if (e.comment) bits.push('note logged');
    return bits.join(', ');
  }
  function describeAct(a) {
    if (!a) return '';
    return (a.mode === 'new' ? 'New ' : 'Marking ') + ((a.setId ? setName(a.setId) : a.newSetName) || '') + ' activity, ' +
      (a.title || 'no title yet') + ', ' + fmt(a.workDate);
  }

  /* ---------- the microphone ---------- */
  function startListening() {
    if (!SR) {
      toast('This browser has no built-in speech — tap in the box and use your keyboard’s 🎤 instead');
      var ta = document.getElementById('mkDictText'); if (ta) ta.focus();
      return;
    }
    ui.dictOpen = true; ui.dictListening = true;
    mkRender();
    speak('Listening. Say save books when you’re done.');
    startEngine();
  }
  function startEngine() {
    if (!SR || !ui.dictListening || rec) return;
    if (window.speechSynthesis && window.speechSynthesis.speaking) { setTimeout(startEngine, 400); return; }   // wait out our own voice
    var r = new SR();
    r.lang = 'en-GB'; r.continuous = true; r.interimResults = true;
    r.onresult = function (e) {
      interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) onUtterance(t); else interim += t;
      }
      showInterim();
    };
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        ui.dictListening = false;
        toast(e.error === 'audio-capture' ? 'No microphone found' : 'Microphone permission was refused — allow it in the browser to dictate');
        mkRender();
      }
    };
    /* Chrome ends a "continuous" session after a silence: quietly start again */
    r.onend = function () {
      rec = null; interim = ''; showInterim();
      if (recStopping) { recStopping = false; return; }
      if (ui.dictListening) setTimeout(startEngine, 200);
    };
    rec = r;
    try { r.start(); } catch (e) { rec = null; }
  }
  function stopListening(silent) {
    var had = ui.dictListening;
    ui.dictListening = false; interim = '';
    if (rec) { recStopping = true; try { rec.stop(); } catch (e) {} rec = null; }
    if (!had) return;
    if (!silent) {
      var n = ui.dictPlan ? ui.dictPlan.entries.length : 0;
      speak(n ? 'Stopped listening. ' + n + (n === 1 ? ' book is' : ' books are') + ' not saved yet.' : 'Stopped listening.');
    }
    if (document.getElementById('mb-marking')) mkRender();
  }
  function showInterim() {
    var el = document.getElementById('mkDictInterim');
    if (el) { el.textContent = interim ? '… ' + interim : ''; el.style.display = interim ? '' : 'none'; }
  }

  /* one finished, pause-delimited utterance */
  function onUtterance(t) {
    t = String(t || '').trim(); if (!t) return;
    var c = window.mkDictate ? window.mkDictate.command(t) : null;
    if (c && c.rest) appendText(c.rest);
    if (c) { runCommand(c.cmd); return; }
    appendText(t);
  }
  function appendText(t) {
    var cur = (ui.dictText || '').replace(/\s+$/, '');
    /* each pause becomes a full stop: speech recognition gives no punctuation,
       and the pauses are where the teacher's thoughts break */
    ui.dictText = cur ? cur + (/[.,;:!?]$/.test(cur) ? ' ' : '. ') + t : t;
    dict.utterances.push(t);
    var ta = document.getElementById('mkDictText'); if (ta) ta.value = ui.dictText;
    var before = ui.dictPlan ? ui.dictPlan.entries.length : 0;
    var plan = reparse();
    refreshPreview();
    if (!plan) return;
    /* say the activity back once it's been heard */
    var ak = plan.activity ? [plan.activity.mode, plan.activity.title, plan.activity.workDate].join('|') : '';
    if (plan.activity && plan.activity.mode === 'new' && plan.activity.title && ak !== dict.spokenAct) { dict.spokenAct = ak; speak(describeAct(plan.activity) + '.'); return; }
    /* a new book started → confirm the one just finished */
    if (plan.entries.length > before && plan.entries.length >= 2 && plan.entries.length - 1 > dict.spokenCount) {
      dict.spokenCount = plan.entries.length - 1;
      speak(describe(plan.entries[plan.entries.length - 2]) + '.');
    }
  }
  function runCommand(cmd) {
    if (cmd === 'save') return saveDictation();
    if (cmd === 'stop') return stopListening();
    if (cmd === 'read') return readBack();
    if (cmd === 'cancel') { clearDictation(); refreshAll(); speak('Cleared. Nothing was saved.'); return; }
    if (cmd === 'undo') {
      var last = dict.utterances.pop();
      var txt = (ui.dictText || '').replace(/\s+$/, '');
      if (last && txt.slice(-last.length) === last) txt = txt.slice(0, -last.length);
      else txt = txt.replace(/[^.!?]*[.!?]?\s*$/, '');                        // edited by hand: drop the last sentence
      ui.dictText = txt.replace(/[\s.,;:]+$/, '');
      var plan = reparse();
      dict.spokenCount = Math.min(dict.spokenCount, plan ? Math.max(0, plan.entries.length - 1) : 0);
      refreshAll();
      speak(last ? 'Removed: ' + last.split(/\s+/).slice(0, 6).join(' ') : 'Nothing to remove.');
    }
  }
  function readBack() {
    var p = ui.dictPlan;
    if (!p || (!p.entries.length && !p.activity)) { speak('Nothing logged yet.'); return; }
    var parts = [];
    if (p.activity) parts.push(describeAct(p.activity) + '.');
    parts.push(p.entries.length + (p.entries.length === 1 ? ' book.' : ' books.'));
    p.entries.forEach(function (e) { parts.push(describe(e) + '.'); });
    speak(parts.join(' '));
  }
  function clearDictation() { ui.dictText = ''; ui.dictPlan = null; ui.dictFix = {}; dict.utterances = []; dict.spokenCount = 0; dict.spokenAct = ''; }

  /* ---------- saving ---------- */
  function applyPlan(plan) {
    load();
    var a = plan && plan.activity;
    if (!a) return { error: 'No activity — say “create new maths activity called …” or pick one on the left.' };
    var act = null;
    if (a.mode === 'existing') act = mk.activities.find(function (x) { return x.id === a.id; });
    if (!act) {
      if (!a.title) return { error: 'The new activity needs a title.' };
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
  function saveDictation() {
    if (dict.busy) return;
    var plan = ui.dictPlan || reparse();
    if (!plan || !plan.entries.length) { speak('Nothing to save yet.'); toast('Nothing to save yet'); return; }
    if (ui.dictSmart && smartReady()) {
      dict.busy = true; refreshPreview();
      smartParse(ui.dictText).then(function (p) { dict.busy = false; finishSave(p || plan, !!p); })
        .catch(function (e) { dict.busy = false; toast((e && e.userMessage) || 'Smart mode unavailable — used the on-device reading'); finishSave(plan, false); });
      return;
    }
    finishSave(plan, false);
  }
  function finishSave(plan, smart) {
    var res = applyPlan(plan);
    if (res.error) { speak(res.error); toast(res.error); return; }
    var names = res.saved.map(function (e) { return firstName(e.pupilId); });
    ui.dictLog.unshift({
      when: new Date().toTimeString().slice(0, 5), title: res.act.title, set: setName(res.act.setId), smart: smart,
      lines: res.saved.map(function (e) { return describe(e); }),
      skipped: res.skipped.map(function (e) { return e.raw || e.heard; })
    });
    /* anything that couldn't be matched stays in the box to fix; the rest is done */
    var left = res.skipped.map(function (e) { return 'next pupil ' + (e.heard || 'unknown') + ' ' + (e.raw || ''); }).join('. ');
    clearDictation();
    ui.dictText = left;
    reparse();
    mkRender();
    var msg = 'Saved ' + names.length + (names.length === 1 ? ' book' : ' books') + ' for ' + res.act.title + '.';
    if (res.skipped.length) msg += ' ' + res.skipped.length + ' I couldn’t match to a pupil — ' + (res.skipped.length === 1 ? 'it’s' : 'they’re') + ' left on screen.';
    toast(msg);
    speak(msg);
  }

  /* ---------- smart mode: Claude reads the note (server.js /api/dictate) ---------- */
  /* smart mode needs the server switched on AND a signed-in teacher: the
     server checks the Firebase ID token on every request */
  function signedIn() { return !!(window.CLOUD && window.CLOUD.uid && window.firebase && window.firebase.auth); }
  function smartReady() { return !!dict.smartAvail && signedIn(); }
  function idToken() {
    try {
      var u = window.firebase.auth().currentUser;
      return u ? u.getIdToken() : Promise.reject(new Error('not signed in'));
    } catch (e) { return Promise.reject(e); }
  }
  function checkSmart() {
    if (dict.smartAvail !== null || !window.fetch || location.protocol === 'file:') { if (location.protocol === 'file:') dict.smartAvail = false; return; }
    dict.smartAvail = false;
    fetch('api/dictate', { method: 'GET', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { dict.smartAvail = !!(j && j.enabled); if (dict.smartAvail) refreshPreview(); })
      .catch(function () {});
  }
  function smartParse(text) {
    var ctx = dictCtx();
    return idToken().then(function (token) { return fetch('api/dictate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ text: text, pupils: ctx.pupils, sets: ctx.sets, markers: ctx.markers, today: ctx.today,
        activeSetId: ctx.activeSetId, activeActivityId: ctx.activeActivityId,
        activities: ctx.activities.slice(-40) })
    }); }).then(function (r) {
      if (r.ok) return r.json();
      /* the server's own words for a refused sign-in or allow-list, so the
         teacher knows why it fell back to the on-device reading */
      return r.json().catch(function () { return {}; }).then(function (j) {
        var err = new Error('HTTP ' + r.status);
        if ((r.status === 401 || r.status === 403) && j && j.error) err.userMessage = j.error + ' Used the on-device reading.';
        throw err;
      });
    })
      .then(function (j) {
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
          entries: (o.entries || []).map(function (e) {
            return { pupilId: ids[e.pupilId] ? e.pupilId : null, heard: e.heard || '', met: e.met === 'met' || e.met === 'not' ? e.met : null,
                     markers: (e.markers || []).filter(Boolean), comment: e.comment || '', raw: e.heard || '' };
          })
        };
      });
  }

  /* ---------- the panel ---------- */
  function refreshAll() { var ta = document.getElementById('mkDictText'); if (ta) ta.value = ui.dictText; refreshPreview(); }
  function renderDict() {
    var host = document.getElementById('mkDict'); if (!host) return;
    checkSmart();
    host.className = 'mk-dict card' + (ui.dictListening ? ' live' : '');
    host.innerHTML =
      '<div class="mk-dicthead"><span class="mk-dicttitle">🎤 Dictate marking</span>' +
        '<span class="mk-dictstate">' + (ui.dictListening ? '<span class="mk-dictdot"></span>Listening — hands-free' : (SR ? 'Microphone off' : 'Use your keyboard’s 🎤 to dictate')) + '</span>' +
        '<span class="mk-spacer"></span><button class="mk-modal-x" id="mkDictClose" title="Close">✕</button></div>' +
      '<div class="mk-dictcmds">Say: <b>“create new maths activity called partitioning on 25/9”</b> · a pupil’s name then your notes · ' +
        '<b>“next pupil”</b> · <b>“scratch that”</b> · <b>“read back”</b> · <b>“save books”</b> · <b>“stop listening”</b></div>' +
      '<div class="mk-dictrow">' +
        '<textarea id="mkDictText" class="mk-dicttext" placeholder="Aurora answered most questions correctly but struggled with tens as a numeral. Not met. Next pupil Zoey answered all correctly, accessed the challenge, met, gold star.">' + E(ui.dictText) + '</textarea>' +
        '<div class="mk-dictbtns">' +
          (SR ? '<button class="mk-dictmic' + (ui.dictListening ? ' on' : '') + '" id="mkDictMic">' + (ui.dictListening ? '■ Stop' : '🎤 Start') + '</button>' : '') +
          '<button id="mkDictSave">✓ Save books</button>' +
          '<button class="secondary" id="mkDictRead">🔊 Read back</button>' +
          '<button class="secondary" id="mkDictClear">Clear</button>' +
        '</div>' +
      '</div>' +
      '<div class="mk-dictinterim" id="mkDictInterim" style="display:none"></div>' +
      '<div class="mk-dictopts">' +
        '<label class="mk-dictopt"><input type="checkbox" id="mkDictSpeak"' + (ui.dictSpeak ? ' checked' : '') + '> Speak confirmations</label>' +
        '<label class="mk-dictopt" id="mkDictSmartWrap" style="' + (smartReady() ? '' : 'display:none') + '"><input type="checkbox" id="mkDictSmart"' + (ui.dictSmart ? ' checked' : '') + '> Smart mode (Claude reads the note when you save)</label>' +
      '</div>' +
      '<div id="mkDictPreview"></div>' +
      (ui.dictLog.length ? '<div class="mk-dictlog">' + ui.dictLog.slice(0, 6).map(function (l) {
        return '<div class="mk-dictmsg"><div class="mk-dictmsg-h">✓ ' + E(l.when) + ' · ' + E(l.set) + ' · ' + E(l.title) + (l.smart ? ' · smart' : '') + '</div>' +
          l.lines.map(function (x) { return '<div>' + E(x) + '</div>'; }).join('') +
          (l.skipped.length ? '<div class="mk-dictwarn">Not saved (no pupil matched): ' + E(l.skipped.join(' · ')) + '</div>' : '') + '</div>';
      }).join('') + '</div>' : '') +
      '<div class="mk-dictnote">Voice uses your browser’s speech recognition. In Chrome and Edge the audio is sent to Google or Microsoft to be turned into text, so the names you say go with it; Safari on iPad and iPhone can do it on the device. Nothing is saved until you say “save books” or tap Save.' +
        (smartReady() ? ' Smart mode sends the text and your class list to Anthropic (Claude) when you save.' : '') + '</div>';
    refreshPreview();
    wireDict(host);
    showInterim();
  }
  function refreshPreview() {
    var el = document.getElementById('mkDictPreview'); if (!el) return;
    var sw = document.getElementById('mkDictSmartWrap'); if (sw) sw.style.display = smartReady() ? '' : 'none';
    var p = ui.dictPlan;
    if (dict.busy) { el.innerHTML = '<div class="mk-empty">Claude is reading your note…</div>'; return; }
    if (!p) { el.innerHTML = ''; return; }
    var a = p.activity;
    var actHTML = a
      ? '<div class="mk-dictact"><span class="mk-dicttag ' + (a.mode === 'new' ? 'new' : '') + '">' + (a.mode === 'new' ? 'New activity' : 'Activity') + '</span>' +
          '<b>' + E(a.title || '(no title)') + '</b> · ' + E((a.setId ? setName(a.setId) : a.newSetName + ' (new set)') || '') + ' · work done ' + E(fmt(a.workDate)) + '</div>'
      : '<div class="mk-dictwarn">No activity yet — say “create new … activity called …”, or pick one on the left.</div>';
    var opts = pupils();
    var rows = p.entries.map(function (e, i) {
      var sel = '<select class="mk-dictpupil" data-dpupil="' + i + '"><option value="">— who is this? —</option>' +
        opts.map(function (x) { return '<option value="' + E(x.id) + '"' + (x.id === e.pupilId ? ' selected' : '') + '>' + E(x.name) + '</option>'; }).join('') + '</select>';
      return '<div class="mk-dictentry' + (e.pupilId ? '' : ' bad') + '">' +
        '<div class="mk-dictentry-top">' + sel +
          (e.fuzzy || !e.pupilId ? '<span class="mk-dictheard">heard “' + E(e.heard) + '”</span>' : '') +
          '<span class="mk-met">' +
            '<button class="mk-met-y' + (e.met === 'met' ? ' on' : '') + '" data-dmet="' + i + '" title="Met">✓</button>' +
            '<button class="mk-met-n' + (e.met === 'not' ? ' on' : '') + '" data-dnot="' + i + '" title="Not met">✗</button></span>' +
          e.markers.map(function (t, k) { return '<button class="mk-mk mk-dictmk" data-dmk="' + i + ':' + k + '" title="Remove">' + E(t) + ' ✕</button>'; }).join('') +
          '<span class="mk-spacer"></span><button class="mk-setx" data-ddel="' + i + '" title="Leave this book out">✕</button></div>' +
        '<textarea class="mk-dictcomment" data-dcomment="' + i + '" rows="2" placeholder="(no written note)">' + E(e.comment) + '</textarea>' +
      '</div>';
    }).join('');
    var warns = (p.warnings || []).concat((p.unmatched || []).map(function (u) { return 'Not attached to a pupil: “' + u + '”'; }));
    el.innerHTML = actHTML +
      (warns.length ? warns.map(function (w) { return '<div class="mk-dictwarn">' + E(w) + '</div>'; }).join('') : '') +
      (rows || '<div class="mk-empty">Say a pupil’s name, then your notes.</div>');
    wirePreview(el);
  }
  function wirePreview(el) {
    var p = ui.dictPlan; if (!p) return;
    el.querySelectorAll('[data-dpupil]').forEach(function (s) {
      s.onchange = function () { var e = p.entries[+s.dataset.dpupil]; e.pupilId = s.value || null; e.fuzzy = false; ui.dictFix[String(e.heard || '').toLowerCase()] = e.pupilId; refreshPreview(); };
    });
    el.querySelectorAll('[data-dmet]').forEach(function (b) { b.onclick = function () { var e = p.entries[+b.dataset.dmet]; e.met = e.met === 'met' ? null : 'met'; refreshPreview(); }; });
    el.querySelectorAll('[data-dnot]').forEach(function (b) { b.onclick = function () { var e = p.entries[+b.dataset.dnot]; e.met = e.met === 'not' ? null : 'not'; refreshPreview(); }; });
    el.querySelectorAll('[data-dmk]').forEach(function (b) { b.onclick = function () { var ik = b.dataset.dmk.split(':'); p.entries[+ik[0]].markers.splice(+ik[1], 1); refreshPreview(); }; });
    el.querySelectorAll('[data-ddel]').forEach(function (b) { b.onclick = function () { p.entries.splice(+b.dataset.ddel, 1); refreshPreview(); }; });
    el.querySelectorAll('[data-dcomment]').forEach(function (t) { t.oninput = function () { p.entries[+t.dataset.dcomment].comment = t.value; }; });
  }
  function wireDict(host) {
    var x = host.querySelector('#mkDictClose'); if (x) x.onclick = function () { stopListening(true); ui.dictOpen = false; mkRender(); };
    var mic = host.querySelector('#mkDictMic'); if (mic) mic.onclick = function () { if (ui.dictListening) stopListening(); else startListening(); };
    var ta = host.querySelector('#mkDictText');
    if (ta) ta.oninput = function () { ui.dictText = ta.value; dict.utterances = []; reparse(); refreshPreview(); };
    var sv = host.querySelector('#mkDictSave'); if (sv) sv.onclick = saveDictation;
    var rb = host.querySelector('#mkDictRead'); if (rb) rb.onclick = readBack;
    var cl = host.querySelector('#mkDictClear'); if (cl) cl.onclick = function () { clearDictation(); refreshAll(); };
    var sp = host.querySelector('#mkDictSpeak'); if (sp) sp.onchange = function () { ui.dictSpeak = sp.checked; if (!sp.checked && window.speechSynthesis) window.speechSynthesis.cancel(); };
    var sm = host.querySelector('#mkDictSmart');
    if (sm) sm.onchange = function () { ui.dictSmart = sm.checked; try { localStorage.setItem('mk_dict_smart', sm.checked ? '1' : '0'); } catch (e) {} renderDict(); };
  }

  /* Test / automation hooks: feed a spoken utterance, or open the panel with text. */
  window.mkDictUtter = function (t) { if (!ui.dictOpen) { ui.dictOpen = true; mkRender(); } onUtterance(t); };
  window.mkDictOpen = function (text) {
    ui.dictOpen = true; clearDictation(); ui.dictText = text || ''; reparse();
    if (document.getElementById('mb-marking')) mkRender();
    return ui.dictPlan;
  };
  window.mkDictSave = function () { saveDictation(); };

  /* Siri / Shortcuts: index.html?dictate=<text>#markbook opens Marking with the
     text read in. &save=1 saves straight away when every book matched a pupil
     and the activity is clear; otherwise it waits on screen. */
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
      var plan = window.mkDictOpen(text);
      var clean = plan && plan.activity && plan.entries.length && plan.entries.every(function (e) { return e.pupilId; }) &&
        !(plan.unmatched || []).length && !(plan.activity.mode === 'new' && !plan.activity.title);
      if (autosave && clean) saveDictation();
      else if (autosave) toast('Some of that needs checking before it’s saved');
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
