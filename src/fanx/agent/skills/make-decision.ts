// FanX skill 4 — make_decision.
// Pure. Takes the scored context + fallback signal, produces one best_move
// recommendation and a decision_type. Never invents an opportunity; if
// nothing scores high enough, returns 'needs_more_info' with a fallback line.

import type { FanxContext } from '../context';
import type { ScoreResult, ScoredOpportunity } from './score-opportunities';
import { fallbackFor } from '../fallback';

export type DecisionType =
  | 'move_now'
  | 'wait'
  | 'avoid'
  | 'better_alternative'
  | 'activate_alert'
  | 'needs_more_info';

export interface AgentDecision {
  best_move: string;            // user-facing Arabic
  decision_type: DecisionType;
  reason: string;               // short machine-readable code
  risk_level: 'منخفض' | 'متوسط' | 'مرتفع' | 'unknown';
  recommended_action: string;   // CTA label
  confidence: number;           // 0..1
  primary_opportunity_id?: number | null;
  fallback?: string | null;     // arabic fallback copy when needs_more_info
}

const NEEDS_MORE_INFO_CONFIDENCE = 0.55;

export function make_decision(ctx: FanxContext, scoreResult: ScoreResult): AgentDecision {
  const fb = fallbackFor(ctx);
  if (fb) {
    return {
      best_move: fb.copy,
      decision_type: 'needs_more_info',
      reason: 'fallback_' + fb.reason,
      risk_level: 'unknown',
      recommended_action: 'أكمل بيانات الرادار',
      confidence: 0.4,
      primary_opportunity_id: null,
      fallback: fb.copy,
    };
  }

  const best = scoreResult.best;
  if (!best || best.overall_score < NEEDS_MORE_INFO_CONFIDENCE) {
    return {
      best_move: 'نحتاج معلومة إضافية قبل ما نعطيك قرار دقيق.',
      decision_type: 'needs_more_info',
      reason: 'low_confidence',
      risk_level: 'unknown',
      recommended_action: 'أكمل اختياراتك',
      confidence: best?.overall_score ?? 0.3,
      primary_opportunity_id: null,
      fallback: 'نحتاج معلومة إضافية قبل ما نعطيك قرار دقيق.',
    };
  }

  return decisionForBest(best);
}

function decisionForBest(best: ScoredOpportunity): AgentDecision {
  const o = best.opportunity;
  const conf = best.overall_score;

  // Type-specific framing of the best move + decision_type.
  switch (o.type) {
    case 'ticket': {
      const decision: DecisionType = conf >= 0.75 ? 'move_now' : 'activate_alert';
      const best_move = decision === 'move_now'
        ? `أفضل حركة الآن: ${o.title}. افتح المصدر الرسمي وتحقق بسرعة.`
        : `${o.title}. الإشارة محتملة — فعّل تنبيه عشان نوصل لك أي تحديث.`;
      return {
        best_move,
        decision_type: decision,
        reason: decision === 'move_now' ? 'ticket_high_confidence' : 'ticket_medium_confidence',
        risk_level: (o.risk_level as any) ?? 'متوسط',
        recommended_action: decision === 'move_now' ? 'افتح المصدر الرسمي' : 'فعّل تنبيه',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    }
    case 'stay':
      return {
        best_move: `أفضل منطقة سكن لك الآن: ${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: 'move_now',
        reason: 'stay_zone_recommendation',
        risk_level: (o.risk_level as any) ?? 'متوسط',
        recommended_action: 'تفاصيل المنطقة',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    case 'transport':
      return {
        best_move: `${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: o.risk_level === 'مرتفع' ? 'avoid' : 'wait',
        reason: 'transport_advisory',
        risk_level: (o.risk_level as any) ?? 'متوسط',
        recommended_action: 'تفاصيل المواصلات',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    case 'warning':
      return {
        best_move: `${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: 'avoid',
        reason: 'warning_advisory',
        risk_level: (o.risk_level as any) ?? 'متوسط',
        recommended_action: 'تفاصيل التنبيه',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    case 'alternative_match':
      return {
        best_move: `بديل أذكى: ${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: 'better_alternative',
        reason: 'alt_match_better_value',
        risk_level: (o.risk_level as any) ?? 'منخفض',
        recommended_action: 'تفاصيل البديل',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    case 'fan_zone':
      return {
        best_move: `${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: 'move_now',
        reason: 'fan_zone_match',
        risk_level: (o.risk_level as any) ?? 'منخفض',
        recommended_action: 'افتح الخريطة',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    case 'city_tip':
      return {
        best_move: `${o.title}. ${o.description ?? ''}`.trim(),
        decision_type: 'wait',
        reason: 'city_tip_general',
        risk_level: (o.risk_level as any) ?? 'منخفض',
        recommended_action: 'تابع الرادار',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
    default:
      return {
        best_move: o.title,
        decision_type: 'wait',
        reason: 'generic_match',
        risk_level: 'unknown',
        recommended_action: 'تابع',
        confidence: conf,
        primary_opportunity_id: o.id ?? null,
      };
  }
}
