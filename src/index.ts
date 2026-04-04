import express from 'express';
import { pool, setupDB } from './db';
import { runMonitorCycle } from './monitor';
import { getActivityFeed } from './feed';

const app = express();
app.use(express.json());

function getDemandColor(band: string): string {
  if (band === 'very_high') return '#ef4444';
  if (band === 'high') return '#f97316';
  if (band === 'medium') return '#eab308';
  return '#a3e635';
}

function getDemandLabel(band: string): { en: string; ar: string } {
  if (band === 'very_high') return { en: '🔥 On Fire', ar: '🔥 ملتهب' };
  if (band === 'high') return { en: '⚡ High Demand', ar: '⚡ طلب مرتفع' };
  if (band === 'medium') return { en: '👀 Picking Up', ar: '👀 يرتفع الطلب' };
  return { en: '○ Watching', ar: '○ قيد المتابعة' };
}

function getHTML(events: any[], feed: any[]): string {
  const ej = JSON.stringify(events);
  const fj = JSON.stringify(feed);

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SeatX — The seat market, live.</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080a0e;
  --bg2:#0d1018;
  --bg3:#121620;
  --lime:#a3e635;
  --lime2:#bef264;
  --lime-dim:rgba(163,230,53,.12);
  --orange:#f97316;
  --red:#ef4444;
  --border:rgba(255,255,255,.07);
  --border2:rgba(255,255,255,.12);
  --muted:#52525b;
  --muted2:#71717a;
  --muted3:#a1a1aa;
  --mono:'IBM Plex Mono',monospace;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:#f4f4f5;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
body.en{font-family:'DM Sans',sans-serif}
body.ar{font-family:'IBM Plex Sans Arabic',sans-serif}

/* NOISE OVERLAY */
body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:.4}

/* NAV */
nav{position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border);background:rgba(8,10,14,.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:0 32px;height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.lbox{width:32px;height:32px;border-radius:8px;background:var(--lime-dim);border:1px solid rgba(163,230,53,.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--lime);font-family:'DM Sans',sans-serif;letter-spacing:-.04em}
.lname{font-size:15px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif;letter-spacing:-.02em}
.lname em{color:var(--lime);font-style:normal}
.nav-r{display:flex;align-items:center;gap:8px}
.ltog{display:flex;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:7px;padding:2px;gap:2px}
.lb{background:none;border:none;border-radius:5px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;color:var(--muted2);font-family:'DM Sans',sans-serif;transition:all .15s;letter-spacing:.03em}
.lb.on{background:var(--lime);color:#000}
.gbtn{background:var(--lime);border:none;border-radius:8px;padding:7px 16px;font-size:13px;font-weight:700;color:#000;cursor:pointer;transition:all .15s;letter-spacing:-.01em}
.gbtn:hover{background:var(--lime2);transform:translateY(-1px)}
.obtn{background:none;border:1px solid var(--border2);border-radius:8px;padding:7px 14px;font-size:13px;color:var(--muted3);cursor:pointer;transition:all .15s}
.obtn:hover{border-color:rgba(255,255,255,.2);color:#fff}

/* TICKER */
.ticker-wrap{border-bottom:1px solid var(--border);background:rgba(163,230,53,.03);overflow:hidden;height:30px;display:flex;align-items:center}
.ticker{display:flex;gap:0;animation:tick 30s linear infinite;white-space:nowrap}
.ticker-item{font-family:var(--mono);font-size:10px;color:var(--muted2);padding:0 24px;border-right:1px solid var(--border);display:flex;align-items:center;gap:6px}
.ticker-item.hot{color:var(--lime)}
.ticker-item.alert{color:var(--orange)}
@keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* HERO */
.hero{max-width:1280px;margin:0 auto;padding:64px 32px 48px;display:grid;grid-template-columns:1fr 420px;gap:56px;align-items:start;position:relative;z-index:1}
.hero-left{}
.eyebrow-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.18);border-radius:100px;padding:4px 12px 4px 8px;font-size:11px;font-weight:600;color:var(--lime);margin-bottom:20px;font-family:var(--mono)}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--lime);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(163,230,53,.5)}50%{box-shadow:0 0 0 5px rgba(163,230,53,0)}}
h1{font-size:clamp(48px,5.5vw,80px);font-weight:900;line-height:.92;letter-spacing:-.04em;color:#fff;margin-bottom:20px}
.ar h1{letter-spacing:0;line-height:1.1}
h1 em{color:var(--lime);font-style:normal;display:block}
.hero-sub{font-size:16px;line-height:1.8;color:var(--muted2);max-width:460px;margin-bottom:28px}
.hero-btns{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:32px}
.hero-btns .gbtn{padding:11px 22px;font-size:14px;border-radius:10px}
.hero-btns .obtn{padding:11px 18px;font-size:14px;border-radius:10px}

/* STATS ROW */
.stats-row{display:flex;gap:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02)}
.stat-block{flex:1;padding:14px 18px;border-right:1px solid var(--border);position:relative}
.stat-block:last-child{border-right:none}
.stat-label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:6px}
.stat-val{font-size:22px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif;line-height:1}
.stat-val span{font-size:12px;font-weight:500;color:var(--lime);margin-left:4px}

/* MARKET PANEL */
.market-panel{background:var(--bg2);border:1px solid var(--border);border-radius:20px;overflow:hidden;position:sticky;top:72px}
.mp-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.mp-title{font-size:13px;font-weight:600;color:#fff}
.mp-sub{font-size:11px;color:var(--muted2);margin-top:2px}
.live-badge{display:flex;align-items:center;gap:5px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:100px;padding:3px 9px;font-size:10px;font-weight:700;color:#f87171;font-family:var(--mono)}
.live-dot{width:5px;height:5px;border-radius:50%;background:#f87171;animation:pulse-red 2s infinite}
@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 4px rgba(239,68,68,0)}}
.mp-feed{padding:12px;display:flex;flex-direction:column;gap:6px;min-height:160px;max-height:200px;overflow:hidden}
.feed-item{border-radius:9px;padding:9px 12px;font-size:12px;line-height:1.5;color:#d4d4d8;background:rgba(255,255,255,.03);border:1px solid var(--border);transition:all .3s}
.feed-item.hot{border-color:rgba(163,230,53,.2);background:rgba(163,230,53,.05);color:#e4e4e7}
.feed-item.alert{border-color:rgba(249,115,22,.2);background:rgba(249,115,22,.05)}
.mp-hot{margin:0 12px 12px;border-radius:12px;border:1px solid rgba(163,230,53,.15);background:linear-gradient(135deg,rgba(163,230,53,.06),rgba(163,230,53,.02));padding:14px}
.mp-hot-label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--lime);margin-bottom:8px}
.mp-hot-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px}
.mp-hot-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted2)}
.demand-bar-wrap{padding:12px 12px 0;margin-bottom:4px}
.demand-bar-label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between}
.demand-bar-track{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.demand-bar-fill{height:100%;border-radius:2px;transition:width 1s cubic-bezier(.4,0,.2,1)}

/* SECTION */
.section{max-width:1280px;margin:0 auto;padding:0 32px 56px;position:relative;z-index:1}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px}
.section-eyebrow{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:6px}
.section-title{font-size:clamp(20px,2.5vw,30px);font-weight:800;color:#fff;letter-spacing:-.02em}
.ar .section-title{letter-spacing:0}
.sort-tabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:9px;padding:3px}
.sort-tab{background:none;border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;color:var(--muted2);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.sort-tab.on{background:rgba(255,255,255,.08);color:#fff}

/* ADD FORM */
.add-form{background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:24px;max-width:560px;margin:0 auto 56px}
.form-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
.form-sub{font-size:12px;color:var(--muted2);margin-bottom:18px}
.form-label{display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
.form-input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;margin-bottom:12px;transition:border-color .2s}
.form-input::placeholder{color:var(--muted)}
.form-input:focus{border-color:rgba(163,230,53,.35);background:rgba(163,230,53,.03)}
.form-note{text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:10px}

/* EVENT CARDS */
.events-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.ecard{border-radius:18px;border:1px solid var(--border);background:var(--bg2);overflow:hidden;transition:all .25s;position:relative;cursor:pointer}
.ecard:hover{border-color:rgba(255,255,255,.14);transform:translateY(-3px);box-shadow:0 20px 40px rgba(0,0,0,.4)}
.ecard.hot-card{border-color:rgba(239,68,68,.2)}
.ecard.hot-card:hover{border-color:rgba(239,68,68,.35)}
.ecard.warm-card{border-color:rgba(249,115,22,.15)}
.ecard.warm-card:hover{border-color:rgba(249,115,22,.3)}

/* CARD IMAGE */
.card-img{height:140px;background:linear-gradient(135deg,#0d1018,#1a1f2e);position:relative;overflow:hidden}
.card-img img{width:100%;height:100%;object-fit:cover;opacity:.7;transition:opacity .3s}
.ecard:hover .card-img img{opacity:.9}
.card-img-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg3),#1e2435)}
.card-img-icon{font-size:36px;opacity:.3}
.card-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(8,10,14,.9))}
.card-source{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:2px 8px;font-family:var(--mono);font-size:9px;color:var(--muted3);text-transform:uppercase;letter-spacing:.08em}
.card-status-badge{position:absolute;top:10px;right:10px;border-radius:100px;padding:3px 9px;font-size:10px;font-weight:700;font-family:var(--mono)}
.csb-available{background:rgba(163,230,53,.15);border:1px solid rgba(163,230,53,.3);color:var(--lime)}
.csb-maybe{background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.25);color:#fbbf24}
.csb-unavailable{background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted2)}

/* CARD BODY */
.card-body{padding:16px}
.card-demand-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.card-demand-tag{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px}
.cdt-very_high{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171}
.cdt-high{background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);color:#fb923c}
.cdt-medium{background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.2);color:#fbbf24}
.cdt-low{background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--muted2)}
.card-watchers{font-family:var(--mono);font-size:10px;color:var(--muted2);display:flex;align-items:center;gap:4px}
.card-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.3}
.card-url{font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-meta-row{display:flex;gap:12px;margin-bottom:12px}
.card-meta-item{font-size:11px;color:var(--muted2);display:flex;align-items:center;gap:4px}

/* DEMAND SCORE */
.card-score-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.score-track{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.score-fill{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.4,0,.2,1)}
.score-val{font-family:var(--mono);font-size:11px;font-weight:600;color:#fff;min-width:28px;text-align:right}

/* COUNTDOWN */
.card-check-row{display:flex;align-items:center;justify-content:space-between;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.12);border-radius:9px;padding:8px 12px;margin-bottom:12px}
.check-label{font-size:11px;color:#fb923c;display:flex;align-items:center;gap:5px;font-weight:600}
.check-dot{width:5px;height:5px;border-radius:50%;background:#fb923c;animation:pulse-o 1.5s infinite}
@keyframes pulse-o{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.5)}50%{box-shadow:0 0 0 4px rgba(249,115,22,0)}}
.check-timer{font-family:var(--mono);font-size:13px;font-weight:700;color:#fff}

/* SUBSCRIBE */
.card-sub-row{display:flex;gap:6px}
.card-email{flex:1;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:8px 11px;font-size:12px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;transition:border-color .2s}
.card-email::placeholder{color:var(--muted)}
.card-email:focus{border-color:rgba(163,230,53,.3)}
.card-alert-btn{background:var(--lime-dim);border:1px solid rgba(163,230,53,.2);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:var(--lime);cursor:pointer;transition:all .2s;white-space:nowrap}
.card-alert-btn:hover{background:rgba(163,230,53,.2)}
.card-fomo{font-size:11px;font-weight:700;color:#fb923c;margin-bottom:8px;display:flex;align-items:center;gap:4px}

/* HOW IT WORKS */
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.step-card{border-radius:16px;border:1px solid var(--border);background:rgba(255,255,255,.02);padding:22px;position:relative;overflow:hidden}
.step-card::before{content:attr(data-num);position:absolute;right:16px;top:12px;font-family:var(--mono);font-size:48px;font-weight:900;color:rgba(255,255,255,.03);line-height:1}
.step-icon{color:var(--lime);width:24px;height:24px;margin-bottom:14px}
.step-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:6px}
.step-desc{font-size:12px;line-height:1.75;color:var(--muted2)}

/* FOUNDING */
.founding-wrap{border-radius:24px;border:1px solid var(--border);background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));padding:36px;margin-bottom:48px;position:relative;overflow:hidden}
.founding-wrap::before{content:'';position:absolute;top:-100px;right:-100px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(163,230,53,.06),transparent 70%);pointer-events:none}
.founding-grid{display:grid;grid-template-columns:1fr 320px;gap:36px;align-items:center}
.founding-card{border-radius:16px;border:1px solid rgba(163,230,53,.15);background:rgba(163,230,53,.04);padding:22px}
.founding-price{font-size:48px;font-weight:900;color:#fff;font-family:'DM Sans',sans-serif;line-height:1;margin:10px 0 4px}
.founding-feature{font-size:13px;color:#d4d4d8;display:flex;align-items:center;gap:8px;padding:4px 0}
.founding-feature::before{content:'✓';color:var(--lime);font-weight:800;font-size:11px;flex-shrink:0}

/* TOAST */
.toast-container{position:fixed;bottom:20px;z-index:500;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:320px}
.en .toast-container{right:20px}
.ar .toast-container{left:20px}
.toast{background:rgba(13,16,24,.97);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 20px 50px rgba(0,0,0,.7);transform:translateX(110%);transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .3s;opacity:0;pointer-events:all;position:relative;overflow:hidden}
.ar .toast{transform:translateX(-110%)}
.toast.on{transform:translateX(0);opacity:1}
.toast.off{transform:translateX(110%);opacity:0}
.ar .toast.off{transform:translateX(-110%)}
.toast-bar{position:absolute;bottom:0;left:0;height:2px;background:var(--lime);animation:tbar linear forwards}
@keyframes tbar{from{width:100%}to{width:0}}
.toast-icon{font-size:22px;flex-shrink:0;margin-top:1px}
.toast-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:3px}
.toast-sub{font-size:11px;color:var(--muted2);line-height:1.5}

/* EMPTY */
.empty-state{text-align:center;padding:64px 32px;color:var(--muted2)}
.empty-icon{font-size:40px;margin-bottom:14px;opacity:.4}
.empty-title{font-size:16px;font-weight:600;color:#fff;margin-bottom:6px}
.empty-sub{font-size:13px;line-height:1.7}

/* SHIMMER */
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.shimmer{background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%);background-size:200% 100%;animation:shimmer 2s infinite}

.quick-hero{background:linear-gradient(180deg,rgba(163,230,53,.06),transparent);border-bottom:1px solid var(--border);padding:20px 32px}
.qh-inner{max-width:680px;margin:0 auto;text-align:center}
.qh-label{font-family:var(--mono);font-size:11px;color:var(--lime);margin-bottom:12px;text-transform:uppercase;letter-spacing:.1em}
.qh-row{display:flex;gap:8px}
.qh-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(163,230,53,.3);border-radius:10px;padding:13px 18px;font-size:14px;font-family:'DM Sans',sans-serif;color:#fff;outline:none}
.qh-input::placeholder{color:var(--muted)}
.qh-input:focus{border-color:var(--lime);background:rgba(163,230,53,.05)}
.qh-btn{background:var(--lime);border:none;border-radius:10px;padding:13px 22px;font-size:14px;font-weight:700;color:#000;cursor:pointer;white-space:nowrap}
.qh-btn:hover{background:var(--lime2)}
.qh-or{font-size:12px;color:var(--muted2);margin-top:10px}
.qh-demo{background:none;border:none;color:var(--lime);font-size:12px;cursor:pointer;text-decoration:underline;font-family:'DM Sans',sans-serif}
.skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:18px;height:280px;border:1px solid var(--border)}
.email-popup{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.email-popup-box{background:var(--bg2);border:1px solid rgba(163,230,53,.2);border-radius:20px;padding:32px;max-width:400px;width:90%;text-align:center}
.email-popup-title{font-size:20px;font-weight:800;color:#fff;margin-bottom:8px}
.email-popup-sub{font-size:13px;color:var(--muted2);margin-bottom:20px;line-height:1.6}
.email-popup-input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:11px 14px;font-size:13px;color:#fff;outline:none;margin-bottom:12px;font-family:'DM Sans',sans-serif}
.email-popup-input:focus{border-color:rgba(163,230,53,.4)}
.email-popup-skip{background:none;border:none;color:var(--muted2);font-size:12px;cursor:pointer;margin-top:8px;font-family:'DM Sans',sans-serif}
.pricing-grid{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:16px;align-items:start}
.pricing-card{background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:24px;position:relative}
.pricing-lifetime{border-color:rgba(163,230,53,.3);background:linear-gradient(135deg,rgba(163,230,53,.06),var(--bg2));padding:28px}
.pc-badge{display:inline-block;background:var(--lime);color:#000;font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;margin-bottom:12px;font-family:var(--mono);text-transform:uppercase}
.pc-name{font-size:12px;font-weight:700;color:var(--muted3);margin-bottom:8px;text-transform:uppercase;font-family:var(--mono);letter-spacing:.1em}
.pc-price{font-size:44px;font-weight:900;color:#fff;font-family:'DM Sans',sans-serif;line-height:1}
.pricing-lifetime .pc-price{color:var(--lime)}
.pc-period{font-size:11px;color:var(--muted2);margin:4px 0 8px}
.pc-sub{font-size:11px;color:var(--lime);margin-bottom:16px;font-weight:600;line-height:1.5}
.pc-features{margin:16px 0;display:flex;flex-direction:column;gap:8px}
.pc-f{font-size:12px;color:#d4d4d8;display:flex;align-items:center;gap:6px}
.pc-f::before{content:'✓';color:var(--lime);font-weight:800;font-size:10px;flex-shrink:0}
.pc-btn{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border2);border-radius:10px;padding:11px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;margin-top:8px;transition:all .2s}
.pc-btn:hover{background:rgba(255,255,255,.1)}
.pc-btn-lifetime{width:100%;background:var(--lime);border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:800;color:#000;cursor:pointer;margin-top:8px;transition:all .2s}
.pc-btn-lifetime:hover{background:var(--lime2);transform:translateY(-1px)}
@media(max-width:800px){.pricing-grid{grid-template-columns:1fr}}
footer{border-top:1px solid var(--border);padding:20px 32px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.05em;position:relative;z-index:1}

@media(max-width:960px){.hero{grid-template-columns:1fr}.market-panel{position:static}.steps-grid{grid-template-columns:repeat(2,1fr)}.founding-grid{grid-template-columns:1fr}}
@media(max-width:600px){.hero{padding:32px 16px 28px}.section{padding:0 16px 40px}nav{padding:0 16px}.events-grid{grid-template-columns:1fr}.steps-grid{grid-template-columns:1fr}}
.upgrade-prompt{background:linear-gradient(135deg,rgba(163,230,53,.08),rgba(163,230,53,.03));border:1px solid rgba(163,230,53,.2);border-radius:18px;padding:32px;text-align:center;grid-column:1/-1}
.up-title{font-size:18px;font-weight:700;color:#fff;margin-bottom:16px}
.usage-meter{display:flex;align-items:center;justify-content:space-between;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.15);border-radius:10px;padding:10px 16px;margin-bottom:16px}
.um-text{font-size:13px;font-weight:600;color:#fb923c;font-family:var(--mono)}
.um-upgrade{background:none;border:1px solid rgba(249,115,22,.3);border-radius:7px;padding:5px 12px;font-size:12px;color:#fb923c;cursor:pointer;font-family:'DM Sans',sans-serif}
</style>
</head>
<body class="en">
<div class="toast-container" id="tc"></div>

<nav>
  <a class="logo" href="/">
    <div class="lbox">X</div>
    <div>
      <div class="lname">SEAT<em>X</em></div>
    </div>
  </a>
  <div class="nav-r">
    <div class="ltog">
      <button class="lb on" onclick="setLang('en')">EN</button>
      <button class="lb" onclick="setLang('ar')">AR</button>
    </div>
    <button class="obtn" id="n-si">Sign in</button>
    <button class="gbtn" id="n-st" onclick="scrollTo('add')">Start watching</button>
  </div>
</nav>

<div class="quick-hero">
  <div class="qh-inner">
    <div class="qh-label" id="qhl">🎫 Track any event — free</div>
    <div class="qh-row">
      <input class="qh-input" id="qh-url" type="url" placeholder="Paste ticket link here..." autocomplete="off"/>
      <button class="qh-btn" id="qh-btn" onclick="quickAdd()">Start watching free →</button>
    </div>
    <div class="qh-or" id="qh-or">or <button class="qh-demo" onclick="tryDemo()">try a demo event</button></div>
  </div>
</div>
<div class="ticker-wrap">
  <div class="ticker" id="ticker">
    ${[...Array(2)].map(() => (feed.slice(0,8).map(f =>
      `<div class="ticker-item ${f.type === 'alert_sent' ? 'alert' : f.type === 'status_change' ? 'hot' : ''}">${f.message || ''}</div>`
    ).join(''))).join('')}
    <div class="ticker-item hot">⚡ SeatX — Real-time seat intelligence</div>
    <div class="ticker-item">🇸🇦 Saudi Arabia's seat market</div>
    <div class="ticker-item alert">🔥 ${events.length} events tracked live</div>
    <div class="ticker-item hot">⚡ SeatX — Real-time seat intelligence</div>
    <div class="ticker-item">🇸🇦 Saudi Arabia's seat market</div>
    <div class="ticker-item alert">🔥 ${events.length} events tracked live</div>
  </div>
</div>

<section class="hero">
  <div class="hero-left">
    <div class="eyebrow-pill"><div class="pulse-dot"></div><span id="ep">Saudi seat market · Live</span></div>
    <h1><span id="hm">The seat market,</span><em id="ha">live.</em></h1>
    <p class="hero-sub" id="hs">Track hot events, watch demand move in real time, and get alerted the second seats return — before everyone else.</p>
    <div class="hero-btns">
      <button class="gbtn" id="hb1" onclick="scrollTo('add')">Start watching free</button>
      <button class="obtn" id="hb2" onclick="scrollTo('evs')">View live events ↓</button>
    </div>
     <div class="stats-row">
      <div class="stat-block">
        <div class="stat-label" id="sl1">Watching now</div>
        <div class="stat-val" id="sv1">${events.reduce((a,e) => a+(e.watchers_count||0),0)}<span>live</span></div>
      </div>
      <div class="stat-block">
        <div class="stat-label" id="sl2">Check speed</div>
        <div class="stat-val">15<span>sec</span></div>
      </div>
      <div class="stat-block">
        <div class="stat-label" id="sl3">Events live</div>
        <div class="stat-val" id="sv3">${events.length}<span>now</span></div>
      </div>
    </div>
  </div>

  <div class="market-panel">
    <div class="mp-header">
      <div>
        <div class="mp-title" id="mpt">Live seat market</div>
        <div class="mp-sub" id="mps">Updating every few seconds</div>
      </div>
      <div class="live-badge"><div class="live-dot"></div>LIVE</div>
    </div>
    <div class="demand-bar-wrap">
      <div class="demand-bar-label"><span id="dbl">Market demand</span><span id="dbv">${events.length > 0 ? Math.round(events.reduce((a,e)=>a+(e.demand_score||0),0)/events.length) : 0}/100</span></div>
      <div class="demand-bar-track"><div class="demand-bar-fill" id="dbf" style="width:${events.length > 0 ? Math.round(events.reduce((a,e)=>a+(e.demand_score||0),0)/events.length) : 0}%;background:${events.length > 0 && events.reduce((a,e)=>a+(e.demand_score||0),0)/events.length > 60 ? '#ef4444' : '#a3e635'}"></div></div>
    </div>
    <div class="mp-feed" id="mpfeed">
      ${feed.slice(0,4).map(f => `<div class="feed-item ${f.type==='alert_sent'?'alert':f.type==='status_change'?'hot':''}">${f.message||''}</div>`).join('') || '<div class="feed-item">Monitoring started...</div>'}
    </div>
    ${events[0] ? `
    <div class="mp-hot">
      <div class="mp-hot-label" id="mhl">🔥 Hottest right now</div>
      <div class="mp-hot-title">${events[0].title}</div>
      <div class="mp-hot-meta">
        <span>${events[0].watchers_count||0} watching</span>
        <span style="color:${getDemandColor(events[0].demand_band||'low')};font-weight:700">${getDemandLabel(events[0].demand_band||'low').en}</span>
      </div>
    </div>` : ''}
  </div>
</section>

<div class="section" id="add">
  <div class="add-form">
    <div class="form-title" id="ft1">Track any event</div>
    <div class="form-sub" id="ft2">We alert you the moment seats become available.</div>
    <label class="form-label" id="fl1">Event title</label>
    <input class="form-input" type="text" id="ev-t" placeholder="Al Nassr vs Al Hilal"/>
    <label class="form-label" id="fl2">Ticket URL</label>
    <input class="form-input" type="url" id="ev-u" placeholder="https://webook.com/..."/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="addEvent()" id="afb">🎟 Track this event</button>
    <div class="form-note" id="fn">Free · No account needed · Real-time alerts</div>
  </div>
</div>

<div class="section">
  <div class="section-head">
    <div>
      <div class="section-eyebrow">🔥 Trending</div>
      <div class="section-title">Hottest right now</div>
    </div>
  </div>
  <div class="events-grid">
    ${events.filter((e: any) => (e.demand_score || 0) > 20).slice(0,3).map((e: any) => renderEventCard(e)).join('') || '<p style="color:var(--muted2)">No trending events yet</p>'}
  </div>
</div>
<div class="section" id="evs">
  <div class="section-head">
    <div>
      <div class="section-eyebrow" id="see">Live events</div>
      <div class="section-title" id="set">What people are watching</div>
    </div>
    <div class="sort-tabs">
      <button class="sort-tab on" onclick="sortEvents('demand',this)" id="srt1">Demand</button>
      <button class="sort-tab" onclick="sortEvents('watchers',this)" id="srt2">Watchers</button>
      <button class="sort-tab" onclick="sortEvents('recent',this)" id="srt3">Recent</button>
    </div>
  </div>

  <div class="events-grid" id="egrid">
    ${events.length === 0 ? `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🎫</div>
      <div class="empty-title" id="empt">No events yet</div>
      <div class="empty-sub" id="emps">Add the first event above to start tracking ↑</div>
    </div>` : events.map(e => renderEventCard(e)).join('')}
  </div>
</div>

<div class="section">
  <div class="section-eyebrow" id="hwe">How it works</div>
  <div class="section-title" style="margin-bottom:24px" id="hwt">Three steps. That is it.</div>
  <div class="steps-grid">
    <div class="step-card" data-num="01">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <div class="step-title" id="st1">Pick an event</div>
      <div class="step-desc" id="sd1">Browse tracked events or paste any ticket page URL to start monitoring.</div>
    </div>
    <div class="step-card" data-num="02">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <div class="step-title" id="st2">We watch the market</div>
      <div class="step-desc" id="sd2">SeatX checks every 15 seconds — availability, demand shifts, page changes.</div>
    </div>
    <div class="step-card" data-num="03">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
      <div class="step-title" id="st3">You get alerted first</div>
      <div class="step-desc" id="sd3">Email the second seats move. Before the crowd even knows.</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title" style="text-align:center;margin-bottom:8px">Be first. Or be late.</div>
  <div class="section-title" style="text-align:center;margin-bottom:8px">Pick your speed</div>
  <p style="text-align:center;font-size:13px;color:var(--muted2);margin-bottom:32px">Start free. Upgrade when you need more speed.</p>
  <p style="text-align:center;font-size:13px;color:#fb923c;margin-bottom:24px;font-weight:600">⚡ Tickets appear and disappear in seconds</p>
  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="pc-name">Start getting ahead</div>
<div class="pc-price">$9</div>
<div class="pc-period">per month</div>
<div class="pc-features">
  <div class="pc-f">Faster than free users</div>
  <div class="pc-f">Track multiple events at once</div>
  <div class="pc-f">Stop missing easy drops</div>
</div>
<button class="pc-btn">Get ahead — $9</button>
    </div>
    <div class="pricing-card">
     <div class="pc-name">Be first every time</div>
<div class="pc-price">$19</div>
<div class="pc-period">per month</div>
<div class="pc-features">
  <div class="pc-f">Instant alerts</div>
  <div class="pc-f">Priority monitoring</div>
  <div class="pc-f">Designed for serious buyers</div>
</div>
<button class="pc-btn">Go Pro — $19</button>
    </div>
    <div class="pricing-card pricing-lifetime">
      <div class="pc-badge">Best Value</div>
    <div class="pc-badge">Best Value</div>
<div class="pc-name">Never miss again</div>
<div class="pc-price">$199</div>
<div class="pc-period">one-time</div>
<div class="pc-sub">You only need this once. Miss one important event… this pays for itself.</div>
<div class="pc-features">
  <div class="pc-f">Fastest alerts possible</div>
  <div class="pc-f">Highest priority access</div>
  <div class="pc-f">Track everything you care about</div>
  <div class="pc-f">All future features included</div>
</div>
<button class="pc-btn-lifetime">Never miss again — $199</button>
      <div class="pc-price">$199</div>
      <div class="pc-period">one-time</div>
      <div class="pc-sub">Pay once. Use forever. Less than 11 months of Pro.</div>
      <div class="pc-features">
        <div class="pc-f">30 active events</div>
        <div class="pc-f">Fastest alerts</div>
        <div class="pc-f">Highest priority</div>
        <div class="pc-f">All future features</div>
      </div>
      <button class="pc-btn-lifetime">Claim Lifetime →</button>
    </div>
  </div>
</div>
  </div>
</div>
<footer>© 2025 SEATX · BUILT FOR FANS · 🇸🇦 SAUDI ARABIA</footer>

<script>
const EVENTS = ${ej};
const FEED = ${fj};

const T = {
  en:{
    ep:'Saudi seat market · Live',
    hm:'The seat market,',ha:'live.',
    hs:'Track hot events, watch demand move in real time, and get alerted the second seats return — before everyone else.',
    hb1:'Start watching free',hb2:'View live events ↓',
    'n-si':'Sign in','n-st':'Start watching',
    sl1:'Watching now',sl2:'Check speed',sl3:'Events live',
    mpt:'Live seat market',mps:'Updating every few seconds',
    dbl:'Market demand',mhl:'🔥 Hottest right now',
    ft1:'Track any event',ft2:'We alert you the moment seats become available.',
    fl1:'Event title',fl2:'Ticket URL',
    afb:'🎟 Track this event',fn:'Free · No account needed · Real-time alerts',
    see:'Live events',set:'What people are watching',
    srt1:'Demand',srt2:'Watchers',srt3:'Recent',
    empt:'No events yet',emps:'Add the first event above to start tracking ↑',
    hwe:'How it works',hwt:'Three steps. That is it.',
    st1:'Pick an event',sd1:'Browse tracked events or paste any ticket page URL to start monitoring.',
    st2:'We watch the market',sd2:'SeatX checks every 15 seconds — availability, demand shifts, page changes.',
    st3:'You get alerted first',sd3:'Email the second seats move. Before the crowd even knows.',
    fob:'Founding launch',fot:'First 1,000 members get lifetime access.',
    fos:'Lock in before the price goes up. Get email + Telegram alerts for life.',
    fobtn:'Learn more',foct:'Founding Pass',focs:'One-time · First 1,000 only',
    ff1:'3 lifetime seat alerts',ff2:'Email + Telegram',ff3:'Founding badge',ff4:'Early access to live seat feed',
    focl:'Claim Founding Pass',
    cdl:'Next check',watching:'watching',demand:'Demand',
    alertBtn:'Get Alert',emailPh:'your@email.com',
    statusAvailable:'⚡ Available',statusMaybe:'👀 Maybe',statusWatching:'○ Watching',
    demandVeryHigh:'🔥 On Fire',demandHigh:'⚡ High Demand',demandMedium:'👀 Picking Up',demandLow:'○ Watching',
  },
  ar:{
    ep:'سوق المقاعد السعودي · مباشر',
    hm:'سوق المقاعد،',ha:'مباشر.',
    hs:'تابع الفعاليات المباعة، راقب حركة الطلب فوراً، وخلك أول من يعرف قبل الجميع.',
    hb1:'ابدأ المتابعة مجاناً',hb2:'شوف الفعاليات ↓',
    'n-si':'تسجيل الدخول','n-st':'ابدأ المتابعة',
    sl1:'يتابعون الآن',sl2:'سرعة الفحص',sl3:'فعاليات مباشرة',
    mpt:'السوق المباشر',mps:'يتحدث كل ثوانٍ',
    dbl:'الطلب في السوق',mhl:'🔥 الأكثر سخونة',
    ft1:'تابع أي فعالية',ft2:'سنبعث لك تنبيهاً فور توفر المقاعد.',
    fl1:'اسم الفعالية',fl2:'رابط التذاكر',
    afb:'🎟 تابع هذه الفعالية',fn:'مجاني · بدون حساب · تنبيهات فورية',
    see:'الفعاليات المباشرة',set:'ما يتابعه الناس الآن',
    srt1:'الطلب',srt2:'المتابعون',srt3:'الأحدث',
    empt:'لا فعاليات بعد',emps:'أضف أول فعالية للمتابعة ↑',
    hwe:'كيف يعمل',hwt:'ثلاث خطوات. بس.',
    st1:'اختر فعاليتك',sd1:'تصفح الفعاليات أو أضف أي رابط تذاكر مباشرة.',
    st2:'نحن نراقب السوق',sd2:'SeatX يفحص كل 15 ثانية — توفر وطلب وتغييرات.',
    st3:'تنبيهك يصلك أول',sd3:'إيميل في لحظة تحرك المقاعد. قبل الجميع.',
    fob:'إطلاق المؤسسين',fot:'أول ألف عضو يحصلون على وصول مدى الحياة.',
    fos:'ثبّت سعرك قبل ارتفاعه.',
    fobtn:'اعرف أكثر',foct:'تصريح المؤسسين',focs:'دفعة واحدة · أول 1,000 فقط',
    ff1:'3 تنبيهات مدى الحياة',ff2:'إيميل + تيليغرام',ff3:'شارة المؤسس',ff4:'وصول مبكر للسوق المباشر',
    focl:'احجز تصريح المؤسسين',
    cdl:'الفحص القادم',watching:'يتابعون',demand:'الطلب',
    alertBtn:'تنبّهني',emailPh:'بريدك@مثال.com',
    statusAvailable:'⚡ متاح',statusMaybe:'👀 ربما',statusWatching:'○ قيد المراقبة',
    demandVeryHigh:'🔥 ملتهب',demandHigh:'⚡ طلب مرتفع',demandMedium:'👀 يرتفع',demandLow:'○ هادئ',
  }
};

let lang = 'en';

function scrollTo(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); }

function s(id, v){ const e = document.getElementById(id); if(e) e.textContent = v; }

function setLang(l) {
  lang = l;
  const isAr = l === 'ar';
  document.documentElement.lang = l;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.body.className = isAr ? 'ar' : 'en';
  document.querySelectorAll('.lb').forEach((b,i) => b.classList.toggle('on', i === (isAr ? 1 : 0)));
  const t = T[l];
  Object.keys(t).forEach(k => s(k, t[k]));
  document.querySelectorAll('.cdl').forEach(el => el.textContent = t.cdl);
  if(isAr){
    document.getElementById('ev-t').placeholder = 'النصر ضد الهلال';
    document.getElementById('ev-u').placeholder = 'https://webook.com/...';
  } else {
    document.getElementById('ev-t').placeholder = 'Al Nassr vs Al Hilal';
    document.getElementById('ev-u').placeholder = 'https://webook.com/...';
  }
  // Re-render cards so demand labels, status badges, and button text switch language
  renderCards();
}

// COUNTDOWN TIMERS
let cdv = {};
function initTimers(){
  document.querySelectorAll('.cdv').forEach((el,i) => {
    cdv[i] = Math.floor(Math.random() * 15);
    el.textContent = '0:' + String(cdv[i]).padStart(2,'0');
  });
}
setInterval(() => {
  document.querySelectorAll('.cdv').forEach((el,i) => {
    if(cdv[i] === undefined) cdv[i] = 15;
    cdv[i]--;
    if(cdv[i] < 0) cdv[i] = 15;
    el.textContent = '0:' + String(cdv[i]).padStart(2,'0');
    if(cdv[i] === 0){
      el.style.color = 'var(--lime)';
      el.style.textShadow = '0 0 8px rgba(163,230,53,.8)';
      setTimeout(() => { el.style.color=''; el.style.textShadow=''; }, 700);
    }
  });
}, 1000);

// LIVE FEED POLLING
async function pollFeed(){
  try {
    const r = await fetch('/api/feed');
    const data = await r.json();
    const mp = document.getElementById('mpfeed');
    if(!mp || !data.logs?.length) return;
    mp.innerHTML = data.logs.slice(0,4).map(f =>
      \`<div class="feed-item \${f.type==='alert_sent'?'alert':f.type==='status_change'?'hot':''}">\${f.message||''}</div>\`
    ).join('');
  } catch(_){}
}
setInterval(pollFeed, 8000);

// SORT EVENTS
let currentEvents = [...EVENTS];
function sortEvents(by, tabEl){
  document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('on'));
  if(tabEl) tabEl.classList.add('on');
  if(by === 'demand') currentEvents.sort((a,b) => (b.demand_score||0)-(a.demand_score||0));
  if(by === 'watchers') currentEvents.sort((a,b) => (b.watchers_count||0)-(a.watchers_count||0));
  if(by === 'recent') currentEvents.sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  renderCards();
}

function renderCards(){
  const grid = document.getElementById('egrid');
  if(!grid) return;
  if(currentEvents.length === 0){
    const t = T[lang];
    grid.innerHTML = \`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎫</div><div class="empty-title">\${t.empt}</div><div class="empty-sub">\${t.emps}</div></div>\`;
    return;
  }
  grid.innerHTML = currentEvents.map(e => buildCard(e)).join('');
  initTimers();
  animateScoreBars();
}

function getDemandClass(band){ return 'cdt-'+(band||'low'); }
function getDemandLabelJS(band){
  const t = T[lang];
  if(band==='very_high') return t.demandVeryHigh;
  if(band==='high') return t.demandHigh;
  if(band==='medium') return t.demandMedium;
  return t.demandLow;
}
function getCardClass(band){
  if(band==='very_high'||band==='high') return 'ecard hot-card';
  if(band==='medium') return 'ecard warm-card';
  return 'ecard';
}
function getScoreColor(score){
  if(score>=80) return '#ef4444';
  if(score>=55) return '#f97316';
  if(score>=30) return '#eab308';
  return '#a3e635';
}

function buildCard(e){
  const t = T[lang];
  const band = e.demand_band || 'low';
  const score = e.demand_score || 0;
  const statusClass = e.status==='available'?'csb-available':e.status==='maybe_available'?'csb-maybe':'csb-unavailable';
  const statusLabel = e.status==='available'?t.statusAvailable:e.status==='maybe_available'?t.statusMaybe:t.statusWatching;
  const imgSection = e.hero_image
    ? \`<div class="card-img"><img src="\${e.hero_image}" alt="\${e.title}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=card-img-fallback><div class=card-img-icon>🎫</div></div>'"/><div class="card-overlay"></div>\${e.source_name?'<div class="card-source">'+e.source_name+'</div>':''}<div class="card-status-badge \${statusClass}">\${statusLabel}</div></div>\`
    : \`<div class="card-img"><div class="card-img-fallback"><div class="card-img-icon">🎫</div></div>\${e.source_name?'<div class="card-source">'+e.source_name+'</div>':''}<div class="card-status-badge \${statusClass}">\${statusLabel}</div></div>\`;

  return \`
  <div class="\${getCardClass(band)}">
    \${imgSection}
    <div class="card-body">
      <div class="card-demand-row">
        <div class="card-demand-tag \${getDemandClass(band)}">\${getDemandLabelJS(band)}</div>
        <div class="card-watchers">👥 \${e.watchers_count||0} \${t.watching}</div>
      </div>
      <div class="card-title">\${e.title}</div>
      <div class="card-url">\${e.event_url}</div>
      \${e.event_date||e.location?'<div class="card-meta-row">'+(e.event_date?'<div class="card-meta-item">📅 '+e.event_date+'</div>':'')+(e.location?'<div class="card-meta-item">📍 '+e.location+'</div>':'')+'</div>':''}
      <div class="card-score-row">
        <div class="score-track"><div class="score-fill" data-score="\${score}" style="width:0%;background:\${getScoreColor(score)}"></div></div>
        <div class="score-val">\${score}</div>
      </div>
      <div class="card-check-row">
        <div class="check-label"><div class="check-dot"></div><span class="cdl">\${t.cdl}</span></div>
        <div class="check-timer cdv">0:15</div>
      </div>
      <div class="card-sub-row">
        <input class="card-email" id="em-\${e.id}" placeholder="\${t.emailPh}" type="email"/>
        <button class="card-alert-btn" onclick="subscribe(\${e.id},this)">\${t.alertBtn}</button>
      </div>
    </div>
  </div>\`;
}

function animateScoreBars(){
  setTimeout(() => {
    document.querySelectorAll('.score-fill[data-score]').forEach(el => {
      el.style.width = el.dataset.score + '%';
    });
  }, 100);
}

// TOASTS
let ti = 0;
const staticToasts = {
  en:[
    {i:'⚡',t:'Seats returned — UFC Riyadh',s:'2 Premium seats appeared. 847 users notified.'},
    {i:'🔥',t:'Al Nassr Derby — demand spike',s:'542 new users in the last 10 minutes.'},
    {i:'🚨',t:'Page change detected',s:'Riyadh Season Concert — availability updated.'},
  ],
  ar:[
    {i:'⚡',t:'مقاعد UFC الرياض عادت',s:'مقعدان بريميوم ظهرا. 847 مستخدم تم تنبيههم.'},
    {i:'🔥',t:'ديربي النصر — ارتفاع الطلب',s:'542 مستخدم جديد في 10 دقائق.'},
    {i:'🚨',t:'تغيير مرصود',s:'حفل موسم الرياض — تحديث التوفر.'},
  ]
};
function showToast(){
  const ts = staticToasts[lang] || staticToasts.en;
  const d = ts[ti % ts.length]; ti++;
  const tc = document.getElementById('tc');
  const t = document.createElement('div'); t.className = 'toast';
  t.style.fontFamily = lang==='ar' ? "'IBM Plex Sans Arabic',sans-serif" : "'DM Sans',sans-serif";
  if(lang==='ar') t.style.direction='rtl';
  t.innerHTML = \`<div class="toast-icon">\${d.i}</div><div><div class="toast-title">\${d.t}</div><div class="toast-sub">\${d.s}</div></div><div class="toast-bar" style="animation-duration:5000ms"></div>\`;
  tc.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on')));
  setTimeout(() => { t.classList.add('off'); t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 5000);
}
setTimeout(() => { showToast(); setInterval(showToast, 9000 + Math.random()*2000); }, 2500);

// ADD EVENT
async function addEvent(){
  const title = document.getElementById('ev-t').value.trim();
  const url = document.getElementById('ev-u').value.trim();
  if(!title||!url){ alert(lang==='ar'?'أكمل جميع الحقول':'Fill all fields'); return; }
  const btn = document.getElementById('afb');
  btn.textContent = lang==='ar'?'جاري الإضافة...':'Adding...';
  btn.disabled = true;
  try {
    await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,eventUrl:url})});
    location.reload();
  } catch(e){ alert('Error'); btn.disabled=false; }
}

// SUBSCRIBE
async function subscribe(id, btnEl){
  const email = document.getElementById('em-'+id)?.value?.trim();
  if(!email||!email.includes('@')){ alert(lang==='ar'?'أدخل بريد صحيح':'Enter valid email'); return; }
  const res = await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:id,email})});
const data = await res.json();
if (data.upgrade) {
  const grid = document.getElementById('egrid');
  if(grid) grid.insertAdjacentHTML('beforeend', '<div class="upgrade-prompt"><div class="up-title">Track more events and get faster alerts</div><button class="pc-btn-lifetime" style="max-width:280px;margin:0 auto" onclick="document.querySelector(\'.pricing-grid\').scrollIntoView({behavior:\'smooth\'})">See plans →</button></div>');
  return;
}
  const btn = btnEl || document.querySelector(\`[onclick*="subscribe(\${id})"]\`);
  try {
    await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:id,email})});
    if(btn){
      btn.textContent = '✅';
      btn.style.background='rgba(163,230,53,.2)';
      btn.style.color='var(--lime)';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = T[lang].alertBtn; btn.style.background=''; btn.style.color=''; btn.disabled=false; }, 3000);
    }
  } catch(e){ alert('Error'); }
}

// INIT
// QUICK ADD
async function quickAdd() {
  const url = document.getElementById('qh-url').value.trim();
  if (!url) {
    document.getElementById('qh-url').focus();
    return;
  }
  const btn = document.getElementById('qh-btn');
  btn.textContent = 'Adding...';
  btn.disabled = true;
  const grid = document.getElementById('egrid');
  if (grid) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.id = 'sk-temp';
    grid.prepend(sk);
  }
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: url.replace(/^https?:\/\//, '').split('/')[0], eventUrl: url})
    });
    showEmailPopup();
    setTimeout(() => location.reload(), 3000);
  } catch(e) {
    btn.textContent = lang === 'ar' ? 'ابدأ المتابعة مجاناً ←' : 'Start watching free →';
    btn.disabled = false;
    const sk = document.getElementById('sk-temp');
    if (sk) sk.remove();
  }
}

async function tryDemo() {
  const demoUrl = 'https://www.ticketmaster.sa/';
  const demoTitle = 'Demo Event — Saudi Concert';
  const btn = document.querySelector('.qh-demo');
  if (btn) { btn.textContent = 'Adding demo...'; btn.disabled = true; }
  const grid = document.getElementById('egrid');
  if (grid) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.id = 'sk-demo';
    grid.prepend(sk);
  }
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: demoTitle, eventUrl: demoUrl})
    });
    showEmailPopup();
    setTimeout(() => location.reload(), 3000);
  } catch(e) {
    if (btn) { btn.textContent = 'try a demo event'; btn.disabled = false; }
    const sk = document.getElementById('sk-demo');
    if (sk) sk.remove();
  }
}

function showEmailPopup() {
  const popup = document.createElement('div');
  popup.className = 'email-popup';
  popup.id = 'email-popup';
  popup.innerHTML = \`
    <div class="email-popup-box">
      <div class="email-popup-title">⚡ Event added!</div>
      <div class="email-popup-sub">Enter your email to get alerted the second seats become available.</div>
      <input class="email-popup-input" id="popup-email" type="email" placeholder="your@email.com" autofocus/>
      <button class="gbtn" style="width:100%;padding:11px" onclick="submitPopupEmail()">Get alerts →</button>
      <br/>
      <button class="email-popup-skip" onclick="document.getElementById('email-popup').remove()">Skip for now</button>
    </div>
  \`;
  document.body.appendChild(popup);
  setTimeout(() => { const i = document.getElementById('popup-email'); if(i) i.focus(); }, 100);
}

async function submitPopupEmail() {
  const email = document.getElementById('popup-email')?.value?.trim();
  if (!email || !email.includes('@')) return;
  const events = EVENTS;
  if (events.length > 0) {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({eventId: events[0].id, email})
    });
  }
  document.getElementById('email-popup')?.remove();
  location.reload();
}
async function quickAdd() {
  const url = document.getElementById('qh-url').value.trim();
  if (!url) { document.getElementById('qh-url').focus(); return; }
  const btn = document.getElementById('qh-btn');
  btn.textContent = 'Adding...'; btn.disabled = true;
  const grid = document.getElementById('egrid');
  if (grid) { const sk = document.createElement('div'); sk.className = 'skeleton'; sk.id = 'sk-temp'; grid.prepend(sk); }
  try {
    await fetch('/api/events', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({title: url.replace(/^https?:\/\//,'').split('/')[0], eventUrl: url}) });
    showEmailPopup();
    setTimeout(() => location.reload(), 3000);
  } catch(e) {
    btn.textContent = 'Start watching free →'; btn.disabled = false;
    const sk = document.getElementById('sk-temp'); if (sk) sk.remove();
  }
}

async function tryDemo() {
  const btn = document.querySelector('.qh-demo');
  if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }
  const grid = document.getElementById('egrid');
  if (grid) { const sk = document.createElement('div'); sk.className = 'skeleton'; sk.id = 'sk-demo'; grid.prepend(sk); }
  try {
    await fetch('/api/events', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({title: 'Al Nassr vs Al Hilal — Demo', eventUrl: 'https://www.ticketmaster.sa/'}) });
    showEmailPopup();
    setTimeout(() => location.reload(), 3000);
  } catch(e) {
    if (btn) { btn.textContent = 'try a demo event'; btn.disabled = false; }
    const sk = document.getElementById('sk-demo'); if (sk) sk.remove();
  }
}

function showEmailPopup() {
  const popup = document.createElement('div');
  popup.className = 'email-popup'; popup.id = 'email-popup';
  popup.innerHTML = \`<div class="email-popup-box">
    <div class="email-popup-title">⚡ Event added!</div>
    <div class="email-popup-sub">Enter your email to get alerted the second seats become available.</div>
    <input class="email-popup-input" id="popup-email" type="email" placeholder="your@email.com"/>
    <button class="gbtn" style="width:100%;padding:11px" onclick="submitPopupEmail()">Get alerts →</button><br/>
    <button class="email-popup-skip" onclick="document.getElementById('email-popup').remove()">Skip for now</button>
  </div>\`;
  document.body.appendChild(popup);
  setTimeout(() => { const i = document.getElementById('popup-email'); if(i) i.focus(); }, 100);
}

async function submitPopupEmail() {
  const email = document.getElementById('popup-email')?.value?.trim();
  if (!email || !email.includes('@')) return;
  if (EVENTS.length > 0) {
    await fetch('/api/subscribe', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({eventId: EVENTS[0].id, email}) });
  }
  document.getElementById('email-popup')?.remove();
  location.reload();
}
document.addEventListener('DOMContentLoaded', () => {
  setLang('en');
  initTimers();
  animateScoreBars();
  const qhInput = document.getElementById('qh-url');
  if (qhInput) qhInput.focus();
});
</script>
</body>
</html>`;
}

function renderEventCard(e: any): string {
  const band: string = e.demand_band || 'low';
  const score: number = e.demand_score || 0;
  const statusClass: string = e.status === 'available' ? 'csb-available' : e.status === 'maybe_available' ? 'csb-maybe' : 'csb-unavailable';
  const statusLabel: string = e.status === 'available' ? '⚡ Available' : e.status === 'maybe_available' ? '👀 Maybe' : '○ Watching';
  const cardClass: string = (band === 'very_high' || band === 'high') ? 'ecard hot-card' : band === 'medium' ? 'ecard warm-card' : 'ecard';
  const scoreColor: string = score >= 80 ? '#ef4444' : score >= 55 ? '#f97316' : score >= 30 ? '#eab308' : '#a3e635';
  const demandLabel: string = band === 'very_high' ? '🔥 On Fire' : band === 'high' ? '⚡ High Demand' : band === 'medium' ? '👀 Picking Up' : '○ Watching';
  const demandTagClass: string = 'cdt-' + band;
  const fomoText: string = band === 'very_high'
    ? '🔥 Selling fast — high demand'
    : band === 'high'
    ? '⚡ People joining right now'
    : band === 'medium'
    ? '👀 Demand picking up'
    : '';
  const trendArrow: string = '';
  const sourcePart: string = e.source_name ? '<div class="card-source">' + e.source_name + '</div>' : '';
  const metaPart: string = (e.event_date || e.location)
    ? '<div class="card-meta-row">'
      + (e.event_date ? '<div class="card-meta-item">📅 ' + e.event_date + '</div>' : '')
      + (e.location ? '<div class="card-meta-item">📍 ' + e.location + '</div>' : '')
      + '</div>'
    : '';
  const imgSection: string = e.hero_image
    ? '<div class="card-img"><img src="' + e.hero_image + '" alt="' + e.title + '" loading="lazy" onerror="this.parentNode.innerHTML=\'<div class=card-img-fallback><div class=card-img-icon>🎫</div></div>\'"/><div class="card-overlay"></div>' + sourcePart + '<div class="card-status-badge ' + statusClass + '">' + statusLabel + '</div></div>'
   : '<div class="card-img" style="background:linear-gradient(135deg,#0d1117,#1a1f2e);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">' + sourcePart + '<div style="font-size:11px;font-weight:700;color:rgba(163,230,53,.6);font-family:var(--mono);text-transform:uppercase;letter-spacing:.15em">LIVE EVENT</div><div style="font-size:15px;font-weight:800;color:#fff;text-align:center;padding:0 16px;line-height:1.3">' + e.title + '</div><div style="width:40px;height:2px;background:rgba(163,230,53,.4);border-radius:2px"></div><div class="card-status-badge ' + statusClass + '">' + statusLabel + '</div></div>';

  return '<div class="' + cardClass + '">'
    + imgSection
    + '<div class="card-body">'
    + '<div class="card-demand-row">'
    + '<div class="card-demand-tag ' + demandTagClass + '">' + demandLabel + '</div>'
+ '<div class="card-watchers">👥 ' + (e.watchers_count || 0) + ' watching'
+ (e.demand_band === 'very_high' || e.demand_band === 'high' ? ' · <span style="color:#fb923c">Spiking</span>' : '')
+ '</div>'
+ (e.recent_transition_count > 0 ? '<div style="font-size:10px;color:var(--lime);margin-bottom:6px">⚡ ' + e.recent_transition_count + ' availability changes detected</div>' : '')
    + '</div>'
    + (fomoText ? '<div class="card-fomo">' + fomoText + '</div>' : '')
    + '<div class="card-title">' + e.title + '</div>'
    + '<div class="card-url">' + e.event_url + '</div>'
    + metaPart
    + '<div class="card-score-row"><div class="score-track"><div class="score-fill" data-score="' + score + '" style="width:0%;background:' + scoreColor + '"></div></div><div class="score-val">' + score + '</div></div>'
    + '<div class="card-check-row"><div class="check-label"><div class="check-dot"></div><span class="cdl">Next check</span></div><div class="check-timer cdv">0:15</div></div>'
    + '<div class="card-sub-row"><input class="card-email" id="em-' + e.id + '" placeholder="your@email.com" type="email"/><button class="card-alert-btn" onclick="subscribe(' + e.id + ',this)">Get Alert</button></div>'
    + '</div>'
    + '</div>';
}

// Routes
app.get('/', async (req, res) => {
  let events: any[] = [];
  let feed: any[] = [];
  try {
    const r = await pool.query('SELECT * FROM events ORDER BY demand_score DESC, created_at DESC');
    events = r.rows;
  } catch (_) {}
  try {
    const { getActivityFeed } = await import('./feed');
    feed = await getActivityFeed(20);
  } catch (_) {}
  res.setHeader('Content-Type', 'text/html');
  res.end(getHTML(events, feed));
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, eventUrl } = req.body;
    if (!title || !eventUrl) return res.status(400).json({ error: 'Missing fields' });
    const r = await pool.query(
      'INSERT INTO events (title, event_url) VALUES ($1,$2) RETURNING *',
      [title, eventUrl]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { eventId, email } = req.body;
    // Freemium limit check
    const { getActiveEventCount } = require('./db');
    const activeCount = await getActiveEventCount(email);
    if (activeCount >= 1) {
      return res.status(403).json({
        error: 'limit_reached',
        message: 'Free plan allows only 3 active events',
        upgrade: true
      });
    }
    const result = await pool.query(
      'INSERT INTO subscriptions (event_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id',
      [eventId, email]
    );
    const inserted = (result.rowCount ?? 0) > 0;
    if (inserted) {
      await pool.query('UPDATE events SET watchers_count = watchers_count + 1 WHERE id = $1', [eventId]);
      const { logActivity } = await import('./feed');
      const ev = await pool.query('SELECT title FROM events WHERE id=$1', [eventId]);
      if (ev.rows[0]) {
        await logActivity(eventId, 'watcher_added', `New watcher joined "${ev.rows[0].title}"`);
      }
    }
    if (!inserted) {
  return res.status(403).json({
    error: 'limit_reached',
    message: 'Track more events and get faster alerts',
    upgrade: true
  });
}
    res.json({ success: true, inserted });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/feed', async (req, res) => {
  try {
    const feed = await getActivityFeed(20);
    res.json({ logs: feed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM events ORDER BY demand_score DESC, created_at DESC');
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, async () => {
  await setupDB();
  console.log(`SeatX running on port ${PORT}`);
  setTimeout(async () => {
    await runMonitorCycle();
    setInterval(runMonitorCycle, 15000);
  }, 5000);
});
