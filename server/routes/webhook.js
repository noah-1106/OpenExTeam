/**
 * Webhook Routes - Agent 回调路由
 */

const { queryRun, queryGet, queryAll } = require('../models/db');
const { broadcast } = require('../events/sse');
const { advanceWorkflow } = require('../services/workflow');

function setupWebhookRoutes(app, activeAdapters) {
  app.post('/webhook/task-complete', (req, res) => {
    const { type, taskId, jobId, agent, result } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: 'taskId required' });
    }

    queryRun('UPDATE tasks SET status = ? WHERE id = ?', ['done', taskId]);
    const { v4: uuidv4 } = require('uuid');
    queryRun('INSERT INTO message_log (id,type,task_id,job_id,from_agent,to_agent,content) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), type || 'task_complete', taskId, jobId, agent, 'dashboard', JSON.stringify(result)]);

    broadcast('task_updated', { taskId, status: 'done' });
    broadcast('agent_callback', { type: type || 'task_complete', taskId, jobId, agent, result });

    if (type === 'workflow_step_complete' && jobId) {
      advanceWorkflow(jobId, activeAdapters, res);
    } else {
      res.json({ success: true, taskId, status: 'done' });
    }
  });
}

module.exports = { setupWebhookRoutes };
