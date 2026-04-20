/**
 * Board Store - 管理 Jobs 和 Tasks 状态
 * 通过 SSE 实时更新
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

const SSE_URL = window.location.origin.replace(/:\d+$/, ':4000') + '/api/events';
let es = null; // EventSource

export const useBoardStore = defineStore('board', () => {
  const jobs = ref([]);
  const tasks = ref([]);
  const agents = ref([]);
  const excards = ref([]);
  const loading = ref(false);

  // ========================
  // SSE 实时推送
  // ========================
  function connectSSE() {
    if (es) es.close();
    es = new EventSource(SSE_URL);

    es.addEventListener('task_updated', (e) => {
      const d = JSON.parse(e.data);
      const t = tasks.value.find(t => t.id === d.taskId);
      if (t) t.status = d.status;
    });

    es.addEventListener('task_created', (e) => {
      const d = JSON.parse(e.data);
      tasks.value.push({
        id: d.id, jobId: d.jobId, title: d.title, agent: d.agent,
        status: 'todo', createdAt: new Date().toLocaleString('zh-CN'),
      });
    });

    es.addEventListener('task_deleted', (e) => {
      const d = JSON.parse(e.data);
      tasks.value = tasks.value.filter(t => t.id !== d.taskId);
    });

    es.addEventListener('workflow_started', (e) => {
      const d = JSON.parse(e.data);
      const job = jobs.value.find(j => j.id === d.jobId);
      if (job) job.status = 'in-progress';
    });

    es.addEventListener('workflow_completed', (e) => {
      const d = JSON.parse(e.data);
      const job = jobs.value.find(j => j.id === d.jobId);
      if (job) job.status = 'done';
    });

    es.addEventListener('workflow_step_advanced', (e) => {
      const d = JSON.parse(e.data);
      console.log('[BoardStore] Workflow step advanced:', d);
      // 可以在这里更新 UI 显示当前步骤
    });

    es.addEventListener('job_updated', (e) => {
      const d = JSON.parse(e.data);
      const job = jobs.value.find(j => j.id === d.jobId);
      if (job) Object.assign(job, d);
    });

    es.addEventListener('adapter_connected', () => {
      console.log('[BoardStore] Adapter connected, re-fetching agents');
      fetchAll();
    });
  }

  // 数据加载
  // ========================
  async function fetchAll() {
    loading.value = true;
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
    } finally {
      loading.value = false;
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
    jobs, tasks, agents, excards, loading,
    fetchAll, connectSSE,
    createJob, updateJob, deleteJob, startWorkflow,
    createTask, deleteTask, startTask, updateTaskStatus,
  };
});
