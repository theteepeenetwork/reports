/* backup.js — DATA EXPORT / IMPORT
   Owner: Data (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   DATA EXPORT / IMPORT
   =================================================================== */
const DATA_KEYS = ['tp_roster','tp_starters','tp_star','tp_behaviour','tp_assess','tp_marking','tp_timetable','tp_seating','tp_groups','tp_generator','tp_profile','tp_battler','tp_report_sel','reportBuilderChildren','tp_picker','tp_starter_cfg','tp_starter_weeks','tp_starter_cleared','tp_classes'];
/* Every physical localStorage key (across ALL classes) whose base is a synced
   data key — backups are whole-account, not just the active class. */
function allClassDataKeys(){
  const out = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i); if (!k) continue;
    if (DATA_KEYS.indexOf(tpKeyBase(k)) >= 0) out.push(k);
  }
  return out;
}
/* Build the backup payload. Split out from exportAll so the round-trip can be
   tested without driving a download and a file picker. */
function buildBackup(){
  const dump = {};
  allClassDataKeys().forEach(k => { try { dump[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} });
  /* activeClass rides in _meta, NOT in DATA_KEYS. tp_active_class is
     per-device and must never sync, so it cannot become a data key -- but
     leaving it out of the backup entirely is why restoring one always dropped
     the teacher on an empty 'default'. ver 2 marks backups that carry it. */
  dump._meta = { app:'Classroom Hub', exportedAt:new Date().toISOString(), ver:2,
    activeClass:(typeof activeClassId === 'function') ? activeClassId() : 'default',
    ownerUid:(window.CLOUD && window.CLOUD.uid) || null, ownerEmail:(window.CLOUD && window.CLOUD.email) || null };
  return dump;
}
function exportAll(){
  download('classroom-hub-backup-' + todayISO() + '.json', JSON.stringify(buildBackup(), null, 2));
}
function importAll(ev){
  const file = ev.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      applyBackup(JSON.parse(e.target.result));
      alert('Backup restored. Reloading.');
      location.reload();
    } catch { alert('That does not look like a valid backup file.'); }
  };
  r.readAsText(file);
}
/* Write a backup payload into localStorage. Returns false if it is not one. */
function applyBackup(d){
  if (!d || typeof d !== 'object') return false;
  Object.keys(d).forEach(k => {
    if (k === '_meta' || d[k] === undefined || d[k] === null) return;
    if (DATA_KEYS.indexOf(tpKeyBase(k)) < 0) return;          // ignore unknown keys
    localStorage.setItem(k, JSON.stringify(d[k]));            // restore suffixed keys verbatim
  });
  /* Follow the recorded class only if it actually came back with the data.
     A stale pointer would strand the teacher again, which is the whole bug. */
  const want = d._meta && d._meta.activeClass;
  if (want && typeof setActiveClass === 'function' && typeof getClasses === 'function' &&
      getClasses().some(c => c && c.id === want)) setActiveClass(want);
  return true;
}
window.buildBackup = buildBackup;
window.applyBackup = applyBackup;

function wipeAll(){
  if (!confirm('Delete ALL Classroom Hub data (every class) from this browser? This cannot be undone.')) return;
  if (!confirm('Really sure? Export a backup first if unsure.')) return;
  allClassDataKeys().forEach(k => localStorage.removeItem(k));
  try { localStorage.removeItem('tp_active_class'); } catch (e) {}
  location.reload();
}
