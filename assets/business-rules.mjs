// Independent portfolio rules. All records are synthetic; no vendor connections.
export const copy = x => structuredClone(x);
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const number = (x, label, minimum = 0) => { const n = Number(x); requireValue(String(x).trim() !== '' && Number.isFinite(n) && n >= minimum, `${label}: enter a number >= ${minimum}`); return n; };
const money = x => Math.round((x + Number.EPSILON) * 100) / 100;
const audit = (state, action, detail) => ({...state, audit: [...state.audit, {sequence: state.audit.length + 1, action, detail}]});

export const orderMessage = (id = 'MSG-1001', patient = 'DEMO-001') => `MSH|^~\\&|HIS|DEMO-HOSPITAL|RIS|DEMO-RAD|20261029120000||ORM^O01|${id}|P|2.5\nPID|1||${patient}^^^DEMO||SYNTHETIC^PATIENT\nORC|NW|ORD-1001\nOBR|1|ORD-1001||XR-CHEST^Chest X-ray`;
export function parseOrder(raw) {
  requireValue(typeof raw === 'string' && raw.length < 20000, 'Message must contain fewer than 20,000 characters');
  const rows = raw.trim().split(/\r\n|\r|\n/).filter(Boolean).map(x => x.split('|'));
  const segment = name => { const matches = rows.filter(x => x[0] === name); requireValue(matches.length === 1, `Exactly one ${name} segment required`); return matches[0]; };
  const msh = segment('MSH'), pid = segment('PID'), obr = segment('OBR');
  requireValue(msh[1] === '^~\\&', 'This educational parser supports only standard delimiters');
  requireValue(msh[8] === 'ORM^O01' && msh[11] === '2.5', 'Supported subset: ORM^O01, HL7 version 2.5');
  requireValue(msh[10] === 'P', 'Processing ID must be P for this fixture');
  const id = msh[9], patient = pid[3]?.split('^')[0], accession = obr[2]?.split('^')[0], procedure = obr[4]?.split('^')[0];
  requireValue(id && patient && accession && procedure, 'Message ID, patient ID, order ID and procedure are required');
  requireValue([id,patient,accession,procedure].every(x=>/^[A-Za-z0-9._-]{1,64}$/.test(x)), 'Identifiers must use letters, numbers, dots, hyphens or underscores');
  return {id, patient, accession, procedure, raw: rows.map(x=>x.join('|')).join('\r')};
}
export const hospitalSeed = () => ({online:true, messages:[], queue:[], studies:[], audit:[]});
export function ingestOrder(state, raw) {
  let message;
  try { message = parseOrder(raw); } catch (e) { return audit(state, 'REJECTED', e.message); }
  const prior = [...state.messages,...state.queue].find(x=>x.id === message.id);
  if (prior) return audit(state, prior.raw === message.raw ? 'DUPLICATE_IGNORED' : 'ID_CONFLICT', message.id);
  if (state.messages.some(x=>x.accession === message.accession && (x.patient !== message.patient || x.procedure !== message.procedure))) return audit(state,'ORDER_CONFLICT',message.accession);
  const next = copy(state);
  (next.online ? next.messages : next.queue).push(message);
  return audit(next, next.online ? 'ACCEPTED_AA' : 'QUEUED_OFFLINE', message.id);
}
export function retryOrders(state) {
  requireValue(state.online, 'Restore the interface before retrying');
  let next = {...copy(state),queue:[]};
  for (const item of state.queue) next = ingestOrder(next,item.raw);
  return next;
}
export function attachStudy(state, patient, accession) {
  const order = state.messages.find(x=>x.accession === accession);
  requireValue(order, 'No accepted order for this accession');
  requireValue(order.patient === patient, 'Patient mismatch: association blocked');
  requireValue(!state.studies.some(x=>x.accession===accession), 'Study already associated');
  const next = {...copy(state), studies:[...state.studies,{patient,accession,modality:'DX',status:'associated'}]};
  return audit(next,'STUDY_ASSOCIATED',accession);
}

export const erpSeed = () => ({po:'PO-DEMO-104',sku:'RAD-WS',supplier:'Synthetic Supply',ordered:10,unitPrice:12500,currency:'MXN',opening:2,receipts:[],invoice:null,audit:[]});
export const received = state => state.receipts.reduce((a,x)=>a+x.quantity,0);
export function receiveGoods(state, quantity, reference) {
  const q = number(quantity,'Quantity',1);
  requireValue(Number.isInteger(q),'Whole units required');
  requireValue(reference?.trim(),'Receipt reference required');
  requireValue(!state.receipts.some(x=>x.reference===reference.trim()),'Duplicate receipt reference');
  requireValue(received(state)+q<=state.ordered,'Over-receipt blocked: exceeds purchase order');
  const next = {...copy(state),receipts:[...state.receipts,{quantity:q,reference:reference.trim()}]};
  return audit(next,'GOODS_RECEIVED',`${reference.trim()}: ${q} units`);
}
export function matchInvoice(state, quantity, price) {
  const q=number(quantity,'Invoice quantity',1), p=number(price,'Unit price',0.01);
  requireValue(Number.isInteger(q),'Whole units required');
  const reasons=[];
  if (q > received(state)) reasons.push('Invoice exceeds received quantity');
  if (q > state.ordered) reasons.push('Invoice exceeds ordered quantity');
  if (money(p)!==money(state.unitPrice)) reasons.push('Unit price differs from purchase order');
  const invoice={quantity:q,unitPrice:money(p),total:money(q*p),status:reasons.length?'ON_HOLD':'MATCHED',reasons};
  return audit({...copy(state),invoice},invoice.status, reasons.join('; ') || 'PO, receipt and invoice agree; approval still required');
}

export const crmSeed = () => ({leads:[],audit:[]});
export const stages = ['New','Qualified','Proposal','Won','Handover'];
export function addLead(state,input) {
  const email=String(input.email??'').trim().toLowerCase(), company=String(input.company??'').trim();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Valid email required');
  requireValue(company && company.length<=100,'Company required (max 100 characters)');
  requireValue(['Software','CRM & marketing','Document workflows'].includes(input.service),'Select a supported service');
  const prior=state.leads.find(x=>x.email===email);
  if(prior) return audit(state,'DUPLICATE_IGNORED',email);
  const value=number(input.value,'Opportunity value');
  const owner={'Software':'Software specialist','CRM & marketing':'CRM specialist','Document workflows':'Document specialist'}[input.service];
  const lead={id:`L-${state.leads.length+1}`,company,email,service:input.service,value,owner,stage:'New',discovery:false,scope:false,acceptance:false};
  return audit({...copy(state),leads:[...state.leads,lead]},'LEAD_CREATED',lead.id);
}
export function moveLead(state,id,checks={}) {
  const lead=state.leads.find(x=>x.id===id); requireValue(lead,'Lead not found');
  const nextLead={...lead,...Object.fromEntries(['discovery','scope','acceptance'].filter(k=>typeof checks[k]==='boolean').map(k=>[k,checks[k]]))};
  const index=stages.indexOf(lead.stage); requireValue(index<stages.length-1,'Handover already complete');
  if(index===0) requireValue(nextLead.discovery,'Discovery must be completed');
  if(index===1) requireValue(nextLead.scope,'Scope must be agreed before proposal');
  if(index>=2) requireValue(nextLead.acceptance,'Customer acceptance required');
  nextLead.stage=stages[index+1];
  return audit({...copy(state),leads:state.leads.map(x=>x.id===id?nextLead:x)},'STAGE_CHANGED',`${id}: ${nextLead.stage}`);
}

export const sampleDocument = 'Invoice: INV-DEMO-044\nSupplier: Synthetic Imaging Supplies\nPO: PO-DEMO-104\nQuantity: 10\nUnit price: 12500\nTotal: 125000\nCurrency: MXN';
export const documentSeed = () => ({document:null,audit:[]});
export function extractDocument(state,text) {
  requireValue(typeof text==='string' && text.length<=20000,'Text must contain fewer than 20,000 characters');
  const fields={}, flags=[];
  for(const line of text.split(/\r?\n/)){const match=line.match(/^([^:]+):\s*(.*)$/);if(match){const key=match[1].trim().toLowerCase();if(Object.hasOwn(fields,key))flags.push(`Duplicate field: ${key}`);fields[key]=match[2].trim();}}
  const names=['invoice','supplier','po','quantity','unit price','total','currency'];
  for(const key of names)if(!fields[key])flags.push(`Missing ${key}`);
  const quantity=Number(fields.quantity),price=Number(fields['unit price']),total=Number(fields.total);
  if(!Number.isInteger(quantity)||quantity<=0)flags.push('Quantity must be a positive integer');
  if(!Number.isFinite(price)||price<=0)flags.push('Invalid unit price');
  if(!Number.isFinite(total)||total<=0)flags.push('Invalid total');
  if(Number.isFinite(quantity*price)&&money(quantity*price)!==money(total))flags.push('Quantity × unit price does not equal total');
  if(fields.currency!=='MXN')flags.push('This scenario supports MXN only');
  if(fields.po!=='PO-DEMO-104')flags.push('Purchase order not found in demo master');
  const document={fields,flags,status:flags.length?'NEEDS_CORRECTION':'AWAITING_REVIEW',reviewer:null};
  return audit({...copy(state),document},'EXTRACTED',`${flags.length} exception(s); deterministic text parsing`);
}
export function approveDocument(state,reviewer,confirmed) {
  requireValue(state.document,'Extract a document first');
  requireValue(state.document.status!=='APPROVED','Document already approved');
  requireValue(state.document.flags.length===0,'Resolve validation exceptions before approving');
  requireValue(confirmed===true,'Explicit human review confirmation required');
  requireValue(reviewer?.trim() && reviewer.trim().length<=80,'Reviewer name required (max 80 characters)');
  return audit({...copy(state),document:{...state.document,status:'APPROVED',reviewer:reviewer.trim()}},'HUMAN_APPROVED',reviewer.trim());
}

export const releaseSeed = () => ({controls:[
  {id:'UAT',title:'User acceptance tests signed off',owner:'Business owner',complete:false,critical:true},
  {id:'DATA',title:'Migration totals reconciled',owner:'Data lead',complete:false,critical:true},
  {id:'ROLLBACK',title:'Rollback rehearsed and recovery agreed',owner:'Technical lead',complete:false,critical:true},
  {id:'TRAIN',title:'Users trained and support handover accepted',owner:'Service lead',complete:false,critical:true},
  {id:'COMMS',title:'Launch communication prepared',owner:'Project manager',complete:false,critical:false}
],audit:[]});
export function setControl(state,id,complete) {
  requireValue(state.controls.some(x=>x.id===id),'Unknown control'); requireValue(typeof complete==='boolean','Control status must be boolean');
  return audit({...copy(state),controls:state.controls.map(x=>x.id===id?{...x,complete}:x)},complete?'EVIDENCE_CONFIRMED':'CONTROL_REOPENED',id);
}
export function releaseDecision(state) {
  const blockers=state.controls.filter(x=>x.critical&&!x.complete), pending=state.controls.filter(x=>!x.complete);
  return {decision:blockers.length?'NO GO':pending.length?'CONDITIONAL GO':'GO',blockers,pending,readiness:Math.round(100*(state.controls.length-pending.length)/state.controls.length)};
}
