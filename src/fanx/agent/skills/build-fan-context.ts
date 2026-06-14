// FanX skill 2 — build_fan_context.
// Async because it queries fanx_city_zones + fanx_opportunities. Pulls
// the seeded reference data plus any active opportunities for the user's
// city. Never invents teams or matches not in the seed.

import { pool } from '../../../db';
import { findCity, findStadium } from '../../seed';
import type {
  FanxContext, UserIntent, WorldCupContext, OpportunityContext,
  WorldCupZone, WorldCupOpp,
} from '../context';
import { emptyOpportunityContext, emptyMemory, emptyWorldCup } from '../context';

interface RawZone {
  zone_name: string;
  distance_label: string | null;
  transport_label: string | null;
  price_level: string | null;
  family_friendly: boolean;
  risk_level: string | null;
  notes: string | null;
}

interface RawOpp {
  id: number;
  type: string;
  title: string;
  description: string | null;
  price_label: string | null;
  distance_label: string | null;
  source_url: string | null;
  source_label: string | null;
  urgency: string | null;
  risk_level: string | null;
  confidence: string | number | null;
}

export interface BuildContextOptions {
  user_id?: number | null;
  radar_id?: number | null;
}

export async function build_fan_context(
  intent: UserIntent,
  opts: BuildContextOptions = {}
): Promise<FanxContext> {
  const world_cup = await loadWorldCup(intent);
  const opportunities = await loadOpportunities(intent);

  return {
    user_id: opts.user_id ?? null,
    radar_id: opts.radar_id ?? null,
    intent,
    trip: {},
    world_cup,
    opportunities,
    memory: emptyMemory(),
  };
}

async function loadWorldCup(intent: UserIntent): Promise<WorldCupContext> {
  if (!intent.city) return emptyWorldCup();
  const city = findCity(intent.city);
  if (!city) return emptyWorldCup();
  const stadium = findStadium(intent.city);

  let zones: WorldCupZone[] = [];
  try {
    const r = await pool.query<RawZone>(
      `SELECT zone_name, distance_label, transport_label, price_level,
              family_friendly, risk_level, notes
         FROM fanx_city_zones
        WHERE city = $1
        ORDER BY id ASC
        LIMIT 8`,
      [intent.city]
    );
    zones = r.rows.map(z => ({
      zone_name: z.zone_name,
      distance_label: z.distance_label,
      transport_label: z.transport_label,
      price_level: z.price_level,
      family_friendly: !!z.family_friendly,
      risk_level: z.risk_level,
      notes: z.notes,
    }));
  } catch (_) { /* swallow */ }

  return {
    city: intent.city,
    stadium: stadium ? stadium.name_ar : null,
    match_id: intent.match_id ?? null,
    teams: intent.team ? [intent.team] : [],
    match_label: null,
    zones,
    fan_zones: [],
    alt_matches: [],
  };
}

async function loadOpportunities(intent: UserIntent): Promise<OpportunityContext> {
  const ctx = emptyOpportunityContext();
  if (!intent.city) return ctx;
  try {
    const r = await pool.query<RawOpp>(
      `SELECT id, type, title, description, price_label, distance_label,
              source_url, source_label, urgency, risk_level, confidence
         FROM fanx_opportunities
        WHERE is_active = TRUE
          AND (city = $1 OR city IS NULL)
        ORDER BY confidence DESC NULLS LAST, id ASC
        LIMIT 40`,
      [intent.city]
    );
    for (const o of r.rows) {
      const opp: WorldCupOpp = {
        id: o.id,
        type: o.type,
        title: o.title,
        description: o.description,
        price_label: o.price_label,
        distance_label: o.distance_label,
        source_url: o.source_url,
        source_label: o.source_label,
        urgency: o.urgency,
        risk_level: o.risk_level,
        confidence: o.confidence === null ? null : Number(o.confidence),
      };
      switch (o.type) {
        case 'ticket':            ctx.tickets.push(opp); break;
        case 'stay':              ctx.stay.push(opp); break;
        case 'transport':         ctx.transport.push(opp); break;
        case 'fan_zone':          ctx.fan_zones.push(opp); break;
        case 'alternative_match': ctx.alt_matches.push(opp); break;
        case 'warning':           ctx.warnings.push(opp); break;
        case 'city_tip':          ctx.city_tips.push(opp); break;
      }
    }
  } catch (_) { /* swallow */ }
  return ctx;
}
