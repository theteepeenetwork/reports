/* roster.js — CLASS LIST (ROSTER)
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   CLASS LIST (ROSTER)
   =================================================================== */
function rosAdd(){
  const inp = document.getElementById('rosNew');
  const name = inp.value.trim();
  if (!name) return;
  roster.push({ id: uid(), name, gender: '', pronouns: 'neutral', send: 'None', pp: false, ehcpLink: '', notes: '', behaviour: '', allergies: false, allergyNotes: '', medical: false, medicalNotes: '' });
  inp.value = '';
  saveRoster(); rosRender(); syncPupilSelectors();
}
function rosBulkAdd(){
  const lines = document.getElementById('rosBulk').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  lines.forEach(name => roster.push({ id: uid(), name, gender:'', pronouns:'neutral', send:'None', pp:false, ehcpLink:'', notes:'', behaviour:'', allergies:false, allergyNotes:'', medical:false, medicalNotes:'' }));
  document.getElementById('rosBulk').value = '';
  saveRoster(); rosRender(); syncPupilSelectors();
}
function rosSeed(){
  if (roster.length && !confirm('Add the 29 sample pupils to your current list?')) return;
  SAMPLE_NAMES.forEach(name => roster.push({ id: uid(), name, gender:'', pronouns:'neutral', send:'None', pp:false, ehcpLink:'', notes:'', behaviour:'', allergies:false, allergyNotes:'', medical:false, medicalNotes:'' }));
  saveRoster(); rosRender(); syncPupilSelectors();
}
function rosDelete(id){
  if (!confirm('Remove this pupil from the class list?')) return;
  roster = roster.filter(p => p.id !== id);
  saveRoster(); rosRender(); syncPupilSelectors();
}
function rosEdit(id, field, value){
  const p = roster.find(p => p.id === id); if (!p) return;
  p[field] = value; saveRoster();
}
function rosRender(){
  document.getElementById('rosCount').textContent = roster.length;
  const t = document.getElementById('rosTable');
  if (!roster.length){ t.innerHTML = '<tr><td class="empty">No pupils yet. Add names above or load the sample class.</td></tr>'; return; }
  let h = '<tr><th>Name</th><th>Gender</th><th>Pronouns</th><th>Attendance</th><th></th></tr>';
  sortedRoster().forEach(p => {
    h += `<tr>
      <td><input value="${esc(p.name)}" onchange="rosEdit('${p.id}','name',this.value);refreshNames()" /></td>
      <td><select onchange="rosEdit('${p.id}','gender',this.value)">
        ${opt('','—',p.gender||'')}${opt('Boy','Boy',p.gender||'')}${opt('Girl','Girl',p.gender||'')}
      </select></td>
      <td><select onchange="rosEdit('${p.id}','pronouns',this.value)">
        ${opt('female','she/her',p.pronouns)}${opt('male','he/him',p.pronouns)}${opt('neutral','they/them',p.pronouns)}
      </select></td>
      <td><button class="ros-abs${p.absent ? ' on' : ''}" onclick="rosToggleAbsent('${p.id}')" title="Absent pupils are greyed out in Glow Getters and sit out of battles">${p.absent ? '🚫 Absent' : '✓ Present'}</button></td>
      <td class="num"><button class="danger small" onclick="rosDelete('${p.id}')">✕</button></td>
    </tr>`;
  });
  t.innerHTML = h;
}
function rosToggleAbsent(id){
  const p = roster.find(p => p.id === id); if (!p) return;
  p.absent = !p.absent; saveRoster();
  window.dispatchEvent(new CustomEvent('tp:sync', { detail:{ key:'tp_roster', source:'local' } }));
}
function refreshNames(){ saveRoster(); window.dispatchEvent(new CustomEvent('tp:sync', { detail:{ key:'tp_roster', source:'local' } })); }

/* One redraw path: any data change (local edit, another tab, or cloud) fires
   'tp:sync'; refresh the pupil selectors and re-render whichever page is open. */
window.addEventListener('tp:sync', function(e){
  var key = e && e.detail && e.detail.key;
  var base = (typeof tpKeyBase === 'function' && key) ? tpKeyBase(key) : key;
  if (base === 'tp_profile' && typeof applyProfile === 'function') applyProfile();
  if ((base === 'tp_classes' || base === 'tp_profile') && typeof applyClass === 'function') applyClass();
  if (typeof syncPupilSelectors === 'function') syncPupilSelectors();
  var active = document.querySelector('.page.active');
  if (active && typeof renderPage === 'function') renderPage(active.id.replace('page-', ''));
});
