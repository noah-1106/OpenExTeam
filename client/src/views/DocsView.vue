<script setup>
import { ref } from 'vue'

const docs = ref([
  {
    id: 'doc-1',
    title: 'Dashboard 与 OpenClaw Gateway 的配对方式',
    content: `## Dashboard 与 OpenClaw Gateway 的配对方式

OpenExTeam Dashboard 是 **Operator 控制台**，通过标准 Gateway 协议连接用户自托管的 OpenClaw Gateway。

⚠️ **重要：** OpenClaw 需要**设备配对**才能连接，不仅仅是 Token。

### 用户使用步骤

#### 第一步：在 **OpenExTeam** 添加连接

**OpenExTeam Dashboard 端，进入设置页面：**
- 填写 Gateway URL: \`ws://127.0.0.1:18789\`（或远程地址）
- Operator Token: 从 Gateway 获取（\`openclaw config get gateway.auth.token\`）

点击「测试连接」或「保存」后，Dashboard 会尝试连接 Gateway。

#### 第二步：在 Gateway 端批准配对

**Gateway 端（终端执行）：**
\`\`\`bash
# 查看待配对设备
openclaw devices list

# 批准 Dashboard 设备
openclaw devices approve <requestId>
\`\`\`

#### 第三步：Dashboard 自动连接

配对批准后，Dashboard 会自动完成连接并开始通信。

### 部署模式

#### 模式一：本地开发（同机运行）

\`\`\`bash
# 1. 启动 Gateway
openclaw gateway start

# 2. 查看/配置 token
openclaw config get gateway.auth.token

# 3. Dashboard 配置 ws://127.0.0.1:18789

# 4. 批准配对（当 Dashboard 提示时）
openclaw devices list
openclaw devices approve <requestId>
\`\`\`

#### 模式二：Tailscale 网络（不同机运行）

\`\`\`bash
# 1. 确保服务器和本地都在 Tailscale 网络
# 2. Dashboard 配置 ws://<服务器TailscaleIP>:18789
# 3. 在服务器批准配对
\`\`\`

### Dashboard 连接配置字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| 连接名称 | 给这个连接起个名字 | 我的 OpenClaw |
| Gateway URL | Gateway WebSocket 地址 | ws://127.0.0.1:18789 |
| Operator Token | Gateway 认证令牌 | sk-xxxxxx |

### 验证连接

点击「测试连接」后，Dashboard 会：
1. 建立 WebSocket 连接
2. 等待 Gateway 发送 \`connect.challenge\`
3. 发送 \`connect\` 请求（role=operator + token）
4. 如果返回 NOT_PAIRED，显示提示信息：「请在 Gateway 端运行 \`openclaw devices approve <requestId>\` 批准配对」
5. 用户批准后，Dashboard 使用 device 身份完成连接

### 常见错误排查

| 错误 | 原因 | 解决 |
|------|------|------|
| NOT_PAIRED | 设备未配对 | 在 Gateway 端运行 \`openclaw devices approve\` |
| DEVICE_IDENTITY_REQUIRED | 缺少 device 身份 | Dashboard 会自动生成 device keypair |
| Connection refused | Gateway 未启动 | 检查 \`openclaw gateway status\` |
| Authentication failed | Token 不匹配 | 确认 token 与 \`gateway.auth.token\` 一致 |

### 安全建议

1. **生产环境**：使用 Tailscale 或 TLS (\`wss://\`)
2. **Token 轮换**：定期执行 \`openclaw config set gateway.auth.token\`
3. **设备管理**：定期查看已配对设备 \`openclaw devices list\`
4. **撤销配对**：使用 \`openclaw devices reject <requestId>\` 移除不信任设备`,
    category: '使用指南',
  },
  {
    id: 'doc-2',
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
    id: 'doc-3',
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
    id: 'doc-4',
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
    id: 'doc-5',
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
        <div class="flex-1 overflow-y-auto p-6" style="max-height: calc(100vh - 200px);">
          <pre class="text-sm text-primary leading-relaxed whitespace-pre-wrap font-sans">{{ selectedDoc.content }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
