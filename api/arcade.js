export const config={api:{bodyParser:{sizeLimit:'16kb'}},maxDuration:30};
import {bodyObject,validateQuery,validateGame,limit} from '../server/security.mjs';
import {db,rpc} from '../server/db.mjs';
import {session,requireUser,sameOrigin,apiError} from '../server/auth.mjs';
import {wager,plinkoResult,coinResult,multipliers,diceResult,nextCard,mineBoard,blackjackDeck} from '../server/arcade.mjs';
const id=x=>{if(typeof x!=='string'||!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x))throw Object.assign(new Error('Invalid request.'),{status:400});return x;};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{validateQuery(req);
 if(req.method==='GET'){await limit(req,'public-arcade',180);
  if(req.query?.activity==='1'){const before=req.query.before;if(before&&!/^\d{1,19}$/.test(before))return res.status(400).json({error:'Invalid page.'});return res.json({feed:await db('z_activity?select=id,username,kind,title,amount,created_at&order=id.desc&limit=50'+(before?'&id=lt.'+before:''))});}
  const ranking=req.query.ranking||'current';if(!['current','lifetime'].includes(ranking))return res.status(400).json({error:'Invalid ranking.'});const rankColumn=ranking==='current'?'zs_balance':'lifetime_zs';
  if(req.query?.balanceLeaders==='1')return res.json({leaders:await db(`z_users?select=username,zs_balance,lifetime_zs&order=${rankColumn}.desc,username.asc&limit=5`)});
  if(req.query?.leaderboardOffset!==undefined){const offset=Number(req.query.leaderboardOffset);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return res.status(400).json({error:'Invalid page.'});return res.json({leaders:await db(`z_users?select=username,zs_balance,lifetime_zs&order=${rankColumn}.desc,username.asc&limit=100&offset=${offset}`)});}
  const u=await session(req);const [games,feed,leaders,personal,ownGames,active]=await Promise.all([
   db('z_games?status=eq.open&order=created_at.desc&limit=100'),
   db('z_activity?select=id,username,kind,title,amount,created_at&order=id.desc&limit=50'),
   db('z_users?select=username,zs_balance,lifetime_zs&order=zs_balance.desc,username.asc&limit=100'),
   u?rpc('z_arcade_profile',{p_user:u.kick_user_id}):null,u?db(`z_games?status=eq.open&creator=eq.${u.kick_user_id}&order=created_at.desc`):[],u?db(`z_games?creator=eq.${u.kick_user_id}&status=eq.playing&select=id,kind,stake,status,result,payout`):[]]);
  const visibleGames=[...ownGames,...games.filter(g=>!ownGames.some(o=>o.id===g.id))];
  return res.json({games:visibleGames.map(({creator,opponent,winner,...g})=>({...g,mine:!!u&&Number(creator)===Number(u.kick_user_id)})),feed,leaders,personal,active,multipliers});
 }
 if(req.method!=='POST')return res.status(405).end();sameOrigin(req);const u=await requireUser(req);const b=bodyObject(req);validateGame(b);await limit(req,'games',60,60,u.kick_user_id);let result;
 if(b.action==='create'&&b.kind==='rps')result=await rpc('z_rps_create',{p_id:id(b.requestId),p_user:u.kick_user_id,p_name:u.username,p_stake:wager(b.stake,'rps'),p_choice:b.choice});
 else if(b.action==='create'||b.action==='plinko')result=await rpc('z_play',{p_id:id(b.requestId),p_user:u.kick_user_id,p_name:u.username,p_kind:b.action==='create'?(b.kind==='dice'?'dice':'coin'):'plinko',p_stake:wager(b.stake,b.action==='create'?(b.kind==='dice'?'dice':'coin'):'plinko'),p_side:b.side||null,p_path:b.action==='plinko'?plinkoResult().path:null});
 else if(b.kind==='blackjack'&&['start','move'].includes(b.action))result=await rpc('z_blackjack',{p_id:id(b.action==='start'?b.requestId:b.id),p_request:id(b.requestId),p_user:u.kick_user_id,p_name:u.username,p_action:b.action==='start'?'start':b.move,p_stake:b.action==='start'?wager(b.stake):null,p_deck:b.action==='start'?blackjackDeck():null,p_version:b.version??null});
 else if(b.action==='start')result=await rpc('z_run_start',{p_id:id(b.requestId),p_user:u.kick_user_id,p_name:u.username,p_kind:b.kind,p_stake:wager(b.stake),p_card:nextCard(),p_mines:b.kind==='mines'?mineBoard(b.mines):null});
 else if(b.action==='move')result=await rpc('z_run_step',{p_id:id(b.id),p_request:id(b.requestId),p_user:u.kick_user_id,p_version:b.version,p_action:b.move,p_cell:b.cell??null,p_card:nextCard()});
 else if(b.action==='accept'||b.action==='cancel'){const game=(await db(`z_games?id=eq.${id(b.id)}&select=kind`))[0];result=game?.kind==='rps'?await rpc('z_rps_action',{p_id:id(b.id),p_user:u.kick_user_id,p_name:u.username,p_cancel:b.action==='cancel',p_choice:b.choice||null}):await rpc('z_coin_action',{p_id:id(b.id),p_user:u.kick_user_id,p_name:u.username,p_cancel:b.action==='cancel',p_result:b.action==='accept'?(game?.kind==='dice'?JSON.stringify(diceResult()):coinResult()):null});}
 else throw Object.assign(new Error('Unknown action.'),{status:400});
 const {creator,opponent,winner,...safe}=result;
 return res.json({result:{...safe,isWinner:Number(winner)===Number(u.kick_user_id)}});
 }catch(e){return apiError(res,e);}}
