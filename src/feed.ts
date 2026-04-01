import { pool } from './db';
import { ActivityFeedItem, ActivityType } from './types';

const TYPE_EMOJI: Record<ActivityType, string> = {
  watcher_added: '👥',
  status_change: '🔄',
  alert_sent: '⚡',
  demand_spike: '🔥',
  page_change: '📄',
  metadata_updated: '🎫',
  watcher_spike: '📈',
  availability_detected: '✅',
  recheck_confirmed: '🔁',
  source_unstable: '⚠️',
};

export async function getActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
  const r = await pool.query(
    `SELECT al.id, al.event_id, al.type, al.message, al.created_at, e.title as event_title
     FROM activity_logs al
     LEFT JOIN events e ON e.id = al.event_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return r.rows.map(row => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.event_title || 'Unknown event',
    type: row.type as ActivityType,
    message: formatMessage(row.type, row.message, row.event_title),
    createdAt: row.created_at,
  }));
}

function formatMessage(type: string, raw: string, eventTitle: string): string {
  const emoji = TYPE_EMOJI[type as ActivityType] || '•';
  return `${emoji} ${raw}`;
}

export async function logActivity(
  eventId: number,
  type: ActivityType,
  message: string
): Promise<void> {
  await pool.query(
    `INSERT INTO activity_logs (event_id, type, message) VALUES ($1, $2, $3)`,
    [eventId, type, message]
  );
}
