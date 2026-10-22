import {authDb,authFail,checkOrigin,createSession,digest,getSessionUser,limitAuth,logout,passwordHash,passwordMatches,verifySetup} from '../../../../lib/auth';
import {importOriginal} from '../../../../lib/initial-data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
async function handle(request:Request){try{
 const action=new URL(request.url).pathname.split('/').at(-1),db=authDb();
 if(request.method==='GET'&&action==='status'){const user=await getSessionUser(request);const initialized=await db.prepare("SELECT key FROM settings WHERE key='auth_initialized'").first();return json({user,setupRequired:!initialized});}
 if(request.method!=='POST')authFail('Método no permitido.',405);
 await checkOrigin(request);const text=await request.text();if(text.length>5000)authFail('Solicitud demasiado grande.',413);const b=JSON.parse(text),email=String(b.email||'').trim().toLowerCase();
 if(action==='logout')return json({ok:true},200,await logout(request));
 await limitAuth(request,email||action);
 if(action==='login'){
  const password=String(b.password||'');const account=await db.prepare('SELECT password_hash,disabled FROM credentials WHERE email=?').bind(email).first<{password_hash:string;disabled:number}>();
  const valid=await passwordMatches(password,account?.password_hash||null);if(!valid||!account||account.disabled)authFail('Correo o contraseña incorrectos.',401);
  return json({ok:true},200,await createSession(request,email));
 }
 if(action==='setup-info'){const owner=await verifySetup(String(b.key||''));return json({email:owner});}
 if(action==='import-initial'){await verifySetup(String(b.key||''));return json(await importOriginal('Sistema · carga inicial autorizada'));}
 if(action==='setup'){
  const owner=await verifySetup(String(b.key||''));if(email!==owner)authFail('Usa el correo de administración indicado en el enlace.',403);
  const name=String(b.name||'').trim().slice(0,100);if(name.length<2)authFail('Ingresa tu nombre.');const hash=await passwordHash(String(b.password||'')),tx=crypto.randomUUID(),now=new Date().toISOString();
  const result=await db.batch([
   db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('auth_initialized',?)").bind(tx),
   db.prepare("INSERT INTO app_users(email,name,role) SELECT ?,?,'admin' WHERE EXISTS(SELECT 1 FROM settings WHERE key='auth_initialized' AND value=?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role='admin'").bind(email,name,tx),
   db.prepare("INSERT INTO credentials(email,password_hash,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key='auth_initialized' AND value=?)").bind(email,hash,now,tx)
  ]);if(!result[0].meta.changes)authFail('La cuenta ya fue creada. Inicia sesión.',409);
  return json({ok:true},200,await createSession(request,email));
 }
 if(action==='invite-info'||action==='activate'){
  const token=String(b.key||'');if(!/^[a-f0-9]{64}$/.test(token))authFail('El enlace no es válido.',403);const tokenHash=await digest(token);
  const invite=await db.prepare('SELECT i.email,u.name FROM invitations i JOIN app_users u ON u.email=i.email WHERE i.token_hash=? AND i.consumed_by IS NULL AND i.expires_at>?').bind(tokenHash,Date.now()).first<{email:string;name:string}>();
  if(!invite)authFail('Este enlace expiró o ya se usó. Solicita uno nuevo a administración.',403);
  if(action==='invite-info')return json(invite);
  const hash=await passwordHash(String(b.password||'')),tx=crypto.randomUUID();
  const result=await db.batch([
   db.prepare('UPDATE invitations SET consumed_by=? WHERE token_hash=? AND consumed_by IS NULL AND expires_at>?').bind(tx,tokenHash,Date.now()),
   db.prepare('INSERT INTO credentials(email,password_hash,created_at,disabled) SELECT ?,?,?,0 WHERE EXISTS(SELECT 1 FROM invitations WHERE token_hash=? AND consumed_by=?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,disabled=0').bind(invite.email,hash,new Date().toISOString(),tokenHash,tx),
   db.prepare('DELETE FROM sessions WHERE email=? AND EXISTS(SELECT 1 FROM invitations WHERE token_hash=? AND consumed_by=?)').bind(invite.email,tokenHash,tx)
  ]);if(!result[0].meta.changes)authFail('El enlace ya fue utilizado.',409);
  return json({ok:true},200,await createSession(request,invite.email));
 }
 authFail('Ruta no encontrada.',404);
 }catch(e:any){if(!e.status)console.error('HSMI_SERVER_ERROR',{code:String(e.code||e.cause?.code||'UNKNOWN')});return json({error:e.status?e.message:'No fue posible completar la solicitud. Inténtalo nuevamente.'},e.status||500);}}
export const GET=handle;export const POST=handle;
