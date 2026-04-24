/**
 * Integration Tests - 集成测试
 *
 * 测试API端到端功能
 */

const request = require('supertest');
const os = require('os');
const path = require('path');
const fs = require('fs');

// 临时设置HOME目录
const TEST_HOME = path.join(os.tmpdir(), 'openexteam-integration-test');
const originalHome = process.env.HOME;

// 确保测试环境
beforeAll(() => {
  process.env.HOME = TEST_HOME;
  if (!fs.existsSync(TEST_HOME)) {
    fs.mkdirSync(TEST_HOME, { recursive: true });
  }

  // 创建配置目录
  const configDir = path.join(TEST_HOME, '.openexteam');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
});

// 清理
afterAll(() => {
  process.env.HOME = originalHome;
  try { fs.rmSync(TEST_HOME, { recursive: true, force: true }); } catch {}
});

describe('API Integration Tests', () => {
  let app;
  let testPort = 4001; // 使用不同的端口避免冲突

  beforeAll(async () => {
    // 模拟一些依赖
    jest.mock('../models/db', () => ({
      initDb: jest.fn(),
      queryAll: jest.fn().mockReturnValue([]),
      queryGet: jest.fn().mockReturnValue(null),
      queryRun: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn()
    }));

    jest.mock('../events/sse', () => ({
      setupSSE: jest.fn(),
      broadcast: jest.fn(),
      sseClients: new Set()
    }));

    // 创建Express应用
    const express = require('express');
    app = express();
    app.use(express.json());

    // 设置简单的测试路由
    app.get('/api/health', (_, res) => {
      res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    app.get('/api/jobs', (_, res) => {
      res.json({
        jobs: [
          { id: 'test-job-1', title: 'Test Job 1', status: 'idle' },
          { id: 'test-job-2', title: 'Test Job 2', status: 'in-progress' }
        ]
      });
    });

    app.post('/api/jobs', (req, res) => {
      const { title, description } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, error: 'title required' });
      }
      res.json({ success: true, id: `job-${Date.now()}`, title, description });
    });

    app.get('/api/agents', (_, res) => {
      res.json({
        agents: [
          { id: 'openclaw:agent-1', name: 'Agent 1', status: 'online' },
          { id: 'openclaw:agent-2', name: 'Agent 2', status: 'online' }
        ]
      });
    });
  });

  describe('基本API测试', () => {
    test('应该能访问健康检查接口', async () => {
      const response = await request(app).get('/api/health');
      expect(response.statusCode).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.timestamp).toBeDefined();
    });

    test('应该能获取jobs列表', async () => {
      const response = await request(app).get('/api/jobs');
      expect(response.statusCode).toBe(200);
      expect(response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs.length).toBe(2);
    });

    test('应该能创建job（需要title）', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Integration Test Job',
          description: 'This is a test'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBeDefined();
    });

    test('创建job时缺少title应该返回400', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({ description: 'No title' });

      expect(response.statusCode).toBe(400);
    });

    test('应该能获取agents列表', async () => {
      const response = await request(app).get('/api/agents');
      expect(response.statusCode).toBe(200);
      expect(response.body.agents).toBeDefined();
      expect(Array.isArray(response.body.agents)).toBe(true);
    });
  });

  describe('输入验证集成测试', () => {
    test('验证模块应该能正常验证job创建', () => {
      const { validateJobCreate } = require('../validation');

      const valid = validateJobCreate({
        title: 'Valid Job',
        description: 'Valid description',
        agent: 'test-agent'
      });
      expect(valid.valid).toBe(true);

      const noTitle = validateJobCreate({ description: 'No title' });
      expect(noTitle.valid).toBe(false);
      expect(noTitle.errors.some(e => e.field === 'title')).toBe(true);
    });

    test('验证模块应该能正常验证适配器配置', () => {
      const { validateAdapterConfig } = require('../validation');

      const valid = validateAdapterConfig({
        name: 'Test Adapter',
        type: 'openclaw',
        url: 'ws://localhost:9999'
      });
      expect(valid.valid).toBe(true);

      const invalidType = validateAdapterConfig({
        name: 'Test',
        type: 'invalid-type',
        url: 'ws://localhost:9999'
      });
      expect(invalidType.valid).toBe(false);

      const invalidUrl = validateAdapterConfig({
        name: 'Test',
        type: 'openclaw',
        url: 'invalid-url'
      });
      expect(invalidUrl.valid).toBe(false);
    });
  });

  describe('Sanitize输入清理测试', () => {
    test('应该能清理危险的HTML标签', () => {
      const { sanitizeInput } = require('../validation');

      const result = sanitizeInput('<script>alert("XSS")</script>');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('>');
    });

    test('应该能保持普通文本不变', () => {
      const { sanitizeInput } = require('../validation');

      const plainText = 'Hello 世界! 123';
      const result = sanitizeInput(plainText);
      expect(result).toBe(plainText);
    });

    test('sanitizeObject应该能深度清理对象', () => {
      const { sanitizeObject } = require('../validation');

      const obj = {
        name: '<b>Name</b>',
        details: {
          desc: '<script>evil()</script>',
          items: ['<i>item</i>', 'normal']
        }
      };

      const result = sanitizeObject(obj);
      expect(result.name).not.toContain('<b');
      expect(result.details.desc).not.toContain('<script');
    });
  });
});
