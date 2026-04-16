<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  agents: { type: Array, required: true },
})

const statusConfig = {
  online: { label: '在线', color: 'text-green-600', bg: 'bg-green-50' },
  busy: { label: '忙碌', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  offline: { label: '离线', color: 'text-muted', bg: 'bg-surface' },
}

const agentAvatars = {
  '品品': '👩‍💼',
  '开开': '👨‍💻',
  '前前': '👨‍🎨',
  '维维': '👨‍🔧',
  '测测': '🧪',
}

const mockLogs = ref([
  { time: '18:13:22', agent: '品品', action: '完成任务', detail: '调研 Mission Control 竞品', level: 'info' },
  { time: '18:10:05', agent: '开开', action: '发送消息', detail: '会话已建立', level: 'info' },
  { time: '18:05:33', agent: '前前', action: '创建任务', detail: '前端项目初始化', level: 'info' },
  { time: '17:58:11', agent: '品品', action: 'spawn', detail: '创建子 agent', level: 'warn' },
  { time: '17:45:00', agent: '测测', action: '健康检查', detail: '连接正常', level: 'info' },
])

function refresh() {
  // 模拟刷新：更新时间戳
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`
  mockLogs.value.unshift({ time: timeStr, agent: '系统', action: '刷新监控数据', detail: '数据已更新', level: 'info' })
  if (mockLogs.value.length > 20) mockLogs.value.pop()
}

const logLevelStyles = {
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-orange-600',
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-primary">监控面板</h2>
      <button @click="refresh" class="px-3 py-1.5 text-sm text-accent hover:bg-accent-dim rounded-lg transition-colors">
        ↻ 刷新
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
            <h3 class="font-medium text-primary">{{ agent.name }}</h3>
            <p :class="['text-sm mt-0.5', statusConfig[agent.status]?.color]">
              {{ statusConfig[agent.status]?.label }}
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
        <div class="flex gap-2">
          <span class="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">全部</span>
          <span class="px-2 py-0.5 text-xs bg-surface text-secondary rounded cursor-pointer hover:bg-surface-raised">警告</span>
          <span class="px-2 py-0.5 text-xs bg-surface text-secondary rounded cursor-pointer hover:bg-surface-raised">错误</span>
        </div>
      </div>
      <div class="max-h-64 overflow-y-auto">
        <div
          v-for="(log, idx) in mockLogs"
          :key="idx"
          class="px-4 py-2.5 border-b border-gray-50 last:border-0 flex items-start gap-3 hover:bg-surface-raised/50"
        >
          <span class="text-xs text-muted font-mono mt-0.5">{{ log.time }}</span>
          <span :class="['w-2 h-2 rounded-full mt-1.5', log.level === 'info' ? 'bg-blue-400' : log.level === 'warn' ? 'bg-yellow-400' : 'bg-red-400']" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-primary">{{ log.agent }}</span>
            <span class="text-sm text-secondary ml-1">{{ log.action }}</span>
            <p class="text-xs text-muted mt-0.5">{{ log.detail }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
