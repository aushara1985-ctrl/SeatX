// FanX skill 1 — analyze_intent.
// Pure function. Reads onboarding inputs, classifies intent, flags missing
// fields. No DB, no AI.

import type { UserIntent } from '../context';

export type IntentType =
  | 'follow_team'
  | 'catch_match'
  | 'explore_city'
  | 'best_opportunity_today'
  | 'knockout_round';

export type IntentUrgency = 'now' | 'today' | 'this_week' | 'later';

export interface AnalyzedIntent {
  intent_type: IntentType;
  urgency: IntentUrgency;
  missing_fields: string[];
  confidence: number;       // 0..1
}

export function analyze_intent(input: UserIntent): AnalyzedIntent {
  const missing: string[] = [];
  if (!input.city) missing.push('city');
  if (!input.budget_level) missing.push('budget_level');
  if (!input.priority) missing.push('priority');

  let intent_type: IntentType;
  if (input.match_id) {
    intent_type = 'catch_match';
  } else if (input.team) {
    intent_type = 'follow_team';
  } else if (input.city && !input.team && !input.match_id) {
    intent_type = 'explore_city';
  } else {
    intent_type = 'best_opportunity_today';
  }

  let urgency: IntentUrgency = 'this_week';
  if (input.arrival === 'already_there') urgency = 'today';
  else if (input.arrival === 'arriving_soon') urgency = 'this_week';
  else if (input.arrival === 'planning') urgency = 'later';

  // Confidence drops with each missing field, floors at 0.3.
  const base = 0.9;
  const drop = Math.min(0.6, missing.length * 0.2);
  const confidence = Math.max(0.3, base - drop);

  return { intent_type, urgency, missing_fields: missing, confidence };
}
