/* ============================================================
   battler.js — Behaviour Battler (gamified behaviour points)
   Global render: btRender()  ·  Store key: 'tp_battler'
   All identifiers prefixed "bt". No external libraries.

   - Individual pupil points (the base game)
   - Tables/groups: award a table and every member gets the point
   - Table standings + pupil leaderboard
   - Class-vs-Boss mode: points deal damage to a boss
   - Ties into the Hub: players come from the shared roster,
     and awards can be written into the Behaviour Log.
   ============================================================ */

(function () {

  /* ── State ──────────────────────────────────────────────── */
  function btDefault(){
    return { v:1, tab:'points', step:1, sound:true, mascot:true, confetti:true, logBh:false, winnerBonus:5,
             showLevels:true, showBadges:true, powerups:true,
             minPoints:5, startPoints:10, maxPoints:'',
             arenaMode:'ffa', satHP:8, coreHP:30,
             bossUnlocked:false, lbWindow:'all',
             points:{}, badges:{}, tables:[], placements:{}, daily:{}, recent:[], boss:{ name:'Grumble the Gremlin', max:50, dealt:0, active:false } };
  }
  // pupil battle colours — cool only (blues/teals/greens/cyans/indigos); red is reserved for the boss & its minions
  var BT_COLORS = ['#3b82f6','#06b6d4','#14b8a6','#10b981','#0ea5e9','#6366f1','#22d3ee','#2563eb','#0d9488','#84cc16','#38bdf8','#4f46e5'];
  // Each earned badge becomes a single-use battle power-up. Keys match btBadgesDef().
  var BT_PU = {
    first:  { icon:'🌱', name:'Regrow',        fx:'heal',   heal:2 },
    ten:    { icon:'⭐', name:'Shooting Star',  fx:'dash',   dashMs:1400, invulMs:1400 },
    q:      { icon:'🏅', name:'Shockwave',      fx:'shock',  shockR:150, dmg:2 },
    half:   { icon:'🏆', name:'Power Strike',   fx:'strike', strikeMs:3000, dmgBonus:1, reachBonus:34 },
    streak: { icon:'🔥', name:'Firestorm',      fx:'fire',   fireMs:3000, spinBoost:0.04, burnR:120, burnMs:520 }
  };
  var BT_PU_ORDER   = ['first','ten','q','half','streak'];
  var BT_PU_ROLL_MS = 1500;   // per-bot roll throttle (ms)
  var BT_PU_P_EACH  = 0.16;   // per-roll base probability per remaining power-up
  function btLoad(){
    var s = Store.get('tp_battler', null);
    if (!s || typeof s !== 'object') s = btDefault();
    var d = btDefault();
    for (var k in d) if (s[k] === undefined) s[k] = d[k];
    if (!s.boss || typeof s.boss !== 'object') s.boss = d.boss;
    if (!s.points || typeof s.points !== 'object') s.points = {};
    if (!s.badges || typeof s.badges !== 'object') s.badges = {};
    if (!Array.isArray(s.tables)) s.tables = [];
    if ([1,2,5].indexOf(s.step) < 0) s.step = 1;
    if (typeof s.bossUnlocked !== 'boolean') s.bossUnlocked = false;
    if (typeof s.showLevels !== 'boolean') s.showLevels = true;
    if (typeof s.showBadges !== 'boolean') s.showBadges = true;
    if (typeof s.powerups !== 'boolean') s.powerups = true;
    if (!s.placements || typeof s.placements !== 'object') s.placements = {};
    if (!s.daily || typeof s.daily !== 'object') s.daily = {};
    if (['all','month','week'].indexOf(s.lbWindow) < 0) s.lbWindow = 'all';
    if (!Array.isArray(s.recent)) s.recent = [];
    return s;
  }
  // Smartboard display views (Settings → Smartboard view). 'classic' = the card grid.
  // The choice is DEVICE-LOCAL (not synced): one screen can show a different view
  // from another. Stored in its own localStorage key, never in the synced blob.
  var BT_BOARD_VIEWS = ['classic','spotlight','split','scoreboard','lanes','constellation','glowcity'];
  var BT_BOARD_LABELS = { classic:'Classic', spotlight:'Spotlight Stage', split:'Split Stage', scoreboard:'Scoreboard Wall', lanes:'Rank Lanes', constellation:'Constellation', glowcity:'Glow City' };
  var BT_VIEW_KEY = 'tp_gg_view';
  function btView(){
    var v = null;
    try { v = window.localStorage.getItem(BT_VIEW_KEY); } catch (e) {}
    if (!v){   // one-time migration: seed from the old (synced) s.boardView if present
      try { var s = Store.get('tp_battler', null); if (s && s.boardView){ v = s.boardView; window.localStorage.setItem(BT_VIEW_KEY, v); } } catch (e) {}
    }
    return BT_BOARD_VIEWS.indexOf(v) >= 0 ? v : 'classic';
  }
  // Neon rank palette for the dark smartboard (RANK_TEMPLATE's light colours stay for the planner).
  var BT_NEON = { rookie:'#8fa0cc', rising:'#5eead4', champ:'#fb7185', hero:'#fde047', legend:'#c084fc' };
  // recent point-getters feed (newest first, capped) — powers the Spotlight view + ticker
  function btPushRecent(s, pid, n){
    if (!Array.isArray(s.recent)) s.recent = [];
    s.recent.unshift({ pid: pid, n: n, ts: Date.now() });
    if (s.recent.length > 20) s.recent.length = 20;
  }
  /* ── Daily net-points aggregates (for week/month leaderboard sorting) ── */
  function btDayKey(){ return (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0,10); }
  function btLogDaily(s, pid, n){
    var k = btDayKey();
    if (!s.daily[k]) s.daily[k] = {};
    s.daily[k][pid] = (s.daily[k][pid] || 0) + n;
    var cutoff = new Date(Date.now() - 40*864e5).toISOString().slice(0,10);   // keep ~40 days
    for (var d in s.daily) if (d < cutoff) delete s.daily[d];
  }
  function btWindowNet(s, pid, days){
    var cutoff = new Date(Date.now() - days*864e5).toISOString().slice(0,10), tot = 0;
    for (var d in s.daily) if (d > cutoff && s.daily[d][pid]) tot += s.daily[d][pid];
    return tot;
  }
  // points used to RANK on the leaderboard for the selected window
  function btLbPoints(s, pid){
    if (s.lbWindow === 'week')  return btWindowNet(s, pid, 7);
    if (s.lbWindow === 'month') return btWindowNet(s, pid, 31);
    return btPts(s, pid);
  }
  /* ── Placement history (1st–5th finishes in free-for-all) ── */
  function btPlace(s, pid){ return s.placements[pid] || {}; }
  function btPlacesHTML(s, pid){
    var p = btPlace(s, pid), icon = { 1:'🥇', 2:'🥈', 3:'🥉', 4:'4️⃣', 5:'5️⃣' }, out = '';
    for (var i = 1; i <= 5; i++) if (p[i]) out += '<span class="lb-place">' + icon[i] + '<span class="lb-place-n">' + p[i] + '</span></span>';
    return out ? '<span class="lb-places">' + out + '</span>' : '';
  }
  function btSave(s){ Store.set('tp_battler', s); }

  /* ── Points model: clamp, ranks, levels, badges (max-aware) ── */
  function btMin(s){ return s.minPoints || 0; }
  function btMaxP(s){ var m = s.maxPoints; return (m === '' || m == null) ? Infinity : (+m); }
  function btStart(s){ return s.startPoints || 0; }
  function btClampP(s, v){ return Math.min(btMaxP(s), Math.max(btMin(s), v)); }
  // New pupils sit at "starting"; points stay between minimum and maximum (blank max = unlimited).
  function btPts(s, pid){ var v = s.points[pid]; if (v === undefined) v = btStart(s); return btClampP(s, v); }
  // Progress (levels / ranks / badges) is measured from the starting amount: a pupil sitting
  // at "starting" has earned 0. The first earned point (start + 1) is the first milestone.
  function btEarned(s, p){ return Math.max(0, p - btStart(s)); }

  var PER_LEVEL = 5;
  var RANK_TEMPLATE = [
    { key:'rookie', label:'Rookie',      color:'#5c6a6e', bg:'#eef1f1', frac:0,    abs:0  },
    { key:'rising', label:'Rising Star', color:'#0f766e', bg:'#ecfbf8', frac:0.20, abs:10 },
    { key:'champ',  label:'Champion',    color:'#f43f5e', bg:'#fff1f3', frac:0.45, abs:25 },
    { key:'hero',   label:'Hero',        color:'#e0a106', bg:'#fdf6e3', frac:0.70, abs:50 },
    { key:'legend', label:'Legend',      color:'#7c5cff', bg:'#f3f0ff', frac:0.90, abs:75 }
  ];
  // Rank thresholds count up from the starting amount: absolute defaults when unlimited,
  // else spread across [start, max]. A pupil at "starting" is the bottom rank (Rookie).
  function btRanks(s){
    var st = btStart(s), mx = btMaxP(s);
    var out = RANK_TEMPLATE.map(function (t){
      var min = (mx === Infinity) ? (st + t.abs) : Math.round(st + t.frac * Math.max(1, mx - st));
      return { key:t.key, label:t.label, color:t.color, bg:t.bg, min:min };
    });
    for (var i=1;i<out.length;i++) if (out[i].min <= out[i-1].min) out[i].min = out[i-1].min + 1;
    return out;
  }
  function btRankFor(s, p){ var rs = btRanks(s), r = rs[0]; for (var i=0;i<rs.length;i++) if (p >= rs[i].min) r = rs[i]; return r; }
  function btNextRank(s, p){ var rs = btRanks(s); for (var i=0;i<rs.length;i++) if (rs[i].min > p) return rs[i]; return null; }
  function btLevelOf(s, p){ return Math.floor(btEarned(s, p) / PER_LEVEL) + 1; }

  // Badge milestones also count earned points above the starting amount (first = start + 1).
  function btBadgesDef(s){
    var st = btStart(s), mx = btMaxP(s);
    if (mx === Infinity){
      return [
        { key:'first', icon:'🌱', name:'First point',    min: st + 1  },
        { key:'ten',   icon:'⭐', name:'Perfect Ten',    min: st + 10 },
        { key:'q',     icon:'🏅', name:'Quarter Master', min: st + 25 },
        { key:'half',  icon:'🏆', name:'Half Century',   min: st + 50 },
        { key:'streak',icon:'🔥', name:'On a Roll',      streakOnly:true }
      ];
    }
    var range = Math.max(1, mx - st);
    return [
      { key:'first', icon:'🌱', name:'First point',   min: st + 1 },
      { key:'ten',   icon:'⭐', name:'Quarter Way',   min: Math.round(st + range*0.25) },
      { key:'q',     icon:'🏅', name:'Halfway There', min: Math.round(st + range*0.50) },
      { key:'half',  icon:'🏆', name:'Full Marks',    min: mx },
      { key:'streak',icon:'🔥', name:'On a Roll',     streakOnly:true }
    ];
  }
  function btBadgeByKey(s, k){ var bs = btBadgesDef(s); for (var i=0;i<bs.length;i++) if (bs[i].key===k) return bs[i]; return null; }
  function btMilestoneBadges(s){ return btBadgesDef(s).filter(function (b){ return !b.streakOnly && b.key !== 'first'; }); }
  function btBadgesOf(s, pid){ if (!s.badges) s.badges = {}; if (!s.badges[pid]) s.badges[pid] = {}; return s.badges[pid]; }
  // Re-base permanent badges to the current scale from a pupil's current points (keeps streak badge).
  function btRecomputeBadges(s, pid){
    var cur = btBadgesOf(s, pid), keepStreak = cur.streak, b = {}, pts = btPts(s, pid);
    btBadgesDef(s).forEach(function (x){ if (!x.streakOnly && pts >= x.min) b[x.key] = true; });
    if (keepStreak) b.streak = true;
    s.badges[pid] = b;
  }
  function btApplyConfig(s){
    sortedRoster().forEach(function (p){ if (s.points[p.id] !== undefined) s.points[p.id] = btClampP(s, s.points[p.id]); btRecomputeBadges(s, p.id); });
    btStreak = {};
  }
  // Additively grant any milestone badges a pupil already qualifies for (badges are permanent).
  function btEnsureBadges(s){
    var changed = false;
    sortedRoster().forEach(function (p){
      var got = btBadgesOf(s, p.id), pts = btPts(s, p.id);
      btBadgesDef(s).forEach(function (b){ if (!b.streakOnly && pts >= b.min && !got[b.key]){ got[b.key] = true; changed = true; } });
    });
    if (changed) btSave(s);
  }
  function btTableTotal(s, t){ return t.pupilIds.reduce(function (a, pid){ return a + btPts(s, pid); }, 0); }

  /* colours */
  var BT_AV_COLORS = ['#14b8a6','#0d9488','#fb7185','#f5b324','#7c5cff','#06b6d4','#10b981','#f97316','#ef4444','#d946ef'];
  var BT_GROUP_COLORS = ['#f43f5e','#2563eb','#10b981','#e0a106','#7c5cff','#06b6d4'];
  function btHash(str){ var h = 0; str = String(str); for (var i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) >>> 0; return h; }
  function btAvColor(pid){ return BT_AV_COLORS[btHash(pid) % BT_AV_COLORS.length]; }
  function btGroupColor(i){ return BT_GROUP_COLORS[i % BT_GROUP_COLORS.length]; }
  // Smartboard rank with the neon palette (label/min from the live ranks, colour from BT_NEON).
  function btNeonOf(s, pts){ var r = btRankFor(s, pts); return { key:r.key, label:r.label, min:r.min, color:(BT_NEON[r.key] || r.color) }; }
  // Avatar disc colour: the pupil's group/table colour when they're in one, else their hashed colour.
  function btPupColor(s, pid){
    if (s && Array.isArray(s.tables)){
      for (var i = 0; i < s.tables.length; i++) if (s.tables[i].pupilIds.indexOf(pid) >= 0) return btGroupColor(i);
    }
    return btAvColor(pid);
  }
  function btPick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function btClassTotal(s){ return sortedRoster().reduce(function (a,p){ return a + btPts(s, p.id); }, 0); }
  // pupils who take part in battles / aren't greyed out — everyone except those marked absent on the Class List
  function btActiveRoster(){ return sortedRoster().filter(function (p){ return !p.absent; }); }

  /* ── Boss-battle charge / unlock — the class collectively earns its way to a
     boss fight. Target = 60% of the maximum points the class could hold
     (class size × Maximum), so it auto-adjusts whenever the Maximum is set. ── */
  var BOSS_BASE = 18; // notional per-pupil cap used only when no Maximum is set
  function btBossCap(s){ return (btMaxP(s) === Infinity) ? (btStart(s) + BOSS_BASE) : btMaxP(s); }
  // Baseline = everyone at their starting points → that is 0% of the bar; the bar fills with EARNED points.
  function btBossBaseline(s){ return btActiveRoster().length * btStart(s); }
  function btBossTarget(s){ return Math.round(btActiveRoster().length * btBossCap(s) * 0.6); }   // class total needed to unlock
  function btBossCharge(s){ return Math.max(0, Math.min(btClassTotal(s) - btBossBaseline(s), btBossTarget(s) - btBossBaseline(s))); }
  function btBossPct(s){ var span = btBossTarget(s) - btBossBaseline(s); return span <= 0 ? 1 : btBossCharge(s) / span; }
  // Track the threshold both ways: fanfare once when the class first reaches 60% of the
  // maximum available; re-lock if the total later drops back below it (deductions / reset).
  function btCheckBossUnlock(s, animate){
    var reached = btClassTotal(s) >= btBossTarget(s);
    if (reached && !s.bossUnlocked){ s.bossUnlocked = true; if (animate) btBossFanfare(s); return true; }
    if (!reached && s.bossUnlocked){ s.bossUnlocked = false; }
    return false;
  }
  function btBossFanfare(s){
    var overlay = document.getElementById('bt-celebrate'), card = document.getElementById('bt-celeCard');
    if (overlay && card){
      card.innerHTML = '<div class="cele-kicker">Boss Battle Unlocked</div>' +
        '<div class="cele-badge boss">⚔️</div>' +
        '<div class="cele-name">The boss is ready!</div>' +
        '<div class="cele-sub">The class charged it up — take it on from the Battle tab.</div>' +
        '<div class="cele-tap">tap anywhere to continue</div>';
      overlay.classList.add('show'); sfx('win'); btConfettiRain(120);
      clearTimeout(btShowCele._t); btShowCele._t = setTimeout(btCloseCele, 3200);
    }
    btMascotSay('Boss unlocked! ⚔️', 'big');
  }
  // Update the Points-tab charge bar + board badge in place (no full re-render).
  function btUpdateBossCharge(s){
    var was = s.bossUnlocked; btCheckBossUnlock(s, false);   // keep lock state in step with the current target (e.g. after a Maximum change)
    if (s.bossUnlocked !== was) btSave(s);
    var fill = document.getElementById('bt-charge-fill');
    if (fill) fill.style.width = Math.min(100, Math.round(btBossPct(s) * 100)) + '%';
    var wrap = document.getElementById('bt-charge'); if (wrap) wrap.classList.toggle('ready', !!s.bossUnlocked);
    var num = document.getElementById('bt-charge-num');
    if (num) num.textContent = s.bossUnlocked ? 'Charged — start it in the Battle tab' : ('class ' + btClassTotal(s) + ' / target ' + btBossTarget(s) + ' pts');
    var lab = document.getElementById('bt-charge-lab'); if (lab) lab.textContent = s.bossUnlocked ? '⚔️ Boss ready!' : 'Boss charge';
    var badge = document.getElementById('bt-bossbadge'); if (badge) badge.style.display = s.bossUnlocked ? '' : 'none';
  }
  function btBossChargeHTML(s){
    var pct = Math.min(100, Math.round(btBossPct(s) * 100)), unlocked = s.bossUnlocked;
    return '<div class="bt-charge' + (unlocked ? ' ready' : '') + '" id="bt-charge">' +
      '<div class="bt-charge-top"><span class="bt-charge-lab" id="bt-charge-lab">' + (unlocked ? '⚔️ Boss ready!' : 'Boss charge') + '</span>' +
        '<span class="bt-charge-num" id="bt-charge-num">' + (unlocked ? 'Charged — start it in the Battle tab' : ('class ' + btClassTotal(s) + ' / target ' + btBossTarget(s) + ' pts')) + '</span></div>' +
      '<div class="bt-charge-track"><div class="bt-charge-fill" id="bt-charge-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  }
  var CHEERS = ['Brilliant!','Well done!','Superstar!','Amazing!','Great work!','Yes! 🎉','Fantastic!','Top effort!'];
  var BIGS   = ['LEVEL UP! 🚀','New rank! 👑','You did it! 🏆','Wow! ⭐'];

  /* ── Number tween ──────────────────────────────────────── */
  function btAnimateNumber(node, from, to, ms){
    if (!node) return; var t0 = (window.performance ? performance.now() : Date.now());
    function step(now){ var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  /* ── Sound (WebAudio synth, no files) ──────────────────── */
  var btAC = null;
  function btCtx(){ try { var A = window.AudioContext || window.webkitAudioContext; btAC = btAC || new A(); return btAC; } catch(e){ return null; } }
  function btTone(freq, t0, dur, type, vol){
    var c = btCtx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sfx(kind, extra){
    if (!btLoad().sound) return; var c = btCtx(); if (!c) return; var t = c.currentTime;
    if (kind === 'gain'){ [659,880].forEach(function (f,i){ btTone(f, t + i*0.07, 0.16, 'triangle'); }); }
    else if (kind === 'loss'){ btTone(360, t, 0.12, 'sine', 0.13); btTone(260, t+0.08, 0.16, 'sine', 0.13); }
    else if (kind === 'streak'){ var base = 520 + Math.min(8, extra||0) * 70; btTone(base, t, 0.12, 'square', 0.12); btTone(base*1.25, t+0.05, 0.14, 'square', 0.1); }
    else if (kind === 'milestone'){ [784,988,1175].forEach(function (f,i){ btTone(f, t + i*0.06, 0.18, 'triangle', 0.15); }); }
    else if (kind === 'level'){ [523,659,784,1047,1319].forEach(function (f,i){ btTone(f, t + i*0.075, 0.22, 'triangle', 0.16); }); }
    else if (kind === 'hit'){ btTone(300, t, 0.06, 'sine', 0.09); }
    else if (kind === 'pop'){ btTone(180, t, 0.1, 'sawtooth', 0.12); btTone(120, t+0.04, 0.14, 'sawtooth', 0.1); }
    else if (kind === 'win'){ [523,659,784,1047,1319,1568].forEach(function (f,i){ btTone(f, t + i*0.09, 0.26, 'triangle', 0.17); }); }
  }

  /* ── Visual reactions (floaters, confetti, mascot, overlay) ─ */
  function btFx(){ return document.getElementById('bt-fx'); }
  function btRectTop(el){ var b = el.getBoundingClientRect(); return { x:b.left + b.width/2, y:b.top + 14 }; }
  function btFloater(el, text, cls){
    var fx = btFx(); if (!fx || !el) return; var c = btRectTop(el);
    var f = document.createElement('div'); f.className = 'floater' + (cls ? ' ' + cls : '');
    f.style.left = c.x + 'px'; f.style.top = c.y + 'px'; f.textContent = text;
    fx.appendChild(f); setTimeout(function (){ f.remove(); }, 1050);
  }
  function btConfetti(el, count, colors){
    if (!btLoad().confetti) return; var fx = btFx(); if (!fx || !el) return; var c = btRectTop(el);
    for (var i=0;i<count;i++){
      var p = document.createElement('div'); p.className = 'confetti';
      var ang = (-Math.PI/2) + (Math.random()-0.5) * 2.4, dist = 60 + Math.random()*120;
      var tx = Math.cos(ang)*dist, ty = Math.sin(ang)*dist + Math.random()*40;
      p.style.left = c.x + 'px'; p.style.top = c.y + 'px';
      p.style.setProperty('--tx', tx.toFixed(0)+'px'); p.style.setProperty('--ty', ty.toFixed(0)+'px');
      p.style.setProperty('--rot', (Math.random()*720-360)+'deg'); p.style.setProperty('--dur', (0.7 + Math.random()*0.5)+'s');
      p.style.background = colors[i % colors.length]; if (Math.random() < 0.4) p.style.borderRadius = '50%';
      fx.appendChild(p); (function (node){ setTimeout(function (){ node.remove(); }, 1300); })(p);
    }
  }
  function btConfettiRain(count){
    if (!btLoad().confetti) return; var fx = btFx(); if (!fx) return;
    var W = window.innerWidth, cols = ['#14b8a6','#fb7185','#f5b324','#7c5cff','#0d9488'];
    for (var i=0;i<count;i++){
      var p = document.createElement('div'); p.className = 'confetti';
      p.style.left = (Math.random()*W) + 'px'; p.style.top = '-12px';
      p.style.setProperty('--tx', (Math.random()*120-60)+'px'); p.style.setProperty('--ty', (window.innerHeight*0.75 + Math.random()*200)+'px');
      p.style.setProperty('--rot', (Math.random()*900-450)+'deg'); p.style.setProperty('--dur', (1.1 + Math.random()*0.8)+'s');
      p.style.background = cols[i % cols.length]; if (Math.random() < 0.4) p.style.borderRadius = '50%';
      fx.appendChild(p); (function (node){ setTimeout(function (){ node.remove(); }, 2000); })(p);
    }
  }
  // Bottom-sliding toast: "Ada +1" / "Ben −2" — one per manual award, auto-dismiss, stacking.
  function btToast(name, n){
    var wrap = document.getElementById('bt-toast'); if (!wrap || !name) return;
    var t = document.createElement('div');
    t.className = 'bt-toast ' + (n >= 0 ? 'gain' : 'loss');
    t.innerHTML = '<span class="bt-toast-n">' + (n >= 0 ? '+' + n : n) + '</span><span class="bt-toast-name">' + (typeof esc === 'function' ? esc(name) : name) + '</span>';
    wrap.appendChild(t);
    requestAnimationFrame(function (){ t.classList.add('in'); });
    setTimeout(function (){ t.classList.remove('in'); t.classList.add('out'); setTimeout(function (){ if (t.parentNode) t.parentNode.removeChild(t); }, 280); }, 2200);
    while (wrap.children.length > 5) wrap.removeChild(wrap.firstChild);   // cap the stack
  }
  // Animated winner pop-up over the still-mounted arena (confetti + sound); auto-continues
  // after ~3.6s or on tap, then runs `proceed` (award placements / bonus, then re-render).
  function btShowWinPop(html, big, lose, proceed){
    var arena = document.getElementById('bt-arena'), done = false, tm;
    function finish(){ if (done) return; done = true; clearTimeout(tm); proceed(); }
    if (!arena){ proceed(); return; }                                  // no arena (headless) → just proceed
    var pop = document.createElement('div'); pop.className = 'bt-winpop' + (lose ? ' lose' : ''); pop.innerHTML = html;
    pop.addEventListener('click', finish);
    arena.appendChild(pop);
    if (!lose) btConfettiRain(big ? 140 : 90);
    sfx(lose ? 'loss' : 'win');
    tm = setTimeout(finish, 3600);
  }
  var btMTimer = null, btBTimer = null;
  function btMascotSay(text, mood){
    if (!btLoad().mascot) return;
    var m = document.getElementById('bt-mascot'), b = document.getElementById('bt-bubble');
    if (!m || !b) return;
    m.classList.remove('cheer','big','aw'); void m.offsetWidth; m.classList.add(mood);
    b.textContent = text; b.classList.add('show');
    clearTimeout(btMTimer); clearTimeout(btBTimer);
    btMTimer = setTimeout(function (){ m.classList.remove('cheer','big','aw'); }, 900);
    btBTimer = setTimeout(function (){ b.classList.remove('show'); }, mood === 'big' ? 2600 : 1700);
  }
  var btQueue = [], btCelebrating = false, btFlushT = null;
  // Collect everything queued in the same burst (e.g. a whole-group award) and
  // show them together, ordered — so several pupils levelling at once all appear.
  function btQueueCele(c){ btQueue.push(c); if (!btCelebrating){ clearTimeout(btFlushT); btFlushT = setTimeout(btFlushCele, 40); } }
  function btFlushCele(){
    if (btCelebrating) return;
    if (!btQueue.length){ btCelebrating = false; return; }
    btCelebrating = true;
    var batch = btQueue.splice(0, btQueue.length);
    if (batch.length === 1) btShowCele(batch[0]); else btShowCeleMulti(batch);
  }
  var CELE_ORDER = { rank:0, level:1, badge:2 };
  function btCeleWhat(s, c){
    if (c.type === 'rank')  return { main:c.rank.label, color:c.rank.color };
    if (c.type === 'level') return { main:'Level ' + c.level, color:btRankFor(s, c.pts).color };
    var b = btBadgeByKey(s, c.badge); return { main:(b?b.name:'Badge'), color:'', icon:(b?b.icon:'⭐') };
  }
  function btShowCeleMulti(batch){
    var s = btLoad(), overlay = document.getElementById('bt-celebrate'), card = document.getElementById('bt-celeCard');
    if (!overlay || !card){ btCelebrating = false; return; }
    batch.sort(function (a, b){ return (CELE_ORDER[a.type] - CELE_ORDER[b.type]) || (b.pts - a.pts) || a.name.localeCompare(b.name); });
    var rows = batch.map(function (c){
      var w = btCeleWhat(s, c);
      var av = w.icon ? ('<span class="cele-mav badge-av">' + w.icon + '</span>')
                      : ('<span class="cele-mav" style="background:' + btAvColor(c.pid) + '">' + esc(initials(c.name)) + '</span>');
      return '<div class="cele-mrow">' + av +
        '<span class="cele-mname">' + esc(c.name) + '</span>' +
        '<span class="cele-mwhat"' + (w.color ? ' style="color:' + w.color + '"' : '') + '>' + esc(w.main) + '</span></div>';
    }).join('');
    card.innerHTML = '<div class="cele-kicker">Multiple achievements</div>' +
      '<div class="cele-name">' + batch.length + ' pupils! 🎉</div>' +
      '<div class="cele-multi">' + rows + '</div>' +
      '<div class="cele-tap">tap anywhere to continue</div>';
    overlay.classList.add('show'); sfx('level'); btConfettiRain(100);
    clearTimeout(btShowCele._t); btShowCele._t = setTimeout(btCloseCele, Math.min(5200, 2600 + batch.length * 350));
  }
  function btMascotMarkup(){
    return '<div class="bt-mascot cele-mascot big"><div class="m-spark">✨</div><div class="m-body"></div>' +
      '<div class="m-cheek l"></div><div class="m-cheek r"></div>' +
      '<div class="m-eye l"></div><div class="m-eye r"></div><div class="m-mouth"></div></div>';
  }
  function btShowCele(c){
    var s = btLoad(), rk = btRankFor(s, c.pts), overlay = document.getElementById('bt-celebrate'), card = document.getElementById('bt-celeCard');
    if (!overlay || !card) { btCelebrating = false; return; }
    var kicker, name, sub, body = '';
    if (c.type === 'rank'){
      kicker = 'New Rank Unlocked';
      body = '<div class="cele-rank" style="background:' + c.rank.bg + ';color:' + c.rank.color + '">' +
             '<span class="dot" style="background:' + c.rank.color + '"></span>' + c.rank.label + '</div>';
      name = c.rank.label + '!'; sub = esc(c.name) + ' reached ' + c.pts + ' points'; sfx('level');
    } else if (c.type === 'level'){
      kicker = 'Level Up'; name = 'Level ' + c.level; sub = esc(c.name) + ' · ' + rk.label; sfx('level');
    } else {
      kicker = 'Badge Unlocked'; name = btBadgeByKey(s, c.badge).name; sub = esc(c.name) + ' earned a badge'; sfx('milestone');
    }
    var badgeHtml = c.badge ? '<div class="cele-badge">' + btBadgeByKey(s, c.badge).icon + '</div>' : '';
    card.innerHTML = '<div class="cele-kicker">' + kicker + '</div>' + (c.badge ? badgeHtml : btMascotMarkup()) +
      '<div class="cele-name">' + name + '</div><div class="cele-sub">' + sub + '</div>' + body +
      '<div class="cele-tap">tap anywhere to continue</div>';
    overlay.classList.add('show'); btConfettiRain(c.type === 'rank' ? 90 : 60);
    clearTimeout(btShowCele._t); btShowCele._t = setTimeout(btCloseCele, c.type === 'rank' ? 2800 : 2200);
  }
  function btCloseCele(){ var o = document.getElementById('bt-celebrate'); if (o) o.classList.remove('show'); clearTimeout(btShowCele._t); btCelebrating = false; setTimeout(btFlushCele, 240); }
  window.btCloseCele = btCloseCele;

  /* ── Player card (collectible "player card" look) ──────── */
  var RING_R = 31, RING_C = 2 * Math.PI * RING_R;
  function btRingOffset(s, pts){ var e = btEarned(s, pts), within = e - Math.floor(e / PER_LEVEL) * PER_LEVEL, pct = within / PER_LEVEL; return RING_C * (1 - pct); }
  function btCardEl(pid){ var v = document.getElementById('bt-view'); return v ? v.querySelector('.pupil[data-pid="' + pid + '"]') : null; }
  function btBadgesHTML(s, pid, justGot){
    var got = btBadgesOf(s, pid);
    return btBadgesDef(s).map(function (b){
      var has = !!got[b.key];
      return '<span class="badge' + (has ? '' : ' locked') + (justGot === b.key ? ' justgot' : '') + '" title="' + esc(b.name) + '">' + (has ? b.icon : '') + '</span>';
    }).join('');
  }
  function btPupilCard(s, p){
    var pts = btPts(s, p.id), rk = btRankFor(s, pts), nr = btNextRank(s, pts), av = btAvColor(p.id);
    return '<div class="pupil' + (p.absent ? ' absent' : '') + '" data-pid="' + p.id + '" data-rank="' + rk.key + '" style="--rk:' + rk.color + ';--rkbg:' + rk.bg + '">' +
      (p.absent ? '<span class="p-absent">Absent</span>' : '') +
      '<span class="rank-glow" style="background:radial-gradient(120% 120% at 85% 100%, ' + rk.color + '22, transparent 60%)"></span>' +
      '<div class="p-ribbon"><span class="p-rank">' + rk.label + '</span><span class="p-emblem" style="color:' + rk.color + '"></span></div>' +
      '<div class="p-main">' +
        '<div class="p-av">' +
          '<svg class="p-ring" viewBox="0 0 76 76"><circle class="ring-track" cx="38" cy="38" r="' + RING_R + '"></circle>' +
          '<circle class="ring-prog" cx="38" cy="38" r="' + RING_R + '" style="stroke:' + rk.color + ';stroke-dasharray:' + RING_C.toFixed(1) + ';stroke-dashoffset:' + btRingOffset(s, pts).toFixed(1) + '"></circle></svg>' +
          '<span class="p-init" style="background:' + av + '">' + esc(initials(p.name)) + '</span>' +
          (s.showLevels ? '<span class="p-lvl">Lv ' + btLevelOf(s, pts) + '</span>' : '') +
        '</div>' +
        '<div class="p-info">' +
          '<div class="p-name">' + esc(p.name) + '</div>' +
          '<div class="p-ptsrow"><span class="p-pts" style="color:' + rk.color + '">' + pts + '</span><span class="p-u">pts</span></div>' +
          '<div class="p-next">' + (nr ? ((nr.min - pts) + ' to ' + nr.label) : '★ Top rank!') + '</div>' +
        '</div>' +
      '</div>' +
      (s.showBadges ? '<div class="p-badges">' + btBadgesHTML(s, p.id) + '</div>' : '') +
      '<div class="p-btns">' +
        '<button class="pbtn minus" title="Take a point" onclick="btAwardOne(\'' + p.id + '\',' + (-s.step) + ')">−</button>' +
        '<button class="pbtn plus" onclick="btAwardOne(\'' + p.id + '\',' + s.step + ')">+' + s.step + '</button>' +
      '</div>' +
    '</div>';
  }
  function btPaintCard(s, pid, instant, justGot){
    var d = btCardEl(pid); if (!d) return;
    var pts = btPts(s, pid), rk = btRankFor(s, pts), nr = btNextRank(s, pts);
    d.dataset.rank = rk.key; d.style.setProperty('--rk', rk.color); d.style.setProperty('--rkbg', rk.bg);
    d.querySelector('.p-rank').textContent = rk.label;
    d.querySelector('.p-emblem').style.color = rk.color;
    d.querySelector('.rank-glow').style.background = 'radial-gradient(120% 120% at 85% 100%, ' + rk.color + '22, transparent 60%)';
    var pe = d.querySelector('.p-pts'); pe.style.color = rk.color; if (instant) pe.textContent = pts;
    var lvl = d.querySelector('.p-lvl'); if (lvl) lvl.textContent = 'Lv ' + btLevelOf(s, pts);
    d.querySelector('.p-next').textContent = nr ? ((nr.min - pts) + ' to ' + nr.label) : '★ Top rank!';
    var ring = d.querySelector('.ring-prog'); ring.style.stroke = rk.color;
    if (instant) ring.style.transition = 'none';
    ring.style.strokeDashoffset = btRingOffset(s, pts);
    if (instant){ void ring.getBoundingClientRect(); ring.style.transition = ''; }
    var bd = d.querySelector('.p-badges'); if (bd) bd.innerHTML = btBadgesHTML(s, pid, justGot);
  }
  function btUpdateClassTotal(s, instant){
    var el = document.getElementById('bt-classtotal'); if (!el) return; var total = btClassTotal(s);
    if (instant){ el.textContent = total; return; } btAnimateNumber(el, +el.textContent || 0, total, 500);
  }

  /* ── Award (single path: reactions + ranks + badges + sound) ─ */
  var btStreak = {};
  function award(pid, n, opts){
    opts = opts || {}; if (!n) return;
    var s = btLoad(), before = btPts(s, pid), after = btClampP(s, before + n);
    if (after === before){ if (n < 0 && !opts.silent) btMascotSay("That's the floor!", 'aw'); return; }
    n = after - before; s.points[pid] = after;
    if (!opts.remote) btLogDaily(s, pid, n);   // per-day net for week/month leaderboard windows (not on the replay path)
    if (!opts.silent && n > 0) btPushRecent(s, pid, n);   // recent point-getters feed (Spotlight view + ticker)
    var oldLevel = btLevelOf(s, before), newLevel = btLevelOf(s, after);
    var oldRank = btRankFor(s, before).key, newRank = btRankFor(s, after).key;
    var name = pupilName(pid);
    if (!opts.silent && !opts.batch) btToast(name, n);   // bottom toast on a normal tap (battles/group-batch skip it)
    if (s.logBh && !opts.remote && typeof bhData !== 'undefined'){
      bhData.push({ id: uid(), date: todayISO(), pupilId: pid, type: n >= 0 ? 'positive' : 'concern',
        note: 'Behaviour Battler ' + (n >= 0 ? '+' : '') + n + (opts.label ? ' · ' + opts.label : '') });
      if (typeof bhSave === 'function'){ bhSave();
        if (document.getElementById('page-behaviour') && document.getElementById('page-behaviour').classList.contains('active') && typeof bhRender === 'function') bhRender(); }
    }
    if (n > 0) btOnGain(s, pid, name, n, oldLevel, newLevel, oldRank, newRank, before, after, opts);
    else       btOnLoss(s, pid, name, n, opts);
    btPaintCard(s, pid);
    var pe = btCardEl(pid); if (pe){ btAnimateNumber(pe.querySelector('.p-pts'), before, after, 480); }
    btUpdateClassTotal(s, false);
    btCheckBossUnlock(s, !opts.silent && !opts.batch);   // crossing the target unlocks the boss (with a fanfare)
    btSave(s);
    btUpdateBossCharge(s);
    btScheduleBoardRefresh();   // display views (non-classic) repaint from the new totals/order
  }
  window.btAward = award;
  // Coalesced re-render for the smartboard display views (classic uses in-place card paints).
  var btBoardRefreshT = null;
  function btScheduleBoardRefresh(){
    if (btBoardRefreshT) return;
    btBoardRefreshT = setTimeout(function (){
      btBoardRefreshT = null;
      var s = btLoad();
      if (AR.running || s.tab !== 'points' || btView() === 'classic') return;
      // preserve scroll: re-rendering the stage must not jump a scrolled board to the top
      var sx = window.scrollX, sy = window.scrollY;
      btRender();
      window.scrollTo(sx, sy);
    }, 90);
  }
  function btOnGain(s, pid, name, n, oldLevel, newLevel, oldRank, newRank, before, after, opts){
    // "batch" (whole-group award): keep the per-card visuals (float/confetti/bump)
    // but mute the per-pupil sound + mascot — the caller plays one of each, and the
    // celebration queue batches everyone who levelled into a single ordered overlay.
    var quiet = opts.silent || opts.batch;
    var d = btCardEl(pid);
    var st = btStreak[pid]; if (st) st.count++; else st = { count:1 }; btStreak[pid] = st;  // persists; only a loss breaks it
    if (d){ d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); setTimeout(function (){ d.classList.remove('bump'); }, 520); }
    var newBadge = null, got = btBadgesOf(s, pid);
    btMilestoneBadges(s).forEach(function (b){ if (before < b.min && after >= b.min && !got[b.key]){ got[b.key] = true; newBadge = b.key; } });
    var fb = btBadgeByKey(s, 'first'); if (fb && after >= fb.min) got.first = true;
    var gotStreak = false, anchor = d || opts.anchor;
    if (st.count >= 2){
      if (anchor && !opts.silent) btFloater(anchor, '🔥 ×' + st.count, 'streak');
      if (anchor && !opts.silent) btConfetti(anchor, 10 + st.count*4, ['#f5b324','#fb7185','#14b8a6','#7c5cff']);
      if (!quiet) sfx('streak', st.count);
      if (st.count >= 3 && !got.streak){ got.streak = true; gotStreak = true; }
    } else {
      if (anchor && !opts.silent) btFloater(anchor, '+' + n);
      if (anchor && !opts.silent) btConfetti(anchor, 12, ['#14b8a6','#0d9488','#5eead4','#f5b324']);
      if (!quiet) sfx('gain');
    }
    if (d) btPaintCard(s, pid, false, newBadge || (gotStreak ? 'streak' : null));
    if (newRank !== oldRank){ if (!quiet) btMascotSay(btPick(BIGS), 'big'); btQueueCele({ type:'rank', pid:pid, name:name, pts:after, rank:btRankFor(s, after), badge:newBadge }); }
    else if (newLevel > oldLevel){ if (!quiet) btMascotSay('Level ' + newLevel + '! 🚀', 'big'); btQueueCele({ type:'level', pid:pid, name:name, pts:after, level:newLevel, badge:newBadge }); }
    else if (newBadge){ if (!quiet) btMascotSay('Badge unlocked! ' + btBadgeByKey(s, newBadge).icon, 'big'); btQueueCele({ type:'badge', pid:pid, name:name, pts:after, badge:newBadge }); }
    else if (!quiet){ if (st.count >= 3) btMascotSay(st.count + ' in a row! 🔥', 'cheer'); else btMascotSay(btPick(CHEERS) + ' ' + name, 'cheer'); }
  }
  function btOnLoss(s, pid, name, n, opts){
    var quiet = opts.silent || opts.batch;
    var d = btCardEl(pid); btStreak[pid] = null;
    if (d){ d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); d.classList.add('dip');
      setTimeout(function (){ d.classList.remove('shake'); }, 440); setTimeout(function (){ d.classList.remove('dip'); }, 650);
      if (!opts.silent) btFloater(d, n, 'neg'); } else if (opts.anchor && !opts.silent){ btFloater(opts.anchor, n, 'neg'); }
    if (!quiet) sfx('loss');
    if (!quiet) btMascotSay('Keep going, ' + name, 'aw');   // badges are permanent
  }

  /* ── Handlers (window) ──────────────────────────────────── */
  window.btSetTab   = function (t){ var s = btLoad(); s.tab = t; btSave(s); btRender(); };
  window.btSetStep  = function (n){ var s = btLoad(); s.step = n; btSave(s); btRender(); };
  window.btSetBoardView = function (v){
    v = (BT_BOARD_VIEWS.indexOf(v) >= 0) ? v : 'classic';
    try { window.localStorage.setItem(BT_VIEW_KEY, v); } catch (e) {}   // device-local; not synced
    btRender();
  };
  window.btSetMinPoints = function (v){ var s = btLoad(); var n = parseInt(v,10); s.minPoints = (n >= 0 ? n : 0); btApplyConfig(s); btSave(s); btRender(); };
  window.btSetStartPoints = function (v){ var s = btLoad(); var n = parseInt(v,10); s.startPoints = (n >= 0 ? n : 0); btApplyConfig(s); btSave(s); btRender(); };
  window.btSetMaxPoints = function (v){ var s = btLoad(); if (v === '' || v == null){ s.maxPoints = ''; } else { var n = parseInt(v,10); s.maxPoints = (n >= 0 ? n : ''); } btApplyConfig(s); btSave(s); btRender(); };
  window.btToggle   = function (key){ var s = btLoad(); s[key] = !s[key]; btSave(s); btRender();
    if (key === 'mascot' && !s.mascot){ var b = document.getElementById('bt-bubble'); if (b) b.classList.remove('show'); } };
  window.btToggleQuiet = function (key){ var s = btLoad(); s[key] = !s[key]; btSave(s);
    var el = document.querySelector('[data-tog="' + key + '"]'); if (el){ el.classList.toggle('on', s[key]); } };
  window.btAwardOne = function (pid, n){ award(pid, n); };
  window.btAwardTable = function (tid, sign){
    var s = btLoad(), t = s.tables.find(function (x){ return x.id === tid; });
    if (!t || !t.pupilIds.length) return;
    var n = sign * s.step, i = s.tables.indexOf(t);
    t.pupilIds.forEach(function (pid){ award(pid, n, { silent:true, label:'Group: ' + t.name }); });
    btRender();
    var card = document.querySelector('#bt-view .group[data-gid="' + tid + '"]');
    if (card){
      var totalEl = card.querySelector('.g-total-n'); if (totalEl){ totalEl.classList.remove('pulse'); void totalEl.offsetWidth; totalEl.classList.add('pulse'); }
      if (sign > 0){ card.classList.add('bump'); setTimeout(function (){ card.classList.remove('bump'); }, 520);
        btConfetti(card, 18, [btGroupColor(i), '#f5b324', '#14b8a6', '#fff']); btFloater(card, '+' + s.step + ' each'); sfx('gain');
        btMascotSay(t.name + ' — ' + btPick(['great teamwork!','superb!','well done all!','brilliant!']), 'cheer'); }
      else { card.classList.add('shake'); setTimeout(function (){ card.classList.remove('shake'); }, 440);
        btFloater(card, '−' + s.step + ' each', 'neg'); sfx('loss'); btMascotSay(t.name + ', settle and refocus', 'aw'); }
    }
  };
  // Award a whole group from the Points-tab bar: every member's individual card
  // animates (+N float / confetti / bump / count-up); one shared sound + mascot
  // line; level/rank pop-ups for everyone who crossed a threshold are batched.
  window.btAwardGroupBoard = function (tid, sign){
    var s = btLoad(), t = s.tables.find(function (x){ return x.id === tid; });
    if (!t || !t.pupilIds.length) return;
    var n = sign * s.step;
    t.pupilIds.forEach(function (pid){ award(pid, n, { batch:true, label:'Group: ' + t.name }); });
    sfx(sign > 0 ? 'gain' : 'loss');
    btMascotSay(t.name + (sign > 0 ? ' — ' + btPick(['great teamwork!','superb!','well done all!','brilliant!']) : ', settle and refocus'), sign > 0 ? 'cheer' : 'aw');
    // refresh the bar's totals in place (a full re-render would wipe the card animations)
    var s2 = btLoad();
    s2.tables.forEach(function (tt){
      var el = document.querySelector('#bt-view .bt-groupbtn[data-gid="' + tt.id + '"] .bt-gn');
      if (el) el.textContent = btTableTotal(s2, tt);
    });
    if (btCheckBossUnlock(s2, true)) btSave(s2);   // a group award can push the class over the boss target
    btUpdateBossCharge(s2);
  };
  window.btResetPoints = function (){
    var s = btLoad();
    if (!confirm('Reset every pupil back to the starting amount (' + btStart(s) + ')?')) return;
    s.points = {}; s.badges = {}; btApplyConfig(s); s.boss.dealt = 0; btStreak = {};
    s.bossUnlocked = false;   // re-lock the boss; class total drops back below the target
    btSave(s); btRender();
  };
  window.btResetLeaderboard = function (){
    var s = btLoad();
    if (!confirm('Reset the leaderboard? This clears placement medals and the week/month history. Points are kept.')) return;
    s.placements = {}; s.daily = {};
    btSave(s); btRender();
  };
  window.btAddTable = function (){
    var inp = document.getElementById('btTableName'), name = (inp.value || '').trim();
    if (!name) return;
    var s = btLoad(); s.tables.push({ id: uid(), name: name, pupilIds: [] }); btSave(s); btRender();
  };
  window.btRenameTable = function (tid, name){ var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t){ t.name = name; btSave(s); } };
  window.btDeleteTable = function (tid){ if (!confirm('Delete this group?')) return; var s = btLoad(); s.tables = s.tables.filter(function (t){ return t.id !== tid; }); btSave(s); btRender(); };
  window.btAddMember = function (tid, pid){ if (!pid) return; var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t && t.pupilIds.indexOf(pid) < 0){ t.pupilIds.push(pid); btSave(s); btRender(); } };
  window.btRemoveMember = function (tid, pid){ var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t){ t.pupilIds = t.pupilIds.filter(function (x){ return x !== pid; }); btSave(s); btRender(); } };
  window.btAutoTables = function (){
    var s = btLoad(); var pupils = sortedRoster(); if (!pupils.length) return;
    var n = Math.max(2, Math.min(8, parseInt(document.getElementById('btAutoN').value, 10) || 4));
    var groups = []; for (var i = 0; i < n; i++) groups.push({ id: uid(), name: 'Group ' + (i + 1), pupilIds: [] });
    pupils.forEach(function (p, i){ groups[i % n].pupilIds.push(p.id); });
    s.tables = groups; btSave(s); btRender();
  };

  /* ── Controls strip + cfg row (shared by Points & Groups) ── */
  function btReTog(key, label){ var s = btLoad(); return '<button class="toggle' + (s[key]?' on':'') + '" onclick="btToggle(\'' + key + '\')"><span class="sw"></span>' + label + '</button>'; }
  function btControlsHTML(s){
    return '<div class="ctrls no-print">' +
      '<div class="ctrl-grp"><span class="ctrl-lab">Per tap</span><div class="steps">' +
        [1,2,5].map(function (n){ return '<button class="step' + (s.step===n?' on':'') + '" onclick="btSetStep(' + n + ')">+' + n + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="ctrl-grp"><span class="ctrl-lab">Reactions</span>' + btReTog('mascot','Mascot') + btReTog('confetti','Confetti') + btReTog('sound','Sound') + '</div>' +
    '</div>';
  }
  // slim per-tap-only strip kept on the Points tab for quick live use
  function btStepStripHTML(s){
    return '<div class="ctrls no-print"><div class="ctrl-grp"><span class="ctrl-lab">Per tap</span><div class="steps">' +
      [1,2,5].map(function (n){ return '<button class="step' + (s.step===n?' on':'') + '" onclick="btSetStep(' + n + ')">+' + n + '</button>'; }).join('') +
    '</div></div></div>';
  }
  // group-award buttons along the top of the Points tab (only when groups exist)
  function btGroupBarHTML(s){
    if (!s.tables.length) return '';
    return '<div class="bt-groupbar no-print"><span class="bt-groupbar-label">Group points</span>' +
      s.tables.map(function (t, i){
        var c = btGroupColor(i), total = btTableTotal(s, t);
        return '<span class="bt-groupbtn" data-gid="' + t.id + '">' +
          '<button class="bt-gminus" onclick="btAwardGroupBoard(\'' + t.id + '\',-1)" aria-label="Take a point from ' + esc(t.name) + '">−</button>' +
          '<button class="bt-gadd" style="background:' + c + ';color:#fff" onclick="btAwardGroupBoard(\'' + t.id + '\',1)">' +
            esc(t.name) + ' +' + s.step + ' <span class="bt-gn">' + total + '</span></button>' +
        '</span>';
      }).join('') +
    '</div>';
  }
  function btCfgRowHTML(s){
    return '<div class="cfg-row no-print">' +
      '<div class="cfg-fg"><label>Minimum</label><input type="number" min="0" value="' + btMin(s) + '" onchange="btSetMinPoints(this.value)" /></div>' +
      '<div class="cfg-fg"><label>Starting</label><input type="number" min="0" value="' + btStart(s) + '" onchange="btSetStartPoints(this.value)" /></div>' +
      '<div class="cfg-fg"><label>Maximum</label><input type="number" min="0" placeholder="none" value="' + esc(s.maxPoints) + '" onchange="btSetMaxPoints(this.value)" /></div>' +
      '<button class="ghost" onclick="btResetPoints()">↺ Reset all to starting</button>' +
      '<span class="cfg-note">New pupils begin at <b>Starting</b>; points stay between <b>Minimum</b> and <b>Maximum</b>. Set a <b>Maximum</b> and the ranks &amp; badges rescale to it.</span>' +
    '</div>';
  }

  /* ── BATTLE ARENA (physics) ────────────────────────────────
     Free-for-all: avatars bounce, a long spinning arm knocks a
     point off whoever it touches; pop at zero, last one wins.
     Boss battle: the class attacks a boss with 6 orbiting limbs
     (each its own HP + spinning arm); clear all limbs, then the
     core. The boss's limb-arms knock points off pupils. */
  var BT_R = 30, BT_REACH = 80, BT_MIN = 0.55, BT_MAX = 3.6, BT_REST = 1.07;
  var BT_SPIN_ACC = 0.0005, BT_SPIN_MAX = 0.10, BT_KNOCK = 3.2, BT_FFA_MS = 120000, BT_FFA_MIN = 50;
  var AR = { running:false, paused:false, mode:'ffa', bots:[], boss:null, raf:0, lastWinner:'', result:'', bossMsg:'', inset:0, insetX:0, insetY:0, ffaElapsed:0, lastT:0 };
  // Free-for-all shrink is TIME-based (not pixels/frame) so it's resolution-independent:
  // the arena closes from full to a tiny ~BT_FFA_MIN px square linearly over BT_FFA_MS (2:00),
  // by which point a winner has long been forced. Returns the shrink-progress scalar (px inset
  // on the long axis); btInsets() turns it into per-axis insets (shave to a square, then equally).
  function btFfaInset(W, H, elapsedMs){
    var maxP = Math.max(W, H) / 2 - BT_FFA_MIN / 2;   // full shrink leaves a ~BT_FFA_MIN px square
    if (maxP <= 0) return 0;
    return Math.max(0, Math.min(maxP, maxP * elapsedMs / BT_FFA_MS));
  }
  // Derive per-axis insets from the single shrink-progress scalar so the WIDER axis
  // shaves down first (to a square), then both axes shrink together — keeping the zone
  // square instead of degenerating into a long thin rectangle on wide screens.
  function btInsets(W, H){
    var p = AR.inset;
    var dW = Math.max(0, (W - H) / 2);   // landscape: width shaves this much before square
    var dH = Math.max(0, (H - W) / 2);   // portrait: height shaves first
    return { x: Math.max(0, p - dH), y: Math.max(0, p - dW) };
  }

  function btSpeedClamp(b){
    var sp = Math.hypot(b.vx, b.vy) || 0.0001;
    var k = sp < BT_MIN ? BT_MIN/sp : (sp > BT_MAX ? BT_MAX/sp : 1);
    b.vx *= k; b.vy *= k;
  }
  // Knock a battler away from a point (the arm/attacker) — a bounce in the opposite direction.
  function btKnock(b, fromX, fromY){
    var dx = b.x - fromX, dy = b.y - fromY, d = Math.hypot(dx, dy) || 0.0001;
    b.vx = dx/d * BT_KNOCK; b.vy = dy/d * BT_KNOCK; btSpeedClamp(b);
  }
  // Arms gradually accelerate their spin, up to a cap.
  function btAccSpin(o, prop){
    o[prop] += (o[prop] >= 0 ? 1 : -1) * BT_SPIN_ACC;
    if (o[prop] > BT_SPIN_MAX) o[prop] = BT_SPIN_MAX;
    if (o[prop] < -BT_SPIN_MAX) o[prop] = -BT_SPIN_MAX;
  }
  // Elastic-ish bump along the contact normal, with restitution > 1 so a
  // knock can speed a battler up or slow it down. Then clamp to sane speeds.
  function btBump(A, B){
    var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.0001, nx = dx/d, ny = dy/d;
    var an = A.vx*nx + A.vy*ny, bn = B.vx*nx + B.vy*ny;
    if (an - bn > 0){ // approaching
      var t = (an - bn) * BT_REST;
      A.vx -= t*nx; A.vy -= t*ny; B.vx += t*nx; B.vy += t*ny;
      btSpeedClamp(A); btSpeedClamp(B);
    }
  }
  function btArenaSize(){
    var a = document.getElementById('bt-arena');
    return { W: a ? a.clientWidth || 900 : 900, H: a ? a.clientHeight || 520 : 520 };
  }

  function btSpawn(s){
    s = s || btLoad();
    var sz = btArenaSize(), W = sz.W, H = sz.H;
    return btActiveRoster().map(function (p, i){
      var r = BT_R, sp = 1.0 + Math.random(), a = Math.random() * Math.PI * 2;
      var bot = {
        pid: p.id, name: p.name, color: BT_COLORS[i % BT_COLORS.length], r: r,
        hp: Math.max(1, btPts(s, p.id)),  // pupil's points = battle HP (starting + awards, clamped)
        x: r + Math.random() * (W - 2*r), y: r + 20 + Math.random() * (H - 2*r - 20),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ang: Math.random() * Math.PI * 2, spin: (Math.random() < 0.5 ? -1 : 1) * (0.024 + Math.random()*0.03),
        cd: 0, alive: true, el: null, ball: null, arm: null, lastHp: -1
      };
      // earned badges become single-use power-ups; transient effect state below
      var got = s.powerups ? btBadgesOf(s, p.id) : {};
      bot.powerups = BT_PU_ORDER.filter(function (k){ return got[k]; })
        .map(function (k){ return { key:k, icon:BT_PU[k].icon, name:BT_PU[k].name, used:false }; });
      bot.nextRoll = 0;
      bot.dmgBonus = 0; bot.reachBonus = 0; bot.strikeUntil = 0;
      bot.invulnUntil = 0; bot.dashUntil = 0;
      bot.fireUntil = 0; bot.nextBurn = 0; bot.spinBoost = 0;
      bot.healUntil = 0; bot.shockUntil = 0; bot._puDirty = true;
      bot.puEl = null; bot.puCells = null; bot.puCnt = null;
      return bot;
    });
  }
  /* ── Power-ups: roll, fire, and damage-over-time. A pupil holds one single-use
     power-up per earned badge; each fires at most once, by chance, with the odds
     rising as more remain. Works in both free-for-all and boss battles. ── */
  function btPuEnemies(b, bots, ffa){
    if (ffa) return bots.filter(function (o){ return o !== b && o.alive; });
    var e = [], boss = AR.boss; if (!boss) return e;
    (boss.sats || []).forEach(function (S){ if (S.alive) e.push(S); });
    (boss.minis || []).forEach(function (M){ if (M.alive) e.push(M); });
    if (boss.core && boss.core.alive && boss.core.vuln) e.push(boss.core);
    return e;
  }
  function btPuFire(b, bots, key, now, ffa){
    var c = BT_PU[key];
    if (c.fx === 'heal'){ b.hp += c.heal; b.healUntil = now + 600; }
    else if (c.fx === 'dash'){ b.dashUntil = now + c.dashMs; b.invulnUntil = now + c.invulMs;
      var sp = Math.hypot(b.vx, b.vy) || 0.0001, k = (BT_MAX * 1.4) / sp; b.vx *= k; b.vy *= k; }
    else if (c.fx === 'shock'){ b.shockUntil = now + 500;
      btPuEnemies(b, bots, ffa).forEach(function (o){
        var dx = o.x - b.x, dy = o.y - b.y;
        if (dx*dx + dy*dy < c.shockR*c.shockR){ btKnock(o, b.x, b.y); btHurt(o, c.dmg, now); } }); }
    else if (c.fx === 'strike'){ b.strikeUntil = now + c.strikeMs; b.dmgBonus = c.dmgBonus; b.reachBonus = c.reachBonus; }
    else if (c.fx === 'fire'){ b.fireUntil = now + c.fireMs; b.spinBoost = c.spinBoost; b.nextBurn = now; }
    b._puDirty = true;
    if (typeof sfx === 'function') sfx('hit');
  }
  function btPuBurn(b, bots, now, ffa){
    var c = BT_PU.streak;
    btPuEnemies(b, bots, ffa).forEach(function (o){
      if (o.invulnUntil > now) return;
      var dx = o.x - b.x, dy = o.y - b.y;
      if (dx*dx + dy*dy < c.burnR*c.burnR && now >= (o.cd || 0)){ o.hp -= 1; o.cd = now + 420; o.justHit = now;
        if (o.hp <= 0){ o.alive = false; o.poppedAt = now; } } });
  }
  function btPuTick(b, bots, now, ffa){
    if (b.strikeUntil && now >= b.strikeUntil){ b.strikeUntil = 0; b.dmgBonus = 0; b.reachBonus = 0; }
    if (b.fireUntil && now >= b.fireUntil){ b.fireUntil = 0; b.spinBoost = 0; }
    if (b.dashUntil && now >= b.dashUntil){ b.dashUntil = 0; }
    if (b.fireUntil && now >= b.nextBurn){ b.nextBurn = now + BT_PU.streak.burnMs; btPuBurn(b, bots, now, ffa); }
    if (!b.powerups || !b.powerups.length || now < b.nextRoll) return;
    b.nextRoll = now + BT_PU_ROLL_MS;
    var pool = b.powerups.filter(function (p){ return !p.used; });
    if (!pool.length) return;
    var pFire = 1 - Math.pow(1 - BT_PU_P_EACH, pool.length);   // more remaining → higher chance
    if (Math.random() >= pFire) return;
    var pu = pool[(Math.random() * pool.length) | 0]; pu.used = true;
    btPuFire(b, bots, pu.key, now, ffa);
  }
  // Shared damage helper so an invulnerable pupil shrugs off every hazard. Returns true if hurt.
  function btHurt(P, dmg, now){
    if (P.invulnUntil > now) return false;
    P.hp -= dmg; P.justHit = now;
    if (P.hp <= 0){ P.alive = false; P.poppedAt = now; }
    return true;
  }
  /* ── Boss balancing — auto-scales to class strength (sum of pupils' points
     = sum of their battle HP) so it's hard but winnable for any class. ── */
  var BOSS = { coreF:0.32, sat1F:0.023, sat2F:0.027, miniHpF:0.02, miniCap:4,
               miniEvery:4200, laserEvery:3800, laserLife:900, laserSweep:0.7,
               blastR:84, blastFrac:0.5, regenMs:1400, swarm:0.048,
               // boss-AI cadence (a random power-up every ~aiEvery±aiJitter ms once exposed)
               aiEvery:5400, aiJitter:1800,
               shockSpeed:6, shockThick:28, shockDmg:1, shockKnock:4,
               missileLife:4400, missileTurn:0.05, missileSpeed:3.0, missileDmg:2, missileR:9,
               bombFuse:1100, bombR:78, bombFrac:0.3,
               gravityKick:2.2,
               shieldMs:2600,
               healDelay:3800, healEvery:950 };   // regen 1 HP / healEvery ms when the core is left alone
  function btBossPower(s){ return btActiveRoster().reduce(function (a,p){ return a + Math.max(1, btPts(s, p.id)); }, 0); }
  function btMakeSats(boss, wave){
    var core = boss.core, n = boss.n, hp = (wave === 1 ? boss.satHp1 : boss.satHp2), out = [];
    for (var i = 0; i < n; i++) out.push({
      off: i*(Math.PI*2/n), r:26, hp:hp, max:hp, alive:true,
      arms: (wave === 1 ? 1 : 2), regen: (wave === 1), regenned:false, explode: (wave === 2), regenAt:0,
      x:core.x, y:core.y, ownAng:Math.random()*Math.PI*2, ownSpin:(i%2?1:-1)*(0.042+Math.random()*0.024),
      reach:52, cd:0, el:null, ball:null, arm:null, arm2:null, conn:null, lastHp:-1, justHit:0, _popped:false
    });
    return out;
  }
  function btSpawnBoss(s){
    var sz = btArenaSize(), n = 6, armLen = Math.min(150, sz.H * 0.30);
    var csp = 0.45, ca = Math.random() * Math.PI * 2, power = btBossPower(s);   // slower roam so the class can corner it in a full-size arena
    var coreHp = Math.max(24, Math.round(power * BOSS.coreF));
    var core = { x: sz.W/2, y: sz.H*0.48, r: 46, hp: coreHp, maxHp: coreHp, ang: 0, spin: 0.011,
                 vx: Math.cos(ca)*csp, vy: Math.sin(ca)*csp,
                 ownAng: Math.random()*Math.PI*2, ownSpin: 0.036, reach: 90, arms: 2,
                 cd: 0, alive: true, vuln: false, el: null, ball: null, arm1: null, arm2: null, lastHp:-1, justHit:0, _popped:false };
    core.shield = false; core.shieldUntil = 0; core.lastDamaged = 0; core.healAt = 0;
    var boss = { core: core, sats: [], n: n, armLen: armLen, wave: 1,
                 satHp1: Math.max(2, Math.round(power * BOSS.sat1F)),
                 satHp2: Math.max(2, Math.round(power * BOSS.sat2F)),
                 miniHp:  Math.max(2, Math.round(power * BOSS.miniHpF)),
                 minis: [], lasers: [], blasts: [], shockwaves: [], missiles: [], bombs: [],
                 flags:{ enrage:false, last:false }, nextAI: 0 };
    boss.sats = btMakeSats(boss, 1);
    return boss;
  }
  function btAliveCount(arr){ var c = 0; for (var i = 0; i < arr.length; i++) if (arr[i].alive) c++; return c; }
  // Exploding satellite (wave 2): knock 50% off the HP of every nearby pupil.
  function btBossBlast(boss, bots, x, y, now){
    boss.blasts.push({ x:x, y:y, born:now, r:BOSS.blastR, el:null });
    for (var i = 0; i < bots.length; i++){ var P = bots[i]; if (!P.alive) continue;
      var dx = P.x - x, dy = P.y - y;
      if (dx*dx + dy*dy < BOSS.blastR*BOSS.blastR){ btKnock(P, x, y);
        if (!(P.invulnUntil > now)){ P.hp = Math.floor(P.hp * (1 - BOSS.blastFrac)); P.justHit = now;
          if (P.hp <= 0){ P.alive = false; P.poppedAt = now; } } } }
  }
  function btBossFireLaser(boss, now){
    boss.lasers.push({ ang: Math.random()*Math.PI*2, sweep: (Math.random()<0.5?-1:1)*BOSS.laserSweep, born:now, life:BOSS.laserLife, cur:0, el:null });
  }
  function btBossTickLasers(boss, bots, now){
    var core = boss.core, keep = [];
    for (var i = 0; i < boss.lasers.length; i++){ var L = boss.lasers[i], age = now - L.born;
      if (age > L.life){ if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el); continue; }
      L.cur = L.ang + L.sweep * (age / L.life);
      var ux = Math.cos(L.cur), uy = Math.sin(L.cur), len = 1000;
      for (var k = 0; k < bots.length; k++){ var P = bots[k]; if (!P.alive) continue;
        var rx = P.x - core.x, ry = P.y - core.y, proj = rx*ux + ry*uy;
        if (proj > core.r && proj < len && Math.abs(rx*(-uy) + ry*ux) < P.r + 6 && now >= (P.cd||0)){
          P.cd = now + 640; btHurt(P, 1, now); } }
      keep.push(L);
    }
    boss.lasers = keep;
  }
  function btBossSpawnMini(boss, now){
    var core = boss.core, a = Math.random()*Math.PI*2, sp = 1.2 + Math.random();
    boss.minis.push({ r:18, hp: boss.miniHp, max: boss.miniHp,
      x: core.x + Math.cos(a)*60, y: core.y + Math.sin(a)*60,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, ang: Math.random()*Math.PI*2,
      spin:(Math.random()<0.5?-1:1)*(0.05+Math.random()*0.03), reach:46, cd:0, alive:true,
      el:null, ball:null, arm:null, lastHp:-1, justHit:0, _popped:false });
  }
  function btBossTickMinis(boss, bots, W, H, now, insetX, insetY){
    var minis = boss.minis, i, k;
    for (i = 0; i < minis.length; i++){ var M = minis[i]; if (!M.alive) continue;
      M.x += M.vx; M.y += M.vy; M.ang += M.spin; btAccSpin(M, 'spin'); btWalls(M, W, H, insetX, insetY); btSpeedClamp(M);
      var tx = M.x + Math.cos(M.ang)*M.reach, ty = M.y + Math.sin(M.ang)*M.reach;
      for (k = 0; k < bots.length; k++){ var P = bots[k]; if (!P.alive) continue;
        var dx = P.x - M.x, dy = P.y - M.y, d2 = dx*dx + dy*dy, rr = P.r + M.r;
        if (d2 < rr*rr && d2 > 0.01){ var d = Math.sqrt(d2), nx = dx/d, ny = dy/d, push = (rr - d)/2;
          P.x += nx*push; P.y += ny*push; M.x -= nx*push; M.y -= ny*push; btBump(M, P); }
        var hx = P.x - tx, hy = P.y - ty;
        if (hx*hx + hy*hy < P.r*P.r && now >= P.cd){ P.cd = now + 580; btKnock(P, M.x, M.y); btHurt(P, 1, now); }
        var preach = BT_REACH + (P.reachBonus || 0);
        var ptx = P.x + Math.cos(P.ang)*preach, pty = P.y + Math.sin(P.ang)*preach;
        var mx = M.x - ptx, my = M.y - pty;
        if (mx*mx + my*my < M.r*M.r && now >= M.cd){ M.hp -= (1 + (P.dmgBonus || 0)); M.cd = now + 260; M.justHit = now;
          if (M.hp <= 0){ M.alive = false; M.poppedAt = now; } }
      }
    }
  }

  /* ── Extra boss hazards (DOM-free physics; lazy-mounted in btPaint) ── */
  // Shockwave: an expanding red ring; its front knocks a life off each pupil once.
  function btBossShockwave(boss, now){ boss.shockwaves.push({ x:boss.core.x, y:boss.core.y, r:boss.core.r, maxR:760, born:now, hit:{}, el:null }); }
  function btBossTickShockwaves(boss, bots, now){
    var keep = [];
    for (var i = 0; i < boss.shockwaves.length; i++){ var S = boss.shockwaves[i];
      S.r += BOSS.shockSpeed;
      if (S.r > S.maxR){ if (S.el && S.el.parentNode) S.el.parentNode.removeChild(S.el); continue; }
      for (var k = 0; k < bots.length; k++){ var P = bots[k]; if (!P.alive || S.hit[P.pid]) continue;
        var dd = Math.hypot(P.x - S.x, P.y - S.y);
        if (dd >= S.r - BOSS.shockThick && dd <= S.r + P.r){
          S.hit[P.pid] = 1;
          var dx = P.x - S.x, dy = P.y - S.y, dn = Math.hypot(dx, dy) || 1;
          P.vx = dx/dn * BOSS.shockKnock; P.vy = dy/dn * BOSS.shockKnock; btSpeedClamp(P);
          btHurt(P, BOSS.shockDmg, now);
        }
      }
      keep.push(S);
    }
    boss.shockwaves = keep;
  }
  // Homing missile: picks a random pupil and hunts it; heavy hit on contact.
  function btBossLaunchMissile(boss, bots, now){
    var alive = bots.filter(function (b){ return b.alive; }); if (!alive.length) return;
    var t = alive[Math.floor(Math.random()*alive.length)], a = Math.random()*Math.PI*2;
    boss.missiles.push({ x:boss.core.x, y:boss.core.y, vx:Math.cos(a)*BOSS.missileSpeed, vy:Math.sin(a)*BOSS.missileSpeed,
      target:t.pid, born:now, life:BOSS.missileLife, r:BOSS.missileR, ang:a, el:null });
  }
  function btBossTickMissiles(boss, bots, W, H, now){
    var keep = [];
    for (var i = 0; i < boss.missiles.length; i++){ var M = boss.missiles[i];
      if (now - M.born > M.life){ if (M.el && M.el.parentNode) M.el.parentNode.removeChild(M.el); continue; }
      var tgt = null, k, P;
      for (k = 0; k < bots.length; k++){ if (bots[k].pid === M.target && bots[k].alive){ tgt = bots[k]; break; } }
      if (!tgt){ var best = 1e9; for (k = 0; k < bots.length; k++){ P = bots[k]; if (!P.alive) continue;
        var dd = (P.x-M.x)*(P.x-M.x) + (P.y-M.y)*(P.y-M.y); if (dd < best){ best = dd; tgt = P; M.target = P.pid; } } }
      if (tgt){ var desired = Math.atan2(tgt.y - M.y, tgt.x - M.x), cur = Math.atan2(M.vy, M.vx);
        var diff = Math.atan2(Math.sin(desired - cur), Math.cos(desired - cur));
        var turn = Math.max(-BOSS.missileTurn, Math.min(BOSS.missileTurn, diff)), na = cur + turn;
        M.vx = Math.cos(na)*BOSS.missileSpeed; M.vy = Math.sin(na)*BOSS.missileSpeed; M.ang = na;
      }
      M.x += M.vx; M.y += M.vy;
      if (M.x < -40 || M.x > W + 40 || M.y < -40 || M.y > H + 40){ if (M.el && M.el.parentNode) M.el.parentNode.removeChild(M.el); continue; }
      var hit = null;
      for (k = 0; k < bots.length; k++){ var Q = bots[k]; if (!Q.alive) continue;
        var hx = Q.x - M.x, hy = Q.y - M.y; if (hx*hx + hy*hy < (Q.r + M.r)*(Q.r + M.r)){ hit = Q; break; } }
      if (hit){ btKnock(hit, M.x, M.y); btHurt(hit, BOSS.missileDmg, now);
        boss.blasts.push({ x:M.x, y:M.y, r:42, born:now, el:null });   // visual splash only
        if (M.el && M.el.parentNode) M.el.parentNode.removeChild(M.el); continue;
      }
      keep.push(M);
    }
    boss.missiles = keep;
  }
  // Telegraphed bomb: a marked circle that detonates for AoE after a short fuse.
  function btBossDropBomb(boss, bots, W, H, now){
    var alive = bots.filter(function (b){ return b.alive; }), tx, ty;
    if (alive.length && Math.random() < 0.7){ var t = alive[Math.floor(Math.random()*alive.length)]; tx = t.x; ty = t.y; }
    else { tx = 60 + Math.random()*(W-120); ty = 60 + Math.random()*(H-120); }
    boss.bombs.push({ x:tx, y:ty, r:BOSS.bombR, born:now, fuse:BOSS.bombFuse, el:null });
  }
  function btBossTickBombs(boss, bots, now){
    var keep = [];
    for (var i = 0; i < boss.bombs.length; i++){ var B = boss.bombs[i];
      if (now - B.born >= B.fuse){
        for (var k = 0; k < bots.length; k++){ var P = bots[k]; if (!P.alive) continue;
          var dx = P.x - B.x, dy = P.y - B.y;
          if (dx*dx + dy*dy < B.r*B.r){ btKnock(P, B.x, B.y);
            if (!(P.invulnUntil > now)){ P.hp = Math.floor(P.hp * (1 - BOSS.bombFrac)); P.justHit = now;
              if (P.hp <= 0){ P.alive = false; P.poppedAt = now; } } } }
        boss.blasts.push({ x:B.x, y:B.y, r:B.r, born:now, el:null });
        if (B.el && B.el.parentNode) B.el.parentNode.removeChild(B.el); continue;
      }
      keep.push(B);
    }
    boss.bombs = keep;
  }
  // Gravity pulse: yank every pupil toward the core (into the limbs/beams).
  function btBossGravity(boss, bots){
    var core = boss.core;
    for (var i = 0; i < bots.length; i++){ var P = bots[i]; if (!P.alive) continue;
      var dx = core.x - P.x, dy = core.y - P.y, d = Math.hypot(dx, dy) || 1;
      P.vx += dx/d * BOSS.gravityKick; P.vy += dy/d * BOSS.gravityKick; btSpeedClamp(P);
    }
  }
  function btBossShield(boss, now){ boss.core.shield = true; boss.core.shieldUntil = now + BOSS.shieldMs; }
  // Heal-when-ignored: regenerate core HP slowly if no one has hit it for a while.
  function btBossHeal(boss, now){
    var core = boss.core;
    if (core.lastDamaged && now - core.lastDamaged > BOSS.healDelay && core.hp < core.maxHp){
      if (!core.healAt) core.healAt = now + BOSS.healEvery;
      if (now >= core.healAt){ core.hp = Math.min(core.maxHp, core.hp + 1); core.healAt = now + BOSS.healEvery; }
      core.healing = true;
    } else { core.healAt = 0; core.healing = false; }
  }
  // Boss AI: every so often, randomly pick a power-up from the phase-unlocked pool.
  function btBossAI(boss, bots, W, H, now){
    var core = boss.core; if (!core.alive) return;
    if (!boss.nextAI){ boss.nextAI = now + BOSS.aiEvery; return; }
    if (now < boss.nextAI) return;
    var pct = core.hp / core.maxHp;
    var pool = ['laser','shock'];
    if (boss.wave >= 2) pool.push('gravity','bomb');
    if (core.vuln){ pool.push('missiles','mini'); if (pct <= 0.30) pool.push('shield'); }
    var pick = function (){ return pool[Math.floor(Math.random()*pool.length)]; };
    var cast = function (a){
      if (a === 'laser') btBossFireLaser(boss, now);
      else if (a === 'shock') btBossShockwave(boss, now);
      else if (a === 'missiles'){ var n = 1 + Math.floor(Math.random()*2); for (var m = 0; m < n; m++) btBossLaunchMissile(boss, bots, now); }
      else if (a === 'mini'){ if (btAliveCount(boss.minis) < BOSS.miniCap) btBossSpawnMini(boss, now); }
      else if (a === 'gravity') btBossGravity(boss, bots);
      else if (a === 'bomb') btBossDropBomb(boss, bots, W, H, now);
      else if (a === 'shield') btBossShield(boss, now);
    };
    cast(pick());
    if (pct <= 0.30 && Math.random() < 0.5) cast(pick());   // late-phase double-cast
    var base = boss.flags.enrage ? BOSS.aiEvery * 0.6 : BOSS.aiEvery;
    boss.nextAI = (pct <= 0.05) ? now + 700 : now + base + (Math.random()*2 - 1) * BOSS.aiJitter;
  }

  function btWalls(b, W, H, insetX, insetY){
    insetX = insetX || 0; insetY = insetY || 0;
    if (b.x < insetX + b.r){ b.x = insetX + b.r; b.vx = Math.abs(b.vx); }
    if (b.x > W - insetX - b.r){ b.x = W - insetX - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < insetY + b.r){ b.y = insetY + b.r; b.vy = Math.abs(b.vy); }
    if (b.y > H - insetY - b.r){ b.y = H - insetY - b.r; b.vy = -Math.abs(b.vy); }
  }
  function btMovePupils(bots, W, H, withArmHits, now, insetX, insetY){
    var i, j;
    for (i = 0; i < bots.length; i++){ var b = bots[i]; if (!b.alive) continue;
      btPuTick(b, bots, now, withArmHits);   // power-ups: expire buffs, burn, maybe fire one
      b.x += b.vx; b.y += b.vy;
      b.ang += b.spin + (b.spinBoost ? (b.spin >= 0 ? b.spinBoost : -b.spinBoost) : 0);
      btAccSpin(b, 'spin'); btWalls(b, W, H, insetX, insetY);
      if (!(b.dashUntil > now)) btSpeedClamp(b);   // a Shooting-Star dash briefly exceeds the cap
    }
    for (i = 0; i < bots.length; i++){ var A = bots[i]; if (!A.alive) continue;
      var reach = BT_REACH + (A.reachBonus || 0);
      var tx = A.x + Math.cos(A.ang)*reach, ty = A.y + Math.sin(A.ang)*reach;
      for (j = i+1; j < bots.length; j++){ var B = bots[j]; if (!B.alive) continue;
        var dx = B.x - A.x, dy = B.y - A.y, d2 = dx*dx + dy*dy, rr = A.r + B.r;
        if (d2 < rr*rr && d2 > 0.01){
          var d = Math.sqrt(d2), nx = dx/d, ny = dy/d, push = (rr - d)/2;
          A.x -= nx*push; A.y -= ny*push; B.x += nx*push; B.y += ny*push;
          btBump(A, B);
        }
      }
      if (withArmHits){
        for (j = 0; j < bots.length; j++){ if (i===j) continue; var C = bots[j]; if (!C.alive) continue;
          var hx = C.x - tx, hy = C.y - ty;
          if (hx*hx + hy*hy < C.r*C.r && now >= C.cd){
            C.cd = now + 420;       // throttle the interaction (Power Strike adds +damage)
            btKnock(C, A.x, A.y);   // bounce the struck avatar away from the attacker
            A.spin = -A.spin;       // the arm bounces off, reversing its spin
            btHurt(C, 1 + (A.dmgBonus || 0), now); }   // invuln avatars take no damage
        }
      }
    }
  }

  // Free-for-all step. Returns alive count.
  function btTick(bots, W, H, now, insetX, insetY){
    btMovePupils(bots, W, H, true, now, insetX, insetY);
    var alive = 0; for (var i = 0; i < bots.length; i++) if (bots[i].alive) alive++;
    return alive;
  }

  // Boss step. Returns { pupils, limbs, core }.
  // Boss step. Phases: wave 1 (limbs regenerate once with 2 arms) → wave 2
  // (limbs explode for 50% AoE on death) → wave 3 / core (lasers at 80% HP,
  // mini-me spawns at 60%, enrage at 20%, last-stand burst at 5%).
  function btTickBoss(bots, boss, W, H, now, insetX, insetY){
    insetX = insetX || 0; insetY = insetY || 0;
    var core = boss.core, sats = boss.sats, i, k, ai;
    boss.minis = boss.minis || []; boss.lasers = boss.lasers || []; boss.blasts = boss.blasts || []; boss.flags = boss.flags || {};
    btMovePupils(bots, W, H, false, now, insetX, insetY);     // pupils cooperate (no arm damage to each other)
    // the core roams the arena; bounce so its limbs stay on-screen
    core.x += core.vx; core.y += core.vy;
    // full-size arena (no shrink): gently pull pupils toward the boss so the class
    // mobs it and the fight stays focused and resolves
    for (i = 0; i < bots.length; i++){ var Pp = bots[i]; if (!Pp.alive) continue;
      var ax = core.x - Pp.x, ay = core.y - Pp.y, ad = Math.hypot(ax, ay) || 1;
      Pp.vx += (ax/ad) * BOSS.swarm; Pp.vy += (ay/ad) * BOSS.swarm; btSpeedClamp(Pp);
    }
    var marg = Math.min(Math.max(insetX, insetY) + boss.armLen + 30, Math.min(W, H)/2 - 8);
    if (core.x < marg){ core.x = marg; core.vx = Math.abs(core.vx); }
    if (core.x > W - marg){ core.x = W - marg; core.vx = -Math.abs(core.vx); }
    if (core.y < marg){ core.y = marg; core.vy = Math.abs(core.vy); }
    if (core.y > H - marg){ core.y = H - marg; core.vy = -Math.abs(core.vy); }
    core.ang += core.spin; core.ownAng += core.ownSpin; btAccSpin(core, 'ownSpin');

    // satellites: orbit, and (wave 1) regenerate once with 2 arms after a beat
    var liveLimbs = 0;
    for (i = 0; i < sats.length; i++){ var st = sats[i];
      if (st.alive){ liveLimbs++;
        var a = core.ang + st.off; st.x = core.x + Math.cos(a)*boss.armLen; st.y = core.y + Math.sin(a)*boss.armLen;
        st.ownAng += st.ownSpin; btAccSpin(st, 'ownSpin');
      } else if (boss.wave === 1 && st.regen && !st.regenned){
        if (!st.regenAt) st.regenAt = now + BOSS.regenMs;
        if (now >= st.regenAt){ st.alive = true; st.hp = st.max; st.arms = 2; st.regenned = true; st.regenAt = 0; st._popped = false; st.lastHp = -1; st.el = null; }
      }
    }
    // wave transitions
    if (boss.wave === 1 && sats.every(function (x){ return !x.alive && x.regenned; })){
      boss.wave = 2; boss.sats = btMakeSats(boss, 2); sats = boss.sats;
    } else if (boss.wave === 2 && sats.every(function (x){ return !x.alive; })){
      boss.wave = 3;
    }
    core.vuln = boss.wave >= 3 && core.alive;

    // pupils attack limbs/core; limbs bump + their spinning arm(s) hit pupils
    for (i = 0; i < bots.length; i++){ var P = bots[i]; if (!P.alive) continue;
      var preach2 = BT_REACH + (P.reachBonus || 0);   // Power Strike extends the pupil's reach
      var tx = P.x + Math.cos(P.ang)*preach2, ty = P.y + Math.sin(P.ang)*preach2;
      for (k = 0; k < sats.length; k++){ var S = sats[k]; if (!S.alive) continue;
        var dx = P.x - S.x, dy = P.y - S.y, d2 = dx*dx + dy*dy, rr = P.r + S.r;
        if (d2 < rr*rr && d2 > 0.01){ var d = Math.sqrt(d2), nx = dx/d, ny = dy/d;
          P.x = S.x + nx*rr; P.y = S.y + ny*rr;
          var vn = P.vx*nx + P.vy*ny; if (vn < 0){ P.vx -= 2*vn*nx; P.vy -= 2*vn*ny; btSpeedClamp(P); } }
        var hx = S.x - tx, hy = S.y - ty;
        if (hx*hx + hy*hy < S.r*S.r && now >= S.cd){ S.hp -= (1 + (P.dmgBonus || 0)); S.cd = now + 230; S.justHit = now; P.spin = -P.spin;
          if (S.hp <= 0){ S.alive = false; S.poppedAt = now; if (S.explode) btBossBlast(boss, bots, S.x, S.y, now); } }
        for (ai = 0; ai < (S.arms || 1); ai++){
          var sang = S.ownAng + ai*(Math.PI*2/(S.arms || 1));
          var sx = S.x + Math.cos(sang)*S.reach, sy = S.y + Math.sin(sang)*S.reach;
          var px = P.x - sx, py = P.y - sy;
          if (px*px + py*py < P.r*P.r && now >= P.cd){ P.cd = now + 580; btKnock(P, S.x, S.y); btHurt(P, 1, now); break; }
        }
      }
      if (core.vuln && core.alive){
        var cdx = P.x - core.x, cdy = P.y - core.y, crr = P.r + core.r;
        if (cdx*cdx + cdy*cdy < crr*crr){ var cd = Math.hypot(cdx,cdy)||0.0001, cnx=cdx/cd, cny=cdy/cd;
          P.x = core.x + cnx*crr; P.y = core.y + cny*crr;
          var cvn = P.vx*cnx + P.vy*cny; if (cvn < 0){ P.vx -= 2*cvn*cnx; P.vy -= 2*cvn*cny; btSpeedClamp(P); } }
        var ctx = core.x - tx, cty = core.y - ty;
        if (ctx*ctx + cty*cty < core.r*core.r && now >= core.cd && !core.shield){ core.hp -= (1 + (P.dmgBonus || 0)); core.cd = now + 57; core.justHit = now; core.lastDamaged = now;
          if (core.hp <= 0){ core.hp = 0; core.alive = false; } }
      }
    }
    // core's own 2 arms keep swinging at pupils once exposed
    if (core.vuln && core.alive){
      for (ai = 0; ai < core.arms; ai++){
        var aang = core.ownAng + ai * (Math.PI*2 / core.arms);
        var atx = core.x + Math.cos(aang)*core.reach, aty = core.y + Math.sin(aang)*core.reach;
        for (k = 0; k < bots.length; k++){ var Q = bots[k]; if (!Q.alive) continue;
          var qx = Q.x - atx, qy = Q.y - aty;
          if (qx*qx + qy*qy < Q.r*Q.r && now >= Q.cd){ Q.cd = now + 580; btKnock(Q, core.x, core.y); btHurt(Q, 1, now); }
        }
      }
      // phase milestones (the AI picks WHICH power-ups to fire; these just escalate)
      var pct = core.hp / core.maxHp;
      if (pct <= 0.20 && !boss.flags.enrage){ boss.flags.enrage = true; core.spin *= 1.9; core.ownSpin *= 1.5; }
      if (pct <= 0.05 && !boss.flags.last){ boss.flags.last = true; for (var mm = 0; mm < 3; mm++) btBossSpawnMini(boss, now); btBossShockwave(boss, now); btBossFireLaser(boss, now); }
      if (core.shield && now >= core.shieldUntil) core.shield = false;
      btBossHeal(boss, now);                              // regenerate if the class stops attacking the core
    }
    btBossAI(boss, bots, W, H, now);                      // random power-up scheduler (runs through all waves)
    btBossTickLasers(boss, bots, now);
    btBossTickMinis(boss, bots, W, H, now, insetX, insetY);
    btBossTickShockwaves(boss, bots, now);
    btBossTickMissiles(boss, bots, W, H, now);
    btBossTickBombs(boss, bots, now);

    var pupils = 0; for (i = 0; i < bots.length; i++) if (bots[i].alive) pupils++;
    return { pupils: pupils, limbs: liveLimbs, core: core.hp, wave: boss.wave };
  }

  /* ── Painting ───────────────────────────────────────────── */
  function btPopEl(holder){ if (holder.el && !holder.el.classList.contains('pop')){ holder.el.classList.add('pop');
    var el = holder.el; setTimeout(function (){ if (el && el.parentNode) el.parentNode.removeChild(el); }, 320); holder.el = null;
    if (holder.conn && holder.conn.parentNode){ holder.conn.parentNode.removeChild(holder.conn); holder.conn = null; } } }
  function btPaintBot(b){
    if (!b.el) return;
    if (!b.alive){ if (!b._popped){ b._popped = true; sfx('pop'); } btPopEl(b); return; }   // pop sound on elimination
    b.el.style.transform = 'translate(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px)';
    b.arm.style.transform = 'rotate(' + b.ang + 'rad)';
    if (b.hp !== b.lastHp){ if (b.hp < b.lastHp) sfx('hit'); b.ball.firstChild.nodeValue = b.hp; b.lastHp = b.hp; }   // tick on losing a point
    if (b.justHit && Date.now() - b.justHit < 240) b.el.classList.add('hit'); else b.el.classList.remove('hit');
    // power-up indicator (remaining count + greyed-out used) and active-effect auras
    if (b.puEl && b._puDirty){ b._puDirty = false; var rem = 0;
      for (var pk = 0; pk < b.powerups.length; pk++){ var pp = b.powerups[pk], cell = b.puCells[pk];
        if (pp.used && !cell.classList.contains('used')) cell.classList.add('used', 'spent');   // pop the icon as it's spent
        if (!pp.used) rem++; }
      b.puCnt.textContent = rem ? rem : '';
    }
    if (b.powerups && b.powerups.length){ var nw = Date.now();
      b.el.classList.toggle('pu-heal',   b.healUntil   > nw);
      b.el.classList.toggle('pu-invuln', b.invulnUntil > nw);
      b.el.classList.toggle('pu-dash',   b.dashUntil   > nw);
      b.el.classList.toggle('pu-shock',  b.shockUntil  > nw);
      b.el.classList.toggle('pu-strike', b.strikeUntil > nw);
      b.el.classList.toggle('pu-fire',   b.fireUntil   > nw);
    }
  }
  function btMountSat(arena, st){
    var conn = document.createElement('div'); conn.className = 'bt-conn'; arena.appendChild(conn); st.conn = conn;
    var el = btMakeBot(st, 'bt-sat');
    if (st.arms === 2){ var a2 = document.createElement('div'); a2.className = 'bt-arm'; a2.style.width = ((st.reach || BT_REACH) + 6) + 'px'; el.insertBefore(a2, el.firstChild); st.arm2 = a2; }
    arena.appendChild(el);
  }
  function btPaint(){
    var arena = document.getElementById('bt-arena'), i;
    for (i = 0; i < AR.bots.length; i++) btPaintBot(AR.bots[i]);
    if (!AR.boss || !arena) return;
    var boss = AR.boss, core = boss.core;
    if (core.el){
      core.el.style.transform = 'translate(' + (core.x - core.r) + 'px,' + (core.y - core.r) + 'px)';
      if (core.hp !== core.lastHp){ core.ball.firstChild.nodeValue = Math.max(0, core.hp); core.lastHp = core.hp; }
      core.el.classList.toggle('vuln', core.vuln && core.alive);
      core.el.classList.toggle('enrage', !!(boss.flags && boss.flags.enrage) && core.alive);
      core.el.classList.toggle('shielded', !!core.shield && core.alive);
      if (core.arm1){
        var showArms = core.vuln && core.alive;
        core.arm1.style.display = showArms ? 'block' : 'none';
        core.arm2.style.display = showArms ? 'block' : 'none';
        if (showArms){
          core.arm1.style.transform = 'rotate(' + core.ownAng + 'rad)';
          core.arm2.style.transform = 'rotate(' + (core.ownAng + Math.PI) + 'rad)';
        }
      }
      if (!core.alive){ if (!core._popped){ core._popped = true; } btPopEl(core); }
      if (core.justHit && Date.now() - core.justHit < 240) core.el.classList.add('hit'); else core.el && core.el.classList.remove('hit');
    }
    boss.sats.forEach(function (st){
      if (st.alive && !st.el) btMountSat(arena, st);            // lazy-mount (covers regenerated + new-wave limbs)
      if (!st.el) return;
      if (!st.alive){ if (!st._popped){ st._popped = true; sfx('pop'); } btPopEl(st); return; }
      st.el.style.transform = 'translate(' + (st.x - st.r) + 'px,' + (st.y - st.r) + 'px)';
      if (st.arm) st.arm.style.transform = 'rotate(' + st.ownAng + 'rad)';
      if (st.arm2) st.arm2.style.transform = 'rotate(' + (st.ownAng + Math.PI) + 'rad)';
      if (st.hp !== st.lastHp){ st.ball.firstChild.nodeValue = st.hp; st.lastHp = st.hp; }
      if (st.conn){
        var len = Math.hypot(st.x - core.x, st.y - core.y), ang = Math.atan2(st.y - core.y, st.x - core.x);
        st.conn.style.width = len + 'px';
        st.conn.style.transform = 'translate(' + core.x + 'px,' + (core.y - 4) + 'px) rotate(' + ang + 'rad)';
      }
      if (st.justHit && Date.now() - st.justHit < 200) st.el.classList.add('hit'); else st.el.classList.remove('hit');
    });
    // mini-me bosses (lazy-mount)
    boss.minis.forEach(function (M){
      if (M.alive && !M.el) arena.appendChild(btMakeBot(M, 'bt-mini'));
      if (!M.el) return;
      if (!M.alive){ if (!M._popped){ M._popped = true; sfx('pop'); } btPopEl(M); return; }
      M.el.style.transform = 'translate(' + (M.x - M.r) + 'px,' + (M.y - M.r) + 'px)';
      if (M.arm) M.arm.style.transform = 'rotate(' + M.ang + 'rad)';
      if (M.hp !== M.lastHp){ M.ball.firstChild.nodeValue = M.hp; M.lastHp = M.hp; }
      if (M.justHit && Date.now() - M.justHit < 200) M.el.classList.add('hit'); else M.el.classList.remove('hit');
    });
    // laser beams
    boss.lasers.forEach(function (L){
      if (!L.el){ var le = document.createElement('div'); le.className = 'bt-laser'; arena.appendChild(le); L.el = le; }
      L.el.style.width = '1000px';
      L.el.style.transform = 'translate(' + core.x + 'px,' + core.y + 'px) rotate(' + (L.cur || L.ang) + 'rad)';
    });
    // explosion rings (transient)
    boss.blasts = (boss.blasts || []).filter(function (bl){
      if (!bl.el){ var be = document.createElement('div'); be.className = 'bt-blast'; be.style.left = (bl.x - bl.r) + 'px'; be.style.top = (bl.y - bl.r) + 'px'; be.style.width = be.style.height = (bl.r*2) + 'px'; arena.appendChild(be); bl.el = be; }
      if (Date.now() - bl.born > 420){ if (bl.el && bl.el.parentNode) bl.el.parentNode.removeChild(bl.el); return false; }
      return true;
    });
    // shockwave rings (expanding)
    (boss.shockwaves || []).forEach(function (S){
      if (!S.el){ var se = document.createElement('div'); se.className = 'bt-shockwave'; arena.appendChild(se); S.el = se; }
      S.el.style.left = (S.x - S.r) + 'px'; S.el.style.top = (S.y - S.r) + 'px'; S.el.style.width = S.el.style.height = (S.r*2) + 'px';
      S.el.style.opacity = Math.max(0, 1 - S.r / S.maxR);
    });
    // homing missiles
    (boss.missiles || []).forEach(function (M){
      if (!M.el){ var me = document.createElement('div'); me.className = 'bt-missile'; arena.appendChild(me); M.el = me; }
      M.el.style.transform = 'translate(' + (M.x - M.r) + 'px,' + (M.y - M.r) + 'px)';
    });
    // telegraphed bombs (target marker before detonation)
    (boss.bombs || []).forEach(function (B){
      if (!B.el){ var bo = document.createElement('div'); bo.className = 'bt-bomb'; bo.style.left = (B.x - B.r) + 'px'; bo.style.top = (B.y - B.r) + 'px'; bo.style.width = bo.style.height = (B.r*2) + 'px'; arena.appendChild(bo); B.el = bo; }
    });
  }

  function btMakeBot(b, cls){
    var el = document.createElement('div'); el.className = 'bt-bot' + (cls ? ' ' + cls : '');
    el.style.width = el.style.height = (b.r * 2) + 'px';
    el.style.transform = 'translate(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px)';
    var arm = document.createElement('div'); arm.className = 'bt-arm';
    arm.style.width = ((b.reach || BT_REACH) + 6) + 'px';
    var ball = document.createElement('div'); ball.className = 'bt-ball'; if (b.color) ball.style.background = b.color;
    ball.appendChild(document.createTextNode(b.hp));
    el.appendChild(arm); el.appendChild(ball);
    if (b.name){ var tag = document.createElement('div'); tag.className = 'bt-tag'; tag.textContent = b.name; el.appendChild(tag); }
    if (b.powerups && b.powerups.length){          // earned-badge power-ups + remaining-to-fire count
      var pu = document.createElement('div'); pu.className = 'bt-pu';
      b.puCells = b.powerups.map(function (p){ var c = document.createElement('span');
        c.className = 'bt-pu-i'; c.textContent = p.icon; c.title = p.name; pu.appendChild(c); return c; });
      b.puCnt = document.createElement('span'); b.puCnt.className = 'bt-pu-n'; pu.appendChild(b.puCnt);
      el.appendChild(pu); b.puEl = pu; b._puDirty = true;
    }
    b.el = el; b.arm = arm; b.ball = ball; b.lastHp = b.hp;
    return el;
  }
  function btMount(){
    var arena = document.getElementById('bt-arena'); if (!arena) return;
    if (AR.boss){
      var core = AR.boss.core;
      // satellites/minis/lasers lazy-mount in btPaint (so regen + new waves appear)
      var cel = document.createElement('div'); cel.className = 'bt-bot bt-core';
      cel.style.width = cel.style.height = (core.r*2) + 'px';
      cel.style.transform = 'translate(' + (core.x-core.r) + 'px,' + (core.y-core.r) + 'px)';
      var ca1 = document.createElement('div'); ca1.className = 'bt-arm bt-core-arm'; ca1.style.width = (core.reach + 6) + 'px'; ca1.style.display = 'none';
      var ca2 = document.createElement('div'); ca2.className = 'bt-arm bt-core-arm'; ca2.style.width = (core.reach + 6) + 'px'; ca2.style.display = 'none';
      var cball = document.createElement('div'); cball.className = 'bt-ball'; cball.appendChild(document.createTextNode(core.hp));
      var ctag = document.createElement('div'); ctag.className = 'bt-tag'; ctag.textContent = 'BOSS';
      cel.appendChild(ca1); cel.appendChild(ca2); cel.appendChild(cball); cel.appendChild(ctag); arena.appendChild(cel);
      core.el = cel; core.ball = cball; core.arm1 = ca1; core.arm2 = ca2; core.lastHp = core.hp;
    }
    AR.bots.forEach(function (b){ arena.appendChild(btMakeBot(b)); });
  }

  function btPaintFrame(W, H){
    var ins = btInsets(W, H); AR.insetX = ins.x; AR.insetY = ins.y;
    var f = document.getElementById('bt-frame'); if (!f) return;
    f.style.left = f.style.right = ins.x + 'px';
    f.style.top = f.style.bottom = ins.y + 'px';
  }
  function btStatus(){
    var rem = document.getElementById('btRemain'); if (!rem) return;
    if (AR.mode === 'boss' && AR.boss){
      var b = AR.boss, live = b.sats.filter(function (s){ return s.alive; }).length;
      var pupils = AR.bots.filter(function (x){ return x.alive; }).length;
      var minis = btAliveCount(b.minis || []);
      var stage = b.wave < 3 ? ('Wave ' + b.wave + ' · Limbs ' + live + '/' + b.n) : ('CORE ' + Math.max(0, b.core.hp) + '/' + b.core.maxHp);
      rem.textContent = stage + ' · Class ' + pupils + ' left' + (minis ? ' · ' + minis + ' mini-bosses' : '');
    } else {
      rem.textContent = AR.bots.filter(function (b){ return b.alive; }).length + ' remaining';
    }
  }
  function btFrame(){
    var arena = document.getElementById('bt-arena'), page = document.getElementById('page-battler');
    if (!AR.running || !arena || !(page && page.classList.contains('active'))){ AR.running = false; return; }
    if (!AR.paused){
      var W = arena.clientWidth, H = arena.clientHeight, now = Date.now();
      // free-for-all closes in by % of TIME (full shrink over 2:00, resolution-independent);
      // the boss arena stays full-size. dt is clamped so a pause/tab-stall doesn't jump it.
      if (AR.mode !== 'boss'){
        var dt = AR.lastT ? Math.min(120, now - AR.lastT) : 16;
        AR.ffaElapsed += dt;
        AR.inset = btFfaInset(W, H, AR.ffaElapsed);
      }
      AR.lastT = now;
      btPaintFrame(W, H);
      if (AR.mode === 'boss'){
        var r = btTickBoss(AR.bots, AR.boss, W, H, now, AR.insetX, AR.insetY); btPaint(); btStatus();
        if (!AR.boss.core.alive){ btFinishBoss(true); return; }
        if (r.pupils === 0){ btFinishBoss(false); return; }
      } else {
        var alive = btTick(AR.bots, W, H, now, AR.insetX, AR.insetY); btPaint(); btStatus();
        if (alive <= 1){ btFinish(); return; }
      }
    }
    AR.raf = requestAnimationFrame(btFrame);
  }

  /* ── Controls / lifecycle ───────────────────────────────── */
  window.btStartBattle = function (){
    var s = btLoad();
    if (btActiveRoster().length < 2) return;
    AR.lastWinner = ''; AR.result = ''; AR.bossMsg = ''; AR.running = true; AR.paused = false; AR.inset = 0; AR.insetX = 0; AR.insetY = 0; AR.ffaElapsed = 0; AR.lastT = 0;
    AR.mode = (s.arenaMode === 'boss' && s.bossUnlocked) ? 'boss' : 'ffa';
    s.tab = 'battle'; btSave(s);
    AR.bots = btSpawn(s);
    AR.boss = AR.mode === 'boss' ? btSpawnBoss(s) : null;
    btRender(); btMount();
    cancelAnimationFrame(AR.raf); AR.raf = requestAnimationFrame(btFrame);
  };
  window.btPauseBattle = function (){
    AR.paused = !AR.paused;
    var btn = document.getElementById('btPauseBtn');
    if (btn) btn.innerHTML = AR.paused ? (iconSVG('play',16) + ' Resume') : (iconSVG('pause',16) + ' Pause');
  };
  window.btEndBattle = function (){ AR.running = false; cancelAnimationFrame(AR.raf); AR.bots = []; AR.boss = null; btRender(); };
  function btOrdinal(p){ return ['', '1st','2nd','3rd','4th','5th'][p] || (p + 'th'); }
  // Finishing order: the survivor is 1st, then the eliminated in REVERSE knock-out order (last out = next place).
  function btFinishOrder(bots){
    var alive = [], dead = [];
    bots.forEach(function (b){ (b.alive ? alive : dead).push(b); });
    dead.sort(function (a, b){ return (b.poppedAt || 0) - (a.poppedAt || 0); });
    return alive.concat(dead).map(function (b){ return b.pid; });
  }
  // Award placement points (1st=5 … 5th=1) and record each pupil's 1st–5th history.
  function btAwardPlacements(order){
    if (!order.length) return;
    var s = btLoad(), top = order.slice(0, 5);
    top.forEach(function (pid, i){ var place = i + 1; s.placements[pid] = s.placements[pid] || {}; s.placements[pid][place] = (s.placements[pid][place] || 0) + 1; });
    btSave(s);   // persist placements first so award()'s own save keeps them
    top.forEach(function (pid, i){ var place = i + 1; award(pid, 6 - place, { silent:true, label:btOrdinal(place) + ' place' }); });
  }
  function btFfaWinHTML(order){
    var rows = order.slice(0, 3).map(function (pid, i){
      var place = i + 1, medal = ['🥇','🥈','🥉'][i];
      return '<div class="wp-row wp-' + place + '"><span class="wp-medal">' + medal + '</span>' +
        '<span class="wp-av" style="background:' + btAvColor(pid) + '">' + esc(initials(pupilName(pid))) + '</span>' +
        '<span class="wp-name">' + esc(pupilName(pid)) + '</span><span class="wp-pts">+' + (6 - place) + '</span></div>';
    }).join('');
    return '<div class="wp-card"><div class="wp-crown">👑</div><div class="wp-title">' + esc(pupilName(order[0])) + ' wins!</div>' +
      '<div class="wp-list">' + rows + '</div><div class="wp-tap">tap to continue</div></div>';
  }
  function btBossWinHTML(win, survivors){
    if (win) return '<div class="wp-card"><div class="wp-crown">🏆</div><div class="wp-title">Boss defeated!</div>' +
      '<div class="wp-sub">' + (survivors.length ? (survivors.length + ' survivor' + (survivors.length === 1 ? '' : 's') + ' share the bonus') : 'The class wins!') + '</div><div class="wp-tap">tap to continue</div></div>';
    return '<div class="wp-card lose"><div class="wp-crown">💥</div><div class="wp-title">The boss won…</div>' +
      '<div class="wp-sub">Earn more points and try again!</div><div class="wp-tap">tap to continue</div></div>';
  }
  function btFinish(){
    AR.running = false; cancelAnimationFrame(AR.raf);
    var order = btFinishOrder(AR.bots);
    AR.lastWinner = order[0] ? pupilName(order[0]) : '';
    var html = btFfaWinHTML(order);                  // build before clearing refs
    AR.bots = []; AR.boss = null;
    btShowWinPop(html, true, false, function (){ btAwardPlacements(order); btRender(); });
  }
  function btFinishBoss(win){
    AR.running = false; cancelAnimationFrame(AR.raf);
    var survivors = AR.bots.filter(function (b){ return b.alive; }).map(function (b){ return b.pid; });
    AR.result = win ? 'win' : 'lose';
    AR.bossMsg = win ? 'The class defeated the boss!' : 'The boss won this time — try again!';
    var html = btBossWinHTML(win, survivors);
    AR.bots = []; AR.boss = null;
    btShowWinPop(html, win, !win, function (){
      if (win){ var s = btLoad(); if (s.winnerBonus > 0 && survivors.length) survivors.forEach(function (pid){ award(pid, s.winnerBonus, { silent:true, label:'Beat the boss' }); }); }
      btRender();
    });
  }
  window.btSetWinnerBonus = function (v){ var s = btLoad(); var n = parseInt(v,10); s.winnerBonus = (n >= 0 ? n : 5); btSave(s); };
  window.btSetArenaMode = function (m){ var s = btLoad(); if (m === 'boss' && !s.bossUnlocked) return; s.arenaMode = (m === 'boss' ? 'boss' : 'ffa'); btSave(s); btRender(); };
  window.btSetSatHP = function (v){ var s = btLoad(); s.satHP = Math.max(1, parseInt(v,10) || 8); btSave(s); };
  window.btSetCoreHP = function (v){ var s = btLoad(); s.coreHP = Math.max(1, parseInt(v,10) || 30); btSave(s); };

  function btBattleTab(s){
    if (AR.running){
      return '<div class="bt-arena-bar no-print">' +
          '<button id="btPauseBtn" class="secondary" onclick="btPauseBattle()">' + iconSVG('pause',16) + ' Pause</button>' +
          '<span class="bt-remain" id="btRemain">…</span>' +
          '<div class="grow"></div>' +
          '<button class="danger" onclick="btEndBattle()">End Battle</button>' +
        '</div>' +
        '<div class="bt-arena" id="bt-arena"><div class="bt-frame" id="bt-frame"></div></div>';
    }
    var banner = '';
    if (AR.result){ banner = '<div class="bt-winner' + (AR.result === 'lose' ? ' lose' : '') + '">' + (AR.result === 'win' ? '🏆 ' : '💥 ') + '<b>' + esc(AR.bossMsg) + '</b></div>'; }
    else if (AR.lastWinner){ banner = '<div class="bt-winner">🏆 <b>' + esc(AR.lastWinner) + '</b> won the battle!' + (s.winnerBonus > 0 ? ' <span class="muted">(+' + s.winnerBonus + ' points)</span>' : '') + '</div>'; }
    var mode = (s.arenaMode === 'boss' && s.bossUnlocked) ? 'boss' : 'ffa';
    var bossBtn = s.bossUnlocked
      ? '<button class="' + (mode === 'boss' ? 'on' : '') + '" onclick="btSetArenaMode(\'boss\')">👹 Boss battle</button>'
      : '<button class="locked" disabled title="Earn the boss on the Points tab">🔒 Boss · ' + Math.round(btBossPct(s)*100) + '%</button>';
    var modeSel = '<div class="seg" style="margin-bottom:14px">' +
        '<button class="' + (mode !== 'boss' ? 'on' : '') + '" onclick="btSetArenaMode(\'ffa\')">⚔️ Free-for-all</button>' +
        bossBtn +
      '</div>';
    var hint = mode === 'boss'
      ? 'The whole class teams up against a boss that auto-scales to your class strength. <b>Phase 1:</b> smashed limbs regrow once with two arms. <b>Phase 2:</b> limbs explode on death, knocking 50% off nearby pupils. <b>Phase 3</b> (core exposed): lasers from 80% HP, mini-bosses from 60%, it enrages at 20% and makes a last stand at 5%. Each pupil’s points are their HP — survivors share the bonus.'
      : 'Each pupil’s points are their battle HP. They bounce around with a long spinning arm that knocks a point off (and bounces back) whoever it hits — pop at zero, last one standing wins. Set Starting/Minimum/Maximum points in Settings.';
    return '<div class="card no-print">' + modeSel +
        '<div class="row" style="align-items:flex-end">' +
          '<div><label>Winner bonus</label><input id="btWinBonus" type="number" min="0" value="' + s.winnerBonus + '" style="width:110px" onchange="btSetWinnerBonus(this.value)" /></div>' +
          '<div class="grow"></div>' +
          '<button onclick="btStartBattle()">' + iconSVG('zap',16) + (mode === 'boss' ? ' Start Boss Battle' : ' Start Battle') + '</button>' +
        '</div>' +
        '<p class="hint small" style="margin-top:8px">' + hint + '</p>' +
      '</div>' + banner;
  }

  function btPointsTab(s){
    if (btView() !== 'classic'){
      return '<div class="gg-fit"><div class="gg-stage" id="gg-stage">' + btBoardView(s) + '</div></div>';
    }
    return btBossChargeHTML(s) +
      '<div class="bt-controls-row no-print">' + btStepStripHTML(s) + btGroupBarHTML(s) + '</div>' +
      '<div class="grid">' + sortedRoster().map(function (p){ return btPupilCard(s, p); }).join('') + '</div>';
  }

  /* ════════════════════════════════════════════════════════════
     SMARTBOARD DISPLAY VIEWS — six alternative Points-tab layouts.
     Each returns markup for a fixed 1920×1080 stage (btFitStage
     scales it to #bt-view). Awards/toasts/celebrations are unchanged.
     ════════════════════════════════════════════════════════════ */
  function btBoardView(s){
    switch (btView()){
      case 'spotlight':     return btViewSpotlight(s);
      case 'split':         return btViewSplit(s);
      case 'scoreboard':    return btViewScoreboard(s);
      case 'lanes':         return btViewLanes(s);
      case 'constellation': return btViewConstellation(s);
      case 'glowcity':      return btViewGlowCity(s);
      default:              return btViewSpotlight(s);
    }
  }
  /* ── shared view bits ── */
  function ggBrand(){
    var sub = '';
    try { var m = (typeof tpActiveClassMeta === 'function') ? tpActiveClassMeta() : {}; sub = [m.name || m.year, m.room].filter(Boolean).join(' · '); } catch (e) {}
    return '<div class="gg-brand"><span class="bolt">⚡</span><span>GLOW GETTERS' +
      (sub ? '<br><small>' + esc(sub) + '</small>' : '') + '</span></div>';
  }
  function ggMascot(size, mood, live){
    return '<div class="gg-mascot ' + (mood || 'cheer') + (live ? ' live' : '') + '" style="--ms:' + size + 'px">' +
      '<div class="gm-body"></div><div class="gm-cheek l"></div><div class="gm-cheek r"></div>' +
      '<div class="gm-eye l"></div><div class="gm-eye r"></div><div class="gm-mouth"></div><div class="gm-spark">✨</div></div>';
  }
  function ggBubble(html, big, point){ return '<div class="gg-bubble pt-' + (point || 'left') + (big ? ' big' : '') + '">' + html + '</div>'; }
  function ggAv(s, pid, size){
    return '<span class="gg-av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size*0.36) + 'px;background:' + btPupColor(s, pid) + '">' + esc(initials(pupilName(pid))) + '</span>';
  }
  function ggTotal(s, big){
    return '<div class="gg-total"><div class="n" style="font-size:' + (big ? 96 : 58) + 'px">' + btClassTotal(s) + '</div>' +
      '<div class="l" style="font-size:' + (big ? 15 : 12) + 'px">Class points · boss at ' + btBossTarget(s) + '</div></div>';
  }
  function ggChargePct(s){ return Math.min(100, Math.round(btBossPct(s) * 100)); }
  function ggMascotLine(s){
    var r = s.recent && s.recent[0];
    if (!r) return 'Let\'s earn some points! ✨';
    return CHEERS[Math.abs(r.ts) % CHEERS.length] + ' <span class="hl">' + esc(pupilName(r.pid)) + '</span> ✨';
  }
  function ggAgo(ts){
    var d = Date.now() - ts; if (d < 45000) return 'just now';
    var m = Math.round(d / 60000); if (m < 60) return m + ' min ago';
    var h = Math.round(d / 3600000); if (h < 24) return h + 'h ago'; return Math.round(h / 24) + 'd ago';
  }
  // pupil rows with neon rank, sorted A–Z
  function ggRoster(s){
    return sortedRoster().map(function (p){
      var pts = btPts(s, p.id);
      return { p:p, pts:pts, rk:btNeonOf(s, pts), nr:btNextRank(s, pts) };
    });
  }

  /* ── F · Spotlight Stage ── */
  function btViewSpotlight(s){
    var rows = ggRoster(s);
    // 3 most recent DISTINCT pupils
    var seen = {}, spots = [];
    (s.recent || []).forEach(function (r){ if (!seen[r.pid]){ seen[r.pid] = 1; spots.push(r); } });
    spots = spots.slice(0, 3);
    var spotsHTML = spots.length ? spots.map(function (r, i){
      var pts = btPts(s, r.pid), rk = btNeonOf(s, pts), nr = btNextRank(s, pts);
      return '<div class="bf-spot gg-tap' + (i === 0 ? ' hero' : '') + '" data-gg-pid="' + r.pid + '" style="--rc:' + rk.color + '">' +
        '<span class="plus">+' + r.n + '</span><span class="ago">' + ggAgo(r.ts) + '</span>' +
        ggAv(s, r.pid, 96) +
        '<div class="nm">' + esc(pupilName(r.pid)) + '</div>' +
        '<div class="pt">' + pts + '<span style="font-size:18px;color:var(--faint)"> pts</span></div>' +
        '<div class="rk">' + rk.label + '</div>' +
        '<div class="nx">' + (nr ? (nr.min - pts) + ' to ' + nr.label : '★ Top rank!') + '</div></div>';
    }).join('') : '<div class="bf-empty">Award a point and the spotlight lights up ✨</div>';
    var tick = (s.recent || []).slice(0, 7).map(function (r){
      return '<b>' + esc(pupilName(r.pid)) + '</b> +' + r.n;
    }).join('<span class="sep">·</span>');
    var pills = rows.map(function (r){
      return '<span class="bf-pill gg-tap' + (r.p.absent ? ' absent' : '') + '" data-gg-pid="' + r.p.id + '" style="--rc:' + r.rk.color + '">' +
        ggAv(s, r.p.id, 28) + esc(r.p.name) + '<span class="pt">' + r.pts + '</span></span>';
    }).join('');
    return '<div class="bf-top">' + ggBrand() + '<div class="bb-total">' +
        '<div class="n">' + btClassTotal(s) + '</div><div class="l">Class points · boss at ' + btBossTarget(s) + '</div></div></div>' +
      '<div class="bf-main"><div class="bf-stage">' + ggBubble(ggMascotLine(s), true, 'bottom').replace('gg-bubble', 'gg-bubble gg-live-bubble') + ggMascot(250, 'cheer', true) + '</div>' +
        '<div><div class="bf-kick">In the spotlight</div><div class="bf-spots">' + spotsHTML + '</div></div></div>' +
      '<div class="bf-ticker"><b>Recent</b><span class="sep">·</span>' + (tick || 'no awards yet') + '</div>' +
      '<div class="bf-strip"><div class="lab">Everyone</div><div class="bf-pills">' + pills + '</div></div>';
  }

  /* ── A · Split Stage ── */
  function btViewSplit(s){
    var rows = ggRoster(s);
    var cols = rows.length > 30 ? 6 : 5;
    var tables = s.tables.length ? '<div class="ba-tables">' + s.tables.slice(0, 6).map(function (t, i){
      var c = btGroupColor(i);
      return '<div class="tt"><b style="color:' + c + ';text-shadow:0 0 12px ' + c + '66">' + btTableTotal(s, t) + '</b>' +
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">' + esc(t.name) + '</span></div>';
    }).join('') + '</div>' : '';
    var tiles = rows.map(function (r){
      var span = (r.nr ? r.nr.min : r.pts) - r.rk.min, prog = r.nr ? Math.min(1, (r.pts - r.rk.min) / Math.max(1, span)) : 1;
      return '<div class="ba-tile gg-tap' + (r.p.absent ? ' absent' : '') + '" data-gg-pid="' + r.p.id + '">' +
        ggAv(s, r.p.id, 46) +
        '<div class="meta"><div class="nm">' + esc(r.p.name) + '</div>' +
        '<div class="pt" style="color:' + r.rk.color + ';text-shadow:0 0 14px ' + r.rk.color + '88">' + r.pts + '<span style="font-size:14px;color:var(--faint)"> pts</span></div></div>' +
        '<div class="prog"><i style="width:' + (prog*100) + '%;background:' + r.rk.color + ';box-shadow:0 0 8px ' + r.rk.color + '"></i></div></div>';
    }).join('');
    return '<div class="ba-wrap"><div class="ba-stage">' + ggBrand() +
        ggBubble(ggMascotLine(s), true, 'bottom').replace('gg-bubble', 'gg-bubble gg-live-bubble') + ggMascot(190, 'cheer', true) +
        '<div class="ba-total"><div class="n">' + btClassTotal(s) + '</div><div class="l">Class points</div></div>' +
        '<div class="ba-boss"><div class="lab"><span>Boss charge</span><span>' + btClassTotal(s) + ' / ' + btBossTarget(s) + '</span></div>' +
          '<div class="bar"><div class="fill" style="width:' + ggChargePct(s) + '%"></div></div></div>' +
        tables + '</div>' +
      '<div class="ba-roster"><div class="ba-kick">Everyone · sorted A–Z</div>' +
        '<div class="ba-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + tiles + '</div></div></div>';
  }

  /* ── B · Scoreboard Wall ── */
  function btViewScoreboard(s){
    var ranked = ggRoster(s).sort(function (a, b){ return b.pts - a.pts || a.p.name.localeCompare(b.p.name); });
    var nCols = ranked.length > 30 ? 3 : 2, per = Math.ceil(ranked.length / nCols), colsHTML = '';
    for (var ci = 0; ci < nCols; ci++){
      var col = ranked.slice(ci * per, (ci + 1) * per);
      colsHTML += '<div>' + col.map(function (r, i){
        var pos = ci * per + i + 1, posS = (pos < 10 ? '0' : '') + pos;
        return '<div class="bb-row gg-tap' + (r.p.absent ? ' absent' : '') + '" data-gg-pid="' + r.p.id + '">' +
          '<span class="bb-pos">' + posS + '</span>' + ggAv(s, r.p.id, 38) +
          '<span class="nm">' + esc(r.p.name) + (r.p.absent ? ' · absent' : '') + '</span>' +
          '<span class="bb-rk" style="color:' + r.rk.color + ';border-color:' + r.rk.color + '55;background:' + r.rk.color + '14">' + r.rk.label + '</span>' +
          '<span class="bb-pts" style="color:' + r.rk.color + ';text-shadow:0 0 12px ' + r.rk.color + '77">' + r.pts + '<span style="font-size:15px;color:var(--faint)"> pts</span></span></div>';
      }).join('') + '</div>';
    }
    return '<div class="bb-head">' + ggBrand() + ggMascot(86, 'cheer', true) +
        ggBubble(ggMascotLine(s), false, 'left').replace('gg-bubble', 'gg-bubble gg-live-bubble') +
        '<div class="bb-total"><div class="n">' + btClassTotal(s) + '</div><div class="l">Class points · boss at ' + btBossTarget(s) + '</div></div></div>' +
      '<div class="bb-charge"><i style="width:' + ggChargePct(s) + '%"></i></div>' +
      '<div class="bb-cols' + (nCols === 3 ? ' three' : '') + '">' + colsHTML + '</div>';
  }

  /* ── C · Rank Lanes ── */
  function btViewLanes(s){
    var ranks = btRanks(s).map(function (r){ return { key:r.key, label:r.label, min:r.min, color:(BT_NEON[r.key] || r.color) }; });
    var rows = ggRoster(s);
    var FIELD_W = 1640 - 210, CHIP_W = 158;
    function place(members, ri){
      var rank = ranks[ri], next = ranks[ri + 1], span = next ? next.min - rank.min : 25;
      var nRows = members.length > 8 ? 3 : (members.length > 3 ? 2 : 1);
      var tops = nRows === 3 ? [14, 64, 114] : nRows === 2 ? [26, 88] : [58];
      var lastX = tops.map(function (){ return -Infinity; });
      return members.sort(function (a, b){ return a.pts - b.pts; }).map(function (m, i){
        var prog = Math.min(1, (m.pts - rank.min) / Math.max(1, span)), row = i % nRows;
        var target = 36 + prog * (FIELD_W - CHIP_W - 70), x = Math.max(target, lastX[row] + CHIP_W + 8);
        lastX[row] = x; return { m:m, x:x, top:tops[row] };
      });
    }
    var lanesHTML = '';
    for (var li = ranks.length - 1; li >= 0; li--){
      var rank = ranks[li];
      var members = rows.filter(function (r){ return r.rk.key === rank.key; });
      var placed = place(members, li);
      lanesHTML += '<div class="bc-lane" style="--lc:' + rank.color + '">' +
        '<div class="bc-lab"><b>' + rank.label + '</b><span>' + rank.min + '+ pts · ' + members.length + ' ' + (members.length === 1 ? 'pupil' : 'pupils') + '</span></div>' +
        '<div class="bc-field">' + placed.map(function (x){
          return '<div class="bc-chip gg-tap' + (x.m.p.absent ? ' absent' : '') + '" data-gg-pid="' + x.m.p.id + '" style="left:' + x.x + 'px;top:' + x.top + 'px">' +
            ggAv(s, x.m.p.id, 46) + '<div class="meta"><div class="nm">' + esc(x.m.p.name) + '</div><div class="pt">' + x.m.pts + ' pts</div></div></div>';
        }).join('') + '</div></div>';
    }
    return '<div class="bc-head">' + ggBrand() +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:22px">' +
          ggBubble('Climb the lanes! 🚀', false, 'right') + ggMascot(84, 'cheer', true) +
          '<div class="bb-total" style="margin-left:10px"><div class="n" style="font-size:48px">' + btClassTotal(s) + '</div><div class="l">Class points</div></div></div></div>' +
      '<div class="bc-lanes">' + lanesHTML + '</div>';
  }

  /* ── D · Constellation ── */
  function btViewConstellation(s){
    var CX = 960, CY = Math.round(1080 * 0.54), SQUASH = 0.6;
    var ranks = btRanks(s).map(function (r){ return { key:r.key, label:r.label, min:r.min, color:(BT_NEON[r.key] || r.color) }; });
    // legend innermost → rookie outermost
    var RINGS = [{ r:ranks[4], rx:200 }, { r:ranks[3], rx:305 }, { r:ranks[2], rx:425 }, { r:ranks[1], rx:560 }, { r:ranks[0], rx:700 }];
    var rows = ggRoster(s);
    var ringsHTML = RINGS.map(function (R){
      return '<div class="bd-ring" style="--rc:' + R.r.color + ';width:' + (R.rx*2) + 'px;height:' + (R.rx*2*SQUASH) + 'px"></div>';
    }).join('');
    var keyHTML = '<div class="bd-key">' + ranks.slice().reverse().map(function (r){
      return '<div class="k" style="--kc:' + r.color + '"><i></i>' + r.label + ' · ' + r.min + '+</div>';
    }).join('') + '</div>';
    var soloAngle = { legend:-24, hero:204 };
    var starsHTML = '';
    RINGS.forEach(function (R, ri){
      var members = rows.filter(function (x){ return x.rk.key === R.r.key; }).sort(function (a, b){ return a.p.name.localeCompare(b.p.name); });
      var step = 360 / Math.max(1, members.length);
      members.forEach(function (m, i){
        var deg = (members.length === 1 && soloAngle[R.r.key] !== undefined) ? soloAngle[R.r.key] : (-90 + step/2 + ri*8 + i*step);
        var a = deg * Math.PI / 180, x = CX + Math.cos(a) * R.rx, y = CY + Math.sin(a) * R.rx * SQUASH;
        starsHTML += '<div class="bd-star gg-tap' + (m.p.absent ? ' absent' : '') + '" data-gg-pid="' + m.p.id + '" style="--rc:' + m.rk.color + ';left:' + x + 'px;top:' + y + 'px">' +
          '<div class="dot"></div><div class="nm">' + esc(m.p.name) + '</div><div class="pt">' + m.pts + ' pts</div></div>';
      });
    });
    return '<div style="position:absolute;left:48px;top:36px;z-index:3">' + ggBrand() + '</div>' +
      ringsHTML + keyHTML + starsHTML +
      '<div class="bd-center">' + ggBubble(ggMascotLine(s), true, 'bottom').replace('gg-bubble', 'gg-bubble gg-live-bubble') +
        ggMascot(150, 'cheer', true) + '<div class="tot">' + btClassTotal(s) + '</div><div class="totl">Class points</div></div>';
  }

  /* ── E · Glow City ── */
  function btViewGlowCity(s){
    var rows = ggRoster(s), N = rows.length;
    var X0 = 86, PITCH = N > 1 ? (1920 - 2*X0 - 44) / (N - 1) : 0;
    var maxPts = rows.reduce(function (a, r){ return Math.max(a, r.pts); }, 0);
    var factor = (64 + maxPts * 7 > 720 && maxPts > 0) ? (720 - 64) / maxPts : 7;   // keep the tallest tower on-screen
    var towers = rows.map(function (r, i){
      var h = 64 + r.pts * factor, left = N > 1 ? (X0 + i * PITCH) : (1920/2 - 22);
      return '<div class="be-tower gg-tap' + (r.p.absent ? ' absent' : '') + '" data-gg-pid="' + r.p.id + '" style="--rc:' + r.rk.color + ';left:' + left + 'px;width:44px">' +
        '<div class="pt">' + r.pts + '</div><div class="col" style="height:' + h + 'px"></div>' +
        '<div class="nm" style="margin-top:' + (i % 2 ? 32 : 8) + 'px">' + esc(r.p.name) + '</div></div>';
    }).join('');
    return '<div class="be-sky">' +
        '<div style="position:absolute;left:64px;top:44px">' + ggBrand() + '</div>' +
        '<div class="be-moon" style="left:480px;top:52px">' + ggMascot(104, 'cheer', true) +
          ggBubble(ggMascotLine(s), false, 'left').replace('gg-bubble', 'gg-bubble gg-live-bubble') + '</div>' +
        '<div class="be-charge"><div class="lab"><span>Boss charge · ' + btClassTotal(s) + ' class points</span><span>target ' + btBossTarget(s) + '</span></div>' +
          '<div class="bar"><i style="width:' + ggChargePct(s) + '%"></i></div></div>' +
        towers + '<div class="be-ground"></div></div>';
  }

  // Scale the fixed 1920×1080 stage to the available width (called after every render + on resize).
  function btFitStage(){
    var fit = document.querySelector('#bt-view .gg-fit'), stage = document.getElementById('gg-stage');
    if (!fit || !stage) return;
    var w = fit.clientWidth; if (!w) return;
    var scale = w / 1920;
    stage.style.transform = 'scale(' + scale + ')';
    fit.style.height = Math.round(1080 * scale) + 'px';
  }
  window.addEventListener('resize', btFitStage);

  /* ── Groups tab (award a whole group in one tap) ───────── */
  function btTablesTab(s){
    var roster = sortedRoster();
    var create = '<div class="g-create no-print">' +
      '<div class="g-create-l"><label>New group</label><input id="btTableName" placeholder="e.g. Purple group" onkeydown="if(event.key===\'Enter\')btAddTable()" /></div>' +
      '<button class="primary" onclick="btAddTable()">+ Add group</button>' +
      '<div class="g-or">or</div>' +
      '<div class="g-create-l"><label>Auto-split class into</label><div class="g-auto"><input id="btAutoN" type="number" min="2" max="8" value="4" /><button class="ghost" onclick="btAutoTables()">Auto groups</button></div></div>' +
    '</div>';
    var grid;
    if (!s.tables.length){
      grid = '<div class="empty">No groups yet — create one above, then award a point to the whole group in one tap.</div>';
    } else {
      grid = s.tables.map(function (t, i){
        var c = btGroupColor(i), total = btTableTotal(s, t);
        var avail = roster.filter(function (p){ return t.pupilIds.indexOf(p.id) < 0; });
        var members = t.pupilIds.length ? t.pupilIds.map(function (pid){
          return '<span class="g-chip" title="' + esc(pupilName(pid)) + '"><span class="g-chip-av" style="background:' + btAvColor(pid) + '">' + esc(initials(pupilName(pid))) + '</span>' +
            '<span class="g-chip-name">' + esc(pupilName(pid).split(' ')[0]) + '</span>' +
            '<button class="g-chip-x" onclick="btRemoveMember(\'' + t.id + '\',\'' + pid + '\')" aria-label="Remove">×</button></span>';
        }).join('') : '<span class="g-empty">No members yet</span>';
        return '<div class="group" data-gid="' + t.id + '" style="--gc:' + c + '">' +
          '<div class="g-head"><input class="g-name" value="' + esc(t.name) + '" onchange="btRenameTable(\'' + t.id + '\',this.value)" />' +
            '<span class="g-total"><span class="g-total-n">' + total + '</span></span></div>' +
          '<div class="g-members">' + members + '</div>' +
          '<div class="g-foot">' +
            '<select class="g-addsel" onchange="btAddMember(\'' + t.id + '\',this.value);this.value=\'\'"><option value="">+ Add pupil…</option>' +
              avail.map(function (p){ return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
            '<div class="g-spacer"></div>' +
            '<button class="g-minus" onclick="btAwardTable(\'' + t.id + '\',-1)" aria-label="Take a point">−</button>' +
            '<button class="g-plus" onclick="btAwardTable(\'' + t.id + '\',1)">+' + s.step + ' all</button>' +
            '<button class="g-del" onclick="btDeleteTable(\'' + t.id + '\')" aria-label="Delete group">🗑</button>' +
          '</div></div>';
      }).join('');
    }
    return create + '<div class="g-grid">' + grid + '</div>';
  }

  /* ── Leaderboard (podium + list + group standings) ─────── */
  var LB_WINDOWS = [['all','All time'],['month','Month'],['week','Week']];
  window.btSetLbWindow = function (w){ var s = btLoad(); s.lbWindow = (['all','month','week'].indexOf(w) >= 0) ? w : 'all'; btSave(s); btRender(); };
  function btLeaderTab(s){
    var ranked = sortedRoster().map(function (p){ return { p:p, pts:btLbPoints(s, p.id) }; })
                  .sort(function (a, b){ return b.pts - a.pts || a.p.name.localeCompare(b.p.name); });
    var seg = '<div class="seg lb-seg no-print">' + LB_WINDOWS.map(function (w){
      return '<button class="' + (s.lbWindow === w[0] ? 'on' : '') + '" onclick="btSetLbWindow(\'' + w[0] + '\')">' + w[1] + '</button>'; }).join('') + '</div>';
    var top3 = ranked.slice(0, 3), rest = ranked.slice(3);
    var listRows = rest.map(function (r, i){
      var rk = btRankFor(s, btPts(s, r.p.id));
      return '<div class="lb-row"><span class="lb-pos">' + (i + 4) + '</span>' +
        '<span class="lb-av" style="background:' + btAvColor(r.p.id) + '">' + esc(initials(r.p.name)) + '</span>' +
        '<span class="lb-name">' + esc(r.p.name) + btPlacesHTML(s, r.p.id) + '</span>' +
        '<span class="lb-rank" style="background:' + rk.bg + ';color:' + rk.color + '">' + rk.label + '</span>' +
        '<span class="lb-pts">' + r.pts + '</span></div>';
    }).join('');
    var groupStand = '';
    if (s.tables.length){
      var gs = s.tables.map(function (t, i){ return { t:t, total:btTableTotal(s, t), i:i }; }).sort(function (a, b){ return b.total - a.total; });
      var max = gs[0].total || 1;
      groupStand = '<div class="lb-panel"><h3 class="lb-h">Group standings</h3>' + gs.map(function (x){
        var pct = Math.max(3, Math.round(x.total / max * 100));
        return '<div class="lb-gstand"><span class="lb-gname" style="color:' + btGroupColor(x.i) + '">' + esc(x.t.name) + '</span>' +
          '<div class="lb-gbar"><div class="lb-gfill" style="width:' + pct + '%;background:' + btGroupColor(x.i) + '"></div></div>' +
          '<span class="lb-gval">' + x.total + '</span></div>';
      }).join('') + '</div>';
    }
    var unit = s.lbWindow === 'week' ? 'this week' : s.lbWindow === 'month' ? 'this month' : 'pts';
    return '<div class="lb-wrap">' + seg + btPodium(s, top3) +
      '<div class="lb-panel"><h3 class="lb-h">Class leaderboard <span class="lb-sub">· ' + unit + '</span></h3>' + (listRows || '<div class="empty">Everyone is on the podium!</div>') + '</div>' +
      groupStand + '</div>';
  }
  function btPodium(s, top3){
    var stageOrder = [top3[1], top3[0], top3[2]], place = [2, 1, 3];
    var medalColor = { 1:'#e0a106', 2:'#9aa6aa', 3:'#c2724f' }, medalBg = { 1:'#fdf6e3', 2:'#eef1f1', 3:'#fbeee6' };
    var cols = stageOrder.map(function (r, idx){
      if (!r) return '<div class="pod-col"></div>';
      var pos = place[idx], rk = btRankFor(s, btPts(s, r.p.id));
      return '<div class="pod-col pod-' + pos + '"><div class="pod-person">' +
        (pos === 1 ? '<div class="pod-crown">👑</div>' : '') +
        '<div class="pod-av" style="background:' + btAvColor(r.p.id) + '"><span>' + esc(initials(r.p.name)) + '</span>' +
          '<span class="pod-medal" style="background:' + medalBg[pos] + ';color:' + medalColor[pos] + '">' + pos + '</span></div>' +
        '<div class="pod-name">' + esc(r.p.name) + '</div>' + (btPlacesHTML(s, r.p.id) || '<div class="pod-rank" style="color:' + rk.color + '">' + rk.label + '</div>') + '</div>' +
        '<div class="pod-block" style="--mc:' + medalColor[pos] + '"><span class="pod-pts">' + r.pts + '</span><span class="pod-u">pts</span></div></div>';
    }).join('');
    return '<div class="podium">' + cols + '</div>';
  }

  /* ── Settings (reaction toggles + how points work) ─────── */
  function btSettingsTab(s){
    function tog(key, label, hint){
      return '<div class="set-row"><div><b>' + label + '</b><div class="set-hint">' + hint + '</div></div>' +
        '<button class="toggle big' + (s[key]?' on':'') + '" data-tog="' + key + '" onclick="btToggleQuiet(\'' + key + '\')"><span class="sw"></span>' + (s[key]?'On':'Off') + '</button></div>';
    }
    var ranksLegend = btRanks(s).map(function (r){
      return '<div class="leg-row"><span class="leg-dot" style="background:' + r.color + '"></span>' +
        '<span class="leg-name" style="color:' + r.color + '">' + r.label + '</span><span class="leg-req">' + r.min + '+ pts</span></div>';
    }).join('');
    var badgeLegend = btBadgesDef(s).map(function (b){
      var req = b.streakOnly ? '3 awards in a row' : (b.min + (b.min === 1 ? ' point' : ' points'));
      return '<div class="leg-row"><span class="leg-badge">' + b.icon + '</span><span class="leg-name">' + b.name + '</span><span class="leg-req">' + req + '</span></div>';
    }).join('');
    var curView = btView();
    var viewChooser = '<div class="bv-seg">' + BT_BOARD_VIEWS.map(function (v){
      return '<button class="' + (curView === v ? 'on' : '') + '" onclick="btSetBoardView(\'' + v + '\')">' + BT_BOARD_LABELS[v] + '</button>';
    }).join('') + '</div>';
    return '<div class="set-grid">' +
      '<div class="set-card"><h3 class="set-h">Smartboard view</h3>' +
        '<p class="set-note">How the Points board is laid out on <b>this device</b> — your laptop and iPad can each show a different view. Awards, sounds and celebrations work the same in every view.</p>' +
        viewChooser +
      '</div>' +
      '<div class="set-card"><h3 class="set-h">Reactions</h3>' +
        tog('sound','Sound effects','Game-like chimes when points change.') +
        tog('mascot','Mascot','Sparky cheers (and sympathises) at the top of the board.') +
        tog('confetti','Confetti & celebrations','Bursts, level-ups and rank pop-ups.') +
        tog('logBh','Log to Behaviour Log','Each award also adds a dated note in your Behaviour Log.') +
        '<div class="set-row"><div><b>Points per tap</b><div class="set-hint">Default award size on the buttons.</div></div>' +
          '<div class="steps">' + [1,2,5].map(function (n){ return '<button class="step' + (s.step===n?' on':'') + '" onclick="btSetStep(' + n + ')">+' + n + '</button>'; }).join('') + '</div></div>' +
        '<div class="set-row"><div><b>Battle winner bonus</b><div class="set-hint">Points the last-standing pupil (or boss survivors) earn.</div></div>' +
          '<input class="num" type="number" min="0" value="' + s.winnerBonus + '" onchange="btSetWinnerBonus(this.value)" /></div>' +
      '</div>' +
      '<div class="set-card"><h3 class="set-h">Pupil cards &amp; power-ups</h3>' +
        tog('showLevels','Show level pills','The “Lv N” badge on each pupil avatar.') +
        tog('showBadges','Show badges','The earned-badge row on each pupil card.') +
        tog('powerups','Battle power-ups','Earned badges become single-use power-ups in the arena — they fire by chance, and the more a pupil holds the likelier one triggers.') +
      '</div>' +
      '<div class="set-card"><h3 class="set-h">Points range</h3>' +
        '<div class="cfg-row" style="margin:0;border:0;padding:0;background:none">' +
          '<div class="cfg-fg"><label>Minimum</label><input type="number" min="0" value="' + btMin(s) + '" onchange="btSetMinPoints(this.value)" /></div>' +
          '<div class="cfg-fg"><label>Starting</label><input type="number" min="0" value="' + btStart(s) + '" onchange="btSetStartPoints(this.value)" /></div>' +
          '<div class="cfg-fg"><label>Maximum</label><input type="number" min="0" placeholder="none" value="' + esc(s.maxPoints) + '" onchange="btSetMaxPoints(this.value)" /></div>' +
        '</div>' +
        '<p class="set-note" style="margin-top:12px">New pupils begin at <b>Starting</b>; points stay between <b>Minimum</b> and <b>Maximum</b>. Set a <b>Maximum</b> and the ranks &amp; badges rescale to it.</p>' +
      '</div>' +
      '<div class="set-card"><h3 class="set-h">How points work</h3>' +
        '<p class="set-note">Every <b>' + PER_LEVEL + ' points = 1 level</b>. Cross a threshold and the pupil climbs a rank. Set a <b>Maximum</b> on the Points tab and these rescale automatically.</p>' +
        '<div class="legend">' + ranksLegend + '</div>' +
        '<h4 class="set-sub">Badges</h4><div class="legend">' + badgeLegend + '</div>' +
      '</div>' +
      '<div class="set-card"><h3 class="set-h">Reset</h3>' +
        '<p class="set-note">Set every pupil back to the starting amount and clear earned badges. This cannot be undone.</p>' +
        '<button class="btn-danger" onclick="btResetPoints()">Reset all points</button>' +
        '<p class="set-note" style="margin-top:14px">Clear placement medals and the week/month leaderboard history. Pupils keep their points and badges.</p>' +
        '<button class="btn-danger" onclick="btResetLeaderboard()">Reset leaderboard</button>' +
      '</div>' +
    '</div>';
  }

  /* ── Main render (updates persistent shell, never the fx/overlay) ── */
  var TABS = [['battle','Battle'],['points','Points'],['tables','Groups'],['leaderboard','Leaderboard'],['settings','Settings']];
  function btRender(){
    var view = document.getElementById('bt-view'); if (!view) return;
    var s = btLoad();
    var tabsEl = document.getElementById('bt-tabs');
    if (tabsEl){
      tabsEl.style.display = AR.running ? 'none' : '';
      tabsEl.innerHTML = AR.running ? '' : TABS.map(function (t){
        return '<button class="tab' + (s.tab === t[0] ? ' active' : '') + '" onclick="btSetTab(\'' + t[0] + '\')">' + t[1] + '</button>';
      }).join('');
    }
    var board = document.getElementById('bt-board');
    // display views draw their own header/mascot/total, so hide the persistent board for them
    var displayView = s.tab === 'points' && btView() !== 'classic';
    var showBoard = !AR.running && (!displayView) && (s.tab === 'points' || s.tab === 'tables' || s.tab === 'leaderboard');
    if (board) board.style.display = showBoard ? 'flex' : 'none';
    if (!roster.length){ view.innerHTML = '<div class="card"><p class="empty">Add pupils on the Class List page first — they become your battlers.</p></div>'; return; }
    btEnsureBadges(s);
    view.innerHTML = s.tab === 'points' ? btPointsTab(s)
             : s.tab === 'tables' ? btTablesTab(s)
             : s.tab === 'leaderboard' ? btLeaderTab(s)
             : s.tab === 'settings' ? btSettingsTab(s)
             : btBattleTab(s);
    if (showBoard) btUpdateClassTotal(s, true);
    btUpdateBossCharge(s);   // keep the charge bar + board "Boss ready" badge in sync
    if (displayView) btFitStage();   // scale the display-view stage to fit
  }

  /* bind the celebration overlay click-to-dismiss once */
  (function (){ var o = document.getElementById('bt-celebrate'); if (o) o.addEventListener('click', btCloseCele); })();

  /* tap-to-award on the smartboard display views: tap = +step, long-press (600ms) = −step.
     Delegated on #bt-view (rebuilt each render); elements carry data-gg-pid. */
  (function (){
    var view = document.getElementById('bt-view'); if (!view) return;
    var lpTimer = null, lpFired = false, lpPid = null;
    function clear(){ if (lpTimer){ clearTimeout(lpTimer); lpTimer = null; } }
    view.addEventListener('pointerdown', function (e){
      var el = e.target.closest ? e.target.closest('[data-gg-pid]') : null; if (!el) return;
      lpPid = el.getAttribute('data-gg-pid'); lpFired = false;
      lpTimer = setTimeout(function (){ lpFired = true; clear(); award(lpPid, -btLoad().step); }, 600);
    });
    view.addEventListener('pointerup', function (e){
      clear();
      if (lpFired){ lpFired = false; return; }
      var el = e.target.closest ? e.target.closest('[data-gg-pid]') : null;
      if (!el || el.getAttribute('data-gg-pid') !== lpPid) return;
      award(lpPid, btLoad().step);
    });
    view.addEventListener('pointercancel', clear);
    view.addEventListener('pointerleave', clear);
  })();

  window.btRender = btRender;

  /* Replay a remote tp_battler change as animated awards so every signed-in
     device shows the +N float, confetti, sound and count-up. Points are still
     at the OLD value when this runs; award() carries them to the new value with
     the full reaction. Returns true if it animated (caller then skips a re-render
     to preserve the animation); false for bulk/structural changes. */
  window.btReplayRemote = function (oldRaw, newRaw){
    var oldS = {}, newS = {};
    try { oldS = oldRaw ? JSON.parse(oldRaw) : {}; } catch (e) {}
    try { newS = JSON.parse(newRaw); } catch (e) { return false; }
    var oldP = (oldS && oldS.points) || {}, newP = (newS && newS.points) || {};
    var ids = {}, changed = [];
    Object.keys(oldP).forEach(function (k){ ids[k] = 1; });
    Object.keys(newP).forEach(function (k){ ids[k] = 1; });
    Object.keys(ids).forEach(function (pid){
      var a = +oldP[pid] || 0, b = (newP[pid] === undefined ? a : +newP[pid]);
      if (b !== a) changed.push({ pid: pid, delta: b - a });
    });
    if (!changed.length || changed.length > 8) return false;   // bulk / reset / structural → let caller render
    changed.forEach(function (c){ award(c.pid, c.delta, { remote: true }); });
    return true;
  };
  window._btTick = btTick; window._btTickBoss = btTickBoss; window._btSpawn = btSpawn; window._btSpawnBoss = btSpawnBoss; window._btAR = AR; window._btInsets = btInsets; window._btFfaInset = btFfaInset;  /* test hooks */
  window._btBoss = { blast: btBossBlast, fireLaser: btBossFireLaser, tickLasers: btBossTickLasers, spawnMini: btBossSpawnMini, tickMinis: btBossTickMinis, makeSats: btMakeSats,
                     cap: btBossCap, charge: btBossCharge, target: btBossTarget, pct: btBossPct, checkUnlock: btCheckBossUnlock,
                     shockwave: btBossShockwave, tickShock: btBossTickShockwaves, launchMissile: btBossLaunchMissile, tickMissiles: btBossTickMissiles,
                     dropBomb: btBossDropBomb, tickBombs: btBossTickBombs, gravity: btBossGravity, shield: btBossShield, heal: btBossHeal, ai: btBossAI, COLORS: BT_COLORS,
                     baseline: btBossBaseline };
  window._btLb = { finishOrder: btFinishOrder, awardPlacements: btAwardPlacements, lbPoints: btLbPoints, windowNet: btWindowNet, logDaily: btLogDaily, place: btPlace, ordinal: btOrdinal };
})();
