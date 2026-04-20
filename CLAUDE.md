# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 项目特定指南：OpenExTeam

### 项目概述

**OpenExTeam** - 跨框架 AI Agent 团队可视化协作平台

- 统一管理 OpenClaw、DeerFlow、Hermes 三个框架的 Agent 任务、聊天和监控
- 技术栈：Vue3 + Vite + Express + sql.js + SSE
- 核心架构：消息总线 + Adapter 层

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发（前后端同时启动）
npm run dev

# 单独启动后端
npm run dev:server

# 单独启动前端
npm run dev:client

# 构建前端
npm run build

# 生产启动
npm start
```

**服务地址：**
- 后端 API: http://localhost:4000
- 前端界面: http://localhost:3000
- 健康检查: http://localhost:4000/health

### 项目结构

```
OpenExTeam/
├── client/                 # Vue3 前端
│   ├── src/
│   │   ├── api/           # API 客户端
│   │   ├── components/    # UI 组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── views/         # 页面视图
│   │   └── App.vue
│   ├── prototype.html     # 交互原型参考
│   └── package.json
├── server/                 # Express 后端
│   ├── adapter/           # Agent 适配器
│   │   ├── index.js       # Adapter 工厂
│   │   └── openclaw.js    # OpenClaw Adapter（主要实现）
│   ├── db/                # 数据库
│   ├── storage/           # 存储层
│   ├── routes/            # API 路由
│   └── server.js          # 主入口（包含所有 API）
├── package.json            # 根目录 workspaces 配置
├── PRD-OpenExTeam.md      # 产品需求文档
├── SPEC.md                 # 技术规范
└── ARCHITECTURE-FRAMEWORK-BINDING.md  # 框架绑定架构
```

### 关键技术点

#### 1. 核心架构原则

**消息即总线** - Dashboard 只与主 Agent 通信，不感知子 Agent
- Adapter 只做消息格式转换，不维护状态
- 状态全部存在 Dashboard（sql.js + JSON 文件）

#### 2. Agent ID 格式

```
"adapterName:gatewayAgentId"
例如: "openclaw-bibi:openclaw-bibi"
```

#### 3. 数据库（sql.js）

- 文件位置: `server/db/openexteam.db`
- 主要表: `jobs`, `tasks`, `workflow_state`, `message_log`
- 同步 API，每次操作后调用 `saveDb()` 持久化

#### 4. SSE 实时推送

- 端点: `/api/events`
- 事件类型: `agent_message`, `adapter_connected`, `task_updated`, `workflow_started`, 等
- 广播函数: `broadcast(event, data)`

#### 5. 配置存储

- 位置: `~/.openexteam/config.json`
- 结构: `{ adapters: [], theme: 'light' }`

### 主要 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET | 获取配置 |
| `/api/config/adapters` | GET/POST | 适配器配置 |
| `/api/adapter/test` | POST | 测试适配器连接 |
| `/api/agents` | GET | 获取所有 Agent |
| `/api/message/send` | POST | 发送消息 |
| `/api/tasks` | GET/POST | 任务列表/创建 |
| `/api/tasks/:id` | DELETE | 删除任务 |
| `/api/task/start` | POST | 启动任务 |
| `/api/task/status` | POST | 更新任务状态 |
| `/api/jobs` | GET/POST | Job 列表/创建 |
| `/api/jobs/:id` | PATCH/DELETE | 更新/删除 Job |
| `/api/workflow/start` | POST | 启动工作流 |
| `/api/workflow/status` | GET | 工作流状态 |
| `/api/excards` | GET/POST | ExCard 列表/创建 |
| `/api/excards/:id` | GET/PUT/DELETE | ExCard 操作 |
| `/webhook/task-complete` | POST | Agent 任务完成回调 |
| `/api/events` | GET | SSE 事件流 |
| `/health` | GET | 健康检查 |

### 开发工作流

**后端开发:**
- 主文件: `server/server.js`（所有 API 都在这里）
- Adapter: `server/adapter/openclaw.js`
- 重启: `npm run dev:server`

**前端开发:**
- 主入口: `client/src/App.vue`
- 原型参考: `client/prototype.html`（直接浏览器打开）
- 热重载: `npm run dev:client` 自动更新

### 重要文档索引

| 文档 | 说明 |
|------|------|
| `PRD-OpenExTeam.md` | 产品需求文档（功能规格、用户故事） |
| `SPEC.md` | 技术规范（API 定义、消息协议） |
| `ARCHITECTURE-FRAMEWORK-BINDING.md` | 框架绑定架构设计 |
| `HANDOVER-20250415.md` | 工作交接文档（前前/开开分工） |
| `README.md` | 项目启动指南 |
