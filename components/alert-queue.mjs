// A broadcast only wakes this consumer; every playable item is claimed by the server.
export function createAlertQueue({request,play,schedule=setTimeout,cancel=clearTimeout,onError=()=>{},remember=()=>{},wasPlayed=()=>false}){
 let running=false,again=false,stopped=false,timer=null,failures=0;const completed=new Map();
 function later(ms){cancel(timer);timer=schedule(()=>{timer=null;wake()},ms);}
 async function wake(){if(stopped)return;if(running){again=true;return;}running=true;cancel(timer);timer=null;try{
  do{again=false;const next=await request({action:'claim'});if(stopped)break;
   if(next.retryAfter){later(Math.max(1,next.retryAfter)*1000);break;}
   if(!next.alert){if(again)continue;break;}
   const item=next.alert;let failed=completed.get(item.id)||false;
   if(!wasPlayed(item.id)){failed=!(await play(item));if(stopped)break;remember(item.id,failed);completed.set(item.id,failed);}
   const done=await request({action:'finish',id:item.id,failed});if(!done.ok)throw Error('Alert ownership changed. Reconnecting…');
   again=true;failures=0;
  }while(again&&!stopped);
  failures=0;
 }catch(e){onError(e);if(!stopped)later(Math.min(60000,1000*2**Math.min(++failures,6)));}finally{running=false;}
 }
 return {wake,stop(){stopped=true;cancel(timer);},get running(){return running}};
}
