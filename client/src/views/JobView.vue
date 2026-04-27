<script setup>
import { ref, computed } from 'vue'
import api, { BASE as API_BASE } from '../api/client'

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
  excards: { type: Array, default: () => [] },
})

const emit = defineEmits(['create-job', 'start-job', 'delete-job', 'add-task', 'delete-task', 'update-job'])

// ==================== 新建工作弹窗 ====================
const showCreateModal = ref(false)
const newJob = ref({
  title: '',
  description: '',
  agent: '',
  type: 'once',
  scheduleType: 'daily',
  scheduleDays: [1, 2, 3, 4, 5],
  scheduleTimes: ['09:00']
})
const newSteps = ref([])

function openCreateModal() {
  newJob.value = {
    title: '',
    description: '',
    agent: '',
    type: 'once',
    scheduleType: 'daily',
    scheduleDays: [1, 2, 3, 4, 5],
    scheduleTimes: ['09:00']
  }
  newSteps.value = []
  showCreateModal.value = true
}

async function createJob() {
  if (!newJob.value.title.trim()) return

  // 创建 Job
  const res = await api.createJob(newJob.value)

  // 创建步骤
  for (let i = 0; i < newSteps.value.length; i++) {
    const step = newSteps.value[i]
    await api.createJobStep(res.id, {
      stepOrder: i,
      stepType: step.type,
      title: step.title,
      description: step.description,
      agent: step.agent,
      excardId: step.excardId
    })
  }

  emit('create-job', { ...newJob.value, id: res.id })
  showCreateModal.value = false
}

// 步骤管理
function addStep(type) {
  newSteps.value.push({
    type,
    title: '',
    description: '',
    agent: '',
    excardId: ''
  })
}

function removeStep(index) {
  newSteps.value.splice(index, 1)
}

function moveStep(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= newSteps.value.length) return
  const temp = newSteps.value[index]
  newSteps.value[index] = newSteps.value[newIndex]
  newSteps.value[newIndex] = temp
}

// 时间管理
function addScheduleTime() {
  newJob.value.scheduleTimes.push('09:00')
}

function removeScheduleTime(index) {
  newJob.value.scheduleTimes.splice(index, 1)
}

// ==================== 工作详情弹窗 ====================
const showDetail = ref(false)
const selectedJob = ref(null)
const isEditingJob = ref(false)
const editJobData = ref({})
const editSteps = ref([])

async function openJobDetail(job) {
  selectedJob.value = job
  isEditingJob.value = false

  // 加载步骤
  try {
    const data = await api.getJobSteps(job.id)
    // 统一字段格式
    editSteps.value = (data.steps || []).map(step => ({
      ...step,
      step_type: step.step_type || step.stepType,
      stepType: step.step_type || step.stepType,
      excard_id: step.excard_id || step.excardId || '',
      excardId: step.excard_id || step.excardId || ''
    }))
  } catch (e) {
    editSteps.value = []
  }

  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  selectedJob.value = null
  isEditingJob.value = false
}

function startEditJob() {
  editJobData.value = {
    ...selectedJob.value,
    scheduleDays: selectedJob.value.scheduleDays || [1, 2, 3, 4, 5],
    scheduleTimes: selectedJob.value.scheduleTimes || ['09:00']
  }
  isEditingJob.value = true
}

async function saveEditJob() {
  // 保存步骤
  for (const step of editSteps.value) {
    // 同步字段
    step.excardId = step.excard_id
    step.stepType = step.step_type

    if (step.id) {
      // 更新现有步骤
      await api.updateJobStep(step.id, {
        title: step.title,
        description: step.description,
        agent: step.agent,
        stepType: step.step_type,
        excardId: step.excard_id
      })
    } else {
      // 创建新步骤
      await api.createJobStep(selectedJob.value.id, {
        title: step.title,
        description: step.description,
        agent: step.agent,
        stepType: step.step_type,
        excardId: step.excard_id,
        stepOrder: editSteps.value.indexOf(step)
      })
    }
  }

  // 保存 Job 基本信息
  await emit('update-job', { ...editJobData.value, id: selectedJob.value.id })

  // 重新加载步骤
  try {
    const data = await api.getJobSteps(selectedJob.value.id)
    editSteps.value = (data.steps || []).map(step => ({
      ...step,
      step_type: step.step_type || step.stepType,
      stepType: step.step_type || step.stepType,
      excard_id: step.excard_id || step.excardId || '',
      excardId: step.excard_id || step.excardId || ''
    }))
  } catch (e) {
    editSteps.value = []
  }

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

// 编辑步骤
function addEditStep(type) {
  editSteps.value.push({
    step_type: type,
    stepType: type,
    title: '',
    description: '',
    agent: '',
    excard_id: '',
    excardId: '',
    status: 'pending'
  })
}

function removeEditStep(index) {
  const step = editSteps.value[index]
  if (step.id && confirm('确定删除这个步骤？')) {
    api.deleteJobStep(step.id).catch(() => {})
  }
  editSteps.value.splice(index, 1)
}

function moveEditStep(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= editSteps.value.length) return
  const temp = editSteps.value[index]
  editSteps.value[index] = editSteps.value[newIndex]
  editSteps.value[newIndex] = temp
}

function addEditScheduleTime() {
  if (!editJobData.value.scheduleTimes) {
    editJobData.value.scheduleTimes = []
  }
  editJobData.value.scheduleTimes.push('09:00')
}

function removeEditScheduleTime(index) {
  editJobData.value.scheduleTimes.splice(index, 1)
}

// ==================== 工作流操作 ====================
async function startWorkflow(job) {
  if (job.status === 'done') {
    // 已完成的工作，询问用户
    const action = confirm(
      `工作「${job.title}」已完成。\n\n` +
      `点击「确定」重新执行（重置步骤状态），\n` +
      `点击「取消」创建为新工作。`
    )
    if (action) {
      // 重新执行：重置步骤状态和工作状态
      try {
        // 先获取步骤
        const data = await api.getJobSteps(job.id)
        const steps = data.steps || []

        // 重置所有步骤为pending
        for (const step of steps) {
          await api.updateJobStep(step.id, { status: 'pending' })
        }

        // 重置工作状态为idle
        await emit('update-job', { id: job.id, status: 'idle' })

        // 启动工作流
        emit('start-job', job.id)
      } catch (e) {
        console.error('Failed to restart job:', e)
        alert('重新执行失败，请刷新重试')
      }
    } else {
      // 创建为新工作
      try {
        // 先获取步骤
        const data = await api.getJobSteps(job.id)
        const steps = data.steps || []

        // 创建新工作
        const newJobRes = await api.createJob({
          title: job.title + ' (副本)',
          description: job.description || '',
          type: job.type || 'once',
          status: 'idle'
        })

        // 复制步骤
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]
          await api.createJobStep(newJobRes.id, {
            stepOrder: i,
            stepType: step.step_type || step.stepType,
            title: step.title,
            description: step.description,
            agent: step.agent,
            excardId: step.excard_id || step.excardId
          })
        }

        // 刷新列表
        emit('create-job', { ...job, id: newJobRes.id, title: job.title + ' (副本)' })

        alert('已创建为新工作！')
      } catch (e) {
        console.error('Failed to copy job:', e)
        alert('创建新工作失败，请重试')
      }
    }
  } else {
    // 未完成的工作，直接启动
    emit('start-job', job.id)
  }
}

// ==================== 辅助函数 ====================
function tasksForJob(jobId) {
  return props.tasks.filter(t => t.job_id === jobId || t.jobId === jobId)
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

function getStepTypeLabel(type) {
  return type === 'excard' ? 'ExCard' : '任务'
}

function getStepStatusStyle(status) {
  return status === 'completed' ? 'bg-green-50 text-green-600 border border-green-200' :
    status === 'in-progress' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
      'bg-gray-50 text-gray-600 border border-gray-200'
}

function getDayLabel(day) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[day]
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
      <button @click="openCreateModal"
              class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors flex items-center gap-2 shadow-xs">
        <span class="text-lg">+</span> 新建工作
      </button>
    </div>

    <!-- Job Cards -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="jobs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="job in jobs" :key="job.id"
             class="bg-surface rounded-xl border border-border-subtle p-5 shadow-xs hover:shadow-sm transition-shadow duration-200">
          <!-- Job Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ job.agent ? (agentAvatars[job.agent] || '👤') : '📋' }}</span>
              <div>
                <div class="font-semibold text-primary text-sm">{{ job.title }}</div>
                <div class="text-xs text-muted">{{ job.agent || '多 Agent 协作' }}</div>
              </div>
            </div>
            <span :class="['text-xs px-2 py-0.5 rounded-md font-medium',
                           job.type === 'recurring' ? 'bg-blue-50 text-blue-600' : 'bg-surface-raised text-secondary']">
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
              <span class="text-xs text-muted">{{ doneCount(job.id) }}/{{ totalCount(job.id) }} 任务完成</span>
              <span class="text-xs font-semibold text-primary">{{ progress(job.id) }}%</span>
            </div>
            <div class="h-2 bg-surface-raised rounded-full overflow-hidden">
              <div :class="['h-full rounded-full transition-all duration-300',
                            job.status === 'done' ? 'bg-green-400' : job.status === 'in-progress' ? 'bg-accent' : 'bg-gray-300']"
                   :style="{ width: progress(job.id) + '%' }" />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 mt-4">
            <button @click="openJobDetail(job)"
                    class="flex-1 py-1.5 border border-border text-secondary rounded-lg text-xs hover:bg-surface-raised transition-colors">
              📋 详情
            </button>
            <button @click="startWorkflow(job)"
                    class="flex-1 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors">
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
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h3 class="font-semibold text-primary">新建工作</h3>
          <button @click="showCreateModal = false" class="text-muted hover:text-primary text-xl leading-none">×</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <!-- 基本信息 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-primary mb-1.5">工作名称</label>
              <input v-model="newJob.title" type="text" placeholder="例如：每日站会摘要"
                     class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-primary mb-1.5">描述</label>
              <textarea v-model="newJob.description" rows="2" placeholder="简要描述工作内容..."
                        class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent bg-surface" />
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
          </div>

          <!-- 周期性设置 -->
          <div v-if="newJob.type === 'recurring'" class="border-t border-border-subtle pt-4">
            <h4 class="text-sm font-medium text-primary mb-3">周期设置</h4>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-primary mb-1.5">重复类型</label>
                <select v-model="newJob.scheduleType"
                        class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>

              <!-- 每周选择 -->
              <div v-if="newJob.scheduleType === 'weekly'">
                <label class="block text-xs font-medium text-primary mb-1.5">选择星期</label>
                <div class="flex flex-wrap gap-2">
                  <label v-for="day in [1,2,3,4,5,6,0]" :key="day"
                         class="flex items-center gap-1 text-xs cursor-pointer px-2 py-1 rounded border"
                         :class="newJob.scheduleDays.includes(day)
                                ? 'bg-accent text-white border-accent' : 'bg-surface border-border'">
                    <input type="checkbox" :value="day" v-model="newJob.scheduleDays" class="hidden" />
                    {{ getDayLabel(day) }}
                  </label>
                </div>
              </div>

              <!-- 每天/每周/每月的时间点 -->
              <div>
                <label class="block text-xs font-medium text-primary mb-1.5">执行时间</label>
                <div v-for="(time, idx) in newJob.scheduleTimes" :key="idx" class="flex gap-2 mb-2">
                  <input v-model="newJob.scheduleTimes[idx]" type="time"
                         class="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface" />
                  <button v-if="newJob.scheduleTimes.length > 1" @click="removeScheduleTime(idx)"
                          class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">删除</button>
                </div>
                <button @click="addScheduleTime" class="text-xs text-accent hover:underline">+ 添加时间</button>
              </div>
            </div>
          </div>

          <!-- 步骤编排 -->
          <div class="border-t border-border-subtle pt-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-primary">步骤编排</h4>
              <div class="flex gap-2">
                <button @click="addStep('task')" class="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
                  + 添加任务
                </button>
                <button @click="addStep('excard')" class="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors">
                  + 添加 ExCard
                </button>
              </div>
            </div>

            <div v-if="newSteps.length === 0" class="text-sm text-muted text-center py-8 bg-surface-raised rounded-lg">
              暂无步骤，点击上方按钮添加
            </div>

            <div v-else class="space-y-3">
              <div v-for="(step, idx) in newSteps" :key="idx"
                   class="bg-surface-raised rounded-lg p-4 border border-border-subtle">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted font-medium">步骤 {{ idx + 1 }}</span>
                    <span :class="['text-xs px-2 py-0.5 rounded font-medium',
                                   step.type === 'excard' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600']">
                      {{ getStepTypeLabel(step.type) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <button @click="moveStep(idx, -1)" :disabled="idx === 0"
                            class="px-2 py-1 text-xs text-muted hover:text-primary disabled:opacity-30">↑</button>
                    <button @click="moveStep(idx, 1)" :disabled="idx === newSteps.length - 1"
                            class="px-2 py-1 text-xs text-muted hover:text-primary disabled:opacity-30">↓</button>
                    <button @click="removeStep(idx)"
                            class="px-2 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">删除</button>
                  </div>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-primary mb-1">标题</label>
                    <input v-model="step.title" type="text"
                           class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface" />
                  </div>
                  <div v-if="step.type === 'task'">
                    <label class="block text-xs font-medium text-primary mb-1">描述（可选）</label>
                    <textarea v-model="step.description" rows="2"
                              class="w-full px-2 py-1.5 border border-border rounded text-sm resize-none outline-none focus:border-accent bg-surface" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-primary mb-1">执行 Agent</label>
                    <select v-model="step.agent"
                            class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                      <option value="">不指定（步骤中配置）</option>
                      <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }} ({{ a.adapter }})</option>
                    </select>
                  </div>
                  <div v-if="step.type === 'excard'">
                    <label class="block text-xs font-medium text-primary mb-1">选择 ExCard</label>
                    <select v-model="step.excardId"
                            class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                      <option value="">请选择</option>
                      <option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
          <button @click="showCreateModal = false"
                  class="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">取消</button>
          <button @click="createJob"
                  class="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors">创建</button>
        </div>
      </div>
    </div>

    <!-- 工作详情弹窗 -->
    <div v-if="showDetail && selectedJob" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeDetail" />
      <div class="relative bg-surface rounded-xl shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
          <div>
            <div class="text-xs text-muted">工作详情</div>
            <h3 class="font-semibold text-primary text-base mt-0.5">
              <template v-if="isEditingJob">
                <input v-model="editJobData.title"
                       class="px-2 py-1 border border-border rounded text-sm w-full outline-none focus:border-accent bg-surface" />
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
              <div class="text-muted text-xs mb-1">类型</div>
              <template v-if="isEditingJob">
                <select v-model="editJobData.type"
                        class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
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
          </div>

          <!-- 周期设置（编辑模式） -->
          <div v-if="isEditingJob && editJobData.type === 'recurring'" class="border-t border-border-subtle pt-4">
            <h4 class="text-sm font-medium text-primary mb-3">周期设置</h4>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-primary mb-1.5">重复类型</label>
                <select v-model="editJobData.scheduleType"
                        class="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface">
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div v-if="editJobData.scheduleType === 'weekly'">
                <label class="block text-xs font-medium text-primary mb-1.5">选择星期</label>
                <div class="flex flex-wrap gap-2">
                  <label v-for="day in [1,2,3,4,5,6,0]" :key="day"
                         class="flex items-center gap-1 text-xs cursor-pointer px-2 py-1 rounded border"
                         :class="editJobData.scheduleDays?.includes(day)
                                ? 'bg-accent text-white border-accent' : 'bg-surface border-border'">
                    <input type="checkbox" :value="day" v-model="editJobData.scheduleDays" class="hidden" />
                    {{ getDayLabel(day) }}
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-primary mb-1.5">执行时间</label>
                <div v-for="(time, idx) in editJobData.scheduleTimes" :key="idx" class="flex gap-2 mb-2">
                  <input v-model="editJobData.scheduleTimes[idx]" type="time"
                         class="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-accent bg-surface" />
                  <button v-if="editJobData.scheduleTimes?.length > 1" @click="removeEditScheduleTime(idx)"
                          class="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">删除</button>
                </div>
                <button @click="addEditScheduleTime" class="text-xs text-accent hover:underline">+ 添加时间</button>
              </div>
            </div>
          </div>

          <!-- 描述 -->
          <div>
            <div class="text-muted text-xs mb-1">描述</div>
            <template v-if="isEditingJob">
              <textarea v-model="editJobData.description" rows="2"
                        class="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:border-accent bg-surface" />
            </template>
            <div v-else class="text-sm text-secondary">{{ selectedJob.description || '—' }}</div>
          </div>

          <!-- 步骤列表（详情模式） -->
          <div class="border-t border-border-subtle pt-4">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm font-medium text-primary">步骤列表</div>
              <template v-if="isEditingJob">
                <div class="flex gap-2">
                  <button @click="addEditStep('task')" class="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
                    + 添加任务
                  </button>
                  <button @click="addEditStep('excard')" class="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors">
                    + 添加 ExCard
                  </button>
                </div>
              </template>
            </div>

            <div v-if="editSteps.length === 0" class="text-sm text-muted text-center py-8 bg-surface-raised rounded-lg">
              暂无步骤
            </div>

            <div v-else class="space-y-3">
              <div v-for="(step, idx) in editSteps" :key="step.id || idx"
                   class="bg-surface-raised rounded-lg p-4 border border-border-subtle">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted font-medium">步骤 {{ idx + 1 }}</span>
                    <span :class="['text-xs px-2 py-0.5 rounded font-medium',
                                  (step.step_type || step.stepType) === 'excard' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600']">
                      {{ getStepTypeLabel(step.step_type || step.stepType) }}
                    </span>
                    <span v-if="step.status" :class="['text-xs px-2 py-0.5 rounded font-medium', getStepStatusStyle(step.status)]">
                      {{ step.status }}
                    </span>
                  </div>
                  <template v-if="isEditingJob">
                    <div class="flex items-center gap-1">
                      <button @click="moveEditStep(idx, -1)" :disabled="idx === 0"
                              class="px-2 py-1 text-xs text-muted hover:text-primary disabled:opacity-30">↑</button>
                      <button @click="moveEditStep(idx, 1)" :disabled="idx === editSteps.length - 1"
                              class="px-2 py-1 text-xs text-muted hover:text-primary disabled:opacity-30">↓</button>
                      <button @click="removeEditStep(idx)"
                              class="px-2 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">删除</button>
                    </div>
                  </template>
                </div>

                <template v-if="isEditingJob">
                  <div class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-primary mb-1">标题</label>
                      <input v-model="step.title" type="text"
                             class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface" />
                    </div>
                    <div v-if="(step.step_type || step.stepType) === 'task'">
                      <label class="block text-xs font-medium text-primary mb-1">描述（可选）</label>
                      <textarea v-model="step.description" rows="2"
                                class="w-full px-2 py-1.5 border border-border rounded text-sm resize-none outline-none focus:border-accent bg-surface" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-primary mb-1">执行 Agent</label>
                      <select v-model="step.agent"
                              class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                        <option value="">不指定（步骤中配置）</option>
                        <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }} ({{ a.adapter }})</option>
                      </select>
                    </div>
                    <div v-if="(step.step_type || step.stepType) === 'excard'">
                      <label class="block text-xs font-medium text-primary mb-1">选择 ExCard</label>
                      <select v-model="step.excard_id"
                              class="w-full px-2 py-1.5 border border-border rounded text-sm outline-none focus:border-accent bg-surface">
                        <option value="">请选择</option>
                        <option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option>
                      </select>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="text-sm text-primary font-medium">{{ step.title }}</div>
                  <div v-if="step.description" class="text-xs text-muted mt-1">{{ step.description }}</div>
                  <div v-if="step.agent" class="text-xs text-accent mt-1">{{ step.agent }}</div>
                </template>
              </div>
            </div>
          </div>

          <!-- 任务列表（向后兼容） -->
          <div class="border-t border-border-subtle pt-4" v-if="tasksForJob(selectedJob.id).length > 0">
            <div class="text-sm font-medium text-primary mb-3">任务列表（旧版）</div>
            <div class="space-y-1.5">
              <div v-for="task in tasksForJob(selectedJob.id)" :key="task.id"
                   class="flex items-center justify-between bg-surface-raised rounded-lg px-3 py-2">
                <div class="flex items-center gap-2">
                  <span :class="['w-2 h-2 rounded-full flex-shrink-0',
                                task.status === 'done' ? 'bg-green-400' : task.status === 'in-progress' ? 'bg-accent' : 'bg-gray-300']" />
                  <span class="text-sm text-primary">{{ task.title }}</span>
                </div>
              </div>
            </div>
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
