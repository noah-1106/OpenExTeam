<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const docs = ref([
  {
    id: 'intro',
    title: '项目介绍',
    content: `# OpenExTeam

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
    category: '快速入门',
  },
  {
    id: 'openclaw',
    title: 'OpenClaw 连接',
    content: `# OpenClaw 连接指南

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
    category: '连接指南',
  },
  {
    id: 'hermes',
    title: 'Hermes 连接',
    content: `# Hermes 连接指南

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
    category: '连接指南',
  },
  {
    id: 'deerflow',
    title: 'DeerFlow 连接',
    content: `# DeerFlow 连接指南

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
    category: '连接指南',
  },
  {
    id: 'chat',
    title: '聊天使用指南',
    content: `# 聊天使用指南

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
    category: '使用指南',
  },
  {
    id: 'job',
    title: '工作使用指南',
    content: `# 工作使用指南

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
    category: '使用指南',
  },
  {
    id: 'excard',
    title: 'ExCard 使用指南',
    content: `# ExCard 使用指南

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

### 写作自检清单
- **Type**: File
- **Source**: User-defined
- **Path**: 写作自检清单.md
- **Purpose**: 质量检查标准
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

### Step 2: 确定选题方向
- **Action**: 分析研究数据，确定核心问题
- **Tool Used**: style_fingerprint
- **Input**: 研究数据
- **Output**: 选题方向和角度
- **Checkpoint**: 选题角度与目标受众匹配
\`\`\`

### 3. Execution Conventions — 执行约定

定义输入输出规范和错误处理：

\`\`\`markdown
## Execution Conventions

### Input Conventions
- **数据来源**: memory/YYYY-MM-DD.md
- **数据格式**: Markdown 格式的研究报告
- **前置条件**: 研究数据文件已存在

### Output Conventions
- **保存位置**: articles/YYYY-MM-DD/[标题]-YYYY-MM-DD.md
- **输出格式**: 完整的 Markdown 文章
- **状态记录**: 更新 status.md 中的执行状态

### Error Handling
- **研究数据缺失**: 使用搜索技能补充
- **风格指纹未找到**: 使用默认风格
- **质量检查未通过**: 返回修订，最多3次
\`\`\`

## 完整模板示例

\`\`\`markdown
# EC-001: 每日汇总报告

## Resource Dependencies

### rss_reader
- **Type**: Skill
- **Source**: Skills_Repo
- **Path**: skills/rss_reader/
- **Purpose**: RSS 数据采集

### summarizer
- **Type**: Skill
- **Source**: Skills_Repo
- **Path**: skills/summarizer/
- **Purpose**: 内容摘要生成

### 输出目录
- **Type**: Directory
- **Source**: Auto-created
- **Path**: reports/YYYY-MM-DD/
- **Purpose**: 报告保存

## Execution Workflow

### Step 1: 采集数据源
- **Action**: 从配置的 RSS 源采集最近24小时的内容
- **Tool Used**: rss_reader
- **Input**: RSS 订阅列表
- **Output**: 原始文章列表
- **Checkpoint**: 至少采集到5篇文章

### Step 2: 生成摘要
- **Action**: 对每篇文章提取关键信息并生成摘要
- **Tool Used**: summarizer
- **Input**: 原始文章列表
- **Output**: 结构化摘要数据
- **Checkpoint**: 每篇摘要不超过200字

### Step 3: 编排报告
- **Action**: 按主题分类摘要，生成完整报告
- **Tool Used**: -
- **Input**: 结构化摘要数据
- **Output**: 完整的 Markdown 报告
- **Checkpoint**: 报告包含分类标题和摘要

### Step 4: 保存交付
- **Action**: 保存报告到输出目录
- **Tool Used**: file_writer
- **Input**: 完整报告内容
- **Output**: 保存路径确认
- **Checkpoint**: 文件成功写入

## Execution Conventions

### Input Conventions
- **数据来源**: RSS 订阅配置
- **时间范围**: 最近24小时
- **前置条件**: RSS 源配置正确

### Output Conventions
- **保存位置**: reports/YYYY-MM-DD/daily-report.md
- **输出格式**: Markdown 报告
- **状态记录**: 更新 last-run.md

### Error Handling
- **RSS 源不可达**: 跳过该源，记录警告
- **采集内容为空**: 使用缓存数据
- **摘要生成失败**: 保留原文前200字
\`\`\`

## 可选 Section

| Section | 说明 |
|---------|------|
| \`## Applicable Scenarios\` | 适用场景、触发条件、执行频率 |
| \`## Quality Redlines\` | 不可违反的硬性规则 |
| \`## Mode Details\` | 多模式 ExCard 的各模式说明 |
| \`## Changelog\` | 版本变更记录 |

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
/ec 创建一个每日汇总报告的 ExCard，功能包括收集当天的信息并生成报告
\`\`\`

Agent 会返回 \`[EXCARD_PROPOSAL]\` 格式的提案，Dashboard 弹出确认框，你可以在确认前修改内容。

### 方式三：修改已有 ExCard

\`\`\`
/ec-modify ec-abc123 增加一个质量检查步骤
\`\`\`

Agent 会获取现有内容并生成修改后的完整提案。

## 在工作中使用 ExCard

编辑工作时，添加类型为「ExCard」的步骤，选择已创建的 ExCard。工作流引擎会按步骤自动执行。

## 工作流返回格式

Agent 完成步骤后，需要返回：

\`\`\`
[WORKFLOW job-<jobId> step-<stepIndex>]
status: complete
message: 完成情况描述
\`\`\`

出错时返回：

\`\`\`
[WORKFLOW job-<jobId> step-<stepIndex>]
status: error
message: 错误描述
\`\`\``,
    category: '使用指南',
  },
  {
    id: 'monitor',
    title: '监控面板',
    content: `# 监控面板

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
    category: '使用指南',
  },
  {
    id: 'board',
    title: '看板使用',
    content: `# 看板使用指南

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
    category: '使用指南',
  },
])

const selectedDoc = ref(docs.value[0])

function selectDoc(doc) {
  selectedDoc.value = doc
}

function getCategoryColor(category) {
  const map = {
    '快速入门': 'bg-purple-50 text-purple-600',
    '连接指南': 'bg-blue-50 text-blue-600',
    '使用指南': 'bg-green-50 text-green-600',
  }
  return map[category] || 'bg-stone-100 text-stone-600'
}

const renderedContent = computed(() => {
  if (!selectedDoc.value) return ''
  const raw = marked.parse(selectedDoc.value.content)
  return DOMPurify.sanitize(raw)
})
</script>

<template>
  <div class="flex gap-4 h-full">
    <!-- 左侧：文档列表 -->
    <div class="w-64 flex-shrink-0 overflow-y-auto">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-primary">文档</h2>
        <p class="text-sm text-secondary mt-0.5">使用指南与连接说明</p>
      </div>
      <div class="space-y-1">
        <div
          v-for="doc in docs"
          :key="doc.id"
          @click="selectDoc(doc)"
          :class="[
            'p-3 rounded-lg cursor-pointer transition-all duration-150',
            selectedDoc?.id === doc.id
              ? 'bg-accent-dim border border-accent/30 shadow-xs'
              : 'hover:bg-surface-raised border border-transparent'
            ]"
        >
          <div class="flex items-center gap-2 mb-1">
            <span
              :class="['px-1.5 py-0.5 rounded text-xs', getCategoryColor(doc.category)]"
              >
              {{ doc.category }}
            </span>
          </div>
          <div class="text-sm font-medium text-primary">{{ doc.title }}</div>
        </div>
      </div>
    </div>

    <!-- 右侧：文档内容 -->
    <div class="flex-1 bg-surface rounded-xl border border-border-subtle overflow-hidden flex flex-col">
      <div v-if="selectedDoc" class="flex flex-col h-full">
        <!-- 头部 -->
        <div class="px-6 py-4 border-b border-border-subtle flex-shrink-0">
          <div class="text-xs text-muted mb-0.5">{{ selectedDoc.category }}</div>
          <h3 class="text-lg font-semibold text-primary">{{ selectedDoc.title }}</h3>
        </div>
        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto p-6">
          <div
            class="prose prose-sm max-w-none"
            v-html="renderedContent"
          ></div>
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full text-muted">
        请选择一篇文档查看
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Prose styles for markdown rendering */
.prose h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937; }
.prose h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; margin-top: 1.5rem; color: #374151; }
.prose h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1rem; color: #374151; }
.prose p { margin-bottom: 0.75rem; line-height: 1.6; color: #4b5563; }
.prose ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose li { margin-bottom: 0.25rem; color: #4b5563; }
.prose code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; color: #dc2626; }
.prose pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 0.75rem; }
.prose pre code { background: transparent; padding: 0; color: inherit; }
.prose table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; }
.prose th, .prose td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
.prose th { background: #f9fafb; font-weight: 600; }
</style>
