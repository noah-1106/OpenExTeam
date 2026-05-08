<script setup>
const props = defineProps({
  frameworks: { type: Array, required: true },
  agents: { type: Array, required: true },
  selectedFramework: { type: String, default: 'all' },
})

const emit = defineEmits(['select-framework'])

const statusColors = {
  online: 'bg-[#5FA88F]',
  offline: 'bg-[#C5C9D3]',
}

const statusText = {
  online: '在线',
  offline: '离线',
}

function onSelectFramework(id) {
  emit('select-framework', id)
}

function getAgentInitial(name) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <aside class="w-56 bg-white border-r border-[#E8E8EC] flex flex-col">
    <!-- Logo -->
    <div class="px-4 py-3 border-b border-[#ECECF0]">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-md bg-[#5B6AD7] flex items-center justify-center text-white text-[13px] font-bold">
          E
        </div>
        <span class="text-[15px] font-semibold text-[#2D2D35]">ExFlower</span>
      </div>
    </div>

    <!-- Framework List -->
    <div class="px-3 py-3 border-b border-[#ECECF0]">
      <h3 class="px-2 text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">框架</h3>
      <div class="space-y-0.5">
        <button
          v-for="fw in frameworks"
          :key="fw.id"
          @click="onSelectFramework(fw.id)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
            selectedFramework === fw.id
              ? 'bg-[#F0F1FE] text-[#5B6AD7]'
              : 'text-[#2D2D35] hover:bg-[#F6F7FA]'
          ]"
        >
          <span class="text-[13px] font-medium w-5">{{ fw.name.charAt(0) }}</span>
          <span class="flex-1 text-left">{{ fw.name }}</span>
          <span
            :class="[
              'w-2 h-2 rounded-full',
              fw.status === 'connected' ? 'bg-[#5FA88F]' : 'bg-[#C5C9D3]'
            ]"
          />
          <span class="text-[11px] text-[#9CA3AF]">{{ fw.agentCount }}</span>
        </button>
      </div>
    </div>

    <!-- Agent List -->
    <div class="flex-1 px-3 py-3 overflow-y-auto">
      <h3 class="px-2 text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">Agent</h3>
      <div class="space-y-0.5">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#F6F7FA] cursor-pointer transition-colors"
        >
          <div class="relative">
            <div class="w-7 h-7 rounded-md bg-[#F0F0F4] flex items-center justify-center text-[11px] font-semibold text-[#6B6B78]">
              {{ getAgentInitial(agent.name) }}
            </div>
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                statusColors[agent.status]
              ]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-[#2D2D35] truncate">
              {{ agent.name }}
              <span v-if="agent.connected === false" class="ml-1 px-1.5 py-0.5 text-[10px] bg-[#FDF0F0] text-[#C97A7A] rounded">已解绑</span>
            </div>
            <div class="text-[11px] text-[#9CA3AF] truncate">
              {{ statusText[agent.status] }}
              <span v-if="agent.task">· {{ agent.task }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-[#ECECF0]">
      <div class="text-[11px] text-[#9CA3AF]">
        ExFlower
      </div>
    </div>
  </aside>
</template>
