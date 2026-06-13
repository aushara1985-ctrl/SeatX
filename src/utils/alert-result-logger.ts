// Phase 2 Smart Detection Agent — alert result logger.
//
// Persists the outcome of every alert decision. Updates:
//   - event_memory  (alert_count / false_positive_count / last_meaningful_change_at)
//   - source_memory (successful_signals / false_signals / last_false_positive_at)
//   - alert_events  (audit row per decision)
//
// All updates are idempotent-safe and tolerate missing rows. Failures here
// must NEVER crash the monitor / API. Every DB call is wrapped in try/catch
// so the detection agent stays a non-load-bearing observer until wired in.

import { pool } from '../db';
import type { AlertDecision, EventMemoryRow, SourceMemoryRow } from './alert-decision';

export type AlertOutcome =
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'manual_review'
  | 'false_positive';

export interface LogAlertInput {
  event_id?: number | null;
  user_email?: string | null;
  watch_request_id?: number | null;
  queue_watch_id?: number | null;
  source?: string | null;
  source_domain?: string | null;
  channel?: string | null;             // 'push' | 'email' | 'push+email' | ...
  decision: AlertDecision;
}

export interface LogAlertResult {
  ok: boolean;
  alert_event_id: number | null;
  error?: string;
}

function isFalsePositive(o: AlertOutcome): boolean {
  return o === 'false_positive';
}

function isSuccessfulSignal(o: AlertOutcome): boolean {
  return o === 'sent';
}

export async function log_alert_result(
  input: LogAlertInput,
  outcome: AlertOutcome
): Promise<LogAlertResult> {
  const {
    event_id = null,
    user_email = null,
    watch_request_id = null,
    queue_watch_id = null,
    source = null,
    source_domain = null,
    channel = null,
    decision,
  } = input;

  let alertEventId: number | null = null;

  // 1. Audit row — always best-effort.
  try {
    const r = await pool.query(
      `INSERT INTO alert_events
         (event_id, user_email, watch_request_id, queue_watch_id,
          decision, opportunity_type, confidence, reason, channel, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        event_id,
        user_email,
        watch_request_id,
        queue_watch_id,
        decision.action,
        decision.opportunity_type,
        decision.confidence,
        decision.reason,
        channel,
        outcome,
      ]
    );
    alertEventId = r.rows?.[0]?.id ?? null;
  } catch (e: any) {
    return { ok: false, alert_event_id: null, error: String(e?.message || e) };
  }

  // 2. event_memory — only if we have an event_id.
  if (event_id) {
    try {
      // Upsert a memory row if one doesn't exist for this event/source.
      await pool.query(
        `INSERT INTO event_memory (event_id, source, alert_count, false_positive_count, last_meaningful_change_at, last_checked_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
         ON CONFLICT (event_id, source) DO UPDATE SET
           alert_count = event_memory.alert_count + $3,
           false_positive_count = event_memory.false_positive_count + $4,
           last_meaningful_change_at = CASE WHEN $3 > 0 THEN NOW() ELSE event_memory.last_meaningful_change_at END,
           last_checked_at = NOW(),
           updated_at = NOW()`,
        [
          event_id,
          source,
          isSuccessfulSignal(outcome) ? 1 : 0,
          isFalsePositive(outcome) ? 1 : 0,
        ]
      );
    } catch (_) {
      // Non-fatal — audit row already persisted.
    }
  }

  // 3. source_memory — only if we have a source name.
  if (source) {
    try {
      await pool.query(
        `INSERT INTO source_memory (source, domain, successful_signals, false_signals, last_false_positive_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (source) DO UPDATE SET
           domain = COALESCE(source_memory.domain, EXCLUDED.domain),
           successful_signals = source_memory.successful_signals + $3,
           false_signals = source_memory.false_signals + $4,
           last_false_positive_at = CASE WHEN $4 > 0 THEN NOW() ELSE source_memory.last_false_positive_at END,
           updated_at = NOW()`,
        [
          source,
          source_domain,
          isSuccessfulSignal(outcome) ? 1 : 0,
          isFalsePositive(outcome) ? 1 : 0,
          isFalsePositive(outcome) ? new Date() : null,
        ]
      );
    } catch (_) {
      // Non-fatal.
    }
  }

  return { ok: true, alert_event_id: alertEventId };
}

// --- Memory accessors used by monitor.ts to feed the Smart Detection Agent ---
// All accessors are crash-safe: a DB failure returns null/void rather than
// throwing, so the monitor stays alive and falls back to legacy behavior.

export async function getEventMemory(
  event_id: number,
  source: string | null
): Promise<EventMemoryRow | null> {
  try {
    const r = await pool.query(
      `SELECT event_id, source, last_known_status, last_known_availability,
              last_meaningful_change_at, false_positive_count, alert_count
         FROM event_memory
        WHERE event_id = $1 AND source IS NOT DISTINCT FROM $2
        LIMIT 1`,
      [event_id, source]
    );
    return r.rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

export async function getOrCreateSourceMemory(
  source: string,
  domain: string | null
): Promise<SourceMemoryRow | null> {
  if (!source) return null;
  try {
    await pool.query(
      `INSERT INTO source_memory (source, domain)
       VALUES ($1, $2)
       ON CONFLICT (source) DO UPDATE SET
         domain = COALESCE(source_memory.domain, EXCLUDED.domain),
         updated_at = NOW()`,
      [source, domain]
    );
    const r = await pool.query(
      `SELECT source, domain, reliability_score, successful_signals, false_signals,
              last_false_positive_at, requires_confirmation, min_confidence_to_alert
         FROM source_memory
        WHERE source = $1
        LIMIT 1`,
      [source]
    );
    const row = r.rows?.[0];
    if (!row) return null;
    return {
      source: row.source,
      domain: row.domain,
      reliability_score: row.reliability_score,
      successful_signals: row.successful_signals,
      false_signals: row.false_signals,
      last_false_positive_at: row.last_false_positive_at,
      requires_confirmation: row.requires_confirmation,
      // pg returns NUMERIC as string — coerce to number safely.
      min_confidence_to_alert:
        row.min_confidence_to_alert === null || row.min_confidence_to_alert === undefined
          ? null
          : Number(row.min_confidence_to_alert),
    };
  } catch (_) {
    return null;
  }
}

export interface UpdateEventMemoryStateInput {
  event_id: number;
  source: string | null;
  last_known_status?: string | null;
  last_known_availability?: string | null;
}

export async function updateEventMemoryState(
  input: UpdateEventMemoryStateInput
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO event_memory
         (event_id, source, last_known_status, last_known_availability,
          last_checked_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       ON CONFLICT (event_id, source) DO UPDATE SET
         last_known_status = COALESCE(EXCLUDED.last_known_status, event_memory.last_known_status),
         last_known_availability = COALESCE(EXCLUDED.last_known_availability, event_memory.last_known_availability),
         last_checked_at = NOW(),
         updated_at = NOW()`,
      [
        input.event_id,
        input.source,
        input.last_known_status ?? null,
        input.last_known_availability ?? null,
      ]
    );
  } catch (_) {
    // Non-fatal — memory update failure should not crash the monitor.
  }
}
