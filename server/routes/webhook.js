/**
 * Webhook Routes - Agent 回调路由
 */

const { queryRun, queryGet, queryAll } = require('../models/db');
const { broadcast } = require('../events/sse');
const { completeWorkflow } = require('../services/workflow');

function setupWebhookRoutes(app, activeAdapters) {
  app.post('/webhook/task-complete', (req, res) => {
    const { type, taskId, jobId, agent, result } = req.body;

    if (jobId) {
      // 如果有 jobId，完成整个工作流
      completeWorkflow(jobId);
      broadcast('agent_callback', { type: type || 'workflow_complete', jobId, agent, result });
      res.json({ success: true, jobId, status: 'done' });
    } else if (taskId) {
      // 只有 taskId，只更新单个任务
      queryRun('UPDATE tasks SET status = ? WHERE id = ?', ['done', taskId]);
      const { v4: uuidv4 } = require('uuid');
      queryRun('INSERT INTO message_log (id,type,task_id,job_id,from_agent,to_agent,content) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), type || 'task_complete', taskId, jobId, agent, 'dashboard', JSON.stringify(result)]);

      broadcast('task_updated', { taskId, status: 'done' });
      broadcast('agent_callback', { type: type || 'task_complete', taskId, jobId, agent, result });
      res.json({ success: true, taskId, status: 'done' });
    } else {
      res.status(400).json({ error: 'taskId or jobId required' });
    }
  });
}

module.exports = { setupWebhookRoutes };
