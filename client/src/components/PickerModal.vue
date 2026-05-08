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
        <div class="relative bg-white rounded-md border border-[#E8E8EC] w-full max-w-md mx-4">
          <div class="px-5 py-3 border-b border-[#ECECF0]">
            <h3 class="text-[14px] font-semibold text-[#2D2D35]">{{ title }}</h3>
          </div>
          <div class="px-5 py-3 border-b border-[#ECECF0]">
            <input
              v-model="search"
              type="text"
              placeholder="搜索..."
              class="w-full px-3 py-2 rounded-md border border-[#E8E8EC] text-[13px] bg-[#F6F6F8] outline-none focus:border-[#5B6AD7] focus:bg-white transition-all"
              autofocus
            />
          </div>
          <div class="max-h-64 overflow-y-auto">
            <div v-if="filtered.length === 0" class="px-5 py-8 text-center text-[13px] text-[#9CA3AF]">
              暂无可选项
            </div>
            <div
              v-for="item in filtered"
              :key="item.id"
              @click="select(item)"
              class="px-5 py-3 cursor-pointer hover:bg-[#F6F7FA] transition-colors border-b border-[#ECECF0] last:border-b-0"
            >
              <div class="text-[13px] font-medium text-[#2D2D35]">{{ item.name }}</div>
              <div v-if="item.description" class="text-[12px] text-[#9CA3AF] mt-0.5 truncate">{{ item.description }}</div>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-[#ECECF0] flex justify-end">
            <button @click="$emit('close')" class="px-4 py-1.5 text-[13px] text-[#6B6B78] hover:text-[#2D2D35] rounded-md hover:bg-[#F6F7FA] transition-colors">
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
