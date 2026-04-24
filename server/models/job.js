/**
 * Job Model - 工作数据操作
 */

const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('./db');
const { broadcast } = require('../events/sse');

function getAllJobs() {
  const jobs = queryAll('SELECT * FROM jobs ORDER BY created_at DESC');
  // 将 snake_case 转换为 camelCase，并添加 excard 字段用于前端兼容性
  return jobs.map(job => {
    let scheduleDays, scheduleTimes;
    try {
      scheduleDays = job.schedule_days ? JSON.parse(job.schedule_days) : [1, 2, 3, 4, 5];
    } catch (e) {
      scheduleDays = [1, 2, 3, 4, 5];
    }
    try {
      scheduleTimes = job.schedule_times ? JSON.parse(job.schedule_times) : ['09:00'];
    } catch (e) {
      scheduleTimes = ['09:00'];
    }
    return {
      ...job,
      excardId: job.excard_id,
      excard: job.excard_id,  // 前端兼容性
      agentId: job.agent,  // 前端兼容性
      scheduleType: job.schedule_type,
      scheduleDays,
      scheduleTimes
    };
  });
}

function createJob(data) {
  const id = data.id || uuidv4();
  // 支持 excardId 和 excard 两种字段名（向后兼容）
  const excardId = data.excardId || data.excard;
  // Job 不强制指定 agent - agent 在步骤中指定
  const agent = data.agent || data.agentId || null;
  // 周期设置
  const scheduleType = data.scheduleType || 'daily';
  const scheduleDays = data.scheduleDays ? JSON.stringify(data.scheduleDays) : JSON.stringify([1, 2, 3, 4, 5]);
  const scheduleTimes = data.scheduleTimes ? JSON.stringify(data.scheduleTimes) : JSON.stringify(['09:00']);

  queryRun(
    'INSERT INTO jobs (id,title,description,type,excard_id,agent,schedule_type,schedule_days,schedule_times) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, data.title, data.description, data.type || 'one-time', excardId, agent,
     scheduleType, scheduleDays, scheduleTimes]
  );
  return { id };
}

function updateJob(id, data) {
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;

  // 支持 excardId 和 excard 两种字段名（向后兼容）
  const excardId = data.excardId ?? data.excard ?? job.excard_id;
  const agent = data.agent ?? data.agentId ?? job.agent;

  // 周期设置
  const scheduleType = data.scheduleType ?? job.schedule_type ?? 'daily';
  const scheduleDays = data.scheduleDays !== undefined
    ? JSON.stringify(data.scheduleDays)
    : job.schedule_days;
  const scheduleTimes = data.scheduleTimes !== undefined
    ? JSON.stringify(data.scheduleTimes)
    : job.schedule_times;

  queryRun(
    'UPDATE jobs SET title=?,description=?,status=?,excard_id=?,agent=?,schedule_type=?,schedule_days=?,schedule_times=? WHERE id=?',
    [data.title ?? job.title, data.description ?? job.description,
     data.status ?? job.status, excardId, agent,
     scheduleType, scheduleDays, scheduleTimes, id]
  );

  const updated = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  // 返回时添加 camelCase 字段
  return {
    ...updated,
    excardId: updated.excard_id,
    excard: updated.excard_id,
    agentId: updated.agent,
    scheduleType: updated.schedule_type,
    scheduleDays: updated.schedule_days ? JSON.parse(updated.schedule_days) : [1, 2, 3, 4, 5],
    scheduleTimes: updated.schedule_times ? JSON.parse(updated.schedule_times) : ['09:00']
  };
}

function getJob(id) {
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  let scheduleDays, scheduleTimes;
  try {
    scheduleDays = job.schedule_days ? JSON.parse(job.schedule_days) : [1, 2, 3, 4, 5];
  } catch (e) {
    scheduleDays = [1, 2, 3, 4, 5];
  }
  try {
    scheduleTimes = job.schedule_times ? JSON.parse(job.schedule_times) : ['09:00'];
  } catch (e) {
    scheduleTimes = ['09:00'];
  }
  return {
    ...job,
    excardId: job.excard_id,
    excard: job.excard_id,
    agentId: job.agent,
    scheduleType: job.schedule_type,
    scheduleDays,
    scheduleTimes
  };
}

function deleteJob(id) {
  queryRun('DELETE FROM tasks WHERE job_id = ?', [id]);
  queryRun('DELETE FROM workflow_state WHERE job_id = ?', [id]);
  queryRun('DELETE FROM jobs WHERE id = ?', [id]);
  broadcast('job_deleted', { id });
  return { success: true };
}

module.exports = {
  getAllJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob
};
