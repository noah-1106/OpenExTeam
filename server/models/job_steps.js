/**
 * Job Steps Model - 工作步骤数据操作
 * 支持 Task 和 ExCard 混合编排
 */

const { v4: uuidv4 } = require('uuid');
const { queryAll, queryGet, queryRun } = require('./db');

function getStepsForJob(jobId) {
  const steps = queryAll(
    'SELECT * FROM job_steps WHERE job_id = ? ORDER BY step_order ASC',
    [jobId]
  );
  return steps.map(step => ({
    ...step,
    excardId: step.excard_id
  }));
}

function createStep(data) {
  const id = data.id || uuidv4();
  queryRun(
    'INSERT INTO job_steps (id,job_id,step_order,step_type,title,description,agent,excard_id,status) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, data.jobId, data.stepOrder || 0, data.stepType || 'task', data.title,
     data.description || null, data.agent || null, data.excardId || null, data.status || 'pending']
  );
  return { id };
}

function updateStep(id, data) {
  const step = queryGet('SELECT * FROM job_steps WHERE id = ?', [id]);
  if (!step) return null;

  queryRun(
    'UPDATE job_steps SET step_order=?,step_type=?,title=?,description=?,agent=?,excard_id=?,status=? WHERE id=?',
    [data.stepOrder ?? step.step_order, data.stepType ?? step.step_type,
     data.title ?? step.title, data.description ?? step.description,
     data.agent ?? step.agent, data.excardId ?? step.excard_id,
     data.status ?? step.status, id]
  );

  return queryGet('SELECT * FROM job_steps WHERE id = ?', [id]);
}

function deleteStep(id) {
  queryRun('DELETE FROM job_steps WHERE id = ?', [id]);
  return { success: true };
}

function deleteStepsForJob(jobId) {
  queryRun('DELETE FROM job_steps WHERE job_id = ?', [jobId]);
  return { success: true };
}

function reorderSteps(jobId, stepIds) {
  stepIds.forEach((stepId, index) => {
    queryRun('UPDATE job_steps SET step_order = ? WHERE id = ?', [index, stepId]);
  });
  return { success: true };
}

module.exports = {
  getStepsForJob,
  createStep,
  updateStep,
  deleteStep,
  deleteStepsForJob,
  reorderSteps
};
