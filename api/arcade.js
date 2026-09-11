import {db,rpc} from '../server/db.mjs';
import {session,requireUser,sameOrigin,apiError} from '../server/auth.mjs';
import {wager,plinkoResult,coinResult,multipliers} from '../server/arcade.mjs';
const id=x=>{if(typeof x!=='string'||!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x))throw Object.assign(new Error('Invalid request.'),{status:400});return x;};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(req.method==='GET'){
  if(req.query?.leaderboardOffset!==undefined){const offset=Number(req.query.leaderboardOffset);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return res.status(400).json({error:'Invalid page.'});return res.json({leaders:await db(`z_users?select=username,lifetime_zs&order=lifetime_zs.desc,username.asc&limit=100&offset=${offset}`)});}
  const u=await session(req);const [games,feed,leaders,personal,ownGames]=await Promise.all([
   db('z_games?status=eq.open&order=created_at.desc&limit=100'),
   db('z_activity?select=id,username,kind,title,amount,created_at&order=id.desc&limit=50'),
   db('z_users?select=username,lifetime_zs&order=lifetime_zs.desc,username.asc&limit=100'),
   u?rpc('z_arcade_profile',{p_user:u.kick_user_id}):null,u?db(`z_games?status=eq.open&creator=eq.${u.kick_user_id}&order=created_at.desc`):[]]);
  const visibleGames=[...ownGames,...games.filter(g=>!ownGames.some(o=>o.id===g.id))];
  return res.json({games:visibleGames.map(({creator,opponent,winner,...g})=>({...g,mine:!!u&&Number(creator)===Number(u.kick_user_id)})),feed,leaders,personal,multipliers});
 }
 if(req.method!=='POST')return res.status(405).end();sameOrigin(req);const u=await requireUser(req);const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};let result;
 if(b.action==='create'||b.action==='plinko')result=await rpc('z_play',{p_id:id(b.requestId),p_user:u.kick_user_id,p_name:u.username,p_kind:b.action==='create'?'coin':'plinko',p_stake:wager(b.stake),p_side:b.side||null,p_path:b.action==='plinko'?plinkoResult().path:null});
 else if(b.action==='accept'||b.action==='cancel')result=await rpc('z_coin_action',{p_id:id(b.id),p_user:u.kick_user_id,p_name:u.username,p_cancel:b.action==='cancel',p_result:b.action==='accept'?coinResult():null});
 else throw Object.assign(new Error('Unknown action.'),{status:400});
 const {creator,opponent,winner,...safe}=result;
 return res.json({result:{...safe,isWinner:Number(winner)===Number(u.kick_user_id)}});
 }catch(e){return apiError(res,e);}}
