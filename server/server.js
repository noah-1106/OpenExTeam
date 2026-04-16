/**
 * OpenExTeam Backend - Express + sql.js + Adapter Layer + SSE
 */

const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createAdapter } = require('./adapter');
const { listExcards, getExcard, createExcard, updateExcard, deleteExcard } = require('./storage/excards');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ================================
// 路径初始化
// ================================
const DATA_DIR = path.join(process.env.HOME || '/root', '.openexteam');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DB_FILE = path.join(__dirname, 'db', 'openexteam.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// ================================
// 数据库（sql.js，同步 API）
// ================================
let db;

function saveDb() {
  if (db) {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  }
}

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
    type TEXT DEFAULT 'one-time', status TEXT DEFAULT 'idle',
    excard_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT, agent TEXT NOT NULL, status TEXT DEFAULT 'todo',
    step_index INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS workflow_state (
    job_id TEXT PRIMARY KEY, status TEXT DEFAULT 'idle',
    current_step INTEGER DEFAULT 0, started_at DATETIME, completed_at DATETIME
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS message_log (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, job_id TEXT, task_id TEXT,
    from_agent TEXT, to_agent TEXT, content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  saveDb();
  console.log('[DB] Initialized at', DB_FILE);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}
function queryGet(sql, params = []) { return queryAll(sql, params)[0] || null; }
function queryRun(sql, params = []) { db.run(sql, params); saveDb(); }

// ================================
// SSE
// ================================
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(': heartbeat\n\n');
  const hb = setInterval(() => res.write(': heartbeat\n\n'), 30000);
  req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
  sseClients.add(res);
});

// ================================
// 配置
// ================================
function loadConfig() {
  try { return fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : { adapters: [], theme: 'light' }; }
  catch { return { adapters: [], theme: 'light' }; }
}
function saveConfig(cfg) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

const activeAdapters = new Map();

async function initAdapters() {
  const cfg = loadConfig();
  for (const ac of cfg.adapters || []) {
    if (!ac.enabled) continue;
    try {
      const adapter = createAdapter(ac.type, { url: ac.url, token: ac.token });
      await adapter.connect();
      adapter.on('message', parsed => broadcast('agent_callback', parsed));
      activeAdapters.set(ac.name, adapter);
      console.log(`[Adapter] Connected: ${ac.name}`);
    } catch (err) { console.error(`[Adapter] ${ac.name}: ${err.message}`); }
  }
}

// ================================
// API Routes
// ================================

app.get('/api/config', (_, res) => res.json(loadConfig()));

app.post('/api/config/adapters', (req, res) => {
  const cfg = loadConfig();
  cfg.adapters = req.body.adapters || [];
  saveConfig(cfg);
  res.json({ success: true });
});

app.post('/api/adapter/test', async (req, res) => {
  const { type, url, token } = req.body;
  try {
    const a = createAdapter(type, { url, token });
    await a.connect();
    const ok = await a.healthCheck();
    await a.disconnect();
    res.json({ success: ok, message: ok ? 'OK' : 'Health check failed' });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.get('/api/agents', async (req, res) => {
  const all = [];
  for (const [name, a] of activeAdapters) {
    try { all.push(...(await a.listAgents()).map(ag => ({ ...ag, adapter: name }))); }
    catch (err) { console.error(`[Agents] ${name}: ${err.message}`); }
  }
  res.json({ agents: all });
});

// 发送消息
app.post('/api/message/send', async (req, res) => {
  const { agentId, agentName, content, type = 'chat' } = req.body;
  if (!agentId && !agentName) return res.status(400).json({ error: 'agentId or agentName required' });

  const messageId = uuidv4();
  queryRun('INSERT INTO message_log (id,type,from_agent,to_agent,content) VALUES (?,?,?,?,?)',
    [messageId, type, 'dashboard', agentId || agentName, JSON.stringify(content)]);

  const adapter = activeAdapters.get(agentName || Object.keys(activeAdapters)[0]);
  if (!adapter) return res.json({ success: true, messageId, warning: 'No adapter connected' });

  try {
    const result = await adapter.send(agentId, { type, content, callback: `http://localhost:${PORT}/webhook/task-complete` });
    broadcast('message_sent', { messageId, agentId, content });
    res.json({ success: true, messageId, ...result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// 启动任务
app.post('/api/task/start', async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  const task = queryGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  queryRun('UPDATE tasks SET status = ? WHERE id = ?', ['in-progress', taskId]);
  queryRun('INSERT INTO message_log (id,type,task_id,from_agent,to_agent,content) VALUES (?,?,?,?,?,?)',
    [uuidv4(), 'task_assign', taskId, 'dashboard', task.agent, JSON.stringify({ title: task.title, description: task.description })]);

  broadcast('task_updated', { taskId, status: 'in-progress' });

  const adapter = Array.from(activeAdapters.values())[0];
  if (adapter) {
    try {
      await adapter.send(task.agent, { type: 'task_assign', taskId: task.id, content: { title: task.title, description: task.description } });
    } catch (err) { console.error('[Task]', err.message); }
  }
  res.json({ success: true, taskId, status: 'in-progress' });
});

// 更新任务状态
app.post('/api/task/status', (req, res) => {
  const { taskId, status } = req.body;
  if (!taskId || !status) return res.status(400).json({ error: 'taskId and status required' });
  queryRun('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId]);
  broadcast('task_updated', { taskId, status });
  res.json({ success: true, taskId, status });
});

// 获取任务列表
app.get('/api/tasks', (req, res) => {
  const { jobId } = req.query;
  const tasks = jobId ? queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId])
                      : queryAll('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json({ tasks });
});

// Job CRUD
app.get('/api/jobs', (_, res) => res.json({ jobs: queryAll('SELECT * FROM jobs ORDER BY created_at DESC') }));

app.post('/api/jobs', (req, res) => {
  const { id = uuidv4(), title, description, type = 'one-time', excardId } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  queryRun('INSERT INTO jobs (id,title,description,type,excard_id) VALUES (?,?,?,?,?)', [id, title, description, type, excardId]);
  res.json({ success: true, id });
});

app.delete('/api/jobs/:id', (req, res) => {
  queryRun('DELETE FROM tasks WHERE job_id = ?', [req.params.id]);
  queryRun('DELETE FROM workflow_state WHERE job_id = ?', [req.params.id]);
  queryRun('DELETE FROM jobs WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.patch('/api/jobs/:id', (req, res) => {
  const { title, description, status, excardId } = req.body;
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  queryRun('UPDATE jobs SET title=?,description=?,status=?,excard_id=? WHERE id=?',
    [title ?? job.title, description ?? job.description, status ?? job.status, excardId ?? job.excard_id, req.params.id]);
  res.json({ success: true });
});

// Task CRUD
app.post('/api/tasks', (req, res) => {
  const { id = uuidv4(), jobId, title, description, agent } = req.body;
  if (!jobId || !title || !agent) return res.status(400).json({ error: 'jobId, title, agent required' });
  queryRun('INSERT INTO tasks (id,job_id,title,description,agent) VALUES (?,?,?,?,?)', [id, jobId, title, description, agent]);
  broadcast('task_created', { id, jobId, title, agent });
  res.json({ success: true, id });
});

app.delete('/api/tasks/:id', (req, res) => {
  queryRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// 启动 Workflow
app.post('/api/workflow/start', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  const tasks = queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId]);
  if (!tasks.length) return res.status(400).json({ error: 'No tasks found' });

  const firstTodo = tasks.find(t => t.status === 'todo');
  if (!firstTodo) return res.json({ success: false, error: tasks.every(t => t.status === 'done') ? 'All done' : 'No pending' });

  const stepIndex = tasks.indexOf(firstTodo) + 1;
  queryRun('INSERT OR REPLACE INTO workflow_state (job_id,status,current_step,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', [jobId, 'running', stepIndex]);
  queryRun('UPDATE tasks SET status=?,step_index=? WHERE id=?', ['in-progress', stepIndex, firstTodo.id]);
  queryRun('UPDATE jobs SET status=? WHERE id=?', ['in-progress', jobId]);

  broadcast('workflow_started', { jobId, currentStep: stepIndex, totalSteps: tasks.length });
  broadcast('task_updated', { taskId: firstTodo.id, status: 'in-progress' });

  const adapter = Array.from(activeAdapters.values())[0];
  if (adapter) {
    adapter.send(firstTodo.agent, {
      type: 'workflow_step', jobId, taskId: firstTodo.id, stepIndex, totalSteps: tasks.length,
      content: { title: firstTodo.title, description: firstTodo.description, context: `步骤 ${stepIndex}/${tasks.length}` }
    }).catch(err => console.error('[Workflow]', err.message));
  }

  res.json({ success: true, started: true, firstTask: { taskId: firstTodo.id, agentId: firstTodo.agent, stepIndex, totalSteps: tasks.length } });
});

// Workflow 状态
app.get('/api/workflow/status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  const state = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
  if (!state) return res.json({ jobId, status: 'idle', currentStep: 0 });
  const current = queryGet('SELECT id as taskId, agent FROM tasks WHERE job_id = ? AND status = ?', [jobId, 'in-progress']);
  res.json({ jobId, status: state.status, currentStep: state.current_step, currentTaskId: current?.taskId, currentAgent: current?.agent, startedAt: state.started_at, completedAt: state.completed_at });
});

// ================================
// Webhook（Agent 回调）
// ================================
app.post('/webhook/task-complete', (req, res) => {
  const { type, taskId, jobId, agent, result } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  queryRun('UPDATE tasks SET status = ? WHERE id = ?', ['done', taskId]);
  queryRun('INSERT INTO message_log (id,type,task_id,job_id,from_agent,to_agent,content) VALUES (?,?,?,?,?,?,?)',
    [uuidv4(), type || 'task_complete', taskId, jobId, agent, 'dashboard', JSON.stringify(result)]);

  broadcast('task_updated', { taskId, status: 'done' });
  broadcast('agent_callback', { type: type || 'task_complete', taskId, jobId, agent, result });

  if (type === 'workflow_step_complete' && jobId) {
    advanceWorkflow(jobId, res);
  } else {
    res.json({ success: true, taskId, status: 'done' });
  }
});

function advanceWorkflow(jobId, res) {
  const tasks = queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId]);
  const next = tasks.find(t => t.status === 'todo');

  if (next) {
    const stepIndex = tasks.indexOf(next) + 1;
    queryRun('UPDATE tasks SET status=?,step_index=? WHERE id=?', ['in-progress', stepIndex, next.id]);
    queryRun('UPDATE workflow_state SET current_step=? WHERE job_id=?', [stepIndex, jobId]);
    broadcast('workflow_step', { jobId, nextTaskId: next.id, stepIndex, totalSteps: tasks.length });
    broadcast('task_updated', { taskId: next.id, status: 'in-progress' });

    const adapter = Array.from(activeAdapters.values())[0];
    if (adapter) {
      adapter.send(next.agent, {
        type: 'workflow_step', jobId, taskId: next.id, stepIndex, totalSteps: tasks.length,
        content: { title: next.title, description: next.description, context: `自动推进：${stepIndex}/${tasks.length}` }
      }).catch(err => console.error('[Workflow]', err.message));
    }
    res.json({ success: true, advanced: true, nextTask: { taskId: next.id, agentId: next.agent, stepIndex, totalSteps: tasks.length } });
  } else {
    queryRun('UPDATE workflow_state SET status=?,completed_at=CURRENT_TIMESTAMP WHERE job_id=?', ['completed', jobId]);
    queryRun('UPDATE jobs SET status=? WHERE id=?', ['done', jobId]);
    broadcast('workflow_completed', { jobId });
    res.json({ success: true, completed: true });
  }
}

// ================================
// ExCard CRUD
// ================================
app.get('/api/excards', (_, res) => {
  try { res.json({ excards: listExcards() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/excards/:id', (req, res) => {
  try {
    const ec = getExcard(req.params.id);
    if (!ec) return res.status(404).json({ error: 'ExCard not found' });
    res.json(ec);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/excards', (req, res) => {
  try {
    if (!req.body.id || !req.body.name) return res.status(400).json({ error: 'id and name required' });
    const ec = createExcard(req.body);
    broadcast('excard_created', { id: ec.id, name: ec.name });
    res.json({ success: true, excard: ec });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/excards/:id', (req, res) => {
  try {
    const ec = updateExcard(req.params.id, req.body);
    broadcast('excard_updated', { id: ec.id, name: ec.name });
    res.json({ success: true, excard: ec });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/excards/:id', (req, res) => {
  try {
    deleteExcard(req.params.id);
    broadcast('excard_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ================================
// Health
// ================================
app.get('/health', (_, res) => res.json({ ok: true, timestamp: new Date().toISOString(), version: '0.2.0', adapters: [...activeAdapters.keys()], sseClients: sseClients.size }));

// ================================
// 启动
// ================================
async function start() {
  await initDb();
  await initAdapters();
  app.listen(PORT, () => {
    console.log(`OpenExTeam server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api  |  SSE: http://localhost:${PORT}/api/events  |  Health: http://localhost:${PORT}/health`);
  });
}

start().catch(console.error);

module.exports = app;
