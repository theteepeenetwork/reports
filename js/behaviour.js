/* behaviour.js — BEHAVIOUR LOG
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   BEHAVIOUR LOG
   =================================================================== */
let bhData = Store.get('tp_behaviour', []); // [{id,date,pupilId,type,note}]
function bhSave(){ Store.set('tp_behaviour', bhData); }
function bhAdd(){
  const date = document.getElementById('bhDate').value || todayISO();
  const pupilId = document.getElementById('bhPupil').value;
  const type = document.getElementById('bhType').value;
  const note = document.getElementById('bhNote').value.trim();
  if (!pupilId){ alert('Add pupils on the Class List page first.'); return; }
  if (!note) return;
  bhData.push({ id: uid(), date, pupilId, type, note });
  document.getElementById('bhNote').value = '';
  bhSave(); bhRender();
}
function bhDelete(id){ bhData = bhData.filter(e => e.id !== id); bhSave(); bhRender(); }
function bhRender(){
  const filter = document.getElementById('bhFilter').value;
  const table = document.getElementById('bhTable');
  let rows = [...bhData].sort((a,b) => b.date.localeCompare(a.date));
  if (filter) rows = rows.filter(e => e.pupilId === filter);
  if (!rows.length){ table.innerHTML = '<tr><td class="empty">No entries yet.</td></tr>'; return; }
  const icon = { positive:'👍', concern:'⚠️', note:'📝' };
  let h = '<tr><th>Date</th><th>Pupil</th><th>Type</th><th>Note</th><th class="no-print"></th></tr>';
  rows.forEach(e => {
    h += `<tr><td>${fmtDate(e.date)}</td><td>${esc(pupilName(e.pupilId))}</td><td>${icon[e.type]||''} ${e.type}</td><td>${esc(e.note)}</td>
      <td class="num no-print"><button class="danger small" onclick="bhDelete('${e.id}')">✕</button></td></tr>`;
  });
  table.innerHTML = h;
}
