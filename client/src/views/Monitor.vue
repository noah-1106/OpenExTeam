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
  online: { label: '在线', dot: 'bg-[#5FA88F]', text: 'text-[#4E917A]' },
  offline: { label: '离线', dot: 'bg-[#C5C9D3]', text: 'text-[#9CA3AF]' },
  busy: { label: '忙碌', dot: 'bg-[#C9965E]', text: 'text-[#A87D4A]' },
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
  if (agentId.includes(':')) {
    return agentId.split(':')[1];
  }
  return agentId;
}

function getAgentInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
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
  info: { dot: 'bg-[#5B6AD7]', text: 'text-[#5B6AD7]' },
  warn: { dot: 'bg-[#C9965E]', text: 'text-[#A87D4A]' },
  error: { dot: 'bg-[#C97A7A]', text: 'text-[#C97A7A]' },
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
  <div class="h-full overflow-y-auto p-6">
    <div class="max-w-4xl mx-auto space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[15px] font-semibold text-[#2D2D35]">监控面板</h2>
          <p class="text-[13px] text-[#9CA3AF] mt-0.5">Agent 状态与实时日志</p>
        </div>
        <button @click="loadLogs" class="px-3 py-1.5 text-[12px] font-medium text-[#5B6AD7] hover:bg-[#F0F1FE] rounded-md transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          刷新
        </button>
      </div>

      <!-- Agent Status Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="bg-white rounded-md p-4 border border-[#E8E8EC]"
        >
          <div class="flex items-start gap-3">
            <div class="relative">
              <div class="w-9 h-9 rounded-md bg-[#F0F0F4] flex items-center justify-center text-[13px] font-semibold text-[#6B6B78]">
                {{ getAgentInitial(agent.name) }}
              </div>
              <span
                :class="[
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                  statusConfig[agent.status]?.dot || 'bg-[#C5C9D3]'
                ]"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-[13px] font-medium text-[#2D2D35]">
                {{ agent.name }}
                <span class="ml-1 text-[11px] text-[#9CA3AF] font-normal">{{ agent.adapter }}</span>
                <span v-if="agent.connected === false" class="ml-2 px-1.5 py-0.5 text-[10px] bg-[#FDF0F0] text-[#C97A7A] rounded">已解绑</span>
              </h3>
              <p :class="['text-[12px] mt-0.5', statusConfig[agent.status]?.text || 'text-[#9CA3AF]']">
                {{ statusConfig[agent.status]?.label || agent.status }}
              </p>
              <p v-if="agent.task" class="text-[11px] text-[#9CA3AF] mt-1 truncate">
                {{ agent.task }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-time Logs -->
      <div class="bg-white rounded-md border border-[#E8E8EC]">
        <div class="px-4 py-3 border-b border-[#ECECF0] flex items-center justify-between">
          <h3 class="text-[13px] font-medium text-[#2D2D35]">实时日志</h3>
          <div class="text-[11px] text-[#9CA3AF]">
            {{ logs.length }} 条日志
          </div>
        </div>
        <div class="max-h-[480px] overflow-y-auto">
          <div
            v-for="(log, idx) in logs"
            :key="log.id || idx"
            class="px-4 py-2.5 border-b border-[#ECECF0] last:border-b-0 flex items-start gap-3 hover:bg-[#F6F7FA] transition-colors"
          >
            <span class="text-[11px] text-[#9CA3AF] font-mono mt-0.5 w-[52px] flex-shrink-0">{{ formatTime(log.timestamp) }}</span>
            <span :class="['w-2 h-2 rounded-full mt-1.5 flex-shrink-0', logLevelStyles[formatLogLevel(log.type)]?.dot || 'bg-[#5B6AD7]']" />
            <div class="flex-1 min-w-0">
              <span class="text-[13px] font-medium text-[#2D2D35]">{{ getAgentName(log.from) }}</span>
              <span class="text-[13px] text-[#6B6B78] ml-1">{{ getLogAction(log) }}</span>
              <p class="text-[11px] text-[#9CA3AF] mt-0.5">{{ getLogDetail(log) }}</p>
            </div>
          </div>

          <div v-if="logs.length === 0" class="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">
            暂无日志
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
