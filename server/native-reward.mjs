const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
export const NATIVE_REWARD_EVENT='channel.reward.redemption.updated';
export function nativeRewardReceipt({type,version,body}){
 if(type!==NATIVE_REWARD_EVENT)return null;
 if(version!=='1')throw new Error('Invalid native reward event version');
 const rewardId=body?.reward?.id,redemptionId=body?.id,status=body?.status,redeemed=Date.parse(body?.redeemed_at);
 if(typeof rewardId!=='string'||!ULID.test(rewardId)||typeof redemptionId!=='string'||!ULID.test(redemptionId)||
   !['pending','accepted','rejected'].includes(status)||!Number.isFinite(redeemed))throw new Error('Invalid native reward event');
 return `native-reward:${rewardId}:${redemptionId}:${status}:${redeemed}`;
}
export function parseNativeRewardReceipt(id,createdAt){
 if(typeof id!=='string'||!id.startsWith('native-reward:'))return null;
 const parts=id.split(':');if(parts.length!==5)return null;
 const [,reward_id,redemption_id,status,redeemedMs]=parts,redeemed=Number(redeemedMs);
 if(!ULID.test(reward_id)||!ULID.test(redemption_id)||!['pending','accepted','rejected'].includes(status)||
   !Number.isSafeInteger(redeemed)||!Number.isFinite(Date.parse(createdAt)))return null;
 return {reward_id,redemption_id,status,redeemed_at:new Date(redeemed).toISOString(),received_at:new Date(createdAt).toISOString()};
}
