# OpenExTeam 全局流程设计

> 核心原则：消息即总线 · Dashboard 只与主 Agent 通信
> 文档限制：300 行以内

---

## 完整闭环流程

```
┌─────────────┐
│   用户      │
│  (界面)     │
└──────┬──────┘
       │ 1. 创建 Job + Task（可选绑定 ExCard）
       ▼
┌─────────────────────────────────┐
│   Dashboard (Vue3)             │
│   - 任务看板                   │
│   - 状态显示                   │
└──────┬──────────────────────────┘
       │ 2. API 请求
       ▼
┌─────────────────────────────────┐
│   Backend (Express)            │
│   - 统一消息格式封装            │
│   - 工作流状态管理              │
└──────┬──────────────────────────┘
       │ 3. 发送统一消息
       ▼
┌─────────────────────────────────┐
│   Adapter Layer                │
│   - OpenClaw Adapter          │
│   - 消息格式转换               │
└──────┬──────────────────────────┘
       │ 4. WebSocket 消息
       ▼
┌─────────────────────────────────┐
│   主 Agent (OpenClaw)         │
│   - 接收消息                   │
│   - spawn 子 Agent 执行        │
└──────┬──────────────────────────┘
       │ 5. 执行结果回调
       ▼
┌─────────────────────────────────┐
│   Backend (Webhook)            │
│   - 解析回调                   │
│   - 推进工作流                 │
└──────┬──────────────────────────┘
       │ 6. SSE 推送
       ▼
┌─────────────────────────────────┐
│   Dashboard (Vue3)             │
│   - 更新状态                   │
│   - 显示结果                   │
└─────────────────────────────────┘
```

---

## 1. 统一消息格式定义

### 下发消息（Dashboard → Adapter → 主 Agent）
```typescript
interface UnifiedMessage {
  message_id: string;
  type: 'task_assign' | 'workflow_step' | 'chat';
  task_id?: string;
  job_id?: string;
  step_index?: number;
  total_steps?: number;
  content: {
    title?: string;
    description: string;
    excard_id?: string;      // 绑定的 ExCard
    context?: string;        // 前序任务输出
  };
  callback: string;          // Webhook 回调地址
}
```

### 回调消息（主 Agent → Adapter → Dashboard）
```typescript
interface UnifiedCallback {
  message_id: string;
  type: 'task_complete' | 'workflow_step_complete';
  reply_to: string;
  task_id: string;
  job_id?: string;
  step_index?: number;
  result: {
    status: 'success' | 'failure' | 'blocked';
    output: string;
    artifacts?: string[];    // 生成的文件
  };
  timestamp: string;
}
```

---

## 2. ExCard 集成方式

### ExCard MD 格式（用户/Agent 都可编辑）
```markdown
---
id: EC-001
name: 标准文章创作
category: content
---

## Resource Dependencies
- Skill: writing_skill
- File: templates/article.md

## Execution Workflow
1. **调研主题**
   - 收集相关资料
   - 输出: research.md
2. **撰写初稿**
   - 基于调研写作
   - 输入: research.md
   - 输出: draft.md

## Execution Conventions
- Input: topics/{topic_id}.json
- Output: outputs/{timestamp}_article.md
```

### ExCard 绑定到任务流程
1. 用户创建 Job → 选择 ExCard
2. 系统自动解析 ExCard Workflow → 生成多个 Task
3. 每个 Task 对应 ExCard 的一个 Step
4. Task 执行时，注入 ExCard 的 Resource Dependencies

---

## 3. 工作流推进逻辑

### 状态机定义
```
Job 状态: idle → running → completed
Task 状态: todo → in-progress → done
```

### 推进流程
1. **启动 Job**: 找到第一个 todo Task，标记为 in-progress
2. **发送消息**: 向绑定 Agent 发送 UnifiedMessage
3. **等待回调**: Agent 执行完成，调用 Webhook
4. **更新状态**: 标记当前 Task 为 done
5. **自动推进**: 找到下一个 todo Task，重复步骤 2-4
6. **完成 Job**: 所有 Task done 后，标记 Job 为 completed

---

## 4. 代码组织方案

### Server 端（每个文件 < 300 行）
```
server/
├── index.js              # 入口（< 50 行）
├── config.js             # 配置加载
├── routes/               # API 路由
│   ├── agents.js
│   ├── tasks.js
│   ├── jobs.js
│   ├── excards.js
│   └── webhook.js
├── services/             # 业务逻辑
│   ├── workflow.js       # 工作流推进
│   ├── message.js        # 消息封装
│   └── excard.js         # ExCard 解析
├── models/               # 数据库操作
│   ├── job.js
│   ├── task.js
│   └── message_log.js
├── adapter/              # Adapter 层
│   ├── index.js
│   └── openclaw.js
├── events/               # SSE 事件
│   └── sse.js
└── storage/              # 存储层
    ├── json.js
    └── excard.js
```

### Client 端
```
client/src/
├── App.vue
├── views/
│   ├── Chat.vue
│   ├── Board.vue
│   ├── JobView.vue
│   ├── ExcardView.vue
│   ├── Monitor.vue
│   └── Settings.vue
├── components/
│   ├── TaskCard.vue
│   ├── JobCard.vue
│   └── ExcardEditor.vue  # MD 编辑器
├── stores/
│   ├── board.js
│   ├── chat.js
│   └── excard.js
└── api/
    └── client.js
```

---

## 5. 下一步行动

1. Git 初始化 + 创建 GitHub 私人仓库
2. 代码重构（拆分 server.js）
3. 实现统一消息格式
4. 实现 ExCard MD 编辑器
5. 端到端联调（OpenClaw 连接 → 任务创建 → 执行 → 回调）
