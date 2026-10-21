/* class-manager.js — SETTINGS › CLASSES
   Owner: Data (docs/OWNERSHIP.md)

   The one place a teacher creates, edits, deletes and fills classes. It used
   to be split between the "Switch class ▾" overlay in the sidebar corner
   (create, rename, delete) and a hidden "Manage class" panel on the Pupils
   page (pupils, active class only). The corner now only switches.

   Works on ANY class, not just the active one: a non-active class's roster is
   read and written straight through its physical key (classPhysKey), which the
   cloud hook on Storage.prototype.setItem syncs like any other write. Edits to
   the active class go through the live `roster` so every page sees them.

   Classic script: loads after classes.js (needs getClasses, createClass,
   deleteClass, classPhysKey) and before hub.js (which calls renderClassManager). */

let cmOpenId = null;      // whose pupils are expanded; null = the active class, '' = none
let cmAdding = false;     // the "New class" form is showing

function cmRoster(id){
  if (id === activeClassId()) return roster;
  try {
    const v = JSON.parse(localStorage.getItem(classPhysKey('tp_roster', id)));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function cmSaveRoster(id, list){
  if (id === activeClassId()){
    roster = list; saveRoster();
    if (typeof syncPupilSelectors === 'function') syncPupilSelectors();
    if (typeof updateNavCount === 'function') updateNavCount();
  } else {
    localStorage.setItem(classPhysKey('tp_roster', id), JSON.stringify(list));
  }
}
function cmNewPupil(name){
  return { id: uid(), name, gender:'', pronouns:'neutral', send:'None', pp:false, ehcpLink:'', notes:'', behaviour:'',
           allergies:false, allergyNotes:'', medical:false, medicalNotes:'' };
}
function cmClassLabel(c){ return [c.name || 'Class', c.year, c.room].filter(Boolean).join(' · '); }

/* Reload after the cloud push (debounced 250ms) has had time to land. */
function cmSwitchTo(id){ setActiveClass(id); setTimeout(() => location.reload(), 650); }

function renderClassManager(){
  const root = document.getElementById('settings-classes'); if (!root) return;
  const classes = getClasses();
  const active = activeClassIsSet() ? activeClassId() : null;
  if (cmOpenId !== '' && !classes.some(c => c.id === cmOpenId)) cmOpenId = activeClassId();

  const rows = classes.map(c => {
    const isActive = c.id === active, open = c.id === cmOpenId;
    const n = cmRoster(c.id).length;
    const canDelete = c.id !== 'default' && classes.length > 1;
    return `<div class="cm-class${isActive ? ' active' : ''}${open ? ' open' : ''}" data-id="${esc(c.id)}">
      <div class="cm-head">
        <div class="cm-fields">
          <input class="cm-name" value="${esc(c.name || '')}" placeholder="Class name" aria-label="Class name" />
          <input class="cm-year" value="${esc(c.year || '')}" placeholder="Year group" aria-label="Year group" />
          <input class="cm-room" value="${esc(c.room || '')}" placeholder="Room" aria-label="Room" />
        </div>
        <div class="cm-actions">
          <button class="secondary small cm-pupils" aria-expanded="${open}">${n} pupil${n === 1 ? '' : 's'} ${open ? '▴' : '▾'}</button>
          ${isActive ? '<span class="cm-badge">Current class</span>' : '<button class="small cm-use">Switch to</button>'}
          ${canDelete
            ? '<button class="danger small cm-del">Delete…</button>'
            : `<button class="danger small" disabled title="${c.id === 'default' ? 'Your first class can’t be deleted — rename it instead.' : 'You need at least one class.'}">Delete…</button>`}
        </div>
      </div>
      ${open ? cmPupilsHTML(c, classes) : ''}
    </div>`;
  }).join('');

  root.innerHTML = `<div class="card cm-card">
    <div class="cm-top">
      <div><h2 style="margin:0">Classes</h2>
        <p class="hint" style="margin:4px 0 0">Pupils, scores, behaviour, groups and reports belong to a class. Your profile and timetable are shared by all of them.</p></div>
      ${cmAdding ? '' : '<button id="cmAddBtn">＋ New class</button>'}
    </div>
    ${cmAdding ? cmNewFormHTML() : ''}
    ${rows}
  </div>`;
  cmWire(root);
}

function cmNewFormHTML(){
  return `<div class="cm-new" id="cmNew">
    <h3 style="margin:0 0 8px">New class</h3>
    <div class="cm-fields">
      <input id="cmNewName" placeholder="Class name, e.g. Oak" />
      <input id="cmNewYear" placeholder="Year group" />
      <input id="cmNewRoom" placeholder="Room" />
    </div>
    <label style="margin-top:10px">Pupils (optional, one name per line)</label>
    <textarea id="cmNewPupils" placeholder="Alex&#10;Alice&#10;Anna"></textarea>
    <label class="cm-check"><input type="checkbox" id="cmNewSwitch" checked /> Switch to this class now</label>
    <div class="row" style="margin-top:10px">
      <button id="cmNewSave">Create class</button>
      <button class="secondary" id="cmNewCancel">Cancel</button>
    </div>
    <p class="hint small" style="margin:8px 0 0">The question generator and Glow Getters setup are copied from your current class; pupils and scores start empty.</p>
  </div>`;
}

function cmPupilsHTML(c, classes){
  const list = [...cmRoster(c.id)].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const isActive = c.id === activeClassId();
  const others = classes.filter(x => x.id !== c.id);
  const moveOpts = others.map(o => `<option value="${esc(o.id)}">${esc(cmClassLabel(o))}</option>`).join('');
  const body = list.length ? list.map(p => `<tr data-pid="${esc(p.id)}">
      <td><input class="cm-pname" value="${esc(p.name)}" aria-label="Pupil name" /></td>
      <td><select class="cm-pgender" aria-label="Gender">${opt('', '—', p.gender || '')}${opt('Boy', 'Boy', p.gender || '')}${opt('Girl', 'Girl', p.gender || '')}</select></td>
      <td><select class="cm-ppron" aria-label="Pronouns">${opt('female', 'she/her', p.pronouns || 'neutral')}${opt('male', 'he/him', p.pronouns || 'neutral')}${opt('neutral', 'they/them', p.pronouns || 'neutral')}</select></td>
      ${isActive ? `<td><button class="ros-abs${p.absent ? ' on' : ''} cm-pabs" title="Absent pupils are greyed out in Glow Getters and sit out of battles">${p.absent ? '🚫 Absent' : '✓ Present'}</button></td>` : ''}
      <td>${others.length ? `<select class="cm-pmove" aria-label="Move to another class"><option value="">Move to…</option>${moveOpts}</select>` : ''}</td>
      <td class="num"><button class="danger small cm-pdel" title="Remove from this class">✕</button></td>
    </tr>`).join('') : `<tr><td class="empty">No pupils in this class yet.</td></tr>`;
  return `<div class="cm-pupils-panel">
    <div class="row">
      <div class="grow"><label>Add a pupil</label><input class="cm-addone" placeholder="Pupil name" /></div>
      <button class="cm-addone-btn">+ Add</button>
    </div>
    <details class="cm-bulk"><summary>Add several at once</summary>
      <textarea class="cm-bulk-txt" placeholder="One name per line"></textarea>
      <button class="secondary small cm-bulk-btn" style="margin-top:6px">Add these pupils</button>
    </details>
    <div class="table-wrap"><table class="cm-table">${list.length ? `<tr><th>Name</th><th>Gender</th><th>Pronouns</th>${isActive ? '<th>Today</th>' : ''}<th>Class</th><th></th></tr>` : ''}${body}</table></div>
    ${others.length && list.length ? '<p class="hint small">Moving a pupil takes their name and details. Scores and logs already recorded stay with this class.</p>' : ''}
  </div>`;
}

function cmWire(root){
  const add = root.querySelector('#cmAddBtn');
  if (add) add.onclick = () => { cmAdding = true; renderClassManager(); const n = document.getElementById('cmNewName'); if (n) n.focus(); };
  const save = root.querySelector('#cmNewSave');
  if (save) save.onclick = () => {
    const name = document.getElementById('cmNewName').value.trim();
    if (!name){ document.getElementById('cmNewName').focus(); return; }
    const id = createClass({ name, year: document.getElementById('cmNewYear').value.trim(), room: document.getElementById('cmNewRoom').value.trim() });
    const names = document.getElementById('cmNewPupils').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (names.length) cmSaveRoster(id, names.map(cmNewPupil));
    cmAdding = false; cmOpenId = id;
    if (document.getElementById('cmNewSwitch').checked){ cmSwitchTo(id); return; }
    renderClassManager();
  };
  const cancel = root.querySelector('#cmNewCancel');
  if (cancel) cancel.onclick = () => { cmAdding = false; renderClassManager(); };

  root.querySelectorAll('.cm-class').forEach(row => {
    const id = row.dataset.id;
    const nameEl = row.querySelector('.cm-name'), yearEl = row.querySelector('.cm-year'), roomEl = row.querySelector('.cm-room');
    const commit = () => { renameClass(id, { name: nameEl.value.trim() || 'Class', year: yearEl.value.trim(), room: roomEl.value.trim() }); if (typeof applyClass === 'function') applyClass(); };
    [nameEl, yearEl, roomEl].forEach(el => el.addEventListener('change', commit));
    row.querySelector('.cm-pupils').onclick = () => { cmOpenId = cmOpenId === id ? '' : id; renderClassManager(); };
    const use = row.querySelector('.cm-use'); if (use) use.onclick = () => cmSwitchTo(id);
    const del = row.querySelector('.cm-del'); if (del) del.onclick = () => cmConfirmDelete(id);
    if (row.querySelector('.cm-pupils-panel')) cmWirePupils(row, id);
  });
}

function cmWirePupils(row, id){
  const list = () => cmRoster(id).slice();
  const one = row.querySelector('.cm-addone');
  const addOne = () => {
    const name = one.value.trim(); if (!name) return;
    cmSaveRoster(id, list().concat([cmNewPupil(name)]));
    renderClassManager();
    const again = document.querySelector('.cm-class[data-id="' + CSS.escape(id) + '"] .cm-addone'); if (again) again.focus();
  };
  row.querySelector('.cm-addone-btn').onclick = addOne;
  one.addEventListener('keydown', e => { if (e.key === 'Enter') addOne(); });
  row.querySelector('.cm-bulk-btn').onclick = () => {
    const names = row.querySelector('.cm-bulk-txt').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    cmSaveRoster(id, list().concat(names.map(cmNewPupil)));
    renderClassManager();
  };
  row.querySelectorAll('tr[data-pid]').forEach(tr => {
    const pid = tr.dataset.pid;
    const edit = (field, value) => { const l = list(); const p = l.find(x => x.id === pid); if (!p) return; p[field] = value; cmSaveRoster(id, l); };
    tr.querySelector('.cm-pname').addEventListener('change', e => { const v = e.target.value.trim(); if (v) edit('name', v); else e.target.value = (cmRoster(id).find(x => x.id === pid) || {}).name || ''; });
    tr.querySelector('.cm-pgender').addEventListener('change', e => edit('gender', e.target.value));
    tr.querySelector('.cm-ppron').addEventListener('change', e => edit('pronouns', e.target.value));
    const abs = tr.querySelector('.cm-pabs');
    if (abs) abs.onclick = () => {
      const p = cmRoster(id).find(x => x.id === pid); edit('absent', !(p && p.absent));
      window.dispatchEvent(new CustomEvent('tp:sync', { detail:{ key:'tp_roster', source:'local' } }));
      renderClassManager();
    };
    const mv = tr.querySelector('.cm-pmove');
    if (mv) mv.addEventListener('change', () => {
      const to = mv.value; if (!to) return;
      const l = list(); const p = l.find(x => x.id === pid); if (!p) return;
      const dest = getClasses().find(c => c.id === to);
      if (!confirm(`Move ${p.name} to ${dest ? cmClassLabel(dest) : 'that class'}?`)){ mv.value = ''; return; }
      cmSaveRoster(to, cmRoster(to).filter(x => x.id !== pid).concat([p]));
      cmSaveRoster(id, l.filter(x => x.id !== pid));
      renderClassManager();
    });
    tr.querySelector('.cm-pdel').onclick = () => {
      const p = cmRoster(id).find(x => x.id === pid);
      if (!confirm(`Remove ${p ? p.name : 'this pupil'} from the class?`)) return;
      cmSaveRoster(id, list().filter(x => x.id !== pid));
      renderClassManager();
    };
  });
}

/* Deleting a class is the one irreversible thing here, and the thing that
   lost a class on 2 Sep 2026. Say exactly what goes, and make the teacher
   type the name — a stray confirm() click is too easy on a shared iPad. */
function cmConfirmDelete(id){
  const c = getClasses().find(x => x.id === id); if (!c) return;
  const n = cmRoster(id).length;
  const name = (c.name || 'Class').trim();
  const typed = prompt(`Delete “${name}”?\n\nThis permanently removes its ${n} pupil${n === 1 ? '' : 's'} and all of their scores, behaviour, groups, seating and reports, on every device. Download a backup first if you might need them.\n\nType the class name to confirm:`);
  if (typed == null) return;
  if (typed.trim().toLowerCase() !== name.toLowerCase()){ alert('The name didn’t match, so nothing was deleted.'); return; }
  const wasActive = activeClassId() === id;
  if (!deleteClass(id)) return;
  if (cmOpenId === id) cmOpenId = null;
  if (wasActive){ setTimeout(() => location.reload(), 650); return; }
  renderClassManager();
}

/* Open Settings with a class's pupils showing — what "Manage class ›" and the
   corner switcher's "Manage classes" link use. */
function openClassManager(id){
  cmOpenId = id || activeClassId();
  if (location.hash.replace('#', '') === 'settings') renderClassManager(); else go('settings');
  setTimeout(() => { const el = document.getElementById('settings-classes'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}
window.renderClassManager = renderClassManager;
window.openClassManager = openClassManager;
