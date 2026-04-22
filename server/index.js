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
const activeWorkflows = new Map(); // agentName → jobId 映射，用于跟踪活跃的工作流

// 后台监控和重连管理
const adapterConfigs = new Map(); // 保存适配器配置

async function initAdapters() {
  const cfg = loadConfig();
  const { handleAgentReply, setActiveWorkflowsRef, startWorkflow, getExcard, getWorkflowSteps } = require('./services/workflow');
  setActiveWorkflowsRef(activeWorkflows); // 传递引用给 workflow 服务

  for (const ac of cfg.adapters || []) {
    if (!ac.enabled) continue;
    // 保存配置供后续重连用
    adapterConfigs.set(ac.name, ac);
    // 尝试初始化连接（后台重试）
    initSingleAdapter(ac).catch(() => {});
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

    // 监听断开连接事件
    adapter.on('disconnected', () => {
      console.log(`[Adapter] ${ac.name} disconnected`);
      activeAdapters.delete(ac.name);
      broadcast('adapter_disconnected', { name: ac.name });
    });

    // 监听错误事件（防止崩溃）
    adapter.on('error', (err) => {
      console.error(`[Adapter] ${ac.name} error: ${err.message}`);
    });

    await adapter.connect();
    activeAdapters.set(ac.name, adapter);
    broadcast('adapter_connected', { name: ac.name });
    console.log(`[Adapter] Connected: ${ac.name}`);
  } catch (err) {
    console.error(`[Adapter] ${ac.name}: ${err.message}, adapter will retry automatically`);
    // 适配器会自己处理重连，不在这里重复调用
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
const { setupWorkflowRoutes } = require('./routes/workflow');
const { setupWebhookRoutes } = require('./routes/webhook');

// API 路由必须在静态文件和通配符路由之前！
setupConfigRoutes(app, activeAdapters);
setupAgentsRoutes(app, activeAdapters);
setupJobsRoutes(app);
setupTasksRoutes(app, activeAdapters);
setupMessagesRoutes(app, activeAdapters);
setupExcardsRoutes(app);
setupWorkflowRoutes(app, activeAdapters);
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
