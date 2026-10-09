// Deliberately omit request bodies, URLs, cookies, identities, IPs and error text.
const events=new Set(['request_rejected','database_failure','webhook_rejected','webhook_failure','delivery_failure','scheduler_failure','reward_feed_failure','integrity_alert','integrity_check_failed']);
export function securityLog(event,status){
 if(!events.has(event))return;
 console.warn(JSON.stringify({event,status:Number.isInteger(status)&&status>=100&&status<=599?status:500}));
}
