/* profile.js — TEACHER PROFILE
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   TEACHER PROFILE
   =================================================================== */
let profile = Object.assign(
  { name: 'Miss Hart', title: 'Class teacher', yearGroup: 'Year 2', room: 'Room 12', school: '', email: '' },
  Store.get('tp_profile', {})
);
function saveProfile(){ Store.set('tp_profile', profile); }
