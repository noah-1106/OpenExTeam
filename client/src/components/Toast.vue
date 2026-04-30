<script setup>
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()

const typeStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

const typeIcons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style="max-width: 360px;">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[typeStyles[t.type] || typeStyles.info, 'pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-lg border shadow-sm text-sm']"
        >
          <span class="font-bold flex-shrink-0">{{ typeIcons[t.type] || 'ℹ' }}</span>
          <span class="flex-1 break-words">{{ t.message }}</span>
          <button @click="removeToast(t.id)" class="flex-shrink-0 opacity-60 hover:opacity-100 ml-1">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.25s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
