/* ============================================================
   charts.js — Progress Charts for Classroom Hub
   Global function: chRender()
   Store key: 'tp_assess'  (read-only)
   All module identifiers prefixed "ch"
   ============================================================ */

(function () {

  /* ── State ──────────────────────────────────────────────── */
  var chSelectedPupil = '__avg__'; // '__avg__' or a pupil id string

  /* ── Metric definitions ─────────────────────────────────── */
  var chMetrics = [
    { key: 'num',  label: 'Numeracy', colour: '#2563eb' },
    { key: 'read', label: 'Reading',  colour: '#16a34a' },
    { key: 'spag', label: 'SPAG',     colour: '#7c3aed' }
  ];

  /* ── Compute per-pupil per-term totals ───────────────────── */
  function chGetTotal(termData, pupilId, metric) {
    if (!termData || !termData[pupilId]) return null;
    var d = termData[pupilId];
    if (metric === 'num') {
      if (d.num1 == null && d.num2 == null) return null;
      return (d.num1 || 0) + (d.num2 || 0);
    }
    if (metric === 'read') {
      if (d.read1 == null && d.read2 == null) return null;
      return (d.read1 || 0) + (d.read2 || 0);
    }
    if (metric === 'spag') {
      if (d.spag == null && d.spell == null) return null;
      return (d.spag || 0) + (d.spell || 0);
    }
    return null;
  }

  /* ── Build the four-term series for one pupil or class avg ─ */
  function chBuildSeries(assess) {
    var series = {}; // metric -> [val|null, val|null, val|null, val|null]
    chMetrics.forEach(function (m) {
      series[m.key] = ASSESS_TERMS.map(function (term) {
        var termData = assess[term] || {};
        if (chSelectedPupil === '__avg__') {
          // average over all pupils who have data
          var sum = 0, count = 0;
          Object.keys(termData).forEach(function (pid) {
            var v = chGetTotal(termData, pid, m.key);
            if (v !== null) { sum += v; count++; }
          });
          return count > 0 ? sum / count : null;
        } else {
          return chGetTotal(termData, chSelectedPupil, m.key);
        }
      });
    });
    return series;
  }

  /* ── Find the global maximum across all series ──────────── */
  function chDataMax(series) {
    var max = 0;
    chMetrics.forEach(function (m) {
      series[m.key].forEach(function (v) {
        if (v !== null && v > max) max = v;
      });
    });
    return max;
  }

  /* ── Round y-axis ceiling up to a sensible value ─────────── */
  function chNiceMax(rawMax) {
    if (rawMax <= 0) return 10;
    var step = Math.pow(10, Math.floor(Math.log(rawMax) / Math.LN10));
    var nice = Math.ceil(rawMax / step) * step;
    // prefer increments divisible by 5
    if (nice / step < 3) {
      step = step / 2;
      nice = Math.ceil(rawMax / step) * step;
    }
    return nice;
  }

  /* ── Build SVG string ─────────────────────────────────────── */
  function chBuildSVG(series) {
    var W = 800, H = 360;
    var padL = 52, padR = 28, padT = 28, padB = 52;
    var chartW = W - padL - padR;
    var chartH = H - padT - padB;

    var rawMax = chDataMax(series);
    var yMax = chNiceMax(rawMax);

    var numTerms = ASSESS_TERMS.length; // 4
    // x positions for each term index
    function xPos(i) {
      return padL + (i / (numTerms - 1)) * chartW;
    }
    function yPos(v) {
      return padT + chartH - (v / yMax) * chartH;
    }

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg"'
      + ' style="width:100%;height:auto;display:block;font-family:Arial,Helvetica,sans-serif;">');

    // ── Background
    svg.push('<rect width="' + W + '" height="' + H + '" fill="#f6f7fb" rx="12"/>');

    // ── Gridlines + y-axis ticks
    var numYTicks = 5;
    for (var t = 0; t <= numYTicks; t++) {
      var yVal = (yMax / numYTicks) * t;
      var gy = yPos(yVal);
      // gridline
      svg.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy
        + '" stroke="#e5e7eb" stroke-width="1"/>');
      // tick label
      var label = Number.isInteger(yVal) ? yVal : yVal.toFixed(1);
      svg.push('<text x="' + (padL - 6) + '" y="' + (gy + 4) + '"'
        + ' text-anchor="end" font-size="11" fill="#6b7280">' + label + '</text>');
    }

    // ── Vertical gridlines at each term
    for (var i = 0; i < numTerms; i++) {
      var gx = xPos(i);
      svg.push('<line x1="' + gx + '" y1="' + padT + '" x2="' + gx + '" y2="' + (padT + chartH)
        + '" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,3"/>');
    }

    // ── Axes
    // y-axis
    svg.push('<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + chartH)
      + '" stroke="#d1d5db" stroke-width="1.5"/>');
    // x-axis
    svg.push('<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (W - padR) + '" y2="' + (padT + chartH)
      + '" stroke="#d1d5db" stroke-width="1.5"/>');

    // ── X-axis term labels
    for (var i = 0; i < numTerms; i++) {
      svg.push('<text x="' + xPos(i) + '" y="' + (padT + chartH + 20) + '"'
        + ' text-anchor="middle" font-size="12" fill="#374151" font-weight="600">'
        + esc(ASSESS_TERMS[i]) + '</text>');
    }

    // ── Draw each metric line + points
    chMetrics.forEach(function (m) {
      var vals = series[m.key];
      // Build polyline segments (split on null values)
      var segments = [];
      var currentSeg = [];
      for (var i = 0; i < numTerms; i++) {
        if (vals[i] !== null) {
          currentSeg.push(i);
        } else {
          if (currentSeg.length > 0) {
            segments.push(currentSeg);
            currentSeg = [];
          }
        }
      }
      if (currentSeg.length > 0) segments.push(currentSeg);

      // Draw line segments (only draw a line if segment has >= 2 points)
      segments.forEach(function (seg) {
        if (seg.length < 2) return;
        var points = seg.map(function (i) {
          return xPos(i) + ',' + yPos(vals[i]);
        }).join(' ');
        svg.push('<polyline points="' + points + '"'
          + ' fill="none" stroke="' + m.colour + '" stroke-width="2.5"'
          + ' stroke-linejoin="round" stroke-linecap="round"/>');
      });

      // Draw points and labels for all non-null values
      for (var i = 0; i < numTerms; i++) {
        if (vals[i] === null) continue;
        var cx = xPos(i);
        var cy = yPos(vals[i]);
        // outer white ring + coloured dot
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="6"'
          + ' fill="white" stroke="' + m.colour + '" stroke-width="2.5"/>');
        svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="3"'
          + ' fill="' + m.colour + '"/>');
        // value label
        var labelVal = Number.isInteger(vals[i]) ? vals[i] : vals[i].toFixed(1);
        // position label above point (or below if near top)
        var labelY = cy > padT + 18 ? cy - 10 : cy + 18;
        svg.push('<text x="' + cx + '" y="' + labelY + '"'
          + ' text-anchor="middle" font-size="10" font-weight="700"'
          + ' fill="' + m.colour + '">' + labelVal + '</text>');
      }
    });

    // ── Legend (top-right area)
    var legX = padL + chartW - 180;
    var legY = padT + 4;
    svg.push('<rect x="' + legX + '" y="' + legY + '" width="172" height="' + (chMetrics.length * 20 + 10)
      + '" rx="8" fill="white" fill-opacity="0.9" stroke="#e5e7eb" stroke-width="1"/>');
    chMetrics.forEach(function (m, idx) {
      var lx = legX + 10;
      var ly = legY + 10 + idx * 20;
      svg.push('<line x1="' + lx + '" y1="' + (ly + 6) + '" x2="' + (lx + 20) + '" y2="' + (ly + 6)
        + '" stroke="' + m.colour + '" stroke-width="2.5" stroke-linecap="round"/>');
      svg.push('<circle cx="' + (lx + 10) + '" cy="' + (ly + 6) + '" r="4"'
        + ' fill="white" stroke="' + m.colour + '" stroke-width="2"/>');
      svg.push('<text x="' + (lx + 26) + '" y="' + (ly + 11) + '"'
        + ' font-size="12" fill="#374151">' + esc(m.label) + '</text>');
    });

    // ── Y-axis label
    var axLabelX = 13;
    var axLabelY = padT + chartH / 2;
    svg.push('<text x="' + axLabelX + '" y="' + axLabelY + '" text-anchor="middle"'
      + ' font-size="11" fill="#6b7280"'
      + ' transform="rotate(-90,' + axLabelX + ',' + axLabelY + ')">Score</text>');

    svg.push('</svg>');
    return svg.join('\n');
  }

  /* ── Check whether any assessment data exists at all ─────── */
  function chHasAnyData(assess) {
    return ASSESS_TERMS.some(function (term) {
      var td = assess[term] || {};
      return Object.keys(td).length > 0;
    });
  }

  /* ── Main render ─────────────────────────────────────────── */
  function chRender() {
    var root = document.getElementById('ch-root');
    if (!root) return;

    var assess = Store.get('tp_assess', {});
    var r = sortedRoster();

    // Empty state
    if (!r.length || !chHasAnyData(assess)) {
      root.innerHTML = '<div class="card"><p class="empty">No progress data yet — enter assessment scores in the <b>Assessments</b> section first.</p></div>';
      return;
    }

    // Clamp selected pupil to a valid id (or avg)
    if (chSelectedPupil !== '__avg__' && !roster.find(function (p) { return p.id === chSelectedPupil; })) {
      chSelectedPupil = '__avg__';
    }

    // ── Controls card
    var selectOptions = '<option value="__avg__"' + opt('__avg__', 'Class average', chSelectedPupil) + '>Class average</option>';
    r.forEach(function (p) {
      selectOptions += '<option value="' + esc(p.id) + '"' + (chSelectedPupil === p.id ? ' selected' : '') + '>'
        + esc(p.name) + '</option>';
    });

    var controlsHtml = '<div class="card">'
      + '<div class="row" style="align-items:flex-end;gap:.75rem;">'
      + '<div class="grow" style="max-width:280px;">'
      + '<label for="ch-pupil-sel">Showing progress for</label>'
      + '<select id="ch-pupil-sel" onchange="chHandleSelect(this.value)">'
      + selectOptions
      + '</select>'
      + '</div>'
      + '</div>'
      + '</div>';

    // ── Chart card
    var series = chBuildSeries(assess);
    var rawMax = chDataMax(series);

    var titleName = chSelectedPupil === '__avg__'
      ? 'Class Average'
      : (pupilName(chSelectedPupil) || 'Unknown');

    var chartHtml;
    if (rawMax === 0) {
      chartHtml = '<div class="card"><p class="empty">No scores recorded for <b>' + esc(titleName) + '</b> yet.</p></div>';
    } else {
      chartHtml = '<div class="card">'
        + '<h2 style="margin-bottom:.8rem;font-size:1.1rem;color:#374151;">Progress: ' + esc(titleName) + '</h2>'
        + chBuildSVG(series)
        + '</div>';
    }

    root.innerHTML = controlsHtml + chartHtml;
  }

  /* ── Exposed select handler (called from inline onchange) ── */
  window.chHandleSelect = function (val) {
    chSelectedPupil = val;
    chRender();
  };

  /* ── Expose render globally ─────────────────────────────── */
  window.chRender = chRender;

})();
