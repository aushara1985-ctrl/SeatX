import { pool } from './db';

export interface SourceReliability {
  sourceName: string;
  totalChecks: number;
  successChecks: number;
  errorChecks: number;
  falsePositives: number;
  reliabilityScore: number;
}

export async function getSourceReliability(sourceName: string): Promise<number> {
  try {
    const r = await pool.query(
      'SELECT * FROM source_stats WHERE source_name=$1',
      [sourceName]
    );
    if (!r.rows[0]) return 0.8;
    const s = r.rows[0];
    const total = s.total_checks || 1;
    const errors = s.error_checks || 0;
    const fp = s.false_positive_count || 0;
    const score = Math.max(0, Math.min(1, 1 - (errors + fp * 2) / total));
    return score;
  } catch (_) {
    return 0.8;
  }
}

export async function recordSuccess(sourceName: string): Promise<void> {
  await pool.query(
    `INSERT INTO source_stats (source_name, total_checks, success_checks)
     VALUES ($1, 1, 1)
     ON CONFLICT (source_name) DO UPDATE SET
       total_checks = source_stats.total_checks + 1,
       success_checks = source_stats.success_checks + 1,
       reliability_score = LEAST(100, source_stats.reliability_score + 1),
       updated_at = NOW()`,
    [sourceName]
  );
}

export async function recordError(sourceName: string): Promise<void> {
  await pool.query(
    `INSERT INTO source_stats (source_name, total_checks, error_checks)
     VALUES ($1, 1, 1)
     ON CONFLICT (source_name) DO UPDATE SET
       total_checks = source_stats.total_checks + 1,
       error_checks = source_stats.error_checks + 1,
       reliability_score = GREATEST(0, source_stats.reliability_score - 2),
       updated_at = NOW()`,
    [sourceName]
  );
}

export async function recordFalsePositive(sourceName: string): Promise<void> {
  await pool.query(
    `INSERT INTO source_stats (source_name, total_checks, false_positive_count)
     VALUES ($1, 1, 1)
     ON CONFLICT (source_name) DO UPDATE SET
       false_positive_count = source_stats.false_positive_count + 1,
       reliability_score = GREATEST(0, source_stats.reliability_score - 5),
       updated_at = NOW()`,
    [sourceName]
  );
}

export async function getAllSourceStats(): Promise<SourceReliability[]> {
  const r = await pool.query('SELECT * FROM source_stats ORDER BY reliability_score DESC');
  return r.rows.map(s => ({
    sourceName: s.source_name,
    totalChecks: s.total_checks,
    successChecks: s.success_checks,
    errorChecks: s.error_checks,
    falsePositives: s.false_positive_count,
    reliabilityScore: s.reliability_score / 100,
  }));
}
