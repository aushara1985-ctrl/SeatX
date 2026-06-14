// FanX Opportunity Agent — Fallback copy.
//
// Whenever the agent doesn't have enough confidence or context to make a
// real recommendation, it returns one of these honest, Saudi-Arabic
// fallback strings instead of inventing a number, hotel, or route.

import type { FanxContext } from './context';

export type FallbackReason =
  | 'missing_city'
  | 'missing_team_or_match'
  | 'missing_ticket_data'
  | 'missing_stay_data'
  | 'missing_transport_data'
  | 'low_confidence';

export interface FallbackResult {
  reason: FallbackReason;
  copy: string;            // user-facing Arabic message
}

const COPY: Record<FallbackReason, string> = {
  missing_city:           'اختر المدينة أولًا عشان نطلع لك فرص قريبة ومواصلات مناسبة.',
  missing_team_or_match:  'اختر فريق أو مباراة، أو خل FanX يعرض أفضل فرص اليوم.',
  missing_ticket_data:    'ما عندنا فرصة تذاكر مؤكدة الآن. نقدر نراقب المباراة وننبهك إذا ظهرت فرصة.',
  missing_stay_data:      'ما عندنا سكن مباشر الآن، لكن نقدر نعرض أفضل المناطق حول الملعب حسب القرب والمواصلات.',
  missing_transport_data: 'المواصلات غير مكتملة الآن. اعتمد على المصادر الرسمية عند يوم المباراة.',
  low_confidence:         'نحتاج معلومة إضافية قبل ما نعطيك قرار دقيق.',
};

export function fallbackCopy(reason: FallbackReason): string {
  return COPY[reason];
}

export function pickFallbackReason(ctx: FanxContext): FallbackReason | null {
  if (!ctx.intent.city) return 'missing_city';
  if (!ctx.intent.team && !ctx.intent.match_id && ctx.intent.priority !== 'fan_atmosphere') {
    return 'missing_team_or_match';
  }
  if (ctx.opportunities.tickets.length === 0 && ctx.intent.priority === 'catch_ticket') {
    return 'missing_ticket_data';
  }
  if (ctx.opportunities.stay.length === 0 && ctx.intent.priority === 'stay_close') {
    return 'missing_stay_data';
  }
  if (ctx.opportunities.transport.length === 0 && ctx.intent.priority === 'avoid_transport') {
    return 'missing_transport_data';
  }
  return null;
}

export function fallbackFor(ctx: FanxContext): FallbackResult | null {
  const reason = pickFallbackReason(ctx);
  if (!reason) return null;
  return { reason, copy: COPY[reason] };
}
