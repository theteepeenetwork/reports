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
    return { v:1, tab:'battle', step:1, sound:true, logBh:false, winnerBonus:5,
             minPoints:5, startPoints:10, maxPoints:'',
             arenaMode:'ffa', satHP:8, coreHP:30,
             points:{}, tables:[], boss:{ name:'Grumble the Gremlin', max:50, dealt:0, active:false } };
  }
  var BT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#ec4899','#84cc16','#06b6d4','#d946ef','#14b8a6','#f97316','#6366f1'];
  function btLoad(){
    var s = Store.get('tp_battler', null);
    if (!s || typeof s !== 'object') s = btDefault();
    var d = btDefault();
    for (var k in d) if (s[k] === undefined) s[k] = d[k];
    if (!s.boss || typeof s.boss !== 'object') s.boss = d.boss;
    if (!s.points || typeof s.points !== 'object') s.points = {};
    if (!Array.isArray(s.tables)) s.tables = [];
    if ([1,2,5].indexOf(s.step) < 0) s.step = 1;
    return s;
  }
  function btSave(s){ Store.set('tp_battler', s); }

  /* ── Derived ────────────────────────────────────────────── */
  function btMin(s){ return s.minPoints || 0; }
  function btMaxP(s){ var m = s.maxPoints; return (m === '' || m == null) ? Infinity : (+m); }
  function btStart(s){ return s.startPoints || 0; }
  function btClampP(s, v){ return Math.min(btMaxP(s), Math.max(btMin(s), v)); }
  // New pupils sit at "starting"; points stay between minimum and maximum (blank max = unlimited).
  function btPts(s, pid){ var v = s.points[pid]; if (v === undefined) v = btStart(s); return btClampP(s, v); }
  function btLevel(p){ return Math.max(1, Math.floor(p / 10) + 1); }
  function btTableTotal(s, t){ return t.pupilIds.reduce(function (a, pid){ return a + btPts(s, pid); }, 0); }
  function btTableColor(i){ var c = ['teal','coral','gold','slate']; return c[i % c.length]; }

  /* ── Sound (WebAudio, no files; silently no-ops if blocked) ─ */
  var btAC = null;
  function btBeep(freqs, dur){
    var s = btLoad(); if (!s.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      btAC = btAC || new AC();
      freqs.forEach(function (f, i){
        var o = btAC.createOscillator(), g = btAC.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        var t0 = btAC.currentTime + i * (dur * 0.9);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(btAC.destination); o.start(t0); o.stop(t0 + dur);
      });
    } catch (e) {}
  }

  /* ── Awarding ───────────────────────────────────────────── */
  var btFlash = {};   // pid -> true (transient highlight)
  function btAwardPids(pids, n, label){
    var s = btLoad();
    pids.forEach(function (pid){
      s.points[pid] = btClampP(s, btPts(s, pid) + n);  // clamp between minimum and maximum
      btFlash[pid] = true;
      if (n > 0 && s.boss.active) s.boss.dealt = Math.min(s.boss.max, s.boss.dealt + n);
      if (s.logBh && typeof bhData !== 'undefined'){
        bhData.push({ id: uid(), date: todayISO(), pupilId: pid,
          type: n >= 0 ? 'positive' : 'concern',
          note: 'Behaviour Battler ' + (n >= 0 ? '+' : '') + n + (label ? ' · ' + label : '') });
      }
    });
    if (s.logBh && typeof bhSave === 'function'){
      bhSave();
      if (document.getElementById('page-behaviour') && document.getElementById('page-behaviour').classList.contains('active') && typeof bhRender === 'function') bhRender();
    }
    var justWon = s.boss.active && s.boss.dealt >= s.boss.max;
    btSave(s);
    if (n > 0) btBeep(justWon ? [523, 659, 784, 1047] : [660, 880], 0.12);
    else btBeep([300, 200], 0.14);
    btRender();
    setTimeout(function (){ btFlash = {}; }, 360);
  }

  /* ── Handlers (window) ──────────────────────────────────── */
  window.btSetTab   = function (t){ var s = btLoad(); s.tab = t; btSave(s); btRender(); };
  window.btSetStep  = function (n){ var s = btLoad(); s.step = n; btSave(s); btRender(); };
  window.btSetMinPoints = function (v){ var s = btLoad(); var n = parseInt(v,10); s.minPoints = (n >= 0 ? n : 0); btSave(s); btRender(); };
  window.btToggle   = function (key){ var s = btLoad(); s[key] = !s[key]; btSave(s); btRender(); };
  window.btAwardOne = function (pid, n){ btAwardPids([pid], n); };
  window.btAwardTable = function (tid, sign){
    var s = btLoad(), t = s.tables.find(function (x){ return x.id === tid; });
    if (!t || !t.pupilIds.length) return;
    btAwardPids(t.pupilIds, sign * s.step, 'Table: ' + t.name);
  };
  window.btResetPoints = function (){
    var s = btLoad();
    if (!confirm('Reset every pupil back to the starting amount (' + btStart(s) + ')?')) return;
    s.points = {}; s.boss.dealt = 0; btSave(s); btRender();
  };
  window.btAddTable = function (){
    var inp = document.getElementById('btTableName'), name = (inp.value || '').trim();
    if (!name) return;
    var s = btLoad(); s.tables.push({ id: uid(), name: name, pupilIds: [] }); btSave(s); btRender();
  };
  window.btRenameTable = function (tid, name){ var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t){ t.name = name; btSave(s); } };
  window.btDeleteTable = function (tid){ if (!confirm('Delete this table?')) return; var s = btLoad(); s.tables = s.tables.filter(function (t){ return t.id !== tid; }); btSave(s); btRender(); };
  window.btAddMember = function (tid, pid){ if (!pid) return; var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t && t.pupilIds.indexOf(pid) < 0){ t.pupilIds.push(pid); btSave(s); btRender(); } };
  window.btRemoveMember = function (tid, pid){ var s = btLoad(); var t = s.tables.find(function (x){ return x.id === tid; }); if (t){ t.pupilIds = t.pupilIds.filter(function (x){ return x !== pid; }); btSave(s); btRender(); } };
  window.btAutoTables = function (){
    var s = btLoad(); var pupils = sortedRoster(); if (!pupils.length) return;
    var n = parseInt(document.getElementById('btAutoN').value, 10) || 4;
    var groups = []; for (var i = 0; i < n; i++) groups.push({ id: uid(), name: 'Table ' + (i + 1), pupilIds: [] });
    pupils.forEach(function (p, i){ groups[i % n].pupilIds.push(p.id); });
    s.tables = groups; btSave(s); btRender();
  };
  window.btSetBoss = function (){
    var s = btLoad();
    var name = (document.getElementById('btBossName').value || '').trim() || 'Boss';
    var max = parseInt(document.getElementById('btBossMax').value, 10); if (!(max > 0)) max = 50;
    s.boss = { name: name, max: max, dealt: 0, active: true }; btSave(s); btRender();
  };
  window.btBossReset = function (){ var s = btLoad(); s.boss.dealt = 0; s.boss.active = true; btSave(s); btRender(); };
  window.btBossOff = function (){ var s = btLoad(); s.boss.active = false; btSave(s); btRender(); };

  /* ── Render helpers ─────────────────────────────────────── */
  function btAvatar(name, variant, extra){
    return '<span class="av ' + (variant || '') + '"' + (extra || '') + '>' + esc(initials(name)) + '</span>';
  }
  function btPupilCard(s, p){
    var pts = btPts(s, p.id), lvl = btLevel(pts);
    return '<div class="bt-card' + (btFlash[p.id] ? ' bt-flash' : '') + '">' +
        btAvatar(p.name, 'teal') +
        '<div class="bt-meta"><div class="bt-name">' + esc(p.name) + '</div><div class="bt-lvl">Lv ' + lvl + '</div></div>' +
        '<div class="bt-pts">' + pts + '</div>' +
        '<div class="bt-btns">' +
          '<button class="bt-mini minus" title="Take a point" onclick="btAwardOne(\'' + p.id + '\',' + (-s.step) + ')">−</button>' +
          '<button class="bt-mini plus" title="Award a point" onclick="btAwardOne(\'' + p.id + '\',' + s.step + ')">+' + s.step + '</button>' +
        '</div>' +
      '</div>';
  }
  function btStepBar(s){
    return '<div class="bt-steps">Points per tap:' + [1,2,5].map(function (n){
      return '<button class="bt-step' + (s.step === n ? ' on' : '') + '" onclick="btSetStep(' + n + ')">+' + n + '</button>';
    }).join('') + '</div>';
  }
  function btBossBar(s){
    var b = s.boss; if (!b.active) return '';
    var remaining = Math.max(0, b.max - b.dealt), pct = Math.round(remaining / b.max * 100), won = b.dealt >= b.max;
    return '<div class="bt-boss' + (won ? ' won' : '') + '">' +
      '<div class="bt-boss-face">' + (won ? '🎉' : '👾') + '</div>' +
      '<div class="bt-boss-main">' +
        '<div class="bt-boss-top"><b>' + esc(b.name) + '</b><span>' + (won ? 'Defeated!' : (remaining + ' / ' + b.max + ' HP')) + '</span></div>' +
        '<div class="bt-bar"><div class="bt-fill" style="width:' + pct + '%"></div></div>' +
        (won ? '<div class="bt-boss-win">The class beat the boss — well done! 🏆</div>' : '') +
      '</div>' +
      '<button class="secondary small" onclick="btBossReset()">New battle</button>' +
      '<button class="ghost small" onclick="btBossOff()">Hide</button>' +
    '</div>';
  }

  /* ── BATTLE ARENA (physics) ────────────────────────────────
     Free-for-all: avatars bounce, a long spinning arm knocks a
     point off whoever it touches; pop at zero, last one wins.
     Boss battle: the class attacks a boss with 6 orbiting limbs
     (each its own HP + spinning arm); clear all limbs, then the
     core. The boss's limb-arms knock points off pupils. */
  var BT_R = 30, BT_REACH = 80, BT_MIN = 0.55, BT_MAX = 3.6, BT_REST = 1.07;
  var BT_SPIN_ACC = 0.0005, BT_SPIN_MAX = 0.10, BT_KNOCK = 3.2, BT_SHRINK = 0.04;
  var AR = { running:false, paused:false, mode:'ffa', bots:[], boss:null, raf:0, lastWinner:'', result:'', bossMsg:'', inset:0 };

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
    return sortedRoster().map(function (p, i){
      var r = BT_R, sp = 1.0 + Math.random(), a = Math.random() * Math.PI * 2;
      return {
        pid: p.id, name: p.name, color: BT_COLORS[i % BT_COLORS.length], r: r,
        hp: Math.max(1, btPts(s, p.id)),  // pupil's points = battle HP (starting + awards, clamped)
        x: r + Math.random() * (W - 2*r), y: r + 20 + Math.random() * (H - 2*r - 20),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ang: Math.random() * Math.PI * 2, spin: (Math.random() < 0.5 ? -1 : 1) * (0.024 + Math.random()*0.03),
        cd: 0, alive: true, el: null, ball: null, arm: null, lastHp: -1
      };
    });
  }
  function btSpawnBoss(s){
    var sz = btArenaSize(), n = 6, armLen = Math.min(150, sz.H * 0.30);
    var csp = 0.75, ca = Math.random() * Math.PI * 2;
    var core = { x: sz.W/2, y: sz.H*0.48, r: 46, hp: s.coreHP, max: s.coreHP, ang: 0, spin: 0.011,
                 vx: Math.cos(ca)*csp, vy: Math.sin(ca)*csp,
                 ownAng: Math.random()*Math.PI*2, ownSpin: 0.036, reach: 90, arms: 2,
                 cd: 0, alive: true, vuln: false, el: null, ball: null, arm1: null, arm2: null };
    var sats = [];
    for (var i = 0; i < n; i++) sats.push({
      off: i * (Math.PI*2/n), r: 26, hp: s.satHP, max: s.satHP, alive: true,
      x: core.x, y: core.y, ownAng: Math.random()*Math.PI*2, ownSpin: (i%2?1:-1)*(0.042+Math.random()*0.024),
      reach: 52, cd: 0, el: null, ball: null, arm: null, conn: null, lastHp: -1
    });
    return { core: core, sats: sats, n: n, armLen: armLen };
  }

  function btWalls(b, W, H, inset){
    inset = inset || 0;
    if (b.x < inset + b.r){ b.x = inset + b.r; b.vx = Math.abs(b.vx); }
    if (b.x > W - inset - b.r){ b.x = W - inset - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < inset + b.r){ b.y = inset + b.r; b.vy = Math.abs(b.vy); }
    if (b.y > H - inset - b.r){ b.y = H - inset - b.r; b.vy = -Math.abs(b.vy); }
  }
  function btMovePupils(bots, W, H, withArmHits, now, inset){
    var i, j;
    for (i = 0; i < bots.length; i++){ var b = bots[i]; if (!b.alive) continue;
      b.x += b.vx; b.y += b.vy; b.ang += b.spin; btAccSpin(b, 'spin'); btWalls(b, W, H, inset); btSpeedClamp(b); }
    for (i = 0; i < bots.length; i++){ var A = bots[i]; if (!A.alive) continue;
      var tx = A.x + Math.cos(A.ang)*BT_REACH, ty = A.y + Math.sin(A.ang)*BT_REACH;
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
          if (hx*hx + hy*hy < C.r*C.r && now >= C.cd){ C.hp -= 1; C.cd = now + 420; C.justHit = now;
            btKnock(C, A.x, A.y);   // bounce the struck avatar away from the attacker
            A.spin = -A.spin;       // the arm bounces off, reversing its spin
            if (C.hp <= 0){ C.alive = false; C.poppedAt = now; } }
        }
      }
    }
  }

  // Free-for-all step. Returns alive count.
  function btTick(bots, W, H, now, inset){
    btMovePupils(bots, W, H, true, now, inset);
    var alive = 0; for (var i = 0; i < bots.length; i++) if (bots[i].alive) alive++;
    return alive;
  }

  // Boss step. Returns { pupils, limbs, core }.
  function btTickBoss(bots, boss, W, H, now, inset){
    inset = inset || 0;
    btMovePupils(bots, W, H, false, now, inset);     // pupils cooperate (no arm damage to each other)
    var core = boss.core, sats = boss.sats, i, k;
    // the boss roams the arena too; bounce so its limbs stay on-screen
    core.x += core.vx; core.y += core.vy;
    var marg = Math.min(inset + boss.armLen + 30, Math.min(W, H)/2 - 8);
    if (core.x < marg){ core.x = marg; core.vx = Math.abs(core.vx); }
    if (core.x > W - marg){ core.x = W - marg; core.vx = -Math.abs(core.vx); }
    if (core.y < marg){ core.y = marg; core.vy = Math.abs(core.vy); }
    if (core.y > H - marg){ core.y = H - marg; core.vy = -Math.abs(core.vy); }
    core.ang += core.spin;
    core.ownAng += core.ownSpin; btAccSpin(core, 'ownSpin');
    var liveLimbs = 0;
    for (i = 0; i < sats.length; i++){ var st = sats[i]; if (!st.alive) continue; liveLimbs++;
      var a = core.ang + st.off;
      st.x = core.x + Math.cos(a) * boss.armLen;
      st.y = core.y + Math.sin(a) * boss.armLen;
      st.ownAng += st.ownSpin; btAccSpin(st, 'ownSpin');
    }
    core.vuln = liveLimbs === 0;
    // pupils attack the boss; boss limbs bump and attack pupils
    for (i = 0; i < bots.length; i++){ var P = bots[i]; if (!P.alive) continue;
      var tx = P.x + Math.cos(P.ang)*BT_REACH, ty = P.y + Math.sin(P.ang)*BT_REACH;
      for (k = 0; k < sats.length; k++){ var S = sats[k]; if (!S.alive) continue;
        // physical bounce off the limb (limb is heavy → only the pupil reflects)
        var dx = P.x - S.x, dy = P.y - S.y, d2 = dx*dx + dy*dy, rr = P.r + S.r;
        if (d2 < rr*rr && d2 > 0.01){ var d = Math.sqrt(d2), nx = dx/d, ny = dy/d;
          P.x = S.x + nx*rr; P.y = S.y + ny*rr;
          var vn = P.vx*nx + P.vy*ny; if (vn < 0){ P.vx -= 2*vn*nx; P.vy -= 2*vn*ny; btSpeedClamp(P); } }
        // pupil arm hits the limb — arm bounces off, reversing its spin
        var hx = S.x - tx, hy = S.y - ty;
        if (hx*hx + hy*hy < S.r*S.r && now >= S.cd){ S.hp -= 1; S.cd = now + 230; S.justHit = now; P.spin = -P.spin;
          if (S.hp <= 0) S.alive = false; }
        // limb's own arm hits the pupil
        var sx = S.x + Math.cos(S.ownAng)*S.reach, sy = S.y + Math.sin(S.ownAng)*S.reach;
        var px = P.x - sx, py = P.y - sy;
        if (px*px + py*py < P.r*P.r && now >= P.cd){ P.hp -= 1; P.cd = now + 460; P.justHit = now;
          btKnock(P, S.x, S.y);
          if (P.hp <= 0){ P.alive = false; P.poppedAt = now; } }
      }
      // once limbs are gone, attack the core
      if (core.vuln && core.alive){
        var cdx = P.x - core.x, cdy = P.y - core.y, crr = P.r + core.r;
        if (cdx*cdx + cdy*cdy < crr*crr){ var cd = Math.hypot(cdx,cdy)||0.0001, cnx=cdx/cd, cny=cdy/cd;
          P.x = core.x + cnx*crr; P.y = core.y + cny*crr;
          var cvn = P.vx*cnx + P.vy*cny; if (cvn < 0){ P.vx -= 2*cvn*cnx; P.vy -= 2*cvn*cny; btSpeedClamp(P); } }
        var ctx = core.x - tx, cty = core.y - ty;
        if (ctx*ctx + cty*cty < core.r*core.r && now >= core.cd){ core.hp -= 1; core.cd = now + 160; core.justHit = now;
          if (core.hp <= 0) core.alive = false; }
      }
    }
    // once its limbs are gone the core keeps 2 spinning arms that still hit pupils
    if (core.vuln && core.alive){
      for (var ai = 0; ai < core.arms; ai++){
        var aang = core.ownAng + ai * (Math.PI*2 / core.arms);
        var atx = core.x + Math.cos(aang)*core.reach, aty = core.y + Math.sin(aang)*core.reach;
        for (k = 0; k < bots.length; k++){ var Q = bots[k]; if (!Q.alive) continue;
          var qx = Q.x - atx, qy = Q.y - aty;
          if (qx*qx + qy*qy < Q.r*Q.r && now >= Q.cd){ Q.hp -= 1; Q.cd = now + 460; Q.justHit = now;
            btKnock(Q, core.x, core.y);
            if (Q.hp <= 0){ Q.alive = false; Q.poppedAt = now; } }
        }
      }
    }
    var pupils = 0; for (i = 0; i < bots.length; i++) if (bots[i].alive) pupils++;
    return { pupils: pupils, limbs: liveLimbs, core: core.hp };
  }

  /* ── Painting ───────────────────────────────────────────── */
  function btPopEl(holder){ if (holder.el && !holder.el.classList.contains('pop')){ holder.el.classList.add('pop');
    var el = holder.el; setTimeout(function (){ if (el && el.parentNode) el.parentNode.removeChild(el); }, 320); holder.el = null;
    if (holder.conn && holder.conn.parentNode){ holder.conn.parentNode.removeChild(holder.conn); holder.conn = null; } } }
  function btPaintBot(b){
    if (!b.el) return;
    if (!b.alive){ btPopEl(b); return; }
    b.el.style.transform = 'translate(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px)';
    b.arm.style.transform = 'rotate(' + b.ang + 'rad)';
    if (b.hp !== b.lastHp){ b.ball.firstChild.nodeValue = b.hp; b.lastHp = b.hp; }
    if (b.justHit && Date.now() - b.justHit < 240) b.el.classList.add('hit'); else b.el.classList.remove('hit');
  }
  function btPaint(){
    var i;
    for (i = 0; i < AR.bots.length; i++) btPaintBot(AR.bots[i]);
    if (!AR.boss) return;
    var core = AR.boss.core;
    if (core.el){
      core.el.style.transform = 'translate(' + (core.x - core.r) + 'px,' + (core.y - core.r) + 'px)';
      if (core.hp !== core.lastHp){ core.ball.firstChild.nodeValue = Math.max(0, core.hp); core.lastHp = core.hp; }
      core.el.classList.toggle('vuln', core.vuln && core.alive);
      if (core.arm1){
        var showArms = core.vuln && core.alive;
        core.arm1.style.display = showArms ? 'block' : 'none';
        core.arm2.style.display = showArms ? 'block' : 'none';
        if (showArms){
          core.arm1.style.transform = 'rotate(' + core.ownAng + 'rad)';
          core.arm2.style.transform = 'rotate(' + (core.ownAng + Math.PI) + 'rad)';
        }
      }
      if (!core.alive) btPopEl(core);
      if (core.justHit && Date.now() - core.justHit < 240) core.el.classList.add('hit'); else core.el && core.el.classList.remove('hit');
    }
    AR.boss.sats.forEach(function (st){
      if (!st.el) return;
      if (!st.alive){ btPopEl(st); return; }
      st.el.style.transform = 'translate(' + (st.x - st.r) + 'px,' + (st.y - st.r) + 'px)';
      st.arm.style.transform = 'rotate(' + st.ownAng + 'rad)';
      if (st.hp !== st.lastHp){ st.ball.firstChild.nodeValue = st.hp; st.lastHp = st.hp; }
      if (st.conn){
        var len = Math.hypot(st.x - core.x, st.y - core.y), ang = Math.atan2(st.y - core.y, st.x - core.x);
        st.conn.style.width = len + 'px';
        st.conn.style.transform = 'translate(' + core.x + 'px,' + (core.y - 4) + 'px) rotate(' + ang + 'rad)';
      }
      if (st.justHit && Date.now() - st.justHit < 200) st.el.classList.add('hit'); else st.el.classList.remove('hit');
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
    b.el = el; b.arm = arm; b.ball = ball; b.lastHp = b.hp;
    return el;
  }
  function btMount(){
    var arena = document.getElementById('bt-arena'); if (!arena) return;
    if (AR.boss){
      var core = AR.boss.core;
      // limbs first (behind), with their connector arms
      AR.boss.sats.forEach(function (st){
        var conn = document.createElement('div'); conn.className = 'bt-conn'; arena.appendChild(conn); st.conn = conn;
        arena.appendChild(btMakeBot(st, 'bt-sat'));
      });
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
    var f = document.getElementById('bt-frame'); if (!f) return;
    f.style.left = f.style.top = f.style.right = f.style.bottom = AR.inset + 'px';
  }
  function btStatus(){
    var rem = document.getElementById('btRemain'); if (!rem) return;
    if (AR.mode === 'boss' && AR.boss){
      var live = AR.boss.sats.filter(function (s){ return s.alive; }).length;
      var pupils = AR.bots.filter(function (b){ return b.alive; }).length;
      rem.textContent = 'Boss ' + Math.max(0, AR.boss.core.hp) + ' HP · Limbs ' + live + '/' + AR.boss.n + ' · Class ' + pupils + ' left';
    } else {
      rem.textContent = AR.bots.filter(function (b){ return b.alive; }).length + ' remaining';
    }
  }
  function btFrame(){
    var arena = document.getElementById('bt-arena'), page = document.getElementById('page-battler');
    if (!AR.running || !arena || !(page && page.classList.contains('active'))){ AR.running = false; return; }
    if (!AR.paused){
      var W = arena.clientWidth, H = arena.clientHeight, now = Date.now();
      AR.inset = Math.min(AR.inset + BT_SHRINK, Math.min(W, H)/2 - 100);  // arena slowly closes in
      btPaintFrame(W, H);
      if (AR.mode === 'boss'){
        var r = btTickBoss(AR.bots, AR.boss, W, H, now, AR.inset); btPaint(); btStatus();
        if (!AR.boss.core.alive){ btFinishBoss(true); return; }
        if (r.pupils === 0){ btFinishBoss(false); return; }
      } else {
        var alive = btTick(AR.bots, W, H, now, AR.inset); btPaint(); btStatus();
        if (alive <= 1){ btFinish(); return; }
      }
    }
    AR.raf = requestAnimationFrame(btFrame);
  }

  /* ── Controls / lifecycle ───────────────────────────────── */
  window.btStartBattle = function (){
    var s = btLoad();
    if (sortedRoster().length < 2) return;
    AR.lastWinner = ''; AR.result = ''; AR.bossMsg = ''; AR.running = true; AR.paused = false; AR.inset = 0;
    AR.mode = s.arenaMode === 'boss' ? 'boss' : 'ffa';
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
  function btFinish(){
    AR.running = false; cancelAnimationFrame(AR.raf);
    var winner = AR.bots.filter(function (b){ return b.alive; })[0]; AR.bots = []; AR.boss = null;
    var s = btLoad();
    if (winner){ AR.lastWinner = winner.name; btBeep([523,659,784,1047], 0.13);
      if (s.winnerBonus > 0){ btAwardPids([winner.pid], s.winnerBonus, 'Battle winner'); return; } }
    btRender();
  }
  function btFinishBoss(win){
    AR.running = false; cancelAnimationFrame(AR.raf);
    var survivors = AR.bots.filter(function (b){ return b.alive; }).map(function (b){ return b.pid; });
    AR.bots = []; AR.boss = null; AR.result = win ? 'win' : 'lose';
    var s = btLoad();
    if (win){ AR.bossMsg = 'The class defeated the boss!'; btBeep([523,659,784,1047], 0.14);
      if (s.winnerBonus > 0 && survivors.length){ btAwardPids(survivors, s.winnerBonus, 'Beat the boss'); return; } }
    else { AR.bossMsg = 'The boss won this time — try again!'; btBeep([300,200,150], 0.18); }
    btRender();
  }
  window.btSetWinnerBonus = function (v){ var s = btLoad(); var n = parseInt(v,10); s.winnerBonus = (n >= 0 ? n : 5); btSave(s); };
  window.btSetStartPoints = function (v){ var s = btLoad(); var n = parseInt(v,10); s.startPoints = (n >= 0 ? n : 0); btSave(s); btRender(); };
  window.btSetMaxPoints = function (v){ var s = btLoad(); if (v === '' || v == null){ s.maxPoints = ''; } else { var n = parseInt(v,10); s.maxPoints = (n >= 0 ? n : ''); } btSave(s); btRender(); };
  window.btSetArenaMode = function (m){ var s = btLoad(); s.arenaMode = (m === 'boss' ? 'boss' : 'ffa'); btSave(s); btRender(); };
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
    var modeSel = '<div class="seg" style="margin-bottom:14px">' +
        '<button class="' + (s.arenaMode !== 'boss' ? 'on' : '') + '" onclick="btSetArenaMode(\'ffa\')">⚔️ Free-for-all</button>' +
        '<button class="' + (s.arenaMode === 'boss' ? 'on' : '') + '" onclick="btSetArenaMode(\'boss\')">👹 Boss battle</button>' +
      '</div>';
    var bossFields = s.arenaMode === 'boss'
      ? '<div><label>Limb HP ×6</label><input type="number" min="1" value="' + s.satHP + '" style="width:100px" onchange="btSetSatHP(this.value)" /></div>' +
        '<div><label>Core HP</label><input type="number" min="1" value="' + s.coreHP + '" style="width:100px" onchange="btSetCoreHP(this.value)" /></div>'
      : '';
    var hint = s.arenaMode === 'boss'
      ? 'The class attacks together: smash all six spinning limbs, then the roaming core — which keeps two arms swinging at pupils. Each pupil’s points are their battle HP; they pop at zero and survivors share the bonus. Set the points on the Points tab.'
      : 'Each pupil’s points are their battle HP. They bounce around with a long spinning arm that knocks a point off (and bounces back) whoever it hits — pop at zero, last one standing wins. Set Starting/Minimum/Maximum points on the Points tab.';
    return '<div class="card no-print">' + modeSel +
        '<div class="row" style="align-items:flex-end">' +
          bossFields +
          '<div><label>Winner bonus</label><input id="btWinBonus" type="number" min="0" value="' + s.winnerBonus + '" style="width:110px" onchange="btSetWinnerBonus(this.value)" /></div>' +
          '<div class="grow"></div>' +
          '<button onclick="btStartBattle()">' + iconSVG('zap',16) + (s.arenaMode === 'boss' ? ' Start Boss Battle' : ' Start Battle') + '</button>' +
        '</div>' +
        '<p class="hint small" style="margin-top:8px">' + hint + '</p>' +
      '</div>' + banner;
  }

  function btPointsTab(s){
    var pupils = sortedRoster();
    var boss = btBossBar(s);
    if (!boss && !s.boss.active) {
      boss = '<div class="card no-print" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">' +
        '<div><label>Boss name</label><input id="btBossName" value="' + esc(s.boss.name) + '" /></div>' +
        '<div><label>Boss HP</label><input id="btBossMax" type="number" min="1" value="' + s.boss.max + '" style="width:90px" /></div>' +
        '<button onclick="btSetBoss()">👾 Start boss battle</button>' +
        '<div class="hint small grow">Optional: the class works together — every point earned damages the boss.</div></div>';
    }
    var ptCfg = '<div class="bt-minrow no-print">' +
      '<div class="bt-fg"><label>Minimum</label><input type="number" min="0" value="' + s.minPoints + '" style="width:80px" onchange="btSetMinPoints(this.value)" /></div>' +
      '<div class="bt-fg"><label>Starting</label><input type="number" min="0" value="' + s.startPoints + '" style="width:80px" onchange="btSetStartPoints(this.value)" /></div>' +
      '<div class="bt-fg"><label>Maximum</label><input type="number" min="0" placeholder="25" value="' + esc(s.maxPoints) + '" style="width:100px" onchange="btSetMaxPoints(this.value)" /></div>' +
      '<button class="ghost small" onclick="btResetPoints()">↺ Reset all to starting</button>' +
      '<span class="hint small grow">New pupils begin at <b>Starting</b>; points stay between <b>Minimum</b> and <b>Maximum</b> (blank max = unlimited).</span></div>';
    return boss + ptCfg + btStepBar(s) + btGroupBar(s) + '<div class="bt-grid">' + pupils.map(function (p){ return btPupilCard(s, p); }).join('') + '</div>';
  }

  // Quick award buttons for each set-up group (shown on the Points tab).
  function btGroupBar(s){
    if (!s.tables.length) return '';
    return '<div class="bt-groupbar">' +
      '<span class="bt-groupbar-label">Give points to a group:</span>' +
      s.tables.map(function (t, i){
        var n = t.pupilIds.length;
        return '<span class="bt-groupbtn">' +
          '<button class="bt-gminus" title="Take a point from the whole group" onclick="btAwardTable(\'' + t.id + '\',-1)">−</button>' +
          '<button class="bt-gadd ' + btTableColor(i) + '" onclick="btAwardTable(\'' + t.id + '\',1)">+' + s.step + ' ' + esc(t.name) + ' <span class="bt-gn">' + n + '</span></button>' +
        '</span>';
      }).join('') +
    '</div>';
  }

  function btTablesTab(s){
    var roster = sortedRoster();
    var create = '<div class="card no-print"><div class="row">' +
      '<div class="grow"><label>New group</label><input id="btTableName" placeholder="e.g. Red group" onkeydown="if(event.key===\'Enter\')btAddTable()" /></div>' +
      '<button onclick="btAddTable()">+ Add group</button>' +
      '<div><label>or auto-split into</label><div class="row" style="gap:6px"><input id="btAutoN" type="number" min="2" max="10" value="4" style="width:70px" /><button class="ghost" onclick="btAutoTables()">Auto groups</button></div></div>' +
    '</div></div>';
    if (!s.tables.length) return create + '<div class="empty">No groups yet. Create one above, then award a point to the whole group at once — they’ll also appear as quick buttons on the Points tab.</div>';
    var cards = s.tables.map(function (t, i){
      var avail = roster.filter(function (p){ return t.pupilIds.indexOf(p.id) < 0; });
      var members = t.pupilIds.length
        ? t.pupilIds.map(function (pid){ return '<span class="bt-chip">' + esc(pupilName(pid)) + ' <button onclick="btRemoveMember(\'' + t.id + '\',\'' + pid + '\')">×</button></span>'; }).join('')
        : '<span class="hint small">No members yet</span>';
      return '<div class="card"><div class="row" style="justify-content:space-between;align-items:center">' +
          '<input class="bt-tname" value="' + esc(t.name) + '" onchange="btRenameTable(\'' + t.id + '\',this.value)" />' +
          '<span class="bt-tscore av ' + btTableColor(i) + '">' + btTableTotal(s, t) + '</span>' +
        '</div>' +
        '<div class="bt-chips">' + members + '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<select onchange="btAddMember(\'' + t.id + '\',this.value);this.value=\'\'" style="min-width:160px"><option value="">+ Add pupil…</option>' +
            avail.map(function (p){ return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
          '<div class="grow"></div>' +
          '<button class="secondary" onclick="btAwardTable(\'' + t.id + '\',-1)">−' + s.step + ' all</button>' +
          '<button onclick="btAwardTable(\'' + t.id + '\',1)">+' + s.step + ' to group</button>' +
          '<button class="danger small" onclick="btDeleteTable(\'' + t.id + '\')">Delete</button>' +
        '</div></div>';
    }).join('');
    return create + btStepBar(s) + cards;
  }

  function btLeaderTab(s){
    var ranked = sortedRoster().map(function (p){ return { p: p, pts: btPts(s, p.id) }; })
                  .sort(function (a, b){ return b.pts - a.pts || a.p.name.localeCompare(b.p.name); });
    var medal = ['gold','slate','coral'];
    var rows = ranked.map(function (r, i){
      return '<div class="bt-rankrow">' +
        '<span class="bt-rank ' + (i < 3 ? medal[i] : '') + '">' + (i + 1) + '</span>' +
        btAvatar(r.p.name, i < 3 ? medal[i] : 'teal') +
        '<span class="bt-rname">' + esc(r.p.name) + '</span>' +
        '<span class="bt-rlvl">Lv ' + btLevel(r.pts) + '</span>' +
        '<span class="bt-rpts">' + r.pts + '</span></div>';
    }).join('');
    var tableStand = '';
    if (s.tables.length){
      var ts = s.tables.map(function (t, i){ return { t: t, total: btTableTotal(s, t), i: i }; }).sort(function (a, b){ return b.total - a.total; });
      tableStand = '<div class="card"><div class="cardhead"><h3>Group standings</h3></div>' +
        ts.map(function (x){
          var max = ts[0].total || 1, pct = Math.max(2, Math.round(x.total / max * 100));
          return '<div class="bt-tstand"><span class="bt-tslabel">' + esc(x.t.name) + '</span>' +
            '<div class="bt-bar"><div class="bt-fill ' + btTableColor(x.i) + '" style="width:' + pct + '%"></div></div>' +
            '<span class="bt-tsval">' + x.total + '</span></div>';
        }).join('') + '</div>';
    }
    return '<div class="card"><div class="cardhead"><h3>Pupil leaderboard</h3></div>' + (rows || '<div class="empty">No pupils yet.</div>') + '</div>' + tableStand;
  }

  function btSettingsTab(s){
    function tog(key, label, hint){
      return '<div class="bt-setting"><div><b>' + label + '</b><div class="hint small">' + hint + '</div></div>' +
        '<button class="bt-switch' + (s[key] ? ' on' : '') + '" onclick="btToggle(\'' + key + '\')">' + (s[key] ? 'On' : 'Off') + '</button></div>';
    }
    return '<div class="card" style="max-width:620px">' +
      tog('sound', 'Sound effects', 'A little chime when points are awarded.') +
      tog('logBh', 'Log to Behaviour Log', 'Each award also adds a dated note in the Behaviour Log.') +
      '<div class="bt-setting"><div><b>Reset all points</b><div class="hint small">Sets every pupil back to the starting amount and clears boss damage.</div></div>' +
        '<button class="danger" onclick="btResetPoints()">Reset points</button></div>' +
    '</div>';
  }

  /* ── Main render ────────────────────────────────────────── */
  function btRender(){
    var root = document.getElementById('bt-root'); if (!root) return;
    var s = btLoad();
    if (!roster.length){ root.innerHTML = '<div class="card"><p class="empty">Add pupils on the Class List page first — they become your battlers.</p></div>'; return; }
    var tabs = [['battle','Battle'],['points','Points'],['tables','Groups'],['leaderboard','Leaderboard'],['settings','Settings']];
    var nav = AR.running ? '' : '<div class="tabs no-print">' + tabs.map(function (t){
      return '<button class="tab' + (s.tab === t[0] ? ' active' : '') + '" onclick="btSetTab(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('') + '</div>';
    var body = s.tab === 'points' ? btPointsTab(s)
             : s.tab === 'tables' ? btTablesTab(s)
             : s.tab === 'leaderboard' ? btLeaderTab(s)
             : s.tab === 'settings' ? btSettingsTab(s)
             : btBattleTab(s);
    root.innerHTML = nav + body;
  }

  window.btRender = btRender;
  window._btTick = btTick; window._btTickBoss = btTickBoss; window._btSpawn = btSpawn; window._btSpawnBoss = btSpawnBoss; window._btAR = AR;  /* test hooks */
})();
