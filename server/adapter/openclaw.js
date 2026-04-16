/**
 * OpenClaw Adapter
 *
 * 职责：
 * 1. 消息格式转换（统一协议 ↔ OpenClaw 原生 WebSocket RPC 格式）
 * 2. 发送消息给主 Agent（通过 sessions_send）
 * 3. 解析主 Agent 回调（统一格式）
 * 4. 管理 WebSocket 连接（心跳保活、自动重连）
 *
 * Dashboard 只与主 Agent 通信，不感知子 Agent 存在。
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class OpenClawAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = 'openclaw';
    this.version = '1.0.0';
    this.url = config.url || 'ws://localhost:18789';
    this.token = config.token;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.pingInterval = null;
    this.pendingRequests = new Map(); // { id: { resolve, reject, timeout } }
    this.requestId = 0;
  }

  // ===== 连接管理 =====

  /**
   * 建立 WebSocket 连接
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        this.ws = new WebSocket(this.url, headers);

        // 超时控制：10秒未连接则拒绝
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
          this.ws.close();
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this._startHeartbeat();
          console.log(`[OpenClawAdapter] Connected to ${this.url}`);
          resolve();
        });

        this.ws.on('message', (data) => {
          this._handleMessage(data);
        });

        this.ws.on('error', (err) => {
          console.error(`[OpenClawAdapter] WebSocket error: ${err.message}`);
          this.emit('error', err);
        });

        this.ws.on('close', () => {
          this.connected = false;
          this._stopHeartbeat();
          console.log('[OpenClawAdapter] Disconnected');
          this._attemptReconnect();
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 断开连接
   */
  async disconnect() {
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const result = await this._rpcCall('gateway', 'health', {});
      return result !== null && result !== undefined;
    } catch (err) {
      return false;
    }
  }

  // ===== Agent 操作 =====

  /**
   * 列出所有 Agent
   * @returns {Promise<Agent[]>}
   */
  async listAgents() {
    try {
      // 调用 gateway status 获取 agent 列表
      const status = await this._rpcCall('gateway', 'status', {});
      const agents = [];

      if (status && status.agents) {
        for (const agent of status.agents) {
          agents.push({
            id: agent.agentId || agent.id,
            name: agent.name,
            status: this._mapAgentStatus(agent.status),
            sessions: agent.sessions || [],
            framework: 'openclaw'
          });
        }
      }

      return agents;
    } catch (err) {
      console.error('[OpenClawAdapter] listAgents error:', err);
      return [];
    }
  }

  /**
   * 获取单个 Agent 状态
   * @param {string} agentId
   */
  async getAgentStatus(agentId) {
    const agents = await this.listAgents();
    return agents.find(a => a.id === agentId) || null;
  }

  // ===== 消息发送 =====

  /**
   * 发送消息给 Agent
   * @param {string} agentId - Agent session key
   * @param {Object} message - 统一消息格式
   * @returns {Promise<{ success: boolean, messageId: string }>}
   */
  async send(agentId, message) {
    if (!this.connected) {
      throw new Error('Not connected to OpenClaw Gateway');
    }

    // 构建发送给 Agent 的消息内容
    const agentMessage = this._formatAgentMessage(message);

    // 通过 sessions_send 发送
    const result = await this._rpcCall('sessions', 'send', {
      sessionKey: agentId,
      message: JSON.stringify(agentMessage)
    });

    return {
      success: true,
      messageId: result?.messageId || `msg_${Date.now()}`
    };
  }

  /**
   * 流式发送消息（如果支持）
   * @param {string} agentId
   * @param {Object} message
   * @param {Function} onChunk - 收到片段时的回调
   */
  streamSend(agentId, message, onChunk) {
    if (!this.connected) {
      throw new Error('Not connected to OpenClaw Gateway');
    }

    const agentMessage = this._formatAgentMessage(message);

    // 注册流式回调
    const callbackId = `stream_${Date.now()}`;
    this.on(callbackId, onChunk);

    // 发送（实际实现取决于 OpenClaw 是否支持 streaming）
    this.send(agentId, message).then(result => {
      // 流式结束
      this.removeListener(callbackId, onChunk);
    }).catch(err => {
      this.removeListener(callbackId, onChunk);
      onChunk({ error: err.message });
    });
  }

  // ===== 消息解析 =====

  /**
   * 解析 OpenClaw 回调为统一格式
   * @param {Object} raw - 原始回调数据
   * @returns {Object} 统一回调格式
   */
  parse(raw) {
    if (!raw) return null;

    const type = raw.type || raw.event || 'task_complete';
    const parsed = {
      messageId: raw.messageId || raw.id,
      type: this._mapCallbackType(type),
      taskId: raw.taskId || raw.task_id,
      jobId: raw.jobId || raw.job_id,
      stepIndex: raw.stepIndex || raw.step_index,
      agent: raw.agent || raw.from,
      result: {
        status: raw.result?.status || (raw.error ? 'failed' : 'completed'),
        output: raw.result?.output || raw.output || raw.content || raw.text,
        artifacts: raw.result?.artifacts || raw.artifacts || []
      },
      timestamp: raw.timestamp || raw.time || new Date().toISOString()
    };

    return parsed;
  }

  // ===== 私有方法 =====

  /**
   * RPC 调用 OpenClaw Gateway
   * @param {string} namespace - 命名空间 (gateway, sessions, etc.)
   * @param {string} method - 方法名
   * @param {Object} params - 参数
   */
  async _rpcCall(namespace, method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method: `${namespace}.${method}`,
        params
      };

      // 超时：30秒
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC call timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * 处理收到的 WebSocket 消息
   */
  _handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());

      // 处理 RPC 响应
      if (msg.id && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id);
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);

        if (msg.error) {
          pending.reject(new Error(msg.error.message || msg.error));
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      // 处理事件/回调（来自 agent 的主动消息）
      if (msg.type || msg.event) {
        const parsed = this.parse(msg);
        if (parsed) {
          this.emit('message', parsed);
          this.emit(msg.type || msg.event, parsed);
        }
      }

    } catch (err) {
      console.error('[OpenClawAdapter] Failed to parse message:', err);
    }
  }

  /**
   * 格式化发给 Agent 的消息
   */
  _formatAgentMessage(message) {
    const base = {
      type: message.type,
      timestamp: new Date().toISOString()
    };

    switch (message.type) {
      case 'task_assign':
        return {
          ...base,
          taskId: message.taskId,
          title: message.content?.title,
          description: message.content?.description,
          requirements: message.content?.requirements,
          deadline: message.content?.deadline
        };

      case 'workflow_step':
        return {
          ...base,
          jobId: message.jobId,
          taskId: message.taskId,
          stepIndex: message.stepIndex,
          totalSteps: message.totalSteps,
          title: message.content?.title,
          description: message.content?.description,
          context: message.content?.context
        };

      case 'workflow_start':
        return {
          ...base,
          jobId: message.jobId,
          initiator: message.initiator || 'dashboard'
        };

      case 'chat':
        return {
          ...base,
          content: message.content,
          chatId: message.chatId
        };

      default:
        return {
          ...base,
          content: message.content || message,
          taskId: message.taskId,
          jobId: message.jobId
        };
    }
  }

  /**
   * 映射 Agent 状态
   */
  _mapAgentStatus(status) {
    const map = {
      'online': 'online',
      'idle': 'idle',
      'busy': 'busy',
      'offline': 'offline'
    };
    return map[status?.toLowerCase()] || 'unknown';
  }

  /**
   * 映射回调类型
   */
  _mapCallbackType(type) {
    const map = {
      'task_complete': 'task_complete',
      'task_completed': 'task_complete',
      'workflow_step_complete': 'workflow_step_complete',
      'workflow_step_completed': 'workflow_step_complete',
      'workflow_complete': 'workflow_complete',
      'workflow_completed': 'workflow_complete',
      'error': 'error'
    };
    return map[type] || type || 'task_complete';
  }

  /**
   * 启动心跳保活
   */
  _startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  /**
   * 停止心跳
   */
  _stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 尝试重连
   */
  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[OpenClawAdapter] Max reconnect attempts reached');
      this.emit('disconnected');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[OpenClawAdapter] Reconnecting... attempt ${this.reconnectAttempts}`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error(`[OpenClawAdapter] Reconnect failed: ${err.message}`);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }
}

module.exports = OpenClawAdapter;
