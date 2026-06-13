import { AlertPayload } from './types';
import { pool } from './db';
import { sendPush, isPushAvailable } from './push';
import type { GeneratedAlertMessage } from './utils/alert-message-generator';

export async function sendAlert(payload: AlertPayload): Promise<void> {
  // Both channels run in parallel; failures in one don't block the other.
  await Promise.allSettled([
    sendPushForRecipient(payload),
    sendEmailAlert(payload),
  ]);
}

// Smart Detection Agent variant — uses the agent's generated Saudi-Arabic
// copy for push title/body and the email subject/body. Email keeps the brand
// wrapper, but the inner copy (no "احجز الآن" buy-promise, no queue-bypass
// language, always carries SeatX disclaimer) comes from the agent.
export async function sendAlertWithAgentMessage(
  payload: AlertPayload,
  agentMessage: GeneratedAlertMessage
): Promise<void> {
  await Promise.allSettled([
    sendPushForRecipientWithAgentMessage(payload, agentMessage),
    sendEmailAlertWithAgentMessage(payload, agentMessage),
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

  // RESEND_FROM / RESEND_FROM_NAME let us swap to a verified custom domain
  // (e.g. alerts@seatx.space) once DNS is set up, without code changes.
  // Falls back to Resend's test domain so the app still works pre-verification.
  const fromAddr = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'SeatX';
  const fromHeader = `${fromName} <${fromAddr}>`;

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
        from: fromHeader,
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

// ---- Smart Detection Agent send helpers ----

async function sendPushForRecipientWithAgentMessage(
  payload: AlertPayload,
  agentMessage: GeneratedAlertMessage
): Promise<void> {
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

  // Push payload uses the agent's safe Arabic copy.
  const title = agentMessage.subject;
  const body = agentMessage.body;

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

async function sendEmailAlertWithAgentMessage(
  payload: AlertPayload,
  agentMessage: GeneratedAlertMessage
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const fromAddr = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'SeatX';
  const fromHeader = `${fromName} <${fromAddr}>`;

  const { eventTitle, recipientEmail } = payload;
  const ctaUrl = agentMessage.cta_url || payload.url;
  const ctaLabel = agentMessage.cta_label;
  // body is plain text with \n separators — convert to <br> for email.
  const bodyHtml = agentMessage.body
    .split('\n')
    .map(line => escapeHtml(line))
    .join('<br>');

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0b0f;color:#f4f4f5;padding:32px;border-radius:16px" dir="rtl">
      <div style="font-size:28px;font-weight:900;color:#a3e635" dir="ltr">SEAT<span style="color:#fff">X</span></div>
      <div style="font-size:12px;color:#71717a;margin-bottom:24px" dir="ltr">Real-time seat market intelligence</div>
      <div style="background:#11141b;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:12px">${escapeHtml(eventTitle)}</div>
        <div style="font-size:14px;color:#e4e4e7;line-height:1.7;margin-bottom:16px">${bodyHtml}</div>
        <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#a3e635;color:#000;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px">${escapeHtml(ctaLabel)} →</a>
      </div>
      <div style="font-size:11px;color:#3f3f46;text-align:center" dir="ltr">SeatX · 🇸🇦 Saudi Arabia</div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromHeader,
        to: recipientEmail,
        subject: agentMessage.subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error('[notify] Email failed:', await res.text());
    } else {
      console.log(`[notify] Email (agent) sent to ${recipientEmail} for "${eventTitle}"`);
    }
  } catch (e: any) {
    console.error('[notify] Email exception:', e.message);
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, ' ').replace(/\r/g, ' ');
}
