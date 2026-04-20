/**
 * Job Model - 工作数据操作
 */

const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('./db');
const { broadcast } = require('../events/sse');

function getAllJobs() {
  const jobs = queryAll('SELECT * FROM jobs ORDER BY created_at DESC');
  // 将 snake_case 转换为 camelCase，并添加 excard 字段用于前端兼容性
  return jobs.map(job => ({
    ...job,
    excardId: job.excard_id,
    excard: job.excard_id,  // 前端兼容性
    agentId: job.agent  // 前端兼容性
  }));
}

function createJob(data) {
  const id = data.id || uuidv4();
  // 支持 excardId 和 excard 两种字段名
  const excardId = data.excardId || data.excard;
  // Job 不强制指定 agent - agent 在 ExCard 步骤或 Task 中指定
  const agent = data.agent || data.agentId || null;
  queryRun(
    'INSERT INTO jobs (id,title,description,type,excard_id,agent) VALUES (?,?,?,?,?,?)',
    [id, data.title, data.description, data.type || 'one-time', excardId, agent]
  );
  return { id };
}

function updateJob(id, data) {
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  // 支持 excardId 和 excard 两种字段名
  const excardId = data.excardId ?? data.excard ?? job.excard_id;
  // 支持 agent 和 agentId 两种字段名
  const agent = data.agent ?? data.agentId ?? job.agent;
  queryRun(
    'UPDATE jobs SET title=?,description=?,status=?,excard_id=?,agent=? WHERE id=?',
    [data.title ?? job.title, data.description ?? job.description,
     data.status ?? job.status, excardId, agent, id]
  );
  const updated = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  // 返回时添加 camelCase 字段
  return {
    ...updated,
    excardId: updated.excard_id,
    excard: updated.excard_id,
    agentId: updated.agent
  };
}

function getJob(id) {
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  return {
    ...job,
    excardId: job.excard_id,
    excard: job.excard_id,
    agentId: job.agent  // 前端兼容性
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
