<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import api from '../api/client.js'
import { createSSEConnection } from '../api/sse.js'

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
})

const emit = defineEmits(['update-task', 'create-task', 'start-job'])

const jobSteps = ref({}) // jobId -> steps array
const selectedJobId = ref(null)
let sseHandle = null

const activeJobs = computed(() => {
  return props.jobs.filter(job => job.status === 'in-progress')
})

const otherJobs = computed(() => {
  return props.jobs.filter(job => job.status !== 'in-progress')
})

async function loadJobSteps(jobId) {
  try {
    const data = await api.getJobSteps(jobId)
    jobSteps.value[jobId] = data.steps || []
  } catch (e) {
    console.error('Failed to load job steps:', e)
    jobSteps.value[jobId] = []
  }
}

function getStepsForJob(jobId) {
  return jobSteps.value[jobId] || []
}

function getTodoSteps(jobId) {
  return getStepsForJob(jobId).filter(s => s.status === 'pending' || s.status === 'todo')
}

function getInProgressSteps(jobId) {
  return getStepsForJob(jobId).filter(s => s.status === 'in-progress')
}

function getDoneSteps(jobId) {
  return getStepsForJob(jobId).filter(s => s.status === 'completed' || s.status === 'done')
}

function getAgentName(agentId) {
  if (!agentId) return ''
  const agent = props.agents.find(a => a.id === agentId)
  if (!agent) return agentId
  return agent.name
}

function startWorkflow(jobId) {
  emit('start-job', jobId)
  setTimeout(() => loadJobSteps(jobId), 500)
}

function statusLabel(status) {
  switch (status) {
    case 'pending': return '等待中'
    case 'in-progress': return '进行中'
    case 'completed': return '已完成'
    case 'error': return '错误'
    default: return status
  }
}

function getStepTypeLabel(type) {
  return type === 'excard' ? 'ExCard' : '任务'
}

function selectJob(jobId) {
  if (selectedJobId.value === jobId) {
    selectedJobId.value = null
  } else {
    selectedJobId.value = jobId
    if (!jobSteps.value[jobId]) {
      loadJobSteps(jobId)
    }
  }
}

// SSE event handling for real-time updates
function connectSSE() {
  if (sseHandle) sseHandle.close()

  sseHandle = createSSEConnection({
    workflow_started: (e) => {
      const d = JSON.parse(e.data)
      console.log('[Board] Workflow started:', d)
      setTimeout(() => loadJobSteps(d.jobId), 100)
    },

    workflow_step_advanced: (e) => {
      const d = JSON.parse(e.data)
      console.log('[Board] Workflow step advanced:', d)
      setTimeout(() => loadJobSteps(d.jobId), 100)
    },

    workflow_completed: (e) => {
      const d = JSON.parse(e.data)
      console.log('[Board] Workflow completed:', d)
      setTimeout(() => loadJobSteps(d.jobId), 100)
    },

    workflow_error: (e) => {
      const d = JSON.parse(e.data)
      console.log('[Board] Workflow error:', d)
      setTimeout(() => loadJobSteps(d.jobId), 100)
    },
  })
}

onMounted(() => {
  connectSSE()
  activeJobs.value.forEach(job => {
    loadJobSteps(job.id)
  })
})

onUnmounted(() => {
  if (sseHandle) {
    sseHandle.close()
    sseHandle = null
  }
})

// Watch for changes to active jobs and load steps
watch(activeJobs, (newJobs) => {
  newJobs.forEach(job => {
    if (!jobSteps.value[job.id]) {
      loadJobSteps(job.id)
    }
  })
}, { deep: true })
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-primary">看板</h2>
        <p class="text-sm text-secondary mt-0.5">
          {{ activeJobs.length }} 个工作正在执行
        </p>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- 如果有正在执行的工作，先显示工作选择器 -->
      <div v-if="activeJobs.length > 0" class="mb-6">
        <h3 class="text-sm font-semibold text-secondary mb-3">正在执行的工作</h3>
        <div class="flex flex-wrap gap-2">
          <button v-for="job in activeJobs" :key="job.id"
                  @click="selectJob(job.id)"
                  :class="['px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                          selectedJobId === job.id
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-surface text-secondary border-border-subtle hover:border-border']">
            {{ job.title }}
          </button>
        </div>
      </div>

      <!-- 看板内容区域 -->
      <div v-if="selectedJobId" class="bg-surface rounded-xl border border-border-subtle shadow-xs overflow-hidden">
        <!-- 工作标题栏 -->
        <div class="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-accent/5">
          <div>
            <h3 class="font-semibold text-primary">
              {{ (props.jobs.find(j => j.id === selectedJobId))?.title || '工作' }}
            </h3>
            <p class="text-xs text-muted mt-1">
              {{ getStepsForJob(selectedJobId).length }} 个步骤
            </p>
          </div>
        </div>

        <!-- 看板三列布局 -->
        <div class="grid grid-cols-3 gap-0">
          <!-- Todo 列 -->
          <div class="border-r border-border-subtle p-4 bg-gray-50/30">
            <div class="flex items-center gap-2 mb-4">
              <span class="w-2 h-2 rounded-full bg-gray-400"></span>
              <span class="text-sm font-semibold text-secondary">待执行</span>
              <span class="text-xs text-muted ml-auto">{{ getTodoSteps(selectedJobId).length }}</span>
            </div>
            <div class="space-y-3">
              <div v-for="step in getTodoSteps(selectedJobId)" :key="step.id"
                   class="bg-white rounded-lg border border-border-subtle p-3 shadow-xs hover:shadow-sm transition-shadow">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                    步骤 {{ getStepsForJob(selectedJobId).indexOf(step) + 1 }}
                  </span>
                  <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                                (step.step_type || step.stepType) === 'excard' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700']">
                    {{ getStepTypeLabel(step.step_type || step.stepType) }}
                  </span>
                </div>
                <div class="text-sm font-medium text-primary mb-1">{{ step.title }}</div>
                <div v-if="step.description" class="text-xs text-muted mb-2">{{ step.description }}</div>
                <div v-if="step.agent" class="text-xs text-accent">
                  {{ getAgentName(step.agent) }}
                </div>
              </div>
              <div v-if="getTodoSteps(selectedJobId).length === 0"
                   class="py-8 text-center text-xs text-muted">
                暂无数步骤
              </div>
            </div>
          </div>

          <!-- In Progress 列 -->
          <div class="border-r border-border-subtle p-4 bg-blue-50/30">
            <div class="flex items-center gap-2 mb-4">
              <span class="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              <span class="text-sm font-semibold text-secondary">执行中</span>
              <span class="text-xs text-muted ml-auto">{{ getInProgressSteps(selectedJobId).length }}</span>
            </div>
            <div class="space-y-3">
              <div v-for="step in getInProgressSteps(selectedJobId)" :key="step.id"
                   class="bg-white rounded-lg border border-accent/50 p-3 shadow-sm ring-1 ring-accent/20">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                    步骤 {{ getStepsForJob(selectedJobId).indexOf(step) + 1 }}
                  </span>
                  <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                                (step.step_type || step.stepType) === 'excard' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700']">
                    {{ getStepTypeLabel(step.step_type || step.stepType) }}
                  </span>
                </div>
                <div class="text-sm font-medium text-primary mb-1">{{ step.title }}</div>
                <div v-if="step.description" class="text-xs text-muted mb-2">{{ step.description }}</div>
                <div v-if="step.agent" class="text-xs text-accent">
                  {{ getAgentName(step.agent) }}
                </div>
              </div>
              <div v-if="getInProgressSteps(selectedJobId).length === 0"
                   class="py-8 text-center text-xs text-muted">
                暂无数步骤
              </div>
            </div>
          </div>

          <!-- Done 列 -->
          <div class="p-4 bg-green-50/30">
            <div class="flex items-center gap-2 mb-4">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span class="text-sm font-semibold text-secondary">已完成</span>
              <span class="text-xs text-muted ml-auto">{{ getDoneSteps(selectedJobId).length }}</span>
            </div>
            <div class="space-y-3">
              <div v-for="step in getDoneSteps(selectedJobId)" :key="step.id"
                   class="bg-white rounded-lg border border-green-200 p-3 shadow-xs opacity-90">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                    步骤 {{ getStepsForJob(selectedJobId).indexOf(step) + 1 }}
                  </span>
                  <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                                (step.step_type || step.stepType) === 'excard' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700']">
                    {{ getStepTypeLabel(step.step_type || step.stepType) }}
                  </span>
                </div>
                <div class="text-sm font-medium text-primary mb-1">{{ step.title }}</div>
                <div v-if="step.description" class="text-xs text-muted mb-2">{{ step.description }}</div>
                <div v-if="step.agent" class="text-xs text-accent">
                  {{ getAgentName(step.agent) }}
                </div>
              </div>
              <div v-if="getDoneSteps(selectedJobId).length === 0"
                   class="py-8 text-center text-xs text-muted">
                暂无数步骤
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 如果没有选择工作，显示提示 -->
      <div v-else-if="activeJobs.length > 0" class="flex flex-col items-center justify-center py-24 text-muted">
        <div class="text-5xl mb-3">📋</div>
        <div class="text-base font-medium">选择上方正在执行的工作查看进度</div>
      </div>

      <!-- 如果没有正在执行的工作，显示其他工作 -->
      <div v-else>
        <h3 class="text-sm font-semibold text-secondary mb-3">其他工作</h3>
        <div v-if="otherJobs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-for="job in otherJobs" :key="job.id"
               class="bg-surface rounded-xl border border-border-subtle p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="font-semibold text-primary text-sm">{{ job.title }}</div>
                <p class="text-xs text-muted mt-1">{{ job.description }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 mb-4">
              <span :class="['text-xs px-2 py-0.5 rounded-md font-medium',
                            job.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600']">
                {{ job.status === 'done' ? '已完成' : '未开始' }}
              </span>
            </div>
            <button @click="startWorkflow(job.id)"
                    class="w-full py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors">
              ▶ 启动
            </button>
          </div>
        </div>
        <div v-else class="flex flex-col items-center justify-center py-24 text-muted">
          <div class="text-5xl mb-3">📋</div>
          <div class="text-base font-medium">暂无数工作</div>
          <div class="text-sm mt-1">在「工作」tab中创建工作</div>
        </div>
      </div>
    </div>
  </div>
</template>
