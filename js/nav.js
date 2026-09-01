/* nav.js — NAVIGATION
   Owner: Shell (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   NAVIGATION
   =================================================================== */
function go(page){ location.hash = page; }
function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open'); }

function showPage(page){
  // legacy routes: Glow Getters was #battler until the Sep 2026 rename.
  // Teachers bookmark the board, so keep the old hash resolving.
  if (page === 'battler') page = 'glow';
  if (!page) page = 'dashboard';
  document.querySelectorAll('.page').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  (el || document.getElementById('page-dashboard')).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0,0);
  renderPage(page);
}
function renderPage(page){
  if (page === 'dashboard') renderDashboard();
  if (page === 'mental-starters') msRender();
  if (page === 'star-pupil') spRender();
  if (page === 'behaviour') bhRender();
  if (page === 'assessments') asRender();
  if (page === 'class-context') ctxRender();
  if (page === 'class-list') rosRender();
  if (page === 'profile') renderProfile();
  // pluggable feature pages (defined in /js modules)
  if (page === 'generator' && typeof genRender === 'function') genRender();
  if (page === 'glow') renderGlowLaunch();
  if (page === 'name-picker' && typeof npRender === 'function') npRender();
  if (page === 'timetable' && typeof ttRender === 'function') ttRender();
  if (page === 'seating' && typeof seatRender === 'function') seatRender('plan');
  if (page === 'instant' && typeof seatRender === 'function') seatRender('groups');
  if (page === 'groups' && typeof grpRender === 'function') grpRender();
  if (page === 'charts' && typeof chRender === 'function') chRender();
  if (page === 'reports' && typeof renderBoard === 'function') renderBoard();
}
document.querySelectorAll('.nav-link').forEach(b => b.onclick = () => go(b.dataset.page));
window.addEventListener('hashchange', () => showPage(location.hash.replace('#','')));
