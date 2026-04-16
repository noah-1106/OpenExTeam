<script setup>
import { ref } from 'vue'

const docs = ref([
  {
    id: 'doc-1',
    title: 'Task 固化规则',
    content: `## 固化条件

当 Task 执行 ≥ 2 次时，Agent 应考虑将其固化为 ExCard。

## 固化流程

1. Agent 通过 EC Creator 工具生成 ExCard
2. ExCard 保存到团队共享目录
3. Agent 通知人类确认

## 相关 Skill

- EC Creator（EC 创建工具）：GitHub / ClawHub（待发布）
- LongTask（长程任务管理）：GitHub / ClawHub（待发布）`,
    category: 'Agent 行为准则',
  },
  {
    id: 'doc-2',
    title: 'ExCard 命名规范',
    content: `## 命名格式

EC{编号}-{AgentID}-{描述}

## 示例

- EC001-pinpin-standard-article
- EC002-kaikai-rss-fetch

## 规则

- 全局编号在首位，按创建顺序排列
- AgentID 在中置，归属清晰
- 描述在最后，一看就懂
- 所有 ExCard 存放在 Dashboard 的共享目录`,
    category: '团队规范',
  },
  {
    id: 'doc-3',
    title: 'Job 创建指南',
    content: `## Job 定义

Job 是工作容器，可以包含：
- 多个 Task
- 多个 ExCard

## Task 与 ExCard 关系

- ExCard 是固化的任务模板
- Task 是 ExCard 的实例
- 同一 ExCard 可生成多个 Task 实例

## 创建方式

- 人类：通过 Dashboard UI 创建
- Agent：通过聊天指令或 Skill 创建`,
    category: '使用指南',
  },
  {
    id: 'doc-4',
    title: 'Skill 下载',
    content: `## OpenExCard 相关 Skill

以下 Skill 需要安装到 Agent 中：

| Skill | 说明 | 下载链接 |
|-------|------|---------|
| EC Creator | 用于创建和校验 ExCard | GitHub（待发布）/ ClawHub（待发布） |
| LongTask Manager | 长程任务编排引擎 | GitHub（待发布）/ ClawHub（待发布） |
| EC Loader | ExCard 执行加载器 | GitHub（待发布）/ ClawHub（待发布） |

## 安装方式

# 方式一：从 GitHub 安装
cd ~/.openclaw/skills && git clone <repo-url>

# 方式二：从 ClawHub 安装
clawhub install <skill-name>

## 注意事项

- Skill 发布后需同步更新本文档的下载链接
- 不同 Agent 底座（OpenClaw / DeerFlow 等）安装方式可能不同`,
    category: '使用指南',
  },
])

const selectedDoc = ref(docs.value[0])

function selectDoc(doc) {
  selectedDoc.value = doc
}

function getCategoryColor(category) {
  const map = {
    'Agent 行为准则': 'bg-red-50 text-red-600',
    '团队规范': 'bg-blue-50 text-blue-600',
    '使用指南': 'bg-green-50 text-green-600',
  }
  return map[category] || 'bg-stone-100 text-stone-600'
}
</script>

<template>
  <div class="h-full flex gap-4">
    <!-- 左侧：文档列表 -->
    <div class="w-64 flex-shrink-0 overflow-y-auto">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-primary">文档</h2>
        <p class="text-sm text-secondary mt-0.5">团队规范与 Agent 行为准则</p>
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
      <div v-if="selectedDoc">
        <!-- 头部 -->
        <div class="px-6 py-4 border-b border-border-subtle">
          <div class="text-xs text-muted mb-0.5">{{ selectedDoc.category }}</div>
          <h3 class="text-lg font-semibold text-primary">{{ selectedDoc.title }}</h3>
        </div>
        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto p-6">
          <pre class="text-sm text-primary leading-relaxed whitespace-pre-wrap font-sans">{{ selectedDoc.content }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
