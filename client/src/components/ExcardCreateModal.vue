<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  agentId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'create'])

const isOpen = computed(() => props.show)

// 表单数据
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

// 生成一个简单的 ID
function generateId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${slug}-${randomStr}`
}

function handleClose() {
  emit('close')
}

function handleCreate() {
  if (!form.value.name.trim()) {
    alert('请填写 ExCard 名称')
    return
  }
  if (!form.value.markdown.trim()) {
    alert('请填写 ExCard 内容')
    return
  }

  const id = generateId(form.value.name)
  emit('create', {
    ...form.value,
    id,
  })
  handleClose()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleClose"></div>
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h3 class="font-semibold text-primary">创建 ExCard</h3>
            <p class="text-xs text-muted mt-1">创建标准化执行模板，定义 Agent 如何执行任务</p>
          </div>
          <button @click="handleClose" class="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">ExCard 名称 *</label>
            <input v-model="form.name" type="text" placeholder="例如：EC-001-daily-report"
              class="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">描述</label>
            <textarea v-model="form.description" rows="2" placeholder="一句话描述这个 ExCard 的用途和使用场景"
              class="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">绑定 Agent</label>
            <input v-model="form.agent" type="text" placeholder="Agent ID"
              :class="[form.agent ? 'bg-gray-50 text-muted' : '']"
              class="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Markdown 内容 *</label>
            <textarea v-model="form.markdown" rows="10" placeholder="# EC-XXX: 卡片名称&#10;&#10;## Resource Dependencies&#10;&#10;### 资源名称&#10;- **Type**: Skill/File/Directory&#10;- **Purpose**: 用途说明&#10;&#10;## Execution Workflow&#10;&#10;### Step 1: 步骤名称&#10;- **Action**: 具体执行动作&#10;- **Checkpoint**: 验证标准&#10;&#10;## Execution Conventions&#10;&#10;### Input Conventions&#10;- **数据来源**: ..."
              class="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
            ></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <button @click="handleClose" class="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">
            取消
          </button>
          <button @click="handleCreate" class="px-4 py-2 text-sm bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors">
            创建 ExCard
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
