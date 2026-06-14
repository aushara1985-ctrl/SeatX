// FanX skill 5 — generate_radar_response.
// Pure. Takes the full context + decision and produces the UI-ready JSON
// for the dashboard. Each card has a `data` block the renderer can drop
// straight into HTML. Arabic, terse, no hype, no fake certainty.

import type { FanxContext, WorldCupOpp } from '../context';
import type { AgentDecision } from './make-decision';
import type { ScoreResult } from './score-opportunities';

export interface DashboardCard {
  kind: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  primary_cta?: { label: string; href: string | null } | null;
  secondary_cta?: { label: string; href: string | null } | null;
  items?: Array<{ title: string; meta?: string | null; description?: string | null; href?: string | null }>;
}

export interface StadiumPanelData {
  city: string | null;
  stadium: string | null;
  zones: Array<{ name: string; distance: string | null; risk: string | null }>;
  fan_zones_count: number;
  transport_warnings_count: number;
  congestion_label: string;          // always seeded label since we have no live data
  weather_label: string;             // ditto
  is_demo: boolean;
}

export interface RadarResponse {
  top_decision_card: DashboardCard;
  ticket_radar_card: DashboardCard;
  stay_radar_card: DashboardCard;
  move_radar_card: DashboardCard;
  around_stadium_card: DashboardCard;
  match_alternatives_card: DashboardCard;
  smart_alerts_card: DashboardCard;
  stadium_panel_data: StadiumPanelData;
  short_arabic_explanation: string;
}

function take<T>(arr: T[], n: number): T[] { return arr.slice(0, n); }

function oppItem(o: WorldCupOpp) {
  const meta = [o.price_label, o.distance_label, o.urgency, o.source_label]
    .filter(Boolean).join(' · ');
  return {
    title: o.title,
    meta: meta || null,
    description: o.description,
    href: o.source_url ?? null,
  };
}

export function generate_radar_response(
  ctx: FanxContext,
  decision: AgentDecision,
  _scoreResult: ScoreResult
): RadarResponse {
  const top_decision_card: DashboardCard = {
    kind: 'best_move',
    title: 'أفضل حركة اليوم',
    subtitle: labelForDecisionType(decision),
    body: decision.best_move,
    primary_cta: { label: decision.recommended_action, href: null },
    secondary_cta: { label: 'لماذا هذا القرار', href: null },
  };

  const ticket_radar_card: DashboardCard = ctx.opportunities.tickets.length === 0
    ? {
        kind: 'ticket',
        title: 'رادار التذاكر',
        subtitle: 'لا توجد فرصة مؤكدة الآن',
        body: 'نقدر نراقب المباراة وننبهك إذا ظهرت فرصة. SeatX لا يضمن التذاكر.',
        primary_cta: { label: 'فعّل تنبيه', href: null },
        items: [],
      }
    : {
        kind: 'ticket',
        title: 'رادار التذاكر',
        subtitle: 'مدعوم بمحرك SeatX',
        body: 'فرص محتملة من مصادر رسمية — تحقق بنفسك قبل أي قرار.',
        primary_cta: { label: 'فعّل تنبيه', href: null },
        items: take(ctx.opportunities.tickets, 3).map(oppItem),
      };

  const stay_radar_card: DashboardCard = ctx.world_cup.zones.length === 0
    ? {
        kind: 'stay',
        title: 'رادار السكن',
        subtitle: 'اختر مدينة لعرض المناطق',
        body: 'ما عندنا سكن مباشر — نعرض أفضل المناطق حول الملعب حسب القرب والمواصلات.',
        items: [],
      }
    : {
        kind: 'stay',
        title: 'رادار السكن',
        subtitle: 'أفضل المناطق حول الملعب',
        body: 'مناطق مختارة حسب القرب، المواصلات، والمخاطر — ليست حجز فندق.',
        items: ctx.world_cup.zones.slice(0, 4).map(z => ({
          title: z.zone_name,
          meta: [z.distance_label, z.price_level, z.risk_level].filter(Boolean).join(' · '),
          description: z.notes,
          href: null,
        })),
      };

  const move_radar_card: DashboardCard = ctx.opportunities.transport.length === 0
    ? {
        kind: 'move',
        title: 'رادار المواصلات',
        subtitle: 'اعتمد على المصادر الرسمية',
        body: 'المواصلات غير مكتملة الآن. اعتمد على المصادر الرسمية يوم المباراة.',
        items: [],
      }
    : {
        kind: 'move',
        title: 'رادار المواصلات',
        subtitle: 'تنبيهات الحركة قبل وبعد المباراة',
        body: null,
        items: ctx.opportunities.transport.map(oppItem),
      };

  const around_stadium_card: DashboardCard = {
    kind: 'around',
    title: 'حول الملعب',
    subtitle: ctx.world_cup.stadium ?? null,
    body: ctx.opportunities.fan_zones.length === 0
      ? 'لا توجد فعاليات مؤكدة الآن — تحديثات تجريبية فقط.'
      : null,
    primary_cta: { label: 'افتح الخريطة', href: null },
    items: ctx.opportunities.fan_zones.map(oppItem),
  };

  const match_alternatives_card: DashboardCard = ctx.opportunities.alt_matches.length === 0
    ? {
        kind: 'alternatives',
        title: 'بدائل أذكى',
        subtitle: 'لا توجد بدائل الآن',
        body: 'إذا كانت المباراة المختارة غالية أو غير متاحة، نقترح بدائل بنفس المدينة.',
        items: [],
      }
    : {
        kind: 'alternatives',
        title: 'بدائل أذكى',
        subtitle: 'نفس المدينة، تكلفة أقل أو تنقّل أسهل',
        body: null,
        items: ctx.opportunities.alt_matches.map(oppItem),
      };

  const smart_alerts_card: DashboardCard = {
    kind: 'alerts',
    title: 'التنبيهات الذكية',
    subtitle: 'اختر القنوات والأنواع',
    body: 'البريد افتراضي. واتساب التقاط فقط الآن. الإشعار يعمل إذا فعّلته من حسابك.',
    primary_cta: { label: 'إعدادات التنبيهات', href: '/fanx/alerts' },
    items: [],
  };

  const stadium_panel_data: StadiumPanelData = {
    city: ctx.intent.city ?? null,
    stadium: ctx.world_cup.stadium ?? null,
    zones: ctx.world_cup.zones.slice(0, 4).map(z => ({
      name: z.zone_name,
      distance: z.distance_label,
      risk: z.risk_level,
    })),
    fan_zones_count: ctx.opportunities.fan_zones.length,
    transport_warnings_count: ctx.opportunities.transport.filter(t => t.risk_level === 'مرتفع').length
      + ctx.opportunities.warnings.length,
    congestion_label: 'تحديث تجريبي',
    weather_label: 'تحديث تجريبي',
    is_demo: true,
  };

  const short_arabic_explanation = shortExplanation(ctx, decision);

  return {
    top_decision_card,
    ticket_radar_card,
    stay_radar_card,
    move_radar_card,
    around_stadium_card,
    match_alternatives_card,
    smart_alerts_card,
    stadium_panel_data,
    short_arabic_explanation,
  };
}

function labelForDecisionType(d: AgentDecision): string {
  switch (d.decision_type) {
    case 'move_now':           return 'فرصة الآن';
    case 'wait':               return 'انتظر';
    case 'avoid':              return 'تنبيه';
    case 'better_alternative': return 'بديل أذكى';
    case 'activate_alert':     return 'فعّل تنبيه';
    case 'needs_more_info':    return 'يحتاج معلومة';
    default:                   return '';
  }
}

function shortExplanation(ctx: FanxContext, d: AgentDecision): string {
  const city = ctx.world_cup.stadium ? `حول ${ctx.world_cup.stadium}` : '';
  const priority = ctx.intent.priority;
  let why = '';
  switch (priority) {
    case 'catch_ticket':    why = 'قرارك مبني على فرص التذاكر المتاحة الآن.'; break;
    case 'stay_close':      why = 'قرارك مبني على القرب من الملعب وسهولة العودة.'; break;
    case 'save_money':      why = 'قرارك مبني على أوفر الخيارات بدون مخاطرة كبيرة.'; break;
    case 'avoid_transport': why = 'قرارك مبني على تجنّب احتقان النقل يوم المباراة.'; break;
    case 'fan_atmosphere':  why = 'قرارك مبني على أقوى أجواء جماهيرية متاحة.'; break;
    case 'family':          why = 'قرارك مبني على مناسبة المنطقة للعائلة.'; break;
    case 'alt_match':       why = 'قرارك مبني على بدائل أفضل بالقيمة من المباراة الرئيسية.'; break;
    default:                why = 'قرارك مبني على أعلى الفرص ثقةً اليوم.'; break;
  }
  return `${why} ${city}`.trim();
}
