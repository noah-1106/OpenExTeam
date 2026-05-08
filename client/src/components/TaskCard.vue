<script setup>
const props = defineProps({
  task: { type: Object, required: true },
})
const emit = defineEmits(['click'])

const priorityStyles = {
  high: { bg: 'bg-[#FDF0F0]', text: 'text-[#C97A7A]', label: '高' },
  medium: { bg: 'bg-[#FDF5EC]', text: 'text-[#A87D4A]', label: '中' },
  low: { bg: 'bg-[#EDF7F3]', text: 'text-[#4E917A]', label: '低' },
}

function getAgentInitial(name) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <div class="bg-white rounded-md p-4 border border-[#E8E8EC] hover:border-[#C5C9D3] transition-all duration-150 cursor-pointer" @click="emit('click', task)">
    <div class="flex items-center gap-2 mb-2">
      <span
        :class="[
          'px-2 py-0.5 rounded text-[11px] font-medium',
          priorityStyles[task.priority]?.bg,
          priorityStyles[task.priority]?.text
        ]"
      >
        {{ priorityStyles[task.priority]?.label }}优先级
      </span>
    </div>

    <h4 class="text-[13px] font-medium text-[#2D2D35] mb-1 leading-snug">{{ task.title }}</h4>

    <p v-if="task.description" class="text-[12px] text-[#6B6B78] mb-3 line-clamp-2">
      {{ task.description }}
    </p>

    <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#ECECF0]">
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-sm bg-[#F0F0F4] flex items-center justify-center text-[10px] font-semibold text-[#6B6B78]">
          {{ getAgentInitial(task.agent) }}
        </div>
        <span class="text-[11px] text-[#6B6B78]">{{ task.agent }}</span>
      </div>

      <span class="text-[11px] text-[#9CA3AF]">{{ task.createdAt }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
