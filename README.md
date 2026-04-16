# OpenExTeam 项目启动指南

> 跨框架 AI Agent 团队可视化协作平台

---

## 快速启动

```bash
# 1. 进入项目目录
cd /root/.openclaw/workspace-devteam/OpenExTeam

# 2. 安装依赖并启动
npm install
npm run dev
```

服务将启动：
- **后端 API**: http://localhost:4000
- **前端界面**: http://localhost:3000 (Vue3 开发服务器)
- **健康检查**: http://localhost:4000/health

---

## 项目结构

```
openexteam/
├── client/                 # Vue3 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── views/          # 页面视图
│   │   ├── stores/         # Pinia 状态管理
│   │   └── api/            # API 客户端
│   ├── prototype.html      # 交互原型参考
│   └── package.json
├── server/                 # Express 后端
│   ├── server.js           # 主入口
│   ├── adapter/            # Agent 适配器
│   │   └── opencode.js     # OpenCode 适配器
│   ├── db/                 # 数据库
│   │   └── init.sql        # 初始化数据
│   └── package.json
├── package.json            # 根目录 workspaces 配置
├── SPEC.md                 # 技术规范
├── PRD.md                  # 产品需求
└── README.md               # 本文件
```

---

## 开发工作分配

### 前前（前端 Vue3）

**必须完成（P0）：**
- [ ] 初始化 Vue3 + Vite + TailwindCSS 项目
- [ ] 实现侧边栏导航（Agent列表、群聊列表）
- [ ] 实现 Tab 切换（6个Tab）
- [ ] 实现聊天界面（消息气泡、输入框、typing状态）
- [ ] 实现任务看板（三列布局、任务卡片）
- [ ] 实现任务详情面板（右侧滑出、状态切换）
- [ ] 对接后端 API（`npm run dev` 自动代理）

**参考实现：** `client/prototype.html` 中的函数

**API 端点：** 见下方「API 参考」

### 开开（后端/Adapter）

**必须完成（P0）：**
- [ ] 测试并完善现有 API 端点
- [ ] 实现 OpenCode 适配器集成（真正调用 opencode CLI）
- [ ] 实现工作流串行推进逻辑（任务完成后自动启动下一步）
- [ ] 添加消息日志查询 API
- [ ] 错误处理和重试机制

**当前状态：** 基础框架已创建，见 `server/server.js`

**适配器位置：** `server/adapter/opencode.js`

---

## API 参考

### 消息相关
```bash
POST /api/message/send
{ agentId, content, type }
```

### 任务相关
```bash
POST /api/task/start
{ taskId }

POST /api/task/status
{ taskId, status }

GET /api/tasks?jobId=xxx
```

### 工作流相关
```bash
POST /api/workflow/start
{ jobId }

GET /api/workflow/status?jobId=xxx
```

### Webhook（Agent 回调）
```bash
POST /webhook/task-complete
{ type, taskId, jobId, agent, result }
```

---

## 数据库

```bash
# 初始化数据
cd server
sqlite3 db/openexteam.db < db/init.sql

# 查看数据
sqlite3 db/openexteam.db "SELECT * FROM jobs;"
sqlite3 db/openexteam.db "SELECT * FROM tasks;"
```

---

## 工作流推进逻辑

```
1. 用户点击"启动工作流"
   → POST /api/workflow/start
   → 找到第一个 todo 任务
   → 发送消息给对应 Agent

2. Agent 完成任务后回调
   → POST /webhook/task-complete
   → 标记当前任务 done
   → 自动找到下一个 todo 任务
   → 发送消息给下一个 Agent

3. 重复直到所有任务完成
   → 标记 Job 为 done
   → 发送完成通知给所有参与者
```

---

## 环境变量

```bash
# 后端 .env
PORT=4000
DATABASE_URL=./db/openexteam.db
OPENCODE_API_KEY=xxx  # 如需真实调用 OpenCode
```

---

## 文档索引

| 文件 | 说明 |
|------|------|
| `SPEC.md` | 技术规范（Adapter接口、消息协议） |
| `PRD-OpenExTeam.md` | 产品需求文档 |
| `HANDOVER-20250415.md` | 详细工作交接文档 |
| `client/prototype.html` | 前端交互原型（直接打开看效果） |

---

## 开发顺序建议

1. **Day 1**: 前端初始化 + 后端测试运行
2. **Day 2**: 聊天界面 + 消息 API 对接
3. **Day 3**: 任务看板 + 任务详情
4. **Day 4**: 工作流启动 + 状态同步
5. **Day 5**: 适配器集成 + 调试收尾

---

有问题找品品对齐。
