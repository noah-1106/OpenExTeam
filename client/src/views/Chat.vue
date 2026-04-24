<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { marked } from 'marked'
import { useBoardStore } from '../stores/board'
import ExcardProposalModal from '../components/ExcardProposalModal.vue'
import SlashCommandHelper from '../components/SlashCommandHelper.vue'

const props = defineProps({
  agents: { type: Array, required: true },
})

const chatStore = useChatStore()
const boardStore = useBoardStore()
const typing = ref(false)
const inputText = ref('')
const chatContainer = ref(null)

// ExCard 提议相关
const showProposalModal = ref(false)
const proposalAgentId = ref('')
const proposalText = ref('')

// 检测消息中是否有 ExCard 提议
function checkForExcardProposal(msg) {
  if (msg.sender === 'user') return false
  const text = msg.text || ''
  if (text.includes('[EXCARD_PROPOSAL]') || text.includes('# EXCARD_PROPOSAL')) {
    return true
  }
  return false
}

// 显示提议弹窗
function showProposal(msg) {
  if (activeSession.value?.type === 'p2p') {
    proposalAgentId.value = activeSession.value.agentId
  } else if (msg.agentId) {
    proposalAgentId.value = msg.agentId
  }
  proposalText.value = msg.text
  showProposalModal.value = true
}

// 创建 ExCard
async function handleCreateExcard(data) {
  try {
    // 先创建 ExCard
    await fetch(`${window.location.origin.replace(/:\d+$/, ':4000')}/api/excards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: data.id,
        name: data.name,
        description: data.description,
        agent: data.agent,
      }),
    })

    // 再更新 Markdown 内容
    await fetch(`${window.location.origin.replace(/:\d+$/, ':4000')}/api/excards/${data.id}/md`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markdown: data.markdown,
      }),
    })

    // 刷新 ExCard 列表
    await boardStore.fetchAll()

    alert('ExCard 创建成功！')
  } catch (err) {
    console.error('创建 ExCard 失败:', err)
    alert('创建 ExCard 失败：' + err.message)
  }
}

// 直接引用 store 中的状态（模板中使用 chatStore.xxx）
const activeSession = computed(() => chatStore.activeSession())

// 渲染 Markdown
function renderMarkdown(text) {
  if (!text) return ''
  return marked(text, { breaks: true, gfm: true })
}

// 检查当前会话是否有至少一个已连接的 agent
const isSessionConnected = computed(() => {
  const sess = activeSession.value
  if (!sess) return false
  
  if (sess.type === 'p2p') {
    const agentId = sess.agentId.includes(':') ? sess.agentId.split(':').pop() : sess.agentId;
    const agent = props.agents.find(a => a.id === agentId || a.id === sess.agentId);
    return agent?.connected || false;
  } else if (sess.type === 'group') {
    return sess.agentIds.some(agId => {
      const pureId = agId.includes(':') ? agId.split(':').pop() : agId;
      const agent = props.agents.find(a => a.id === pureId || a.id === agId);
      return agent?.connected || false;
    });
  }
  return false;
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
    // 检测斜杠命令，给 agent 明确的回复格式要求
    let messageToSend = text
    if (text.startsWith('/ec')) {
      // 提取用户需求，给 agent 明确的格式指令
      const userDemand = text.replace(/^\/ec\s*/, '').trim()
      messageToSend = `/ec ${userDemand}

请务必用以下格式回复提案：
# EXCARD_PROPOSAL

（在这里写完整的 ExCard Markdown 内容）

或者使用：
[EXCARD_PROPOSAL]
name: ExCard名称
description: 描述用途
agent: <agent-id>
markdown:
# ExCard标题
## 任务描述
...`
    }

    await chatStore.sendMessage(messageToSend)
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

// 监听消息变化，检测 ExCard 提议
watch(() => activeSession.value?.messages, (newMessages) => {
  if (newMessages && newMessages.length > 0) {
    const lastMsg = newMessages[newMessages.length - 1]
    if (checkForExcardProposal(lastMsg)) {
      showProposal(lastMsg)
    }
  }
}, { deep: true })

function getLastMessage(sess) {
  if (!sess.messages.length) return ''
  return sess.messages[sess.messages.length - 1].text
}

function getLastTime(sess) {
  if (!sess.messages.length) return ''
  return sess.messages[sess.messages.length - 1].time
}

function getStatusColor(agent) {
  const colors = { online: 'bg-green-400', busy: 'bg-yellow-400', offline: 'bg-gray-300' }
  return colors[agent?.status] || 'bg-gray-300'
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 会话列表 -->
    <div class="w-64 bg-surface border-r border-border flex flex-col flex-shrink-0">
      <div class="px-4 py-3 border-b border-border-subtle">
        <h2 class="text-sm font-semibold text-primary">消息</h2>
      </div>
      <div class="flex-1 overflow-y-auto py-2">
        <!-- 系统通知 -->
        <div class="px-3 mb-1">
          <div class="text-xs font-semibold text-muted uppercase tracking-wide px-2 py-1">系统通知</div>
          <div
            v-for="sess in chatStore.sessions.filter(s => s.type === 'system')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
              chatStore.activeSessionId === sess.id ? 'bg-accent-dim' : 'hover:bg-surface-raised'
            ]"
          >
            <div class="relative flex-shrink-0">
              <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-base">
                <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-sm font-medium', chatStore.activeSessionId === sess.id ? 'text-accent' : 'text-primary']">
                  {{ sess.name }}
                </span>
                <span class="text-xs text-muted flex-shrink-0">{{ getLastTime(sess) }}</span>
              </div>
              <p class="text-xs text-secondary truncate mt-0.5">{{ getLastMessage(sess) }}</p>
            </div>
          </div>
        </div>
        <!-- 单聊 -->
        <div class="px-3 mb-1">
          <div class="text-xs font-semibold text-muted uppercase tracking-wide px-2 py-1">单聊</div>
          <div
            v-for="sess in chatStore.sessions.filter(s => s.type === 'p2p')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
              chatStore.activeSessionId === sess.id ? 'bg-accent-dim' : 'hover:bg-surface-raised'
            ]"
          >
            <div class="relative flex-shrink-0">
              <div class="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-base">
                <img v-if="sess.avatarUrl" :src="sess.avatarUrl" class="w-full h-full object-cover" />
                <svg v-else class="w-full h-full" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F5F4F0"/><rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/><circle cx="13" cy="17" r="1.5" fill="#78716C"/><circle cx="23" cy="17" r="1.5" fill="#78716C"/><path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/><rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/></svg>
              </div>
              <span
                :class="[
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                  getStatusColor(agents.find(a => a.id === sess.agentId) || {})
                ]"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-sm font-medium', chatStore.activeSessionId === sess.id ? 'text-accent' : 'text-primary']">
                  {{ sess.name }}
                  <span v-if="agents.find(a => a.id === sess.agentId)?.connected === false" class="ml-1 px-1 py-0.5 text-[10px] bg-red-50 text-red-500 rounded">已解绑</span>
                </span>
                <span class="text-xs text-muted flex-shrink-0">{{ getLastTime(sess) }}</span>
              </div>
              <p class="text-xs text-secondary truncate mt-0.5">{{ getLastMessage(sess) }}</p>
            </div>
          </div>
        </div>
        <!-- 群聊（暂时隐藏） -->
        <!-- <div class="px-3">
          <div class="text-xs font-semibold text-muted uppercase tracking-wide px-2 py-1">群聊</div>
          <div
            v-for="sess in chatStore.sessions.filter(s => s.type === 'group')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
              chatStore.activeSessionId === sess.id ? 'bg-accent-dim' : 'hover:bg-surface-raised'
            ]"
          >
            <div class="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-base flex-shrink-0">
              <img v-if="sess.avatarUrl" :src="sess.avatarUrl" class="w-full h-full object-cover" />
                <svg v-else class="w-full h-full" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F5F4F0"/><rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/><circle cx="13" cy="17" r="1.5" fill="#78716C"/><circle cx="23" cy="17" r="1.5" fill="#78716C"/><path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/><rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-sm font-medium', chatStore.activeSessionId === sess.id ? 'text-accent' : 'text-primary']">
                  {{ sess.name }}
                </span>
                <span class="text-xs text-muted flex-shrink-0">{{ getLastTime(sess) }}</span>
              </div>
              <p class="text-xs text-secondary truncate mt-0.5">{{ getLastMessage(sess) }}</p>
            </div>
          </div>
        </div> -->
      </div>
    </div>

    <!-- 聊天窗口 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-surface-raised">
      <!-- 头部 -->
      <div class="px-6 py-4 bg-surface border-b border-border-subtle flex items-center gap-3">
        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img v-if="activeSession?.avatarUrl" :src="activeSession.avatarUrl" class="w-full h-full object-cover" />
          <svg v-else class="w-full h-full" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="18" fill="#F5F4F0"/>
            <rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/>
            <circle cx="13" cy="17" r="1.5" fill="#78716C"/>
            <circle cx="23" cy="17" r="1.5" fill="#78716C"/>
            <path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/>
          </svg>
        </div>
        <div class="flex-1">
          <div class="font-semibold text-primary">
            {{ activeSession?.name }}
            <span v-if="activeSession?.type === 'p2p' && agents.find(a => a.id === activeSession?.agentId)?.connected === false" class="ml-2 px-2 py-0.5 text-xs bg-red-50 text-red-500 rounded">已解绑</span>
          </div>
          <div class="text-xs text-muted">
            {{ activeSession?.type === 'system' ? '系统工作流通知' : (activeSession?.type === 'group' ? `${activeSession?.agentIds?.length || 0} 位成员` : '私聊') }}
          </div>
        </div>
        <!-- <button
          v-if="activeSession?.type === 'group'"
          class="px-3 py-1.5 text-xs text-secondary border border-border rounded-lg hover:bg-surface-raised"
        >
          群设置
        </button> -->
      </div>

      <!-- 消息列表 -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        <div
          v-for="(msg, idx) in activeSession?.messages"
          :key="idx"
          :class="['flex items-end gap-3', msg.sender === 'user' ? 'flex-row-reverse' : '']"
        >
          <!-- 头像 -->
          <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden self-start">
            <!-- 用户头像 -->
            <svg v-if="msg.sender === 'user'" class="w-full h-full" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="18" fill="#E5702A"/>
              <circle cx="18" cy="14" r="5" fill="white"/>
              <path d="M8 30c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <!-- Agent 头像 -->
            <img v-else-if="getMsgAvatarInfo(msg).avatarUrl" :src="getMsgAvatarInfo(msg).avatarUrl" class="w-full h-full object-cover" />
            <svg v-else class="w-full h-full" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="18" fill="#F5F4F0"/>
              <rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/>
              <circle cx="13" cy="17" r="1.5" fill="#78716C"/>
              <circle cx="23" cy="17" r="1.5" fill="#78716C"/>
              <path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/>
            </svg>
          </div>
          <!-- 气泡 -->
          <div class="max-w-[70%]">
            <div
              :class="[
                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.sender === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-surface text-primary border border-border-subtle rounded-bl-md prose prose-sm max-w-none',
                msg.sender === 'user' ? 'prose-invert' : ''
              ]"
              v-if="msg.sender !== 'user'"
              v-html="renderMarkdown(msg.text)"
            ></div>
            <div
              :class="[
                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                msg.sender === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-surface text-primary border border-border-subtle rounded-bl-md'
              ]"
              v-else
            >
              {{ msg.text }}
            </div>
            <div :class="['text-xs text-muted mt-1', msg.sender === 'user' ? 'text-right' : '']">
              {{ msg.time }}
            </div>
          </div>
        </div>

        <!-- Typing 状态 -->
        <div v-if="typing && activeSession" class="flex items-end gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            <svg class="w-full h-full" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="18" fill="#F5F4F0"/>
              <rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/>
              <circle cx="13" cy="17" r="1.5" fill="#78716C"/>
              <circle cx="23" cy="17" r="1.5" fill="#78716C"/>
              <path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/>
            </svg>
          </div>
          <div class="bg-surface border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3 shadow-xs">
            <span class="inline-block w-2 h-2 bg-accent rounded-full animate-bounce" style="animation-delay: -0.32s"></span>
            <span class="inline-block w-2 h-2 bg-accent rounded-full animate-bounce mx-0.5" style="animation-delay: -0.16s"></span>
            <span class="inline-block w-2 h-2 bg-accent rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="px-6 py-4 bg-surface border-t border-border-subtle">
        <div v-if="activeSession?.type === 'system'" class="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-600">
          ℹ️ 系统通知会话仅用于接收工作流进度更新
        </div>
        <div v-else-if="isSessionConnected" class="flex items-end gap-3">
          <div class="flex-1 relative">
            <textarea
              v-model="inputText"
              @keydown="handleKeydown"
              rows="1"
              placeholder="输入消息，按 Enter 发送..."
              class="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-full text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent leading-relaxed"
              style="min-height: 42px; max-height: 120px"
            />
            <div v-if="inputText.trim() === ''" class="absolute left-4 bottom-2.5 text-xs text-muted pointer-events-none">
              <span class="mr-3 text-accent font-medium">/ec</span> 让 Agent 帮忙创建 ExCard
            </div>
          </div>
          <button
            @click="sendMessage"
            class="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all duration-150 flex-shrink-0 shadow-xs"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
        <div v-else class="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-center text-sm text-red-600">
          🔌 {{ activeSession?.type === 'p2p' ? 'Agent 已离线' : '所有 Agent 都已离线' }}，无法发送消息
        </div>
      </div>
    </div>

    <!-- ExCard 提议弹窗 -->
    <ExcardProposalModal
      :show="showProposalModal"
      :agent-id="proposalAgentId"
      :raw-text="proposalText"
      @close="showProposalModal = false"
      @create="handleCreateExcard"
    />
  </div>
</template>
