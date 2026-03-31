import { pool } from './db';
import { DemandBand, DemandResult } from './types';

function computeDemandBand(score: number): DemandBand {
  if (score >= 80) return 'very_high';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function computeDemandTrend(prev: number, current: number): string {
  if (current > prev + 5) return 'rising';
  if (current < prev - 5) return 'dropping';
  return 'stable';
}

export async function computeDemand(eventId: number): Promise<DemandResult> {
  const [watchersRes, transitionsRes, alertsRes, checksRes, recheckRes, prevRes] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM subscriptions WHERE event_id=$1', [eventId]),
    pool.query(
      `SELECT COUNT(*) FROM activity_logs
       WHERE event_id=$1 AND type='status_change'
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [eventId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM activity_logs
       WHERE event_id=$1 AND type='alert_sent'
       AND created_at > NOW() - INTERVAL '6 hours'`,
      [eventId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM event_checks
       WHERE event_id=$1
       AND checked_at > NOW() - INTERVAL '1 hour'`,
      [eventId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM event_checks
       WHERE event_id=$1
       AND checked_at > NOW() - INTERVAL '30 minutes'
       AND confidence > 50`,
      [eventId]
    ),
    pool.query('SELECT demand_score FROM events WHERE id=$1', [eventId]),
  ]);

  const watchers = parseInt(watchersRes.rows[0].count, 10);
  const transitions = parseInt(transitionsRes.rows[0].count, 10);
  const alerts = parseInt(alertsRes.rows[0].count, 10);
  const checks = parseInt(checksRes.rows[0].count, 10);
  const rechecks = parseInt(recheckRes.rows[0].count, 10);
  const prevScore = prevRes.rows[0]?.demand_score || 0;

  const watcherScore = Math.min(40, watchers * 2);
  const transitionScore = Math.min(25, transitions * 8);
  const alertScore = Math.min(15, alerts * 5);
  const activityScore = Math.min(10, checks / 10);
  const recheckScore = Math.min(10, rechecks * 3);

  const score = Math.round(watcherScore + transitionScore + alertScore + activityScore + recheckScore);
  const band = computeDemandBand(score);
  const trend = computeDemandTrend(prevScore, score);

  return { score, band, watchersCount: watchers, trend };
}

export async function updateDemand(eventId: number): Promise<void> {
  const prev = await pool.query(
    'SELECT demand_band, demand_score FROM events WHERE id=$1',
    [eventId]
  );
  const result = await computeDemand(eventId);

  const prevBand = prev.rows[0]?.demand_band;
  const priorityScore = result.band === 'very_high' ? 10
    : result.band === 'high' ? 8
    : result.band === 'medium' ? 5 : 2;

  const checkInterval = result.band === 'very_high' ? 10
    : result.band === 'high' ? 15
    : result.band === 'medium' ? 30 : 90;

  await pool.query(
    `UPDATE events SET
      watchers_count=$1, demand_score=$2, demand_band=$3,
      priority_score=$4, check_interval=$5
     WHERE id=$6`,
    [result.watchersCount, result.score, result.band, priorityScore, checkInterval, eventId]
  );

  if (prevBand && prevBand !== result.band) {
    await pool.query(
      `INSERT INTO activity_logs (event_id, type, message) VALUES ($1, $2, $3)`,
      [
        eventId,
        'demand_spike',
        `Demand moved from ${prevBand} to ${result.band} (score: ${result.score}, trend: ${result.trend})`
      ]
    );
  }

  // Log watcher spike
  if (result.watchersCount > (prev.rows[0]?.watchers_count || 0) + 5) {
    await pool.query(
      `INSERT INTO activity_logs (event_id, type, message) VALUES ($1, $2, $3)`,
      [
        eventId,
        'watcher_added',
        `${result.watchersCount} users now watching this event`
      ]
    );
  }
}

export async function getEventIntelligence(eventId: number): Promise<any> {
  const [eventRes, activityRes, checksRes] = await Promise.all([
    pool.query('SELECT * FROM events WHERE id=$1', [eventId]),
    pool.query(
      `SELECT COUNT(*) FROM activity_logs
       WHERE event_id=$1
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [eventId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM event_checks
       WHERE event_id=$1
       AND checked_at > NOW() - INTERVAL '1 hour'`,
      [eventId]
    ),
  ]);

  const event = eventRes.rows[0];
  if (!event) return null;

  const demand = await computeDemand(eventId);

  return {
    eventId,
    title: event.title,
    status: event.status,
    watchersCount: demand.watchersCount,
    demandScore: demand.score,
    demandBand: demand.band,
    demandTrend: demand.trend,
    recentActivityCount: parseInt(activityRes.rows[0].count, 10),
    recentChecks: parseInt(checksRes.rows[0].count, 10),
    lastMeaningfulChange: event.last_triggered_at,
    sourceReliability: event.source_reliability_score,
    heroImage: event.hero_image,
    eventDate: event.event_date,
    location: event.location,
  };
}
