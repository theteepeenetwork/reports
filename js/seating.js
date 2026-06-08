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
   TOOL 2 — Seating plan
   ====================================================================== */
function seatPlanHTML(pupils) {
  var rows = seatState.planRows;
  var cols = seatState.planCols;

  /* build pupil option list once */
  var pupilOpts = '<option value="">— empty —</option>';
  pupils.forEach(function (p) {
    pupilOpts += '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
  });

  var html = '<div class="card">' +
    '<div class="row">' +
    '<div><label>Rows</label><input id="seatPlanRows" type="number" min="1" max="20" style="width:80px" value="' + rows + '" /></div>' +
    '<div><label>Columns</label><input id="seatPlanCols" type="number" min="1" max="20" style="width:80px" value="' + cols + '" /></div>' +
    '<div style="align-self:flex-end"><button onclick="seatApplyLayout()">Apply layout</button></div>' +
    '<div style="align-self:flex-end"><button class="danger small" onclick="seatClearPlan()">Clear seating</button></div>' +
    '</div>' +
    '</div>';

  html += '<div class="card"><div id="seatGrid" style="display:grid;gap:.5rem;grid-template-columns:repeat(' + cols + ',1fr)">';

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var key = r + ',' + c;
      var assigned = seatState.desks[key] || '';
      html += '<div style="background:#f3f4f6;border-radius:10px;padding:.4rem;text-align:center">' +
        '<div style="font-size:.7rem;color:#6b7280;margin-bottom:.25rem">R' + (r + 1) + ' C' + (c + 1) + '</div>' +
        '<select style="font-size:.82rem;padding:.25rem .2rem;width:100%;border-radius:6px" ' +
        'data-key="' + key + '" onchange="seatDeskChange(this)">';

      /* render options with current selection */
      html += '<option value="">— empty —</option>';
      pupils.forEach(function (p) {
        html += '<option value="' + esc(p.id) + '"' + (p.id === assigned ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });

      html += '</select></div>';
    }
  }

  html += '</div></div>';
  return html;
}

function seatDeskChange(selectEl) {
  var key = selectEl.getAttribute('data-key');
  var val = selectEl.value;
  if (val) {
    seatState.desks[key] = val;
  } else {
    delete seatState.desks[key];
  }
  seatSave();
  /* no full re-render needed — state is already current */
}

function seatApplyLayout() {
  var rEl = document.getElementById('seatPlanRows');
  var cEl = document.getElementById('seatPlanCols');
  if (!rEl || !cEl) return;

  var newRows = Math.max(1, parseInt(rEl.value, 10) || 1);
  var newCols = Math.max(1, parseInt(cEl.value, 10) || 1);

  /* check if any existing assignments would be lost */
  var willLose = Object.keys(seatState.desks).some(function (key) {
    var parts = key.split(',');
    return parseInt(parts[0], 10) >= newRows || parseInt(parts[1], 10) >= newCols;
  });

  if (willLose) {
    if (!confirm('Shrinking the grid will remove some desk assignments. Continue?')) return;
    /* prune out-of-bounds desks */
    Object.keys(seatState.desks).forEach(function (key) {
      var parts = key.split(',');
      if (parseInt(parts[0], 10) >= newRows || parseInt(parts[1], 10) >= newCols) {
        delete seatState.desks[key];
      }
    });
  }

  seatState.planRows = newRows;
  seatState.planCols = newCols;
  seatSave();
  seatRender();
}

function seatClearPlan() {
  if (!confirm('Clear all desk assignments? This cannot be undone.')) return;
  seatState.desks = {};
  seatSave();
  seatRender();
}
