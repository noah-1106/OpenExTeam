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

const form = ref({
  id: '',
  name: '',
  description: '',
  markdown: '',
  agent: props.agentId,
})

function parseProposal(text) {
  const lines = text.split('\n')
  let inMarkdown = false
  let markdownLines = []
  let nameFromProposal = ''
  let descFromProposal = ''
  let agentFromProposal = props.agentId
  let fullMarkdown = ''

  let isKeyValueFormat = false
  let isMarkdownFormat = false

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
  } else if (isMarkdownFormat) {
    fullMarkdown = text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!nameFromProposal && line.includes('name') && line.includes('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p)
        if (parts.length === 2 && parts[0] === 'name') {
          nameFromProposal = parts[1]
        }
      }
      if (!descFromProposal && line.includes('## 卡片目的') && i + 2 < lines.length) {
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

  if (!nameFromProposal) {
    nameFromProposal = 'new-excard-' + Date.now().toString(36)
  }
  if (!descFromProposal) {
    descFromProposal = '通过 Agent 提案创建的 ExCard'
  }
  if (!fullMarkdown) {
    const startIdx = text.indexOf('[EXCARD_PROPOSAL]')
    if (startIdx >= 0) {
      fullMarkdown = text.substring(startIdx + '[EXCARD_PROPOSAL]'.length).trim()
    } else {
      fullMarkdown = text
    }
  }

  return {
    name: nameFromProposal,
    description: descFromProposal,
    agent: agentFromProposal,
    markdown: fullMarkdown,
  }
}

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
      <div class="absolute inset-0 bg-black/30" @click="handleClose"></div>
      <div class="relative bg-white rounded-md border border-[#E8E8EC] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
        <div class="flex items-center justify-between px-5 py-3 border-b border-[#ECECF0]">
          <div>
            <h3 class="text-[15px] font-semibold text-[#2D2D35]">{{ props.isModifyMode ? '修改 ExCard' : '创建 ExCard' }}</h3>
            <p class="text-[12px] text-[#9CA3AF] mt-0.5">Agent 提议{{ props.isModifyMode ? '修改' : '创建' }}一个 ExCard，你可以修改后确认</p>
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
            <input v-model="form.name" @input="clearValidationError('name')" type="text" placeholder="输入名称"
              :class="['w-full px-3 py-2 border rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all', validationErrors.name ? 'border-[#C97A7A]' : 'border-[#E8E8EC]']"
            />
          </div>
          <div v-if="props.isModifyMode">
            <p class="text-[11px] text-[#9CA3AF]">正在修改: {{ props.targetExcardId }}</p>
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">描述</label>
            <textarea v-model="form.description" rows="2" placeholder="简要描述这个 ExCard 的用途"
              class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
            ></textarea>
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">绑定 Agent</label>
            <input v-model="form.agent" type="text" placeholder="Agent ID" readonly
              class="w-full px-3 py-2 bg-[#F6F7FA] border border-[#E8E8EC] rounded-md text-[13px] outline-none text-[#9CA3AF]"
            />
          </div>

          <div>
            <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">Markdown 内容 *</label>
            <textarea v-model="form.markdown" @input="clearValidationError('markdown')" rows="10" placeholder="# ExCard 标题&#10;&#10;## 任务描述&#10;..."
              :class="['w-full px-3 py-2 border rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all font-mono', validationErrors.markdown ? 'border-[#C97A7A]' : 'border-[#E8E8EC]']"
            ></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 px-5 py-3 border-t border-[#ECECF0]">
          <button @click="handleClose" class="px-4 py-2 text-[13px] text-[#6B6B78] hover:text-[#2D2D35] transition-colors">
            取消
          </button>
          <button @click="handleCreate" class="px-4 py-2 text-[13px] bg-[#5B6AD7] text-white rounded-md font-medium hover:bg-[#4A58C0] transition-colors">
            创建 ExCard
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
