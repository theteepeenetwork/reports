/* glow-launch.js — GLOW GETTERS — launcher (opens the standalone smartboard window)
   Owner: Board (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   GLOW GETTERS — launcher (opens the standalone smartboard window)
   =================================================================== */
function openGlowGetters(sameTab){
  const url = 'glow-getters.html';
  if (sameTab){ location.href = url; return; }
  const w = window.open(url, 'glowgetters', 'width=1400,height=900');
  if (!w) location.href = url; // popup blocked → fall back to this tab
}
/* back-compat alias — see the bt* shim at the foot of js/glow.js */
window.openBattler = openGlowGetters;
function renderGlowLaunch(){
  const el = document.getElementById('blStats'); if (!el) return;
  const bt = Store.get('tp_battler', null);
  let total = 0;
  if (bt && bt.points) Object.keys(bt.points).forEach(k => total += (+bt.points[k] || 0));
  el.innerHTML =
    `<div class="bl-stat"><div class="n">${roster.length}</div><div class="l">Pupils</div></div>` +
    `<div class="bl-stat"><div class="n">${total}</div><div class="l">Class points</div></div>`;
}

const DASH_QUICK = [
  { key:'mental-starters', label:'Record mental starter', icon:'calculator', tone:'teal' },
  { key:'star-pupil',      label:'Log a star pupil',      icon:'star',       tone:'amber' },
  { key:'behaviour',       label:'Add behaviour note',    icon:'clipboard-list', tone:'coral' },
  { key:'assessments',     label:'Enter assessment scores', icon:'bar-chart-2', tone:'teal' },
  { key:'reports',         label:'Write reports',         icon:'file-text',  tone:'slate' }
];
const IDEAS = [
  { key:'mental-starters', title:'Mental Starters', icon:'calculator', tone:'teal',  body:'Log each morning’s score and award an iPad with a single tap.' },
  { key:'name-picker',     title:'Name Picker',     icon:'target',     tone:'coral', body:'Pull a pupil at random for fair questioning — no repeats.' },
  { key:'seating',         title:'Seating & Groups',icon:'layout-grid',tone:'teal',  body:'Generate fair, balanced groups in one click.' },
  { key:'reports',         title:'Report Builder',  icon:'file-text',  tone:'slate', body:'Assemble comments in your own voice, ready to refine.' }
];
function dashAvgStarter(){
  const all = [];
  Object.values(msData).forEach(b => Object.values(b.scores || {}).forEach(r => Object.values(r).forEach(c => {
    if (c && c.v != null && !isNaN(+c.v)) all.push(+c.v);
  })));
  return all.length ? (all.reduce((a,b) => a+b, 0) / all.length).toFixed(1) : '—';
}
function renderDashboard(){
  const avg = dashAvgStarter();
  setText('dashDate', new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' }));
  document.getElementById('dashHeroStats').innerHTML =
    heroStat(roster.length,'Pupils') + heroStat(spData.length,'Stars') + heroStat(avg,'Avg starter');
  document.getElementById('dashQuick').innerHTML = DASH_QUICK.map(q =>
    `<button class="qa" onclick="go('${q.key}')"><span class="ic ${q.tone}">${iconSVG(q.icon,20)}</span><b>${q.label}</b></button>`).join('');
  document.getElementById('dashStats').innerHTML =
    statTile(roster.length,'Pupils','') +
    statTile(spData.length,'Stars this term','var(--gold-600)') +
    statTile(avg,'Avg starter','var(--teal-600)') +
    statTile(bhData.length,'Behaviour notes','var(--coral-600)');
  document.getElementById('ideasList').innerHTML = IDEAS.map(d =>
    `<button class="idea" onclick="go('${d.key}')"><span class="ic ${d.tone}">${iconSVG(d.icon,18)}</span><b>${esc(d.title)}</b><p>${esc(d.body)}</p></button>`).join('');

  const recent = [...spData].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4);
  const starred = new Set(spData.map(x => x.pupilId));
  const toStar = Math.max(0, roster.length - starred.size);
  const stars = document.getElementById('dashStars');
  if (!recent.length){
    stars.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:10px 0 16px">No stars yet. <button class="link" onclick="go('star-pupil')">Log the first one →</button></div>`;
  } else {
    stars.innerHTML = recent.map(e => {
      const nm = pupilName(e.pupilId);
      return `<div class="listrow"><span class="av gold">${esc(initials(nm))}</span><div style="min-width:0"><div class="nm">${esc(nm)}</div><div class="rs">${esc(e.reason)}</div></div><span class="meta">${fmtDate(e.date)}</span></div>`;
    }).join('') +
      `<div style="margin-top:12px"><button class="link" onclick="go('star-pupil')">Open Star Pupil ${iconSVG('arrow-right',15)}</button></div>` +
      (toStar > 0 ? `<div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--teal-50);font-size:12.5px;color:var(--teal-700);font-weight:600">${toStar} ${toStar===1?'pupil hasn’t':'pupils haven’t'} been star yet this term</div>` : '');
  }
  updateNavCount();
}
function heroStat(n,l){ return `<div class="hs"><div class="n">${n}</div><div class="l">${l}</div></div>`; }
function statTile(n,l,accent){ return `<div class="stat"><div class="num"${accent?` style="color:${accent}"`:''}>${n}</div><div class="lab">${l}</div></div>`; }
function updateNavCount(){ const el = document.getElementById('navClassCount'); if (el) el.textContent = roster.length ? roster.length : ''; }
