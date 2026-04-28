/**
 * Messages API Routes - 消息 API 路由
 */

const { v4: uuidv4 } = require('uuid');
const { queryRun, queryAll } = require('../models/db');
const { broadcast } = require('../events/sse');
const { validators, validateMessageSend } = require('../validation');

function setupMessagesRoutes(app, activeAdapters) {
  // 获取聊天历史
  app.get('/api/messages/history', (req, res) => {
    const { agentId, limit = 50 } = req.query;
    let sql, params;

    if (agentId) {
      // 获取与特定 agent 的聊天历史
      sql = `SELECT * FROM message_log
             WHERE (from_agent = ? OR to_agent = ?)
             ORDER BY timestamp DESC LIMIT ?`;
      params = [agentId, agentId, parseInt(limit)];
    } else {
      // 获取所有消息历史
      sql = `SELECT * FROM message_log ORDER BY timestamp DESC LIMIT ?`;
      params = [parseInt(limit)];
    }

    const messages = queryAll(sql, params).reverse(); // 反转按时间正序
    res.json({ messages });
  });

  app.post('/api/message/send', async (req, res) => {
    // 输入验证
    const validation = validateMessageSend({ ...req.body, content: req.body.content || req.body.message });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.errors
      });
    }

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
    queryRun('INSERT INTO message_log (id,type,from_agent,to_agent,content,timestamp) VALUES (?,?,?,?,?,?)',
      [messageId, type || 'chat', 'dashboard', agentId, typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent), new Date().toISOString()]);

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
      // 广播日志事件
      broadcast('log', {
        id: messageId,
        type: type || 'chat',
        from: 'dashboard',
        to: agentId,
        content: messageContent,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true, messageId, ...result });
    } catch (err) {
      console.error('[Messages API] Error sending message:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupMessagesRoutes };
