/* assess.js — ASSESSMENTS
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   ASSESSMENTS
   =================================================================== */
// data: { 'Autumn': { pupilId: { num1,num2, read1,read2, readAge, spag, spell } } }
let asData = Store.get('tp_assess', {});
let asTerm = 'Baseline';
function asSave(){ Store.set('tp_assess', asData); }
function asBlock(){ if (!asData[asTerm]) asData[asTerm] = {}; return asData[asTerm]; }
function asRec(pid){ const b = asBlock(); if (!b[pid]) b[pid] = {}; return b[pid]; }
function asSet(pid, field, val){ asRec(pid)[field] = val === '' ? null : (field==='readAge' ? val : Number(val)); asSave(); asUpdateTotals(pid); }
function asNumTotal(r){ return (Number(r.num1)||0) + (Number(r.num2)||0); }
function asReadTotal(r){ return (Number(r.read1)||0) + (Number(r.read2)||0); }
function asSpagTotal(r){ return (Number(r.spag)||0) + (Number(r.spell)||0); }
function asUpdateTotals(pid){
  const r = asRec(pid);
  setText('nt-'+pid, asNumTotal(r) || '');
  setText('rt-'+pid, asReadTotal(r) || '');
  setText('st-'+pid, asSpagTotal(r) || '');
}
function asRender(){
  const tabs = document.getElementById('asTabs');
  tabs.innerHTML = ASSESS_TERMS.map(t => `<button class="tab${t===asTerm?' active':''}" onclick="asTerm='${t}';asRender()">${t}</button>`).join('');
  const t = document.getElementById('asTable');
  if (!roster.length){ t.innerHTML = '<tr><td class="empty">Add pupils on the Class List page first.</td></tr>'; return; }
  let h = `<tr>
    <th rowspan="2" class="name">Pupil</th>
    <th colspan="3" class="num">Numeracy</th>
    <th colspan="3" class="num">Reading</th>
    <th rowspan="2" class="num">Reading<br>age</th>
    <th colspan="3" class="num">SPAG</th>
  </tr><tr>
    <th class="num">Test 1</th><th class="num">Test 2</th><th class="num">Total</th>
    <th class="num">Test 1</th><th class="num">Test 2</th><th class="num">Total</th>
    <th class="num">SPaG</th><th class="num">Spelling</th><th class="num">Total</th>
  </tr>`;
  sortedRoster().forEach(p => {
    const r = asBlock()[p.id] || {};
    h += `<tr><td class="name">${esc(p.name)}</td>
      <td>${asInp(p.id,'num1',r.num1)}</td><td>${asInp(p.id,'num2',r.num2)}</td><td class="total-cell" id="nt-${p.id}">${asNumTotal(r)||''}</td>
      <td>${asInp(p.id,'read1',r.read1)}</td><td>${asInp(p.id,'read2',r.read2)}</td><td class="total-cell" id="rt-${p.id}">${asReadTotal(r)||''}</td>
      <td><input value="${r.readAge!=null?esc(r.readAge):''}" placeholder="7.4" onchange="asSet('${p.id}','readAge',this.value)" style="width:100%;border:none;text-align:center"/></td>
      <td>${asInp(p.id,'spag',r.spag)}</td><td>${asInp(p.id,'spell',r.spell)}</td><td class="total-cell" id="st-${p.id}">${asSpagTotal(r)||''}</td>
    </tr>`;
  });
  t.innerHTML = h;
}
function asInp(pid, field, val){
  return `<input type="number" min="0" value="${val!=null?val:''}" onchange="asSet('${pid}','${field}',this.value)" />`;
}
