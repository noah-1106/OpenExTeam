<script setup>
import { ref, computed, onMounted } from 'vue'
import { useExcardStore } from '../stores/excards'
import { useSettingsStore } from '../stores/settings'
import ExcardMdEditor from '../components/ExcardMdEditor.vue'
import api from '../api/client'

const store = useExcardStore()
const settingsStore = useSettingsStore()
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
    // 如果没有获取到具体 Agent，降级到适配器列表
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

// 编辑模式的临时变量
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
  if (!newExcard.value.resources.includes(newResource.value.trim())) {
    newExcard.value.resources.push(newResource.value.trim())
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
  if (!newExcard.value.name.trim()) {
    alert('请填写 ExCard 名称')
    return
  }
  if (!newExcard.value.agent) {
    alert('请为 ExCard 绑定一个 Agent')
    return
  }
  const num = String(store.excards.length + 1).padStart(3, '0')
  const id = `EC-${num}`
  await store.createExcard({ id, ...JSON.parse(JSON.stringify(newExcard.value)) })
  showCreateModal.value = false
}

async function startEditExcard() {
  // 从 Markdown 重新解析数据，确保内容一致
  try {
    const mdData = await api.getExcardMd(store.selectedExcard.id)
    if (mdData) {
      // 先使用 store 中的数据
      editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
      // 然后尝试从 Markdown 解析最新数据
      if (mdData.markdown) {
        const parsed = parseExcardMd(mdData.markdown)
        // 合并解析的数据
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
      // 如果获取 Markdown 失败，直接使用 store 中的数据
      editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
    }
  } catch (err) {
    console.error('[ExcardView] 解析 Markdown 失败:', err)
    editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
  }
  // 确保字段存在
  if (!editData.value.conventions) editData.value.conventions = { input: '', output: '', errorHandling: '' }
  if (!editData.value.tags) editData.value.tags = []
  if (!editData.value.resources) editData.value.resources = []
  if (!editData.value.workflow) editData.value.workflow = []
  if (!editData.value.agent) editData.value.agent = ''
  // 重置编辑临时变量
  editNewStepName.value = ''
  editNewStepDesc.value = ''
  editNewResource.value = ''
  editNewTag.value = ''
  isEditing.value = true
  useMdEditor.value = false
}

// 简单的 ExCard Markdown 解析器（和后端保持一致）
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
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const rawLine = lines[i]

    // 解析 Frontmatter (--- 开头)
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

    // 解析 H1 标题作为名称
    if (line.startsWith('# ')) {
      if (!excard.name) excard.name = line.slice(2).trim()
      continue
    }

    // 解析 H2 标题（支持中英文）
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

    // description (H1 后面的文本，或者## 卡片目的/任务描述下面的内容)
    if ((!currentSection || currentSection === 'description') && line && !line.startsWith('#')) {
      if (excard.description) excard.description += '\n' + line
      else excard.description = line
      continue
    }

    // 解析各 section 内容
    if (currentSection === 'resource dependencies') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const resourceText = line.slice(2).trim()
        excard.resources.push(resourceText)
      }
    }

    if (currentSection === 'execution workflow') {
      if (line.match(/^\d+\.\s/)) {
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
        // 继续追加步骤描述
        if (!line.toLowerCase().startsWith('agent:')) {
          if (currentStep.description) currentStep.description += '\n' + rawLine.trim()
          else currentStep.description = rawLine.trim()
        }
      }
    }

    if (currentSection === 'execution conventions') {
      if (line.toLowerCase().startsWith('### input') || line.toLowerCase().startsWith('## input') ||
          line.toLowerCase().includes('### 输入') || line.toLowerCase().includes('## 输入')) {
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
                 line.toLowerCase().includes('### 输出') || line.toLowerCase().includes('## 输出')) {
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
      // 如果有单独的"输出要求"部分，把内容放到 output 约定中
      if (!line.startsWith('#')) {
        if (excard.conventions.output) excard.conventions.output += '\n' + line
        else excard.conventions.output = line
      }
    }
  }

  if (currentStep) excard.workflow.push(currentStep)

  return excard
}

async function saveEditExcard() {
  if (!useMdEditor.value && !editData.value.agent) {
    alert('请为 ExCard 绑定一个 Agent')
    return
  }
  if (useMdEditor.value) {
    await store.updateExcardMd(store.selectedExcard.id, store.selectedExcardMd)
  } else {
    await store.updateExcard(store.selectedExcard.id, editData.value)
  }
  isEditing.value = false
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
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-primary">ExCard 模板库</h2>
        <p class="text-sm text-secondary mt-0.5">标准化 Agent 执行卡片模板</p>
      </div>
      <button
        @click="openCreateModal"
        class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all duration-150 flex items-center gap-2"
      >
        <span class="text-lg">+</span> 新建 ExCard
      </button>
    </div>

    <div class="flex-1 flex gap-4 overflow-hidden">
      <div class="flex-1 overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="ec in store.excards"
            :key="ec.id"
            @click="toggleSelect(ec)"
            :class="[
              'bg-surface rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm',
              selectedExcard?.id === ec.id ? 'border-accent ring-2 ring-accent/20' : 'border-border'
            ]"
          >
            <div class="p-5">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-muted font-mono mb-1">{{ ec.id }}</div>
                  <h3 class="font-semibold text-primary">{{ ec.name }}</h3>
                </div>
              </div>
              <p class="text-sm text-secondary mb-3 line-clamp-2">{{ ec.description || '暂无描述' }}</p>
              <div class="flex flex-wrap gap-1.5 mb-3">
                <span class="text-xs px-2 py-0.5 rounded bg-surface-raised text-secondary">{{ getCategoryLabel(ec.category) }}</span>
                <span
                  v-for="tag in (ec.tags || []).slice(0, 2)"
                  :key="tag"
                  class="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent"
                >
                  {{ tag }}
                </span>
                <span v-if="(ec.tags || []).length > 2" class="text-xs text-muted">+{{ ec.tags.length - 2 }}</span>
              </div>
              <div class="flex items-center gap-4 text-xs text-muted">
                <span v-if="ec.agent">🤖 {{ ec.agent }}</span>
                <span>📦 {{ (ec.resources || []).length }}</span>
                <span>🔄 {{ (ec.workflow || []).length }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.selectedExcard" class="w-[450px] flex flex-col bg-surface rounded-xl border border-border flex-shrink-0 overflow-hidden">
        <div class="flex justify-between items-center p-4 border-b border-border">
          <div class="flex items-center gap-2">
            <button
              @click="useMdEditor = false"
              :class="[
                'px-2 py-1 text-xs rounded transition-all',
                !useMdEditor ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              ]"
            >
              表单编辑
            </button>
            <button
              @click="useMdEditor = true"
              :class="[
                'px-2 py-1 text-xs rounded transition-all',
                useMdEditor ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              ]"
            >
              Markdown
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button @click="cancelEditExcard" class="px-3 py-1.5 text-xs text-secondary hover:text-primary">取消</button>
            <button @click="saveEditExcard" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">保存</button>
            <button @click="deleteExcard" class="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">删除</button>
          </div>
        </div>

        <div v-if="isEditing && useMdEditor" class="flex-1 p-4 overflow-hidden">
          <ExcardMdEditor v-model="store.selectedExcardMd" :readonly="false" />
        </div>

        <template v-else>
          <div class="flex-1 overflow-y-auto p-4">
            <div class="text-xs text-muted font-mono mb-3">{{ selectedExcard.id }}</div>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-primary mb-1">名称</label>
                <input v-model="editData.name" type="text" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">描述</label>
                <textarea v-model="editData.description" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-primary mb-1">分类</label>
                  <select v-model="editData.category" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                    <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-primary mb-1">绑定 Agent</label>
                  <select v-model="editData.agent" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                    <option value="">-- 选择 Agent --</option>
                    <option v-for="ag in availableAgents" :key="ag.id" :value="ag.name">
                      {{ ag.adapter ? `[${ag.adapter}] ` : '' }}{{ ag.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">标签</label>
                <div class="flex items-center gap-2 mb-2">
                  <input v-model="editNewTag" type="text" placeholder="添加标签..." class="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                  <button @click="() => { if (editNewTag.trim() && !editData.tags.includes(editNewTag.trim())) { editData.tags.push(editNewTag.trim()); editNewTag = '' } }" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">添加</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in editData.tags"
                    :key="tag"
                    class="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent flex items-center gap-1"
                  >
                    {{ tag }}
                    <button @click="() => { const idx = editData.tags.indexOf(tag); if (idx >=0) editData.tags.splice(idx, 1) }" class="hover:text-red-500">×</button>
                  </span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">资源依赖</label>
                <div class="flex items-center gap-2 mb-2">
                  <input v-model="editNewResource" type="text" placeholder="例如：Skill/summarizer" class="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                  <button @click="() => { if (editNewResource.trim() && !editData.resources.includes(editNewResource.trim())) { editData.resources.push(editNewResource.trim()); editNewResource = '' } }" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">添加</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(res, idx) in editData.resources"
                    :key="idx"
                    class="px-2 py-0.5 rounded text-xs bg-surface-raised text-secondary flex items-center gap-1"
                  >
                    📦 {{ res }}
                    <button @click="() => editData.resources.splice(idx, 1)" class="hover:text-red-500">×</button>
                  </span>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">执行工作流</label>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="col-span-2">
                    <input v-model="editNewStepName" type="text" placeholder="例如：采集数据源" class="w-full px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                  </div>
                  <div class="col-span-2">
                    <textarea v-model="editNewStepDesc" rows="1" placeholder="Action / Input / Output" class="w-full px-3 py-1.5 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
                  </div>
                </div>
                <button @click="() => { if (editNewStepName.trim()) { editData.workflow.push({ index: editData.workflow.length + 1, name: editNewStepName.trim(), description: editNewStepDesc.trim() }); editNewStepName = ''; editNewStepDesc = '' } }" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover mb-2">添加步骤</button>
                <div class="space-y-1.5">
                  <div v-for="(step, idx) in editData.workflow" :key="idx" class="flex items-start gap-2 p-2 bg-surface-raised rounded-lg text-sm">
                    <span class="text-xs bg-accent text-white px-2 py-0.5 rounded flex-shrink-0">{{ step.index }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-primary">{{ step.name }}</div>
                      <div class="text-xs text-muted mt-0.5">{{ step.description }}</div>
                    </div>
                    <button @click="() => { editData.workflow.splice(idx, 1); editData.workflow.forEach((s, i) => s.index = i + 1) }" class="text-red-500 hover:text-red-600">×</button>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">执行约定</label>
                <div class="space-y-2">
                  <div>
                    <label class="text-xs text-muted mb-1 block">输入约定</label>
                    <textarea v-model="editData.conventions.input" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label class="text-xs text-muted mb-1 block">输出约定</label>
                    <textarea v-model="editData.conventions.output" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label class="text-xs text-muted mb-1 block">错误处理</label>
                    <textarea v-model="editData.conventions.errorHandling" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div
        v-if="!store.selectedExcard"
        class="w-[450px] flex-shrink-0 bg-surface rounded-xl border border-border flex flex-col items-center justify-center text-muted"
      >
        <div class="text-4xl mb-3">📋</div>
        <div class="text-base font-medium">点击 ExCard 查看详情</div>
        <div class="text-sm mt-1">支持表单编辑和 Markdown 编辑</div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-surface rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
          <div class="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="text-lg font-semibold text-primary">新建 ExCard</h3>
              <p class="text-sm text-muted mt-0.5">创建标准化执行模板</p>
            </div>
            <button @click="showCreateModal = false" class="text-muted hover:text-primary">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l18 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-primary border-b border-border pb-1">基本信息</h4>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">名称 <span class="text-red-500">*</span></label>
                <input v-model="newExcard.name" type="text" placeholder="例如：EC-001-daily-report" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">描述</label>
                <textarea v-model="newExcard.description" rows="2" placeholder="一句话描述这个 ExCard 的用途和使用场景..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-primary mb-1">分类</label>
                  <select v-model="newExcard.category" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                    <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-primary mb-1">绑定 Agent</label>
                  <select v-model="newExcard.agent" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                    <option value="">-- 选择 Agent --</option>
                    <option v-for="ag in availableAgents" :key="ag.id" :value="ag.name">
                      {{ ag.adapter ? `[${ag.adapter}] ` : '' }}{{ ag.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">标签</label>
                <div class="flex items-center gap-2">
                  <input v-model="newTag" type="text" placeholder="添加标签..." class="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                  <button @click="addTag" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">添加</button>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  <span
                    v-for="tag in newExcard.tags"
                    :key="tag"
                    class="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent flex items-center gap-1"
                  >
                    {{ tag }}
                    <button @click="removeTag(tag)" class="hover:text-red-500">×</button>
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-primary border-b border-border pb-1">资源依赖</h4>
              <div class="flex items-center gap-2">
                <input v-model="newResource" type="text" placeholder="例如：Skill/summarizer" class="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                <button @click="addResource" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">添加</button>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(res, idx) in newExcard.resources"
                  :key="idx"
                  class="px-2 py-0.5 rounded text-xs bg-surface-raised text-secondary flex items-center gap-1"
                >
                  📦 {{ res }}
                  <button @click="removeResource(idx)" class="hover:text-red-500">×</button>
                </span>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-primary border-b border-border pb-1">执行工作流</h4>
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-primary mb-1">步骤名称</label>
                  <input v-model="newStepName" type="text" placeholder="例如：采集数据源" class="w-full px-3 py-1.5 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-primary mb-1">步骤描述</label>
                  <textarea v-model="newStepDesc" rows="2" placeholder="具体执行动作和验证标准..." class="w-full px-3 py-1.5 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
                </div>
              </div>
              <button @click="addStep" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">添加步骤</button>
              <div class="space-y-1.5">
                <div v-for="(step, idx) in newExcard.workflow" :key="idx" class="flex items-start gap-2 p-2 bg-surface-raised rounded-lg">
                  <span class="text-xs bg-accent text-white px-2 py-0.5 rounded flex-shrink-0">{{ step.index }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-primary">{{ step.name }}</div>
                    <div class="text-xs text-muted mt-0.5">{{ step.description }}</div>
                  </div>
                  <button @click="removeStep(idx)" class="text-red-500 hover:text-red-600">×</button>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-primary border-b border-border pb-1">执行约定</h4>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">输入约定</label>
                <textarea v-model="newExcard.conventions.input" rows="2" placeholder="数据来源路径、格式要求、前置条件..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">输出约定</label>
                <textarea v-model="newExcard.conventions.output" rows="2" placeholder="保存位置、输出格式、状态记录..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-sm font-medium text-primary mb-1">错误处理</label>
                <textarea v-model="newExcard.conventions.errorHandling" rows="2" placeholder="错误场景及处理方式（表格格式）..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
            <button @click="showCreateModal = false" class="px-4 py-2 text-sm text-secondary hover:text-primary">取消</button>
            <button @click="createExcard" :disabled="!newExcard.name" class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
