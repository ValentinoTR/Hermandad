import {getDatabase} from '../../../lib/database';
import {requireUser,createInvite} from '../../../lib/auth';
import {importOriginal} from '../../../lib/initial-data';
import catalog from '../../../data/catalog.json';
import {readFile} from 'node:fs/promises';
import pathModule from 'node:path';
import {paymentReceipt} from '../../../lib/receipt.mjs';
import {applyPayment,getObligation,paidAmount,type Member,type Concept,type AppUser,type State} from '../../../lib/domain';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function db(){return getDatabase();}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
function txt(v:unknown,max=250){return String(v??'').trim().slice(0,max);}
async function log(actor:string,action:string,memberId:string|null,detail:unknown){await db().prepare('INSERT INTO audit(id,at,actor,action,member_id,detail) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),new Date().toISOString(),actor,action,memberId,JSON.stringify(detail)).run();}
async function concept(id:string){const c=await db().prepare('SELECT * FROM concepts WHERE id=?').bind(id).first<Concept>();if(!c)fail('El concepto no existe.',404);return c;}
async function member(id:string){const r=await db().prepare('SELECT * FROM members WHERE id=?').bind(id).first<any>();if(!r)fail('El integrante no existe.',404);return {id:r.id,name:r.name,group:r.group_name,revision:r.revision,data:JSON.parse(r.data)} as Member;}
async function save(m:Member,expected:number,actor:string,action:string,detail:unknown,mutationId:string){
 const results=await db().batch([
  db().prepare('UPDATE members SET name=?,group_name=?,data=?,revision=revision+1,last_mutation=? WHERE id=? AND revision=?').bind(m.name,m.group,JSON.stringify(m.data),mutationId,m.id,expected),
  db().prepare('INSERT OR IGNORE INTO audit(id,at,actor,action,member_id,detail) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM members WHERE id=? AND revision=? AND last_mutation=?)').bind(mutationId,new Date().toISOString(),actor,action,m.id,JSON.stringify(detail),m.id,expected+1,mutationId)
 ]);
 if(!results[0].meta.changes)fail('Otra persona actualizó este registro. Actualiza el padrón y vuelve a intentarlo.',409);
 return json({ok:true});
}
async function handle(request:Request){try{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,''),isWrite=request.method==='POST';
 if(isWrite&&request.headers.get('origin')!==url.origin)fail('Solicitud no autorizada.',403);
 const user=await requireUser(request);
 if(request.method==='GET'){
  if(path==='changes'){const row=await db().prepare('SELECT id FROM audit ORDER BY at DESC,id DESC LIMIT 1').first<{id:string}>();return json({id:row?.id||''});}
  if(path==='receipt'){
   const m=await member(txt(url.searchParams.get('memberId'))),payment=m.data.payments.find(p=>p.id===txt(url.searchParams.get('paymentId'),100));
   if(!payment)fail('El pago no existe.',404);
   const c=await concept(payment.conceptId);
   const bytes=await paymentReceipt({member:m,concept:c,payment,logo:await readFile(pathModule.join(process.cwd(),'public','hsmi-emblema.png'))});
   const name='HSMI-comprobante-'+payment.id.replace(/[^a-zA-Z0-9-]/g,'')+'.pdf';
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='state'){
   const [m,c,a,meta,u]=await Promise.all([
    db().prepare('SELECT * FROM members ORDER BY name COLLATE NOCASE').all<any>(),db().prepare('SELECT * FROM concepts ORDER BY year,id').all<Concept>(),
    db().prepare('SELECT * FROM audit ORDER BY at DESC,id DESC LIMIT 100').all<any>(),db().prepare("SELECT value FROM settings WHERE key='import'").first<{value:string}>(),
    user.role==='admin'?db().prepare('SELECT email,name,role FROM app_users ORDER BY name').all<AppUser>():Promise.resolve({results:[]})
   ]);
   return json({members:m.results.map(r=>({id:r.id,name:r.name,group:r.group_name,revision:r.revision,data:JSON.parse(r.data)})),concepts:c.results,audit:a.results.map(r=>({...r,detail:JSON.parse(r.detail)})),importInfo:meta?JSON.parse(meta.value):null,seedCount:catalog.count,user,users:u.results});
  }
  if(path==='backup'){
   if(user.role!=='admin')fail('Solo administración puede descargar el respaldo completo.',403);
   const [m,c,a,s]=await Promise.all(['members','concepts','audit','settings'].map(t=>db().prepare(`SELECT * FROM ${t}`).all()));
   return new Response(JSON.stringify({format:'hsmi-backup-v1',exportedAt:new Date().toISOString(),members:m.results,concepts:c.results,audit:a.results,settings:s.results},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="hsmi-respaldo.json"','Cache-Control':'no-store'}});
  }
  fail('Ruta no encontrada.',404);
 }
 if(!isWrite)fail('Método no permitido.',405);
 if(user.role==='viewer')fail('Tu cuenta tiene acceso de consulta.',403);
 const length=Number(request.headers.get('content-length')||0);if(length>100000)fail('Solicitud demasiado grande.',413);
 const b=await request.json() as any;
 if(path==='import'){
  if(user.role!=='admin')fail('Solo administración puede importar el padrón.',403);
  return json(await importOriginal(user.email));
 }
 if(path==='members'){
  const name=txt(b.name,160),group=txt(b.group,80);if(name.length<3||!group)fail('Completa el nombre y la cuadrilla o grupo.');
  if(b.id){const m=await member(txt(b.id));const before={name:m.name,group:m.group};m.name=name;m.group=group;return await save(m,Number(b.revision),user.email,'Edición de integrante',{before,after:{name,group}},crypto.randomUUID());}
  const id='HSMI-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const cs=(await db().prepare('SELECT * FROM concepts').all<Concept>()).results;
  const joinYear=Number(b.joinYear);if(!Number.isInteger(joinYear)||joinYear<1900||joinYear>2200)fail('Ingresa un año de ingreso válido.');
  const obligations=Object.fromEntries(cs.map(c=>[c.id,{state:c.year<joinYear?'na':'review',amountCents:c.amount,reason:c.year<joinYear?`Anterior al año de ingreso (${joinYear})`:'',historical:false}]));
  const data={obligations,payments:[],sourceNote:txt(b.note,1000)};
  const mid=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO members(id,name,group_name,data,revision) VALUES(?,?,?,?,0)').bind(id,name,group,JSON.stringify(data)),db().prepare('INSERT INTO audit(id,at,actor,action,member_id,detail) VALUES(?,?,?,?,?,?)').bind(mid,new Date().toISOString(),user.email,'Nuevo integrante',id,JSON.stringify({name,group,joinYear}))]);return json({ok:true,id});
 }
 if(path==='concepts'){
  if(user.role!=='admin')fail('Solo administración puede crear conceptos.',403);
  const name=txt(b.name,80),year=Number(b.year),amount=b.amountCents===null||b.amountCents===''?null:Number(b.amountCents);
  if(!name||!Number.isInteger(year)||year<1900||year>2200||(amount!==null&&(!Number.isSafeInteger(amount)||amount<=0)))fail('Revisa el concepto, año e importe.');
  const exists=await db().prepare('SELECT id FROM concepts WHERE year=? AND lower(name)=lower(?)').bind(year,name).first();if(exists)fail('Ese concepto ya existe en el año seleccionado.');
  const id=crypto.randomUUID();await db().prepare('INSERT INTO concepts(id,year,name,amount) VALUES(?,?,?,?)').bind(id,year,name,amount).run();await log(user.email,'Nuevo concepto',null,{id,name,year,amount});return json({ok:true});
 }
 if(path==='users'){
  if(user.role!=='admin')fail('Solo administración puede gestionar permisos.',403);
  const email=txt(b.email).toLowerCase(),name=txt(b.name,100),role=txt(b.role);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!['admin','treasurer','viewer'].includes(role))fail('Revisa los datos del usuario.');
  if(email===user.email&&role!=='admin')fail('Conserva tu acceso de administración.');
  await db().prepare('INSERT INTO app_users(email,name,role) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role').bind(email,name,role).run();await log(user.email,'Permisos de usuario',null,{email,name,role});return json({ok:true,activationUrl:await createInvite(email,new URL(request.url).origin)});
 }
 if(['payment','obligation','void-payment'].includes(path)){
  const m=await member(txt(b.memberId));const revision=Number(b.revision);if(!Number.isInteger(revision))fail('Actualiza el registro antes de guardar.');
  const requestId=txt(b.requestId,100)||crypto.randomUUID();
  if(path==='payment'){
   if(m.data.payments.some(p=>p.id===requestId))return json({ok:true,alreadySaved:true,memberId:m.id,paymentId:requestId});
   const c=await concept(txt(b.conceptId));const date=txt(b.date,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Ingresa una fecha válida.');
   const method=txt(b.method,40);if(!['Efectivo','Transferencia','Yape','Plin','Otro'].includes(method))fail('Selecciona un medio de pago.');
   const p={id:requestId,conceptId:c.id,date,amountCents:Number(b.amountCents),method,receipt:txt(b.receipt,150),note:txt(b.note,1000),actor:user.email,recordedAt:new Date().toISOString(),receiptSnapshot:{memberName:m.name,memberCode:m.id,group:m.group,conceptName:c.name,conceptYear:c.year,actorName:user.name}};
   applyPayment(m,c,p,Number(b.expectedCents));await save(m,revision,user.email,'Pago registrado',{...p,concept:`${c.name} ${c.year}`},requestId);return json({ok:true,memberId:m.id,paymentId:p.id});
  }
  if(path==='obligation'){
   const c=await concept(txt(b.conceptId)),before=getObligation(m,c),state=txt(b.state) as State,reason=txt(b.reason,1000);
   if(!['paid','na','pending','review'].includes(state)||reason.length<4)fail('Selecciona un estado y explica el motivo del cambio.');
   if(paidAmount(m,c.id)>0)fail('Este concepto tiene pagos registrados. Anula los pagos con un motivo antes de corregir su estado.');
   const amount=b.amountCents===null||b.amountCents===''?null:Number(b.amountCents);if(amount!==null&&(!Number.isSafeInteger(amount)||amount<=0))fail('El importe debe ser mayor que cero.');
   m.data.obligations[c.id]={...before,state,amountCents:amount,reason,historical:before.historical};
   return await save(m,revision,user.email,'Estado actualizado',{concept:`${c.name} ${c.year}`,before,after:m.data.obligations[c.id]},requestId);
  }
  const p=m.data.payments.find(p=>p.id===b.paymentId);if(!p||p.voidReason)fail('El pago no existe o ya está anulado.');
  const reason=txt(b.reason,1000);if(reason.length<4)fail('Indica el motivo de la anulación.');p.voidReason=reason;
  const c=await concept(p.conceptId),o=getObligation(m,c),total=paidAmount(m,c.id);
  m.data.obligations[c.id]={...o,state:total===0?'pending':o.amountCents!==null&&total>=o.amountCents?'paid':'partial'};
  return await save(m,revision,user.email,'Pago anulado',{paymentId:p.id,reason,concept:`${c.name} ${c.year}`},requestId);
 }
 fail('Ruta no encontrada.',404);
 }catch(e:any){console.error('HSMI API',e.message);return json({error:e.status||!e.message?.includes('D1')?e.message:'No fue posible guardar. Inténtalo nuevamente.'},e.status||400);}}
export const GET=handle;
export const POST=handle;
