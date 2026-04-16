# OpenExTeam 框架绑定架构设计（简化版）

> 消息总线架构：Dashboard 只与主 Agent 通信
> 设计日期：2026-04-16

---

## 核心原则

**Dashboard 只认识"一个 Agent"，不关心子 Agent 如何创建和管理。**

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard                                               │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐     │
│  │  任务A     │───►│  任务B     │───►│  任务C     │     │
│  └────────────┘    └────────────┘    └────────────┘     │
│       │                 │                 │              │
│       └─────────────────┴─────────────────┘              │
│                    │                                     │
│                    ▼                                     │
│            统一消息格式                                   │
│    {type, content, callback, taskId, jobId}           │
└──────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   OpenClaw   │  │    Hermes    │  │   DeerFlow   │
    │   主 Agent   │  │   主 Agent   │  │   主 Agent   │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  子 Agent    │  │  子 Agent    │  │  子 Agent    │
    │  (spawn)     │  │  (delegate)  │  │  (ultra mode)│
    └──────────────┘  └──────────────┘  └──────────────┘
           │                 │                 │
           └─────────────────┴─────────────────┘
                    │
                    ▼
         回调到 Dashboard
         (来自主 Agent)
```

---

## 统一消息格式

### 下发消息（Dashboard → Adapter → 主 Agent）

```json
{
  "message_id": "msg_001",
  "type": "task_assign" | "workflow_step" | "workflow_start",
  "task_id": "task-001",
  "job_id": "job-001",
  "step_index": 1,
  "total_steps": 7,
  "content": {
    "title": "任务标题",
    "description": "任务描述",
    "context": "前序任务输出（如有）"
  },
  "callback": "http://dashboard:4000/webhook/agent-callback"
}
```

### 回调消息（主 Agent → Adapter → Dashboard）

```json
{
  "message_id": "msg_002",
  "type": "task_complete" | "workflow_step_complete" | "workflow_complete",
  "reply_to": "msg_001",
  "task_id": "task-001",
  "job_id": "job-001",
  "step_index": 1,
  "result": {
    "status": "success" | "failure" | "blocked",
    "output": "执行结果文本",
    "artifacts": ["file1.js", "file2.md"]
  },
  "timestamp": "2026-04-16T01:00:00+08:00"
}
```

---

## 各框架 Adapter 实现

### OpenClaw Adapter

```typescript
class OpenClawAdapter {
  // 发送消息给主 Agent
  async send(agentId: string, message: UnifiedMessage): Promise<void> {
    // 1. 转换消息格式
    const openclawMessage = {
      tool: "sessions_send",
      params: {
        sessionKey: agentId,  // 主 agent 的 session key
        message: message.content
      }
    };
    
    // 2. 发送到主 Agent
    // 主 Agent 内部通过 sessions_spawn 创建子 Agent 执行
    await this.webSocketSend(openclawMessage);
  }
  
  // 解析回调
  parse(raw: any): UnifiedCallback {
    // 回调来自主 Agent（子 Agent 结果已汇总）
    return {
      type: 'task_complete',
      taskId: raw.taskId,
      result: raw.output,
      // ...
    };
  }
}
```

**OpenClaw 内部流程：**
1. Dashboard 发送消息给主 Agent session
2. 主 Agent 收到消息，调用 `sessions_spawn` 创建子 Agent
3. 子 Agent 执行完成后，结果返回主 Agent
4. 主 Agent 汇总结果，通过 webhook 回调 Dashboard

---

### DeerFlow Adapter

```typescript
class DeerFlowAdapter {
  async send(agentId: string, message: UnifiedMessage): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message: message.content,
        thread_id: agentId,  // thread 作为 lead agent 标识
        mode: message.type === 'workflow_step' ? 'ultra' : 'standard',
        callback: message.callback
      })
    });
  }
}
```

**DeerFlow 内部流程：**
1. Dashboard POST /api/chat 给 lead agent
2. `mode=ultra` 触发 lead agent 内部创建 sub-agents
3. sub-agents 执行完成，结果汇总给 lead agent
4. lead agent 通过 webhook 回调 Dashboard

---

### Hermes Adapter

```typescript
class HermesAdapter {
  async send(agentId: string, message: UnifiedMessage): Promise<void> {
    // 方案 A: 通过 api_server.py HTTP API
    await fetch(`${this.endpoint}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        prompt: message.content,
        agent: agentId,
        callback: message.callback
      })
    });
    
    // 方案 B: SSH + CLI
    // ssh user@host "hermes chat -q 'prompt' --json"
  }
}
```

**Hermes 内部流程：**
1. Dashboard 发送消息给主 Agent
2. 主 Agent 调用 `delegate_task` 工具创建子 Agent
3. 子 Agent 执行完成，结果返回主 Agent
4. 主 Agent 通过 webhook 回调 Dashboard

---

## OpenClaw 远程连接方案

### 方案：Tailscale（推荐）

```bash
# 服务器端（OpenClaw）
tailscale up
openclaw config set gateway.bind tailnet
openclaw gateway restart

# 获取连接信息
openclaw qr --json
# 输出: wss://oc-server.tailnet.ts.net:18789
```

**Dashboard 配置：**
```json
{
  "type": "openclaw",
  "endpoint": "wss://oc-server.tailnet.ts.net:18789",
  "auth": { "mode": "token" }
}
```

**配对流程（不可跳过）：**
1. Dashboard 输入 URL，点击"配对"
2. 在 OpenClaw 服务器执行：`openclaw devices approve --latest`
3. Dashboard 获得 Gateway Token，完成连接

---

## Dashboard 工作流推进

```javascript
// 工作流启动
async startWorkflow(jobId) {
  const tasks = await db.getTasks(jobId);
  const firstTodo = tasks.find(t => t.status === 'todo');
  
  // 发送消息给第一个任务的主 Agent
  await adapter.send(firstTodo.agent, {
    type: 'workflow_step',
    taskId: firstTodo.id,
    content: { title: firstTodo.title, ... },
    callback: `${DASHBOARD_URL}/webhook/agent-callback`
  });
}

// 接收回调，自动推进
async onAgentCallback(message) {
  if (message.type === 'workflow_step_complete') {
    // 标记当前任务完成
    await db.updateTask(message.taskId, { status: 'done' });
    
    // 找到下一个任务
    const nextTask = await db.findNextTodo(message.jobId);
    if (nextTask) {
      // 自动发送给下一个 Agent
      await adapter.send(nextTask.agent, {
        type: 'workflow_step',
        taskId: nextTask.id,
        content: { title: nextTask.title, ... },
        callback: `${DASHBOARD_URL}/webhook/agent-callback`
      });
    } else {
      // 工作流完成
      await db.updateJob(message.jobId, { status: 'done' });
    }
  }
}
```

---

## 文档索引

| 文档 | 说明 |
|------|------|
| `SPEC.md` | 技术规范（消息协议、API 定义） |
| `ARCHITECTURE-FRAMEWORK-BINDING.md` | 本文件（框架绑定架构） |
| `HANDOVER-20250415.md` | 工作交接文档（前前/开开分工） |
| `API-RESEARCH.md` | 三大框架 API 调研报告 |

---

*设计完成：2026-04-16*
