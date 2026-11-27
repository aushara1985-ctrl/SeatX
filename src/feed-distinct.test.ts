import test from 'node:test';
import assert from 'node:assert';
import { distinctFeed, tickerMessages, countDistinctEvents } from './feed-distinct';

const dup = (n: number) => Array.from({ length: n }, (_, i) => ({
  eventId: 1, type: 'metadata_updated', message: '🎫 Al Nassr vs Al Hilal — معلومات الفعالية محدّثة', createdAt: i,
}));

test('40 duplicate housekeeping rows produce nothing, ticker hidden', () => {
  const f = distinctFeed(dup(40));
  assert.strictEqual(f.length, 0);
  assert.deepStrictEqual(tickerMessages(f), []);
});
test('repeated same event+kind collapses; single item hides ticker', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ eventId: 1, type: 'status_change', message: '🔄 same', createdAt: i }));
  const f = distinctFeed(rows);
  assert.strictEqual(f.length, 1);
  assert.deepStrictEqual(tickerMessages(f), []);
});
test('two distinct items show once each', () => {
  const f = distinctFeed([
    { eventId: 1, type: 'status_change', message: 'a' }, { eventId: 1, type: 'status_change', message: 'a2' },
    { eventId: 2, type: 'alert_sent', message: 'b' }, { eventId: 2, type: 'metadata_updated', message: 'c' },
  ]);
  assert.deepStrictEqual(tickerMessages(f), ['a', 'b']);
});
test('distinct events count', () => {
  assert.strictEqual(countDistinctEvents([{ id: 1 }, { id: 1 }, { id: 2 }]), 2);
});
