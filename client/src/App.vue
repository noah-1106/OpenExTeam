<script setup>
import { ref, onMounted, watch } from 'vue'
import Board from './views/Board.vue'
import JobView from './views/JobView.vue'
import Settings from './views/Settings.vue'
import DocsView from './views/DocsView.vue'
import Monitor from './views/Monitor.vue'
import Chat from './views/Chat.vue'
import ExcardView from './views/ExcardView.vue'
import { useBoardStore } from './stores/board'
import { useChatStore } from './stores/chat'

const boardStore = useBoardStore()
const chatStore = useChatStore()
const activeTab = ref('chat')

const tabs = [
  { id: 'chat',    label: '聊天' },
  { id: 'board',   label: '看板' },
  { id: 'job',     label: '工作' },
  { id: 'excard',  label: 'ExCard' },
  { id: 'monitor', label: '监控' },
  { id: 'settings',label: '设置' },
  { id: 'docs',    label: '文档' },
]

onMounted(async () => {
  await boardStore.fetchAll()
  // 同步 agents 到 ChatStore
  chatStore.initSessions(boardStore.agents)
})

// 当 agents 列表更新时，同步到 ChatStore
watch(() => boardStore.agents, (newAgents) => {
  if (newAgents.length > 0) {
    chatStore.initSessions(newAgents)
  }
})

function onTaskUpdate(taskId, newStatus) {
  boardStore.updateTaskStatus(taskId, newStatus)
}

function onTaskCreate(newTask) {
  boardStore.createTask(newTask)
}

function onJobCreate(newJob) {
  boardStore.createJob(newJob)
}

function onJobStart(jobId) {
  boardStore.startWorkflow(jobId)
}

function onJobDelete(jobId) {
  boardStore.deleteJob(jobId)
}

function onJobUpdate(jobData) {
  boardStore.updateJob(jobData.id, jobData)
}

function onAddTask(payload) {
  boardStore.createTask(payload)
}

function onDeleteTask(taskId) {
  boardStore.deleteTask(taskId)
}

function onNavigate(tab) {
  activeTab.value = tab.id
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header class="bg-surface border-b border-border px-6 py-3 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-6">
          <h1 class="text-lg font-semibold text-primary">OpenExTeam</h1>
          <nav class="flex gap-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="onNavigate(tab)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-accent-dim text-accent font-semibold'
                  : 'text-secondary hover:text-primary hover:bg-surface'
              ]"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-secondary">Phase 1</span>
          <div class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white text-sm font-bold shadow-xs">
            O
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto p-6 bg-bg">
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
  </div>
</template>
