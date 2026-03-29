const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function setupDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT NOT NULL, event_url TEXT NOT NULL, status TEXT DEFAULT 'unavailable', last_checked TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS subscriptions (id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES events(id), email TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  `);
}

function getHTML(events) {
  const ej = JSON.stringify(events);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SeatX - The seat market, live.</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0b0f;--bg2:#11141b;--lime:#a3e635;--lime2:#bef264;--border:rgba(255,255,255,.09);--muted:#71717a;--muted2:#3f3f46}
body{background:var(--bg);color:#f4f4f5;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
body.en{font-family:'DM Sans',sans-serif}
body.ar{font-family:'IBM Plex Sans Arabic',sans-serif}
nav{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--border);background:rgba(10,11,15,.92);backdrop-filter:blur(20px);padding:14px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px}
.lbox{width:36px;height:36px;border-radius:10px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.25);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:var(--lime);font-family:'DM Sans',sans-serif}
.lname{font-size:17px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif}
.lname em{color:var(--lime);font-style:normal}
.lsub{font-size:10px;color:var(--muted);margin-top:1px}
.nav-r{display:flex;align-items:center;gap:8px}
.ltog{display:flex;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:8px;padding:3px;gap:3px}
.lb{background:none;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;color:#71717a;font-family:'DM Sans',sans-serif;transition:all .15s}
.lb.on{background:var(--lime);color:#000}
.gbtn{background:var(--lime);border:none;border-radius:9px;padding:8px 16px;font-size:13px;font-weight:700;color:#000;cursor:pointer;transition:background .15s}
.gbtn:hover{background:var(--lime2)}
.obtn{background:none;border:1px solid var(--border);border-radius:9px;padding:8px 14px;font-size:13px;color:#a1a1aa;cursor:pointer}
/* HERO */
.hero{max-width:1200px;margin:0 auto;padding:56px 32px 40px;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:start}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.badge{display:inline-flex;align-items:center;border-radius:100px;border:1px solid;padding:3px 10px;font-size:11px;font-weight:600}
.bg{border-color:rgba(163,230,53,.22);background:rgba(163,230,53,.1);color:var(--lime)}
.bo{border-color:rgba(249,115,22,.22);background:rgba(249,115,22,.1);color:#fb923c}
.bb{border-color:rgba(56,189,248,.22);background:rgba(56,189,248,.1);color:#7dd3fc}
.bl{border-color:rgba(248,113,113,.22);background:rgba(248,113,113,.1);color:#f87171;display:flex;align-items:center;gap:5px}
.bl::before{content:'';width:5px;height:5px;border-radius:50%;background:#f87171;animation:pu 2s infinite;flex-shrink:0}
@keyframes pu{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5)}50%{box-shadow:0 0 0 4px rgba(248,113,113,0)}}
h1{font-size:clamp(44px,6vw,78px);font-weight:900;line-height:.95;letter-spacing:-.03em;color:#fff;margin-bottom:18px}
.ar h1{letter-spacing:0;line-height:1.15}
h1 em{color:var(--lime);font-style:normal}
.sub{font-size:16px;line-height:1.75;color:var(--muted);max-width:480px;margin-bottom:22px}
.hbtns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.wpill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;padding:4px 12px 4px 8px;font-size:12px;color:#a1a1aa;margin-bottom:20px}
.wavs{display:flex}
.wav{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--bg);margin-left:-5px;font-size:9px;display:flex;align-items:center;justify-content:center}
.wav:first-child{margin-left:0}
.wcnt{font-weight:700;color:#fff;font-family:'DM Sans',sans-serif}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.sc{border-radius:18px;border:1px solid var(--border);background:rgba(255,255,255,.03);padding:16px}
.sl{font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)}
.ar .sl{letter-spacing:0}
.sv{font-size:22px;font-weight:800;color:#fff;margin-top:6px;font-family:'DM Sans',sans-serif}
/* FEED */
.fw{border-radius:22px;border:1px solid var(--border);background:rgba(255,255,255,.02);padding:16px;box-shadow:0 32px 64px rgba(0,0,0,.5)}
.fi2{border-radius:16px;border:1px solid var(--border);background:var(--bg2);padding:16px}
.fhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.flist{display:flex;flex-direction:column;gap:6px;min-height:130px}
.fi{border-radius:10px;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:10px 13px;font-size:12px;color:#d4d4d8;line-height:1.5;transition:all .4s}
.fi.hot{border-color:rgba(163,230,53,.2);background:rgba(163,230,53,.04)}
.fhot{margin-top:12px;border-radius:10px;border:1px solid rgba(163,230,53,.18);background:rgba(163,230,53,.06);padding:12px}
/* FORM */
.sec{max-width:1200px;margin:0 auto;padding:0 32px 48px}
.aform{background:rgba(255,255,255,.035);border:1px solid var(--border);border-radius:20px;padding:26px;max-width:540px;margin:0 auto 48px}
.aform label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px}
.ar .aform label{letter-spacing:0}
.aform input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:11px;padding:11px 14px;font-size:13px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;margin-bottom:12px}
.aform input::placeholder{color:var(--muted2)}
.aform input:focus{border-color:rgba(163,230,53,.4)}
/* EVENTS */
.eyebrow{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-bottom:8px}
.ar .eyebrow{letter-spacing:0}
h2.st{font-size:clamp(22px,3vw,34px);font-weight:900;letter-spacing:-.02em;color:#fff;margin-bottom:22px}
.ar h2.st{letter-spacing:0}
.egrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.ecard{border-radius:18px;border:1px solid var(--border);background:rgba(255,255,255,.03);padding:20px;transition:border-color .2s,transform .2s}
.ecard:hover{border-color:rgba(163,230,53,.25);transform:translateY(-2px)}
.estat{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:100px;font-size:11px;font-weight:700;margin-bottom:10px}
.ea{background:rgba(163,230,53,.12);color:var(--lime);border:1px solid rgba(163,230,53,.2)}
.eu{background:rgba(255,255,255,.04);color:var(--muted);border:1px solid var(--border)}
.em{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.etitle{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px}
.eurl{font-size:11px;color:var(--muted2);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ubar{background:rgba(249,115,22,.07);border:1px solid rgba(249,115,22,.18);border-radius:10px;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.ul{display:flex;align-items:center;gap:7px;font-size:11px;color:#fb923c;font-weight:600}
.udot{width:5px;height:5px;border-radius:50%;background:#fb923c;animation:pu 1.5s infinite;flex-shrink:0}
.ucd{font-size:13px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;font-family:'DM Sans',sans-serif}
.einput{width:100%;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:9px;padding:9px 12px;font-size:12px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;margin-bottom:8px}
.einput::placeholder{color:var(--muted2)}
.einput:focus{border-color:rgba(163,230,53,.4)}
.abtn{width:100%;background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.2);border-radius:9px;padding:9px;font-size:12px;font-weight:700;color:var(--lime);cursor:pointer}
.abtn:hover{background:rgba(163,230,53,.2)}
/* STEPS */
.sg2{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.scard{border-radius:18px;border:1px solid var(--border);background:rgba(255,255,255,.03);padding:22px}
.stop{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.sicon{color:var(--lime);width:26px;height:26px}
.snum{font-size:12px;font-weight:700;color:var(--muted2);font-family:'DM Sans',sans-serif}
/* FOUNDING */
.fwrap{border-radius:26px;border:1px solid var(--border);background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.01));padding:32px;margin-bottom:40px}
.fgrid{display:grid;grid-template-columns:1fr .85fr;gap:32px;align-items:center}
.fcard{border-radius:18px;border:1px solid rgba(163,230,53,.2);background:rgba(163,230,53,.04);padding:20px}
.fprice{font-size:44px;font-weight:900;color:#fff;margin:10px 0 4px;font-family:'DM Sans',sans-serif}
.ff{font-size:13px;color:#d4d4d8;display:flex;align-items:center;gap:7px;padding:3px 0}
.ff::before{content:'✓';color:var(--lime);font-weight:800;font-size:11px;flex-shrink:0}
/* TOAST */
.tc{position:fixed;bottom:20px;z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px}
.en .tc{right:20px}
.ar .tc{left:20px}
.toast{background:rgba(15,17,24,.97);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.6);transform:translateX(120%);transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .3s;opacity:0;pointer-events:all;position:relative;overflow:hidden}
.ar .toast{transform:translateX(-120%)}
.toast.on{transform:translateX(0);opacity:1}
.toast.off{transform:translateX(120%);opacity:0}
.ar .toast.off{transform:translateX(-120%)}
.tbar{position:absolute;bottom:0;left:0;height:2px;background:var(--lime);animation:tb linear forwards}
.ar .tbar{left:auto;right:0}
@keyframes tb{from{width:100%}to{width:0}}
footer{border-top:1px solid var(--border);padding:20px 32px;text-align:center;font-size:11px;color:var(--muted2)}
@media(max-width:900px){.hero{grid-template-columns:1fr}.sg2{grid-template-columns:repeat(2,1fr)}.fgrid{grid-template-columns:1fr}.sgrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.sg2,.egrid{grid-template-columns:1fr}nav{padding:12px 16px}.hero{padding:32px 16px 24px}.sec{padding:0 16px 40px}}
</style>
</head>
<body class="en">
<div class="tc" id="tc"></div>
<nav>
  <div class="logo">
    <div class="lbox">X</div>
    <div>
      <div class="lname">SEAT<em>X</em></div>
      <div class="lsub" id="n-sub">Live seat market intelligence</div>
    </div>
  </div>
  <div class="nav-r">
    <div class="ltog">
      <button class="lb on" onclick="setLang('en')">EN</button>
      <button class="lb" onclick="setLang('ar')">AR</button>
    </div>
    <button class="obtn" id="n-si">Sign in</button>
    <button class="gbtn" id="n-st" onclick="document.getElementById('add').scrollIntoView({behavior:'smooth'})">Start watching</button>
  </div>
</nav>

<section class="hero">
  <div>
    <div class="badges">
      <span class="badge bg" id="b1">Real-time alerts</span>
      <span class="badge bo" id="b2">Hot events feed</span>
      <span class="badge bb" id="b3">Saudi-first</span>
    </div>
    <h1><span id="hm">The seat market,</span><br><em id="ha">live.</em></h1>
    <p class="sub" id="hs">Track hot events, watch demand move, and get alerted before the crowd.</p>
    <div class="hbtns">
      <button class="gbtn" id="hb1" onclick="document.getElementById('add').scrollIntoView({behavior:'smooth'})">Start watching</button>
      <button class="obtn" id="hb2" onclick="document.getElementById('evs').scrollIntoView({behavior:'smooth'})">View events ↓</button>
    </div>
    <div class="wpill">
      <div class="wavs">
        <div class="wav" style="background:#1e3a2e">🧑</div>
        <div class="wav" style="background:#2e1e3a">👤</div>
        <div class="wav" style="background:#3a2e1e">🙋</div>
        <div class="wav" style="background:#1e2e3a">👥</div>
      </div>
      <span class="wcnt" id="wc">8,247</span>
      <span id="wl">&nbsp;watching right now</span>
    </div>
    <div class="sgrid" style="margin-top:16px">
      <div class="sc"><div class="sl" id="s1l">Alerts today</div><div class="sv" id="s1v">1,932</div></div>
      <div class="sc"><div class="sl" id="s2l">Check speed</div><div class="sv" id="s2v">15s</div></div>
      <div class="sc"><div class="sl" id="s3l">Events live</div><div class="sv" id="s3v">${events.length}</div></div>
    </div>
  </div>
  <div class="fw">
    <div class="fi2">
      <div class="fhdr">
        <div>
          <div style="font-size:13px;font-weight:600;color:#fff" id="ft">Live seat market</div>
          <div style="font-size:11px;color:var(--muted)" id="fs">Updating every few seconds</div>
        </div>
        <span class="badge bl">Live</span>
      </div>
      <div class="flist" id="flist"></div>
      <div class="fhot">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--lime);font-weight:700" id="fhl">🔥 Hottest right now</div>
        <div style="font-size:17px;font-weight:800;color:#fff;margin-top:6px">Al Nassr vs Al Hilal</div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#a1a1aa;margin-top:7px">
          <span><span id="fhc">2,481</span> <span id="fhm1">watching</span></span>
          <span><span id="fhm2">Demand:</span> <strong style="color:#fb923c" id="fhd">High</strong></span>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="sec" id="add">
  <div class="aform">
    <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px" id="af1">Track any event</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:18px" id="af2">We'll alert you the moment seats become available.</p>
    <label id="afl1">Event title</label>
    <input type="text" id="ev-t" placeholder="Al Nassr vs Al Hilal"/>
    <label id="afl2">Ticket URL</label>
    <input type="url" id="ev-u" placeholder="https://ticketmaster.sa/..."/>
    <button class="gbtn" style="width:100%;margin-top:4px;padding:12px" onclick="addEvent()" id="afb">🎟 Track this event</button>
    <div style="text-align:center;font-size:11px;color:var(--muted2);margin-top:10px" id="afn">Free · No account needed</div>
  </div>
</div>

<div class="sec" id="evs">
  <div class="eyebrow" id="ee">Live events</div>
  <h2 class="st" id="eh">What people are watching</h2>
  <div class="egrid">
    ${events.length === 0
      ? '<p style="color:var(--muted);padding:32px 0" id="emp">No events yet — add the first one above 👆</p>'
      : events.map(e => `
    <div class="ecard">
      <div class="ubar"><div class="ul"><div class="udot"></div><span class="cdl">Next check in</span></div><div class="ucd cdv">0:15</div></div>
      <span class="estat ${e.status==='available'?'ea':e.status==='maybe_available'?'em':'eu'}">
        ${e.status==='available'?'⚡ Available':e.status==='maybe_available'?'👀 Maybe':'○ Watching'}
      </span>
      <div class="etitle">${e.title}</div>
      <div class="eurl">${e.event_url}</div>
      <input class="einput" id="em-${e.id}" placeholder="your@email.com"/>
      <button class="abtn" onclick="subscribe(${e.id})">Get Alert</button>
    </div>`).join('')}
  </div>
</div>

<div class="sec">
  <div class="eyebrow" id="ste">How it works</div>
  <h2 class="st" id="stt">Three steps. That is it.</h2>
  <div class="sg2">
    <div class="scard"><div class="stop"><svg class="sicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="snum">01</span></div><div style="font-size:16px;font-weight:700;color:#fff" id="s1t">Pick an event</div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" id="s1d">Browse events or paste any ticket page URL.</div></div>
    <div class="scard"><div class="stop"><svg class="sicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span class="snum">02</span></div><div style="font-size:16px;font-weight:700;color:#fff" id="s2t">We watch the market</div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" id="s2d">SeatX checks every 15 seconds — availability, demand, changes.</div></div>
    <div class="scard"><div class="stop"><svg class="sicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg><span class="snum">03</span></div><div style="font-size:16px;font-weight:700;color:#fff" id="s3t">You get alerted first</div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" id="s3d">Email the second seats move. Before the crowd knows.</div></div>
  </div>
</div>

<div class="sec">
  <div class="fwrap">
    <div class="fgrid">
      <div>
        <span class="badge bg" id="fob">Founding launch</span>
        <h2 style="font-size:clamp(22px,3vw,38px);font-weight:900;color:#fff;letter-spacing:-.02em;margin-top:14px" id="fot">First 1,000 members get lifetime access.</h2>
        <p style="font-size:15px;line-height:1.75;color:var(--muted);margin-top:10px;max-width:440px" id="fos">Lock in before the price goes up.</p>
        <button class="gbtn" style="margin-top:18px" id="fobtn">Learn more</button>
      </div>
      <div class="fcard">
        <div style="font-size:14px;font-weight:700;color:#fff" id="foct">Founding Pass</div>
        <div class="fprice">$199</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px" id="focs">One-time · First 1,000 only</div>
        <div class="ff" id="fof1">3 lifetime seat alerts</div>
        <div class="ff" id="fof2">Email + Telegram</div>
        <div class="ff" id="fof3">Founding badge</div>
        <div class="ff" id="fof4">Early access to live seat feed</div>
        <button class="gbtn" style="width:100%;margin-top:16px" id="focl">Claim Founding Pass</button>
      </div>
    </div>
  </div>
</div>

<footer id="ft2">© 2025 SeatX · Built for fans · 🇸🇦 Saudi Arabia</footer>

<script>
const DB = ${ej};
const T = {
  en:{
    sub:"Live seat market intelligence",si:"Sign in",st:"Start watching",
    b1:"Real-time alerts",b2:"Hot events feed",b3:"Saudi-first",
    hm:"The seat market,",ha:"live.",
    hs:"Track hot events, watch demand move, and get alerted before the crowd.",
    hb1:"Start watching",hb2:"View events ↓",wl:" watching right now",
    s1l:"Alerts today",s1v:"1,932",s2l:"Check speed",s2v:"15s",s3l:"Events live",
    ft:"Live seat market",fs:"Updating every few seconds",
    fhl:"🔥 Hottest right now",fhm1:"watching",fhm2:"Demand:",fhd:"High",
    af1:"Track any event",af2:"We'll alert you the moment seats become available.",
    afl1:"Event title",afl2:"Ticket URL",
    afb:"🎟 Track this event",afn:"Free · No account needed",
    ee:"Live events",eh:"What people are watching",
    emp:"No events yet — add the first one above 👆",
    cdl:"Next check in",
    ste:"How it works",stt:"Three steps. That is it.",
    s1t:"Pick an event",s1d:"Browse events or paste any ticket page URL.",
    s2t:"We watch the market",s2d:"SeatX checks every 15 seconds — availability, demand, changes.",
    s3t:"You get alerted first",s3d:"Email the second seats move. Before the crowd knows.",
    fob:"Founding launch",fot:"First 1,000 members get lifetime access.",
    fos:"Lock in before the price goes up.",fobtn:"Learn more",
    foct:"Founding Pass",focs:"One-time · First 1,000 only",
    fof1:"3 lifetime seat alerts",fof2:"Email + Telegram",fof3:"Founding badge",fof4:"Early access to live seat feed",
    focl:"Claim Founding Pass",
    ft2:"© 2025 SeatX · Built for fans · 🇸🇦 Saudi Arabia",
    feed:[
      {t:"🔥 143 users started watching Al Nassr vs Al Hilal",h:false},
      {t:"⚡ General Admission seats returned — Al Nassr Derby",h:true},
      {t:"👀 Demand spiking — UFC Riyadh now 1,842 watching",h:false},
      {t:"🚨 Page change detected — Riyadh Season Concert",h:false},
      {t:"⚡ 6 Premium seats available right now",h:true},
    ],
    toasts:[
      {i:"⚡",t:"Seats returned — UFC Riyadh",s:"2 Premium seats appeared. 847 users notified."},
      {i:"🔥",t:"Al Nassr Derby — demand spike",s:"542 new users in the last 10 minutes."},
      {i:"🚨",t:"Page change detected",s:"Riyadh Season Concert — availability updated."},
    ],
  },
  ar:{
    sub:"سوق المقاعد المباشر",si:"تسجيل الدخول",st:"ابدأ المتابعة",
    b1:"تنبيهات فورية",b2:"الفعاليات الساخنة",b3:"السوق السعودي أولاً",
    hm:"سوق المقاعد،",ha:"مباشر.",
    hs:"تابع الفعاليات المباعة، راقب حركة الطلب، وخلك أول من يعرف قبل الجميع.",
    hb1:"ابدأ المتابعة",hb2:"شوف الفعاليات ↓",wl:" يتابعون الآن",
    s1l:"تنبيهات اليوم",s1v:"1,932",s2l:"سرعة الفحص",s2v:"15 ث",s3l:"فعاليات مباشرة",
    ft:"السوق المباشر",fs:"يتحدث كل ثوانٍ",
    fhl:"🔥 الأكثر سخونة الآن",fhm1:"يتابعون",fhm2:"الطلب:",fhd:"مرتفع",
    af1:"تابع أي فعالية",af2:"سنبعث لك تنبيهاً فور توفر المقاعد.",
    afl1:"اسم الفعالية",afl2:"رابط التذاكر",
    afb:"🎟 تابع هذه الفعالية",afn:"مجاني · بدون حساب",
    ee:"الفعاليات المباشرة",eh:"ما يتابعه الناس الآن",
    emp:"لا فعاليات بعد — أضف أول واحدة 👆",
    cdl:"الفحص القادم خلال",
    ste:"كيف يعمل",stt:"ثلاث خطوات. بس.",
    s1t:"اختر فعاليتك",s1d:"تصفح الفعاليات أو أضف أي رابط تذاكر مباشرة.",
    s2t:"نحن نراقب السوق",s2d:"SeatX يفحص الصفحة كل 15 ثانية — توفر وطلب وتغييرات.",
    s3t:"تنبيهك يصلك أول",s3d:"إيميل في اللحظة التي تتحرك فيها المقاعد. قبل الجميع.",
    fob:"إطلاق المؤسسين",fot:"أول ألف عضو يحصلون على وصول مدى الحياة.",
    fos:"ثبّت سعرك قبل ارتفاعه.",fobtn:"اعرف أكثر",
    foct:"تصريح المؤسسين",focs:"دفعة واحدة · أول 1,000 فقط",
    fof1:"3 تنبيهات مدى الحياة",fof2:"إيميل + تيليغرام",fof3:"شارة المؤسس",fof4:"وصول مبكر للسوق المباشر",
    focl:"احجز تصريح المؤسسين",
    ft2:"© 2025 SeatX · مبني للمشجعين · 🇸🇦 المملكة العربية السعودية",
    feed:[
      {t:"🔥 143 مستخدم بدأ متابعة النصر ضد الهلال",h:false},
      {t:"⚡ عادت مقاعد الدخول العام — ديربي النصر",h:true},
      {t:"👀 ارتفاع الطلب — UFC الرياض: 1,842 متابع",h:false},
      {t:"🚨 تغيير في صفحة التذاكر — حفل موسم الرياض",h:false},
      {t:"⚡ 6 مقاعد بريميوم متاحة الآن",h:true},
    ],
    toasts:[
      {i:"⚡",t:"مقاعد UFC الرياض عادت",s:"مقعدان بريميوم ظهرا. 847 مستخدم تم تنبيههم."},
      {i:"🔥",t:"ديربي النصر — ارتفاع الطلب",s:"542 مستخدم جديد في 10 دقائق الأخيرة."},
      {i:"🚨",t:"تغيير مرصود في الصفحة",s:"حفل موسم الرياض — تحديث قسم التوفر."},
    ],
  }
};

let lang='en';
function s(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function setLang(l){
  lang=l;
  const isAr=l==='ar';
  document.documentElement.lang=l;
  document.documentElement.dir=isAr?'rtl':'ltr';
  document.body.className=isAr?'ar':'en';
  document.querySelectorAll('.lb').forEach((b,i)=>b.classList.toggle('on',i===(isAr?1:0)));
  const t=T[l];
  s('n-sub',t.sub);s('n-si',t.si);s('n-st',t.st);
  s('b1',t.b1);s('b2',t.b2);s('b3',t.b3);
  s('hm',t.hm);s('ha',t.ha);s('hs',t.hs);
  s('hb1',t.hb1);s('hb2',t.hb2);s('wl',' '+t.wl);
  s('s1l',t.s1l);s('s1v',t.s1v);s('s2l',t.s2l);s('s2v',t.s2v);s('s3l',t.s3l);
  s('ft',t.ft);s('fs',t.fs);s('fhl',t.fhl);s('fhm1',t.fhm1);s('fhm2',t.fhm2);s('fhd',t.fhd);
  s('af1',t.af1);s('af2',t.af2);s('afl1',t.afl1);s('afl2',t.afl2);s('afb',t.afb);s('afn',t.afn);
  const ti=document.getElementById('ev-t');const ui=document.getElementById('ev-u');
  if(ti)ti.placeholder=isAr?'النصر ضد الهلال':'Al Nassr vs Al Hilal';
  if(ui)ui.placeholder=isAr?'رابط التذاكر...':'https://ticketmaster.sa/...';
  s('ee',t.ee);s('eh',t.eh);
  const emp=document.getElementById('emp');if(emp)emp.textContent=t.emp;
  document.querySelectorAll('.cdl').forEach(e=>e.textContent=t.cdl);
  s('ste',t.ste);s('stt',t.stt);
  s('s1t',t.s1t);s('s1d',t.s1d);s('s2t',t.s2t);s('s2d',t.s2d);s('s3t',t.s3t);s('s3d',t.s3d);
  s('fob',t.fob);s('fot',t.fot);s('fos',t.fos);s('fobtn',t.fobtn);
  s('foct',t.foct);s('focs',t.focs);s('fof1',t.fof1);s('fof2',t.fof2);s('fof3',t.fof3);s('fof4',t.fof4);
  s('focl',t.focl);s('ft2',t.ft2);
  initFeed();
}

let fi=0;
function initFeed(){
  const items=T[lang].feed;
  const list=document.getElementById('flist');
  if(!list)return;
  list.innerHTML=items.slice(0,4).map(i=>\`<div class="fi\${i.h?' hot':''}">\${i.t}</div>\`).join('');
}
function rollFeed(){
  const items=T[lang].feed;
  const msg=items[fi%items.length];fi++;
  const list=document.getElementById('flist');if(!list)return;
  const div=document.createElement('div');
  div.className='fi'+(msg.h?' hot':'');div.textContent=msg.t;
  div.style.cssText='opacity:0;transform:translateY(-8px);transition:opacity .4s,transform .4s';
  list.insertBefore(div,list.firstChild);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{div.style.opacity='1';div.style.transform='';}));
  while(list.children.length>4){const l=list.lastChild;l.style.transition='opacity .3s';l.style.opacity='0';setTimeout(()=>l.remove(),320);}
}
setInterval(rollFeed,5500);

const ctrs={wc:8247,fhc:2481};
setInterval(()=>{
  const keys=Object.keys(ctrs);
  const key=keys[Math.floor(Math.random()*keys.length)];
  ctrs[key]=Math.max(800,ctrs[key]+Math.floor(Math.random()*3)-1);
  const el=document.getElementById(key);
  if(el){el.textContent=ctrs[key].toLocaleString();el.style.transition='transform .2s';el.style.transform='scale(1.08)';setTimeout(()=>el.style.transform='',250);}
},3000);

let cdv={};
document.querySelectorAll('.cdv').forEach((el,i)=>{cdv[i]=Math.floor(Math.random()*15);el.textContent='0:'+String(cdv[i]).padStart(2,'0');});
setInterval(()=>{
  document.querySelectorAll('.cdv').forEach((el,i)=>{
    if(cdv[i]===undefined)cdv[i]=15;
    cdv[i]--;if(cdv[i]<0)cdv[i]=15;
    const v=cdv[i];el.textContent='0:'+String(v).padStart(2,'0');
    if(v===0||v===15){el.style.color='var(--lime)';el.style.textShadow='0 0 8px rgba(163,230,53,.8)';setTimeout(()=>{el.style.color='';el.style.textShadow='';},600);}
  });
},1000);

let ti2=0;
function showToast(){
  const ts=T[lang].toasts;const d=ts[ti2%ts.length];ti2++;
  const tc=document.getElementById('tc');
  const t=document.createElement('div');t.className='toast';
  t.style.fontFamily=lang==='ar'?"'IBM Plex Sans Arabic',sans-serif":"'DM Sans',sans-serif";
  if(lang==='ar')t.style.direction='rtl';
  t.innerHTML=\`<div style="font-size:20px;flex-shrink:0">\${d.i}</div><div><div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:3px">\${d.t}</div><div style="font-size:11px;color:var(--muted);line-height:1.5">\${d.s}</div></div><div class="tbar" style="animation-duration:5000ms"></div>\`;
  tc.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('on')));
  setTimeout(()=>{t.classList.add('off');t.classList.remove('on');setTimeout(()=>t.remove(),400);},5000);
}
setTimeout(()=>{showToast();setInterval(showToast,9000+Math.random()*3000);},3000);

async function addEvent(){
  const title=document.getElementById('ev-t').value.trim();
  const url=document.getElementById('ev-u').value.trim();
  if(!title||!url){alert(lang==='ar'?'أكمل جميع الحقول':'Fill all fields');return;}
  const btn=document.getElementById('afb');
  btn.textContent=lang==='ar'?'جاري الإضافة...':'Adding...';btn.disabled=true;
  try{await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,eventUrl:url})});location.reload();}
  catch(e){alert('Error');btn.disabled=false;}
}

async function subscribe(id){
  const email=document.getElementById('em-'+id)?.value?.trim();
  if(!email||!email.includes('@')){alert(lang==='ar'?'أدخل بريد صحيح':'Enter valid email');return;}
  await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:id,email})});
  alert(lang==='ar'?'✅ تم! سنبعث لك تنبيهاً عند توفر المقاعد.':'✅ Alert set! We will email you when seats appear.');
}

document.addEventListener('DOMContentLoaded',()=>{setLang('en');});
</script>
</body>
</html>`;
}

app.get('/', async (req, res) => {
  let events = [];
  try { const r = await pool.query('SELECT * FROM events ORDER BY created_at DESC'); events = r.rows; } catch(e){}
  res.setHeader('Content-Type','text/html');
  res.end(getHTML(events));
});

app.post('/api/events', async (req, res) => {
  try {
    const {title,eventUrl} = req.body;
    if(!title||!eventUrl) return res.status(400).json({error:'Missing fields'});
    const r = await pool.query('INSERT INTO events (title,event_url) VALUES ($1,$2) RETURNING *',[title,eventUrl]);
    res.json(r.rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const {eventId,email} = req.body;
    await pool.query('INSERT INTO subscriptions (event_id,email) VALUES ($1,$2)',[eventId,email]);
    res.json({success:true});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/monitor', async (req, res) => {
  try {
    const evs = await pool.query("SELECT * FROM events");
    const results = [];
    for(const ev of evs.rows){
      try{
        const r = await fetch(ev.event_url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(10000)});
        const html = await r.text();
        const lower = html.toLowerCase();
        const pos = ['buy now','available','add to cart','select seats','get tickets'].filter(s=>lower.includes(s));
        const neg = ['sold out','unavailable','coming soon'].filter(s=>lower.includes(s));
        let status = 'unavailable';
        if(pos.length>0&&neg.length===0) status='available';
        else if(pos.length>0) status='maybe_available';
        await pool.query('UPDATE events SET status=$1,last_checked=NOW() WHERE id=$2',[status,ev.id]);
        results.push({id:ev.id,title:ev.title,status});
      } catch(err){ results.push({id:ev.id,error:err.message}); }
    }
    res.json({checked:results.length,results});
  } catch(e){ res.status(500).json({error:e.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await setupDB();
  console.log('SeatX running on port ' + PORT);
});
// Auto monitor every 15 seconds
setInterval(async () => {
  try {
    await fetch(`http://localhost:${PORT}/api/monitor`);
  } catch(e) {}
}, 15000);
