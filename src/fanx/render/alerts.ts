// FanX alert settings — channel toggles + per-type toggles. Email-first.
// WhatsApp is capture-only until send infrastructure exists.

import { renderPage, escapeHtml } from './base';

export interface AlertsRenderInput {
  email: string | null;
  whatsapp: string | null;
  prefs: {
    email_enabled: boolean;
    whatsapp_enabled: boolean;
    push_enabled: boolean;
    ticket_alerts: boolean;
    stay_alerts: boolean;
    transport_alerts: boolean;
    fan_zone_alerts: boolean;
    alternative_match_alerts: boolean;
  };
}

function toggle(id: string, label: string, on: boolean, hint?: string): string {
  return `
<div class="fx-toggle">
  <div>
    <div class="lbl">${escapeHtml(label)}</div>
    ${hint ? `<div class="fx-card-meta">${escapeHtml(hint)}</div>` : ''}
  </div>
  <input type="checkbox" name="${id}" id="${id}"${on ? ' checked' : ''}>
</div>`;
}

export function renderAlerts(input: AlertsRenderInput): string {
  const p = input.prefs;
  const body = `
<h1 class="fx-dash-title">إعدادات التنبيهات</h1>
<form method="post" action="/fanx/api/alert-prefs" class="fx-card" style="padding:18px">
  <div class="fx-section-title" style="margin-top:0">القنوات</div>
  <div class="fx-field">
    <label class="fx-label" for="email">البريد</label>
    <input class="fx-input" id="email" name="email" type="email" value="${escapeHtml(input.email ?? '')}" placeholder="you@example.com">
  </div>
  ${toggle('email_enabled', 'تنبيه بالبريد', p.email_enabled)}

  <div class="fx-field">
    <label class="fx-label" for="whatsapp">واتساب (التقاط فقط الآن)</label>
    <input class="fx-input" id="whatsapp" name="whatsapp" type="tel" value="${escapeHtml(input.whatsapp ?? '')}" placeholder="+966...">
  </div>
  ${toggle('whatsapp_enabled', 'تنبيه واتساب', p.whatsapp_enabled, 'نستلم الرقم الآن — إرسال واتساب يفعل لاحقًا.')}

  ${toggle('push_enabled', 'إشعار المتصفح', p.push_enabled, 'يعمل إذا فعّلت الإشعار من المتصفح.')}

  <div class="fx-section-title">أنواع التنبيهات</div>
  ${toggle('ticket_alerts', 'تنبيهات التذاكر', p.ticket_alerts)}
  ${toggle('stay_alerts', 'تنبيهات السكن', p.stay_alerts)}
  ${toggle('transport_alerts', 'تنبيهات المواصلات', p.transport_alerts)}
  ${toggle('fan_zone_alerts', 'تنبيهات فان زون', p.fan_zone_alerts)}
  ${toggle('alternative_match_alerts', 'بدائل أذكى', p.alternative_match_alerts)}

  <button type="submit" class="fx-cta" style="width:100%;margin-top:10px">حفظ</button>
  <div class="fx-card-meta" style="margin-top:10px;text-align:center">FanX لا يضمن التذاكر. التنبيهات استرشادية فقط.</div>
</form>
<style>.fx-dash-title{margin:0 0 14px;font-size:22px;font-weight:800}</style>
`;
  return renderPage({ title: 'التنبيهات', active_tab: 'alerts' }, body);
}
