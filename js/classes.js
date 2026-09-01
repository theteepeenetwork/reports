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

/* Seed the registry from the legacy single class on first run. Idempotent. */
function ensureClasses(){
  let cs = getClasses();
  if (!cs.length){
    cs = [{ id:'default', name:(profile.yearGroup || 'My class'), year:(profile.yearGroup || ''), room:(profile.room || ''), createdAt:Date.now() }];
    saveClasses(cs);
  }
  if (!cs.some(c => c && c.id === activeClassId())) setActiveClass('default');   // recover dangling pointer
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
  saveClasses(cs.filter(c => c.id !== id));
  removeClassKeys(id);
  if (activeClassId() === id) setActiveClass('default');
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
  if (typeof setText === 'function') setText('teachClassName', c.name || '');
}

/* ── Class switcher / manager (self-contained overlay) ── */
function openClassSwitcher(){
  const old = document.getElementById('tpClassSwitch'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'tpClassSwitch';
  ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(20,24,29,.45);display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  const active = activeClassId();
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
        : '<button class="tpcs-use" style="font-size:12px;font-weight:700;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;cursor:pointer">Use ▸</button>'}
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
