/**
 * Job Model - 工作数据操作
 */

const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('./db');
const { broadcast } = require('../events/sse');

function getAllJobs() {
  return queryAll('SELECT * FROM jobs ORDER BY created_at DESC');
}

function createJob(data) {
  const id = data.id || uuidv4();
  queryRun(
    'INSERT INTO jobs (id,title,description,type,excard_id) VALUES (?,?,?,?,?)',
    [id, data.title, data.description, data.type || 'one-time', data.excardId]
  );
  return { id };
}

function updateJob(id, data) {
  const job = queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  queryRun(
    'UPDATE jobs SET title=?,description=?,status=?,excard_id=? WHERE id=?',
    [data.title ?? job.title, data.description ?? job.description,
     data.status ?? job.status, data.excardId ?? job.excard_id, id]
  );
  return queryGet('SELECT * FROM jobs WHERE id = ?', [id]);
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
  createJob,
  updateJob,
  deleteJob
};
