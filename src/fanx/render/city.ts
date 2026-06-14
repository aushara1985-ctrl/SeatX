// FanX city page — best matches + stadium zones + transport notes + fan
// zones + active opportunities, all for one city. Renders even when the
// agent has no current best move (uses fallback copy via dashboard pieces).

import { renderPage, escapeHtml } from './base';
import { renderCard, renderStadiumPanel } from './components/cards';
import type { RadarResponse } from '../agent/skills/generate-radar-response';
import type { FanxCity } from '../seed/cities';

export interface CityRenderInput {
  city: FanxCity;
  stadium_label: string | null;
  response: RadarResponse;
}

export function renderCity(input: CityRenderInput): string {
  const body = `
<div class="fx-section-title">مدينة</div>
<h1 class="fx-dash-title">${escapeHtml(input.city.name_ar)}</h1>
<div class="fx-filters-row" style="margin-bottom:14px">
  <span class="fx-tag is-warn">تحديث تجريبي</span>
  ${input.stadium_label ? `<span class="fx-tag">${escapeHtml(input.stadium_label)}</span>` : ''}
  <span class="fx-tag">${escapeHtml(input.city.timezone_label)}</span>
</div>

<div class="fx-layout">
  <div class="fx-main-col">
    <div class="fx-grid">
      ${renderCard(input.response.ticket_radar_card)}
      ${renderCard(input.response.stay_radar_card)}
      ${renderCard(input.response.move_radar_card)}
      ${renderCard(input.response.around_stadium_card)}
      ${renderCard(input.response.match_alternatives_card)}
    </div>
  </div>
  <div class="fx-aside">
    ${renderStadiumPanel(input.response.stadium_panel_data)}
    <div class="fx-card">
      <h3>أنشئ رادارك</h3>
      <div class="fx-card-body">حدد فريقك وميزانيتك ليعطيك FanX قرارًا مخصصًا.</div>
      <div class="fx-cta-row"><a class="fx-cta" href="/fanx">ابدأ الرادار</a></div>
    </div>
  </div>
</div>

<style>
.fx-dash-title{margin:0 0 10px;font-size:24px;font-weight:800}
.fx-filters-row{display:flex;flex-wrap:wrap;gap:6px}
</style>
`;
  return renderPage({ title: input.city.name_ar, active_tab: 'city' }, body);
}
