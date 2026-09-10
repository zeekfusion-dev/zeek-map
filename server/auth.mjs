import crypto from 'node:crypto';
import {db} from './db.mjs';
import {BROADCASTER} from './domain.mjs';
export const site=()=>new URL(process.env.KICK_REDIRECT_URI||'https://www.zeekfusion.com/api/kick/callback').origin;
export const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
export function cookie(req,name){const part=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`));return part?decodeURIComponent(part.slice(name.length+1)):null;}
export function setCookie(res,name,value,seconds){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`);}
function encryptionKey(){if(!process.env.KICK_CLIENT_SECRET)throw new Error('Kick connection is not configured.');return crypto.createHash('sha256').update('zeek-vault-v1:'+process.env.KICK_CLIENT_SECRET).digest();}
export function seal(data){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);const body=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
export function unseal(data){const buf=Buffer.from(data,'base64url');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),buf.subarray(0,12));decipher.setAuthTag(buf.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)),decipher.final()]).toString());}
export async function session(req){const token=cookie(req,'z_session');if(!token)return null;return (await db(`z_sessions?token_hash=eq.${hash(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=kick_user_id,username`))[0]||null;}
export function sameOrigin(req){if(req.headers.origin!==site())throw Object.assign(new Error('Please use the ZeekFusion website.'),{status:403});}
export async function requireUser(req){const u=await session(req);if(!u)throw Object.assign(new Error('Log in with Kick first.'),{status:401});return u;}
export async function requireAdmin(req){const u=await requireUser(req);if(Number(u.kick_user_id)!==BROADCASTER)throw Object.assign(new Error('Owner access required.'),{status:403});return u;}
export async function createSession(res,user){const token=crypto.randomBytes(32).toString('base64url');await db('z_sessions',{method:'POST',body:{token_hash:hash(token),kick_user_id:user.user_id,username:user.name,expires_at:new Date(Date.now()+7*86400000).toISOString()}});setCookie(res,'z_session',token,7*86400);}
export function apiError(res,e){console.error(e.message);return res.status(e.status||500).json({error:e.status?e.message:'Unable to complete this request. Please try again.'});}
