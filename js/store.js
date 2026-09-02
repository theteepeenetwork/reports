/* store.js — STORE + SHARED ROSTER
   Owner: Data (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */


/* ===================================================================
   STORE + SHARED ROSTER
   =================================================================== */
const Store = {
  get(k, def){ try { const v = JSON.parse(localStorage.getItem(tpPhysicalKey(k))); return v === null ? def : v; } catch { return def; } },
  set(k, v){ localStorage.setItem(tpPhysicalKey(k), JSON.stringify(v)); }
};

const HALF_TERMS = ['Autumn 1','Autumn 2','Spring 1','Spring 2','Summer 1','Summer 2'];
const ASSESS_TERMS = ['Baseline','Autumn','Spring','Summer'];
const SAMPLE_NAMES = ['Alex','Alice','Anna','Aria','Ava','Axel','Bradley','Christopher','Colton','Daniel','Elise','Esmae','Fynley','Harper','Huxley','Jenson','Leia','Leo','Lilly-Anne','Lilly-Mae','Logan','McKenzie','Noah D','Noah M','Oakley','Olivia','Robert','Rose','Skylar'];

let roster = Store.get('tp_roster', []);
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

function saveRoster(){ Store.set('tp_roster', roster); }
function pupilName(id){ const p = roster.find(p => p.id === id); return p ? p.name : '—'; }
function sortedRoster(){ return [...roster].sort((a,b) => a.name.localeCompare(b.name)); }
