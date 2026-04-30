<script setup>
import { ref, watch, computed } from 'vue'
import { useToast } from '../composables/useToast'

const { toast } = useToast()

const props = defineProps({
  show: { type: Boolean, required: true },
  agentId: { type: String, required: true },
  rawText: { type: String, required: true },
  isModifyMode: { type: Boolean, default: false },
  targetExcardId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'create'])

const isOpen = computed(() => props.show)
const validationErrors = ref({})

// 表单数据
const form = ref({
  id: '',
  name: '',
  description: '',
  markdown: '',
  agent: props.agentId,
})

// 解析提议格式
function parseProposal(text) {
  const lines = text.split('\n')
  let inMarkdown = false
  let markdownLines = []
  let nameFromProposal = ''
  let descFromProposal = ''
  let agentFromProposal = props.agentId
  let fullMarkdown = ''

  console.log('[ExcardProposalModal] 开始解析:', text.substring(0, 200))

  // 先检查是否是 [EXCARD_PROPOSAL] 键值对格式
  let isKeyValueFormat = false
  // 再检查是否是 # EXCARD_PROPOSAL Markdown 标题格式
  let isMarkdownFormat = false

  // 第一次扫描确定格式
  for (let line of lines) {
    if (line.trim().startsWith('[EXCARD_PROPOSAL]')) {
      isKeyValueFormat = true
      break
    }
    if (line.trim() === '# EXCARD_PROPOSAL') {
      isMarkdownFormat = true
      break
    }
  }

  console.log('[ExcardProposalModal] 格式检测:', { isKeyValueFormat, isMarkdownFormat })

  // 第二次扫描提取内容
  if (isKeyValueFormat) {
    for (let line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[EXCARD_PROPOSAL]')) {
        continue
      }
      if (trimmed.toLowerCase().startsWith('markdown:')) {
        inMarkdown = true
        continue
      }
      if (inMarkdown) {
        markdownLines.push(line)
      } else {
        const colonIndex = trimmed.indexOf(':')
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim().toLowerCase()
          const value = trimmed.substring(colonIndex + 1).trim()
          if (key === 'name') nameFromProposal = value
          if (key === 'description') descFromProposal = value
          if (key === 'agent' && value) agentFromProposal = value
        }
      }
    }
    fullMarkdown = markdownLines.join('\n').trim()
    console.log('[ExcardProposalModal] 键值对格式解析结果:', { nameFromProposal, descFromProposal, markdownLength: fullMarkdown.length })
  } else if (isMarkdownFormat) {
    // 直接把整个内容作为 markdown
    fullMarkdown = text
    // 尝试从内容中提取名称和描述
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // 尝试从内容中找卡片名称
      if (!nameFromProposal && line.includes('name') && line.includes('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p)
        if (parts.length === 2 && parts[0] === 'name') {
          nameFromProposal = parts[1]
        }
      }
      if (!descFromProposal && line.includes('## 卡片目的') && i + 2 < lines.length) {
        // 取卡片目的下面的第一段
        let descBuffer = []
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith('---') || lines[j].trim().startsWith('##')) {
            break
          }
          if (lines[j].trim()) {
            descBuffer.push(lines[j].trim())
          }
        }
        descFromProposal = descBuffer.join(' ').substring(0, 100)
      }
    }
  }

  // 设置默认值
  if (!nameFromProposal) {
    nameFromProposal = 'new-excard-' + Date.now().toString(36)
  }
  if (!descFromProposal) {
    descFromProposal = '通过 Agent 提案创建的 ExCard'
  }
  if (!fullMarkdown) {
    // 如果没有提取到 markdown，尝试使用全部文本（去除头部）
    const startIdx = text.indexOf('[EXCARD_PROPOSAL]')
    if (startIdx >= 0) {
      fullMarkdown = text.substring(startIdx + '[EXCARD_PROPOSAL]'.length).trim()
    } else {
      fullMarkdown = text
    }
  }

  console.log('[ExcardProposalModal] 最终解析结果:', { nameFromProposal, descFromProposal, fullMarkdownLength: fullMarkdown.length })

  return {
    name: nameFromProposal,
    description: descFromProposal,
    agent: agentFromProposal,
    markdown: fullMarkdown,
  }
}

// 当 props 变化时解析
watch(() => props.rawText, (newText) => {
  if (newText) {
    const parsed = parseProposal(newText)
    form.value = {
      id: '',
      name: parsed.name || '',
      description: parsed.description || '',
      markdown: parsed.markdown || '',
      agent: parsed.agent || props.agentId,
    }
  }
}, { immediate: true })

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

  const id = props.isModifyMode ? props.targetExcardId : generateId(form.value.name)
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
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleClose"></div>
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h3 class="font-semibold text-primary">{{ props.isModifyMode ? '修改 ExCard' : '创建 ExCard' }}</h3>
            <p class="text-xs text-muted mt-1">Agent 提议{{ props.isModifyMode ? '修改' : '创建' }}一个 ExCard，你可以修改后确认</p>
          </div>
          <button @click="handleClose" class="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div v-if="!props.isModifyMode">
            <label class="block text-sm font-medium text-primary mb-1.5">ExCard 名称 *</label>
            <input v-model="form.name" @input="clearValidationError('name')" type="text" placeholder="输入名称"
              :class="['w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent focus:border-transparent', validationErrors.name ? 'border-red-400' : 'border-border']"
            />
          </div>
          <div v-else>
            <label class="block text-sm font-medium text-primary mb-1.5">ExCard 名称 *</label>
            <input v-model="form.name" @input="clearValidationError('name')" type="text" placeholder="输入名称"
              :class="['w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent focus:border-transparent', validationErrors.name ? 'border-red-400' : 'border-border']"
            />
            <p class="text-xs text-muted mt-1">正在修改: {{ props.targetExcardId }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">描述</label>
            <textarea v-model="form.description" rows="2" placeholder="简要描述这个 ExCard 的用途"
              class="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">绑定 Agent</label>
            <input v-model="form.agent" type="text" placeholder="Agent ID" readonly
              class="w-full px-3 py-2 bg-gray-50 border border-border rounded-lg text-sm outline-none text-muted"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">Markdown 内容 *</label>
            <textarea v-model="form.markdown" @input="clearValidationError('markdown')" rows="10" placeholder="# ExCard 标题&#10;&#10;## 任务描述&#10;..."
              :class="['w-full px-3 py-2 bg-surface-raised border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono', validationErrors.markdown ? 'border-red-400' : 'border-border']"
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
