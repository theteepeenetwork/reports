/* ===================================================================
   timetable.js  —  Weekly Timetable / Daily Plan for Classroom Hub
   Store key: tp_timetable
   Global entry-point: ttRender()
   All module globals are prefixed "tt".
   =================================================================== */

(function () {

  /* ── Constants ─────────────────────────────────────────────────── */
  var TT_KEY = 'tp_timetable';
  var TT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var TT_DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

  /* Periods that look like break or lunch — given a subtle background */
  var TT_BREAK_KEYWORDS = ['break', 'lunch', 'play', 'dinner'];

  /* UK primary-school default timetable */
  var TT_DEFAULT_PERIODS = [
    { label: '8:50 Registration',        cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '9:00 Mental Starter',      cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '9:15 Maths',               cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '10:15 Break',              cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '10:30 English',            cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '11:30 Reading / Phonics',  cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '12:00 Lunch',             cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '1:00 Topic / Science',     cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '2:00 Afternoon Session',   cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } },
    { label: '2:50 Story & Home Time',   cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' } }
  ];

  /* ── State ──────────────────────────────────────────────────────── */
  var ttData = null; // loaded lazily in ttLoad()

  /* ── Persistence helpers ────────────────────────────────────────── */
  function ttLoad() {
    var saved = Store.get(TT_KEY, null);
    if (saved && Array.isArray(saved.periods) && saved.periods.length > 0) {
      ttData = saved;
    } else {
      // Seed defaults — give every period a stable id
      ttData = {
        periods: TT_DEFAULT_PERIODS.map(function (p) {
          return { id: uid(), label: p.label, cells: Object.assign({}, p.cells) };
        })
      };
      ttSave();
    }
  }

  function ttSave() {
    Store.set(TT_KEY, ttData);
  }

  /* ── Helpers ────────────────────────────────────────────────────── */
  function ttIsBreak(label) {
    var l = (label || '').toLowerCase();
    return TT_BREAK_KEYWORDS.some(function (kw) { return l.indexOf(kw) !== -1; });
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  function ttBuildTable() {
    var rows = '';

    ttData.periods.forEach(function (period, idx) {
      var isBreak = ttIsBreak(period.label);
      var rowStyle = isBreak ? ' style="background:#f0fdf4;"' : '';

      // Period label cell (first column)
      var labelCell =
        '<td style="min-width:9rem;padding:.15rem;">' +
          '<input' +
          ' type="text"' +
          ' value="' + esc(period.label) + '"' +
          ' aria-label="Period label"' +
          ' data-tt-label="' + esc(period.id) + '"' +
          ' style="font-weight:600;text-align:left;"' +
          '>' +
        '</td>';

      // Weekday cells
      var dayCells = TT_DAYS.map(function (day) {
        return '<td>' +
          '<input' +
          ' type="text"' +
          ' value="' + esc(period.cells[day] || '') + '"' +
          ' aria-label="' + TT_DAY_LABELS[day] + '"' +
          ' data-tt-cell="' + esc(period.id) + '"' +
          ' data-tt-day="' + day + '"' +
          '>' +
        '</td>';
      }).join('');

      // Remove button cell
      var removeCell =
        '<td style="padding:.15rem;text-align:center;white-space:nowrap;">' +
          '<button' +
          ' class="button danger small no-print"' +
          ' title="Remove this period"' +
          ' data-tt-remove="' + esc(period.id) + '"' +
          '>&#x2715;</button>' +
        '</td>';

      rows += '<tr' + rowStyle + '>' + labelCell + dayCells + removeCell + '</tr>\n';
    });

    return rows;
  }

  function ttRenderInner() {
    var root = document.getElementById('tt-root');
    if (!root) return;

    // Header row
    var headerCols = TT_DAYS.map(function (d) {
      return '<th style="text-align:center;min-width:8rem;">' + TT_DAY_LABELS[d] + '</th>';
    }).join('');

    var html =
      '<div class="card">' +
        '<div class="table-wrap">' +
          '<table class="table grid-table" id="tt-grid">' +
            '<thead>' +
              '<tr>' +
                '<th style="min-width:9rem;">Time / Period</th>' +
                headerCols +
                '<th class="no-print" style="width:3rem;"></th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="tt-tbody">' +
              ttBuildTable() +
            '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="row" style="margin-top:.8rem;">' +
          '<button class="button no-print" id="tt-add-btn">+ Add period</button>' +
          '<span class="hint small" style="align-self:center;">Changes save automatically.</span>' +
        '</div>' +
      '</div>';

    root.innerHTML = html;
    ttAttachListeners();
  }

  /* ── Event wiring ───────────────────────────────────────────────── */
  function ttAttachListeners() {
    var grid = document.getElementById('tt-grid');
    if (!grid) return;

    // Single delegated listener for all inputs in the grid
    grid.addEventListener('change', function (e) {
      var el = e.target;

      // Period label edited
      var labelId = el.getAttribute('data-tt-label');
      if (labelId) {
        var period = ttFindPeriod(labelId);
        if (period) {
          period.label = el.value;
          ttSave();
          // Refresh break-row colouring without full re-render
          ttRefreshRowStyle(labelId, el.value);
        }
        return;
      }

      // Day cell edited
      var cellId = el.getAttribute('data-tt-cell');
      var day    = el.getAttribute('data-tt-day');
      if (cellId && day) {
        var p = ttFindPeriod(cellId);
        if (p) {
          p.cells[day] = el.value;
          ttSave();
        }
        return;
      }
    });

    // Remove buttons (delegated on tbody to survive partial re-renders)
    var tbody = document.getElementById('tt-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-tt-remove]');
        if (!btn) return;
        var id = btn.getAttribute('data-tt-remove');
        var period = ttFindPeriod(id);
        var label = period ? period.label : 'this period';
        if (confirm('Remove "' + label + '"? This cannot be undone.')) {
          ttData.periods = ttData.periods.filter(function (p) { return p.id !== id; });
          ttSave();
          ttRenderInner(); // structural change — full re-render
        }
      });
    }

    // Add period button
    var addBtn = document.getElementById('tt-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        ttData.periods.push({
          id: uid(),
          label: '',
          cells: { Mon: '', Tue: '', Wed: '', Thu: '', Fri: '' }
        });
        ttSave();
        ttRenderInner(); // structural change — full re-render
        // Focus the new label input
        var tbody2 = document.getElementById('tt-tbody');
        if (tbody2) {
          var lastRow = tbody2.querySelector('tr:last-child');
          if (lastRow) {
            var inp = lastRow.querySelector('input');
            if (inp) { inp.focus(); }
          }
        }
      });
    }
  }

  /* Refresh the background colour of a row after a label change
     without destroying focus on other cells. */
  function ttRefreshRowStyle(periodId, newLabel) {
    var inputs = document.querySelectorAll('[data-tt-label="' + periodId + '"]');
    if (!inputs.length) return;
    var row = inputs[0].closest('tr');
    if (!row) return;
    row.style.background = ttIsBreak(newLabel) ? '#f0fdf4' : '';
  }

  /* ── Utility ────────────────────────────────────────────────────── */
  function ttFindPeriod(id) {
    return ttData.periods.find(function (p) { return p.id === id; }) || null;
  }

  /* ── Public entry-point ─────────────────────────────────────────── */
  window.ttRender = function () {
    ttLoad();
    ttRenderInner();
  };

}());
