import {rpc} from './db.mjs';
import {normalizeAnswer} from './domain.mjs';
export const MARKET_URL='zeekfusion.com/#/market';
// Help and dispatch share one registry. Aliases are listed alongside the canonical command.
export const COMMANDS=Object.freeze([
 Object.freeze({name:'z',aliases:['zs'],command:'balance',usage:'!z',description:'Check your Z balance'}),
 Object.freeze({name:'buy',aliases:[],command:'buy',usage:'!buy <reward>',description:'Buy a Z Market reward'}),
 Object.freeze({name:'zcommand',aliases:['zcommands'],command:'help',usage:'!zcommand',description:'Show Z commands'})
]);
export const CHAT_COMMANDS=Object.freeze(Object.fromEntries(COMMANDS.flatMap(c=>[c.name,...c.aliases].map(name=>[name,c.command]))));
export function commandHelp(){return 'Z Commands: '+COMMANDS.map(c=>`${c.usage}${c.aliases.length?' (also '+c.aliases.map(a=>'!'+a).join(', ')+')':''} — ${c.description}`).join(' | ')+' | Visit '+MARKET_URL;}
export function parseChatCommand(message){const match=String(message).trim().match(/^!(\S+)(?:\s+([\s\S]*))?$/);const command=match&&Object.hasOwn(CHAT_COMMANDS,match[1].toLowerCase())&&CHAT_COMMANDS[match[1].toLowerCase()];return command?{command,argument:(match[2]||'').trim()}:null;}
export async function processChat({event,user,username,message,content,created},call=rpc){const parsed=parseChatCommand(content);const common={p_event:event,p_user:user,p_name:username,p_message:message,p_created:created};return parsed?call('z_process_command',{...common,p_command:parsed.command,p_argument:parsed.command==='help'?commandHelp():parsed.argument}):call('z_process_chat',{...common,p_answer:normalizeAnswer(content),p_balance:false});}
