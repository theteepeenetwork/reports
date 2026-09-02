/* starters.js — MENTAL STARTERS
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   MENTAL STARTERS
   =================================================================== */
// data: { 'Summer 2': { max:22, dates:[iso...], scores:{ pupilId:{ iso:{v:Number,ipad:Bool} } } } }
let msData = Store.get('tp_starters', {});
function msHT(){ return document.getElementById('msHalfTerm').value || 'Autumn 1'; }
function msBlock(){
  const ht = msHT();
  if (!msData[ht]) msData[ht] = { max: 22, dates: [], scores: {} };
  return msData[ht];
}
function msSave(){ Store.set('tp_starters', msData); }
function msSetMax(){ msBlock().max = Number(document.getElementById('msMax').value) || 22; msSave(); }
function msAddDate(){
  const d = document.getElementById('msNewDate').value || new Date().toISOString().slice(0,10);
  const b = msBlock();
  if (!b.dates.includes(d)) b.dates.push(d);
  b.dates.sort();
  msSave(); msRender();
}
function msDelDate(d){
  if (!confirm('Remove the column for ' + fmtDate(d) + '?')) return;
  const b = msBlock();
  b.dates = b.dates.filter(x => x !== d);
  Object.values(b.scores).forEach(row => delete row[d]);
  msSave(); msRender();
}
function msSet(pid, d, v){
  const b = msBlock();
  if (!b.scores[pid]) b.scores[pid] = {};
  if (!b.scores[pid][d]) b.scores[pid][d] = { v: null, ipad: false };
  b.scores[pid][d].v = v === '' ? null : Number(v);
  msSave(); msUpdateRow(pid);
}
function msToggleIpad(pid, d, btn){
  const b = msBlock();
  if (!b.scores[pid]) b.scores[pid] = {};
  if (!b.scores[pid][d]) b.scores[pid][d] = { v: null, ipad: false };
  const on = !b.scores[pid][d].ipad;
  b.scores[pid][d].ipad = on;
  btn.parentNode.classList.toggle('reward', on);
  btn.classList.toggle('on', on);
  btn.textContent = '📱' + (on ? ' iPad' : '');
  msSave();
}
/* ── Recent scores, for spotting an odd morning ──────────────────────
   The table already carries every date as a column, but once a half-term
   has a dozen of them you are scanning sideways to answer "is this normal
   for this child?". These two put the last five together in one place. */

/* The five most recent scores for a pupil, oldest first. Dates with no score
   are skipped rather than shown as blanks: an absence is not a data point,
   and padding the row makes a pattern harder to read, not easier. */
function msRecent(pid, n){
  const b = msBlock(), row = b.scores[pid] || {};
  const out = [];
  for (let i = b.dates.length - 1; i >= 0 && out.length < n; i--){
    const d = b.dates[i], c = row[d];
    if (c && c.v != null) out.unshift({ d: d, v: c.v });
  }
  return out;
}

/* Mark scores sitting well away from this pupil's own recent middle:
   -1 below, 1 above, 0 ordinary. Compared against the MEDIAN, not the mean,
   so one odd score cannot drag the baseline towards itself and hide the next
   one. The threshold is deliberately blunt -- a quarter of the paper, and
   never less than 4 marks -- because this is a nudge to look at a child, not
   a measurement of them. Fewer than three scores marks nothing: there is no
   normal to be unusual against yet. */
function msOutliers(vals, max){
  if (vals.length < 3) return vals.map(() => 0);
  const sorted = vals.slice().sort((a, b) => a - b);
  const half = sorted.length / 2;
  const mid = sorted.length % 2 ? sorted[Math.floor(half)]
                                : (sorted[half - 1] + sorted[half]) / 2;
  const gap = Math.max(4, Math.round((max || 20) * 0.25));
  return vals.map(v => v <= mid - gap ? -1 : (v >= mid + gap ? 1 : 0));
}

function msRecentHTML(pid){
  const b = msBlock();
  const recent = msRecent(pid, 5);
  if (!recent.length) return '<span class="muted small">—</span>';
  const flags = msOutliers(recent.map(r => r.v), b.max);
  return recent.map((r, i) => {
    const f = flags[i];
    const style = f === 0 ? 'color:var(--muted)'
      : 'font-weight:800;' + (f < 0 ? 'color:#b4232a' : 'color:#1a7f43');
    const mark = f === 0 ? '' : (f < 0 ? ' ▼' : ' ▲');
    const title = fmtDate(r.d) + ': ' + r.v + (f === 0 ? '' : ' — well ' + (f < 0 ? 'below' : 'above') + ' their recent scores');
    return '<span title="' + esc(title) + '" style="' + style + '">' + r.v + mark + '</span>';
  }).join('<span style="color:var(--line)"> · </span>');
}

function msUpdateRow(pid){
  msUpdateAvg(pid);
  const el = document.getElementById('recent-' + pid);
  if (el) el.innerHTML = msRecentHTML(pid);
}

function msAvg(pid){
  const b = msBlock(); const row = b.scores[pid] || {};
  const vals = b.dates.map(d => row[d] && row[d].v != null ? row[d].v : null).filter(v => v != null);
  if (!vals.length) return '';
  return (vals.reduce((a,c) => a+c,0) / vals.length).toFixed(1);
}
function msUpdateAvg(pid){
  const el = document.getElementById('avg-' + pid);
  if (el) el.textContent = msAvg(pid);
}
function msRender(){
  // populate half-term selector
  const sel = document.getElementById('msHalfTerm');
  if (!sel.options.length){ sel.innerHTML = HALF_TERMS.map(h => `<option>${h}</option>`).join(''); sel.value = 'Summer 2'; }
  const b = msBlock();
  document.getElementById('msMax').value = b.max;
  const t = document.getElementById('msTable');
  if (!roster.length){ t.innerHTML = '<tr><td class="empty">Add pupils on the Class List page first.</td></tr>'; return; }

  let head = '<tr><th class="name">Pupil</th>';
  b.dates.forEach(d => head += `<th class="num">${fmtDate(d)}<br><button class="danger small no-print" style="padding:0 .4rem" onclick="msDelDate('${d}')">✕</button></th>`);
  head += '<th class="num" title="This pupil\'s last five scores, oldest first. ▼ or ▲ marks one a quarter of the paper away from their own middle score.">Last 5</th><th class="num">Avg</th></tr>';

  let body = '';
  sortedRoster().forEach(p => {
    const row = b.scores[p.id] || {};
    body += `<tr><td class="name">${esc(p.name)}</td>`;
    b.dates.forEach(d => {
      const cell = row[d] || {};
      const rewardCls = cell.ipad ? ' reward' : '';
      const onCls = cell.ipad ? ' on' : '';
      body += `<td class="ms-cell num${rewardCls}">
        <input type="number" min="0" value="${cell.v != null ? cell.v : ''}" onchange="msSet('${p.id}','${d}',this.value)" />
        <button class="ipad-btn${onCls}" title="Did this pupil earn an iPad this morning?" onclick="msToggleIpad('${p.id}','${d}',this)">📱${cell.ipad ? ' iPad' : ''}</button>
      </td>`;
    });
    body += `<td class="num no-print" id="recent-${p.id}" style="white-space:nowrap;font-size:12px">${msRecentHTML(p.id)}</td>`;
    body += `<td class="total-cell" id="avg-${p.id}">${msAvg(p.id)}</td></tr>`;
  });
  if (!b.dates.length) body = `<tr><td class="name">${roster.length} pupils</td><td class="empty">Add a date column above to start recording →</td><td></td><td></td></tr>`;
  t.innerHTML = head + body;
}
