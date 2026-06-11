/* ============================================================
   groups.js — Universal nested Groups (replaces Reading Groups)

   One grouping system: unlimited heading depth, group cards with
   colour / TA / notes, free (multi-group) membership. Editable in
   Plan › Organise › Groups, read-only in Teach.

   Store key: 'tp_groups'  — a nested tree:
     heading = { id, type:'heading', name, collapsed, children:[] }
     group   = { id, type:'group',   name, colorIdx, pupilIds:[], ta, notes }

   Plan global:  grpRender()            → renders into #grp-root
   Teach helpers (seed-aware, read-only):
     window.grpTree()                   → nested tree
     window.grpFlatGroups()             → flat list of every group node
     window.grpGroupNameFor(pupilId)    → first group a pupil belongs to

   All identifiers prefixed "grp".
   ============================================================ */

(function () {

  var GROUPS_KEY = 'tp_groups';

  /* Group accent colours — cobalt / coral / gold / violet / green / slate,
     matching the Classroom Hub palette tokens. */
  var GRP_COLORS = ['#2f55e0', '#e11d48', '#d99a07', '#6d4bdc', '#1f8a4c', '#5c6a6e'];

  /* Indent / type scale for the Plan outline tree, by depth. */
  var NAME_SIZES = ['18px', '15.5px', '14px', '13px'];

  /* ── Model helpers ─────────────────────────────────────────── */

  function grpUid() { return 'g' + Math.random().toString(36).slice(2, 9); }
  function heading(name, children) { return { id: grpUid(), type: 'heading', name: name, collapsed: false, children: children || [] }; }
  function group(name, colorIdx, ta, notes) { return { id: grpUid(), type: 'group', name: name, colorIdx: colorIdx || 0, pupilIds: [], ta: ta || '', notes: notes || '' }; }

  /* First-load migration: if there's no tp_groups yet but the old Reading
     Groups store has data, lift those groups under a "Reading" heading so the
     teacher keeps their real groups. Otherwise start empty. (Old per-group
     session logs are out of scope for this design.) */
  function migrateFromReading() {
    try {
      var old = Store.get('tp_reading_groups', null);
      var gs = old && old.groups;
      if (Array.isArray(gs) && gs.length) {
        return [heading('Reading', gs.map(function (g, i) {
          var n = group(g.name || 'Group', i % GRP_COLORS.length);
          n.pupilIds = Array.isArray(g.pupilIds) ? g.pupilIds.slice() : [];
          return n;
        }))];
      }
    } catch (e) {}
    return [];
  }

  /* Load is migration-aware. A migrated/empty tree lives in memory only — it
     is never written until the first edit, so an untouched device doesn't trip
     the cloud adopt/owner flow. */
  function grpLoad() {
    var t = Store.get(GROUPS_KEY, null);
    if (Array.isArray(t) && t.length) return t;
    return migrateFromReading();
  }

  /* Drop pupil ids that are no longer on the roster, then persist. */
  function pruneTree(list) {
    (list || []).forEach(function (n) {
      if (n.type === 'group') n.pupilIds = (n.pupilIds || []).filter(rosterHas);
      else if (n.type === 'heading') pruneTree(n.children);
    });
  }
  function grpSave(tree) { pruneTree(tree); Store.set(GROUPS_KEY, tree); }

  function rosterHas(pid) { return (roster || []).some(function (p) { return p.id === pid; }); }

  function findNode(id, list, parent) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return { node: list[i], list: list, index: i, parent: parent || null };
      if (list[i].type === 'heading') {
        var r = findNode(id, list[i].children, list[i]);
        if (r) return r;
      }
    }
    return null;
  }

  function countGroups(node) {
    if (node.type === 'group') return 1;
    return node.children.reduce(function (a, c) { return a + countGroups(c); }, 0);
  }

  function flatten(list, out) {
    (list || []).forEach(function (n) {
      if (n.type === 'group') out.push(n);
      else if (n.type === 'heading') flatten(n.children, out);
    });
    return out;
  }

  /* ── Actions (load → mutate → save → re-render) ────────────── */

  function commit(tree) { grpSave(tree); grpRender(); }

  function actCaret(id) { var t = grpLoad(); var r = findNode(id, t); if (r) { r.node.collapsed = !r.node.collapsed; commit(t); } }
  function actColor(id) { var t = grpLoad(); var r = findNode(id, t); if (r) { r.node.colorIdx = (r.node.colorIdx + 1) % GRP_COLORS.length; commit(t); } }

  function actDelete(id) {
    var t = grpLoad(); var r = findNode(id, t); if (!r) return;
    if (r.node.type === 'heading' && r.node.children.length && !confirm('Delete "' + r.node.name + '" and everything inside it?')) return;
    if (r.node.type === 'group' && r.node.pupilIds.length && !confirm('Delete group "' + r.node.name + '"?')) return;
    r.list.splice(r.index, 1);
    commit(t);
  }

  function actAddGroup(id) { var t = grpLoad(); var r = findNode(id, t); if (r) { r.node.children.push(group('New group', r.node.children.length % GRP_COLORS.length)); commit(t); } }
  function actAddSub(id)   { var t = grpLoad(); var r = findNode(id, t); if (r) { r.node.children.push(heading('New heading', [])); commit(t); } }
  function actAddRoot()    { var t = grpLoad(); t.push(heading('New heading', [])); commit(t); }

  function actAddPupil(id, pupilId) {
    if (!pupilId) return;
    var t = grpLoad(); var r = findNode(id, t);
    if (r && r.node.pupilIds.indexOf(pupilId) === -1) { r.node.pupilIds.push(pupilId); commit(t); }
  }
  function actRemovePupil(id, pupilId) {
    var t = grpLoad(); var r = findNode(id, t);
    if (r) { r.node.pupilIds = r.node.pupilIds.filter(function (x) { return x !== pupilId; }); commit(t); }
  }

  /* Text edits: save without a full re-render (the field already shows the
     typed text, and re-rendering would steal focus). */
  function actText(id, field, value) {
    var t = grpLoad(); var r = findNode(id, t);
    if (!r) return;
    if (field === 'name') { value = value.trim(); if (!value) { grpRender(); return; } }
    r.node[field] = value;
    grpSave(t);
  }

  /* ── Plan render ───────────────────────────────────────────── */

  function ensureStyle() {
    if (document.getElementById('grp-style')) return;
    var s = document.createElement('style');
    s.id = 'grp-style';
    s.textContent =
      '#grp-root input:focus,#grp-root select:focus{outline:none}' +
      '.grp-h-caret:hover{background:var(--line-2);color:var(--ink)}' +
      '.grp-name:hover{border-color:var(--border)!important;background:#fff}' +
      '.grp-name:focus{border-color:var(--accent)!important;background:#fff}' +
      '.grp-del:hover{background:var(--coral-50);color:var(--coral-600)}' +
      '.grp-ta:hover{border-color:var(--border)!important}' +
      '.grp-ta:focus{border-color:var(--accent)!important;color:var(--ink)}' +
      '.grp-notes:hover{border-color:var(--border)!important}' +
      '.grp-notes:focus{border-color:var(--accent)!important;color:var(--ink)}' +
      '.grp-pill-x:hover{background:rgba(31,63,184,.14)}' +
      '.grp-pick:hover{border-color:var(--accent);color:var(--accent)}' +
      '.grp-add:hover,.grp-addroot:hover{border-color:var(--accent);color:var(--accent);background:var(--teal-50)}' +
      '.grp-tband:hover{background:var(--line-2)}';
    document.head.appendChild(s);
  }

  function memberPills(node) {
    return node.pupilIds.filter(rosterHas).map(function (pid) {
      var nm = esc(pupilName(pid));
      return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--teal-100);color:var(--teal-700);border-radius:999px;padding:2.5px 5px 2.5px 11px;font-size:12.5px;font-weight:600;">'
        + nm
        + '<button class="grp-pill-x" data-act="rmpupil" data-id="' + esc(node.id) + '" data-pupil="' + esc(pid) + '" title="Remove ' + nm + '" '
        + 'style="background:none;border:none;color:var(--teal-700);font-size:10px;font-weight:800;cursor:pointer;padding:1px 5px;border-radius:999px;line-height:1;">&#x2715;</button>'
        + '</span>';
    }).join('');
  }

  function addChildSelect(node) {
    var taken = node.pupilIds;
    var opts = '<option value="">＋ Add child…</option>'
      + sortedRoster().filter(function (p) { return taken.indexOf(p.id) === -1; })
          .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    return '<select class="grp-pick" data-act="pick" data-id="' + esc(node.id) + '" '
      + 'style="font-size:12px;font-weight:600;color:var(--muted);background:#fff;border:1px dashed #c4cad2;border-radius:999px;padding:3px 8px;cursor:pointer;max-width:150px;">'
      + opts + '</select>';
  }

  function headingRow(node, depth) {
    var indent = (depth * 26) + 'px';
    var n = countGroups(node);
    var headMargin = (depth === 0 ? '18px' : '4px') + ' 0 4px ' + indent;
    var countLabel = node.collapsed ? (n + (n === 1 ? ' group' : ' groups')) : '';
    return '<div style="margin:' + headMargin + ';display:flex;align-items:center;gap:4px;max-width:760px;">'
      + '<button class="grp-h-caret" data-act="caret" data-id="' + esc(node.id) + '" title="Collapse / expand" '
      + 'style="width:24px;height:24px;border:none;background:none;color:var(--faint);font-size:11px;cursor:pointer;border-radius:6px;flex:0 0 auto;">' + (node.collapsed ? '▶' : '▼') + '</button>'
      + '<input class="grp-name" data-act="text" data-field="name" data-id="' + esc(node.id) + '" value="' + esc(node.name) + '" '
      + 'style="flex:1;min-width:60px;font-size:' + NAME_SIZES[Math.min(depth, 3)] + ';font-weight:700;letter-spacing:-.01em;color:var(--ink);background:none;border:1px solid transparent;border-radius:8px;padding:3px 8px;" />'
      + '<span style="font-size:12px;font-weight:600;color:var(--faint);white-space:nowrap;">' + esc(countLabel) + '</span>'
      + '<button class="grp-del" data-act="del" data-id="' + esc(node.id) + '" title="Delete heading" '
      + 'style="width:26px;height:26px;border:none;background:none;color:#c4cad2;font-size:13px;cursor:pointer;border-radius:7px;flex:0 0 auto;">&#x2715;</button>'
      + '</div>';
  }

  function groupCard(node, depth) {
    var indent = (depth * 26) + 'px';
    var bar = GRP_COLORS[node.colorIdx % GRP_COLORS.length];
    return '<div style="margin:0 0 10px ' + indent + ';max-width:760px;background:#fff;border:1px solid var(--border);border-left:4px solid ' + bar + ';border-radius:12px;padding:12px 14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;">'

      + '<div style="display:flex;align-items:center;gap:9px;">'
      + '<button data-act="color" data-id="' + esc(node.id) + '" title="Click to change colour" '
      + 'style="width:15px;height:15px;border-radius:50%;background:' + bar + ';border:none;cursor:pointer;flex:0 0 auto;box-shadow:0 0 0 2px #fff,0 0 0 3px var(--border);"></button>'
      + '<input class="grp-name" data-act="text" data-field="name" data-id="' + esc(node.id) + '" value="' + esc(node.name) + '" '
      + 'style="flex:1;min-width:50px;font-size:15.5px;font-weight:700;letter-spacing:-.01em;color:var(--ink);background:none;border:1px solid transparent;border-radius:8px;padding:2px 8px;" />'
      + '<input class="grp-ta" data-act="text" data-field="ta" data-id="' + esc(node.id) + '" value="' + esc(node.ta) + '" placeholder="TA / adult" '
      + 'style="width:135px;font-size:12.5px;font-weight:600;color:var(--muted);background:none;border:1px solid transparent;border-radius:8px;padding:3px 8px;text-align:right;" />'
      + '<button class="grp-del" data-act="del" data-id="' + esc(node.id) + '" title="Delete group" '
      + 'style="width:26px;height:26px;border:none;background:none;color:#c4cad2;font-size:13px;cursor:pointer;border-radius:7px;flex:0 0 auto;">&#x2715;</button>'
      + '</div>'

      + '<input class="grp-notes" data-act="text" data-field="notes" data-id="' + esc(node.id) + '" value="' + esc(node.notes) + '" placeholder="Notes — focus, book band, resources…" '
      + 'style="font-size:12.5px;color:var(--muted);background:none;border:1px solid transparent;border-radius:8px;padding:3px 8px;margin-left:24px;" />'

      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:24px;">'
      + memberPills(node) + addChildSelect(node)
      + '</div>'
      + '</div>';
  }

  function addRow(node, depth) {
    var indent = ((depth + 1) * 26) + 'px';
    return '<div style="margin:2px 0 14px ' + indent + ';display:flex;gap:8px;">'
      + '<button class="grp-add" data-act="addgroup" data-id="' + esc(node.id) + '" '
      + 'style="border:1px dashed #c4cad2;background:none;color:var(--muted);font-size:12px;font-weight:600;border-radius:9px;padding:5px 13px;cursor:pointer;">＋ Group</button>'
      + '<button class="grp-add" data-act="addsub" data-id="' + esc(node.id) + '" '
      + 'style="border:1px dashed #dde0e5;background:none;color:var(--faint);font-size:12px;font-weight:600;border-radius:9px;padding:5px 13px;cursor:pointer;">＋ Sub-heading</button>'
      + '</div>';
  }

  function walkPlan(list, depth) {
    var html = '';
    list.forEach(function (node) {
      if (node.type === 'heading') {
        html += headingRow(node, depth);
        if (!node.collapsed) {
          html += walkPlan(node.children, depth + 1);
          html += addRow(node, depth);
        }
      } else {
        html += groupCard(node, depth);
      }
    });
    return html;
  }

  function grpRender() {
    var root = document.getElementById('grp-root');
    if (!root) return;
    ensureStyle();

    /* Empty roster guard — same pattern as the page it replaces. */
    if (!roster || !roster.length) {
      root.innerHTML = '<div class="card"><p class="empty">No pupils on the class list yet. '
        + 'Add pupils in <strong>Plan › Pupils</strong> first.</p></div>';
      return;
    }

    var tree = grpLoad();
    var html = walkPlan(tree, 0);

    if (!tree.length) {
      html += '<div class="card" style="max-width:760px;margin-bottom:12px;"><p class="empty" style="margin:0;">'
        + 'No groups yet. Start with a <strong>＋ Heading</strong> (e.g. Literacy or Numeracy), then add groups inside it.'
        + '</p></div>';
    }

    html += '<div style="margin-top:6px;max-width:760px;">'
      + '<button class="grp-addroot" data-act="addroot" '
      + 'style="width:100%;border:1.5px dashed #c4cad2;background:none;color:var(--muted);font-size:13px;font-weight:700;border-radius:12px;padding:11px;cursor:pointer;">＋ Heading</button>'
      + '</div>'
      + '<p style="max-width:760px;font-size:12px;color:var(--faint);margin:14px 0 0;">Headings nest as deep as you need. Children can be in any number of groups — Teach shows everything read-only.</p>';

    root.innerHTML = html;

    /* Delegated handlers — one click, one change, keyed by data-act. */
    root.onclick = function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var id = b.dataset.id;
      switch (b.dataset.act) {
        case 'caret':    actCaret(id); break;
        case 'color':    actColor(id); break;
        case 'del':      actDelete(id); break;
        case 'addgroup': actAddGroup(id); break;
        case 'addsub':   actAddSub(id); break;
        case 'addroot':  actAddRoot(); break;
        case 'rmpupil':  actRemovePupil(id, b.dataset.pupil); break;
      }
    };
    root.onchange = function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.dataset.act === 'pick') { actAddPupil(el.dataset.id, el.value); }
      else if (el.dataset.act === 'text') { actText(el.dataset.id, el.dataset.field, el.value); }
    };
    root.onkeydown = function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.dataset.act === 'text') e.target.blur();
    };
  }

  /* ── Teach helpers (read-only, seed-aware) ─────────────────── */

  function grpTree() { return grpLoad(); }
  function grpFlatGroups() { return flatten(grpLoad(), []); }
  function grpGroupNameFor(pupilId) {
    var g = grpFlatGroups().find(function (g) { return g.pupilIds.indexOf(pupilId) !== -1; });
    return g ? g.name : '';
  }

  /* Expose globals */
  window.grpRender = grpRender;
  window.grpTree = grpTree;
  window.grpFlatGroups = grpFlatGroups;
  window.grpGroupNameFor = grpGroupNameFor;
  window.GRP_COLORS = GRP_COLORS;

}());
