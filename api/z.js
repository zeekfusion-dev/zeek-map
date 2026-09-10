import crypto from 'node:crypto';
import {db,rpc,configuration} from '../server/db.mjs';
import {session,requireUser,requireAdmin,sameOrigin,setCookie,cookie,hash,apiError} from '../server/auth.mjs';
import {BROADCASTER,validConfig,normalizeAnswer,cents} from '../server/domain.mjs';
import {tick} from '../server/kick.mjs';
const uuid=x=>{if(typeof x!=='string'||!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x))throw Object.assign(new Error('Invalid request ID.'),{status:400});return x;};
const text=(x,max=300)=>String(x||'').trim().slice(0,max);
export const config={maxDuration:60};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(req.method==='GET'){
  if(req.query.admin==='1'){await requireAdmin(req);const [settings,runtime,bot,questions,rewards,redemptions,tickets,log,failures,giveaways]=await Promise.all([configuration(),db('z_runtime?id=eq.1'),db('z_bot?id=eq.1&select=updated_at'),db('z_questions?order=id.asc'),db('z_rewards?order=created_at.desc'),db('z_redemptions?order=created_at.desc&limit=100'),db('z_conversion_tickets?order=created_at.desc&limit=100'),db('z_admin_log?order=id.desc&limit=50'),db('z_outbox?status=in.(failed,sending)&order=created_at.desc&limit=10&select=id,content,status,created_at'),db('z_giveaways?order=created_at.desc')]);return res.json({settings,runtime:runtime[0],botConnected:bot.length>0,questions,rewards,redemptions,tickets,log,failures,giveaways});}
  const u=await session(req);const [settings,runtime,leaderboard,rounds,rewards,feed,giveaways]=await Promise.all([configuration(),db('z_runtime?id=eq.1&select=is_live,next_question_at,checked_at'),db('z_users?select=username,zs_balance,lifetime_zs&order=lifetime_zs.desc,username.asc&limit=50'),db('z_rounds?status=in.(open,won,expired)&select=id,question,reward,status,opened_at,expires_at,winner_username&order=created_at.desc&limit=1'),db('z_rewards?enabled=eq.true&select=id,title,description,cost,stock&order=created_at.desc'),db('z_transactions?amount=gt.0&select=amount,reason,created_at,z_users(username)&order=created_at.desc&limit=15'),db('z_giveaways?status=in.(open,drawn)&select=id,title,description,closes_at,status,winner_username&order=created_at.desc')]);
  let me=null;if(u){const [balance,history,redemptions,tickets,entries]=await Promise.all([db(`z_users?kick_user_id=eq.${u.kick_user_id}&select=zs_balance,lifetime_zs`),db(`z_transactions?kick_user_id=eq.${u.kick_user_id}&select=amount,reason,created_at&order=created_at.desc&limit=30`),db(`z_redemptions?kick_user_id=eq.${u.kick_user_id}&select=id,title,cost,status,created_at&order=created_at.desc&limit=30`),db(`z_conversion_tickets?kick_user_id=eq.${u.kick_user_id}&select=id,points,zs,status,created_at&order=created_at.desc&limit=10`),db(`z_giveaway_entries?kick_user_id=eq.${u.kick_user_id}&select=giveaway_id`)]);me={username:u.username,isAdmin:Number(u.kick_user_id)===BROADCASTER,...(balance[0]||{zs_balance:0,lifetime_zs:0}),history,redemptions,tickets,entries};}
  return res.json({settings,runtime:runtime[0],leaderboard,round:rounds[0]||null,rewards,feed,giveaways,me,serverTime:new Date().toISOString()});
 }
 if(req.method!=='POST')return res.status(405).end();sameOrigin(req);
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};const u=await requireUser(req);let result;
 if(b.action==='logout'){await db(`z_sessions?token_hash=eq.${hash(cookie(req,'z_session'))}`,{method:'DELETE'});setCookie(res,'z_session','',0);return res.json({ok:true});}
 if(b.action==='redeem')result=await rpc('z_redeem',{p_user:u.kick_user_id,p_name:u.username,p_reward:uuid(b.rewardId),p_request:uuid(b.requestId)});
 else if(b.action==='convert'){if(!Number.isSafeInteger(b.points))throw Object.assign(new Error('Enter a whole number of BotRix points.'),{status:400});result=await rpc('z_conversion',{p_user:u.kick_user_id,p_name:u.username,p_points:b.points,p_id:uuid(b.requestId)});}
 else if(b.action==='enter')result=await rpc('z_enter_giveaway',{p_id:uuid(b.id),p_user:u.kick_user_id,p_name:u.username});
 else{await requireAdmin(req);
  if(b.action==='settings'){let settings;try{settings=validConfig(b.settings);}catch(e){e.status=400;throw e;}await db('z_config?id=eq.1',{method:'PATCH',body:{settings}});await db('z_admin_log',{method:'POST',body:{actor:u.kick_user_id,action:'settings',details:settings}});}
  else if(b.action==='question'){const q=text(b.question,260),answers=String(b.answers||'').split('|').map(normalizeAnswer).filter(Boolean);if(!q||!answers.length||answers.length>20)throw Object.assign(new Error('Enter a question and at least one answer.'),{status:400});const record={question:q,answers,category:text(b.category,40)||'General',enabled:b.enabled!==false};if(b.id){if(!Number.isSafeInteger(b.id))throw new Error('Invalid question');await db(`z_questions?id=eq.${b.id}`,{method:'PATCH',body:record});}else await db('z_questions',{method:'POST',body:record});}
  else if(b.action==='reward'){cents(b.cost);if(Number(b.cost)<=0||!text(b.title,80)||(b.stock!==null&&(!Number.isInteger(b.stock)||b.stock<0)))throw Object.assign(new Error('Enter a title, positive cost, and valid stock.'),{status:400});const r={title:text(b.title,80),description:text(b.description,500),cost:Number(b.cost),stock:b.stock,enabled:b.enabled===true};await db(b.id?`z_rewards?id=eq.${uuid(b.id)}`:'z_rewards',{method:b.id?'PATCH':'POST',body:r});}
  else if(b.action==='redemption')await rpc('z_resolve_redemption',{p_id:uuid(b.id),p_status:b.status,p_actor:u.kick_user_id});
  else if(b.action==='conversion')await rpc('z_resolve_conversion',{p_id:uuid(b.id),p_status:b.status,p_proof:text(b.proof,500),p_actor:u.kick_user_id});
  else if(b.action==='adjust'){cents(b.amount);if(!Number.isSafeInteger(b.userId)||b.userId<=0||!text(b.username,100))throw Object.assign(new Error('Enter a Kick user ID and username.'),{status:400});result=await rpc('z_admin_adjust',{p_actor:u.kick_user_id,p_user:b.userId,p_name:text(b.username,100),p_amount:Number(b.amount),p_reason:text(b.reason),p_id:uuid(b.requestId)});}
  else if(b.action==='tick')result=await tick();
  else if(b.action==='giveaway'){if(!text(b.title,100)||!Number.isFinite(Date.parse(b.closesAt))||Date.parse(b.closesAt)<=Date.now())throw Object.assign(new Error('Enter a title and future closing time.'),{status:400});await db('z_giveaways',{method:'POST',body:{title:text(b.title,100),description:text(b.description,1000),closes_at:new Date(b.closesAt).toISOString(),status:b.enabled?'open':'draft'}});}
  else if(b.action==='publish-giveaway'){await db(`z_giveaways?id=eq.${uuid(b.id)}&status=eq.draft&closes_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'PATCH',body:{status:'open'}});}
  else if(b.action==='draw'){const id=uuid(b.id);const count=Number(await rpc('z_giveaway_count',{p_id:id}));if(!count)throw Object.assign(new Error('There are no entries.'),{status:400});result=await rpc('z_draw_giveaway',{p_id:id,p_actor:u.kick_user_id,p_index:crypto.randomInt(count)});}
  else throw Object.assign(new Error('Unknown action.'),{status:400});
 }
 return res.json({ok:true,result});
 }catch(e){return apiError(res,e);}}
