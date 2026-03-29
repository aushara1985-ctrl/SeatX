import { AlertPayload } from './types';

export async function sendAlert(payload: AlertPayload): Promise<void> {
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
    console.error(`[notify] Failed:`, await res.text());
  } else {
    console.log(`[notify] Sent to ${recipientEmail} for "${eventTitle}"`);
  }
}
