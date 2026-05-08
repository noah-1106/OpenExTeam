<script setup>
import { ref, computed, watch } from 'vue'
import { useToast } from '../composables/useToast'

const { toast } = useToast()

const props = defineProps({
  show: { type: Boolean, required: true },
  agentId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'create'])

const isOpen = computed(() => props.show)
const creating = ref(false)
const validationErrors = ref({})

const form = ref({
  id: '',
  name: '',
  description: '',
  markdown: '',
  agent: props.agentId,
})

watch(() => props.agentId, (newId) => {
  form.value.agent = newId
})

function generateId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${slug}-${randomStr}`
}

function handleClose() {
  emit('close')
}

function handleCreate() {
  validationErrors.value = {}
  if (!form.value.name.trim()) {
    validationErrors.value.name = true
    toast.error('请填写 ExCard 名称')
    return
  }
  if (!form.value.markdown.trim()) {
    validationErrors.value.markdown = true
    toast.error('请填写 ExCard 内容')
    return
  }

  const id = generateId(form.value.name)
  emit('create', {
    ...form.value,
    id,
  })
  handleClose()
}

function clearValidationError(field) {
  delete validationErrors.value[field]
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30" @click="handleClose"></div>
      <div class="relative bg-white rounded-md border border-[#E8E8EC] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
        <div class="flex items-center justify-between px-5 py-3 border-b border-[#ECECF0]">
          <div>
            <h3 class="text-[15px] font-semibold text-[#2D2D35]">创建 ExCard</h3>
            <p class="text-[12px] text-[#9CA3AF] mt-0.5">创建标准化执行模板，定义 Agent 如何执行任务</p>
          </div>
          <button @click="handleClose" class="text-[#9CA3AF] hover:text-[#2D2D35] transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l18 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">ExCard 名称 *</label>
            <input v-model="form.name" @input="clearValidationError('name')" type="text" placeholder="例如：EC-001-daily-report"
              :class="['w-full px-3 py-2 border rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all', validationErrors.name ? 'border-[#C97A7A]' : 'border-[#E8E8EC]']"
            />
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">描述</label>
            <textarea v-model="form.description" rows="2" placeholder="一句话描述这个 ExCard 的用途和使用场景"
              class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
            ></textarea>
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">绑定 Agent</label>
            <input v-model="form.agent" type="text" placeholder="Agent ID"
              :class="[form.agent ? 'bg-[#F6F7FA] text-[#9CA3AF]' : '']"
              class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
            />
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">Markdown 内容 *</label>
            <textarea v-model="form.markdown" @input="clearValidationError('markdown')" rows="10" placeholder="# EC-XXX: 卡片名称&#10;&#10;## Resource Dependencies&#10;&#10;### 资源名称&#10;- **Type**: Skill/File/Directory&#10;- **Purpose**: 用途说明&#10;&#10;## Execution Workflow&#10;&#10;### Step 1: 步骤名称&#10;- **Action**: 具体执行动作&#10;- **Checkpoint**: 验证标准&#10;&#10;## Execution Conventions&#10;&#10;### Input Conventions&#10;- **数据来源**: ..."
              :class="['w-full px-3 py-2 border rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all font-mono', validationErrors.markdown ? 'border-[#C97A7A]' : 'border-[#E8E8EC]']"
            ></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 px-5 py-3 border-t border-[#ECECF0]">
          <button @click="handleClose" class="px-4 py-2 text-[13px] text-[#6B6B78] hover:text-[#2D2D35] transition-colors">
            取消
          </button>
          <button @click="handleCreate" :disabled="creating" class="px-4 py-2 text-[13px] bg-[#5B6AD7] text-white rounded-md font-medium hover:bg-[#4A58C0] transition-colors disabled:opacity-50">
            {{ creating ? '创建中...' : '创建 ExCard' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
