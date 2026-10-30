import {hospitalSeed,orderMessage,ingestOrder,retryOrders,attachStudy,erpSeed,receiveGoods,received,matchInvoice,crmSeed,addLead,moveLead,stages,documentSeed,sampleDocument,extractDocument,approveDocument,releaseSeed,setControl,releaseDecision} from './business-rules.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind=document.body.dataset.lab;
const factories={healthcare:hospitalSeed,erp:erpSeed,commercial:crmSeed,documents:documentSeed,release:releaseSeed};
let state=factories[kind]();
const label=(id,title,type='text',value='')=>`<label class="field" for="${id}"><span>${title}</span><input class="input" id="${id}" type="${type}" value="${escape(value)}" ${type==='number'?'min="0" step="0.01"':''}></label>`;
const button=(action,title,primary=false)=>`<button type="button" class="btn ${primary?'primary':''}" data-action="${action}">${title}</button>`;
const table=(headers,rows)=>`<div class="tablewrap"><table><thead><tr>${headers.map(x=>`<th>${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(x=>`<td>${escape(x)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty">No records yet. Run the guided scenario.</td></tr>`}</tbody></table></div>`;
const metric=(title,value,note)=>`<div class="kpi"><div class="label">${title}</div><div class="statnum">${escape(value)}</div><div class="note">${note}</div></div>`;
const section=(title,content)=>`<section class="result-section"><h3>${title}</h3>${content}</section>`;
const currency=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value);
const forms={
 healthcare:`<h2>Order intake</h2><p>Start with a synthetic radiology order. Replaying it must not create a duplicate.</p><label class="field" for="message"><span>HL7 v2.5 ORM^O01 sample · editable</span><textarea class="input mono" id="message" rows="9" spellcheck="false">${escape(orderMessage())}</textarea></label><div class="actions">${button('ingest','Process order',true)}${button('sample','Load new order')}</div><div class="divider"></div><label class="check"><input type="checkbox" id="offline"> Simulate unavailable RIS interface</label><div class="actions">${button('retry','Retry queued messages')}</div><div class="divider"></div><h3>Associate imaging metadata</h3><p class="fineprint">Metadata association only; no DICOM file transfer or clinical validation.</p>${label('patient','Synthetic patient ID','text','DEMO-001')}${label('accession','Order / accession ID','text','ORD-1001')}<div class="actions">${button('associate','Associate study')}</div>`,
 erp:`<h2>Receive & reconcile</h2><p>PO-DEMO-104 orders 10 workstations at MXN 12,500 each. Opening stock: 2. Quantity unit: each; no tax or currency conversion.</p>${label('receipt','Receipt reference','text','GRN-001')}${label('quantity','Received units','number','6')}<div class="actions">${button('receive','Receive goods',true)}</div><div class="divider"></div><h3>Three-way match</h3><p class="fineprint">Try invoicing all 10 units after receiving only 6. Correct the receipt or invoice and run the match again.</p>${label('invoiceQuantity','Invoice units','number','10')}${label('price','Invoice unit price · MXN','number','12500')}<div class="actions">${button('match','Evaluate invoice')}</div>`,
 commercial:`<h2>Qualify an opportunity</h2><p>Route work to the right specialty, preserve one lead per email and require evidence before handover.</p>${label('company','Fictional company','text','Demo Imaging Group')}${label('email','Synthetic contact email','email','buyer@example.org')}<label class="field" for="service"><span>Service required</span><select id="service" class="input"><option>Software</option><option>CRM &amp; marketing</option><option>Document workflows</option></select></label>${label('value','Illustrative opportunity value · MXN','number','50000')}<div class="actions">${button('lead','Capture lead',true)}</div><div class="divider"></div><h3>Stage evidence</h3><label class="field" for="leadId"><span>Opportunity</span><select id="leadId" class="input"></select></label><label class="check"><input id="discovery" type="checkbox"> Discovery completed</label><label class="check"><input id="scope" type="checkbox"> Scope agreed</label><label class="check"><input id="acceptance" type="checkbox"> Customer acceptance recorded</label><div class="actions">${button('advance','Advance one stage')}</div><p class="fineprint">Routing illustrates specialty categories; it does not create a real referral or contact a partner.</p>`,
 documents:`<h2>Extract & review</h2><p>Paste the synthetic invoice text. The parser extracts labeled fields and checks arithmetic and the purchase order.</p><label class="field" for="document"><span>Invoice text · editable</span><textarea id="document" class="input mono" rows="10">${sampleDocument}</textarea></label><div class="actions">${button('extract','Extract and validate',true)}${button('broken','Load inconsistent invoice')}</div><div class="divider"></div><h3>Human approval</h3>${label('reviewer','Demo reviewer name','text','Demo reviewer')}<label class="check"><input type="checkbox" id="confirmed"> I reviewed the fields against the source</label><div class="actions">${button('approve','Approve reviewed document')}</div><p class="fineprint">Text extraction is deterministic. This demo does not perform OCR, call an AI model or approve payment.</p>`,
 release:`<h2>Release evidence</h2><p>Check a control only after its fictional evidence has been reviewed. Reopening a critical control must block release.</p><div id="controls"></div><div class="notice">The recommendation follows explicit rules. A real launch still requires authorized business and technical approval.</div><a class="btn" href="../tpm-program-dashboard/">Explore milestone dependencies →</a>`
};
$('inputs').innerHTML=forms[kind];
function render(){
 let metrics='',output='';
 if(kind==='healthcare'){
  metrics=metric('Accepted orders',state.messages.length,'Validated supported message subset')+metric('Retry queue',state.queue.length,state.online?'Interface available':'Interface offline')+metric('Associated studies',state.studies.length,'Patient and accession must match');
  output=section('Accepted order registry',table(['Message','Patient','Accession','Procedure'],state.messages.map(x=>[x.id,x.patient,x.accession,x.procedure])))+section('Recovery queue',table(['Message','Patient','Reason'],state.queue.map(x=>[x.id,x.patient,'Interface unavailable'])))+section('Imaging metadata',table(['Accession','Patient','Modality','Status'],state.studies.map(x=>[x.accession,x.patient,x.modality,x.status])));
 }
 if(kind==='erp'){
  const count=received(state), invoice=state.invoice;
  metrics=metric('Units in stock',state.opening+count,`${count} received / ${state.ordered} ordered`)+metric('Received value',currency(count*state.unitPrice),'PO cost basis; excludes opening stock')+metric('Invoice decision',invoice?.status??'PENDING','Match recommendation; no payment');
  output=section('Goods receipts',table(['Reference','Quantity','Unit'],state.receipts.map(x=>[x.reference,x.quantity,'each'])))+section('Invoice reconciliation',invoice?`<div class="notice"><strong>${escape(invoice.status)}</strong> · ${escape(currency(invoice.total))}<br>${escape(invoice.reasons.join(' · ')||'Quantity and price matched against PO and receipts. Ready for separate approval.')}</div>`:'<p>No invoice evaluated.</p>');
 }
 if(kind==='commercial'){
  const open=state.leads.filter(x=>!['Won','Handover'].includes(x.stage));
  metrics=metric('Opportunities',state.leads.length,'Unique contact email policy')+metric('Open pipeline',currency(open.reduce((a,x)=>a+x.value,0)),'Unweighted estimates; not booked revenue')+metric('Handovers',state.leads.filter(x=>x.stage==='Handover').length,'Accepted scope and specialist routing');
  output=section('Opportunity pipeline',table(['ID','Company','Service','Owner','Stage','Value'],state.leads.map(x=>[x.id,x.company,x.service,x.owner,x.stage,currency(x.value)])))+section('Stage contract',`<div class="step-rail">${stages.map(x=>`<span>${x}</span>`).join('<i>→</i>')}</div><p class="fineprint">Discovery → agreed scope → customer acceptance → specialist handover. No external messages are sent.</p>`);
  const selected=$('leadId').value;
  $('leadId').innerHTML=state.leads.length?state.leads.map(x=>`<option value="${x.id}">${x.id} · ${escape(x.company)} · ${x.stage}</option>`).join(''):'<option value="">Capture a lead first</option>';
  if(state.leads.some(x=>x.id===selected))$('leadId').value=selected;
 }
 if(kind==='documents'){
  const doc=state.document;
  metrics=metric('Workflow status',doc?.status??'NEW','Extraction → validation → human review')+metric('Exceptions',doc?.flags.length??0,'Required fields, arithmetic and PO lookup')+metric('Approved by',doc?.reviewer??'Pending','Named reviewer and explicit confirmation');
  output=section('Extracted fields',table(['Field','Value'],doc?Object.entries(doc.fields):[]))+section('Validation results',doc?`<div class="notice">${escape(doc.flags.join(' · ')||'All configured checks passed. Human review is still required.')}</div>`:'<p>Extract the sample to begin.</p>');
 }
 if(kind==='release'){
  const d=releaseDecision(state);
  metrics=metric('Recommendation',d.decision,'Critical controls determine release gate')+metric('Readiness',`${d.readiness}%`,'Controls confirmed; not a success probability')+metric('Critical blockers',d.blockers.length,'Any critical blocker yields NO GO');
  $('controls').innerHTML=state.controls.map(x=>`<label class="check control"><input type="checkbox" data-control="${x.id}" ${x.complete?'checked':''}><span><strong>${escape(x.title)}</strong><small>${escape(x.owner)} · ${x.critical?'Critical gate':'Advisory'}</small></span></label>`).join('');
  output=section('Decision and owners',table(['Control','Owner','Class','Evidence'],state.controls.map(x=>[x.id,x.owner,x.critical?'Critical':'Advisory',x.complete?'Confirmed':'Pending'])))+section('Next decision',`<div class="notice">${escape(d.blockers.length?'Hold launch. Obtain evidence for: '+d.blockers.map(x=>x.id).join(', '):d.pending.length?'Critical gates cleared. Agree the remaining advisory action before proceeding.':'All modeled controls cleared. Submit the evidence to the authorized release owner.')}</div>`);
 }
 $('metrics').innerHTML=metrics;
 $('results').innerHTML=output;
 $('audit').innerHTML=table(['#','Decision','Detail'],state.audit.slice(-30).reverse().map(x=>[x.sequence,x.action,x.detail]));
 $('audit-count').textContent=`${state.audit.length} recorded decision(s)`;
}
function notify(message,error=false){$('feedback').textContent=message;$('feedback').className='notice '+(error?'error':'success');}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function report(){
 const title=document.querySelector('h1').textContent;
 const lines=[`# ${title}`,'','Independent portfolio demonstration. All data and outcomes are synthetic.','',`## Scenario state`, '```json',JSON.stringify(state,null,2),'```','','## Interpretation',kind==='release'?`Recommendation: ${releaseDecision(state).decision}`:kind==='erp'?`Invoice: ${state.invoice?.status??'not evaluated'}`:kind==='documents'?`Document: ${state.document?.status??'not extracted'}`:'Review the decision trail and resolve exceptions before handover.','','## Production considerations','Production use requires secure access, durable storage, verified integrations, monitoring and acceptance by accountable owners.'];
 return lines.join('\n');
}
document.addEventListener('click',event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
 try{
  const before=state.audit.length;
  switch(action){
   case 'ingest':state=ingestOrder(state,$('message').value);break;
   case 'sample':{const n=state.messages.length+state.queue.length+1002;$('message').value=orderMessage(`MSG-${n}`).replaceAll('ORD-1001',`ORD-${n}`);notify('New synthetic order loaded. Process it to register it.');return;}
   case 'retry':state=retryOrders(state);break;
   case 'associate':state=attachStudy(state,$('patient').value.trim(),$('accession').value.trim());break;
   case 'receive':state=receiveGoods(state,$('quantity').value,$('receipt').value);break;
   case 'match':state=matchInvoice(state,$('invoiceQuantity').value,$('price').value);break;
   case 'lead':state=addLead(state,{company:$('company').value,email:$('email').value,service:$('service').value,value:$('value').value});break;
   case 'advance':state=moveLead(state,$('leadId').value,{discovery:$('discovery').checked,scope:$('scope').checked,acceptance:$('acceptance').checked});break;
   case 'extract':state=extractDocument(state,$('document').value);$('confirmed').checked=false;break;
   case 'broken':$('document').value=sampleDocument.replace('Total: 125000','Total: 99999');notify('Inconsistent total loaded. Extract it to see the validation exception.');return;
   case 'approve':state=approveDocument(state,$('reviewer').value,$('confirmed').checked);break;
   case 'reset':state=factories[kind]();if($('offline'))$('offline').checked=false;if($('confirmed'))$('confirmed').checked=false;break;
   case 'export':download(`${kind}-audit.json`,JSON.stringify({provenance:'Synthetic independent portfolio scenario',state},null,2),'application/json');notify('Scenario and full decision trail exported as JSON.');return;
   case 'brief':download(`${kind}-executive-brief.md`,report(),'text/markdown');notify('Executive scenario brief exported.');return;
  }
  render();const last=state.audit.at(-1);const isError=/REJECTED|CONFLICT|ON_HOLD/.test(last?.action??'');notify(action==='reset'?'Scenario reset.':state.audit.length>before?`${last.action}: ${last.detail}`:'No queued messages to process.',isError);
 }catch(error){notify(error.message,true);}
});
document.addEventListener('change',event=>{
 if(event.target.id==='offline'){state={...state,online:!event.target.checked};render();notify(state.online?'Interface restored. Retry queued messages.':'Interface offline. New orders enter the recovery queue.');}
 if(event.target.dataset.control){state=setControl(state,event.target.dataset.control,event.target.checked);render();notify(`Release recommendation: ${releaseDecision(state).decision}`);}
});
render();
