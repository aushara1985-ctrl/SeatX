// FanX skill 7 — learn_from_feedback.
// Updates aggregate counters from explicit user actions only. No implicit
// learning, no fake "you might also like". A click on an opportunity card
// bumps a counter; ignoring is also a signal. Memory comes purely from
// recorded fanx_agent_events rows.

import { pool } from '../../../db';

export interface FeedbackInput {
  radar_id: number;
  opportunity_id?: number | null;
  outcome: 'click' | 'save' | 'ignore' | 'share' | 'alert_enabled';
}

export async function learn_from_feedback(input: FeedbackInput): Promise<void> {
  const { radar_id, opportunity_id, outcome } = input;
  try {
    await pool.query(
      `INSERT INTO fanx_agent_events (radar_id, event_type, payload_json)
       VALUES ($1, $2, $3)`,
      [
        radar_id,
        outcome,
        JSON.stringify({ opportunity_id: opportunity_id ?? null, ts: new Date().toISOString() }),
      ]
    );
  } catch (_) { /* swallow */ }
}

export interface RadarMemorySnapshot {
  clicks: number;
  saves: number;
  ignores: number;
  shares: number;
  alerts_enabled: number;
  last_event_at: Date | null;
}

export async function loadRadarMemory(radar_id: number): Promise<RadarMemorySnapshot> {
  const empty: RadarMemorySnapshot = {
    clicks: 0, saves: 0, ignores: 0, shares: 0, alerts_enabled: 0, last_event_at: null,
  };
  try {
    const r = await pool.query<{
      event_type: string;
      c: string;
      last_at: Date | null;
    }>(
      `SELECT event_type,
              COUNT(*)::text AS c,
              MAX(created_at) AS last_at
         FROM fanx_agent_events
        WHERE radar_id = $1
        GROUP BY event_type`,
      [radar_id]
    );
    const snap = { ...empty };
    for (const row of r.rows) {
      const n = Number(row.c) || 0;
      if (snap.last_event_at === null || (row.last_at && row.last_at > snap.last_event_at)) {
        snap.last_event_at = row.last_at;
      }
      switch (row.event_type) {
        case 'click':          snap.clicks = n; break;
        case 'save':           snap.saves = n; break;
        case 'ignore':         snap.ignores = n; break;
        case 'share':          snap.shares = n; break;
        case 'alert_enabled':  snap.alerts_enabled = n; break;
      }
    }
    return snap;
  } catch (_) {
    return empty;
  }
}
