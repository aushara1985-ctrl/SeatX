// FanX shareable radar — public, read-only. No email, no WhatsApp, no
// alerts CTA, no preferences. Just the agent's response for the radar
// owner's stored intent.

import { renderPage, escapeHtml } from './base';
import { renderBestMove, renderCard, renderStadiumPanel } from './components/cards';
import type { RadarResponse } from '../agent/skills/generate-radar-response';

export interface ShareableInput {
  slug: string;
  city_label: string | null;
  team_label: string | null;
  response: RadarResponse;
}

export function renderShareable(input: ShareableInput): string {
  const body = `
<div class="fx-section-title">رادار مشارَك</div>
<h1 class="fx-dash-title">رادار اليوم</h1>
<div class="fx-filters-row" style="margin-bottom:18px">
  <span class="fx-tag is-warn">تحديث تجريبي · للقراءة فقط</span>
  ${input.city_label ? `<span class="fx-tag">${escapeHtml(input.city_label)}</span>` : ''}
  ${input.team_label ? `<span class="fx-tag">${escapeHtml(input.team_label)}</span>` : ''}
</div>

<div class="fx-layout">
  <div class="fx-main-col">
    ${renderBestMove(input.response.top_decision_card, input.response.short_arabic_explanation)}
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
      <div class="fx-card-body">FanX يبني لك رادار مخصص حسب مدينتك وفريقك وميزانيتك.</div>
      <div class="fx-cta-row"><a class="fx-cta" href="/fanx">ابدأ مجانًا</a></div>
    </div>
  </div>
</div>

<style>
.fx-dash-title{margin:0 0 10px;font-size:22px;font-weight:800}
.fx-filters-row{display:flex;flex-wrap:wrap;gap:6px}
</style>
`;
  return renderPage({ title: 'رادار مشارَك', active_tab: 'shareable' }, body);
}
