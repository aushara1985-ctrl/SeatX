import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function setupDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      event_url TEXT NOT NULL,
      status TEXT DEFAULT 'unavailable',
      last_status TEXT DEFAULT 'unavailable',
      last_triggered_at TIMESTAMPTZ,
      last_page_hash TEXT,
      source_name TEXT,
      source_logo TEXT,
      hero_image TEXT,
      event_date TEXT,
      location TEXT,
      watchers_count INTEGER DEFAULT 0,
      demand_score INTEGER DEFAULT 0,
      demand_band TEXT DEFAULT 'low',
      priority_score INTEGER DEFAULT 5,
      check_interval INTEGER DEFAULT 15,
      next_check_at TIMESTAMPTZ,
      recent_transition_count INTEGER DEFAULT 0,
      recent_signal_strength INTEGER DEFAULT 0,
      source_reliability_score INTEGER DEFAULT 80,
      metadata_last_updated_at TIMESTAMPTZ,
      last_checked TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(event_id, email)
    );

    CREATE TABLE IF NOT EXISTS event_checks (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      detected_status TEXT,
      page_hash TEXT,
      positive_signals TEXT[],
      negative_signals TEXT[],
      button_signals TEXT[],
      dom_signals TEXT[],
      snippet TEXT,
      confidence INTEGER,
      response_time INTEGER,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS source_stats (
      id SERIAL PRIMARY KEY,
      source_name TEXT UNIQUE NOT NULL,
      total_checks INTEGER DEFAULT 0,
      success_checks INTEGER DEFAULT 0,
      error_checks INTEGER DEFAULT 0,
      false_positive_count INTEGER DEFAULT 0,
      reliability_score INTEGER DEFAULT 80,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS signal_history (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      source_name TEXT,
      signals TEXT[],
      detected_status TEXT,
      actual_outcome TEXT,
      confidence INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      plan TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(email, plan)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_push_email ON push_subscriptions(email);

    -- Queue Mode submissions: user is stuck in someone else's queue and
    -- wants us to watch for a SECOND opportunity on the same event
    -- (another link, new drop, different package). We never claim to jump
    -- the queue. See docs/design.md and the customer-facing disclaimer.
    CREATE TABLE IF NOT EXISTS queue_watch (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      event_name TEXT NOT NULL,
      source TEXT,
      queue_position TEXT,
      queue_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_qw_email ON queue_watch(email);
    CREATE INDEX IF NOT EXISTS idx_qw_created ON queue_watch(created_at DESC);

    -- Phase 2 Smart Detection Agent — Context Layer (rule-based, no AI).
    -- Persists per-event memory so the detection agent can decide whether a
    -- detected change is meaningful enough to alert users on. No prediction,
    -- no personalization, no queue bypass — see CLAUDE.md product rules.
    CREATE TABLE IF NOT EXISTS event_memory (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      source TEXT,
      last_known_status TEXT,
      last_known_availability TEXT,
      last_meaningful_change_at TIMESTAMPTZ,
      last_checked_at TIMESTAMPTZ,
      false_positive_count INTEGER DEFAULT 0,
      alert_count INTEGER DEFAULT 0,
      notes_json JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(event_id, source)
    );
    CREATE INDEX IF NOT EXISTS idx_em_event ON event_memory(event_id);
    CREATE INDEX IF NOT EXISTS idx_em_source ON event_memory(source);

    -- Per-source reliability memory. Mirrors source_stats at a higher
    -- semantic level used by the detection agent's decision step.
    CREATE TABLE IF NOT EXISTS source_memory (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL UNIQUE,
      domain TEXT,
      reliability_score INTEGER DEFAULT 80,
      successful_signals INTEGER DEFAULT 0,
      false_signals INTEGER DEFAULT 0,
      last_false_positive_at TIMESTAMPTZ,
      requires_confirmation BOOLEAN DEFAULT FALSE,
      min_confidence_to_alert NUMERIC(3,2) DEFAULT 0.70,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sm_domain ON source_memory(domain);

    -- Every alert decision made by the agent — sent or not. Allows audit and
    -- false-positive learning without faking activity. Free INTEGER columns
    -- (no FK) on watch_request_id / queue_watch_id so partial logs never
    -- crash the agent if the referenced row is gone.
    CREATE TABLE IF NOT EXISTS alert_events (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_email TEXT,
      watch_request_id INTEGER,
      queue_watch_id INTEGER,
      decision TEXT NOT NULL,
      opportunity_type TEXT,
      confidence NUMERIC(3,2),
      reason TEXT,
      channel TEXT,
      outcome TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ae_event ON alert_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_ae_email ON alert_events(user_email);
    CREATE INDEX IF NOT EXISTS idx_ae_created ON alert_events(created_at DESC);
  `);

  const migrations = [
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS demand_band TEXT DEFAULT 'low'`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS recent_transition_count INTEGER DEFAULT 0`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS recent_signal_strength INTEGER DEFAULT 0`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS source_reliability_score INTEGER DEFAULT 80`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata_last_updated_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS last_status TEXT DEFAULT 'unavailable'`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS last_page_hash TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS source_name TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS source_logo TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS hero_image TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS watchers_count INTEGER DEFAULT 0`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS demand_score INTEGER DEFAULT 0`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 5`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS check_interval INTEGER DEFAULT 15`,
    `ALTER TABLE event_checks ADD COLUMN IF NOT EXISTS button_signals TEXT[]`,
    `ALTER TABLE event_checks ADD COLUMN IF NOT EXISTS dom_signals TEXT[]`,
    `ALTER TABLE event_checks ADD COLUMN IF NOT EXISTS confidence INTEGER`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free'`,
`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS monitoring_status TEXT DEFAULT 'pending'`,
`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ`,
  ];

  for (const m of migrations) {
    try { await pool.query(m); } catch (_) {}
  }

  console.log('[db] Schema ready');
}

  export async function getActiveEventCount(email: string): Promise<number> {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) FROM subscriptions WHERE email=$1 AND monitoring_status='active'`,
      [email]
    );
    return parseInt(r.rows[0].count, 10);
  } catch (_) { return 0; }
}
