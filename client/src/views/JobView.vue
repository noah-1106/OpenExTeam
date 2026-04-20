<script setup>
import { ref } from 'vue'

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
  excards: { type: Array, default: () => [] },
})

const emit = defineEmits(['create-job', 'start-job', 'delete-job', 'add-task', 'delete-task', 'update-job'])

// ==================== 新建工作弹窗 ====================
const showCreateModal = ref(false)
const newJob = ref({ title: '', description: '', agent: '', type: 'once', excardId: '', scheduleTime: '09:00' })

function openCreateModal() {
  newJob.value = { title: '', description: '', agent: '', type: 'once', excardId: '', autoGenerateTasks: false }
  showCreateModal.value = true
}

function createJob() {
  if (!newJob.value.title.trim()) return
  const jobData = { ...newJob.value }
  if (jobData.type !== 'recurring') {
    delete jobData.scheduleTime
  }
  emit('create-job', jobData)
  showCreateModal.value = false
}

// ==================== 工作详情弹窗 ====================
const showDetail = ref(false)
const selectedJob = ref(null)
const isEditingJob = ref(false)
const editJobData = ref({})

function openJobDetail(job) {
  selectedJob.value = job
  isEditingJob.value = false
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  selectedJob.value = null
  isEditingJob.value = false
  showAddTask.value = false
}

function startEditJob() {
  editJobData.value = { ...selectedJob.value }
  isEditingJob.value = true
}

function saveEditJob() {
  emit('update-job', { ...editJobData.value })
  selectedJob.value = { ...editJobData.value }
  isEditingJob.value = false
}

function deleteCurrentJob() {
  if (!selectedJob.value) return
  if (confirm(`确定删除工作「${selectedJob.value.title}」？`)) {
    emit('delete-job', selectedJob.value.id)
    closeDetail()
  }
}

// ==================== 添加 Task ====================
const showAddTask = ref(false)
const newTaskTitle = ref('')

function openAddTask() {
  newTaskTitle.value = ''
  showAddTask.value = true
}

function addTaskToJob() {
  if (!newTaskTitle.value.trim() || !selectedJob.value) return
  emit('add-task', { jobId: selectedJob.value.id, title: newTaskTitle.value.trim() })
  showAddTask.value = false
}

function removeTaskFromJob(task) {
  if (confirm(`确定移除任务「${task.title}」？`)) {
    emit('delete-task', task.id)
  }
}

// ==================== 工作流操作 ====================
function startWorkflow(job) {
  emit('start-job', job.id)
}

// ==================== 辅助函数 ====================
function tasksForJob(jobId) {
  return props.tasks.filter(t => t.jobId === jobId)
}

function doneCount(jobId) {
  return tasksForJob(jobId).filter(t => t.status === 'done').length
}

function totalCount(jobId) {
  return tasksForJob(jobId).length
}

function progress(jobId) {
  const total = totalCount(jobId)
  if (!total) return 0
  return Math.round((doneCount(jobId) / total) * 100)
}

function getStatusLabel(status) {
  return status === 'done' ? '已完成' : status === 'in-progress' ? '进行中' : '未开始'
}

function getStatusStyle(status) {
  return status === 'done' ? 'bg-green-50 text-green-600 border border-green-100' :
         status === 'in-progress' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
         'bg-surface-raised text-secondary border border-border-subtle'
}

function getJobExcardName(excardId) {
  if (!excardId) return '—'
  const ec = props.excards.find(e => e.id === excardId)
  return ec ? ec.name : excardId
}

const agentAvatars = { '品品': '👩‍💼', '开开': '👨‍💻', '前前': '👨‍🎨', '维维': '👨‍🔧', '测测': '🧪' }
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-primary">工作</h2>
        <p class="text-sm text-secondary mt-0.5">{{ jobs.length }} 个工作</p>
      </div>
      <button @click="openCreateModal" class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors flex items-center gap-2 shadow-xs">
        <span class="text-lg">+</span> 新建工作
      </button>
    </div>

    <!-- Job Cards -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="jobs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="job in jobs"
          :key="job.id"
          class="bg-surface rounded-xl border border-border-subtle p-5 shadow-xs hover:shadow-sm transition-shadow duration-200"
        >
          <!-- Job Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ job.agent ? (agentAvatars[job.agent] || '👤') : '📋' }}</span>
              <div>
                <div class="font-semibold text-primary text-sm">{{ job.title }}</div>
                <div class="text-xs text-muted">{{ job.agent || '多 Agent 协作' }}</div>
              </div>
            </div>
            <span :class="['text-xs px-2 py-0.5 rounded-md font-medium', job.type === 'recurring' ? 'bg-blue-50 text-blue-600' : 'bg-surface-raised text-secondary']">
              {{ job.type === 'recurring' ? '🔄 周期性' : '⚡ 一次性' }}
            </span>
          </div>

          <p class="text-sm text-secondary mb-4 line-clamp-2 leading-relaxed">{{ job.description }}</p>

          <!-- ExCard + Status -->
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <span v-if="job.excard" class="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 font-medium">
              {{ getJobExcardName(job.excard) }}
            </span>
            <span :class="['text-xs px-2 py-0.5 rounded-md font-medium', getStatusStyle(job.status)]">
              {{ getStatusLabel(job.status) }}
            </span>
          </div>

          <!-- Progress -->
          <div class="border-t border-border-subtle pt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-muted">
                {{ doneCount(job.id) }}/{{ totalCount(job.id) }} 任务完成
              </span>
              <span class="text-xs font-semibold text-primary">{{ progress(job.id) }}%</span>
            </div>
            <div class="h-2 bg-surface-raised rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="job.status === 'done' ? 'bg-green-400' : job.status === 'in-progress' ? 'bg-accent' : 'bg-gray-300'"
                :style="{ width: progress(job.id) + '%' }"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 mt-4">
            <button @click="openJobDetail(job)" class="flex-1 py-1.5 border border-border text-secondary rounded-lg text-xs hover:bg-surface-raised transition-colors">
              📋 详情
            </button>
            <button @click="startWorkflow(job)" class="flex-1 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors">
              ▶ 启动
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-24 text-muted">
        <div class="text-5xl mb-3">📋</div>
        <div class="text-base font-medium">暂无工作</div>
        <div class="text-sm mt-1">点击「+ 新建工作」开始</div>
      </div>
    </div>

    <!-- 新建工作弹窗 -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showCreateModal = false" />
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-md mx-4 animate-fade-in">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h3 class="font-semibold text-primary">新建工作</h3>
          <button @click="showCreateModal = false" class="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>
        <div class="px-5 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">工作名称</label>
            <input v-model="newJob.title" type="text" placeholder="例如：每日站会摘要" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface" />
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">负责 Agent <span class="text-muted text-xs">(可选，可在 ExCard 或任务中指定)</span></label>
            <select v-model="newJob.agent" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
              <option value="">不指定 (使用 ExCard 或任务中的 Agent)</option>
              <option v-for="agent in agents" :key="agent.id" :value="agent.name">{{ agent.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">描述</label>
            <textarea v-model="newJob.description" rows="2" placeholder="简要描述工作内容..." class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent bg-surface" />
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">类型</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" v-model="newJob.type" value="once" class="accent-accent" /> 一次性
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" v-model="newJob.type" value="recurring" class="accent-accent" /> 周期性
              </label>
            </div>
          </div>
          <div v-if="newJob.type === 'recurring'">
            <label class="block text-sm font-medium text-primary mb-1.5">触发时间</label>
            <input
              v-model="newJob.scheduleTime"
              type="time"
              class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-1.5">绑定 ExCard</label>
            <select v-model="newJob.excardId" class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
              <option value="">不绑定</option>
              <option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option>
            </select>
            <p class="text-xs text-muted mt-1">ExCard 作为完整的执行模板，启动时会发送给 Agent</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">取消</button>
          <button @click="createJob" class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors">创建</button>
        </div>
      </div>
    </div>

    <!-- 工作详情弹窗 -->
    <div v-if="showDetail && selectedJob" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeDetail" />
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
          <div>
            <div class="text-xs text-muted">工作详情</div>
            <h3 class="font-semibold text-primary text-base mt-0.5">
              <template v-if="isEditingJob">
                <input v-model="editJobData.title" class="px-2 py-1 border border-border rounded text-sm w-full outline-none focus:border-accent bg-surface" />
              </template>
              <template v-else>{{ selectedJob.title }}</template>
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="isEditingJob">
              <button @click="isEditingJob = false" class="px-3 py-1.5 text-sm text-secondary hover:text-primary">取消</button>
              <button @click="saveEditJob" class="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover">保存</button>
            </template>
            <template v-else>
              <button @click="startEditJob" class="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised text-secondary">编辑</button>
              <button @click="deleteCurrentJob" class="px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50">删除</button>
            </template>
            <button @click="closeDetail" class="text-muted hover:text-primary text-xl leading-none ml-1">×</button>
          </div>
        </div>

        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- 基本信息 -->
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-muted text-xs mb-1">负责 Agent</div>
              <template v-if="isEditingJob">
                <select v-model="editJobData.agent" class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                  <option value="">不指定</option>
                  <option v-for="a in agents" :key="a.id" :value="a.name">{{ a.name }}</option>
                </select>
              </template>
              <div v-else class="text-primary font-medium">{{ selectedJob.agent || '多 Agent 协作' }}</div>
            </div>
            <div>
              <div class="text-muted text-xs mb-1">类型</div>
              <template v-if="isEditingJob">
                <select v-model="editJobData.type" class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                  <option value="once">一次性</option>
                  <option value="recurring">周期性</option>
                </select>
              </template>
              <div v-else class="text-primary">{{ selectedJob.type === 'once' ? '一次性' : '周期性' }}</div>
            </div>
            <div>
              <div class="text-muted text-xs mb-1">状态</div>
              <span :class="['text-xs px-2 py-0.5 rounded font-medium', getStatusStyle(selectedJob.status)]">
                {{ getStatusLabel(selectedJob.status) }}
              </span>
            </div>
            <div>
              <div class="text-muted text-xs mb-1">绑定 ExCard</div>
              <template v-if="isEditingJob">
                <select v-model="editJobData.excard" class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                  <option value="">不绑定</option>
                  <option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option>
                </select>
              </template>
              <div v-else class="text-primary text-xs">{{ getJobExcardName(selectedJob.excard) }}</div>
            </div>
          </div>

          <!-- 描述 -->
          <div>
            <div class="text-muted text-xs mb-1">描述</div>
            <template v-if="isEditingJob">
              <textarea v-model="editJobData.description" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent bg-surface" />
            </template>
            <div v-else class="text-sm text-secondary">{{ selectedJob.description || '—' }}</div>
          </div>

          <!-- 任务列表 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm font-medium text-primary">任务列表</div>
              <button @click="openAddTask" class="px-2 py-1 text-xs text-accent border border-accent/30 rounded hover:bg-accent/10">+ 添加任务</button>
            </div>
            <div v-if="tasksForJob(selectedJob.id).length === 0" class="text-sm text-muted text-center py-4 bg-surface-raised rounded-lg">暂无任务</div>
            <div v-else class="space-y-1.5">
              <div
                v-for="task in tasksForJob(selectedJob.id)"
                :key="task.id"
                class="flex items-center justify-between bg-surface-raised rounded-lg px-3 py-2"
              >
                <div class="flex items-center gap-2">
                  <span :class="['w-2 h-2 rounded-full flex-shrink-0', task.status === 'done' ? 'bg-green-400' : task.status === 'in-progress' ? 'bg-accent' : 'bg-gray-300']" />
                  <span class="text-sm text-primary">{{ task.title }}</span>
                </div>
                <button @click="removeTaskFromJob(task)" class="text-muted hover:text-red-400 text-xs">移除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加任务输入 -->
        <div v-if="showAddTask" class="px-5 pb-4 border-t border-border-subtle flex-shrink-0">
          <div class="flex gap-2 mt-3">
            <input v-model="newTaskTitle" @keydown.enter="addTaskToJob" type="text" placeholder="输入任务名称" class="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface" />
            <button @click="addTaskToJob" class="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover">添加</button>
            <button @click="showAddTask = false" class="px-3 py-2 text-sm text-secondary hover:text-primary">取消</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
