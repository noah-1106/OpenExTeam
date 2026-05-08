<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Board from './views/Board.vue'
import JobView from './views/JobView.vue'
import Settings from './views/Settings.vue'
import DocsView from './views/DocsView.vue'
import Monitor from './views/Monitor.vue'
import Chat from './views/Chat.vue'
import ExcardView from './views/ExcardView.vue'
import Toast from './components/Toast.vue'
import { useBoardStore } from './stores/board'
import { useChatStore } from './stores/chat'
import api from './api/client'

const boardStore = useBoardStore()
const chatStore = useChatStore()
const activeTab = ref('chat')
const brandingTitle = ref('ExFlower')

// 连接状态
const connectedAdapters = ref([])
const allDisconnected = computed(() => connectedAdapters.value.length === 0)
let healthTimer = null

async function checkHealth() {
  try {
    const h = await api.health()
    connectedAdapters.value = h.adapters || []
    const b = await api.getBranding()
    if (b.title && b.title !== brandingTitle.value) {
      brandingTitle.value = b.title
      document.title = b.title
    }
  } catch {
    connectedAdapters.value = []
  }
}

const tabs = [
  { id: 'chat',    label: '聊天',    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'board',   label: '看板',    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
  { id: 'job',     label: '工作',    icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'excard',  label: 'ExCard',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'monitor', label: '监控',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'settings',label: '设置',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'docs',    label: '文档',    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
]

onMounted(async () => {
  try {
    const b = await api.getBranding()
    if (b.title) {
      brandingTitle.value = b.title
      document.title = b.title
    }
  } catch {}
  await boardStore.fetchAll()
  chatStore.initSessions(boardStore.agents)
  await checkHealth()
  healthTimer = setInterval(checkHealth, 10000)
})

onUnmounted(() => {
  if (healthTimer) clearInterval(healthTimer)
})

watch(() => boardStore.agents, (newAgents) => {
  if (newAgents.length > 0) {
    chatStore.initSessions(newAgents)
  }
})

function onTaskUpdate(taskId, newStatus) { boardStore.updateTaskStatus(taskId, newStatus) }
function onTaskCreate(newTask) { boardStore.createTask(newTask) }
function onJobCreate(newJob) { boardStore.createJob(newJob) }
function onJobStart(jobId) { boardStore.startWorkflow(jobId) }
function onJobDelete(jobId) { boardStore.deleteJob(jobId) }
function onJobUpdate(jobData) { boardStore.updateJob(jobData.id, jobData) }
function onAddTask(payload) { boardStore.createTask(payload) }
function onDeleteTask(taskId) { boardStore.deleteTask(taskId) }
function onNavigate(tab) { activeTab.value = tab.id }
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <Toast />
    <!-- Sidebar -->
    <aside class="w-[220px] flex-shrink-0 bg-white border-r border-[#E8E8EC] flex flex-col">
      <!-- Logo -->
      <div class="h-14 flex items-center px-5 border-b border-[#ECECF0]">
        <div class="w-7 h-7 rounded-md bg-[#5B6AD7] flex items-center justify-center text-white text-sm font-bold mr-2.5">
          {{ brandingTitle.charAt(0) }}
        </div>
        <span class="text-[15px] font-semibold text-[#2D2D35]">{{ brandingTitle }}</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 py-3 px-3 space-y-0.5">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="onNavigate(tab)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-[#F0F1FE] text-[#5B6AD7]'
              : 'text-[#6B6B78] hover:bg-[#F6F7FA] hover:text-[#2D2D35]'
          ]"
        >
          <svg class="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="tab.icon" />
          </svg>
          {{ tab.label }}
        </button>
      </nav>

      <!-- Bottom: Connection Status -->
      <div class="px-4 py-3 border-t border-[#ECECF0]">
        <div v-if="allDisconnected" class="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
          <span class="w-2 h-2 rounded-full bg-[#C97A7A]"></span>
          未连接
        </div>
        <div v-else class="space-y-1.5">
          <div v-for="name in connectedAdapters" :key="name" class="flex items-center gap-2 text-[12px] text-[#6B6B78]">
            <span class="w-2 h-2 rounded-full bg-[#5FA88F]"></span>
            <span class="truncate">{{ name }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 overflow-hidden bg-[#F6F6F8]">
      <Board
        v-if="activeTab === 'board'"
        :jobs="boardStore.jobs"
        :tasks="boardStore.tasks"
        :agents="boardStore.agents"
        @update-task="onTaskUpdate"
        @create-task="onTaskCreate"
        @start-job="onJobStart"
      />
      <Chat
        v-if="activeTab === 'chat'"
        :agents="boardStore.agents"
      />
      <JobView
        v-if="activeTab === 'job'"
        :jobs="boardStore.jobs"
        :tasks="boardStore.tasks"
        :agents="boardStore.agents"
        :excards="boardStore.excards"
        @create-job="onJobCreate"
        @start-job="onJobStart"
        @delete-job="onJobDelete"
        @update-job="onJobUpdate"
        @add-task="onAddTask"
        @delete-task="onDeleteTask"
      />
      <ExcardView v-if="activeTab === 'excard'" />
      <Monitor v-if="activeTab === 'monitor'" :agents="boardStore.agents" />
      <Settings v-if="activeTab === 'settings'" />
      <DocsView v-if="activeTab === 'docs'" />
    </main>
  </div>
</template>
