import dictionary from './ui.json' with {type:'json'};
export const languages=[['en','English'],['es','Español'],['zh','中文'],['de','Deutsch'],['ru','Русский']];
export function validLanguage(value){return languages.some(([code])=>code===value)?value:'en'}
let language='en';try{language=validLanguage(globalThis.localStorage?.getItem('zeek-language'))}catch{}
const listeners=new Set();
export const getLanguage=()=>language;
export const subscribeLanguage=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
export function setLanguage(value){language=validLanguage(value);try{localStorage.setItem('zeek-language',language)}catch{}listeners.forEach(fn=>fn())}
export function translate(text,locale=language){if(typeof text!=='string')return text;const key=text.trim().replace(/\s+/g,' '),translated=dictionary[key]?.[locale];return translated?text.replace(text.trim(),translated):text}
