import http from 'http';

const PORT = 3001;

// Prefilled bot/mock database list to guarantee the ranking starts populated with active look/status goals
let leaderboard = [
  { username: '👑 Chico Coins', aura: 999999, tier: 'Chad Supremo 👑' },
  { username: '🥈 GigaChad Original', aura: 750000, tier: 'Mewing God 🤫' },
  { username: '🥉 Baby Gronk', aura: 450000, tier: 'Sigma Rizzler ⚡' }
];

let sseClients = [];

const server = http.createServer((req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // SSE Stream endpoint for global realtime broadcasts
  if (parsedUrl.pathname === '/api/live' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial list on connect
    res.write(`data: ${JSON.stringify(leaderboard)}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // Fetch leaderboard API
  if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(leaderboard));
    return;
  }

  // Submit/Update score
  if (parsedUrl.pathname === '/api/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, aura, tier } = JSON.parse(body);
        if (!username) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username required' }));
          return;
        }

        // Add or update player in database
        const normalizedName = username.startsWith('@') ? username : `@${username}`;
        const idx = leaderboard.findIndex(p => p.username === normalizedName);

        if (idx !== -1) {
          // Keep the highest recorded score
          leaderboard[idx].aura = Math.max(leaderboard[idx].aura, aura);
          leaderboard[idx].tier = tier;
        } else {
          leaderboard.push({ username: normalizedName, aura, tier });
        }

        // Sort score descending and keep top 50
        leaderboard.sort((a, b) => b.aura - a.aura);
        leaderboard = leaderboard.slice(0, 50);

        // Broadcast to all active clients
        const dataStr = JSON.stringify(leaderboard);
        sseClients.forEach(client => {
          client.write(`data: ${dataStr}\n\n`);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, leaderboard }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Native Realtime Server listening on http://0.0.0.0:${PORT}`);
});
