/**
 * Workflow Service - 工作流推进逻辑
 */

const { queryAll, queryGet, queryRun } = require('../models/db');
const { broadcast } = require('../events/sse');

function startWorkflow(jobId, activeAdapters) {
  const tasks = queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId]);
  if (!tasks.length) {
    return { success: false, error: 'No tasks found' };
  }

  const firstTodo = tasks.find(t => t.status === 'todo');
  if (!firstTodo) {
    return {
      success: false,
      error: tasks.every(t => t.status === 'done') ? 'All done' : 'No pending'
    };
  }

  const stepIndex = tasks.indexOf(firstTodo) + 1;
  queryRun(
    'INSERT OR REPLACE INTO workflow_state (job_id,status,current_step,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP)',
    [jobId, 'running', stepIndex]
  );
  queryRun(
    'UPDATE tasks SET status=?,step_index=? WHERE id=?',
    ['in-progress', stepIndex, firstTodo.id]
  );
  queryRun('UPDATE jobs SET status=? WHERE id=?', ['in-progress', jobId]);

  broadcast('workflow_started', {
    jobId,
    currentStep: stepIndex,
    totalSteps: tasks.length
  });
  broadcast('task_updated', { taskId: firstTodo.id, status: 'in-progress' });

  sendTaskToAgent(firstTodo, jobId, stepIndex, tasks.length, activeAdapters);

  return {
    success: true,
    started: true,
    firstTask: { taskId: firstTodo.id, agentId: firstTodo.agent, stepIndex, totalSteps: tasks.length }
  };
}

function sendTaskToAgent(task, jobId, stepIndex, totalSteps, activeAdapters) {
  let adapterName, gatewayAgentId;
  if (task.agent && task.agent.includes(':')) {
    const colonIdx = task.agent.indexOf(':');
    adapterName = task.agent.slice(0, colonIdx);
    gatewayAgentId = task.agent.slice(colonIdx + 1);
  } else {
    adapterName = Array.from(activeAdapters.keys())[0];
    gatewayAgentId = task.agent;
  }

  const adapter = activeAdapters.get(adapterName);
  if (adapter) {
    adapter.send(gatewayAgentId, {
      type: 'workflow_step',
      jobId,
      taskId: task.id,
      stepIndex,
      totalSteps,
      content: { title: task.title, description: task.description, context: `步骤 ${stepIndex}/${totalSteps}` }
    }).catch(err => console.error('[Workflow]', err.message));
  }
}

function advanceWorkflow(jobId, activeAdapters, res) {
  const tasks = queryAll('SELECT * FROM tasks WHERE job_id = ? ORDER BY created_at ASC', [jobId]);
  const next = tasks.find(t => t.status === 'todo');

  if (next) {
    const stepIndex = tasks.indexOf(next) + 1;
    queryRun('UPDATE tasks SET status=?,step_index=? WHERE id=?', ['in-progress', stepIndex, next.id]);
    queryRun('UPDATE workflow_state SET current_step=? WHERE job_id=?', [stepIndex, jobId]);
    broadcast('workflow_step', { jobId, nextTaskId: next.id, stepIndex, totalSteps: tasks.length });
    broadcast('task_updated', { taskId: next.id, status: 'in-progress' });

    sendTaskToAgent(next, jobId, stepIndex, tasks.length, activeAdapters);

    if (res) {
      res.json({
        success: true,
        advanced: true,
        nextTask: { taskId: next.id, agentId: next.agent, stepIndex, totalSteps: tasks.length }
      });
    }
  } else {
    queryRun(
      'UPDATE workflow_state SET status=?,completed_at=CURRENT_TIMESTAMP WHERE job_id=?',
      ['completed', jobId]
    );
    queryRun('UPDATE jobs SET status=? WHERE id=?', ['done', jobId]);
    broadcast('workflow_completed', { jobId });

    if (res) {
      res.json({ success: true, completed: true });
    }
  }
}

function getWorkflowStatus(jobId) {
  const state = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
  if (!state) {
    return { jobId, status: 'idle', currentStep: 0 };
  }
  const current = queryGet(
    'SELECT id as taskId, agent FROM tasks WHERE job_id = ? AND status = ?',
    [jobId, 'in-progress']
  );
  return {
    jobId,
    status: state.status,
    currentStep: state.current_step,
    currentTaskId: current?.taskId,
    currentAgent: current?.agent,
    startedAt: state.started_at,
    completedAt: state.completed_at
  };
}

module.exports = {
  startWorkflow,
  advanceWorkflow,
  getWorkflowStatus
};
