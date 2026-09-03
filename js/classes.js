/* classes.js — CLASS REGISTRY (multi-class). The active class is per-device
   Owner: Data (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   CLASS REGISTRY (multi-class). The active class is per-device
   (tp_active_class); the registry (tp_classes) is shared & synced.
   The first class keeps un-suffixed keys (id 'default') for back-compat.
   =================================================================== */
function getClasses(){ const cs = Store.get('tp_classes', null); return Array.isArray(cs) ? cs : []; }
function saveClasses(cs){ Store.set('tp_classes', cs); }
function activeClassId(){ const id = Store.get('tp_active_class', 'default'); return (typeof id === 'string' && id) ? id : 'default'; }
function setActiveClass(id){ Store.set('tp_active_class', id || 'default'); }
function activeClass(){ const id = activeClassId(); return getClasses().filter(c => c && c.id === id)[0] || null; }

/* Is a class genuinely chosen on this device? activeClassId() answers
   'default' when the pointer is absent, which is the right thing for routing
   keys and the wrong thing for telling the teacher where they are. */
function activeClassIsSet(){ return typeof Store.get('tp_active_class', null) === 'string'; }

/* Class ids that own per-class data but have no row in the registry.
   Normally empty: deleting a class drops its keys and its row together. It
   fills when the two fall out of step -- a stale registry arriving from the
   cloud, or a backup restoring data without the class it belonged to. */
function orphanedClassIds(){
  const known = getClasses().map(c => c && c.id);
  const out = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i); if (!k) continue;
    const at = k.indexOf('::'); if (at < 0) continue;
    const base = k.slice(0, at), id = k.slice(at + 2);
    if (!id || known.indexOf(id) >= 0 || out.indexOf(id) >= 0) continue;
    if (TP_PER_CLASS.indexOf(base) >= 0) out.push(id);
  }
  return out;
}

function classHasPupils(id){
  try {
    const raw = localStorage.getItem(classPhysKey('tp_roster', id));
    const r = raw ? JSON.parse(raw) : null;
    return Array.isArray(r) && r.length > 0;
  } catch (e) { return false; }
}

/* Put orphaned classes back in the registry so the switcher can reach them,
   and move to one only when the teacher is sitting in a class holding nothing.

   Registering is what makes the data reachable at all; switching is what stops
   a teacher staring at an empty app and reaching for a backup. We only switch
   when there is exactly one candidate, so the app never guesses between two.

   Tradeoff, deliberate: if another device deletes a class and its key removals
   arrive after the registry change, this can briefly re-register that class.
   Showing a class the teacher can delete again beats silently hiding 36KB of
   their work, which is the failure this exists to prevent. */
function recoverOrphanedClasses(){
  const orphans = orphanedClassIds();
  if (!orphans.length) return [];
  const cs = getClasses();
  orphans.forEach((id, i) => {
    cs.push({ id, name:'Recovered class' + (orphans.length > 1 ? ' ' + (i + 1) : ''),
              year:'', room:'', createdAt:Date.now(), recovered:true });
  });
  saveClasses(cs);
  if (!classHasPupils(activeClassId())){
    const withPupils = orphans.filter(classHasPupils);
    if (withPupils.length === 1) setActiveClass(withPupils[0]);
  }
  return orphans;
}

/* Seed the registry from the legacy single class on first run. Idempotent. */
function ensureClasses(){
  let cs = getClasses();
  if (!cs.length){
    cs = [{ id:'default', name:(profile.yearGroup || 'My class'), year:(profile.yearGroup || ''), room:(profile.room || ''), createdAt:Date.now() }];
    saveClasses(cs);
  }
  if (!cs.some(c => c && c.id === activeClassId())) setActiveClass('default');   // recover dangling pointer
  recoverOrphanedClasses();
}

function classPhysKey(base, id){ return (!id || id === 'default') ? base : base + '::' + id; }

/* Copy structural setup (question generator whole; Glow Getters config only)
   from the current class into a new class's keys. Pupils stay empty. */
function seedClassConfig(newId){
  try {
    const gen = localStorage.getItem(tpPhysicalKey('tp_generator'));
    if (gen != null) localStorage.setItem(classPhysKey('tp_generator', newId), gen);
  } catch (e) {}
  try {
    const raw = localStorage.getItem(tpPhysicalKey('tp_battler'));
    if (raw != null){
      const bat = JSON.parse(raw);
      if (bat && typeof bat === 'object'){
        bat.points = {}; bat.badges = {}; bat.placements = {}; bat.daily = {}; bat.recent = [];
        if (bat.boss) bat.boss = Object.assign({}, bat.boss, { dealt:0, active:false });
        localStorage.setItem(classPhysKey('tp_battler', newId), JSON.stringify(bat));
      }
    }
  } catch (e) {}
}

function createClass(meta){
  meta = meta || {};
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const cs = getClasses();
  cs.push({ id, name:(meta.name || 'New class'), year:(meta.year || ''), room:(meta.room || ''), createdAt:Date.now() });
  saveClasses(cs);
  seedClassConfig(id);
  return id;
}
function renameClass(id, patch){ const cs = getClasses(); const c = cs.filter(x => x.id === id)[0]; if (!c) return; Object.assign(c, patch); saveClasses(cs); }

/* Remove every physical key for a class, locally and (if signed in) in the cloud. */
function removeClassKeys(id){
  if (!id || id === 'default') return;
  const suffix = '::' + id;
  const kill = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if (k && k.slice(-suffix.length) === suffix && tpKeyBase(k) !== k && TP_PER_CLASS.indexOf(tpKeyBase(k)) >= 0) kill.push(k);
  }
  kill.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} if (typeof window.cloudRemoveKey === 'function') window.cloudRemoveKey(k); });
}
function deleteClass(id){
  if (id === 'default') return false;
  const cs = getClasses(); if (cs.length <= 1) return false;
  const left = cs.filter(c => c.id !== id);
  saveClasses(left);
  removeClassKeys(id);
  /* Fall back to a class that still exists, preferring one with pupils in it.
     This used to be a hard-coded 'default', which strands the teacher whenever
     'default' is an empty shell -- exactly what happened on 2 Sep 2026. Taking
     the first survivor is not enough either: 'default' sorts first, so an empty
     'default' would still win over the class they actually teach. */
  if (activeClassId() === id){
    const occupied = left.filter(c => c && classHasPupils(c.id));
    setActiveClass((occupied[0] || left[0]).id);
  }
  return true;
}

function applyProfile(){
  setText('sideAvatar', initials(profile.name));
  setText('sideWho', profile.name || '—');
  setText('sideRole', profile.title || '');
  const greet = document.getElementById('dashGreeting');
  if (greet) greet.textContent = 'Welcome back' + (profile.name ? ', ' + profile.name : '');
}

/* Active-class identity in the sidebar brand (the brand opens the switcher). */
function applyClass(){
  const c = activeClass() || { name:'', year:'', room:'' };
  setText('brandSub', [c.name, c.room].filter(Boolean).join(' · ') || 'Classroom Hub');
  const brand = document.querySelector('#planApp .brand');
  if (brand && !brand._classWired){ brand.style.cursor = 'pointer'; brand.title = 'Switch class'; brand.onclick = openClassSwitcher; brand._classWired = true; }
  ensureClassOpener();
  if (typeof setText === 'function') setText('teachClassName', c.name || '');
}

/* A labelled control for the switcher. The brand block opens it too, but a
   logo with a title attribute is not a discoverable way to reach the one
   screen that gets a teacher back to their class. */
function ensureClassOpener(){
  const brand = document.querySelector('#planApp .brand');
  if (!brand || document.getElementById('tpClassOpen')) return;
  // .brand is a flex row, so this goes inside the text block beneath the
  // subtitle -- appending to .brand itself makes it a flex item and squashes
  // the title into two lines.
  const host = brand.querySelector('div') || brand;
  const b = document.createElement('button');
  b.id = 'tpClassOpen';
  b.type = 'button';
  b.textContent = 'Switch class ▾';
  b.style.cssText = 'display:inline-block;margin-top:6px;font-size:11px;font-weight:700;' +
    'line-height:1.2;white-space:nowrap;color:var(--muted);background:none;' +
    'border:1px solid var(--line);border-radius:999px;padding:3px 9px;cursor:pointer';
  b.onclick = function (e){ e.stopPropagation(); openClassSwitcher(); };
  host.appendChild(b);
}

/* ── Class switcher / manager (self-contained overlay) ── */
function openClassSwitcher(){
  const old = document.getElementById('tpClassSwitch'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'tpClassSwitch';
  ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(20,24,29,.45);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  // Not activeClassId(): with no pointer that answers 'default', and the
  // 'default' row would wear an "Active" pill and offer no way out.
  const active = activeClassIsSet() ? activeClassId() : null;
  const rows = getClasses().map(c => {
    const isActive = c.id === active;
    return `<div class="tpcs-row" data-id="${esc(c.id)}" style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid ${isActive ? 'var(--teal-600)' : 'var(--line)'};border-radius:12px;margin-bottom:8px;background:${isActive ? 'var(--teal-50)' : 'var(--card)'}">
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <input class="tpcs-name" value="${esc(c.name || '')}" placeholder="Class name" style="font-weight:700;font-size:14px;border:1px solid transparent;border-radius:8px;padding:3px 6px;background:none" />
        <div style="display:flex;gap:6px">
          <input class="tpcs-year" value="${esc(c.year || '')}" placeholder="Year group" style="flex:1;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:3px 6px" />
          <input class="tpcs-room" value="${esc(c.room || '')}" placeholder="Room" style="width:90px;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:3px 6px" />
        </div>
      </div>
      ${isActive
        ? '<span class="pill" style="background:var(--teal-50);color:var(--teal-700);font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px">Active</span>'
        : '<button class="tpcs-use" style="font-size:12px;font-weight:700;color:var(--ink);border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;cursor:pointer">Use ▸</button>'}
      ${(c.id !== 'default' && getClasses().length > 1)
        ? '<button class="tpcs-del" title="Delete class" style="width:28px;height:28px;border:none;background:none;color:#c4cad2;font-size:14px;cursor:pointer;border-radius:8px">✕</button>'
        : ''}
    </div>`;
  }).join('');
  ov.innerHTML = `<div style="background:var(--card);border-radius:18px;max-width:460px;width:100%;max-height:85vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(20,24,29,.3)">
    <div style="display:flex;align-items:center;margin-bottom:4px"><h3 style="margin:0;font-size:18px;font-weight:800">Your classes</h3><span style="flex:1"></span><button id="tpcsClose" style="background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer">✕ close</button></div>
    <p class="muted" style="font-size:12.5px;margin:0 0 14px">Switch class on this device. Pupils, scores, behaviour, groups and reports are per class; your timetable and name are shared.</p>
    ${rows}
    <button id="tpcsAdd" style="width:100%;border:1.5px dashed #c4cad2;background:none;color:var(--muted);font-size:13px;font-weight:700;border-radius:12px;padding:11px;cursor:pointer;margin-top:4px">＋ Add a class</button>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById('tpcsClose').onclick = () => ov.remove();
  document.getElementById('tpcsAdd').onclick = () => { const id = createClass({ name:'New class' }); setActiveClass(id); setTimeout(() => location.reload(), 650); };  // let the cloud push (debounced 250ms) land
  ov.querySelectorAll('.tpcs-row').forEach(row => {
    const id = row.dataset.id;
    const nameEl = row.querySelector('.tpcs-name'), yearEl = row.querySelector('.tpcs-year'), roomEl = row.querySelector('.tpcs-room');
    const commit = () => { renameClass(id, { name:nameEl.value.trim() || 'Class', year:yearEl.value.trim(), room:roomEl.value.trim() }); applyClass(); };
    [nameEl, yearEl, roomEl].forEach(el => el.addEventListener('change', commit));
    const use = row.querySelector('.tpcs-use'); if (use) use.onclick = () => { setActiveClass(id); location.reload(); };
    const del = row.querySelector('.tpcs-del'); if (del) del.onclick = () => {
      if (!confirm('Delete this class and all its pupils, scores and notes? This cannot be undone.')) return;
      const wasActive = activeClassId() === id;
      deleteClass(id);
      if (wasActive) setTimeout(() => location.reload(), 400); else openClassSwitcher();
    };
  });
}
window.openClassSwitcher = openClassSwitcher;
window.orphanedClassIds = orphanedClassIds;
window.recoverOrphanedClasses = recoverOrphanedClasses;
window.activeClassIsSet = activeClassIsSet;
/* Year group & room now live on each class (Switch class ▾), not the teacher profile. */
const PROFILE_FIELDS = [
  { k:'name',      label:'Name',               ph:'e.g. Miss Hart' },
  { k:'title',     label:'Role / job title',   ph:'e.g. Class teacher' },
  { k:'school',    label:'School',             ph:'e.g. Oakfield Primary' },
  { k:'email',     label:'Email',              ph:'you@school.org' }
];
function renderProfile(){
  const r = document.getElementById('prof-root');
  const fields = PROFILE_FIELDS.map(f =>
    `<div><label>${f.label}</label><input id="prof_${f.k}" type="${f.k==='email'?'email':'text'}" value="${esc(profile[f.k]||'')}" placeholder="${esc(f.ph)}" oninput="profInput('${f.k}',this.value)" /></div>`
  ).join('');
  r.innerHTML =
    `<div class="card" style="max-width:680px">
       <div style="display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--line-2);margin-bottom:6px">
         <span class="av coral" id="profAvatar" style="width:56px;height:56px;font-size:19px">${esc(initials(profile.name))}</span>
         <div>
           <div id="profNamePrev" style="font-weight:700;font-size:17px">${esc(profile.name || 'Your name')}</div>
           <div class="muted" id="profRolePrev" style="font-size:13px">${esc([profile.title, profile.school].filter(Boolean).join(' · '))}</div>
         </div>
       </div>
       <div class="field-grid" style="margin-top:12px">${fields}</div>
       <div class="row" style="margin-top:16px">
         <button onclick="profSave()">${iconSVG('check',16)} Save profile</button>
       </div>
     </div>`;
}
function profInput(k, val){
  profile[k] = val;
  if (k === 'name'){ setText('profAvatar', initials(val)); setText('profNamePrev', val || 'Your name'); }
  if (k === 'title' || k === 'school') setText('profRolePrev', [profile.title, profile.school].filter(Boolean).join(' · '));
}
function profSave(){ saveProfile(); applyProfile(); alert('Profile saved.'); }
