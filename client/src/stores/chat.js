/**
 * Chat Store - 管理私聊/群聊会话和消息历史
 * 通过 SSE 接收 Agent 实时消息
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

const SSE_URL = 'http://121.4.84.159:4000/api/events';
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
      const msgAgent = msg.agent || msg.from;
      // 找到对应的会话，追加消息
      const sess = sessions.value.find(s => {
        if (s.type === 'p2p') {
          // 兼容两种情况：s.agentId 就是纯 agent id，或者是 adapterName:agentId 格式
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
    console.log('[ChatStore] initSessions called with:', agentList);
    if (!agentList || agentList.length === 0) {
      console.log('[ChatStore] agentList is empty, skipping initialization');
      return;
    }
    
    agents.value = agentList;
    
    // 清除现有会话，重新初始化
    sessions.value = [];
    
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
    activeSessionId.value = sessions.value[0].id;
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

    // 检查连接状态
    let hasConnectedAgent = false;
    if (sess.type === 'p2p') {
      // 查找对应 agent，检查连接状态
      const agentId = sess.agentId.includes(':') ? sess.agentId.split(':').pop() : sess.agentId;
      const agent = agents.value.find(a => a.id === agentId || a.id === sess.agentId);
      hasConnectedAgent = agent?.connected || false;
    } else if (sess.type === 'group') {
      // 检查是否至少有一个 agent 已连接
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
        // 群聊：发给所有已连接的 Agent
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
      // 网络错误时添加错误提示
      sess.messages.push({
        sender: 'system',
        text: `发送失败：${err.message}`,
        time: timeStr,
      });
    }
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
