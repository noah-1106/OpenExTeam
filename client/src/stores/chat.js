/**
 * Chat Store - 管理私聊/群聊会话和消息历史
 * 通过 SSE 接收 Agent 实时消息
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

const SSE_URL = window.location.origin.replace(/:\d+$/, ':4000') + '/api/events';
let es = null;

export const useChatStore = defineStore('chat', () => {
  // 会话列表
  const sessions = ref([]);
  const activeSessionId = ref(null);
  const agents = ref([]); // 当前 agents 列表（从 BoardStore 同步）
  const loadedHistories = ref(new Set()); // 已加载历史的会话

  // 跟踪流式消息：key = messageId, value = { sessionId, messageIndex }
  const streamingMessages = ref(new Map());

  // 确保系统会话存在
  function ensureSystemSession() {
    let systemSess = sessions.value.find(s => s.id === 'system-notifications');
    if (!systemSess) {
      systemSess = {
        id: 'system-notifications',
        type: 'system',
        name: '系统通知',
        avatarUrl: null,
        messages: [],
      };
      sessions.value.unshift(systemSess); // 放在最前面
    }
    return systemSess;
  }

  // SSE 连接
  function connectSSE() {
    if (es) es.close();
    es = new EventSource(SSE_URL);

    // Agent 回复消息 - 使用 messageId 和 state 处理流式消息
    es.addEventListener('agent_message', (e) => {
      const msg = JSON.parse(e.data);
      const msgAgent = msg.agent || msg.from;
      const content = msg.content || msg.text || msg.output || JSON.stringify(msg.result || msg);
      const messageId = msg.messageId;
      const state = msg.state; // "delta" 或 "final"

      console.log('[Chat] Received message:', { messageId, state, agent: msgAgent, from: msg.from, type: msg.type, content });

      // 检查是否是系统消息（工作流通知）
      if (msg.from === 'system' || msg.type?.startsWith('workflow_') || msg.type?.startsWith('message_')) {
        console.log('[Chat] System/workflow message, routing to system session');
        const systemSess = ensureSystemSession();

        // 添加系统消息
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const displayContent = typeof content === 'string' ? content :
                             (content.title ? `${content.title}\n${content.message || ''}` : JSON.stringify(content));
        systemSess.messages.push({
          sender: 'system',
          text: displayContent,
          time: timeStr,
          jobId: msg.jobId,
          msgType: msg.type
        });

        // 如果当前没有选中会话，自动选中系统会话
        if (!activeSessionId.value) {
          activeSessionId.value = systemSess.id;
        }
        return;
      }

      // 找到对应的会话
      const sess = sessions.value.find(s => {
        if (s.type === 'p2p') {
          const sAgentPart = s.agentId.includes(':') ? s.agentId.split(':').pop() : s.agentId;
          return s.agentId === msgAgent || sAgentPart === msgAgent;
        }
        if (s.type === 'group') {
          return s.agentIds?.some(agentId => {
            const agentPart = agentId.includes(':') ? agentId.split(':').pop() : agentId;
            return agentId === msgAgent || agentPart === msgAgent;
          });
        }
        return false;
      });

      if (!sess) {
        console.log('[Chat] No session found for agent:', msgAgent);
        return;
      }

      // 检查是否是已有流式消息的更新
      if (messageId && streamingMessages.value.has(messageId)) {
        const streamState = streamingMessages.value.get(messageId);
        if (streamState.sessionId === sess.id) {
          // 更新现有消息
          const existingMsg = sess.messages[streamState.messageIndex];
          if (existingMsg) {
            existingMsg.text = content;
            console.log('[Chat] Updated streaming message:', messageId);

            // 如果是 final 状态，清理跟踪
            if (state === 'final') {
              streamingMessages.value.delete(messageId);
              console.log('[Chat] Stream finished:', messageId);
            }
            return;
          }
        }
      }

      // 新消息
      const newMessage = {
        sender: msgAgent,
        agentId: msgAgent,
        text: content,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      sess.messages.push(newMessage);
      console.log('[Chat] Added new message, total:', sess.messages.length);

      // 如果是 delta 状态，开始跟踪
      if (messageId && (state === 'delta' || state !== 'final')) {
        streamingMessages.value.set(messageId, {
          sessionId: sess.id,
          messageIndex: sess.messages.length - 1,
        });
        console.log('[Chat] Started tracking stream:', messageId);
      }
    });

    // 通用 agent 回调（任务完成等）
    es.addEventListener('agent_callback', (e) => {
      const cb = JSON.parse(e.data);
      if (cb.result?.output) {
        console.log('[Chat] Agent callback:', cb);
      }
    });

    es.onerror = () => {
      console.warn('[Chat] SSE connection lost, reconnecting...');
      setTimeout(connectSSE, 3000);
    };
  }

  // 初始化会话（从 agents 列表构建）
  function initSessions(agentList) {
    console.log('[ChatStore] initSessions called with:', agentList);
    if (!agentList || agentList.length === 0) {
      console.log('[ChatStore] agentList is empty, skipping initialization');
      return;
    }

    agents.value = agentList;

    // 保存现有系统会话的消息
    const existingSystemSess = sessions.value.find(s => s.id === 'system-notifications');
    const systemMessages = existingSystemSess?.messages || [];

    // 清除现有会话，重新初始化
    sessions.value = [];

    // 重新添加系统会话（保留消息）
    if (systemMessages.length > 0) {
      sessions.value.push({
        id: 'system-notifications',
        type: 'system',
        name: '系统通知',
        avatarUrl: null,
        messages: systemMessages,
      });
    }

    // 为每个 Agent 创建私聊会话
    agentList.forEach(ag => {
      sessions.value.push({
        id: `p2p-${ag.id}`,
        type: 'p2p',
        name: ag.name,
        avatarUrl: ag.avatarUrl || null,
        agentId: ag.id,
        messages: [],
      });
    });

    // 创建默认群聊
    sessions.value.push({
      id: 'group-dev',
      type: 'group',
      name: '开发群',
      avatarUrl: null,
      agentIds: agentList.map(a => a.id),
      messages: [],
    });

    // 确保系统会话存在
    ensureSystemSession();

    // 默认选中第一个私聊（如果有），否则选中系统会话
    const firstP2p = sessions.value.find(s => s.type === 'p2p');
    activeSessionId.value = firstP2p?.id || 'system-notifications';
  }

  // 发送消息
  async function sendMessage(text) {
    const sess = sessions.value.find(s => s.id === activeSessionId.value);
    if (!sess || !text.trim()) return;

    // 系统会话不支持发送消息
    if (sess.type === 'system') {
      console.log('[Chat] Cannot send messages to system session');
      return;
    }

    const timeStr = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit'
    });

    console.log('[Chat] Sending user message:', text);

    // 发送新消息前，清理该会话的所有流式跟踪状态
    streamingMessages.value.clear();

    // 添加用户消息
    sess.messages.push({ sender: 'user', text: text.trim(), time: timeStr });

    // 检查连接状态
    let hasConnectedAgent = false;
    if (sess.type === 'p2p') {
      const agentId = sess.agentId.includes(':') ? sess.agentId.split(':').pop() : sess.agentId;
      const agent = agents.value.find(a => a.id === agentId || a.id === sess.agentId);
      hasConnectedAgent = agent?.connected || false;
    } else if (sess.type === 'group') {
      hasConnectedAgent = sess.agentIds.some(agId => {
        const pureId = agId.includes(':') ? agId.split(':').pop() : agId;
        const agent = agents.value.find(a => a.id === pureId || a.id === agId);
        return agent?.connected || false;
      });
    }

    if (!hasConnectedAgent) {
      sess.messages.push({
        sender: 'system',
        text: 'Agent 离线，无法发送消息',
        time: timeStr,
      });
      return;
    }

    // 调用 API
    try {
      if (sess.type === 'p2p') {
        await api.sendMessage(sess.agentId, text.trim(), 'chat');
      } else {
        await Promise.all(
          sess.agentIds.map(async agId => {
            const pureId = agId.includes(':') ? agId.split(':').pop() : agId;
            const agent = agents.value.find(a => a.id === pureId || a.id === agId);
            if (agent?.connected) {
              await api.sendMessage(agId, `[群消息] ${text.trim()}`, 'chat');
            }
          })
        );
      }
    } catch (err) {
      console.error('[Chat] sendMessage error:', err);
      sess.messages.push({
        sender: 'system',
        text: `发送失败：${err.message}`,
        time: timeStr,
      });
    }
  }

  // 加载会话历史消息
  async function loadSessionHistory(sessionId) {
    if (loadedHistories.value.has(sessionId)) {
      console.log('[Chat] History already loaded for:', sessionId);
      return;
    }

    const sess = sessions.value.find(s => s.id === sessionId);
    if (!sess) return;

    if (sess.type === 'p2p') {
      try {
        console.log('[Chat] Loading history for agent:', sess.agentId);
        const data = await api.getMessageHistory(sess.agentId);
        if (data.messages && data.messages.length > 0) {
          // 转换历史消息格式
          const historyMessages = data.messages.map(msg => {
            const content = msg.content ? (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) : '';
            return {
              sender: msg.from_agent === 'dashboard' ? 'user' : (msg.from_agent || 'system'),
              text: content,
              time: new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              isHistory: true
            };
          });
          // 历史消息插入到前面
          sess.messages = [...historyMessages, ...sess.messages];
          loadedHistories.value.add(sessionId);
          console.log('[Chat] Loaded', historyMessages.length, 'history messages');
        }
      } catch (err) {
        console.error('[Chat] Failed to load history:', err);
      }
    }
  }

  // 切换会话
  function selectSession(id) {
    activeSessionId.value = id;
    loadSessionHistory(id);
  }

  // 当前活跃会话
  function activeSession() {
    return sessions.value.find(s => s.id === activeSessionId.value) || null;
  }

  // 添加新会话（群聊）
  function addGroupSession(name, participantIds) {
    sessions.value.push({
      id: `group-${Date.now()}`,
      type: 'group',
      name,
      avatarUrl: null,
      agentIds: participantIds,
      messages: [],
    });
  }

  // 初始化 SSE
  connectSSE();

  return {
    sessions,
    activeSessionId,
    agents,
    loadedHistories,
    connectSSE,
    initSessions,
    sendMessage,
    selectSession,
    activeSession,
    addGroupSession,
    ensureSystemSession,
    loadSessionHistory,
  };
});
