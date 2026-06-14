// FanX match page — focused view for a specific match. Reuses the dashboard
// renderer with the radar pre-filtered to one match.

import { renderPage, escapeHtml } from './base';
import { renderBestMove, renderCard, renderStadiumPanel } from './components/cards';
import type { RadarResponse } from '../agent/skills/generate-radar-response';

export interface MatchRenderInput {
  match_id: string;
  match_label: string;
  response: RadarResponse;
}

export function renderMatch(input: MatchRenderInput): string {
  const body = `
<div class="fx-section-title">المباراة</div>
<h1 class="fx-dash-title">${escapeHtml(input.match_label)}</h1>
<div class="fx-filters-row" style="margin-bottom:18px">
  <span class="fx-tag is-warn">تحديث تجريبي</span>
  <span class="fx-tag">${escapeHtml(input.match_id)}</span>
</div>

<div class="fx-layout">
  <div class="fx-main-col">
    ${renderBestMove(input.response.top_decision_card, input.response.short_arabic_explanation)}
    <div class="fx-section-title">رادارات المباراة</div>
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
      <h3>فعّل تنبيه</h3>
      <div class="fx-card-body">نراقب المصادر الرسمية وننبهك إذا ظهرت فرصة لهذه المباراة.</div>
      <div class="fx-cta-row"><a class="fx-cta" href="/fanx/alerts">إعدادات التنبيهات</a></div>
    </div>
  </div>
</div>

<style>
.fx-dash-title{margin:0 0 10px;font-size:22px;font-weight:800}
.fx-filters-row{display:flex;flex-wrap:wrap;gap:6px}
</style>
`;
  return renderPage({ title: input.match_label, active_tab: 'match' }, body);
}
