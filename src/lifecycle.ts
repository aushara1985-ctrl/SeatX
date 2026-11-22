// Lifecycle emails: welcome at signup + trial-end reminders (2 days before, last day).
// Uses the existing Resend channel (same env as notify.ts). Idempotent: each
// message is claimed with a timestamp column before sending, so it goes out
// once per account. No backfill: the welcome is only triggered by a brand-new
// signup, and reminders only target trials that still end in the future.
import { pool } from './db';

const SITE = (process.env.PUBLIC_BASE_URL || 'https://www.seatx.space').replace(/\/$/, '');

type Kind = 'welcome' | 'remind2' | 'remind0';
const COL: Record<Kind, string> = {
  welcome: 'welcome_sent_at',
  remind2: 'trial_remind2_sent_at',
  remind0: 'trial_remind0_sent_at',
};

function wrap(arTitle: string, arBody: string, enTitle: string, enBody: string): string {
  const card = 'background:#11141b;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:20px;margin-bottom:16px';
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0b0f;color:#f4f4f5;padding:32px;border-radius:16px">
      <div style="font-size:28px;font-weight:900;color:#a3e635">SEAT<span style="color:#fff">X</span></div>
      <div style="${card};direction:rtl;text-align:right;margin-top:20px">
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:10px">${arTitle}</div>
        <div style="font-size:14px;line-height:1.9;color:#e4e4e7">${arBody}</div>
        <a href="${SITE}/" style="display:inline-block;margin-top:14px;background:#a3e635;color:#000;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px">افتح SeatX</a>
      </div>
      <div style="${card};direction:ltr;text-align:left">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">${enTitle}</div>
        <div style="font-size:13px;line-height:1.7;color:#a1a1aa">${enBody}</div>
      </div>
      <div style="font-size:11px;color:#52525b;text-align:center">SeatX · Saudi Arabia · SeatX تنبّهك فقط ولا تحجز نيابةً عنك</div>
    </div>`;
}

function build(kind: Kind): { subject: string; html: string } {
  if (kind === 'welcome') {
    return {
      subject: 'هلا فيك في SeatX · Welcome to SeatX',
      html: wrap(
        'هلا فيك في SeatX 👋',
        'بدأت تجربتك المجانية لمدة ٧ أيام بكل المزايا.<br>أول خطوة: اختر حدث تبغاه (أو أضف حدثك) وفعّل التنبيه ببريدك، ونرسل لك لما نرصد توفّر مقاعد.<br>ملاحظة: SeatX تنبّهك فقط، والحجز يكون من موقع البيع الرسمي. الدفع والترقية لباقة Pro «قريباً».',
        'Welcome to SeatX',
        'Your free 7-day trial has started. Pick an event (or add your own) and turn on an alert with your email. SeatX only alerts you; booking happens on the official seller. Paid Pro upgrade is coming soon.'
      ),
    };
  }
  if (kind === 'remind2') {
    return {
      subject: 'باقي يومين على نهاية تجربتك · 2 days left in your SeatX trial',
      html: wrap(
        'باقي يومين على نهاية تجربتك',
        'تنتهي تجربتك المجانية بعد يومين تقريباً. بعدها يبقى حسابك مجاني وتنبيهاتك تصير أبطأ، وتبقى أحداثك محفوظة.<br>تبغى تمدد؟ ادعُ صديق: كل دعوة مؤهلة تعطيك +١ يوم مجاناً. باقة Pro المدفوعة «قريباً».',
        '2 days left in your trial',
        'Your free trial ends in about 2 days. After that your account stays free with slower alerts, and your watched events are kept. Invite a friend for +1 free day per qualified invite. Paid Pro is coming soon.'
      ),
    };
  }
  return {
    subject: 'اليوم آخر يوم في تجربتك · Last day of your SeatX trial',
    html: wrap(
      'اليوم آخر يوم في تجربتك',
      'تنتهي تجربتك المجانية خلال أقل من ٢٤ ساعة. بعدها يبقى حسابك مجاني بتنبيهات أبطأ، وأحداثك محفوظة.<br>تبغى يوم إضافي؟ ادعُ صديق وتاخذ +١ يوم مجاناً لكل دعوة مؤهلة. باقة Pro المدفوعة «قريباً».',
      'Last day of your trial',
      'Your free trial ends within 24 hours. Your account then stays free with slower alerts and your events are kept. Invite a friend for +1 free day per qualified invite. Paid Pro is coming soon.'
    ),
  };
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const fromAddr = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'SeatX';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromAddr}>`, to, subject, html }),
    });
    if (!res.ok) { console.error('[lifecycle] email failed:', res.status); return false; }
    return true;
  } catch (e: any) {
    console.error('[lifecycle] email exception:', e.message);
    return false;
  }
}

// Claim (atomic, once) then send. If the send fails the claim is released so
// the hourly pass can retry; a never-configured mailer leaves nothing claimed.
async function claimAndSend(email: string, kind: Kind): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const col = COL[kind];
  const claim = await pool.query(
    `UPDATE accounts SET ${col}=NOW() WHERE email=$1 AND ${col} IS NULL RETURNING email`, [email]);
  if (!claim.rows[0]) return;
  const { subject, html } = build(kind);
  const ok = await sendMail(email, subject, html);
  if (!ok) {
    await pool.query(`UPDATE accounts SET ${col}=NULL WHERE email=$1`, [email]).catch(() => {});
  } else {
    console.log(`[lifecycle] ${kind} sent`);
  }
}

// Called once, right after a NEW account row is created. Never throws.
export function sendWelcomeOnce(email: string): void {
  claimAndSend(email, 'welcome').catch((e) => console.error('[lifecycle] welcome error:', e?.message));
}

// Hourly pass. Only trials whose end is in the future.
export async function runTrialReminders(): Promise<void> {
  try {
    const last = await pool.query(
      `SELECT email FROM accounts WHERE plan='trial' AND pro_until > NOW()
         AND pro_until <= NOW() + INTERVAL '24 hours' AND trial_remind0_sent_at IS NULL LIMIT 200`);
    for (const r of last.rows) await claimAndSend(r.email, 'remind0');
    const two = await pool.query(
      `SELECT email FROM accounts WHERE plan='trial' AND pro_until > NOW() + INTERVAL '24 hours'
         AND pro_until <= NOW() + INTERVAL '48 hours' AND trial_remind2_sent_at IS NULL LIMIT 200`);
    for (const r of two.rows) await claimAndSend(r.email, 'remind2');
  } catch (e: any) {
    console.error('[lifecycle] reminder pass failed:', e?.message);
  }
}
