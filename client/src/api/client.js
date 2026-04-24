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

  try {
    const res = await fetch(`${BASE}${path}`, opts);

    // 尝试解析响应
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // 如果不是JSON，尝试读取文本
      const text = await res.text();
      data = { error: text || `HTTP ${res.status}` };
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
      console.error(`[API] ${method} ${path} failed:`, errorMsg);
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    // 网络错误等
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.error(`[API] Network error for ${method} ${path}:`, err);
      throw new Error('网络连接失败，请检查服务器是否运行');
    }
    console.error(`[API] ${method} ${path} error:`, err);
    throw err;
  }
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
  getJobExcard: (id) => request('GET', `/api/jobs/${id}/excard`),
  getJobSteps: (id) => request('GET', `/api/jobs/${id}/steps`),

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
  getMessageHistory: (agentId, limit = 50) =>
    request('GET', `/api/messages/history?agentId=${encodeURIComponent(agentId)}&limit=${limit}`),
};

export default api;
