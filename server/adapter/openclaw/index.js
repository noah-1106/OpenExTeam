/**
 * OpenClaw Adapter - 新版模块化实现
 *
 * 跨框架AI Agent团队可视化协作平台
 * OpenClaw Gateway适配器
 */

const EventEmitter = require('events');
const CredentialManager = require('./credentials');
const ConnectionManager = require('./connection');

class OpenClawAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'openclaw';
    this.url = config.url || 'ws://127.0.0.1:9999';
    this.gatewayToken = config.token || process.env.GATEWAY_TOKEN || '';
    console.log(`[OpenClaw:${this.name}] Initialized with token: ${this.gatewayToken ? this.gatewayToken.substring(0, 10) + '...' : 'NONE'}`);
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10000;
    this.reconnectDelay = config.reconnectDelay || 5000;

    // 初始化凭证管理器
    this.credentialManager = new CredentialManager(this.name);

    // 加载凭证
    this.credentials = this.credentialManager.loadOrCreateDeviceCredentials();
    this.credentials.deviceToken = this.credentialManager.loadDeviceToken();
    this.credentials.scopes = this.credentialManager.loadDeviceScopes();
    this.credentials.getDefaultScopes = () => this.credentialManager.getDefaultScopes();
    this.credentials.getFullScopes = () => this.credentialManager.getFullScopes();
    this.credentials.saveDeviceToken = (token, deviceId) =>
      this.credentialManager.saveDeviceToken(token, deviceId);

    // 连接管理器会稍后初始化
    this.connectionManager = null;
  }

  /**
   * 连接到Gateway
   */
  async connect() {
    // 自动修复URL协议
    let url = this.url;
    if (url && url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
      console.log(`[OpenClaw:${this.name}] Auto-converted URL: ${url}`);
    }
    if (url && url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
      console.log(`[OpenClaw:${this.name}] Auto-converted URL: ${url}`);
    }

    // 创建连接管理器
    this.connectionManager = new ConnectionManager({
      url,
      name: this.name,
      gatewayToken: this.gatewayToken,
      credentials: this.credentials,
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectDelay: this.reconnectDelay
    });

    // 转发事件
    this.connectionManager.on('connected', () => this.emit('connected'));
    this.connectionManager.on('disconnected', () => this.emit('disconnected'));
    this.connectionManager.on('message', (msg) => this.emit('message', msg));
    this.connectionManager.on('gateway_event', (evt) => this.emit('gateway_event', evt));
    this.connectionManager.on('pairing_required', (data) => this.emit('pairing_required', data));
    this.connectionManager.on('pairing_complete', (data) => this.emit('pairing_complete', data));

    try {
      await this.connectionManager.connect();
    } catch (err) {
      // 不直接抛出错误，允许通过pairing_required事件处理
      if (err.message !== 'PAIRING_REQUIRED') {
        throw err;
      }
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.connectionManager) {
      await this.connectionManager.disconnect();
    }
    // 注意：不要清理事件监听器，因为还要复用实例！
    // 事件监听器由 index.js 管理，只在创建实例时注册一次
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return this.connectionManager?.connected && this.connectionManager?.ready;
  }

  /**
   * 获取Agent列表
   */
  async listAgents() {
    try {
      if (this.connectionManager?.connected && this.connectionManager?.ready) {
        const result = await this.connectionManager.rpcCall('agents', 'list', {}, 120000);
        if (result && Array.isArray(result.agents) && result.agents.length > 0) {
          const mappedAgents = result.agents.map(agent => ({
            id: agent.id,
            name: agent.name || agent.id,
            status: 'online',
            sessions: [],
            framework: 'openclaw',
            connected: true
          }));
          return mappedAgents;
        }
      }
    } catch (err) {
      console.warn(`[OpenClaw:${this.name}] Failed to list agents:`, err.message);
    }
    return [];
  }

  /**
   * 获取Agent状态
   */
  async getAgentStatus(agentId) {
    const agents = await this.listAgents();
    const cleanAgentId = agentId.includes(':') ? agentId.split(':').slice(1).join(':') : agentId;
    return agents.find(a => a.id === agentId || a.id === `${this.name}:${cleanAgentId}`) || null;
  }

  /**
   * 发送消息给Agent
   */
  async send(agentId, message) {
    if (!this.connectionManager?.ready) {
      throw new Error(`[OpenClaw:${this.name}] Not connected to Gateway`);
    }

    const agentMessage = this._formatAgentMessage(message);
    const gatewayAgentId = agentId.includes(':') ? agentId.split(':').slice(1).join(':') : agentId;
    const sessionName = 'openexteam';
    const sessionKey = `agent:${gatewayAgentId}:${sessionName}`;

    // 创建会话（如果不存在）
    try {
      await this.connectionManager.rpcCall('sessions', 'create', {
        key: sessionKey,
        agentId: gatewayAgentId,
        label: 'OpenExTeam Dashboard'
      }, 10000);
      console.log(`[OpenClaw:${this.name}] Session ready: ${sessionKey}`);
    } catch (createErr) {
      const errMsg = createErr.message || String(createErr);
      if (!errMsg.toLowerCase().includes('already exists') &&
          !errMsg.toLowerCase().includes('duplicate')) {
        console.log(`[OpenClaw:${this.name}] Session create warning: ${errMsg}`);
      }
    }

    // 发送消息
    try {
      const result = await this.connectionManager.rpcCall('sessions', 'send', {
        key: sessionKey,
        message: JSON.stringify(agentMessage),
        idempotencyKey: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
      }, 30000);

      return {
        success: true,
        runId: result?.runId,
        messageId: result?.messageId || `msg_${Date.now()}`
      };
    } catch (sendErr) {
      console.error(`[OpenClaw:${this.name}] Send failed:`, sendErr.message);
      return { success: false, error: sendErr.message };
    }
  }

  /**
   * 格式化Agent消息
   */
  _formatAgentMessage(message) {
    const base = { type: message.type, timestamp: new Date().toISOString() };
    switch (message.type) {
      case 'task_assign':
        return { ...base, taskId: message.taskId, ...message.content };
      case 'workflow_step':
        return { ...base, jobId: message.jobId, taskId: message.taskId, stepIndex: message.stepIndex, ...message.content };
      case 'chat':
        return { ...base, content: message.content, chatId: message.chatId };
      default:
        return { ...base, ...message };
    }
  }

  /**
   * 解析消息（保持向后兼容）
   */
  parse(raw) {
    if (!raw) return null;
    return {
      messageId: raw.messageId || raw.id,
      type: raw.type || 'task_complete',
      taskId: raw.taskId,
      jobId: raw.jobId,
      agent: raw.agent || raw.from,
      result: raw.result || { status: 'completed' },
      timestamp: raw.timestamp || new Date().toISOString()
    };
  }

  /**
   * 检查是否已配对
   */
  isDevicePaired() {
    return !!this.credentials.deviceToken;
  }

  /**
   * 获取设备ID
   */
  getDeviceId() {
    return this.credentials.deviceId;
  }

  /**
   * 重置配对状态
   */
  async resetPairing() {
    this.credentials.deviceToken = null;
    this.pairingRequested = false;
    this.credentialManager.clearAllCredentials();
    await this.disconnect();
    console.log(`[OpenClaw:${this.name}] Pairing reset`);
  }
}

module.exports = OpenClawAdapter;
