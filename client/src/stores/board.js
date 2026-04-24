/**
 * Board Store - 管理 Jobs 和 Tasks 状态
 * 通过 SSE 实时更新
 */

import { defineStore } from 'pinia';
import { ref, onUnmounted } from 'vue';
import api from '../api/client';

const SSE_URL = window.location.origin.replace(/:\d+$/, ':4000') + '/api/events';
let es = null; // EventSource
let reconnectTimer = null;
const RECONNECT_DELAY = 3000;

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
    if (es) {
      es.close();
      es = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    try {
      es = new EventSource(SSE_URL);

      es.addEventListener('open', () => {
        console.log('[BoardStore] SSE connected');
        clearError();
      });

      es.addEventListener('error', (e) => {
        console.warn('[BoardStore] SSE connection error, will reconnect:', e);
        setError('实时连接断开，正在重连...');

        // 重连逻辑
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          console.log('[BoardStore] Attempting to reconnect SSE...');
          connectSSE();
        }, RECONNECT_DELAY);
      });

      es.addEventListener('task_updated', (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = tasks.value.find(t => t.id === d.taskId);
          if (t) t.status = d.status;
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_updated:', err);
        }
      });

      es.addEventListener('task_created', (e) => {
        try {
          const d = JSON.parse(e.data);
          tasks.value.push({
            id: d.id, jobId: d.jobId, title: d.title, agent: d.agent,
            status: 'todo', createdAt: new Date().toLocaleString('zh-CN'),
          });
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_created:', err);
        }
      });

      es.addEventListener('task_deleted', (e) => {
        try {
          const d = JSON.parse(e.data);
          tasks.value = tasks.value.filter(t => t.id !== d.taskId);
        } catch (err) {
          console.warn('[BoardStore] Failed to parse task_deleted:', err);
        }
      });

      es.addEventListener('workflow_started', (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) job.status = 'in-progress';
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_started:', err);
        }
      });

      es.addEventListener('workflow_completed', (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) job.status = 'done';
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_completed:', err);
        }
      });

      es.addEventListener('workflow_step_advanced', (e) => {
        try {
          const d = JSON.parse(e.data);
          console.log('[BoardStore] Workflow step advanced:', d);
          // 可以在这里更新 UI 显示当前步骤
        } catch (err) {
          console.warn('[BoardStore] Failed to parse workflow_step_advanced:', err);
        }
      });

      es.addEventListener('job_updated', (e) => {
        try {
          const d = JSON.parse(e.data);
          const job = jobs.value.find(j => j.id === d.jobId);
          if (job) Object.assign(job, d);
        } catch (err) {
          console.warn('[BoardStore] Failed to parse job_updated:', err);
        }
      });

      es.addEventListener('adapter_connected', () => {
        console.log('[BoardStore] Adapter connected, re-fetching agents');
        fetchAll();
      });

    } catch (err) {
      console.error('[BoardStore] Failed to create SSE connection:', err);
      setError('无法连接到服务器');
    }
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
      console.log('[BoardStore] fetchAll agentsRes:', agentsRes);
      jobs.value = jobsRes.jobs || [];
      tasks.value = tasksRes.tasks || [];
      agents.value = agentsRes.agents || [];
      excards.value = excardsRes.excards || [];
      console.log('[BoardStore] agents set to:', agents.value);
    } catch (err) {
      console.error('[BoardStore] fetchAll:', err);
      setError(err);
    } finally {
      loading.value = false;
    }
  }

  // 清理SSE连接
  function cleanup() {
    if (es) {
      es.close();
      es = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
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
