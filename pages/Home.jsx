import FollowingEyes from '../components/FollowingEyes';
import {SiKick} from 'react-icons/si';
import React,{useEffect,useState} from "react";
import "./Home.css";
import {amountZ} from "../server/z-format.mjs";
import { Link } from "react-router-dom";

import {

  FaDiscord,
  FaYoutube,
  FaTwitch,
  FaInstagram,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";

export default function Home() {
  return (
    <div className="home-page" style={page}>


      <main className="home-layout" style={layout}>
        <section className="home-hero" style={hero}>
          <div>
            <p style={welcome}>WELCOME TO</p>
            <h1 style={title}>
              ZEEK <br />
              <span>FUSION</span>
            </h1>
            <p style={heroText}>IRL STREAMER. TRAVELER. CONTENT CREATOR.</p>
            <p style={heroTextBlue}>CHAOS EVERYTIME.</p>

            <div className="home-watch-stack">{[
 {url:'https://kick.com/zeekfusion',Icon:SiKick,label:'WATCH LIVE ON KICK',color:'#53fc18'},
 {url:'https://twitch.tv/zeekfusion',Icon:FaTwitch,label:'WATCH LIVE ON TWITCH',color:'#a970ff'},
 {url:'https://youtube.com/@zeekfusion',Icon:FaYoutube,label:'WATCH LIVE ON YOUTUBE',color:'#ff4343'}
].map(({url,Icon,label,color})=><a key={url} href={url} target="_blank" rel="noreferrer" className="home-stream-button"><Icon color={color} aria-hidden="true"/><span>{label}</span><span aria-hidden="true">→</span></a>)}</div>
          </div>

          <div style={heroFace}>
            <FollowingEyes/>
          </div>
        </section>

        <Link to="/map" style={{ ...imageCard, backgroundImage: "url('/images/map.png')" }}>
        <div style={cardContent}>
            <h2 style={cardTitle}>TRAVEL MAP</h2>
            <p style={cardText}>See everywhere I’ve been and where I’m going next.</p>
            <span style={smallBtn}>EXPLORE MAP →</span>
        </div>
        </Link>

        <Link to="/vault" style={{ ...imageCard, backgroundImage: "linear-gradient(90deg,rgba(1,5,13,.8),transparent 85%),url('/images/z-vault-arena.png')", backgroundPosition: "72% center"}}>
        <div style={cardContent}>
            <h2 style={cardTitle}>THE Z VAULT</h2>
            <p style={cardText}>Earn Zs in chat. Unlock rewards. Join the community.</p>
            <span style={smallBtn}>ENTER VAULT →</span>
        </div>
        </Link>

        <section style={videoCard}>
        <h3>▌ LATEST VIDEO</h3>

        <a
            href="https://youtu.be/7QLze6D0ODY"
            target="_blank"
            rel="noreferrer"
            style={{
            ...youtubeCard,
            backgroundImage:
                "url('https://img.youtube.com/vi/7QLze6D0ODY/maxresdefault.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            }}
        >
            <div style={videoOverlay}>
            <div style={playButton}>▶</div>

            <div>
                <p style={latestLabel}></p>
                <h2 style={latestTitle}>
                We Tried The World's Most Disgusting Smoothies!!
                </h2>
            </div>
            </div>
        </a>

        <a
            style={blueLink}
            href="https://youtube.com/@ZeekFusion"
            target="_blank"
            rel="noreferrer"
        >
            WATCH ON YOUTUBE →
        </a>
        </section>

        <HomeLeaders/>


        <Link to="/merch" className="home-merch" style={merchCard}>
          <h3>MERCH</h3>
          <h2>LIMITED DROPS<br />COMING SOON</h2>
          <span style={smallBtn}>SHOP MERCH →</span>
        </Link>

        <section className="home-connect" style={connectCard}>
          <h3>CONNECT WITH ME</h3>
            <div style={socials}>
        <a
            href="https://kick.com/zeekfusion"
            target="_blank"
            rel="noreferrer"
            style={socialItem}
        >
            <SiKick style={{ ...socialIcon, color: "#53FC18" }} />
            <span>KICK</span>
        </a>

        <a
            href="https://youtube.com/@ZeekFusion"
            target="_blank"
            rel="noreferrer"
            style={socialItem}
        >
            <FaYoutube style={{ ...socialIcon, color: "#FF0000" }} />
            <span>YOUTUBE</span>
        </a>

        <a
            href="https://instagram.com/zeekfusion"
            target="_blank"
            rel="noreferrer"
            style={socialItem}
        >
            <FaInstagram style={{ ...socialIcon, color: "#E1306C" }} />
            <span>INSTAGRAM</span>
        </a>

        <a
            href="https://x.com/zeekfusion"
            target="_blank"
            rel="noreferrer"
            style={socialItem}
        >
            <FaXTwitter style={{ ...socialIcon, color: "#1DA1F2" }} />
            <span>X</span>
        </a>

        <a
            href="https://tiktok.com/@zeekfusion"
            target="_blank"
            rel="noreferrer"
            style={socialItem}
        >
            <FaTiktok style={socialIcon} />
            <span>TIKTOK</span>
        </a>
        </div>

          <a href="https://discord.gg/AdduJ22Ven" target="_blank" rel="noreferrer" style={community} className="home-discord"><FaDiscord aria-hidden="true"/>
            <div>
              <strong>JOIN THE DISCORD COMMUNITY</strong>
              <p>HANG OUT • STREAM UPDATES • JOIN THE CHAOS</p>
            </div>
            <span>›</span>
          </a>
        </section>
        <section style={stats}>
          <div><strong>5M+</strong><span>TOTAL VIEWS</span></div>
          <div><strong>500+</strong><span>VIDEOS</span></div>
          <div><strong>VISITING ALL OF USA </strong><span>BY 2027</span></div>
          <div><strong>LIVE </strong><span>ALMOST EVERY DAY</span></div>
          <div><strong>ALL ENERGY </strong><span>ALL CHAOS</span></div>
        </section>
      </main>
      <footer className="home-footer">ZEEKFUSION · ALL ENERGY. ALL CHAOS.</footer>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#02040a",
  color: "white",
  fontFamily: "Impact, Arial Black, Arial, sans-serif",
  padding: "0 22px 22px",
};

const nav = {
  height: "78px",
  display: "flex",
  alignItems: "center",
  gap: "28px",
  borderBottom: "1px solid rgba(0,132,255,.35)",
  marginBottom: "22px",
};

const kickBrand = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  color: "white",
  textDecoration: "none",
  fontSize: "30px",
  fontWeight: 900,
};

const kickK = {
  color: "#38ff14",
  fontSize: "48px",
  lineHeight: 1,
};

const navLinks = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  gap: "34px",
};

const navLink = {
  color: "white",
  textDecoration: "none",
  fontSize: "18px",
  fontWeight: 900,
};

const activeNav = {
  ...navLink,
  color: "#0ea5ff",
  borderBottom: "3px solid #0ea5ff",
  paddingBottom: "8px",
};

const avatar = {
  width: "70px",
  height: "70px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid #008cff",
  boxShadow: "0 0 22px #008cff",
};

const watchBtn = {
  background: "linear-gradient(90deg,#005bea,#00a6ff)",
  color: "white",
  padding: "15px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "18px",
  fontWeight: 900,
  boxShadow: "0 0 20px rgba(0,132,255,.75)",
};

const layout = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "14px",
};

const hero = {
  gridRow: "span 2",
  minHeight: "520px",
  border: "1px solid rgba(0,132,255,.55)",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at 70% 50%, rgba(0,132,255,.55), transparent 30%), linear-gradient(135deg,#030711,#071a38)",
  padding: "42px",
  display: "grid",
  gridTemplateColumns: "1.1fr .9fr",
  overflow: "hidden",
};

const welcome = {
  color: "#008cff",
  fontSize: "22px",
  letterSpacing: "5px",
};

const title = {
  fontSize: "110px",
  lineHeight: ".86",
  margin: "10px 0",
  textShadow: "0 0 22px rgba(0,132,255,.6)",
};

const heroText = {
  fontSize: "22px",
  margin: "10px 0 0",
};

const heroTextBlue = {
  fontSize: "24px",
  color: "#0ea5ff",
  margin: 0,
};

const heroButton = {
  marginTop: "24px",
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 22px",
  border: "1px solid #008cff",
  borderRadius: "8px",
  color: "white",
  textDecoration: "none",
  boxShadow: "0 0 20px rgba(0,132,255,.6)",
};

const kickSmall = {
  color: "#38ff14",
  fontWeight: 900,
};

const heroFace = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroImg = {
  width: "560px",
  height: "560px",
  objectFit: "contain",
  borderRadius: "0",
  filter: "drop-shadow(0 0 45px #008cff)",
};

const card = {
  minHeight: "235px",
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "28px",
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(135deg,#06101f,#082954)",
};

const imageCard = {
  minHeight: "210px",
  border: "1px solid rgba(0,132,255,.55)",
  borderRadius: "16px",
  color: "white",
  textDecoration: "none",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  overflow: "hidden",
};

const cardContent = {
  height: "100%",
  padding: "26px 34px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  maxWidth: "70%",
};

const cardTitle = {
  fontSize: "34px",
  margin: "0 0 16px",
  lineHeight: "1",
};

const cardText = {
  fontSize: "18px",
  lineHeight: "1.35",
  margin: "0 0 20px",
  fontFamily: "Arial, sans-serif",
  fontWeight: 700,
};

const smallBtn = {
  marginTop: "18px",
  background: "#031a35",
  border: "1px solid #008cff",
  color: "white",
  padding: "12px 18px",
  borderRadius: "7px",
  fontWeight: 900,
};

const videoCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "18px",
  background: "#05080e",
};

const videoBox = {
  height: "175px",
  borderRadius: "10px",
  background: "linear-gradient(135deg,#06213d,#0ea5ff)",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const videoFace = {
  position: "absolute",
  left: "15px",
  width: "115px",
  height: "115px",
  objectFit: "cover",
  borderRadius: "12px",
};

const play = {
  fontSize: "54px",
  color: "red",
  zIndex: 2,
};

const blueLink = {
  display: "inline-block",
  marginTop: "14px",
  color: "#008cff",
  textDecoration: "none",
};

const connectCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "22px",
  background: "#05080e",
};

const socials = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  marginTop: "30px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const community = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #008cff",
  borderRadius: "10px",
  padding: "18px",
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(90deg,#031a35,#062b5d)",
};

const merchCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "28px",
  color: "white",
  textDecoration: "none",
  background:
    "radial-gradient(circle at right, rgba(0,132,255,.9), transparent 38%), linear-gradient(135deg,#05080e,#071a38)",
};

const stats = {
  gridColumn: "1 / span 2",
  display: "grid",
  gridTemplateColumns: "repeat(5,1fr)",
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "22px",
  background: "linear-gradient(90deg,#05080e,#06162d)",
  textAlign: "center",
};

const socialGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  marginTop: "18px",
};

const socialIcon = {
  fontSize: "64px",
};

const socialItem = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  padding: "35px 10px",
  textDecoration: "none",
  color: "white",
  fontWeight: "900",
  fontSize: "18px",
  letterSpacing: "1px",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  transition: "0.25s",
};

const socialLabel = {
  fontSize: "14px",
  fontFamily: "Arial, sans-serif",
  fontWeight: "bold",
  letterSpacing: ".5px",
};

const videoTitle = {
  marginLeft: "18px",
  fontSize: "18px",
  fontWeight: 900,
};

const youtubeCard = {
  height: "260px",
  borderRadius: "14px",
  overflow: "hidden",
  textDecoration: "none",
  position: "relative",
  display: "flex",
  alignItems: "flex-end",
};

const videoOverlay = {
  width: "100%",
  padding: "24px",
  background:
    "linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.2), transparent)",
  display: "flex",
  alignItems: "center",
  gap: "22px",
};

const playButton = {
  width: "72px",
  height: "72px",
  borderRadius: "50%",
  background: "red",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "34px",
  color: "white",
  flexShrink: 0,
};

const latestLabel = {
  margin: 0,
  color: "#0ea5ff",
  fontSize: "14px",
  letterSpacing: "2px",
};

const latestTitle = {
  margin: "6px 0 0",
  fontSize: "clamp(28px, 4vw, 64px)",
  lineHeight: ".95",
  color: "white",
  textShadow: "0 0 18px rgba(0,0,0,.95)",
  maxWidth: "75%",
};

const statsDiv = {};
function HomeLeaders(){const [leaders,setLeaders]=useState(null),[error,setError]=useState(false);useEffect(()=>{let active=true;const load=()=>fetch('/api/arcade?balanceLeaders=1').then(r=>{if(!r.ok)throw Error();return r.json()}).then(j=>{if(active){setLeaders(j.leaders);setError(false)}}).catch(()=>{if(active)setError(true)});load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer)}},[]);return <section className="home-leaders"><span className="home-eyebrow">THE VAULT'S HEAVY HITTERS</span><h2>Z VAULT LEADERBOARD</h2><p>Most Zs in the Vault. Who’s taking the crown?</p>{error?<p>Leaderboard temporarily unavailable.</p>:leaders===null?<p>Loading players…</p>:!leaders.length?<p>The first spot is waiting for you.</p>:leaders.map((u,i)=><div className={'home-leader place-'+(i+1)} key={u.username}><span>{i===0?'♛':'#'+(i+1)}</span><strong>@{u.username}</strong><b>{amountZ(u.zs_balance)}</b></div>)}<Link to="/vault">ENTER THE Z VAULT →</Link></section>}
