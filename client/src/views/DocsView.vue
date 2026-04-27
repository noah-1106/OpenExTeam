<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const docs = ref([
  {
    id: 'intro',
    title: '项目介绍',
    content: `# OpenExTeam

OpenExTeam 是一个跨框架 AI Agent 团队协作平台。

## 核心功能

- **多底座支持**：统一管理 OpenClaw、Hermes、DeerFlow 等不同框架的 Agent
- **聊天协作**：与单个 Agent 对话，或进行群聊
- **工作编排**：创建多步骤工作流，自动在 Agent 间流转
- **ExCard 模板**：使用 Markdown 定义完整的任务执行模板
- **实时监控**：查看 Agent 状态和执行日志

## 快速开始

1. 在设置页添加底座连接
2. 在聊天页与 Agent 对话
3. 在工作页创建并执行任务
4. 在看板页查看执行进度

## 核心概念

| 概念 | 说明 |
|------|------|
| Agent | AI 助手，可以是 LLM 或其他智能体 |
| 底座 | Agent 运行框架（OpenClaw/Hermes/DeerFlow） |
| 工作 | 任务容器，可包含多个步骤 |
| 步骤 | 工作的单个执行单元 |
| ExCard | Markdown 格式的任务模板 |`,
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

确保 Hermes 服务正在运行。

## 在 Dashboard 添加连接

1. 进入设置页面
2. 点击「新建连接」
3. 填写信息：
   - 连接名称：如「我的 Hermes」
   - 类型：选择 Hermes
   - URL：Hermes API 地址
   - Token：认证令牌（如需要）

## 验证连接

设置页会显示「已连接」状态，Agent 列表自动加载。`,
    category: '连接指南',
  },
  {
    id: 'deerflow',
    title: 'DeerFlow 连接',
    content: `# DeerFlow 连接指南

## 前置准备

确保 DeerFlow 服务正在运行。

## 在 Dashboard 添加连接

1. 进入设置页面
2. 点击「新建连接」
3. 填写信息：
   - 连接名称：如「我的 DeerFlow」
   - 类型：选择 DeerFlow
   - URL：DeerFlow API 地址
   - Token：认证令牌（如需要）

## 验证连接

设置页会显示「已连接」状态，Agent 列表自动加载。`,
    category: '连接指南',
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

ExCard 是 Markdown 格式的完整任务执行模板。

## 创建 ExCard

1. 进入 ExCard 页面
2. 点击「新建 ExCard」
3. 填写：
   - 标题：ExCard 名称
   - 描述：用途说明
   - 内容：Markdown 格式的完整模板
   - 绑定 Agent：指定默认执行的 Agent

## ExCard 内容格式

\`\`\`markdown
# ExCard 标题

## 任务描述

详细描述任务...

## 执行步骤

1. 第一步...
2. 第二步...

## 输出格式

要求 Agent 按格式输出...
\`\`\`

## 在工作中使用 ExCard

编辑工作时，添加类型为「ExCard」的步骤，选择创建好的 ExCard。

## 工作流返回格式

Agent 完成后，需要返回：

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
\`\`\`

## 提议创建 ExCard

如果 Agent 认为这个任务可以固化成 ExCard，可以在返回结果中包含：

\`\`\`
[EXCARD_PROPOSAL]
name: ExCard 名称
description: 描述这个 ExCard 的用途
agent: <agent-id> (可选，默认当前 agent)
markdown:
# ExCard 标题
## 任务描述
这里写 ExCard 的完整 Markdown 内容
...
\`\`\`

Dashboard 会自动检测到这个格式并弹出确认框。

## 斜杠命令

在聊天输入框中输入斜杠命令可以告诉 Agent 做什么：

- \`/ec <需求>\` - 让 Agent 帮忙创建 ExCard
- \`/ec-modify <card-id> <需求>\` - 让 Agent 帮忙修改已有 ExCard

示例：
\`\`\`
/ec 创建一个每日汇总报告的 ExCard，功能包括收集当天的信息并生成报告
\`\`\`

Agent 收到后会返回 \`[EXCARD_PROPOSAL]\` 格式的提议，确认后创建。`,
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

看板专门用于展示正在执行工作的进度。

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

在工作页面点击「启动工作流」，或在看板的「其他工作」区域点击「启动」。`,
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
