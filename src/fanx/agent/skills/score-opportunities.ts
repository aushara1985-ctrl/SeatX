// FanX skill 3 — score_opportunities.
// Pure scoring. Each opportunity gets per-axis scores (0..1) and one
// overall score. Rule-based only, no AI. The scoring favors the user's
// stated priority and budget, never invents data, never claims certainty
// above the confidence the opportunity already carries.

import type { FanxContext, WorldCupOpp, BudgetLevel, Priority } from '../context';

export interface ScoredOpportunity {
  opportunity: WorldCupOpp;
  ticket_score: number;
  stay_risk: number;
  move_difficulty: number;
  match_value: number;
  urgency_score: number;
  family_fit: number;
  budget_fit: number;
  overall_score: number;
}

export interface ScoreResult {
  scored: ScoredOpportunity[];
  best?: ScoredOpportunity | null;
}

const URGENCY_MAP: Record<string, number> = {
  'اليوم': 0.9,
  'الأسبوع': 0.6,
  'وقت لاحق': 0.3,
};

const PRICE_FIT: Record<BudgetLevel, Record<string, number>> = {
  low:    { 'اقتصادي': 1.0, 'متوسط': 0.6, 'مرتفع': 0.2 },
  medium: { 'اقتصادي': 0.7, 'متوسط': 1.0, 'مرتفع': 0.5 },
  high:   { 'اقتصادي': 0.5, 'متوسط': 0.8, 'مرتفع': 1.0 },
};

const RISK_PENALTY: Record<string, number> = {
  'منخفض': 0.0,
  'متوسط': 0.15,
  'مرتفع': 0.35,
};

function safe(n: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, n));
}

function getBudgetFit(opp: WorldCupOpp, budget: BudgetLevel | null | undefined): number {
  if (!budget || !opp.price_label) return 0.5;
  const map = PRICE_FIT[budget];
  return map[opp.price_label] ?? 0.5;
}

function getUrgencyScore(opp: WorldCupOpp): number {
  if (!opp.urgency) return 0.4;
  return URGENCY_MAP[opp.urgency] ?? 0.4;
}

function getRiskPenalty(opp: WorldCupOpp): number {
  if (!opp.risk_level) return 0.05;
  return RISK_PENALTY[opp.risk_level] ?? 0.1;
}

function priorityBoost(opp: WorldCupOpp, priority: Priority | null | undefined): number {
  if (!priority) return 0;
  const t = opp.type;
  switch (priority) {
    case 'catch_ticket':     return t === 'ticket' ? 0.2 : 0;
    case 'stay_close':       return t === 'stay' ? 0.2 : (t === 'warning' ? -0.05 : 0);
    case 'save_money':       return opp.price_label === 'اقتصادي' ? 0.15 : 0;
    case 'avoid_transport':  return t === 'transport' ? 0.2 : (t === 'warning' ? 0.1 : 0);
    case 'fan_atmosphere':   return t === 'fan_zone' ? 0.2 : 0;
    case 'family':           return 0; // family fit handled separately
    case 'alt_match':        return t === 'alternative_match' ? 0.2 : 0;
    default:                 return 0;
  }
}

function familyFitScore(opp: WorldCupOpp): number {
  // We don't store family_friendly on opportunities (only on zones), so
  // we infer from risk_level. High risk = bad family fit. Don't fake.
  if (opp.risk_level === 'منخفض') return 0.8;
  if (opp.risk_level === 'متوسط') return 0.5;
  if (opp.risk_level === 'مرتفع') return 0.2;
  return 0.5;
}

function scoreOne(opp: WorldCupOpp, ctx: FanxContext): ScoredOpportunity {
  const baseConfidence = opp.confidence ?? 0.5;
  const urgency_score = getUrgencyScore(opp);
  const budget_fit = getBudgetFit(opp, ctx.intent.budget_level);
  const family_fit = familyFitScore(opp);
  const risk_pen = getRiskPenalty(opp);

  const ticket_score = opp.type === 'ticket' ? safe(baseConfidence) : 0;
  const stay_risk = opp.type === 'stay' ? safe(1 - risk_pen * 1.5) : 0;
  const move_difficulty = opp.type === 'transport' || opp.type === 'warning'
    ? safe(risk_pen + 0.1)
    : 0;
  const match_value = opp.type === 'alternative_match' || opp.type === 'ticket'
    ? safe(baseConfidence + budget_fit * 0.2)
    : 0;

  const boost = priorityBoost(opp, ctx.intent.priority);
  const familyBonus = ctx.intent.priority === 'family' ? family_fit * 0.15 : 0;

  // Overall = anchored on opportunity confidence, modulated by fits, minus risk.
  const overall = safe(
    baseConfidence * 0.55
    + urgency_score * 0.15
    + budget_fit * 0.15
    + boost
    + familyBonus
    - risk_pen * 0.5
  );

  return {
    opportunity: opp,
    ticket_score,
    stay_risk,
    move_difficulty,
    match_value,
    urgency_score,
    family_fit,
    budget_fit,
    overall_score: overall,
  };
}

export function score_opportunities(ctx: FanxContext): ScoreResult {
  const all: WorldCupOpp[] = [
    ...ctx.opportunities.tickets,
    ...ctx.opportunities.stay,
    ...ctx.opportunities.transport,
    ...ctx.opportunities.fan_zones,
    ...ctx.opportunities.alt_matches,
    ...ctx.opportunities.warnings,
    ...ctx.opportunities.city_tips,
  ];
  const scored = all.map(o => scoreOne(o, ctx));
  scored.sort((a, b) => b.overall_score - a.overall_score);
  return { scored, best: scored[0] ?? null };
}
