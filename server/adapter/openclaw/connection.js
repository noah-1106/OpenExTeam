/**
 * OpenClaw Adapter - 连接管理模块
 * 处理WebSocket连接、握手、重连等
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const crypto = require('crypto');
const CredentialManager = require('./credentials');

// 协议版本
const PROTOCOL_VERSION = 3;
const CONNECTION_TIMEOUT = 15000;
const DEFAULT_RECONNECT_DELAY = 5000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10000;

class ConnectionManager extends EventEmitter {
  constructor({ url, name, gatewayToken = '', credentials, maxReconnectAttempts, reconnectDelay }) {
    super();
    this.url = url;
    this.name = name;
    this.gatewayToken = gatewayToken;
    this.credentials = credentials;
    this.maxReconnectAttempts = maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = reconnectDelay || DEFAULT_RECONNECT_DELAY;

    this.ws = null;
    this.connected = false;
    this.ready = false;
    this.reconnectAttempts = 0;
    this.sessionId = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.nonce = null;
    this.pairingRequested = false;
    this._connectResolve = null;
    this._connectReject = null;
    this._connectionTimer = null;
    this._reconnectTimeout = null;
    this._pairingResolve = null;
    this._pairingReject = null;
  }

  /**
   * 建立连接
   */
  async connect() {
    return new Promise(async (resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;
      try {
        await this._establishConnection();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 断开连接
   */
  async disconnect() {
    console.log(`[OpenClaw:${this.name}] Disconnecting and stopping reconnection...`);
    if (this._connectionTimer) {
      clearTimeout(this._connectionTimer);
      this._connectionTimer = null;
    }
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.ready = false;
    this.reconnectAttempts = 0;
  }

  /**
   * 建立WebSocket连接
   */
  _establishConnection() {
    return new Promise((resolve, reject) => {
      this._connectionTimer = setTimeout(() => {
        reject(new Error('Connection timeout - no connect.challenge received'));
      }, CONNECTION_TIMEOUT);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log(`[OpenClaw:${this.name}] WebSocket connected`);
      });

      this.ws.on('ping', () => {
        this.ws.pong();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._dispatchMessage(msg, { resolve, reject });
        } catch (err) {
          console.error(`[OpenClaw:${this.name}] Failed to parse message:`, err);
        }
      });

      this.ws.on('error', (err) => {
        if (this._connectionTimer) {
          clearTimeout(this._connectionTimer);
          this._connectionTimer = null;
        }
        console.error(`[OpenClaw:${this.name}] WebSocket error:`, err);
        // 不emit error防止崩溃
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.ready = false;
        console.log(`[OpenClaw:${this.name}] WebSocket disconnected`);
        this.emit('disconnected');

        // 如果适配器启用，尝试重连（不管有没有配对）
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this._attemptReconnect();
        }
      });
    });
  }

  /**
   * 分发消息
   */
  _dispatchMessage(msg, { resolve, reject }) {
    // connect.challenge - 发送connect请求
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      this.nonce = msg.payload?.nonce || msg.payload?.challenge;
      if (this._connectionTimer) {
        clearTimeout(this._connectionTimer);
        this._connectionTimer = null;
      }
      this._handleChallenge(msg.payload).then(resolve).catch(reject);
      return;
    }

    // connect响应
    if (msg.type === 'res' && (msg.method === 'connect' || (resolve && reject && !this.connected))) {
      this._handleConnectResponse(msg, resolve, reject);
      return;
    }

    // pairing响应
    if (msg.type === 'res' && msg.method === 'device.pair') {
      this._handlePairingResponse(msg);
      return;
    }

    // pairing批准事件
    if (msg.type === 'event' && (msg.event === 'pairing.approved' || msg.event === 'device.paired')) {
      this._handlePairingApproved(msg.payload);
      return;
    }

    // pairing等待事件
    if (msg.type === 'event' && (msg.event === 'pairing.pending' || msg.event === 'device.pairing')) {
      console.log(`[OpenClaw:${this.name}] Pairing pending approval...`);
      return;
    }

    // 其他消息
    this._handleMessage(msg);
  }

  /**
   * 处理connect.challenge
   */
  async _handleChallenge(payload) {
    const nonce = payload?.nonce || this.nonce || crypto.randomBytes(16).toString('hex');
    const signedAtMs = Date.now();
    // 只用用户填写的 gateway token
    const token = this.gatewayToken || '';

    console.log(`[OpenClaw:${this.name}] Token info - credentials.deviceToken: ${this.credentials.deviceToken ? 'SET' : 'NOT SET'}, gatewayToken: ${this.gatewayToken ? 'SET' : 'NOT SET'}, using token: ${token ? token.substring(0, 10) + '...' : 'NONE'}`);

    // 优先使用保存的权限范围
    const savedScopes = this.credentials.scopes;
    const scopes = savedScopes && savedScopes.length > 0 ? savedScopes : this.credentials.getDefaultScopes();

    console.log(`[OpenClaw:${this.name}] Using scopes:`, scopes);

    const signature = CredentialManager.signDevicePayload({
      deviceId: this.credentials.deviceId,
      clientId: 'gateway-client',
      clientMode: 'backend',
      role: 'operator',
      scopes,
      signedAtMs,
      token,
      nonce,
      platform: 'linux',
      deviceFamily: '',
      privateKeyPem: this.credentials.privateKeyPem
    });

    const connectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: { id: 'gateway-client', version: '1.0.0', platform: 'linux', mode: 'backend' },
      role: 'operator',
      scopes,
      auth: {},
      locale: 'zh-CN',
      userAgent: 'OpenExTeam-Dashboard/1.0.0',
      device: {
        id: this.credentials.deviceId,
        publicKey: this.credentials.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce
      }
    };

    if (token) {
      connectParams.auth = { token };
    }

    this._sendRaw({
      type: 'req',
      id: this._nextId(),
      method: 'connect',
      params: connectParams
    });

    console.log(`[OpenClaw:${this.name}] Sent connect request`);
  }

  /**
   * 处理connect响应
   */
  _handleConnectResponse(msg, resolve, reject) {
    if (msg.ok === undefined) {
      console.log(`[OpenClaw:${this.name}] Connect response missing ok, triggering pairing`);
      this._handlePairingRequired(resolve, reject);
      return;
    }

    if (msg.ok) {
      const protocol = msg.payload?.protocol;
      const auth = msg.payload?.auth;

      if (auth?.deviceToken) {
        this.credentials.deviceToken = auth.deviceToken;
        this.credentials.saveDeviceToken(auth.deviceToken);
      }

      this.sessionId = msg.id;
      this.connected = true;
      this.ready = true;
      this.reconnectAttempts = 0;
      this.pairingRequested = false;

      console.log(`[OpenClaw:${this.name}] Connected (protocol ${protocol})`);
      this.emit('connected');

      if (this._connectResolve) {
        this._connectResolve();
        this._connectResolve = null;
        this._connectReject = null;
      }
      return;
    }

    // 连接失败
    const error = msg.payload?.error || msg.error || msg.payload;
    const errorCode = msg.payload?.errorCode || (error?.code) || (typeof error === 'string' ? error : error?.message);
    const errorMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));

    console.log(`[OpenClaw:${this.name}] Connect failed: ${errorMessage}`);

    // 检查是否需要配对
    const msgLower = errorMessage.toLowerCase();
    const codeUpper = (errorCode || '').toUpperCase();
    const isPairingError =
      codeUpper.includes('NOT_PAIRED') ||
      codeUpper.includes('DEVICE_ID_MISMATCH') ||
      codeUpper.includes('DEVICE_NOT_PAIRED') ||
      codeUpper.includes('PAIRING_REQUIRED') ||
      codeUpper.includes('INVALID_REQUEST') ||
      msgLower.includes('device identity mismatch') ||
      msgLower.includes('not paired') ||
      msgLower.includes('pairing required') ||
      msgLower.includes('unknown requestid');

    if (isPairingError) {
      console.log(`[OpenClaw:${this.name}] Device needs pairing`);
      this._handlePairingRequired(resolve, reject);
      return;
    }

    if (this._connectReject) {
      this._connectReject(new Error(errorMessage));
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  /**
   * 处理需要配对的情况
   */
  _handlePairingRequired(resolve, reject) {
    console.log(`[OpenClaw:${this.name}] Initiating pairing flow...`);

    const signedAtMs = Date.now();
    const nonce = this.nonce || crypto.randomBytes(16).toString('hex');
    const token = this.credentials.deviceToken || this.gatewayToken || '';
    const scopes = this.credentials.getDefaultScopes();

    const signature = CredentialManager.signDevicePayload({
      deviceId: this.credentials.deviceId,
      clientId: 'cli',
      clientMode: 'cli',
      role: 'operator',
      scopes,
      signedAtMs,
      token,
      nonce,
      platform: 'linux',
      deviceFamily: '',
      privateKeyPem: this.credentials.privateKeyPem
    });

    // 发送配对请求给Gateway
    this._sendDevicePairRequest();

    // 立即显示提示，让用户去Gateway用list查看
    this.emit('pairing_required', {
      deviceId: this.credentials.deviceId,
      requestId: this.credentials.deviceId,
      message: `请在Gateway端执行：openclaw devices list 查看请求，找到 Device ID 为 ${this.credentials.deviceId} 的那条，然后用 openclaw devices approve <requestId> 批准`,
      signature,
      nonce,
      signedAt: signedAtMs
    });

    if (reject) {
      reject(new Error('PAIRING_REQUIRED'));
    }
    this._connectResolve = null;
    this._connectReject = null;
  }

  /**
   * 发送配对请求
   */
  _sendDevicePairRequest() {
    if (this.pairingRequested) {
      console.log(`[OpenClaw:${this.name}] Pairing already requested`);
      return null;
    }
    this.pairingRequested = true;

    const signedAtMs = Date.now();
    const nonce = this.nonce || crypto.randomBytes(16).toString('hex');
    const token = this.credentials.deviceToken || this.gatewayToken || '';
    const scopes = this.credentials.getDefaultScopes();

    const signature = CredentialManager.signDevicePayload({
      deviceId: this.credentials.deviceId,
      clientId: 'cli',
      clientMode: 'cli',
      role: 'operator',
      scopes,
      signedAtMs,
      token,
      nonce,
      platform: 'linux',
      deviceFamily: '',
      privateKeyPem: this.credentials.privateKeyPem
    });

    const requestId = this._nextId();
    const pairRequest = {
      type: 'req',
      id: requestId,
      method: 'device.pair',
      params: {
        device: {
          id: this.credentials.deviceId,
          displayName: `OpenExTeam Dashboard - ${this.name}`,
          publicKey: this.credentials.publicKey,
          signature,
          signedAt: signedAtMs,
          nonce
        },
        role: 'operator',
        scopes
      }
    };

    this._sendRaw(pairRequest);
    console.log(`[OpenClaw:${this.name}] Sent pairing request for: ${this.credentials.deviceId}, requestId: ${requestId}`);
    return requestId;
  }

  /**
   * 处理配对响应
   */
  _handlePairingResponse(msg) {
    if (msg.ok) {
      const status = msg.payload?.status;
      if (status === 'approved' || status === 'paired') {
        console.log(`[OpenClaw:${this.name}] Pairing approved!`);
        this._handlePairingApproved(msg.payload);
        if (this._pairingResolve) {
          this._pairingResolve();
          this._pairingResolve = null;
          this._pairingReject = null;
        }
      } else {
        // 拿到Gateway真正的Request ID！
        const requestId = msg.payload?.requestId || msg.payload?.id || this.credentials.deviceId;
        console.log(`[OpenClaw:${this.name}] Pairing pending, requestId: ${requestId}`);

        const signedAtMs = Date.now();
        const nonce = this.nonce || crypto.randomBytes(16).toString('hex');
        const token = this.credentials.deviceToken || this.gatewayToken || '';
        const scopes = this.credentials.getDefaultScopes();

        const signature = CredentialManager.signDevicePayload({
          deviceId: this.credentials.deviceId,
          clientId: 'cli',
          clientMode: 'cli',
          role: 'operator',
          scopes,
          signedAtMs,
          token,
          nonce,
          platform: 'linux',
          deviceFamily: '',
          privateKeyPem: this.credentials.privateKeyPem
        });

        // 发送真正的Request ID给前端！
        this.emit('pairing_required', {
          deviceId: this.credentials.deviceId,
          requestId,
          message: `请在Gateway端执行: openclaw devices approve ${requestId}`,
          signature,
          nonce,
          signedAt: signedAtMs
        });

        // 现在可以reject connect了，让重连逻辑接管
        if (this._pairingReject) {
          this._pairingReject(new Error('PAIRING_REQUIRED'));
          this._pairingResolve = null;
          this._pairingReject = null;
        }
      }
    } else {
      const error = msg.payload?.error || msg.error;
      console.error(`[OpenClaw:${this.name}] Pairing failed:`, error);
      if (this._pairingReject) {
        this._pairingReject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
        this._pairingResolve = null;
        this._pairingReject = null;
      }
    }
  }

  /**
   * 处理配对批准事件
   */
  _handlePairingApproved(payload) {
    console.log(`[OpenClaw:${this.name}] Pairing approved event received`);
    if (payload?.token || payload?.deviceToken) {
      const token = payload.token || payload.deviceToken;
      this.credentials.deviceToken = token;
      const actualDeviceId = payload.deviceId || this.credentials.deviceId;

      if (payload.deviceId && payload.deviceId !== this.credentials.deviceId) {
        console.log(`[OpenClaw:${this.name}] Device ID updated to: ${payload.deviceId}`);
        this.credentials.deviceId = payload.deviceId;
      }

      this.credentials.saveDeviceToken(token, actualDeviceId);
      this.emit('pairing_complete', { deviceId: actualDeviceId, token });

      // 重新连接
      setTimeout(() => {
        this.connect().catch((err) => {
          console.error(`[OpenClaw:${this.name}] Reconnect after pairing failed:`, err.message);
        });
      }, 1000);
    }
  }

  /**
   * 处理通用消息
   */
  _handleMessage(msg) {
    // RPC响应
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id);
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(msg.id);

      if (msg.error || !msg.ok) {
        const error = msg.error || msg.payload?.error || new Error('Request failed');
        console.error(`[OpenClaw:${this.name}] RPC failed:`, error);
        pending.reject(new Error(error.message || JSON.stringify(error)));
      } else {
        pending.resolve(msg.payload || msg.result);
      }
      return;
    }

    // Gateway事件
    if (msg.type === 'event') {
      this.emit('gateway_event', msg);

      // chat事件
      if (msg.event === 'chat' && msg.payload?.message) {
        const parsed = this._parseChatEvent(msg.payload);
        if (parsed) this.emit('message', parsed);
      }
    }
  }

  /**
   * 解析chat事件
   */
  _parseChatEvent(payload) {
    if (!payload?.message) return null;
    const msg = payload.message;

    // Extract text content and detect tool usage from content array
    const contentItems = msg.content || [];
    const textParts = [];
    let hasToolUse = false;

    for (const item of contentItems) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
      } else if (item.type === 'tool_use' || item.type === 'tool_result') {
        hasToolUse = true;
      }
    }

    // If all content is tool-related (no text), skip emitting as chat message
    if (hasToolUse && textParts.length === 0) {
      return null;
    }

    const content = textParts.join('');
    if (!content) return null;

    return {
      messageId: payload.runId || payload.seq,
      type: hasToolUse ? 'tool_chat' : 'chat',
      agent: `${this.name}:${this._extractAgentId(payload.sessionKey)}`,
      content,
      timestamp: msg.timestamp || new Date().toISOString(),
      sessionKey: payload.sessionKey,
      state: payload.state
    };
  }

  /**
   * 从sessionKey提取agentId
   */
  _extractAgentId(sessionKey) {
    if (!sessionKey) return 'unknown';
    const match = sessionKey.match(/^agent:([^:]+):/);
    return match ? match[1] : 'unknown';
  }

  /**
   * 发送RPC请求
   */
  async rpcCall(namespace, method, params = {}, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.ready) {
        reject(new Error('WebSocket not ready'));
        return;
      }

      const id = this._nextId();
      const fullMethod = namespace ? `${namespace}.${method}` : method;
      const request = { type: 'req', id, method: fullMethod, params };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${fullMethod}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      console.log(`[OpenClaw:${this.name}] RPC: ${fullMethod}`);
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * 发送原始消息
   */
  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /**
   * 生成下一个请求ID
   */
  _nextId() {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * 尝试重连
   */
  _attemptReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
    console.log(`[OpenClaw:${this.name}] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this._reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}

module.exports = ConnectionManager;
