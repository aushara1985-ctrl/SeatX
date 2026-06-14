// FanX daily radar dashboard. Renders the agent's RadarResponse into the
// SeatX-style command-center layout. Mobile-first: cards stack; on desktop
// the stadium panel becomes a side rail.

import { renderPage, escapeHtml } from './base';
import { renderBestMove, renderCard, renderStadiumPanel } from './components/cards';
import type { RadarResponse } from '../agent/skills/generate-radar-response';

export interface DashboardRenderInput {
  response: RadarResponse;
  is_demo: boolean;
  city_label: string | null;
  team_label: string | null;
}

export function renderDashboard(input: DashboardRenderInput): string {
  const { response, is_demo, city_label, team_label } = input;

  const filtersBar = `
<section class="fx-filters">
  <div class="fx-filters-row">
    <span class="fx-tag${is_demo ? ' is-warn' : ''}">${is_demo ? 'تحديث تجريبي' : 'رادار اليوم'}</span>
    ${city_label ? `<span class="fx-tag">${escapeHtml(city_label)}</span>` : ''}
    ${team_label ? `<span class="fx-tag">${escapeHtml(team_label)}</span>` : ''}
  </div>
</section>`;

  const body = `
<h1 class="fx-dash-title">راداري اليوم</h1>
${filtersBar}

<div class="fx-layout">
  <div class="fx-main-col">
    ${renderBestMove(response.top_decision_card, response.short_arabic_explanation)}

    <div class="fx-section-title">رادارات اليوم</div>
    <div class="fx-grid">
      ${renderCard(response.ticket_radar_card)}
      ${renderCard(response.stay_radar_card)}
      ${renderCard(response.move_radar_card)}
      ${renderCard(response.around_stadium_card)}
      ${renderCard(response.match_alternatives_card)}
      ${renderCard(response.smart_alerts_card)}
    </div>
  </div>

  <div class="fx-aside">
    ${renderStadiumPanel(response.stadium_panel_data)}
    <div class="fx-card">
      <h3>تذكير</h3>
      <div class="fx-card-body">SeatX لا يضمن التذاكر. لا تبني قرار مالي على هذا الرادار قبل التحقق من المصدر الرسمي.</div>
    </div>
  </div>
</div>

<style>
.fx-dash-title{margin:6px 0 14px;font-size:22px;font-weight:800}
.fx-filters{margin-bottom:18px}
.fx-filters-row{display:flex;flex-wrap:wrap;gap:6px}
</style>
`;
  return renderPage({ title: 'راداري اليوم', active_tab: 'radar' }, body);
}
