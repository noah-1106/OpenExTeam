<script setup>
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()

const typeStyles = {
  success: 'bg-[#EDF7F3] border-[#B8DFCC] text-[#3D6B5A]',
  error: 'bg-[#FDF0F0] border-[#F0C8C8] text-[#8A5555]',
  info: 'bg-[#F0F1FE] border-[#C4CDF0] text-[#3D4590]',
}

const typeIcons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style="max-width: 320px;">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[typeStyles[t.type] || typeStyles.info, 'pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-md border text-[13px]']"
        >
          <span class="font-bold flex-shrink-0 mt-0.5">{{ typeIcons[t.type] || 'ℹ' }}</span>
          <span class="flex-1 break-words leading-relaxed">{{ t.message }}</span>
          <button @click="removeToast(t.id)" class="flex-shrink-0 opacity-50 hover:opacity-100 ml-1 text-[16px] leading-none">×</button>
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
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
