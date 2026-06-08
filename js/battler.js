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
    return { v:1, tab:'battle', step:1, sound:true, logBh:false,
             points:{}, tables:[], boss:{ name:'Grumble the Gremlin', max:50, dealt:0, active:false } };
  }
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
  function btPts(s, pid){ return s.points[pid] || 0; }
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
      s.points[pid] = (s.points[pid] || 0) + n;
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
  window.btToggle   = function (key){ var s = btLoad(); s[key] = !s[key]; btSave(s); btRender(); };
  window.btAwardOne = function (pid, n){ btAwardPids([pid], n); };
  window.btAwardTable = function (tid, sign){
    var s = btLoad(), t = s.tables.find(function (x){ return x.id === tid; });
    if (!t || !t.pupilIds.length) return;
    btAwardPids(t.pupilIds, sign * s.step, 'Table: ' + t.name);
  };
  window.btResetPoints = function (){
    if (!confirm('Reset every pupil’s points to zero and clear boss damage?')) return;
    var s = btLoad(); s.points = {}; s.boss.dealt = 0; btSave(s); btRender();
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

  /* ── Tabs ───────────────────────────────────────────────── */
  function btBattleTab(s){
    var pupils = sortedRoster();
    var boss = btBossBar(s);
    if (!boss && !s.boss.active) {
      boss = '<div class="card no-print" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">' +
        '<div><label>Boss name</label><input id="btBossName" value="' + esc(s.boss.name) + '" /></div>' +
        '<div><label>Boss HP</label><input id="btBossMax" type="number" min="1" value="' + s.boss.max + '" style="width:90px" /></div>' +
        '<button onclick="btSetBoss()">👾 Start boss battle</button>' +
        '<div class="hint small grow">Optional: the class works together — every point earned damages the boss.</div></div>';
    }
    return boss + btStepBar(s) + '<div class="bt-grid">' + pupils.map(function (p){ return btPupilCard(s, p); }).join('') + '</div>';
  }

  function btTablesTab(s){
    var roster = sortedRoster();
    var create = '<div class="card no-print"><div class="row">' +
      '<div class="grow"><label>New table / group</label><input id="btTableName" placeholder="e.g. Red Table" onkeydown="if(event.key===\'Enter\')btAddTable()" /></div>' +
      '<button onclick="btAddTable()">+ Add table</button>' +
      '<div><label>or auto-split into</label><div class="row" style="gap:6px"><input id="btAutoN" type="number" min="2" max="10" value="4" style="width:70px" /><button class="ghost" onclick="btAutoTables()">Auto tables</button></div></div>' +
    '</div></div>';
    if (!s.tables.length) return create + '<div class="empty">No tables yet. Create one above, then award a point to the whole table at once.</div>';
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
          '<button onclick="btAwardTable(\'' + t.id + '\',1)">+' + s.step + ' to table</button>' +
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
      tableStand = '<div class="card"><div class="cardhead"><h3>Table standings</h3></div>' +
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
      '<div class="bt-setting"><div><b>Reset all points</b><div class="hint small">Sets every pupil back to zero and clears boss damage.</div></div>' +
        '<button class="danger" onclick="btResetPoints()">Reset points</button></div>' +
    '</div>';
  }

  /* ── Main render ────────────────────────────────────────── */
  function btRender(){
    var root = document.getElementById('bt-root'); if (!root) return;
    var s = btLoad();
    if (!roster.length){ root.innerHTML = '<div class="card"><p class="empty">Add pupils on the Class List page first — they become your battlers.</p></div>'; return; }
    var tabs = [['battle','Battle'],['tables','Tables'],['leaderboard','Leaderboard'],['settings','Settings']];
    var nav = '<div class="tabs no-print">' + tabs.map(function (t){
      return '<button class="tab' + (s.tab === t[0] ? ' active' : '') + '" onclick="btSetTab(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('') + '</div>';
    var body = s.tab === 'tables' ? btTablesTab(s)
             : s.tab === 'leaderboard' ? btLeaderTab(s)
             : s.tab === 'settings' ? btSettingsTab(s)
             : btBattleTab(s);
    root.innerHTML = nav + body;
  }

  window.btRender = btRender;
})();
