# SeatX — Claude Code Notes

This repo is **SeatX**, a real-time Saudi seat-market intelligence product. Express + TypeScript backend, single-file SSR HTML frontend (`src/index.ts`), PostgreSQL on Railway, Resend for email, Firebase Cloud Messaging for Web Push.

---

## 🛑 BEFORE ANY UI/UX CHANGE

**MANDATORY pre-read:** [`docs/design.md`](docs/design.md)

That file is the single source of truth for SeatX visual identity, typography, navigation, components, motion, and product feel. Every UI change in this repo must:

1. Read `docs/design.md` in full before drafting.
2. Start **wireframe-first** — outline structure and hierarchy in plain text before writing CSS.
3. Use only the palette in §2 and typography in §4 of `docs/design.md`. New values require updating that file first.
4. Pass the **Bloomberg test** (would this appear in a financial terminal?) and the **Saudi premium test** (does it feel like a serious tool for serious buyers?).
5. Reference `docs/design.md §N` in commit messages when changes touch a documented area.

Do **not** invent a new design direction per session. Do **not** add Material/Flutter/crypto-clone patterns. Do **not** introduce colors, fonts, or radii outside the design system.

---

## Architecture pointers

- **Server:** `src/index.ts` (single file — Express routes, SSR HTML, Firebase admin push)
- **DB schema:** `src/db.ts` (events, subscriptions, activity_logs, push_subscriptions, waitlist)
- **Monitoring:** `src/monitor.ts` (15s cycle, signal extraction, status transitions, alert dispatch)
- **Notify:** `src/notify.ts` (push + email parallel dispatch, `RESEND_FROM` env-driven)
- **Push:** `src/push.ts` (Firebase admin lazy init, invalid-token cleanup)
- **Parsers:** `src/sourceParsers/` (webook, ticketmaster, generic)
- **Intelligence layer:** `src/demand.ts`, `src/confidence.ts`, `src/learning.ts`, `src/reliability.ts`

---

## Product rules (locked, persistent)

1. **No fake intelligence.** Heuristics on real data are fine. Predictions / personalization / Brain layers stay locked until real user data exists.
2. **No fake activity.** Never log fabricated user counts or activity strings to make the feed look busy.
3. **Phase B (real-watcher trending, interests onboarding, real dashboard) is gated on ~50 real users.**
4. **Phase C (return probability, crowd pressure, personalized feed, Brain V1) is gated on retention data from Phase B.**
5. Memory file `project_seatx.md` carries the full phase-gating contract. Memory file `feedback_no_speculative_intelligence.md` carries the cross-product rule against pre-built AI.

---

## Development

```bash
npm install
npm run build      # tsc → dist/
npm run dev        # tsx watch src/index.ts
npm start          # node dist/index.js (production)
```

**Required env vars (Railway):**
- `DATABASE_URL` — PostgreSQL (Railway-provided)
- `PORT` — Railway-provided
- `RESEND_API_KEY` — email sender (Resend)
- `RESEND_FROM` / `RESEND_FROM_NAME` — optional, defaults to `onboarding@resend.dev` if unset
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_VAPID_KEY` — client Web Push config (public, served via `/api/firebase-config`)
- `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — server admin SDK (required to actually send push; missing = push is a silent no-op, email fallback continues)

Push **registration** works without admin creds. Push **send** requires them.

---

## Deploy

Push to `main` on `github.com/aushara1985-ctrl/SeatX` → Railway auto-deploys.
Live URL: `seatx-production.up.railway.app` (custom domain `seatx.space` configured at registrar; Railway custom-domain attach + SSL provisioning may still be pending — check before announcing).
