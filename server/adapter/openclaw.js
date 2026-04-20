/**
 * OpenClaw Adapter - 标准 Gateway 协议实现（含设备配对流程）
 *
 * 遵循 OpenClaw Gateway WebSocket 协议规范：
 * - 握手：connect.challenge → connect → hello-ok
 * - 角色：operator（控制台模式）
 * - 支持作用域：operator.read, operator.write, operator.pairing
 *
 * 设备配对流程：
 * 1. 加载或生成设备凭证（存储在 ~/.openclaw/identity/）
 * 2. 连接时发送 device 身份信息
 * 3. 如果收到 NOT_PAIRED 错误 → 发起配对请求
 * 4. 轮询配对状态直至批准
 * 5. 批准后获取 device token 并存储
 * 6. 后续连接直接使用 device token 认证
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const IDENTITY_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'identity');

// ===== 设备凭证管理 =====

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * 从 PEM 格式提取原始公钥（去掉 SPKI 前缀）
 */
function derivePublicKeyRaw(publicKeyPem) {
  const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 && spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

/**
 * 使用与 OpenClaw Gateway 相同的算法计算设备 ID
 * deviceId = SHA256(raw_public_key).hex
 */
function computeDeviceId(publicKeyPem) {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * 生成 ECDH 密钥对（用于设备身份）
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Ed25519 签名设备认证 payload
 * payload 格式: v3|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<signedAtMs>|<token>|<nonce>|<platform>|<deviceFamily>
 */
function signDevicePayload(deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce, platform, deviceFamily, privateKeyPem) {
  const payload = [
    'v3',
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(','),
    String(signedAtMs),
    token || '',
    nonce,
    platform || '',
    deviceFamily || ''
  ].join('|');
  
  console.log('[OpenClawAdapter] Signature payload:', payload);
  
  // 使用 Ed25519 签名 (Node.js crypto 自动选择算法)
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8'
  });
  
  // Ed25519 signing
  const signature = crypto.sign(null, Buffer.from(payload), privateKey);
  return signature.toString('base64url');
}

/**
 * 获取或创建设户凭证
 */
function loadOrCreateDeviceCredentials() {
  // 确保目录存在
  if (!fs.existsSync(IDENTITY_DIR)) {
    fs.mkdirSync(IDENTITY_DIR, { recursive: true });
  }

  const deviceJsonPath = path.join(IDENTITY_DIR, 'device.json');
  const privateKeyPath = path.join(IDENTITY_DIR, 'device-private.pem');
  const deviceAuthPath = path.join(IDENTITY_DIR, 'device-auth.json');

  // FIRST: 检查 device-auth.json 是否有已配对的设备（优先使用）
  if (fs.existsSync(deviceAuthPath)) {
    try {
      const authData = JSON.parse(fs.readFileSync(deviceAuthPath, 'utf-8'));
      if (authData.deviceId && authData.tokens?.operator?.token) {
        // 有已配对的设备，检查是否有完整的密钥对
        if (fs.existsSync(deviceJsonPath) && fs.existsSync(privateKeyPath)) {
          const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf-8'));
          const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
          const deviceId = authData.deviceId;  // 使用 auth.json 中的实际配对 ID
          const publicKey = deviceData.publicKeyPem || deviceData.publicKey;
          
          if (publicKey && privateKey) {
            console.log(`[OpenClawAdapter] Using paired device from device-auth.json: ${deviceId}`);
            return { deviceId, publicKey, privateKey, privateKeyPem: privateKey };
          }
        }
      }
    } catch (err) {
      console.warn('[OpenClawAdapter] Failed to load from device-auth.json:', err.message);
    }
  }

  // SECOND: 检查 device.json 是否有本地凭证
  if (fs.existsSync(deviceJsonPath) && fs.existsSync(privateKeyPath)) {
    try {
      const deviceData = JSON.parse(fs.readFileSync(deviceJsonPath, 'utf-8'));
      let publicKey = deviceData.publicKeyPem || deviceData.publicKey;
      let privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
      
      if (!publicKey || !privateKey) throw new Error('Missing device fields');
      
      // 使用与 OpenClaw 相同的算法计算 deviceId
      const deviceId = computeDeviceId(publicKey);
      console.log(`[OpenClawAdapter] Loaded existing device credentials: ${deviceId}`);
      return { deviceId, publicKey, privateKey, privateKeyPem: privateKey };
    } catch (err) {
      console.warn('[OpenClawAdapter] Failed to load device credentials, regenerating:', err.message);
    }
  }

  // 生成新凭证（使用与 OpenClaw 相同的 deviceId 算法）
  const keys = generateKeyPair();
  const publicKey = keys.publicKey;
  const privateKey = keys.privateKey;

  // 使用与 OpenClaw Gateway 相同的算法计算 deviceId
  const deviceId = computeDeviceId(publicKey);

  // 存储
  fs.writeFileSync(deviceJsonPath, JSON.stringify({ version: 1, deviceId, publicKeyPem: publicKey, privateKeyPem: privateKey }, null, 2));
  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  console.log(`[OpenClawAdapter] Generated new device credentials: ${deviceId}`);

  return { deviceId, publicKey, privateKey, privateKeyPem: privateKey };
}

/**
 * 加载已批准的设备 token
 */
function loadDeviceToken() {
  const tokenPath = path.join(IDENTITY_DIR, 'device-auth.json');
  if (fs.existsSync(tokenPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      return data.tokens?.operator?.token || data.token || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 加载已批准的设备 scopes
 */
function loadDeviceScopes() {
  const tokenPath = path.join(IDENTITY_DIR, 'device-auth.json');
  if (fs.existsSync(tokenPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      return data.tokens?.operator?.scopes || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 保存设备 token
 */
function saveDeviceToken(token, deviceId) {
  const tokenPath = path.join(IDENTITY_DIR, 'device-auth.json');
  try {
    // 读取现有数据，保留 deviceId
    let existingData = {};
    if (fs.existsSync(tokenPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      } catch {}
    }
    
    const data = {
      version: 1,
      deviceId: deviceId || existingData.deviceId,
      tokens: {
        operator: {
          token: token,
          role: 'operator',
          scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.pairing', 'operator.talk.secrets', 'operator.approvals'],
          updatedAtMs: Date.now()
        }
      }
    };
    
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
    console.log('[OpenClawAdapter] Device token and deviceId saved');
  } catch (err) {
    console.error('[OpenClawAdapter] Failed to save device token:', err.message);
  }
}

// ===== 主适配器类 =====

class OpenClawAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = 'openclaw';
    this.version = '1.0.0';
    this.url = config.url || 'ws://127.0.0.1:18789';
    this.gatewayToken = config.token || process.env.GATEWAY_TOKEN || '';
    this.ws = null;
    this.connected = false;
    this.ready = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 3000;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.protocolVersion = 3;
    this.sessionId = null;

    // 设备配对相关
    this.device = null;           // { id, publicKey, privateKey }
    this.deviceToken = null;      // 配对成功后获取的 token
    this.isPaired = false;        // 配对是否已完成
    this.pairingRequested = false; // 是否已发起配对请求
    this.nonce = null;            // 连接挑战的 nonce
    this._connectResolve = null;
    this._connectReject = null;
  }

  // ===== 连接管理 =====

  /**
   * 完整连接流程：
   * 1. 加载设备凭证
   * 2. 建立 WebSocket 连接
   * 3. 处理 connect.challenge
   * 4. 发送 connect 请求
   * 5. 如果 NOT_PAIRED → 发起配对 → 重试连接
   */
  async connect() {
    // Step 1: 加载设备凭证
    if (!this.device) {
      this.device = loadOrCreateDeviceCredentials();
      this.deviceToken = loadDeviceToken();
      this.isPaired = !!this.deviceToken;
    }

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
   * 建立 WebSocket 连接并处理握手
   */
  async _establishConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout (no connect.challenge received)'));
      }, 15000);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log(`[OpenClawAdapter] WebSocket opened to ${this.url}`);
      });

      // Handle ping/pong for connection keepalive
      this.ws.on('ping', () => {
        this.ws.pong();
      });
      this.ws.on('pong', () => {
        // Connection alive, no action needed
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._dispatchMessage(msg, { timeout, resolve, reject });
        } catch (err) {
          console.error('[OpenClawAdapter] Failed to parse message:', err);
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[OpenClawAdapter] WebSocket error: ${err.message}`);
        this.emit('error', err);
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.ready = false;
        this._stopHeartbeat();
        console.log('[OpenClawAdapter] Disconnected');
        this.emit('disconnected');
        if (this.isPaired && this.reconnectAttempts < this.maxReconnectAttempts) {
          this._attemptReconnect();
        }
      });
    });
  }

  /**
   * 根据消息类型分发处理
   */
  _dispatchMessage(msg, { timeout, resolve, reject }) {
    // connect.challenge → 发送 connect 请求
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      this.nonce = msg.payload?.nonce || msg.payload?.challenge;
      clearTimeout(timeout);
      this._handleChallenge(msg.payload).then(resolve).catch(reject);
      return;
    }

    // connect 响应 (only when it's actually connect method or during initial connection)
    if (msg.type === 'res' && (msg.method === 'connect' || (resolve && reject && !this.connected))) {
      this._handleConnectResponse(msg, resolve, reject);
      return;
    }

    // pairing 相关响应
    if (msg.type === 'res' && msg.method === 'device.pair') {
      this._handlePairingResponse(msg);
      return;
    }

    // pairing.approved 事件
    if (msg.type === 'event' && (msg.event === 'pairing.approved' || msg.event === 'device.paired')) {
      this._handlePairingApproved(msg.payload);
      return;
    }

    // pairing.pending 事件
    if (msg.type === 'event' && (msg.event === 'pairing.pending' || msg.event === 'device.pairing')) {
      console.log('[OpenClawAdapter] Pairing is pending approval...');
      return;
    }

    // 其他消息（RPC 响应或推送）
    this._handleMessage(msg);
  }

  /**
   * 处理 connect.challenge：构造并发送 connect 请求
   */
  async _handleChallenge(payload) {
    const { nonce } = payload || {};
    const nonceToSign = nonce || this.nonce || crypto.randomBytes(16).toString('hex');

    // 构造 device 签名信息
    const signedAtMs = Date.now();
    const token = this.deviceToken || this.gatewayToken || '';
    
    // 优先使用 device-auth.json 中保存的 scopes
    // 如果没有保存的 scopes，使用默认的（与配对请求一致的）scopes
    const savedScopes = loadDeviceScopes();
    const scopes = savedScopes && savedScopes.length > 0 
      ? savedScopes 
      : ['operator.read', 'operator.write', 'operator.pairing'];
    
    console.log('[OpenClawAdapter] Using scopes:', scopes);
    
    // 使用 Ed25519 签名 v3 payload
    // 注意：clientId 和 clientMode 必须与 connectParams.client 中的值一致
    const signature = signDevicePayload(
      this.device.deviceId,
      'gateway-client', // clientId
      'backend',        // clientMode
      'operator',     // role
      scopes,
      signedAtMs,
      token,
      nonceToSign,
      'linux',        // platform
      '',             // deviceFamily
      this.device.privateKeyPem
    );

    const connectParams = {
      minProtocol: this.protocolVersion,
      maxProtocol: this.protocolVersion,
      client: {
        id: 'gateway-client',
        version: '1.0.0',
        platform: 'linux',
        mode: 'backend'
      },
      role: 'operator',
      scopes: scopes,
      auth: {},
      locale: 'zh-CN',
      userAgent: 'OpenExTeam-Dashboard/1.0.0',
      device: {
        id: this.device.deviceId,
        publicKey: this.device.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce: nonceToSign
      }
    };

    // 如果有 gateway token 或 device token，加上 auth
    if (this.deviceToken) {
      connectParams.auth = { token: this.deviceToken };
    } else if (this.gatewayToken) {
      connectParams.auth = { token: this.gatewayToken };
    }

    this._sendRaw({
      type: 'req',
      id: this._nextId(),
      method: 'connect',
      params: connectParams
    });

    console.log('[OpenClawAdapter] Sent connect request with device credentials');
  }

  /**
   * 处理 connect 响应
   */
  _handleConnectResponse(msg, resolve, reject) {
    // 如果响应没有 ok 字段，说明可能连接失败了（可能是 device identity mismatch）
    if (msg.ok === undefined) {
      console.log('[OpenClawAdapter] Connect response missing ok field, treating as failure');
      // 触发配对请求
      this._handlePairingRequired(resolve, reject);
      return;
    }
    
    if (msg.ok) {
      const protocol = msg.payload?.protocol;
      const auth = msg.payload?.auth;

      if (auth?.deviceToken) {
        this.deviceToken = auth.deviceToken;
        this.isPaired = true;
        saveDeviceToken(auth.deviceToken);
        console.log('[OpenClawAdapter] Device token received and saved');
      }

      this.sessionId = msg.id;
      this.connected = true;
      this.ready = true;
      this.reconnectAttempts = 0;
      this.pairingRequested = false;

      console.log(`[OpenClawAdapter] Connected (protocol ${protocol})`);
      this.emit('connected');
      if (this._connectResolve) {
        this._connectResolve();
        this._connectResolve = null;
        this._connectReject = null;
      }
      return;
    }

    // 连接失败：检查是否是 NOT_PAIRED 错误
    // 响应格式可能是 {"payload":{"code":"INVALID_REQUEST","message":"device identity mismatch"}}
    const error = msg.payload?.error || msg.error || msg.payload;
    const errorCode = msg.payload?.errorCode || (error?.code) || (typeof error === 'string' ? error : error?.message);
    const errorMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));

    console.log(`[OpenClawAdapter] Connect failed: ${errorMessage} (code: ${errorCode})`);

    // 检查是否是 device identity mismatch（未配对）
    const msgLower = errorMessage.toLowerCase();
    const codeUpper = (errorCode || '').toUpperCase();
    const isPairingError = 
      codeUpper.includes('NOT_PAIRED') ||
      codeUpper.includes('DEVICE_ID_MISMATCH') ||
      codeUpper.includes('DEVICE_NOT_PAIRED') ||
      codeUpper.includes('PAIRING_REQUIRED') ||
      msgLower.includes('device identity mismatch') ||
      msgLower.includes('not paired') ||
      msgLower.includes('pairing required');

    if (isPairingError) {
      this._handlePairingRequired(resolve, reject);
      return;
    }

    if (this._connectReject) {
      this._connectReject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  /**
   * 处理需要配对的情况
   */
  _handlePairingRequired(resolve, reject) {
    console.log('[OpenClawAdapter] Device not paired, initiating pairing flow...');
    
    const signedAtMs = Date.now();
    const nonceToSign = this.nonce || crypto.randomBytes(16).toString('hex');
    const token = this.deviceToken || this.gatewayToken || '';
    const scopes = ['operator.read', 'operator.write', 'operator.pairing'];
    
    // 使用 Ed25519 签名 v3 payload
    const signature = signDevicePayload(
      this.device.deviceId,
      'cli',          // clientId
      'cli',          // clientMode
      'operator',     // role
      scopes,
      signedAtMs,
      token,
      nonceToSign,
      'linux',        // platform
      '',             // deviceFamily
      this.device.privateKeyPem
    );
    
    // 触发事件，让前端显示配对提示
    this.emit('pairing_required', {
      deviceId: this.device.deviceId,
      message: `请在 Gateway 端执行: openclaw devices approve ${this.device.deviceId}`,
      signature,
      nonce: nonceToSign,
      signedAt: signedAtMs
    });
    
    // reject Promise，让调用者知道需要配对
    if (reject) {
      reject(new Error('PAIRING_REQUIRED'));
    }
    this._connectResolve = null;
    this._connectReject = null;
    
    // 直接在同一连接上发送 device.pair 请求（不要关闭连接）
    // 因为 _handleConnectResponse 是在收到消息的回调中调用的，连接还没关闭
    this._sendDevicePairRequest();
    
    // 注意：不要在这里调用 _startPairingFlow，因为它会尝试重新连接
    // 配对请求已发送，后续由 _handlePairingResponse 处理
  }

  /**
   * 在当前连接上发送设备配对请求
   * 这个方法在收到 NOT_PAIRED 错误后立即调用，利用还有效的连接
   * 返回 Promise，等待配对完成
   */
  _sendDevicePairRequest() {
    return new Promise((resolve, reject) => {
      if (this.pairingRequested) {
        console.log('[OpenClawAdapter] Pairing already requested');
        resolve();
        return;
      }
      this.pairingRequested = true;
      this._pairingResolve = resolve;
      this._pairingReject = reject;

      const signedAtMs = Date.now();
      const nonceToSign = this.nonce || crypto.randomBytes(16).toString('hex');
      const token = this.deviceToken || this.gatewayToken || '';
      const scopes = ['operator.read', 'operator.write', 'operator.pairing'];
      
      // 使用 Ed25519 签名 v3 payload
      const signature = signDevicePayload(
        this.device.deviceId,
        'cli',          // clientId
        'cli',          // clientMode
        'operator',     // role
        scopes,
        signedAtMs,
        token,
        nonceToSign,
        'linux',        // platform
        '',             // deviceFamily
        this.device.privateKeyPem
      );
      const requestId = this._nextId();

      const pairRequest = {
        type: 'req',
        id: requestId,
        method: 'device.pair',
        params: {
          device: {
            id: this.device.deviceId,
            displayName: 'OpenExTeam Dashboard',
            publicKey: this.device.publicKey,
            signature,
            signedAt: signedAtMs,
            nonce: nonceToSign
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.pairing']
        }
      };

      this._sendRaw(pairRequest);
      console.log('[OpenClawAdapter] Sent device pairing request (deviceId:', this.device.deviceId, ', requestId:', requestId, ')');
      console.log('[OpenClawAdapter] Pairing request ID:', requestId);
      
      // 如果一段时间后没有收到响应，也认为配对请求已发送
      // 后续由事件驱动处理
      setTimeout(() => {
        if (this._pairingResolve) {
          console.log('[OpenClawAdapter] Pairing request sent, waiting for approval...');
          // 不要立即 resolve，等收到响应或超时再处理
        }
      }, 1000);
    });
  }

  /**
   * 发起设备配对请求（在新连接上）
   */
  async _startPairingFlow() {
    if (this.pairingRequested) {
      console.log('[OpenClawAdapter] Pairing already requested, waiting...');
      return;
    }
    this.pairingRequested = true;

    // 如果 WebSocket 未连接，先重新建立连接
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[OpenClawAdapter] WebSocket not open, reconnecting for pairing...');
      try {
        await this._establishConnection();
      } catch (err) {
        console.error('[OpenClawAdapter] Failed to reconnect for pairing:', err.message);
        throw err;
      }
    }

    const signedAtMs = Date.now();
    const nonceToSign = this.nonce || crypto.randomBytes(16).toString('hex');
    const token = this.deviceToken || this.gatewayToken || '';
    const scopes = ['operator.read', 'operator.write', 'operator.pairing'];
    
    // 使用 Ed25519 签名 v3 payload
    const signature = signDevicePayload(
      this.device.deviceId,
      'cli',          // clientId
      'cli',          // clientMode
      'operator',     // role
      scopes,
      signedAtMs,
      token,
      nonceToSign,
      'linux',        // platform
      '',             // deviceFamily
      this.device.privateKeyPem
    );

    const pairRequest = {
      type: 'req',
      id: this._nextId(),
      method: 'device.pair',
      params: {
        device: {
          id: this.device.deviceId,
          displayName: 'OpenExTeam Dashboard',
          publicKey: this.device.publicKey,
          signature,
          signedAt: signedAtMs,
          nonce: nonceToSign
        },
        role: 'operator',
        scopes: scopes
      }
    };

    this._sendRaw(pairRequest);
    console.log('[OpenClawAdapter] Sent device pairing request');
    console.log(`[OpenClawAdapter] Device ID: ${this.device.deviceId}`);
    
    // 等待配对完成（轮询或等待事件）
    await this._waitForPairingApproval();
  }

  /**
   * 等待配对批准（最长等待 120 秒）
   */
  async _waitForPairingApproval() {
    const maxWait = 120000; // 2 分钟
    const pollInterval = 3000; // 每 3 秒检查一次
    const maxAttempts = Math.floor(maxWait / pollInterval);

    for (let i = 0; i < maxAttempts; i++) {
      if (this.isPaired) {
        console.log('[OpenClawAdapter] Pairing approved!');
        return;
      }

      // 发送状态查询请求
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const statusRequest = {
          type: 'req',
          id: this._nextId(),
          method: 'device.pairingStatus',
          params: {
            deviceId: this.device.deviceId
          }
        };
        this._sendRaw(statusRequest);
      }

      await this._sleep(pollInterval);
    }

    throw new Error('Pairing timeout: device was not approved within 120 seconds');
  }

  /**
   * 处理配对批准事件或状态响应
   */
  _handlePairingApproved(payload) {
    console.log('[OpenClawAdapter] Received pairing approval event');
    if (payload?.token || payload?.deviceToken) {
      this.deviceToken = payload.token || payload.deviceToken;
      this.isPaired = true;
      
      // 如果 payload 中有实际的 deviceId，使用那个（Gateway 可能分配了新 ID）
      const actualDeviceId = payload.deviceId || this.device.deviceId;
      if (payload.deviceId && payload.deviceId !== this.device.deviceId) {
        console.log(`[OpenClawAdapter] Device ID changed from ${this.device.deviceId} to ${payload.deviceId}`);
        this.device.deviceId = payload.deviceId;
        // 更新 device.json
        const deviceJsonPath = path.join(IDENTITY_DIR, 'device.json');
        const privateKeyPath = path.join(IDENTITY_DIR, 'device-private.pem');
        if (fs.existsSync(privateKeyPath)) {
          const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
          fs.writeFileSync(deviceJsonPath, JSON.stringify({
            deviceId: this.device.deviceId,
            publicKeyPem: this.device.publicKey
          }, null, 2));
          console.log('[OpenClawAdapter] device.json updated with actual deviceId');
        }
      }
      
      // 保存 token 和 deviceId
      saveDeviceToken(this.deviceToken, this.device.deviceId);
      console.log('[OpenClawAdapter] Device token received from approval event');
      
      // 触发配对完成事件
      this.emit('pairing_complete', { deviceId: this.device.deviceId, token: this.deviceToken });
    }
  }

  /**
   * 处理配对响应（可能是等待状态）
   */
  _handlePairingResponse(msg) {
    if (msg.ok) {
      const status = msg.payload?.status;
      if (status === 'approved' || status === 'paired') {
        console.log('[OpenClawAdapter] Pairing approved!');
        this._handlePairingApproved(msg.payload);
        if (this._pairingResolve) {
          this._pairingResolve();
          this._pairingResolve = null;
          this._pairingReject = null;
        }
      } else {
        // status === 'pending' - 需要用户手动批准
        const requestId = msg.payload?.requestId || msg.payload?.id;
        console.log('[OpenClawAdapter] Pairing status: pending (waiting for manual approval)...');
        console.log('[OpenClawAdapter] Request ID for manual approval:', requestId);
        if (requestId) {
          console.log('[OpenClawAdapter] Please run: openclaw devices approve', requestId);
          // 更新 pairingMessage 以便前端显示
          this.emit('pairing_pending', {
            requestId: requestId,
            message: `请在 Gateway 端执行: openclaw devices approve ${requestId}`
          });
        }
      }
    } else {
      const error = msg.payload?.error || msg.error;
      console.error(`[OpenClawAdapter] Pairing request failed: ${JSON.stringify(error)}`);
      if (this._pairingReject) {
        this._pairingReject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
        this._pairingResolve = null;
        this._pairingReject = null;
      }
    }
  }

  /**
   * 配对成功后重新连接
   */
  async _reconnectAfterPairing() {
    this.reconnectAttempts = 0;
    // 短暂延迟后重新建立连接
    await this._sleep(1000);
    this.connect().catch((err) => {
      console.error('[OpenClawAdapter] Reconnect after pairing failed:', err.message);
      this.emit('error', err);
    });
  }

  /**
   * 断开连接
   */
  async disconnect() {
    this.isPaired = false; // 防止重连
    if (this.ws) {
      // 直接关闭 WebSocket，不需要发送 RPC
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.ready = false;
  }

  /**
   * 健康检查 - 简化为只检查连接状态
   */
  async healthCheck() {
    // 只需检查连接状态即可，RPC 调用可能不可用
    return this.connected && this.ready;
  }

  // ===== Agent 操作 =====

  async listAgents() {
    try {
      if (this.connected && this.ready) {
        const result = await this._rpcCallWithTimeout('agents', 'list', {}, 5000);
        if (result && Array.isArray(result.agents) && result.agents.length > 0) {
          const mappedAgents = result.agents.map(agent => ({
            id: agent.id,
            name: agent.name || agent.id,
            status: 'online',
            sessions: [],
            framework: 'openclaw'
          }));
          const isConnected = this.connected && this.ready;
          return mappedAgents.map(a => ({ ...a, connected: isConnected }));
        }
      }
    } catch (err) {
      console.warn('[OpenClawAdapter] Failed to list agents from Gateway, falling back to filesystem:', err.message);
    }
    
    const agents = this._loadAgentsFromFilesystem();
    const isConnected = this.connected && this.ready;
    return agents.map(a => ({ ...a, status: isConnected ? 'online' : 'offline', connected: isConnected }));
  }

  /**
   * 从文件系统读取 agents 列表（降级方案）
   */
  _loadAgentsFromFilesystem() {
    const agentsDir = path.join(process.env.HOME || '/root', '.openclaw', 'agents');
    const agents = [];
    try {
      if (!fs.existsSync(agentsDir)) return agents;
      const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(agentsDir, entry.name, 'config.json');
          let name = entry.name;
          let status = 'offline';
          try {
            if (fs.existsSync(configPath)) {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              name = config.name || config.id || entry.name;
              status = config.status || 'offline';
            }
          } catch {}
          agents.push({
            id: entry.name,
            name: name,
            status: status,
            sessions: [],
            framework: 'openclaw'
          });
        }
      }
    } catch (err) {
      console.error('[OpenClawAdapter] Failed to load agents from filesystem:', err.message);
    }
    return agents;
  }

  async getAgentStatus(agentId) {
    const agents = await this.listAgents();
    return agents.find(a => a.id === agentId) || null;
  }

  // ===== 消息发送 =====

  async send(agentId, message) {
    if (!this.ready) {
      throw new Error("Not connected to OpenClaw Gateway");
    }
    const agentMessage = this._formatAgentMessage(message);
    const gatewayAgentId = agentId;
    const sessionName = "openexteam";
    const sessionKey = `agent:${gatewayAgentId}:${sessionName}`;

    // Step 1: Create the session if it does not exist
    try {
      await this._rpcCallWithTimeout("sessions", "create", {
        key: sessionKey,
        agentId: gatewayAgentId,
        label: "OpenExTeam Dashboard"
      }, 10000);
      console.log(`[OpenClawAdapter] Session created/found: ${sessionKey}`);
    } catch (createErr) {
      // Session may already exist, which is fine
      const errMsg = createErr.message || String(createErr);
      if (!errMsg.toLowerCase().includes("already exists") && !errMsg.toLowerCase().includes("duplicate")) {
        console.log(`[OpenClawAdapter] Session create warning (may already exist): ${errMsg}`);
      }
    }

    // Step 2: Send the message using sessions.send
    try {
      const result = await this._rpcCallWithTimeout("sessions", "send", {
        key: sessionKey,
        message: JSON.stringify(agentMessage),
        idempotencyKey: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
      }, 30000); // 30s timeout for potentially slow agent responses
      return {
        success: true,
        runId: result?.runId,
        messageId: result?.messageId || `msg_${Date.now()}`
      };
    } catch (sendErr) {
      console.error("[OpenClawAdapter] sessions.send error:", sendErr.message);
      return { success: false, error: sendErr.message };
    }
  }

  /**
   * 带超时的 RPC 调用
   */
  _rpcCallWithTimeout(namespace, method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.ready) {
        reject(new Error('WebSocket not ready'));
        return;
      }
      const id = this._nextId();
      const fullMethod = namespace ? `${namespace}.${method}` : method;
      const request = {
        type: 'req',
        id,
        method: fullMethod,
        params
      };
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC call timeout: ${method}`));
      }, timeoutMs);
      this.pendingRequests.set(id, { resolve, reject, timeout });
      console.log(`[OpenClawAdapter] RPC call: namespace=${namespace} method=${method} params=${JSON.stringify(params)}`);
      this.ws.send(JSON.stringify(request));
    });
  }

  // ===== 私有方法 =====

  _nextId() {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _handleMessage(data) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;

      // RPC 响应
      if (msg.id && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id);
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);
        if (msg.error || !msg.ok) {
          const error = msg.error || msg.payload?.error || new Error('Request failed');
          pending.reject(new Error(error.message || JSON.stringify(error)));
        } else {
          pending.resolve(msg.payload || msg.result);
        }
        return;
      }

      // Gateway 推送事件
      if (msg.type === 'event') {
        this.emit('gateway_event', msg);
        if (msg.event === 'agent.message') {
          const parsed = this.parse(msg.payload);
          if (parsed) this.emit('message', parsed);
        }

        // 配对相关事件
        if (msg.event === 'pairing.approved' || msg.event === 'device.paired') {
          this._handlePairingApproved(msg.payload);
        }
        return;
      }
    } catch (err) {
      console.error('[OpenClawAdapter] _handleMessage error:', err);
    }
  }

  _formatAgentMessage(message) {
    const base = { type: message.type, timestamp: new Date().toISOString() };
    switch (message.type) {
      case 'task_assign': return { ...base, taskId: message.taskId, ...message.content };
      case 'workflow_step': return { ...base, jobId: message.jobId, taskId: message.taskId, stepIndex: message.stepIndex, ...message.content };
      case 'chat': return { ...base, content: message.content, chatId: message.chatId };
      default: return { ...base, ...message };
    }
  }

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

  _mapAgentStatus(status) {
    const map = { online: 'online', idle: 'idle', busy: 'busy', offline: 'offline' };
    return map[status?.toLowerCase()] || 'unknown';
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[OpenClawAdapter] Max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
    console.log(`[OpenClawAdapter] Reconnecting... attempt ${this.reconnectAttempts} in ${delay}ms`);
    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  // ===== 状态查询 =====

  /**
   * 检查配对状态
   */
  isDevicePaired() {
    return this.isPaired;
  }

  /**
   * 获取当前设备 ID
   */
  getDeviceId() {
    return this.device?.deviceId || null;
  }

  /**
   * 清除配对状态（重新配对）
   */
  async resetPairing() {
    this.isPaired = false;
    this.pairingRequested = false;
    this.deviceToken = null;

    // 删除存储的 token
    const tokenPath = path.join(IDENTITY_DIR, 'device-auth.json');
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }

    await this.disconnect();
    console.log('[OpenClawAdapter] Pairing state reset');
  }
}

module.exports = OpenClawAdapter;
