/**
 * OpenExTeam SSE - Server-Sent Events
 */

const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {}
  }
}

function setupSSE(app) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(': heartbeat\n\n');

    const hb = setInterval(() => res.write(': heartbeat\n\n'), 30000);
    req.on('close', () => {
      clearInterval(hb);
      sseClients.delete(res);
    });
    sseClients.add(res);
  });
}

module.exports = {
  broadcast,
  setupSSE,
  sseClients
};
