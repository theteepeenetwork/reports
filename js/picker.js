/* ============================================================
   picker.js — Random Name Picker for Classroom Hub
   Global function: npRender()
   Store key: 'tp_picker'
   All identifiers prefixed "np"
   ============================================================ */

(function () {

  /* ── State helpers ─────────────────────────────────────── */

  function npLoadState() {
    return Store.get('tp_picker', {
      noRepeats: false,
      picked: [],        // ids picked this round
      currentId: null    // last chosen id
    });
  }

  function npSaveState(s) {
    Store.set('tp_picker', s);
  }

  /* ── Animation handle (module-level so we can clear it) ── */
  var npAnimTimer = null;

  /* ── Main render ────────────────────────────────────────── */

  function npRender() {
    var root = document.getElementById('np-root');
    if (!root) return;

    var pupils = sortedRoster();

    /* Empty state */
    if (!pupils || pupils.length === 0) {
      root.innerHTML =
        '<div class="card"><p class="empty">No pupils yet — add some on the <strong>Class List</strong> page first.</p></div>';
      return;
    }

    var s = npLoadState();

    /* Clamp stale ids that are no longer in roster */
    var validIds = pupils.map(function (p) { return p.id; });
    s.picked = s.picked.filter(function (id) { return validIds.indexOf(id) !== -1; });
    if (s.currentId && validIds.indexOf(s.currentId) === -1) {
      s.currentId = null;
    }
    npSaveState(s);

    var total = pupils.length;
    var pickedCount = s.picked.length;
    var roundDone = s.noRepeats && pickedCount >= total;

    /* ── Stage display text ── */
    var stageName;
    if (s.currentId) {
      stageName = esc(pupilName(s.currentId));
    } else {
      stageName = '<span style="color:var(--muted);font-weight:400;font-size:2rem">Tap Pick a name</span>';
    }

    /* ── Progress line ── */
    var progressHTML = '';
    if (s.noRepeats) {
      if (roundDone) {
        progressHTML =
          '<p class="np-celebrate" style="margin:0;font-size:1.1rem;text-align:center">' +
          '&#127881; Everyone&#39;s had a turn! Next pick starts a fresh round.' +
          '</p>';
      } else {
        progressHTML =
          '<p class="hint" style="margin:0;text-align:center">' +
          pickedCount + ' of ' + total + ' picked this round' +
          '</p>';
      }
    }

    /* ── Build HTML ── */
    root.innerHTML =
      /* Stage card */
      '<div class="card" style="text-align:center;padding:2rem 1.5rem">' +
        '<div id="np-stage" style="' +
          'font-size:3rem;font-weight:800;min-height:3.5rem;' +
          'line-height:1.15;color:var(--text);margin-bottom:.75rem;' +
          'transition:color .1s' +
        '">' +
          stageName +
        '</div>' +
        '<div id="np-progress" style="min-height:1.6rem;margin-bottom:1.25rem">' +
          progressHTML +
        '</div>' +
        '<button id="np-pick-btn" class="button" style="font-size:1.2rem;padding:.75rem 2rem" ' +
          'onclick="npPick()">' +
          '&#127919; Pick a name' +
        '</button>' +
      '</div>' +

      /* Options card */
      '<div class="card">' +
        '<div class="row" style="align-items:center;gap:.75rem">' +
          '<label style="margin:0;display:flex;align-items:center;gap:.5rem;cursor:pointer;font-weight:600">' +
            '<input type="checkbox" id="np-no-repeats" ' +
              (s.noRepeats ? 'checked' : '') +
              ' onchange="npToggleNoRepeats(this.checked)" ' +
              'style="width:1.1rem;height:1.1rem;cursor:pointer">' +
            ' No repeats until everyone&#39;s had a turn' +
          '</label>' +
          '<button class="button secondary small" onclick="npResetRound()" ' +
            'style="margin-left:auto">&#9851;&#65039; Reset round</button>' +
        '</div>' +
        (s.noRepeats && pickedCount > 0
          ? '<div style="margin-top:.75rem">' +
              '<div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden">' +
                '<div style="background:var(--accent);height:100%;width:' +
                  Math.round((pickedCount / total) * 100) + '%;' +
                  'transition:width .4s;border-radius:999px"></div>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>';
  }

  /* expose render to the router (other helpers are already on window) */
  window.npRender = npRender;

  /* ── Pick logic ─────────────────────────────────────────── */

  window.npPick = function () {
    var pupils = sortedRoster();
    if (!pupils || pupils.length === 0) return;

    var s = npLoadState();
    var total = pupils.length;
    var validIds = pupils.map(function (p) { return p.id; });

    /* Clean stale ids */
    s.picked = s.picked.filter(function (id) { return validIds.indexOf(id) !== -1; });

    /* If round was exhausted, fresh round */
    if (s.noRepeats && s.picked.length >= total) {
      s.picked = [];
    }

    /* Build candidate pool */
    var pool;
    if (s.noRepeats) {
      pool = pupils.filter(function (p) { return s.picked.indexOf(p.id) === -1; });
    } else {
      pool = pupils.slice();
    }

    if (pool.length === 0) {
      /* Shouldn't happen, but safety fallback */
      pool = pupils.slice();
      s.picked = [];
    }

    /* Pick the final winner up front */
    var winner = pool[Math.floor(Math.random() * pool.length)];

    /* Disable button during animation */
    var btn = document.getElementById('np-pick-btn');
    if (btn) btn.disabled = true;

    var stage = document.getElementById('np-stage');
    var elapsed = 0;
    var interval = 80;   /* ms between flashes */
    var duration = 800;  /* total animation ms */

    /* Flash through random names from full roster for variety */
    if (npAnimTimer) clearInterval(npAnimTimer);

    npAnimTimer = setInterval(function () {
      elapsed += interval;
      var flash = pupils[Math.floor(Math.random() * pupils.length)];
      if (stage) {
        stage.style.color = 'var(--accent)';
        stage.textContent = flash.name;
      }

      if (elapsed >= duration) {
        clearInterval(npAnimTimer);
        npAnimTimer = null;

        /* Land on winner */
        if (stage) {
          stage.style.color = 'var(--text)';
          stage.textContent = winner.name;
        }

        /* Update state */
        s.currentId = winner.id;
        if (s.noRepeats && s.picked.indexOf(winner.id) === -1) {
          s.picked.push(winner.id);
        }
        npSaveState(s);

        /* Re-enable button and refresh progress */
        npRefreshProgress(s, pupils.length);
        if (btn) btn.disabled = false;
      }
    }, interval);
  };

  /* ── Toggle no-repeats ──────────────────────────────────── */

  window.npToggleNoRepeats = function (checked) {
    var s = npLoadState();
    s.noRepeats = checked;
    npSaveState(s);
    npRender();
  };

  /* ── Reset round ────────────────────────────────────────── */

  window.npResetRound = function () {
    var s = npLoadState();
    s.picked = [];
    npSaveState(s);
    npRender();
  };

  /* ── Lightweight progress refresh (no full re-render during animation) ── */

  function npRefreshProgress(s, total) {
    var progressEl = document.getElementById('np-progress');
    if (!progressEl) return;

    var pickedCount = s.picked.length;
    var roundDone = s.noRepeats && pickedCount >= total;

    if (!s.noRepeats) {
      progressEl.innerHTML = '';
      return;
    }

    if (roundDone) {
      progressEl.innerHTML =
        '<p class="np-celebrate" style="margin:0;font-size:1.1rem;text-align:center">' +
        '&#127881; Everyone&#39;s had a turn! Next pick starts a fresh round.' +
        '</p>';
    } else {
      progressEl.innerHTML =
        '<p class="hint" style="margin:0;text-align:center">' +
        pickedCount + ' of ' + total + ' picked this round' +
        '</p>';
    }

    /* Update progress bar if present */
    var bar = document.querySelector('#np-root .card:nth-child(2) div[style*="background:var(--accent)"]');
    if (bar) {
      bar.style.width = Math.round((pickedCount / total) * 100) + '%';
    }
  }

})();
