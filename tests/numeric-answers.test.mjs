import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnswer} from '../server/domain.mjs';
import {processChat} from '../server/chat-commands.mjs';

test('digit-only answers accept whitespace between digits',()=>{
  for(const input of ['64','6 4',' 6   4 ','6\t4','6\n4','6\u00a04','６ ４'])assert.equal(normalizeAnswer(input),'64');
  assert.equal(normalizeAnswer('1 0 0'),'100');
  assert.equal(normalizeAnswer('0 6 4'),'064'); // Do not coerce numeric values.
});
test('numeric tolerance does not merge punctuation, operators, words or lists',()=>{
  for(const input of ['6.4','6,4','6-4','6/4','6+4','6:4','6 & 4','6 or 4','answer 6 4','-6 4','+6 4','6 4!'])assert.notEqual(normalizeAnswer(input),'64',input);
  assert.equal(normalizeAnswer('sixty four'),'sixty four');
  assert.equal(normalizeAnswer('New   York'),'new york');
  assert.equal(normalizeAnswer('POKÉMON!'),'pokemon');
});
test('chat dispatcher passes the corrected answer with unchanged identity and timing',async()=>{
  const payload={event:'numeric-event',user:123,username:'Viewer',message:'numeric-message',content:'6 4',created:'2026-11-04T02:58:45Z'};
  await processChat(payload,async(name,args)=>{
    assert.equal(name,'z_process_chat');
    assert.deepEqual(args,{p_event:payload.event,p_user:123,p_name:'Viewer',p_message:payload.message,p_created:payload.created,p_answer:'64',p_balance:false});
  });
  await processChat({...payload,content:'6.4'},async(name,args)=>assert.equal(args.p_answer,'6 4'));
});
