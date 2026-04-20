# OpenExTeam 项目需求与设计原则

> 文档版本：v1.0 | 日期：2026-04-18
> 产品：OpenExTeam - 跨底座 AI Agent 团队管理平台

---

## 一、产品定位

**一句话描述**：在同一个 Dashboard 上统一管理不同底座的 Agent，支持聊天和任务执行。

**目标底座**：OpenClaw、Hermes、DeerFlow

---

## 二、核心设计原则

### 2.1 "消息即总线" (Message as Bus)

- 所有与底座的交互都通过**消息**完成
- 不使用复杂的系统级 API 调用
- **不干预底座的内部运行**（底座自己管理 spawn、调度、执行）
- Dashboard 只负责：**发消息、收消息、驱动工作流**

### 2.2 消息协议

**下发消息格式**（Dashboard → Adapter → 底座）：
```json
{
  "message_id": "msg_xxx",
  "type": "chat" | "task_assign" | "workflow_step",
  "task_id": "task_xxx",
  "content": {
    "title": "任务标题",
    "description": "任务描述"
  },
  "callback": "http://dashboard:4000/webhook/agent-callback"
}
```

**回调消息格式**（底座 → Adapter → Dashboard）：
```json
{
  "message_id": "msg_xxx",
  "type": "chat_reply" | "task_complete" | "workflow_step_complete",
  "task_id": "task_xxx",
  "result": {
    "status": "success",
    "output": "执行结果"
  }
}
```

---

## 三、系统架构

```
┌─────────────────────────────────────────────┐
│  OpenExTeam Dashboard (Vue3 + Express)       │
│  ┌─────────────────────────────────────┐   │
│  │ Server (Node.js)                   │   │
│  │ ┌─────────────┐  ┌─────────────┐   │   │
│  │ │ API 层     │  │ Adapter 层  │   │   │
│  │ │ (REST)     │  │ (消息翻译) │   │   │
│  │ └─────────────┘  └─────────────┘   │   │
│  └─────────────────────────────────────┘   │
└──────────────┬──────────────────────────────┘
               │ WebSocket / HTTP
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌───────┐  ┌───────┐  ┌───────┐
│OpenClaw│  │Hermes │  │DeerFlow│
│底座    │  │底座   │  │底座    │
└───────┘  └───────┘  └───────┘
```

---

## 四、模块职责

### 4.1 Dashboard Server（后端）

- **消息下发**：通过 Adapter 向底座发送消息
- **回调接收**：接收底座的回调，解析消息内容
- **工作流推进**：根据回调消息，决定下一步动作
- **状态存储**：任务状态、聊天记录、配置数据
- **实时推送**：通过 SSE 向前端推送状态更新

**不做的事**：
- ❌ 不管理底座内部状态
- ❌ 不干预底座调度逻辑
- ❌ 不维护到底座的长连接

### 4.2 Adapter 层

**核心职责**：
1. **连接底座**：建立与底座的通信通道
2. **消息翻译**：Dashboard 统一格式 ↔ 底座原生格式
3. **消息收发**：发送消息给底座，接收底座回调
4. **工作流推进**：收到回调后，根据消息类型推进工作流

**关键原则**：
- Adapter 只与底座的**主 Agent** 通信
- 底座内部自行 spawn 子 Agent（对 Dashboard 透明）
- 所有回调统一来自主 Agent

### 4.3 底座（外部系统）

- 接收 Adapter 发来的消息
- 自行决定如何执行（spawn 子 agent、分配任务等）
- 执行完成后，按约定格式回调 Dashboard
- 底座内部逻辑对 Dashboard 完全透明

---

## 五、工作流程

### 5.1 正常聊天

1. 用户在 Dashboard 输入消息
2. Dashboard → Adapter → 底座主 Agent
3. 底座主 Agent 回复
4. 底座 → Adapter → Dashboard
5. Dashboard 更新聊天界面

### 5.2 任务执行（工作流）

1. 用户点击"启动工作流"
2. Dashboard 找到 Job 下第一个 `todo` 任务
3. Dashboard → Adapter → 底座：发送 `workflow_step` 消息
4. 底座执行（自行 spawn 子 agent）
5. 底座执行完成，回调 Dashboard：`workflow_step_complete`
6. Dashboard 收到回调：
   - 更新当前任务状态为 `done`
   - 查找同 Job 的下一个 `todo` 任务
   - 如有：发送下一个 `workflow_step`
   - 如无：标记 Job 为 `completed`

---

## 六、技术约束

### 6.1 Adapter 实现原则

```javascript
// Adapter 接口
class AgentAdapter {
  // 连接底座
  connect(config): Promise<void>
  
  // 发送消息给底座主 Agent
  send(agentId: string, message: UnifiedMessage): Promise<void>
  
  // 解析底座回调，转为统一格式
  parse(raw: any): UnifiedMessage | null
}
```

### 6.2 各底座接入方式

| 底座 | 通信方式 | 主 Agent 标识 |
|------|---------|--------------|
| OpenClaw | WebSocket RPC | `sessionKey` |
| Hermes | HTTP API | `agentId` |
| DeerFlow | HTTP REST | `thread_id` |

### 6.3 数据存储

- 任务、聊天记录、配置：Dashboard Server 本地存储
- Token 消耗、Agent 内部状态：从底座实时读取

---

## 七、验收标准

- [ ] Dashboard 能看到各底座的 Agent 列表
- [ ] 能在看板创建、拖拽、关闭任务卡片
- [ ] 任务能通过消息下发到指定 Agent，并收到回调
- [ ] 工作流能自动推进（一步完成自动启动下一步）
- [ ] 能和 Agent 进行单聊和群聊
- [ ] 任务状态能实时同步到前端

---

## 八、关键设计决策

1. **消息即总线**：所有交互都是消息，不依赖底座内部 API
2. **Adapter 做推进**：收到回调后自动触发下一步
3. **底座透明化**：不感知底座内部子 Agent 机制
4. **回调驱动**：底座通过回调通知 Dashboard，Dashboard 据此推进

---

*文档由 Noah 口述，开开整理*
