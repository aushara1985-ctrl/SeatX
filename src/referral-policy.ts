// Referral rules (per-referrer cap + anti-abuse). Pure so it can be unit-tested.
export const REFERRAL_MAX_REWARDS = 5;
export function referralDecision(i: {
  referrerEmail: string | null; inviteeEmail: string;
  referrerIpHash: string | null; inviteeIpHash: string | null;
  referrerRewardedCount: number;
}): 'reward' | 'self' | 'same_ip' | 'capped' {
  if (!i.referrerEmail) return 'self';                                   // unknown referrer: no reward
  if (i.referrerEmail.toLowerCase() === i.inviteeEmail.toLowerCase()) return 'self';
  if (i.referrerIpHash && i.inviteeIpHash && i.referrerIpHash === i.inviteeIpHash) return 'same_ip';
  if (i.referrerRewardedCount >= REFERRAL_MAX_REWARDS) return 'capped';
  return 'reward';
}

