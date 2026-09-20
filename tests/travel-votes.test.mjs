import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVote,visitorToken,travelVotes} from '../server/travel-votes.mjs';
const valid={kind:'states',place:'Florida',requestId:'aabbbbbb-1111-4111-8111-111111111111'};
test('travel vote inputs reject arbitrary identity fields and malformed payloads',()=>{assert.deepEqual(validateVote(valid),valid);for(const b of [{...valid,kind:'usa'},{...valid,place:[]},{...valid,requestId:'bad'},{...valid,user:20306616}])assert.throws(()=>validateVote(b));});
test('guest voting uses a tamper-resistant persistent HttpOnly device cookie',()=>{process.env.KICK_CLIENT_SECRET='test-only-secret';let header;const res={setHeader:(k,v)=>header=v};const first=visitorToken({headers:{}},res);assert.match(header,/HttpOnly; Secure; SameSite=Lax; Max-Age=31536000/);const cookie=header.split(';')[0];assert.equal(visitorToken({headers:{cookie}},res),first);assert.notEqual(visitorToken({headers:{cookie:cookie+'tampered'}},res),first);});
test('cross-origin voting is rejected before database access',async()=>{await assert.rejects(()=>travelVotes({method:'POST',headers:{origin:'https://evil.example'},body:valid},{}),e=>e.status===403);});
