<script setup>
import { ref, computed, onMounted } from 'vue'
import { useExcardStore } from '../stores/excards'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../composables/useToast'
import ExcardMdEditor from '../components/ExcardMdEditor.vue'
import api from '../api/client'

const store = useExcardStore()
const settingsStore = useSettingsStore()
const { toast } = useToast()
const saving = ref(false)
const validationErrors = ref({})

function clearValidationError(field) {
  delete validationErrors.value[field]
}
const showCreateModal = ref(false)
const isEditing = ref(false)
const editData = ref({})
const useMdEditor = ref(false)
const agents = ref([])

async function fetchAgents() {
  try {
    const data = await api.getAgents()
    agents.value = data.agents || []
  } catch (err) {
    console.error('[ExcardView] fetchAgents error:', err)
    agents.value = []
  }
}

onMounted(() => {
  store.fetchExcards()
  settingsStore.fetchAdapters()
  fetchAgents()
})

const selectedExcard = computed(() => store.selectedExcard)
const availableAgents = computed(() => {
  if (agents.value.length > 0) {
    return agents.value.map(a => ({
      id: a.id,
      name: a.name,
      adapter: a.adapter
    }))
  } else {
    return (settingsStore.adapters || []).map(a => ({
      id: a.id,
      name: a.name || a.id
    }))
  }
})

const newExcard = ref({
  name: '',
  description: '',
  category: 'general',
  agent: '',
  tags: [],
  resources: [],
  workflow: [],
  conventions: { input: '', output: '', errorHandling: '' }
})

const newStepName = ref('')
const newStepDesc = ref('')
const newResource = ref('')
const newTag = ref('')

const editNewStepName = ref('')
const editNewStepDesc = ref('')
const editNewResource = ref('')
const editNewTag = ref('')

const categories = [
  { value: 'general', label: '通用' },
  { value: 'writing', label: '写作' },
  { value: 'data', label: '数据' },
  { value: 'engineering', label: '工程' },
  { value: 'operations', label: '运营' },
  { value: 'research', label: '研究' }
]

async function toggleSelect(ec) {
  if (store.selectedExcard?.id === ec?.id) {
    store.selectedExcard = null
    isEditing.value = false
  } else {
    await store.selectExcard(ec)
    await startEditExcard()
  }
}

function openCreateModal() {
  resetForm()
  showCreateModal.value = true
}

function resetForm() {
  newExcard.value = {
    name: '',
    description: '',
    category: 'general',
    agent: '',
    tags: [],
    resources: [],
    workflow: [],
    conventions: { input: '', output: '', errorHandling: '' }
  }
  newStepName.value = ''
  newStepDesc.value = ''
  newResource.value = ''
  newTag.value = ''
}

function addResource() {
  if (!newResource.value.trim()) return
  const name = newResource.value.trim()
  if (!newExcard.value.resources.some(r => (typeof r === 'object' ? r.name : r) === name)) {
    newExcard.value.resources.push({ name, type: '', source: '', path: '', purpose: '' })
  }
  newResource.value = ''
}
function removeResource(idx) {
  newExcard.value.resources.splice(idx, 1)
}

function addStep() {
  if (!newStepName.value.trim()) return
  newExcard.value.workflow.push({
    index: newExcard.value.workflow.length + 1,
    name: newStepName.value.trim(),
    description: newStepDesc.value.trim()
  })
  newStepName.value = ''
  newStepDesc.value = ''
}
function removeStep(idx) {
  newExcard.value.workflow.splice(idx, 1)
  newExcard.value.workflow.forEach((s, i) => { s.index = i + 1 })
}

function addTag() {
  const t = newTag.value.trim()
  if (t && !newExcard.value.tags.includes(t)) newExcard.value.tags.push(t)
  newTag.value = ''
}
function removeTag(tag) {
  const idx = newExcard.value.tags.indexOf(tag)
  if (idx >= 0) newExcard.value.tags.splice(idx, 1)
}

async function createExcard() {
  validationErrors.value = {}
  if (!newExcard.value.name.trim()) {
    validationErrors.value.name = true
    toast.error('请填写 ExCard 名称')
    return
  }
  if (!newExcard.value.agent) {
    validationErrors.value.agent = true
    toast.error('请为 ExCard 绑定一个 Agent')
    return
  }
  try {
    const num = String(store.excards.length + 1).padStart(3, '0')
    const id = `EC-${num}`
    await store.createExcard({ id, ...JSON.parse(JSON.stringify(newExcard.value)) })
    showCreateModal.value = false
    toast.success('ExCard 创建成功')
  } catch (err) {
    toast.error('创建失败：' + err.message)
  }
}

async function startEditExcard() {
  try {
    const mdData = await api.getExcardMd(store.selectedExcard.id)
    if (mdData) {
      editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
      if (mdData.markdown) {
        const parsed = parseExcardMd(mdData.markdown)
        editData.value.name = parsed.name || editData.value.name
        editData.value.description = parsed.description || editData.value.description
        editData.value.category = parsed.category || editData.value.category
        editData.value.agent = parsed.agent || editData.value.agent
        editData.value.tags = parsed.tags?.length ? parsed.tags : editData.value.tags
        editData.value.resources = parsed.resources?.length ? parsed.resources : editData.value.resources
        editData.value.workflow = parsed.workflow?.length ? parsed.workflow : editData.value.workflow
        if (parsed.conventions) {
          editData.value.conventions = {
            input: parsed.conventions.input || editData.value.conventions?.input || '',
            output: parsed.conventions.output || editData.value.conventions?.output || '',
            errorHandling: parsed.conventions.errorHandling || editData.value.conventions?.errorHandling || ''
          }
        }
      }
    } else {
      editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
    }
  } catch (err) {
    console.error('[ExcardView] 解析 Markdown 失败:', err)
    editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
  }
  if (!editData.value.conventions) editData.value.conventions = { input: '', output: '', errorHandling: '' }
  if (!editData.value.tags) editData.value.tags = []
  if (!editData.value.resources) editData.value.resources = []
  if (!editData.value.workflow) editData.value.workflow = []
  if (!editData.value.agent) editData.value.agent = ''
  editNewStepName.value = ''
  editNewStepDesc.value = ''
  editNewResource.value = ''
  editNewTag.value = ''
  isEditing.value = true
  useMdEditor.value = false
}

function parseExcardMd(mdContent) {
  const excard = {
    name: '',
    description: '',
    category: 'general',
    agent: '',
    tags: [],
    resources: [],
    workflow: [],
    conventions: {
      input: '',
      output: '',
      errorHandling: ''
    }
  }

  const lines = mdContent.split('\n')
  let currentSection = ''
  let currentStep = null
  let currentResource = null
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const rawLine = lines[i]

    if (line === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }

    if (inFrontmatter) {
      if (line.startsWith('name:')) excard.name = line.slice(5).trim()
      if (line.startsWith('category:')) excard.category = line.slice(9).trim()
      if (line.startsWith('agent:')) excard.agent = line.slice(6).trim()
      if (line.startsWith('tags:')) {
        excard.tags = line.slice(5).trim().split(',').map(t => t.trim()).filter(Boolean)
      }
      continue
    }

    if (line.startsWith('# ')) {
      if (!excard.name) excard.name = line.slice(2).trim()
      continue
    }

    if (line.startsWith('## ')) {
      const title = line.slice(3).trim().toLowerCase()
      if (title.includes('resource') || title.includes('资源')) {
        currentSection = 'resource dependencies'
      } else if (title.includes('workflow') || title.includes('工作流') || title.includes('执行步骤') || title.includes('步骤')) {
        currentSection = 'execution workflow'
      } else if (title.includes('convention') || title.includes('约定') || title.includes('输出要求') || title.includes('执行约定')) {
        currentSection = 'execution conventions'
      } else if (title.includes('purpose') || title.includes('目的') || title.includes('描述') || title.includes('任务') || title.includes('卡片')) {
        currentSection = 'description'
      } else {
        currentSection = title
      }
      continue
    }

    if ((!currentSection || currentSection === 'description') && line && !line.startsWith('#')) {
      if (excard.description) excard.description += '\n' + line
      else excard.description = line
      continue
    }

    if (currentSection === 'resource dependencies') {
      if (line.startsWith('### ')) {
        if (currentResource && currentResource.name) {
          excard.resources.push(currentResource)
        }
        const resName = line.slice(4).trim()
        if (resName) {
          currentResource = { name: resName, type: '', source: '', path: '', purpose: '' }
        }
      } else if (currentResource && line.match(/^-\s+\*\*/)) {
        const kvMatch = line.match(/^-\s+\*\*(.*?)\*\*:\s*(.*)$/)
        if (kvMatch) {
          const key = kvMatch[1].trim().toLowerCase()
          const value = kvMatch[2].trim()
          if (key === 'type') currentResource.type = value
          else if (key === 'source') currentResource.source = value
          else if (key === 'path') currentResource.path = value
          else if (key === 'purpose') currentResource.purpose = value
        }
      } else if ((line.startsWith('- ') || line.startsWith('* ')) && !currentResource) {
        const resourceText = line.slice(2).trim()
        excard.resources.push(resourceText)
      } else if (line.trim() === '' && currentResource) {
        if (currentResource.name) {
          excard.resources.push(currentResource)
        }
        currentResource = null
      }
    }

    if (currentSection === 'execution workflow') {
      if (line.match(/^###\s+step\s+\d+/i)) {
        if (currentStep) excard.workflow.push(currentStep)
        const stepMatch = line.match(/^###\s+[Ss]tep\s+(\d+)\s*[:：]?\s*(.*)$/)
        if (stepMatch) {
          currentStep = {
            index: parseInt(stepMatch[1]),
            name: stepMatch[2].trim(),
            description: '',
            action: '',
            tool: '',
            input: '',
            output: '',
            checkpoint: ''
          }
        }
      } else if (line.match(/^\d+\.\s/)) {
        if (currentStep) excard.workflow.push(currentStep)
        const stepMatch = line.match(/^(\d+)\.\s\*\*(.*?)\*\*(.*)$/)
        if (stepMatch) {
          currentStep = {
            index: parseInt(stepMatch[1]),
            name: stepMatch[2].trim(),
            description: stepMatch[3].trim()
          }
        } else {
          const simpleMatch = line.match(/^(\d+)\.\s(.*)$/)
          currentStep = {
            index: parseInt(simpleMatch[1]),
            name: simpleMatch[2].trim(),
            description: ''
          }
        }
      } else if (currentStep && line) {
        const kvMatch = line.match(/^-\s+\*\*(.*?)\*\*:\s*(.*)$/)
        if (kvMatch) {
          const key = kvMatch[1].trim().toLowerCase()
          const value = kvMatch[2].trim()
          if (key === 'action') currentStep.action = value
          else if (key === 'tool used' || key === 'tool') currentStep.tool = value
          else if (key === 'input') currentStep.input = value
          else if (key === 'output') currentStep.output = value
          else if (key === 'checkpoint') currentStep.checkpoint = value
          else if (key === 'description') currentStep.description = value
        } else if (!line.toLowerCase().startsWith('agent:')) {
          if (currentStep.description) currentStep.description += '\n' + rawLine.trim()
          else currentStep.description = rawLine.trim()
        }
      }
    }

    if (currentSection === 'execution conventions') {
      if (line.toLowerCase().startsWith('### input') || line.toLowerCase().startsWith('## input') ||
          line.toLowerCase().includes('### 输入') || line.toLowerCase().includes('## 输入') ||
          line.toLowerCase().includes('input conventions')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        excard.conventions.input = content
      } else if (line.toLowerCase().startsWith('### output') || line.toLowerCase().startsWith('## output') ||
                 line.toLowerCase().includes('### 输出') || line.toLowerCase().includes('## 输出') ||
                 line.toLowerCase().includes('output conventions')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        excard.conventions.output = content
      } else if (line.toLowerCase().startsWith('### error') || line.toLowerCase().startsWith('## error') ||
                 line.toLowerCase().includes('### 错误') || line.toLowerCase().includes('## 错误')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        excard.conventions.errorHandling = content
      }
    } else if (currentSection === '输出要求') {
      if (!line.startsWith('#')) {
        if (excard.conventions.output) excard.conventions.output += '\n' + line
        else excard.conventions.output = line
      }
    }
  }

  if (currentStep) excard.workflow.push(currentStep)
  if (currentResource && currentResource.name) excard.resources.push(currentResource)

  return excard
}

async function saveEditExcard() {
  if (!useMdEditor.value && !editData.value.agent) {
    toast.error('请为 ExCard 绑定一个 Agent')
    return
  }
  saving.value = true
  try {
    if (useMdEditor.value) {
      await store.updateExcardMd(store.selectedExcard.id, store.selectedExcardMd)
    } else {
      await store.updateExcard(store.selectedExcard.id, editData.value)
    }
    isEditing.value = false
    toast.success('ExCard 保存成功')
  } catch (err) {
    toast.error('保存失败：' + err.message)
  } finally {
    saving.value = false
  }
}

function cancelEditExcard() {
  isEditing.value = false
  useMdEditor.value = false
}

async function deleteExcard() {
  if (!confirm(`确定删除 ExCard「${store.selectedExcard.name}」？`)) return
  await store.deleteExcard(store.selectedExcard.id)
}

function getCategoryLabel(category) {
  const cat = categories.find(c => c.value === category)
  return cat ? cat.label : category
}
</script>

<template>
  <div class="h-full flex flex-col p-6">
    <div class="flex items-center justify-between mb-5 flex-shrink-0">
      <div>
        <h2 class="text-[15px] font-semibold text-[#2D2D35]">ExCard 模板库</h2>
        <p class="text-[13px] text-[#9CA3AF] mt-0.5">标准化 Agent 执行卡片模板</p>
      </div>
      <button
        @click="openCreateModal"
        class="px-4 py-2 bg-[#5B6AD7] text-white rounded-md text-[13px] font-medium hover:bg-[#4A58C0] transition-all duration-150 flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        新建 ExCard
      </button>
    </div>

    <div class="flex-1 flex gap-4 overflow-hidden">
      <div class="flex-1 overflow-y-auto pr-1">
        <div v-if="store.loading" class="flex items-center justify-center h-48 text-[#9CA3AF]">
          <span class="animate-pulse text-[13px]">加载中...</span>
        </div>
        <div v-else-if="store.excards.length === 0" class="flex flex-col items-center justify-center h-48 text-[#9CA3AF]">
          <svg class="w-10 h-10 text-[#C5C9D3] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-[13px]">暂无 ExCard 模板</p>
          <p class="text-[12px] mt-1">点击「新建 ExCard」创建第一个执行模板</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div
            v-for="ec in store.excards"
            :key="ec.id"
            @click="toggleSelect(ec)"
            :class="[
              'bg-white rounded-md border cursor-pointer transition-all duration-200 hover:border-[#C5C9D3]',
              selectedExcard?.id === ec.id ? 'border-[#5B6AD7] shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)]' : 'border-[#E8E8EC]'
            ]"
          >
            <div class="p-4">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <div class="text-[11px] text-[#9CA3AF] font-mono mb-1">{{ ec.id }}</div>
                  <h3 class="text-[13px] font-semibold text-[#2D2D35]">{{ ec.name }}</h3>
                </div>
              </div>
              <p class="text-[12px] text-[#6B6B78] mb-3 line-clamp-2">{{ ec.description || '暂无描述' }}</p>
              <div class="flex flex-wrap gap-1.5 mb-3">
                <span class="text-[11px] px-2 py-0.5 rounded bg-[#F6F7FA] text-[#6B6B78]">{{ getCategoryLabel(ec.category) }}</span>
                <span
                  v-for="tag in (ec.tags || []).slice(0, 2)"
                  :key="tag"
                  class="px-2 py-0.5 rounded text-[11px] bg-[#F0F1FE] text-[#5B6AD7]"
                >
                  {{ tag }}
                </span>
                <span v-if="(ec.tags || []).length > 2" class="text-[11px] text-[#9CA3AF]">+{{ ec.tags.length - 2 }}</span>
              </div>
              <div class="flex items-center gap-4 text-[11px] text-[#9CA3AF]">
                <span v-if="ec.agent" class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {{ ec.agent }}
                </span>
                <span>{{ (ec.resources || []).length }} 资源</span>
                <span>{{ (ec.workflow || []).length }} 步骤</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.selectedExcard" class="w-[420px] flex flex-col bg-white rounded-md border border-[#E8E8EC] flex-shrink-0 overflow-hidden">
        <div class="flex justify-between items-center p-3 border-b border-[#ECECF0] flex-shrink-0">
          <div class="flex items-center gap-2">
            <button
              @click="useMdEditor = false"
              :class="[
                'px-2.5 py-1 text-[11px] rounded transition-all',
                !useMdEditor ? 'bg-[#5B6AD7] text-white' : 'text-[#6B6B78] hover:text-[#2D2D35]'
              ]"
            >
              表单编辑
            </button>
            <button
              @click="useMdEditor = true"
              :class="[
                'px-2.5 py-1 text-[11px] rounded transition-all',
                useMdEditor ? 'bg-[#5B6AD7] text-white' : 'text-[#6B6B78] hover:text-[#2D2D35]'
              ]"
            >
              Markdown
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button @click="cancelEditExcard" class="px-2.5 py-1 text-[11px] text-[#6B6B78] hover:text-[#2D2D35]">取消</button>
            <button @click="saveEditExcard" :disabled="saving" class="px-2.5 py-1 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0] disabled:opacity-50">{{ saving ? '保存中...' : '保存' }}</button>
            <button @click="deleteExcard" class="px-2.5 py-1 text-[11px] border border-[#F0C8C8] text-[#C97A7A] rounded-md hover:bg-[#FDF0F0]">删除</button>
          </div>
        </div>

        <div v-if="isEditing && useMdEditor" class="flex-1 p-3 overflow-hidden">
          <ExcardMdEditor v-model="store.selectedExcardMd" :readonly="false" />
        </div>

        <template v-else>
          <div class="flex-1 overflow-y-auto p-4">
            <div class="text-[11px] text-[#9CA3AF] font-mono mb-3">{{ selectedExcard.id }}</div>
            <div class="space-y-4">
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">名称</label>
                <input v-model="editData.name" type="text" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">描述</label>
                <textarea v-model="editData.description" rows="2" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">分类</label>
                  <select v-model="editData.category" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white">
                    <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">绑定 Agent</label>
                  <select v-model="editData.agent" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white">
                    <option value="">-- 选择 Agent --</option>
                    <option v-for="ag in availableAgents" :key="ag.id" :value="ag.name">
                      {{ ag.adapter ? `[${ag.adapter}] ` : '' }}{{ ag.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">标签</label>
                <div class="flex items-center gap-2 mb-2">
                  <input v-model="editNewTag" type="text" placeholder="添加标签..." class="flex-1 px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  <button @click="() => { if (editNewTag.trim() && !editData.tags.includes(editNewTag.trim())) { editData.tags.push(editNewTag.trim()); editNewTag = '' } }" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">添加</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in editData.tags"
                    :key="tag"
                    class="px-2 py-0.5 rounded text-[11px] bg-[#F0F1FE] text-[#5B6AD7] flex items-center gap-1"
                  >
                    {{ tag }}
                    <button @click="() => { const idx = editData.tags.indexOf(tag); if (idx >=0) editData.tags.splice(idx, 1) }" class="hover:text-[#C97A7A]">×</button>
                  </span>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">资源依赖</label>
                <div class="flex items-center gap-2 mb-2">
                  <input v-model="editNewResource" type="text" placeholder="例如：Skill/summarizer" class="flex-1 px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  <button @click="() => { if (editNewResource.trim() && !editData.resources.some(r => (typeof r === 'object' ? r.name : r) === editNewResource.trim())) { editData.resources.push({ name: editNewResource.trim(), type: '', source: '', path: '', purpose: '' }); editNewResource = '' } }" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">添加</button>
                </div>
                <div class="space-y-1.5">
                  <div v-for="(res, idx) in editData.resources" :key="idx" class="flex items-start gap-2 p-2 bg-[#F6F7FA] rounded-md text-[13px]">
                    <span class="text-[11px] px-1.5 py-0.5 rounded bg-[#F5F0FA] text-[#A67EC5] flex-shrink-0">{{ typeof res === 'object' ? (res.type || 'Res') : 'Res' }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-[#2D2D35]">{{ typeof res === 'object' ? res.name : res }}</div>
                      <div v-if="typeof res === 'object' && (res.source || res.purpose)" class="text-[11px] text-[#9CA3AF] mt-0.5">
                        <span v-if="res.source">{{ res.source }}</span>
                        <span v-if="res.source && res.purpose"> · </span>
                        <span v-if="res.purpose">{{ res.purpose }}</span>
                      </div>
                    </div>
                    <button @click="() => editData.resources.splice(idx, 1)" class="text-[#C97A7A] hover:text-[#B86565]">×</button>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">执行工作流</label>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="col-span-2">
                    <input v-model="editNewStepName" type="text" placeholder="例如：采集数据源" class="w-full px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  </div>
                  <div class="col-span-2">
                    <textarea v-model="editNewStepDesc" rows="1" placeholder="Action / Input / Output" class="w-full px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  </div>
                </div>
                <button @click="() => { if (editNewStepName.trim()) { editData.workflow.push({ index: editData.workflow.length + 1, name: editNewStepName.trim(), description: editNewStepDesc.trim() }); editNewStepName = ''; editNewStepDesc = '' } }" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0] mb-2">添加步骤</button>
                <div class="space-y-1.5">
                  <div v-for="(step, idx) in editData.workflow" :key="idx" class="flex items-start gap-2 p-2 bg-[#F6F7FA] rounded-md text-[13px]">
                    <span class="text-[11px] bg-[#5B6AD7] text-white px-2 py-0.5 rounded flex-shrink-0">{{ step.index }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-[#2D2D35]">{{ step.name }}</div>
                      <div class="text-[11px] text-[#9CA3AF] mt-0.5">{{ step.description }}</div>
                    </div>
                    <button @click="() => { editData.workflow.splice(idx, 1); editData.workflow.forEach((s, i) => s.index = i + 1) }" class="text-[#C97A7A] hover:text-[#B86565]">×</button>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-[#2D2D35] mb-1">执行约定</label>
                <div class="space-y-2">
                  <div>
                    <label class="text-[11px] text-[#9CA3AF] mb-1 block">输入约定</label>
                    <textarea v-model="editData.conventions.input" rows="2" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  </div>
                  <div>
                    <label class="text-[11px] text-[#9CA3AF] mb-1 block">输出约定</label>
                    <textarea v-model="editData.conventions.output" rows="2" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  </div>
                  <div>
                    <label class="text-[11px] text-[#9CA3AF] mb-1 block">错误处理</label>
                    <textarea v-model="editData.conventions.errorHandling" rows="2" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div
        v-if="!store.selectedExcard"
        class="w-[420px] flex-shrink-0 bg-white rounded-md border border-[#E8E8EC] flex flex-col items-center justify-center text-[#9CA3AF]"
      >
        <svg class="w-10 h-10 text-[#C5C9D3] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div class="text-[13px] font-medium">点击 ExCard 查看详情</div>
        <div class="text-[12px] mt-1">支持表单编辑和 Markdown 编辑</div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-md w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in border border-[#E8E8EC]">
          <div class="px-5 py-3 border-b border-[#ECECF0] flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="text-[15px] font-semibold text-[#2D2D35]">新建 ExCard</h3>
              <p class="text-[12px] text-[#9CA3AF] mt-0.5">创建标准化执行模板</p>
            </div>
            <button @click="showCreateModal = false" class="text-[#9CA3AF] hover:text-[#2D2D35] transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l18 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            <div class="space-y-3">
              <h4 class="text-[13px] font-semibold text-[#2D2D35] border-b border-[#ECECF0] pb-1">基本信息</h4>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">名称 <span class="text-[#C97A7A]">*</span></label>
                <input v-model="newExcard.name" type="text" placeholder="例如：EC-001-daily-report" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">描述</label>
                <textarea v-model="newExcard.description" rows="2" placeholder="一句话描述这个 ExCard 的用途和使用场景..." class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">分类</label>
                  <select v-model="newExcard.category" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white">
                    <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">绑定 Agent</label>
                  <select v-model="newExcard.agent" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white">
                    <option value="">-- 选择 Agent --</option>
                    <option v-for="ag in availableAgents" :key="ag.id" :value="ag.name">
                      {{ ag.adapter ? `[${ag.adapter}] ` : '' }}{{ ag.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">标签</label>
                <div class="flex items-center gap-2">
                  <input v-model="newTag" type="text" placeholder="添加标签..." class="flex-1 px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                  <button @click="addTag" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">添加</button>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  <span
                    v-for="tag in newExcard.tags"
                    :key="tag"
                    class="px-2 py-0.5 rounded text-[11px] bg-[#F0F1FE] text-[#5B6AD7] flex items-center gap-1"
                  >
                    {{ tag }}
                    <button @click="removeTag(tag)" class="hover:text-[#C97A7A]">×</button>
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-[13px] font-semibold text-[#2D2D35] border-b border-[#ECECF0] pb-1">资源依赖</h4>
              <div class="flex items-center gap-2">
                <input v-model="newResource" type="text" placeholder="例如：Skill/summarizer" class="flex-1 px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                <button @click="addResource" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">添加</button>
              </div>
              <div class="space-y-1.5">
                <div v-for="(res, idx) in newExcard.resources" :key="idx" class="flex items-start gap-2 p-2 bg-[#F6F7FA] rounded-md text-[13px]">
                  <span class="text-[11px] px-1.5 py-0.5 rounded bg-[#F5F0FA] text-[#A67EC5] flex-shrink-0">{{ typeof res === 'object' ? (res.type || 'Res') : 'Res' }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-[#2D2D35]">{{ typeof res === 'object' ? res.name : res }}</div>
                    <div v-if="typeof res === 'object' && (res.source || res.purpose)" class="text-[11px] text-[#9CA3AF] mt-0.5">
                      <span v-if="res.source">{{ res.source }}</span>
                      <span v-if="res.source && res.purpose"> · </span>
                      <span v-if="res.purpose">{{ res.purpose }}</span>
                    </div>
                  </div>
                  <button @click="removeResource(idx)" class="text-[#C97A7A] hover:text-[#B86565]">×</button>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-[13px] font-semibold text-[#2D2D35] border-b border-[#ECECF0] pb-1">执行工作流</h4>
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">步骤名称</label>
                  <input v-model="newStepName" type="text" placeholder="例如：采集数据源" class="w-full px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                </div>
                <div class="col-span-2">
                  <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">步骤描述</label>
                  <textarea v-model="newStepDesc" rows="2" placeholder="具体执行动作和验证标准..." class="w-full px-3 py-1.5 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
                </div>
              </div>
              <button @click="addStep" class="px-3 py-1.5 text-[11px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">添加步骤</button>
              <div class="space-y-1.5">
                <div v-for="(step, idx) in newExcard.workflow" :key="idx" class="flex items-start gap-2 p-2 bg-[#F6F7FA] rounded-md">
                  <span class="text-[11px] bg-[#5B6AD7] text-white px-2 py-0.5 rounded flex-shrink-0">{{ step.index }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-medium text-[#2D2D35]">{{ step.name }}</div>
                    <div class="text-[11px] text-[#9CA3AF] mt-0.5">{{ step.description }}</div>
                  </div>
                  <button @click="removeStep(idx)" class="text-[#C97A7A] hover:text-[#B86565]">×</button>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-[13px] font-semibold text-[#2D2D35] border-b border-[#ECECF0] pb-1">执行约定</h4>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">输入约定</label>
                <textarea v-model="newExcard.conventions.input" rows="2" placeholder="数据来源路径、格式要求、前置条件..." class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">输出约定</label>
                <textarea v-model="newExcard.conventions.output" rows="2" placeholder="保存位置、输出格式、状态记录..." class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">错误处理</label>
                <textarea v-model="newExcard.conventions.errorHandling" rows="2" placeholder="错误场景及处理方式（表格格式）..." class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all" />
              </div>
            </div>
          </div>

          <div class="px-5 py-3 border-t border-[#ECECF0] flex justify-end gap-3 flex-shrink-0">
            <button @click="showCreateModal = false" class="px-4 py-2 text-[13px] text-[#6B6B78] hover:text-[#2D2D35] transition-colors">取消</button>
            <button @click="createExcard" :disabled="!newExcard.name" class="px-4 py-2 bg-[#5B6AD7] text-white rounded-md text-[13px] font-medium hover:bg-[#4A58C0] disabled:opacity-40 disabled:cursor-not-allowed">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
