import { SignalResult, MetadataResult, SourceParser } from '../types';
import { extractMetadata } from '../metadata';

const POSITIVE = [
  { keyword: 'buy now', weight: 20 },
  { keyword: 'add to cart', weight: 20 },
  { keyword: 'select seats', weight: 25 },
  { keyword: 'get tickets', weight: 20 },
  { keyword: 'available', weight: 15 },
  { keyword: 'book now', weight: 20 },
  { keyword: 'purchase', weight: 15 },
  { keyword: 'choose seats', weight: 20 },
  { keyword: 'ticket types', weight: 18 },
  { keyword: 'add ticket', weight: 18 },
];

const NEGATIVE = [
  { keyword: 'sold out', weight: 45 },
  { keyword: 'unavailable', weight: 35 },
  { keyword: 'coming soon', weight: 25 },
  { keyword: 'not available', weight: 35 },
  { keyword: 'fully booked', weight: 45 },
  { keyword: 'tickets are no longer', weight: 40 },
  { keyword: 'event is over', weight: 50 },
];

function detectButtonSignals(html: string): string[] {
  const signals: string[] = [];
  const buttonMatches = html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi);
  for (const match of buttonMatches) {
    const full = match[0].toLowerCase();
    const text = match[1].replace(/<[^>]+>/g, '').toLowerCase().trim();
    const isDisabled = full.includes('disabled') || full.includes('aria-disabled="true"');
    const buyWords = ['buy', 'cart', 'ticket', 'seat', 'book', 'purchase', 'get'];
    if (buyWords.some(w => text.includes(w))) {
      signals.push(isDisabled ? `button:disabled:${text.slice(0, 40)}` : `button:enabled:${text.slice(0, 40)}`);
    }
  }
  return signals;
}

function detectDomSignals(html: string): string[] {
  const signals: string[] = [];
  const lower = html.toLowerCase();
  if (lower.includes('ticket-type') || lower.includes('tickettype')) signals.push('dom:ticket-types-section');
  if (lower.includes('seat-map') || lower.includes('seatmap')) signals.push('dom:seat-map-present');
  if (lower.includes('price-card') || lower.includes('pricetier')) signals.push('dom:price-cards');
  if (lower.includes('add-to-cart') || lower.includes('addtocart')) signals.push('dom:cart-section');
  if (/\d+\s+tickets?\s+left/i.test(html)) signals.push('dom:limited-availability');
  if (/\$[\d,]+|£[\d,]+|SAR\s*[\d,]+|ر\.س[\d,]+/i.test(html)) signals.push('dom:price-visible');
  return signals;
}

function detectAvailabilityHints(html: string): string[] {
  const hints: string[] = [];
  const text = html.replace(/<[^>]+>/g, ' ');
  const patterns = [
    /(\d+)\s+tickets?\s+(?:left|remaining|available)/i,
    /only\s+(\d+)\s+left/i,
    /(\d+)\s+seats?\s+available/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) hints.push(`hint:${m[0].trim().slice(0, 60)}`);
  }
  return hints;
}

export const GenericParser: SourceParser = {
  extractSignals(html: string): SignalResult {
    const lower = html.toLowerCase();
    const snippet = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400);

    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    let positiveScore = 0;
    let negativeScore = 0;

    for (const p of POSITIVE) {
      if (lower.includes(p.keyword)) {
        positiveSignals.push(p.keyword);
        positiveScore += p.weight;
      }
    }

    for (const n of NEGATIVE) {
      if (lower.includes(n.keyword)) {
        negativeSignals.push(n.keyword);
        negativeScore += n.weight;
      }
    }

    const buttonSignals = detectButtonSignals(html);
    const domSignals = detectDomSignals(html);
    const availabilityHints = detectAvailabilityHints(html);

    const enabledButtons = buttonSignals.filter(b => b.includes(':enabled:')).length;
    const disabledButtons = buttonSignals.filter(b => b.includes(':disabled:')).length;
    positiveScore += enabledButtons * 15;
    negativeScore += disabledButtons * 10;
    positiveScore += domSignals.length * 8;
    positiveScore += availabilityHints.length * 12;

    if (positiveScore > 0 && negativeScore > 30) {
      positiveScore = positiveScore * 0.6;
    }

    let status: 'available' | 'maybe_available' | 'unavailable' = 'unavailable';
    let confidence = 0;

    if (positiveScore > 0 && negativeScore === 0) {
      status = 'available';
      confidence = Math.min(100, Math.round(positiveScore));
    } else if (positiveScore > negativeScore) {
      status = 'maybe_available';
      confidence = Math.min(100, Math.round(positiveScore - negativeScore * 0.5));
    } else {
      status = 'unavailable';
      confidence = Math.min(100, Math.round(negativeScore));
    }

    return { status, confidence, positiveSignals, negativeSignals, buttonSignals, domSignals, availabilityHints, snippet };
  },

  extractMetadata(html: string): MetadataResult {
    return extractMetadata(html);
  },
};
