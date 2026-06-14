// FanX skill 6 — log_result.
// Persists every agent run + every user-triggered event. DB failures
// are swallowed so the renderer never crashes on a logging hiccup.

import { pool } from '../../../db';
import type { AgentDecision } from './make-decision';

export type FanxAgentOutcome =
  | 'shown'
  | 'clicked'
  | 'saved'
  | 'shared'
  | 'ignored'
  | 'alert_enabled';

export interface LogResultInput {
  user_id?: number | null;
  radar_id?: number | null;
  decision: AgentDecision;
  action?: string | null;
  outcome?: FanxAgentOutcome;
}

export async function log_result(input: LogResultInput): Promise<void> {
  const { user_id, radar_id, decision, action, outcome } = input;

  try {
    await pool.query(
      `INSERT INTO fanx_agent_decisions
         (radar_id, opportunity_id, decision_type, best_move, reason,
          score_json, recommended_action, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        radar_id ?? null,
        decision.primary_opportunity_id ?? null,
        decision.decision_type,
        decision.best_move,
        decision.reason,
        JSON.stringify({ risk_level: decision.risk_level }),
        decision.recommended_action,
        decision.confidence,
      ]
    );
  } catch (_) { /* swallow */ }

  try {
    await pool.query(
      `INSERT INTO fanx_agent_events (radar_id, event_type, payload_json)
       VALUES ($1, $2, $3)`,
      [
        radar_id ?? null,
        outcome ?? 'shown',
        JSON.stringify({ user_id, action: action ?? null, decision_type: decision.decision_type }),
      ]
    );
  } catch (_) { /* swallow */ }
}
