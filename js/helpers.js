/* helpers.js — HELPERS + SELECTOR SYNC
   Owner: Shell (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   HELPERS + SELECTOR SYNC
   =================================================================== */
/* ---- line icons (Lucide-style, from the design handoff) ---- */
const ICONS = {
  'graduation-cap':'<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v5c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5"/><path d="M22 9v5"/>',
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  calculator:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4"/>',
  'help-circle':'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.7"/><path d="M12 17h.01"/>',
  star:'<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/>',
  'clipboard-list':'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>',
  'bar-chart-2':'<path d="M6 20V10M12 20V4M18 20V14"/>',
  'trending-up':'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  'user-cog':'<circle cx="9" cy="8" r="4"/><path d="M2 20c0-3.6 3-6.5 7-6.5"/><circle cx="18" cy="17" r="2.5"/><path d="M18 13.5v1M18 19.5v1M21 17h-1M16 17h-1"/>',
  'layout-grid':'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  'book-open':'<path d="M12 6c-1.6-1.2-4-2-7-2v13c3 0 5.4.8 7 2 1.6-1.2 4-2 7-2V4c-3 0-5.4.8-7 2z"/><path d="M12 6v13"/>',
  'file-text':'<path d="M14 2H6v20h12V6z"/><path d="M14 2v4h4"/><path d="M9 13h6M9 17h6"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21a6 6 0 0 0-4-5.6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  cloud:'<path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18z"/>',
  bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  printer:'<path d="M6 9V3h12v6"/><path d="M6 18H4v-7h16v7h-2"/><rect x="8" y="14" width="8" height="7" rx="1"/>',
  'arrow-right':'<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  check:'<path d="M5 12l4 4 10-10"/>',
  zap:'<path d="M13 2L4 14h7l-2 8 9-12h-7z"/>',
  play:'<path d="M7 4l13 8-13 8z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>'
};
function iconSVG(name, size){ size = size || 18; return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; }
function injectIcons(root){ (root || document).querySelectorAll('[data-icon]').forEach(el => {
  const sz = el.classList.contains('mark') ? 20 : (el.closest('.search') ? 16 : 18);
  el.innerHTML = iconSVG(el.dataset.icon, sz);
}); }
function initials(n){ return (n||'?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase(); }

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function opt(v,l,cur){ return `<option value="${v}"${v===cur?' selected':''}>${l}</option>`; }
function setText(id,v){ const el = document.getElementById(id); if (el) el.textContent = v; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){ if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}`; }
function download(name, text){
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function syncPupilSelectors(){
  const opts = '<option value="">— pupil —</option>' + sortedRoster().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  ['spPupil','bhPupil'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
  const f = document.getElementById('bhFilter');
  if (f){ const cur = f.value; f.innerHTML = '<option value="">All pupils</option>' + sortedRoster().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join(''); f.value = cur; }
  // refresh any visible roster-driven pages
  if (document.getElementById('page-mental-starters').classList.contains('active')) msRender();
  if (document.getElementById('page-assessments').classList.contains('active')) asRender();
  if (document.getElementById('page-class-context').classList.contains('active')) ctxRender();
  if (document.getElementById('page-star-pupil').classList.contains('active')) spRender();
  if (document.getElementById('page-reports').classList.contains('active') && typeof renderBoard === 'function') renderBoard();
  updateNavCount();
}

/* set today as default on date inputs */
['spDate','bhDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });

/* render the line icons in the static shell (sidebar, topbar) + nav badge + profile */
injectIcons();
updateNavCount();
ensureClasses();
applyProfile();
applyClass();
