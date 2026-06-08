/* ============================================================
   reading-groups.js — Guided Reading & Phonics Groups
   Global function: rgGroupsRender()
   Store key: 'tp_reading_groups'
   All identifiers prefixed "rg2"
   ============================================================ */

(function () {

  /* ── Data helpers ──────────────────────────────────────────── */

  function rg2Load() {
    return Store.get('tp_reading_groups', { groups: [] });
  }

  function rg2Save(data) {
    Store.set('tp_reading_groups', data);
  }

  /* ── Actions ───────────────────────────────────────────────── */

  function rg2CreateGroup(name) {
    name = name.trim();
    if (!name) return;
    var data = rg2Load();
    data.groups.push({ id: uid(), name: name, pupilIds: [], sessions: [] });
    rg2Save(data);
    rgGroupsRender();
  }

  function rg2DeleteGroup(groupId) {
    if (!confirm('Delete this group and all its sessions?')) return;
    var data = rg2Load();
    data.groups = data.groups.filter(function (g) { return g.id !== groupId; });
    rg2Save(data);
    rgGroupsRender();
  }

  function rg2RenameGroup(groupId, newName) {
    newName = newName.trim();
    if (!newName) return;
    var data = rg2Load();
    var g = data.groups.find(function (g) { return g.id === groupId; });
    if (g) g.name = newName;
    rg2Save(data);
    /* no full re-render — just save; title already reflects typed text */
  }

  function rg2AddPupil(groupId, pupilId) {
    if (!pupilId) return;
    var data = rg2Load();
    var g = data.groups.find(function (g) { return g.id === groupId; });
    if (g && g.pupilIds.indexOf(pupilId) === -1) {
      g.pupilIds.push(pupilId);
    }
    rg2Save(data);
    rgGroupsRender();
  }

  function rg2RemovePupil(groupId, pupilId) {
    var data = rg2Load();
    var g = data.groups.find(function (g) { return g.id === groupId; });
    if (g) g.pupilIds = g.pupilIds.filter(function (id) { return id !== pupilId; });
    rg2Save(data);
    rgGroupsRender();
  }

  function rg2LogSession(groupId, date, book, notes) {
    date = date.trim();
    book = book.trim();
    notes = notes.trim();
    if (!date) { alert('Please pick a date.'); return; }
    var data = rg2Load();
    var g = data.groups.find(function (g) { return g.id === groupId; });
    if (g) {
      g.sessions.push({ id: uid(), date: date, book: book, notes: notes });
    }
    rg2Save(data);
    rgGroupsRender();
  }

  function rg2DeleteSession(groupId, sessionId) {
    var data = rg2Load();
    var g = data.groups.find(function (g) { return g.id === groupId; });
    if (g) g.sessions = g.sessions.filter(function (s) { return s.id !== sessionId; });
    rg2Save(data);
    rgGroupsRender();
  }

  /* ── Render helpers ────────────────────────────────────────── */

  function rg2MemberPills(group) {
    if (!group.pupilIds.length) {
      return '<span class="hint small">No members yet.</span>';
    }
    return group.pupilIds.map(function (pid) {
      var name = esc(pupilName(pid));
      return '<span class="rg2-member-pill" style="display:inline-flex;align-items:center;gap:.25rem;'
        + 'background:#dbeafe;color:#1e40af;border-radius:999px;padding:.15rem .55rem .15rem .6rem;'
        + 'font-size:.82rem;font-weight:700;margin:.15rem;">'
        + name
        + '<button class="rg2-remove-pupil ghost small" '
        + 'data-group="' + esc(group.id) + '" data-pupil="' + esc(pid) + '" '
        + 'title="Remove ' + name + '" '
        + 'style="background:transparent;color:#1e40af;font-weight:900;padding:0 .2rem;'
        + 'border-radius:999px;line-height:1;font-size:.8rem;">&#x2715;</button>'
        + '</span>';
    }).join('');
  }

  function rg2AddPupilSelect(group) {
    /* collect pupils already in any group so we can still allow cross-group membership
       — here we just exclude those already in THIS group */
    var taken = group.pupilIds;
    var available = sortedRoster().filter(function (p) {
      return taken.indexOf(p.id) === -1;
    });
    if (!available.length) {
      return '<span class="hint small">All pupils already added.</span>';
    }
    var opts = '<option value="">— add pupil —</option>'
      + available.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>';
        }).join('');
    return '<select class="rg2-add-pupil-sel" data-group="' + esc(group.id) + '" '
      + 'style="width:auto;min-width:160px;">' + opts + '</select>';
  }

  function rg2SessionRows(group) {
    if (!group.sessions.length) {
      return '<tr><td colspan="4" class="empty" style="text-align:center">No sessions logged yet.</td></tr>';
    }
    /* newest first */
    var sorted = group.sessions.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    return sorted.map(function (s) {
      return '<tr>'
        + '<td style="white-space:nowrap">' + esc(fmtDate(s.date)) + '</td>'
        + '<td>' + esc(s.book) + '</td>'
        + '<td>' + esc(s.notes) + '</td>'
        + '<td style="text-align:center">'
        + '<button class="rg2-del-session danger small" '
        + 'data-group="' + esc(group.id) + '" data-session="' + esc(s.id) + '" '
        + 'title="Delete session" style="padding:.2rem .45rem;">&#x2715;</button>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  function rg2GroupCard(group) {
    return '<div class="card" style="margin-bottom:1.1rem;">'

      /* ── Header row: editable name + delete button ── */
      + '<div class="row" style="align-items:center;margin-bottom:.8rem;">'
      + '<input class="rg2-group-name" data-group="' + esc(group.id) + '" '
      + 'value="' + esc(group.name) + '" '
      + 'style="font-size:1.15rem;font-weight:700;border:none;border-bottom:2px solid var(--border);'
      + 'border-radius:0;padding:.2rem .3rem;width:auto;flex:1 1 auto;" />'
      + '<button class="rg2-del-group danger small" data-group="' + esc(group.id) + '">'
      + '&#x2715; Delete group</button>'
      + '</div>'

      /* ── Members ── */
      + '<div style="margin-bottom:.7rem;">'
      + '<strong style="font-size:.88rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);">Members</strong>'
      + '<div style="margin:.4rem 0;">' + rg2MemberPills(group) + '</div>'
      + '<div class="row" style="margin-top:.35rem;">'
      + rg2AddPupilSelect(group)
      + '</div>'
      + '</div>'

      /* ── Session logger ── */
      + '<div style="border-top:1px solid var(--border);padding-top:.8rem;margin-bottom:.6rem;">'
      + '<strong style="font-size:.88rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);">Log a session</strong>'
      + '<div class="row" style="margin-top:.4rem;flex-wrap:wrap;">'
      + '<input class="rg2-sess-date" data-group="' + esc(group.id) + '" type="date" '
      + 'value="' + esc(todayISO()) + '" style="width:auto;min-width:150px;" />'
      + '<input class="rg2-sess-book" data-group="' + esc(group.id) + '" type="text" '
      + 'placeholder="Book / resource" style="flex:2 1 180px;" />'
      + '<input class="rg2-sess-notes" data-group="' + esc(group.id) + '" type="text" '
      + 'placeholder="Notes" style="flex:3 1 220px;" />'
      + '<button class="rg2-log-session" data-group="' + esc(group.id) + '">+ Log session</button>'
      + '</div>'
      + '</div>'

      /* ── Sessions table ── */
      + '<div class="table-wrap">'
      + '<table class="table"><thead><tr>'
      + '<th style="white-space:nowrap">Date</th><th>Book / resource</th><th>Notes</th><th></th>'
      + '</tr></thead><tbody>'
      + rg2SessionRows(group)
      + '</tbody></table>'
      + '</div>'

      + '</div>';
  }

  /* ── Main render ────────────────────────────────────────────── */

  function rgGroupsRender() {
    var root = document.getElementById('rg2-root');
    if (!root) return;

    /* Empty roster guard */
    if (!roster || !roster.length) {
      root.innerHTML = '<div class="card"><p class="empty">'
        + 'No pupils on the class list yet. '
        + 'Go to <strong>Class List</strong> to add pupils first.'
        + '</p></div>';
      return;
    }

    var data = rg2Load();
    var html = '';

    /* ── Create group card ── */
    html += '<div class="card" style="margin-bottom:1.1rem;">'
      + '<h3 style="margin-bottom:.7rem;">Create a new group</h3>'
      + '<div class="row">'
      + '<input id="rg2-new-name" type="text" placeholder="Group name, e.g. Phonics — Red" '
      + 'class="grow" style="max-width:380px;" />'
      + '<button id="rg2-create-btn">+ Create group</button>'
      + '</div>'
      + '</div>';

    /* ── Existing groups ── */
    if (!data.groups.length) {
      html += '<div class="card"><p class="empty">No groups yet — create one above.</p></div>';
    } else {
      data.groups.forEach(function (g) {
        html += rg2GroupCard(g);
      });
    }

    root.innerHTML = html;

    /* ── Attach events ────────────────────────────────────────── */

    /* Create group */
    document.getElementById('rg2-create-btn').addEventListener('click', function () {
      var inp = document.getElementById('rg2-new-name');
      rg2CreateGroup(inp.value);
      inp.value = '';
    });
    document.getElementById('rg2-new-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('rg2-create-btn').click();
    });

    /* Delete group buttons */
    root.querySelectorAll('.rg2-del-group').forEach(function (btn) {
      btn.addEventListener('click', function () {
        rg2DeleteGroup(btn.dataset.group);
      });
    });

    /* Inline rename — save on blur or Enter */
    root.querySelectorAll('.rg2-group-name').forEach(function (inp) {
      inp.addEventListener('blur', function () {
        rg2RenameGroup(inp.dataset.group, inp.value);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') inp.blur();
      });
    });

    /* Remove pupil pills */
    root.querySelectorAll('.rg2-remove-pupil').forEach(function (btn) {
      btn.addEventListener('click', function () {
        rg2RemovePupil(btn.dataset.group, btn.dataset.pupil);
      });
    });

    /* Add pupil selects */
    root.querySelectorAll('.rg2-add-pupil-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        rg2AddPupil(sel.dataset.group, sel.value);
      });
    });

    /* Log session buttons */
    root.querySelectorAll('.rg2-log-session').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var gid = btn.dataset.group;
        var dateEl  = root.querySelector('.rg2-sess-date[data-group="' + gid + '"]');
        var bookEl  = root.querySelector('.rg2-sess-book[data-group="' + gid + '"]');
        var notesEl = root.querySelector('.rg2-sess-notes[data-group="' + gid + '"]');
        rg2LogSession(gid, dateEl.value, bookEl.value, notesEl.value);
      });
    });

    /* Delete session buttons */
    root.querySelectorAll('.rg2-del-session').forEach(function (btn) {
      btn.addEventListener('click', function () {
        rg2DeleteSession(btn.dataset.group, btn.dataset.session);
      });
    });
  }

  /* Expose as global */
  window.rgGroupsRender = rgGroupsRender;

}());
