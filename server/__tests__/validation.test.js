/**
 * 验证模块测试
 */

const {
  validateField,
  validateFields,
  validateJobCreate,
  validateJobUpdate,
  validateTaskCreate,
  validateMessageSend,
  validateWorkflowStart,
  validateAdapterConfig,
  generateId,
  sanitizeInput,
  sanitizeObject
} = require('../validation');

describe('Validation Module', () => {
  describe('validateField', () => {
    test('应该验证jobId', () => {
      expect(validateField('jobId', 'job-123').valid).toBe(true);
      expect(validateField('jobId', '').valid).toBe(false);
      expect(validateField('jobId', null).valid).toBe(false);
    });

    test('应该验证status', () => {
      expect(validateField('status', 'idle').valid).toBe(true);
      expect(validateField('status', 'in-progress').valid).toBe(true);
      expect(validateField('status', 'done').valid).toBe(true);
      expect(validateField('status', 'invalid').valid).toBe(false);
    });

    test('应该验证adapterType', () => {
      expect(validateField('adapterType', 'openclaw').valid).toBe(true);
      expect(validateField('adapterType', 'hermes').valid).toBe(true);
      expect(validateField('adapterType', 'deerflow').valid).toBe(true);
      expect(validateField('adapterType', 'invalid').valid).toBe(false);
    });

    test('应该验证adapterUrl', () => {
      expect(validateField('adapterUrl', 'ws://localhost:9999').valid).toBe(true);
      expect(validateField('adapterUrl', 'http://localhost:9999').valid).toBe(true);
      expect(validateField('adapterUrl', 'wss://example.com').valid).toBe(true);
      expect(validateField('adapterUrl', 'https://example.com').valid).toBe(true);
      expect(validateField('adapterUrl', 'invalid').valid).toBe(false);
    });

    test('对于没有规则的字段应该返回true', () => {
      expect(validateField('unknownField', 'anything').valid).toBe(true);
    });
  });

  describe('validateFields', () => {
    test('应该验证多个字段', () => {
      const result = validateFields({
        jobId: 'job-123',
        status: 'idle'
      });
      expect(result.valid).toBe(true);
    });

    test('应该返回所有错误', () => {
      const result = validateFields({
        jobId: '',
        status: 'invalid'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('validateJobCreate', () => {
    test('应该验证有效的job创建', () => {
      const result = validateJobCreate({
        title: '测试任务',
        description: '任务描述',
        agent: 'agent-1'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝没有标题的job', () => {
      const result = validateJobCreate({
        description: '只有描述'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
    });

    test('应该拒绝标题过长的job', () => {
      const result = validateJobCreate({
        title: 'a'.repeat(201)
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateJobUpdate', () => {
    test('应该验证有效的job更新', () => {
      const result = validateJobUpdate({
        title: '新标题',
        status: 'done'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝无效的状态值', () => {
      const result = validateJobUpdate({
        status: 'invalid-status'
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTaskCreate', () => {
    test('应该验证有效的task创建', () => {
      const result = validateTaskCreate({
        jobId: 'job-123',
        title: '测试任务',
        agent: 'agent-1'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝缺少必填字段的task', () => {
      const result = validateTaskCreate({
        title: '缺少jobId和agent'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateMessageSend', () => {
    test('应该验证有效的消息发送', () => {
      const result = validateMessageSend({
        agentId: 'agent-1',
        content: '你好'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝没有agentId的消息', () => {
      const result = validateMessageSend({
        content: '没有agentId'
      });
      expect(result.valid).toBe(false);
    });

    test('应该拒绝没有content的消息', () => {
      const result = validateMessageSend({
        agentId: 'agent-1'
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateWorkflowStart', () => {
    test('应该验证有效的工作流启动', () => {
      const result = validateWorkflowStart({
        jobId: 'job-123'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝没有jobId的工作流启动', () => {
      const result = validateWorkflowStart({});
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAdapterConfig', () => {
    test('应该验证有效的适配器配置', () => {
      const result = validateAdapterConfig({
        name: '我的OpenClaw',
        type: 'openclaw',
        url: 'ws://localhost:9999',
        token: 'test-token'
      });
      expect(result.valid).toBe(true);
    });

    test('应该拒绝无效的适配器类型', () => {
      const result = validateAdapterConfig({
        name: '测试',
        type: 'invalid-type',
        url: 'ws://localhost:9999'
      });
      expect(result.valid).toBe(false);
    });

    test('应该拒绝无效的URL', () => {
      const result = validateAdapterConfig({
        name: '测试',
        type: 'openclaw',
        url: 'invalid-url'
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('generateId', () => {
    test('应该生成唯一ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });

    test('应该生成带前缀的ID', () => {
      const id = generateId('job');
      expect(id.startsWith('job-')).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    test('应该移除HTML标签', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    test('应该保留普通文本', () => {
      expect(sanitizeInput('你好，世界')).toBe('你好，世界');
    });

    test('应该处理非字符串输入', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
    });
  });

  describe('sanitizeObject', () => {
    test('应该深度清理对象', () => {
      const obj = {
        name: '<b>名字</b>',
        nested: {
          desc: '<script>xss</script>'
        },
        list: ['<i>item</i>']
      };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('b名字/b');
      expect(result.nested.desc).toBe('scriptxss/script');
      expect(result.list[0]).toBe('iitem/i');
    });
  });
});
