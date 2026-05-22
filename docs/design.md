# SeatX Design System

> **Single source of truth for all SeatX UI/UX decisions.**
> Every UI change MUST read this file in full before drafting.
> Updates to this file require explicit user approval before commit.

---

## 1. Brand Positioning

**SeatX is:**
- Bloomberg for the Saudi ticket market
- StockX × live ticket trading
- Premium Saudi market terminal

**SeatX is NOT:**
- An events app
- A generic ticket tracker
- A crypto clone
- A Flutter / SaaS template
- A casual browsing experience

The product positions itself as **professional-grade market intelligence** for ticket demand. The user is a serious buyer who wants speed, priority, and information advantage — not a casual fan browsing events.

---

## 2. Visual Identity

**Palette (strict — additions require updating §2 first):**

| Role | Token |
|---|---|
| Background primary | `#080a0e` |
| Background elevated | `#0d1018` |
| Background surface | `#121620` |
| Accent (active states + primary CTAs only) | `#a3e635` neon lime |
| Text primary | `#f4f4f5` |
| Text secondary | `#a1a1aa` |
| Text tertiary | `#71717a` |
| Text muted | `#52525b` |
| Demand band very_high | `#ef4444` |
| Demand band high | `#f97316` |
| Demand band medium | `#eab308` |
| Border subtle | `rgba(255,255,255,.07)` |
| Border defined | `rgba(255,255,255,.12)` |

**Direction:** Arabic-first RTL default. English secondary via toggle. Static HTML defaults to Arabic.

**Fonts:**
- AR: `IBM Plex Sans Arabic` (400, 500, 600, 700)
- EN: `DM Sans` (400–900)
- Mono / numbers / eyebrows: `IBM Plex Mono` (400, 500, 600)

**Principle:** Dense but readable. Premium, not playful. Financial-terminal aesthetic over consumer-app aesthetic.

---

## 3. Design Philosophy

1. **Content is the hero.** Chrome (nav, borders, decorations) recedes. Information density beats whitespace generosity.
2. **One accent rule.** Neon green only for active states + primary CTAs. Never as decoration.
3. **Minimal glow.** Glow only for live indicators (pulse dots, alert moments). Never on buttons, cards, or static elements.
4. **Every border earns its place.** Borders carry information — separation, state, or hierarchy. Never aesthetic.
5. **No padding for padding's sake.** No giant empty cards. No vertical breathing room without reason.
6. **Time-to-glance < 1 second** per data point. The user should not "decode" the UI.
7. **Subtle over loud.** Pulse dot beats badge. Underline beats colored background. Mono number beats decorated stat.

---

## 4. Typography

**Mobile hierarchy (≤600px):**

| Element | Size | Weight | Family |
|---|---|---|---|
| Hero H1 | 40–44px | 900 | DM Sans |
| Section title | 20–22px | 800 | DM Sans / Plex Arabic 700 |
| Card title | 15–16px | 700 | inherit |
| Body | 13–14px | 400–500 | inherit |
| Eyebrow / label | 10–11px | 600 | Plex Mono (LTR) |
| Tab label | 10.5px | 700 | Plex Arabic |
| Meta / numbers | 10–11px | 600 | Plex Mono |

**Minimums (non-negotiable):**
- Body text ≥ 13px on every screen
- Form inputs = 16px font (iOS no-zoom)
- Tap targets ≥ 44×44px

**Forbidden:**
- Body under 13px
- Marketing copy in mono
- Mono for Arabic body
- Decorative italic
- Letter-spacing > .15em outside eyebrow labels

---

## 5. Navigation

**Mobile (≤960px):**
- Top nav: logo + AR/EN toggle + small account **icon** button. Height 56–60px. **No primary CTAs in top nav.**
- Bottom nav: 5 fixed tabs (الرئيسية / الأكثر تداولًا / مراقباتي / التنبيهات / حسابي). Height **60px**. Fixed at viewport bottom.

**Desktop (≥961px):**
- Top nav owns navigation via horizontal `.nav-tabs` text strip.
- Bottom nav hidden entirely. No floating bottom bar in the center of the page.
- Account/lang stays right-aligned in top nav.

**Bottom nav rules:**
- Height: **60px** (was 54–58 in v1; bumped 2026-05-13 for readability on iPhone SE / small Android).
- Icons: **inline outline SVG only.** Lucide / Phosphor style. **20px size**, 1.5 stroke. **No emoji. No filled icons. No CDN.**
- Label: **12px** Plex Arabic, weight 700, color matches icon.
- **Active state: lime color + 2px underline ABOVE the icon** (terminal-style subtle indicator, ~32px wide). No filled background. No glow. No scale animation.
- Inactive: muted gray (`#71717a`).
- Background: `rgba(8,10,14,.98)` + 1px subtle border-top. No drop shadow.
- z-index 9999, position fixed, bottom 0.
- Body padding-bottom on mobile: 76px (clears nav + safe-area inset).

**Top-nav tabs (desktop):**
- Text only. 2px lime underline on active. No pill backgrounds. No background fills.

**No duplicated navigation patterns.** The top nav and bottom nav must not present the same actions in two competing visual treatments. On mobile, the bottom nav owns tabs; the top nav owns branding + utility (lang, account icon). On desktop, the top nav owns tabs; there is no bottom nav.

---

## 6. Components

**Cards (.tcard — market view):**
- Background `#0d1018`. Border 1px subtle, promoted to demand-band color on hot/warm rows.
- Radius 12–14px. Padding 14px. **No drop shadow on cards in lists.**
- Compact horizontal: thumb (56–62px) + body + meta column.

**Buttons:**
- Primary (lime): `#a3e635` bg, `#000` text, weight 700. No glow. No gradient.
- Secondary: `rgba(255,255,255,.05)` bg, `#fff` text, 1px subtle border.
- Heights: 40 (compact) · 46 (default) · 52 (hero only). **Never 60+.**
- Radius 10–12px. Hover = background-darken, never glow.

**Chips / heat tags:**
- 10–11px font · 3–4px vertical padding · 9–11px horizontal padding.
- Border + matching background at ~10% opacity.
- One emoji maximum (allowed heat semantics: 🔥 ⚡ 👀 — nothing else).

**Inputs:**
- 12–14px padding · 16px font (iOS no-zoom) · `rgba(255,255,255,.04)` background.
- Focus border `rgba(163,230,53,.35)`. Radius 10px.

**Modals:**
- Centered, max-width 420px.
- `#0d1018` background · `rgba(163,230,53,.2)` border · radius 18–20px · padding 24–28px.
- Backdrop blur 4–8px (subtle).

**Watchlist / alert items:**
- Single line where possible. Hierarchy: title bold + status + timestamp meta.
- Empty state = one line of copy + one button. **No empty cards as placeholders.**

---

## 7. Motion & Animation

**Allowed:**
- Subtle fades (opacity 0→1, 100–180ms ease)
- Underline width transition on tab active state (120–160ms ease)
- Color transitions on hover/active (100–140ms ease)
- Pulse dot for live indicators (1.6–2s infinite, low-amplitude shadow ring)

**Forbidden:**
- Bouncy easing curves (cubic-bezier with overshoot — no `back`, no spring)
- Transitions longer than 220ms on any UI chrome
- Animated gradients, shimmer on static elements
- Scale-up on tap (`transform: scale(1.05)` on buttons — playful, off-brand)
- Page-transition animations on tab switch (the page swaps instantly)
- Loading spinners as decoration

**Defaults:**
- `transition: <prop> .12s ease` for tab/icon state
- `transition: <prop> .15s ease` for underline width
- `transition: background-color .14s ease` for hover

Motion should feel like a terminal updating — instant, deliberate, never showing off.

---

## 8. Forbidden Patterns

Never ship:
- Flutter / Material-template feeling (Material You curves, FAB shadow stacks, ripple effects)
- Crypto-meme styling (rainbow gradients, holographic, 🚀)
- Excessive glow on static elements
- Giant empty cards with placeholder text
- Fake market visuals (random sparklines, fabricated watcher counts, fake user activity)
- Childish gradients (purple→pink, pastel rainbows)
- Emoji-heavy UI (one emoji per concept maximum)
- Duplicated CTAs on the same screen
- Duplicated navigation patterns (top + bottom showing the same actions)
- Noisy layouts with everything competing for attention
- Tooltips, popovers, or modals as primary navigation

---

## 9. Mobile-First Rules

- Primary actions reachable on the bottom third of the viewport (thumb zone).
- Tap targets ≥ 44×44px with 8px breathing room.
- Bottom nav fixed at viewport bottom on every mobile width.
- Inputs sized 16px font (iOS no-zoom).
- **Quick-hero ≤ 12% of iPhone SE viewport** (≤ 80px including padding) — it is a utility input, not a hero.
- Hero H1 tightens to 40–44px on iPhone SE.

---

## 10. Product Feel

Users **should** feel:
- **Speed** — the market moves, and they are inside the system that watches it
- **FOMO** — there is an opportunity moving, and being late costs money
- **Premium access** — this is a tool for serious buyers, not browsers
- **Information advantage** — they see what the crowd does not

Users **should NOT** feel:
- Casual events-browsing
- Marketing-page-like (sales pitch over function)
- Generic SaaS / Flutter polish

Saudi-market context is implicit. References to الهلال / النصر / موسم الرياض / UFC live in real data, never as marketing decoration.

---

## 11. Future UI Constraint

**Any new UI change MUST:**
1. **Read this file in full** before drafting.
2. **Start wireframe-first** — text outline of structure + hierarchy before any color, shadow, or polish.
3. Use only the palette in §2 and typography in §4. New values require updating this file first.
4. Pass the **"Bloomberg test"** — would this appear in a financial terminal? If not, rework.
5. Pass the **"Saudi premium test"** — does this feel like a serious tool for serious buyers? If not, rework.
6. Justify any deviation in the commit message (reference the rule being broken and why).

**Update protocol:**
- This file is the single source of truth.
- Changes to it require explicit user approval before commit.
- Memory `project_seatx.md` references this file.
- Memory `feedback_no_speculative_intelligence.md` complements it.
- Repo `CLAUDE.md` references this file as MANDATORY pre-read for any UI work.
