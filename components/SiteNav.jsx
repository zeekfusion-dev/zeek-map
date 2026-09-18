import LanguageSelector from './Language';
import {translate as tr} from '../localization/language.mjs';
import React from 'react';
import {NavLink} from 'react-router-dom';
import './SiteNav.css';
export default function SiteNav(){return <header className="site-nav"><a className="site-kick" href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer"><span>K</span>KICK.COM/ZEEKFUSION</a><nav aria-label="Main navigation">{[['/','HOME'],['/map','MAP'],['/market','Z MARKET'],['/mc-server','MC SERVER'],['/clips','CLIPS']].map(([url,label])=><NavLink key={url} to={url} end>{tr(label)}</NavLink>)}</nav><LanguageSelector/><img className="site-avatar" src="/images/zeek-profile.webp" alt="ZeekFusion"/><a className="site-watch" href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer"><span>K</span> {tr("WATCH LIVE")}</a></header>}
