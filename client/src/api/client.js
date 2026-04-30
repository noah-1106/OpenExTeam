/**
 * API Client - 封装所有后端 HTTP 调用
 * 基准地址: http://localhost:4000
 */

const BASE = window.location.origin.replace(/:\d+$/, ':4000');
const SSE_URL = `${BASE}/api/events`;

export { BASE, SSE_URL };

// API Key 鉴权：从 localStorage 读取，后端未启用时忽略
function getApiKey() {
  try { return localStorage.getItem('openexteam_api_key') || ''; } catch { return ''; }
}

const ERROR_MESSAGES = {
  'Failed to fetch': '网络连接失败，请检查服务器是否运行',
  'ECONNREFUSED': '服务器未响应，请检查后端服务是否启动',
  401: '认证失败，请检查 API Key',
  403: '权限不足',
  404: '请求的资源不存在',
  500: '服务器内部错误，请稍后重试',
  502: '服务器网关错误，请稍后重试',
  503: '服务暂不可用，请稍后重试',
}

function friendlyError(err) {
  const msg = err.message || ''
  // HTTP 状态码匹配
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(code) || msg.includes(`HTTP ${code}`)) return text
  }
  // 网络错误关键词匹配
  for (const [keyword, text] of Object.entries(ERROR_MESSAGES)) {
    if (typeof keyword === 'string' && msg.includes(keyword)) return text
  }
  return msg
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const apiKey = getApiKey();
  if (apiKey) opts.headers['Authorization'] = `Bearer ${apiKey}`;
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
      const err = new Error(errorMsg);
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (err) {
    // 网络错误等
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.error(`[API] Network error for ${method} ${path}:`, err);
      throw new Error('网络连接失败，请检查服务器是否运行');
    }
    console.error(`[API] ${method} ${path} error:`, err);
    throw new Error(friendlyError(err));
  }
}

const api = {
  // --- Health ---
  health: () => request('GET', '/health'),

  // --- Config & Adapter ---
  getConfig: () => request('GET', '/api/config'),
  getAdapters: () => request('GET', '/api/config/adapters'),
  saveAdapters: (adapters) => request('POST', '/api/config/adapters', { adapters }),
  testAdapter: (type, url, token) => request('POST', '/api/adapter/test', { type, url, token }),
  connectAdapter: (name) => request('POST', `/api/adapter/${encodeURIComponent(name)}/connect`),
  disconnectAdapter: (name) => request('POST', `/api/adapter/${encodeURIComponent(name)}/disconnect`),
  resetCredentials: (type) => request('POST', '/api/adapter/reset-credentials', { type }),

  // --- Agents ---
  getAgents: () => request('GET', '/api/agents'),

  // --- Jobs ---
  getJobs: () => request('GET', '/api/jobs'),
  createJob: (data) => request('POST', '/api/jobs', data),
  updateJob: (id, data) => request('PATCH', `/api/jobs/${id}`, data),
  deleteJob: (id) => request('DELETE', `/api/jobs/${id}`),
  getJobExcard: (id) => request('GET', `/api/jobs/${id}/excard`),
  getJobSteps: (id) => request('GET', `/api/jobs/${id}/steps`),
  createJobStep: (jobId, data) => request('POST', `/api/jobs/${jobId}/steps`, data),
  updateJobStep: (stepId, data) => request('PATCH', `/api/job-steps/${stepId}`, data),
  deleteJobStep: (stepId) => request('DELETE', `/api/job-steps/${stepId}`),

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
  getSystemHistory: (limit = 50) =>
    request('GET', `/api/messages/history?type=system&limit=${limit}`),

  // --- Logs ---
  getLogs: (limit = 50) => request('GET', `/api/logs?limit=${limit}`),

  // --- Docs ---
  getDocs: () => request('GET', '/api/docs'),
  getDocContent: (filename) => request('GET', `/api/docs/${encodeURIComponent(filename)}`),
};

export default api;
