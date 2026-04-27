/**
 * 服务端常量定义
 * 统一管理 magic strings 和配置值
 */

// 工作流完成状态关键词（Agent 回复中检测这些值）
const WORKFLOW_COMPLETE_STATUSES = ['complete', 'success', 'done'];

// Agent 在线状态
const AGENT_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
};

// Job 状态
const JOB_STATUS = {
  IDLE: 'idle',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  ERROR: 'error',
};

// Task 状态
const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
};

// 步骤状态
const STEP_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  ERROR: 'error',
};

module.exports = {
  WORKFLOW_COMPLETE_STATUSES,
  AGENT_STATUS,
  JOB_STATUS,
  TASK_STATUS,
  STEP_STATUS,
};
