import { SignalResult, MetadataResult, SourceParser } from '../types';
import { GenericParser } from './generic';
import { extractMetadata } from '../metadata';

export const WebookParser: SourceParser = {
  extractSignals(html: string): SignalResult {
    const base = GenericParser.extractSignals(html);
    const lower = html.toLowerCase();

    if (lower.includes('sold-out') || lower.includes('"soldout"') || lower.includes('class="sold')) {
      base.negativeSignals.push('webook:sold-out-class');
      base.confidence = Math.max(0, base.confidence - 20);
      base.status = 'unavailable';
    }

    if (lower.includes('btn-buy') || lower.includes('buy-button') || lower.includes('checkout-btn')) {
      base.positiveSignals.push('webook:buy-button-detected');
      base.confidence = Math.min(100, base.confidence + 15);
      if (base.status === 'unavailable') base.status = 'maybe_available';
    }

    return base;
  },

  extractMetadata(html: string): MetadataResult {
    return extractMetadata(html);
  },
};
