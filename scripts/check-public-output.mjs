import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const problems=[];
function walk(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(root,e.name)):[path.join(root,e.name)]);}
for(const file of walk('dist')){
 const data=fs.readFileSync(file).toString();
 if(file.endsWith('.map'))problems.push(file+': public source map');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{30,}/.test(data))problems.push(file+': credential pattern');
 if(/\/Users\/[A-Za-z0-9_.-]+\//.test(data))problems.push(file+': local user path');
 for(const token of data.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(token[0].split('.')[1],'base64url')).role==='service_role')problems.push(file+': service-role JWT');}catch{}}
}
// Never include private identity terms in this public repository or CI logs.
const identity=execFileSync('git',['log','-1','--format=%an%n%ae%n%cn%n%ce']).toString().trim().split('\n');
const names=new Set(['ZeekFusion','zeekfusion-dev','GitHub','dependabot[bot]']);
for(const i of [0,2])if(!names.has(identity[i])||!/@users\.noreply\.github\.com$|^noreply@github\.com$/.test(identity[i+1]))problems.push('Latest commit uses unapproved public attribution; configure branded name and GitHub noreply email.');
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exit(1);}
console.log('Public output and latest commit attribution checks passed.');
