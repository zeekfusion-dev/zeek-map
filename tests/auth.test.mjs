import test from 'node:test';import assert from 'node:assert/strict';
import {seal,unseal,sameOrigin,requireUser,requireAdmin} from '../server/auth.mjs';
import api from '../api/z.js';
process.env.KICK_CLIENT_SECRET='test-only-local-secret';
process.env.KICK_REDIRECT_URI='https://www.zeekfusion.com/api/kick/callback';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
test('encrypted OAuth state detects tampering',()=>{const token=seal({state:'abc',verifier:'private'});assert.deepEqual(unseal(token),{state:'abc',verifier:'private'});const buf=Buffer.from(token,'base64url');buf[30]^=1;assert.throws(()=>unseal(buf.toString('base64url')));});
test('unauthenticated user and owner requests fail closed',async()=>{await assert.rejects(()=>requireUser({headers:{}}),{status:401});await assert.rejects(()=>requireAdmin({headers:{}}),{status:401});const r=response();await api({method:'GET',query:{admin:'1'},headers:{}},r);assert.equal(r.statusCode,401);});
test('cross-site state changes are refused before database access',async()=>{assert.throws(()=>sameOrigin({headers:{origin:'https://evil.example'}}),{status:403});const r=response();await api({method:'POST',headers:{origin:'https://evil.example'},body:{action:'adjust',amount:10000}},r);assert.equal(r.statusCode,403);});
