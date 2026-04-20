/**
 * OpenExTeam Backend - 新入口
 * 重构版：模块化架构
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./models/db');
const { setupSSE, broadcast } = require('./events/sse');
const { loadConfig, saveConfig } = require('./config');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const activeAdapters = new Map();

async function initAdapters() {
  const cfg = loadConfig();
  for (const ac of cfg.adapters || []) {
    if (!ac.enabled) continue;
    try {
      const { createAdapter } = require('./adapter');
      const adapter = createAdapter(ac.type, { url: ac.url, token: ac.token });
      await adapter.connect();
      adapter.on('message', parsed => {
        broadcast('agent_message', parsed);
      });
      activeAdapters.set(ac.name, adapter);
      broadcast('adapter_connected', { name: ac.name });
      console.log(`[Adapter] Connected: ${ac.name}`);
    } catch (err) {
      console.error(`[Adapter] ${ac.name}: ${err.message}`);
    }
  }
}

app.get('/health', (_, res) => {
  const { sseClients } = require('./events/sse');
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: '0.3.0-refactored',
    adapters: [...activeAdapters.keys()],
    sseClients: sseClients.size
  });
});

setupSSE(app);

const { setupConfigRoutes } = require('./routes/config');
const { setupAgentsRoutes } = require('./routes/agents');
const { setupJobsRoutes } = require('./routes/jobs');
const { setupTasksRoutes } = require('./routes/tasks');
const { setupMessagesRoutes } = require('./routes/messages');
const { setupExcardsRoutes } = require('./routes/excards');
const { setupWebhookRoutes } = require('./routes/webhook');

setupConfigRoutes(app, activeAdapters);
setupAgentsRoutes(app, activeAdapters);
setupJobsRoutes(app);
setupTasksRoutes(app, activeAdapters);
setupMessagesRoutes(app, activeAdapters);
setupExcardsRoutes(app);
setupWebhookRoutes(app, activeAdapters);

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

async function start() {
  await initDb();
  await initAdapters();
  app.listen(PORT, () => {
    console.log(`OpenExTeam server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

start().catch(console.error);

module.exports = app;
