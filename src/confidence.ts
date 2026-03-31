import { getSourceReliability } from './reliability';
import { getSignalWeight } from './learning';
import { SignalResult } from './types';

export interface ConfidenceResult {
  score: number;
  shouldAlert: boolean;
  shouldRecheck: boolean;
  reason: string;
}

const ALERT_THRESHOLD = 72;
const RECHECK_LOW = 50;
const RECHECK_HIGH = 72;

export async function computeConfidence(
  signals: SignalResult,
  sourceName: string
): Promise<ConfidenceResult> {
  const baseScore = signals.confidence;

  // Source reliability modifier
  const reliability = await getSourceReliability(sourceName);
  const reliabilityModifier = (reliability - 0.8) * 20;

  // Signal weight from learning
  const allSignals = [
    ...signals.positiveSignals,
    ...signals.buttonSignals.filter(b => b.includes(':enabled:')),
    ...signals.domSignals,
    ...signals.availabilityHints,
  ];
  const signalWeight = await getSignalWeight(allSignals, sourceName);
  const weightModifier = (signalWeight - 1.0) * 15;

  // Noise penalty
  let noisePenalty = 0;
  if (signals.negativeSignals.length > 0 && signals.positiveSignals.length > 0) {
    noisePenalty = signals.negativeSignals.length * 8;
  }

  // Ambiguity penalty
  let ambiguityPenalty = 0;
  if (signals.positiveSignals.length > 0 && signals.confidence < 40) {
    ambiguityPenalty = 10;
  }

  // Disabled button penalty
  const disabledButtons = signals.buttonSignals.filter(b => b.includes(':disabled:')).length;
  const buttonPenalty = disabledButtons * 12;

  // Strong negative override
  const strongNegatives = signals.negativeSignals.filter(s =>
    ['sold out', 'fully booked', 'event is over'].includes(s)
  );
  if (strongNegatives.length > 0) {
    return {
      score: 0,
      shouldAlert: false,
      shouldRecheck: false,
      reason: 'Strong negative override: ' + strongNegatives.join(', '),
    };
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(
    baseScore
    + reliabilityModifier
    + weightModifier
    - noisePenalty
    - ambiguityPenalty
    - buttonPenalty
  )));

  const shouldAlert = finalScore >= ALERT_THRESHOLD;
  const shouldRecheck = !shouldAlert && finalScore >= RECHECK_LOW && finalScore < RECHECK_HIGH;

  return {
    score: finalScore,
    shouldAlert,
    shouldRecheck,
    reason: shouldAlert
      ? 'High confidence detection'
      : shouldRecheck
        ? 'Borderline — recheck needed'
        : 'Low confidence — skipped',
  };
}
