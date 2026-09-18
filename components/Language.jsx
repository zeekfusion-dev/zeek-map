import {FiGlobe} from 'react-icons/fi';
import React,{useSyncExternalStore,useEffect} from 'react';
import {languages,getLanguage,subscribeLanguage,setLanguage,translate} from '../localization/language.mjs';
export function useLanguage(){const language=useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'en');useEffect(()=>{document.documentElement.lang=language;},[language]);return language}
export default function LanguageSelector(){const language=useLanguage();return <label className="site-language"><FiGlobe aria-hidden="true"/><select aria-label="Language / Idioma / 语言 / Sprache / Язык" value={language} onChange={e=>setLanguage(e.target.value)}>{languages.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>}
