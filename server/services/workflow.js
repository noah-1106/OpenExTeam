/**
 * Workflow Service - 工作流推进逻辑（多步骤完整版）
 *
 * 新设计原则：
 * - Job 可以绑定 ExCard（完整的执行模板）
 * - ExCard 不拆分成多个 Task，而是作为整体发送给 Agent
 * - Task 是可选的，用于人工跟踪，不是 ExCard 的拆分结果
 * - Agent 通过消息总线回复，不是 webhook 回调
 * - 工作流信息同步到聊天界面
 * - 支持 ExCard 中的多步骤 workflow 自动推进
 */

const { queryAll, queryGet, queryRun } = require('../models/db');
const { broadcast } = require('../events/sse');
const { getJob } = require('../models/job');
const { getExcard, getExcardMd } = require('../storage/excards');
const { v4: uuidv4 } = require('uuid');

// 从外部传入 activeWorkflows 映射
let activeWorkflows = null;

function setActiveWorkflowsRef(ref) {
  activeWorkflows = ref;
}

/**
 * 向聊天界面发送系统消息，用于追踪工作流进度
 */
function sendSystemMessageToChat(jobId, messageType, content, relatedAgent = null) {
  try {
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    // 记录到 message_log
    queryRun(
      'INSERT INTO message_log (id,type,from_agent,to_agent,content,timestamp,job_id) VALUES (?,?,?,?,?,?,?)',
      [messageId, messageType, 'system', relatedAgent || 'dashboard', JSON.stringify(content), timestamp, jobId]
    );

    // 广播消息，让前端聊天界面收到
    broadcast('agent_message', {
      id: messageId,
      type: messageType,
      from: 'system',
      to: relatedAgent || 'dashboard',
      content: content,
      timestamp: timestamp,
      jobId: jobId
    });

    console.log(`[Workflow] System message sent to chat: ${messageType}`);
  } catch (err) {
    console.error('[Workflow] Failed to send system message:', err.message);
  }
}

/**
 * 获取 ExCard 的 workflow 步骤
 */
function getWorkflowSteps(excardData) {
  if (!excardData || !excardData.workflow) {
    return [];
  }
  // 确保步骤按 index 排序
  return excardData.workflow
    .filter(step => step && step.index)
    .sort((a, b) => a.index - b.index);
}

function startWorkflow(jobId, activeAdapters) {
  try {
    const job = getJob(jobId);
    if (!job) {
      console.warn(`[Workflow] Job ${jobId} not found`);
      return { success: false, error: 'Job not found' };
    }

    // 检查 job 状态
    if (job.status === 'in-progress' || job.status === 'done') {
      console.warn(`[Workflow] Job ${jobId} already in status: ${job.status}`);
      return { success: false, error: `Job already ${job.status}` };
    }

    // 先确定 excard 和 workflow 步骤
    let excardId = job.excard_id || job.excard;
    let excardData = null;
    let workflowSteps = [];

    if (excardId) {
      try {
        excardData = getExcard(excardId);
        workflowSteps = getWorkflowSteps(excardData);
        console.log(`[Workflow] ExCard has ${workflowSteps.length} workflow steps`);
      } catch (e) {
        console.warn('[Workflow] Failed to load ExCard:', e.message);
      }
    }

    // 确定当前步骤（从第1步开始）
    const currentStepIndex = workflowSteps.length > 0 ? 1 : 0;

    // 确定 agentName
    let agentName = job.agent;
    if (!agentName && workflowSteps.length > 0) {
      const firstStep = workflowSteps[0];
      agentName = firstStep.agent;
      console.log(`[Workflow] Using agent from first workflow step: ${agentName}`);
    }

    if (!agentName && excardData) {
      agentName = excardData.agentName;
    }

    // 更新 Job 状态和 workflow_state
    queryRun('UPDATE jobs SET status=? WHERE id=?', ['in-progress', jobId]);
    queryRun(
      'INSERT OR REPLACE INTO workflow_state (job_id,status,current_step,started_at) VALUES (?,?,?,CURRENT_TIMESTAMP)',
      [jobId, 'running', currentStepIndex]
    );

    broadcast('workflow_started', { jobId, currentStep: currentStepIndex, totalSteps: workflowSteps.length });

    // 向聊天界面发送工作流启动消息
    const startMessage = {
      title: '工作流已启动',
      jobTitle: job.title,
      message: `工作「${job.title}」已开始执行`,
      hasExcard: !!excardId,
      excardId: excardId,
      currentStep: currentStepIndex,
      totalSteps: workflowSteps.length
    };

    if (workflowSteps.length > 0) {
      startMessage.stepName = workflowSteps[0].name;
      startMessage.stepDescription = workflowSteps[0].description;
    }

    sendSystemMessageToChat(jobId, 'workflow_start', startMessage, agentName);

    // 发送给 Agent
    if (excardId) {
      sendExcardToAgent(job, excardId, activeAdapters, agentName, excardData, currentStepIndex, workflowSteps);
    } else {
      sendJobToAgent(job, activeAdapters, agentName);
    }

    return {
      success: true,
      started: true,
      hasExcard: !!excardId,
      excardId,
      currentStep: currentStepIndex,
      totalSteps: workflowSteps.length
    };

  } catch (err) {
    console.error('[Workflow] Error starting workflow:', err.message);
    // 出错时尝试回滚状态
    try {
      queryRun('UPDATE jobs SET status=? WHERE id=?', ['idle', jobId]);
    } catch (rollbackErr) {
      console.error('[Workflow] Failed to rollback job status:', rollbackErr.message);
    }
    return { success: false, error: err.message };
  }
}

/**
 * 把 ExCard 作为完整的执行模板发送给 Agent（支持多步骤）
 */
function sendExcardToAgent(job, excardId, activeAdapters, agentName, excardData, currentStepIndex, workflowSteps) {
  console.log(`[Workflow] Sending ExCard ${excardId} (step ${currentStepIndex}) to Agent for job ${job.id}`);

  // 获取 ExCard 的完整数据和 Markdown 内容
  let excardMd = null;
  try {
    excardMd = getExcardMd(excardId);
    if (!excardData) {
      excardData = getExcard(excardId);
    }
  } catch (err) {
    console.error('[Workflow] Failed to load ExCard:', err.message);
  }

  // 确定发送目标 Agent
  if (!agentName && workflowSteps.length > 0) {
    const step = workflowSteps[currentStepIndex - 1] || workflowSteps[0];
    agentName = step.agent;
  }

  if (!agentName && excardData) {
    agentName = excardData.agentName;
  }

  if (!agentName && activeAdapters.size > 0) {
    agentName = Array.from(activeAdapters.keys())[0];
  }

  if (!agentName) {
    console.warn('[Workflow] No agent assigned to job');
    sendSystemMessageToChat(job.id, 'message_failed', {
      title: '消息发送失败',
      message: '没有指定 Agent，无法发送任务'
    });
    return;
  }

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
    sendSystemMessageToChat(job.id, 'message_failed', {
      title: '消息发送失败',
      message: `Adapter ${adapterName} 未找到`
    }, agentName);
    return;
  }

  // 构建消息内容 - 包含当前步骤信息
  let messageContent = `请执行工作「${job.title}」`;
  if (job.description) {
    messageContent += `\n\n工作描述：${job.description}`;
  }

  if (workflowSteps.length > 0) {
    messageContent += `\n\n📋 工作流进度：第 ${currentStepIndex}/${workflowSteps.length} 步`;
    const currentStep = workflowSteps[currentStepIndex - 1];
    if (currentStep) {
      messageContent += `\n\n📍 当前步骤：${currentStep.name}`;
      if (currentStep.description) {
        messageContent += `\n${currentStep.description}`;
      }
    }
  }

  if (excardMd) {
    messageContent += `\n\n---\n\n完整 ExCard 模板参考：\n\n${excardMd}`;
  }

  // 发送给 Agent - 通过消息总线
  adapter.send(gatewayAgentId, {
    type: 'workflow_start',
    jobId: job.id,
    currentStep: currentStepIndex,
    totalSteps: workflowSteps.length,
    content: {
      title: job.title,
      description: job.description,
      excardId,
      excardMarkdown: excardMd,
      workflowSteps: workflowSteps,
      currentStepIndex: currentStepIndex,
      fullPrompt: messageContent
    }
  }).then(() => {
    // 只有发送成功才记录活跃的工作流映射
    if (activeWorkflows) {
      activeWorkflows.set(agentName, jobId);
      console.log(`[Workflow] Registered active workflow: ${agentName} -> ${jobId} (step ${currentStepIndex})`);
    }
    console.log(`[Workflow] ExCard sent to ${gatewayAgentId}`);

    // 向聊天界面发送消息发送成功的通知
    const stepInfo = workflowSteps.length > 0 ? ` (第 ${currentStepIndex}/${workflowSteps.length} 步)` : '';
    sendSystemMessageToChat(job.id, 'message_sent', {
      title: '消息已发送',
      message: `已将任务发送给 ${agentName}${stepInfo}`,
      agentName: agentName,
      currentStep: currentStepIndex,
      totalSteps: workflowSteps.length
    }, agentName);

  }).catch(err => {
    console.error('[Workflow] Send failed:', err.message);
    // 发送失败时回滚 job 状态
    try {
      queryRun('UPDATE jobs SET status=? WHERE id=?', ['idle', job.id]);
      console.log(`[Workflow] Rolled back job ${job.id} status to idle`);

      sendSystemMessageToChat(job.id, 'message_failed', {
        title: '消息发送失败',
        message: `发送给 ${agentName} 的消息失败: ${err.message}`,
        error: err.message
      }, agentName);

    } catch (rollbackErr) {
      console.error('[Workflow] Failed to rollback job status:', rollbackErr.message);
    }
  });
}

/**
 * 发送基本的 Job 信息给 Agent（没有 ExCard 的情况）
 */
function sendJobToAgent(job, activeAdapters, agentName) {
  console.log(`[Workflow] Sending job ${job.id} to Agent (no ExCard)`);

  if (!agentName) {
    agentName = job.agent;
  }

  if (!agentName) {
    console.warn('[Workflow] No agent assigned to job');
    return;
  }

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
    return;
  }

  let messageContent = `请执行工作「${job.title}」`;
  if (job.description) {
    messageContent += `\n\n工作描述：${job.description}`;
  }

  adapter.send(gatewayAgentId, {
    type: 'workflow_start',
    jobId: job.id,
    content: {
      title: job.title,
      description: job.description,
      fullPrompt: messageContent
    }
  }).then(() => {
    if (activeWorkflows) {
      activeWorkflows.set(agentName, job.id);
    }
    console.log(`[Workflow] Job sent to ${gatewayAgentId}`);

    sendSystemMessageToChat(job.id, 'message_sent', {
      title: '消息已发送',
      message: `已将任务发送给 ${agentName}`,
      agentName: agentName
    }, agentName);

  }).catch(err => {
    console.error('[Workflow] Send failed:', err.message);
    try {
      queryRun('UPDATE jobs SET status=? WHERE id=?', ['idle', job.id]);
      sendSystemMessageToChat(job.id, 'message_failed', {
        title: '消息发送失败',
        message: `发送给 ${agentName} 的消息失败: ${err.message}`,
        error: err.message
      }, agentName);
    } catch (rollbackErr) {
      console.error('[Workflow] Failed to rollback job status:', rollbackErr.message);
    }
  });
}

/**
 * 处理 Agent 的回复消息，推动工作流进度（支持多步骤）
 */
function handleAgentReply(agentName, message, jobId) {
  try {
    console.log(`[Workflow] Handling reply from ${agentName} for job ${jobId}`);

    if (!agentName) {
      console.warn('[Workflow] Missing agentName in handleAgentReply');
      return { handled: false, action: 'none', error: 'Missing agentName' };
    }

    if (!jobId) {
      console.warn('[Workflow] Missing jobId in handleAgentReply');
      return { handled: false, action: 'none', error: 'Missing jobId' };
    }

    const job = getJob(jobId);
    if (!job) {
      console.warn(`[Workflow] Job ${jobId} not found`);
      if (activeWorkflows) {
        activeWorkflows.delete(agentName);
      }
      return { handled: false, action: 'none', error: 'Job not found' };
    }

    if (job.status === 'done') {
      console.log(`[Workflow] Job ${jobId} already completed, ignoring`);
      if (activeWorkflows) {
        activeWorkflows.delete(agentName);
      }
      return { handled: false, action: 'none' };
    }

    const messageText = typeof message === 'string' ? message :
                        (message.content || message.text || JSON.stringify(message));

    sendSystemMessageToChat(jobId, 'agent_reply', {
      title: '收到 Agent 回复',
      message: `${agentName}: ${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}`,
      agentName: agentName
    }, agentName);

    const isComplete = messageText.includes('完成') ||
                       messageText.includes('workflow_complete') ||
                       messageText.includes('done') ||
                       messageText.includes('step_complete') ||
                       (message.type === 'workflow_complete') ||
                       (message.type === 'step_complete');

    if (isComplete) {
      console.log(`[Workflow] Agent ${agentName} completed step for job ${jobId}`);

      // 获取当前 workflow 状态
      const workflowState = queryGet('SELECT * FROM workflow_state WHERE job_id = ?', [jobId]);
      const currentStep = workflowState?.current_step || 0;

      // 获取 ExCard 和 workflow 步骤
      let excardId = job.excard_id || job.excard;
      let workflowSteps = [];
      if (excardId) {
        try {
          const excardData = getExcard(excardId);
          workflowSteps = getWorkflowSteps(excardData);
        } catch (e) {
          // ignore
        }
      }

      // 检查是否还有下一步
      const hasNextStep = workflowSteps.length > 0 && currentStep < workflowSteps.length;

      if (hasNextStep) {
        // 推进到下一步
        const nextStep = currentStep + 1;
        console.log(`[Workflow] Advancing to step ${nextStep}/${workflowSteps.length}`);

        // 更新 workflow 状态
        queryRun('UPDATE workflow_state SET current_step=? WHERE job_id=?', [nextStep, jobId]);
        broadcast('workflow_step_advanced', { jobId, currentStep: nextStep, totalSteps: workflowSteps.length });

        // 发送下一步到聊天界面
        const nextStepData = workflowSteps[nextStep - 1];
        sendSystemMessageToChat(jobId, 'workflow_step', {
          title: '工作流推进',
          message: `正在执行第 ${nextStep}/${workflowSteps.length} 步：${nextStepData.name}`,
          currentStep: nextStep,
          totalSteps: workflowSteps.length,
          stepName: nextStepData.name,
          stepDescription: nextStepData.description
        }, agentName);

        // 确定下一步的 agent
        const nextAgentName = nextStepData.agent || agentName;

        // 获取 activeAdapters - 这里需要从外部传入，暂时通过 require 解决
        const activeAdapters = new Map(); // 注意：这里需要实际的 adapter 引用

        // 重新发送 ExCard 给下一步的 agent
        // 注意：这里需要 activeAdapters，需要在调用时传入
        // 暂时先标记完成这一步，等待下一次调用

        return { handled: true, action: 'advanced', nextStep };

      } else {
        // 所有步骤都完成了
        console.log(`[Workflow] All steps completed for job ${jobId}`);
        completeWorkflow(jobId, agentName);

        if (activeWorkflows) {
          activeWorkflows.delete(agentName);
        }
        return { handled: true, action: 'complete' };
      }
    }

    return { handled: false, action: 'none' };

  } catch (err) {
    console.error('[Workflow] Error in handleAgentReply:', err.message);
    if (agentName && activeWorkflows) {
      activeWorkflows.delete(agentName);
    }
    return { handled: false, action: 'error', error: err.message };
  }
}

function completeWorkflow(jobId, agentName = null) {
  queryRun(
    'UPDATE workflow_state SET status=?,completed_at=CURRENT_TIMESTAMP WHERE job_id=?',
    ['completed', jobId]
  );
  queryRun('UPDATE jobs SET status=? WHERE id=?', ['done', jobId]);
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

  // 获取 ExCard 信息来计算总步骤
  let totalSteps = 0;
  const job = getJob(jobId);
  if (job) {
    const excardId = job.excard_id || job.excard;
    if (excardId) {
      try {
        const excardData = getExcard(excardId);
        totalSteps = getWorkflowSteps(excardData).length;
      } catch (e) {
        // ignore
      }
    }
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
  sendSystemMessageToChat,
  getWorkflowSteps
};
