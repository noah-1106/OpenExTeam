<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  title: { type: String, default: '选择' },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['select', 'close'])

const search = ref('')

const filtered = computed(() => {
  if (!search.value.trim()) return props.items
  const q = search.value.toLowerCase()
  return props.items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q)
  )
})

watch(() => props.show, (v) => {
  if (v) search.value = ''
})

function select(item) {
  emit('select', item)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/30" @click="$emit('close')"></div>
        <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-md mx-4">
          <!-- 头部 -->
          <div class="px-5 py-4 border-b border-border-subtle">
            <h3 class="text-base font-semibold text-primary">{{ title }}</h3>
          </div>
          <!-- 搜索 -->
          <div class="px-5 py-3 border-b border-border-subtle">
            <input
              v-model="search"
              type="text"
              placeholder="搜索..."
              class="w-full px-3 py-2 rounded-lg border border-border text-sm bg-bg focus:outline-none focus:border-accent"
              autofocus
            />
          </div>
          <!-- 列表 -->
          <div class="max-h-64 overflow-y-auto">
            <div v-if="filtered.length === 0" class="px-5 py-8 text-center text-sm text-muted">
              暂无可选项
            </div>
            <div
              v-for="item in filtered"
              :key="item.id"
              @click="select(item)"
              class="px-5 py-3 cursor-pointer hover:bg-surface-raised transition-colors border-b border-border-subtle last:border-b-0"
            >
              <div class="text-sm font-medium text-primary">{{ item.name }}</div>
              <div v-if="item.description" class="text-xs text-muted mt-0.5 truncate">{{ item.description }}</div>
            </div>
          </div>
          <!-- 底部 -->
          <div class="px-5 py-3 border-t border-border-subtle flex justify-end">
            <button @click="$emit('close')" class="px-4 py-1.5 text-sm text-secondary hover:text-primary rounded-lg hover:bg-surface-raised transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
