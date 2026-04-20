/**
 * Agents API Routes - Agent API 路由
 */

function setupAgentsRoutes(app, activeAdapters) {
  app.get('/api/agents', async (req, res) => {
    const all = [];
    for (const [name, a] of activeAdapters.entries()) {
      try {
        const agents = await a.listAgents();
        all.push(...agents.map(ag => ({
          id: `${name}:${ag.id}`,
          name: ag.name,
          status: ag.status,
          connected: ag.connected,
          adapter: name
        })));
      } catch (err) {
        console.error(`[Server] listAgents failed for adapter ${name}:`, err.message);
      }
    }
    res.json({ agents: all });
  });
}

module.exports = { setupAgentsRoutes };
