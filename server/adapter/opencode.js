/**
 * OpenClaw Adapter - 简化版
 * 
 * 职责：
 * 1. 消息格式转换（统一协议 ↔ OpenClaw 原生格式）
 * 2. 发送消息给主 Agent（主 Agent 内部自行 spawn 子 Agent）
 * 3. 解析主 Agent 回调（子 Agent 结果已汇总）
 * 
 * 注意：Dashboard 不感知子 Agent，只与主 Agent 通信
 */

class OpenClawAdapter {
  constructor(config = {}) {
    this.name = 'opencode';
    this.version = '1.4.6';
    this.endpoint = config.endpoint;  // wss://host:18789
    this.token = config.token;
  }

  /**
   * 发送消息给主 Agent
   * @param {string} agentId - 主 Agent 的 session key
   * @param {Object} message - 统一消息格式
   */
  async send(agentId, message) {
    // 转换消息格式
    const openclawMessage = {
      type: message.type,
      content: message.content,
      callback: message.callback,
      taskId: message.taskId,
      jobId: message.jobId,
      stepIndex: message.stepIndex,
      totalSteps: message.totalSteps
    };
    
    // 发送到主 Agent
    // 主 Agent 内部通过 sessions_spawn 创建子 Agent 执行
    // 执行完成后，主 Agent 通过 callback webhook 返回结果
    const result = await this.webSocketSend(agentId, openclawMessage);
    
    return {
      success: true,
      messageId: result.messageId
    };
  }

  /**
   * 解析主 Agent 回调
   * @param {Object} raw - OpenClaw 回调数据
   * @returns {UnifiedCallback} 统一回调格式
   */
  parse(raw) {
    // 回调来自主 Agent（子 Agent 执行结果已汇总）
    return {
      type: raw.type,  // task_complete | workflow_step_complete
      messageId: raw.messageId,
      replyTo: raw.replyTo,
      taskId: raw.taskId,
      jobId: raw.jobId,
      stepIndex: raw.stepIndex,
      result: {
        status: raw.result?.status || 'completed',
        output: raw.result?.output,
        artifacts: raw.result?.artifacts || []
      },
      timestamp: raw.timestamp || new Date().toISOString()
    };
  }

  // ===== Private Methods =====

  async webSocketSend(agentId, message) {
    // 实际实现：通过 WebSocket RPC 发送给 OpenClaw Gateway
    // 调用 sessions_send 工具，发送给指定 session
    
    // 伪代码：
    // const ws = new WebSocket(this.endpoint);
    // ws.send(JSON.stringify({
    //   jsonrpc: "2.0",
    //   method: "gateway.call",
    //   params: {
    //     agent: agentId,
    //     tool: "sessions_send",
    //     args: { message }
    //   }
    // }));
    
    // 目前先返回模拟数据
    return {
      messageId: `msg_${Date.now()}`
    };
  }
}

module.exports = OpenClawAdapter;
