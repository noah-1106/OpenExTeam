# OpenExTeam

> 跨框架 AI Agent 团队可视化协作平台
>
> 在一个 Dashboard 上统一管理不同底座的 Agent，支持聊天、任务执行和多步骤工作流

---

## ✨ 核心特性

### 🤖 多框架 Agent 管理
- 支持 OpenClaw、Hermes、DeerFlow 三个框架
- 统一的 Agent 列表和状态管理
- 实时在线/离线/忙碌状态展示

### 💬 智能聊天
- 单聊 + 群聊支持
- Markdown 渲染
- 流式输出
- 系统通知会话（工作流进度实时同步）

### 📋 任务看板
- Job → Task 层级结构
- 三列看板布局（To Do / In Progress / Done）
- 实时状态更新（SSE 推送）
- 任务详情面板

### 🎯 ExCard 执行模板
- Markdown 格式的完整执行模板
- 多步骤 workflow 定义
- 每个步骤可指定不同 Agent
- Job 绑定 ExCard 自动执行

### 🔄 多步骤工作流自动推进 🌟
- 自动解析 ExCard workflow 步骤
- Agent 回复完成后自动推进到下一步
- 完整的状态跟踪和 SSE 事件推送
- 实时同步到聊天界面系统通知

### 📡 消息总线架构
- 所有交互通过消息完成
- 不使用 webhook 回调
- 不干预底座内部运行
- Adapter 只做消息格式转换

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
# 前后端同时启动
npm run dev

# 或单独启动
npm run dev:server   # 后端 (端口 4000)
npm run dev:client   # 前端 (端口 3000)
```

### 服务地址

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:4000 |
| 前端界面 | http://localhost:3000 |
| 健康检查 | http://localhost:4000/health |

---

## 📁 项目结构

```
openexteam/
├── client/                 # Vue3 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── views/          # 页面视图
│   │   ├── stores/         # Pinia 状态管理
│   │   └── api/            # API 客户端
│   └── package.json
├── server/                 # Express 后端
│   ├── adapter/            # Agent 适配器
│   │   └── openclaw.js    # OpenClaw 适配器
│   ├── routes/             # API 路由
│   ├── models/             # 数据模型
│   ├── services/           # 业务服务
│   ├── events/             # SSE 事件
│   ├── storage/            # ExCard 存储
│   ├── db/                # 数据库 (sql.js)
│   └── index.js           # 主入口
├── e2e/                   # 端到端测试
├── package.json            # 根目录
├── PRD-OpenExTeam.md      # 产品需求
├── SPEC.md               # 技术规范
├── CODE-REVIEW.md        # 代码审查报告
└── README.md              # 本文件
```

---

## 🛠️ 核心技术栈

### 前端
- Vue 3 + Vite
- Pinia (状态管理)
- TailwindCSS
- SSE (Server-Sent Events)
- Marked (Markdown 渲染)

### 后端
- Express.js
- sql.js (SQLite)
- SSE (实时推送)
- WebSocket (Agent 通信)

---

## 📚 核心设计原则

### "消息即总线" (Message as Bus)

- 所有与底座的交互都通过**消息**完成
- 不使用复杂的系统级 API 调用
- **不干预底座的内部运行**（底座自己管理 spawn、调度、执行）
- Dashboard 只负责：**发消息、收消息、驱动工作流**

### ExCard 设计原则

- ExCard 是完整的执行模板，不拆分成多个 Task
- Task 是可选的，用于人工跟踪，不是 ExCard 的拆分结果
- Agent 通过消息总线回复，不是 webhook 回调
- Job 不需要指定 Agent，Agent 在 ExCard 或 Task 中指定

---

## 🔧 配置说明

### 配置文件位置

```bash
~/.openexteam/config.json
```

### 配置格式

```json
{
  "adapters": [
    {
      "id": "openclaw",
      "type": "openclaw",
      "name": "我的OpenClaw",
      "url": "ws://127.0.0.1:9999",
      "token": "xxx",
      "enabled": true
    }
  ],
  "theme": "light"
}
```

---

## 📊 工作流推进逻辑

### 多步骤工作流

```
1. startWorkflow(jobId)
   ↓
2. 解析 ExCard workflow 步骤
   ↓
3. 发送第 1 步给 Agent (current_step = 1)
   ↓
4. Agent 回复 (含 "完成"/"done"/"workflow_complete")
   ↓
5. handleAgentReply() 检测完成
   ↓
6. 检查是否有下一步 (current_step < total_steps)
   ↓
7a. 有下一步 → current_step + 1，发送 workflow_step_advanced 事件
7b. 无下一步 → completeWorkflow()，标记 Job done
```

---

## 🎯 API 端点一览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/config` | GET | 获取配置 |
| `/api/agents` | GET | 获取所有 Agent |
| `/api/message/send` | POST | 发送消息 |
| `/api/tasks` | GET/POST | 任务列表/创建 |
| `/api/task/start` | POST | 启动任务 |
| `/api/task/status` | POST | 更新任务状态 |
| `/api/jobs` | GET/POST | Job 列表/创建 |
| `/api/jobs/:id` | PATCH/DELETE | 更新/删除 Job |
| `/api/workflow/start` | POST | 启动工作流 |
| `/api/workflow/status` | GET | 工作流状态 |
| `/api/excards` | GET/POST | ExCard 列表/创建 |
| `/api/excards/:id` | GET/PUT/DELETE | ExCard 操作 |
| `/api/events` | GET | SSE 事件流 |

---

## 📝 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建前端
npm run build

# 生产启动
npm start

# 运行测试
node test-full-suite.js
```

---

## 📚 文档索引

| 文档 | 说明 |
|------|------|
| `PRD-OpenExTeam.md` | 产品需求文档 |
| `SPEC.md` | 技术规范 |
| `ARCHITECTURE-FRAMEWORK-BINDING.md` | 框架绑定架构 |
| `CODE-REVIEW.md` | 代码审查报告 |
| `REQUIREMENTS.md` | 需求与设计原则 |

---

## 👥 团队

- 品品 (产品)
- 开开 (后端/Adapter)
- 前前 (前端)

---

## 📄 许可证

MIT License

---

**有问题找品品对齐。
