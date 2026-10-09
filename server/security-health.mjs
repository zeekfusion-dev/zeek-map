import {rpc} from './db.mjs';
import {securityLog} from './security-log.mjs';
export async function checkSecurityHealth(){
 try{const health=await rpc('z_security_health');if(health?.ok===false)securityLog('integrity_alert',500);return health;}
 catch{securityLog('integrity_check_failed',503);return null;}
}
