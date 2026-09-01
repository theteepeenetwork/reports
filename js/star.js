/* star.js — STAR PUPIL
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   STAR PUPIL
   =================================================================== */
let spData = Store.get('tp_star', []); // [{id,date,pupilId,reason}]
function spSave(){ Store.set('tp_star', spData); }
function spAdd(){
  const date = document.getElementById('spDate').value || todayISO();
  const pupilId = document.getElementById('spPupil').value;
  const reason = document.getElementById('spReason').value.trim();
  if (!pupilId){ alert('Add pupils on the Class List page first.'); return; }
  spData.push({ id: uid(), date, pupilId, reason });
  document.getElementById('spReason').value = '';
  spSave(); spRender();
}
function spDelete(id){ spData = spData.filter(e => e.id !== id); spSave(); spRender(); }
function spRender(){
  const tally = {};
  spData.forEach(e => tally[e.pupilId] = (tally[e.pupilId]||0) + 1);
  const tEl = document.getElementById('spTally');
  if (!roster.length){ tEl.innerHTML = '<p class="empty">Add pupils on the Class List page first.</p>'; }
  else {
    tEl.innerHTML = sortedRoster().map(p => {
      const n = tally[p.id] || 0;
      return `<span class="pill" style="margin:.15rem;background:${n?'var(--soft)':'#f3f4f6'};color:${n?'var(--accent-dark)':'#9ca3af'}">${esc(p.name)} · ${n}</span>`;
    }).join(' ');
  }
  const table = document.getElementById('spTable');
  if (!spData.length){ table.innerHTML = '<tr><td class="empty">No star pupils logged yet.</td></tr>'; return; }
  let h = '<tr><th>Date</th><th>Pupil</th><th>Reason</th><th class="no-print"></th></tr>';
  [...spData].sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
    h += `<tr><td>${fmtDate(e.date)}</td><td>${esc(pupilName(e.pupilId))}</td><td>${esc(e.reason)}</td>
      <td class="num no-print"><button class="danger small" onclick="spDelete('${e.id}')">✕</button></td></tr>`;
  });
  table.innerHTML = h;
}
