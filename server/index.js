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
const { handleAgentReply, setActiveWorkflowsRef, setActiveAdaptersRef, startWorkflow } = require('./services/workflow');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const activeAdapters = new Map();
const activeWorkflows = new Map(); // agentName → jobId 映射，用于跟踪活跃的工作流

// 后台监控和重连管理
const adapterConfigs = new Map(); // 保存适配器配置

// 暴露给路由使用
let globalInitSingleAdapter = null;

// 更新适配器配置（保存新配置时调用）
function updateAdapterConfigs() {
  const cfg = loadConfig();
  adapterConfigs.clear();
  for (const ac of cfg.adapters || []) {
    adapterConfigs.set(ac.name, ac);
  }
  console.log(`[Config] Updated adapterConfigs, loaded ${adapterConfigs.size} config(s)`);
}

async function initAdapters() {
  setActiveWorkflowsRef(activeWorkflows); // 传递引用给 workflow 服务
  setActiveAdaptersRef(activeAdapters); // 传递引用给 workflow 服务

  // 加载配置到内存
  updateAdapterConfigs();

  // 初始化启用的适配器
  for (const [name, ac] of adapterConfigs) {
    if (!ac.enabled) continue;
    // 尝试初始化连接（后台重试）
    initSingleAdapter(ac).catch((err) => {
      console.error(`[Adapter] Failed to initialize ${name}:`, err.message);
    });
  }
}

async function initSingleAdapter(ac) {
  try {
    // 自动修复 URL 格式
    let url = ac.url;
    if (url && url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
      console.log(`[Adapter] Auto-converted URL for ${ac.name}: ${url}`);
    }
    if (url && url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
      console.log(`[Adapter] Auto-converted URL for ${ac.name}: ${url}`);
    }

    const { createAdapter } = require('./adapter');
    const adapter = createAdapter(ac.type, { name: ac.name, url, token: ac.token });

    // 监听消息事件
    adapter.on('message', parsed => {
      broadcast('agent_message', parsed);

      // 检查是否是工作流回复
      const agentName = parsed.from || parsed.agent;
      if (agentName && activeWorkflows.has(agentName)) {
        const jobId = activeWorkflows.get(agentName);
        console.log(`[Workflow] Got reply from ${agentName} for job ${jobId}`);
        const result = handleAgentReply(agentName, parsed, jobId);

        if (result.handled) {
          if (result.action === 'complete') {
            activeWorkflows.delete(agentName); // 清理
          } else if (result.action === 'advanced') {
            // 工作流推进到下一步，需要重新发送给下一个 agent
            console.log(`[Workflow] Step advanced, will need to send next step for job ${jobId}`);
          }
        }
      }
    });

    // 监听连接成功事件
    adapter.on('connected', () => {
      console.log(`[Adapter] ${ac.name} connected (or reconnected)`);
      activeAdapters.set(ac.name, adapter);
      broadcast('adapter_connected', { name: ac.name });
    });

    // 监听断开连接事件 - 适配器内部已处理重连
    adapter.on('disconnected', () => {
      console.log(`[Adapter] ${ac.name} disconnected`);
      activeAdapters.delete(ac.name);
      broadcast('adapter_disconnected', { name: ac.name });
    });

    // 监听错误事件（防止崩溃）
    adapter.on('error', (err) => {
      console.error(`[Adapter] ${ac.name} error:`, err);
    });

    await adapter.connect();
    activeAdapters.set(ac.name, adapter);
    broadcast('adapter_connected', { name: ac.name });
    console.log(`[Adapter] Connected: ${ac.name}`);
  } catch (err) {
    console.error(`[Adapter] ${ac.name}: ${err.message}`);
  }
}

// 手动连接适配器
async function connectAdapterManual(name) {
  console.log(`[Connect] Manual connect requested for: ${name}`);

  // 如果内存中找不到配置，尝试从文件重新加载
  let config = adapterConfigs.get(name);
  if (!config) {
    console.log(`[Connect] Config not found in memory, reloading from file...`);
    updateAdapterConfigs();
    config = adapterConfigs.get(name);
  }

  if (!config) {
    throw new Error(`Adapter config not found: ${name}`);
  }

  if (activeAdapters.has(name)) {
    console.log(`[Connect] Adapter ${name} already connected`);
    return { success: true, message: 'Already connected' };
  }

  console.log(`[Connect] Starting connection for ${name} to ${config.url}`);
  await initSingleAdapter(config);
  return { success: true, message: 'Connected' };
}

// 手动断开适配器
async function disconnectAdapterManual(name) {
  const adapter = activeAdapters.get(name);
  if (adapter) {
    // 从 activeAdapters 中移除，防止自动重连
    activeAdapters.delete(name);
    // 标记为不启用，防止 auto-reconnect
    const config = adapterConfigs.get(name);
    if (config) {
      config.enabled = false;
    }
    await adapter.disconnect();
    broadcast('adapter_disconnected', { name });
    return { success: true, message: 'Disconnected' };
  }
  return { success: true, message: 'Not connected' };
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
const { setupJobStepsRoutes } = require('./routes/job_steps');
const { setupTasksRoutes } = require('./routes/tasks');
const { setupMessagesRoutes } = require('./routes/messages');
const { setupExcardsRoutes } = require('./routes/excards');
const { setupWorkflowRoutes } = require('./routes/workflow');
const { setupWebhookRoutes } = require('./routes/webhook');
const { setupLogsRoutes } = require('./routes/logs');

// API 路由必须在静态文件和通配符路由之前！
setupConfigRoutes(app, activeAdapters, adapterConfigs, { connectAdapterManual, disconnectAdapterManual });
setupAgentsRoutes(app, activeAdapters);
setupJobsRoutes(app);
setupJobStepsRoutes(app);
setupTasksRoutes(app, activeAdapters);
setupMessagesRoutes(app, activeAdapters);
setupExcardsRoutes(app);
setupWorkflowRoutes(app);
setupWebhookRoutes(app, activeAdapters);
setupLogsRoutes(app);

// 手动连接/断开 API
app.post('/api/adapter/:name/connect', async (req, res) => {
  try {
    const name = req.params.name;
    // 确保配置存在并且启用
    const cfg = loadConfig();
    const adapterCfg = cfg.adapters?.find(a => a.name === name);
    if (!adapterCfg) {
      return res.status(404).json({ success: false, message: 'Adapter not found' });
    }
    adapterCfg.enabled = true;
    saveConfig(cfg);
    adapterConfigs.set(name, adapterCfg);

    const result = await connectAdapterManual(name);
    res.json(result);
  } catch (err) {
    console.error('[API] Connect error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/adapter/:name/disconnect', async (req, res) => {
  try {
    const name = req.params.name;
    // 保存配置为不启用
    const cfg = loadConfig();
    const adapterCfg = cfg.adapters?.find(a => a.name === name);
    if (adapterCfg) {
      adapterCfg.enabled = false;
      saveConfig(cfg);
    }

    const result = await disconnectAdapterManual(name);
    res.json(result);
  } catch (err) {
    console.error('[API] Disconnect error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

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
