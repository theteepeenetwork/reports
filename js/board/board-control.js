/* ===================================================================
   board-control.js — "Show on board" — the single front door to every
   class-facing, projected surface (Glow Getters, the starter sheet).
   ------------------------------------------------------------------
   Owner: Board agent (see docs/OWNERSHIP.md)

   Why this file exists
   --------------------
   Glow Getters had no route in on desktop. PLAN_NAV (js/hub.js) does not
   list it, and setMode()'s hash whitelist bounced #glow back to Today,
   so on any device >= 1024px the words "Glow Getters" did not appear
   anywhere in the app. The one device it was built for — the smartboard
   laptop — was the one device that hid it.

   The fix is not another nav item. Glow Getters is not a page you visit,
   it is something you put on the board. So it gets a control that sits in
   the SAME position on every surface, and that control names the category
   ("show on board") rather than the feature — which is what makes it
   findable by a teacher who has never been told where to look.

   Contract with hub.js (js/hub.js owns both):
     window.hubSetMode(mode)   'teach' | 'plan'
     window.hubTeachGo(screen) navigate a teach screen
   Contract with index.html:
     window.openGlowGetters(sameTab)
   All three are probed defensively — if hub.js has not booted yet, the
   control degrades to the Glow Getters entry alone rather than throwing.
   =================================================================== */
(function () {
  'use strict';

  var BTN_ID = 'showOnBoard';
  var SHEET_ID = 'bdSheet';

  function has(fn) { return typeof window[fn] === 'function'; }

  /* ── what can go on the board ──────────────────────────────────── */
  function items() {
    var out = [];
    out.push({
      key: 'glow',
      title: 'Glow Getters',
      sub: 'Points, ranks and badges — full screen for the class',
      bolt: true,
      go: function () { if (has('openGlowGetters')) window.openGlowGetters(); }
    });
    if (has('hubSetMode') && has('hubTeachGo')) {
      out.push({
        key: 'starter',
        title: 'Starter sheet',
        sub: "Today's mental maths questions, sized for the board",
        go: function () { window.hubSetMode('teach'); window.hubTeachGo('day'); }
      });
    }
    return out;
  }

  /* ── the sheet ─────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function closeSheet() {
    var el = document.getElementById(SHEET_ID);
    if (el) el.remove();
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) { if (e.key === 'Escape') closeSheet(); }

  function openSheet() {
    closeSheet();
    var list = items();
    var wrap = document.createElement('div');
    wrap.id = SHEET_ID;
    wrap.className = 'bd-backdrop';
    wrap.innerHTML =
      '<div class="bd-sheet" role="dialog" aria-modal="true" aria-label="Show on board">' +
        '<div class="bd-head">' +
          '<span class="bd-title">Show on board</span>' +
          '<button class="bd-x" type="button" aria-label="Close">×</button>' +
        '</div>' +
        '<p class="bd-hint">Opens full screen in its own window so the whole class can see it. ' +
          'Everything you award still saves back here.</p>' +
        list.map(function (it) {
          return '<button class="bd-item" type="button" data-board="' + esc(it.key) + '">' +
            '<span class="bd-ico' + (it.bolt ? ' bolt' : '') + '">' + (it.bolt ? '⚡' : '▶') + '</span>' +
            '<span class="bd-copy"><span class="bd-item-title">' + esc(it.title) + '</span>' +
            '<span class="bd-item-sub">' + esc(it.sub) + '</span></span>' +
            '<span class="bd-chev">›</span></button>';
        }).join('') +
      '</div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('.bd-x')) { closeSheet(); return; }
      var btn = e.target.closest('[data-board]');
      if (!btn) return;
      var key = btn.getAttribute('data-board');
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) { closeSheet(); list[i].go(); return; }
      }
    });
    document.addEventListener('keydown', onKey);
    var first = wrap.querySelector('.bd-item');
    if (first) { try { first.focus(); } catch (e) {} }
  }

  window.openBoardMenu = openSheet;

  /* ── the button ────────────────────────────────────────────────── */
  function buttonHTML(cls) {
    return '<button type="button" class="' + cls + '" id="' + BTN_ID + '" ' +
      'title="Put Glow Getters or the starter sheet on the smartboard">' +
      '<span class="bolt">⚡</span> Show on board</button>';
  }

  /* Teach mode renders its own copy inside topRow() (js/hub.js) so it
     survives re-renders. Plan mode's top bar is static, so inject once. */
  function mountPlan() {
    var bar = document.querySelector('#planApp .topbar');
    if (!bar || bar.querySelector('#' + BTN_ID)) return;
    var spacer = bar.querySelector('.tb-spacer');
    var holder = document.createElement('span');
    holder.innerHTML = buttonHTML('bd-btn');
    var node = holder.firstChild;
    if (spacer && spacer.nextSibling) bar.insertBefore(node, spacer.nextSibling);
    else bar.appendChild(node);
  }

  /* Delegated so it works for both the injected Plan button and the
     Teach button that hub.js re-renders on every screen change. */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#' + BTN_ID)) { e.preventDefault(); openSheet(); }
  });

  function boot() {
    mountPlan();
    /* the shell can rebuild the sidebar/top bar after us — re-check once */
    setTimeout(mountPlan, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
