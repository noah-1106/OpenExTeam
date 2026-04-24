/**
 * 凭证管理器测试
 *
 * 注意：这些测试会创建临时文件，但会在测试后清理
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const CredentialManager = require('../adapter/openclaw/credentials');

// 临时目录
const TEST_HOME = path.join(os.tmpdir(), 'openexteam-test');
const originalHome = process.env.HOME;

describe('CredentialManager', () => {
  // 每个测试前设置临时HOME目录
  beforeEach(() => {
    process.env.HOME = TEST_HOME;
    // 清理并创建测试目录
    if (fs.existsSync(TEST_HOME)) {
      const deleteDir = (dirPath) => {
        if (fs.existsSync(dirPath)) {
          fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteDir(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      };
      deleteDir(TEST_HOME);
    }
    fs.mkdirSync(TEST_HOME, { recursive: true });
  });

  // 每个测试后恢复
  afterEach(() => {
    process.env.HOME = originalHome;
  });

  describe('静态方法', () => {
    test('应该能生成密钥对', () => {
      const keys = CredentialManager.generateKeyPair();
      expect(keys).toHaveProperty('publicKey');
      expect(keys).toHaveProperty('privateKey');
      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
      expect(keys.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keys.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    test('应该能计算设备ID', () => {
      const keys = CredentialManager.generateKeyPair();
      const deviceId = CredentialManager.computeDeviceId(keys.publicKey);
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
    });

    test('相同的公钥应该生成相同的设备ID', () => {
      const keys = CredentialManager.generateKeyPair();
      const deviceId1 = CredentialManager.computeDeviceId(keys.publicKey);
      const deviceId2 = CredentialManager.computeDeviceId(keys.publicKey);
      expect(deviceId1).toBe(deviceId2);
    });
  });

  describe('实例方法', () => {
    test('应该能创建新的凭证管理器实例', () => {
      const manager = new CredentialManager('test-adapter');
      expect(manager).toBeInstanceOf(CredentialManager);
      expect(manager.adapterName).toBe('test-adapter');
    });

    test('应该能创建新的设备凭证', () => {
      const manager = new CredentialManager('test-adapter');
      const credentials = manager.loadOrCreateDeviceCredentials();

      expect(credentials).toHaveProperty('deviceId');
      expect(credentials).toHaveProperty('publicKey');
      expect(credentials).toHaveProperty('privateKey');
      expect(credentials).toHaveProperty('privateKeyPem');
    });

    test('应该能保存和加载设备token', () => {
      const manager = new CredentialManager('test-adapter');
      const credentials = manager.loadOrCreateDeviceCredentials();

      // 保存token
      const testToken = 'test-token-12345';
      manager.saveDeviceToken(testToken, credentials.deviceId);

      // 重新加载
      const manager2 = new CredentialManager('test-adapter');
      const loadedToken = manager2.loadDeviceToken();
      expect(loadedToken).toBe(testToken);
    });

    test('应该能返回默认权限范围', () => {
      const manager = new CredentialManager('test-adapter');
      const scopes = manager.getDefaultScopes();
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
      expect(scopes).toContain('operator.read');
    });

    test('应该能返回完整权限范围', () => {
      const manager = new CredentialManager('test-adapter');
      const scopes = manager.getFullScopes();
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(manager.getDefaultScopes().length);
    });

    test('应该能清除所有凭证', () => {
      const manager = new CredentialManager('test-adapter');
      // 创建凭证
      manager.loadOrCreateDeviceCredentials();
      manager.saveDeviceToken('test-token', 'test-id');

      // 清除
      manager.clearAllCredentials();

      // 应该创建新凭证
      const manager2 = new CredentialManager('test-adapter');
      const credentials = manager2.loadOrCreateDeviceCredentials();
      expect(credentials.deviceId).toBeDefined();
      // token应该不存在
      expect(manager2.loadDeviceToken()).toBeNull();
    });
  });

  describe('多个适配器隔离', () => {
    test('不同适配器的凭证应该隔离', () => {
      const manager1 = new CredentialManager('adapter-1');
      const manager2 = new CredentialManager('adapter-2');

      const creds1 = manager1.loadOrCreateDeviceCredentials();
      const creds2 = manager2.loadOrCreateDeviceCredentials();

      expect(creds1.deviceId).not.toBe(creds2.deviceId);
    });

    test('适配器token不应该互相干扰', () => {
      const manager1 = new CredentialManager('adapter-1');
      const manager2 = new CredentialManager('adapter-2');

      const creds1 = manager1.loadOrCreateDeviceCredentials();
      const creds2 = manager2.loadOrCreateDeviceCredentials();

      manager1.saveDeviceToken('token-1', creds1.deviceId);
      manager2.saveDeviceToken('token-2', creds2.deviceId);

      expect(manager1.loadDeviceToken()).toBe('token-1');
      expect(manager2.loadDeviceToken()).toBe('token-2');
    });
  });
});
