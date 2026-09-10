export async function db(path,{method='GET',body,prefer}={}) {
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!base||!key) throw new Error('Database connection is not configured.');
  const r=await fetch(`${base}/rest/v1/${path}`,{method,headers:{apikey:key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const t=await r.text();
  if(!r.ok){console.error('Database request failed',path.split('?')[0],r.status,t.slice(0,300));const known=['Insufficient Zs','Reward unavailable','Weekly conversion limit exceeded','Conversions unavailable or invalid amount','Entries are closed','Giveaway must be closed for entries'];let detail;try{detail=JSON.parse(t).message;}catch{}if(known.includes(detail))throw Object.assign(new Error(detail),{status:400});throw new Error('The database could not complete this action.');}
  return t?JSON.parse(t):null;
}
export const rpc=(name,body={})=>db(`rpc/${name}`,{method:'POST',body});
export async function configuration(){return (await db('z_config?id=eq.1&select=settings'))[0].settings;}
