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
  msSave(); msUpdateAvg(pid);
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
  head += '<th class="num">Avg</th></tr>';

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
    body += `<td class="total-cell" id="avg-${p.id}">${msAvg(p.id)}</td></tr>`;
  });
  if (!b.dates.length) body = `<tr><td class="name">${roster.length} pupils</td><td class="empty">Add a date column above to start recording →</td><td></td></tr>`;
  t.innerHTML = head + body;
}
