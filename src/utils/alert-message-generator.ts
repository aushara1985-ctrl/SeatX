// Phase 2 Smart Detection Agent — alert message generator.
//
// Saudi Arabic, max 4 lines, no guarantees, no hype, no queue bypass.
// Always carries the official source CTA. Generated copy must be safe to
// drop into both push + email channels.
//
// Hard product rules (CLAUDE.md):
//   - SeatX does not buy / resell / guarantee / bypass queues.
//   - Queue Mode = alternative official opportunities, never queue jumping.
//   - No "will sell out in X" claims.

import type { AlertDecision } from './alert-decision';
import type { OpportunityType } from './opportunity-analyzer';

export interface AlertEventInput {
  title?: string | null;
  event_url?: string | null;
  source_name?: string | null;
}

export interface GeneratedAlertMessage {
  subject: string;       // short, push title / email subject
  body: string;          // max 4 lines, Arabic
  cta_url: string | null;
  cta_label: string;     // Arabic CTA label
  disclaimer: string;    // SeatX standard disclaimer line
}

const DISCLAIMER = 'SeatX لا يضمن التذاكر.';
const CTA_LABEL = 'افتح المصدر الرسمي';

function safeTitle(t?: string | null): string {
  const v = (t || '').trim();
  return v || 'الفعالية';
}

function pickHeadline(o: OpportunityType, title: string): string {
  switch (o) {
    case 'seats_returned':
      return `قد تكون رجعت مقاعد لـ ${title}.`;
    case 'sale_opened':
      return `ظهرت فرصة محتملة لـ ${title}.`;
    case 'new_drop':
      return `قد يكون فيه طرح جديد لـ ${title}.`;
    case 'official_link_changed':
      return `تغير الرابط الرسمي لـ ${title}.`;
    case 'package_available':
      return `قد يكون فيه باقة جديدة لـ ${title}.`;
    case 'queue_removed':
      // Carefully avoids implying we got the user past the queue.
      return `حالة الطابور تغيّرت لـ ${title}.`;
    case 'status_changed':
      return `تغيّرت حالة ${title} في المصدر.`;
    default:
      return `تحديث محتمل على ${title}.`;
  }
}

function pickAction(o: OpportunityType): string {
  if (o === 'queue_removed') {
    // Do NOT say "skip the queue" / "jump the queue". Just point them to the
    // official source and let them verify themselves.
    return 'افتح المصدر الرسمي وتأكد من الحالة بنفسك.';
  }
  return 'افتح المصدر الرسمي وتحقق من التوفر بسرعة.';
}

export function generate_alert_message(
  event: AlertEventInput | null | undefined,
  decision: AlertDecision
): GeneratedAlertMessage {
  const title = safeTitle(event?.title);
  const url = (event?.event_url || '').trim() || null;

  const headline = pickHeadline(decision.opportunity_type, title);
  const action = pickAction(decision.opportunity_type);

  // Max 4 lines: headline, action, (optional) low-confidence note, disclaimer.
  const lines: string[] = [headline, action];

  if (decision.urgency === 'low' && decision.action === 'send_alert') {
    lines.push('الإشارة ضعيفة — تحقق قبل الشراء.');
  }

  lines.push(DISCLAIMER);

  // Force max 4 lines.
  const body = lines.slice(0, 4).join('\n');

  const subjectPrefix =
    decision.opportunity_type === 'queue_removed'
      ? 'تحديث طابور'
      : decision.opportunity_type === 'seats_returned'
      ? 'مقاعد محتملة'
      : 'فرصة محتملة';

  const subject = `${subjectPrefix} — ${title}`;

  return {
    subject,
    body,
    cta_url: url,
    cta_label: CTA_LABEL,
    disclaimer: DISCLAIMER,
  };
}
