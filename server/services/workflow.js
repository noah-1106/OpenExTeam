/**
 * Workflow Service - Job 多步骤编排
 *
 * 设计原则：
 * - Job 可以有多个步骤（job_steps 表）
 * - 每个步骤可以是 Task 或 ExCard
 * - ExCard 是一个完整的步骤（不再拆分内部 workflow）
 * - Agent 回复后自动流转到下一步
 * - 出错时停止并通知
 */

const { queryAll, queryGet, queryRun, beginTransaction, commitTransaction, rollbackTransaction, runTransaction } = require('../models/db');
const { broadcast } = require('../events/sse');
const { getJob } = require('../models/job');
const { getExcard, getExcardMd } = require('../storage/excards');
const { getStepsForJob, updateStep } = require('../models/job_steps');
const { v4: uuidv4 } = require('uuid');

// 从外部传入 activeWorkflows 和 activeAdapters 映射
let activeWorkflows = null;
let activeAdapters = null;

function setActiveWorkflowsRef(ref) {
  activeWorkflows = ref;
}

function setActiveAdaptersRef(ref) {
  activeAdapters = ref;
}

/**
 * 向聊天界面发送系统消息
 */
function sendSystemMessageToChat(jobId, messageType, content, relatedAgent = null) {
  try {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    queryRun(
      'INSERT INTO message_log (id,type,from_agent,to_agent,content,timestamp,job_id) VALUES (?,?,?,?,?,?,?)',
      [messageId, messageType, 'system', relatedAgent || 'dashboard', JSON.stringify(content), timestamp, jobId]
    );

    broadcast('agent_message', {
      id: messageId,
      type: messageType,
      from: 'system',
      to: relatedAgent || 'dashboard',
      content: content,
      timestamp: timestamp,
      jobId: jobId
    });

    // 同时广播日志事件
    broadcast('log', {
      id: messageId,
      type: messageType,
      from: 'system',
      to: relatedAgent || 'dashboard',
      content: content,
      timestamp: timestamp,
      jobId: jobId
    });

    console.log(`[Workflow] System message sent: ${messageType}`);
  } catch (err) {
    console.error('[Workflow] Failed to send system message:', err.message);
  }
}

/**
 * 获取 Job 步骤
 */
function getJobSteps(jobId) {
  return getStepsForJob(jobId);
}

function startWorkflow(jobId) {
  try {
    const job = getJob(jobId);
    if (!job) {
      console.warn(`[Workflow] Job ${jobId} not found`);
      return { success: false, error: 'Job not found' };
    }

    if (job.status === 'in-progress') {
      console.warn(`[Workflow] Job ${jobId} already in progress`);
      return { success: false, error: 'Job already in progress' };
    }

    // 如果是已完成的工作，我们允许重新启动
    if (job.status === 'done') {
      console.log(`[Workflow] Restarting completed job ${jobId}`);
    }

    // 获取 Job 步骤
    let jobSteps = getJobSteps(jobId);
    let hasSteps = jobSteps && jobSteps.length > 0;
    let totalSteps = hasSteps ? jobSteps.length : 1; // 如果没有步骤，就只执行一次
    let currentStepIndex = 1;

    // 确定执行 Agent
    let agentName = null;

    if (hasSteps) {
      const firstStep = jobSteps[0];
      agentName = firstStep.agent || job.agent;
    } else {
      // 没有步骤的旧版情况，用 Job 绑定的 ExCard 的 agent
      agentName = job.agent;
    }

    if (!agentName) {
      console.error(`[Workflow] No agent specified for job ${jobId}`);
      return { success: false, error: 'Job 必须指定执行 Agent' };
    }

    // 使用事务更新状态
    beginTransaction();
    try {
      queryRun('UPDATE jobs SET status=? WHERE id=?', ['in-progress', jobId]);
      queryRun(
        'INSERT OR REPLACE INTO workflow_state (job_id,status,current_step,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP)',
        [jobId, 'running', currentStepIndex]
      );
      commitTransaction();
    } catch (txErr) {
      rollbackTransaction();
      throw txErr;
    }

    broadcast('workflow_started', { jobId, currentStep: currentStepIndex, totalSteps });

    const startMessage = {
      title: '工作流已启动',
      jobTitle: job.title,
      message: `工作「${job.title}」已开始执行`,
      currentStep: currentStepIndex,
      totalSteps: totalSteps
    };

    sendSystemMessageToChat(jobId, 'workflow_start', startMessage, agentName);

    // 发送第一个步骤或单个任务
    if (hasSteps) {
      sendJobStepToAgent(job, jobSteps[0], currentStepIndex, jobSteps, agentName);
    } else {
      sendSingleJobToAgent(job, agentName);
    }

    return {
      success: true,
      started: true,
      currentStep: currentStepIndex,
      totalSteps: totalSteps
    };

  } catch (err) {
    console.error('[Workflow] Error starting workflow:', err.message);
    try {
      queryRun('UPDATE jobs SET status=? WHERE id=?', ['idle', jobId]);
    } catch (rollbackErr) {
      console.error('[Workflow] Failed to rollback job status:', rollbackErr.message);
    }
    return { success: false, error: err.message };
  }
}

/**
 * 发送 Job 步骤给 Agent
 */
function sendJobStepToAgent(job, step, stepIndex, allSteps, agentName) {
  console.log(`[Workflow] Sending step ${stepIndex}/${allSteps.length} to agent: ${agentName}`);

  let adapterName, gatewayAgentId;
  if (agentName.includes(':')) {
    const colonIdx = agentName.indexOf(':');
    adapterName = agentName.slice(0, colonIdx);
    gatewayAgentId = agentName.slice(colonIdx + 1);
  } else {
    adapterName = Array.from(activeAdapters.keys())[0];
    gatewayAgentId = agentName;
  }

  const adapter = activeAdapters.get(adapterName);
  if (!adapter) {
    console.warn(`[Workflow] Adapter ${adapterName} not found`);
    handleWorkflowError(job.id, agentName, `Adapter ${adapterName} 未找到`);
    return;
  }

  const isExcardStep = (step.step_type || step.stepType) === 'excard';
  let messageContent = `请执行工作「${job.title}」的第 ${stepIndex}/${allSteps.length} 步\n\n`;
  messageContent += `步骤名称：${step.title}\n`;
  if (step.description) {
    messageContent += `步骤描述：${step.description}\n`;
  }

  if (isExcardStep && step.excard_id) {
    try {
      const excardMd = getExcardMd(step.excard_id);
      messageContent += `\n---\n\n关联 ExCard 模板：\n\n${excardMd}`;
    } catch (e) {
      console.warn('[Workflow] Failed to load step ExCard:', e.message);
    }
  }

  messageContent += `\n---\n\n完成后请按以下格式回复，以便系统自动推进到下一步：\n\n`;
  messageContent += `[WORKFLOW job-${job.id} step-${stepIndex}]\nstatus: complete\nmessage: （简要说明完成情况）\n\n`;
  messageContent += `如果出错，请回复：\n\n`;
  messageContent += `[WORKFLOW job-${job.id} step-${stepIndex}]\nstatus: error\nmessage: （错误说明）`;

  // Update step status to in-progress
  try {
    updateStep(step.id, { status: 'in-progress' });
  } catch (e) {
    console.warn('[Workflow] Failed to update step status:', e.message);
  }

  adapter.send(gatewayAgentId, {
    type: 'workflow_step',
    jobId: job.id,
    stepIndex: stepIndex,
    totalSteps: allSteps.length,
    stepType: step.step_type || step.stepType,
    stepId: step.id,
    content: {
      title: step.title,
      description: step.description,
      excardId: step.excard_id,
      fullPrompt: messageContent
    }
  }).then(() => {
    if (activeWorkflows) {
      activeWorkflows.set(agentName, job.id);
      console.log(`[Workflow] Registered active workflow: ${agentName} -> ${job.id} (step ${stepIndex})`);
    }

    sendSystemMessageToChat(job.id, 'message_sent', {
      title: '消息已发送',
      message: `已将第 ${stepIndex}/${allSteps.length} 步发送给 ${agentName}`,
      agentName: agentName,
      currentStep: stepIndex,
      totalSteps: allSteps.length
    }, agentName);

  }).catch(err => {
    console.error('[Workflow] Send failed:', err.message);
    handleWorkflowError(job.id, agentName, `发送失败: ${err.message}`);
  });
}

/**
 * 发送单个 Job 给 Agent（旧版兼容）
 */
function sendSingleJobToAgent(job, agentName) {
  console.log(`[Workflow] Sending single job ${job.id} to Agent`);

  let adapterName, gatewayAgentId;
  if (agentName.includes(':')) {
    const colonIdx = agentName.indexOf(':');
    adapterName = agentName.slice(0, colonIdx);
    gatewayAgentId = agentName.slice(colonIdx + 1);
  } else {
    adapterName = Array.from(activeAdapters.keys())[0];
    gatewayAgentId = agentName;
  }

  const adapter = activeAdapters.get(adapterName);
  if (!adapter) {
    console.warn(`[Workflow] Adapter ${adapterName} not found`);
    handleWorkflowError(job.id, agentName, `Adapter ${adapterName} 未找到`);
    return;
  }

  let messageContent = `请执行工作「${job.title}」`;
  if (job.description) {
    messageContent += `\n\n工作描述：${job.description}`;
  }

  const excardId = job.excard_id || job.excard;
  if (excardId) {
    try {
      const excardMd = getExcardMd(excardId);
      messageContent += `\n\n---\n\n完整 ExCard 模板参考：\n\n${excardMd}`;
    } catch (e) {
      console.warn('[Workflow] Failed to load ExCard:', e.message);
    }
  }

  messageContent += `\n---\n\n完成后请按以下格式回复：\n\n`;
  messageContent += `[WORKFLOW job-${job.id}]\nstatus: complete\nmessage: （简要说明完成情况）\n\n`;
  messageContent += `如果出错，请回复：\n\n`;
  messageContent += `[WORKFLOW job-${job.id}]\nstatus: error\nmessage: （错误说明）`;

  adapter.send(gatewayAgentId, {
    type: 'workflow_start',
    jobId: job.id,
    content: {
      title: job.title,
      description: job.description,
      excardId: excardId,
      fullPrompt: messageContent
    }
  }).then(() => {
    if (activeWorkflows) {
      activeWorkflows.set(agentName, job.id);
    }
    sendSystemMessageToChat(job.id, 'message_sent', {
      title: '消息已发送',
      message: `已将任务发送给 ${agentName}`,
      agentName: agentName
    }, agentName);
  }).catch(err => {
    console.error('[Workflow] Send failed:', err.message);
    handleWorkflowError(job.id, agentName, `发送失败: ${err.message}`);
  });
}

/**
 * 处理工作流错误
 */
function handleWorkflowError(jobId, agentName, errorMessage) {
  try {
    beginTransaction();
    queryRun('UPDATE jobs SET status=? WHERE id=?', ['idle', jobId]);
    queryRun('UPDATE workflow_state SET status=? WHERE job_id=?', ['error', jobId]);
    commitTransaction();
  } catch (e) {
    console.error('[Workflow] Failed to update status:', e.message);
    try { rollbackTransaction(); } catch (re) {}
  }

  if (activeWorkflows) {
    activeWorkflows.delete(agentName);
  }

  sendSystemMessageToChat(jobId, 'workflow_error', {
    title: '工作流出错',
    message: errorMessage,
    agentName: agentName
  }, agentName);

  broadcast('workflow_error', { jobId, error: errorMessage });
}

/**
 * 处理 Agent 的回复消息，推动工作流进度
 */
/**
 * 解析 Agent 工作流回复
 * 格式: [WORKFLOW job-id step-id]
 */
function parseWorkflowReply(messageText) {
  const text = messageText || '';

  // 匹配工作流标记：
  // [WORKFLOW]
  // [WORKFLOW job-123]
  // [WORKFLOW job-123 step=2]
  // [WORKFLOW job-123 step-2]
  const markerPattern = /\[WORKFLOW(?:\s+([^\]]*))?\]/;
  const markerMatch = text.match(markerPattern);

  if (!markerMatch) {
    return { isWorkflow: false };
  }

  const result = { isWorkflow: true };

  // 解析标记里的内容
  const markerContent = markerMatch[1] || '';
  if (markerContent) {
    const jobMatch = markerContent.match(/job[-\s]?=?\s*['"]?([\w-]+)['"]?/i);
    const stepMatch = markerContent.match(/step[-\s]?=?\s*['"]?([\w-]+)['"]?/i);

    if (jobMatch) result.jobId = jobMatch[1];
    if (stepMatch) result.stepId = stepMatch[1];
  }

  // 解析键值对
  const keyValuePattern = /(\w+)\s*[=:]\s*"?([^"\n]+)"?/g;
  let match;

  while ((match = keyValuePattern.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    result[key] = value;
  }

  // 找 message（可能在后面多行）
  const messageMatch = text.match(/message[=:]\s*([^\n]+(?:\n(?!\w+[=:])[^\n]+)*)/i);
  if (messageMatch) {
    result.message = messageMatch[1].trim();
  }

  return result;
}

function handleAgentReply(agentName, message, jobId) {
  try {
    console.log(`[Workflow] Handling reply from ${agentName} for job ${jobId}`);

    if (!agentName || !jobId) {
      return { handled: false, action: 'none', error: 'Missing params' };
    }

    const job = getJob(jobId);
    if (!job || job.status === 'done') {
      if (activeWorkflows) activeWorkflows.delete(agentName);
      return { handled: false, action: 'none' };
    }

    const messageText = typeof message === 'string' ? message :
                        (message.content || message.text || JSON.stringify(message));

    sendSystemMessageToChat(jobId, 'agent_reply', {
      title: '收到 Agent 回复',
      message: `${agentName}: ${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}`,
      agentName: agentName
    }, agentName);

    const workflowReply = parseWorkflowReply(messageText);
    if (!workflowReply.isWorkflow) {
      console.log(`[Workflow] Not a workflow update message, continuing`);
      return { handled: false, action: 'none' };
    }

    console.log(`[Workflow] Parsed workflow reply:`, workflowReply);

    // 验证 jobId 是否匹配
    if (workflowReply.jobId && workflowReply.jobId !== jobId) {
      console.log(`[Workflow] Job ID mismatch: reply has ${workflowReply.jobId} != expected ${jobId}`);
      // 不匹配但继续，可能是其他 Job 的消息
      return { handled: false, action: 'none' };
    }

    const status = (workflowReply.status || '').toLowerCase();
    const isError = status === 'error' || status === 'failed' || status === 'failure';

    if (isError) {
      const errorMsg = workflowReply.message || 'Agent 报告了错误';
      console.log(`[Workflow] Agent reported error for job ${jobId}: ${errorMsg}`);

      // Update current step status to error
      try {
        const workflowState = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
        const currentStep = workflowState?.current_step || 0;
        const jobSteps = getJobSteps(jobId);
        if (jobSteps && jobSteps[currentStep - 1]) {
          updateStep(jobSteps[currentStep - 1].id, { status: 'error' });
        }
      } catch (e) {
        console.warn('[Workflow] Failed to update step status to error:', e.message);
      }

      handleWorkflowError(jobId, agentName, errorMsg);
      return { handled: true, action: 'error' };
    }

    const isComplete = status === 'complete' || status === 'success' || status === 'done';
    if (!isComplete) {
      console.log(`[Workflow] Status '${status}' not marked as complete, continuing`);
      return { handled: false, action: 'none' };
    }

    console.log(`[Workflow] Agent ${agentName} completed step for job ${jobId}`);

    const workflowState = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
    const currentStep = workflowState?.current_step || 0;

    // 验证 stepId 是否匹配（如果有）
    if (workflowReply.stepId) {
      const replyStep = parseInt(workflowReply.stepId, 10);
      if (!isNaN(replyStep) && replyStep !== currentStep) {
        console.log(`[Workflow] Step ID mismatch: reply has step ${replyStep} != current step ${currentStep}`);
        // 如果不匹配，可能是过期的回复，不处理
        return { handled: false, action: 'none' };
      }
    }

    const jobSteps = getJobSteps(jobId);
    const hasSteps = jobSteps && jobSteps.length > 0;

    // Mark current step as completed
    if (hasSteps && jobSteps[currentStep - 1]) {
      try {
        updateStep(jobSteps[currentStep - 1].id, { status: 'completed' });
      } catch (e) {
        console.warn('[Workflow] Failed to update step status to completed:', e.message);
      }
    }

    const hasNextStep = hasSteps ? currentStep < jobSteps.length : false;

    if (hasNextStep) {
      const nextStepIndex = currentStep + 1;
      console.log(`[Workflow] Advancing to step ${nextStepIndex}/${jobSteps.length}`);

      // 使用事务更新步骤状态
      try {
        beginTransaction();
        // 标记当前步骤为完成
        if (hasSteps && jobSteps[currentStep - 1]) {
          updateStep(jobSteps[currentStep - 1].id, { status: 'completed' });
        }
        // 更新工作流状态到下一步
        queryRun('UPDATE workflow_state SET current_step=? WHERE job_id=?', [nextStepIndex, jobId]);
        commitTransaction();
      } catch (txErr) {
        rollbackTransaction();
        console.error('[Workflow] Transaction failed while advancing step:', txErr.message);
        handleWorkflowError(jobId, agentName, '工作流推进失败: ' + txErr.message);
        return { handled: true, action: 'error', error: txErr.message };
      }

      broadcast('workflow_step_advanced', { jobId, currentStep: nextStepIndex, totalSteps: jobSteps.length });

      sendSystemMessageToChat(jobId, 'workflow_step', {
        title: '工作流推进',
        message: `正在执行第 ${nextStepIndex}/${jobSteps.length} 步`,
        currentStep: nextStepIndex,
        totalSteps: jobSteps.length
      }, agentName);

      const nextStep = jobSteps[nextStepIndex - 1];
      const nextAgentName = nextStep.agent || agentName;

      // 清理旧的 agentName 的 activeWorkflows 记录
      if (activeWorkflows && agentName !== nextAgentName) {
        activeWorkflows.delete(agentName);
        console.log(`[Workflow] Unregistered old agent: ${agentName} for job ${jobId}`);
      }

      sendJobStepToAgent(job, nextStep, nextStepIndex, jobSteps, nextAgentName);

      return { handled: true, action: 'advanced', nextStep: nextStepIndex };

    } else {
      console.log(`[Workflow] All steps completed for job ${jobId}`);

      // 使用事务完成工作流
      try {
        beginTransaction();
        // 标记最后一步为完成
        if (hasSteps && jobSteps[currentStep - 1]) {
          updateStep(jobSteps[currentStep - 1].id, { status: 'completed' });
        }
        commitTransaction();
      } catch (txErr) {
        rollbackTransaction();
        console.warn('[Workflow] Failed to mark final step complete:', txErr.message);
      }

      completeWorkflow(jobId, agentName);

      if (activeWorkflows) {
        activeWorkflows.delete(agentName);
      }
      return { handled: true, action: 'complete' };
    }

  } catch (err) {
    console.error('[Workflow] Error in handleAgentReply:', err.message);
    if (agentName && activeWorkflows) {
      activeWorkflows.delete(agentName);
    }
    return { handled: false, action: 'error', error: err.message };
  }
}

function completeWorkflow(jobId, agentName = null) {
  try {
    beginTransaction();
    queryRun(
      'UPDATE workflow_state SET status=?,completed_at=CURRENT_TIMESTAMP WHERE job_id=?',
      ['completed', jobId]
    );
    queryRun('UPDATE jobs SET status=? WHERE id=?', ['done', jobId]);
    commitTransaction();
  } catch (e) {
    console.error('[Workflow] Failed to mark complete:', e.message);
    try { rollbackTransaction(); } catch (re) {}
    return;
  }

  broadcast('workflow_completed', { jobId });
  console.log(`[Workflow] Job ${jobId} marked as complete`);

  sendSystemMessageToChat(jobId, 'workflow_complete', {
    title: '工作流已完成',
    message: agentName ? `工作已由 ${agentName} 完成` : '工作已完成',
    agentName: agentName
  }, agentName);
}

function getWorkflowStatus(jobId) {
  const state = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
  if (!state) {
    return { jobId, status: 'idle', currentStep: 0, totalSteps: 0 };
  }

  let totalSteps = 0;
  const job = getJob(jobId);
  if (job) {
    const jobSteps = getJobSteps(jobId);
    totalSteps = (jobSteps && jobSteps.length > 0) ? jobSteps.length : 1;
  }

  return {
    jobId,
    status: state.status,
    currentStep: state.current_step || 0,
    totalSteps: totalSteps,
    startedAt: state.started_at,
    completedAt: state.completed_at
  };
}

module.exports = {
  startWorkflow,
  completeWorkflow,
  getWorkflowStatus,
  handleAgentReply,
  setActiveWorkflowsRef,
  setActiveAdaptersRef,
  sendSystemMessageToChat,
  getJobSteps,
  parseWorkflowReply
};
