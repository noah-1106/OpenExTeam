/**
 * Logs API Routes - 日志查询 API
 */

const { queryAll } = require('../models/db');

function setupLogsRoutes(app) {
  app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const logs = queryAll(
      'SELECT * FROM message_log ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    res.json({ logs });
  });
}

module.exports = { setupLogsRoutes };
