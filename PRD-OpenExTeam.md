# OpenExTeam PRD - 需求文档

> 版本：v0.3 | 状态：草稿 | 日期：2026-04-14
> 作者：品品

---

## 一、产品概述

### 1.1 一句话描述

跨框架 AI Agent 团队可视化协作平台——在一个 Dashboard 上统一管理 OpenClaw、DeerFlow、Hermes 三个框架的 Agent 任务、聊天和监控。

### 1.2 解决的核心问题

- 多个 Agent 框架（OpenClaw / Hermes / DeerFlow）分散管理，操作入口不统一
- 任务下发靠对话、靠记忆，没有统一看板
- 缺乏标准化的执行流程（ExCard）绑定和管理

### 1.3 目标用户

| 用户 | 场景 |
|------|------|
| 个人开发者 | 用多框架 Agent 协作完成项目，一个人管多个"数字员工" |
| 小团队 | 管理 AI Agent 工作流，需要可视化追踪任务状态 |
| Agent 开发者 | 测试、监控多框架运行状态 |

### 1.4 成功指标

- [ ] Dashboard 能看到 OpenClaw 的 Agent 列表
- [ ] 能在看板创建、拖拽、关闭任务卡片
- [ ] 任务能正确下发到指定 Agent，并收到执行结果
- [ ] Token 消耗能在监控面板可视化
- [ ] 能和 Agent 进行单聊

---

## 二、竞品分析

### 2.1 直接竞品

| 产品 | GitHub | 框架支持 | 与本项目差异 |
|------|--------|---------|-------------|
| **Mission Control** | builderz-labs/mission-control | OpenClaw, CrewAI, LangGraph, AutoGen, Claude SDK | 全栈 Next.js，SQLite，多租户，安全评估 |
| **openclaw-mission-control** | abhi1693/openclaw-mission-control | 仅 OpenClaw | 轻量，OpenClaw 专用 |

### 2.2 差异化机会

Mission Control 不支持 **DeerFlow** 和 **Hermes**——这是本项目的核心切入点。

---

## 三、产品功能规格

### 3.1 模块总览

| 模块 | 状态 |
|------|------|
| 任务看板 | ✅ 原型已完成 |
| 框架配对与设置 | ✅ 原型已完成 |
| 监控面板 | ✅ 原型已完成 |
| Agent 单聊 | 🔨 原型待补充 |
| 跨框架群聊 | 📋 待开发 |
| ExCard 管理 | 📋 待开发 |

### 3.2 框架配对

- 用户在设置页面添加框架连接（输入 Gateway URL + Token）
- 点击"测试连接"验证连通性
- 成功后在左侧显示已配对框架和 Agent 列表
- 支持框架：OpenClaw（Phase 1）、DeerFlow、Hermes

### 3.3 左侧导航

```
┌────────────────────────────────┐
│ 🤖 OpenExTeam                   │
├─────────┬──────────────────────┤
│ 框架    │                      │
│ ──────  │                      │
│ ○ OC    │   主内容区            │
│ ○ Deer  │   (Tab 切换)          │
│ ○ Her   │                      │
│         │                      │
│ Agent   │                      │
│ ──────  │                      │
│ ● 品品  │                      │
│ ○ 开开  │                      │
│ ○ 测测  │                      │
└─────────┴──────────────────────┘
```

### 3.4 任务看板

**层级结构：Job → Task**

一个 Job 包含多个 Task。Job 按类型分为：

| 类型 | 说明 | 示例 |
|------|------|------|
| 一次性工作 | 触发一次，执行完毕即结束 | "撰写 OpenExTeam PRD"、"调研竞品" |
| 周期性工作 | 按日/周/月重复执行 | "每日调研报告"、"每周运营周报" |

**Job 字段：**
- 标题 / 描述
- 类型（一次性 / 周期性）
- 负责人（Owner）
- 绑定的 ExCard 模板（可选，定义执行流程）
- 周期规则（仅周期性工作）：日 / 周（选星期）/ 月（选日期）
- 触发时间（时:分）
- 状态（未开始 / 进行中 / 已完成）
- 进度（n/m Task 完成）

**Task 字段：**
- 标题 / 描述
- 所属 Job
- 绑定 ExCard 模板（继承自 Job 或单独覆盖）
- 负责人
- 状态（To Do / In Progress / Done）
- 创建时间

**ExCard 模板绑定逻辑：**
- Job 可绑定一张 ExCard 模板（如"标准文章撰写流程"）
- Job 下的所有 Task 继承该 ExCard
- Task 也可单独绑定不同的 ExCard，覆盖 Job 设置
- ExCard 定义"怎么做"——包含步骤流程、输入/输出约定、资源依赖

**看板交互：**
- 按 Job 分组展示，每个 Job 下有 To Do / In Progress / Done 三列
- 点击任意 Task 卡片，打开右侧详情面板（状态切换、描述、ExCard 绑定情况）
- 点击 [+ 新建工作] 创建新 Job（需选类型：一次性/周期性）
- 点击 [+ 新建任务] 创建 Task（需选择所属 Job，可选绑定 ExCard）

### 3.5 Agent 状态列表

- 显示各 Agent 的在线/离线/忙碌状态
- 显示当前任务的简要信息

### 3.6 监控面板

- Agent 状态卡片（在线/忙碌/离线）
- Token 消耗仪表盘（per-agent 分解）
- 实时日志滚动（按 Agent / 级别过滤）

### 3.7 Agent 聊天

**单聊：**
- 选择 Agent 后，在聊天窗口发送消息
- 消息通过 `sessions_send` 发送到对应 Agent session
- Agent 回复通过 SSE 实时推送
- 支持 Markdown 渲染
- 消息输入：回车发送，Shift+回车换行

**群聊：**
- 创建群聊，选择参与的 Agent
- Dashboard 作为消息中继，将消息广播给各 Agent
- 各 Agent 的回复在群聊中统一展示

### 3.8 ExCard 管理

- 创建 / 编辑 / 删除 ExCard 模板
- 模板字段：ID、名称、描述、场景标签、步骤列表、输入约定、输出约定
- ExCard 绑定到任务，任务执行时引用对应模板

### 3.9 周期性触发机制

**触发方式：通过对话消息触发**

OpenExTeam 自建定时任务调度，不依赖各框架的原生调度能力。

**实现逻辑：**

1. OpenExTeam Backend 维护自己的定时任务表（存储 schedule 元数据：每天/每周/每月 + 触发时间）
2. Backend 内置 cron 定时检查，到点时：
   - 构造一条任务消息，格式如"请执行每日技术调研任务，参考 ec-004 ExCard 流程"
   - 通过 `sessions_send` 发给对应 Agent
3. Agent 收到消息后，像处理普通对话一样执行任务，返回结果
4. Dashboard 通过 SSE 接收执行状态更新

**Backend 职责：**
- 存储和管理定时任务的 schedule（每天/每周/每月 + 触发时间）
- 内置 cron 定时检查
- 构造任务消息，通过 Adapter 的 `sendMessage` 发送给 Agent

**优势：**
- 框架无关：所有框架统一通过 chat 消息触发，不需要各框架各自的调度 API
- 实现简单：不需要改造 Adapter 层接口
- 可控性强：定时逻辑完全在 OpenExTeam 内部管理

### 3.10 任务下发

- 用户在任务详情中选择目标 Agent
- 系统通过 `sessions_send` 向目标 Agent 的主 session 发送任务消息
- OpenClaw 底座自行 spawn 子 agent 执行任务（或直接执行）
- 任务状态通过 SSE 实时回传（执行中 → 完成 / 失败）
- **OpenClaw 底座负责 spawn 机制的透明化，Dashboard 只管发消息和收结果**

---

## 四、验收标准

- [ ] 能添加 OpenClaw 框架配对
- [ ] 能测试连接成功
- [ ] 左侧显示 Agent 列表
- [ ] 能创建任务卡片
- [ ] 能拖拽卡片切换状态
- [ ] 能将任务下发到指定 Agent，并收到执行结果反馈
- [ ] Agent 状态实时显示
- [ ] 能和 Agent 进行单聊
- [ ] Token 消耗在监控面板可视化

---

## 五、架构设计

### 5.0 核心设计原则

**消息即总线**

- 系统内部只有一套消息协议，所有与底座的交互都是消息
- Adapter 只做一件事：把统一消息格式 ↔ 框架原生格式互相转换
- Adapter **不维护任何状态**——不存任务、不记对话历史、不管调度
- 状态全部存在 Dashboard 自身（Express JSON 文件）

### 5.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (Vue3 SPA)                  │
│        任务看板 · 监控面板 · 聊天 · ExCard 管理           │
└──────────────────┬────────────────────────────────────────┘
                   │ SSE / JSON
┌──────────────────▼────────────────────────────────────────┐
│                   Backend (Express)                      │
│            任务调度 · 消息路由 · 状态聚合                   │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────┐
│                   Adapter Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ OpenClaw   │  │  DeerFlow   │  │  Hermes     │      │
│  │  Adapter   │  │   Adapter   │  │   Adapter   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Adapter 接口定义

```typescript
interface AgentAdapter {
  // 身份
  name: string;
  version: string;

  // 连接
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // Agent 操作
  listAgents(): Promise<Agent[]>;
  getAgentStatus(agentId: string): Promise<AgentStatus>;

  // 消息
  sendMessage(agentId: string, message: string): Promise<Message>;
  streamMessage(agentId: string, message: string, onChunk: Function): void;

  // 任务
  createTask(agentId: string, task: Task): Promise<TaskResult>;
  getTaskStatus(taskId: string): Promise<TaskStatus>;
}
```

### 5.3 数据存储

```
~/.openexteam/
├── config.json          # 框架配对配置
├── tasks.json           # 任务数据
├── excards/             # ExCard 模板
│   └── ec-001.md
├── sessions/            # 聊天记录
│   └── {agentId}.json
└── logs/                # 日志
    └── app.log
```

---

## 六、技术约束与风险

### 6.1 已知技术风险

| 风险 | 描述 | 应对 |
|------|------|------|
| **DeerFlow 单 Agent 架构** | DeerFlow 不是多 Agent 架构，它的"Agent"是 skill/mode 的概念 | 重新定义 `listAgents` 为"list capabilities"，Adapter 自行翻译 |
| **OpenClaw spawn 间接触发** | `spawnTask` 不能直接调用，需通过 `sessions_send` 消息触发 | 任务下发走 agent 主 session 发消息，让底座 agent 自己 spawn；spawn 机制由 OpenClaw 底座负责透明化 |
| **Hermes 无 REST API** | Hermes 无公开 REST API，只有 CLI/Python API | 用 api_server.py 或 SSH + CLI 作为 transport |

### 6.2 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 前端 | Vue3 + Vite | 轻量，响应式，生态成熟 |
| 看板拖拽 | vue-draggable-next | Vue3 拖拽库 |
| 样式 | TailwindCSS | 快速样式开发 |
| 后端 | Express (Node.js) | 与 OpenClaw 同语言，兼容好 |
| 实时 | SSE (Server-Sent Events) | 比 WebSocket 简单，后端一个库 |
| 存储 | JSON 文件 | 无数据库依赖，部署简单 |
| 部署 | Docker + Docker Compose | 一条命令跑起来 |

---

## 七、关键设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 多用户 | 单用户模式 | MVP 阶段简化 |
| 跨框架群聊 | Dashboard 做消息中继 | 各框架消息协议不同，需要中继层 |
| 任务交接 | 共享文件夹 `~/.openexteam/workspace/{task_id}/` 中转 | 跨框架任务文件共享方案 |
| 数据归属 | Dashboard 只存任务/ExCard/配置，聊天/Token 从底座实时读取 | 避免数据不一致 |
| spawn 机制 | OpenClaw 底座负责，Dashboard 不感知 | spawn 是 OpenClaw 内部机制，Dashboard 只发消息收结果 |

---

## 八、OpenClaw Adapter 详细说明

### 8.1 连接配置

```json
{
  "type": "openclaw",
  "name": "我的OpenClaw",
  "url": "http://localhost:18789",
  "token": "openclaw-api-token"
}
```

### 8.2 核心 RPC 端点

| 操作 | OpenClaw RPC | 备注 |
|------|-------------|------|
| 健康检查 | `gateway call health` | 返回 channels 状态 |
| Agent 列表 | `gateway call status` → agents[] | 包含 agentId, name, sessions |
| Session 列表 | `gateway call sessions.list` | 包含 token 消耗、cost 估算 |
| 发送消息 | `sessions_send(sessionKey, message)` | 通过 agent 工具调用 |
| 任务下发 | 向 agent 主 session 发消息，让底座 spawn | Dashboard 只发消息，spawn 由底座处理 |

---

*最后更新：2026-04-14*
