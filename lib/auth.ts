import {getDatabase} from './database';
import bcrypt from 'bcryptjs';
import type {AppUser} from './domain';
export function authDb(){return getDatabase();}
export function authFail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password:string){if(password.length<12||bcrypt.truncates(password))authFail('Usa una contraseña de al menos 12 caracteres y máximo 72 bytes.');return bcrypt.hash(password,12);}
const dummyHash='$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
export async function passwordMatches(password:string,stored:string|null){if(password.length>128||bcrypt.truncates(password))return false;return bcrypt.compare(password,stored||dummyHash);}
function cookieName(request:Request){return new URL(request.url).protocol==='https:'?'__Host-hsmi_session':'hsmi_session';}
export function sessionCookie(request:Request,token:string,maxAge=28800){return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function sessionToken(request:Request){const name=cookieName(request)+'=';return (request.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(name))?.slice(name.length)||'';}
export async function getSessionUser(request:Request):Promise<AppUser|null>{const token=sessionToken(request);if(!/^[a-f0-9]{64}$/.test(token))return null;return authDb().prepare('SELECT u.email,u.name,u.role FROM sessions s JOIN app_users u ON u.email=s.email JOIN credentials c ON c.email=u.email WHERE s.token_hash=? AND s.expires_at>? AND c.disabled=0').bind(await digest(token),Date.now()).first<AppUser>();}
export async function requireUser(request:Request){const user=await getSessionUser(request);if(!user)authFail('Inicia sesión con tu correo y contraseña.',401);return user;}
export async function createSession(request:Request,email:string){const token=randomToken();await authDb().prepare('INSERT INTO sessions(token_hash,email,expires_at) VALUES(?,?,?)').bind(await digest(token),email,Date.now()+8*60*60*1000).run();await authDb().prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run();return sessionCookie(request,token);}
export async function logout(request:Request){const token=sessionToken(request);if(token)await authDb().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return sessionCookie(request,'',0);}
export async function checkOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)authFail('Solicitud no autorizada.',403);}
export async function limitAuth(request:Request,email=''){
 const ip=(process.env.VERCEL?request.headers.get('x-vercel-forwarded-for'):request.headers.get('cf-connecting-ip'))||'local';const now=Date.now(),until=now+15*60*1000;
 const keys=[await digest('ip:'+ip),await digest('email:'+email.toLowerCase())];
 for(let i=0;i<keys.length;i++){
  await authDb().prepare('INSERT INTO auth_limits AS current_limit(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN current_limit.expires_at<? THEN 1 ELSE current_limit.attempts+1 END,expires_at=CASE WHEN current_limit.expires_at<? THEN excluded.expires_at ELSE current_limit.expires_at END').bind(keys[i],until,now,now).run();
  const v=await authDb().prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(keys[i]).first<{attempts:number}>();if(v!.attempts>(i===0?60:10))authFail('Demasiados intentos. Vuelve a intentarlo en 15 minutos.',429);
 }
}
export async function verifySetup(key:string){
 if(!process.env.HSMI_SETUP_HASH||!process.env.HSMI_OWNER_EMAIL)authFail('La activación inicial aún no está configurada.',503);
 if(!/^[a-f0-9]{64}$/.test(key)||await digest(key)!==process.env.HSMI_SETUP_HASH)authFail('El enlace de activación no es válido.',403);
 const initialized=await authDb().prepare("SELECT key FROM settings WHERE key='auth_initialized'").first();if(initialized)authFail('La cuenta de administración ya está creada. Ingresa con tu correo y contraseña.',409);
 return process.env.HSMI_OWNER_EMAIL.toLowerCase();
}
export async function createInvite(email:string,base:string){const token=randomToken();await authDb().batch([
 authDb().prepare('DELETE FROM invitations WHERE email=?').bind(email),
 authDb().prepare('INSERT INTO invitations(token_hash,email,expires_at) VALUES(?,?,?)').bind(await digest(token),email,Date.now()+48*60*60*1000)
 ]);return base+'/#activar='+token;}
