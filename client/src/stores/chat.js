/**
 * Chat Store - 管理私聊/群聊会话和消息历史
 * 通过 SSE 接收 Agent 实时消息
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

const SSE_URL = 'http://localhost:4000/api/events';
let es = null;

export const useChatStore = defineStore('chat', () => {
  // 会话列表
  const sessions = ref([]);
  const activeSessionId = ref(null);
  const agents = ref([]); // 当前 agents 列表（从 BoardStore 同步）

  // SSE 连接
  function connectSSE() {
    if (es) es.close();
    es = new EventSource(SSE_URL);

    // Agent 回复消息
    es.addEventListener('agent_message', (e) => {
      const msg = JSON.parse(e.data);
      // 找到对应的会话，追加消息
      const sess = sessions.value.find(s => {
        if (s.type === 'p2p') return s.agentId === msg.agent || s.agentId === msg.from;
        if (s.type === 'group') return s.agentIds?.includes(msg.agent);
        return false;
      });
      if (sess) {
        sess.messages.push({
          sender: msg.agent || msg.from,
          agentId: msg.agent || msg.from,
          text: msg.content || msg.text || msg.output || JSON.stringify(msg.result),
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    // 通用 agent 回调（任务完成等）
    es.addEventListener('agent_callback', (e) => {
      const cb = JSON.parse(e.data);
      if (cb.result?.output) {
        // 找到 active session 通知
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
    agents.value = agentList;

    // 如果还没初始化过会话，才初始化
    if (sessions.value.length === 0 && agentList.length > 0) {
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

      // 默认选中第一个私聊
      if (sessions.value.length > 0) {
        activeSessionId.value = sessions.value[0].id;
      }
    }
  }

  // 发送消息
  async function sendMessage(text) {
    const sess = sessions.value.find(s => s.id === activeSessionId.value);
    if (!sess || !text.trim()) return;

    const timeStr = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit'
    });

    // 添加用户消息
    sess.messages.push({ sender: 'user', text: text.trim(), time: timeStr });

    // 调用 API
    try {
      let result;
      if (sess.type === 'p2p') {
        result = await api.sendMessage(sess.agentId, text.trim(), 'chat');
      } else {
        // 群聊：发给所有 Agent
        await Promise.all(
          sess.agentIds.map(agId => api.sendMessage(agId, `[群消息] ${text.trim()}`, 'chat'))
        );
        result = { success: true };
      }

      // 模拟 Agent 回复（如果后端 Adapter 未连接，用模拟回复）
      if (!result.warning && result.success !== undefined) {
        scheduleMockReply(sess);
      }
    } catch (err) {
      console.error('[Chat] sendMessage error:', err);
      // 网络错误时添加错误提示
      sess.messages.push({
        sender: 'system',
        text: `发送失败：${err.message}`,
        time: timeStr,
      });
    }
  }

  // 模拟 Agent 回复（Adapter 未连接时使用）
  function scheduleMockReply(sess) {
    setTimeout(() => {
      const replies = [
        '收到，让我处理一下。',
        '好的，这个我来搞。',
        '明白了，开始执行。',
        '了解，有结果了通知你。',
      ];
      const timeStr = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit'
      });
      sess.messages.push({
        sender: sess.name,
        agentId: sess.type === 'p2p' ? sess.agentId : undefined,
        text: replies[Math.floor(Math.random() * replies.length)],
        time: timeStr,
      });
    }, 1500);
  }

  // 切换会话
  function selectSession(id) {
    activeSessionId.value = id;
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
    connectSSE,
    initSessions,
    sendMessage,
    selectSession,
    activeSession,
    addGroupSession,
  };
});
