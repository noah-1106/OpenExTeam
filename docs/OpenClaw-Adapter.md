# OpenClaw Adapter 配置与使用文档

## 概述

OpenClaw Adapter 是 OpenExTeam Dashboard 与 OpenClaw Gateway 的连接器，负责：
- 获取 Agents 列表和状态
- 发送消息给 Agents
- 接收 Agents 的实时响应

## 架构设计

```
Dashboard (Vue3) ←→ OpenExTeam Server ←→ OpenClaw Adapter ←→ OpenClaw Gateway
                                    ↓
                              文件系统 (降级方案)
```

## 配置方法

### 1. 基础配置

在 `~/.openexteam/config.json` 中添加：

```json
{
  "adapters": [
    {
      "id": "openclaw",
      "type": "openclaw",
      "name": "OpenClaw",
      "url": "ws://localhost:18789",
      "token": "YOUR_GATEWAY_TOKEN",
      "enabled": true
    }
  ]
}
```

### 2. 获取 Gateway Token

**方法一：从 OpenClaw 配置获取**

```bash
openclaw config get gateway.auth.token
```

**方法二：使用 Device Token（推荐）**

如果需要发送消息给 Agents，需要使用 device token：

1. 生成 device identity（如果还没有）：
```bash
openclaw identity init
```

2. 请求 device pairing：
```bash
openclaw device pair request
```

3. 在 OpenClaw Control UI 或 CLI 中批准配对请求

4. 获取 device token：
```bash
cat ~/.openclaw/identity/device-auth.json
```

将 `tokens.operator.token` 填入配置文件的 `token` 字段。

## 功能说明

### Agents 列表

**实现方式**：
- 主要：从 Gateway RPC 获取 `agents.list`
- 降级：从 `~/.openclaw/agents/` 目录读取

**返回字段**：
- `id`: Agent ID (如 "openclaw-kaikai")
- `name`: 显示名称（从 IDENTITY.md 读取）
- `avatarUrl`: 头像路径（从 IDENTITY.md 读取）
- `status`: online/offline
- `adapter`: "OpenClaw"

### 消息发送

**接口**：`POST /api/message/send`

**参数**：
```json
{
  "agentId": "openclaw-kaikai",
  "content": "消息内容",
  "type": "chat"
}
```

**实现方式**：
- 调用 Gateway RPC `sessions.send`
- 需要 `operator.write` scope

## 权限要求

| 功能 | 需要的 Scope | 说明 |
|------|-------------|------|
| 读取 Agents 列表 | `operator.read` | 基础功能 |
| 发送消息 | `operator.write` | 聊天功能 |
| 查看系统状态 | `operator.read` | 监控功能 |

## 故障排查

### "missing scope: operator.read"

**原因**：Token 没有足够的权限

**解决**：
1. 使用 device token 而不是 gateway token
2. 确保 device 已完成 pairing 流程

### "device identity required"

**原因**：Gateway 配置为需要 device identity

**解决**：
1. 在 connect 请求中包含 device 信息
2. 或修改 Gateway 配置 `gateway.auth.mode`

### "device signature invalid"

**原因**：Device ID 与公钥指纹不匹配

**解决**：重新生成 device identity：
```bash
rm ~/.openclaw/identity/device.json
openclaw identity init
```

## 降级方案

当 Gateway 不可用时，Adapter 会自动降级：
- Agents 列表：从 `~/.openclaw/agents/` 目录读取
- 消息发送：记录到数据库，显示 "delivery not confirmed"

## Roadmap

- [ ] 支持多个 Gateway 连接
- [ ] 支持 node 类型 agents
- [ ] 支持文件/图片传输
- [ ] 支持流式响应

## 相关链接

- OpenClaw 文档：https://docs.openclaw.ai
- Gateway Protocol：https://docs.openclaw.ai/gateway/protocol
- Device Pairing：https://docs.openclaw.ai/gateway/pairing
