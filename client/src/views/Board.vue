<script setup>
import { ref } from 'vue'
import TaskCard from '../components/TaskCard.vue'

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
})

const emit = defineEmits(['update-task', 'create-task'])

const showCreateModal = ref(false)
const newTask = ref({ title: '', description: '', agent: '', priority: 'medium', jobId: '' })
const showDetail = ref(false)
const selectedTask = ref(null)

function tasksForJob(jobId) { return props.tasks.filter(t => t.jobId === jobId) }
function tasksByStatus(jobId, status) { return tasksForJob(jobId).filter(t => t.status === status) }
function jobProgress(jobId) {
  const all = tasksForJob(jobId)
  if (!all.length) return 0
  return Math.round((all.filter(t => t.status === 'done').length / all.length) * 100)
}
function jobDoneCount(jobId) { return tasksForJob(jobId).filter(t => t.status === 'done').length }
function jobTotalCount(jobId) { return tasksForJob(jobId).length }

const columns = [
  { id: 'todo', label: 'To Do', color: 'bg-surface-raised' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-accent' },
  { id: 'done', label: 'Done', color: 'bg-green-400' },
]

function openCreateModal() {
  newTask.value = {
    title: '', description: '', agent: props.agents[0]?.name || '',
    priority: 'medium', jobId: props.jobs[0]?.id || '',
  }
  showCreateModal.value = true
}
function createTask() {
  if (!newTask.value.title.trim() || !newTask.value.jobId) return
  emit('create-task', { ...newTask.value, status: 'todo' })
  showCreateModal.value = false
}
function onDragStart(e, task) { e.dataTransfer.setData('taskId', task.id) }
function onDrop(e, status) {
  const tid = e.dataTransfer.getData('taskId')
  if (tid) emit('update-task', tid, status)
}
function onDragOver(e) { e.preventDefault() }
function openTaskDetail(task) { selectedTask.value = task; showDetail.value = true }
function closeDetail() { showDetail.value = false; selectedTask.value = null }
function changeStatus(status) {
  if (selectedTask.value) {
    emit('update-task', selectedTask.value.id, status)
    selectedTask.value = { ...selectedTask.value, status }
  }
}
function startTask() {
  if (!selectedTask.value) return
  emit('update-task', selectedTask.value.id, 'in-progress')
  selectedTask.value = { ...selectedTask.value, status: 'in-progress' }
}
function getTaskStepIndex(task) { return tasksForJob(task.jobId).findIndex(t => t.id === task.id) + 1 }
function getJobTitle(task) { return props.jobs.find(j => j.id === task.jobId)?.title || '' }

const agentAvatars = { '品品': '👩‍💼', '开开': '👨‍💻', '前前': '👨‍🎨', '维维': '👨‍🔧', '测测': '🧪' }
const statusOptions = [
  { value: 'todo', label: '待处理' },
  { value: 'in-progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-primary">任务看板</h2>
        <p class="text-sm text-secondary mt-0.5">{{ jobs.length }} 个工作 · {{ tasks.length }} 个任务</p>
      </div>
    </div>

    <!-- Job Cards -->
    <div class="flex-1 overflow-y-auto space-y-5">
      <div v-for="job in jobs" :key="job.id"
        class="bg-surface rounded-xl border border-border-subtle shadow-xs overflow-hidden hover:shadow-sm transition-shadow duration-200 animate-fade-in">

        <!-- Job Header -->
        <div class="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="font-semibold text-primary">{{ job.title }}</span>
              <span v-if="job.type === 'recurring' && job.schedule"
                class="text-xs px-2 py-0.5 rounded-md bg-accent-dim text-accent font-semibold">
                🔄 每天 {{ job.schedule.time }}
              </span>
              <span v-else class="text-xs px-2 py-0.5 rounded-md bg-surface text-secondary font-medium">
                ⚡ 一次性
              </span>
              <span v-if="job.excard"
                class="text-xs px-2 py-0.5 rounded-md bg-accent-dim text-accent font-medium">
                {{ job.excard }}
              </span>
              <span :class="[
                'text-xs px-2 py-0.5 rounded-md font-medium',
                job.status === 'done' ? 'bg-surface-raised text-orange-600' :
                job.status === 'in-progress' ? 'bg-accent-dim text-accent' :
                'bg-surface text-secondary'
              ]">
                {{ job.status === 'done' ? '已完成' : job.status === 'in-progress' ? '进行中' : '未开始' }}
              </span>
            </div>
            <p class="text-xs text-muted truncate">{{ job.description }}</p>
          </div>

          <div class="flex items-center gap-4 flex-shrink-0">
            <button v-if="tasksForJob(job.id).length > 0"
              class="px-3 py-1.5 bg-green-400 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 transition-all duration-150 shadow-xs">
              ▶ 启动工作流
            </button>
            <div class="text-right">
              <div class="text-sm font-bold text-primary">{{ jobDoneCount(job.id) }}/{{ jobTotalCount(job.id) }}</div>
              <div class="flex items-center gap-2 mt-1">
                <div class="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-300"
                    :class="job.status === 'done' ? 'bg-green-400' : job.status === 'in-progress' ? 'bg-accent' : 'bg-surface-raised'"
                    :style="{ width: jobProgress(job.id) + '%' }" />
                </div>
                <span class="text-xs text-muted">{{ jobProgress(job.id) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Task Columns -->
        <div class="grid grid-cols-3">
          <div v-for="(col, ci) in columns" :key="col.id"
            :class="ci < 2 ? 'border-r border-border-subtle' : ''"
            class="p-3" @drop="onDrop($event, col.id)" @dragover="onDragOver">
            <!-- Column Header -->
            <div class="flex items-center gap-2 mb-3">
              <span :class="['w-2 h-2 rounded-full flex-shrink-0', col.color]" />
              <span class="text-xs font-semibold text-secondary uppercase tracking-wide">{{ col.label }}</span>
              <span class="ml-auto text-xs text-muted">{{ tasksByStatus(job.id, col.id).length }}</span>
            </div>
            <!-- Tasks -->
            <div class="space-y-2">
              <div v-for="task in tasksByStatus(job.id, col.id)" :key="task.id"
                draggable="true" @dragstart="onDragStart($event, task)">
                <div @click="openTaskDetail(task)"
                  :class="[
                    'rounded-xl border p-3 cursor-pointer transition-all duration-150 hover:shadow-sm',
                    task.status === 'done' ? 'bg-surface-raised/70 border-emerald-100' :
                    task.status === 'in-progress' ? 'bg-accent-dim/70 border-accent' :
                    'bg-surface border-border-subtle hover:border-border'
                  ]">
                  <div class="flex items-start gap-2 mb-1.5">
                    <span :class="['w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', col.color]" />
                    <span v-if="getTaskStepIndex(task) > 0"
                      class="text-xs px-1.5 py-0.5 rounded bg-surface text-secondary font-semibold flex-shrink-0">
                      #{{ getTaskStepIndex(task) }}
                    </span>
                    <span class="text-sm font-medium text-primary leading-snug flex-1">{{ task.title }}</span>
                    <span v-if="task.status === 'in-progress'"
                      class="text-xs px-1.5 py-0.5 rounded bg-accent-dim text-accent font-semibold flex-shrink-0">
                      执行中
                    </span>
                  </div>
                  <p v-if="task.description"
                    class="text-xs text-secondary ml-3.5 line-clamp-2 mb-2 leading-relaxed">
                    {{ task.description }}
                  </p>
                  <div class="flex items-center justify-between ml-3.5">
                    <span class="text-xs text-muted">{{ task.agent }}</span>
                    <span v-if="task.excard"
                      class="text-xs px-1.5 py-0.5 rounded bg-accent-dim text-accent font-medium">
                      {{ task.excard }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-if="tasksByStatus(job.id, col.id).length === 0"
                class="py-6 text-center text-xs text-muted">
                暂无
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="jobs.length === 0"
        class="flex flex-col items-center justify-center py-24 text-muted">
        <div class="text-5xl mb-3">📋</div>
        <div class="text-base font-medium">暂无工作</div>
        <div class="text-sm mt-1">点击「+ 新建任务」开始</div>
      </div>
    </div>

    <!-- ===== Task Detail Slide Panel ===== -->
    <Teleport to="body">
      <div v-if="showDetail" class="fixed inset-0 z-50" @click.self="closeDetail">
        <div class="absolute inset-0 bg-stone-900/20 backdrop-blur-sm" @click="closeDetail" />
        <div class="absolute right-0 top-0 h-full w-full max-w-md bg-surface shadow-md flex flex-col animate-slide-in-right border-l border-border-subtle">
          <!-- Header -->
          <div class="px-5 py-4 border-b border-border-subtle flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-primary text-base leading-snug">{{ selectedTask?.title }}</h2>
              <p class="text-xs text-muted mt-1">{{ getJobTitle(selectedTask) }}</p>
            </div>
            <button @click="closeDetail"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface hover:text-primary transition-colors flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <!-- Content -->
          <div v-if="selectedTask" class="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">操作</div>
              <button v-if="selectedTask.status === 'todo'" @click="startTask"
                class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-all duration-150 shadow-xs">
                ▶ 启动任务
              </button>
            </div>
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">状态</div>
              <div class="flex gap-2">
                <button v-for="opt in statusOptions" :key="opt.value" @click="changeStatus(opt.value)"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150',
                    selectedTask.status === opt.value
                      ? opt.value === 'done' ? 'bg-surface-raised border-emerald-200 text-orange-600' :
                        opt.value === 'in-progress' ? 'bg-accent-dim border-accent text-accent' :
                        'bg-surface border-border text-primary'
                      : 'bg-surface border-border text-muted hover:bg-surface-raised'
                  ]">
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">描述</div>
              <p class="text-sm text-primary leading-relaxed whitespace-pre-wrap">{{ selectedTask.description || '暂无描述' }}</p>
            </div>
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">负责人</div>
              <div class="flex items-center gap-2">
                <span class="text-xl">{{ agentAvatars[selectedTask.agent] || '👤' }}</span>
                <span class="text-sm font-medium text-primary">{{ selectedTask.agent }}</span>
              </div>
            </div>
            <div v-if="selectedTask.excard">
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">ExCard</div>
              <div class="px-3 py-2 bg-accent-dim rounded-lg text-sm text-violet-700 font-medium">
                {{ selectedTask.excard }}
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">步骤</div>
              <p class="text-sm text-primary">#{{ getTaskStepIndex(selectedTask) }} / {{ tasksForJob(selectedTask.jobId).length }}</p>
            </div>
            <div>
              <div class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">创建时间</div>
              <p class="text-sm text-primary">{{ selectedTask.createdAt }}</p>
            </div>
          </div>
          <div class="px-5 py-4 border-t border-border-subtle">
            <button @click="closeDetail"
              class="w-full py-2 text-secondary hover:bg-surface rounded-lg text-sm font-medium transition-colors">
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== Create Task Modal ===== -->
    <Teleport to="body">
      <div v-if="showCreateModal"
        class="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="showCreateModal = false">
        <div class="bg-surface rounded-2xl shadow-md w-full max-w-md mx-4 border border-border-subtle">
          <div class="px-6 py-4 border-b border-border-subtle">
            <h3 class="text-base font-semibold text-primary">新建任务</h3>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1.5">所属工作</label>
              <select v-model="newTask.jobId"
                class="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent bg-surface">
                <option v-for="job in jobs" :key="job.id" :value="job.id">{{ job.title }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1.5">标题</label>
              <input v-model="newTask.title" type="text" placeholder="输入任务标题"
                class="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1.5">描述</label>
              <textarea v-model="newTask.description" rows="2" placeholder="输入任务描述"
                class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-primary mb-1.5">负责人</label>
                <select v-model="newTask.agent"
                  class="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent bg-surface">
                  <option v-for="agent in agents" :key="agent.id" :value="agent.name">{{ agent.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-primary mb-1.5">优先级</label>
                <select v-model="newTask.priority"
                  class="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent bg-surface">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">
            <button @click="showCreateModal = false"
              class="px-4 py-2 text-secondary hover:bg-surface rounded-lg text-sm font-medium transition-colors">
              取消
            </button>
            <button @click="createTask"
              class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-all duration-150">
              创建
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
