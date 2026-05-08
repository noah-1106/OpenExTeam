<script setup>
import { ref, computed } from 'vue'
import api, { BASE as API_BASE } from '../api/client'
import { useToast } from '../composables/useToast'

const { toast } = useToast()

const props = defineProps({
  jobs: { type: Array, required: true },
  tasks: { type: Array, required: true },
  agents: { type: Array, required: true },
  excards: { type: Array, default: () => [] },
})

const emit = defineEmits(['create-job', 'start-job', 'delete-job', 'add-task', 'delete-task', 'update-job'])

const showCreateModal = ref(false)
const newJob = ref({ title: '', description: '', agent: '', type: 'once', scheduleType: 'daily', scheduleDays: [1,2,3,4,5], scheduleTimes: ['09:00'] })
const newSteps = ref([])

function openCreateModal() {
  newJob.value = { title: '', description: '', agent: '', type: 'once', scheduleType: 'daily', scheduleDays: [1,2,3,4,5], scheduleTimes: ['09:00'] }
  newSteps.value = []
  showCreateModal.value = true
}

async function createJob() {
  if (!newJob.value.title.trim()) return
  const res = await api.createJob(newJob.value)
  for (let i = 0; i < newSteps.value.length; i++) {
    const step = newSteps.value[i]
    await api.createJobStep(res.id, { stepOrder: i, stepType: step.type, title: step.title, description: step.description, agent: step.agent, excardId: step.excardId })
  }
  emit('create-job', { ...newJob.value, id: res.id })
  showCreateModal.value = false
}

function addStep(type) { newSteps.value.push({ type, title: '', description: '', agent: '', excardId: '' }) }
function removeStep(index) { newSteps.value.splice(index, 1) }
function moveStep(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= newSteps.value.length) return
  const temp = newSteps.value[index]
  newSteps.value[index] = newSteps.value[newIndex]
  newSteps.value[newIndex] = temp
}
function addScheduleTime() { newJob.value.scheduleTimes.push('09:00') }
function removeScheduleTime(index) { newJob.value.scheduleTimes.splice(index, 1) }

const showDetail = ref(false)
const selectedJob = ref(null)
const isEditingJob = ref(false)
const editJobData = ref({})
const editSteps = ref([])

async function openJobDetail(job) {
  selectedJob.value = job
  isEditingJob.value = false
  try {
    const data = await api.getJobSteps(job.id)
    editSteps.value = (data.steps || []).map(step => ({
      ...step, step_type: step.step_type || step.stepType, stepType: step.step_type || step.stepType,
      excard_id: step.excard_id || step.excardId || '', excardId: step.excard_id || step.excardId || ''
    }))
  } catch { editSteps.value = [] }
  showDetail.value = true
}

function closeDetail() { showDetail.value = false; selectedJob.value = null; isEditingJob.value = false }
function startEditJob() {
  editJobData.value = { ...selectedJob.value, scheduleDays: selectedJob.value.scheduleDays || [1,2,3,4,5], scheduleTimes: selectedJob.value.scheduleTimes || ['09:00'] }
  isEditingJob.value = true
}

async function saveEditJob() {
  for (const step of editSteps.value) {
    step.excardId = step.excard_id; step.stepType = step.step_type
    if (step.id) {
      await api.updateJobStep(step.id, { title: step.title, description: step.description, agent: step.agent, stepType: step.step_type, excardId: step.excard_id })
    } else {
      await api.createJobStep(selectedJob.value.id, { title: step.title, description: step.description, agent: step.agent, stepType: step.step_type, excardId: step.excard_id, stepOrder: editSteps.value.indexOf(step) })
    }
  }
  await emit('update-job', { ...editJobData.value, id: selectedJob.value.id })
  try {
    const data = await api.getJobSteps(selectedJob.value.id)
    editSteps.value = (data.steps || []).map(step => ({ ...step, step_type: step.step_type || step.stepType, stepType: step.step_type || step.stepType, excard_id: step.excard_id || step.excardId || '', excardId: step.excard_id || step.excardId || '' }))
  } catch { editSteps.value = [] }
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

function addEditStep(type) { editSteps.value.push({ step_type: type, stepType: type, title: '', description: '', agent: '', excard_id: '', excardId: '', status: 'pending' }) }
function removeEditStep(index) {
  const step = editSteps.value[index]
  if (step.id && confirm('确定删除这个步骤？')) { api.deleteJobStep(step.id).catch(() => {}) }
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
  if (!editJobData.value.scheduleTimes) editJobData.value.scheduleTimes = []
  editJobData.value.scheduleTimes.push('09:00')
}
function removeEditScheduleTime(index) { editJobData.value.scheduleTimes.splice(index, 1) }

async function startWorkflow(job) {
  if (job.status === 'done') {
    const action = confirm(`工作「${job.title}」已完成。\n\n点击「确定」重新执行，点击「取消」创建为新工作。`)
    if (action) {
      try {
        const data = await api.getJobSteps(job.id)
        const steps = data.steps || []
        for (const step of steps) { await api.updateJobStep(step.id, { status: 'pending' }) }
        await emit('update-job', { id: job.id, status: 'idle' })
        emit('start-job', job.id)
      } catch { toast.error('重新执行失败，请刷新重试') }
    } else {
      try {
        const data = await api.getJobSteps(job.id)
        const steps = data.steps || []
        const newJobRes = await api.createJob({ title: job.title + ' (副本)', description: job.description || '', type: job.type || 'once', status: 'idle' })
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]
          await api.createJobStep(newJobRes.id, { stepOrder: i, stepType: step.step_type || step.stepType, title: step.title, description: step.description, agent: step.agent, excardId: step.excard_id || step.excardId })
        }
        emit('create-job', { ...job, id: newJobRes.id, title: job.title + ' (副本)' })
        toast.success('已创建为新工作')
      } catch { toast.error('创建新工作失败，请重试') }
    }
  } else {
    emit('start-job', job.id)
  }
}

async function cancelJob(job) {
  if (!confirm(`确定停止工作「${job.title}」？`)) return
  try {
    await api.updateJob(job.id, { status: 'idle' })
    emit('update-job', { id: job.id, status: 'idle' })
    toast.success('工作已停止')
  } catch (err) { toast.error(`停止失败：${err.message}`) }
}

function tasksForJob(jobId) { return props.tasks.filter(t => t.job_id === jobId || t.jobId === jobId) }
function doneCount(jobId) { return tasksForJob(jobId).filter(t => t.status === 'done').length }
function totalCount(jobId) { return tasksForJob(jobId).length }
function progress(jobId) { const total = totalCount(jobId); return total ? Math.round((doneCount(jobId) / total) * 100) : 0 }
function getStatusLabel(status) { return status === 'done' ? '已完成' : status === 'in-progress' ? '进行中' : '未开始' }
function getStatusStyle(status) { return status === 'done' ? 'bg-[#EDF7F3] text-[#4E917A] border border-[#B8DFCC]' : status === 'in-progress' ? 'bg-[#F0F1FE] text-[#5B6AD7] border border-[#C4CDF0]' : 'bg-[#F6F7FA] text-[#6B6B78] border border-[#E8E8EC]' }
function getJobExcardName(excardId) { if (!excardId) return '—'; const ec = props.excards.find(e => e.id === excardId); return ec ? ec.name : excardId }
function getStepTypeLabel(type) { return type === 'excard' ? 'ExCard' : '任务' }
function getStepStatusStyle(status) { return status === 'completed' ? 'bg-[#EDF7F3] text-[#4E917A] border border-[#B8DFCC]' : status === 'in-progress' ? 'bg-[#F0F1FE] text-[#5B6AD7] border border-[#C4CDF0]' : 'bg-[#F6F7FA] text-[#6B6B78] border border-[#E8E8EC]' }
function getDayLabel(day) { return ['周日','周一','周二','周三','周四','周五','周六'][day] }
const agentAvatars = { '品品': '👩‍💼', '开开': '👨‍💻', '前前': '👨‍🎨', '维维': '👨‍🔧', '测测': '🧪' }
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-white border-b border-[#ECECF0] flex items-center justify-between flex-shrink-0">
      <div>
        <h2 class="text-[15px] font-semibold text-[#2D2D35]">工作</h2>
        <p class="text-[12px] text-[#9CA3AF] mt-0.5">{{ jobs.length }} 个工作</p>
      </div>
      <button @click="openCreateModal" class="px-4 py-2 bg-[#5B6AD7] text-white rounded-md text-[13px] font-medium hover:bg-[#4A58C0] transition-colors flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        新建工作
      </button>
    </div>

    <!-- Job Cards -->
    <div class="flex-1 overflow-y-auto p-6">
      <div v-if="jobs.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="job in jobs" :key="job.id" class="bg-white rounded-md border border-[#E8E8EC] p-5 hover:border-[#C5C9D3] transition-colors">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">{{ job.agent ? (agentAvatars[job.agent] || '👤') : '📋' }}</span>
              <div>
                <div class="font-semibold text-[#2D2D35] text-[13px]">{{ job.title }}</div>
                <div class="text-[11px] text-[#9CA3AF]">{{ job.agent || '多 Agent 协作' }}</div>
              </div>
            </div>
            <span :class="['text-[11px] px-2 py-0.5 rounded font-medium', job.type === 'recurring' ? 'bg-[#E0E3FA] text-[#5B6AD7]' : 'bg-[#F0F0F4] text-[#6B6B78]']">
              {{ job.type === 'recurring' ? '周期性' : '一次性' }}
            </span>
          </div>

          <p class="text-[13px] text-[#6B6B78] mb-3 line-clamp-2 leading-relaxed">{{ job.description }}</p>

          <div class="flex items-center gap-2 mb-3 flex-wrap">
            <span v-if="job.excard" class="text-[11px] px-2 py-0.5 rounded bg-[#F5F0FA] text-[#A67EC5] font-medium">{{ getJobExcardName(job.excard) }}</span>
            <span :class="['text-[11px] px-2 py-0.5 rounded font-medium', getStatusStyle(job.status)]">{{ getStatusLabel(job.status) }}</span>
          </div>

          <div class="border-t border-[#ECECF0] pt-3">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] text-[#9CA3AF]">{{ doneCount(job.id) }}/{{ totalCount(job.id) }} 任务</span>
              <span class="text-[11px] font-semibold text-[#2D2D35]">{{ progress(job.id) }}%</span>
            </div>
            <div class="h-1.5 bg-[#F0F0F4] rounded-full overflow-hidden">
              <div :class="['h-full rounded-full transition-all duration-300', job.status === 'done' ? 'bg-[#5FA88F]' : job.status === 'in-progress' ? 'bg-[#5B6AD7]' : 'bg-[#C5C9D3]']" :style="{ width: progress(job.id) + '%' }" />
            </div>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button @click="openJobDetail(job)" class="flex-1 py-1.5 border border-[#E8E8EC] text-[#6B6B78] rounded text-[12px] hover:bg-[#F6F7FA] transition-colors">详情</button>
            <button v-if="job.status === 'idle'" @click="startWorkflow(job)" class="flex-1 py-1.5 bg-[#5B6AD7] text-white rounded text-[12px] font-medium hover:bg-[#4A58C0] transition-colors">启动</button>
            <button v-else-if="job.status === 'in-progress'" @click="cancelJob(job)" class="flex-1 py-1.5 bg-[#C97A7A] text-white rounded text-[12px] font-medium hover:bg-[#B86565] transition-colors">停止</button>
            <button v-else-if="job.status === 'done'" @click="startWorkflow(job)" class="flex-1 py-1.5 bg-[#6B6B78] text-white rounded text-[12px] font-medium hover:bg-[#5A5A68] transition-colors">重新执行</button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
        <div class="text-4xl mb-3">📋</div>
        <div class="text-[14px] font-medium">暂无工作</div>
        <div class="text-[12px] mt-1">点击「新建工作」开始</div>
      </div>
    </div>

    <!-- 新建工作弹窗 -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30" @click="showCreateModal = false" />
      <div class="relative bg-white rounded-lg shadow-lg border border-[#E8E8EC] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#ECECF0]">
          <h3 class="font-semibold text-[#2D2D35] text-[14px]">新建工作</h3>
          <button @click="showCreateModal = false" class="text-[#9CA3AF] hover:text-[#2D2D35] text-lg">&times;</button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">工作名称</label>
              <input v-model="newJob.title" type="text" placeholder="例如：每日站会摘要" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">描述</label>
              <textarea v-model="newJob.description" rows="2" placeholder="简要描述工作内容..." class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] bg-white" />
            </div>
            <div>
              <label class="block text-[13px] font-medium text-[#2D2D35] mb-1">类型</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="radio" v-model="newJob.type" value="once" class="accent-[#5B6AD7]" /> 一次性
                </label>
                <label class="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="radio" v-model="newJob.type" value="recurring" class="accent-[#5B6AD7]" /> 周期性
                </label>
              </div>
            </div>
          </div>

          <div v-if="newJob.type === 'recurring'" class="border-t border-[#ECECF0] pt-4">
            <h4 class="text-[13px] font-medium text-[#2D2D35] mb-3">周期设置</h4>
            <div class="space-y-4">
              <div>
                <label class="block text-[12px] font-medium text-[#2D2D35] mb-1">重复类型</label>
                <select v-model="newJob.scheduleType" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white">
                  <option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option>
                </select>
              </div>
              <div v-if="newJob.scheduleType === 'weekly'">
                <label class="block text-[12px] font-medium text-[#2D2D35] mb-1">选择星期</label>
                <div class="flex flex-wrap gap-2">
                  <label v-for="day in [1,2,3,4,5,6,0]" :key="day" :class="['flex items-center gap-1 text-[12px] cursor-pointer px-2.5 py-1 rounded border transition-colors', newJob.scheduleDays.includes(day) ? 'bg-[#5B6AD7] text-white border-[#5B6AD7]' : 'bg-white border-[#E8E8EC] hover:border-[#C5C9D3]']">
                    <input type="checkbox" :value="day" v-model="newJob.scheduleDays" class="hidden" />{{ getDayLabel(day) }}
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-[12px] font-medium text-[#2D2D35] mb-1">执行时间</label>
                <div v-for="(time, idx) in newJob.scheduleTimes" :key="idx" class="flex gap-2 mb-2">
                  <input v-model="newJob.scheduleTimes[idx]" type="time" class="flex-1 px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white" />
                  <button v-if="newJob.scheduleTimes.length > 1" @click="removeScheduleTime(idx)" class="px-3 py-2 text-[#C97A7A] hover:bg-[#FDF0F0] rounded-md text-[13px]">删除</button>
                </div>
                <button @click="addScheduleTime" class="text-[12px] text-[#5B6AD7] hover:underline">+ 添加时间</button>
              </div>
            </div>
          </div>

          <div class="border-t border-[#ECECF0] pt-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-[13px] font-medium text-[#2D2D35]">步骤编排</h4>
              <div class="flex gap-2">
                <button @click="addStep('task')" class="text-[11px] px-2.5 py-1 bg-[#F0F1FE] text-[#5B6AD7] rounded hover:bg-[#E0E3FA] transition-colors">+ 添加任务</button>
                <button @click="addStep('excard')" class="text-[11px] px-2.5 py-1 bg-[#F5F0FA] text-[#A67EC5] rounded hover:bg-[#E5D5F0] transition-colors">+ 添加 ExCard</button>
              </div>
            </div>
            <div v-if="newSteps.length === 0" class="text-[13px] text-[#9CA3AF] text-center py-8 bg-[#F6F7FA] rounded-md">暂无步骤</div>
            <div v-else class="space-y-3">
              <div v-for="(step, idx) in newSteps" :key="idx" class="bg-[#F6F7FA] rounded-md p-4 border border-[#ECECF0]">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-[#9CA3AF] font-medium">步骤 {{ idx + 1 }}</span>
                    <span :class="['text-[11px] px-2 py-0.5 rounded font-medium', step.type === 'excard' ? 'bg-[#F5F0FA] text-[#A67EC5]' : 'bg-[#F0F1FE] text-[#5B6AD7]']">{{ getStepTypeLabel(step.type) }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <button @click="moveStep(idx, -1)" :disabled="idx === 0" class="px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#2D2D35] disabled:opacity-30">&uarr;</button>
                    <button @click="moveStep(idx, 1)" :disabled="idx === newSteps.length - 1" class="px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#2D2D35] disabled:opacity-30">&darr;</button>
                    <button @click="removeStep(idx)" class="px-2 py-1 text-[11px] text-[#C97A7A] hover:bg-[#FDF0F0] rounded transition-colors">删除</button>
                  </div>
                </div>
                <div class="space-y-3">
                  <div><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">标题</label><input v-model="step.title" type="text" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white" /></div>
                  <div v-if="step.type === 'task'"><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">描述（可选）</label><textarea v-model="step.description" rows="2" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] resize-none outline-none focus:border-[#5B6AD7] bg-white" /></div>
                  <div><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">执行 Agent</label><select v-model="step.agent" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="">不指定</option><option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option></select></div>
                  <div v-if="step.type === 'excard'"><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">选择 ExCard</label><select v-model="step.excardId" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="">请选择</option><option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option></select></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-3 border-t border-[#ECECF0]">
          <button @click="showCreateModal = false" class="px-4 py-2 text-[13px] text-[#6B6B78] hover:text-[#2D2D35] transition-colors">取消</button>
          <button @click="createJob" class="px-4 py-2 bg-[#5B6AD7] text-white rounded-md text-[13px] font-medium hover:bg-[#4A58C0] transition-colors">创建</button>
        </div>
      </div>
    </div>

    <!-- 工作详情弹窗 -->
    <div v-if="showDetail && selectedJob" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/30" @click="closeDetail" />
      <div class="relative bg-white rounded-lg shadow-lg border border-[#E8E8EC] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#ECECF0] flex-shrink-0">
          <div>
            <div class="text-[11px] text-[#9CA3AF]">工作详情</div>
            <h3 class="font-semibold text-[#2D2D35] text-[14px] mt-0.5">
              <template v-if="isEditingJob"><input v-model="editJobData.title" class="px-2 py-1 border border-[#E8E8EC] rounded text-[13px] w-full outline-none focus:border-[#5B6AD7] bg-white" /></template>
              <template v-else>{{ selectedJob.title }}</template>
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="isEditingJob">
              <button @click="isEditingJob = false" class="px-3 py-1.5 text-[13px] text-[#6B6B78] hover:text-[#2D2D35]">取消</button>
              <button @click="saveEditJob" class="px-3 py-1.5 text-[13px] bg-[#5B6AD7] text-white rounded-md hover:bg-[#4A58C0]">保存</button>
            </template>
            <template v-else>
              <button @click="startEditJob" class="px-3 py-1.5 text-[13px] border border-[#E8E8EC] rounded-md hover:bg-[#F6F7FA] text-[#6B6B78]">编辑</button>
              <button @click="deleteCurrentJob" class="px-3 py-1.5 text-[13px] border border-[#F0C8C8] text-[#C97A7A] rounded-md hover:bg-[#FDF0F0]">删除</button>
            </template>
            <button @click="closeDetail" class="text-[#9CA3AF] hover:text-[#2D2D35] text-lg ml-1">&times;</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <div class="grid grid-cols-2 gap-4 text-[13px]">
            <div><div class="text-[#9CA3AF] text-[11px] mb-1">类型</div><template v-if="isEditingJob"><select v-model="editJobData.type" class="w-full px-2 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="once">一次性</option><option value="recurring">周期性</option></select></template><div v-else class="text-[#2D2D35]">{{ selectedJob.type === 'once' ? '一次性' : '周期性' }}</div></div>
            <div><div class="text-[#9CA3AF] text-[11px] mb-1">状态</div><span :class="['text-[11px] px-2 py-0.5 rounded font-medium', getStatusStyle(selectedJob.status)]">{{ getStatusLabel(selectedJob.status) }}</span></div>
          </div>

          <div v-if="isEditingJob && editJobData.type === 'recurring'" class="border-t border-[#ECECF0] pt-4">
            <h4 class="text-[13px] font-medium text-[#2D2D35] mb-3">周期设置</h4>
            <div class="space-y-4">
              <div><label class="block text-[12px] font-medium text-[#2D2D35] mb-1">重复类型</label><select v-model="editJobData.scheduleType" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></div>
              <div v-if="editJobData.scheduleType === 'weekly'"><label class="block text-[12px] font-medium text-[#2D2D35] mb-1">选择星期</label><div class="flex flex-wrap gap-2"><label v-for="day in [1,2,3,4,5,6,0]" :key="day" :class="['flex items-center gap-1 text-[12px] cursor-pointer px-2.5 py-1 rounded border transition-colors', editJobData.scheduleDays?.includes(day) ? 'bg-[#5B6AD7] text-white border-[#5B6AD7]' : 'bg-white border-[#E8E8EC] hover:border-[#C5C9D3]']"><input type="checkbox" :value="day" v-model="editJobData.scheduleDays" class="hidden" />{{ getDayLabel(day) }}</label></div></div>
              <div><label class="block text-[12px] font-medium text-[#2D2D35] mb-1">执行时间</label><div v-for="(time, idx) in editJobData.scheduleTimes" :key="idx" class="flex gap-2 mb-2"><input v-model="editJobData.scheduleTimes[idx]" type="time" class="flex-1 px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] bg-white" /><button v-if="editJobData.scheduleTimes?.length > 1" @click="removeEditScheduleTime(idx)" class="px-3 py-2 text-[#C97A7A] hover:bg-[#FDF0F0] rounded-md text-[13px]">删除</button></div><button @click="addEditScheduleTime" class="text-[12px] text-[#5B6AD7] hover:underline">+ 添加时间</button></div>
            </div>
          </div>

          <div><div class="text-[#9CA3AF] text-[11px] mb-1">描述</div><template v-if="isEditingJob"><textarea v-model="editJobData.description" rows="2" class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] resize-none outline-none focus:border-[#5B6AD7] bg-white" /></template><div v-else class="text-[13px] text-[#6B6B78]">{{ selectedJob.description || '—' }}</div></div>

          <div class="border-t border-[#ECECF0] pt-4">
            <div class="flex items-center justify-between mb-3"><div class="text-[13px] font-medium text-[#2D2D35]">步骤列表</div><template v-if="isEditingJob"><div class="flex gap-2"><button @click="addEditStep('task')" class="text-[11px] px-2.5 py-1 bg-[#F0F1FE] text-[#5B6AD7] rounded hover:bg-[#E0E3FA]">+ 添加任务</button><button @click="addEditStep('excard')" class="text-[11px] px-2.5 py-1 bg-[#F5F0FA] text-[#A67EC5] rounded hover:bg-[#E5D5F0]">+ 添加 ExCard</button></div></template></div>
            <div v-if="editSteps.length === 0" class="text-[13px] text-[#9CA3AF] text-center py-8 bg-[#F6F7FA] rounded-md">暂无步骤</div>
            <div v-else class="space-y-3">
              <div v-for="(step, idx) in editSteps" :key="step.id || idx" class="bg-[#F6F7FA] rounded-md p-4 border border-[#ECECF0]">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2"><span class="text-[11px] text-[#9CA3AF] font-medium">步骤 {{ idx + 1 }}</span><span :class="['text-[11px] px-2 py-0.5 rounded font-medium', (step.step_type || step.stepType) === 'excard' ? 'bg-[#F5F0FA] text-[#A67EC5]' : 'bg-[#F0F1FE] text-[#5B6AD7]']">{{ getStepTypeLabel(step.step_type || step.stepType) }}</span><span v-if="step.status" :class="['text-[11px] px-2 py-0.5 rounded font-medium', getStepStatusStyle(step.status)]">{{ step.status }}</span></div>
                  <template v-if="isEditingJob"><div class="flex items-center gap-1"><button @click="moveEditStep(idx, -1)" :disabled="idx === 0" class="px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#2D2D35] disabled:opacity-30">&uarr;</button><button @click="moveEditStep(idx, 1)" :disabled="idx === editSteps.length - 1" class="px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#2D2D35] disabled:opacity-30">&darr;</button><button @click="removeEditStep(idx)" class="px-2 py-1 text-[11px] text-[#C97A7A] hover:bg-[#FDF0F0] rounded transition-colors">删除</button></div></template>
                </div>
                <template v-if="isEditingJob">
                  <div class="space-y-3"><div><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">标题</label><input v-model="step.title" type="text" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white" /></div><div v-if="(step.step_type || step.stepType) === 'task'"><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">描述</label><textarea v-model="step.description" rows="2" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] resize-none outline-none focus:border-[#5B6AD7] bg-white" /></div><div><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">执行 Agent</label><select v-model="step.agent" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="">不指定</option><option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option></select></div><div v-if="(step.step_type || step.stepType) === 'excard'"><label class="block text-[11px] font-medium text-[#2D2D35] mb-1">选择 ExCard</label><select v-model="step.excard_id" class="w-full px-2.5 py-1.5 border border-[#E8E8EC] rounded text-[13px] outline-none focus:border-[#5B6AD7] bg-white"><option value="">请选择</option><option v-for="ec in excards" :key="ec.id" :value="ec.id">{{ ec.name }}</option></select></div></div>
                </template>
                <template v-else>
                  <div class="text-[13px] text-[#2D2D35] font-medium">{{ step.title }}</div>
                  <div v-if="step.description" class="text-[11px] text-[#9CA3AF] mt-1">{{ step.description }}</div>
                  <div v-if="step.agent" class="text-[11px] text-[#5B6AD7] mt-1">{{ step.agent }}</div>
                </template>
              </div>
            </div>
          </div>

          <div class="border-t border-[#ECECF0] pt-4" v-if="tasksForJob(selectedJob.id).length > 0">
            <div class="text-[13px] font-medium text-[#2D2D35] mb-3">任务列表（旧版）</div>
            <div class="space-y-1.5">
              <div v-for="task in tasksForJob(selectedJob.id)" :key="task.id" class="flex items-center justify-between bg-[#F6F7FA] rounded-md px-3 py-2">
                <div class="flex items-center gap-2"><span :class="['w-2 h-2 rounded-full flex-shrink-0', task.status === 'done' ? 'bg-[#5FA88F]' : task.status === 'in-progress' ? 'bg-[#5B6AD7]' : 'bg-[#C5C9D3]']" /><span class="text-[13px] text-[#2D2D35]">{{ task.title }}</span></div>
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
