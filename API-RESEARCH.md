# OpenExTeam - 三大框架 API 技术调研报告

> 调研时间：2026-04-13
> 目的：验证 SPEC v1.1 中 Adapter 接口设计的可行性

---

## 一、OpenClaw

### 1.1 远程访问方式
- **协议：WebSocket RPC**
- **端口：** 默认 18789
- **认证：** Gateway Token（`gateway.auth.token`）
- **安全传输：** Tailscale / SSH Tunnel / loopback
- **CLI 命令：** `openclaw gateway call <method> --url <ws://host:port> --token <token>`

### 1.2 已验证的 RPC 端点

#### `gateway call health`
```json
{
  "ok": true,
  "ts": 1776074174155,
  "channels": {
    "feishu": { "configured": true, "running": false, "probe": {"ok": true, "botName": "红运"} }
  }
}
```

#### `gateway call status`
返回完整的框架状态信息：
```json
{
  "runtimeVersion": "...",
  "heartbeat": {...},
  "channelSummary": {...},
  "sessions": {...},
  "agents": [
    {
      "agentId": "main",
      "name": null,
      "isDefault": true,
      "heartbeat": { "enabled": true, "every": "30m" },
      "sessions": {
        "count": 14,
        "recent": [
          {
            "key": "agent:main:feishu:default:direct:ou_xxx",
            "updatedAt": 1776074065996,
            "age": 108154
          }
        ]
      }
    },
    { "agentId": "kaikai", "name": "kaikai" },
    { "agentId": "lulu", "name": "lulu" },
    // ... 共12个 agent
  ]
}
```

#### `gateway call sessions.list`
返回所有 session 的详细信息：
```json
{
  "ts": ...,
  "count": 21,
  "defaults": {
    "modelProvider": "minimax-portal",
    "model": "MiniMax-M2.7",
    "contextTokens": 200000
  },
  "sessions": [
    {
      "key": "agent:main:feishu:default:direct:ou_xxx",
      "kind": "direct",
      "status": "running",
      "inputTokens": 3,
      "outputTokens": 504,
      "totalTokens": 174463,
      "estimatedCostUsd": 0.003,
      "modelProvider": "autodl",
      "model": "claude-opus-4-6",
      "childSessions": ["agent:main:subagent:xxx", ...],
      "startedAt": 1776083494162,
      "updatedAt": 1776083494194
    }
  ]
}
```

### 1.3 Adapter 方法映射（已验证）

| Adapter 方法 | OpenClaw RPC | 已验证 | 返回数据 |
|---|---|---|---|
| connect | WebSocket 连接 | ✅ | ws://host:18789 |
| healthCheck | `gateway call health` | ✅ | {ok, channels} |
| listAgents | `gateway call status` → agents[] | ✅ | agentId, name, sessions, heartbeat |
| getAgentStatus | `gateway call sessions.list` → 按 agent 过滤 | ✅ | status, tokens, cost, model |
| getTokenUsage | sessions.list → session.totalTokens/estimatedCostUsd | ✅ | inputTokens, outputTokens, cost |
| spawnTask | 工具: sessions_spawn({agentId, task, mode:'run'}) | ⚠️ 需通过 agent 工具调用 | spawnId |
| getSpawnStatus | sessions.list → childSessions[] 过滤 | ✅ | session 状态 |
| sendMessage | 工具: sessions_send(sessionKey, message) | ⚠️ 需通过 agent 工具调用 | - |
| getConversationHistory | 工具: sessions_history(sessionKey) | ⚠️ 需通过 agent 工具调用 | Message[] |
| getMemory | 读文件（本地）或 通过 agent 工具（远程） | ⚠️ | MEMORY.md 内容 |

### 1.4 关键发现
1. **status 和 sessions.list 是核心 RPC** — 提供 agent 列表、session 状态、token 消耗、cost
2. **spawn/send/history 不是 Gateway RPC** — 它们是 agent 运行时的工具调用，需要通过 session 消息触发
3. **子agent 信息可追踪** — session 的 `childSessions[]` 字段列出所有子 agent

### 1.5 ⚠️ 关键问题：spawn 如何从外部触发？
OpenClaw 的 `sessions_spawn` 是 agent 的内部工具，不是 Gateway RPC 方法。外部系统无法直接调用。

**可能的方案：**
- A) 通过 `sessions_send` 向 agent 主 session 发消息，让 agent 自己 spawn 子agent
- B) 通过 Gateway `cron` 机制创建一个 agentTurn 类型的 job
- C) 推动 OpenClaw 上游暴露 spawn 的 REST/RPC API

---

## 二、Hermes Agent (Nous Research)

### 2.1 基本信息
- **GitHub：** https://github.com/NousResearch/hermes-agent (73k⭐)
- **语言：** Python
- **文档站：** https://hermes-agent.nousresearch.com/docs/
- **协议：** MIT
- **存储：** SQLite + FTS5（session/state）
- **从 OpenClaw 迁移：** `hermes claw migrate` 内置支持

### 2.2 架构概览
```
Entry Points: CLI (cli.py) | Gateway (gateway/run.py) | ACP (acp_adapter/)
    ↓
AIAgent (run_agent.py) → Prompt Builder + Provider Resolution + Tool Dispatch
    ↓
SessionStore (SQLite) + Tool Backends (6种终端 + Browser + Web + MCP)
```

### 2.3 Gateway 架构
- **协议：** 各平台原生协议（Telegram Bot API / Discord.py / Slack Socket Mode 等）
- **Session Key 格式：** `agent:main:{platform}:{chat_type}:{chat_id}`
- **Session 存储：** SQLite（gateway/session.py）
- **支持平台：** 15个（Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS, DingTalk, Feishu, WeCom, Weixin, BlueBubbles, HomeAssistant）

### 2.4 Sub-agent (delegate_tool)
- **工具名：** `delegate_task`
- **位置：** `tools/delegate_tool.py`
- **特点：** Agent-loop 级别的工具（不走 registry dispatch，直接在 agent loop 中处理）
- **行为：** Spawn isolated subagent session，独立上下文执行

### 2.5 CLI 命令（可用于 Adapter 实现）

| 命令 | 说明 | Adapter 用途 |
|------|------|------------|
| `hermes chat -q "prompt" --quiet` | 一次性执行 | spawnTask（非交互） |
| `hermes status` | 状态信息 | healthCheck |
| `hermes sessions` | 会话管理 | listSessions |
| `hermes gateway status` | Gateway 状态 | healthCheck |
| `hermes insights --days N` | Token/cost 分析 | getTokenUsage |

### 2.6 关键问题
1. **没有公开的 HTTP/REST API** — Hermes Gateway 是消息适配层，不是 REST 服务
2. **没有 WebSocket RPC** — 不像 OpenClaw 有 gateway call
3. **可用方案：**
   - A) 通过 CLI 命令（subprocess）执行操作
   - B) 通过 Python API 直接调用（import hermes 模块）
   - C) 通过 Webhook adapter（`gateway/platforms/webhook.py` / `api_server.py`）
   - D) 通过 ACP adapter（VS Code / Zed 集成用的 API）

### 2.7 最佳方案评估
- **`api_server.py` 是关键** — Hermes 有一个 REST API server adapter！
- **ACP adapter** 也暴露了标准化接口
- 如果两者都不够，**Python SDK 嵌入**是最可靠的（直接 import）

---

## 三、DeerFlow (ByteDance)

### 3.1 基本信息
- **GitHub：** https://github.com/bytedance/deer-flow (61k⭐)
- **语言：** Python（后端）+ Next.js（前端）
- **协议：** MIT
- **默认端口：** 2026（统一代理）
- **架构：** LangGraph + LangChain 基础

### 3.2 API 架构
DeerFlow 有 **完整的 HTTP REST API**（Gateway API）！

**三个 URL：**
```
DEERFLOW_URL=http://localhost:2026            # 统一代理（nginx 反代）
DEERFLOW_GATEWAY_URL=http://localhost:2026    # Gateway API
DEERFLOW_LANGGRAPH_URL=http://localhost:2026/api/langgraph  # LangGraph API
```

### 3.3 Gateway API 端点（从 claude-to-deerflow 技能和 README 推断）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/models` | GET | 模型列表 |
| `/api/skills` | GET | Skills 列表 |
| `/api/chat` | POST | 发送聊天消息 |
| `/api/chat/stream` | POST | 流式聊天 |
| `/api/threads` | GET | 线程列表 |
| `/api/threads/{thread_id}` | GET/DELETE | 线程管理 |
| `/api/threads/{thread_id}/upload` | POST | 上传文件 |
| `/api/langgraph/*` | * | LangGraph 原生 API |

### 3.4 Embedded Python Client
```python
from deerflow.client import DeerFlowClient

client = DeerFlowClient()
response = client.chat("Analyze this paper", thread_id="my-thread")
models = client.list_models()      # {"models": [...]}
skills = client.list_skills()      # {"skills": [...]}
client.upload_files("thread-1", ["./report.pdf"])
```

### 3.5 执行模式
| 模式 | 说明 | sub-agent |
|------|------|-----------|
| flash | 快速执行 | 否 |
| standard | 标准模式 | 否 |
| pro | 规划模式 | 是 |
| ultra | 完整 sub-agents | 是 |

### 3.6 Sub-agents
- Lead agent 动态 spawn sub-agents
- 每个 sub-agent 有独立的上下文、工具和终止条件
- 并行执行
- 结果汇报给 lead agent 合成输出

### 3.7 IM Channels
DeerFlow 原生支持消息平台集成：
- Telegram, Slack, Feishu, WeChat, WeCom
- 通过 config.yaml 配置，自动启动

### 3.8 Adapter 映射

| Adapter 方法 | DeerFlow 实现 | 可行性 |
|---|---|---|
| connect | HTTP 连接到 :2026 | ✅ |
| healthCheck | `GET /api/health` | ✅ |
| listAgents | 不适用（DeerFlow 是单 agent，通过 skills 扩展能力） | ⚠️ |
| spawnTask | `POST /api/chat` with mode="ultra" | ✅ |
| getSpawnStatus | `GET /api/threads/{thread_id}` | ✅ |
| sendMessage | `POST /api/chat` | ✅ |
| getConversationHistory | `GET /api/threads/{thread_id}` | ✅ |
| getTokenUsage | 需要从 LangSmith/Langfuse 获取，或 thread 信息中提取 | ⚠️ |
| getMemory | `/api/memory`（推测） | ⚠️ |

### 3.9 关键发现
1. **DeerFlow 有完整的 HTTP REST API** — 最容易对接
2. **DeerFlow 不是"多 agent"架构** — 它是单 lead agent + 动态 sub-agents，不像 OpenClaw 有多个独立 agent
3. **thread_id 类似 session** — 每个对话一个 thread
4. **execution mode 控制是否使用 sub-agents** — ultra 模式启用完整 sub-agent

---

## 四、对比总结

### 4.1 远程 API 对比

| 能力 | OpenClaw | Hermes Agent | DeerFlow |
|------|----------|-------------|----------|
| 协议 | WebSocket RPC | CLI / Python API / Webhook | HTTP REST |
| 远程访问 | ✅ ws://host:18789 | ⚠️ 需要 SSH 或 API server | ✅ http://host:2026 |
| 认证 | Gateway Token | 平台级认证 | 待确认 |
| Agent 列表 | ✅ `status` RPC | ⚠️ 需要 CLI/文件 | ❌ 单 agent 架构 |
| Spawn 子agent | ⚠️ 需间接触发 | ⚠️ delegate_tool 是内部工具 | ✅ `POST /api/chat` mode=ultra |
| Session 管理 | ✅ `sessions.list` RPC | ✅ `hermes sessions` CLI | ✅ `/api/threads` |
| Token 消耗 | ✅ session 字段中有 | ✅ `hermes insights` | ⚠️ 需 LangSmith |
| 文件上传 | ❌ 无 API | ❌ 无 API | ✅ `/api/threads/{id}/upload` |

### 4.2 架构差异

| 维度 | OpenClaw | Hermes Agent | DeerFlow |
|------|----------|-------------|----------|
| Agent 模型 | 多独立 Agent | 单 Agent + Profiles | 单 Lead Agent + 动态 Sub-agents |
| 存储 | JSON 文件 | SQLite | LangGraph State + SQLite |
| 语言 | Node.js | Python | Python + Next.js |
| Gateway | WebSocket RPC | 平台适配 | HTTP REST + LangGraph |
| Session 概念 | 显式 session key | 显式 session ID | Thread ID |

### 4.3 SPEC 设计影响

**需要调整的地方：**

1. **`listAgents` 不通用** — DeerFlow 没有"多 agent"概念，它的 "agent" 更像 "skill/mode"
   - 建议：重新定义 listAgents 为 "list capabilities"，各 Adapter 翻译
   
2. **`spawnTask` 触发方式各不同：**
   - OpenClaw：需要通过向 agent session 发消息来间接触发 spawn
   - Hermes：需要通过 CLI 或 Python API 调用 delegate_tool
   - DeerFlow：直接 HTTP POST with mode=ultra ✅ 最简单

3. **认证方式不统一：**
   - OpenClaw：Gateway Token
   - Hermes：平台级认证 + CLI
   - DeerFlow：HTTP API（待确认是否有 auth）

4. **"Agent" 概念不统一：**
   - OpenClaw：多个独立 Agent（main, kaikai, lulu...）
   - Hermes：单 Agent，多 Profile
   - DeerFlow：单 Lead Agent，能力通过 skills 扩展

---

## 五、建议的 Adapter 实现方案

### 5.1 OpenClaw Adapter
```
连接方式：WebSocket (ws://host:18789)
认证：Gateway Token
Agent 列表：gateway call status → agents[]
Session 管理：gateway call sessions.list
任务执行：向 agent 主 session 发消息 → agent 自动 spawn 子agent
Token/Cost：从 sessions.list 中提取
Memory：通过 agent session 请求读取
```

### 5.2 Hermes Adapter
```
连接方式：SSH + CLI 命令 / 或 api_server.py REST endpoint
认证：SSH key / API Token
Agent 列表：hermes status（单 agent，返回当前 profile）
Session 管理：hermes sessions
任务执行：hermes chat -q "task prompt" --quiet
Token/Cost：hermes insights
Memory：hermes memory
```

### 5.3 DeerFlow Adapter
```
连接方式：HTTP REST (http://host:2026)
认证：待确认（可能无认证或 API Key）
Agent 列表：GET /api/skills（返回能力列表）
Session 管理：GET /api/threads
任务执行：POST /api/chat {message, thread_id, mode: "ultra"}
Token/Cost：从 LangSmith/Langfuse 获取，或 response 中提取
Memory：GET /api/memory（推测）
文件上传：POST /api/threads/{id}/upload ✅
```

---

*调研完成时间：2026-04-13 20:35*
