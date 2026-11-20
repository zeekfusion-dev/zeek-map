import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('GTA overlay shows five standings every 15 minutes and hides after 30 seconds',async()=>{
 const code=readFileSync(new URL('../public/gta-overlay.js',import.meta.url),'utf8');
 const nodes=Object.fromEntries(['popup','leaders','empty'].map(id=>[id,{hidden:true,kids:[],replaceChildren(...kids){this.kids=kids;}}]));
 let poll,hide,enabled=true;
 vm.runInNewContext(code,{
  location:{protocol:'https:'},
  document:{getElementById:id=>nodes[id],createElement:()=>({kids:[],append(node){this.kids.push(node);}})},
  AbortSignal,
  setInterval(fn,ms){assert.equal(ms,900000);poll=fn;},
  setTimeout(fn,ms){assert.equal(ms,30000);hide=fn;},
  fetch:async()=>enabled?Response.json({entries:Array.from({length:7},(_,i)=>({rank:i+1,username:'Example'+i,xp:30-i}))}):new Response(null,{status:404})
 });
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.popup.hidden,false);
 assert.equal(nodes.leaders.kids.length,5);
 assert.equal(nodes.leaders.kids[0].kids[1].textContent,'@Example0');
 hide();
 assert.equal(nodes.popup.hidden,true);
 enabled=false;await poll();
 assert.equal(nodes.popup.hidden,false);
 assert.equal(nodes.leaders.kids.length,0);
 assert.equal(nodes.empty.textContent,'No standings yet.');
});
