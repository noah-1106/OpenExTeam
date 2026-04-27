/**
 * Board Store - 管理 Jobs 和 Tasks 状态
 * 通过 SSE 实时更新
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';
import { createSSEConnection } from '../api/sse';

let sseHandle = null;

export const useBoardStore = defineStore('board', () => {
  const jobs = ref([]);
  const tasks = ref([]);
  const agents = ref([]);
  const excards = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // ========================
  // 错误处理
  // ========================
  function setError(err) {
    error.value = err?.message || err || '未知错误';
    console.error('[BoardStore] Error:', err);
  }

  function clearError() {
    error.value = null;
  }

  // ========================
  // SSE 实时推送
  // ========================
  function connectSSE() {
    if (sseHandle) sseHandle.close();

    sseHandle = createSSEConnection({
      task_updated: (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = tasks.value.find(t => t.id === d.taskId);
          if (t) t.status = d.status;
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_updated:', err);
        }
      },

      task_created: (e) => {
        try {
          const d = JSON.parse(e.data);
          tasks.value.push({
            id: d.id, jobId: d.jobId, title: d.title, agent: d.agent,
            status: 'todo', createdAt: new Date().toLocaleString('zh-CN'),
          });
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_created:', err);
        }
      },

      task_deleted: (e) => {
        try {
          const d = JSON.parse(e.data);
          tasks.value = tasks.value.filter(t => t.id !== d.taskId);
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_deleted:', err);
        }
      },

      workflow_started: (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) job.status = 'in-progress';
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_started:', err);
        }
      },

      workflow_completed: (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) job.status = 'done';
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_completed:', err);
        }
      },

      workflow_step_advanced: (e) => {
        try {
          const d = JSON.parse(e.data);
          console.log('[BoardStore] Workflow step advanced:', d);
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_step_advanced:', err);
        }
      },

      job_updated: (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) Object.assign(job, d);
        } catch (err) {
          console.warn('[BoardStore] Failed to parse job_updated:', err);
        }
      },

      adapter_connected: () => {
        console.log('[BoardStore] Adapter connected, re-fetching agents');
        fetchAll();
      },
    }, {
      onOpen: () => {
        console.log('[BoardStore] SSE connected');
        clearError();
      },
      onError: () => {
        setError('实时连接断开，正在重连...');
      },
    });
  }

  // 数据加载
  // ========================
  async function fetchAll() {
    loading.value = true;
    clearError();
    try {
      const [jobsRes, tasksRes, agentsRes, excardsRes] = await Promise.all([
        api.getJobs(),
        api.getTasks(),
        api.getAgents(),
        api.getExcards(),
      ]);
      jobs.value = jobsRes.jobs || [];
      tasks.value = tasksRes.tasks || [];
      agents.value = agentsRes.agents || [];
      excards.value = excardsRes.excards || [];
    } catch (err) {
      console.error('[BoardStore] fetchAll:', err);
      setError(err);
    } finally {
      loading.value = false;
    }
  }

  // 清理SSE连接
  function cleanup() {
    if (sseHandle) {
      sseHandle.close();
      sseHandle = null;
    }
  }

  // ========================
  // Job 操作
  // ========================
  async function createJob(data) {
    const res = await api.createJob(data);
    await fetchAll();
    return res;
  }

  async function updateJob(id, data) {
    const res = await api.updateJob(id, data);
    await fetchAll();
    return res;
  }

  async function deleteJob(id) {
    await api.deleteJob(id);
    jobs.value = jobs.value.filter(j => j.id !== id);
    tasks.value = tasks.value.filter(t => t.jobId !== id);
  }

  async function startWorkflow(jobId) {
    return api.startWorkflow(jobId);
  }

  // ========================
  // Task 操作
  // ========================
  async function createTask(data) {
    const res = await api.createTask(data);
    await fetchAll();
    return res;
  }

  async function deleteTask(id) {
    await api.deleteTask(id);
    tasks.value = tasks.value.filter(t => t.id !== id);
  }

  async function startTask(taskId) {
    return api.startTask(taskId);
  }

  async function updateTaskStatus(taskId, status) {
    // 乐观更新
    const t = tasks.value.find(t => t.id === taskId);
    if (t) t.status = status;
    return api.updateTaskStatus(taskId, status);
  }

  // ========================
  // 初始化
  // ========================
  connectSSE();

  return {
    jobs, tasks, agents, excards, loading, error,
    fetchAll, connectSSE, cleanup, setError, clearError,
    createJob, updateJob, deleteJob, startWorkflow,
    createTask, deleteTask, startTask, updateTaskStatus,
  };
});
