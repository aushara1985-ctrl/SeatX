// Pure helpers: the public feed/ticker must show DISTINCT real items only.
// Housekeeping rows (metadata_updated, written every monitor cycle) are not market
// movement, and repeated rows of the same kind for the same event collapse to the latest.
export const HOUSEKEEPING_TYPES = ['metadata_updated'];

export function distinctFeed<T extends { eventId?: number | null; type: string; message?: string; createdAt?: any }>(
  items: T[],
  limit = 20
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (HOUSEKEEPING_TYPES.includes(it.type)) continue;
    const key = `${it.eventId ?? 'x'}|${it.type}`;
    const msgKey = `m|${(it.message || '').trim()}`;
    if (seen.has(key) || seen.has(msgKey)) continue;
    seen.add(key);
    seen.add(msgKey);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

// Ticker shows only when there are at least 2 distinct real items. Never padded.
export function tickerMessages(feed: { message?: string }[], max = 8): string[] {
  const msgs = Array.from(new Set(feed.map(f => (f.message || '').trim()).filter(Boolean))).slice(0, max);
  return msgs.length >= 2 ? msgs : [];
}

export function countDistinctEvents(events: { id?: number; title?: string; event_url?: string }[]): number {
  return new Set(events.map(e => e.id ?? `${e.title}|${e.event_url}`)).size;
}
