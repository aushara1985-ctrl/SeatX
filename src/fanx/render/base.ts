// FanX shared SSR layout — head, RTL body wrap, shared CSS.
// Uses the SeatX palette + typography verbatim (docs/design.md §2/§4).
// Defines minimal extra classes specific to FanX cards.

export function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(s: string | null | undefined): string {
  return escapeHtml(s).replace(/\n/g, ' ').replace(/\r/g, ' ');
}

export interface PageOptions {
  title: string;
  active_tab?: 'radar' | 'match' | 'city' | 'alerts' | 'pricing' | 'landing' | 'shareable';
  hide_chrome?: boolean;
}

export function renderPage(opts: PageOptions, body: string, extraHead = ''): string {
  const title = escapeHtml(opts.title);
  const tab = opts.active_tab ?? 'landing';
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${title} · FanX by SeatX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=DM+Sans:wght@400;500;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style>
${extraHead}
</head>
<body data-tab="${tab}">
${opts.hide_chrome ? '' : renderHeader(tab)}
<main class="fanx-main">${body}</main>
${opts.hide_chrome ? '' : renderFooter()}
</body>
</html>`;
}

function renderHeader(tab: string): string {
  const navItem = (name: string, href: string, label: string) =>
    `<a class="fanx-nav-item${tab === name ? ' is-active' : ''}" href="${escapeAttr(href)}">${escapeHtml(label)}</a>`;
  return `
<header class="fanx-header">
  <a class="fanx-brand" href="/fanx">
    <span class="fanx-brand-mark">FAN<span>X</span></span>
    <span class="fanx-brand-sub">by SeatX</span>
  </a>
  <nav class="fanx-nav" aria-label="FanX">
    ${navItem('radar',   '/fanx/radar',   'الرادار')}
    ${navItem('alerts',  '/fanx/alerts',  'التنبيهات')}
    ${navItem('pricing', '/fanx/pricing', 'الأسعار')}
  </nav>
</header>`;
}

function renderFooter(): string {
  return `
<footer class="fanx-footer">
  <div class="fanx-footer-disclaimer">FanX by SeatX · لا نبيع التذاكر ولا نضمنها · المصادر الرسمية هي المرجع.</div>
</footer>`;
}

// CSS — tied to SeatX docs/design.md palette + typography. No new tokens
// introduced. Mobile-first, breakpoints at 600/960px.
const BASE_CSS = `
:root{
  --bg:#080a0e; --bg-elev:#0d1018; --bg-surf:#121620;
  --accent:#a3e635;
  --text:#f4f4f5; --text-2:#a1a1aa; --text-3:#71717a; --text-mute:#52525b;
  --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.12);
  --risk-high:#ef4444; --risk-med:#f97316; --risk-low:#22c55e;
  --r:14px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
  font-family:'IBM Plex Sans Arabic','DM Sans',system-ui,sans-serif;
  font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}
img,svg{display:block;max-width:100%}

/* HEADER */
.fanx-header{position:sticky;top:0;z-index:50;display:flex;align-items:center;
  justify-content:space-between;gap:16px;padding:14px 20px;background:rgba(8,10,14,.92);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.fanx-brand{display:flex;align-items:baseline;gap:8px}
.fanx-brand-mark{font-family:'DM Sans',sans-serif;font-weight:900;font-size:22px;letter-spacing:.02em;color:var(--text)}
.fanx-brand-mark span{color:var(--accent)}
.fanx-brand-sub{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;
  color:var(--text-3);letter-spacing:.12em;text-transform:uppercase}
.fanx-nav{display:flex;gap:18px}
.fanx-nav-item{font-size:13px;font-weight:600;color:var(--text-2);padding:6px 2px;border-bottom:2px solid transparent}
.fanx-nav-item.is-active{color:var(--accent);border-bottom-color:var(--accent)}

/* MAIN */
.fanx-main{max-width:1240px;margin:0 auto;padding:24px 20px 96px}

/* CARD */
.fx-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--r);padding:18px}
.fx-card + .fx-card{margin-top:14px}
.fx-card h3{margin:0 0 4px;font-size:15px;font-weight:700;color:var(--text)}
.fx-card .fx-card-sub{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:14px}
.fx-card .fx-card-body{font-size:13.5px;line-height:1.7;color:var(--text-2);margin-bottom:14px}
.fx-card .fx-card-meta{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-3);margin-top:4px}

/* OPP LIST */
.fx-list{display:grid;gap:10px}
.fx-list-item{background:var(--bg-surf);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.fx-list-item .ttl{font-size:13.5px;font-weight:600;color:var(--text);margin-bottom:4px}
.fx-list-item .meta{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--text-3);margin-bottom:6px}
.fx-list-item .desc{font-size:12.5px;color:var(--text-2);line-height:1.6}

/* CTA BUTTONS */
.fx-cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:44px;padding:0 18px;border-radius:10px;background:var(--accent);color:#000;
  font-size:13.5px;font-weight:700;border:none}
.fx-cta-ghost{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-height:44px;padding:0 18px;border-radius:10px;background:transparent;
  color:var(--text);border:1px solid var(--border-2);font-size:13.5px;font-weight:600}
.fx-cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}

/* BEST MOVE HERO */
.fx-best{background:linear-gradient(180deg,rgba(163,230,53,.06),rgba(163,230,53,0) 70%),var(--bg-elev);
  border:1px solid rgba(163,230,53,.25);border-radius:16px;padding:22px}
.fx-best .label{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;
  color:var(--accent);letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
.fx-best h2{margin:0 0 8px;font-size:20px;line-height:1.4;font-weight:800;color:var(--text)}
.fx-best .body{font-size:14px;color:var(--text-2);line-height:1.7;margin-bottom:14px}
.fx-best .explain{font-size:12.5px;color:var(--text-3);margin-top:10px}

/* DASHBOARD GRID */
.fx-grid{display:grid;gap:14px;grid-template-columns:1fr}
.fx-aside{display:grid;gap:14px}
@media (min-width:960px){
  .fx-layout{display:grid;grid-template-columns:1fr 320px;gap:18px}
  .fx-grid{grid-template-columns:1fr 1fr}
}

/* STADIUM PANEL */
.fx-stadium{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--r);padding:16px}
.fx-stadium .demo{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;
  color:var(--text-3);letter-spacing:.12em;text-transform:uppercase}
.fx-stadium svg{width:100%;height:auto;margin:10px 0}
.fx-stadium .zones{display:grid;gap:6px;font-size:12.5px}
.fx-stadium .zones .row{display:flex;justify-content:space-between;gap:8px;color:var(--text-2)}
.fx-stadium .zones .row .name{color:var(--text)}

/* FORMS */
.fx-input,.fx-select{display:block;width:100%;min-height:48px;padding:12px 14px;
  background:var(--bg-surf);color:var(--text);border:1px solid var(--border-2);
  border-radius:10px;font-size:16px}
.fx-label{display:block;font-size:11px;font-weight:700;color:var(--text-3);
  letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;font-family:'IBM Plex Mono',monospace}
.fx-field{margin-bottom:14px}
.fx-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px;background:var(--bg-surf);border:1px solid var(--border);border-radius:10px;margin-bottom:10px}
.fx-toggle .lbl{font-size:13.5px;font-weight:600;color:var(--text)}
.fx-toggle input{transform:scale(1.3)}

/* MODAL */
.fx-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);
  z-index:90;display:flex;align-items:center;justify-content:center;padding:16px}
.fx-modal{background:var(--bg-elev);border:1px solid var(--border-2);border-radius:18px;
  padding:24px;max-width:480px;width:100%;max-height:90vh;overflow:auto}
.fx-modal h2{margin:0 0 4px;font-size:22px;font-weight:800}
.fx-modal .sub{font-size:13.5px;color:var(--text-2);margin-bottom:16px}
.fx-pill-row{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-bottom:16px}
.fx-pill{display:flex;align-items:center;justify-content:center;min-height:48px;padding:0 14px;
  border:1px solid var(--border-2);border-radius:10px;background:var(--bg-surf);color:var(--text);
  font-size:13px;font-weight:600;cursor:pointer}
.fx-pill.is-on{background:rgba(163,230,53,.1);border-color:var(--accent);color:var(--accent)}
@media (max-width:600px){
  .fx-modal{max-width:100%;border-radius:18px 18px 0 0;align-self:flex-end;max-height:95vh}
  .fx-modal-backdrop{align-items:flex-end;padding:0}
}

/* FOOTER */
.fanx-footer{margin-top:48px;padding:24px 20px;border-top:1px solid var(--border);background:var(--bg-elev)}
.fanx-footer-disclaimer{max-width:1240px;margin:0 auto;font-size:12px;color:var(--text-3);text-align:center;line-height:1.7}

/* PRICING */
.fx-tiers{display:grid;gap:14px;grid-template-columns:1fr}
@media (min-width:960px){ .fx-tiers{grid-template-columns:repeat(4,1fr)} }
.fx-tier{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--r);padding:18px}
.fx-tier.is-featured{border-color:rgba(163,230,53,.4);background:linear-gradient(180deg,rgba(163,230,53,.06),rgba(163,230,53,0) 70%),var(--bg-elev)}
.fx-tier h3{font-size:16px;font-weight:800;margin:0 0 4px}
.fx-tier .price{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-3);margin-bottom:10px}
.fx-tier ul{margin:0;padding-right:18px;font-size:13px;color:var(--text-2);line-height:1.8}
.fx-tier ul li{margin-bottom:4px}
.fx-tier .fx-cta{margin-top:14px;width:100%}

/* MISC */
.fx-section-title{font-size:13px;font-weight:700;color:var(--text-3);letter-spacing:.12em;
  text-transform:uppercase;font-family:'IBM Plex Mono',monospace;margin:18px 0 10px}
.fx-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:600;
  font-family:'IBM Plex Mono',monospace;background:var(--bg-surf);color:var(--text-3);
  border:1px solid var(--border);margin-inline-end:6px}
.fx-tag.is-warn{color:var(--risk-high);border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.08)}
.fx-tag.is-ok{color:var(--accent);border-color:rgba(163,230,53,.3);background:rgba(163,230,53,.08)}
`;
