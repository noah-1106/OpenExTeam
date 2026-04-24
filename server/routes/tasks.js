/**
 * Tasks API Routes - 任务 API 路由
 */

const { getTasks, createTask, updateTaskStatus, deleteTask } = require('../models/task');
const { v4: uuidv4 } = require('uuid');
const { queryRun, queryGet } = require('../models/db');
const { broadcast } = require('../events/sse');
const { validators, validateTaskCreate } = require('../validation');

function setupTasksRoutes(app, activeAdapters) {
  app.get('/api/tasks', (req, res) => {
    const { jobId } = req.query;
    res.json({ tasks: getTasks(jobId) });
  });

  app.post('/api/tasks', (req, res) => {
    // 输入验证
    const validation = validateTaskCreate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.errors
      });
    }

    const { id, jobId, title, description, agent } = req.body;
    const result = createTask({ id, jobId, title, description, agent: agent || null });
    res.json({ success: true, id: result.id });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    deleteTask(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/task/start', async (req, res) => {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });

    const task = queryGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    queryRun('UPDATE tasks SET status = ? WHERE id = ?', ['in-progress', taskId]);
    queryRun('INSERT INTO message_log (id,type,task_id,from_agent,to_agent,content) VALUES (?,?,?,?,?,?)',
      [uuidv4(), 'task_assign', taskId, 'dashboard', task.agent, JSON.stringify({ title: task.title, description: task.description })]);

    broadcast('task_updated', { taskId, status: 'in-progress' });

    let adapterName, gatewayAgentId;
    if (task.agent && task.agent.includes(':')) {
      const colonIdx = task.agent.indexOf(':');
      adapterName = task.agent.slice(0, colonIdx);
      gatewayAgentId = task.agent.slice(colonIdx + 1);
    } else {
      adapterName = Array.from(activeAdapters.keys())[0];
      gatewayAgentId = task.agent;
    }

    const adapter = activeAdapters.get(adapterName);
    if (adapter) {
      try {
        await adapter.send(gatewayAgentId, { type: 'task_assign', taskId: task.id, content: { title: task.title, description: task.description } });
      } catch (err) { console.error('[Task]', err.message); }
    }
    res.json({ success: true, taskId, status: 'in-progress' });
  });

  app.post('/api/task/status', (req, res) => {
    const { taskId, status } = req.body;
    if (!taskId || !status) {
      return res.status(400).json({ error: 'taskId and status required' });
    }
    updateTaskStatus(taskId, status);
    res.json({ success: true, taskId, status });
  });
}

module.exports = { setupTasksRoutes };
