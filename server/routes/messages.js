/**
 * Messages API Routes - 消息 API 路由
 */

const { v4: uuidv4 } = require('uuid');
const { queryRun } = require('../models/db');
const { broadcast } = require('../events/sse');

function setupMessagesRoutes(app, activeAdapters) {
  app.post('/api/message/send', async (req, res) => {
    const { agentId, message, type, content } = req.body;

    let adapterName, gatewayAgentId;
    if (agentId && agentId.includes(':')) {
      const colonIdx = agentId.indexOf(':');
      adapterName = agentId.slice(0, colonIdx);
      gatewayAgentId = agentId.slice(colonIdx + 1);
    } else {
      adapterName = Array.from(activeAdapters.keys())[0];
      gatewayAgentId = agentId;
    }

    if (!gatewayAgentId) {
      return res.status(400).json({ success: false, error: 'Invalid agentId' });
    }

    const messageContent = content || message;
    const messageId = uuidv4();
    queryRun('INSERT INTO message_log (id,type,from_agent,to_agent,content) VALUES (?,?,?,?,?)',
      [messageId, type || 'chat', 'dashboard', agentId, JSON.stringify(messageContent)]);

    const adapter = activeAdapters.get(adapterName);
    if (!adapter) {
      return res.status(400).json({ success: false, error: `Adapter not found: ${adapterName}` });
    }

    try {
      const result = await adapter.send(gatewayAgentId, {
        type: type || 'chat',
        content: messageContent,
        callback: `http://localhost:${process.env.PORT || 4000}/webhook/task-complete`
      });
      broadcast('message_sent', { messageId, agentId, content: messageContent });
      res.json({ success: true, messageId, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupMessagesRoutes };
