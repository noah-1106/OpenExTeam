/**
 * Chat Store - 管理私聊/群聊会话和消息历史
 * 通过 SSE 接收 Agent 实时消息
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../api/client';
import { createSSEConnection } from '../api/sse';

let sseHandle = null;

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
        unreadCount: 0,
        lastMessageTime: 0,
      };
      sessions.value.unshift(systemSess); // 放在最前面
    }
    return systemSess;
  }

  // SSE 连接
  function connectSSE() {
    if (sseHandle) sseHandle.close();

    sseHandle = createSSEConnection({
      agent_message: (e) => {
        const msg = JSON.parse(e.data);
        const msgAgent = msg.agent || msg.from;
        const content = msg.content || msg.text || msg.output || JSON.stringify(msg.result || msg);
        const messageId = msg.messageId;
        const state = msg.state; // "delta" 或 "final"

        console.log('[Chat] Received message:', { messageId, state, agent: msgAgent, from: msg.from, type: msg.type, content });

        // 检查是否是系统消息（工作流通知 + 工具调用）
        if (msg.from === 'system' || msg.type?.startsWith('workflow_') || msg.type?.startsWith('message_') || msg.type === 'tool_chat') {
          console.log('[Chat] System/workflow message, routing to system session');
          const systemSess = ensureSystemSession();

          // 格式化系统消息为可读文本，避免显示原始 JSON
          const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          let displayContent;
          if (typeof content === 'string') {
            displayContent = content;
          } else if (content && typeof content === 'object') {
            // 提取可读字段
            const parts = [];
            if (content.title) parts.push(content.title);
            if (content.message) parts.push(content.message);
            if (content.step) parts.push(`步骤: ${content.step}`);
            if (content.stepName) parts.push(content.stepName);
            if (content.status) parts.push(`状态: ${content.status}`);
            displayContent = parts.length > 0 ? parts.join(' — ') : `[${msg.type || 'system'}]`;
          } else {
            displayContent = `[${msg.type || 'system'}]`;
          }
          systemSess.messages.push({
            sender: 'system',
            text: displayContent,
            time: timeStr,
            jobId: msg.jobId,
            msgType: msg.type
          });
          systemSess.lastMessageTime = Date.now();
          if (activeSessionId.value !== systemSess.id) {
            systemSess.unreadCount = (systemSess.unreadCount || 0) + 1;
          }

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
            const msgAgentPart = msgAgent.includes(':') ? msgAgent.split(':').pop() : msgAgent;
            return s.agentId === msgAgent || sAgentPart === msgAgent || sAgentPart === msgAgentPart;
          }
          if (s.type === 'group') {
            return s.agentIds?.some(agentId => {
              const agentPart = agentId.includes(':') ? agentId.split(':').pop() : agentId;
              const msgAgentPart = msgAgent.includes(':') ? msgAgent.split(':').pop() : msgAgent;
              return agentId === msgAgent || agentPart === msgAgent || agentPart === msgAgentPart;
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

        // 对于非 final 的消息（delta/流式），尝试更新同一 agent 的最后一条消息
        if (state !== 'final') {
          const lastMsg = sess.messages[sess.messages.length - 1];
          if (lastMsg && lastMsg.sender === msgAgent && lastMsg.sender !== 'user') {
            lastMsg.text = content;
            // 开始跟踪这个流
            if (messageId) {
              streamingMessages.value.set(messageId, {
                sessionId: sess.id,
                messageIndex: sess.messages.length - 1,
              });
              console.log('[Chat] Attached stream to last message:', messageId);
            }
            return;
          }
        }

        // 新消息（仅 final 状态或首条消息）
        const newMessage = {
          sender: msgAgent,
          agentId: msgAgent,
          text: content,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        sess.messages.push(newMessage);
        console.log('[Chat] Added new message, total:', sess.messages.length);
        sess.lastMessageTime = Date.now();
        if (activeSessionId.value !== sess.id) {
          sess.unreadCount = (sess.unreadCount || 0) + 1;
        }

        // 如果是 delta 状态，开始跟踪
        if (messageId && (state === 'delta' || state !== 'final')) {
          streamingMessages.value.set(messageId, {
            sessionId: sess.id,
            messageIndex: sess.messages.length - 1,
          });
          console.log('[Chat] Started tracking stream:', messageId);
        }
      },

      agent_callback: (e) => {
        const cb = JSON.parse(e.data);
        if (cb.result?.output) {
          console.log('[Chat] Agent callback:', cb);
        }
      },
    }, {
      onError: () => {
        console.warn('[Chat] SSE connection lost, reconnecting...');
      },
    });
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

    // 保存现有所有会话的消息
    const existingMessages = new Map();
    sessions.value.forEach(sess => {
      existingMessages.set(sess.id, sess.messages);
    });

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
        unreadCount: 0,
        lastMessageTime: 0,
      });
    }

    // 为每个 Agent 创建私聊会话
    // 始终追加底座名称以区分不同适配器的 agent
    agentList.forEach(ag => {
      const sessionId = `p2p-${ag.id}`;
      const savedMessages = existingMessages.get(sessionId) || [];
      sessions.value.push({
        id: sessionId,
        type: 'p2p',
        name: ag.name,
        avatarUrl: ag.avatarUrl || null,
        agentId: ag.id,
        adapterName: ag.adapter || ag.id.split(':')[0],
        messages: savedMessages,
        unreadCount: 0,
        lastMessageTime: 0,
      });
    });

    // 确保系统会话存在
    ensureSystemSession();

    // 默认选中第一个私聊（如果有），否则选中系统会话
    const firstP2p = sessions.value.find(s => s.type === 'p2p');
    if (!activeSessionId.value) {
      activeSessionId.value = firstP2p?.id || 'system-notifications';
    }

    // 自动加载当前活跃会话的历史记录
    if (activeSessionId.value) {
      loadSessionHistory(activeSessionId.value);
    }
  }

  // 发送消息
  async function sendMessage(text, options = {}) {
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

    // 发送新消息前，清理该会话的所有流式跟踪状态
    streamingMessages.value.clear();

    // 添加用户消息（用户可见的文本）
    const userVisibleText = options.userVisibleText || text.trim();
    sess.messages.push({ sender: 'user', text: userVisibleText, time: timeStr });

    // 实际发送的消息（可能包含额外的提示词）
    const actualMessageToSend = options.actualMessage || text.trim();
    console.log('[Chat] Sending user message (visible):', userVisibleText);
    console.log('[Chat] Sending actual message:', actualMessageToSend);

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
        await api.sendMessage(sess.agentId, actualMessageToSend, 'chat');
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
            let content = msg.content ? (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) : '';
            // Migration guard: old data stored strings with JSON.stringify, adding extra quotes
            if (content.startsWith('"') && content.endsWith('"')) {
              try { content = JSON.parse(content); } catch {}
            }
            // Fix timezone: old timestamps like "2026-04-27 14:02:36" are UTC but lack the Z suffix
            let ts = msg.timestamp;
            if (ts && !ts.includes('T')) {
              ts = ts.replace(' ', 'T') + 'Z';
            }
            return {
              sender: msg.from_agent === 'dashboard' ? 'user' : (msg.from_agent || 'system'),
              text: content,
              time: new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              isHistory: true
            };
          });
          // 用完整历史替换当前消息（服务端已包含用户和 agent 双方消息）
          sess.messages = historyMessages;
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
    const sess = sessions.value.find(s => s.id === id);
    if (sess) sess.unreadCount = 0;
    loadSessionHistory(id);
  }

  // 当前活跃会话
  function activeSession() {
    return sessions.value.find(s => s.id === activeSessionId.value) || null;
  }

  // 按 lastMessageTime 排序的 p2p 会话（最近的在最上面）
  const sortedP2pSessions = computed(() => {
    return [...sessions.value.filter(s => s.type === 'p2p')]
      .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  });

  // 总未读数（用于全局提示）
  const totalUnread = computed(() => {
    return sessions.value.reduce((sum, s) => sum + (s.unreadCount || 0), 0);
  });

  // 添加新会话（群聊）
  function addGroupSession(name, participantIds) {
    sessions.value.push({
      id: `group-${Date.now()}`,
      type: 'group',
      name,
      avatarUrl: null,
      agentIds: participantIds,
      messages: [],
      unreadCount: 0,
      lastMessageTime: 0,
    });
  }

  // 初始化 SSE
  connectSSE();

  return {
    sessions,
    activeSessionId,
    agents,
    loadedHistories,
    sortedP2pSessions,
    totalUnread,
    connectSSE,
    initSessions,
    sendMessage,
    selectSession,
    activeSession,
    ensureSystemSession,
    loadSessionHistory,
  };
});
