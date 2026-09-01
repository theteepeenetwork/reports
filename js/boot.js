/* boot.js — start the app
   Owner: Shell (docs/OWNERSHIP.md)
   Loads LAST of the scripts extracted from the inline blocks: it calls
   into everything above it. */

/* ===================================================================
       BOOT THE WHOLE APP
       =================================================================== */
    syncPupilSelectors();
    showPage(location.hash.replace('#','') || 'dashboard');
