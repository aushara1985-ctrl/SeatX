import test from 'node:test';
import assert from 'node:assert';
import { referralTotalDays, referralFriendDays, parseRefCode, referralProgressLine, referralShareText } from './referral-policy';
import { qualifyReferral } from './referral';

function fakePool() {
  const st: any = {
    acc: [
      { email: 'ali@x.com', referral_code: 'SXAAAAA', guest_id: 'g-ali', signup_ip_hash: 'ip-ali', pro_until: null, referral_days_earned: 0 },
    ] as any[],
    ev: [] as any[], n: 1,
  };
  const q = async (sql: string, p: any[] = []) => {
    sql = sql.replace(/\s+/g, ' ');
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
    if (/SELECT \* FROM accounts WHERE email/.test(sql)) return { rows: st.acc.filter((a: any) => a.email === p[0]) };
    if (/UPDATE accounts SET first_watch_at/.test(sql)) { const a = st.acc.find((x: any) => x.email === p[0]); if (a && !a.first_watch_at) a.first_watch_at = 1; return { rows: [] }; }
    if (/SELECT \* FROM referral_events WHERE referred_email/.test(sql)) return { rows: st.ev.filter((e: any) => e.referred_email === p[0] && e.status === 'pending') };
    if (/SELECT email, signup_ip_hash, guest_id FROM accounts WHERE referral_code/.test(sql)) return { rows: st.acc.filter((a: any) => a.referral_code === p[0]) };
    if (/FOR UPDATE/.test(sql)) return { rows: [{ id: 1 }] };
    if (/UPDATE referral_events SET status='rewarded'/.test(sql)) { const e = st.ev.find((x: any) => x.id === p[0] && x.status === 'pending'); if (!e) return { rows: [] }; e.status = 'rewarded'; return { rows: [{ id: e.id }] }; }
    if (/UPDATE referral_events SET status='rejected'/.test(sql)) { const e = st.ev.find((x: any) => x.id === p[0]); if (e) e.status = 'rejected'; return { rows: [] }; }
    if (/SELECT COUNT/.test(sql)) return { rows: [{ c: st.ev.filter((e: any) => e.referrer_code === p[0] && e.status === 'rewarded').length }] };
    if (/UPDATE accounts SET pro_until/.test(sql)) {
      const a = st.acc.find((x: any) => x.referral_code === p[0]);
      const base = Math.max(a.pro_until ?? 0, Date.now());
      a.pro_until = base + Number(p[1]) * 864e5; a.referral_days_earned += p[2]; return { rows: [] };
    }
    throw new Error('unexpected sql ' + sql);
  };
  const pool: any = { query: q };
  const addFriend = (email: string, extra: any = {}) => {
    st.acc.push({ email, referral_code: 'SX' + email.slice(0, 5).toUpperCase().padEnd(5, 'A'), guest_id: 'g-' + email, signup_ip_hash: 'ip-' + email, ...extra });
    st.ev.push({ id: st.n++, referrer_code: 'SXAAAAA', referred_email: email, status: 'pending' });
  };
  return { pool, st, addFriend };
}

test('schedule: 2 friends = 7, +3 each, cap 30, never shown', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(referralTotalDays), [0, 0, 7, 10, 13]);
  assert.strictEqual(referralTotalDays(50), 30);
  assert.strictEqual(referralFriendDays(1), 0);
  assert.strictEqual(referralFriendDays(2), 7);
  assert.strictEqual(referralFriendDays(3), 3);
  assert.strictEqual(referralFriendDays(40), 0);
  assert.ok(!/30|60/.test(referralProgressLine(9) + referralShareText('x')));
});

test('code parsing accepts u- prefix', () => {
  assert.strictEqual(parseRefCode('u-SXABCDE'), 'SXABCDE');
  assert.strictEqual(parseRefCode('SXABCDE'), 'SXABCDE');
  assert.strictEqual(parseRefCode('u-bad'), null);
});

test('first friend pays nothing, second 7 days, third +3; repeat is idempotent', async () => {
  const { pool, st, addFriend } = fakePool();
  ['a@x.com', 'b@x.com', 'c@x.com'].forEach((e) => addFriend(e));
  assert.strictEqual((await qualifyReferral(pool, 'a@x.com')).paid, 0);
  assert.strictEqual(st.acc[0].pro_until, null);
  assert.strictEqual((await qualifyReferral(pool, 'b@x.com')).paid, 7);
  assert.strictEqual((await qualifyReferral(pool, 'c@x.com')).paid, 3);
  const before = st.acc[0].pro_until;
  assert.strictEqual((await qualifyReferral(pool, 'c@x.com')).paid, 0);
  assert.strictEqual(st.acc[0].pro_until, before);
  assert.strictEqual(st.acc[0].referral_days_earned, 10);
});

test('self, same device and same IP earn nothing', async () => {
  const { pool, st, addFriend } = fakePool();
  addFriend('s1@x.com', { guest_id: 'g-ali' });
  addFriend('s2@x.com', { signup_ip_hash: 'ip-ali' });
  await qualifyReferral(pool, 's1@x.com'); await qualifyReferral(pool, 's2@x.com');
  assert.deepStrictEqual(st.ev.map((e: any) => e.status), ['rejected', 'rejected']);
  assert.strictEqual(st.acc[0].pro_until, null);
});

test('never reduces access and total stops at the cap', async () => {
  const { pool, st, addFriend } = fakePool();
  st.acc[0].pro_until = Date.now() + 20 * 864e5;
  const start = st.acc[0].pro_until;
  for (let i = 0; i < 30; i++) addFriend('f' + i + 'abc@x.com');
  let prev = start;
  for (let i = 0; i < 30; i++) { await qualifyReferral(pool, 'f' + i + 'abc@x.com'); assert.ok(st.acc[0].pro_until >= prev); prev = st.acc[0].pro_until; }
  assert.strictEqual(st.acc[0].referral_days_earned, 30);
  assert.ok(Math.abs((prev - start) / 864e5 - 30) < 0.01);
});
