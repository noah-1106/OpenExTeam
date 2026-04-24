/**
 * API Client Tests - API客户端测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../api/client';

// 模拟fetch
global.fetch = vi.fn();

// 创建模拟响应的辅助函数
const createMockResponse = (ok, data) => ({
  ok,
  headers: {
    get: vi.fn().mockReturnValue('application/json')
  },
  json: async () => data,
  text: async () => JSON.stringify(data)
});

describe('API Client', () => {
  beforeEach(() => {
    // 重置mock
    vi.clearAllMocks();

    // 设置默认成功响应
    global.fetch.mockResolvedValue(createMockResponse(true, { success: true }));
  });

  describe('基础API方法', () => {
    it('应该能正确调用getConfig', async () => {
      await api.getConfig();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/config');
      expect(call[1].method).toBe('GET');
    });

    it('应该能正确调用getAgents', async () => {
      await api.getAgents();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/agents');
    });

    it('应该能正确调用getJobs', async () => {
      await api.getJobs();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/jobs');
    });

    it('应该能正确调用getTasks', async () => {
      await api.getTasks();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/tasks');
    });
  });

  describe('Job相关API', () => {
    it('应该能正确调用createJob', async () => {
      const jobData = {
        title: 'Test Job',
        description: 'Test Description'
      };

      await api.createJob(jobData);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/jobs');
      expect(call[1].method).toBe('POST');
      expect(call[1].body).toBe(JSON.stringify(jobData));
    });

    it('应该能正确调用updateJob', async () => {
      const updateData = { status: 'in-progress' };
      await api.updateJob('job-123', updateData);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/jobs/job-123');
      expect(call[1].method).toBe('PATCH');
    });

    it('应该能正确调用deleteJob', async () => {
      await api.deleteJob('job-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/jobs/job-123');
      expect(call[1].method).toBe('DELETE');
    });
  });

  describe('Task相关API', () => {
    it('应该能正确调用createTask', async () => {
      const taskData = {
        jobId: 'job-123',
        title: 'Test Task',
        agent: 'test-agent'
      };

      await api.createTask(taskData);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/tasks');
      expect(call[1].method).toBe('POST');
    });

    it('应该能正确调用startTask', async () => {
      await api.startTask('task-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/task/start');
    });
  });

  describe('Workflow相关API', () => {
    it('应该能正确调用startWorkflow', async () => {
      await api.startWorkflow('job-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/workflow/start');
    });

    it('应该能正确调用getWorkflowStatus', async () => {
      await api.getWorkflowStatus('job-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/workflow/status');
    });
  });

  describe('Message相关API', () => {
    it('应该能正确调用sendMessage', async () => {
      await api.sendMessage('agent-1', 'Hello!');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/message/send');
    });

    it('应该能正确调用getMessageHistory', async () => {
      await api.getMessageHistory('agent-1');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const call = global.fetch.mock.calls[0];
      expect(call[0]).toContain('/api/messages/history');
    });
  });

  describe('错误处理', () => {
    it('应该能处理API错误响应', async () => {
      global.fetch.mockResolvedValue(createMockResponse(false, { error: 'Something went wrong' }));

      await expect(api.getJobs()).rejects.toThrow();
    });

    it('应该能处理网络错误', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(api.getJobs()).rejects.toThrow();
    });
  });
});
