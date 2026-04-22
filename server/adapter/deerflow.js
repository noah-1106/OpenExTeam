/**
 * DeerFlow Agent Adapter
 *
 * 根据 API-RESEARCH.md 中的技术调研实现：
 * - 连接方式：HTTP REST API
 * - 默认端口：2026
 * - Agent 架构：单 agent + 动态 sub-agents
 * - API endpoints: /api/health, /api/chat, /api/threads, /api/skills 等
 *
 * GitHub：https://github.com/bytedance/deer-flow
 */

const http = require('http');
const EventEmitter = require('events');

class DeerFlowAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = 'deerflow';
    this.version = '1.0.0';
    this.baseUrl = config.url || 'http://127.0.0.1:2026';
    this.apiKey = config.token || null;
    this.connected = false;
    this.ready = false;
    this._connectResolve = null;
    this._connectReject = null;

    // 解析 baseUrl
    try {
      const url = new URL(this.baseUrl);
      this.hostname = url.hostname;
      this.port = url.port || 80;
      this.pathname = url.pathname || '';
    } catch {
      this.hostname = '127.0.0.1';
      this.port = 2026;
      this.pathname = '';
    }
  }

  /**
   * 连接到 DeerFlow
   */
  async connect() {
    return new Promise(async (resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;

      try {
        const health = await this._getHealth();
        if (!health) {
          throw new Error('DeerFlow health check failed');
        }

        this.connected = true;
        this.ready = true;
        console.log('[DeerFlowAdapter] Connected successfully');
        this.emit('connected');
        resolve();
      } catch (err) {
        console.error('[DeerFlowAdapter] Connection failed:', err.message);
        this.emit('error', err);
        reject(err);
      }
    });
  }

  /**
   * HTTP 请求辅助方法
   */
  async _request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: this.pathname + path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加 API Key 如果存在
      if (this.apiKey) {
        options.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const result = body ? JSON.parse(body) : { ok: true };
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.setTimeout(30000, () => {
        req.destroy(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * GET 请求
   */
  async _get(path) {
    return this._request('GET', path);
  }

  /**
   * POST 请求
   */
  async _post(path, data) {
    return this._request('POST', path, data);
  }

  /**
   * DELETE 请求
   */
  async _delete(path) {
    return this._request('DELETE', path);
  }

  /**
   * 健康检查
   */
  async _getHealth() {
    try {
      const result = await this._get('/api/health');
      return result;
    } catch (err) {
      console.warn('[DeerFlowAdapter] Health check failed:', err.message);
      return null;
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    this.connected = false;
    this.ready = false;
    this.emit('disconnected');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.connected || !this.ready) {
      return false;
    }
    const health = await this._getHealth();
    return health !== null;
  }

  // ===== Agent 操作 =====

  /**
   * 列出 Agents
   * DeerFlow 是单 agent 架构，通过 skills 扩展能力
   * 我们将 skills 作为 "agents" 列出，或者返回单个 agent
   */
  async listAgents() {
    try {
      const skills = await this._listSkills();
      const isConnected = this.connected && this.ready;

      // 主 agent
      const agents = [{
        id: 'deerflow-main',
        name: 'DeerFlow Agent',
        status: isConnected ? 'online' : 'offline',
        connected: isConnected,
        framework: 'deerflow',
        isDefault: true,
        skills: skills
      }];

      return agents;
    } catch (err) {
      console.error('[DeerFlowAdapter] Failed to list agents:', err.message);

      // 返回默认的单个 agent
      const isConnected = this.connected && this.ready;
      return [{
        id: 'deerflow-main',
        name: 'DeerFlow Agent',
        status: isConnected ? 'online' : 'offline',
        connected: isConnected,
        framework: 'deerflow',
        isDefault: true
      }];
    }
  }

  /**
   * 列出 skills
   */
  async _listSkills() {
    try {
      const result = await this._get('/api/skills');
      return result.skills || result || [];
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to list skills:', err.message);
      return [];
    }
  }

  /**
   * 列出模型
   */
  async _listModels() {
    try {
      const result = await this._get('/api/models');
      return result.models || result || [];
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to list models:', err.message);
      return [];
    }
  }

  /**
   * 获取 Agent 状态
   */
  async getAgentStatus(agentId) {
    const agents = await this.listAgents();
    return agents.find(a => a.id === agentId) || null;
  }

  // ===== 消息发送 =====

  /**
   * 发送消息给 Agent
   */
  async send(agentId, message) {
    if (!this.ready) {
      throw new Error("DeerFlow not connected");
    }

    const content = typeof message === 'string' ? message : message.content || message.text;
    if (!content) {
      throw new Error("Message content is required");
    }

    try {
      // 确定执行模式
      const mode = message.mode || 'standard'; // flash, standard, pro, ultra

      // 创建或获取 thread
      const threadId = message.threadId || await this._createThread();

      // 发送聊天消息
      const result = await this._sendChat(threadId, content, mode);

      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        threadId: threadId,
        result: result
      };
    } catch (err) {
      console.error('[DeerFlowAdapter] Failed to send message:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * 创建新 thread
   */
  async _createThread() {
    try {
      const result = await this._post('/api/threads', {});
      return result.threadId || result.id || `thread_${Date.now()}`;
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to create thread, using temporary:', err.message);
      return `thread_${Date.now()}`;
    }
  }

  /**
   * 发送聊天消息
   */
  async _sendChat(threadId, message, mode = 'standard') {
    const payload = {
      message: message,
      thread_id: threadId,
      mode: mode
    };

    const result = await this._post('/api/chat', payload);

    // 发送消息事件
    const responseMessage = {
      type: 'chat',
      from: 'deerflow-main',
      content: result.response || result.message || result.content || JSON.stringify(result),
      timestamp: new Date().toISOString(),
      threadId: threadId
    };
    this.emit('message', responseMessage);

    return result;
  }

  // ===== 会话管理 =====

  /**
   * 列出 threads
   */
  async listSessions() {
    try {
      const result = await this._get('/api/threads');
      const threads = result.threads || result || [];
      return threads.map(thread => ({
        id: thread.id || thread.threadId,
        name: thread.name || thread.title || `Thread ${thread.id}`,
        updatedAt: thread.updatedAt || thread.last_message_time
      }));
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to list threads:', err.message);
      return [];
    }
  }

  /**
   * 获取 thread 历史
   */
  async getThreadHistory(threadId) {
    try {
      const result = await this._get(`/api/threads/${threadId}`);
      return result;
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to get thread history:', err.message);
      return null;
    }
  }

  /**
   * 删除 thread
   */
  async deleteThread(threadId) {
    try {
      await this._delete(`/api/threads/${threadId}`);
      return true;
    } catch (err) {
      console.warn('[DeerFlowAdapter] Failed to delete thread:', err.message);
      return false;
    }
  }

  /**
   * 上传文件到 thread
   */
  async uploadFile(threadId, filePath) {
    // DeerFlow 支持文件上传，但需要 multipart/form-data
    // 这里简化实现，将来可以扩展
    console.warn('[DeerFlowAdapter] File upload not fully implemented yet');
    return { success: false, error: 'Not implemented' };
  }

  // ===== 解析消息 =====

  /**
   * 解析原始消息
   */
  parse(raw) {
    if (!raw) return null;
    return {
      messageId: raw.messageId || raw.id || `msg_${Date.now()}`,
      type: raw.type || 'chat',
      taskId: raw.taskId,
      jobId: raw.jobId,
      agent: raw.agent || raw.from || 'deerflow-main',
      content: raw.content || raw.response || raw.message || raw.result || raw,
      timestamp: raw.timestamp || new Date().toISOString(),
      threadId: raw.threadId
    };
  }
}

module.exports = DeerFlowAdapter;
