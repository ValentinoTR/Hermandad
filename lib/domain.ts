export type State = 'paid'|'na'|'pending'|'review'|'partial';
export type Obligation = {state:State;amountCents:number|null;reason:string;sourceCode?:string;historical?:boolean};
export type Payment = {id:string;conceptId:string;date:string;amountCents:number;method:string;receipt:string;note:string;actor:string;voidReason?:string;recordedAt?:string;receiptSnapshot?:{memberName:string;memberCode:string;group:string;conceptName:string;conceptYear:number;actorName:string}};
export type Member = {id:string;name:string;group:string;revision:number;data:{sourceRow?:number;sourceItem?:string;sourceNote?:string;duplicate?:boolean;obligations:Record<string,Obligation>;payments:Payment[]}};
export type Concept = {id:string;year:number;name:string;amount:number|null};
export type AppUser = {email:string;name:string;role:'admin'|'treasurer'|'viewer'};
export const stateNames:Record<State,string>={paid:'Pagado',na:'No aplica',pending:'Pendiente',review:'Por revisar',partial:'Abono parcial'};
export function getObligation(m:Member,c:Concept):Obligation {return m.data.obligations[c.id]||{state:'review',amountCents:c.amount,reason:''};}
export function paidAmount(m:Member,conceptId:string){return m.data.payments.filter(p=>p.conceptId===conceptId&&!p.voidReason).reduce((s,p)=>s+p.amountCents,0);}
export function condition(m:Member,concepts:Concept[],year:number,scope='cumulative'){
 const selected=concepts.filter(c=>scope==='annual'?c.year===year:c.year<=year);
 const obligations=selected.map(c=>getObligation(m,c));
 if(!obligations.length) return 'Por revisar';
 if(obligations.some(o=>o.state==='pending'||o.state==='partial'))return 'Inactivo';
 if(obligations.some(o=>o.state==='review'))return 'Por revisar';
 if(obligations.every(o=>o.state==='na'))return 'Sin obligaciones';
 return 'Activo';
}
export function money(cents:number){return new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(cents/100);}
export function plain(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
export function applyPayment(m:Member,c:Concept,p:Payment,amountCents:number){
 const o=getObligation(m,c);if(o.state==='na'||o.state==='paid')throw new Error('Este concepto ya está pagado o no aplica. Revisa su estado antes de registrar otro pago.');
 if(!Number.isSafeInteger(p.amountCents)||p.amountCents<=0||!Number.isSafeInteger(amountCents)||amountCents<=0)throw new Error('Ingresa importes válidos mayores que cero.');
 const total=paidAmount(m,c.id)+p.amountCents;if(total>amountCents)throw new Error('El pago supera el saldo pendiente.');
 m.data.payments.push(p);m.data.obligations[c.id]={...o,amountCents,state:total===amountCents?'paid':'partial',historical:false};
}
