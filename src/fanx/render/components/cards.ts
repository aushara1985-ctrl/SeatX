// FanX dashboard card renderers. Each takes a DashboardCard from the
// agent's generate_radar_response and returns an HTML string. No client
// JS in here — interactivity is wired by the page templates.

import { escapeHtml, escapeAttr } from '../base';
import type { DashboardCard, StadiumPanelData } from '../../agent/skills/generate-radar-response';

function renderCtaRow(card: DashboardCard): string {
  const parts: string[] = [];
  if (card.primary_cta) {
    parts.push(card.primary_cta.href
      ? `<a class="fx-cta" href="${escapeAttr(card.primary_cta.href)}">${escapeHtml(card.primary_cta.label)}</a>`
      : `<button type="button" class="fx-cta" data-card-action="${escapeAttr(card.kind)}">${escapeHtml(card.primary_cta.label)}</button>`);
  }
  if (card.secondary_cta) {
    parts.push(card.secondary_cta.href
      ? `<a class="fx-cta-ghost" href="${escapeAttr(card.secondary_cta.href)}">${escapeHtml(card.secondary_cta.label)}</a>`
      : `<button type="button" class="fx-cta-ghost" data-card-explain="${escapeAttr(card.kind)}">${escapeHtml(card.secondary_cta.label)}</button>`);
  }
  return parts.length ? `<div class="fx-cta-row">${parts.join('')}</div>` : '';
}

function renderItems(card: DashboardCard): string {
  if (!card.items || card.items.length === 0) return '';
  return `<div class="fx-list">${card.items.map(it => `
    <div class="fx-list-item">
      <div class="ttl">${escapeHtml(it.title)}</div>
      ${it.meta ? `<div class="meta">${escapeHtml(it.meta)}</div>` : ''}
      ${it.description ? `<div class="desc">${escapeHtml(it.description)}</div>` : ''}
      ${it.href ? `<div class="fx-cta-row"><a class="fx-cta-ghost" href="${escapeAttr(it.href)}" rel="noopener noreferrer">افتح المصدر</a></div>` : ''}
    </div>
  `).join('')}</div>`;
}

export function renderBestMove(card: DashboardCard, explanation: string): string {
  return `
<section class="fx-best">
  <div class="label">${escapeHtml(card.subtitle ?? 'أفضل حركة اليوم')}</div>
  <h2>${escapeHtml(card.title)}</h2>
  <div class="body">${escapeHtml(card.body ?? '')}</div>
  ${renderCtaRow(card)}
  ${explanation ? `<div class="explain">${escapeHtml(explanation)}</div>` : ''}
</section>`;
}

export function renderCard(card: DashboardCard): string {
  return `
<article class="fx-card" data-card-kind="${escapeAttr(card.kind)}">
  <h3>${escapeHtml(card.title)}</h3>
  ${card.subtitle ? `<div class="fx-card-sub">${escapeHtml(card.subtitle)}</div>` : ''}
  ${card.body ? `<div class="fx-card-body">${escapeHtml(card.body)}</div>` : ''}
  ${renderItems(card)}
  ${renderCtaRow(card)}
</article>`;
}

// ---- Stadium panel ----

export function renderStadiumPanel(data: StadiumPanelData): string {
  const zoneRows = data.zones.map(z => `
    <div class="row">
      <span class="name">${escapeHtml(z.name)}</span>
      <span>${escapeHtml(z.distance ?? '—')}</span>
    </div>`).join('');

  return `
<aside class="fx-stadium" aria-label="لوحة الملعب">
  <div class="demo">لوحة الملعب · تحديث تجريبي</div>
  ${stadiumSvg(data)}
  <div class="zones">
    ${zoneRows || '<div class="row"><span class="name">اختر مدينة لعرض المناطق</span><span>—</span></div>'}
  </div>
  <div class="fx-card-meta" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
    <span class="fx-tag">فان زون: ${data.fan_zones_count}</span>
    <span class="fx-tag${data.transport_warnings_count > 0 ? ' is-warn' : ''}">تنبيهات نقل: ${data.transport_warnings_count}</span>
    <span class="fx-tag">ازدحام: ${escapeHtml(data.congestion_label)}</span>
    <span class="fx-tag">طقس: ${escapeHtml(data.weather_label)}</span>
  </div>
</aside>`;
}

function stadiumSvg(data: StadiumPanelData): string {
  // Stylized stadium silhouette — no real map data, no animation.
  // Outline in accent, zones drawn as small labelled rectangles.
  const has = data.stadium ? 1 : 0;
  return `
<svg viewBox="0 0 280 180" role="img" aria-label="${escapeAttr(data.stadium ?? 'الملعب')}">
  <defs>
    <linearGradient id="fxField" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1018"/>
      <stop offset="1" stop-color="#080a0e"/>
    </linearGradient>
  </defs>
  <ellipse cx="140" cy="90" rx="125" ry="65" fill="url(#fxField)" stroke="${has ? '#a3e635' : '#52525b'}" stroke-width="1.5" opacity="${has ? 0.9 : 0.45}"/>
  <ellipse cx="140" cy="90" rx="80" ry="36" fill="none" stroke="${has ? '#a3e635' : '#52525b'}" stroke-width="1" opacity="${has ? 0.55 : 0.3}"/>
  <line x1="140" y1="54" x2="140" y2="126" stroke="${has ? '#a3e635' : '#52525b'}" stroke-width="0.8" opacity="0.4"/>
  ${data.zones.slice(0,4).map((_z,i)=>{
    const xs = [22, 240, 22, 240];
    const ys = [22, 22, 142, 142];
    return `<rect x="${xs[i]}" y="${ys[i]}" width="18" height="14" rx="3" fill="none" stroke="${has ? '#a3e635' : '#52525b'}" stroke-width="1"/>`;
  }).join('')}
</svg>`;
}
