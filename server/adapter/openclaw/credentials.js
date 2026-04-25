/**
 * OpenClaw Adapter - 凭证管理模块
 * 处理设备密钥、token存储和加载
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE_IDENTITY_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'identity');

// 默认权限范围
const DEFAULT_SCOPES = ['operator.read', 'operator.write', 'operator.pairing'];
const FULL_SCOPES = [
  'operator.admin', 'operator.read', 'operator.write', 'operator.pairing',
  'operator.talk.secrets', 'operator.approvals'
];

class CredentialManager {
  constructor(adapterName) {
    this.adapterName = adapterName;
    this.identityDir = path.join(BASE_IDENTITY_DIR, adapterName);
    this.deviceJsonPath = path.join(this.identityDir, 'device.json');
    this.privateKeyPath = path.join(this.identityDir, 'device-private.pem');
    this.deviceAuthPath = path.join(this.identityDir, 'device-auth.json');

    // 确保目录存在
    if (!fs.existsSync(this.identityDir)) {
      fs.mkdirSync(this.identityDir, { recursive: true });
    }
  }

  /**
   * 从PEM格式提取原始公钥（去掉SPKI前缀）
   */
  static derivePublicKeyRaw(publicKeyPem) {
    const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
    const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
    if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
        spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
      return spki.subarray(ED25519_SPKI_PREFIX.length);
    }
    return spki;
  }

  /**
   * 使用与OpenClaw Gateway相同的算法计算设备ID
   */
  static computeDeviceId(publicKeyPem) {
    const raw = CredentialManager.derivePublicKeyRaw(publicKeyPem);
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * 生成ED25519密钥对
   */
  static generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  /**
   * Ed25519签名设备认证payload
   */
  static signDevicePayload({
    deviceId, clientId, clientMode, role, scopes,
    signedAtMs, token, nonce, platform = '', deviceFamily = '',
    privateKeyPem
  }) {
    const payload = [
      'v3', deviceId, clientId, clientMode, role,
      scopes.join(','), String(signedAtMs),
      token || '', nonce, platform, deviceFamily
    ].join('|');

    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem, format: 'pem', type: 'pkcs8'
    });

    const signature = crypto.sign(null, Buffer.from(payload), privateKey);
    return signature.toString('base64url');
  }

  /**
   * 加载或创建设备凭证
   */
  loadOrCreateDeviceCredentials() {
    // 优先尝试从device-auth.json加载已配对的设备
    const pairedDevice = this._tryLoadPairedDevice();
    if (pairedDevice) return pairedDevice;

    // 尝试加载本地凭证
    const localDevice = this._tryLoadLocalDevice();
    if (localDevice) return localDevice;

    // 创建新凭证
    return this._createNewDeviceCredentials();
  }

  /**
   * 尝试从device-auth.json加载已配对设备
   */
  _tryLoadPairedDevice() {
    if (!fs.existsSync(this.deviceAuthPath)) return null;

    try {
      const authData = JSON.parse(fs.readFileSync(this.deviceAuthPath, 'utf8'));
      if (!authData.deviceId || !authData.tokens?.operator?.token) return null;

      // 检查是否有对应的密钥文件
      if (!fs.existsSync(this.deviceJsonPath) || !fs.existsSync(this.privateKeyPath)) {
        return null;
      }

      const deviceData = JSON.parse(fs.readFileSync(this.deviceJsonPath, 'utf8'));
      const privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
      const publicKey = deviceData.publicKeyPem || deviceData.publicKey;

      if (!publicKey || !privateKey) return null;

      console.log(`[OpenClaw:${this.adapterName}] Using paired device: ${authData.deviceId}`);
      return {
        deviceId: authData.deviceId,
        publicKey,
        privateKey,
        privateKeyPem: privateKey,
        deviceToken: authData.tokens.operator.token
      };
    } catch (err) {
      console.warn(`[OpenClaw:${this.adapterName}] Failed to load paired device:`, err.message);
      return null;
    }
  }

  /**
   * 尝试加载本地未配对凭证
   */
  _tryLoadLocalDevice() {
    if (!fs.existsSync(this.deviceJsonPath) || !fs.existsSync(this.privateKeyPath)) {
      return null;
    }

    try {
      const deviceData = JSON.parse(fs.readFileSync(this.deviceJsonPath, 'utf8'));
      const publicKey = deviceData.publicKeyPem || deviceData.publicKey;
      const privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');

      if (!publicKey || !privateKey) return null;

      const deviceId = CredentialManager.computeDeviceId(publicKey);
      console.log(`[OpenClaw:${this.adapterName}] Loaded local device: ${deviceId}`);
      return { deviceId, publicKey, privateKey, privateKeyPem: privateKey };
    } catch (err) {
      console.warn(`[OpenClaw:${this.adapterName}] Failed to load local device:`, err.message);
      return null;
    }
  }

  /**
   * 创建新的设备凭证
   */
  _createNewDeviceCredentials() {
    const keys = CredentialManager.generateKeyPair();
    const deviceId = CredentialManager.computeDeviceId(keys.publicKey);

    // 保存
    fs.writeFileSync(this.deviceJsonPath, JSON.stringify({
      version: 1,
      deviceId,
      publicKeyPem: keys.publicKey,
      privateKeyPem: keys.privateKey
    }, null, 2));

    fs.writeFileSync(this.privateKeyPath, keys.privateKey, { mode: 0o600 });
    console.log(`[OpenClaw:${this.adapterName}] Created new device: ${deviceId}`);

    return {
      deviceId,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      privateKeyPem: keys.privateKey
    };
  }

  /**
   * 加载设备token
   */
  loadDeviceToken() {
    if (!fs.existsSync(this.deviceAuthPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(this.deviceAuthPath, 'utf8'));
      return data.tokens?.operator?.token || data.token || null;
    } catch {
      return null;
    }
  }

  /**
   * 加载设备权限范围
   */
  loadDeviceScopes() {
    if (!fs.existsSync(this.deviceAuthPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(this.deviceAuthPath, 'utf8'));
      return data.tokens?.operator?.scopes || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存设备token
   */
  saveDeviceToken(token, deviceId) {
    try {
      let existingData = {};
      if (fs.existsSync(this.deviceAuthPath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(this.deviceAuthPath, 'utf8'));
        } catch {}
      }

      const data = {
        version: 1,
        deviceId: deviceId || existingData.deviceId,
        tokens: {
          operator: {
            token,
            role: 'operator',
            scopes: FULL_SCOPES,
            updatedAtMs: Date.now()
          }
        }
      };

      fs.writeFileSync(this.deviceAuthPath, JSON.stringify(data, null, 2));
      console.log(`[OpenClaw:${this.adapterName}] Device token saved`);
    } catch (err) {
      console.error(`[OpenClaw:${this.adapterName}] Failed to save device token:`, err.message);
    }
  }

  /**
   * 清除所有凭证
   */
  clearAllCredentials() {
    console.log(`[OpenClaw:${this.adapterName}] Clearing all credentials...`);

    [this.deviceJsonPath, this.privateKeyPath, this.deviceAuthPath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`[OpenClaw:${this.adapterName}] Deleted: ${path.basename(file)}`);
      }
    });
  }

  /**
   * 获取默认权限范围
   */
  getDefaultScopes() {
    return [...DEFAULT_SCOPES];
  }

  /**
   * 获取完整权限范围
   */
  getFullScopes() {
    return [...FULL_SCOPES];
  }
}

module.exports = CredentialManager;
