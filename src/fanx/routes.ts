// FanX Express router. Mounted at /fanx by src/index.ts ONLY when
// FANX_ENABLED=true. All FanX pages and APIs live under this prefix so
// none of the SeatX routes are touched.

import express, { Request, Response, Router } from 'express';
import { pool } from '../db';
import { seedFanx, findCity, findStadium, listCities } from './seed';
import { renderLanding } from './render/landing';
import { renderDashboard } from './render/dashboard';
import { renderMatch } from './render/match';
import { renderCity } from './render/city';
import { renderAlerts } from './render/alerts';
import { renderPricing } from './render/pricing';
import { renderShareable } from './render/shareable';
import { analyze_intent } from './agent/skills/analyze-intent';
import { build_fan_context } from './agent/skills/build-fan-context';
import { score_opportunities } from './agent/skills/score-opportunities';
import { make_decision } from './agent/skills/make-decision';
import { generate_radar_response } from './agent/skills/generate-radar-response';
import { log_result } from './agent/skills/log-result';
import type { UserIntent, BudgetLevel, Priority } from './agent/context';

// ----- helpers -----

function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

function clampStr(v: unknown, max = 80): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function clampEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  if (typeof v !== 'string') return null;
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const BUDGETS = ['low', 'medium', 'high'] as const;
const PRIORITIES: readonly Priority[] = [
  'catch_ticket','stay_close','save_money','avoid_transport','fan_atmosphere','family','alt_match',
] as const;

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

// Per-IP rate limit just for FanX POSTs. Lightweight in-memory bucket.
const fxRate = new Map<string, { count: number; resetAt: number }>();
function fanxRateLimit(ip: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const e = fxRate.get(ip);
  if (!e || now > e.resetAt) { fxRate.set(ip, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}

// ----- radar pipeline -----

async function runAgent(intent: UserIntent, opts: { radar_id?: number | null }) {
  const analyzed = analyze_intent(intent);
  const ctx = await build_fan_context(intent, { radar_id: opts.radar_id ?? null });
  const scored = score_opportunities(ctx);
  const decision = make_decision(ctx, scored);
  const response = generate_radar_response(ctx, decision, scored);
  return { analyzed, ctx, scored, decision, response };
}

// ----- router -----

export function createFanxRouter(): Router {
  const r = express.Router();

  // Trigger seed once at first request (lazy + idempotent). The seeder is
  // safe to re-run — it uses ON CONFLICT DO NOTHING / row-count guards.
  let seeded = false;
  r.use(async (_req, _res, next) => {
    if (!seeded) {
      seeded = true;
      try { await seedFanx(); } catch (_) { /* swallow */ }
    }
    next();
  });

  // -- pages --

  r.get('/', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/html; charset=utf-8').send(renderLanding());
  });

  r.get('/radar', async (req: Request, res: Response) => {
    const slug = clampStr(req.query.s as any, 20);
    const demo = req.query.demo === '1';
    let intent: UserIntent;
    let radar_id: number | null = null;
    let team_label: string | null = null;
    let city_label: string | null = null;

    if (slug) {
      const rrow = await pool.query(
        `SELECT id, city, team, match_id, budget_level, priority, has_ticket, has_stay
           FROM fanx_radars WHERE public_slug = $1 LIMIT 1`,
        [slug]
      ).catch(() => ({ rows: [] as any[] }));
      const row = rrow.rows[0];
      if (row) {
        intent = {
          city: row.city, team: row.team, match_id: row.match_id,
          budget_level: row.budget_level as BudgetLevel | null,
          priority: row.priority as Priority | null,
        };
        radar_id = row.id;
        team_label = row.team || null;
        const c = row.city ? findCity(row.city) : null;
        city_label = c ? c.name_ar : (row.city || null);
      } else {
        intent = { city: null };
      }
    } else if (demo) {
      // Demo radar — pick the first city for illustration.
      const city = listCities()[0];
      intent = { city: city.slug, budget_level: 'medium', priority: 'catch_ticket' };
      city_label = city.name_ar;
    } else {
      intent = { city: null };
    }

    const { decision, response } = await runAgent(intent, { radar_id });
    await log_result({ radar_id, decision, outcome: 'shown' });
    res.set('Content-Type', 'text/html; charset=utf-8').send(
      renderDashboard({ response, is_demo: demo || !slug, city_label, team_label })
    );
  });

  r.get('/match/:matchId', async (req: Request, res: Response) => {
    const matchId = clampStr(req.params.matchId, 40) || 'unknown';
    // We don't have a matches table yet; intent.city is unknown for a bare
    // match link, so we let the agent fall back gracefully.
    const intent: UserIntent = { city: null, match_id: matchId };
    const { decision, response } = await runAgent(intent, { radar_id: null });
    await log_result({ radar_id: null, decision, outcome: 'shown' });
    res.set('Content-Type', 'text/html; charset=utf-8').send(
      renderMatch({ match_id: matchId, match_label: matchId, response })
    );
  });

  r.get('/city/:city', async (req: Request, res: Response) => {
    const slug = clampStr(req.params.city, 40) || '';
    const city = findCity(slug);
    if (!city) { res.status(404).send('City not found.'); return; }
    const intent: UserIntent = { city: city.slug, budget_level: 'medium', priority: 'stay_close' };
    const { response } = await runAgent(intent, { radar_id: null });
    const stadium = findStadium(city.slug);
    res.set('Content-Type', 'text/html; charset=utf-8').send(
      renderCity({ city, stadium_label: stadium ? stadium.name_ar : null, response })
    );
  });

  r.get('/alerts', async (_req: Request, res: Response) => {
    // No auth yet — render the form pre-populated with defaults. Save still
    // works when an email is provided.
    res.set('Content-Type', 'text/html; charset=utf-8').send(
      renderAlerts({
        email: null,
        whatsapp: null,
        prefs: {
          email_enabled: true, whatsapp_enabled: false, push_enabled: false,
          ticket_alerts: true, stay_alerts: false, transport_alerts: false,
          fan_zone_alerts: false, alternative_match_alerts: false,
        },
      })
    );
  });

  r.get('/pricing', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/html; charset=utf-8').send(renderPricing());
  });

  r.get('/radar/:slug', async (req: Request, res: Response) => {
    const slug = clampStr(req.params.slug, 20);
    if (!slug) { res.status(404).send('Not found'); return; }
    const rrow = await pool.query(
      `SELECT id, city, team, match_id, budget_level, priority
         FROM fanx_radars WHERE public_slug = $1 LIMIT 1`,
      [slug]
    ).catch(() => ({ rows: [] as any[] }));
    const row = rrow.rows[0];
    if (!row) { res.status(404).send('Not found'); return; }
    const intent: UserIntent = {
      city: row.city, team: row.team, match_id: row.match_id,
      budget_level: row.budget_level as BudgetLevel | null,
      priority: row.priority as Priority | null,
    };
    const { response } = await runAgent(intent, { radar_id: row.id });
    const c = row.city ? findCity(row.city) : null;
    res.set('Content-Type', 'text/html; charset=utf-8').send(
      renderShareable({
        slug,
        city_label: c ? c.name_ar : (row.city || null),
        team_label: row.team || null,
        response,
      })
    );
  });

  // -- APIs --

  r.post('/api/radar', async (req: Request, res: Response) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'anon');
    if (!fanxRateLimit(`radar:${ip}`)) { res.status(429).json({ error: 'rate_limited' }); return; }

    const body = (req.body || {}) as Record<string, unknown>;
    const city = clampStr(body.city, 40);
    const team = clampStr(body.team, 80);
    const budget_level = clampEnum<BudgetLevel>(body.budget_level, BUDGETS);
    const priority = clampEnum<Priority>(body.priority, PRIORITIES);
    const email = isEmail(body.email) ? (body.email as string) : null;
    const whatsapp = clampStr(body.whatsapp, 40);

    // Resolve or create the fanx_user (email-keyed; null email = anonymous radar).
    let user_id: number | null = null;
    if (email) {
      try {
        const existing = await pool.query(`SELECT id FROM fanx_users WHERE email=$1 LIMIT 1`, [email]);
        if (existing.rows.length) {
          user_id = existing.rows[0].id;
          if (whatsapp) {
            await pool.query(`UPDATE fanx_users SET whatsapp=$1 WHERE id=$2`, [whatsapp, user_id]).catch(()=>{});
          }
        } else {
          const ins = await pool.query(
            `INSERT INTO fanx_users (email, whatsapp) VALUES ($1,$2) RETURNING id`,
            [email, whatsapp]
          );
          user_id = ins.rows[0].id;
        }
      } catch (_) { /* swallow */ }
    }

    // Create radar row with a unique slug. Retry once on slug collision.
    let radar_id: number | null = null;
    let slug = randomSlug();
    try {
      const ins = await pool.query(
        `INSERT INTO fanx_radars (user_id, city, team, budget_level, priority, public_slug)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, public_slug`,
        [user_id, city, team, budget_level, priority, slug]
      );
      radar_id = ins.rows[0].id;
      slug = ins.rows[0].public_slug;
    } catch (_) {
      slug = randomSlug();
      try {
        const ins2 = await pool.query(
          `INSERT INTO fanx_radars (user_id, city, team, budget_level, priority, public_slug)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, public_slug`,
          [user_id, city, team, budget_level, priority, slug]
        );
        radar_id = ins2.rows[0].id;
        slug = ins2.rows[0].public_slug;
      } catch (_e) {
        res.status(500).json({ error: 'create_failed' });
        return;
      }
    }

    res.json({ ok: true, slug, radar_id });
  });

  r.post('/api/alert-prefs', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'anon');
    if (!fanxRateLimit(`prefs:${ip}`, 20)) { res.status(429).send('rate limited'); return; }
    const body = (req.body || {}) as Record<string, unknown>;
    const email = isEmail(body.email) ? (body.email as string) : null;
    if (!email) { res.redirect('/fanx/alerts'); return; }
    const whatsapp = clampStr(body.whatsapp, 40);
    let user_id: number | null = null;
    try {
      const existing = await pool.query(`SELECT id FROM fanx_users WHERE email=$1 LIMIT 1`, [email]);
      if (existing.rows.length) user_id = existing.rows[0].id;
      else {
        const ins = await pool.query(`INSERT INTO fanx_users (email, whatsapp) VALUES ($1,$2) RETURNING id`, [email, whatsapp]);
        user_id = ins.rows[0].id;
      }
    } catch (_) { /* swallow */ }

    if (user_id) {
      const flag = (k: string) => body[k] === 'on' || body[k] === 'true' || body[k] === '1';
      try {
        await pool.query(
          `INSERT INTO fanx_alert_preferences (user_id, email_enabled, whatsapp_enabled, push_enabled,
             ticket_alerts, stay_alerts, transport_alerts, fan_zone_alerts, alternative_match_alerts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (user_id) DO UPDATE SET
             email_enabled=EXCLUDED.email_enabled,
             whatsapp_enabled=EXCLUDED.whatsapp_enabled,
             push_enabled=EXCLUDED.push_enabled,
             ticket_alerts=EXCLUDED.ticket_alerts,
             stay_alerts=EXCLUDED.stay_alerts,
             transport_alerts=EXCLUDED.transport_alerts,
             fan_zone_alerts=EXCLUDED.fan_zone_alerts,
             alternative_match_alerts=EXCLUDED.alternative_match_alerts,
             updated_at=NOW()`,
          [
            user_id, flag('email_enabled'), flag('whatsapp_enabled'), flag('push_enabled'),
            flag('ticket_alerts'), flag('stay_alerts'), flag('transport_alerts'),
            flag('fan_zone_alerts'), flag('alternative_match_alerts'),
          ]
        );
      } catch (_) { /* swallow */ }
    }
    res.redirect('/fanx/alerts');
  });

  r.post('/api/waitlist', async (req: Request, res: Response) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'anon');
    if (!fanxRateLimit(`wait:${ip}`, 10)) { res.status(429).json({ error: 'rate_limited' }); return; }
    const body = (req.body || {}) as Record<string, unknown>;
    const email = isEmail(body.email) ? (body.email as string) : null;
    const plan = clampStr(body.plan, 40) || 'fanx_unknown';
    if (!email) { res.status(400).json({ error: 'invalid_email' }); return; }
    try {
      await pool.query(
        `INSERT INTO waitlist (email, plan) VALUES ($1,$2)
         ON CONFLICT (email, plan) DO NOTHING`,
        [email, plan]
      );
    } catch (_) { /* swallow */ }
    try {
      await pool.query(
        `INSERT INTO fanx_users (email) VALUES ($1)
         ON CONFLICT DO NOTHING`,
        [email]
      );
    } catch (_) { /* swallow */ }
    res.json({ ok: true });
  });

  return r;
}
