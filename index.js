<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SeatX — The seat market, live.</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0b0f;--bg2:#11141b;--bg3:rgba(255,255,255,0.03);
  --border:rgba(255,255,255,0.09);--border2:rgba(255,255,255,0.05);
  --lime:#a3e635;--lime-hover:#bef264;
  --orange:#f97316;--green:#4ade80;
  --text:#f4f4f5;--muted:#71717a;--muted2:#3f3f46;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;min-height:100vh;padding-bottom:88px;overflow-x:hidden}
body.lang-en{font-family:'DM Sans',sans-serif}
body.lang-ar{font-family:'IBM Plex Sans Arabic',sans-serif}

/* ── LOGO ── */
.logo-wrap{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}
.logo-icon{width:38px;height:38px;border-radius:12px;background:rgba(163,230,53,0.08);border:1px solid rgba(163,230,53,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-icon-x{font-size:20px;font-weight:900;color:var(--lime);filter:drop-shadow(0 0 8px rgba(163,230,53,0.8));font-family:'DM Sans',sans-serif}
.logo-text{display:flex;align-items:baseline;gap:1px}
.logo-seat{font-size:17px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif}
.logo-x{font-size:21px;font-weight:900;color:var(--lime);filter:drop-shadow(0 0 10px rgba(163,230,53,0.7));font-family:'DM Sans',sans-serif}
.logo-sub{font-size:10px;color:var(--muted);margin-top:1px}

/* ── LANG TOGGLE ── */
.lang-toggle{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:10px;padding:3px}
.lang-btn{background:none;border:none;border-radius:7px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;color:#71717a;font-family:'DM Sans',sans-serif}
.lang-btn.active{background:var(--lime);color:#000}
.lang-btn:not(.active):hover{color:#fff;background:rgba(255,255,255,.06)}

/* ── BADGE ── */
.badge{display:inline-flex;align-items:center;border-radius:100px;border:1px solid;padding:3px 10px;font-size:11px;font-weight:600;line-height:1.5;white-space:nowrap}
.badge-default{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#a1a1aa}
.badge-hot{border-color:rgba(249,115,22,.25);background:rgba(249,115,22,.1);color:#fb923c}
.badge-green{border-color:rgba(163,230,53,.22);background:rgba(163,230,53,.1);color:var(--lime)}
.badge-blue{border-color:rgba(56,189,248,.22);background:rgba(56,189,248,.1);color:#7dd3fc}
.badge-live{border-color:rgba(248,113,113,.22);background:rgba(248,113,113,.1);color:#f87171;display:flex;align-items:center;gap:5px}
.badge-live::before{content:'';width:5px;height:5px;border-radius:50%;background:#f87171;animation:pr 1.8s infinite;flex-shrink:0}
@keyframes pr{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.6)}50%{box-shadow:0 0 0 4px rgba(248,113,113,0)}}

/* ── NAV ── */
.nav{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--border);background:rgba(10,11,15,.9);backdrop-filter:blur(20px)}
.nav-inner{max-width:1280px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-links{display:flex;align-items:center;gap:20px}
.nav-links button{background:none;border:none;font-size:13px;color:#71717a;cursor:pointer;transition:color .15s}
.nav-links button:hover,.nav-links button.active{color:#fff;font-weight:600}
.nav-right{display:flex;align-items:center;gap:8px}
.btn-ghost{background:none;border:1px solid var(--border);border-radius:10px;padding:7px 14px;font-size:13px;color:#a1a1aa;cursor:pointer;transition:all .15s}
.btn-ghost:hover{border-color:rgba(255,255,255,.2);color:#fff}
.btn-lime{background:var(--lime);border:none;border-radius:10px;padding:7px 16px;font-size:13px;font-weight:700;color:#000;cursor:pointer;transition:background .15s}
.btn-lime:hover{background:var(--lime-hover)}
.btn-lime-lg{background:var(--lime);border:none;border-radius:14px;padding:12px 24px;font-size:14px;font-weight:700;color:#000;cursor:pointer;transition:background .15s,transform .1s,box-shadow .15s}
.btn-lime-lg:hover{background:var(--lime-hover);transform:translateY(-1px);box-shadow:0 8px 24px rgba(163,230,53,0.25)}
.btn-outline-lg{background:none;border:1px solid var(--border);border-radius:14px;padding:12px 24px;font-size:14px;font-weight:600;color:#d4d4d8;cursor:pointer;transition:all .15s}
.btn-outline-lg:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.03)}

/* ── PAGES ── */
.page{display:none;max-width:1280px;margin:0 auto;padding:36px 24px 20px}
.page.active{display:block}
.eyebrow{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.22em;color:var(--muted);margin-bottom:10px}
h2.sec-title{font-size:clamp(24px,3.5vw,36px);font-weight:900;letter-spacing:-.02em;color:#fff}
.sec-sub{font-size:15px;line-height:1.75;color:var(--muted);margin-top:12px;max-width:540px}
.card{border-radius:20px;border:1px solid var(--border);background:var(--bg3);padding:22px}
.card-dark{border-radius:16px;border:1px solid var(--border);background:rgba(0,0,0,.25);padding:16px}

/* ── TOAST ── */
.toast-container{position:fixed;bottom:100px;z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:320px}
[dir=ltr] .toast-container{right:20px}
[dir=rtl] .toast-container{left:20px}
.toast{background:rgba(15,17,24,0.97);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 16px 40px rgba(0,0,0,.6);transform:translateX(120%);transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .3s;opacity:0;pointer-events:all;position:relative;overflow:hidden}
[dir=rtl] .toast{transform:translateX(-120%)}
.toast.show{transform:translateX(0);opacity:1}
.toast.hide{transform:translateX(120%);opacity:0}
[dir=rtl] .toast.hide{transform:translateX(-120%)}
.toast-icon{font-size:20px;flex-shrink:0;margin-top:1px}
.toast-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:3px}
.toast-sub{font-size:11px;color:var(--muted);line-height:1.5}
.toast-bar{position:absolute;bottom:0;height:2px;border-radius:0 0 16px 16px;background:var(--lime);animation:toastbar linear forwards}
[dir=ltr] .toast-bar{left:0}
[dir=rtl] .toast-bar{right:0}
@keyframes toastbar{from{width:100%}to{width:0%}}

/* ── URGENCY BAR ── */
.urgency-bar{background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.18);border-radius:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.urgency-left{display:flex;align-items:center;gap:8px;font-size:12px;color:#fb923c;font-weight:600}
.urgency-dot{width:6px;height:6px;border-radius:50%;background:#fb923c;animation:pr 1.5s infinite;flex-shrink:0}
.urgency-countdown{font-size:13px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;font-family:'DM Sans',sans-serif}

/* ── HERO ── */
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
h1.hero-title{font-size:clamp(40px,6vw,76px);font-weight:900;line-height:.95;letter-spacing:-.03em;color:#fff;margin-top:16px}
.lang-ar h1.hero-title{letter-spacing:0;line-height:1.15}
h1.hero-title .accent{color:var(--lime);filter:drop-shadow(0 0 24px rgba(163,230,53,0.4))}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:28px}
.stat-card{border-radius:20px;border:1px solid var(--border);background:var(--bg3);padding:18px}
.stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)}
.lang-ar .stat-label{letter-spacing:0}
.stat-val{font-size:24px;font-weight:800;color:#fff;margin-top:6px;font-family:'DM Sans',sans-serif}

/* Feed widget */
.feed-widget{border-radius:24px;border:1px solid var(--border);background:rgba(255,255,255,.02);padding:18px;box-shadow:0 32px 64px rgba(0,0,0,.5)}
.feed-inner{border-radius:18px;border:1px solid var(--border);background:var(--bg2);padding:18px}
.feed-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.feed-list{display:flex;flex-direction:column;gap:7px;min-height:160px}
.feed-item{border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:11px 14px;font-size:12px;color:#d4d4d8;line-height:1.6;transition:all .5s ease}
.feed-item.new{border-color:rgba(163,230,53,.2);background:rgba(163,230,53,.04)}
.feed-hot{margin-top:14px;border-radius:12px;border:1px solid rgba(163,230,53,.18);background:rgba(163,230,53,.06);padding:14px}

/* Events */
.events-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
.ev-card{border-radius:20px;border:1px solid var(--border);background:var(--bg3);padding:22px;transition:border-color .2s,transform .2s;cursor:pointer}
.ev-card:hover{border-color:rgba(163,230,53,.25);transform:translateY(-3px)}
.ev-title{font-size:19px;font-weight:900;color:#fff;margin-top:12px;line-height:1.2}
.ev-cat{font-size:12px;color:var(--muted);margin-top:4px}
.ev-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
.ev-stat{border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:12px}
.ev-stat-label{font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)}
.lang-ar .ev-stat-label{letter-spacing:0}
.ev-stat-val{font-size:18px;font-weight:700;color:#fff;margin-top:4px;font-family:'DM Sans',sans-serif}

/* Steps */
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
.step-card{border-radius:20px;border:1px solid var(--border);background:var(--bg3);padding:22px}
.step-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.step-icon{color:var(--lime);width:28px;height:28px}
.step-num{font-size:12px;font-weight:700;color:var(--muted2);font-family:'DM Sans',sans-serif}

/* Founding */
.founding-wrap{border-radius:28px;border:1px solid var(--border);background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.01));padding:36px}
.founding-grid{display:grid;grid-template-columns:1fr .85fr;gap:36px;align-items:center}
.founding-card{border-radius:20px;border:1px solid rgba(163,230,53,.2);background:rgba(163,230,53,.04);padding:22px}
.founding-price{font-size:48px;font-weight:900;color:#fff;margin-top:14px;font-family:'DM Sans',sans-serif}
.founding-feature{font-size:13px;color:#d4d4d8;display:flex;align-items:center;gap:8px;padding:4px 0}
.founding-feature::before{content:'✓';color:var(--lime);font-weight:800;font-size:12px;font-family:'DM Sans',sans-serif;flex-shrink:0}

/* Dashboard */
.dash-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:28px}
.dash-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.dstat{border-radius:20px;border:1px solid var(--border);background:var(--bg3);padding:18px}
.dstat-icon{color:var(--lime);width:22px;height:22px;margin-bottom:12px}
.dstat-val{font-size:28px;font-weight:900;color:#fff;margin-top:4px;font-family:'DM Sans',sans-serif}
.dash-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-bottom:16px}
.table-wrap{border-radius:20px;border:1px solid var(--border);overflow:hidden}
.table-head{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr;gap:16px;padding:13px 18px;background:rgba(0,0,0,.2);border-bottom:1px solid var(--border)}
.table-head span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)}
.lang-ar .table-head span{letter-spacing:0}
.table-row{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr;gap:16px;padding:13px 18px;border-bottom:1px solid var(--border2);font-size:13px;color:#d4d4d8}
.table-row:last-child{border-bottom:none}
.table-row:hover{background:rgba(255,255,255,.02)}
.status-watching{color:var(--muted)}
.status-sent{color:var(--lime);font-weight:600}

/* Pricing */
.pricing-header{text-align:center;max-width:580px;margin:0 auto 44px}
.plans-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.plan-card{border-radius:24px;border:1px solid var(--border);background:var(--bg3);padding:26px;display:flex;flex-direction:column}
.plan-card.featured{border-color:rgba(163,230,53,.3);background:rgba(163,230,53,.04)}
.plan-price{font-size:48px;font-weight:900;color:#fff;margin:20px 0;line-height:1;font-family:'DM Sans',sans-serif}
.plan-feature{font-size:13px;color:#d4d4d8;display:flex;align-items:center;gap:8px;padding:3px 0}
.plan-feature::before{content:'•';color:var(--lime);flex-shrink:0}
.launch-box{border-radius:24px;border:1px solid var(--border);background:var(--bg3);padding:28px;margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px}
.urgency-tag-p{border-radius:12px;border:1px solid rgba(249,115,22,.22);background:rgba(249,115,22,.08);padding:8px 16px;font-size:12px;font-weight:600;color:#fb923c}

/* Event page */
.event-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:28px}
.event-title{font-size:clamp(32px,5vw,54px);font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1.05}
.lang-ar .event-title{letter-spacing:0;line-height:1.2}
.event-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:24px}
.event-stat{border-radius:18px;border:1px solid var(--border);background:var(--bg3);padding:15px}
.demand-bar{height:6px;border-radius:100px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:6px}
.demand-fill{height:100%;border-radius:100px;background:linear-gradient(to right,var(--lime),#f97316,#ef4444);transition:width 1.2s cubic-bezier(.22,1,.36,1)}
.tiers{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.tier-row{border-radius:14px;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
.tier-avail{font-size:12px;font-weight:700}
.tier-avail.available{color:var(--green)}
.tier-avail.limited{color:#fb923c}
.tier-avail.soldout{color:#f87171}
.form-input,.form-select{width:100%;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.2);padding:11px 14px;font-size:13px;color:#fff;outline:none;transition:border-color .2s,box-shadow .2s;margin-bottom:10px}
.form-input::placeholder{color:var(--muted2)}
.form-input:focus,.form-select:focus{border-color:rgba(163,230,53,.4);box-shadow:0 0 0 3px rgba(163,230,53,.08)}
.lang-ar .form-input,.lang-ar .form-select{text-align:right}

/* Almost modal */
.modal-bg{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .25s}
.modal-bg.open{opacity:1;pointer-events:all}
.modal{background:#0f1117;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:36px;max-width:420px;width:100%;box-shadow:0 40px 80px rgba(0,0,0,.8);transform:translateY(20px);transition:transform .3s cubic-bezier(.22,1,.36,1);position:relative}
.modal-bg.open .modal{transform:translateY(0)}
.modal-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.07);border:none;border-radius:50%;width:28px;height:28px;color:#71717a;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
[dir=rtl] .modal-close{right:auto;left:14px}
.almost-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
.almost-stat{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center}
.almost-stat-val{font-size:20px;font-weight:900;color:#fff;margin-bottom:4px;font-family:'DM Sans',sans-serif}
.almost-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.lang-ar .almost-stat-label{letter-spacing:0}
.almost-stat.highlight .almost-stat-val{color:var(--lime)}

/* Bottom nav */
.bottom-nav{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:100;width:calc(100% - 28px);max-width:480px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:rgba(8,10,14,.92);backdrop-filter:blur(24px);padding:7px}
.bottom-nav-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.tab-btn{display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 6px;border-radius:12px;border:none;background:none;font-size:11px;font-weight:500;color:#52525b;cursor:pointer;transition:all .15s;white-space:nowrap}
.tab-btn svg{width:14px;height:14px;flex-shrink:0}
.tab-btn.active{background:var(--lime);color:#000;font-weight:700}
.tab-btn:not(.active):hover{background:rgba(255,255,255,.05);color:#a1a1aa}

/* Watching pill */
.watching-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;padding:4px 12px 4px 8px;font-size:12px;color:#a1a1aa;margin-top:14px}
[dir=rtl] .watching-pill{padding:4px 8px 4px 12px}
.watching-avatars{display:flex}
.watching-avatar{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--bg);margin-left:-5px;font-size:9px;display:flex;align-items:center;justify-content:center}
[dir=rtl] .watching-avatar{margin-left:0;margin-right:-5px}
.watching-avatar:first-child{margin-left:0}
[dir=rtl] .watching-avatar:first-child{margin-right:0}
.watching-count{font-weight:700;color:#fff;font-family:'DM Sans',sans-serif}

/* Responsive */
@media(max-width:920px){.hero-grid,.founding-grid,.dash-grid,.event-grid{grid-template-columns:1fr}.events-grid,.steps-grid,.plans-grid,.dash-stats{grid-template-columns:repeat(2,1fr)}.event-stats{grid-template-columns:repeat(2,1fr)}.stats-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.events-grid,.steps-grid,.plans-grid,.dash-stats{grid-template-columns:1fr}.nav-links{display:none}.page{padding:20px 14px}.toast-container{right:10px;left:10px;max-width:none}}
</style>
</head>
<body class="lang-en">

<!-- TRANSLATIONS -->
<script>
const COPY = {
  en: {
    logoSub: "Live seat market intelligence",
    navHome: "Home", navMarket: "Market", navDashboard: "Dashboard", navPricing: "Pricing",
    signIn: "Sign in", startWatching: "Start watching",
    heroBadge1: "Real-time alerts", heroBadge2: "Hot events feed", heroBadge3: "Saudi-first",
    heroTitle: "The seat market,", heroAccent: "live.",
    heroSub: "Track hot events, watch demand move, and get alerted before the crowd.",
    heroBtn1: "Start watching", heroBtn2: "View live market →",
    watchersLabel: "watching right now",
    stat1Label: "Alerts sent today", stat1Val: "1,932",
    stat2Label: "Check speed", stat2Val: "15s",
    stat3Label: "Hot events live",
    feedTitle: "Live seat market", feedSub: "Updating every few seconds",
    feedHotLabel: "🔥 Hottest right now",
    feedHotMeta1: "watching", feedHotMeta2: "Demand:",
    sectionHotEyebrow: "Hot events", sectionHotTitle: "What people are watching now",
    sectionHotBtn: "Open live market →",
    trackNow: "Watch market",
    evCat1: "Football · Saudi Pro League", evStatus1: "Fluctuating — drops expected",
    evCat2: "Combat Sports · Kingdom Arena", evStatus2: "Returned seats detected",
    evCat3: "Concert · Boulevard World", evStatus3: "Watching for next drop",
    evStatLabel1: "Watching", evStatLabel2: "Last move",
    stepsEyebrow: "How it works", stepsTitle: "Three steps. That is it.",
    step1Title: "Pick an event", step1Desc: "Browse curated hot events or paste any ticket page URL.",
    step2Title: "We watch the market", step2Desc: "SeatX checks every 15 seconds — availability, demand, sudden changes.",
    step3Title: "You get alerted first", step3Desc: "Email and Telegram the second seats move. Before the crowd knows.",
    foundingBadge: "Founding launch",
    foundingTitle: "First 1,000 members get lifetime access.",
    foundingSub: "Lock in before the price goes up. Built for fans who take seats seriously.",
    foundingBtn: "View pricing →",
    foundingCardTitle: "Founding Pass",
    foundingPriceSub: "One-time · First 1,000 only",
    foundingF1: "3 lifetime seat alerts", foundingF2: "Email + Telegram",
    foundingF3: "Founding badge", foundingF4: "Early access to live seat feed",
    foundingClaim: "Claim Founding Pass",
    dashGreeting: "Dashboard",
    dashTitle: "Your seat command center",
    dashAddBtn: "+ Add alert",
    dashStat1: "Active alerts", dashStat2: "Triggered today", dashStat3: "Plan", dashStat4: "Check speed",
    dashFeedTitle: "Live seat feed", dashFeedSub: "Your watched market right now",
    dashTrendTitle: "Trending now", dashTrendSub: "High demand, high movement",
    dashTableTitle: "Your seat alerts", dashTableSub: "Fast, clear, built for action",
    thEvent: "Event", thTier: "Tier", thStatus: "Status", thLastCheck: "Last check",
    statusWatching: "Watching", statusSent: "Alert sent ⚡",
    pricingBadge: "Pricing",
    pricingTitle: "Simple plans. Strong urgency.",
    pricingSub: "Start free. Upgrade when you're tired of being seconds too late.",
    plan1Name: "Free", plan1Desc: "Try SeatX and watch one event.",
    plan2Name: "Pro", plan2Desc: "For fans watching multiple hot events.",
    plan3Name: "Founding Lifetime", plan3Desc: "First 1,000 users only. Never pay again.",
    bestValue: "Best value",
    plan1F1: "1 active alert", plan1F2: "Delayed checks (~60s)", plan1F3: "Email only",
    plan2F1: "5 active alerts", plan2F2: "Real-time checks (15s)", plan2F3: "Email + Telegram", plan2F4: "Live seat feed",
    plan3F1: "3 lifetime alerts", plan3F2: "Founding badge", plan3F3: "Email + Telegram", plan3F4: "Launch access",
    plan1Cta: "Start Free", plan2Cta: "Go Pro", plan3Cta: "Claim Founding Pass",
    launchTitle: "Founding launch strategy",
    launchDesc: "Use the $199 lifetime pass to generate launch cash, create urgency, and turn early adopters into social proof.",
    launchTag: "🔥 1,000 founding spots only",
    evTags: ["Football", "Hot event", "Riyadh"],
    evDesc: "Follow live seat movement, watch demand spikes, and get the market feel that keeps users coming back daily.",
    evDemandLabel: "Demand", evWatchLabel: "Watching", evLastLabel: "Last move", evStatusLabel: "Status",
    evStatusVal: "Fluctuating",
    evCountdownLabel: "Checking page in",
    evCountdownSuffix: "— last check: no change",
    evActivityTitle: "Live seat activity", evActivitySub: "What changed on this event",
    evTiersTitle: "Seat tiers", evTiersSub: "Live status by category",
    evTier1: "General Admission", evTier1Sub: "High movement detected", evTier1Status: "Limited",
    evTier2: "Premium", evTier2Sub: "Returned seats detected ✨", evTier2Status: "Available",
    evTier3: "VIP", evTier3Sub: "Watch for cancellations", evTier3Status: "Sold Out",
    evFormTitle: "Watch this event", evFormSub: "Alert fires the second seats move",
    evEmailPlaceholder: "your@email.com",
    evTierSelect: "Any available seat", evTierGA: "General Admission", evTierPrem: "Premium", evTierVIP: "VIP",
    evWatchBtn: "Watch this event",
    evDisclaimer: "We monitor public pages and alert you when availability changes. No resale. No auto-buy.",
    evDemandCardLabel: "Demand snapshot",
    d24Low: "24H Low", d24High: "24H High", d7Trend: "7D Trend", dAlertSpeed: "Alert Speed",
    almostTitle: "You almost got in.",
    almostSub: "Seats were available for a few minutes — but they moved fast.",
    almostStat1: "3 min", almostStat1L: "Available for",
    almostStat2: "47", almostStat2L: "People got in",
    almostStat3: "#12", almostStat3L: "Your position",
    almostNudge: "⚡ Pro users get alerts 30 seconds faster. That gap costs seats.",
    almostUpgrade: "Upgrade to Pro — $29/mo",
    almostDismiss: "I'll be quicker next time",
    highLabel: "High", veryHighLabel: "Very High", risingLabel: "Rising ↑", instantLabel: "Instant",
    watchingEvent: "watching this event",
    demandHigh: "High",
  },
  ar: {
    logoSub: "سوق المقاعد المباشر",
    navHome: "الرئيسية", navMarket: "السوق", navDashboard: "لوحة التحكم", navPricing: "الأسعار",
    signIn: "تسجيل الدخول", startWatching: "ابدأ المتابعة",
    heroBadge1: "تنبيهات فورية", heroBadge2: "الفعاليات الساخنة", heroBadge3: "السوق السعودي أولاً",
    heroTitle: "سوق المقاعد،", heroAccent: "مباشر.",
    heroSub: "تابع الفعاليات المباعة، راقب حركة الطلب، وخلك أول من يعرف قبل الجميع.",
    heroBtn1: "ابدأ المتابعة", heroBtn2: "← افتح السوق المباشر",
    watchersLabel: "يتابعون الآن",
    stat1Label: "تنبيهات اليوم", stat1Val: "1,932",
    stat2Label: "سرعة الفحص", stat2Val: "15 ث",
    stat3Label: "فعاليات ساخنة",
    feedTitle: "السوق المباشر", feedSub: "يتحدث كل ثوانٍ",
    feedHotLabel: "🔥 الأكثر سخونة الآن",
    feedHotMeta1: "يتابعون", feedHotMeta2: "الطلب:",
    sectionHotEyebrow: "الفعاليات الساخنة", sectionHotTitle: "ما يتابعه الناس الآن",
    sectionHotBtn: "← افتح السوق المباشر",
    trackNow: "تابع السوق",
    evCat1: "كرة قدم · دوري روشن", evStatus1: "متذبذب — يُتوقع عودة مقاعد",
    evCat2: "رياضات قتالية · ملعب المملكة", evStatus2: "تم رصد مقاعد عائدة",
    evCat3: "حفل موسيقي · بوليفارد الرياض", evStatus3: "بالمراقبة لأول إتاحة",
    evStatLabel1: "المتابعون", evStatLabel2: "آخر حركة",
    stepsEyebrow: "كيف يعمل", stepsTitle: "ثلاث خطوات. بس.",
    step1Title: "اختر فعاليتك", step1Desc: "تصفح الفعاليات الساخنة أو أضف أي رابط تذاكر مباشرة.",
    step2Title: "نحن نراقب السوق", step2Desc: "SeatX يفحص الصفحة كل 15 ثانية — توفر المقاعد، الطلب، والتغييرات المفاجئة.",
    step3Title: "تنبيهك يصلك أول", step3Desc: "إيميل وتيليغرام في اللحظة التي تتحرك فيها المقاعد. قبل أن يعرف أحد.",
    foundingBadge: "إطلاق المؤسسين",
    foundingTitle: "أول ألف عضو يحصلون على وصول مدى الحياة.",
    foundingSub: "ثبّت سعرك قبل ارتفاعه. مبني للمشجعين الجادين.",
    foundingBtn: "← عرض الأسعار",
    foundingCardTitle: "تصريح المؤسسين",
    foundingPriceSub: "دفعة واحدة · أول 1,000 فقط",
    foundingF1: "3 تنبيهات مدى الحياة", foundingF2: "إيميل + تيليغرام",
    foundingF3: "شارة المؤسس", foundingF4: "وصول مبكر للسوق المباشر",
    foundingClaim: "احجز تصريح المؤسسين",
    dashGreeting: "لوحة التحكم",
    dashTitle: "مركز تحكمك في سوق المقاعد",
    dashAddBtn: "+ إضافة تنبيه",
    dashStat1: "تنبيهات نشطة", dashStat2: "تفعّلت اليوم", dashStat3: "الخطة", dashStat4: "سرعة الفحص",
    dashFeedTitle: "السوق المباشر", dashFeedSub: "ما يحدث في سوقك الآن",
    dashTrendTitle: "الأكثر رواجاً", dashTrendSub: "طلب عالٍ وحركة مرتفعة",
    dashTableTitle: "تنبيهاتك", dashTableSub: "سريعة وواضحة وجاهزة للتصرف",
    thEvent: "الفعالية", thTier: "الفئة", thStatus: "الحالة", thLastCheck: "آخر فحص",
    statusWatching: "بالمراقبة", statusSent: "تم الإرسال ⚡",
    pricingBadge: "الأسعار",
    pricingTitle: "خطط بسيطة. وضغط حقيقي.",
    pricingSub: "ابدأ مجاناً. اترقّى حين تمل أن تكون ثوانٍ متأخراً.",
    plan1Name: "مجاني", plan1Desc: "جرّب SeatX وتابع فعالية واحدة.",
    plan2Name: "برو", plan2Desc: "للمشجعين الذين يتابعون أكثر من فعالية.",
    plan3Name: "تصريح المؤسسين", plan3Desc: "أول 1,000 فقط. لا دفع بعد اليوم.",
    bestValue: "الأفضل قيمة",
    plan1F1: "تنبيه نشط واحد", plan1F2: "فحص متأخر (~60 ث)", plan1F3: "إيميل فقط",
    plan2F1: "5 تنبيهات نشطة", plan2F2: "فحص فوري (15 ث)", plan2F3: "إيميل + تيليغرام", plan2F4: "السوق المباشر",
    plan3F1: "3 تنبيهات مدى الحياة", plan3F2: "شارة المؤسس", plan3F3: "إيميل + تيليغرام", plan3F4: "وصول مبكر",
    plan1Cta: "ابدأ مجاناً", plan2Cta: "اشترك في برو", plan3Cta: "احجز تصريح المؤسسين",
    launchTitle: "استراتيجية إطلاق المؤسسين",
    launchDesc: "استخدم تصريح الـ199$ لتوليد عائد في اليوم الأول وبناء قاعدة مؤمنين بالمنتج.",
    launchTag: "🔥 1,000 مقعد تأسيسي فقط",
    evTags: ["كرة القدم", "فعالية ساخنة", "الرياض"],
    evDesc: "تابع حركة المقاعد مباشرة، راقب ارتفاع الطلب، وعش تجربة السوق الحي التي تخليك تعود يومياً.",
    evDemandLabel: "الطلب", evWatchLabel: "المتابعون", evLastLabel: "آخر حركة", evStatusLabel: "الحالة",
    evStatusVal: "متذبذب",
    evCountdownLabel: "الفحص القادم خلال",
    evCountdownSuffix: "— آخر فحص: لا تغيير",
    evActivityTitle: "النشاط المباشر", evActivitySub: "آخر التغييرات على هذه الفعالية",
    evTiersTitle: "فئات المقاعد", evTiersSub: "الحالة المباشرة لكل فئة",
    evTier1: "دخول عام", evTier1Sub: "حركة عالية مرصودة", evTier1Status: "محدود",
    evTier2: "بريميوم", evTier2Sub: "مقاعد عادت للتوفر ✨", evTier2Status: "متاح",
    evTier3: "VIP", evTier3Sub: "بالمراقبة للإلغاءات", evTier3Status: "نفدت",
    evFormTitle: "تابع هذه الفعالية", evFormSub: "تنبيهك يصل فور تحرك المقاعد",
    evEmailPlaceholder: "بريدك@الإلكتروني.com",
    evTierSelect: "أي مقعد متاح", evTierGA: "دخول عام", evTierPrem: "بريميوم", evTierVIP: "VIP",
    evWatchBtn: "تابع هذه الفعالية",
    evDisclaimer: "نراقب صفحات التذاكر العامة وننبهك عند تغير التوفر. لا إعادة بيع. لا شراء تلقائي.",
    evDemandCardLabel: "لقطة الطلب",
    d24Low: "أدنى 24س", d24High: "أعلى 24س", d7Trend: "7 أيام", dAlertSpeed: "سرعة التنبيه",
    almostTitle: "كنت على وشك الدخول.",
    almostSub: "كانت المقاعد متاحة لدقائق — لكنها تحركت بسرعة.",
    almostStat1: "3 د", almostStat1L: "مدة التوفر",
    almostStat2: "47", almostStat2L: "دخلوا",
    almostStat3: "#12", almostStat3L: "ترتيبك",
    almostNudge: "⚡ مستخدمو برو يصلهم التنبيه قبل 30 ثانية. هذا الفرق يكلّف مقعداً.",
    almostUpgrade: "اشترك في برو — 29$/شهر",
    almostDismiss: "سأكون أسرع المرة القادمة",
    highLabel: "مرتفع", veryHighLabel: "مرتفع جداً", risingLabel: "صاعد ↑", instantLabel: "فوري",
    watchingEvent: "يتابعون هذه الفعالية",
    demandHigh: "مرتفع",
  }
};

let currentLang = 'en';

function t(key) { return COPY[currentLang][key] || COPY.en[key] || key; }

function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.body.className = isAr ? 'lang-ar' : 'lang-en';

  // Update all lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Nav buttons
  document.querySelectorAll('.nav-links button').forEach(btn => {
    const key = btn.dataset.copy;
    if (key) btn.textContent = t(key);
  });

  // Update everything with data-copy attributes
  document.querySelectorAll('[data-copy]').forEach(el => {
    const key = el.dataset.copy;
    if (el.tagName === 'INPUT') {
      if (el.type !== 'submit') el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });

  // Toggle font for nav buttons
  document.querySelectorAll('.nav-links button, .btn-ghost, .btn-lime, .btn-lime-lg, .btn-outline-lg, .tab-btn').forEach(btn => {
    btn.style.fontFamily = isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'DM Sans', sans-serif";
  });
}
</script>

<!-- TOAST CONTAINER -->
<div class="toast-container" id="toast-container"></div>

<!-- ALMOST GOT IT MODAL -->
<div class="modal-bg" id="almost-modal">
  <div class="modal">
    <button class="modal-close" onclick="closeAlmost()">✕</button>
    <div style="font-size:48px;text-align:center;margin-bottom:16px;animation:shake .5s ease .3s">😤</div>
    <div style="font-size:22px;font-weight:900;color:#fff;text-align:center;margin-bottom:8px" data-copy="almostTitle"></div>
    <div style="font-size:13px;color:var(--muted);text-align:center;line-height:1.65;margin-bottom:24px" data-copy="almostSub"></div>
    <div class="almost-stats">
      <div class="almost-stat"><div class="almost-stat-val" data-copy="almostStat1"></div><div class="almost-stat-label" data-copy="almostStat1L"></div></div>
      <div class="almost-stat"><div class="almost-stat-val" data-copy="almostStat2"></div><div class="almost-stat-label" data-copy="almostStat2L"></div></div>
      <div class="almost-stat highlight"><div class="almost-stat-val" data-copy="almostStat3"></div><div class="almost-stat-label" data-copy="almostStat3L"></div></div>
    </div>
    <div style="background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);border-radius:14px;padding:14px;margin-bottom:20px;font-size:13px;color:#fb923c;text-align:center;line-height:1.6" data-copy="almostNudge"></div>
    <button class="btn-lime-lg" style="width:100%;margin-bottom:10px" onclick="closeAlmost();showPage('pricing',null)" data-copy="almostUpgrade"></button>
    <button class="btn-outline-lg" style="width:100%;font-size:13px" onclick="closeAlmost()" data-copy="almostDismiss"></button>
  </div>
</div>
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}

<!-- NAV -->
<header class="nav">
  <div class="nav-inner">
    <div class="logo-wrap" onclick="showPage('landing',null)">
      <div class="logo-icon"><span class="logo-icon-x">X</span></div>
      <div>
        <div class="logo-text"><span class="logo-seat">SEAT</span><span class="logo-x">X</span></div>
        <div class="logo-sub" data-copy="logoSub"></div>
      </div>
    </div>
    <nav class="nav-links">
      <button class="active" data-copy="navHome" onclick="showPage('landing',this)"></button>
      <button data-copy="navMarket" onclick="showPage('event',this)"></button>
      <button data-copy="navDashboard" onclick="showPage('dashboard',this)"></button>
      <button data-copy="navPricing" onclick="showPage('pricing',this)"></button>
    </nav>
    <div class="nav-right">
      <!-- Lang toggle -->
      <div class="lang-toggle">
        <button class="lang-btn active" data-lang="en" onclick="applyLang('en')">EN</button>
        <button class="lang-btn" data-lang="ar" onclick="applyLang('ar')">AR</button>
      </div>
      <button class="btn-ghost" data-copy="signIn"></button>
      <button class="btn-lime" data-copy="startWatching"></button>
    </div>
  </div>
</header>

<!-- ══════════════ LANDING ══════════════ -->
<div class="page active" id="page-landing">
  <section style="padding-bottom:60px">
    <div class="hero-grid">
      <div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <span class="badge badge-green" data-copy="heroBadge1"></span>
          <span class="badge badge-hot" data-copy="heroBadge2"></span>
          <span class="badge badge-blue" data-copy="heroBadge3"></span>
        </div>
        <h1 class="hero-title" style="margin-top:16px">
          <span data-copy="heroTitle"></span><br>
          <span class="accent" data-copy="heroAccent"></span>
        </h1>
        <p style="font-size:16px;line-height:1.75;color:var(--muted);margin-top:16px;max-width:480px" data-copy="heroSub"></p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px">
          <button class="btn-lime-lg" data-copy="heroBtn1"></button>
          <button class="btn-outline-lg" onclick="showPage('event',null)" data-copy="heroBtn2"></button>
        </div>
        <div class="watching-pill">
          <div class="watching-avatars">
            <div class="watching-avatar" style="background:#1e3a2e">🧑</div>
            <div class="watching-avatar" style="background:#2e1e3a">👤</div>
            <div class="watching-avatar" style="background:#3a2e1e">🙋</div>
            <div class="watching-avatar" style="background:#1e2e3a">👥</div>
          </div>
          <span class="watching-count" id="hero-watchers">8,247</span>
          <span data-copy="watchersLabel"></span>
        </div>
        <div class="stats-grid" style="margin-top:18px">
          <div class="stat-card"><div class="stat-label" data-copy="stat1Label"></div><div class="stat-val" data-copy="stat1Val"></div></div>
          <div class="stat-card"><div class="stat-label" data-copy="stat2Label"></div><div class="stat-val" data-copy="stat2Val"></div></div>
          <div class="stat-card"><div class="stat-label" data-copy="stat3Label"></div><div class="stat-val" id="hot-count">20</div></div>
        </div>
      </div>
      <!-- Feed widget -->
      <div class="feed-widget">
        <div class="feed-inner">
          <div class="feed-header">
            <div>
              <div style="font-size:13px;font-weight:600;color:#fff" data-copy="feedTitle"></div>
              <div style="font-size:11px;color:var(--muted)" data-copy="feedSub"></div>
            </div>
            <span class="badge badge-live">Live</span>
          </div>
          <div class="feed-list" id="hero-feed">
            <div class="feed-item" id="fi1"></div>
            <div class="feed-item" id="fi2"></div>
            <div class="feed-item" id="fi3"></div>
            <div class="feed-item" id="fi4"></div>
          </div>
          <div class="feed-hot">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--lime);font-weight:700" data-copy="feedHotLabel"></div>
            <div style="font-size:18px;font-weight:800;color:#fff;margin-top:6px">Al Nassr vs Al Hilal</div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#a1a1aa;margin-top:8px">
              <span><span id="derby-watchers">2,481</span> <span data-copy="feedHotMeta1"></span></span>
              <span><span data-copy="feedHotMeta2"></span> <strong style="color:#fb923c" data-copy="demandHigh"></strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Hot events -->
  <section style="padding-bottom:60px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <div class="eyebrow" data-copy="sectionHotEyebrow"></div>
        <h2 class="sec-title" data-copy="sectionHotTitle"></h2>
      </div>
      <button class="btn-outline-lg" onclick="showPage('event',null)" data-copy="sectionHotBtn"></button>
    </div>
    <div class="events-grid">
      <div class="ev-card" onclick="showPage('event',null)">
        <div class="urgency-bar"><div class="urgency-left"><div class="urgency-dot"></div><span id="urgLabelEv1" data-copy="evCountdownLabel"></span></div><div class="urgency-countdown" id="ev1-cd">0:14</div></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between"><span class="badge badge-hot" data-copy="heroBadge1" style="display:none"></span><span class="badge badge-hot">⚽ <span data-copy="evStatLabel1"></span>: <span id="ev1w">2,481</span></span></div>
        <div class="ev-title">Al Nassr vs Al Hilal</div>
        <div class="ev-cat" data-copy="evCat1"></div>
        <div class="ev-stats">
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel1"></div><div class="ev-stat-val" id="ev1-watch">2,481</div></div>
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel2"></div><div class="ev-stat-val">2m</div></div>
        </div>
        <div class="ev-status" style="font-size:12px;color:var(--muted);margin-top:12px" data-copy="evStatus1"></div>
        <button class="btn-lime-lg" style="width:100%;margin-top:16px" data-copy="trackNow" onclick="event.stopPropagation();showPage('event',null)"></button>
      </div>
      <div class="ev-card">
        <div class="urgency-bar"><div class="urgency-left"><div class="urgency-dot"></div><span data-copy="evCountdownLabel"></span></div><div class="urgency-countdown" id="ev2-cd">0:09</div></div>
        <div class="ev-title">UFC Riyadh Fight Night</div>
        <div class="ev-cat" data-copy="evCat2"></div>
        <div class="ev-stats">
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel1"></div><div class="ev-stat-val" id="ev2-watch">1,842</div></div>
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel2"></div><div class="ev-stat-val">5m</div></div>
        </div>
        <div class="ev-status" style="font-size:12px;color:var(--muted);margin-top:12px" data-copy="evStatus2"></div>
        <button class="btn-lime-lg" style="width:100%;margin-top:16px" data-copy="trackNow"></button>
      </div>
      <div class="ev-card">
        <div class="urgency-bar" style="background:rgba(56,189,248,0.06);border-color:rgba(56,189,248,0.18)"><div class="urgency-left" style="color:#7dd3fc"><div class="urgency-dot" style="background:#7dd3fc"></div><span data-copy="evCountdownLabel"></span></div><div class="urgency-countdown" id="ev3-cd">0:11</div></div>
        <div class="ev-title" data-copy="stat3Label" style="display:none"></div>
        <div class="ev-title">Riyadh Season Concert</div>
        <div class="ev-cat" data-copy="evCat3"></div>
        <div class="ev-stats">
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel1"></div><div class="ev-stat-val">918</div></div>
          <div class="ev-stat"><div class="ev-stat-label" data-copy="evStatLabel2"></div><div class="ev-stat-val">11m</div></div>
        </div>
        <div class="ev-status" style="font-size:12px;color:var(--muted);margin-top:12px" data-copy="evStatus3"></div>
        <button class="btn-lime-lg" style="width:100%;margin-top:16px" data-copy="trackNow"></button>
      </div>
    </div>
  </section>

  <!-- Steps -->
  <section style="padding-bottom:60px">
    <div class="eyebrow" data-copy="stepsEyebrow"></div>
    <h2 class="sec-title" data-copy="stepsTitle"></h2>
    <div class="steps-grid">
      <div class="step-card"><div class="step-top"><svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="step-num">01</span></div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="step1Title"></div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" data-copy="step1Desc"></div></div>
      <div class="step-card"><div class="step-top"><svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span class="step-num">02</span></div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="step2Title"></div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" data-copy="step2Desc"></div></div>
      <div class="step-card"><div class="step-top"><svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg><span class="step-num">03</span></div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="step3Title"></div><div style="font-size:12px;line-height:1.75;color:var(--muted);margin-top:8px" data-copy="step3Desc"></div></div>
    </div>
  </section>

  <!-- Founding -->
  <section style="padding-bottom:16px">
    <div class="founding-wrap">
      <div class="founding-grid">
        <div>
          <span class="badge badge-green" data-copy="foundingBadge"></span>
          <h2 class="sec-title" style="margin-top:16px;font-size:clamp(24px,3.5vw,42px)" data-copy="foundingTitle"></h2>
          <p class="sec-sub" data-copy="foundingSub"></p>
          <button class="btn-lime-lg" style="margin-top:22px" onclick="showPage('pricing',null)" data-copy="foundingBtn"></button>
        </div>
        <div class="founding-card">
          <div style="font-size:15px;font-weight:700;color:#fff" data-copy="foundingCardTitle"></div>
          <div class="founding-price">$199</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px;margin-bottom:16px" data-copy="foundingPriceSub"></div>
          <div class="founding-feature" data-copy="foundingF1"></div>
          <div class="founding-feature" data-copy="foundingF2"></div>
          <div class="founding-feature" data-copy="foundingF3"></div>
          <div class="founding-feature" data-copy="foundingF4"></div>
          <button class="btn-lime-lg" style="width:100%;margin-top:20px" data-copy="foundingClaim"></button>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- ══════════════ EVENT PAGE ══════════════ -->
<div class="page" id="page-event">
  <div class="event-grid">
    <div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px" id="ev-tags"></div>
      <h1 class="event-title">Al Nassr vs Al Hilal</h1>
      <p style="font-size:15px;line-height:1.7;color:var(--muted);margin-top:12px;max-width:500px" data-copy="evDesc"></p>
      <div class="event-stats">
        <div class="event-stat"><div class="stat-label" data-copy="evDemandLabel"></div><div style="font-size:20px;font-weight:800;color:#fff;margin-top:4px">84/100</div><div class="demand-bar"><div class="demand-fill" id="ev-demand-bar" style="width:0%"></div></div></div>
        <div class="event-stat"><div class="stat-label" data-copy="evWatchLabel"></div><div style="font-size:20px;font-weight:800;color:#fff;margin-top:4px;font-family:'DM Sans',sans-serif" id="ev-page-watch">2,481</div></div>
        <div class="event-stat"><div class="stat-label" data-copy="evLastLabel"></div><div style="font-size:20px;font-weight:800;color:#fff;margin-top:4px">2m</div></div>
        <div class="event-stat"><div class="stat-label" data-copy="evStatusLabel"></div><div style="font-size:14px;font-weight:700;color:#fb923c;margin-top:4px" data-copy="evStatusVal"></div></div>
      </div>
      <div class="urgency-bar" style="margin-top:16px">
        <div class="urgency-left"><div class="urgency-dot"></div><span data-copy="evCountdownLabel"></span></div>
        <div class="urgency-countdown" id="ev-page-cd">0:14</div>
        <div style="font-size:11px;color:var(--muted)" data-copy="evCountdownSuffix"></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="evActivityTitle"></div><div style="font-size:12px;color:var(--muted);margin-top:2px" data-copy="evActivitySub"></div></div>
          <span class="badge badge-live">Live</span>
        </div>
        <div class="feed-list" id="event-feed-list">
          <div class="feed-item new" id="efi1"></div>
          <div class="feed-item" id="efi2"></div>
          <div class="feed-item" id="efi3"></div>
          <div class="feed-item" id="efi4"></div>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:4px" data-copy="evTiersTitle"></div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px" data-copy="evTiersSub"></div>
        <div class="tiers">
          <div class="tier-row"><div><div style="font-size:14px;font-weight:600;color:#fff" data-copy="evTier1"></div><div style="font-size:11px;color:var(--muted);margin-top:2px" data-copy="evTier1Sub"></div></div><div class="tier-avail limited" data-copy="evTier1Status"></div></div>
          <div class="tier-row"><div><div style="font-size:14px;font-weight:600;color:#fff" data-copy="evTier2"></div><div style="font-size:11px;color:var(--muted);margin-top:2px" data-copy="evTier2Sub"></div></div><div class="tier-avail available" data-copy="evTier2Status"></div></div>
          <div class="tier-row"><div><div style="font-size:14px;font-weight:600;color:#fff" data-copy="evTier3"></div><div style="font-size:11px;color:var(--muted);margin-top:2px" data-copy="evTier3Sub"></div></div><div class="tier-avail soldout" data-copy="evTier3Status"></div></div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card">
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:3px" data-copy="evFormTitle"></div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:16px" data-copy="evFormSub"></div>
        <div class="watching-pill" style="margin-top:0;margin-bottom:16px;width:fit-content">
          <div class="watching-avatars"><div class="watching-avatar" style="background:#1a2e1a">🧑</div><div class="watching-avatar" style="background:#1a1a2e">👤</div><div class="watching-avatar" style="background:#2e1a1a">🙋</div></div>
          <span class="watching-count" id="ev-w-pill">2,481</span> <span data-copy="watchingEvent"></span>
        </div>
        <input type="email" class="form-input" id="event-email" data-copy="evEmailPlaceholder"/>
        <select class="form-select" id="ev-tier-select">
          <option data-copy="evTierSelect"></option>
          <option data-copy="evTierGA"></option>
          <option data-copy="evTierPrem"></option>
          <option data-copy="evTierVIP"></option>
        </select>
        <button class="btn-lime-lg" style="width:100%;margin-top:2px" id="watch-btn" onclick="submitWatch()" data-copy="evWatchBtn"></button>
        <div style="font-size:11px;line-height:1.7;color:var(--muted);margin-top:10px" data-copy="evDisclaimer"></div>
      </div>
      <div class="card" style="border-color:rgba(249,115,22,.15)">
        <div style="font-size:12px;font-weight:700;color:#fb923c;margin-bottom:12px" data-copy="evDemandCardLabel"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="card-dark" style="padding:12px;border-radius:12px"><div class="stat-label" data-copy="d24Low"></div><div style="font-size:15px;font-weight:700;color:#fff;margin-top:4px" data-copy="highLabel"></div></div>
          <div class="card-dark" style="padding:12px;border-radius:12px"><div class="stat-label" data-copy="d24High"></div><div style="font-size:15px;font-weight:700;color:#fff;margin-top:4px" data-copy="veryHighLabel"></div></div>
          <div class="card-dark" style="padding:12px;border-radius:12px"><div class="stat-label" data-copy="d7Trend"></div><div style="font-size:15px;font-weight:700;color:var(--lime);margin-top:4px" data-copy="risingLabel"></div></div>
          <div class="card-dark" style="padding:12px;border-radius:12px"><div class="stat-label" data-copy="dAlertSpeed"></div><div style="font-size:15px;font-weight:700;color:var(--lime);margin-top:4px" data-copy="instantLabel"></div></div>
        </div>
      </div>
      <div class="card" style="border-color:rgba(248,113,113,.15);background:rgba(248,113,113,.03);cursor:pointer" onclick="openAlmost()">
        <div style="font-size:13px;font-weight:700;color:#f87171;margin-bottom:6px">😤 <span data-copy="almostTitle"></span></div>
        <div style="font-size:12px;color:var(--muted);line-height:1.65" data-copy="almostSub"></div>
        <div style="font-size:11px;color:#f87171;margin-top:8px;font-weight:600" data-copy="almostUpgrade"></div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════ DASHBOARD ══════════════ -->
<div class="page" id="page-dashboard">
  <div class="dash-header">
    <div><div style="font-size:12px;color:var(--muted)" data-copy="dashGreeting"></div><h1 style="font-size:clamp(24px,4vw,36px);font-weight:900;color:#fff;letter-spacing:-.02em;margin-top:6px" data-copy="dashTitle"></h1></div>
    <button class="btn-lime-lg" data-copy="dashAddBtn"></button>
  </div>
  <div class="dash-stats">
    <div class="dstat"><svg class="dstat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg><div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)" data-copy="dashStat1"></div><div class="dstat-val">3</div></div>
    <div class="dstat"><svg class="dstat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)" data-copy="dashStat2"></div><div class="dstat-val">9</div></div>
    <div class="dstat"><svg class="dstat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)" data-copy="dashStat3"></div><div class="dstat-val">Pro</div></div>
    <div class="dstat"><svg class="dstat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div style="font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)" data-copy="dashStat4"></div><div class="dstat-val">15s</div></div>
  </div>
  <div class="dash-grid">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="dashFeedTitle"></div><div style="font-size:12px;color:var(--muted);margin-top:2px" data-copy="dashFeedSub"></div></div><span class="badge badge-live">Live</span></div>
      <div class="feed-list" id="dash-feed">
        <div class="feed-item" id="dfi1"></div>
        <div class="feed-item" id="dfi2"></div>
        <div class="feed-item" id="dfi3"></div>
        <div class="feed-item" id="dfi4"></div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:17px;font-weight:700;color:#fff" data-copy="dashTrendTitle"></div><div style="font-size:12px;color:var(--muted);margin-top:2px" data-copy="dashTrendSub"></div></div><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3e635" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="card-dark" style="padding:12px;border-radius:14px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:13px;font-weight:600;color:#fff">Al Nassr vs Al Hilal</div><div style="font-size:11px;color:var(--muted);margin-top:2px">2,481 <span data-copy="feedHotMeta1"></span></div></div><span class="badge badge-hot" data-copy="highLabel"></span></div>
        <div class="card-dark" style="padding:12px;border-radius:14px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:13px;font-weight:600;color:#fff">UFC Riyadh Fight Night</div><div style="font-size:11px;color:var(--muted);margin-top:2px">1,842 <span data-copy="feedHotMeta1"></span></div></div><span class="badge badge-hot" data-copy="highLabel"></span></div>
        <div class="card-dark" style="padding:12px;border-radius:14px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:13px;font-weight:600;color:#fff">Riyadh Season Concert</div><div style="font-size:11px;color:var(--muted);margin-top:2px">918 <span data-copy="feedHotMeta1"></span></div></div><span class="badge badge-default">Medium</span></div>
      </div>
    </div>
  </div>
  <div class="table-wrap">
    <div style="padding:16px 18px;border-bottom:1px solid var(--border)"><div style="font-size:17px;font-weight:700;color:#fff" data-copy="dashTableTitle"></div><div style="font-size:12px;color:var(--muted);margin-top:2px" data-copy="dashTableSub"></div></div>
    <div class="table-head"><span data-copy="thEvent"></span><span data-copy="thTier"></span><span data-copy="thStatus"></span><span data-copy="thLastCheck"></span></div>
    <div class="table-row"><div>Al Nassr vs Al Hilal</div><div data-copy="evTierSelect"></div><div class="status-watching" data-copy="statusWatching"></div><div>15s</div></div>
    <div class="table-row"><div>UFC Riyadh</div><div data-copy="evTierPrem"></div><div class="status-sent" data-copy="statusSent"></div><div>1m</div></div>
    <div class="table-row"><div>Concert Drop</div><div>VIP</div><div class="status-watching" data-copy="statusWatching"></div><div>22s</div></div>
  </div>
</div>

<!-- ══════════════ PRICING ══════════════ -->
<div class="page" id="page-pricing">
  <div class="pricing-header">
    <span class="badge badge-green" style="margin-bottom:14px" data-copy="pricingBadge"></span>
    <h1 style="font-size:clamp(30px,5vw,50px);font-weight:900;color:#fff;letter-spacing:-.03em;margin-top:10px" data-copy="pricingTitle"></h1>
    <p style="font-size:15px;line-height:1.75;color:var(--muted);margin-top:14px" data-copy="pricingSub"></p>
  </div>
  <div class="plans-grid">
    <div class="plan-card"><div><div class="plan-name" data-copy="plan1Name"></div><div style="font-size:12px;color:var(--muted);margin-top:4px" data-copy="plan1Desc"></div></div><div class="plan-price">$0</div><div style="flex:1"><div class="plan-feature" data-copy="plan1F1"></div><div class="plan-feature" data-copy="plan1F2"></div><div class="plan-feature" data-copy="plan1F3"></div></div><button class="btn-outline-lg" style="width:100%;margin-top:24px" data-copy="plan1Cta"></button></div>
    <div class="plan-card featured"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div><div class="plan-name" data-copy="plan2Name"></div><div style="font-size:12px;color:var(--muted);margin-top:4px" data-copy="plan2Desc"></div></div><span class="badge badge-green" data-copy="bestValue"></span></div><div class="plan-price">$29<span style="font-size:18px;font-weight:600;color:var(--muted)">/mo</span></div><div style="flex:1"><div class="plan-feature" data-copy="plan2F1"></div><div class="plan-feature" data-copy="plan2F2"></div><div class="plan-feature" data-copy="plan2F3"></div><div class="plan-feature" data-copy="plan2F4"></div></div><button class="btn-lime-lg" style="width:100%;margin-top:24px" data-copy="plan2Cta"></button></div>
    <div class="plan-card"><div><div class="plan-name" data-copy="plan3Name"></div><div style="font-size:12px;color:var(--muted);margin-top:4px" data-copy="plan3Desc"></div></div><div class="plan-price">$199<span style="font-size:14px;font-weight:500;color:var(--muted);display:block;margin-top:4px">one-time</span></div><div style="flex:1"><div class="plan-feature" data-copy="plan3F1"></div><div class="plan-feature" data-copy="plan3F2"></div><div class="plan-feature" data-copy="plan3F3"></div><div class="plan-feature" data-copy="plan3F4"></div></div><button class="btn-outline-lg" style="width:100%;margin-top:24px" data-copy="plan3Cta"></button></div>
  </div>
  <div class="launch-box"><div><div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:8px" data-copy="launchTitle"></div><div style="font-size:13px;line-height:1.75;color:var(--muted);max-width:560px" data-copy="launchDesc"></div></div><div class="urgency-tag-p" data-copy="launchTag"></div></div>
</div>

<!-- BOTTOM NAV -->
<div class="bottom-nav">
  <div class="bottom-nav-grid">
    <button class="tab-btn active" id="tab-landing" onclick="showPage('landing',null)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg><span data-copy="navHome"></span></button>
    <button class="tab-btn" id="tab-event" onclick="showPage('event',null)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span data-copy="navMarket"></span></button>
    <button class="tab-btn" id="tab-dashboard" onclick="showPage('dashboard',null)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span data-copy="navDashboard"></span></button>
    <button class="tab-btn" id="tab-pricing" onclick="showPage('pricing',null)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg><span data-copy="navPricing"></span></button>
  </div>
</div>

<script>
// ════════════════════════════════════════
// FEED CONTENT PER LANG
// ════════════════════════════════════════
const FEED_EN = [
  { t: '🔥 143 users started watching Al Nassr vs Al Hilal', h: false },
  { t: '⚡ General Admission seats returned — Al Nassr Derby', h: true },
  { t: '👀 Demand spiking — UFC Riyadh now 1,842 watching', h: false },
  { t: '🚨 Page change detected — Riyadh Season Concert', h: false },
  { t: '📈 3 events crossed 1,000 watchers today', h: false },
  { t: '⚡ 6 Premium seats available right now', h: true },
];
const FEED_AR = [
  { t: '🔥 143 مستخدم بدأ متابعة النصر ضد الهلال', h: false },
  { t: '⚡ عادت مقاعد الدخول العام — نصر الهلال ديربي', h: true },
  { t: '👀 ارتفاع الطلب — UFC الرياض: 1,842 متابع', h: false },
  { t: '🚨 تغيير في صفحة التذاكر — حفل موسم الرياض', h: false },
  { t: '📈 3 فعاليات تجاوزت 1,000 متابع اليوم', h: false },
  { t: '⚡ 6 مقاعد بريميوم متاحة الآن', h: true },
];

function getFeed() { return currentLang === 'ar' ? FEED_AR : FEED_EN; }

// ════════════════════════════════════════
// INIT STATIC FEED ITEMS
// ════════════════════════════════════════
function initFeedItems() {
  const f = getFeed();
  ['fi1','fi2','fi3','fi4'].forEach((id,i) => {
    const el = document.getElementById(id);
    if(el){ el.textContent = f[i]?.t||''; el.className='feed-item'+(f[i]?.h?' new':''); }
  });
  ['efi1','efi2','efi3','efi4'].forEach((id,i) => {
    const texts_en = ['✅ Seats available on Premium tier — just now','🔥 132 users started watching in the last hour','📈 Demand moved Medium → High — 16 min ago','🔄 Availability changed on GA — 39 min ago'];
    const texts_ar = ['✅ مقاعد بريميوم متاحة — الآن','🔥 132 مستخدم بدأ المتابعة في آخر ساعة','📈 الطلب انتقل من متوسط إلى مرتفع — 16 د','🔄 تغيير في توفر الدخول العام — 39 د'];
    const el = document.getElementById(id);
    const arr = currentLang==='ar'?texts_ar:texts_en;
    if(el){ el.textContent=arr[i]||''; el.className='feed-item'+(i===0?' new':''); }
  });
  ['dfi1','dfi2','dfi3','dfi4'].forEach((id,i) => {
    const el = document.getElementById(id);
    const f2 = getFeed();
    if(el){ el.textContent=f2[i]?.t||''; }
  });
}

// ════════════════════════════════════════
// ROUTING
// ════════════════════════════════════════
function showPage(name, navBtn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (navBtn) navBtn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'event') {
    setTimeout(() => {
      const b = document.getElementById('ev-demand-bar');
      if (b) b.style.width = '84%';
    }, 250);
    // Trigger almost modal after 30s on event page
    if (!almostShown) {
      almostTimer = setTimeout(() => { almostShown = true; openAlmost(); }, 30000);
    }
  }
}

// ════════════════════════════════════════
// LANG SWITCH
// ════════════════════════════════════════
const _applyLang = applyLang;
applyLang = function(lang) {
  _applyLang(lang);
  // Update event page tags
  const tags = COPY[lang].evTags;
  const tagClasses = ['badge-default','badge-hot','badge-blue'];
  const tagsEl = document.getElementById('ev-tags');
  if(tagsEl) {
    tagsEl.innerHTML = tags.map((tag,i) => `<span class="badge ${tagClasses[i]}">${tag}</span>`).join('');
  }
  initFeedItems();
  // Re-apply font to all body text
  document.body.style.fontFamily = lang==='ar' ? "'IBM Plex Sans Arabic', sans-serif" : "'DM Sans', sans-serif";
};

// ════════════════════════════════════════
// TOAST
// ════════════════════════════════════════
const TOASTS_EN = [
  { icon:'⚡', title:'Seats returned — UFC Riyadh', sub:'2 Premium seats appeared. 847 users notified.' },
  { icon:'🔥', title:'Al Nassr Derby — demand spike', sub:'542 new users in the last 10 minutes.' },
  { icon:'🚨', title:'Page change detected', sub:'Riyadh Season Concert — availability updated.' },
  { icon:'⚡', title:'6 seats live right now', sub:'Al Nassr vs Al Hilal — General Admission.' },
];
const TOASTS_AR = [
  { icon:'⚡', title:'مقاعد UFC الرياض عادت', sub:'مقعدان بريميوم ظهرا. 847 مستخدم تم تنبيههم.' },
  { icon:'🔥', title:'ديربي النصر — ارتفاع الطلب', sub:'542 مستخدم جديد في 10 دقائق الأخيرة.' },
  { icon:'🚨', title:'تغيير مرصود في الصفحة', sub:'حفل موسم الرياض — تحديث قسم التوفر.' },
  { icon:'⚡', title:'6 مقاعد متاحة الآن', sub:'النصر ضد الهلال — الدخول العام.' },
];
let toastIdx=0;
function showToast(){
  const arr = currentLang==='ar'?TOASTS_AR:TOASTS_EN;
  const data = arr[toastIdx%arr.length]; toastIdx++;
  const container=document.getElementById('toast-container');
  const toast=document.createElement('div');
  toast.className='toast';
  toast.innerHTML=`<div class="toast-icon">${data.icon}</div><div><div class="toast-title">${data.title}</div><div class="toast-sub">${data.sub}</div></div><div class="toast-bar" style="animation-duration:5000ms"></div>`;
  toast.style.fontFamily = currentLang==='ar'?"'IBM Plex Sans Arabic',sans-serif":"'DM Sans',sans-serif";
  if(currentLang==='ar') toast.style.direction='rtl';
  container.appendChild(toast);
  requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('show')));
  setTimeout(()=>{toast.classList.add('hide');toast.classList.remove('show');setTimeout(()=>toast.remove(),400);},5000);
}
setTimeout(()=>{showToast();setInterval(showToast,9000+Math.random()*3000);},3000);

// ════════════════════════════════════════
// COUNTDOWNS
// ════════════════════════════════════════
const cds={'ev1-cd':14,'ev2-cd':9,'ev3-cd':11,'ev-page-cd':14};
setInterval(()=>{
  Object.keys(cds).forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    cds[id]--; if(cds[id]<0)cds[id]=15;
    const s=cds[id]; el.textContent=`0:${s.toString().padStart(2,'0')}`;
    if(s===0||s===15){el.style.color='var(--lime)';el.style.textShadow='0 0 8px rgba(163,230,53,.8)';setTimeout(()=>{el.style.color='';el.style.textShadow='';},600);}
  });
},1000);

// ════════════════════════════════════════
// LIVE COUNTERS
// ════════════════════════════════════════
const ctrs={'hero-watchers':8247,'ev1-watch':2481,'ev2-watch':1842,'derby-watchers':2481,'ev-page-watch':2481,'ev-w-pill':2481};
setInterval(()=>{
  const keys=Object.keys(ctrs);
  const key=keys[Math.floor(Math.random()*keys.length)];
  ctrs[key]=Math.max(800,ctrs[key]+Math.floor(Math.random()*3)-1);
  const el=document.getElementById(key);
  if(el){el.textContent=ctrs[key].toLocaleString();el.style.transition='transform .2s';el.style.transform='scale(1.08)';setTimeout(()=>el.style.transform='',250);}
},3000);

// ════════════════════════════════════════
// ROLLING FEED
// ════════════════════════════════════════
let feedRIdx=0;
function rollFeed(feedId){
  const feed=document.getElementById(feedId); if(!feed)return;
  const arr=getFeed();
  const msg=arr[feedRIdx%arr.length]; feedRIdx++;
  const div=document.createElement('div');
  div.className='feed-item'+(msg.h?' new':'');
  div.textContent=msg.t;
  div.style.opacity='0';div.style.transform='translateY(-8px)';div.style.transition='opacity .4s,transform .4s';
  feed.insertBefore(div,feed.firstChild);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{div.style.opacity='1';div.style.transform='';}));
  while(feed.children.length>4){const last=feed.lastChild;last.style.transition='opacity .3s';last.style.opacity='0';setTimeout(()=>last.remove(),320);}
}
setInterval(()=>{rollFeed('hero-feed');rollFeed('event-feed-list');rollFeed('dash-feed');},5500);

// ════════════════════════════════════════
// ALMOST MODAL
// ════════════════════════════════════════
let almostShown=false, almostTimer=null;
function openAlmost(){document.getElementById('almost-modal').classList.add('open');}
function closeAlmost(){document.getElementById('almost-modal').classList.remove('open');}
document.getElementById('almost-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAlmost();});

// ════════════════════════════════════════
// FORM
// ════════════════════════════════════════
function submitWatch(){
  const email=document.getElementById('event-email').value.trim();
  const btn=document.getElementById('watch-btn');
  if(!email||!email.includes('@')){document.getElementById('event-email').style.borderColor='rgba(239,68,68,.5)';document.getElementById('event-email').focus();return;}
  btn.textContent='⚡…';btn.disabled=true;btn.style.opacity='.7';
  setTimeout(()=>{btn.textContent='✅';btn.style.background='#4ade80';btn.style.opacity='1';btn.style.color='#000';},1000);
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyLang('en');
  document.getElementById('ev-tags').innerHTML = COPY.en.evTags.map((t,i)=>`<span class="badge ${['badge-default','badge-hot','badge-blue'][i]}">${t}</span>`).join('');
  initFeedItems();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAlmost();});
</script>
</body>
</html>  
