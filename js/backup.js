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
function exportAll(){
  const dump = {};
  allClassDataKeys().forEach(k => { try { dump[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} });
  dump._meta = { app:'Classroom Hub', exportedAt:new Date().toISOString(), ver:1,
    ownerUid:(window.CLOUD && window.CLOUD.uid) || null, ownerEmail:(window.CLOUD && window.CLOUD.email) || null };
  download('classroom-hub-backup-' + todayISO() + '.json', JSON.stringify(dump, null, 2));
}
function importAll(ev){
  const file = ev.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      Object.keys(d).forEach(k => {
        if (k === '_meta' || d[k] === undefined || d[k] === null) return;
        if (DATA_KEYS.indexOf(tpKeyBase(k)) < 0) return;          // ignore unknown keys
        localStorage.setItem(k, JSON.stringify(d[k]));            // restore suffixed keys verbatim
      });
      alert('Backup restored. Reloading.');
      location.reload();
    } catch { alert('That does not look like a valid backup file.'); }
  };
  r.readAsText(file);
}
function wipeAll(){
  if (!confirm('Delete ALL Classroom Hub data (every class) from this browser? This cannot be undone.')) return;
  if (!confirm('Really sure? Export a backup first if unsure.')) return;
  allClassDataKeys().forEach(k => localStorage.removeItem(k));
  try { localStorage.removeItem('tp_active_class'); } catch (e) {}
  location.reload();
}
