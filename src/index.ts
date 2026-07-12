import express, { Request, Response } from 'express';
import { createHash } from 'crypto';
import { pool, setupDB, getActiveEventCount } from './db';
import { runMonitorCycle } from './monitor';
import { getActivityFeed, logActivity } from './feed';
import { getPublicConfig } from './push';

const app = express();
app.use(express.json({ limit: '64kb' }));

// FanX by SeatX — World Cup 2026 decision radar. Strictly env-gated. When
// FANX_ENABLED is not 'true', the router is not mounted and the module tree
// is not loaded — zero effect on SeatX. All FanX routes live under /fanx/*.
if (process.env.FANX_ENABLED === 'true') {
  // Lazy require so FanX code never executes when the flag is off.
  const { createFanxRouter } = require('./fanx/routes');
  app.use('/fanx', createFanxRouter());
  console.log('[startup] FanX enabled — routes mounted at /fanx');
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================
function isValidUrl(u: unknown): u is string {
  if (typeof u !== 'string' || u.length > 2000) return false;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

// Normalize a user-pasted link. Prepends https:// when the protocol is
// missing (real users paste "webook.com/..." all the time) and returns the
// canonical href, or null if it still isn't a valid http(s) URL. This is the
// server-side half of the fix for the false "invalid link" rejection.
function normalizeUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  let s = u.trim();
  if (!s || s.length > 2000) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const p = new URL(s);
    if (p.protocol === 'http:' || p.protocol === 'https:') return p.href;
  } catch { /* fall through */ }
  return null;
}

function isValidTitle(t: unknown): t is string {
  if (typeof t !== 'string') return false;
  const trimmed = t.trim();
  return trimmed.length >= 1 && trimmed.length <= 200;
}

function isValidEmail(e: unknown): e is string {
  return typeof e === 'string'
    && e.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Hash email for use in rate-limit keys + abuse logs. We never log raw emails
// (privacy); the truncated SHA1 is enough to correlate events without exposing
// the address. Lowercased + trimmed so the same email maps to one bucket.
function hashEmail(e: string): string {
  return createHash('sha1').update(e.toLowerCase().trim()).digest('hex').slice(0, 12);
}

// Allowed ticket vendor domains. Env-driven via ALLOWED_TICKET_DOMAINS so we
// can widen the list without redeploy. Suffix match: 'webook.com' matches
// 'webook.com' and 'sa.webook.com'. Anything outside this list is rejected at
// /api/events — this is the strongest single anti-abuse measure (kills fake
// event spam AND prevents SSRF-style outbound scraping of arbitrary URLs).
const TICKET_DOMAINS: string[] = (process.env.ALLOWED_TICKET_DOMAINS ||
  'webook.com,ticketmaster.sa,ticketmaster.com,platinumlist.net,eventbrite.com,ticketmx.com,coca-cola-arena.com')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

function isAllowedTicketDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TICKET_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =============================================================================
// RATE LIMITER (in-memory, per IP+route)
// =============================================================================
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

const rateCleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateMap) if (now > v.resetAt) rateMap.delete(k);
}, 60000);
rateCleanup.unref?.();

function getIP(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd) || req.socket?.remoteAddress || 'unknown';
  return raw.toString().split(',')[0].trim();
}

// =============================================================================
// DEMAND HELPERS
// =============================================================================
function getDemandColor(band: string): string {
  if (band === 'very_high') return '#ef4444';
  if (band === 'high') return '#f97316';
  if (band === 'medium') return '#eab308';
  return '#a3e635';
}

function getDemandLabel(band: string, lang: 'en' | 'ar'): string {
  if (lang === 'ar') {
    if (band === 'very_high') return '🔥 ملتهب';
    if (band === 'high') return '⚡ طلب مرتفع';
    if (band === 'medium') return '👀 يرتفع';
    return '○ هادئ';
  }
  if (band === 'very_high') return '🔥 On Fire';
  if (band === 'high') return '⚡ High Demand';
  if (band === 'medium') return '👀 Picking Up';
  return '○ Watching';
}

// =============================================================================
// CARD RENDERER (server-side, English by default; client re-renders on lang switch)
// =============================================================================
function renderEventCard(e: any): string {
  const band: string = e.demand_band || 'low';
  const score: number = e.demand_score || 0;
  const status: string = e.status || 'unavailable';
  const statusClass = status === 'available'
    ? 'csb-available'
    : status === 'maybe_available' ? 'csb-maybe' : 'csb-unavailable';
  const statusLabel = status === 'available'
    ? '⚡ Available'
    : status === 'maybe_available' ? '👀 Maybe' : '○ Watching';
  const cardClass = (band === 'very_high' || band === 'high')
    ? 'ecard hot-card'
    : band === 'medium' ? 'ecard warm-card' : 'ecard';
  const scoreColor = score >= 80 ? '#ef4444'
    : score >= 55 ? '#f97316'
    : score >= 30 ? '#eab308' : '#a3e635';
  const demandLabel = getDemandLabel(band, 'en');
  const demandTagClass = 'cdt-' + band;
  const fomoText = band === 'very_high'
    ? '🔥 Selling fast — high demand'
    : band === 'high' ? '⚡ People joining right now'
    : band === 'medium' ? '👀 Demand picking up' : '';
  const safeTitle = escapeHtml(e.title || '');
  const safeUrl = escapeHtml(e.event_url || '');
  const sourcePart = e.source_name
    ? `<div class="card-source">${escapeHtml(e.source_name)}</div>`
    : '';
  const metaPart = (e.event_date || e.location)
    ? `<div class="card-meta-row">${e.event_date ? `<div class="card-meta-item">📅 ${escapeHtml(e.event_date)}</div>` : ''}${e.location ? `<div class="card-meta-item">📍 ${escapeHtml(e.location)}</div>` : ''}</div>`
    : '';
  const imgSection = e.hero_image
    ? `<div class="card-img"><img src="${escapeHtml(e.hero_image)}" alt="${safeTitle}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=card-img-fallback><div class=card-img-icon>🎫</div></div>'"/><div class="card-overlay"></div>${sourcePart}<div class="card-status-badge ${statusClass}">${statusLabel}</div></div>`
    : `<div class="card-img" style="background:linear-gradient(135deg,#0d1117,#1a1f2e);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">${sourcePart}<div style="font-size:11px;font-weight:700;color:rgba(163,230,53,.6);font-family:var(--mono);text-transform:uppercase;letter-spacing:.15em">LIVE EVENT</div><div style="font-size:15px;font-weight:800;color:#fff;text-align:center;padding:0 16px;line-height:1.3">${safeTitle}</div><div style="width:40px;height:2px;background:rgba(163,230,53,.4);border-radius:2px"></div><div class="card-status-badge ${statusClass}">${statusLabel}</div></div>`;

  return `
  <div class="${cardClass}">
    ${imgSection}
    <div class="card-body">
      <div class="card-demand-row">
        <div class="card-demand-tag ${demandTagClass}">${demandLabel}</div>
        <div class="card-watchers">👥 ${e.watchers_count || 0} <span class="watching-label">watching</span>${(band === 'very_high' || band === 'high') ? ' · <span style="color:#fb923c" class="spiking-label">Spiking</span>' : ''}</div>
      </div>
      ${e.recent_transition_count > 0 ? `<div style="font-size:10px;color:var(--lime);margin-bottom:6px">⚡ ${e.recent_transition_count} availability changes detected</div>` : ''}
      ${fomoText ? `<div class="card-fomo">${fomoText}</div>` : ''}
      <div class="card-title">${safeTitle}</div>
      <div class="card-url">${safeUrl}</div>
      ${metaPart}
      <div class="card-score-row"><div class="score-track"><div class="score-fill" data-score="${score}" style="width:0%;background:${scoreColor}"></div></div><div class="score-val">${score}</div></div>
      <div class="card-check-row"><div class="check-label"><div class="check-dot"></div><span class="cdl">Next check</span></div><div class="check-timer cdv">0:15</div></div>
      <div class="card-sub-row">
        <input class="card-email" id="em-${e.id}" placeholder="your@email.com" type="email" autocomplete="email"/>
        <button class="card-alert-btn" onclick="subscribe(${e.id},this)">Get Alert</button>
        <button class="card-share-btn" onclick="event.stopPropagation();openShareModal(${e.id})" title="Share" aria-label="Share">↗</button>
      </div>
    </div>
  </div>`;
}

// =============================================================================
// TRENDING CARD (compact, app-like — for the Trending tab)
// =============================================================================
function renderTrendingCard(e: any): string {
  const band: string = e.demand_band || 'low';
  const cardClass = (band === 'very_high' || band === 'high')
    ? 'tcard tcard-hot'
    : band === 'medium' ? 'tcard tcard-warm' : 'tcard';
  const heatLabel = band === 'very_high' ? '🔥 طلب مرتفع جداً'
    : band === 'high'   ? '⚡ طلب مرتفع'
    : band === 'medium' ? '👀 يرتفع الطلب'
    : '○ قيد المراقبة';
  const watchers = e.watchers_count || 0;
  const watchersStr = watchers >= 1000
    ? (Math.round(watchers / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K'
    : String(watchers);
  const safeTitle = escapeHtml(e.title || '');
  const cat = e.source_name ? escapeHtml(e.source_name) : 'فعالية مباشرة';
  const url = escapeHtml(e.event_url || '#');
  const thumb = e.hero_image
    ? `<img src="${escapeHtml(e.hero_image)}" alt="${safeTitle}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=tcard-thumb-fallback>🎫</div>'"/>`
    : `<div class="tcard-thumb-fallback">🎫</div>`;
  return `
  <a class="${cardClass}" href="${url}" target="_blank" rel="noopener">
    <div class="tcard-thumb">${thumb}</div>
    <div class="tcard-body">
      <div class="tcard-title">${safeTitle}</div>
      <div class="tcard-cat">${cat}</div>
      <div class="tcard-heat heat-${band}">${heatLabel}</div>
    </div>
    <div class="tcard-meta">
      <div class="tcard-watchers"><em>${watchersStr}</em> يراقبون</div>
    </div>
  </a>`;
}

// =============================================================================
// HOME PAGE HTML
// =============================================================================
function getHTML(events: any[], feed: any[], alerts24h: number = 0): string {
  const ej = JSON.stringify(events).replace(/</g, '\\u003c');
  const fj = JSON.stringify(feed).replace(/</g, '\\u003c');
  // FanX secondary entry only renders when FanX is live (avoids a dead link).
  const fanxOn = process.env.FANX_ENABLED === 'true';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SeatX — السوق المباشر لتذاكر السعودية</title>
<meta name="description" content="ذكاء سوق مباشر لتذاكر المباريات والحفلات والفعاليات في السعودية. اعرف لحظة رجوع المقاعد قبل أي شخص ثاني."/>
<meta name="description" lang="en" content="Real-time demand intelligence for Saudi sports, concerts, and events. Know the second seats return — before everyone else."/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
/* ─── GLOBAL TAP/LINK DEFAULTS ────────────────────────────────────
   Fix sources of mobile interaction breakage:
   - <a> with no explicit color → browser default purple on :visited
   - 300ms tap delay on iOS without touch-action
   - default gray tap-flash overlay
   - SVG inside buttons capturing clicks (Safari quirk)
*/
a{color:inherit;text-decoration:none}
a:visited{color:inherit}
button,a,input,select,textarea{-webkit-tap-highlight-color:rgba(163,230,53,.18)}
button,a,[role=button]{touch-action:manipulation;cursor:pointer}
button svg,a svg{pointer-events:none}
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
body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:.4}
nav{position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border);background:rgba(8,10,14,.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:0 32px;height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.lbox{width:32px;height:32px;border-radius:8px;background:var(--lime-dim);border:1px solid rgba(163,230,53,.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--lime);font-family:'DM Sans',sans-serif;letter-spacing:-.04em}
.lname{font-size:15px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif;letter-spacing:-.02em}
.lname em{color:var(--lime);font-style:normal}
.nav-r{display:flex;align-items:center;gap:8px}
.ltog{display:flex;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:7px;padding:2px;gap:2px}
.lb{background:none;border:none;border-radius:5px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;color:var(--muted2);font-family:'DM Sans',sans-serif;transition:all .15s;letter-spacing:.03em}
.lb.on{background:var(--lime);color:#000}
.gbtn{background:var(--lime);border:none;border-radius:8px;padding:7px 16px;font-size:13px;font-weight:700;color:#000;cursor:pointer;transition:all .15s;letter-spacing:-.01em;font-family:inherit}
.gbtn:hover{background:var(--lime2);transform:translateY(-1px)}
.obtn{background:none;border:1px solid var(--border2);border-radius:8px;padding:7px 14px;font-size:13px;color:var(--muted3);cursor:pointer;transition:all .15s;font-family:inherit}
.obtn:hover{border-color:rgba(255,255,255,.2);color:#fff}
/* Icon-only variant for top-nav account (docs/design.md §5: no clutter) */
.obtn.obtn-icon{padding:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:9px}
.obtn.obtn-icon svg{width:18px;height:18px;display:block}
.ticker-wrap{border-bottom:1px solid var(--border);background:rgba(163,230,53,.03);overflow:hidden;height:30px;display:flex;align-items:center}
.ticker{display:flex;gap:0;animation:tick 30s linear infinite;white-space:nowrap}
.ticker-item{font-family:var(--mono);font-size:10px;color:var(--muted2);padding:0 24px;border-right:1px solid var(--border);display:flex;align-items:center;gap:6px}
.ticker-item.hot{color:var(--lime)}
.ticker-item.alert{color:var(--orange)}
@keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.hero{max-width:1280px;margin:0 auto;padding:40px 32px 32px;display:grid;grid-template-columns:1fr 420px;gap:48px;align-items:start;position:relative;z-index:1}
.eyebrow-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.18);border-radius:100px;padding:4px 12px 4px 8px;font-size:11px;font-weight:600;color:var(--lime);margin-bottom:20px;font-family:var(--mono)}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--lime);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(163,230,53,.5)}50%{box-shadow:0 0 0 5px rgba(163,230,53,0)}}
h1{font-size:clamp(40px,5.5vw,80px);font-weight:900;line-height:.92;letter-spacing:-.04em;color:#fff;margin-bottom:20px}
.ar h1{letter-spacing:0;line-height:1.1}
h1 em{color:var(--lime);font-style:normal;display:block}
.hero-sub{font-size:16px;line-height:1.8;color:var(--muted2);max-width:460px;margin-bottom:28px}
.hero-btns{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:32px}
.hero-btns .gbtn{padding:11px 22px;font-size:14px;border-radius:10px}
.hero-btns .obtn{padding:11px 18px;font-size:14px;border-radius:10px}
.stats-row{display:flex;gap:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02)}
.stat-block{flex:1;padding:14px 18px;border-right:1px solid var(--border);position:relative}
.stat-block:last-child{border-right:none}
.stat-label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:6px}
.stat-val{font-size:22px;font-weight:800;color:#fff;font-family:'DM Sans',sans-serif;line-height:1}
.stat-val span{font-size:12px;font-weight:500;color:var(--lime);margin-left:4px}
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
.section{max-width:1280px;margin:0 auto;padding:0 32px 56px;position:relative;z-index:1}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;gap:12px;flex-wrap:wrap}
.section-eyebrow{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:6px}
.section-title{font-size:clamp(20px,2.5vw,30px);font-weight:800;color:#fff;letter-spacing:-.02em}
.ar .section-title{letter-spacing:0}
.sort-tabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:9px;padding:3px}
.sort-tab{background:none;border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;color:var(--muted2);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.sort-tab.on{background:rgba(255,255,255,.08);color:#fff}
.add-form{background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:24px;max-width:560px;margin:0 auto 56px}
.form-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
.form-sub{font-size:12px;color:var(--muted2);margin-bottom:18px}
.form-label{display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
.form-input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;margin-bottom:12px;transition:border-color .2s}
.form-input::placeholder{color:var(--muted)}
.form-input:focus{border-color:rgba(163,230,53,.35);background:rgba(163,230,53,.03)}
.form-note{text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:10px}
.events-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.ecard{border-radius:18px;border:1px solid var(--border);background:var(--bg2);overflow:hidden;transition:all .25s;position:relative;cursor:pointer}
.ecard:hover{border-color:rgba(255,255,255,.14);transform:translateY(-3px);box-shadow:0 20px 40px rgba(0,0,0,.4)}
.ecard.hot-card{border-color:rgba(239,68,68,.2)}
.ecard.hot-card:hover{border-color:rgba(239,68,68,.35)}
.ecard.warm-card{border-color:rgba(249,115,22,.15)}
.ecard.warm-card:hover{border-color:rgba(249,115,22,.3)}
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
.card-body{padding:16px}
.card-demand-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px}
.card-demand-tag{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap}
.cdt-very_high{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171}
.cdt-high{background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);color:#fb923c}
.cdt-medium{background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.2);color:#fbbf24}
.cdt-low{background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--muted2)}
.card-watchers{font-family:var(--mono);font-size:10px;color:var(--muted2);display:flex;align-items:center;gap:4px}
.card-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.3}
.card-url{font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-meta-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.card-meta-item{font-size:11px;color:var(--muted2);display:flex;align-items:center;gap:4px}
.card-score-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.score-track{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
.score-fill{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.4,0,.2,1)}
.score-val{font-family:var(--mono);font-size:11px;font-weight:600;color:#fff;min-width:28px;text-align:right}
.card-check-row{display:flex;align-items:center;justify-content:space-between;background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.12);border-radius:9px;padding:8px 12px;margin-bottom:12px}
.check-label{font-size:11px;color:#fb923c;display:flex;align-items:center;gap:5px;font-weight:600}
.check-dot{width:5px;height:5px;border-radius:50%;background:#fb923c;animation:pulse-o 1.5s infinite}
@keyframes pulse-o{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.5)}50%{box-shadow:0 0 0 4px rgba(249,115,22,0)}}
.check-timer{font-family:var(--mono);font-size:13px;font-weight:700;color:#fff}
.card-sub-row{display:flex;gap:6px;align-items:stretch}
.card-email{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:8px 11px;font-size:12px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;transition:border-color .2s}
.card-email::placeholder{color:var(--muted)}
.card-email:focus{border-color:rgba(163,230,53,.3)}
.card-alert-btn{background:var(--lime-dim);border:1px solid rgba(163,230,53,.2);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;color:var(--lime);cursor:pointer;transition:all .2s;white-space:nowrap;font-family:inherit}
.card-alert-btn:hover{background:rgba(163,230,53,.2)}
.card-share-btn{background:rgba(255,255,255,.06);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;transition:all .2s;font-family:inherit;line-height:1}
.card-share-btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2)}
.card-fomo{font-size:11px;font-weight:700;color:#fb923c;margin-bottom:8px;display:flex;align-items:center;gap:4px}
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.step-card{border-radius:16px;border:1px solid var(--border);background:rgba(255,255,255,.02);padding:22px;position:relative;overflow:hidden}
.step-card::before{content:attr(data-num);position:absolute;right:16px;top:12px;font-family:var(--mono);font-size:48px;font-weight:900;color:rgba(255,255,255,.03);line-height:1}
.step-icon{color:var(--lime);width:24px;height:24px;margin-bottom:14px}
.step-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:6px}
.step-desc{font-size:12px;line-height:1.75;color:var(--muted2)}
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
.empty-state{text-align:center;padding:64px 32px;color:var(--muted2)}
.empty-icon{font-size:40px;margin-bottom:14px;opacity:.4}
.empty-title{font-size:16px;font-weight:600;color:#fff;margin-bottom:6px}
.empty-sub{font-size:13px;line-height:1.7}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:18px;height:280px;border:1px solid var(--border)}
/* Quick-hero — utility market-access input, not a landing hero.
   docs/design.md §9: ≤80px on iPhone SE. Label hidden by default,
   demo link hidden on mobile. */
.quick-hero{background:transparent;border-bottom:1px solid var(--border);padding:10px 32px}
.qh-inner{max-width:680px;margin:0 auto}
.qh-label{display:none}
.qh-row{display:flex;gap:8px}
.qh-input{flex:1;min-width:0;background:rgba(255,255,255,.04);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;font-size:14px;font-family:'IBM Plex Sans Arabic',sans-serif;color:#fff;outline:none}
.qh-input::placeholder{color:var(--muted)}
.qh-input:focus{border-color:rgba(163,230,53,.35);background:rgba(163,230,53,.03)}
.qh-btn{background:var(--lime);border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;color:#000;cursor:pointer;white-space:nowrap;font-family:inherit}
.qh-btn:hover{background:var(--lime2)}
.qh-or{font-size:11px;color:var(--muted2);margin-top:6px;text-align:center}
.qh-demo{background:none;border:none;color:var(--muted3);font-size:11px;cursor:pointer;text-decoration:underline;font-family:inherit}
.qh-demo:hover{color:var(--lime)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px}
.modal-box{background:var(--bg2);border:1px solid rgba(163,230,53,.2);border-radius:20px;padding:28px;max-width:420px;width:100%;text-align:center;max-height:85vh;overflow-y:auto}
.modal-title{font-size:20px;font-weight:800;color:#fff;margin-bottom:8px}
.modal-sub{font-size:13px;color:var(--muted2);margin-bottom:18px;line-height:1.6}
.modal-input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:11px 14px;font-size:13px;color:#fff;outline:none;margin-bottom:12px;font-family:inherit}
.modal-input:focus{border-color:rgba(163,230,53,.4)}
.modal-skip{background:none;border:none;color:var(--muted2);font-size:12px;cursor:pointer;margin-top:8px;font-family:inherit;text-decoration:underline}
.modal-share-row{display:flex;flex-direction:column;gap:8px;margin:8px 0 0}
.modal-share-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
.modal-share-btn.whatsapp{background:#25d366;color:#000}
.modal-share-btn.twitter{background:#000;color:#fff;border:1px solid rgba(255,255,255,.15)}
.modal-share-btn.copy{background:rgba(255,255,255,.08);color:#fff}
.modal-alert-list{display:flex;flex-direction:column;gap:8px;margin:12px 0;max-height:320px;overflow-y:auto;text-align:left}
.ar .modal-alert-list{text-align:right}
.modal-alert-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--border);font-size:13px;color:#e4e4e7}
.modal-alert-item a{color:var(--lime);text-decoration:none;font-size:11px;white-space:nowrap}
.pricing-grid{display:grid;grid-template-columns:1fr 1.3fr;gap:18px;align-items:start;max-width:880px;margin:0 auto}
.why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:880px;margin:0 auto}
.why-stat{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:22px 20px;text-align:center;position:relative;overflow:hidden}
.why-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--lime),transparent);opacity:.6}
.why-stat-val{font-size:36px;font-weight:900;color:#fff;font-family:'DM Sans',sans-serif;line-height:1;margin-bottom:8px}
.why-stat-val em{color:var(--lime);font-style:normal}
.why-stat-label{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted2)}
.why-pulse{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10px;color:var(--lime);background:rgba(163,230,53,.06);border:1px solid rgba(163,230,53,.18);border-radius:100px;padding:4px 11px;margin-bottom:14px}
.why-pulse::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--lime);animation:pulse 1.8s infinite}
.pricing-card{background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:24px;position:relative}
.pricing-lifetime{border-color:rgba(163,230,53,.3);background:linear-gradient(135deg,rgba(163,230,53,.06),var(--bg2));padding:28px}
.pc-badge{display:inline-block;background:var(--lime);color:#000;font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;margin-bottom:12px;font-family:var(--mono);text-transform:uppercase}
.pc-name{font-size:12px;font-weight:700;color:var(--muted3);margin-bottom:8px;text-transform:uppercase;font-family:var(--mono);letter-spacing:.1em}
.ar .pc-name{letter-spacing:0;font-family:'IBM Plex Sans Arabic',sans-serif}
.pc-price{font-size:44px;font-weight:900;color:#fff;font-family:'DM Sans',sans-serif;line-height:1}
.pricing-lifetime .pc-price{color:var(--lime)}
.pc-period{font-size:11px;color:var(--muted2);margin:4px 0 8px}
.pc-sub{font-size:11px;color:var(--lime);margin-bottom:16px;font-weight:600;line-height:1.5}
.pc-features{margin:16px 0;display:flex;flex-direction:column;gap:8px}
.pc-f{font-size:12px;color:#d4d4d8;display:flex;align-items:center;gap:6px}
.pc-f::before{content:'✓';color:var(--lime);font-weight:800;font-size:10px;flex-shrink:0}
.pc-btn{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border2);border-radius:10px;padding:11px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;margin-top:8px;transition:all .2s;font-family:inherit}
.pc-btn:hover{background:rgba(255,255,255,.1)}
.pc-btn-lifetime{width:100%;background:var(--lime);border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:800;color:#000;cursor:pointer;margin-top:8px;transition:all .2s;font-family:inherit}
.pc-btn-lifetime:hover{background:var(--lime2);transform:translateY(-1px)}
@media(max-width:800px){.pricing-grid{grid-template-columns:1fr}.why-grid{grid-template-columns:1fr}}
footer{border-top:1px solid var(--border);padding:20px 32px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.05em;position:relative;z-index:1}
.ar footer{font-family:'IBM Plex Sans Arabic',sans-serif;letter-spacing:0}
@media(max-width:960px){.hero{grid-template-columns:1fr;padding:40px 24px 32px;gap:32px}.market-panel{position:static}.steps-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){
  /* Layout */
  .hero{padding:32px 16px 24px}
  .section{padding:0 16px 40px}
  nav{padding:0 16px;height:60px}
  .events-grid{grid-template-columns:1fr}
  .steps-grid{grid-template-columns:1fr}
  .quick-hero{padding:8px 14px}
  .qh-row{flex-direction:row;gap:6px}
  /* Hide "or try demo" on mobile — quick-hero is utility, not landing. */
  #qh-or-wrap{display:none}
  /* Bump tiny tap targets on mobile (lang toggle was 20x30px — below 44 min). */
  .lb{padding:8px 13px;font-size:12.5px}
  .ltog{padding:3px}
  .stats-row{flex-wrap:wrap}
  .stat-block{min-width:50%;padding:16px 18px}
  .nav-r .obtn{display:none}
  /* Typography +30% bump for thumb readability */
  .qh-input{padding:10px 12px;font-size:16px}
  .qh-btn{padding:10px 14px;font-size:13px;font-weight:700}
  .hero-sub{font-size:17px;line-height:1.75}
  .hero-btns{gap:12px;flex-direction:column}
  .hero-btns .gbtn,.hero-btns .obtn{padding:15px 24px;font-size:15px;border-radius:12px;width:100%}
  .stat-label{font-size:10px}
  .stat-val{font-size:24px}
  .mp-title{font-size:14px}
  .mp-sub{font-size:12px}
  .feed-item{font-size:13px;padding:11px 14px;line-height:1.6}
  .mp-hot-title{font-size:18px}
  .mp-hot-meta{font-size:12px}
  .section-title{font-size:24px;letter-spacing:-.02em}
  .section-eyebrow{font-size:11px}
  .form-title{font-size:17px}
  .form-sub{font-size:14px;line-height:1.6}
  .form-input{padding:13px 16px;font-size:16px}
  .form-label{font-size:10px}
  /* Cards */
  .card-title{font-size:17px;line-height:1.3}
  .card-url{font-size:11px}
  .card-demand-tag{font-size:12px;padding:4px 11px}
  .card-watchers{font-size:11px}
  .card-fomo{font-size:12.5px;margin-bottom:10px}
  .card-status-badge{font-size:11px;padding:4px 11px}
  .card-alert-btn{padding:11px 16px;font-size:13px}
  .card-share-btn{padding:11px 13px;font-size:16px;min-width:44px}
  .card-email{padding:11px 14px;font-size:15px}
  .card-img{height:160px}
  .card-body{padding:18px}
  /* Steps */
  .step-card{padding:24px}
  .step-title{font-size:17px}
  .step-desc{font-size:13.5px;line-height:1.8}
  /* Pricing */
  .pc-name{font-size:13px}
  .pc-price{font-size:48px}
  .pc-period{font-size:13px}
  .pc-sub{font-size:13px;line-height:1.6}
  .pc-f{font-size:14px;line-height:1.5}
  .pc-btn,.pc-btn-lifetime{padding:14px;font-size:15px;border-radius:12px}
  .pricing-card{padding:24px}
  .pricing-lifetime{padding:28px}
  /* Modals */
  .modal-title{font-size:22px}
  .modal-sub{font-size:14px;line-height:1.65}
  .modal-input{padding:13px 16px;font-size:16px}
}

/* ─── TAB SYSTEM (uniform — same on mobile + desktop) ─────────────── */
[data-tab]:not(.active-tab){display:none !important}
@media(max-width:960px){
  /* Top nav owns only branding + lang on mobile — bnav owns navigation */
  .nav-r .gbtn,.nav-r .obtn{display:none}
}

/* ─── BOTTOM NAV — terminal-minimal, mobile only ────────────────────── */
/* See docs/design.md §5: 54-58px height · outline SVG icons · subtle 2px
   lime underline ABOVE icon on active · no fill background · no glow. */
.bnav{position:fixed !important;bottom:0 !important;left:0 !important;right:0 !important;top:auto !important;height:60px;background:rgba(8,10,14,.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--border);display:none;align-items:stretch;justify-content:space-around;z-index:9999;padding:0;padding-bottom:env(safe-area-inset-bottom,0);font-family:'IBM Plex Sans Arabic',sans-serif}
.bnav-item{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--muted2);cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;background:none;border:none;padding:9px 4px 7px;transition:color .12s ease;line-height:1}
/* Active indicator: 2px subtle lime underline directly above the icon. */
.bnav-item::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:0;height:2px;background:var(--lime);transition:width .15s ease;border-radius:0 0 2px 2px}
/* Active state: lime + bumped weight + subtle text shadow for the SeatX CTA
   feel. NO purple, NO heavy fill, NO glow. Inactive stays muted gray. */
.bnav-item.active{color:var(--lime);font-weight:800}
.bnav-item.active .bnav-label{font-weight:800}
.bnav-item.active::before{width:32px}
/* Icon + label MUST not capture touch events themselves — Safari/iOS sometimes
   refuse to bubble click from inline SVG up to the parent button. pointer-events
   none on children = clicks always register on the button. */
.bnav-icon{width:20px;height:20px;display:block;flex-shrink:0;color:currentColor;pointer-events:none}
.bnav-label{font-size:12px;line-height:1;white-space:nowrap;letter-spacing:0;pointer-events:none}
.bnav-item *{pointer-events:none}
.bnav-item{cursor:pointer}
@media(max-width:960px){.bnav{display:flex}body{padding-bottom:76px}}
@media(min-width:961px){.bnav{display:none !important}body{padding-bottom:0}}

/* ─── DESKTOP TOP-NAV TABS (≥961px only) ─────────────────────────── */
.nav-tabs{display:none;gap:3px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:3px;font-family:'IBM Plex Sans Arabic',sans-serif}
.ntab{background:none;border:none;border-radius:7px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;color:var(--muted2);font-family:inherit;transition:all .15s;white-space:nowrap}
.ntab:hover{color:#fff}
.ntab.active{background:rgba(163,230,53,.12);color:var(--lime)}
@media(min-width:961px){.nav-tabs{display:flex}}

/* ─── TCARD (compact trending card, Bloomberg-style) ─────────────── */
.tcards-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;max-width:880px;margin-left:auto;margin-right:auto;padding:0 4px}
.tcards-h-title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;color:#fff}
.tcards-h-title::before{content:'🔥';font-size:18px}
.tcards-h-sub{font-size:11px;color:var(--lime);font-family:var(--mono);text-decoration:none;border:1px solid rgba(163,230,53,.2);border-radius:100px;padding:4px 11px;background:rgba(163,230,53,.06)}
.tcards-list{display:flex;flex-direction:column;gap:12px;max-width:880px;margin:0 auto}
.tcard{display:flex;align-items:stretch;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:14px;transition:all .2s;cursor:pointer;position:relative;overflow:hidden}
.tcard:hover,.tcard:active{border-color:rgba(163,230,53,.25);transform:translateY(-1px)}
.tcard.tcard-hot{border-color:rgba(239,68,68,.22)}
.tcard.tcard-warm{border-color:rgba(249,115,22,.18)}
.tcard-thumb{flex-shrink:0;width:62px;height:62px;border-radius:12px;background:linear-gradient(135deg,#1a1f2e,#0d1117);display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--border)}
.tcard-thumb img{width:100%;height:100%;object-fit:cover}
.tcard-thumb-fallback{font-size:26px;opacity:.4}
.tcard-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}
.tcard-title{font-size:15.5px;font-weight:800;color:#fff;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tcard-cat{font-size:11.5px;color:var(--muted2);font-weight:500}
.tcard-heat{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:100px;width:fit-content;margin-top:2px;white-space:nowrap}
.tcard-heat.heat-very_high{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.25)}
.tcard-heat.heat-high{background:rgba(249,115,22,.12);color:#fb923c;border:1px solid rgba(249,115,22,.25)}
.tcard-heat.heat-medium{background:rgba(234,179,8,.1);color:#fbbf24;border:1px solid rgba(234,179,8,.2)}
.tcard-heat.heat-low{background:rgba(255,255,255,.04);color:var(--muted2);border:1px solid var(--border)}
.tcard-meta{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:6px;min-width:64px}
.tcard-spark{width:60px;height:24px;display:block;overflow:visible}
.tcard-watchers{font-family:var(--mono);font-size:10.5px;color:var(--muted2);font-weight:600;white-space:nowrap;direction:ltr;text-align:left}
.tcard-watchers em{color:#fff;font-style:normal;font-weight:800;font-size:13px}
@media(max-width:600px){
  .tcard{padding:12px;gap:12px}
  .tcard-thumb{width:56px;height:56px;border-radius:10px}
  .tcard-title{font-size:15.5px}
  .tcard-heat{font-size:11px}
  .tcard-spark{width:54px;height:22px}
}

/* ─── ACCOUNT TAB ─────────────────────────────────────────────────── */
.acc-block{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:22px;margin:0 auto 14px;max-width:520px}
.acc-h{font-size:14px;font-weight:700;color:#fff;margin-bottom:6px}
.acc-sub{font-size:12.5px;color:var(--muted2);line-height:1.65;margin-bottom:14px}
.acc-btn{width:100%;background:rgba(255,255,255,.05);border:1px solid var(--border2);border-radius:11px;padding:13px;font-size:14px;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s}
.acc-btn:hover{background:rgba(255,255,255,.1)}
.acc-row{display:flex;gap:10px;align-items:stretch}
.acc-row .modal-input{margin-bottom:0;flex:1}
.acc-ltog{display:flex;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:3px;gap:3px;width:fit-content;margin:0 auto}
.acc-ltog button{background:none;border:none;border-radius:7px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;color:var(--muted2);font-family:inherit;transition:all .15s}
.acc-ltog button.on{background:var(--lime);color:#000}

/* ─── WATCHING TAB rows (separate from afeed) ─────────────────────── */
.watch-row{display:flex;align-items:center;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;transition:opacity .15s ease}
.watch-row + .watch-row{margin-top:8px}
.watch-row-main{flex:1;min-width:0}
.watch-row-title{font-size:14px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.watch-row-meta{font-size:11.5px;color:var(--muted2);font-weight:500}
.watch-row-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
.watch-act{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid var(--border);cursor:pointer;color:var(--muted3);text-decoration:none;font-family:inherit;transition:all .12s ease;padding:0}
.watch-act svg{width:16px;height:16px;display:block}
.watch-act:hover{background:rgba(255,255,255,.08);color:#fff;border-color:var(--border2)}
.watch-act-stop:hover{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#f87171}

/* ─── QUEUE MODE — segmented source picker (replaces native select) ── */
.qm-seg{display:flex;gap:6px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:14px}
.qm-seg-btn{flex:1;min-height:44px;background:none;border:1px solid transparent;color:var(--muted3);font-size:13.5px;font-weight:700;cursor:pointer;border-radius:8px;font-family:inherit;transition:all .12s ease;padding:8px 6px;line-height:1}
.qm-seg-btn:hover{color:#fff}
.qm-seg-btn.on{background:rgba(163,230,53,.12);color:var(--lime);border-color:rgba(163,230,53,.25)}
@media(max-width:600px){.qm-seg-btn{font-size:13px}}

/* ─── QUEUE MODE — post-submit result card ──────────────────────────── */
.qm-result-card{background:var(--bg2);border:1px solid rgba(163,230,53,.22);border-radius:14px;padding:18px;margin-top:14px}
.qm-result-title{font-size:16px;font-weight:800;color:var(--lime);margin-bottom:6px;display:flex;align-items:center;gap:8px}
.qm-result-title::before{content:'✓';font-size:16px;font-weight:900;width:22px;height:22px;border-radius:50%;background:rgba(163,230,53,.15);display:inline-flex;align-items:center;justify-content:center;line-height:1}
.qm-result-body{font-size:13.5px;color:#d4d4d8;line-height:1.7;margin-bottom:14px}
.qm-result-summary{display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;margin-bottom:14px}
.qm-result-summary-row{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12.5px;line-height:1.4}
.qm-result-summary-row span{color:var(--muted2);font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
.qm-result-summary-row strong{color:#fff;font-weight:700;text-align:left;direction:ltr;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar .qm-result-summary-row strong{text-align:right;direction:rtl}
.qm-result-watch-title{font-size:12px;font-weight:700;color:var(--muted3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-family:var(--mono)}
.ar .qm-result-watch-title{letter-spacing:0;font-family:'IBM Plex Sans Arabic',sans-serif}
.qm-result-watch-list{list-style:none;padding:0;margin:0 0 14px;font-size:13px;color:#d4d4d8;line-height:1.85}
.qm-result-disclaimer{font-size:11.5px;color:var(--muted);line-height:1.6;padding-top:12px;border-top:1px solid var(--border)}
.qm-result-again{display:block;background:none;border:none;color:var(--lime);font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;margin:12px auto 0;text-decoration:underline}
.qm-result-again:hover{color:var(--lime2)}

/* ─── ALERTS FEED ─────────────────────────────────────────────────── */
.afeed-list{display:flex;flex-direction:column;gap:8px;max-width:640px;margin:0 auto}
.afeed-item{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;gap:11px;align-items:flex-start;font-size:13.5px;line-height:1.55;color:#e4e4e7}
.afeed-item.afeed-hot{border-color:rgba(163,230,53,.2);background:rgba(163,230,53,.03)}
.afeed-item.afeed-alert{border-color:rgba(249,115,22,.2);background:rgba(249,115,22,.03)}
.afeed-time{font-family:var(--mono);font-size:10px;color:var(--muted);flex-shrink:0;direction:ltr;margin-top:2px;white-space:nowrap}
.afeed-msg{flex:1;min-width:0}
.afeed-empty{text-align:center;padding:48px 24px;color:var(--muted2);font-size:14px;line-height:1.7;max-width:420px;margin:0 auto}

/* ─── MARKET PULSE (Why-now upgrade — "monitoring" copy when 0) ──── */
.market-monitor{display:inline-flex;align-items:center;gap:7px;color:var(--lime);font-size:13px;font-weight:700;font-family:'IBM Plex Sans Arabic',sans-serif}
.market-monitor::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--lime);animation:pulse 1.6s infinite;flex-shrink:0}
</style>
</head>
<body class="ar">
<div class="toast-container" id="tc"></div>

<nav>
  <a class="logo" href="/">
    <div class="lbox">X</div>
    <div><div class="lname">SEAT<em>X</em></div></div>
  </a>
  <!-- Desktop-only horizontal tab nav (≥961px). Mobile uses the .bnav at bottom. -->
  <div class="nav-tabs" id="ntabs">
    <button class="ntab active" data-target="home" onclick="switchTab('home')" id="ntab-home">الرئيسية</button>
    <button class="ntab" data-target="trending" onclick="switchTab('trending')" id="ntab-trending">الأكثر تداولًا</button>
    <button class="ntab" data-target="watching" onclick="switchTab('watching')" id="ntab-watching">مراقباتي</button>
    <button class="ntab" data-target="alerts" onclick="switchTab('alerts')" id="ntab-alerts">التنبيهات</button>
  </div>
  <div class="nav-r">
    <div class="ltog">
      <button class="lb" onclick="setLang('en')">EN</button>
      <button class="lb on" onclick="setLang('ar')">AR</button>
    </div>
    <button class="obtn obtn-icon" id="n-si" onclick="switchTab('account')" aria-label="حسابي" title="حسابي">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
      </svg>
    </button>
  </div>
</nav>

<div class="quick-hero active-tab" data-tab="home">
  <div class="qh-inner">
    <div class="qh-label" id="qhl">🔔 ألصق رابط الحدث — ننبّهك إذا رجعت المقاعد</div>
    <div class="qh-row">
      <input class="qh-input" id="qh-url" type="url" placeholder="ألصق رابط الحدث هنا" autocomplete="off"/>
      <button class="qh-btn" id="qh-btn" onclick="quickAdd()">نبّهني إذا رجعت ←</button>
    </div>
    <div class="qh-or" id="qh-or-wrap"><span id="qh-or">أو </span><button class="qh-demo" id="qh-demo" onclick="tryDemo()">جرّب بفعالية تجريبية</button></div>
  </div>
</div>

<div class="ticker-wrap active-tab" data-tab="home">
  <div class="ticker" id="ticker">
    ${[...Array(2)].map(() => (feed.slice(0, 8).map((f: any) =>
      `<div class="ticker-item ${f.type === 'alert_sent' ? 'alert' : f.type === 'status_change' ? 'hot' : ''}">${escapeHtml(f.message || '')}</div>`
    ).join(''))).join('')}
    <div class="ticker-item hot">⚡ السوق المباشر للمقاعد</div>
    <div class="ticker-item">🇸🇦 السعودية أولًا</div>
    <div class="ticker-item alert">🔥 ${events.length} فعالية يتابعها السوق</div>
    <div class="ticker-item hot">⚡ تنبيهات لحظية للمقاعد</div>
    <div class="ticker-item">🎟 موسم الرياض · UFC · الدوري السعودي</div>
    <div class="ticker-item alert">🔥 ${events.length} فعالية مباشرة الآن</div>
  </div>
</div>

<section class="hero active-tab" data-tab="home">
  <div class="hero-left">
    <div class="eyebrow-pill"><div class="pulse-dot"></div><span id="ep">Saudi seat market · Live</span></div>
    <h1><span id="hm">لا تفوّت التذكرة</span><em id="ha">إذا رجعت.</em></h1>
    <p class="hero-sub" id="hs">SeatX يتابع الحدث وينبهك إذا ظهرت فرصة: مقاعد رجعت، ضغط ارتفع، أو حركة جديدة على نفس الحدث.</p>
    <div class="hero-btns">
      <button class="gbtn" id="hb1" onclick="scrollTo('add')">ابدأ المتابعة</button>
      <button class="obtn" id="hb2" onclick="scrollTo('queue-mode')">أنا داخل كيو</button>
    </div>
    <div class="stats-row">
      <div class="stat-block">
        <div class="stat-label" id="sl1">Watching now</div>
        <div class="stat-val" id="sv1">${events.reduce((a: number, e: any) => a + (e.watchers_count || 0), 0)}<span>live</span></div>
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
        <div class="mp-title" id="mpt">فرص الحدث</div>
        <div class="mp-sub" id="mps">آخر حركة قبل ثوانٍ</div>
      </div>
      <div class="live-badge"><div class="live-dot"></div>LIVE</div>
    </div>
    <div class="demand-bar-wrap">
      <div class="demand-bar-label"><span id="dbl">Market demand</span><span id="dbv">${events.length > 0 ? Math.round(events.reduce((a: number, e: any) => a + (e.demand_score || 0), 0) / events.length) : 0}/100</span></div>
      <div class="demand-bar-track"><div class="demand-bar-fill" id="dbf" style="width:${events.length > 0 ? Math.round(events.reduce((a: number, e: any) => a + (e.demand_score || 0), 0) / events.length) : 0}%;background:${events.length > 0 && events.reduce((a: number, e: any) => a + (e.demand_score || 0), 0) / events.length > 60 ? '#ef4444' : '#a3e635'}"></div></div>
    </div>
    <div class="mp-feed" id="mpfeed">
      ${feed.slice(0, 4).map((f: any) => `<div class="feed-item ${f.type === 'alert_sent' ? 'alert' : f.type === 'status_change' ? 'hot' : ''}">${escapeHtml(f.message || '')}</div>`).join('') || '<div class="feed-item">Monitoring started...</div>'}
    </div>
    ${events[0] ? `
    <div class="mp-hot">
      <div class="mp-hot-label" id="mhl">🔥 Hottest right now</div>
      <div class="mp-hot-title">${escapeHtml(events[0].title)}</div>
      <div class="mp-hot-meta">
        <span>${events[0].watchers_count || 0} watching</span>
        <span style="color:${getDemandColor(events[0].demand_band || 'low')};font-weight:700">${getDemandLabel(events[0].demand_band || 'low', 'en')}</span>
      </div>
    </div>` : ''}
  </div>
</section>

<div class="section active-tab" id="add" data-tab="home">
  <div class="add-form">
    <div class="form-title" id="ft1">عندي رابط الحدث</div>
    <div class="form-sub" id="ft2">ألصق رابط ويبوك أو تيكت ماستر، وSeatX ينبّهك إذا رجعت المقاعد.</div>
    <label class="form-label" id="fl1">اسم الحدث</label>
    <input class="form-input" type="text" id="ev-t" placeholder="مثال: الهلال × النصر" maxlength="200"/>
    <label class="form-label" id="fl2">رابط التذاكر</label>
    <input class="form-input" type="url" id="ev-u" placeholder="ألصق رابط الحدث" maxlength="2000"/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="addEvent()" id="afb">🔔 نبّهني إذا رجعت المقاعد</button>
    <div class="form-note" id="fn">مجاني · بدون حساب · تنبيهات لحظية</div>
  </div>
</div>

<!-- ════ ENTRY MODE 2 — no link, just the event name ════════════════════
     User tells us the event; we find/monitor tickets and alert them. We do
     NOT say "we search for a link" — the outcome framing is: tell us the
     event, we bring the alert. -->
<div class="section active-tab" id="request-event" data-tab="home">
  <div class="add-form" style="max-width:560px">
    <div class="form-title" id="rq-title">ما عندك رابط؟ قل لنا الحدث</div>
    <div class="form-sub" id="rq-sub">اكتب اسم الحدث اللي تبيه، وSeatX يوصّلك تنبيه لما تتوفر تذاكره — بدون ما تدوّر بنفسك.</div>
    <label class="form-label" id="rq-l-name">اسم الحدث</label>
    <input class="form-input" type="text" id="rq-event" placeholder="مثال: الهلال × النصر، حفلة محمد عبده، موسم الرياض" maxlength="200"/>
    <label class="form-label" id="rq-l-city">المدينة <span style="color:var(--muted);font-weight:400" id="rq-optional">(اختياري)</span></label>
    <input class="form-input" type="text" id="rq-city" placeholder="الرياض، جدة، ..." maxlength="60"/>
    <label class="form-label" id="rq-l-email">بريدك للتنبيه</label>
    <input class="form-input" type="email" id="rq-email" placeholder="your@email.com" autocomplete="email"/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="requestEvent()" id="rq-btn">🔔 نبّهني لما تتوفر التذاكر</button>
    <div id="rq-confirm" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;background:rgba(163,230,53,.06);border:1px solid rgba(163,230,53,.2);font-size:13px;color:#e4e4e7;line-height:1.7"></div>
    <div class="form-note" id="rq-note">مجاني · بدون حساب · ننبّهك أول ما نلقى تذاكره</div>
  </div>
</div>

<!-- ════ QUEUE MODE — for users stuck in someone else's waiting room ═══
     IMPORTANT: copy makes no promise of jumping the queue, buying for
     them, or guaranteeing tickets. We only watch for a SECOND opportunity
     on the same event (different link, new drop, different package). -->
<div class="section active-tab" id="queue-mode" data-tab="home">
  <div class="add-form" style="max-width:560px">
    <div class="form-title" id="qm-title">داخل كيو ورقمك بعيد؟</div>
    <div class="form-sub" id="qm-sub">SeatX ما يقدر يقدّمك في الطابور. لكن نقدر نبحث لك عن فرصة ثانية لنفس الحدث: رابط رسمي آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر.</div>

    <ul style="list-style:none;padding:0;margin:6px 0 16px;font-size:12.5px;color:var(--muted3);line-height:1.85" id="qm-bullets">
      <li>· ما نتجاوز الطابور</li>
      <li>· نبحث عن فرص ثانية لنفس الحدث</li>
      <li>· ننبّهك إذا ظهر مسار رسمي مختلف</li>
      <li>· نساعدك تعرف هل الانتظار يستاهل</li>
    </ul>

    <label class="form-label" id="qm-l-name">اسم الحدث</label>
    <input class="form-input" type="text" id="qm-event" placeholder="مثال: حفلة محمد عبده، UFC Riyadh" maxlength="200"/>

    <label class="form-label" id="qm-l-source">المصدر اللي أنت منتظر فيه</label>
    <!-- Native <select> renders white-and-blue on dark in Chrome/Safari; not
         themeable. Replaced with segmented buttons that live inside the dark
         identity. Hidden input below carries the chosen value to the form. -->
    <div class="qm-seg" role="radiogroup" aria-labelledby="qm-l-source">
      <button type="button" class="qm-seg-btn" data-value="webook" onclick="qmSetSource('webook',this)">Webook</button>
      <button type="button" class="qm-seg-btn" data-value="ticketmaster" onclick="qmSetSource('ticketmaster',this)">Ticketmaster</button>
      <button type="button" class="qm-seg-btn" data-value="other" onclick="qmSetSource('other',this)" id="qm-seg-other">غير ذلك</button>
    </div>
    <input type="hidden" id="qm-source" value=""/>

    <label class="form-label" id="qm-l-pos">رقمك في الانتظار <span style="color:var(--muted);font-weight:400">(اختياري)</span></label>
    <input class="form-input" type="text" id="qm-pos" placeholder="مثال: 24,500" maxlength="40"/>

    <label class="form-label" id="qm-l-url">رابط الكيو <span style="color:var(--muted);font-weight:400">(اختياري)</span></label>
    <input class="form-input" type="url" id="qm-url" placeholder="ألصق رابط الانتظار" maxlength="2000"/>

    <label class="form-label" id="qm-l-email">بريدك للتنبيه</label>
    <input class="form-input" type="email" id="qm-email" placeholder="your@email.com" autocomplete="email"/>

    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="queueModeSubmit()" id="qm-btn">ابحث عن فرصة ثانية</button>

    <div id="qm-confirm" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;background:rgba(163,230,53,.06);border:1px solid rgba(163,230,53,.2);font-size:13px;color:#e4e4e7;line-height:1.7" data-default-ar="تمام. خلّك في الكيو إذا تبغى، وSeatX بيراقب أي فرصة ثانية حول نفس الحدث. إذا ظهر رابط آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر، بننبّهك." data-default-en="Done. Stay in the queue if you want — SeatX is now watching for a second opportunity on the same event. If another link, a new drop, a different package, or a meaningful availability change appears, we'll notify you."></div>

    <div class="form-note" id="qm-disclaimer" style="margin-top:10px;color:var(--muted)">SeatX لا يتجاوز الكيو، لا يشتري بدالك، ولا يضمن التذاكر.</div>
  </div>
</div>

<!-- ════ TRENDING TAB — Bloomberg-style compact cards ═══════════════ -->
<div class="section" id="trending" data-tab="trending">
  <div class="tcards-head">
    <div class="tcards-h-title" id="trnd-t">فعاليات ممكن ترجع فيها فرص</div>
    <a class="tcards-h-sub" href="#" onclick="event.preventDefault();switchTab('watching')" id="trnd-link">مراقباتي ←</a>
  </div>
  <div class="tcards-list" id="tcards-list">
    ${events.length === 0 ? `
    <div class="afeed-empty" id="trnd-empty">
      <div style="font-size:38px;opacity:.35;margin-bottom:12px">🔔</div>
      <div id="trnd-empty-title" style="color:#fff;font-weight:700;font-size:15px;margin-bottom:6px">ما فيه فرص مرصودة الآن</div>
      <div id="trnd-empty-body" style="font-size:13px;margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">أضف أول حدث تبي تتابعه، وإذا رجعت مقاعد أو ظهرت فرصة رسمية بننبّهك.</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:280px;margin:0 auto">
        <button class="gbtn" style="padding:12px 16px;font-size:14px;border-radius:10px;width:100%" onclick="goHomeAndAddEvent()" id="trnd-empty-cta">أضف حدث للمتابعة</button>
        <button class="obtn" style="padding:11px 16px;font-size:13.5px;border-radius:10px;width:100%" onclick="goHomeAndQueueMode()" id="trnd-empty-cta2">أنا داخل كيو</button>
      </div>
    </div>` : events.map((e: any) => renderTrendingCard(e)).join('')}
  </div>
</div>

<div class="section active-tab" id="why-now" data-tab="home">
  <div style="text-align:center;margin-bottom:26px">
    <div class="why-pulse" id="why-pulse-label">السوق المباشر</div>
    <div class="section-title" id="why-title">السوق يتحرك الآن</div>
    <p style="font-size:14.5px;color:var(--muted2);max-width:520px;margin:12px auto 0;line-height:1.75" id="why-sub">كل ثانية، فعالية تتغيّر. الأسرع يمسك. المتأخر يفوّته.</p>
  </div>
  <div class="why-grid">
    <div class="why-stat">
      <div class="why-stat-val"><em>${events.length}</em></div>
      <div class="why-stat-label" id="why-l1">فعالية في السوق</div>
    </div>
    <div class="why-stat">
      <div class="why-stat-val">${events.reduce((a: number, e: any) => a + (e.watchers_count || 0), 0)}</div>
      <div class="why-stat-label" id="why-l2">متابع نشط</div>
    </div>
    <div class="why-stat">
      ${alerts24h > 0
        ? `<div class="why-stat-val"><em>${alerts24h}</em></div>
           <div class="why-stat-label" id="why-l3">تحرّك في آخر ٢٤ ساعة</div>`
        : `<div class="why-stat-val" style="font-size:16px;line-height:1.4"><span class="market-monitor" id="why-monitor">السوق قيد المراقبة</span></div>
           <div class="why-stat-label" id="why-l3">نراقب لحظياً — أي تحرّك يصلك</div>`
      }
    </div>
  </div>
</div>

${fanxOn ? `
<!-- ════ FanX secondary entry (home tab) — additive, links to /fanx ═══════ -->
<div class="section active-tab" data-tab="home">
  <a href="/fanx" style="display:block;text-decoration:none;background:linear-gradient(135deg,rgba(163,230,53,.08),rgba(163,230,53,.02));border:1px solid rgba(163,230,53,.22);border-radius:16px;padding:20px 18px;max-width:560px;margin:0 auto">
    <div style="font-family:var(--mono);font-size:10px;color:var(--lime);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px">🎫 FanX · رادار يوم الفعالية</div>
    <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:6px">رايح فعالية كبيرة؟</div>
    <div style="font-size:14px;color:var(--muted2);line-height:1.7;margin-bottom:14px">جرّب FanX — رادار يوم الفعالية للزحمة، التنبيهات، التنقل، والبدائل.</div>
    <span style="display:inline-flex;align-items:center;gap:6px;color:var(--lime);font-weight:700;font-size:14px">شوف FanX ←</span>
  </a>
</div>` : ''}

<!-- ════ ACCOUNT TAB — settings only (no email lookup; see Watching tab) ═══════ -->
<div class="section" data-tab="account">
  <div style="text-align:center;margin-bottom:22px">
    <div class="section-title" id="acc-title">حسابي</div>
    <p style="font-size:13px;color:var(--muted2);margin-top:6px" id="acc-subtitle">إعداداتك في السوق</p>
  </div>

  <!-- Plan status (read-only for MVP) -->
  <div class="acc-block">
    <div class="acc-h" id="acc-plan-h">خطتك الحالية</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px">
      <div>
        <div id="acc-plan-name" style="font-size:18px;font-weight:800;color:#fff;line-height:1.2">مجاني</div>
        <div id="acc-plan-limit" style="font-size:11.5px;color:var(--muted2);margin-top:4px;font-family:var(--mono)">فعالية واحدة نشطة كحد أقصى</div>
      </div>
      <button class="gbtn" style="padding:10px 16px;font-size:13px;border-radius:10px;white-space:nowrap" onclick="openUpgradeModal('pro')" id="acc-upgrade-btn">الترقية</button>
    </div>
  </div>

  <!-- Notification status (push permission + saved email indicator) -->
  <div class="acc-block">
    <div class="acc-h" id="acc-notif-h">التنبيهات</div>
    <div id="acc-notif-push" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#a1a1aa;margin-top:6px">
      <span class="market-monitor" id="acc-notif-push-dot" style="display:none"></span>
      <span id="acc-notif-push-text">جاري الفحص…</span>
    </div>
    <div id="acc-notif-email" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#a1a1aa;margin-top:8px">
      <span id="acc-notif-email-text">جاري الفحص…</span>
    </div>
    <div id="acc-notif-hint" style="font-size:11.5px;color:var(--muted);margin-top:10px;line-height:1.65" data-default-ar="فعّل التنبيهات من خلال الاشتراك بأول فعالية في تبويب «الرئيسية»." data-default-en="Enable alerts by subscribing to your first event on the Home tab.">فعّل التنبيهات من خلال الاشتراك بأول فعالية في تبويب «الرئيسية».</div>
  </div>

  <!-- Language toggle -->
  <div class="acc-block" style="text-align:center">
    <div class="acc-h" id="acc-lang-h" style="margin-bottom:14px">اللغة</div>
    <div class="acc-ltog">
      <button onclick="setLang('en')" id="acc-ltog-en">EN</button>
      <button onclick="setLang('ar')" id="acc-ltog-ar" class="on">العربية</button>
    </div>
  </div>

  <!-- Pricing -->
  <div style="margin:30px 0 24px;text-align:center">
    <div class="section-eyebrow" id="prc-eye" style="margin-bottom:10px">💎 الوصول للسوق</div>
    <div class="section-title" style="margin-bottom:10px" id="prc-h1">السرعة تحدّد من يمسك ومن يفوّته</div>
    <p style="font-size:14px;color:var(--muted2);line-height:1.75;max-width:520px;margin:0 auto" id="prc-sub">ما نبيع features أو حدود تقنية. نبيع <strong style='color:#fff'>الأولوية</strong> و<strong style='color:#fff'>السرعة</strong> و<strong style='color:#fff'>الوصول للسوق المباشر</strong>.</p>
  </div>
  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="pc-name" id="pc-pro-name">الأولوية</div>
      <div class="pc-price">$19</div>
      <div class="pc-period" id="pc-pro-period">شهرياً</div>
      <div class="pc-sub" id="pc-pro-tag" style="color:#fb923c">أسرع تنبيهات. أولوية فحص.</div>
      <div class="pc-features">
        <div class="pc-f" id="pc-pro-f1">تنبيهات لحظية لما المقاعد ترجع</div>
        <div class="pc-f" id="pc-pro-f2">أولوية فحص أعلى من المجاني</div>
        <div class="pc-f" id="pc-pro-f3">وصول كامل لذكاء السوق</div>
      </div>
      <button class="pc-btn" id="pc-pro-btn" onclick="openUpgradeModal('pro')">احصل على الأولوية — $19</button>
    </div>
    <div class="pricing-card pricing-lifetime">
      <div class="pc-badge" id="pc-life-badge">💎 المؤسسون · للأوائل</div>
      <div class="pc-name" id="pc-life-name">وصول مدى الحياة</div>
      <div class="pc-price">$199</div>
      <div class="pc-period" id="pc-life-period">دفعة واحدة</div>
      <div class="pc-sub" id="pc-life-sub">سعر المؤسسين الأوائل. يرتفع بعد عدد محدود من المقاعد.</div>
      <div class="pc-features">
        <div class="pc-f" id="pc-life-f1">كل مميزات الأولوية، للأبد</div>
        <div class="pc-f" id="pc-life-f2">أعلى مستوى وصول للسوق</div>
        <div class="pc-f" id="pc-life-f3">شارة المؤسس على ملفك</div>
        <div class="pc-f" id="pc-life-f4">كل المزايا المستقبلية مشمولة</div>
      </div>
      <button class="pc-btn-lifetime" id="pc-life-btn" onclick="openUpgradeModal('lifetime')">احجز كمؤسس — $199</button>
    </div>
  </div>
</div>

<!-- ════ WATCHING TAB — user's tracked events ══════════════════════ -->
<div class="section" data-tab="watching">
  <div class="tcards-head">
    <div class="tcards-h-title" style="gap:8px" id="watch-title">مراقباتي</div>
  </div>
  <div id="watch-content">
    <div class="acc-block">
      <div class="acc-h" id="watch-h">شوف فعالياتك</div>
      <div class="acc-sub" id="watch-sub">اكتب بريدك لعرض الفعاليات اللي تتابعها — نبهنك لحظة رجوع المقاعد.</div>
      <div class="acc-row">
        <input type="email" class="modal-input" id="watch-email" placeholder="your@email.com" autocomplete="email" style="margin-bottom:0"/>
        <button class="gbtn" style="padding:13px 24px;font-size:14px;border-radius:11px;white-space:nowrap" onclick="watchLookup()" id="watch-btn">عرض</button>
      </div>
    </div>
    <div id="watch-list" style="margin-top:18px"></div>
  </div>
</div>

<!-- ════ ALERTS TAB — real DB activity feed ════════════════════════ -->
<div class="section" data-tab="alerts">
  <div class="tcards-head">
    <div class="tcards-h-title" style="gap:8px" id="alerts-title">التنبيهات</div>
    <button class="tcards-h-sub" onclick="loadAlertsFeed()" style="cursor:pointer;font-family:inherit" id="alerts-refresh">تحديث</button>
  </div>
  <div class="afeed-list" id="alerts-list">
    ${feed.length === 0 ? `
    <div class="afeed-empty">
      <div style="font-size:36px;opacity:.35;margin-bottom:10px">🔔</div>
      <div style="color:#fff;font-weight:700;font-size:15px;margin-bottom:6px">ما فيه تنبيهات حتى الآن</div>
      <div style="margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">إذا رجعت مقاعد أو ظهرت فرصة على حدث تتابعه، بنعرض التنبيه هنا.</div>
      <button class="gbtn" style="padding:12px 18px;font-size:14px;border-radius:10px;max-width:260px" onclick="goHomeAndAddEvent()">أضف حدث للمتابعة</button>
    </div>` : feed.slice(0, 30).map((f: any) => {
      const cls = f.type === 'alert_sent' ? 'afeed-item afeed-alert'
                : f.type === 'status_change' ? 'afeed-item afeed-hot'
                : 'afeed-item';
      const t = new Date(f.createdAt);
      const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
      return `<div class="${cls}"><div class="afeed-msg">${escapeHtml(f.message || '')}</div><div class="afeed-time">${time}</div></div>`;
    }).join('')}
  </div>
</div>

<footer id="ftr">© 2026 SEATX · BUILT FOR FANS · 🇸🇦 SAUDI ARABIA</footer>

<!-- ════ BOTTOM NAV — terminal-minimal, mobile only ════════════════ -->
<!-- See docs/design.md §5. Outline SVG icons, no emoji, no fills, no glow. -->
<nav class="bnav" id="bnav" role="navigation" aria-label="Primary">
  <button class="bnav-item active" data-target="home" onclick="switchTab('home')" aria-label="الرئيسية">
    <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 9.6L12 3l9 6.6V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.6z"/>
    </svg>
    <div class="bnav-label" id="bnav-home">الرئيسية</div>
  </button>
  <button class="bnav-item" data-target="trending" onclick="switchTab('trending')" aria-label="الأكثر تداولًا">
    <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 17 9 11 13 15 21 7"/>
      <polyline points="14 7 21 7 21 14"/>
    </svg>
    <div class="bnav-label" id="bnav-trending">الأكثر تداولًا</div>
  </button>
  <button class="bnav-item" data-target="watching" onclick="switchTab('watching')" aria-label="مراقباتي">
    <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    <div class="bnav-label" id="bnav-watching">مراقباتي</div>
  </button>
  <button class="bnav-item" data-target="alerts" onclick="switchTab('alerts')" aria-label="التنبيهات">
    <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
    <div class="bnav-label" id="bnav-alerts">التنبيهات</div>
  </button>
  <button class="bnav-item" data-target="account" onclick="switchTab('account')" aria-label="حسابي">
    <svg class="bnav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
    </svg>
    <div class="bnav-label" id="bnav-account">حسابي</div>
  </button>
</nav>

<script>
const EVENTS = ${ej};
const FEED = ${fj};
const SHARE_BASE = location.origin;

const T = {
  en: {
    navMyAlerts: 'Account', navStart: 'Start watching',
    qhLabel: '🔔 Paste a ticket link — we alert you if seats return',
    qhBtn: 'Notify me if seats return →',
    qhOr: 'or ', qhDemo: 'try a demo event',
    qhPlaceholder: 'Paste ticket link here...',
    ep: 'Saudi seat market · Live',
    hm: "Don't miss the ticket", ha: 'if it comes back.',
    hs: "SeatX watches the event and alerts you the moment an opportunity appears: seats returned, demand spiked, or a new movement on the same event.",
    hb1: 'Start watching', hb2: "I'm in a queue",
    sl1: 'Watching now', sl2: 'Check speed', sl3: 'Events live',
    mpt: 'Event opportunities', mps: 'Last movement seconds ago',
    dbl: 'Demand pressure', mhl: '🔥 Hottest right now',
    ft1: 'I have the event link', ft2: 'Paste a Webook or Ticketmaster link — SeatX alerts you if seats return.',
    fl1: 'Event name', fl2: 'Ticket URL',
    afb: '🔔 Notify me if seats return', fn: 'Free · No account needed · Live alerts',
    titlePh: 'e.g. Al Hilal vs Al Nassr', urlPh: 'Paste event link',
    trndE: '🔥 Opportunities', trndT: 'Events where tickets might come back',
    see: 'Live events', set: 'What people are watching',
    srt1: 'Demand', srt2: 'Watchers', srt3: 'Recent',
    empt: 'No events yet', emps: 'Add the first event above to start tracking ↑',
    // Why-now section (real DB stats below)
    whyPulse: 'Live market', whyTitle: 'The market is moving now',
    whySub: 'Every second, an event shifts. Faster catches. Slower misses.',
    whyL1: 'Events in the market', whyL2: 'Active watchers', whyL3: 'Moves in the last 24h',
    // Pricing — sells priority/speed/access, not features or limits
    prcEye: '💎 Market access', prcH1: 'Speed decides who catches and who misses',
    prcSub: "We don't sell features or limits. We sell <strong style='color:#fff'>priority</strong>, <strong style='color:#fff'>speed</strong>, and <strong style='color:#fff'>live market access</strong>.",
    pcProName: 'Priority', pcProPeriod: 'per month',
    pcProTag: 'Fastest alerts. Priority monitoring.',
    pcProF1: 'Live alerts the second seats return',
    pcProF2: 'Priority monitoring (faster than free)',
    pcProF3: 'Full market intelligence access',
    pcProBtn: 'Get priority — $19',
    pcLifeBadge: '💎 Founding Users · Early only',
    pcLifeName: 'Lifetime access', pcLifePeriod: 'one-time',
    pcLifeSub: 'Founding-user price. Increases after a limited number of seats.',
    pcLifeF1: 'All Priority features, forever',
    pcLifeF2: 'Highest market access tier',
    pcLifeF3: 'Founder badge on your profile',
    pcLifeF4: 'All future features included',
    pcLifeBtn: 'Claim founder access — $199',
    footer: '© 2026 SEATX · BUILT FOR FANS · 🇸🇦 SAUDI ARABIA',
    cdl: 'Next check', watching: 'watching', spiking: 'Spiking',
    alertBtn: 'Get Alert', emailPh: 'your@email.com',
    statusAvailable: '⚡ Available', statusMaybe: '👀 Maybe', statusWatching: '○ Watching',
    demandVeryHigh: '🔥 On Fire', demandHigh: '⚡ High Demand', demandMedium: '👀 Picking Up', demandLow: '○ Watching',
    fomoVeryHigh: '🔥 Selling fast — high demand', fomoHigh: '⚡ People joining right now', fomoMedium: '👀 Demand picking up',
    upgradeTitle: 'Join the {plan} waitlist', upgradeSub: 'Checkout opens soon. Drop your email and we\\'ll let you know first.',
    upgradeBtn: 'Join waitlist', upgradeJoined: '✅ You\\'re on the list. We\\'ll email you when checkout opens.',
    upgradeEntry: 'Entry ($9/mo)', upgradePro: 'Pro ($19/mo)', upgradeLifetime: 'Lifetime ($199)',
    shareTitle: 'Share this event', shareWA: 'WhatsApp', shareTW: 'X / Twitter', shareCopy: 'Copy link', shareCopied: '✓ Copied!',
    shareText: 'Check this on SeatX',
    myAlertsTitle: 'My Alerts', myAlertsSub: 'Enter your email to see events you are tracking.',
    myAlertsBtn: 'Show my alerts', myAlertsEmpty: 'No alerts yet. Track an event to start.',
    popupTitle: '⚡ Event added!', popupSub: 'Enter your email to get alerted the second seats become available.',
    popupBtn: 'Get alerts →', popupSkip: 'Skip for now',
    closeBtn: 'Close',
    invalidEmail: 'Enter valid email', invalidUrl: 'Paste a valid link', fillAll: 'Fill all fields',
    adding: 'Adding...', sending: 'Sending...', error: 'Something went wrong', limitMsg: 'Free plan: 1 active event. Upgrade for more.',
    // Tab labels (bottom nav)
    tabHome: 'Home', tabTrending: 'Trending', tabWatching: 'Watching', tabAlerts: 'Alerts', tabAccount: 'Account',
    // Trending tab
    trendTitle: 'Hottest right now', trendLink: 'See all',
    trendEmptyTitle: 'No opportunities tracked yet', trendEmptyBody: "Add the first event you want to follow — if seats return or an official opportunity appears, we'll notify you.",
    // Watching tab
    watchTitle: 'My watching', watchH: 'See your events', watchSub: 'Enter your email to see the events you are tracking — we alert you the second seats return.',
    watchBtn: 'Show', watchEmptyTitle: 'No events yet', watchEmptyBody: 'Go to Home and paste your first event link.',
    // Alerts tab
    alertsTitle: 'Alerts', alertsRefresh: 'Refresh',
    alertsEmptyTitle: 'No alerts yet', alertsEmptyBody: "If seats return or an opportunity appears on an event you're watching, the alert shows here.",
    // Account tab
    accTitle: 'My account', accSubtitle: 'Your settings',
    accPlanH: 'Current plan', accPlanName: 'Free', accPlanLimit: '1 active event maximum',
    accUpgradeBtn: 'Upgrade',
    accNotifH: 'Alerts',
    notifPushOn: '✓ Live push alerts enabled',
    notifPushOff: '○ Push alerts not enabled yet',
    notifPushBlocked: '○ Browser blocked push notifications',
    notifPushUnsupported: 'Push not supported on this device',
    notifEmailOn: '📧 ',
    notifEmailOff: '○ No email saved yet',
    accNotifHint: 'Enable alerts by subscribing to your first event on the Home tab.',
    accLangH: 'Language',
    // Why-now zero-state
    whyMonitor: 'Watching for opportunities',
    whyL3Zero: 'Live — any movement reaches you',
    // Queue Mode section (separate flow, honest disclaimer)
    qmTitle: "Stuck in a queue with a high number?",
    qmSub: "SeatX can't move you up the queue. But we CAN watch for a second opportunity on the same event: another official link, a new drop, a different package, or a meaningful change in availability.",
    qmB1: "We don't bypass the queue",
    qmB2: 'We look for a second opportunity on the same event',
    qmB3: 'We notify you if a different official path appears',
    qmB4: "We help you decide if the wait is worth it",
    qmLName: 'Event name', qmLSource: 'Which source are you waiting on?',
    qmLPos: 'Your queue position', qmLOptional: '(optional)',
    qmLUrl: 'Queue link', qmLEmail: 'Email for alerts',
    qmEventPh: 'e.g. Mohammed Abdu concert, UFC Riyadh',
    qmSourcePick: 'Pick a source', qmPosPh: 'e.g. 24,500',
    qmUrlPh: 'Paste the waiting-room link',
    qmSubmit: 'Find me a second opportunity',
    qmConfirm: "Done. Stay in the queue if you want — SeatX is now watching for a second opportunity on the same event. If another link, a new drop, a different package, or a meaningful availability change appears, we'll notify you.",
    qmDisclaimer: "SeatX doesn't bypass queues, doesn't buy on your behalf, and doesn't guarantee tickets.",
    qmNeedEvent: 'Enter the event name first',
    // Entry mode 2 — request by name
    rqTitle: "No link? Just tell us the event", rqSub: "Type the event you want and SeatX alerts you the moment its tickets are available — no searching on your part.",
    rqLName: 'Event name', rqLCity: 'City', rqOptional: '(optional)', rqLEmail: 'Email for the alert',
    rqBtn: '🔔 Alert me when tickets are available', rqNote: 'Free · No account · We alert you the moment we find tickets',
    rqEventPh: 'e.g. Al Hilal vs Al Nassr, a concert, Riyadh Season', rqCityPh: 'Riyadh, Jeddah, ...',
    rqNeedEvent: 'Enter the event name', rqConfirm: "Done — we saved your request for “{ev}”. The moment its tickets are available, we'll alert your email.",
    // Queue Mode segmented source button (label for "Other"; vendor names stay as-is)
    qmSegOther: 'Other',
    // Queue Mode success card
    qmResultTitle: 'Your request is saved',
    qmResultBody: "SeatX is now watching for any second official opportunity around this event. If another official link, a new drop, a different package, or a meaningful availability change appears, we'll notify you.",
    qmSummaryEvent: 'Event', qmSummarySource: 'Source', qmSummaryPosition: 'Queue position',
    qmSummaryStatus: 'Status', qmSummaryLast: 'Last update', qmSummaryDash: '—',
    qmStatusSearching: 'Watching for a second opportunity', qmTimeNow: 'just now',
    qmWatchTitle: "What we're watching for",
    qmWatchB1: 'Another official link', qmWatchB2: 'A new drop',
    qmWatchB3: 'A different package',  qmWatchB4: 'A meaningful change in availability',
    qmAnother: 'Submit another request',
    // Trending empty state CTAs
    trendEmptyCta: 'Add an event to watch', trendEmptyCta2: "I'm in a queue",
    // Watching empty + error states
    watchEmptyTitle: "You don't have any watches yet",
    watchEmptyBody: 'Add an event from Home, and your watches will show here.',
    watchErrorTitle: "We couldn't load your watches",
    watchErrorBody: 'Double-check the email, or try again.',
    watchErrorRetry: 'Try again',
    // Shared empty-CTA label + loading
    emptyCtaAdd: 'Add an event', loading: 'Loading...',
  },
  ar: {
    navMyAlerts: 'حسابي', navStart: 'ابدأ المتابعة',
    qhLabel: '🔔 ألصق رابط الحدث — ننبّهك إذا رجعت المقاعد',
    qhBtn: 'نبّهني إذا رجعت ←',
    qhOr: 'أو ', qhDemo: 'جرّب فعالية تجريبية',
    qhPlaceholder: 'الصق رابط التذاكر هنا...',
    ep: 'سوق المقاعد السعودي · مباشر',
    hm: 'لا تفوّت التذكرة', ha: 'إذا رجعت.',
    hs: 'SeatX يتابع الحدث وينبّهك إذا ظهرت فرصة: مقاعد رجعت، ضغط ارتفع، أو حركة جديدة على نفس الحدث.',
    hb1: 'ابدأ المتابعة', hb2: 'أنا داخل كيو',
    sl1: 'يتابعون الآن', sl2: 'سرعة الفحص', sl3: 'فعاليات مباشرة',
    mpt: 'فرص الحدث', mps: 'آخر حركة قبل ثوانٍ',
    dbl: 'الضغط على الحدث', mhl: '🔥 الأقرب لفرصة الآن',
    ft1: 'عندي رابط الحدث', ft2: 'ألصق رابط ويبوك أو تيكت ماستر، وSeatX ينبّهك إذا رجعت المقاعد.',
    fl1: 'اسم الحدث', fl2: 'رابط التذاكر',
    afb: '🔔 نبّهني إذا رجعت المقاعد', fn: 'مجاني · بدون حساب · تنبيهات لحظية',
    titlePh: 'مثال: الهلال × النصر', urlPh: 'ألصق رابط الحدث',
    trndE: '🔥 فرص', trndT: 'فعاليات ممكن ترجع فيها فرص',
    see: 'الفعاليات المباشرة', set: 'ما يتابعه الناس الآن',
    srt1: 'الطلب', srt2: 'المتابعون', srt3: 'الأحدث',
    empt: 'لا فعاليات بعد', emps: 'أضف أول فعالية للمتابعة ↑',
    // Why-now section
    whyPulse: 'السوق المباشر', whyTitle: 'السوق يتحرك الآن',
    whySub: 'كل ثانية، فعالية تتغيّر. الأسرع يمسك. المتأخر يفوّته.',
    whyL1: 'فعالية في السوق', whyL2: 'متابع نشط', whyL3: 'تحرّك في آخر ٢٤ ساعة',
    // Pricing — السرعة والأولوية، ليس features أو حدود
    prcEye: '💎 الوصول للسوق', prcH1: 'السرعة تحدّد من يمسك ومن يفوّته',
    prcSub: 'ما نبيع features أو حدود تقنية. نبيع <strong style="color:#fff">الأولوية</strong> و<strong style="color:#fff">السرعة</strong> و<strong style="color:#fff">الوصول للسوق المباشر</strong>.',
    pcProName: 'الأولوية', pcProPeriod: 'شهرياً',
    pcProTag: 'أسرع تنبيهات. أولوية فحص.',
    pcProF1: 'تنبيهات لحظية لما المقاعد ترجع',
    pcProF2: 'أولوية فحص أعلى من المجاني',
    pcProF3: 'وصول كامل لذكاء السوق',
    pcProBtn: 'احصل على الأولوية — $19',
    pcLifeBadge: '💎 المؤسسون · للأوائل',
    pcLifeName: 'وصول مدى الحياة', pcLifePeriod: 'دفعة واحدة',
    pcLifeSub: 'سعر المؤسسين الأوائل. يرتفع بعد عدد محدود من المقاعد.',
    pcLifeF1: 'كل مميزات الأولوية، للأبد',
    pcLifeF2: 'أعلى مستوى وصول للسوق',
    pcLifeF3: 'شارة المؤسس على ملفك',
    pcLifeF4: 'كل المزايا المستقبلية مشمولة',
    pcLifeBtn: 'احجز كمؤسس — $199',
    footer: '© 2026 SEATX · صُنع للمشجعين · 🇸🇦 المملكة العربية السعودية',
    cdl: 'الفحص القادم', watching: 'يتابعون', spiking: 'يرتفع',
    alertBtn: 'تنبّهني', emailPh: 'بريدك@مثال.com',
    statusAvailable: '⚡ متاح', statusMaybe: '👀 ربما', statusWatching: '○ قيد المراقبة',
    demandVeryHigh: '🔥 ملتهب', demandHigh: '⚡ طلب مرتفع', demandMedium: '👀 يرتفع', demandLow: '○ هادئ',
    fomoVeryHigh: '🔥 يُباع بسرعة — طلب مرتفع', fomoHigh: '⚡ مستخدمون ينضمّون الآن', fomoMedium: '👀 الطلب يرتفع',
    upgradeTitle: 'انضم لقائمة انتظار {plan}', upgradeSub: 'الدفع يفتح قريباً. اترك بريدك ونعلمك أول واحد.',
    upgradeBtn: 'انضم', upgradeJoined: '✅ أنت في القائمة. سنراسلك عند فتح الدفع.',
    upgradeEntry: 'Entry ($9/شهر)', upgradePro: 'Pro ($19/شهر)', upgradeLifetime: 'Lifetime ($199)',
    shareTitle: 'شارك الفعالية', shareWA: 'واتساب', shareTW: 'تويتر', shareCopy: 'نسخ الرابط', shareCopied: '✓ تم النسخ!',
    shareText: 'شيك على هذا في SeatX',
    myAlertsTitle: 'تنبيهاتي', myAlertsSub: 'اكتب بريدك لرؤية الفعاليات اللي تتابعها.',
    myAlertsBtn: 'اعرض تنبيهاتي', myAlertsEmpty: 'لا توجد تنبيهات بعد. تابع فعالية للبدء.',
    popupTitle: '⚡ تم إضافة الفعالية!', popupSub: 'اكتب بريدك لتصلك تنبيهات لحظة توفر المقاعد.',
    popupBtn: 'تنبيهاتي ←', popupSkip: 'لاحقاً',
    closeBtn: 'إغلاق',
    invalidEmail: 'أدخل بريدًا صحيحًا', invalidUrl: 'الصق رابطاً صحيحاً', fillAll: 'أكمل جميع الحقول',
    adding: 'جاري الإضافة...', sending: 'جاري الإرسال...', error: 'حصل خطأ', limitMsg: 'الخطة المجانية: فعالية واحدة نشطة. ارقِ لمزيد.',
    // Tab labels (bottom nav)
    tabHome: 'الرئيسية', tabTrending: 'الأكثر تداولًا', tabWatching: 'مراقباتي', tabAlerts: 'التنبيهات', tabAccount: 'حسابي',
    // Trending tab
    trendTitle: 'الأكثر تداولًا الآن', trendLink: 'عرض الكل',
    trendEmptyTitle: 'ما فيه فرص مرصودة الآن', trendEmptyBody: 'أضف أول حدث تبي تتابعه، وإذا رجعت مقاعد أو ظهرت فرصة رسمية بننبّهك.',
    // Watching tab
    watchTitle: 'مراقباتي', watchH: 'شوف فعالياتك', watchSub: 'اكتب بريدك لعرض الفعاليات اللي تتابعها — نبّهك لحظة رجوع المقاعد.',
    watchBtn: 'عرض', watchEmptyTitle: 'لسه ما تتابع أي فعالية', watchEmptyBody: 'روح للرئيسية وألصق رابط أول فعالية.',
    // Alerts tab
    alertsTitle: 'التنبيهات', alertsRefresh: 'تحديث',
    alertsEmptyTitle: 'ما فيه تنبيهات حتى الآن', alertsEmptyBody: 'إذا رجعت مقاعد أو ظهرت فرصة على حدث تتابعه، بنعرض التنبيه هنا.',
    // Account tab
    accTitle: 'حسابي', accSubtitle: 'إعداداتك في السوق',
    accPlanH: 'خطتك الحالية', accPlanName: 'مجاني', accPlanLimit: 'فعالية واحدة نشطة كحد أقصى',
    accUpgradeBtn: 'الترقية',
    accNotifH: 'التنبيهات',
    notifPushOn: '✓ تنبيهات لحظية مفعّلة',
    notifPushOff: '○ تنبيهات الويب غير مفعّلة بعد',
    notifPushBlocked: '○ تنبيهات الويب محجوبة من المتصفح',
    notifPushUnsupported: 'الجهاز لا يدعم تنبيهات الويب',
    notifEmailOn: '📧 ',
    notifEmailOff: '○ ما اتسجّل بريد بعد',
    accNotifHint: 'فعّل التنبيهات من خلال الاشتراك بأول فعالية في تبويب «الرئيسية».',
    accLangH: 'اللغة',
    // Why-now zero-state
    whyMonitor: 'نتابع الفرص',
    whyL3Zero: 'مباشر — أي حركة توصلك',
    // Queue Mode (نص صريح: ما نتجاوز الكيو)
    qmTitle: 'داخل كيو ورقمك بعيد؟',
    qmSub: 'SeatX ما يقدر يقدّمك في الطابور. لكن نقدر نبحث لك عن فرصة ثانية لنفس الحدث: رابط رسمي آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر.',
    qmB1: 'ما نتجاوز الطابور',
    qmB2: 'نبحث عن فرص ثانية لنفس الحدث',
    qmB3: 'ننبّهك إذا ظهر مسار رسمي مختلف',
    qmB4: 'نساعدك تعرف هل الانتظار يستاهل',
    qmLName: 'اسم الحدث', qmLSource: 'المصدر اللي أنت منتظر فيه',
    qmLPos: 'رقمك في الانتظار', qmLOptional: '(اختياري)',
    qmLUrl: 'رابط الكيو', qmLEmail: 'بريدك للتنبيه',
    qmEventPh: 'مثال: حفلة محمد عبده، UFC Riyadh',
    qmSourcePick: 'اختر المصدر', qmPosPh: 'مثال: 24,500',
    qmUrlPh: 'ألصق رابط الانتظار',
    qmSubmit: 'ابحث عن فرصة ثانية',
    qmConfirm: 'تمام. خلّك في الكيو إذا تبغى، وSeatX بيراقب أي فرصة ثانية حول نفس الحدث. إذا ظهر رابط آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر، بننبّهك.',
    qmDisclaimer: 'SeatX لا يتجاوز الكيو، لا يشتري بدالك، ولا يضمن التذاكر.',
    qmNeedEvent: 'اكتب اسم الحدث أولًا',
    // Entry mode 2 — request by name
    rqTitle: 'ما عندك رابط؟ قل لنا الحدث', rqSub: 'اكتب اسم الحدث اللي تبيه، وSeatX يوصّلك تنبيه لما تتوفر تذاكره — بدون ما تدوّر بنفسك.',
    rqLName: 'اسم الحدث', rqLCity: 'المدينة', rqOptional: '(اختياري)', rqLEmail: 'بريدك للتنبيه',
    rqBtn: '🔔 نبّهني لما تتوفر التذاكر', rqNote: 'مجاني · بدون حساب · ننبّهك أول ما نلقى تذاكره',
    rqEventPh: 'مثال: الهلال × النصر، حفلة محمد عبده، موسم الرياض', rqCityPh: 'الرياض، جدة، ...',
    rqNeedEvent: 'اكتب اسم الحدث', rqConfirm: 'تمام — سجّلنا طلبك على «{ev}». أول ما تتوفر تذاكره بننبّهك على بريدك.',
    // Queue Mode segmented source button
    qmSegOther: 'غير ذلك',
    // Queue Mode success card
    qmResultTitle: 'تم حفظ طلبك',
    qmResultBody: 'SeatX بيراقب أي فرصة رسمية ثانية حول هذا الحدث. إذا ظهر رابط رسمي آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر، بننبّهك.',
    qmSummaryEvent: 'اسم الحدث', qmSummarySource: 'المصدر', qmSummaryPosition: 'رقم الانتظار',
    qmSummaryStatus: 'الحالة', qmSummaryLast: 'آخر تحديث', qmSummaryDash: '—',
    qmStatusSearching: 'نبحث عن فرصة ثانية', qmTimeNow: 'الآن',
    qmWatchTitle: 'وش نراقب؟',
    qmWatchB1: 'رابط رسمي آخر', qmWatchB2: 'دفعة جديدة',
    qmWatchB3: 'باقة مختلفة',    qmWatchB4: 'تغير مهم في التوفر',
    qmAnother: 'إرسال طلب ثاني',
    // Trending empty state CTAs
    trendEmptyCta: 'أضف حدث للمتابعة', trendEmptyCta2: 'أنا داخل كيو',
    // Watching empty + error states
    watchEmptyTitle: 'ما عندك مراقبات بعد',
    watchEmptyBody: 'أضف حدث من الرئيسية، وبعدها بتظهر مراقباتك هنا.',
    watchErrorTitle: 'ما قدرنا نحمّل مراقباتك',
    watchErrorBody: 'تأكد من الإيميل أو جرّب مرة ثانية.',
    watchErrorRetry: 'جرّب مرة ثانية',
    // Shared empty-CTA label + loading
    emptyCtaAdd: 'أضف حدث', loading: 'جاري التحميل...',
  }
};

let lang = 'en';
let pendingEventId = null;

function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function s(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function sPh(id, v) { const e = document.getElementById(id); if (e) e.placeholder = v; }

function setLang(l) {
  lang = l;
  const isAr = l === 'ar';
  document.documentElement.lang = l;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.body.className = isAr ? 'ar' : 'en';
  document.querySelectorAll('.lb').forEach((b, i) => b.classList.toggle('on', i === (isAr ? 1 : 0)));
  const t = T[l];
  // n-si is now icon-only (docs/design.md §5). Set aria-label/title only.
  var nsi = document.getElementById('n-si');
  if (nsi) { nsi.setAttribute('aria-label', t.navMyAlerts); nsi.setAttribute('title', t.navMyAlerts); }
  // Desktop top-nav tabs (.ntab) — mirror tab labels
  s('ntab-home', t.tabHome); s('ntab-trending', t.tabTrending);
  s('ntab-watching', t.tabWatching); s('ntab-alerts', t.tabAlerts);
  s('qhl', t.qhLabel); s('qh-btn', t.qhBtn); s('qh-or', t.qhOr); s('qh-demo', t.qhDemo);
  // Don't set qh-url placeholder here — startRotatingPlaceholder owns it so
  // it rotates through Saudi-flavored prompts (الهلال × النصر / ويبوك / موسم الرياض / UFC).
  if (typeof startRotatingPlaceholder === 'function') startRotatingPlaceholder();
  s('ep', t.ep); s('hm', t.hm); s('ha', t.ha); s('hs', t.hs);
  s('hb1', t.hb1); s('hb2', t.hb2);
  s('sl1', t.sl1); s('sl2', t.sl2); s('sl3', t.sl3);
  s('mpt', t.mpt); s('mps', t.mps); s('dbl', t.dbl); s('mhl', t.mhl);
  s('ft1', t.ft1); s('ft2', t.ft2); s('fl1', t.fl1); s('fl2', t.fl2);
  s('afb', t.afb); s('fn', t.fn);
  sPh('ev-t', t.titlePh); sPh('ev-u', t.urlPh);
  s('trnd-e', t.trndE); s('trnd-t', t.trndT);
  s('see', t.see); s('set', t.set);
  s('srt1', t.srt1); s('srt2', t.srt2); s('srt3', t.srt3);
  s('empt', t.empt); s('emps', t.emps);
  // Why-now section (replaces How-it-works)
  s('why-pulse-label', t.whyPulse); s('why-title', t.whyTitle); s('why-sub', t.whySub);
  s('why-l1', t.whyL1); s('why-l2', t.whyL2); s('why-l3', t.whyL3);
  // Pricing — 2 cards (Pro + Lifetime Founders). Entry card was removed in the
  // landing pass; pcEntry* keys are intentionally gone.
  s('prc-eye', t.prcEye); s('prc-h1', t.prcH1);
  // prc-sub contains inline <strong> bold accents — use innerHTML, not textContent.
  var prcSubEl = document.getElementById('prc-sub');
  if (prcSubEl) prcSubEl.innerHTML = t.prcSub;
  s('pc-pro-name', t.pcProName); s('pc-pro-period', t.pcProPeriod); s('pc-pro-tag', t.pcProTag);
  s('pc-pro-f1', t.pcProF1); s('pc-pro-f2', t.pcProF2); s('pc-pro-f3', t.pcProF3);
  s('pc-pro-btn', t.pcProBtn);
  s('pc-life-badge', t.pcLifeBadge); s('pc-life-name', t.pcLifeName); s('pc-life-period', t.pcLifePeriod);
  s('pc-life-sub', t.pcLifeSub);
  s('pc-life-f1', t.pcLifeF1); s('pc-life-f2', t.pcLifeF2); s('pc-life-f3', t.pcLifeF3); s('pc-life-f4', t.pcLifeF4);
  s('pc-life-btn', t.pcLifeBtn);
  // Tab labels (bottom nav)
  s('bnav-home', t.tabHome); s('bnav-trending', t.tabTrending);
  s('bnav-watching', t.tabWatching); s('bnav-alerts', t.tabAlerts);
  s('bnav-account', t.tabAccount);
  // Trending tab
  s('trnd-t', t.trendTitle); s('trnd-link', t.trendLink);
  // Watching tab
  s('watch-title', t.watchTitle); s('watch-h', t.watchH);
  s('watch-sub', t.watchSub); s('watch-btn', t.watchBtn);
  // Alerts tab
  s('alerts-title', t.alertsTitle); s('alerts-refresh', t.alertsRefresh);
  // Account tab — settings only (no email lookup; lives in Watching tab now)
  s('acc-title', t.accTitle); s('acc-subtitle', t.accSubtitle);
  s('acc-plan-h', t.accPlanH); s('acc-plan-name', t.accPlanName);
  s('acc-plan-limit', t.accPlanLimit); s('acc-upgrade-btn', t.accUpgradeBtn);
  s('acc-notif-h', t.accNotifH); s('acc-lang-h', t.accLangH);
  s('acc-notif-hint', t.accNotifHint);
  // Notification status text is owned by renderAccountStatus() — re-run after
  // lang switch so the message reflects current state in the chosen language.
  if (typeof renderAccountStatus === 'function') renderAccountStatus();
  // Account language toggle reflects current lang
  document.querySelectorAll('.acc-ltog button').forEach((b, i) => b.classList.toggle('on', i === (isAr ? 1 : 0)));
  // Why-now zero-state copy (only present when alerts_24h was 0 at SSR)
  s('why-monitor', t.whyMonitor);
  // Queue Mode — title, copy, bullets, labels, placeholders, disclaimer
  s('qm-title', t.qmTitle); s('qm-sub', t.qmSub);
  s('qm-l-name', t.qmLName); s('qm-l-source', t.qmLSource);
  // Optional-label slots use innerHTML so the (optional) tag stays subtle.
  var qmLPos = document.getElementById('qm-l-pos');
  if (qmLPos) qmLPos.innerHTML = t.qmLPos + ' <span style="color:var(--muted);font-weight:400">' + t.qmLOptional + '</span>';
  var qmLUrl = document.getElementById('qm-l-url');
  if (qmLUrl) qmLUrl.innerHTML = t.qmLUrl + ' <span style="color:var(--muted);font-weight:400">' + t.qmLOptional + '</span>';
  s('qm-l-email', t.qmLEmail); s('qm-btn', t.qmSubmit); s('qm-disclaimer', t.qmDisclaimer);
  // Entry mode 2 — request by name
  s('rq-title', t.rqTitle); s('rq-sub', t.rqSub);
  s('rq-l-name', t.rqLName); s('rq-l-email', t.rqLEmail);
  s('rq-btn', t.rqBtn); s('rq-note', t.rqNote); s('rq-optional', t.rqOptional);
  sPh('rq-event', t.rqEventPh); sPh('rq-city', t.rqCityPh);
  // rq-l-city has an inline (optional) span — set via innerHTML to keep it.
  var rqLCity = document.getElementById('rq-l-city');
  if (rqLCity) rqLCity.innerHTML = t.rqLCity + ' <span style="color:var(--muted);font-weight:400" id="rq-optional">' + t.rqOptional + '</span>';
  sPh('qm-event', t.qmEventPh); sPh('qm-pos', t.qmPosPh); sPh('qm-url', t.qmUrlPh);
  // Bullet list (4 items) — re-rendered as innerHTML on lang switch.
  var qmBul = document.getElementById('qm-bullets');
  if (qmBul) qmBul.innerHTML = '<li>· ' + t.qmB1 + '</li><li>· ' + t.qmB2 + '</li><li>· ' + t.qmB3 + '</li><li>· ' + t.qmB4 + '</li>';
  // Segmented source picker: only "Other" is translated (vendor names stay).
  s('qm-seg-other', t.qmSegOther);
  // Trending empty-state copy + CTAs (only present when events.length === 0 at SSR)
  s('trnd-empty-title', t.trendEmptyTitle); s('trnd-empty-body', t.trendEmptyBody);
  s('trnd-empty-cta', t.trendEmptyCta); s('trnd-empty-cta2', t.trendEmptyCta2);
  s('ftr', t.footer);
  renderCards();
}

let cdv = {};
function initTimers() {
  document.querySelectorAll('.cdv').forEach((el, i) => {
    cdv[i] = Math.floor(Math.random() * 15);
    el.textContent = '0:' + String(cdv[i]).padStart(2, '0');
  });
}
setInterval(() => {
  document.querySelectorAll('.cdv').forEach((el, i) => {
    if (cdv[i] === undefined) cdv[i] = 15;
    cdv[i]--;
    if (cdv[i] < 0) cdv[i] = 15;
    el.textContent = '0:' + String(cdv[i]).padStart(2, '0');
    if (cdv[i] === 0) {
      el.style.color = 'var(--lime)';
      el.style.textShadow = '0 0 8px rgba(163,230,53,.8)';
      setTimeout(() => { el.style.color = ''; el.style.textShadow = ''; }, 700);
    }
  });
}, 1000);

async function pollFeed() {
  try {
    const r = await fetch('/api/feed');
    const data = await r.json();
    const mp = document.getElementById('mpfeed');
    if (!mp || !data.logs || !data.logs.length) return;
    mp.innerHTML = data.logs.slice(0, 4).map(f =>
      \`<div class="feed-item \${f.type === 'alert_sent' ? 'alert' : f.type === 'status_change' ? 'hot' : ''}">\${escapeHtmlClient(f.message || '')}</div>\`
    ).join('');
  } catch (_) { }
}
setInterval(pollFeed, 8000);

function escapeHtmlClient(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let currentEvents = [...EVENTS];
function sortEvents(by, tabEl) {
  document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('on'));
  if (tabEl) tabEl.classList.add('on');
  if (by === 'demand') currentEvents.sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0));
  if (by === 'watchers') currentEvents.sort((a, b) => (b.watchers_count || 0) - (a.watchers_count || 0));
  if (by === 'recent') currentEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  renderCards();
}

function getDemandClass(band) { return 'cdt-' + (band || 'low'); }
function getDemandLabelJS(band) {
  const t = T[lang];
  if (band === 'very_high') return t.demandVeryHigh;
  if (band === 'high') return t.demandHigh;
  if (band === 'medium') return t.demandMedium;
  return t.demandLow;
}
function getCardClass(band) {
  if (band === 'very_high' || band === 'high') return 'ecard hot-card';
  if (band === 'medium') return 'ecard warm-card';
  return 'ecard';
}
function getScoreColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 55) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#a3e635';
}
function getStatusLabel(status) {
  const t = T[lang];
  if (status === 'available') return t.statusAvailable;
  if (status === 'maybe_available') return t.statusMaybe;
  return t.statusWatching;
}
function getFomoText(band) {
  const t = T[lang];
  if (band === 'very_high') return t.fomoVeryHigh;
  if (band === 'high') return t.fomoHigh;
  if (band === 'medium') return t.fomoMedium;
  return '';
}

function renderCards() {
  const grid = document.getElementById('egrid');
  if (!grid) return;
  if (currentEvents.length === 0) {
    const t = T[lang];
    grid.innerHTML = \`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎫</div><div class="empty-title">\${t.empt}</div><div class="empty-sub">\${t.emps}</div></div>\`;
    return;
  }
  grid.innerHTML = currentEvents.map(e => buildCard(e)).join('');
  initTimers();
  animateScoreBars();
}

function buildCard(e) {
  const t = T[lang];
  const band = e.demand_band || 'low';
  const score = e.demand_score || 0;
  const statusClass = e.status === 'available' ? 'csb-available' : e.status === 'maybe_available' ? 'csb-maybe' : 'csb-unavailable';
  const fomo = getFomoText(band);
  const titleEsc = escapeHtmlClient(e.title || '');
  const urlEsc = escapeHtmlClient(e.event_url || '');
  const sourcePart = e.source_name ? '<div class="card-source">' + escapeHtmlClient(e.source_name) + '</div>' : '';
  const imgSection = e.hero_image
    ? \`<div class="card-img"><img src="\${escapeHtmlClient(e.hero_image)}" alt="\${titleEsc}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=card-img-fallback><div class=card-img-icon>🎫</div></div>'"/><div class="card-overlay"></div>\${sourcePart}<div class="card-status-badge \${statusClass}">\${getStatusLabel(e.status)}</div></div>\`
    : \`<div class="card-img" style="background:linear-gradient(135deg,#0d1117,#1a1f2e);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">\${sourcePart}<div style="font-size:11px;font-weight:700;color:rgba(163,230,53,.6);font-family:var(--mono);text-transform:uppercase;letter-spacing:.15em">LIVE EVENT</div><div style="font-size:15px;font-weight:800;color:#fff;text-align:center;padding:0 16px;line-height:1.3">\${titleEsc}</div><div style="width:40px;height:2px;background:rgba(163,230,53,.4);border-radius:2px"></div><div class="card-status-badge \${statusClass}">\${getStatusLabel(e.status)}</div></div>\`;
  const metaPart = (e.event_date || e.location)
    ? '<div class="card-meta-row">' + (e.event_date ? '<div class="card-meta-item">📅 ' + escapeHtmlClient(e.event_date) + '</div>' : '') + (e.location ? '<div class="card-meta-item">📍 ' + escapeHtmlClient(e.location) + '</div>' : '') + '</div>'
    : '';
  return \`
  <div class="\${getCardClass(band)}">
    \${imgSection}
    <div class="card-body">
      <div class="card-demand-row">
        <div class="card-demand-tag \${getDemandClass(band)}">\${getDemandLabelJS(band)}</div>
        <div class="card-watchers">👥 \${e.watchers_count || 0} \${t.watching}\${(band === 'very_high' || band === 'high') ? ' · <span style="color:#fb923c">' + t.spiking + '</span>' : ''}</div>
      </div>
      \${fomo ? '<div class="card-fomo">' + fomo + '</div>' : ''}
      <div class="card-title">\${titleEsc}</div>
      <div class="card-url">\${urlEsc}</div>
      \${metaPart}
      <div class="card-score-row"><div class="score-track"><div class="score-fill" data-score="\${score}" style="width:0%;background:\${getScoreColor(score)}"></div></div><div class="score-val">\${score}</div></div>
      <div class="card-check-row"><div class="check-label"><div class="check-dot"></div><span class="cdl">\${t.cdl}</span></div><div class="check-timer cdv">0:15</div></div>
      <div class="card-sub-row">
        <input class="card-email" id="em-\${e.id}" placeholder="\${t.emailPh}" type="email" autocomplete="email"/>
        <button class="card-alert-btn" onclick="subscribe(\${e.id},this)">\${t.alertBtn}</button>
        <button class="card-share-btn" onclick="event.stopPropagation();openShareModal(\${e.id})" title="\${t.shareTitle}" aria-label="\${t.shareTitle}">↗</button>
      </div>
    </div>
  </div>\`;
}

function animateScoreBars() {
  setTimeout(() => {
    document.querySelectorAll('.score-fill[data-score]').forEach(el => {
      el.style.width = el.dataset.score + '%';
    });
  }, 100);
}

let ti = 0;
const staticToasts = {
  en: [
    { i: '⚡', t: 'Seats returned — UFC Riyadh', s: '2 Premium seats appeared. 847 users notified.' },
    { i: '🔥', t: 'Al Nassr Derby — demand spike', s: '542 new users in the last 10 minutes.' },
    { i: '🚨', t: 'Page change detected', s: 'Riyadh Season Concert — availability updated.' },
  ],
  ar: [
    { i: '⚡', t: 'مقاعد UFC الرياض عادت', s: 'مقعدان بريميوم ظهرا. 847 مستخدم تم تنبيههم.' },
    { i: '🔥', t: 'ديربي النصر — ارتفاع الطلب', s: '542 مستخدم جديد في 10 دقائق.' },
    { i: '🚨', t: 'تغيير مرصود', s: 'حفل موسم الرياض — تحديث التوفر.' },
  ]
};
function showToast() {
  const ts = staticToasts[lang] || staticToasts.en;
  const d = ts[ti % ts.length]; ti++;
  const tc = document.getElementById('tc');
  if (!tc) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.fontFamily = lang === 'ar' ? "'IBM Plex Sans Arabic',sans-serif" : "'DM Sans',sans-serif";
  if (lang === 'ar') el.style.direction = 'rtl';
  el.innerHTML = \`<div class="toast-icon">\${d.i}</div><div><div class="toast-title">\${escapeHtmlClient(d.t)}</div><div class="toast-sub">\${escapeHtmlClient(d.s)}</div></div><div class="toast-bar" style="animation-duration:5000ms"></div>\`;
  tc.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  setTimeout(() => { el.classList.add('off'); el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 5000);
}
setTimeout(() => { showToast(); setInterval(showToast, 9000 + Math.random() * 2000); }, 2500);

async function addEvent() {
  const t = T[lang];
  const title = document.getElementById('ev-t').value.trim();
  let url = document.getElementById('ev-u').value.trim();
  if (!title || !url) { alert(t.fillAll); return; }
  // Tolerate links pasted without a protocol (e.g. "webook.com/..."). Real
  // users copy links this way — rejecting them is the bug Ahmad hit.
  if (!/^https?:\\/\\//i.test(url)) url = 'https://' + url;
  if (url.indexOf('.') === -1) { alert(t.invalidUrl); return; }
  const btn = document.getElementById('afb');
  const orig = btn.textContent;
  btn.textContent = t.adding;
  btn.disabled = true;
  try {
    const r = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, eventUrl: url }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'failed');
    pendingEventId = data.id;
    showEmailPopup(data.id);
    setTimeout(() => location.reload(), 4000);
  } catch (e) {
    alert(t.error);
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function quickAdd() {
  const t = T[lang];
  let url = document.getElementById('qh-url').value.trim();
  if (!url) { document.getElementById('qh-url').focus(); return; }
  // Tolerate links without a protocol (same fix as addEvent).
  if (!/^https?:\\/\\//i.test(url)) url = 'https://' + url;
  if (url.indexOf('.') === -1) { alert(t.invalidUrl); return; }
  const btn = document.getElementById('qh-btn');
  const orig = btn.textContent;
  btn.textContent = t.adding;
  btn.disabled = true;
  const grid = document.getElementById('egrid');
  if (grid) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.id = 'sk-temp';
    grid.prepend(sk);
  }
  try {
    let host = url;
    try { host = new URL(url).hostname; } catch (_) { }
    const r = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: host, eventUrl: url }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'failed');
    pendingEventId = data.id;
    showEmailPopup(data.id);
    setTimeout(() => location.reload(), 4000);
  } catch (e) {
    btn.textContent = orig;
    btn.disabled = false;
    const sk = document.getElementById('sk-temp');
    if (sk) sk.remove();
  }
}

async function tryDemo() {
  const t = T[lang];
  const btn = document.getElementById('qh-demo');
  if (btn) { btn.textContent = t.adding; btn.disabled = true; }
  const grid = document.getElementById('egrid');
  if (grid) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.id = 'sk-demo';
    grid.prepend(sk);
  }
  try {
    const r = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Al Nassr vs Al Hilal — Demo', eventUrl: 'https://www.ticketmaster.sa/' }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'failed');
    pendingEventId = data.id;
    showEmailPopup(data.id);
    setTimeout(() => location.reload(), 4000);
  } catch (e) {
    if (btn) { btn.textContent = t.qhDemo; btn.disabled = false; }
    const sk = document.getElementById('sk-demo');
    if (sk) sk.remove();
  }
}

// Segmented source picker. Writes chosen value into hidden #qm-source so the
// existing submit handler reads it transparently.
function qmSetSource(value, btn) {
  const hidden = document.getElementById('qm-source');
  if (hidden) hidden.value = value;
  const buttons = document.querySelectorAll('.qm-seg-btn');
  for (let i = 0; i < buttons.length; i++) buttons[i].classList.toggle('on', buttons[i] === btn);
}

// Reset Queue Mode form after submit so user can submit another. Called by the
// "ارسل طلب ثاني" link in the success card.
function qmResetForm() {
  ['qm-event', 'qm-pos', 'qm-url'].forEach(id => {
    const el = document.getElementById(id); if (el) (el).value = '';
  });
  const hidden = document.getElementById('qm-source'); if (hidden) hidden.value = '';
  document.querySelectorAll('.qm-seg-btn').forEach(b => b.classList.remove('on'));
  // Show form again, hide result
  document.querySelectorAll('#queue-mode .form-label, #queue-mode .form-input, #queue-mode .qm-seg, #queue-mode #qm-btn, #queue-mode #qm-bullets, #queue-mode #qm-disclaimer').forEach(el => { el.style.display = ''; });
  const conf = document.getElementById('qm-confirm');
  if (conf) { conf.style.display = 'none'; conf.innerHTML = ''; }
  document.getElementById('qm-event')?.focus();
}

// Build the rich success card (called from queueModeSubmit on 200).
function qmBuildResultCard(eventName, source, queuePos) {
  const tt = T[lang] || T.ar;
  const sourceLabel = source === 'webook' ? 'Webook'
                    : source === 'ticketmaster' ? 'Ticketmaster'
                    : source === 'other' ? (tt.qmSegOther || 'غير ذلك')
                    : (tt.qmSummaryDash || '—');
  const posRow = queuePos ? ''
    + '<div class="qm-result-summary-row"><span>' + (tt.qmSummaryPosition || 'رقم الانتظار') + '</span><strong>' + escapeHtmlClient(queuePos) + '</strong></div>'
    : '';
  return ''
    + '<div class="qm-result-card">'
    +   '<div class="qm-result-title">' + (tt.qmResultTitle || 'تم حفظ طلبك') + '</div>'
    +   '<div class="qm-result-body">' + (tt.qmResultBody || 'SeatX بيراقب أي فرصة رسمية ثانية حول هذا الحدث. إذا ظهر رابط رسمي آخر، دفعة جديدة، باقة مختلفة، أو تغير مهم في التوفر، بننبّهك.') + '</div>'
    +   '<div class="qm-result-summary">'
    +     '<div class="qm-result-summary-row"><span>' + (tt.qmSummaryEvent || 'اسم الحدث') + '</span><strong>' + escapeHtmlClient(eventName) + '</strong></div>'
    +     '<div class="qm-result-summary-row"><span>' + (tt.qmSummarySource || 'المصدر') + '</span><strong>' + escapeHtmlClient(sourceLabel) + '</strong></div>'
    +     posRow
    +     '<div class="qm-result-summary-row"><span>' + (tt.qmSummaryStatus || 'الحالة') + '</span><strong>' + (tt.qmStatusSearching || 'نبحث عن فرصة ثانية') + '</strong></div>'
    +     '<div class="qm-result-summary-row"><span>' + (tt.qmSummaryLast || 'آخر تحديث') + '</span><strong>' + (tt.qmTimeNow || 'الآن') + '</strong></div>'
    +   '</div>'
    +   '<div class="qm-result-watch-title">' + (tt.qmWatchTitle || 'وش نراقب؟') + '</div>'
    +   '<ul class="qm-result-watch-list">'
    +     '<li>· ' + (tt.qmWatchB1 || 'رابط رسمي آخر') + '</li>'
    +     '<li>· ' + (tt.qmWatchB2 || 'دفعة جديدة') + '</li>'
    +     '<li>· ' + (tt.qmWatchB3 || 'باقة مختلفة') + '</li>'
    +     '<li>· ' + (tt.qmWatchB4 || 'تغير مهم في التوفر') + '</li>'
    +   '</ul>'
    +   '<div class="qm-result-disclaimer">' + (tt.qmDisclaimer || 'SeatX لا يتجاوز الكيو، لا يشتري بدالك، ولا يضمن التذاكر.') + '</div>'
    +   '<button class="qm-result-again" type="button" onclick="qmResetForm()">' + (tt.qmAnother || 'إرسال طلب ثاني') + '</button>'
    + '</div>';
}

// Queue Mode submit — logs a request for a SECOND opportunity on the same
// event. We don't claim to jump the queue. Posts to /api/queue-watch.
async function queueModeSubmit() {
  const t = T[lang];
  const email     = document.getElementById('qm-email')?.value?.trim();
  const eventName = document.getElementById('qm-event')?.value?.trim();
  const source    = document.getElementById('qm-source')?.value || '';
  const queuePos  = document.getElementById('qm-pos')?.value?.trim() || '';
  const queueUrl  = document.getElementById('qm-url')?.value?.trim() || '';
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  if (!eventName || eventName.length < 2) { alert(t.qmNeedEvent || 'اكتب اسم الحدث'); return; }
  const btn = document.getElementById('qm-btn');
  const origLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = t.sending || 'جاري الإرسال...'; }
  try {
    const res = await fetch('/api/queue-watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        eventName: eventName,
        source: source || null,
        queuePosition: queuePos || null,
        queueUrl: queueUrl || null,
      }),
    });
    if (!res.ok) throw new Error('submit failed');
    try { localStorage.setItem('seatx_last_email', email); } catch (_) { }
    // Hide the form, show the rich success card with summary + watch list.
    document.querySelectorAll('#queue-mode .form-label, #queue-mode .form-input, #queue-mode .qm-seg, #queue-mode #qm-btn, #queue-mode #qm-bullets, #queue-mode #qm-disclaimer').forEach(el => { el.style.display = 'none'; });
    const conf = document.getElementById('qm-confirm');
    if (conf) {
      conf.innerHTML = qmBuildResultCard(eventName, source, queuePos);
      conf.style.display = 'block';
      conf.style.background = 'transparent';
      conf.style.border = 'none';
      conf.style.padding = '0';
      conf.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (e) {
    alert(t.error || 'حصل خطأ');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origLabel || (t.qmSubmit || 'ابحث عن فرصة ثانية'); }
  }
}

// Entry mode 2 — request an event by name (no link). Posts to
// /api/request-event, then shows a confirmation. Outcome framing only.
async function requestEvent() {
  const t = T[lang];
  const email = document.getElementById('rq-email')?.value?.trim();
  const eventName = document.getElementById('rq-event')?.value?.trim();
  const city = document.getElementById('rq-city')?.value?.trim() || '';
  if (!eventName || eventName.length < 2) { alert(t.rqNeedEvent || 'اكتب اسم الحدث'); return; }
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  const btn = document.getElementById('rq-btn');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = t.sending || 'جاري الإرسال...'; }
  try {
    const r = await fetch('/api/request-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, eventName: eventName, city: city || null }),
    });
    if (!r.ok) throw new Error('failed');
    try { localStorage.setItem('seatx_last_email', email); } catch (_) { }
    tryEnablePush(email);
    // Collapse the form, show confirmation.
    ['rq-l-name','rq-event','rq-l-city','rq-city','rq-l-email','rq-email','rq-btn','rq-note'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const conf = document.getElementById('rq-confirm');
    if (conf) {
      conf.textContent = (t.rqConfirm || 'تمام — سجّلنا طلبك على «{ev}». أول ما تتوفر تذاكره بننبّهك على بريدك.').replace('{ev}', eventName);
      conf.style.display = 'block';
    }
  } catch (e) {
    alert(t.error || 'حصل خطأ');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig || (t.rqBtn || '🔔 نبّهني لما تتوفر التذاكر'); }
  }
}

async function subscribe(id, btnEl) {
  const t = T[lang];
  const email = document.getElementById('em-' + id)?.value?.trim();
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  try {
    const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: id, email }) });
    const data = await r.json();
    if (r.status === 403 && data.upgrade) {
      // Entry tier was retired in the landing pass. Limit hit -> Pro upgrade.
      openUpgradeModal('pro');
      return;
    }
    if (!r.ok) throw new Error(data.message || 'failed');
    tryEnablePush(email);
    if (btnEl) {
      btnEl.textContent = '✅';
      btnEl.style.background = 'rgba(163,230,53,.2)';
      btnEl.style.color = 'var(--lime)';
      btnEl.disabled = true;
      setTimeout(() => {
        btnEl.textContent = T[lang].alertBtn;
        btnEl.style.background = '';
        btnEl.style.color = '';
        btnEl.disabled = false;
      }, 3000);
    }
  } catch (e) {
    alert(t.error);
  }
}

// =============================================================================
// MODALS
// =============================================================================
function closeModal(id) { document.getElementById(id)?.remove(); }

function showEmailPopup(eventId) {
  pendingEventId = eventId || null;
  const t = T[lang];
  closeModal('email-popup');
  const popup = document.createElement('div');
  popup.className = 'modal-overlay';
  popup.id = 'email-popup';
  popup.innerHTML = \`<div class="modal-box">
    <div class="modal-title">\${t.popupTitle}</div>
    <div class="modal-sub">\${t.popupSub}</div>
    <input class="modal-input" id="popup-email" type="email" placeholder="\${t.emailPh}" autocomplete="email"/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="submitPopupEmail()">\${t.popupBtn}</button>
    <button class="modal-skip" onclick="closeModal('email-popup')">\${t.popupSkip}</button>
  </div>\`;
  popup.addEventListener('click', (e) => { if (e.target === popup) closeModal('email-popup'); });
  document.body.appendChild(popup);
  setTimeout(() => { document.getElementById('popup-email')?.focus(); }, 100);
}

async function submitPopupEmail() {
  const t = T[lang];
  const email = document.getElementById('popup-email')?.value?.trim();
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  if (!pendingEventId) { closeModal('email-popup'); return; }
  try {
    await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: pendingEventId, email }) });
    await tryEnablePush(email);
  } catch (_) { }
  closeModal('email-popup');
  location.reload();
}

function openUpgradeModal(plan) {
  const t = T[lang];
  const planLabel = plan === 'entry' ? t.upgradeEntry : plan === 'pro' ? t.upgradePro : t.upgradeLifetime;
  closeModal('upgrade-modal');
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'upgrade-modal';
  m.innerHTML = \`<div class="modal-box">
    <div class="modal-title">\${t.upgradeTitle.replace('{plan}', planLabel)}</div>
    <div class="modal-sub">\${t.upgradeSub}</div>
    <input class="modal-input" id="upgrade-email" type="email" placeholder="\${t.emailPh}" autocomplete="email"/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="submitUpgrade('\${plan}')">\${t.upgradeBtn}</button>
    <button class="modal-skip" onclick="closeModal('upgrade-modal')">\${t.closeBtn}</button>
  </div>\`;
  m.addEventListener('click', (e) => { if (e.target === m) closeModal('upgrade-modal'); });
  document.body.appendChild(m);
  setTimeout(() => { document.getElementById('upgrade-email')?.focus(); }, 100);
}

async function submitUpgrade(plan) {
  const t = T[lang];
  const email = document.getElementById('upgrade-email')?.value?.trim();
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  try {
    await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, plan }) });
  } catch (_) { }
  const box = document.querySelector('#upgrade-modal .modal-box');
  if (box) {
    box.innerHTML = \`<div class="modal-title">\${t.upgradeJoined}</div><button class="modal-skip" onclick="closeModal('upgrade-modal')">\${t.closeBtn}</button>\`;
  }
}

function openShareModal(eventId) {
  const t = T[lang];
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  const url = SHARE_BASE + '/event/' + eventId + (lang === 'ar' ? '?lang=ar' : '');
  const text = t.shareText + ' — ' + (ev.title || '') + ' ' + url;
  closeModal('share-modal');
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'share-modal';
  m.innerHTML = \`<div class="modal-box">
    <div class="modal-title">\${t.shareTitle}</div>
    <div class="modal-sub">\${escapeHtmlClient(ev.title || '')}</div>
    <div class="modal-share-row">
      <a class="modal-share-btn whatsapp" href="https://wa.me/?text=\${encodeURIComponent(text)}" target="_blank" rel="noopener">\${t.shareWA}</a>
      <a class="modal-share-btn twitter" href="https://twitter.com/intent/tweet?text=\${encodeURIComponent(text)}" target="_blank" rel="noopener">\${t.shareTW}</a>
      <button class="modal-share-btn copy" id="share-copy-btn" onclick="copyShareLink('\${url.replace(/'/g, \"\\\\'\")}', this)">\${t.shareCopy}</button>
    </div>
    <button class="modal-skip" onclick="closeModal('share-modal')">\${t.closeBtn}</button>
  </div>\`;
  m.addEventListener('click', (e) => { if (e.target === m) closeModal('share-modal'); });
  document.body.appendChild(m);
}

async function copyShareLink(url, btn) {
  const t = T[lang];
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = t.shareCopied;
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); btn.textContent = t.shareCopied; } catch (_) { }
    ta.remove();
  }
}

function openMyAlerts() {
  const t = T[lang];
  closeModal('my-alerts-modal');
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'my-alerts-modal';
  m.innerHTML = \`<div class="modal-box">
    <div class="modal-title">\${t.myAlertsTitle}</div>
    <div class="modal-sub">\${t.myAlertsSub}</div>
    <input class="modal-input" id="my-alerts-email" type="email" placeholder="\${t.emailPh}" autocomplete="email"/>
    <button class="gbtn" style="width:100%;padding:12px;font-size:14px;border-radius:10px" onclick="loadMyAlerts()">\${t.myAlertsBtn}</button>
    <div id="my-alerts-result"></div>
    <button class="modal-skip" onclick="closeModal('my-alerts-modal')">\${t.closeBtn}</button>
  </div>\`;
  m.addEventListener('click', (e) => { if (e.target === m) closeModal('my-alerts-modal'); });
  document.body.appendChild(m);
  setTimeout(() => { document.getElementById('my-alerts-email')?.focus(); }, 100);
}

async function loadMyAlerts() {
  const t = T[lang];
  const email = document.getElementById('my-alerts-email')?.value?.trim();
  const result = document.getElementById('my-alerts-result');
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  if (!result) return;
  result.innerHTML = '<div style="color:var(--muted2);font-size:12px;padding:12px">...</div>';
  try {
    const r = await fetch('/api/my-alerts?email=' + encodeURIComponent(email));
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'failed');
    const items = data.alerts || [];
    if (items.length === 0) {
      result.innerHTML = \`<div style="color:var(--muted2);font-size:13px;padding:16px 0">\${t.myAlertsEmpty}</div>\`;
      return;
    }
    result.innerHTML = '<div class="modal-alert-list">' + items.map(a =>
      \`<div class="modal-alert-item"><span>\${escapeHtmlClient(a.title)}</span><a href="/event/\${a.event_id}" target="_blank" rel="noopener">→</a></div>\`
    ).join('') + '</div>';
  } catch (e) {
    result.innerHTML = \`<div style="color:#f87171;font-size:12px;padding:12px">\${t.error}</div>\`;
  }
}

// =============================================================================
// PUSH NOTIFICATIONS (FCM)
// =============================================================================
let pushReady = false;
let pushConfig = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-pushsrc="' + src + '"]')) return resolve();
    const sc = document.createElement('script');
    sc.src = src;
    sc.dataset.pushsrc = src;
    sc.onload = () => resolve();
    sc.onerror = reject;
    document.head.appendChild(sc);
  });
}

async function initPush() {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    const r = await fetch('/api/firebase-config');
    const cfg = await r.json();
    if (!cfg || !cfg.apiKey) return;
    pushConfig = cfg;
    await loadScriptOnce('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    await loadScriptOnce('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
    if (typeof firebase === 'undefined') return;
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = firebase.messaging();
    messaging.onMessage(payload => {
      try {
        const tc = document.getElementById('tc');
        if (!tc) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.style.fontFamily = lang === 'ar' ? "'IBM Plex Sans Arabic',sans-serif" : "'DM Sans',sans-serif";
        if (lang === 'ar') el.style.direction = 'rtl';
        const ttl = (payload.notification && payload.notification.title) || 'SeatX';
        const body = (payload.notification && payload.notification.body) || '';
        el.innerHTML = '<div class="toast-icon">⚡</div><div><div class="toast-title">' + escapeHtmlClient(ttl) + '</div><div class="toast-sub">' + escapeHtmlClient(body) + '</div></div><div class="toast-bar" style="animation-duration:6000ms"></div>';
        tc.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
        setTimeout(() => { el.classList.add('off'); el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 6000);
      } catch (_) { }
    });
    pushReady = true;
  } catch (e) {
    console.warn('[push] init failed:', e);
  }
}

// =============================================================================
// ROTATING PLACEHOLDER (Saudi market flavor)
// =============================================================================
var SAUDI_PLACEHOLDERS = {
  ar: [
    'ألصق رابط مباراة الهلال × النصر',
    'ألصق رابط ويبوك',
    'ألصق رابط موسم الرياض',
    'ألصق رابط UFC Riyadh',
    'ألصق رابط حفلة محمد عبده',
    'ألصق رابط فعالية بوليفارد',
  ],
  en: [
    'Paste Al Nassr vs Al Hilal link',
    'Paste webook.com link',
    'Paste Riyadh Season link',
    'Paste UFC Riyadh link',
    'Paste concert link',
  ],
};
var _rotIdx = 0;
var _rotTimer = null;
function _rotatePlaceholder() {
  var el = document.getElementById('qh-url');
  if (!el) return;
  if (el === document.activeElement) return; // don't change while user is typing
  if (el.value) return;
  var arr = SAUDI_PLACEHOLDERS[lang] || SAUDI_PLACEHOLDERS.en;
  el.placeholder = arr[_rotIdx % arr.length];
  _rotIdx++;
}
function startRotatingPlaceholder() {
  if (_rotTimer) { clearInterval(_rotTimer); _rotTimer = null; }
  _rotIdx = 0;
  _rotatePlaceholder();
  _rotTimer = setInterval(_rotatePlaceholder, 3500);
}

async function tryEnablePush(email) {
  if (!pushReady || !pushConfig || !pushConfig.vapidKey) return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (!email || !email.includes('@')) return false;
  try {
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: pushConfig.vapidKey,
      serviceWorkerRegistration: reg,
    });
    if (!token) return false;
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, token: token, userAgent: navigator.userAgent }),
    });
    return true;
  } catch (e) {
    console.warn('[push] enable failed:', e);
    return false;
  }
}

// =============================================================================
// TAB SYSTEM (mobile-first app-like navigation)
// =============================================================================
let activeTab = 'home';

// Empty-state CTA helpers — used by Trending/Watching/Alerts empty cards.
// Switching tab is instant (no animation), so we focus/scroll on a tiny
// timeout to land after the layout settles.
function goHomeAndAddEvent() {
  switchTab('home');
  setTimeout(function() {
    const el = document.getElementById('qh-url');
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { }
      try { el.focus(); } catch (_) { }
    }
  }, 100);
}
function goHomeAndQueueMode() {
  switchTab('home');
  setTimeout(function() {
    const el = document.getElementById('queue-mode');
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { }
    }
  }, 100);
}

function switchTab(name) {
  if (!name) return;
  activeTab = name;
  // Show/hide sections by data-tab
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (el.dataset.tab === name) el.classList.add('active-tab');
    else el.classList.remove('active-tab');
  });
  // Highlight active bnav item (mobile)
  document.querySelectorAll('.bnav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.target === name);
  });
  // Highlight active ntab item (desktop top nav)
  document.querySelectorAll('.ntab').forEach(el => {
    el.classList.toggle('active', el.dataset.target === name);
  });
  // Scroll to top on tab switch (app-like)
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Lazy-load tab data on demand
  if (name === 'alerts') loadAlertsFeed();
  if (name === 'account') renderAccountStatus();
  if (name === 'watching') {
    // Auto-load if we already have a saved email — saves a manual step.
    try {
      var savedEmail = localStorage.getItem('seatx_last_email') || '';
      var watchEmailEl = document.getElementById('watch-email');
      if (savedEmail && watchEmailEl) {
        watchEmailEl.value = savedEmail;
        renderUserAlertsList(savedEmail, 'watch-list', lang);
      }
    } catch (_) { }
  }
  if (name === 'home') {
    // Re-focus the quick-hero input so users can paste immediately
    setTimeout(() => document.getElementById('qh-url')?.focus(), 80);
  }
}

// Render the user's subscribed events into a target container. Each row gets
// two actions: open (the ticket page in a new tab) and stop (DELETE the
// subscription via /api/unsubscribe). The email is encoded into the unstop
// button's onclick so we don't depend on stale closures.
async function renderUserAlertsList(email, targetId, lang) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const tt = T[lang] || T.ar;
  target.innerHTML = '<div style="color:var(--muted2);font-size:13px;text-align:center;padding:14px">' + (tt.loading || 'جاري التحميل...') + '</div>';
  // Three terminal states: EMPTY (200 + [])  vs  HTTP/network FAILURE
  //                       vs  successful render. Each gets its own
  //                       distinguishable copy + appropriate CTAs. We
  //                       previously collapsed all three into one scary
  //                       red "تعذر التحميل" — that hid the empty case.
  let httpResult;
  try {
    httpResult = await fetch('/api/my-alerts?email=' + encodeURIComponent(email));
  } catch (netErr) {
    // Network failure — no HTTP status. Show error state with retry + add.
    target.innerHTML = renderWatchErrorBlock(tt);
    return;
  }
  let data;
  try { data = await httpResult.json(); } catch (_) { data = {}; }
  if (!httpResult.ok) {
    // Server returned 4xx/5xx (e.g., local dev with no DB → 500). Show
    // error state, NOT empty state.
    target.innerHTML = renderWatchErrorBlock(tt);
    return;
  }
  const items = (data && Array.isArray(data.alerts)) ? data.alerts : [];
  if (items.length === 0) {
    target.innerHTML = ''
      + '<div class="afeed-empty">'
      +   '<div style="font-size:32px;opacity:.35;margin-bottom:10px">👁</div>'
      +   '<div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:6px">' + (tt.watchEmptyTitle || 'ما عندك مراقبات بعد') + '</div>'
      +   '<div style="font-size:13px;margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">' + (tt.watchEmptyBody || 'أضف حدث من الرئيسية، وبعدها بتظهر مراقباتك هنا.') + '</div>'
      +   '<button class="gbtn" style="padding:12px 18px;font-size:14px;border-radius:10px;max-width:260px" onclick="goHomeAndAddEvent()">' + (tt.emptyCtaAdd || 'أضف حدث') + '</button>'
      + '</div>';
    return;
  }
  try {
    // Email is NOT inlined into onclick (would force quote-escaping inside the
    // outer SSR template literal — that path produces broken JS, exactly the
    // failure mode we just removed). The handler reads the saved email from
    // localStorage instead. watchLookup() always stores it before this renders.
    target.innerHTML = '<div class="afeed-list">' + items.map(a => {
      const band = a.demand_band || 'low';
      const heat = band === 'very_high' ? '🔥 ملتهب'
                  : band === 'high'     ? '⚡ طلب عالي'
                  : band === 'medium'   ? '👀 يرتفع'
                  : '○ هادي';
      const status = a.status === 'available' ? '⚡ متاح'
                   : a.status === 'maybe_available' ? '👀 ربما' : '○ قيد المراقبة';
      const safeUrl = a.event_url ? escapeHtmlClient(a.event_url) : '#';
      return ''
        + '<div class="watch-row" data-event-id="' + a.event_id + '">'
        +   '<div class="watch-row-main">'
        +     '<div class="watch-row-title">' + escapeHtmlClient(a.title) + '</div>'
        +     '<div class="watch-row-meta">' + status + ' · ' + heat + '</div>'
        +   '</div>'
        +   '<div class="watch-row-actions">'
        +     '<a class="watch-act watch-act-open" href="' + safeUrl + '" target="_blank" rel="noopener" title="فتح صفحة التذاكر" aria-label="فتح صفحة التذاكر">'
        +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>'
        +     '</a>'
        +     '<button class="watch-act watch-act-stop" onclick="unsubscribeFromEvent(' + a.event_id + ', this)" title="إيقاف المتابعة" aria-label="إيقاف المتابعة">'
        +       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>'
        +     '</button>'
        +   '</div>'
        + '</div>';
    }).join('') + '</div>';
  } catch (e) {
    target.innerHTML = renderWatchErrorBlock(tt);
  }
}

// Shared error-state block for the Watching tab. Distinguishes from "empty"
// (handled separately above) by showing two CTAs: retry the lookup, or add
// a new event from Home. Soft amber, not scary red.
function renderWatchErrorBlock(tt) {
  return ''
    + '<div class="afeed-empty" style="padding:32px 16px">'
    +   '<div style="font-size:32px;opacity:.5;margin-bottom:10px">⚠️</div>'
    +   '<div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:6px">' + (tt.watchErrorTitle || 'ما قدرنا نحمّل مراقباتك') + '</div>'
    +   '<div style="font-size:13px;margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">' + (tt.watchErrorBody || 'تأكد من الإيميل أو جرّب مرة ثانية.') + '</div>'
    +   '<div style="display:flex;flex-direction:column;gap:8px;max-width:280px;margin:0 auto">'
    +     '<button class="gbtn" style="padding:12px 16px;font-size:14px;border-radius:10px;width:100%" onclick="watchLookup()">' + (tt.watchErrorRetry || 'جرّب مرة ثانية') + '</button>'
    +     '<button class="obtn" style="padding:11px 16px;font-size:13.5px;border-radius:10px;width:100%" onclick="goHomeAndAddEvent()">' + (tt.emptyCtaAdd || 'أضف حدث جديد') + '</button>'
    +   '</div>'
    + '</div>';
}

async function watchLookup() {
  const t = T[lang];
  const email = document.getElementById('watch-email')?.value?.trim();
  if (!email || !email.includes('@')) { alert(t.invalidEmail); return; }
  try { localStorage.setItem('seatx_last_email', email); } catch (_) { }
  await renderUserAlertsList(email, 'watch-list', lang);
}

// Stop tracking one event. Email is read from localStorage (saved by
// watchLookup before this renders) — avoids the broken inline-quote pattern
// that previously killed the entire <script> block with SyntaxError.
async function unsubscribeFromEvent(eventId, btnEl) {
  let email = '';
  try { email = localStorage.getItem('seatx_last_email') || ''; } catch (_) { }
  if (!email || !email.includes('@')) return;
  // Optimistic UI: dim the row immediately
  const row = btnEl && btnEl.closest && btnEl.closest('.watch-row');
  if (row) { row.style.opacity = '.4'; row.style.pointerEvents = 'none'; }
  try {
    await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: eventId, email: email }),
    });
    await renderUserAlertsList(email, 'watch-list', lang);
  } catch (e) {
    if (row) { row.style.opacity = '1'; row.style.pointerEvents = ''; }
  }
}

// Render the Account tab's notification status block. Reads from
// Notification.permission + localStorage seatx_last_email — no server call.
function renderAccountStatus() {
  const t = T[lang] || {};
  // Push permission status
  const pushText = document.getElementById('acc-notif-push-text');
  const pushDot  = document.getElementById('acc-notif-push-dot');
  if (pushText) {
    if (!('Notification' in window)) {
      pushText.textContent = t.notifPushUnsupported || 'الجهاز لا يدعم تنبيهات الويب';
      if (pushDot) pushDot.style.display = 'none';
    } else if (Notification.permission === 'granted') {
      pushText.textContent = t.notifPushOn || '✓ تنبيهات لحظية مفعّلة';
      if (pushDot) pushDot.style.display = 'inline-flex';
    } else if (Notification.permission === 'denied') {
      pushText.textContent = t.notifPushBlocked || '○ تنبيهات الويب محجوبة من المتصفح';
      if (pushDot) pushDot.style.display = 'none';
    } else {
      pushText.textContent = t.notifPushOff || '○ تنبيهات الويب غير مفعّلة بعد';
      if (pushDot) pushDot.style.display = 'none';
    }
  }
  // Email status (from localStorage)
  const emailText = document.getElementById('acc-notif-email-text');
  let savedEmail = '';
  try { savedEmail = localStorage.getItem('seatx_last_email') || ''; } catch (_) { }
  if (emailText) {
    if (savedEmail) {
      emailText.textContent = (t.notifEmailOn || '📧 ') + savedEmail;
    } else {
      emailText.textContent = t.notifEmailOff || '○ ما اتسجّل بريد بعد';
    }
  }
}

// Re-pull the alerts feed when the Alerts tab is opened or refresh tapped.
// Filters out 'metadata_updated' — that's housekeeping noise, not a market
// movement. Alerts tab shows ONLY: status_change, alert_sent, watcher_added.
async function loadAlertsFeed() {
  const target = document.getElementById('alerts-list');
  if (!target) return;
  try {
    const r = await fetch('/api/feed');
    const data = await r.json();
    const items = (data.logs || [])
      .filter(f => f.type === 'status_change' || f.type === 'alert_sent' || f.type === 'watcher_added' || f.type === 'availability_detected' || f.type === 'demand_spike')
      .slice(0, 30);
    if (items.length === 0) {
      const tt = T[lang] || T.ar;
      target.innerHTML = ''
        + '<div class="afeed-empty">'
        +   '<div style="font-size:36px;opacity:.35;margin-bottom:10px">🔔</div>'
        +   '<div style="color:#fff;font-weight:700;font-size:15px;margin-bottom:6px">' + (tt.alertsEmptyTitle || 'ما فيه تنبيهات حتى الآن') + '</div>'
        +   '<div style="margin-bottom:18px;max-width:380px;margin-left:auto;margin-right:auto">' + (tt.alertsEmptyBody || 'إذا رجعت مقاعد أو ظهرت فرصة على حدث تتابعه، بنعرض التنبيه هنا.') + '</div>'
        +   '<button class="gbtn" style="padding:12px 18px;font-size:14px;border-radius:10px;max-width:260px" onclick="goHomeAndAddEvent()">' + (tt.emptyCtaAdd || 'أضف حدث للمتابعة') + '</button>'
        + '</div>';
      return;
    }
    target.innerHTML = items.map(f => {
      const cls = f.type === 'alert_sent' ? 'afeed-item afeed-alert'
                : f.type === 'status_change' ? 'afeed-item afeed-hot'
                : 'afeed-item';
      const t2 = new Date(f.createdAt);
      const time = String(t2.getHours()).padStart(2, '0') + ':' + String(t2.getMinutes()).padStart(2, '0');
      return '<div class="' + cls + '"><div class="afeed-msg">' + escapeHtmlClient(f.message || '') + '</div><div class="afeed-time">' + time + '</div></div>';
    }).join('');
  } catch (e) { /* keep last state */ }
}

// Restore previously-used email so the watching/account tabs feel personal.
function prefillSavedEmail() {
  try {
    const e = localStorage.getItem('seatx_last_email');
    if (!e) return;
    const w = document.getElementById('watch-email');
    const a = document.getElementById('acc-email');
    if (w) w.value = e;
    if (a) a.value = e;
  } catch (_) { }
}

document.addEventListener('DOMContentLoaded', () => {
  // Arabic-first: load AR by default. User can toggle EN via the nav switch.
  setLang('ar');
  initTimers();
  animateScoreBars();
  startRotatingPlaceholder();
  prefillSavedEmail();
  // Initial tab = home. switchTab also handles the .active-tab class set we
  // ship in the static HTML (everything tagged data-tab="home" already has
  // .active-tab), so this is a no-op on first paint but keeps state aligned.
  switchTab('home');
  initPush();
});
</script>
</body>
</html>`;
}

// =============================================================================
// EVENT DETAIL PAGE
// =============================================================================
function getEventHTML(e: any, lang: 'en' | 'ar'): string {
  const isAr = lang === 'ar';
  const band = e.demand_band || 'low';
  const demandColor = getDemandColor(band);
  const demandLabel = getDemandLabel(band, lang);
  const statusLabel = e.status === 'available'
    ? (isAr ? '⚡ متاح' : '⚡ Available')
    : e.status === 'maybe_available'
      ? (isAr ? '👀 ربما متاح' : '👀 Maybe Available')
      : (isAr ? '○ قيد المراقبة' : '○ Monitoring');
  const safeTitle = escapeHtml(e.title || '');
  const watchersLabel = isAr ? 'يتابعون' : 'watching';
  const demandPrefix = isAr ? 'الطلب:' : 'Demand:';
  const ctaText = isAr ? 'تنبيه عند توفر المقاعد ←' : 'Get alerted when seats appear →';
  const subText = isAr ? 'مجاني · بدون حساب · تنبيهات فورية' : 'Free · No account needed · Real-time alerts';
  const shareWA = isAr ? 'واتساب' : 'WhatsApp';
  const shareTW = isAr ? 'تويتر' : 'X / Twitter';
  const shareCopy = isAr ? 'نسخ الرابط' : 'Copy link';
  const shareCopied = isAr ? '✓ تم النسخ!' : '✓ Copied!';
  const homeUrl = process.env.PUBLIC_BASE_URL || 'https://seatx-production.up.railway.app';
  const eventUrl = `${homeUrl}/event/${e.id}` + (isAr ? '?lang=ar' : '');
  const shareText = isAr
    ? `شيك على هذا في SeatX — ${e.title} ${eventUrl}`
    : `Check this on SeatX — ${e.title} ${eventUrl}`;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle} — SeatX</title>
<meta property="og:title" content="${safeTitle} — SeatX"/>
<meta property="og:description" content="${e.watchers_count || 0} ${watchersLabel}. ${demandLabel}"/>
${e.hero_image ? `<meta property="og:image" content="${escapeHtml(e.hero_image)}"/>` : ''}
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080a0e;color:#f4f4f5;font-family:${isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'DM Sans',sans-serif"};min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
.card{position:relative;background:#0d1018;border:1px solid rgba(255,255,255,.07);border-radius:24px;max-width:480px;width:100%;overflow:hidden}
.card-img{height:200px;background:linear-gradient(135deg,#0d1117,#1a1f2e);display:flex;align-items:center;justify-content:center;position:relative}
.card-img img{width:100%;height:100%;object-fit:cover}
.card-body{padding:24px}
.brand{font-size:11px;font-weight:700;color:#a3e635;letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px}
.title{font-size:24px;font-weight:900;color:#fff;margin-bottom:8px;line-height:1.2}
.status{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#a1a1aa;margin-bottom:16px}
.meta{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.meta-item{font-size:13px;color:#71717a}
.meta-item strong{color:#fff;font-weight:700}
.cta{display:block;background:#a3e635;color:#000;font-weight:800;font-size:15px;padding:14px;border-radius:12px;text-align:center;text-decoration:none;margin-bottom:12px}
.cta:hover{background:#bef264}
.sub{font-size:12px;color:#52525b;text-align:center}
.share-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.share-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;border:none;cursor:pointer;flex:1;font-family:inherit}
.share-btn.whatsapp{background:#25d366;color:#000}
.share-btn.twitter{background:#000;color:#fff;border:1px solid rgba(255,255,255,.15)}
.share-btn.copy{background:rgba(255,255,255,.08);color:#fff}
</style>
</head>
<body>
<div class="card">
  ${e.hero_image
      ? `<div class="card-img"><img src="${escapeHtml(e.hero_image)}" alt="${safeTitle}"/></div>`
      : `<div class="card-img"><div style="text-align:center"><div style="font-size:12px;font-weight:700;color:rgba(163,230,53,.6);letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px">LIVE EVENT</div><div style="font-size:18px;font-weight:800;color:#fff">${safeTitle}</div></div></div>`}
  <div class="card-body">
    <div class="brand">SEATX · ${isAr ? 'ذكاء سوق المقاعد' : 'Live Intelligence'}</div>
    <div class="title">${safeTitle}</div>
    <div class="status">${statusLabel}</div>
    <div class="meta">
      <div class="meta-item">👥 <strong>${e.watchers_count || 0}</strong> ${watchersLabel}</div>
      <div class="meta-item">📊 ${demandPrefix} <strong style="color:${demandColor}">${demandLabel}</strong></div>
    </div>
    ${e.event_date ? `<div class="meta-item" style="margin-bottom:12px">📅 ${escapeHtml(e.event_date)}</div>` : ''}
    ${e.location ? `<div class="meta-item" style="margin-bottom:16px">📍 ${escapeHtml(e.location)}</div>` : ''}
    <a class="cta" href="${homeUrl}">${ctaText}</a>
    <div class="share-row">
      <a class="share-btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${shareWA}</a>
      <a class="share-btn twitter" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${shareTW}</a>
      <button class="share-btn copy" onclick="navigator.clipboard.writeText(window.location.href).then(()=>this.textContent='${shareCopied}')">${shareCopy}</button>
    </div>
    <div class="sub">${subText}</div>
  </div>
</div>
</body>
</html>`;
}

// =============================================================================
// ROUTES
// =============================================================================
app.get('/', async (_req: Request, res: Response) => {
  let events: any[] = [];
  let feed: any[] = [];
  let alerts24h = 0;
  try {
    const r = await pool.query('SELECT * FROM events ORDER BY demand_score DESC, created_at DESC');
    events = r.rows;
  } catch (_) { }
  try {
    feed = await getActivityFeed(20);
  } catch (_) { }
  try {
    // Real DB stat for the "why now" section. No fake numbers.
    const a = await pool.query(
      `SELECT COUNT(*) AS c FROM activity_logs
       WHERE type IN ('alert_sent','status_change')
         AND created_at > NOW() - INTERVAL '24 hours'`
    );
    alerts24h = parseInt(a.rows[0]?.c || '0', 10) || 0;
  } catch (_) { }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(getHTML(events, feed, alerts24h));
});

app.post('/api/events', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('ev:' + getIP(req), 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests' });
    }
    const { title, eventUrl } = req.body || {};
    if (!isValidTitle(title)) {
      return res.status(400).json({ error: 'invalid_title', message: 'Title must be 1-200 characters' });
    }
    // Normalize first — prepend https:// when missing so a pasted
    // "webook.com/..." is accepted instead of falsely rejected.
    const normUrl = normalizeUrl(eventUrl);
    if (!normUrl) {
      return res.status(400).json({ error: 'invalid_url', message: 'أدخل رابطًا صحيحًا للحدث' });
    }
    // Domain allowlist — only accept events from known ticket vendors.
    // Anything else is rejected here (kills fake-event spam + outbound SSRF).
    if (!isAllowedTicketDomain(normUrl)) {
      let blockedHost = '';
      try { blockedHost = new URL(normUrl).hostname; } catch { }
      console.warn('[abuse] /api/events disallowed domain:', getIP(req), blockedHost);
      return res.status(400).json({
        error: 'unsupported_domain',
        message: 'هذا المصدر غير مدعوم. ندعم حاليًا: webook.com، ticketmaster.sa/com، platinumlist.net، إلخ.',
      });
    }
    const r = await pool.query(
      'INSERT INTO events (title, event_url) VALUES ($1, $2) RETURNING *',
      [title.trim(), normUrl]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.post('/api/subscribe', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('sub:' + getIP(req), 20, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests' });
    }
    const { eventId, email } = req.body || {};
    const idNum = parseInt(String(eventId), 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'invalid_event_id' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email' });
    }
    // Per-email rate limit (second tier — IP-only doesn't help if attacker has
    // proxies but is targeting one victim email).
    if (!rateLimit('sub-email:' + hashEmail(email), 5, 60_000)) {
      console.warn('[abuse] /api/subscribe per-email rate hit:', getIP(req), hashEmail(email));
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests for this email' });
    }

    // Already subscribed to this exact event? idempotent success.
    const existing = await pool.query(
      'SELECT id FROM subscriptions WHERE event_id=$1 AND email=$2',
      [idNum, email]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return res.json({ success: true, alreadySubscribed: true });
    }

    // Free plan: 1 active event per email. pending/error do not count.
    const activeCount = await getActiveEventCount(email);
    if (activeCount >= 1) {
      return res.status(403).json({
        error: 'limit_reached',
        message: 'Free plan: 1 active event. Upgrade for more.',
        upgrade: true,
      });
    }

    const ins = await pool.query(
      `INSERT INTO subscriptions (event_id, email, monitoring_status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (event_id, email) DO NOTHING
       RETURNING id`,
      [idNum, email]
    );
    const inserted = (ins.rowCount ?? 0) > 0;
    if (inserted) {
      await pool.query('UPDATE events SET watchers_count = watchers_count + 1 WHERE id = $1', [idNum]);
      try {
        const ev = await pool.query('SELECT title FROM events WHERE id=$1', [idNum]);
        if (ev.rows[0]) {
          await logActivity(idNum, 'watcher_added', `👥 ${ev.rows[0].title} — متابع جديد انضم للسوق`);
        }
      } catch (_) { }
    }
    res.json({ success: true, inserted });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.get('/api/my-alerts', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('mya:' + getIP(req), 10, 60_000)) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    const email = String(req.query.email || '');
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    // Per-email rate limit — slows watchlist enumeration if an attacker
    // discovers a target email (10 lookups / hour / email is plenty for
    // normal users who refresh the page).
    const eh = hashEmail(email);
    if (!rateLimit('mya-email:' + eh, 10, 3600_000)) {
      console.warn('[abuse] /api/my-alerts per-email rate hit:', getIP(req), eh);
      return res.status(429).json({ error: 'rate_limit', message: 'Too many lookups for this email' });
    }
    // Hashed access log — useful for spotting abuse patterns later without
    // leaking real emails to logs.
    console.log('[my-alerts] access:', getIP(req), eh);
    const r = await pool.query(
      `SELECT s.event_id, s.monitoring_status, s.created_at, e.title, e.status, e.demand_band, e.event_url
       FROM subscriptions s
       JOIN events e ON e.id = s.event_id
       WHERE s.email = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [email]
    );
    res.json({ alerts: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Stop tracking — used from the Watching tab's per-row إيقاف button.
// Deletes the subscription row + decrements watchers_count atomically.
app.post('/api/unsubscribe', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('unsub:' + getIP(req), 20, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests' });
    }
    const { eventId, email } = req.body || {};
    const idNum = parseInt(String(eventId), 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'invalid_event_id' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    // Per-email second-tier limit (mirrors /api/subscribe per security commit
    // 0e95473). Prevents subscribe↔unsubscribe spam cycles against a victim
    // email from rotating proxies.
    if (!rateLimit('unsub-email:' + hashEmail(email), 5, 60_000)) {
      console.warn('[abuse] /api/unsubscribe per-email rate hit:', getIP(req), hashEmail(email));
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests for this email' });
    }
    const del = await pool.query(
      'DELETE FROM subscriptions WHERE event_id=$1 AND email=$2 RETURNING id',
      [idNum, email]
    );
    const removed = (del.rowCount ?? 0) > 0;
    if (removed) {
      await pool.query(
        'UPDATE events SET watchers_count = GREATEST(watchers_count - 1, 0) WHERE id = $1',
        [idNum]
      );
    }
    res.json({ success: true, removed });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Queue Mode submission — user is stuck in someone else's waiting room and
// wants us to watch for a SECOND opportunity on the same event. We do NOT
// claim to jump the queue, buy on their behalf, or guarantee tickets — the
// customer-facing copy makes this explicit. We just log the request so we
// can surface a related opportunity if/when one appears.
// Entry mode 2 — user has an event in mind but NO link. They give us the
// event name + email; we find/monitor the official tickets and alert them.
// Honest framing: we don't promise instant results, we promise an alert.
app.post('/api/request-event', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('req:' + getIP(req), 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests' });
    }
    const { email, eventName, city } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!rateLimit('req-email:' + hashEmail(email), 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests for this email' });
    }
    if (typeof eventName !== 'string' || eventName.trim().length < 2 || eventName.length > 200) {
      return res.status(400).json({ error: 'invalid_event_name' });
    }
    const cityStr = (typeof city === 'string' && city.trim()) ? city.trim().slice(0, 60) : null;
    await pool.query(
      `INSERT INTO event_requests (email, event_name, city, status) VALUES ($1, $2, $3, 'pending')`,
      [email, eventName.trim(), cityStr]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.post('/api/queue-watch', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('qw:' + getIP(req), 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests' });
    }
    const { email, eventName, source, queuePosition, queueUrl } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    // Per-email second-tier limit (same pattern as subscribe/unsubscribe).
    if (!rateLimit('qw-email:' + hashEmail(email), 5, 60_000)) {
      console.warn('[abuse] /api/queue-watch per-email rate hit:', getIP(req), hashEmail(email));
      return res.status(429).json({ error: 'rate_limit', message: 'Too many requests for this email' });
    }
    if (typeof eventName !== 'string' || eventName.trim().length < 2 || eventName.length > 200) {
      return res.status(400).json({ error: 'invalid_event_name' });
    }
    const src = typeof source === 'string' ? source.trim().slice(0, 40) : null;
    const pos = typeof queuePosition === 'string' && queuePosition.trim() ? queuePosition.trim().slice(0, 40) : null;
    const qUrl = typeof queueUrl === 'string' && queueUrl.trim()
      ? (isValidUrl(queueUrl) ? queueUrl.trim() : null)
      : null;
    await pool.query(
      `INSERT INTO queue_watch (email, event_name, source, queue_position, queue_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, eventName.trim(), src, pos, qUrl]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.post('/api/waitlist', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('wl:' + getIP(req), 5, 60_000)) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    const { email, plan } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    const planStr = String(plan || '');
    if (!['entry', 'pro', 'lifetime'].includes(planStr)) {
      return res.status(400).json({ error: 'invalid_plan' });
    }
    await pool.query(
      `INSERT INTO waitlist (email, plan) VALUES ($1, $2) ON CONFLICT (email, plan) DO NOTHING`,
      [email, planStr]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.get('/api/feed', async (req: Request, res: Response) => {
  // Public + polled by every connected client every 8s. Rate limit per IP
  // (60/min = ~1/s, well above the 8s poll rate but blocks abuse bots).
  if (!rateLimit('feed:' + getIP(req), 60, 60_000)) {
    return res.status(429).json({ error: 'rate_limit' });
  }
  try {
    const feed = await getActivityFeed(20);
    res.json({ logs: feed });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.get('/api/events', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT * FROM events ORDER BY demand_score DESC, created_at DESC');
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// =============================================================================
// PUSH NOTIFICATIONS — endpoints + service worker
// =============================================================================
app.get('/api/firebase-config', (_req: Request, res: Response) => {
  // Returns public Firebase config (apiKey is safe to expose — restrict by domain in Firebase console).
  // Returns empty object if not configured, so client gracefully skips push.
  const cfg = getPublicConfig();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(cfg);
});

app.post('/api/push-subscribe', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('psub:' + getIP(req), 20, 60_000)) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    const { email, token, userAgent } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
      return res.status(400).json({ error: 'invalid_token' });
    }
    const ua = typeof userAgent === 'string' ? userAgent.slice(0, 500) : null;
    await pool.query(
      `INSERT INTO push_subscriptions (email, token, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET
         email = EXCLUDED.email,
         user_agent = COALESCE(EXCLUDED.user_agent, push_subscriptions.user_agent),
         last_used_at = NOW()`,
      [email, token, ua]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.post('/api/push-unsubscribe', async (req: Request, res: Response) => {
  try {
    if (!rateLimit('punsub:' + getIP(req), 20, 60_000)) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    const { token } = req.body || {};
    if (typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ error: 'invalid_token' });
    }
    await pool.query('DELETE FROM push_subscriptions WHERE token=$1', [token]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.get('/firebase-messaging-sw.js', (_req: Request, res: Response) => {
  const cfg = getPublicConfig();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Service-Worker-Allowed', '/');
  if (!cfg.apiKey) {
    // No config — serve a no-op SW so registration doesn't 404
    res.end(`// SeatX: Firebase not configured. Push disabled.\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => self.clients.claim());\n`);
    return;
  }
  const sw = `importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: ${JSON.stringify(cfg.apiKey)},
  authDomain: ${JSON.stringify(cfg.authDomain)},
  projectId: ${JSON.stringify(cfg.projectId)},
  messagingSenderId: ${JSON.stringify(cfg.messagingSenderId)},
  appId: ${JSON.stringify(cfg.appId)}
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(function(payload) {
  var title = (payload.notification && payload.notification.title) || 'SeatX';
  var options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    requireInteraction: true,
    tag: (payload.data && payload.data.eventId) ? 'seatx-' + payload.data.eventId : 'seatx'
  };
  return self.registration.showNotification(title, options);
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(function(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url === url && 'focus' in list[i]) return list[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(self.clients.claim()); });
`;
  res.end(sw);
});

app.get('/event/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).send('Invalid event id');
    const r = await pool.query('SELECT * FROM events WHERE id=$1', [id]);
    if (!r.rows[0]) return res.status(404).send('Event not found');
    const lang: 'en' | 'ar' = req.query.lang === 'ar' ? 'ar' : 'en';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getEventHTML(r.rows[0], lang));
  } catch (_) {
    res.status(500).send('Error');
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, async () => {
  console.log(`SeatX running on port ${PORT}`);
  // setupDB is best-effort. If Postgres is unreachable (e.g., local dev
  // without DATABASE_URL set), log and continue — the server still boots
  // and serves the UI. Routes that touch the DB already swallow query
  // failures and degrade to empty-state UI.
  try {
    await setupDB();
  } catch (e: any) {
    console.warn('[startup] setupDB skipped (Postgres unreachable):', e?.message || String(e));
    console.warn('[startup] UI will render with empty data; routes hitting the DB will return empty/error.');
  }
  // Monitor cycle is also DB-dependent — only start it if setupDB succeeded.
  // Otherwise we'd spam the console with reconnect errors every 15s.
  if (process.env.DATABASE_URL) {
    setTimeout(async () => {
      try { await runMonitorCycle(); } catch (e) { console.error('[monitor] cycle error:', e); }
      setInterval(() => { runMonitorCycle().catch(e => console.error('[monitor]', e)); }, 15000);
    }, 5000);
  } else {
    console.warn('[startup] DATABASE_URL not set — monitor cycle disabled for this run.');
  }
});
