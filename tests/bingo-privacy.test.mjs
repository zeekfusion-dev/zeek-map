import {test} from 'node:test';
import assert from 'node:assert/strict';
import site from '../api/site.js';
import {BROADCASTER} from '../server/domain.mjs';

test('only the owner can read bingo; generic public content omits it', async t => {
 const oldFetch=globalThis.fetch;
 const oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_SECRET_KEY;
 t.after(()=>{globalThis.fetch=oldFetch;for(const [k,v] of [['SUPABASE_URL',oldUrl],['SUPABASE_SECRET_KEY',oldKey]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 process.env.SUPABASE_URL='https://example.test';
 process.env.SUPABASE_SECRET_KEY='dummy';
 const board={title:'Private challenge',squares:[]};
 const row={content:{bingo:board,latestVideo:{id:'video'}},revision:4};
 let userId=4,reads=0;
 globalThis.fetch=async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/z_rate_limit'))return Response.json(true);
  if(path.endsWith('/z_sessions'))return Response.json([{kick_user_id:userId}]);
  if(path.endsWith('/z_site_content')){reads++;return Response.json([row]);}
  throw Error('Unexpected request');
 };
 const read=async(query,headers={})=>{
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await site({method:'GET',query,headers,socket:{remoteAddress:'127.0.0.1'}},res);
  return res;
 };
 const session={cookie:'z_session='+'z'.repeat(43)};
 assert.equal((await read({bingo:'1'})).code,401);
 assert.equal((await read({bingo:'1'},session)).code,403);
 assert.equal(reads,0);
 const publicResult=await read({});
 assert.equal(publicResult.code,200);
 assert.deepEqual(publicResult.body,{content:{latestVideo:{id:'video'}},revision:4});
 userId=BROADCASTER;
 const owner=await read({bingo:'1'},session);
 assert.equal(owner.code,200);
 assert.deepEqual(owner.body,{board,revision:4});
});
