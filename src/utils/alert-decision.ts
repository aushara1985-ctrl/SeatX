// Phase 2 Smart Detection Agent — alert decision.
//
// Pure rule-based. Given an event's memory, the source's memory, and an
// opportunity emitted by analyze_event_change, decide whether to send,
// hold, manually review, or ignore. Conservative — when in doubt: hold.
//
// Product rules (CLAUDE.md): no fake demand, no queue bypass language,
// no guarantees. Decisions here MUST be safe to wire into the existing
// monitor/notify pipeline without contradicting those rules.

import type { OpportunityResult, OpportunityType } from './opportunity-analyzer';

export interface EventMemoryRow {
  event_id?: number | null;
  source?: string | null;
  last_known_status?: string | null;
  last_known_availability?: string | null;
  last_meaningful_change_at?: Date | string | null;
  false_positive_count?: number | null;
  alert_count?: number | null;
  watchers_count?: number | null;          // optional hint when known
}

export interface SourceMemoryRow {
  source?: string | null;
  domain?: string | null;
  reliability_score?: number | null;       // 0..100
  successful_signals?: number | null;
  false_signals?: number | null;
  last_false_positive_at?: Date | string | null;
  requires_confirmation?: boolean | null;
  min_confidence_to_alert?: number | null; // 0..1, default 0.7
}

export type AlertAction = 'send_alert' | 'hold' | 'manual_review' | 'ignore';
export type AlertUrgency = 'low' | 'medium' | 'high';

export interface AlertDecision {
  action: AlertAction;
  urgency: AlertUrgency;
  reason: string;
  confidence: number;
  opportunity_type: OpportunityType;
}

const DEFAULT_MIN_CONFIDENCE = 0.7;
const RECENT_FALSE_POSITIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const ALERT_FATIGUE_THRESHOLD = 5;                            // alerts in memory before we soft-throttle

function toMs(t: Date | string | null | undefined): number {
  if (!t) return 0;
  if (t instanceof Date) return t.getTime();
  const n = Date.parse(String(t));
  return Number.isFinite(n) ? n : 0;
}

function isStrongOpportunity(o: OpportunityType): boolean {
  return o === 'seats_returned' || o === 'sale_opened' || o === 'new_drop';
}

function isQueueRelated(o: OpportunityType): boolean {
  return o === 'queue_removed';
}

export function make_alert_decision(
  event_memory: EventMemoryRow | null | undefined,
  source_memory: SourceMemoryRow | null | undefined,
  opportunity: OpportunityResult
): AlertDecision {
  const em = event_memory || {};
  const sm = source_memory || {};
  const opp = opportunity;

  const minConfidence =
    typeof sm.min_confidence_to_alert === 'number' && sm.min_confidence_to_alert > 0
      ? sm.min_confidence_to_alert
      : DEFAULT_MIN_CONFIDENCE;

  // 0. No real change — ignore. (Cheapest exit.)
  if (!opp.changed || opp.confidence <= 0) {
    return {
      action: 'ignore',
      urgency: 'low',
      reason: 'no_change_detected',
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 1. Confidence floor from source policy.
  if (opp.confidence < minConfidence) {
    return {
      action: 'hold',
      urgency: 'low',
      reason: `confidence_${opp.confidence.toFixed(2)}_below_source_floor_${minConfidence.toFixed(2)}`,
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 2. Source recently produced a false positive — require confirmation.
  const lastFp = toMs(sm.last_false_positive_at);
  const sourceUntrusted =
    sm.requires_confirmation === true ||
    (lastFp > 0 && Date.now() - lastFp < RECENT_FALSE_POSITIVE_WINDOW_MS);

  if (sourceUntrusted && opp.requires_confirmation) {
    return {
      action: 'manual_review',
      urgency: 'low',
      reason: 'source_recently_false_positive_and_opportunity_unconfirmed',
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 3. Event has accumulated false positives — be cautious.
  const eventFp = Math.max(0, em.false_positive_count || 0);
  if (eventFp >= 3) {
    return {
      action: 'manual_review',
      urgency: 'low',
      reason: `event_false_positive_count_${eventFp}`,
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 4. Queue-related opportunity has its own dedicated safe-copy template, so
  // it bypasses the generic "requires_confirmation -> hold" rule below — but
  // only AFTER the source/event safety vetoes above. NEVER implies queue
  // bypass; the generator owns the wording.
  if (isQueueRelated(opp.opportunity_type)) {
    return {
      action: 'send_alert',
      urgency: 'medium',
      reason: 'queue_status_changed_official_flow',
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 5. Opportunity says it needs confirmation — hold if not strong enough.
  if (opp.requires_confirmation && !isStrongOpportunity(opp.opportunity_type)) {
    return {
      action: 'hold',
      urgency: 'low',
      reason: 'opportunity_requires_confirmation_and_not_strong',
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 6. Alert fatigue — too many recent alerts for this event memory.
  const alerts = Math.max(0, em.alert_count || 0);
  if (alerts >= ALERT_FATIGUE_THRESHOLD && opp.confidence < 0.85) {
    return {
      action: 'hold',
      urgency: 'low',
      reason: `alert_fatigue_${alerts}_recent_alerts`,
      confidence: opp.confidence,
      opportunity_type: opp.opportunity_type,
    };
  }

  // 7. Strong opportunity + clear confidence → send. Urgency tracks
  // confidence and the watcher hint if present.
  let urgency: AlertUrgency = 'medium';
  if (opp.confidence >= 0.9 || isStrongOpportunity(opp.opportunity_type)) {
    urgency = 'high';
  }
  if (opp.confidence < 0.8 && !isStrongOpportunity(opp.opportunity_type)) {
    urgency = 'low';
  }

  return {
    action: 'send_alert',
    urgency,
    reason: `opportunity_${opp.opportunity_type}_confidence_${opp.confidence.toFixed(2)}`,
    confidence: opp.confidence,
    opportunity_type: opp.opportunity_type,
  };
}
