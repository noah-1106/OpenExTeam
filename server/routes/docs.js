/**
 * Docs API Routes - 文档 API 路由
 * 从 ~/.openexteam/docs/ 目录读取 Markdown 文件
 */

const path = require('path');
const fs = require('fs');
const { DOCS_DIR } = require('../config');

// 默认文档内容
const DEFAULT_DOCS = {
  '01-intro.md': `# OpenExTeam

OpenExTeam 是一个跨框架 AI Agent 团队协作平台，在一个 Dashboard 上统一管理不同底座的 AI Agent。

## 核心功能

- **多底座支持**：统一管理 OpenClaw、Hermes、DeerFlow 等不同框架的 Agent
- **消息即总线**：所有交互通过消息完成，不侵入底座内部
- **聊天协作**：与单个 Agent 对话，支持流式输出和聊天历史持久化
- **系统通知**：工作流进度、工具调用等系统消息集中在一个会话中
- **工作编排**：创建多步骤工作流，Agent 完成一步自动推进下一步
- **ExCard 模板**：使用 Markdown 定义完整的任务执行模板
- **实时看板**：三列看板展示当前执行中工作的步骤进度

## 快速开始

1. 在设置页添加底座连接
2. 在聊天页与 Agent 对话
3. 在工作页创建并执行任务
4. 在看板页查看执行进度

## 核心概念

| 概念 | 说明 |
|------|------|
| Agent | AI 助手，由底座框架管理运行 |
| 底座 (Adapter) | Agent 运行框架（OpenClaw/Hermes/DeerFlow） |
| 工作 (Job) | 任务容器，可包含多个步骤 |
| 步骤 (Step) | 工作的单个执行单元，可指定不同 Agent |
| ExCard | Markdown 格式的完整执行模板 |
| 消息总线 | 所有交互的核心通道，Dashboard 只做发消息、收消息、驱动工作流 |`,

  '02-openclaw.md': `# OpenClaw 连接指南

## 前置准备

确保 OpenClaw Gateway 正在运行：

\`\`\`bash
openclaw gateway start
\`\`\`

## 获取 Token

\`\`\`bash
openclaw config get gateway.auth.token
\`\`\`

## 在 Dashboard 添加连接

1. 进入设置页面
2. 点击「新建连接」
3. 填写信息：
   - 连接名称：如「我的 OpenClaw」
   - 类型：选择 OpenClaw
   - URL：\`ws://127.0.0.1:18789\`
   - Token：从上面获取的 token

## 批准配对

连接测试后，在 Gateway 端执行：

\`\`\`bash
# 查看待配对设备
openclaw devices list

# 批准配对
openclaw devices approve <requestId>
\`\`\`

## 验证连接

设置页会显示「已连接」状态，Agent 列表自动加载。`,

  '03-hermes.md': `# Hermes 连接指南

## 前置准备

安装 Hermes CLI：

\`\`\`bash
# 官方安装脚本
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# 或通过 pip
pip install hermes-agent
\`\`\`

验证安装：

\`\`\`bash
hermes --help
hermes status
\`\`\`

## 连接模式

Hermes 适配器支持两种连接模式：

### CLI 模式（默认）

不填写 URL 时自动使用 CLI 模式。Dashboard 通过调用本地 \`hermes\` 命令与 Agent 交互：
- \`hermes profile list\` — 列出可用配置
- \`hermes chat -q "prompt" --quiet\` — 发送消息
- \`hermes sessions list\` — 列出会话
- \`hermes insights\` — 查看 Token 使用情况

### API Server 模式

填写 URL 时使用 API Server 模式（需要 Hermes Gateway 启用 API Server 平台，默认端口 8642）：

\`\`\`
URL: http://127.0.0.1:8642
\`\`\`

## 在 Dashboard 添加连接

1. 进入设置页面
2. 点击「新建连接」
3. 填写信息：
   - 连接名称：如「我的 Hermes」
   - 类型：选择 Hermes
   - URL：留空使用 CLI 模式，或填写 API 地址
   - Token：API 模式的认证令牌（CLI 模式不需要）

## 验证连接

设置页会显示「已连接」状态，Agent 列表自动加载。

> **注意**：CLI 模式仅支持本地运行。如果 Hermes 安装在远程服务器，请使用 API Server 模式。`,

  '04-deerflow.md': `# DeerFlow 连接指南

## 前置准备

启动 DeerFlow 服务（默认端口 2026）：

\`\`\`bash
# 克隆并启动
git clone https://github.com/bytedance/deer-flow.git
cd deer-flow
# 参照官方 README 启动服务
\`\`\`

DeerFlow 通过 Nginx 反向代理提供统一 API（端口 2026），内部路由到 FastAPI Gateway 和 LangGraph Server。

## 在 Dashboard 添加连接

1. 进入设置页面
2. 点击「新建连接」
3. 填写信息：
   - 连接名称：如「我的 DeerFlow」
   - 类型：选择 DeerFlow
   - URL：\`http://127.0.0.1:2026\`（默认）
   - Token：留空（DeerFlow 默认无认证）

## 架构说明

DeerFlow 2.0 是单 Agent + 动态 Sub-Agent 架构：
- 通过 Skills 扩展能力
- 支持 flash / standard / pro / ultra 四种执行模式
- 使用 LangGraph Runs API 进行交互

## 验证连接

设置页会显示「已连接」状态，Agent 列表自动加载。

> **注意**：DeerFlow 设计用于本地可信环境，默认只监听 127.0.0.1。远程部署需自行配置认证。`,

  '05-chat.md': `# 聊天使用指南

## 会话列表

左侧显示所有聊天会话：

- **系统通知**：工作流进度、工具调用等系统消息集中展示，不支持发送消息
- **私聊**：与单个 Agent 的一对一对话，显示 Agent 名称和底座名称

## 会话排序与未读提示

- 有新消息的会话自动排到列表顶部
- 未读消息显示红色徽章，切到该会话后自动清除

## 流式输出

Agent 回复采用流式输出，消息逐步呈现，实时更新。

## 聊天历史

聊天记录持久化保存，刷新或重新打开 Dashboard 后可查看完整对话。

## 斜杠命令

在输入框中输入斜杠命令可以触发特殊功能：

- \`/ec <需求>\` — 让 Agent 帮忙创建 ExCard
- \`/ec-modify <card-id> <需求>\` — 让 Agent 帮忙修改已有 ExCard

示例：

\`\`\`
/ec 创建一个每日汇总报告的 ExCard
\`\`\`

## Agent 离线

当 Agent 离线时，发送消息会提示「Agent 离线，无法发送消息」。请在设置页检查底座连接状态。`,

  '06-job.md': `# 工作使用指南

## 什么是工作

工作是任务的容器，可以编排多个步骤自动执行。

## 创建工作

1. 进入工作页面
2. 点击「新建工作」
3. 填写：
   - 标题：工作名称
   - 描述：工作说明
   - 类型：一次性或周期性

## 添加步骤

在工作详情页，点击「编辑」添加步骤：

- **任务**：简单的单步任务
- **ExCard**：使用预定义的复杂模板

每个步骤需要：
- 标题：步骤名称
- 描述（可选）：步骤说明
- 执行 Agent：由哪个 Agent 执行

## 启动工作

点击「启动工作流」按钮：
1. Dashboard 自动发送第一步给指定 Agent
2. Agent 执行后返回 \`[WORKFLOW] status: complete\`
3. Dashboard 自动推进到下一步
4. 所有步骤完成后标记工作为完成

## 查看进度

在看板页面查看工作的实时进度。`,

  '07-excard.md': `# ExCard 使用指南

## 什么是 ExCard

ExCard（Execution Card）是场景化的执行标准，用 Markdown 格式定义 **"如何做"**（执行标准），而非 **"做什么"**（任务列表）。它将 Agent 的执行经验从"记忆"转化为"约定"，确保工作流可重复、可追溯。

## 命名规范

\`\`\`
EC-{XXX}-{descriptive-name}.md
\`\`\`

- \`XXX\` 为3位编号（001, 002, ...）
- 名称使用小写英文和连字符
- 示例：\`EC-001-daily-report\`、\`EC-002-social-prospecting\`

## 必需的三个核心 Section

每个 ExCard **必须**包含以下三个 Section，否则不完整：

### 1. Resource Dependencies — 资源依赖

列出执行所需的所有技能、文件、工具等资源，每个资源用子标题+清单描述：

\`\`\`markdown
## Resource Dependencies

### style_fingerprint
- **Type**: Skill
- **Source**: Skills_Repo
- **Path**: skills/style_fingerprint/
- **Purpose**: 加载写作风格
\`\`\`

Type 包括：\`Skill\`、\`File\`、\`Directory\`、\`Database\`、\`Config\`、\`API\`

### 2. Execution Workflow — 执行工作流

按步骤定义执行过程（3-15步），每个步骤包含：

\`\`\`markdown
## Execution Workflow

### Step 1: 加载输入
- **Action**: 读取主题标题和研究报告
- **Tool Used**: file_reader
- **Input**: 研究报告文件路径
- **Output**: 结构化的研究数据
- **Checkpoint**: 确认数据完整且格式正确
\`\`\`

### 3. Execution Conventions — 执行约定

定义输入输出规范和错误处理：

\`\`\`markdown
## Execution Conventions

### Input Conventions
- **数据来源**: memory/YYYY-MM-DD.md
- **数据格式**: Markdown 格式的研究报告

### Output Conventions
- **保存位置**: articles/YYYY-MM-DD/[标题].md
- **输出格式**: 完整的 Markdown 文章

### Error Handling
- **研究数据缺失**: 使用搜索技能补充
- **质量检查未通过**: 返回修订，最多3次
\`\`\`

## 创建 ExCard

### 方式一：手动创建

1. 进入 ExCard 页面
2. 点击「新建 ExCard」
3. 填写名称和描述
4. 按 Markdown 格式编写内容
5. 绑定默认 Agent

### 方式二：通过聊天让 Agent 创建

使用 \`/ec\` 斜杠命令：

\`\`\`
/ec 创建一个每日汇总报告的 ExCard
\`\`\`

Agent 会返回 \`[EXCARD_PROPOSAL]\` 格式的提案，Dashboard 弹出确认框。

### 方式三：修改已有 ExCard

\`\`\`
/ec-modify ec-abc123 增加一个质量检查步骤
\`\`\`

## 在工作中使用 ExCard

编辑工作时，添加类型为「ExCard」的步骤，选择已创建的 ExCard。工作流引擎会按步骤自动执行。`,

  '08-board.md': `# 看板使用指南

## 看板用途

看板专门用于展示当前正在执行的工作进度，聚焦于活跃任务。

## 查看工作

顶部显示当前正在执行的工作列表，点击查看详情。

## 步骤状态

每个工作分为三列：

- **待执行**：灰色，未开始的步骤
- **执行中**：蓝色，当前正在执行的步骤（带脉冲动画）
- **已完成**：绿色，已完成的步骤

## 实时更新

步骤状态变化时看板自动更新，无需刷新页面。

## 启动工作

在工作页面点击「启动工作流」，看板会自动加载并展示步骤进度。`,

  '09-monitor.md': `# 监控面板

## Agent 状态

顶部显示所有已连接的 Agent：
- 🟢 在线
- 🟠 忙碌
- ⚪ 离线/已解绑

## 实时日志

显示系统和 Agent 的所有活动：
- 工作流启动/完成
- Agent 消息发送/接收
- 配对事件
- 错误警告

日志按时间倒序排列，最新在最前。

## 刷新

点击右上角刷新按钮重新加载日志。`,
};

// 确保默认文档存在
function ensureDefaultDocs() {
  const existingFiles = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  if (existingFiles.length === 0) {
    console.log('[Docs] No documents found, generating defaults...');
    for (const [filename, content] of Object.entries(DEFAULT_DOCS)) {
      fs.writeFileSync(path.join(DOCS_DIR, filename), content, 'utf8');
    }
    console.log(`[Docs] Generated ${Object.keys(DEFAULT_DOCS).length} default documents`);
  }
}

ensureDefaultDocs();

function setupDocsRoutes(app) {
  // 获取文档列表
  app.get('/api/docs', (_req, res) => {
    try {
      const files = fs.readdirSync(DOCS_DIR)
        .filter(f => f.endsWith('.md'))
        .sort();

      const docs = files.map(filename => {
        const filepath = path.join(DOCS_DIR, filename);
        const content = fs.readFileSync(filepath, 'utf8');
        // 从第一行 # 标题 提取标题
        const firstLine = content.split('\n')[0] || '';
        const titleMatch = firstLine.match(/^#\s+(.+)$/);
        const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, '');
        const id = filename.replace(/\.md$/, '');

        return { id, title, filename };
      });

      res.json({ docs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 获取单个文档内容
  app.get('/api/docs/:filename', (req, res) => {
    try {
      const filename = req.params.filename;

      // 安全校验
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      if (!filename.endsWith('.md')) {
        return res.status(400).json({ error: 'Only .md files allowed' });
      }

      const filepath = path.join(DOCS_DIR, filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const firstLine = content.split('\n')[0] || '';
      const titleMatch = firstLine.match(/^#\s+(.+)$/);
      const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, '');

      res.json({ title, content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { setupDocsRoutes };
