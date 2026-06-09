/* =======================================================================
   seating.js  —  Seating & Groups module for Classroom Hub
   Globals: seatRender (function), seatState (object)
   Store key: 'tp_seating'
   ======================================================================= */

/* ---- module state ---- */
var seatState = (function () {
  var defaults = {
    tab: 'groups',          // 'groups' | 'plan'
    groupMode: 'numGroups', // 'numGroups' | 'groupSize'
    groupValue: 4,
    groups: [],             // [[id, …], …]
    planRows: 4,
    planCols: 6,
    desks: {}               // "r,c" -> pupilId
  };
  var saved = Store.get('tp_seating', {});
  return Object.assign({}, defaults, saved);
}());

function seatSave() {
  Store.set('tp_seating', seatState);
}

/* ---- helpers ---- */
function seatShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function seatDistribute(pupils, numGroups) {
  var groups = [];
  for (var i = 0; i < numGroups; i++) groups.push([]);
  pupils.forEach(function (p, i) { groups[i % numGroups].push(p); });
  return groups;
}

function seatGroupsText() {
  return seatState.groups.map(function (g, i) {
    var names = g.map(function (id) { return pupilName(id); }).join(', ');
    return 'Group ' + (i + 1) + ': ' + names;
  }).join('\n');
}

/* ---- main render ---- */
function seatRender() {
  var root = document.getElementById('seat-root');
  if (!root) return;

  var pupils = sortedRoster();
  if (!pupils.length) {
    root.innerHTML = '<div class="card"><p class="empty">No pupils yet — add some on the <strong>Class List</strong> page first.</p></div>';
    return;
  }

  /* tabs */
  var html = '<div class="tabs">' +
    '<button class="tab button' + (seatState.tab === 'groups' ? ' active' : '') + '" onclick="seatSetTab(\'groups\')">Group maker</button>' +
    '<button class="tab button' + (seatState.tab === 'plan' ? ' active' : '') + '" onclick="seatSetTab(\'plan\')">Seating plan</button>' +
    '</div>';

  if (seatState.tab === 'groups') {
    html += seatGroupsHTML(pupils);
  } else {
    html += seatPlanHTML(pupils);
  }

  root.innerHTML = html;
}

/* ======================================================================
   TOOL 1 — Group maker
   ====================================================================== */
function seatGroupsHTML(pupils) {
  var modeNumSel = seatState.groupMode === 'numGroups' ? ' selected' : '';
  var modeSzSel  = seatState.groupMode === 'groupSize' ? ' selected' : '';

  var label = seatState.groupMode === 'numGroups' ? 'Number of groups' : 'Pupils per group';

  var html = '<div class="card">' +
    '<div class="row">' +
    '<div><label>Mode</label>' +
    '<select id="seatGroupMode" onchange="seatOnModeChange()" style="min-width:200px">' +
    '<option value="numGroups"' + modeNumSel + '>By number of groups</option>' +
    '<option value="groupSize"' + modeSzSel + '>By group size</option>' +
    '</select></div>' +
    '<div><label id="seatGroupValueLabel">' + esc(label) + '</label>' +
    '<input id="seatGroupValue" type="number" min="1" style="width:90px" value="' + seatState.groupValue + '" onchange="seatOnValueChange()" /></div>' +
    '<div style="align-self:flex-end">' +
    '<button onclick="seatMakeGroups()">&#127922; Make groups</button>' +
    '</div>' +
    '<div style="align-self:flex-end">' +
    '<button class="secondary" onclick="seatMakeGroups()">Reshuffle</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  if (seatState.groups.length) {
    html += '<div class="card">' +
      '<div class="row" style="margin-bottom:.8rem">' +
      '<h3 style="margin:0;flex:1">Groups</h3>' +
      '<button class="ghost small" onclick="seatCopyGroups()">&#128203; Copy</button>' +
      '</div>' +
      '<div id="seatGroupCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.8rem">';

    seatState.groups.forEach(function (group, gi) {
      html += '<div class="card" style="margin:0;padding:.8rem">' +
        '<strong>Group ' + (gi + 1) + '</strong>' +
        '<ul style="margin:.4rem 0 0;padding-left:1.2rem">';
      group.forEach(function (id) {
        html += '<li>' + esc(pupilName(id)) + '</li>';
      });
      html += '</ul></div>';
    });

    html += '</div></div>';
  }

  return html;
}

function seatSetTab(tab) {
  seatState.tab = tab;
  seatSave();
  seatRender();
}

function seatOnModeChange() {
  var el = document.getElementById('seatGroupMode');
  if (!el) return;
  seatState.groupMode = el.value;
  var lbl = document.getElementById('seatGroupValueLabel');
  if (lbl) lbl.textContent = seatState.groupMode === 'numGroups' ? 'Number of groups' : 'Pupils per group';
  seatSave();
}

function seatOnValueChange() {
  var el = document.getElementById('seatGroupValue');
  if (!el) return;
  var v = parseInt(el.value, 10);
  if (!isNaN(v) && v >= 1) { seatState.groupValue = v; seatSave(); }
}

function seatMakeGroups() {
  /* read current control values before generating */
  seatOnModeChange();
  seatOnValueChange();

  var pupils = seatShuffle(sortedRoster().map(function (p) { return p.id; }));
  var n = Math.max(1, seatState.groupValue);
  var numGroups;

  if (seatState.groupMode === 'numGroups') {
    numGroups = Math.min(n, pupils.length);
  } else {
    /* by group size: ceil(total / size) */
    numGroups = Math.max(1, Math.ceil(pupils.length / n));
  }

  seatState.groups = seatDistribute(pupils, numGroups);
  seatSave();
  seatRender();
}

function seatCopyGroups() {
  if (!seatState.groups.length) return;
  var text = seatGroupsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      seatFlash('seatCopyBtn', 'Copied!');
    }).catch(function () {
      seatFallbackCopy(text);
    });
  } else {
    seatFallbackCopy(text);
  }
}

function seatFallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

function seatFlash(id, msg) {
  /* find the copy button and briefly change its label */
  var btns = document.querySelectorAll('#seat-root button');
  btns.forEach(function (btn) {
    if (btn.textContent.indexOf('Copy') !== -1 || btn.textContent.indexOf('📋') !== -1) {
      var orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = orig; }, 1400);
    }
  });
}

/* ======================================================================
   TOOL 2 — Seating plan (interactive draggable desks, snap to grid)
   ====================================================================== */
var SEAT_CELL = 104;   /* grid pitch — tiles snap to multiples of this */
var SEAT_TILE = 92;    /* tile size */
var SEAT_COLORS = ['#2f55e0', '#0d9488', '#e11d48', '#b9810f', '#6d4bdc', '#0891b2', '#15803d', '#c2410c'];

function seatHash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function seatColor(id) { return SEAT_COLORS[seatHash(id) % SEAT_COLORS.length]; }

function seatEnsureSeats() {
  if (!seatState.seats || typeof seatState.seats !== 'object') seatState.seats = {};
  /* one-time migration from the old desk-dropdown model {"r,c": id} */
  if (seatState.desks && Object.keys(seatState.desks).length && !Object.keys(seatState.seats).length) {
    Object.keys(seatState.desks).forEach(function (k) {
      var p = k.split(','), id = seatState.desks[k];
      if (id) seatState.seats[id] = { gx: parseInt(p[1], 10) || 0, gy: parseInt(p[0], 10) || 0 };
    });
  }
}

function seatInjectCSS() {
  if (document.getElementById('seatplan-css')) return;
  var s = document.createElement('style');
  s.id = 'seatplan-css';
  s.textContent = [
    '.seat-front{ text-align:center; font-size:11px; font-weight:700; letter-spacing:.18em; color:var(--faint); text-transform:uppercase; padding:9px 0; border-bottom:1px dashed var(--line); background:var(--line-2); }',
    '.seat-canvas{ position:relative; background-image:radial-gradient(circle, rgba(20,24,29,.10) 1.4px, transparent 1.5px); background-size:' + SEAT_CELL + 'px ' + SEAT_CELL + 'px; background-position:' + (SEAT_CELL / 2) + 'px ' + (SEAT_CELL / 2 + 6) + 'px; touch-action:none; }',
    '.seat-traylab{ font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:12px; }',
    '.seat-tray{ display:flex; flex-wrap:wrap; gap:10px; min-height:' + SEAT_TILE + 'px; align-content:flex-start; }',
    '.seat-tile{ width:' + SEAT_TILE + 'px; height:' + SEAT_TILE + 'px; border-radius:14px; background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:8px 6px; text-align:center; cursor:grab; user-select:none; touch-action:none; }',
    '.seat-tile:active{ cursor:grabbing; }',
    '.seat-placed{ position:absolute; transition:left .16s cubic-bezier(.2,.7,.3,1), top .16s cubic-bezier(.2,.7,.3,1); }',
    '.seat-av{ width:32px; height:32px; border-radius:50%; color:#fff; font-weight:700; font-size:12.5px; display:flex; align-items:center; justify-content:center; flex:0 0 auto; box-shadow:inset 0 -2px 4px rgba(0,0,0,.15); }',
    '.seat-nm{ font-size:12.5px; font-weight:600; line-height:1.15; max-width:100%; overflow:hidden; color:var(--ink); }',
    '.seat-dragging{ cursor:grabbing; box-shadow:0 16px 36px rgba(20,24,29,.28); border-color:var(--accent); transform:scale(1.05) rotate(-2deg); transition:none; }',
    '.seat-ghost{ position:absolute; width:' + SEAT_TILE + 'px; height:' + SEAT_TILE + 'px; border-radius:14px; border:2px dashed var(--accent); background:var(--accent-soft); display:none; pointer-events:none; z-index:0; }',
    '.seat-tray.seat-drop{ outline:2px dashed var(--accent); outline-offset:4px; border-radius:10px; }'
  ].join('\n');
  document.head.appendChild(s);
}

function seatTileInner(p) {
  return '<span class="seat-av" style="background:' + seatColor(p.id) + '">' + esc(initials(p.name)) + '</span>' +
         '<span class="seat-nm">' + esc(p.name) + '</span>';
}
function seatTileTray(p) {
  return '<div class="seat-tile" data-id="' + esc(p.id) + '" onpointerdown="seatDragStart(event,\'' + p.id + '\',true)">' + seatTileInner(p) + '</div>';
}
function seatTilePlaced(p) {
  var s = seatState.seats[p.id];
  return '<div class="seat-tile seat-placed" data-id="' + esc(p.id) + '" style="left:' + (s.gx * SEAT_CELL) + 'px;top:' + (s.gy * SEAT_CELL) + 'px" onpointerdown="seatDragStart(event,\'' + p.id + '\',false)">' + seatTileInner(p) + '</div>';
}

function seatPlanHTML(pupils) {
  seatInjectCSS();
  seatEnsureSeats();
  /* drop seats for pupils no longer on the roster */
  var ids = {}; pupils.forEach(function (p) { ids[p.id] = 1; });
  Object.keys(seatState.seats).forEach(function (id) { if (!ids[id]) delete seatState.seats[id]; });

  var placed = pupils.filter(function (p) { return seatState.seats[p.id]; });
  var unplaced = pupils.filter(function (p) { return !seatState.seats[p.id]; });

  var maxGx = 4, maxGy = 3;
  placed.forEach(function (p) { var s = seatState.seats[p.id]; maxGx = Math.max(maxGx, s.gx); maxGy = Math.max(maxGy, s.gy); });
  var cw = (maxGx + 2) * SEAT_CELL + 20;
  var ch = (maxGy + 2) * SEAT_CELL + 24;

  var html = '<div class="card">' +
    '<div class="row" style="align-items:center">' +
      '<div class="grow"><strong>Seating plan</strong><div class="hint small" style="margin-top:3px">Drag the desks to arrange your room — they snap neatly into place. Drag a pupil from the tray onto the plan, drop one desk on another to swap them, or drag a desk back to the tray to remove it.</div></div>' +
      '<button onclick="seatAutoArrange()">Auto-arrange</button>' +
      '<button class="secondary" onclick="seatAddAll()">Seat everyone</button>' +
      '<button class="danger small" onclick="seatClearPlan()">Clear plan</button>' +
    '</div>' +
  '</div>';

  html += '<div class="card"><div class="seat-traylab">Not seated · ' + unplaced.length + '</div>' +
    '<div id="seatTray" class="seat-tray">' +
      (unplaced.length ? unplaced.map(seatTileTray).join('') : '<span class="hint small">Everyone is seated.</span>') +
    '</div></div>';

  html += '<div class="card" style="padding:0;overflow:auto">' +
    '<div class="seat-front">Front of class · whiteboard</div>' +
    '<div id="seatCanvas" class="seat-canvas" style="min-height:' + ch + 'px;width:max(100%,' + cw + 'px)">' +
      placed.map(seatTilePlaced).join('') +
      '<div id="seatGhost" class="seat-ghost"></div>' +
    '</div></div>';

  return html;
}

/* ---- drag + snap (pointer events: mouse + touch) ---- */
var seatDrag = null;

function seatDragStart(e, id, fromTray) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  var src = e.currentTarget;
  var rect = src.getBoundingClientRect();
  var ghost = src.cloneNode(true);
  ghost.classList.add('seat-dragging');
  ghost.classList.remove('seat-placed');
  ghost.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;margin:0;z-index:9999;pointer-events:none;';
  document.body.appendChild(ghost);
  src.style.opacity = '.25';
  seatDrag = {
    id: id, fromTray: fromTray, ghost: ghost, src: src,
    prev: fromTray ? null : { gx: seatState.seats[id].gx, gy: seatState.seats[id].gy },
    dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height, moved: false
  };
  window.addEventListener('pointermove', seatDragMove);
  window.addEventListener('pointerup', seatDragEnd);
}

function seatPointInRect(e, el) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function seatCellAt(canvas, e, drag) {
  var cr = canvas.getBoundingClientRect();
  var left = e.clientX - cr.left - drag.dx;
  var top = e.clientY - cr.top - drag.dy;
  var gx = Math.max(0, Math.min(15, Math.round(left / SEAT_CELL)));
  var gy = Math.max(0, Math.min(15, Math.round(top / SEAT_CELL)));
  return { gx: gx, gy: gy };
}

function seatDragMove(e) {
  if (!seatDrag) return;
  seatDrag.moved = true;
  seatDrag.ghost.style.left = (e.clientX - seatDrag.dx) + 'px';
  seatDrag.ghost.style.top = (e.clientY - seatDrag.dy) + 'px';
  var canvas = document.getElementById('seatCanvas');
  var tray = document.getElementById('seatTray');
  var gh = document.getElementById('seatGhost');
  var inside = seatPointInRect(e, canvas);
  var overTray = seatPointInRect(e, tray);
  if (tray) tray.classList.toggle('seat-drop', overTray && !seatDrag.fromTray);
  if (gh) {
    if (inside && !overTray) {
      var cell = seatCellAt(canvas, e, seatDrag);
      gh.style.display = 'block';
      gh.style.left = (cell.gx * SEAT_CELL) + 'px';
      gh.style.top = (cell.gy * SEAT_CELL) + 'px';
    } else { gh.style.display = 'none'; }
  }
}

function seatDragEnd(e) {
  window.removeEventListener('pointermove', seatDragMove);
  window.removeEventListener('pointerup', seatDragEnd);
  if (!seatDrag) return;
  var d = seatDrag; seatDrag = null;
  if (d.ghost) d.ghost.remove();
  var canvas = document.getElementById('seatCanvas');
  var tray = document.getElementById('seatTray');

  /* a tap with no drag: seat a tray pupil at the first free desk */
  if (!d.moved) {
    if (d.fromTray) { var c0 = seatFirstFree(); seatState.seats[d.id] = c0; seatSave(); seatRender(); }
    else if (d.src) d.src.style.opacity = '';
    return;
  }

  var overTray = seatPointInRect(e, tray);
  var inside = seatPointInRect(e, canvas);

  if (overTray || !inside) {
    delete seatState.seats[d.id];           /* dropped on tray / off-plan → un-seat */
  } else {
    var cell = seatCellAt(canvas, e, d);
    var occupant = seatOccupantAt(cell.gx, cell.gy, d.id);
    if (occupant) {
      if (d.prev) { seatState.seats[occupant] = d.prev; }   /* swap two desks */
      else { cell = seatNearestFree(cell, d.id); }          /* from tray → take nearest free desk */
    }
    seatState.seats[d.id] = { gx: cell.gx, gy: cell.gy };
  }
  seatSave();
  seatRender();
}

function seatOccupantAt(gx, gy, exceptId) {
  var found = null;
  Object.keys(seatState.seats).forEach(function (id) {
    if (id !== exceptId && seatState.seats[id].gx === gx && seatState.seats[id].gy === gy) found = id;
  });
  return found;
}
function seatNearestFree(cell, id) {
  if (!seatOccupantAt(cell.gx, cell.gy, id)) return cell;
  for (var r = 1; r < 14; r++) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var gx = cell.gx + dx, gy = cell.gy + dy;
        if (gx < 0 || gy < 0) continue;
        if (!seatOccupantAt(gx, gy, id)) return { gx: gx, gy: gy };
      }
    }
  }
  return cell;
}
function seatFirstFree() {
  for (var gy = 0; gy < 40; gy++) for (var gx = 0; gx < 8; gx++) if (!seatOccupantAt(gx, gy, null)) return { gx: gx, gy: gy };
  return { gx: 0, gy: 0 };
}

function seatAutoArrange() {
  var pupils = sortedRoster();
  var canvas = document.getElementById('seatCanvas');
  var cols = canvas ? Math.max(1, Math.floor(canvas.clientWidth / SEAT_CELL)) : 6;
  cols = Math.max(2, Math.min(cols, 7));
  seatState.seats = {};
  pupils.forEach(function (p, i) { seatState.seats[p.id] = { gx: i % cols, gy: Math.floor(i / cols) }; });
  seatSave();
  seatRender();
}
function seatAddAll() {
  seatEnsureSeats();
  sortedRoster().forEach(function (p) { if (!seatState.seats[p.id]) seatState.seats[p.id] = seatFirstFree(); });
  seatSave();
  seatRender();
}
function seatClearPlan() {
  if (!confirm('Clear the whole seating plan?')) return;
  seatState.seats = {};
  seatState.desks = {};
  seatSave();
  seatRender();
}
