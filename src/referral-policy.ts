// Referral rules. Pure so they can be unit-tested.
// Program (same as Darbi): friend must sign up through the link AND set their first real watch.
//   2 friends = 7 days Pro, every extra friend = +3 days, cap 30 days earned per user (never shown to users).
export const REFERRAL_NEED = 2;
export const REFERRAL_BASE_DAYS = 7;
export const REFERRAL_EXTRA_DAYS = 3;
export const REFERRAL_CAP_DAYS = 30;

// Total days a referrer should have earned once n friends have qualified.
export function referralTotalDays(n: number): number {
  if (!(n >= REFERRAL_NEED)) return 0;
  return Math.min(REFERRAL_CAP_DAYS, REFERRAL_BASE_DAYS + REFERRAL_EXTRA_DAYS * (n - REFERRAL_NEED));
}

// Days the n-th qualified friend added (0 for the first, 7 for the second, 3 after, 0 once capped).
export function referralFriendDays(n: number): number {
  return Math.max(0, referralTotalDays(n) - referralTotalDays(n - 1));
}

// "u-SXABCDE" / "SXABCDE" / "u-sxabcde" -> "SXABCDE"; anything else -> null.
export function parseRefCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase();
  if (s.startsWith('U-')) s = s.slice(2);
  return /^SX[A-Z2-9]{5}$/.test(s) ? s : null;
}

export function referralProgressLine(qualified: number): string {
  const q = Math.max(0, qualified | 0);
  if (q === 0) return 'دعيت 0 من 2 — باقي اثنين وتاخذ أسبوع Pro';
  if (q === 1) return 'دعيت 1 من 2 — باقي واحد وتاخذ أسبوع Pro';
  return 'دعيت ' + q + ' — كل صديق جديد يضيف لك 3 أيام Pro';
}

export function referralShareText(url: string): string {
  return 'أستخدم SeatX يتابع لي التذاكر وينبّهني إذا رجعت مقاعد. جرّبه، وأول أسبوع Pro مجاني: ' + url;
}

export function referralDecision(i: {
  referrerEmail: string | null; inviteeEmail: string;
  referrerIpHash: string | null; inviteeIpHash: string | null;
  referrerGuestId?: string | null; inviteeGuestId?: string | null;
}): 'reward' | 'self' | 'same_ip' | 'same_device' {
  if (!i.referrerEmail) return 'self';                                   // unknown referrer: no reward
  if (i.referrerEmail.toLowerCase() === i.inviteeEmail.toLowerCase()) return 'self';
  if (i.referrerGuestId && i.inviteeGuestId && i.referrerGuestId === i.inviteeGuestId) return 'same_device';
  if (i.referrerIpHash && i.inviteeIpHash && i.referrerIpHash === i.inviteeIpHash) return 'same_ip';
  return 'reward';
}
