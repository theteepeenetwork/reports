/* app-hooks.js — MULTI-USER hooks (called by js/cloud.js — see docs/CONTRACT.md)
   Owner: Data (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   MULTI-USER hooks (called by js/cloud.js — see docs/CONTRACT.md)
   appResetState(): blank the in-memory mirrors + redraw to an empty,
   neutral state. cloud.js has already cleared localStorage by now.
   =================================================================== */
window.appResetState = function(){
  try { roster = []; } catch(e){}
  try { msData = {}; } catch(e){}
  try { spData = []; } catch(e){}
  try { bhData = []; } catch(e){}
  try { asData = {}; } catch(e){}
  try { if (typeof mkReset === 'function') mkReset(); } catch(e){}
  try { if (typeof ensureClasses === 'function') ensureClasses(); } catch(e){}   // re-seed default registry after a wipe
  try { if (typeof applyClass === 'function') applyClass(); } catch(e){}
  try { if (typeof syncPupilSelectors === 'function') syncPupilSelectors(); } catch(e){}
  try { var a = document.querySelector('.page.active'); if (a && typeof renderPage === 'function') renderPage(a.id.replace('page-','')); } catch(e){}
};
window.addEventListener('tp:reset', function(){ try { window.appResetState(); } catch(e){} });

function appBackupDownload(){ try { if (typeof exportAll === 'function') exportAll(); } catch(e){} }
/* The "this device has another teacher's class" decision (cloud.js calls this). */
window.appPromptAdopt = function(summary, handlers){
  handlers = handlers || {};
  var old = document.getElementById('tpAdopt'); if (old) old.remove();
  var n = (summary && summary.names) || 0, k = (summary && summary.keys) || 0;
  var ov = document.createElement('div'); ov.id = 'tpAdopt';
  ov.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(15,20,28,.55);padding:20px;';
  var btn = 'width:100%;padding:11px 14px;border-radius:11px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer;border:1px solid var(--line);';
  ov.innerHTML =
    '<div style="background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:16px;max-width:430px;width:100%;padding:24px;box-shadow:0 30px 70px rgba(0,0,0,.35)">' +
      '<h3 style="margin:0 0 6px;font-size:19px">This device has another class on it</h3>' +
      '<p style="margin:0 0 16px;color:var(--muted);font-size:13.5px">There’s a class on this device (' + n + ' pupil' + (n===1?'':'s') + ', ' + k + ' item' + (k===1?'':'s') + ') that isn’t in the account you just signed into. Choose what to keep — this account is currently empty.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button id="tpAdoptKeep" style="' + btn + 'background:var(--teal-600);color:#fff;border-color:var(--teal-600)">Keep &amp; upload this device’s class to my account</button>' +
        '<button id="tpAdoptAccount" style="' + btn + 'background:var(--card);color:var(--ink)">Discard this device’s class (use the account’s data)</button>' +
      '</div>' +
      '<button id="tpAdoptBackup" style="display:block;width:100%;margin-top:14px;text-align:center;color:var(--muted);font-size:12.5px;background:none;border:0;cursor:pointer">↓ Download a backup of this device’s class first</button>' +
    '</div>';
  document.body.appendChild(ov);
  document.getElementById('tpAdoptKeep').onclick = function(){ ov.remove(); if (handlers.onKeepUpload) handlers.onKeepUpload(); };
  document.getElementById('tpAdoptAccount').onclick = function(){
    if (!confirm('Discard this device’s class for good? Download a backup first if you’re not sure.')) return;
    ov.remove(); if (handlers.onUseAccount) handlers.onUseAccount();
  };
  document.getElementById('tpAdoptBackup').onclick = appBackupDownload;
};
