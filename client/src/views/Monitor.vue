<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import api, { BASE as API_BASE } from '../api/client.js';
import { createSSEConnection } from '../api/sse.js';

const props = defineProps({
  agents: { type: Array, required: true },
});

const logs = ref([]);
let sseHandle = null;

const statusConfig = {
  online: { label: '在线', color: 'text-green-600', bg: 'bg-green-50' },
  offline: { label: '离线', color: 'text-muted', bg: 'bg-surface' },
};

const agentAvatars = {
  '品品': '👩‍💼',
  '开开': '👨‍💻',
  '前前': '👨‍🎨',
  '维维': '👨‍🔧',
  '测测': '🧪',
};

async function loadLogs() {
  try {
    const result = await api.getLogs(50);
    logs.value = result.logs || [];
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function connectSSE() {
  if (sseHandle) sseHandle.close();

  sseHandle = createSSEConnection({
    log: (event) => {
      try {
        const logData = JSON.parse(event.data);
        logs.value.unshift(logData);
        if (logs.value.length > 50) logs.value.pop();
      } catch (err) {
        console.error('Failed to parse log event:', err);
      }
    },

    agent_message: (event) => {
      try {
        const logData = JSON.parse(event.data);
        logs.value.unshift(logData);
        if (logs.value.length > 50) logs.value.pop();
      } catch (err) {
        console.error('Failed to parse agent_message event:', err);
      }
    },
  });
}

function formatTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '';
  }
}

function formatLogLevel(type) {
  if (!type) return 'info';
  const t = type.toLowerCase();
  if (t.includes('error') || t.includes('fail')) return 'error';
  if (t.includes('warn') || t.includes('warning')) return 'warn';
  return 'info';
}

function getAgentName(agentId) {
  if (!agentId) return '';
  if (agentId === 'system') return '系统';
  if (agentId === 'dashboard') return '控制台';
  const agent = props.agents.find(a => a.id === agentId);
  if (agent) return agent.name;
  // agentId 可能包含冒号，取后面的部分
  if (agentId.includes(':')) {
    return agentId.split(':')[1];
  }
  return agentId;
}

function getLogDetail(log) {
  let content = log.content;
  if (typeof content === 'object') {
    if (content.message) return content.message;
    if (content.title) return content.title;
    return JSON.stringify(content);
  }
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.message) return parsed.message;
      if (parsed.title) return parsed.title;
      return content;
    } catch {
      return content;
    }
  }
  return JSON.stringify(content);
}

function getLogAction(log) {
  const type = log.type || 'info';
  switch (type) {
    case 'workflow_start': return '工作流启动';
    case 'workflow_step': return '工作流步骤';
    case 'workflow_completed': return '工作流完成';
    case 'workflow_error': return '工作流错误';
    case 'chat': return '聊天消息';
    case 'message_sent': return '发送消息';
    case 'task_assign': return '任务分配';
    case 'agent_reply': return 'Agent 回复';
    default: return type;
  }
}

const logLevelStyles = {
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-orange-600',
};

onMounted(async () => {
  await loadLogs();
  connectSSE();
});

onUnmounted(() => {
  if (sseHandle) {
    sseHandle.close();
    sseHandle = null;
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-primary">监控面板</h2>
      <button @click="loadLogs" class="px-3 py-1.5 text-sm text-accent hover:bg-accent-dim rounded-lg transition-colors">
        🔄 刷新
      </button>
    </div>

    <!-- Agent Status Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="bg-surface rounded-xl p-4 shadow-xs border border-border-subtle"
      >
        <div class="flex items-start gap-3">
          <div class="relative">
            <div class="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-2xl">
              {{ agentAvatars[agent.name] || '👤' }}
            </div>
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white',
                agent.status === 'online' ? 'bg-green-400' : agent.status === 'busy' ? 'bg-orange-400' : 'bg-gray-400'
              ]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-primary">
              {{ agent.name }}
              <span class="ml-1 text-xs text-muted font-normal">{{ agent.adapter }}</span>
              <span v-if="agent.connected === false" class="ml-2 px-2 py-0.5 text-xs bg-red-50 text-red-500 rounded">已解绑</span>
            </h3>
            <p :class="['text-sm mt-0.5', statusConfig[agent.status] ? statusConfig[agent.status].color : '']">
              {{ statusConfig[agent.status] ? statusConfig[agent.status].label : agent.status }}
            </p>
            <p v-if="agent.task" class="text-xs text-muted mt-1 truncate">
              {{ agent.task }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Real-time Logs -->
    <div class="bg-surface rounded-xl shadow-xs border border-border-subtle">
      <div class="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h3 class="font-medium text-primary">实时日志</h3>
        <div class="text-xs text-muted">
          {{ logs.length }} 条日志
        </div>
      </div>
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="(log, idx) in logs"
          :key="log.id || idx"
          class="px-4 py-2.5 border-b border-gray-50 last:border-0 flex items-start gap-3 hover:bg-surface-raised/50"
        >
          <span class="text-xs text-muted font-mono mt-0.5">{{ formatTime(log.timestamp) }}</span>
          <span :class="['w-2 h-2 rounded-full mt-1.5', formatLogLevel(log.type) === 'info' ? 'bg-blue-400' : formatLogLevel(log.type) === 'warn' ? 'bg-yellow-400' : 'bg-orange-400']" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-primary">{{ getAgentName(log.from) }}</span>
            <span class="text-sm text-secondary ml-1">{{ getLogAction(log) }}</span>
            <p class="text-xs text-muted mt-0.5">{{ getLogDetail(log) }}</p>
          </div>
        </div>

        <div v-if="logs.length === 0" class="px-4 py-8 text-center text-sm text-muted">
          暂无日志
        </div>
      </div>
    </div>
  </div>
</template>
