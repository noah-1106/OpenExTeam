/**
 * API Client - 封装所有后端 HTTP 调用
 * 基准地址: http://localhost:4000
 */

const BASE = window.location.origin.replace(/:\d+$/, ':4000');

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  // --- Config & Adapter ---
  getConfig: () => request('GET', '/api/config'),
  saveAdapters: (adapters) => request('POST', '/api/config/adapters', { adapters }),
  testAdapter: (type, url, token) => request('POST', '/api/adapter/test', { type, url, token }),

  // --- Agents ---
  getAgents: () => request('GET', '/api/agents'),

  // --- Jobs ---
  getJobs: () => request('GET', '/api/jobs'),
  createJob: (data) => request('POST', '/api/jobs', data),
  updateJob: (id, data) => request('PATCH', `/api/jobs/${id}`, data),
  deleteJob: (id) => request('DELETE', `/api/jobs/${id}`),
  generateTasksFromExcard: (jobId, agentId, excardId) =>
    request('POST', `/api/jobs/${jobId}/generate-tasks`, { agentId, excardId }),

  // --- Tasks ---
  getTasks: (jobId) => request('GET', `/api/tasks${jobId ? `?jobId=${jobId}` : ''}`),
  createTask: (data) => request('POST', '/api/tasks', data),
  deleteTask: (id) => request('DELETE', `/api/tasks/${id}`),
  startTask: (taskId) => request('POST', '/api/task/start', { taskId }),
  updateTaskStatus: (taskId, status) => request('POST', '/api/task/status', { taskId, status }),

  // --- Workflow ---
  startWorkflow: (jobId) => request('POST', '/api/workflow/start', { jobId }),
  getWorkflowStatus: (jobId) => request('GET', `/api/workflow/status?jobId=${jobId}`),

  // --- ExCards ---
  getExcards: () => request('GET', '/api/excards'),
  getExcard: (id) => request('GET', `/api/excards/${id}`),
  getExcardMd: (id) => request('GET', `/api/excards/${id}/md`),
  createExcard: (data) => request('POST', '/api/excards', data),
  updateExcard: (id, data) => request('PUT', `/api/excards/${id}`, data),
  updateExcardMd: (id, markdown) => request('PUT', `/api/excards/${id}/md`, { markdown }),
  deleteExcard: (id) => request('DELETE', `/api/excards/${id}`),

  // --- Messages ---
  sendMessage: (agentId, content, type = 'chat', agentName) =>
    request('POST', '/api/message/send', { agentId, content, type, agentName }),
};

export default api;
