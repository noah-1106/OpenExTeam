/**
 * Task Model - 任务数据操作
 */

const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('./db');
const { broadcast } = require('../events/sse');

function getTasks(jobId) {
  return jobId
    ? queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId])
    : queryAll('SELECT * FROM tasks ORDER BY created_at ASC');
}

function createTask(data) {
  const id = data.id || uuidv4();
  queryRun(
    'INSERT INTO tasks (id,job_id,title,description,agent) VALUES (?,?,?,?,?)',
    [id, data.jobId, data.title, data.description, data.agent]
  );
  broadcast('task_created', { id, jobId: data.jobId, title: data.title, agent: data.agent });
  return { id };
}

function updateTaskStatus(taskId, status) {
  queryRun('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId]);
  broadcast('task_updated', { taskId, status });
}

function deleteTask(taskId) {
  queryRun('DELETE FROM tasks WHERE id = ?', [taskId]);
  broadcast('task_deleted', { taskId });
}

module.exports = {
  getTasks,
  createTask,
  updateTaskStatus,
  deleteTask
};
