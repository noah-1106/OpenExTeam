# OpenExTeam - Specification

> Universal AI Agent Team Command Center
> 一套产品，对接所有主流 Agent 框架

---

## 1. 产品定位

**一句话：** 跨框架的 AI Agent 团队可视化协作平台

**解决什么问题：**
- 多个 Agent 框架（OpenClaw / Hermes / Deer Flow…）分散管理，操作入口不统一
- 任务下发靠对话、靠记忆，没有统一看板
- 缺乏标准化的执行流程（ExCard）绑定和管理

**目标用户：**
- 个人开发者 / 独立开发者：用多框架 Agent 协作完成项目
- 小团队：管理 AI Agent 工作流，需要可视化追踪
- Agent 开发者：测试、监控多框架运行状态

---

## 2. 核心架构

### 设计原则：低耦合 · 消息驱动

OpenExTeam 与各 AI 框架通过 **标准化消息** 交互，而非深度 API 集成。
Adapter 层极简——只做"消息格式转换 + 任务状态回调"，不维护长连接、不处理认证差异。

```
┌──────────────────────────────────────────────────────────┐
│                      Browser                              │
│                  (Vue3 SPA :3000)                        │
├──────────────────────────────────────────────────────────┤
│                      Express API                         │
│                  (Node.js :4000)                         │
│            任务调度 · 消息路由 · 状态聚合                  │
├──────────────────────────────────────────────────────────┤
│                 Adapter Layer (轻量级)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  OpenClaw   │ │   Hermes    │ │  DeerFlow   │       │
│  │  Adapter    │ │   Adapter   │ │   Adapter   │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
├──────────────────────────────────────────────────────────┤
│              各 AI 框架 (任意实现方式)                     │
│     OpenClaw Agent    DeerFlow API    Hermes CLI        │
└──────────────────────────────────────────────────────────┘
```

### 2.1 Adapter 职责（极简）

| 职责 | 说明 |
|------|------|
| **消息格式转换** | 统一协议 ↔ 框架原生格式 |
| **任务状态触发** | 接收框架完成通知，上报 Dashboard |
| **简单消息路由** | 转发 Dashboard 消息到具体 agent |

**不做的事：**
- ❌ 不维护长连接（WebSocket/HTTP 轮询）
- ❌ 不处理框架认证差异
- ❌ 不做复杂的状态管理

Adapter 接口：

```typescript
interface AgentAdapter {
  name: string;
  version: string;

  // 发送任务/消息给 agent（格式转换后转发）
  send(agentId: string, message: UnifiedMessage): Promise<void>;

  // 解析框架回传的消息，转为统一格式
  parse(raw: any): UnifiedMessage | null;
}
```

### 2.2 统一消息协议

所有交互归结为两类消息：**下发** 和 **上报**。

**下发任务：**
```json
{
  "message_id": "msg_001",
  "type": "task_assign",
  "task_id": "task_001",
  "target_agent": "kaikai",
  "content": {
    "title": "实现登录页面",
    "description": "使用 Vue3 + TailwindCSS",
    "requirements": ["响应式设计", "表单验证"],
    "deadline": "2026-04-15T18:00:00+08:00"
  },
  "callback": "http://dashboard:4000/api/webhook/task-status"
}
```

**状态上报：**
```json
{
  "message_id": "msg_002",
  "type": "task_update",
  "task_id": "task_001",
  "agent": "kaikai",
  "status": "completed",
  "result": {
    "output": "代码已提交到 git",
    "artifacts": ["src/pages/Login.vue"]
  },
  "timestamp": "2026-04-14T20:00:00+08:00"
}
```

**工作流消息（串行推进）：**

工作流由 Job 关联的多个 Task 组成，按创建时间顺序串行执行。Adapter 负责在任务完成后自动启动下一步。

工作流启动（Dashboard → Adapter）：
```json
{
  "message_id": "msg_003",
  "type": "workflow_start",
  "job_id": "job_001",
  "initiator": "user",
  "timestamp": "2026-04-14T20:00:00+08:00"
}
```

工作流步骤下发（Adapter → Agent）：
```json
{
  "message_id": "msg_004",
  "type": "workflow_step",
  "job_id": "job_001",
  "task_id": "task_001",
  "step_index": 1,
  "total_steps": 7,
  "target_agent": "kaikai",
  "content": {
    "title": "设计系统架构",
    "description": "完成Adapter层接口定义",
    "context": "前一个任务已完成，自动推进"
  },
  "callback": "http://dashboard:4000/api/webhook/workflow-step"
}
```

工作流步骤完成（Agent → Adapter）：
```json
{
  "message_id": "msg_005",
  "type": "workflow_step_complete",
  "job_id": "job_001",
  "task_id": "task_001",
  "step_index": 1,
  "agent": "kaikai",
  "status": "completed",
  "result": {
    "output": "架构设计文档已输出",
    "artifacts": ["docs/architecture.md"]
  },
  "next_step_auto": true,
  "timestamp": "2026-04-14T20:30:00+08:00"
}
```

工作流完成（Adapter → Dashboard）：
```json
{
  "message_id": "msg_006",
  "type": "workflow_complete",
  "job_id": "job_001",
  "total_steps": 7,
  "completed_steps": 7,
  "timestamp": "2026-04-14T22:00:00+08:00"
}
```

**工作流推进逻辑：**

1. Dashboard 发送 `workflow_start` → Adapter
2. Adapter 查询该 Job 的所有 Task，按 `createdAt` 排序
3. 找到第一个 `status=todo` 的任务，发送 `workflow_step` 给对应 Agent
4. Agent 完成任务后发送 `workflow_step_complete` 给 Adapter
5. Adapter 自动找到下一个 `status=todo` 的任务，重复步骤3
6. 如果没有剩余任务，发送 `workflow_complete` 给 Dashboard

### 2.3 框架接入方式

**核心原则：Dashboard 只与主 Agent 通信**

Dashboard 只与**主 Agent**（main agent）通信，不感知子 Agent（sub-agent）的存在。各框架的子 Agent 实现细节对 Dashboard 完全透明。

```
Dashboard ──► Adapter ──► 主 Agent ──► 子 Agent(s)
   ▲           │           │
   └───────────┴───────────┘
        回调统一来自主 Agent
```

**各框架实现：**

| 框架 | 主 Agent 接收 | 主 Agent 内部实现 | 回调上报 |
|------|---------------|-------------------|----------|
| **OpenClaw** | `sessions_send` 给主 session | 主 agent 通过 `sessions_spawn` 创建子 agent | 主 agent 汇总结果回调 |
| **DeerFlow** | `POST /api/chat` 给 lead agent | `mode=ultra` 内部创建 sub-agents | lead agent 汇总结果回调 |
| **Hermes** | `hermes chat` / api_server | `delegate_task` 创建 sub-agent | 主 agent 汇总结果回调 |
| **Hermes** | `hermes chat -q "..."` CLI | 文件标记 / 日志解析 |

### 2.4 配对流程

```
用户操作：
1. Dashboard → 设置 → 添加框架
2. 选择框架类型（OpenClaw / Hermes / DeerFlow / 其他）
3. 填入连接信息（URL / Token / SSH 等，按框架而定）
4. 点击"测试连接"
   → Adapter 尝试发送一条测试消息
   → 成功：框架上线
   → 失败：提示错误信息
5. 已配对的框架存入 config.json
```

---

## 3. 功能模块

### 3.1 导航结构

```
┌─────────────────────────────────────────────────────────┐
│  [≡] OpenExTeam           [设置] [主题]                  │
├────────┬────────────────────────────────────────────────┤
│        │  ┌──────────────────────────────────────────┐ │
│ 框架   │  │  [看板] [聊天] [ExCard] [监控]           │ │
│ ─────  │  └──────────────────────────────────────────┘ │
│ ○ OC   │                                                │
│ ○ Her  │  主内容区（Tab 切换）                          │
│        │                                                │
│ Agent  │                                                │
│ ─────  │                                                │
│ ○ 开开 │                                                │
│ ● 品品 │                                                │
│ ○ 测测 │                                                │
└────────┴────────────────────────────────────────────────┘
```

### 3.2 模块1：任务看板

**布局：** Trello 风格，三列默认

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   To Do     │ │  In Progress│ │    Done     │
├─────────────┤ ├─────────────┤ ├─────────────┤
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
│ │ 任务卡片 │ │ │ │ 任务卡片 │ │ │ │ 任务卡片 │ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
│ ┌─────────┐ │ │             │ │             │
│ │ 任务卡片 │ │ │             │ │             │
│ └─────────┘ │ │             │ │             │
│      [+]    │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
```

**任务卡片字段：**
- 标题
- 描述
- 绑定 Agent（可指定 / 可自动分配）
- 绑定 ExCard 模板（可选）
- 优先级（高/中/低）
- 状态（To Do / Doing / Done）
- 创建时间
- 更新时间

**交互：**
- 拖拽卡片（vue-draggable-next）
- 点击卡片 → 右侧滑出详情面板
- 点击 [+] → 弹窗创建新任务
- 卡片内显示绑定 Agent 头像 + ExCard 标签

### 3.3 模块2：聊天

**聊天列表（左）：**
```
┌────────────────┐
│ 私聊 / 群聊     │
├────────────────┤
│ [○] 开开        │  ← 单聊
│ [○] 品品        │
│ [○] 测测        │
├────────────────┤
│ [◎] 开发群      │  ← 群聊（所有Agent）
│ [◎] 运营群      │
└────────────────┘
```

**聊天窗口（右）：**
- 类似 Slack/飞书
- 消息气泡：用户消息 / Agent 回复分开显示
- 支持 Markdown 渲染
- 消息发送：回车发送，Shift+回车换行
- Agent 正在输入时显示 "typing..."

**实现：**
- 通过 Adapter 的 `sendMessage()` / `streamMessage()` 与各框架对接
- 群聊：消息同时发送给多个 Agent

### 3.4 模块3：ExCard 管理

**ExCard 列表：**
```
┌──────────────────────────────────────────────────┐
│ ExCard 模板库                      [+ 新建卡片]  │
├──────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐   │
│ │ [EC-001] 每日调研报告                       │   │
│ │ 场景：Moltbook 每日发帖                     │   │
│ │ 绑定任务数：3                              │   │
│ └────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────┐   │
│ │ [EC-002] 社交媒体获客                       │   │
│ │ 场景：Reddit/Twitter 评论获客               │   │
│ │ 绑定任务数：1                               │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**创建 ExCard 弹窗：**
- ID（自动生成：EC-XXX）
- 名称
- 描述
- 场景标签（营销/研究/运营/开发…）
- 步骤列表（顺序执行）
- 输入约定
- 输出约定
- 错误处理

### 3.5 模块4：监控面板

**Agent 状态一览：**
```
┌────────────────────────────────────────────────────┐
│ Agent 监控                            [刷新]        │
├────────────────────────────────────────────────────┤
│ ○ 开开  │ 在线  │ 空闲      │ Token: 234/10k     │
│ ● 品品  │ 忙碌  │ 执行中... │ Token: 8,901/10k   │
│ ○ 测测  │ 在线  │ 空闲      │ Token: 1,203/10k   │
│ ○ 维维  │ 离线  │ -         │ -                  │
└────────────────────────────────────────────────────┘
```

**实时日志：**
- 各 Agent 执行日志滚动
- 按 Agent 过滤
- 按时间倒序
- 日志级别：INFO / WARN / ERROR

---

## 4. 数据存储

**存储结构（JSON文件，本地文件）：**
```
~/.openexteam/
├── config.json          # 框架配对配置
├── tasks.json           # 任务数据
├── excards/             # ExCard 模板
│   ├── ec-001.md
│   └── ec-002.md
├── sessions/            # 聊天记录
│   └── {agentId}.json
└── logs/                # 日志
    └── app.log
```

**config.json 示例：**
```json
{
  "adapters": [
    {
      "type": "openclaw",
      "name": "我的OpenClaw",
      "url": "http://localhost:18789",
      "token": "sk-xxx",
      "enabled": true
    }
  ],
  "theme": "light"
}
```

---

## 5. 技术栈

| 层 | 技术 | 理由 |
|----|------|------|
| 前端框架 | Vue3 + Vite | 轻量，响应式，生态成熟 |
| 看板 | vue-draggable-next | Vue3 拖拽库，轻量 |
| 样式 | TailwindCSS | 快速样式开发 |
| 图表 | Chart.js / 轻量方案 | Token 消耗可视化 |
| 后端 | Express (Node.js) | 与 OpenClaw 同语言，兼容好 |
| 实时 | SSE (Server-Sent Events) | 比 WebSocket 简单，后端一个库 |
| 存储 | JSON 文件 | 无数据库依赖，部署简单 |
| 部署 | Docker + Docker Compose | 一条命令跑起来 |

---

## 6. 开发计划

### Phase 1：MVP（核心跑通）
- [ ] 项目初始化（Vue3 + Express + Docker）
- [ ] OpenClaw Adapter 实现
- [ ] 任务看板 CRUD + 拖拽
- [ ] Agent 状态列表

**验收标准：** 在 Dashboard 上能看到 OpenClaw 的 Agent 列表 + 创建任务卡片

### Phase 2：核心功能
- [ ] 任务下发到 Agent（通过 sessions_send）
- [ ] 任务绑定 ExCard 模板
- [ ] 监控面板（Token 消耗）
- [ ] 实时日志

### Phase 3：聊天
- [ ] Agent 单聊
- [ ] Agent 群聊
- [ ] 聊天记录存储

### Phase 4：ExCard 系统
- [ ] ExCard 创建/编辑/删除
- [ ] ExCard 导入/导出
- [ ] ExCard 模板市场（远程加载）

### Phase 5：多 Adapter
- [ ] Hermes Adapter
- [ ] DeerFlow Adapter
- [ ] Adapter 注册机制

---

## 7. 项目结构

```
openexteam/
├── README.md
├── SPEC.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server/
│   ├── index.js              # Express 入口
│   ├── bus.js                # Unified Bus
│   ├── adapters/
│   │   ├── index.js          # Adapter 加载器
│   │   └── openclaw.js       # OpenClaw Adapter
│   ├── routes/
│   │   ├── agents.js
│   │   ├── tasks.js
│   │   ├── chat.js
│   │   └── excards.js
│   └── storage/
│       └── jsonStore.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── views/
│   │   ├── Board.vue         # 看板
│   │   ├── Chat.vue          # 聊天
│   │   ├── ExCard.vue        # ExCard 管理
│   │   └── Monitor.vue       # 监控
│   ├── components/
│   │   ├── TaskCard.vue
│   │   ├── ChatWindow.vue
│   │   └── AgentList.vue
│   └── stores/
│       ├── tasks.js
│       └── agents.js
└── public/
```

---

## 8. OpenClaw Adapter 详细设计

### 8.1 OpenClaw API 映射

| Dashboard 操作 | OpenClaw 实现 |
|---------------|---------------|
| 列出 Agent | `GET /api/agents` |
| Agent 状态 | `GET /api/status` |
| 发送消息 | `sessions_send(sessionKey, message)` |
| 创建任务 | `cron job` + `sessions_send` |
| 实时日志 | WebSocket subscribe |

### 8.2 连接配置

```json
{
  "type": "openclaw",
  "name": "我的OpenClaw",
  "url": "http://localhost:18789",
  "token": "openclaw-api-token"
}
```

### 8.3 会话管理

- 任务下发 → 为每个任务创建独立 session（或复用）
- 聊天 → 每个 Agent 一个 persistent session
- Session key 存在 `sessions/{agentId}.json`

---

*Last updated: 2026-04-13*

---

## 关键设计决定（2026-04-13 讨论确认）

1. **多用户先不做** — 单用户模式即可
2. **跨框架群聊** — Dashboard 做消息中继，注入其他Agent发言到各自session
3. **多Agent任务交接** — 共享文件夹 `~/.openexteam/workspace/{task_id}/` 做中转
4. **数据归属** — Dashboard 只存任务/ExCard/配置，聊天/Memory/Token从底座实时读取
5. **双通道对接** — 命令通道(Session-based) + 元数据通道(API/文件)

## 新增章节（v0.6）
- 十一：跨框架群聊（消息中继）
- 十二：共享工作区（任务文件中转）
- 十三：跨框架任务交接
- 十四：Agent 并发管理
- 十五：成本追踪
- 十六：断线重连 & 部分故障
- 十七：Webhook & 定时触发
- 十八：ExCard 版本管理
- 十九：Adapter 插件化
