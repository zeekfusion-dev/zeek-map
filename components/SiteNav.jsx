import React from 'react';
import {NavLink} from 'react-router-dom';
import './SiteNav.css';
export default function SiteNav(){return <header className="site-nav"><a className="site-kick" href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer"><span>K</span>KICK.COM/ZEEKFUSION</a><nav aria-label="Main navigation">{[['/','HOME'],['/map','MAP'],['/market','Z MARKET'],['/merch','MERCH'],['/clips','CLIPS']].map(([url,label])=><NavLink key={url} to={url} end>{label}</NavLink>)}</nav><img className="site-avatar" src="/images/zeek-profile.webp" alt="ZeekFusion"/><a className="site-watch" href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer"><span>K</span> WATCH LIVE</a></header>}
