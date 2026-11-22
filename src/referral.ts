// Referral qualification: the invitee's first real watch pays the referrer once.
// Rewards extend accounts.pro_until (never reduced). Idempotent: the pending row is claimed atomically
// under a lock on the referrer's account row, so one referred user can only ever pay once.
import { referralDecision, referralFriendDays } from './referral-policy';

export interface Queryable { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>; }
export interface PoolLike extends Queryable { connect?: () => Promise<Queryable & { release?: () => void }>; }

export async function qualifyReferral(pool: PoolLike, email: string): Promise<{ paid: number }> {
  const acc = await pool.query('SELECT * FROM accounts WHERE email=$1', [email]).catch(() => ({ rows: [] as any[] }));
  const me = acc.rows[0];
  if (!me) return { paid: 0 };            // no account -> nothing to qualify
  if (me.first_watch_at) return { paid: 0 };   // already had a first watch
  await pool.query('UPDATE accounts SET first_watch_at=NOW() WHERE email=$1 AND first_watch_at IS NULL', [email]).catch(() => {});

  const pend = await pool.query(`SELECT * FROM referral_events WHERE referred_email=$1 AND status='pending'`, [email]).catch(() => ({ rows: [] as any[] }));
  let paid = 0;
  for (const r of pend.rows) {
    const refQ = await pool.query('SELECT email, signup_ip_hash, guest_id FROM accounts WHERE referral_code=$1', [r.referrer_code]).catch(() => ({ rows: [] as any[] }));
    const ref = refQ.rows[0];
    const decision = referralDecision({
      referrerEmail: ref?.email ?? null, inviteeEmail: email,
      referrerIpHash: ref?.signup_ip_hash ?? null, inviteeIpHash: me.signup_ip_hash ?? null,
      referrerGuestId: ref?.guest_id ?? null, inviteeGuestId: me.guest_id ?? null,
    });
    if (decision !== 'reward') {
      await pool.query(`UPDATE referral_events SET status='rejected' WHERE id=$1 AND status='pending'`, [r.id]).catch(() => {});
      continue;
    }
    const c = pool.connect ? await pool.connect() : pool;
    try {
      await c.query('BEGIN');
      await c.query('SELECT id FROM accounts WHERE referral_code=$1 FOR UPDATE', [r.referrer_code]);
      const claim = await c.query(`UPDATE referral_events SET status='rewarded' WHERE id=$1 AND status='pending' RETURNING id`, [r.id]);
      if (!claim.rows.length) { await c.query('ROLLBACK'); continue; }
      const cnt = await c.query(`SELECT COUNT(*)::int AS c FROM referral_events WHERE referrer_code=$1 AND status='rewarded'`, [r.referrer_code]);
      const days = referralFriendDays(cnt.rows[0]?.c || 0);
      if (days > 0) {
        await c.query(
          `UPDATE accounts SET pro_until = GREATEST(COALESCE(pro_until, NOW()), NOW()) + ($2 || ' days')::interval,
                               referral_days_earned = COALESCE(referral_days_earned,0) + $3,
                               trial_remind2_sent_at = NULL, trial_remind0_sent_at = NULL
            WHERE referral_code = $1`,
          [r.referrer_code, String(days), days]
        );
      }
      await c.query('COMMIT');
      paid += days;
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch (_) { /* ignore */ }
    } finally { if ((c as any).release && c !== pool) (c as any).release(); }
  }
  return { paid };
}
