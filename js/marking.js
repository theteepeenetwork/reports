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
      ['sets', 'activeSetId', 'activities', 'activeActivityId', 'marks', 'lastMarked', 'bank', 'sort', 'seq', 'quickButtons'].forEach(function (k) {
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
          comment: rec.comment || ''
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
          '<button class="mk-comment' + (r.hasC ? ' has' : '') + '" data-comment="' + r.p.id + '">' + (r.hasC ? E(r.comment) : '+ comment') + '</button>' +
        '</div>';
      }).join('');

      function sortBtn(key, label) { return '<button class="mk-sortbtn' + (mk.sort === key ? ' on' : '') + '" data-sort="' + key + '">' + label + '</button>'; }

      listCol =
        '<div class="mk-list card">' +
          '<div class="mk-list-head"><span class="mk-list-title">' + E(act.title) + '</span>' +
            '<span class="mk-list-count">' + markedCount + '/' + P.length + ' marked</span></div>' +
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

    host.innerHTML = setsBar + '<div class="mk-cols">' + activitiesCol + listCol + '</div>';
    wire(host);
  }
  window.mkRender = mkRender;

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

    /* permanent customisable quick-insert buttons (defined by the teacher) */
    var qb = mk.quickButtons || [];
    var qbHTML;
    if (ui.qbEdit) {
      qbHTML = qb.map(function (b) {
        return '<span class="mk-qbedit"><input class="mk-qbname" data-qbrename="' + b.id + '" value="' + E(b.text) + '">' +
          '<button class="mk-setx" data-qbremove="' + b.id + '" title="Remove button">✕</button></span>';
      }).join('') +
        '<span class="mk-newset"><input class="mk-newsetin" id="mkQbNew" placeholder="New button…">' +
        '<button class="mk-newsetadd" id="mkQbAdd">+</button></span>';
    } else {
      qbHTML = qb.length
        ? qb.map(function (b) { return '<button class="mk-qbtn" data-qbins="' + b.id + '">' + E(b.text) + '</button>'; }).join('')
        : '<span class="mk-qbempty">No quick buttons yet — add your own →</span>';
    }
    var qbRow =
      '<div class="mk-qbrow"><span class="mk-qblbl">Quick buttons</span>' + qbHTML +
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

    /* quick buttons: insert on tap; ✎ Edit toggles add / rename / remove */
    bd.querySelectorAll('[data-qbins]').forEach(function (b) {
      b.onclick = function () {
        var t = (mk.quickButtons || []).find(function (x) { return x.id === b.dataset.qbins; });
        if (!t) return;
        ui.draft = smartAppend(ui.draft, t.text);
        var ta2 = document.getElementById('mkDraft'); if (ta2) { ta2.value = ui.draft; ta2.focus(); }
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
