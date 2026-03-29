import { SignalResult, MetadataResult, SourceParser } from '../types';
import { GenericParser } from './generic';
import { extractMetadata } from '../metadata';

export const TicketmasterParser: SourceParser = {
  extractSignals(html: string): SignalResult {
    const base = GenericParser.extractSignals(html);
    const lower = html.toLowerCase();

    if (lower.includes('"offeringstatus":"available"') || lower.includes('offeringstatus":"available"')) {
      base.positiveSignals.push('tm:offering-available');
      base.confidence = Math.min(100, base.confidence + 20);
      base.status = 'available';
    }

    if (lower.includes('"offeringstatus":"unavailable"') || lower.includes('status":"soldout"')) {
      base.negativeSignals.push('tm:offering-unavailable');
      base.confidence = Math.max(0, base.confidence - 25);
      base.status = 'unavailable';
    }

    return base;
  },

  extractMetadata(html: string): MetadataResult {
    return extractMetadata(html);
  },
};
