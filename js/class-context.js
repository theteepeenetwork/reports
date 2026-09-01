/* class-context.js — CLASS CONTEXT
   Owner: Desk (docs/OWNERSHIP.md)
   Extracted verbatim from the inline <script> in index.html.
   These are classic scripts sharing one global scope, so the load
   order in index.html is load-bearing — do not reorder the tags. */

/* ===================================================================
   CLASS CONTEXT
   =================================================================== */
function ctxRender(){
  const list = document.getElementById('ctxList');
  let send=0, ehcp=0, pp=0;
  roster.forEach(p => { if (p.send==='SEN Support') send++; if (p.send==='EHCP') ehcp++; if (p.pp) pp++; });
  setText('ctxSend', send + ehcp); setText('ctxEhcp', ehcp); setText('ctxPp', pp);
  if (!roster.length){ list.innerHTML = '<div class="card"><p class="empty">Add pupils on the Class List page first.</p></div>'; return; }
  list.innerHTML = sortedRoster().map(p => {
    const pills = [];
    if (p.send==='SEN Support') pills.push('<span class="pill send">SEND</span>');
    if (p.send==='EHCP') pills.push('<span class="pill ehcp">EHCP</span>');
    if (p.pp) pills.push('<span class="pill pp">PP</span>');
    if (p.allergies) pills.push('<span class="pill" style="background:#ffedd5;color:#9a3412">⚠ Allergy</span>');
    if (p.medical) pills.push('<span class="pill" style="background:#e0f2fe;color:#075985">✚ Medical</span>');
    return `<div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3 style="margin:0">${esc(p.name)} ${pills.join(' ')}</h3>
      </div>
      <div class="row">
        <div><label>SEND status</label>
          <select onchange="rosEdit('${p.id}','send',this.value);ctxRender()" style="min-width:160px">
            ${opt('None','None',p.send)}${opt('SEN Support','SEN Support',p.send)}${opt('EHCP','EHCP',p.send)}
          </select>
        </div>
        <div><label>Pupil Premium</label>
          <select onchange="rosEdit('${p.id}','pp',this.value==='yes');ctxRender()" style="width:90px">
            ${opt('no','No',p.pp?'yes':'no')}${opt('yes','Yes',p.pp?'yes':'no')}
          </select>
        </div>
        <div class="grow"><label>OneDrive SEND / EHCP plan link</label>
          <input value="${esc(p.ehcpLink||'')}" placeholder="Paste OneDrive link" onchange="rosEdit('${p.id}','ehcpLink',this.value)" />
        </div>
        ${p.ehcpLink ? `<div style="align-self:flex-end"><a href="${esc(p.ehcpLink)}" target="_blank"><button class="ghost">Open plan ↗</button></a></div>` : ''}
      </div>
      <div class="row">
        <div><label>Allergies</label>
          <select onchange="rosEdit('${p.id}','allergies',this.value==='yes');ctxRender()" style="width:90px">
            ${opt('no','No',p.allergies?'yes':'no')}${opt('yes','Yes',p.allergies?'yes':'no')}
          </select>
        </div>
        <div><label>Medical needs</label>
          <select onchange="rosEdit('${p.id}','medical',this.value==='yes');ctxRender()" style="width:90px">
            ${opt('no','No',p.medical?'yes':'no')}${opt('yes','Yes',p.medical?'yes':'no')}
          </select>
        </div>
      </div>
      ${p.allergies ? `<label>Allergy details</label>
      <textarea onchange="rosEdit('${p.id}','allergyNotes',this.value)" placeholder="Allergens, severity, EpiPen / medication location, signs of a reaction...">${esc(p.allergyNotes||'')}</textarea>` : ''}
      ${p.medical ? `<label>Medical notes</label>
      <textarea onchange="rosEdit('${p.id}','medicalNotes',this.value)" placeholder="Conditions, medication & dosage, care plan, what to watch for...">${esc(p.medicalNotes||'')}</textarea>` : ''}
      <label>Context &amp; needs</label>
      <textarea onchange="rosEdit('${p.id}','notes',this.value)" placeholder="Key context, strategies that work, medical, EAL, interventions...">${esc(p.notes||'')}</textarea>
      <label>Behaviour notes</label>
      <textarea onchange="rosEdit('${p.id}','behaviour',this.value)" placeholder="Triggers, de-escalation, reward that motivates...">${esc(p.behaviour||'')}</textarea>
    </div>`;
  }).join('');
}

/* ===================================================================
   DASHBOARD
   =================================================================== */
