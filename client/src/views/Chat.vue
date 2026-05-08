<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { useToast } from '../composables/useToast'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/board'
import api from '../api/client'
import ExcardProposalModal from '../components/ExcardProposalModal.vue'
import PickerModal from '../components/PickerModal.vue'

const props = defineProps({
  agents: { type: Array, required: true },
})

const chatStore = useChatStore()
const boardStore = useBoardStore()
const { toast } = useToast()
const typing = ref(false)
const inputText = ref('')
const chatContainer = ref(null)

// ExCard 提议相关
const showProposalModal = ref(false)
const proposalAgentId = ref('')
const proposalText = ref('')
const isModifyMode = ref(false)
const targetExcardId = ref('')
const processedMessages = ref(new Set())

// /jobrun 和 /ecrun 选择器
const showJobPicker = ref(false)
const showExcardPicker = ref(false)
const jobPickerItems = computed(() =>
  boardStore.jobs.map(j => ({ id: j.id, name: j.title, description: j.description }))
)
const excardPickerItems = computed(() =>
  boardStore.excards.map(e => ({ id: e.id, name: e.name, description: e.description }))
)

function checkForExcardProposal(msg) {
  if (msg.sender === 'user') return false
  const text = msg.text || ''
  if (text.includes('[EXCARD_PROPOSAL]') || text.includes('# EXCARD_PROPOSAL')) return true
  return false
}

function getMessageId(msg) {
  return `${msg.sender}-${msg.text}-${msg.time}`
}

function onProposalModalClose() {
  showProposalModal.value = false
}

function showProposal(msg) {
  const msgId = getMessageId(msg)
  if (processedMessages.value.has(msgId)) return
  if (activeSession.value?.type === 'p2p') {
    proposalAgentId.value = activeSession.value.agentId
  } else if (msg.agentId) {
    proposalAgentId.value = msg.agentId
  }
  proposalText.value = msg.text
  showProposalModal.value = true
  processedMessages.value.add(msgId)
}

async function handleCreateExcard(data) {
  try {
    if (isModifyMode.value && targetExcardId.value) {
      await api.updateExcard(targetExcardId.value, {
        name: data.name,
        description: data.description,
        agent: data.agent,
      })
      await api.updateExcardMd(targetExcardId.value, data.markdown)
      isModifyMode.value = false
      targetExcardId.value = ''
      await boardStore.fetchAll()
      toast.success('ExCard 更新成功')
    } else {
      await api.createExcard({ id: data.id, name: data.name, description: data.description, agent: data.agent })
      await api.updateExcardMd(data.id, data.markdown)
      await boardStore.fetchAll()
      toast.success('ExCard 创建成功')
    }
  } catch (err) {
    toast.error('处理 ExCard 失败：' + err.message)
  }
}

const activeSession = computed(() => chatStore.activeSession())

function renderMarkdown(text) {
  if (!text) return ''
  const raw = marked(text, { breaks: true, gfm: true })
  return DOMPurify.sanitize(raw)
}

const isSessionConnected = computed(() => {
  const sess = activeSession.value
  if (!sess) return false
  if (sess.type === 'p2p') {
    const agentId = sess.agentId.includes(':') ? sess.agentId.split(':').pop() : sess.agentId
    const agent = props.agents.find(a => a.id === agentId || a.id === sess.agentId)
    return agent?.connected || false
  } else if (sess.type === 'group') {
    return sess.agentIds.some(agId => {
      const pureId = agId.includes(':') ? agId.split(':').pop() : agId
      const agent = props.agents.find(a => a.id === pureId || a.id === agId)
      return agent?.connected || false
    })
  }
  return false
})

function selectSession(id) {
  chatStore.selectSession(id)
  scrollToBottom()
}

function getMsgAvatarInfo(msg) {
  if (msg.sender === 'user') return { avatarUrl: null, isUser: true }
  if (activeSession.value?.type === 'group' && msg.agentId) {
    const agent = props.agents.find(a => a.id === msg.agentId)
    return { avatarUrl: agent?.avatarUrl || null, isUser: false }
  }
  return { avatarUrl: activeSession.value?.avatarUrl || null, isUser: false }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

async function sendMessage() {
  let text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  typing.value = true

  try {
    if (text.startsWith('/jobrun')) {
      if (jobPickerItems.value.length === 0) { toast.info('暂无可运行的工作'); return }
      showJobPicker.value = true
    } else if (text.startsWith('/ecrun')) {
      if (excardPickerItems.value.length === 0) { toast.info('暂无可执行的 ExCard'); return }
      showExcardPicker.value = true
    } else if (text.startsWith('/ec-modify')) {
      const parts = text.split(' ')
      const cardId = parts[1] || ''
      const userDemand = parts.slice(2).join(' ').trim()
      if (!cardId) { toast.info('请指定 ExCard ID，如 /ec-modify ec-abc 增加步骤'); return }
      let existingContent = ''
      try { const mdData = await api.getExcardMd(cardId); existingContent = mdData.markdown || '' } catch {}
      isModifyMode.value = true
      targetExcardId.value = cardId
      const actualMessage = `请帮我修改 ExCard [${cardId}]，修改需求：${userDemand}\n\n现有内容：\n${existingContent || '（无法获取）'}\n\n请输出修改后的完整 ExCard，严格遵循格式：\n[EXCARD_PROPOSAL]\nname: ...\ndescription: ...\nagent: ${activeSession.value?.agentId || ''}\nmarkdown:\n# EC-XXX\n...`
      await chatStore.sendMessage(text, { userVisibleText: text, actualMessage })
    } else if (text.startsWith('/ec')) {
      const userDemand = text.replace(/^\/ec\s*/, '').trim()
      isModifyMode.value = false
      targetExcardId.value = ''
      const actualMessage = `请帮我创建一个 ExCard，主题是：${userDemand}\n\n[EXCARD_PROPOSAL]\nname: EC-XXX\ndescription: ...\nagent: ${activeSession.value?.agentId || ''}\nmarkdown:\n# EC-XXX\n...\n必须包含 Resource Dependencies / Execution Workflow / Execution Conventions 三个核心 Section。`
      await chatStore.sendMessage(text, { userVisibleText: text, actualMessage })
    } else {
      await chatStore.sendMessage(text)
    }
  } catch (err) {
    console.error('发送消息失败:', err)
  } finally {
    typing.value = false
  }
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

async function onJobRunSelect(item) {
  showJobPicker.value = false
  try {
    await boardStore.startWorkflow(item.id)
    toast.success(`工作「${item.name}」已启动`)
  } catch (err) {
    toast.error(`启动失败：${err.message}`)
  }
}

async function onExcardRunSelect(item) {
  showExcardPicker.value = false
  try {
    const data = await api.getExcardMd(item.id)
    const actualMessage = `请按照以下 ExCard 执行：\n\n${data.markdown || ''}`
    await chatStore.sendMessage(`/ecrun ${item.name}`, { userVisibleText: `/ecrun ${item.name}`, actualMessage })
  } catch (err) {
    toast.error(`执行失败：${err.message}`)
  }
}

watch(() => chatStore.currentSessionId, () => { scrollToBottom() })

watch(() => activeSession.value?.messages, (newMessages, oldMessages) => {
  if (!newMessages || newMessages.length === 0) return
  const oldLen = oldMessages?.length || 0
  const newLen = newMessages.length
  for (let i = oldLen; i < newLen; i++) {
    const msg = newMessages[i]
    if (checkForExcardProposal(msg)) showProposal(msg)
  }
  for (let i = 0; i < newMessages.length; i++) {
    const msg = newMessages[i]
    const msgId = getMessageId(msg)
    if (msg.sender !== 'user' && !processedMessages.value.has(msgId) && checkForExcardProposal(msg)) {
      showProposal(msg)
    }
  }
}, { deep: true })

watch(() => activeSession.value?.messages?.length, () => { scrollToBottom() })

function getStatusColor(agent) {
  const colors = { online: 'bg-green-400', busy: 'bg-yellow-400', offline: 'bg-gray-300' }
  return colors[agent?.status] || 'bg-gray-300'
}

function getSessionLastText(sess) {
  const msgs = sess.messages
  if (!msgs || msgs.length === 0) return ''
  const last = msgs[msgs.length - 1]
  return last.text || ''
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 会话列表 -->
    <div class="w-[240px] bg-white border-r border-[#E8E8EC] flex flex-col flex-shrink-0">
      <div class="px-4 py-3 border-b border-[#ECECF0]">
        <h2 class="text-[13px] font-medium text-[#9CA3AF] uppercase tracking-wide">会话</h2>
      </div>
      <div class="flex-1 overflow-y-auto py-2">
        <!-- 系统通知 -->
        <div class="px-2 mb-1">
          <div
            v-for="sess in chatStore.sessions.filter(s => s.type === 'system')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors mb-0.5',
              chatStore.activeSessionId === sess.id ? 'bg-[#F0F1FE]' : 'hover:bg-[#F6F7FA]'
            ]"
          >
            <div class="w-8 h-8 rounded-md bg-[#FDF3DC] flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-[#A87D4A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-[13px] font-medium truncate', chatStore.activeSessionId === sess.id ? 'text-[#5B6AD7]' : 'text-[#2D2D35]']">
                  {{ sess.name }}
                </span>
                <span v-if="sess.unreadCount" class="px-1.5 py-0 text-[10px] bg-[#C97A7A] text-white rounded-full leading-none flex-shrink-0">{{ sess.unreadCount > 99 ? '99+' : sess.unreadCount }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- 单聊 -->
        <div class="px-2">
          <div class="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wide px-2.5 py-1.5">Agent</div>
          <div v-if="chatStore.sortedP2pSessions.length === 0" class="px-2.5 py-6 text-center">
            <p class="text-[13px] text-[#9CA3AF]">暂无 Agent 在线</p>
            <p class="text-[11px] text-[#B5B8C0] mt-1">请在设置中配置 Adapter</p>
          </div>
          <div
            v-for="sess in chatStore.sortedP2pSessions"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors mb-0.5',
              chatStore.activeSessionId === sess.id ? 'bg-[#F0F1FE]' : 'hover:bg-[#F6F7FA]'
            ]"
          >
            <div class="relative flex-shrink-0">
              <div class="w-8 h-8 rounded-md bg-[#F0F0F4] flex items-center justify-center text-[13px] overflow-hidden">
                <img v-if="sess.avatarUrl" :src="sess.avatarUrl" class="w-full h-full object-cover" />
                <svg v-else class="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <span :class="['absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', getStatusColor(agents.find(a => a.id === sess.agentId) || {})]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-[13px] font-medium truncate', chatStore.activeSessionId === sess.id ? 'text-[#5B6AD7]' : 'text-[#2D2D35]']">
                  {{ sess.name }}
                  <span v-if="agents.find(a => a.id === sess.agentId)?.connected === false" class="ml-1 text-[10px] text-[#C97A7A]">离线</span>
                </span>
                <span v-if="sess.unreadCount" class="px-1.5 py-0 text-[10px] bg-[#C97A7A] text-white rounded-full leading-none flex-shrink-0">{{ sess.unreadCount > 99 ? '99+' : sess.unreadCount }}</span>
              </div>
              <p class="text-[11px] text-[#9CA3AF] truncate mt-0.5">{{ getSessionLastText(sess) || sess.adapterName }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天窗口 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <!-- 头部 -->
      <div class="h-14 px-6 border-b border-[#ECECF0] flex items-center gap-3 flex-shrink-0">
        <div class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden bg-[#F0F0F4]">
          <img v-if="activeSession?.avatarUrl" :src="activeSession.avatarUrl" class="w-full h-full object-cover" />
          <svg v-else class="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[14px] font-semibold text-[#2D2D35] truncate">
            {{ activeSession?.name }}
            <span v-if="activeSession?.type === 'p2p' && agents.find(a => a.id === activeSession?.agentId)?.connected === false" class="ml-2 text-[11px] text-[#C97A7A] font-normal">已离线</span>
          </div>
          <div class="text-[11px] text-[#9CA3AF]">
            {{ activeSession?.type === 'system' ? '系统通知' : (activeSession?.type === 'group' ? `${activeSession?.agentIds?.length || 0} 位成员` : (activeSession?.adapterName || '私聊')) }}
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto px-6 py-5">
        <div class="max-w-[720px] mx-auto space-y-5">
          <div
            v-for="(msg, idx) in activeSession?.messages"
            :key="idx"
            :class="['flex gap-3', msg.sender === 'user' ? 'flex-row-reverse' : '']"
          >
            <!-- 头像 -->
            <div class="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden self-start mt-0.5" :class="msg.sender === 'user' ? 'bg-[#5B6AD7]' : 'bg-[#F0F0F4]'">
              <svg v-if="msg.sender === 'user'" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <img v-else-if="getMsgAvatarInfo(msg).avatarUrl" :src="getMsgAvatarInfo(msg).avatarUrl" class="w-full h-full object-cover" />
              <svg v-else class="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>

            <!-- 消息内容 -->
            <div class="max-w-[85%]">
              <div
                v-if="msg.sender !== 'user'"
                class="bg-[#F6F7FA] border border-[#ECECF0] rounded-lg rounded-tl-sm px-4 py-3 text-[14px] leading-relaxed text-[#2D2D35] prose prose-sm max-w-none"
                v-html="renderMarkdown(msg.text)"
              />
              <div
                v-else
                class="bg-[#5B6AD7] rounded-lg rounded-tr-sm px-4 py-3 text-[14px] leading-relaxed text-white whitespace-pre-wrap"
              >
                {{ msg.text }}
              </div>
              <div :class="['text-[11px] text-[#B5B8C0] mt-1', msg.sender === 'user' ? 'text-right' : '']">{{ msg.time }}</div>
            </div>
          </div>

          <!-- Typing -->
          <div v-if="typing && activeSession" class="flex gap-3">
            <div class="w-7 h-7 rounded-md bg-[#F0F0F4] flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="bg-[#F6F7FA] border border-[#ECECF0] rounded-lg rounded-tl-sm px-4 py-3">
              <span class="inline-block w-1.5 h-1.5 bg-[#C5C9D3] rounded-full animate-bounce" style="animation-delay: -0.32s"/>
              <span class="inline-block w-1.5 h-1.5 bg-[#C5C9D3] rounded-full animate-bounce mx-1" style="animation-delay: -0.16s"/>
              <span class="inline-block w-1.5 h-1.5 bg-[#C5C9D3] rounded-full animate-bounce"/>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="px-6 py-4 border-t border-[#ECECF0] flex-shrink-0">
        <div v-if="activeSession?.type === 'system'" class="px-4 py-3 bg-[#F6F7FA] border border-[#E8E8EC] rounded-md text-center text-[13px] text-[#9CA3AF]">
          系统通知会话仅用于接收工作流进度更新
        </div>
        <div v-else-if="isSessionConnected" class="max-w-[720px] mx-auto flex items-end gap-2">
          <div class="flex-1 relative">
            <textarea
              v-model="inputText"
              @keydown="handleKeydown"
              rows="1"
              placeholder="输入消息，按 Enter 发送..."
              class="w-full px-4 py-3 bg-[#F6F7FA] border border-[#E8E8EC] rounded-lg text-[14px] resize-none outline-none focus:border-[#5B6AD7] focus:bg-white transition-colors leading-relaxed"
              style="min-height: 46px; max-height: 140px"
            />
            <div v-if="inputText.trim() === ''" class="absolute left-4 top-3.5 text-[12px] text-[#B5B8C0] pointer-events-none">
              <span class="text-[#5B6AD7] font-medium">/ec</span> 创建 ExCard · <span class="text-[#5B6AD7] font-medium">/ec-modify</span> 修改 · <span class="text-[#5B6AD7] font-medium">/jobrun</span> 运行工作
            </div>
          </div>
          <button
            @click="sendMessage"
            class="w-10 h-10 rounded-lg bg-[#5B6AD7] text-white flex items-center justify-center hover:bg-[#4A58C0] transition-colors flex-shrink-0"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
        <div v-else class="max-w-[720px] mx-auto px-4 py-3 bg-[#FDF0F0] border border-[#F0C8C8] rounded-md text-center text-[13px] text-[#C97A7A]">
          {{ activeSession?.type === 'p2p' ? 'Agent 已离线' : '所有 Agent 都已离线' }}，无法发送消息
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ExcardProposalModal
      :show="showProposalModal"
      :agent-id="proposalAgentId"
      :raw-text="proposalText"
      :is-modify-mode="isModifyMode"
      :target-excard-id="targetExcardId"
      @close="onProposalModalClose"
      @create="handleCreateExcard"
    />
    <PickerModal :show="showJobPicker" title="选择要运行的工作" :items="jobPickerItems" @select="onJobRunSelect" @close="showJobPicker = false" />
    <PickerModal :show="showExcardPicker" title="选择要执行的 ExCard" :items="excardPickerItems" @select="onExcardRunSelect" @close="showExcardPicker = false" />
  </div>
</template>
