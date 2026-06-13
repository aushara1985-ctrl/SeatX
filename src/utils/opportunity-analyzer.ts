// Phase 2 Smart Detection Agent — opportunity analyzer.
//
// Pure rule-based. No AI calls, no fake demand, no fake watcher counts, no
// sell-out predictions. Compares a previous snapshot of an event/source to
// the current one and returns whether the change is a real opportunity worth
// alerting on. Conservative by design — fewer accurate alerts beat noisy
// ones. See CLAUDE.md product rules.

export type OpportunityType =
  | 'seats_returned'
  | 'sale_opened'
  | 'new_drop'
  | 'official_link_changed'
  | 'package_available'
  | 'queue_removed'
  | 'status_changed'
  | 'unknown';

export interface EventStateSnapshot {
  status?: string | null;            // 'available' | 'maybe_available' | 'unavailable' | 'sold_out' | ...
  availability?: string | null;       // free-form text, e.g. 'sold_out', 'temporarily_unavailable', 'available'
  hasBuyButton?: boolean | null;
  officialUrl?: string | null;
  packageLabel?: string | null;       // current ticket package (e.g. 'VIP', 'Cat A')
  inQueue?: boolean | null;           // true if user is/was held in a queue
  pageText?: string | null;           // raw text for text-only comparison
  pageHash?: string | null;           // hash of page body for cheap diff
}

export interface OpportunityResult {
  changed: boolean;
  opportunity_type: OpportunityType;
  confidence: number;            // 0..1
  reason: string;
  requires_confirmation: boolean;
}

function norm(s?: string | null): string {
  return (s || '').toString().trim().toLowerCase();
}

function isUnavailable(v: string): boolean {
  return (
    v === 'sold_out' ||
    v === 'soldout' ||
    v === 'unavailable' ||
    v === 'not_available' ||
    v === 'sold-out' ||
    v === 'sold out'
  );
}

function isAvailable(v: string): boolean {
  return v === 'available' || v === 'on_sale' || v === 'in_stock';
}

function isTemporarilyUnavailable(v: string): boolean {
  return (
    v === 'temporarily_unavailable' ||
    v === 'temp_unavailable' ||
    v === 'maybe_available' ||
    v === 'hold' ||
    v === 'on_hold' ||
    v === 'paused'
  );
}

export function analyze_event_change(
  previousState: EventStateSnapshot | null | undefined,
  currentState: EventStateSnapshot | null | undefined
): OpportunityResult {
  const prev = previousState || {};
  const curr = currentState || {};

  if (!previousState) {
    // No prior memory — record current state but do not treat as opportunity.
    return {
      changed: false,
      opportunity_type: 'unknown',
      confidence: 0,
      reason: 'no_previous_state_recorded',
      requires_confirmation: true,
    };
  }

  const prevAvail = norm(prev.availability ?? prev.status);
  const currAvail = norm(curr.availability ?? curr.status);

  // RULE 1: sold_out → available is the canonical strong signal.
  if (isUnavailable(prevAvail) && isAvailable(currAvail)) {
    return {
      changed: true,
      opportunity_type: 'seats_returned',
      confidence: 0.92,
      reason: 'transition_sold_out_to_available',
      requires_confirmation: false,
    };
  }

  // RULE 2: any → available where it wasn't before — sale opened.
  if (!isAvailable(prevAvail) && isAvailable(currAvail)) {
    return {
      changed: true,
      opportunity_type: 'sale_opened',
      confidence: 0.85,
      reason: 'transition_to_available',
      requires_confirmation: false,
    };
  }

  // RULE 3: buy button appeared = strong signal even without status flip.
  if (prev.hasBuyButton === false && curr.hasBuyButton === true) {
    return {
      changed: true,
      opportunity_type: 'sale_opened',
      confidence: 0.88,
      reason: 'buy_button_appeared',
      requires_confirmation: false,
    };
  }

  // RULE 4: new official URL (or package) appeared = medium/high signal,
  // requires confirmation because URL swaps can be cosmetic.
  if (
    prev.officialUrl &&
    curr.officialUrl &&
    norm(prev.officialUrl) !== norm(curr.officialUrl)
  ) {
    return {
      changed: true,
      opportunity_type: 'official_link_changed',
      confidence: 0.72,
      reason: 'official_url_changed',
      requires_confirmation: true,
    };
  }

  if (
    !norm(prev.packageLabel) &&
    norm(curr.packageLabel)
  ) {
    return {
      changed: true,
      opportunity_type: 'package_available',
      confidence: 0.7,
      reason: 'new_package_appeared',
      requires_confirmation: true,
    };
  }

  // RULE 5: queue lifted (was in queue, now not). NOT queue bypass — only a
  // signal that the official flow re-opened. Generator must phrase this
  // without implying bypass.
  if (prev.inQueue === true && curr.inQueue === false) {
    return {
      changed: true,
      opportunity_type: 'queue_removed',
      confidence: 0.78,
      reason: 'queue_was_active_now_inactive',
      requires_confirmation: true,
    };
  }

  // RULE 6: unavailable → temporarily_unavailable = weak signal (something
  // moved on the source side but we don't know if it's a real opening).
  if (isUnavailable(prevAvail) && isTemporarilyUnavailable(currAvail)) {
    return {
      changed: true,
      opportunity_type: 'status_changed',
      confidence: 0.35,
      reason: 'transition_unavailable_to_temporarily_unavailable',
      requires_confirmation: true,
    };
  }

  // RULE 7: any other status transition we did not match — weak status change.
  if (prevAvail && currAvail && prevAvail !== currAvail) {
    return {
      changed: true,
      opportunity_type: 'status_changed',
      confidence: 0.4,
      reason: `status_transition_${prevAvail}_to_${currAvail}`,
      requires_confirmation: true,
    };
  }

  // RULE 8: text-only change (page hash / text moved but no status flip).
  // Treated as low confidence — a banner edit or footer date can move the
  // hash without anything meaningful happening.
  const prevHash = norm(prev.pageHash);
  const currHash = norm(curr.pageHash);
  const prevText = (prev.pageText || '').length;
  const currText = (curr.pageText || '').length;
  if (
    (prevHash && currHash && prevHash !== currHash) ||
    (!prevHash && !currHash && prevText > 0 && currText > 0 && prevText !== currText)
  ) {
    return {
      changed: true,
      opportunity_type: 'unknown',
      confidence: 0.2,
      reason: 'text_only_change',
      requires_confirmation: true,
    };
  }

  return {
    changed: false,
    opportunity_type: 'unknown',
    confidence: 0,
    reason: 'no_meaningful_change',
    requires_confirmation: false,
  };
}
