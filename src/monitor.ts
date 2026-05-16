import crypto from 'crypto';
import { pool } from './db';
import { sendAlert } from './notify';
import { updateDemand } from './demand';
import { sanitizeMetadata } from './metadata';
import { logActivity } from './feed';
import { GenericParser } from './sourceParsers/generic';
import { WebookParser } from './sourceParsers/webook';
import { TicketmasterParser } from './sourceParsers/ticketmaster';
import { computeConfidence } from './confidence';
import { recordSignalOutcome } from './learning';
import { recordSuccess, recordError } from './reliability';
import { Event, SignalResult, SourceInfo, SourceParser } from './types';

// Per-domain throttle: track the last fetch timestamp per hostname so a
// cycle with many events on the same domain doesn't hammer the vendor.
// Lives in-process (resets on restart, which is fine — it's anti-burst, not
// audit). MIN_GAP_MS = minimum interval between two requests to the same host.
const domainLastFetch = new Map<string, number>();
const DOMAIN_MIN_GAP_MS = 3000;

async function throttleByDomain(url: string): Promise<void> {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const last = domainLastFetch.get(host) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < DOMAIN_MIN_GAP_MS) {
      await new Promise(r => setTimeout(r, DOMAIN_MIN_GAP_MS - elapsed));
    }
    domainLastFetch.set(host, Date.now());
  } catch {
    /* invalid URL — skip throttle; checkEvent will fail downstream cleanly */
  }
}

function detectSource(url: string): SourceInfo {
  if (url.includes('webook.com')) return { sourceName: 'Webook', sourceLogo: '/logos/webook.png' };
  if (url.includes('ticketmaster')) return { sourceName: 'Ticketmaster', sourceLogo: '/logos/ticketmaster.png' };
  if (url.includes('platinumlist')) return { sourceName: 'Platinumlist', sourceLogo: '/logos/platinumlist.png' };
  return { sourceName: 'Direct', sourceLogo: '/logos/default.png' };
}

function getParser(url: string): SourceParser {
  if (url.includes('webook.com')) return WebookParser;
  if (url.includes('ticketmaster')) return TicketmasterParser;
  return GenericParser;
}

function normalizeAndHash(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\d{10,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('md5').update(stripped).digest('hex');
}

function shouldTriggerAlert(
  previousStatus: string,
  currentStatus: string,
  lastTriggeredAt: Date | null,
  confidence: number
): boolean {
  const validTransitions = [
    'unavailable->maybe_available',
    'unavailable->available',
    'maybe_available->available',
  ];
  if (!validTransitions.includes(`${previousStatus}->${currentStatus}`)) return false;
  if (confidence < 72) return false;
  if (lastTriggeredAt) {
    const minutesSince = (Date.now() - new Date(lastTriggeredAt).getTime()) / 60000;
    if (minutesSince < 30) return false;
  }
  return true;
}

async function recheckEvent(url: string, parser: SourceParser): Promise<SignalResult | null> {
  try {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });
    const html = await res.text();
    return parser.extractSignals(html);
  } catch (_) {
    return null;
  }
}

export async function checkEvent(ev: Event): Promise<void> {
  const start = Date.now();
  const source = detectSource(ev.event_url);
  const parser = getParser(ev.event_url);

  try {
    const response = await fetch(ev.event_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    const html = await response.text();
    const responseTime = Date.now() - start;
    const pageHash = normalizeAndHash(html);
    const signals = parser.extractSignals(html);

    // Metadata extraction
    const rawMeta = parser.extractMetadata(html);
    const meta = sanitizeMetadata(rawMeta);
    const shouldUpdateMeta = !ev.hero_image || !ev.event_date ||
      !ev.metadata_last_updated_at ||
      (Date.now() - new Date(ev.metadata_last_updated_at).getTime()) > 1000 * 60 * 60 * 24;

    if (shouldUpdateMeta && (meta.heroImage || meta.eventDate || meta.location)) {
      await pool.query(
        `UPDATE events SET
          hero_image = COALESCE($1, hero_image),
          event_date = COALESCE($2, event_date),
          location = COALESCE($3, location),
          metadata_last_updated_at = NOW()
         WHERE id = $4`,
        [meta.heroImage, meta.eventDate, meta.location, ev.id]
      );
      await logActivity(ev.id, 'metadata_updated', `🎫 ${ev.title} — معلومات الفعالية محدّثة`);
    }

    // Compute advanced confidence
    const confidenceResult = await computeConfidence(signals, source.sourceName);

    // Log check
    await pool.query(
      `INSERT INTO event_checks
        (event_id, detected_status, page_hash, positive_signals, negative_signals,
         button_signals, dom_signals, snippet, confidence, response_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        ev.id, signals.status, pageHash,
        signals.positiveSignals, signals.negativeSignals,
        signals.buttonSignals, signals.domSignals,
        signals.snippet, confidenceResult.score, responseTime,
      ]
    );

    // Record source success
    await recordSuccess(source.sourceName);

    if (pageHash === ev.last_page_hash && signals.status === ev.status) return;

    let finalSignals = signals;
    let finalConfidence = confidenceResult;

    // Smart recheck for borderline confidence. We deliberately do NOT log
    // recheck attempts to the public activity feed — they read like debug
    // chatter. Only the *final* confirmed transition reaches the feed below.
    if (confidenceResult.shouldRecheck) {
      console.log(`[monitor] recheck triggered for event ${ev.id} "${ev.title}" (confidence ${confidenceResult.score})`);
      const recheck = await recheckEvent(ev.event_url, parser);
      if (recheck) {
        finalSignals = recheck;
        finalConfidence = await computeConfidence(recheck, source.sourceName);
        console.log(`[monitor] recheck result for event ${ev.id}: ${recheck.status} (confidence ${finalConfidence.score})`);
      } else {
        return;
      }
    }

    if (!finalConfidence.shouldAlert && !confidenceResult.shouldAlert) {
      // Record signal outcome for learning
      await recordSignalOutcome(
        ev.id, source.sourceName,
        finalSignals.positiveSignals,
        finalSignals.status,
        finalConfidence.score,
        false
      );
      return;
    }

    const trigger = shouldTriggerAlert(
      ev.last_status || ev.status,
      finalSignals.status,
      ev.last_triggered_at,
      finalConfidence.score
    );

    await pool.query(
      `UPDATE events SET
        status=$1, last_status=$2, last_page_hash=$3,
        last_checked=NOW(), source_name=$4, source_logo=$5,
        recent_signal_strength=$6,
        recent_transition_count = CASE WHEN $1 != status THEN recent_transition_count + 1 ELSE recent_transition_count END
        ${trigger ? ', last_triggered_at=NOW()' : ''}
       WHERE id=$7`,
      [finalSignals.status, ev.status, pageHash, source.sourceName, source.sourceLogo, finalConfidence.score, ev.id]
    );

    if (finalSignals.status !== ev.status) {
      // Saudi-flavored, market-feel transition strings — direction-aware.
      // 'available' coming online is the headline event; the reverse direction
      // and "maybe" transitions get softer copy so the feed feels alive
      // without crying wolf.
      const nowStatus = finalSignals.status;
      const wasStatus = ev.status;
      let transitionMsg: string;
      if (nowStatus === 'available' && wasStatus !== 'available') {
        transitionMsg = `🎟 ${ev.title} — مقاعد رجعت الآن!`;
      } else if (nowStatus === 'maybe_available' && wasStatus === 'unavailable') {
        transitionMsg = `👀 ${ev.title} — حركة في السوق، احتمال يرجعون قريب`;
      } else if (nowStatus === 'unavailable' && wasStatus === 'available') {
        transitionMsg = `🚨 ${ev.title} — انباعوا بسرعة، اكتملت المقاعد`;
      } else if (nowStatus === 'unavailable' && wasStatus === 'maybe_available') {
        transitionMsg = `❌ ${ev.title} — السوق هدأ، المقاعد ما رجعت`;
      } else {
        transitionMsg = `📊 ${ev.title} — تغيّر في حالة المقاعد`;
      }
      await logActivity(ev.id, 'status_change', transitionMsg);
    }

    if (trigger) {
      const subs = await pool.query('SELECT email FROM subscriptions WHERE event_id=$1', [ev.id]);
      for (const sub of subs.rows) {
        await sendAlert({
          eventId: ev.id,
          eventTitle: ev.title,
          status: finalSignals.status,
          detectedSignals: finalSignals.positiveSignals,
          url: ev.event_url,
          recipientEmail: sub.email,
        });
      }
      await logActivity(
        ev.id,
        'alert_sent',
        `🔥 ${ev.title} — ${subs.rows.length} ${subs.rows.length === 1 ? 'مستخدم' : 'مستخدم'} وصلهم تنبيه لحظي`
      );

      // Record signal outcome for learning
      await recordSignalOutcome(
        ev.id, source.sourceName,
        finalSignals.positiveSignals,
        finalSignals.status,
        finalConfidence.score,
        true
      );
    }

    await updateDemand(ev.id);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `INSERT INTO event_checks (event_id, error_message, response_time) VALUES ($1,$2,$3)`,
      [ev.id, msg, Date.now() - start]
    );
    await recordError(source.sourceName);
  }
}

export async function runMonitorCycle(): Promise<void> {
  try {
    // Batch cap: process at most 40 events per cycle. With 800ms inter-event
    // sleep + potential 3s domain throttle, 40 events fit comfortably in the
    // 15s cycle interval. Overflow events get picked up by the next cycle
    // (ordered by priority_score DESC so the most important always run first).
    const { rows } = await pool.query(
      `SELECT * FROM events
       WHERE next_check_at IS NULL OR next_check_at <= NOW()
       ORDER BY priority_score DESC, demand_score DESC
       LIMIT 40`
    );

    for (const ev of rows) {
      // Per-domain throttle BEFORE the actual fetch. Two events on the same
      // host now wait 3s minimum between them, regardless of cycle pacing.
      await throttleByDomain(ev.event_url);
      await checkEvent(ev as Event);
      const planInterval = ev.plan_type === 'lifetime' ? 10
  : ev.plan_type === 'pro' ? 15
  : ev.plan_type === 'entry' ? 30
  : 90; // free = slow
const interval = planInterval;
      await pool.query(
        `UPDATE events SET next_check_at = NOW() + ($1 || ' seconds')::INTERVAL WHERE id = $2`,
        [interval, ev.id]
      );
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (err) {
    console.error('[monitor] Cycle error:', err);
  }
}
