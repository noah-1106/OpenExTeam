<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '../api/client.js'
import { createSSEConnection } from '../api/sse.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
})

const emit = defineEmits(['update-task', 'create-task', 'start-job'])
const { toast } = useToast()

const jobSteps = ref({})
const selectedJobId = ref(null)
let sseHandle = null

const activeJobs = computed(() => {
  const active = props.jobs.filter(job => job.status === 'in-progress' || job.status === 'idle')
  return active.sort((a, b) => {
    if (a.status === 'in-progress' && b.status !== 'in-progress') return -1
    if (a.status !== 'in-progress' && b.status === 'in-progress') return 1
    return 0
  })
})

async function loadJobSteps(jobId) {
  try {
    const data = await api.getJobSteps(jobId)
    jobSteps.value[jobId] = data.steps || []
  } catch {
    jobSteps.value[jobId] = []
  }
}

function getStepsForJob(jobId) {
  return jobSteps.value[jobId] || []
}

function getProgress(jobId) {
  const steps = getStepsForJob(jobId)
  if (!steps.length) return 0
  const done = steps.filter(s => s.status === 'completed' || s.status === 'done').length
  return Math.round((done / steps.length) * 100)
}

function getAgentName(agentId) {
  if (!agentId) return '未指定'
  const agent = props.agents.find(a => a.id === agentId || a.id.endsWith(agentId))
  return agent ? agent.name : agentId
}

function selectJob(jobId) {
  selectedJobId.value = jobId
  if (!jobSteps.value[jobId]) loadJobSteps(jobId)
}

async function retryStep(jobId, stepId) {
  try {
    const result = await api.retryStep(jobId, stepId)
    if (result.success) {
      toast.success('步骤已重新执行')
      setTimeout(() => loadJobSteps(jobId), 300)
    } else {
      toast.error(result.error || '重试失败')
    }
  } catch (err) {
    toast.error(`重试失败：${err.message}`)
  }
}

async function cancelJob(jobId) {
  try {
    await api.updateJob(jobId, { status: 'idle' })
    toast.success('工作已停止')
    setTimeout(() => loadJobSteps(jobId), 300)
  } catch (err) {
    toast.error(`停止失败：${err.message}`)
  }
}

async function restartJob(jobId) {
  try {
    const data = await api.getJobSteps(jobId)
    const steps = data.steps || []
    for (const step of steps) {
      await api.updateJobStep(step.id, { status: 'pending' })
    }
    await api.updateJob(jobId, { status: 'idle' })
    emit('start-job', jobId)
    toast.success('工作已重新启动')
  } catch (err) {
    toast.error(`重新执行失败：${err.message}`)
  }
}

function stepStatusClass(status) {
  switch (status) {
    case 'pending': case 'todo': return 'pending'
    case 'in-progress': return 'running'
    case 'completed': case 'done': return 'done'
    case 'error': return 'error'
    default: return 'pending'
  }
}

function stepStatusLabel(status) {
  switch (status) {
    case 'pending': case 'todo': return '待执行'
    case 'in-progress': return '执行中'
    case 'completed': case 'done': return '已完成'
    case 'error': return '失败'
    default: return status
  }
}

function connectSSE() {
  if (sseHandle) sseHandle.close()
  sseHandle = createSSEConnection({
    workflow_started: (e) => { setTimeout(() => loadJobSteps(JSON.parse(e.data).jobId), 100) },
    workflow_step_advanced: (e) => { setTimeout(() => loadJobSteps(JSON.parse(e.data).jobId), 100) },
    workflow_completed: (e) => { setTimeout(() => loadJobSteps(JSON.parse(e.data).jobId), 100) },
    workflow_error: (e) => { setTimeout(() => loadJobSteps(JSON.parse(e.data).jobId), 100) },
    workflow_retry: (e) => { setTimeout(() => loadJobSteps(JSON.parse(e.data).jobId), 100) },
  })
}

onMounted(() => {
  connectSSE()
  const inProgress = props.jobs.find(j => j.status === 'in-progress')
  if (inProgress) selectJob(inProgress.id)
})

onUnmounted(() => {
  if (sseHandle) { sseHandle.close(); sseHandle = null }
})

watch(() => props.jobs, (newJobs) => {
  if (selectedJobId.value && !newJobs.find(j => j.id === selectedJobId.value)) {
    selectedJobId.value = null
  }
  newJobs.filter(j => j.status === 'in-progress').forEach(job => {
    if (!jobSteps.value[job.id]) loadJobSteps(job.id)
  })
}, { deep: true })
</script>

<template>
  <div class="h-full flex gap-0">
    <!-- 左侧：工作列表 -->
    <div class="w-[280px] flex-shrink-0 flex flex-col bg-white border-r border-[#E8E8EC]">
      <div class="px-5 py-3 border-b border-[#ECECF0]">
        <h2 class="text-[14px] font-semibold text-[#2D2D35]">执行中</h2>
        <p class="text-[12px] text-[#9CA3AF] mt-0.5">工作流进度</p>
      </div>

      <div v-if="activeJobs.length === 0" class="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
        <svg class="w-10 h-10 text-[#C5C9D3] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <div class="text-[13px] font-medium">暂无工作</div>
        <div class="text-[11px] mt-0.5">在「工作」页面创建并启动工作</div>
      </div>

      <div v-else class="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        <div
          v-for="job in activeJobs"
          :key="job.id"
          @click="selectJob(job.id)"
          :class="[
            'p-3 rounded-md cursor-pointer transition-all duration-150 border',
            selectedJobId === job.id
              ? 'bg-[#F0F1FE] border-[#C4CDF0]'
              : 'bg-white border-transparent hover:bg-[#F6F7FA] hover:border-[#E8E8EC]'
          ]"
        >
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[13px] font-semibold text-[#2D2D35] truncate">{{ job.title }}</span>
            <span :class="[
              'text-[11px] px-1.5 py-0.5 rounded font-medium',
              job.status === 'in-progress' ? 'bg-[#E0E3FA] text-[#5B6AD7]' : 'bg-[#F0F0F4] text-[#6B6B78]'
            ]">{{ job.status === 'in-progress' ? '执行中' : '待执行' }}</span>
          </div>
          <div v-if="getStepsForJob(job.id).length > 0" class="mt-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] text-[#9CA3AF]">{{ getProgress(job.id) }}%</span>
              <span class="text-[11px] text-[#9CA3AF]">{{ getStepsForJob(job.id).filter(s => s.status === 'completed' || s.status === 'done').length }}/{{ getStepsForJob(job.id).length }}</span>
            </div>
            <div class="h-1 bg-[#F0F0F4] rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" :class="job.status === 'in-progress' ? 'bg-[#5B6AD7]' : 'bg-[#C5C9D3]'" :style="{ width: getProgress(job.id) + '%' }" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：时间线 -->
    <div class="flex-1 bg-[#F6F6F8] overflow-hidden flex flex-col">
      <div v-if="!selectedJobId" class="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
        <svg class="w-10 h-10 mb-3 text-[#C5C9D3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <div class="text-[13px]">选择左侧工作查看执行流程</div>
      </div>

      <template v-else>
        <!-- 工作标题栏 -->
        <div class="px-6 py-3 bg-white border-b border-[#ECECF0] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 class="text-[14px] font-bold text-[#2D2D35]">{{ (props.jobs.find(j => j.id === selectedJobId))?.title || '工作' }}</h3>
            <p class="text-[11px] text-[#9CA3AF] mt-0.5">{{ getStepsForJob(selectedJobId).length }} 个步骤 · {{ getProgress(selectedJobId) }}% 完成</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-1.5 w-28 bg-[#F0F0F4] rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-[#5B6AD7] transition-all duration-500" :style="{ width: getProgress(selectedJobId) + '%' }" />
            </div>
            <button v-if="(props.jobs.find(j => j.id === selectedJobId))?.status === 'in-progress'"
              @click="cancelJob(selectedJobId)"
              class="px-3 py-1.5 text-[12px] font-medium text-[#C97A7A] bg-[#FDF0F0] rounded hover:bg-[#F5DEDE] transition-colors"
            >停止</button>
            <button v-else-if="(props.jobs.find(j => j.id === selectedJobId))?.status === 'done'"
              @click="restartJob(selectedJobId)"
              class="px-3 py-1.5 text-[12px] font-medium text-white bg-[#5B6AD7] rounded hover:bg-[#4A58C0] transition-colors"
            >重新执行</button>
          </div>
        </div>

        <!-- 时间线 -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="getStepsForJob(selectedJobId).length === 0" class="flex items-center justify-center h-full text-[#9CA3AF] text-[13px]">
            此工作暂无步骤
          </div>

          <div v-else class="relative pl-6 max-w-[640px] mx-auto">
            <div class="absolute left-[9px] top-0 bottom-0 w-[2px] bg-[#F0F0F4]"></div>

            <div v-for="(step, idx) in getStepsForJob(selectedJobId)" :key="step.id" class="relative mb-5 last:mb-0">
              <div :class="[
                'absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 z-10',
                stepStatusClass(step.status) === 'done' ? 'bg-[#5FA88F] border-[#5FA88F] text-white' :
                stepStatusClass(step.status) === 'running' ? 'bg-[#5B6AD7] border-[#5B6AD7] text-white animate-pulse' :
                stepStatusClass(step.status) === 'error' ? 'bg-[#C97A7A] border-[#C97A7A] text-white' :
                'bg-white border-[#C5C9D3] text-[#9CA3AF]'
              ]">
                <svg v-if="stepStatusClass(step.status) === 'done'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <svg v-else-if="stepStatusClass(step.status) === 'error'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span v-else>{{ idx + 1 }}</span>
              </div>

              <div :class="[
                'rounded-md border p-3.5 transition-all duration-150',
                stepStatusClass(step.status) === 'done' ? 'bg-[#EDF7F3] border-[#B8DFCC]' :
                stepStatusClass(step.status) === 'running' ? 'bg-[#F0F1FE] border-[#C4CDF0]' :
                stepStatusClass(step.status) === 'error' ? 'bg-[#FDF0F0] border-[#F0C8C8]' :
                'bg-white border-[#E8E8EC]'
              ]">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[13px] font-semibold text-[#2D2D35]">{{ step.title }}</span>
                  <span :class="[
                    'text-[11px] px-1.5 py-0.5 rounded font-medium',
                    stepStatusClass(step.status) === 'done' ? 'bg-[#D4E8DD] text-[#4E917A]' :
                    stepStatusClass(step.status) === 'running' ? 'bg-[#E0E3FA] text-[#5B6AD7]' :
                    stepStatusClass(step.status) === 'error' ? 'bg-[#F5DEDE] text-[#C97A7A]' :
                    'bg-[#F0F0F4] text-[#6B6B78]'
                  ]">{{ stepStatusLabel(step.status) }}</span>
                  <span v-if="(step.step_type || step.stepType) === 'excard'" class="text-[11px] px-1.5 py-0.5 rounded bg-[#F5F0FA] text-[#A67EC5] font-medium">ExCard</span>
                </div>

                <div v-if="step.description" class="text-[13px] text-[#6B6B78] mb-2">{{ step.description }}</div>

                <div class="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>{{ getAgentName(step.agent) }}</span>
                </div>

                <div v-if="stepStatusClass(step.status) === 'error'" class="mt-2 pt-2 border-t border-[#F0C8C8]">
                  <button @click="retryStep(selectedJobId, step.id)" class="text-[12px] font-medium text-[#C97A7A] hover:text-[#B86565] flex items-center gap-1 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                    重试此步骤
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
