import {rpc} from './db.mjs';
import {normalizeAnswer} from './domain.mjs';
// A single registry owns aliases; unknown messages retain the existing trivia path.
export const CHAT_COMMANDS=Object.freeze({z:'balance',zs:'balance',buy:'buy'});
export function parseChatCommand(message){const match=String(message).trim().match(/^!(\S+)(?:\s+([\s\S]*))?$/);const command=match&&Object.hasOwn(CHAT_COMMANDS,match[1].toLowerCase())&&CHAT_COMMANDS[match[1].toLowerCase()];return command?{command,argument:(match[2]||'').trim()}:null;}
export async function processChat({event,user,username,message,content,created},call=rpc){const parsed=parseChatCommand(content);const common={p_event:event,p_user:user,p_name:username,p_message:message,p_created:created};return parsed?call('z_process_command',{...common,p_command:parsed.command,p_argument:parsed.argument}):call('z_process_chat',{...common,p_answer:normalizeAnswer(content),p_balance:false});}
