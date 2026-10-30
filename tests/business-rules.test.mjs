import test from 'node:test';
import assert from 'node:assert/strict';
import {copy,orderMessage,parseOrder,hospitalSeed,ingestOrder,retryOrders,attachStudy,erpSeed,received,receiveGoods,matchInvoice,crmSeed,addLead,moveLead,documentSeed,sampleDocument,extractDocument,approveDocument,releaseSeed,setControl,releaseDecision} from '../assets/business-rules.mjs';

test('Healthcare: supported message fields map to identifiers',()=>{
 assert.deepEqual({...parseOrder(orderMessage()),raw:undefined},{id:'MSG-1001',patient:'DEMO-001',accession:'ORD-1001',procedure:'XR-CHEST',raw:undefined});
});
test('Healthcare: invalid patient and repeated PID are rejected without state changes',()=>{
 const seed=hospitalSeed();const result=ingestOrder(seed,orderMessage('X',''));
 assert.equal(result.messages.length,0);assert.equal(result.audit[0].action,'REJECTED');assert.equal(seed.audit.length,0);
 assert.throws(()=>parseOrder(orderMessage()+'\nPID|1||OTHER'),/Exactly one PID/);
});
test('Healthcare: LF and CR versions are idempotent',()=>{
 const first=ingestOrder(hospitalSeed(),orderMessage());const second=ingestOrder(first,orderMessage().replaceAll('\n','\r'));
 assert.equal(second.messages.length,1);assert.equal(second.audit.at(-1).action,'DUPLICATE_IGNORED');
});
test('Healthcare: reused ID with changed patient is a conflict',()=>{
 const first=ingestOrder(hospitalSeed(),orderMessage());const second=ingestOrder(first,orderMessage('MSG-1001','OTHER'));
 assert.equal(second.audit.at(-1).action,'ID_CONFLICT');assert.equal(second.messages[0].patient,'DEMO-001');
});
test('Healthcare: same accession cannot silently change patient',()=>{
 const state=ingestOrder(ingestOrder(hospitalSeed(),orderMessage()),orderMessage('MSG-2','OTHER'));
 assert.equal(state.messages.length,1);assert.equal(state.audit.at(-1).action,'ORDER_CONFLICT');
});
test('Healthcare: offline queue deduplicates and recovers once',()=>{
 let state=ingestOrder({...hospitalSeed(),online:false},orderMessage());state=ingestOrder(state,orderMessage());
 assert.equal(state.queue.length,1);assert.throws(()=>retryOrders(state),/Restore/);
 state=retryOrders({...state,online:true});assert.equal(state.queue.length,0);assert.equal(state.messages.length,1);
 assert.equal(retryOrders(state).messages.length,1);
});
test('Healthcare: association requires existing order and matching patient',()=>{
 const state=ingestOrder(hospitalSeed(),orderMessage());
 assert.throws(()=>attachStudy(state,'OTHER','ORD-1001'),/Patient mismatch/);
 assert.throws(()=>attachStudy(state,'DEMO-001','MISSING'),/No accepted/);
 const done=attachStudy(state,'DEMO-001','ORD-1001');assert.equal(done.studies.length,1);
 assert.throws(()=>attachStudy(done,'DEMO-001','ORD-1001'),/already/);
});
test('Healthcare: unsupported message type and identifiers are rejected',()=>{
 assert.throws(()=>parseOrder(orderMessage().replace('ORM^O01','ADT^A01')),/Supported subset/);
 assert.throws(()=>parseOrder(orderMessage('MSG<script>')),/Identifiers/);
});
test('ERP: partial receipts update stock evidence without mutating inputs',()=>{
 const seed=erpSeed(), first=receiveGoods(seed,6,'GRN-1');assert.equal(received(first),6);assert.equal(received(seed),0);
 assert.equal(received(receiveGoods(first,4,'GRN-2')),10);
});
test('ERP: duplicate receipt, over-receipt, fractional and invalid values blocked',()=>{
 const first=receiveGoods(erpSeed(),6,'GRN-1');
 assert.throws(()=>receiveGoods(first,1,'GRN-1'),/Duplicate/);
 assert.throws(()=>receiveGoods(first,5,'GRN-2'),/Over-receipt/);
 for(const quantity of [-1,0,1.2,Infinity,NaN,''])assert.throws(()=>receiveGoods(first,quantity,'NEW'));
});
test('ERP: invoice quantity cannot exceed receipt, and price must match',()=>{
 const first=receiveGoods(erpSeed(),6,'GRN-1');
 const held=matchInvoice(first,10,12500);assert.equal(held.invoice.status,'ON_HOLD');assert.match(held.invoice.reasons[0],/received/);
 const price=matchInvoice(first,6,13000);assert.equal(price.invoice.status,'ON_HOLD');
 const matched=matchInvoice(receiveGoods(first,4,'GRN-2'),10,12500);assert.equal(matched.invoice.status,'MATCHED');assert.equal(matched.invoice.total,125000);
});
test('ERP: zero, negative and nonfinite invoice amounts cannot match',()=>{
 for(const price of [0,-1,Infinity,NaN,''])assert.throws(()=>matchInvoice(erpSeed(),1,price));
});
const lead={company:'Fictional Org',email:' BUYER@example.org ',service:'Software',value:50000};
test('Commercial: normalizes unique contact and routes by specialty',()=>{
 const first=addLead(crmSeed(),lead), replay=addLead(first,{...lead,email:'buyer@example.org'});
 assert.equal(replay.leads.length,1);assert.equal(replay.audit.at(-1).action,'DUPLICATE_IGNORED');assert.equal(first.leads[0].owner,'Software specialist');
});
test('Commercial: stage gates require discovery, scope and acceptance',()=>{
 let state=addLead(crmSeed(),lead);assert.throws(()=>moveLead(state,'L-1'),/Discovery/);
 state=moveLead(state,'L-1',{discovery:true});assert.equal(state.leads[0].stage,'Qualified');
 assert.throws(()=>moveLead(state,'L-1'),/Scope/);state=moveLead(state,'L-1',{scope:true});
 assert.throws(()=>moveLead(state,'L-1'),/acceptance/);state=moveLead(state,'L-1',{acceptance:true});
 state=moveLead(state,'L-1');assert.equal(state.leads[0].stage,'Handover');assert.throws(()=>moveLead(state,'L-1'),/already/);
});
test('Commercial: arbitrary input cannot replace stage, value or owner',()=>{
 let state=addLead(crmSeed(),lead);state=moveLead(state,'L-1',{discovery:true,stage:'Handover',value:1,owner:'X'});
 assert.equal(state.leads[0].stage,'Qualified');assert.equal(state.leads[0].value,50000);assert.equal(state.leads[0].owner,'Software specialist');
});
test('Commercial: malformed lead fields are rejected',()=>{
 for(const changes of [{email:'bad'},{company:''},{service:'Unknown'},{value:-1},{value:Infinity}])assert.throws(()=>addLead(crmSeed(),{...lead,...changes}));
});
test('Documents: valid invoice awaits human review and approval is traceable',()=>{
 let state=extractDocument(documentSeed(),sampleDocument);assert.equal(state.document.flags.length,0);assert.equal(state.document.status,'AWAITING_REVIEW');
 assert.throws(()=>approveDocument(state,'Reviewer',false),/confirmation/);assert.throws(()=>approveDocument(state,'',true),/Reviewer/);
 state=approveDocument(state,'Demo reviewer',true);assert.equal(state.document.status,'APPROVED');assert.equal(state.audit.at(-1).action,'HUMAN_APPROVED');
 assert.throws(()=>approveDocument(state,'Demo reviewer',true),/already/);
});
test('Documents: arithmetic error blocks approval until corrected',()=>{
 const broken=extractDocument(documentSeed(),sampleDocument.replace('125000','99999'));
 assert.ok(broken.document.flags.some(x=>x.includes('does not equal')));assert.throws(()=>approveDocument(broken,'Reviewer',true),/exceptions/);
 const fixed=extractDocument(broken,sampleDocument);assert.equal(fixed.document.status,'AWAITING_REVIEW');assert.equal(fixed.document.reviewer,null);
});
test('Documents: duplicate labels, missing data, unknown PO and currency flagged',()=>{
 const fixtures=[sampleDocument+'\nTotal: 125000',sampleDocument.replace('Supplier: Synthetic Imaging Supplies',''),sampleDocument.replace('PO-DEMO-104','PO-OTHER'),sampleDocument.replace('MXN','USD'),sampleDocument.replace('Quantity: 10','Quantity: -1')];
 for(const text of fixtures)assert.ok(extractDocument(documentSeed(),text).document.flags.length>0);
});
test('Documents: replacement extraction invalidates prior human approval',()=>{
 const state=approveDocument(extractDocument(documentSeed(),sampleDocument),'Reviewer',true);
 assert.equal(extractDocument(state,sampleDocument).document.status,'AWAITING_REVIEW');
});
test('Release: critical gates, advisory action and reopen work end to end',()=>{
 let state=releaseSeed();assert.equal(releaseDecision(state).decision,'NO GO');
 for(const c of state.controls.filter(x=>x.critical))state=setControl(state,c.id,true);
 assert.equal(releaseDecision(state).decision,'CONDITIONAL GO');assert.equal(releaseDecision(state).readiness,80);
 state=setControl(state,'COMMS',true);assert.equal(releaseDecision(state).decision,'GO');
 state=setControl(state,'ROLLBACK',false);assert.equal(releaseDecision(state).decision,'NO GO');
});
test('Release: unknown control and nonboolean evidence rejected without mutation',()=>{
 const state=releaseSeed(),before=copy(state);assert.throws(()=>setControl(state,'MISSING',true));assert.throws(()=>setControl(state,'UAT','yes'));assert.deepEqual(state,before);
});
