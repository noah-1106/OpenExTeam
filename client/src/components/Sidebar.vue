<script setup>
import { ref } from 'vue'

const props = defineProps({
  frameworks: { type: Array, required: true },
  agents: { type: Array, required: true },
  selectedFramework: { type: String, default: 'all' },
})

const emit = defineEmits(['select-framework'])

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
}

const statusText = {
  online: '在线',
  offline: '离线',
}

function onSelectFramework(id) {
  emit('select-framework', id)
}
</script>

<template>
  <aside class="w-56 bg-surface border-r border-border flex flex-col">
    <!-- Logo -->
    <div class="px-4 py-4 border-b border-border-subtle">
      <div class="flex items-center gap-2">
        <span class="text-xl">🤖</span>
        <span class="font-semibold text-primary">OpenExTeam</span>
      </div>
    </div>

    <!-- Framework List -->
    <div class="px-3 py-4 border-b border-border-subtle">
      <h3 class="px-2 text-xs font-medium text-muted uppercase tracking-wider mb-2">框架</h3>
      <div class="space-y-1">
        <button
          v-for="fw in frameworks"
          :key="fw.id"
          @click="onSelectFramework(fw.id)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            selectedFramework === fw.id
              ? 'bg-blue-50 text-blue-700'
              : 'text-primary hover:bg-bg'
          ]"
        >
          <span class="text-base">{{ fw.icon }}</span>
          <span class="flex-1 text-left">{{ fw.name }}</span>
          <span
            :class="[
              'w-2 h-2 rounded-full',
              fw.status === 'connected' ? 'bg-green-500' : 'bg-gray-300'
            ]"
          />
          <span class="text-xs text-muted">{{ fw.agentCount }}</span>
        </button>
      </div>
    </div>

    <!-- Agent List -->
    <div class="flex-1 px-3 py-4 overflow-y-auto">
      <h3 class="px-2 text-xs font-medium text-muted uppercase tracking-wider mb-2">Agent</h3>
      <div class="space-y-1">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg cursor-pointer transition-colors"
        >
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-lg">
              {{ agent.avatar }}
            </div>
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                statusColors[agent.status]
              ]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-primary truncate">
              {{ agent.name }}
              <span v-if="agent.connected === false" class="ml-1 px-1.5 py-0.5 text-[10px] bg-red-50 text-red-500 rounded">已解绑</span>
            </div>
            <div class="text-xs text-muted truncate">
              {{ statusText[agent.status] }}
              <span v-if="agent.task">· {{ agent.task }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-border-subtle">
      <div class="text-xs text-muted">
        OpenExTeam v0.1.0
      </div>
    </div>
  </aside>
</template>
