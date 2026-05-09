import { AlertPayload } from './types';
import { pool } from './db';
import { sendPush, isPushAvailable } from './push';

export async function sendAlert(payload: AlertPayload): Promise<void> {
  // Both channels run in parallel; failures in one don't block the other.
  await Promise.allSettled([
    sendPushForRecipient(payload),
    sendEmailAlert(payload),
  ]);
}

async function sendPushForRecipient(payload: AlertPayload): Promise<void> {
  if (!isPushAvailable()) return;

  let tokens: { token: string }[] = [];
  try {
    const r = await pool.query(
      'SELECT token FROM push_subscriptions WHERE email=$1',
      [payload.recipientEmail]
    );
    tokens = r.rows;
  } catch (e: any) {
    console.error('[push] token lookup failed:', e.message);
    return;
  }

  if (tokens.length === 0) return;

  const title = pushTitle(payload);
  const body = pushBody(payload);

  for (const { token } of tokens) {
    const result = await sendPush(token, {
      title,
      body,
      url: payload.url,
      eventId: payload.eventId,
    });

    if (result.invalidToken) {
      try {
        await pool.query('DELETE FROM push_subscriptions WHERE token=$1', [token]);
        console.log(`[push] removed invalid token for ${payload.recipientEmail}`);
      } catch (_) { /* swallow */ }
      continue;
    }

    if (result.ok) {
      try {
        await pool.query(
          'UPDATE push_subscriptions SET last_used_at=NOW() WHERE token=$1',
          [token]
        );
      } catch (_) { /* swallow */ }
    } else {
      console.warn(`[push] send failed: ${result.error}`);
    }
  }
}

function pushTitle(payload: AlertPayload): string {
  if (payload.status === 'available') return `⚡ Tickets available — ${payload.eventTitle}`;
  if (payload.status === 'maybe_available') return `👀 Tickets maybe available — ${payload.eventTitle}`;
  return `📊 ${payload.eventTitle} — update`;
}

function pushBody(payload: AlertPayload): string {
  if (payload.detectedSignals.length === 0) return 'Tap to open and check now.';
  return `Signals: ${payload.detectedSignals.slice(0, 3).join(', ')}`;
}

async function sendEmailAlert(payload: AlertPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { eventTitle, status, detectedSignals, url, recipientEmail } = payload;
  const statusLabel = status === 'available' ? '⚡ متاحة الآن' : '👀 ربما متاحة';

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0b0f;color:#f4f4f5;padding:32px;border-radius:16px">
      <div style="font-size:28px;font-weight:900;color:#a3e635">SEAT<span style="color:#fff">X</span></div>
      <div style="font-size:12px;color:#71717a;margin-bottom:24px">Real-time seat market intelligence</div>
      <div style="background:#11141b;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">${eventTitle}</div>
        <div style="font-size:24px;font-weight:900;color:#a3e635;margin-bottom:12px">${statusLabel}</div>
        <div style="font-size:12px;color:#71717a;margin-bottom:16px">Signals: ${detectedSignals.join(', ')}</div>
        <a href="${url}" style="display:inline-block;background:#a3e635;color:#000;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px">احجز الآن →</a>
      </div>
      <div style="font-size:11px;color:#3f3f46;text-align:center">SeatX · 🇸🇦 Saudi Arabia</div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SeatX <onboarding@resend.dev>',
        to: recipientEmail,
        subject: `${statusLabel} — ${eventTitle}`,
        html,
      }),
    });

    if (!res.ok) {
      console.error('[notify] Email failed:', await res.text());
    } else {
      console.log(`[notify] Email sent to ${recipientEmail} for "${eventTitle}"`);
    }
  } catch (e: any) {
    console.error('[notify] Email exception:', e.message);
  }
}
