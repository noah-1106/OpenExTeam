<script setup>
const props = defineProps({
  task: { type: Object, required: true },
})
const emit = defineEmits(['click'])

const priorityStyles = {
  high: { bg: 'bg-surface-raised', text: 'text-red-600', label: '高' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-600', label: '中' },
  low: { bg: 'bg-green-50', text: 'text-green-600', label: '低' },
}

const agentAvatars = {
  '品品': '👩‍💼',
  '开开': '👨‍💻',
  '前前': '👨‍🎨',
  '维维': '👨‍🔧',
  '测测': '🧪',
}
</script>

<template>
  <div class="bg-surface rounded-xl p-4 shadow-xs hover:shadow-xs transition-all duration-150 cursor-pointer border border-border-subtle" @click="emit('click', task)">
    <!-- Priority Badge -->
    <div class="flex items-center gap-2 mb-2">
      <span
        :class="[
          'px-2 py-0.5 rounded text-xs font-medium',
          priorityStyles[task.priority]?.bg,
          priorityStyles[task.priority]?.text
        ]"
      >
        {{ priorityStyles[task.priority]?.label }}优先级
      </span>
    </div>

    <!-- Title -->
    <h4 class="font-medium text-primary mb-1 leading-snug">{{ task.title }}</h4>

    <!-- Description -->
    <p v-if="task.description" class="text-sm text-secondary mb-3 line-clamp-2">
      {{ task.description }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between mt-3 pt-3 border-t border-50">
      <!-- Agent -->
      <div class="flex items-center gap-1.5">
        <span class="text-sm">{{ agentAvatars[task.agent] || '👤' }}</span>
        <span class="text-xs text-secondary">{{ task.agent }}</span>
      </div>

      <!-- Date -->
      <span class="text-xs text-muted">{{ task.createdAt }}</span>
    </div>

    <!-- Task Actions (shown on hover) -->
    <div class="flex items-center gap-2 mt-3 opacity-0 hover:opacity-100 transition-opacity">
      <button class="flex-1 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors">
        分配
      </button>
      <button class="flex-1 py-1 text-xs text-primary hover:bg-bg rounded transition-colors">
        详情
      </button>
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
