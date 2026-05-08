<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  inputText: { type: String, required: true },
})

const emit = defineEmits(['selectCommand'])

const showDropdown = ref(false)
const selectedIndex = ref(0)

const commands = [
  {
    key: 'ec',
    title: '创建 ExCard',
    description: '创建一个新的 ExCard',
  },
  {
    key: 'ecrun',
    title: '执行 ExCard',
    description: '选择并发送 ExCard 给当前 Agent',
  },
  {
    key: 'jobrun',
    title: '运行工作',
    description: '选择并启动一个工作流',
  },
]

const matchedCommands = computed(() => {
  const text = props.inputText.trim()
  if (!text.startsWith('/')) return []

  const search = text.substring(1).toLowerCase()
  return commands.filter(cmd =>
    cmd.key.toLowerCase().startsWith(search) ||
    cmd.title.toLowerCase().includes(search)
  )
})

watch(() => props.inputText, (newText) => {
  if (newText.trim().startsWith('/')) {
    showDropdown.value = true
    selectedIndex.value = 0
  } else {
    showDropdown.value = false
  }
})

function handleKeydown(e) {
  if (!showDropdown.value || matchedCommands.value.length === 0) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % matchedCommands.value.length
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value - 1 + matchedCommands.value.length) % matchedCommands.value.length
      break
    case 'Enter':
    case 'Tab':
      e.preventDefault()
      selectCommand(matchedCommands.value[selectedIndex.value])
      break
    case 'Escape':
      showDropdown.value = false
      break
  }
}

function selectCommand(cmd) {
  emit('selectCommand', cmd.key)
  showDropdown.value = false
}

defineExpose({ handleKeydown })
</script>

<template>
  <div class="relative">
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDropdown && matchedCommands.length > 0"
          class="fixed z-50 bg-white border border-[#E8E8EC] rounded-md min-w-[280px] max-h-[200px] overflow-y-auto"
          :style="{
            left: dropdownStyle.left + 'px',
            top: dropdownStyle.top + 'px'
          }"
        >
          <div class="px-3 py-2 text-[11px] text-[#9CA3AF] border-b border-[#ECECF0]">
            可用命令 (↑/↓ 选择，Enter 确认)
          </div>
          <div
            v-for="(cmd, idx) in matchedCommands"
            :key="cmd.key"
            @click="selectCommand(cmd)"
            :class="[
              'px-4 py-2 cursor-pointer transition-colors',
              selectedIndex === idx ? 'bg-[#F0F1FE]' : 'hover:bg-[#F6F7FA]'
            ]"
          >
            <div class="text-[13px] font-medium text-[#2D2D35]">
              <span class="text-[#5B6AD7]">/{{ cmd.key }}</span>
              <span class="text-[#6B6B78] ml-2">- {{ cmd.title }}</span>
            </div>
            <div class="text-[12px] text-[#9CA3AF] mt-0.5">{{ cmd.description }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
export default {
  data() {
    return {
      dropdownStyle: { left: 0, top: 0 }
    }
  },
  mounted() {
    this.updateDropdownPosition()
  },
  methods: {
    updateDropdownPosition() {
      // 这个组件需要结合输入框位置使用，暂时先简化
    }
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
