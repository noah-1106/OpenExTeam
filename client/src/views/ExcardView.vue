<script setup>
import { ref, computed, onMounted } from 'vue'
import { useExcardStore } from '../stores/excards'
import ExcardMdEditor from '../components/ExcardMdEditor.vue'

const store = useExcardStore()
const showCreateModal = ref(false)
const isEditing = ref(false)
const editData = ref({})
const useMdEditor = ref(false)

onMounted(() => {
  store.fetchExcards()
})

const selectedExcard = computed(() => store.selectedExcard)

const newExcard = ref({
  name: '',
  description: '',
  category: '写作',
  tags: [],
  agentName: '',
  resources: [],
  workflow: [],
  conventions: { input: '', output: '', errors: [] },
  redlines: [],
})

const newStepName = ref('')
const newStepDesc = ref('')
const newResource = ref({ type: 'Skill', name: '', source: '', path: '', purpose: '' })
const newError = ref({ scenario: '', handling: '' })
const newTag = ref('')
const newRedline = ref('')

const categories = ['写作', '数据', '图像', '工程', '运营', '研究']
const resourceTypes = ['Skill', 'File', 'Directory', 'API', 'Model']
const agentOptions = [
  { id: 'agent-1', name: '品品' },
  { id: 'agent-2', name: '开开' },
  { id: 'agent-3', name: '前前' },
  { id: 'agent-4', name: '维维' },
  { id: 'agent-5', name: '测测' },
]

async function toggleSelect(ec) {
  if (store.selectedExcard?.id === ec?.id) {
    store.selectedExcard = null
  } else {
    await store.selectExcard(ec)
  }
}

function openCreateModal() {
  resetForm()
  showCreateModal.value = true
}

function resetForm() {
  newExcard.value = {
    name: '', description: '', category: '写作', tags: [],
    agentName: '', resources: [], workflow: [],
    conventions: { input: '', output: '', errors: [] }, redlines: [],
  }
  newStepName.value = ''
  newStepDesc.value = ''
  newResource.value = { type: 'Skill', name: '', source: '', path: '', purpose: '' }
  newError.value = { scenario: '', handling: '' }
  newTag.value = ''
  newRedline.value = ''
}

function addResource() {
  if (!newResource.value.name.trim()) return
  newExcard.value.resources.push({ ...newResource.value })
  newResource.value = { type: 'Skill', name: '', source: '', path: '', purpose: '' }
}
function removeResource(idx) { newExcard.value.resources.splice(idx, 1) }

function addStep() {
  if (!newStepName.value.trim()) return
  newExcard.value.workflow.push({
    step: newExcard.value.workflow.length + 1,
    name: newStepName.value.trim(),
    desc: newStepDesc.value.trim(),
  })
  newStepName.value = ''
  newStepDesc.value = ''
}
function removeStep(idx) {
  newExcard.value.workflow.splice(idx, 1)
  newExcard.value.workflow.forEach((s, i) => { s.step = i + 1 })
}

function addError() {
  if (!newError.value.scenario.trim()) return
  newExcard.value.conventions.errors.push({ ...newError.value })
  newError.value = { scenario: '', handling: '' }
}
function removeError(idx) { newExcard.value.conventions.errors.splice(idx, 1) }

function addTag() {
  const t = newTag.value.trim()
  if (t && !newExcard.value.tags.includes(t)) newExcard.value.tags.push(t)
  newTag.value = ''
}
function removeTag(tag) { newExcard.value.tags.splice(newExcard.value.tags.indexOf(tag), 1) }

function addRedline() {
  const r = newRedline.value.trim()
  if (r) newExcard.value.redlines.push(r)
  newRedline.value = ''
}
function removeRedline(idx) { newExcard.value.redlines.splice(idx, 1) }

async function createExcard() {
  if (!newExcard.value.name.trim() || !newExcard.value.agentName || !newExcard.value.description.trim()) {
    alert('请填写完整信息：名称、绑定 Agent、描述为必填项')
    return
  }
  const num = String(store.excards.length + 1).padStart(3, '0')
  const agentSlug = newExcard.value.agentName.toLowerCase()
  const nameSlug = newExcard.value.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20)
  const id = `EC${num}-${agentSlug}-${nameSlug}`
  await store.createExcard({ id, ...JSON.parse(JSON.stringify(newExcard.value)) })
  showCreateModal.value = false
}

function startEditExcard() {
  editData.value = JSON.parse(JSON.stringify(store.selectedExcard))
  isEditing.value = true
  useMdEditor.value = false
}

async function saveEditExcard() {
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

function getTagColor(tag) {
  const map = {
    '内容创作': 'bg-violet-50 text-violet-600', '写作': 'bg-pink-50 text-pink-600',
    '润色': 'bg-rose-50 text-rose-500', '设计': 'bg-blue-50 text-blue-600',
    '运营': 'bg-green-50 text-green-600', '研究': 'bg-yellow-50 text-yellow-600',
    '工程': 'bg-stone-100 text-stone-600', '调试': 'bg-red-50 text-red-600',
    '数据': 'bg-cyan-50 text-cyan-600', '采集': 'bg-indigo-50 text-indigo-600',
    '图像': 'bg-purple-50 text-purple-600',
  }
  return map[tag] || 'bg-stone-100 text-stone-600'
}

function getResourceIcon(type) {
  return { Skill: '⚡', File: '📄', Directory: '📁', API: '🔗', Model: '🧠' }[type] || '📦'
}

function getStepColor(idx) {
  return ['bg-blue-500','bg-violet-500','bg-purple-500','bg-pink-500','bg-rose-500',
          'bg-orange-500','bg-amber-500','bg-green-500','bg-emerald-500','bg-teal-500'][idx % 10]
}
</script>
<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-primary">ExCard 模板库</h2>
        <p class="text-sm text-secondary mt-0.5">标准化 Agent 执行卡片，绑定特定 Agent，开箱即用</p>
      </div>
      <button
        @click="openCreateModal"
        class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-all duration-150 flex items-center gap-2 shadow-xs"
      >
        <span class="text-lg">+</span> 新建卡片
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
              selectedExcard?.id === ec.id ? 'border-accent ring-2 ring-accent/20' : 'border-border-subtle'
            ]"
          >
            <div class="p-5">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-muted font-mono mb-1 truncate">{{ ec.id }}</div>
                  <h3 class="font-semibold text-primary">{{ ec.name }}</h3>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted bg-surface-raised px-2 py-1 rounded-md flex-shrink-0 ml-2">
                  <span>{{ ec.taskCount || 0 }}</span><span>个任务</span>
                </div>
              </div>
              <div class="flex items-center gap-2 mb-3">
                <div class="w-6 h-6 rounded-full bg-accent-dim flex items-center justify-center text-xs text-accent font-medium">
                  {{ ec.agentName?.[0] || 'A' }}
                </div>
                <span class="text-xs text-secondary">{{ ec.agentName }}</span>
              </div>
              <p class="text-sm text-secondary mb-3 line-clamp-2">{{ ec.description }}</p>
              <div class="flex flex-wrap gap-1.5 mb-3">
                <span class="text-xs px-2 py-0.5 rounded bg-surface-raised text-secondary">{{ ec.category }}</span>
                <span
                  v-for="tag in ec.tags"
                  :key="tag"
                  :class="['px-2 py-0.5 rounded text-xs font-medium', getTagColor(tag)]"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="border-t border-border-subtle pt-3 flex items-center gap-4">
                <div class="flex items-center gap-1 text-xs text-muted">
                  <span>📦</span><span>{{ (ec.resources || []).length }}</span>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted">
                  <span>🔁</span><span>{{ (ec.workflow || []).length }}</span>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted">
                  <span>🔴</span><span>{{ (ec.redlines || []).length }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.selectedExcard" class="w-[420px] flex flex-col bg-surface rounded-xl border border-border-subtle flex-shrink-0 overflow-hidden">
        <div class="flex justify-between items-center p-4 border-b border-border-subtle">
          <div class="flex items-center gap-2">
            <template v-if="isEditing">
              <button
                @click="useMdEditor = false"
                :class="[
                  'px-2 py-1 text-xs rounded transition-all',
                  !useMdEditor ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
                ]"
              >
                📝 表单
              </button>
              <button
                @click="useMdEditor = true"
                :class="[
                  'px-2 py-1 text-xs rounded transition-all',
                  useMdEditor ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
                ]"
              >
                📄 Markdown
              </button>
            </template>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="isEditing">
              <button @click="cancelEditExcard" class="px-3 py-1.5 text-xs text-secondary hover:text-primary">取消</button>
              <button @click="saveEditExcard" class="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-hover">保存</button>
            </template>
            <template v-else>
              <button @click="startEditExcard" class="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-raised text-secondary">编辑</button>
              <button @click="deleteExcard" class="px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50">删除</button>
            </template>
          </div>
        </div>

        <div v-if="isEditing && useMdEditor" class="flex-1 p-4 overflow-hidden">
          <ExcardMdEditor v-model="store.selectedExcardMd" :readonly="false" />
        </div>

        <template v-else-if="isEditing && !useMdEditor">
          <div class="flex-1 overflow-y-auto p-4">
            <div class="text-xs text-muted font-mono mb-1">{{ selectedExcard.id }}</div>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-primary mb-1">名称</label>
                <input v-model="editData.name" type="text" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">描述</label>
                <textarea v-model="editData.description" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">分类</label>
                <select v-model="editData.category" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex-1 overflow-y-auto p-4">
            <div class="mb-4">
              <div class="text-xs text-muted font-mono mb-1">{{ selectedExcard.id }}</div>
              <h3 class="text-lg font-semibold text-primary">{{ selectedExcard.name }}</h3>
              <div class="flex items-center gap-2 mt-2" v-if="selectedExcard.agentName">
                <div class="w-6 h-6 rounded-full bg-accent-dim flex items-center justify-center text-xs text-accent font-medium">
                  {{ selectedExcard.agentName[0] }}
                </div>
                <span class="text-sm text-secondary">创建者：{{ selectedExcard.agentName }}</span>
              </div>
              <p class="text-sm text-secondary mt-2">{{ selectedExcard.description }}</p>
            </div>

            <div class="mb-5">
              <h4 class="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                <span>📦</span> 资源依赖
              </h4>
              <div class="space-y-1.5">
                <div
                  v-for="(res, idx) in (selectedExcard.resources || [])"
                  :key="idx"
                  class="flex items-start gap-2 text-xs p-2 bg-surface-raised rounded-lg"
                >
                  <span class="text-base flex-shrink-0">{{ getResourceIcon(res.type) }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-primary">{{ res.name }}</div>
                    <div class="text-muted truncate text-xs">{{ res.path }}</div>
                    <div class="text-muted text-xs">{{ res.purpose }}</div>
                  </div>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-surface text-muted flex-shrink-0">{{ res.type }}</span>
                </div>
              </div>
            </div>

            <div class="mb-5">
              <h4 class="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                <span>🔁</span> 执行工作流
              </h4>
              <div class="relative">
                <div class="absolute left-3.5 top-0 bottom-0 w-px bg-border-subtle" />
                <div class="space-y-2">
                  <div
                    v-for="(step, idx) in (selectedExcard.workflow || [])"
                    :key="idx"
                    class="flex items-start gap-3 relative"
                  >
                    <div
                      :class="['w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 z-10', getStepColor(idx)]"
                    >
                      {{ step.step }}
                    </div>
                    <div class="flex-1 pt-0.5">
                      <div class="text-sm font-medium text-primary">{{ step.name }}</div>
                      <div class="text-xs text-muted mt-0.5">{{ step.desc }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mb-5">
              <h4 class="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
                <span>📋</span> 执行约定
              </h4>
              <div class="space-y-2">
                <div class="text-xs">
                  <div class="text-muted mb-1">输入约定</div>
                  <div class="text-primary bg-surface-raised p-2 rounded-lg text-xs">{{ selectedExcard.conventions?.input || '—' }}</div>
                </div>
                <div class="text-xs">
                  <div class="text-muted mb-1">输出约定</div>
                  <div class="text-primary bg-surface-raised p-2 rounded-lg text-xs">{{ selectedExcard.conventions?.output || '—' }}</div>
                </div>
              </div>
            </div>

            <div class="text-xs text-muted border-t border-border-subtle pt-3 flex items-center justify-between">
              <span>{{ selectedExcard.version || 'v1.0' }}</span>
              <span>更新于 {{ selectedExcard.updatedAt || new Date().toLocaleDateString() }}</span>
            </div>
          </div>
        </template>
      </div>

      <div
        v-if="!store.selectedExcard"
        class="w-[420px] flex-shrink-0 bg-surface rounded-xl border border-border-subtle flex flex-col items-center justify-center text-muted"
      >
        <div class="text-4xl mb-3">📋</div>
        <div class="text-base font-medium">点击卡片查看详情</div>
        <div class="text-sm mt-1">展示资源依赖、工作流、约定和质量红线</div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        @click.self="showCreateModal = false"
      >
        <div class="bg-surface rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-fade-in">
          <div class="px-6 py-4 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="text-lg font-semibold text-primary">新建 ExCard</h3>
              <p class="text-xs text-muted mt-0.5">命名格式：EC{编号}-{AgentID}-{描述}，按创建顺序自动编号</p>
            </div>
            <button @click="showCreateModal = false" class="text-muted hover:text-primary">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-primary border-b border-border-subtle pb-1">基本信息</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-primary mb-1">卡片名称 <span class="text-red-500">*</span></label>
                  <input v-model="newExcard.name" type="text" placeholder="例如：标准文章创作" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-primary mb-1">绑定 Agent <span class="text-red-500">*</span></label>
                  <select v-model="newExcard.agentName" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                    <option value="">选择 Agent...</option>
                    <option v-for="ag in agentOptions" :key="ag.id" :value="ag.name">{{ ag.name }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1">描述 <span class="text-red-500">*</span></label>
                <textarea v-model="newExcard.description" rows="2" placeholder="描述这个 ExCard 的用途和使用场景..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent" />
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-border-subtle flex justify-end gap-3 flex-shrink-0">
            <button @click="showCreateModal = false" class="px-4 py-2 text-sm text-secondary hover:text-primary">取消</button>
            <button @click="createExcard" :disabled="!newExcard.name || !newExcard.agentName" class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed">创建 ExCard</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
