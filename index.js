const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      event_url TEXT NOT NULL,
      status TEXT DEFAULT 'unavailable',
      last_checked TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id),
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
  const events = result.rows;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SeatX — The seat market, live.</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#0a0b0f;color:#f4f4f5;-webkit-font-smoothing:antialiased;min-height:100vh}
nav{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,11,15,.9);position:sticky;top:0;z-index:10;backdrop-filter:blur(20px)}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:36px;height:36px;border-radius:10px;background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.25);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#a3e635}
.logo-seat{font-size:16px;font-weight:800;color:#fff}
.logo-x{font-size:20px;font-weight:900;color:#a3e635;filter:drop-shadow(0 0 8px rgba(163,230,53,.7))}
.logo-sub{font-size:10px;color:#52525b;margin-top:1px}
.nav-btn{background:#a3e635;border:none;border-radius:9px;padding:8px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;color:#000;cursor:pointer}
.hero{max-width:900px;margin:0 auto;padding:64px 24px 40px;text-align:center}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.2);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;color:#a3e635;letter-spacing:.1em;text-transform:uppercase;margin-bottom:24px}
.badge-dot{width:5px;height:5px;border-radius:50%;background:#a3e635}
h1{font-size:clamp(44px,7vw,80px);font-weight:900;line-height:.95;letter-spacing:-.03em;color:#fff;margin-bottom:20px}
.accent{color:#a3e635;filter:drop-shadow(0 0 20px rgba(163,230,53,.4))}
.hero-sub{font-size:17px;color:#71717a;line-height:1.75;max-width:500px;margin:0 auto 32px}
.stats{display:flex;justify-content:center;gap:32px;flex-wrap:wrap;margin-bottom:48px}
.stat{text-align:center}
.stat-val{font-size:24px;font-weight:800;color:#fff}
.stat-label{font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-top:2px}
.stat-div{width:1px;background:rgba(255,255,255,.08);align-self:stretch}
.form-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:28px;max-width:520px;margin:0 auto 64px;text-align:left}
.form-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:4px}
.form-sub{font-size:12px;color:#71717a;margin-bottom:20px}
.field{margin-bottom:12px}
.field label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#52525b;margin-bottom:6px}
input[type=text],input[type=email],input[type=url]{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:11px 14px;font-size:13px;font-family:'DM Sans',sans-serif;color:#fff;outline:none}
input::placeholder{color:#3f3f46}
input:focus{border-color:rgba(163,230,53,.4)}
.submit-btn{width:100%;background:#a3e635;border:none;border-radius:11px;padding:13px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;color:#000;cursor:pointer;margin-top:4px}
.submit-btn:hover{background:#bef264}
.note{text-align:center;font-size:11px;color:#3f3f46;margin-top:10px}
.events-section{max-width:900px;margin:0 auto;padding:0 24px 80px}
.section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:#52525b;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#f87171;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5)}50%{box-shadow:0 0 0 5px rgba(248,113,113,0)}}
.events-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.ev-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;transition:border-color .2s,transform .2s}
.ev-card:hover{border-color:rgba(163,230,53,.25);transform:translateY(-2px)}
.ev-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:8px}
.ev-url{font-size:11px;color:#52525b;margin-bottom:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;margin-bottom:14px}
.status-available{background:rgba(163,230,53,.12);color:#a3e635;border:1px solid rgba(163,230,53,.2)}
.status-unavailable{background:rgba(255,255,255,.04);color:#52525b;border:1px solid rgba(255,255,255,.08)}
.status-maybe{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}
.ev-email{width:100%;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:9px 12px;font-size:12px;font-family:'DM Sans',sans-serif;color:#fff;outline:none;margin-bottom:8px}
.ev-email::placeholder{color:#3f3f46}
.alert-btn{width:100%;background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.2);border-radius:9px;padding:9px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;color:#a3e635;cursor:pointer}
.alert-btn:hover{background:rgba(163,230,53,.2)}
.empty{text-align:center;padding:48px;color:#52525b;font-size:14px}
footer{border-top:1px solid rgba(255,255,255,.06);padding:20px;text-align:center;font-size:11px;color:#3f3f46}
</style>
</head>
<body>

<nav>
  <div class="logo">
    <div class="logo-icon">X</div>
    <div>
      <div style="display:flex;align-items:baseline;gap:1px">
        <span class="logo-seat">SEAT</span><span class="logo-x">X</span>
      </div>
      <div class="logo-sub">Live seat market intelligence</div>
    </div>
  </div>
  <button class="nav-btn" onclick="document.getElementById('track-form').scrollIntoView({behavior:'smooth'})">Start watching</button>
</nav>

<div class="hero">
  <div class="hero-badge"><div class="badge-dot"></div>Live · Saudi Arabia 🇸🇦</div>
  <h1>The seat market,<br><span class="accent">live.</span></h1>
  <p class="hero-sub">Track hot events, watch demand move, and get alerted before the crowd.</p>
  <div class="stats">
    <div class="stat"><div class="stat-val">${events.length}</div><div class="stat-label">Events tracked</div></div>
    <div class="stat-div"></div>
    <div class="stat"><div class="stat-val">15s</div><div class="stat-label">Check speed</div></div>
    <div class="stat-div"></div>
    <div class="stat"><div class="stat-val">${events.filter(e=>e.status==='available').length}</div><div class="stat-label">Available now</div></div>
  </div>

  <div class="form-card" id="track-form">
    <div class="form-title">Track any event</div>
    <div class="form-sub">We'll alert you the moment seats become available.</div>
    <div class="field"><label>Event title</label><input type="text" id="ev-title" placeholder="Al Nassr vs Al Hilal"/></div>
    <div class="field"><label>Ticket URL</label><input type="url" id="ev-url" placeholder="https://ticketmaster.sa/..."/></div>
    <button class="submit-btn" onclick="addEvent()">🎟 Track this event</button>
    <div class="note">Free · No account needed · Instant alerts</div>
  </div>
</div>

<div class="events-section">
  <div class="section-label"><div class="live-dot"></div>Live events</div>
  ${events.length === 0 ? '<div class="empty">No events yet — add the first one above 👆</div>' : `
  <div class="events-grid">
    ${events.map(e => `
    <div class="ev-card">
      <div class="ev-title">${e.title}</div>
      <div class="ev-url">${e.event_url}</div>
      <div class="ev-status ${e.status === 'available' ? 'status-available' : e.status === 'maybe_available' ? 'status-maybe' : 'status-unavailable'}">
        ${e.status === 'available' ? '⚡ Available' : e.status === 'maybe_available' ? '👀 Maybe' : '○ Watching'}
      </div>
      <input class="ev-email" id="email-${e.id}" placeholder="your@email.com"/>
      <button class="alert-btn" onclick="subscribe(${e.id})">Get Alert</button>
    </div>`).join('')}
  </div>`}
</div>

<footer>© 2025 SeatX · Built for fans · 🇸🇦 Saudi Arabia</footer>

<script>
async function addEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const url = document.getElementById('ev-url').value.trim();
  if (!title || !url) return alert('Fill all fields');
  const btn = document.querySelector('.submit-btn');
  btn.textContent = 'Setting up...';
  btn.disabled = true;
  await fetch('/api/events', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({title, eventUrl: url})
  });
  location.reload();
}
async function subscribe(eventId) {
  const email = document.getElementById('email-' + eventId).value.trim();
  if (!email || !email.includes('@')) return alert('Enter a valid email');
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({eventId, email})
  });
  alert('✅ Alert set! We will email you when seats appear.');
}
</script>
</body>
</html>`);
});

app.post('/api/events', async (req, res) => {
  const { title, eventUrl } = req.body;
  const result = await pool.query(
    'INSERT INTO events (title, event_url) VALUES ($1, $2) RETURNING *',
    [title, eventUrl]
  );
  res.json(result.rows[0]);
});

app.post('/api/subscribe', async (req, res) => {
  const { eventId, email } = req.body;
  await pool.query(
    'INSERT INTO subscriptions (event_id, email) VALUES ($1, $2)',
    [eventId, email]
  );
  res.json({ success: true });
});

app.get('/api/monitor', async (req, res) => {
  const events = await pool.query("SELECT * FROM events WHERE status != 'error'");
  const results = [];
  for (const event of events.rows) {
    try {
      const response = await fetch(event.event_url, {
        headers: {'User-Agent': 'Mozilla/5.0'},
        signal: AbortSignal.timeout(10000)
      });
      const html = await response.text();
      const lower = html.toLowerCase();
      const positive = ['buy now','available','add to cart','select seats','get tickets'].filter(s => lower.includes(s));
      const negative = ['sold out','unavailable','coming soon'].filter(s => lower.includes(s));
      let status = 'unavailable';
      if (positive.length > 0 && negative.length === 0) status = 'available';
      else if (positive.length > 0) status = 'maybe_available';
      await pool.query('UPDATE events SET status=$1, last_checked=NOW() WHERE id=$2', [status, event.id]);
      results.push({ id: event.id, title: event.title, status });
    } catch (err) {
      results.push({ id: event.id, error: err.message });
    }
  }
  res.json({ checked: results.length, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await setupDB();
  console.log('SeatX running on port ' + PORT);
});
