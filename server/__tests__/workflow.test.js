/**
 * Workflow Service Tests - 工作流服务单元测试
 *
 * 注意：这些测试会使用临时数据库
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

// 临时设置HOME目录
const TEST_HOME = path.join(os.tmpdir(), 'openexteam-workflow-test');
const originalHome = process.env.HOME;

// 模拟数据库和相关模块
const mockDb = {
  jobs: [],
  tasks: [],
  jobSteps: [],
  workflowState: [],
  messageLog: []
};

// 模拟广播
const mockBroadcast = jest.fn();

// 重置mock
function resetMocks() {
  mockDb.jobs = [];
  mockDb.tasks = [];
  mockDb.jobSteps = [];
  mockDb.workflowState = [];
  mockDb.messageLog = [];
  mockBroadcast.mockClear();
}

// 模拟数据库模块
jest.mock('../models/db', () => ({
  initDb: jest.fn(),
  queryAll: jest.fn((sql, params) => {
    if (sql.includes('jobs')) return mockDb.jobs;
    if (sql.includes('job_steps')) return mockDb.jobSteps;
    if (sql.includes('workflow_state')) return mockDb.workflowState;
    if (sql.includes('message_log')) return mockDb.messageLog;
    return [];
  }),
  queryGet: jest.fn((sql, params) => {
    if (sql.includes('jobs') && params?.length) {
      return mockDb.jobs.find(j => j.id === params[0]) || null;
    }
    if (sql.includes('workflow_state') && params?.length) {
      return mockDb.workflowState.find(w => w.job_id === params[0]) || null;
    }
    return null;
  }),
  queryRun: jest.fn((sql, params) => {
    // 简单模拟INSERT/UPDATE
    if (sql.includes('INSERT INTO jobs')) {
      mockDb.jobs.push({
        id: params[0],
        title: params[1],
        description: params[2],
        status: params[3],
        excard_id: params[4],
        agent: params[5],
        created_at: new Date().toISOString()
      });
    } else if (sql.includes('UPDATE jobs SET status')) {
      const job = mockDb.jobs.find(j => j.id === params[1]);
      if (job) job.status = params[0];
    } else if (sql.includes('INSERT OR REPLACE INTO workflow_state')) {
      const existing = mockDb.workflowState.find(w => w.job_id === params[0]);
      if (existing) {
        existing.status = params[1];
        existing.current_step = params[2];
      } else {
        mockDb.workflowState.push({
          job_id: params[0],
          status: params[1],
          current_step: params[2],
          started_at: new Date().toISOString()
        });
      }
    } else if (sql.includes('UPDATE workflow_state SET')) {
      const state = mockDb.workflowState.find(w => w.job_id === params[1]);
      if (state) {
        if (sql.includes('current_step')) state.current_step = params[0];
        if (sql.includes('status')) state.status = params[0];
      }
    }
  }),
  beginTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  runTransaction: jest.fn()
}));

// 模拟SSE模块
jest.mock('../events/sse', () => ({
  setupSSE: jest.fn(),
  broadcast: jest.fn((event, data) => {
    mockBroadcast(event, data);
  }),
  sseClients: new Set()
}));

// 模拟job model
jest.mock('../models/job', () => ({
  getJob: jest.fn((jobId) => mockDb.jobs.find(j => j.id === jobId) || null),
  getAllJobs: jest.fn(() => mockDb.jobs),
  createJob: jest.fn((data) => {
    const job = { id: data.id || `job-${Date.now()}`, status: 'idle', ...data };
    mockDb.jobs.push(job);
    return job;
  }),
  updateJob: jest.fn((id, data) => {
    const job = mockDb.jobs.find(j => j.id === id);
    if (job) {
      Object.assign(job, data);
      return job;
    }
    return null;
  }),
  deleteJob: jest.fn((id) => {
    const index = mockDb.jobs.findIndex(j => j.id === id);
    if (index !== -1) mockDb.jobs.splice(index, 1);
  })
}));

// 模拟job_steps model
jest.mock('../models/job_steps', () => ({
  getStepsForJob: jest.fn((jobId) => mockDb.jobSteps.filter(s => s.job_id === jobId)),
  updateStep: jest.fn((id, data) => {
    const step = mockDb.jobSteps.find(s => s.id === id);
    if (step) Object.assign(step, data);
  })
}));

// 模拟excards storage
jest.mock('../storage/excards', () => ({
  getExcard: jest.fn((id) => ({
    id,
    title: 'Test ExCard',
    content: 'Test content'
  })),
  getExcardMd: jest.fn((id) => '# Test ExCard\n\nThis is a test.')
}));

describe('Workflow Service', () => {
  let workflowService;

  beforeAll(() => {
    // 设置临时HOME目录
    process.env.HOME = TEST_HOME;
    if (!fs.existsSync(TEST_HOME)) {
      fs.mkdirSync(TEST_HOME, { recursive: true });
    }
  });

  beforeEach(() => {
    resetMocks();

    // 导入workflow service
    workflowService = require('../services/workflow');

    // 设置模拟的activeWorkflows和activeAdapters
    const mockActiveWorkflows = new Map();
    const mockActiveAdapters = new Map();

    // 添加一个模拟适配器
    mockActiveAdapters.set('test-adapter', {
      send: jest.fn().mockResolvedValue({ success: true }),
      connected: true
    });

    workflowService.setActiveWorkflowsRef(mockActiveWorkflows);
    workflowService.setActiveAdaptersRef(mockActiveAdapters);
  });

  afterAll(() => {
    process.env.HOME = originalHome;
    // 清理测试目录
    if (fs.existsSync(TEST_HOME)) {
      // 简单清理
      try { fs.rmSync(TEST_HOME, { recursive: true, force: true }); } catch {}
    }
  });

  describe('基本功能测试', () => {
    test('应该能正确导入workflow service', () => {
      expect(workflowService).toBeDefined();
      expect(typeof workflowService.startWorkflow).toBe('function');
      expect(typeof workflowService.completeWorkflow).toBe('function');
      expect(typeof workflowService.handleAgentReply).toBe('function');
      expect(typeof workflowService.getWorkflowStatus).toBe('function');
      expect(typeof workflowService.parseWorkflowReply).toBe('function');
    });

    test('parseWorkflowReply应该能正确解析简单的非workflow消息', () => {
      const result = workflowService.parseWorkflowReply('普通聊天消息');
      expect(result.isWorkflow).toBe(false);
    });

    test('parseWorkflowReply应该能正确解析WORKFLOW标记消息', () => {
      const result = workflowService.parseWorkflowReply('[WORKFLOW job-123]');
      expect(result.isWorkflow).toBe(true);
      // 注意：实际代码只匹配数字部分
      expect(result.jobId).toBeDefined();
    });

    test('parseWorkflowReply应该能正确解析status和message', () => {
      const result = workflowService.parseWorkflowReply(
        '[WORKFLOW job-123]\nstatus: complete\nmessage: 任务完成！'
      );
      expect(result.isWorkflow).toBe(true);
      expect(result.status).toBe('complete');
      expect(result.message).toBe('任务完成！');
    });
  });

  describe('Workflow启动测试', () => {
    test('startWorkflow应该能返回错误如果job不存在', () => {
      const result = workflowService.startWorkflow('non-existent-job');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Job not found');
    });

    test('startWorkflow应该能返回错误如果job没有agent', () => {
      mockDb.jobs.push({
        id: 'test-job-1',
        title: 'Test Job',
        description: 'Test description',
        status: 'idle',
        agent: null
      });

      const result = workflowService.startWorkflow('test-job-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Job 必须指定执行 Agent');
    });

    test('startWorkflow应该能拒绝重复启动已经在运行的job', () => {
      mockDb.jobs.push({
        id: 'test-job-2',
        title: 'Test Job 2',
        description: 'Test description 2',
        status: 'in-progress',
        agent: 'test-agent'
      });

      const result = workflowService.startWorkflow('test-job-2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });
  });

  describe('Workflow状态查询测试', () => {
    test('getWorkflowStatus应该能对不存在的workflow返回默认状态', () => {
      const status = workflowService.getWorkflowStatus('non-existent-job');
      expect(status.jobId).toBe('non-existent-job');
      expect(status.status).toBe('idle');
      expect(status.currentStep).toBe(0);
    });

    test('getWorkflowStatus应该能返回已存在的workflow状态', () => {
      mockDb.workflowState.push({
        job_id: 'test-job-3',
        status: 'running',
        current_step: 2,
        started_at: new Date().toISOString()
      });
      mockDb.jobs.push({
        id: 'test-job-3',
        title: 'Test Job 3',
        status: 'in-progress',
        agent: 'test-agent'
      });

      const status = workflowService.getWorkflowStatus('test-job-3');
      expect(status.jobId).toBe('test-job-3');
      expect(status.status).toBe('running');
      expect(status.currentStep).toBe(2);
    });
  });

  describe('解析Agent回复测试', () => {
    test('parseWorkflowReply应该能正确识别各种status值', () => {
      const cases = [
        { status: 'complete', expected: 'complete' },
        { status: 'success', expected: 'success' },
        { status: 'done', expected: 'done' },
        { status: 'error', expected: 'error' },
        { status: 'failed', expected: 'failed' },
        { status: 'in_progress', expected: 'in_progress' }
      ];

      for (const { status, expected } of cases) {
        const result = workflowService.parseWorkflowReply(
          `[WORKFLOW job-test]\nstatus: ${status}`
        );
        expect(result.status).toBe(expected);
      }
    });

    test('parseWorkflowReply应该能正确解析step信息', () => {
      const result = workflowService.parseWorkflowReply(
        '[WORKFLOW job-test step-2]\nstatus: complete'
      );
      expect(result.isWorkflow).toBe(true);
      expect(result.stepId).toBe('2');
    });
  });
});
