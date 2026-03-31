import { pool } from './db';

export interface SignalPattern {
  signals: string[];
  successRate: number;
  totalOccurrences: number;
  weight: number;
}

export async function recordSignalOutcome(
  eventId: number,
  sourceName: string,
  signals: string[],
  detectedStatus: string,
  confidence: number,
  wasAlertSent: boolean
): Promise<void> {
  await pool.query(
    `INSERT INTO signal_history
      (event_id, source_name, signals, detected_status, confidence, actual_outcome)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [eventId, sourceName, signals, detectedStatus, confidence, wasAlertSent ? 'alerted' : 'skipped']
  );
}

export async function getSignalWeight(signals: string[], sourceName: string): Promise<number> {
  if (!signals.length) return 1.0;
  try {
    const r = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN actual_outcome = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN actual_outcome = 'false_positive' THEN 1 ELSE 0 END) as false_pos
       FROM signal_history
       WHERE source_name = $1
       AND signals && $2::text[]
       AND created_at > NOW() - INTERVAL '30 days'`,
      [sourceName, signals]
    );
    const row = r.rows[0];
    const total = parseInt(row.total, 10);
    if (total < 5) return 1.0;
    const confirmed = parseInt(row.confirmed, 10);
    const falsePosCount = parseInt(row.false_pos, 10);
    const successRate = confirmed / total;
    const fpRate = falsePosCount / total;
    const weight = Math.max(0.3, Math.min(1.5, 1.0 + successRate - fpRate * 2));
    return weight;
  } catch (_) {
    return 1.0;
  }
}

export async function confirmSignalOutcome(
  eventId: number,
  wasReal: boolean
): Promise<void> {
  const outcome = wasReal ? 'confirmed' : 'false_positive';
  await pool.query(
    `UPDATE signal_history
     SET actual_outcome = $1
     WHERE event_id = $2
     AND actual_outcome = 'alerted'
     AND created_at > NOW() - INTERVAL '2 hours'`,
    [outcome, eventId]
  );
}

export async function getTopSignals(sourceName: string): Promise<string[]> {
  try {
    const r = await pool.query(
      `SELECT unnest(signals) as signal, COUNT(*) as freq
       FROM signal_history
       WHERE source_name = $1
       AND actual_outcome = 'confirmed'
       AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY signal
       ORDER BY freq DESC
       LIMIT 10`,
      [sourceName]
    );
    return r.rows.map((row: any) => row.signal);
  } catch (_) {
    return [];
  }
}
