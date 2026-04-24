/**
 * OpenExTeam - API输入验证模块
 * 提供请求参数验证功能
 */

const { v4: uuidv4 } = require('uuid');

// 验证规则
const RULES = {
  jobId: {
    validate: (val) => typeof val === 'string' && val.length > 0,
    message: 'Job ID必须是非空字符串'
  },
  taskId: {
    validate: (val) => typeof val === 'string' && val.length > 0,
    message: 'Task ID必须是非空字符串'
  },
  agentId: {
    validate: (val) => typeof val === 'string' && val.length > 0,
    message: 'Agent ID必须是非空字符串'
  },
  jobTitle: {
    validate: (val) => typeof val === 'string' && val.length > 0 && val.length <= 200,
    message: 'Job标题必须是1-200个字符'
  },
  taskTitle: {
    validate: (val) => typeof val === 'string' && val.length > 0 && val.length <= 200,
    message: 'Task标题必须是1-200个字符'
  },
  excardId: {
    validate: (val) => !val || (typeof val === 'string' && val.length > 0),
    message: 'ExCard ID必须是非空字符串或undefined'
  },
  status: {
    validate: (val) => ['idle', 'in-progress', 'done', 'todo', 'error'].includes(val),
    message: '无效的状态值'
  },
  stepOrder: {
    validate: (val) => Number.isInteger(val) && val >= 0,
    message: '步骤顺序必须是非负整数'
  },
  stepType: {
    validate: (val) => ['task', 'excard'].includes(val),
    message: '步骤类型必须是"task"或"excard"'
  },
  messageContent: {
    validate: (val) => typeof val === 'string' && val.length <= 10000,
    message: '消息内容最多10000个字符'
  },
  adapterName: {
    validate: (val) => typeof val === 'string' && val.length > 0 && val.length <= 50,
    message: '适配器名称必须是1-50个字符'
  },
  adapterUrl: {
    validate: (val) => {
      if (!val || typeof val !== 'string') return false;
      try {
        new URL(val);
        return true;
      } catch {
        return val.startsWith('ws://') || val.startsWith('wss://') ||
               val.startsWith('http://') || val.startsWith('https://');
      }
    },
    message: '适配器URL格式无效'
  },
  adapterType: {
    validate: (val) => ['openclaw', 'hermes', 'deerflow'].includes(val),
    message: '适配器类型必须是openclaw、hermes或deerflow'
  }
};

/**
 * 验证单个字段
 */
function validateField(fieldName, value) {
  const rule = RULES[fieldName];
  if (!rule) return { valid: true }; // 没有规则的字段默认通过
  const valid = rule.validate(value);
  return { valid, message: valid ? null : rule.message };
}

/**
 * 验证多个字段
 */
function validateFields(fields) {
  const errors = [];
  for (const [fieldName, value] of Object.entries(fields)) {
    const result = validateField(fieldName, value);
    if (!result.valid) {
      errors.push({ field: fieldName, message: result.message });
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 验证Job创建请求
 */
function validateJobCreate(data) {
  const errors = [];

  // 必填字段检查
  if (!data.title) {
    errors.push({ field: 'title', message: 'Job标题是必填项' });
  } else {
    const titleResult = validateField('jobTitle', data.title);
    if (!titleResult.valid) errors.push(titleResult);
  }

  // 可选字段验证
  if (data.description && typeof data.description !== 'string') {
    errors.push({ field: 'description', message: '描述必须是字符串' });
  }

  if (data.excard_id !== undefined) {
    const excardResult = validateField('excardId', data.excard_id);
    if (!excardResult.valid) errors.push(excardResult);
  }

  if (data.agent && typeof data.agent !== 'string') {
    errors.push({ field: 'agent', message: 'Agent必须是字符串' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证Job更新请求
 */
function validateJobUpdate(data) {
  const errors = [];

  if (data.title !== undefined) {
    const titleResult = validateField('jobTitle', data.title);
    if (!titleResult.valid) errors.push(titleResult);
  }

  if (data.status !== undefined) {
    const statusResult = validateField('status', data.status);
    if (!statusResult.valid) errors.push(statusResult);
  }

  if (data.description !== undefined && typeof data.description !== 'string') {
    errors.push({ field: 'description', message: '描述必须是字符串' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证Task创建请求
 */
function validateTaskCreate(data) {
  const errors = [];

  if (!data.jobId) {
    errors.push({ field: 'jobId', message: 'Job ID是必填项' });
  }

  if (!data.title) {
    errors.push({ field: 'title', message: 'Task标题是必填项' });
  } else {
    const titleResult = validateField('taskTitle', data.title);
    if (!titleResult.valid) errors.push(titleResult);
  }

  if (!data.agent) {
    errors.push({ field: 'agent', message: 'Agent是必填项' });
  }

  if (data.stepIndex !== undefined && !Number.isInteger(data.stepIndex)) {
    errors.push({ field: 'stepIndex', message: '步骤索引必须是整数' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证消息发送请求
 */
function validateMessageSend(data) {
  const errors = [];

  if (!data.agentId) {
    errors.push({ field: 'agentId', message: 'Agent ID是必填项' });
  }

  if (data.content === undefined || data.content === null) {
    errors.push({ field: 'content', message: '消息内容是必填项' });
  } else {
    const contentStr = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content);
    const contentResult = validateField('messageContent', contentStr);
    if (!contentResult.valid) errors.push(contentResult);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证工作流启动请求
 */
function validateWorkflowStart(data) {
  const errors = [];

  if (!data.jobId) {
    errors.push({ field: 'jobId', message: 'Job ID是必填项' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证适配器配置
 */
function validateAdapterConfig(config) {
  const errors = [];

  if (!config.name) {
    errors.push({ field: 'name', message: '适配器名称是必填项' });
  } else {
    const nameResult = validateField('adapterName', config.name);
    if (!nameResult.valid) errors.push(nameResult);
  }

  if (!config.type) {
    errors.push({ field: 'type', message: '适配器类型是必填项' });
  } else {
    const typeResult = validateField('adapterType', config.type);
    if (!typeResult.valid) errors.push(typeResult);
  }

  if (!config.url) {
    errors.push({ field: 'url', message: '适配器URL是必填项' });
  } else {
    const urlResult = validateField('adapterUrl', config.url);
    if (!urlResult.valid) errors.push(urlResult);
  }

  if (config.token !== undefined && typeof config.token !== 'string') {
    errors.push({ field: 'token', message: 'Token必须是字符串' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Express验证中间件
 */
function createValidator(validationFn) {
  return (req, res, next) => {
    const data = { ...req.params, ...req.body, ...req.query };
    const result = validationFn(data);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: '输入验证失败',
        details: result.errors
      });
    }

    next();
  };
}

// 预定义的验证中间件
const validators = {
  jobCreate: createValidator(validateJobCreate),
  jobUpdate: createValidator(validateJobUpdate),
  taskCreate: createValidator(validateTaskCreate),
  messageSend: createValidator(validateMessageSend),
  workflowStart: createValidator(validateWorkflowStart),
  adapterConfig: createValidator(validateAdapterConfig)
};

// 生成安全的ID
function generateId(prefix = '') {
  const uuid = uuidv4().replace(/-/g, '').substring(0, 16);
  return prefix ? `${prefix}-${uuid}` : uuid;
}

// 清理用户输入（XSS防护）
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '') // 移除尖括号
    .trim();
}

// 深度清理对象
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return sanitizeInput(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeObject(value);
  }
  return result;
}

module.exports = {
  validateField,
  validateFields,
  validateJobCreate,
  validateJobUpdate,
  validateTaskCreate,
  validateMessageSend,
  validateWorkflowStart,
  validateAdapterConfig,
  createValidator,
  validators,
  generateId,
  sanitizeInput,
  sanitizeObject
};
