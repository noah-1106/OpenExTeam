# OpenExTeam

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/noah-1106/OpenExTeam/pulls)

**Universal AI Agent Team Command Center** — 在一个 Dashboard 上统一管理不同底座的 AI Agent，支持聊天、任务执行和多步骤工作流自动推进。

![](https://img.shields.io/badge/框架支持-OpenClaw%20%7C%20Hermes%20%7C%20DeerFlow-blue)

---

## 为什么做 OpenExTeam？

当你在用多个 AI Agent 框架（OpenClaw、Hermes、DeerFlow…）时，每个框架都有自己的管理界面和交互方式。OpenExTeam 要做的是：

- **统一入口** — 一个 Dashboard 管理所有底座的 Agent
- **消息即总线** — 所有交互通过消息完成，不侵入底座内部
- **工作流自动化** — ExCard 定义多步骤执行模板，Agent 完成一步自动推进下一步

## 核心特性

### 多框架 Agent 管理
- 支持 OpenClaw、Hermes、DeerFlow 三个框架
- 统一的 Agent 列表、在线状态和底座标识
- SSE 实时推送状态变更

### 智能聊天
- 单聊 + 系统通知会话
- Markdown 渲染 + 流式输出
- 聊天历史持久化，重新打开可查看完整对话
- 未读消息红色徽章 + 会话自动排序
- `/ec` 和 `/ec-modify` 斜杠命令创建和修改 ExCard

### 任务看板
- Job → Step 层级结构，三列看板（To Do / In Progress / Done）
- 只展示正在执行的工作，聚焦当前任务
- 实时状态更新

### ExCard 执行模板
- Markdown 格式的完整执行模板
- 多步骤 Workflow 定义，每步可指定不同 Agent
- Job 绑定 ExCard 后自动按步骤执行

### 多步骤工作流自动推进
- 自动解析 ExCard Workflow 步骤
- Agent 回复完成后检测并推进到下一步
- 全程 SSE 事件推送，聊天界面实时同步进度

## 技术栈

| 层 | 技术 |
|---|---|
| **Frontend** | Vue 3 · Vite · Pinia · TailwindCSS · Marked · DOMPurify |
| **Backend** | Express · sql.js (SQLite) · SSE · WebSocket |
| **Architecture** | 消息总线 + Adapter 层 |

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装

```bash
git clone https://github.com/noah-1106/OpenExTeam.git
cd OpenExTeam
npm install
```

### 开发

```bash
# 前后端同时启动
npm run dev

# 或单独启动
npm run dev:server   # 后端 → http://localhost:4000
npm run dev:client   # 前端 → http://localhost:3000
```

### 生产

```bash
npm run build   # 构建前端
npm start       # 启动后端（自动服务静态文件）
```

### 测试

```bash
node test-user-journey.js    # 用户旅程端到端测试（31 项）
```

## 项目结构

```
openexteam/
├── client/                 # Vue 3 前端
│   └── src/
│       ├── api/            # API 客户端 + SSE 工具
│       ├── components/     # UI 组件
│       ├── stores/         # Pinia 状态管理
│       └── views/          # 页面视图
├── server/                 # Express 后端
│   ├── adapter/            # Agent 适配器 (OpenClaw / Hermes / DeerFlow)
│   ├── routes/             # API 路由
│   ├── services/           # 业务服务 (Workflow)
│   ├── events/             # SSE 事件广播
│   ├── storage/            # ExCard 文件存储
│   ├── models/             # 数据库封装 (sql.js)
│   └── middleware/         # API 鉴权中间件
├── test-user-journey.js    # 端到端测试
└── package.json            # npm workspaces
```

## 架构设计

### Message as Bus

所有与底座的交互都通过**消息**完成：
- Dashboard 只做三件事：**发消息、收消息、驱动工作流**
- Adapter 只做消息格式转换，不维护状态
- 不干预底座内部运行（spawn、调度、执行由底座自己管理）

### ExCard 设计

- ExCard 是完整的执行模板，不拆分成多个 Task
- Task 是可选的，用于人工跟踪
- Agent 通过消息总线回复，不使用 webhook 回调
- Job 不需要指定 Agent，Agent 在 ExCard 或 Task 步骤中指定

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/agents` | GET | 获取所有 Agent |
| `/api/message/send` | POST | 发送消息 |
| `/api/messages/history` | GET | 聊天历史 |
| `/api/jobs` | GET/POST | Job 列表/创建 |
| `/api/jobs/:id/steps` | GET/POST | Job 步骤 |
| `/api/workflow/start` | POST | 启动工作流 |
| `/api/excards` | GET/POST | ExCard 列表/创建 |
| `/api/excards/:id/md` | GET/PUT | ExCard Markdown |
| `/api/events` | GET | SSE 事件流 |
| `/api/config` | GET | 获取配置 |

完整 API 列表见 [SPEC.md](SPEC.md)。

## 配置

配置文件位于 `~/.openexteam/config.json`：

```json
{
  "adapters": [
    {
      "id": "openclaw",
      "type": "openclaw",
      "name": "My OpenClaw",
      "url": "ws://127.0.0.1:9999",
      "token": "your-gateway-token",
      "enabled": true
    }
  ]
}
```

设置环境变量 `OPENEXTEAM_API_KEY` 可启用 API 鉴权（不设置则不限制访问）。

## License

[MIT](LICENSE)
