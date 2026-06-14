// FanX Opportunity Agent — Context Layer types.
//
// Pure data shape definitions. The Context Layer is what every skill
// receives. It is built from: user intent (from onboarding modal),
// trip status (optional), World Cup reference data (seeded), curated
// opportunities (fanx_opportunities), and memory (prior decisions/events).
//
// Rules: no fake fields, no AI-generated values, no hallucinated prices.
// Anything we don't know is null/undefined and a fallback fires downstream.

export type BudgetLevel = 'low' | 'medium' | 'high';

export type Priority =
  | 'catch_ticket'
  | 'stay_close'
  | 'save_money'
  | 'avoid_transport'
  | 'fan_atmosphere'
  | 'family'
  | 'alt_match';

export type Arrival = 'already_there' | 'arriving_soon' | 'planning';
export type TriState = 'true' | 'false' | 'unknown';

export interface UserIntent {
  city?: string | null;            // city slug
  team?: string | null;
  match_id?: string | null;
  budget_level?: BudgetLevel | null;
  priority?: Priority | null;
  arrival?: Arrival | null;
}

export interface TripStatus {
  has_ticket?: TriState;
  has_stay?: TriState;
  stay_area?: string | null;
  group_flag?: boolean;
}

export interface WorldCupContext {
  city?: string | null;
  stadium?: string | null;
  match_id?: string | null;
  teams?: string[];
  match_label?: string | null;     // user-readable; never fabricated
  zones: WorldCupZone[];
  fan_zones: WorldCupOpp[];
  alt_matches: WorldCupOpp[];
}

export interface WorldCupZone {
  zone_name: string;
  distance_label: string | null;
  transport_label: string | null;
  price_level: string | null;
  family_friendly: boolean;
  risk_level: string | null;
  notes: string | null;
}

export interface WorldCupOpp {
  id?: number;
  type: string;
  title: string;
  description: string | null;
  price_label?: string | null;
  distance_label?: string | null;
  source_url?: string | null;
  source_label?: string | null;
  urgency?: string | null;
  risk_level?: string | null;
  confidence?: number | null;
}

export interface OpportunityContext {
  tickets: WorldCupOpp[];
  stay: WorldCupOpp[];
  transport: WorldCupOpp[];
  fan_zones: WorldCupOpp[];
  alt_matches: WorldCupOpp[];
  warnings: WorldCupOpp[];
  city_tips: WorldCupOpp[];
}

export interface AgentMemory {
  prev_decisions: any[];
  alerts_sent: any[];
  clicks: any[];
  saved: any[];
  ignored: any[];
}

export interface FanxContext {
  user_id?: number | null;
  radar_id?: number | null;
  intent: UserIntent;
  trip: TripStatus;
  world_cup: WorldCupContext;
  opportunities: OpportunityContext;
  memory: AgentMemory;
}

export function emptyOpportunityContext(): OpportunityContext {
  return {
    tickets: [], stay: [], transport: [],
    fan_zones: [], alt_matches: [], warnings: [], city_tips: [],
  };
}

export function emptyMemory(): AgentMemory {
  return { prev_decisions: [], alerts_sent: [], clicks: [], saved: [], ignored: [] };
}

export function emptyWorldCup(): WorldCupContext {
  return {
    city: null, stadium: null, match_id: null,
    teams: [], match_label: null,
    zones: [], fan_zones: [], alt_matches: [],
  };
}
