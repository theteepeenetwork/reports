/* ============================================================
   handwriting.js — HANDWRITING checker (#handwriting)
   Owner: Desk (docs/OWNERSHIP.md) · loads after helpers.js / roster.js

   Tick off each letter and join, child by child, the way Spellings logs
   the high-frequency words: tap once = green (can do it), again = red (not
   yet), again = clear. Each mark keeps the date it was assessed on (the
   "Assessed on" date, today unless changed), so an old green can be
   rechecked.

   THE ORDER — Oak National Academy's KS1 handwriting units, in CURSIVE
   (this school teaches cursive with lead-ins, never print or pre-cursive)
     Letters  each lower case letter formed in cursive, in Oak's movement
             families: i l t · u y j · m n r · h k · b p · c a d · o g q ·
             e s f · v w x z
             Capital letters · Numerals 0–10
     Joins   The four cursive joins, with the pairs Oak's lessons use:
             1st  baseline to x-height, diagonal: id ig ed eg en ud ir ag ac na to
             2nd  diagonal to an ascender:          ck ch nk lk il it ik ul el mb at tt
             3rd  horizontal:                       oo og wa wo on om ow oi os rm wi
             4th  horizontal to an ascender:        wl oh ot ol ok of rl rk rt
             then looped descenders and break letters.

   STORE  tp_handwriting  (per class; in DATA_KEYS; see docs/CONTRACT.md)
     { marks: { [pid]: { [itemId]: { s: 1 | 0, d: 'YYYY-MM-DD' } } } }
   s 1 = secure (green), 0 = not yet (red); no entry = not assessed.
   Item ids are permanent: 'l:a' lower case, 'c:A' capital, 'n:7' numeral,
   'j:id' join, 'x:brk' break letters. Add items; never rename one, or
   saved marks lose their letter. Names are never stored, only roster ids.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'tp_handwriting';

  /* ── the checklist, in Oak's teaching order ─────────────── */
  function fam(title, letters) { return { title: title, items: letters.split(' ').map(function (c) { return { id: 'l:' + c, t: c }; }) }; }
  function joins(title, pairs) { return { title: title, items: pairs.split(' ').map(function (c) { return { id: 'j:' + c, t: c }; }) }; }
  var CAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var SECTIONS = [
    { id: 'lower', title: 'Cursive letters', yr: 'Year 1', sub: 'Each lower case letter in cursive, with its lead-in — in Oak\'s families of letters that start the same way.',
      groups: [fam('i l t', 'i l t'), fam('u y j', 'u y j'), fam('m n r', 'm n r'), fam('h k', 'h k'), fam('b p', 'b p'),
               fam('c a d', 'c a d'), fam('o g q', 'o g q'), fam('e s f', 'e s f'), fam('v w x z', 'v w x z')] },
    { id: 'caps', title: 'Capitals', yr: 'Year 1', sub: 'Capital letters.',
      groups: [{ title: 'A – M', items: CAPS.slice(0, 13).map(function (c) { return { id: 'c:' + c, t: c }; }) },
               { title: 'N – Z', items: CAPS.slice(13).map(function (c) { return { id: 'c:' + c, t: c }; }) }] },
    { id: 'nums', title: 'Numerals', yr: 'Year 1', sub: 'Numerals 0–10.',
      groups: [{ title: '0 – 10', items: '0 1 2 3 4 5 6 7 8 9 10'.split(' ').map(function (c) { return { id: 'n:' + c, t: c }; }) }] },
    { id: 'joins', title: 'Cursive joins', yr: 'Year 2', sub: 'The four cursive joins — the letter pairs Oak\'s lessons practise.',
      groups: [joins('1st join · diagonal', 'id ig ed eg en ud ir ag ac na to'),
               joins('2nd join · diagonal to an ascender', 'ck ch nk lk il it ik ul el mb at tt'),
               joins('3rd join · horizontal', 'oo og wa wo on om ow oi os rm wi'),
               joins('4th join · horizontal to an ascender', 'wl oh ot ol ok of rl rk rt'),
               { title: 'Then', items: [{ id: 'x:brk', t: 'Looped descenders & break letters', wide: true }] }] }
  ];
  var ITEM = {};
  SECTIONS.forEach(function (s) { s.groups.forEach(function (g) { g.items.forEach(function (it) { ITEM[it.id] = it; it.sec = s.id; }); }); });
  function itemsOf(sec) { var out = []; sec.groups.forEach(function (g) { out = out.concat(g.items); }); return out; }

  /* ── dates (local parts, never toISOString — BST midnight rolls back) ── */
  function isoOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function todayISO() { return isoOf(new Date()); }
  function shortD(s) { if (!s) return ''; var p = String(s).split('-'); return +p[2] + '/' + +p[1]; }
  function longD(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* ── store ────────────────────────────────────────────── */
  function load() {
    var s = Store.get(KEY, null) || {};
    return { marks: s.marks && typeof s.marks === 'object' ? s.marks : {} };
  }
  function save(s) { Store.set(KEY, s); }
  function markOf(state, pid, id) { var m = state.marks[pid] && state.marks[pid][id]; return m && (m.s === 1 || m.s === 0) ? m : null; }
  /* blank → green → red → blank */
  function cycle(state, pid, id, date) {
    var m = markOf(state, pid, id), next = !m ? 1 : m.s === 1 ? 0 : null;
    if (!state.marks[pid]) state.marks[pid] = {};
    if (next == null) delete state.marks[pid][id];
    else state.marks[pid][id] = { s: next, d: date || todayISO() };
    if (!Object.keys(state.marks[pid]).length) delete state.marks[pid];
    return next;
  }
  function countSec(state, pid, sec) {
    var c = { ok: 0, no: 0, n: 0 };
    itemsOf(sec).forEach(function (it) { var m = markOf(state, pid, it.id); c.n++; if (m) { if (m.s === 1) c.ok++; else c.no++; } });
    return c;
  }

  /* ── view state (device-local, not data) ──────────────── */
  var view = 'child', secId = 'lower', pupilId = null, onDate = null, showDates = false;

  function host() { return document.getElementById('page-handwriting'); }
  function pupils() { return typeof sortedRoster === 'function' ? sortedRoster() : (window.roster || []); }
  function curSec() { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === secId) return SECTIONS[i]; return SECTIONS[0]; }
  function cls(m) { return m ? (m.s === 1 ? 'hw-ok' : 'hw-no') : ''; }
  function tipOf(it, m, name) {
    var who = name ? name + ' · ' : '';
    return who + it.t + (m ? (m.s === 1 ? ' — can do it, ' : ' — not yet, ') + longD(m.d) : ' — not assessed') + '. Tap to change.';
  }

  function render() {
    var h = host(); if (!h) return;
    if (!onDate) onDate = todayISO();
    var list = pupils();
    if (!pupilId || !list.some(function (p) { return p.id === pupilId; })) pupilId = list.length ? list[0].id : null;
    h.innerHTML =
      '<div class="page-header"><h1>Handwriting</h1>' +
      '<p>Check off each cursive letter and join in Oak National Academy\'s order. Tap once for <b class="hw-key hw-ok">can do it</b>, again for <b class="hw-key hw-no">not yet</b>, again to clear. Each mark keeps the date it was assessed.</p></div>' +
      '<div class="hw-bar">' +
        '<div class="cbm-tabs hw-tabs">' + [['child', 'One child'], ['class', 'Whole class']].map(function (t) {
          return '<button type="button" class="cbm-tab' + (view === t[0] ? ' active' : '') + '" data-hwview="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<label class="hw-date">Assessed on <input type="date" id="hwDate" value="' + onDate + '"></label>' +
        (onDate !== todayISO() ? '<button type="button" class="secondary small" id="hwToday">Today</button>' : '') +
      '</div>' +
      '<div class="cbm-tabs hw-secs">' + SECTIONS.map(function (s) {
        return '<button type="button" class="cbm-tab' + (s.id === secId ? ' active' : '') + '" data-hwsec="' + s.id + '">' + esc(s.title) + ' <small>' + esc(s.yr) + '</small></button>'; }).join('') + '</div>' +
      '<div id="hwBody"></div>';
    h.querySelectorAll('[data-hwview]').forEach(function (b) { b.onclick = function () { view = b.dataset.hwview; render(); }; });
    h.querySelectorAll('[data-hwsec]').forEach(function (b) { b.onclick = function () { secId = b.dataset.hwsec; render(); }; });
    document.getElementById('hwDate').onchange = function (e) { onDate = e.target.value || todayISO(); render(); };
    var tb = document.getElementById('hwToday'); if (tb) tb.onclick = function () { onDate = todayISO(); render(); };
    if (!list.length) { document.getElementById('hwBody').innerHTML = '<div class="card empty">Add pupils on the Pupils page first.</div>'; return; }
    if (view === 'class') renderClass(); else renderChild();
  }

  /* ── one child: big tiles, like Spellings ─────────────── */
  function renderChild() {
    var state = load(), sec = curSec(), list = pupils(), body = document.getElementById('hwBody');
    var p = list.filter(function (x) { return x.id === pupilId; })[0];
    var idx = list.indexOf(p), c = countSec(state, p.id, sec);
    var opts = list.map(function (x) {
      var cc = countSec(state, x.id, sec);
      return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + ' (' + cc.ok + '/' + cc.n + ')</option>';
    }).join('');
    body.innerHTML =
      '<div class="card">' +
        '<div class="hw-who"><button type="button" class="secondary small" id="hwPrev" aria-label="Previous pupil"' + (idx <= 0 ? ' disabled' : '') + '>‹</button>' +
          '<select id="hwPupil" aria-label="Pupil">' + opts + '</select>' +
          '<button type="button" class="secondary small" id="hwNext" aria-label="Next pupil"' + (idx >= list.length - 1 ? ' disabled' : '') + '>›</button>' +
          '<span class="hw-tally"><b class="hw-ok-t">' + c.ok + ' can do</b> · <b class="hw-no-t">' + c.no + ' not yet</b> · ' + (c.n - c.ok - c.no) + ' to check</span>' +
          '<span class="grow"></span>' +
          '<button type="button" class="secondary small" id="hwAllOk" title="Mark every unassessed one in this section green, dated ' + esc(longD(onDate)) + '">All the rest green</button>' +
        '</div>' +
        '<p class="cbm-hint">' + esc(sec.yr + ' · ' + sec.sub) + '</p>' +
        sec.groups.map(function (g) {
          return '<div class="hw-group"><div class="hw-gtitle">' + esc(g.title) + '</div><div class="hw-tiles">' +
            g.items.map(function (it) {
              var m = markOf(state, p.id, it.id);
              return '<button type="button" class="hw-tile ' + cls(m) + (it.wide ? ' wide' : '') + '" data-hwi="' + esc(it.id) + '" title="' + esc(tipOf(it, m)) + '">' +
                '<b>' + esc(it.t) + '</b><small>' + (m ? (m.s === 1 ? '✓ ' : '✗ ') + shortD(m.d) : '&nbsp;') + '</small></button>';
            }).join('') + '</div></div>';
        }).join('') +
      '</div>';
    document.getElementById('hwPupil').onchange = function (e) { pupilId = e.target.value; renderChild(); };
    document.getElementById('hwPrev').onclick = function () { if (idx > 0) { pupilId = list[idx - 1].id; renderChild(); } };
    document.getElementById('hwNext').onclick = function () { if (idx < list.length - 1) { pupilId = list[idx + 1].id; renderChild(); } };
    document.getElementById('hwAllOk').onclick = function () {
      var s = load(), n = 0;
      itemsOf(sec).forEach(function (it) { if (!markOf(s, p.id, it.id)) { if (!s.marks[p.id]) s.marks[p.id] = {}; s.marks[p.id][it.id] = { s: 1, d: onDate }; n++; } });
      if (n) { save(s); renderChild(); }
    };
    body.querySelectorAll('[data-hwi]').forEach(function (b) {
      b.onclick = function () { var s = load(); cycle(s, p.id, b.dataset.hwi, onDate); save(s); renderChild(); };
    });
  }

  /* ── whole class: one row per child, one column per letter/join ── */
  function renderClass() {
    var state = load(), sec = curSec(), list = pupils(), body = document.getElementById('hwBody'), items = itemsOf(sec);
    var head1 = '<th class="name" rowspan="2">Pupil</th>' + sec.groups.map(function (g) { return '<th class="hw-gh" colspan="' + g.items.length + '">' + esc(g.title) + '</th>'; }).join('') + '<th class="num" rowspan="2">Can do</th>';
    var head2 = items.map(function (it, i) {
      var ok = list.filter(function (p) { var m = markOf(state, p.id, it.id); return m && m.s === 1; }).length;
      return '<th class="hw-ch' + (isFirst(sec, it) ? ' gstart' : '') + '" title="' + esc(it.t + ': ' + ok + ' of ' + list.length + ' can do it') + '">' + esc(it.wide ? 'brk' : it.t) + '</th>';
    }).join('');
    var rows = list.map(function (p) {
      var c = countSec(state, p.id, sec);
      return '<tr><td class="name"><button type="button" class="hw-name" data-hwp="' + esc(p.id) + '" title="Open ' + esc(p.name) + '">' + esc(p.name) + '</button></td>' +
        items.map(function (it) {
          var m = markOf(state, p.id, it.id);
          return '<td class="hw-c' + (isFirst(sec, it) ? ' gstart' : '') + '"><button type="button" class="hw-cell ' + cls(m) + '" data-hwp="' + esc(p.id) + '" data-hwi="' + esc(it.id) + '" title="' + esc(tipOf(it, m, p.name)) + '" aria-label="' + esc(tipOf(it, m, p.name)) + '">' +
            (m ? (showDates ? shortD(m.d) : (m.s === 1 ? '✓' : '✗')) : '') + '</button></td>';
        }).join('') +
        '<td class="num"><b>' + c.ok + '</b>/' + c.n + '</td></tr>';
    }).join('');
    var foot = '<tr class="hw-foot"><td class="name">Class</td>' + items.map(function (it) {
      var ok = list.filter(function (p) { var m = markOf(state, p.id, it.id); return m && m.s === 1; }).length;
      var no = list.filter(function (p) { var m = markOf(state, p.id, it.id); return m && m.s === 0; }).length;
      return '<td class="hw-c' + (isFirst(sec, it) ? ' gstart' : '') + (no ? ' hw-foot-no' : '') + '" title="' + esc(it.t + ': ' + ok + ' can do, ' + no + ' not yet') + '">' + ok + '</td>';
    }).join('') + '<td></td></tr>';
    body.innerHTML =
      '<div class="card"><div class="hw-who"><span class="cbm-hint" style="margin:0">' + esc(sec.yr + ' · ' + sec.sub) + ' Tap a square to mark it, dated ' + esc(longD(onDate)) + '.</span><span class="grow"></span>' +
        '<label class="hw-showd"><input type="checkbox" id="hwShowD"' + (showDates ? ' checked' : '') + '> Show dates</label></div>' +
        '<div class="table-wrap"><table class="hw-table' + (showDates ? ' hw-dates' : '') + '"><thead><tr>' + head1 + '</tr><tr>' + head2 + '</tr></thead><tbody>' + rows + foot + '</tbody></table></div></div>';
    document.getElementById('hwShowD').onchange = function (e) { showDates = e.target.checked; renderClass(); };
    body.querySelectorAll('.hw-name').forEach(function (b) { b.onclick = function () { pupilId = b.dataset.hwp; view = 'child'; render(); }; });
    body.querySelectorAll('.hw-cell').forEach(function (b) {
      b.onclick = function () {
        var s = load(), pid = b.dataset.hwp, id = b.dataset.hwi;
        cycle(s, pid, id, onDate); save(s);
        /* redraw, keeping the table's scroll position */
        var w = body.querySelector('.table-wrap'), x = w ? w.scrollLeft : 0, y = window.scrollY;
        renderClass();
        w = body.querySelector('.table-wrap'); if (w) w.scrollLeft = x; window.scrollTo(0, y);
        var nb = body.querySelector('.hw-cell[data-hwp="' + CSS.escape(pid) + '"][data-hwi="' + CSS.escape(id) + '"]'); if (nb) nb.focus();
      };
    });
  }
  function isFirst(sec, it) { return sec.groups.some(function (g, i) { return i > 0 && g.items[0] === it; }); }

  window.addEventListener('tp:sync', function () { var h = host(); if (h && h.classList.contains('active')) render(); });
  window.addEventListener('tp:reset', function () { pupilId = null; var h = host(); if (h) h.innerHTML = ''; });

  window.hwRender = render;
  /* pure parts, for tests */
  window.HW = { SECTIONS: SECTIONS, ITEM: ITEM, cycle: cycle, countSec: countSec, KEY: KEY };
})();
