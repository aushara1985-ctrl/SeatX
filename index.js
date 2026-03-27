express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Setup database
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

// Home page
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
  const events = result.rows;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SeatX</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0b0f; color: #fff; font-family: sans-serif; padding: 20px; }
        h1 { color: #a3e635; margin-bottom: 20px; }
        .event { background: #111; border: 1px solid #222; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
        .title { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
        .status { display: inline-block; padding: 4px 10px; border-radius: 100px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        .available { background: rgba(163,230,53,0.15); color: #a3e635; }
        .unavailable { background: rgba(255,255,255,0.05); color: #666; }
        input { width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; margin-bottom: 8px; }
        button { background: #a3e635; color: #000; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; }
        .add-form { background: #111; border: 1px solid #222; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>🎟 SeatX</h1>
      
      <div class="add-form">
        <h3 style="margin-bottom:12px">Add New Event</h3>
        <input id="title" placeholder="Event title" />
        <input id="url" placeholder="Ticket URL" />
        <button onclick="addEvent()">Add Event</button>
      </div>

      ${events.map(e => `
        <div class="event">
          <div class="title">${e.title}</div>
          <div class="status ${e.status === 'available' ? 'available' : 'unavailable'}">
            ${e.status === 'available' ? '⚡ Available' : '○ Unavailable'}
          </div>
          <div style="font-size:11px;color:#555;margin-bottom:10px">${e.event_url}</div>
          <input id="email-${e.id}" placeholder="Your email for alerts" />
          <button onclick="subscribe(${e.id})">Get Alert</button>
        </div>
      `).join('')}

      <script>
        async function addEvent() {
          const title = document.getElementById('title').value;
          const url = document.getElementById('url').value;
          if (!title || !url) return alert('Fill all fields');
          await fetch('/api/events', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({title, eventUrl: url})
          });
          location.reload();
        }
        async function subscribe(eventId) {
          const email = document.getElementById('email-' + eventId).value;
          if (!email) return alert('Enter your email');
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({eventId, email})
          });
          alert('Alert set!');
        }
      </script>
    </body>
    </html>
  `);
});

// API: Add event
app.post('/api/events', async (req, res) => {
  const { title, eventUrl } = req.body;
  const result = await pool.query(
    'INSERT INTO events (title, event_url) VALUES ($1, $2) RETURNING *',
    [title, eventUrl]
  );
  res.json(result.rows[0]);
});

// API: Subscribe
app.post('/api/subscribe', async (req, res) => {
  const { eventId, email } = req.body;
  await pool.query(
    'INSERT INTO subscriptions (event_id, email) VALUES ($1, $2)',
    [eventId, email]
  );
  res.json({ success: true });
});

// API: Monitor
app.get('/api/monitor', async (req, res) => {
  const events = await pool.query('SELECT * FROM events WHERE status != $1', ['error']);
  const results = [];
  
  for (const event of events.rows) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(event.event_url, { timeout: 10000 });
      const html = await response.text();
      const lower = html.toLowerCase();
      
      const positive = ['buy now','available','add to cart','select seats','get tickets'].filter(s => lower.includes(s));
      const negative = ['sold out','unavailable','coming soon'].filter(s => lower.includes(s));
      
      let status = 'unavailable';
      if (positive.length > 0 && negative.length === 0) status = 'available';
      else if (positive.length > 0) status = 'maybe_available';
      
      await pool.query(
        'UPDATE events SET status=$1, last_checked=NOW() WHERE id=$2',
        [status, event.id]
      );
      
      results.push({ id: event.id, title: event.title, status });
    } catch (err) {
      results.push({ id: event.id, title: event.title, error: err.message });
    }
  }
  
  res.json({ checked: results.length, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await setupDB();
  console.log('SeatX running on port ' + PORT);
});
