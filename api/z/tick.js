import {rpc} from '../../server/db.mjs';
import {tick} from '../../server/kick.mjs';
export const config={maxDuration:60};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();const token=req.headers['x-z-tick'];if(typeof token!=='string'||!/^[0-9a-f-]{36}$/.test(token))return res.status(401).end();try{if(!await rpc('z_consume_tick',{p_token:token}))return res.status(401).end();res.json(await tick());}catch(e){console.error('Z scheduler:',e.message);res.status(503).json({error:'Scheduler could not complete this run.'});}}
