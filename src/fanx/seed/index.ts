// FanX seeder — idempotent. Safe to call on every boot when FANX_ENABLED.
// Uses INSERT ... ON CONFLICT DO NOTHING / unique constraints to avoid
// duplicate rows. Never deletes existing FanX rows.

import { pool } from '../../db';
import { FANX_CITIES, FANX_STADIUMS, FANX_ZONES } from './cities';
import { FANX_OPPORTUNITIES } from './opportunities';

export async function seedFanx(): Promise<void> {
  // Zones first — they are the only seed rows we own with a UNIQUE constraint.
  // (Cities + stadiums don't need their own table; we surface them via
  // constants for now to avoid schema churn before user data exists.)
  try {
    for (const z of FANX_ZONES) {
      const stadium_label = lookupStadiumLabel(z.city_slug, z.stadium_en);
      await pool.query(
        `INSERT INTO fanx_city_zones
           (city, stadium, zone_name, distance_label, transport_label,
            price_level, family_friendly, risk_level, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (city, stadium, zone_name) DO NOTHING`,
        [
          z.city_slug,
          stadium_label,
          z.zone_name,
          z.distance_label,
          z.transport_label,
          z.price_level,
          z.family_friendly,
          z.risk_level,
          z.notes,
        ]
      );
    }
  } catch (e: any) {
    console.warn('[fanx-seed] zone seed warn:', e?.message || e);
  }

  // Opportunities — seed only once per (city, type, title) tuple. We don't
  // have a unique constraint here (titles may legitimately recur once curated
  // workflows exist), so we guard by counting current rows.
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM fanx_opportunities WHERE confidence IS NOT NULL`
    );
    const existing = r.rows?.[0]?.c ?? 0;
    if (existing === 0) {
      for (const o of FANX_OPPORTUNITIES) {
        const stadium_label = o.stadium ? o.stadium : null;
        await pool.query(
          `INSERT INTO fanx_opportunities
             (type, city, stadium, match_id, team, title, description,
              price_label, distance_label, source_url, source_label,
              urgency, risk_level, confidence, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)`,
          [
            o.type,
            o.city,
            stadium_label,
            o.match_id ?? null,
            o.team ?? null,
            o.title,
            o.description,
            o.price_label ?? null,
            o.distance_label ?? null,
            o.source_url ?? null,
            o.source_label ?? null,
            o.urgency,
            o.risk_level,
            o.confidence,
          ]
        );
      }
      console.log(`[fanx-seed] seeded ${FANX_OPPORTUNITIES.length} opportunities`);
    }
  } catch (e: any) {
    console.warn('[fanx-seed] opportunity seed warn:', e?.message || e);
  }
}

function lookupStadiumLabel(city_slug: string, stadium_en: string): string {
  const match = FANX_STADIUMS.find(
    s => s.city_slug === city_slug && s.name_en === stadium_en
  );
  return match ? match.name_ar : stadium_en;
}

export function listCities() { return FANX_CITIES; }
export function listStadiums() { return FANX_STADIUMS; }
export function findCity(slug: string) { return FANX_CITIES.find(c => c.slug === slug) || null; }
export function findStadium(city_slug: string) {
  return FANX_STADIUMS.find(s => s.city_slug === city_slug) || null;
}
