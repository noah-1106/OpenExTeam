<script setup>
import { ref, computed, nextTick, watch } from 'vue'

const props = defineProps({
  agents: { type: Array, required: true },
})

// 会话数据
const sessions = ref([
  {
    id: 'p2p-pinpin',
    type: 'p2p',
    name: '品品',
    avatarUrl: null, // TODO: 从 OpenClaw 底座获取
    agentId: 'agent-1',
    messages: [
      { sender: 'user', text: '品品，帮我梳理 Phase 1 验收标准', time: '18:00' },
      { sender: 'agent', text: 'Phase 1 验收标准：\n1.能添加 OpenClaw 配对\n2.能测试连接\n3.左侧显示 Agent 列表\n4.能创建任务卡片\n5.能拖拽切换状态\n6.能下发任务\n7.Agent 状态实时\n8.能单聊', time: '18:01' },
    ],
  },
  {
    id: 'p2p-kaikai',
    type: 'p2p',
    name: '开开',
    avatarUrl: null,
    agentId: 'agent-2',
    messages: [
      { sender: 'user', text: '开开，查下 health 接口返回', time: '18:30' },
      { sender: 'agent', text: 'health 返回：\n{ok: true, ts: ..., channels: {...}}\n主要是 ok 字段。', time: '18:31' },
    ],
  },
  {
    id: 'p2p-qianqian',
    type: 'p2p',
    name: '前前',
    avatarUrl: null,
    agentId: 'agent-3',
    messages: [
      { sender: 'user', text: '前端项目初始化好了吗？', time: '18:20' },
      { sender: 'agent', text: '初始化完成！Vue3+Vite+TailwindCSS 已就绪。', time: '18:21' },
    ],
  },
  {
    id: 'group-dev',
    type: 'group',
    name: '开发群',
    avatarUrl: null,
    agentIds: ['agent-1', 'agent-2', 'agent-3'],
    messages: [
      { sender: '品品', agentId: 'agent-1', text: '今天推进 OpenExTeam：\n前前 Vue3 前端\n开开 Adapter\n我 PRD + 进度', time: '09:00' },
      { sender: '开开', agentId: 'agent-2', text: '收到，我研究 WebSocket RPC', time: '09:05' },
      { sender: '前前', agentId: 'agent-3', text: '好，我去搭架子', time: '09:06' },
    ],
  },
])

const activeSessionId = ref('p2p-kaikai')
const inputText = ref('')
const typing = ref(false)
const chatContainer = ref(null)

const activeSession = computed(() => {
  return sessions.value.find(s => s.id === activeSessionId.value) || sessions.value[0]
})

function selectSession(id) {
  activeSessionId.value = id
  scrollToBottom()
}

// 根据消息获取头像信息
function getMsgAvatarInfo(msg) {
  if (msg.sender === 'user') {
    return { avatarUrl: null, isUser: true }
  }
  // 群聊消息：按 agentId 查找对应 Agent 的头像
  if (activeSession.value.type === 'group' && msg.agentId) {
    const agent = props.agents.find(a => a.id === msg.agentId)
    return { avatarUrl: agent?.avatarUrl || null, isUser: false }
  }
  // 私聊：用会话自身的头像
  return { avatarUrl: activeSession.value.avatarUrl || null, isUser: false }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  const sess = activeSession.value
  sess.messages.push({
    sender: 'user',
    text,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  })
  inputText.value = ''
  scrollToBottom()

  // 模拟 Agent 回复
  typing.value = true
  setTimeout(() => {
    typing.value = false
    const replies = ['收到，让我处理一下。', '好的，这个我来搞。', '明白了，马上开始。']
    sess.messages.push({
      sender: sess.name,
      agentId: sess.agentId || null,
      text: replies[Math.floor(Math.random() * replies.length)],
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    })
    scrollToBottom()
  }, 1500)
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function getLastMessage(sess) {
  if (sess.messages.length === 0) return ''
  const last = sess.messages[sess.messages.length - 1]
  return last.text
}

function getLastTime(sess) {
  if (sess.messages.length === 0) return ''
  return sess.messages[sess.messages.length - 1].time
}

function getStatusColor(agent) {
  const colors = { online: 'bg-green-400', busy: 'bg-yellow-400', offline: 'bg-gray-300' }
  return colors[agent.status] || 'bg-gray-300'
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
        <!-- 单聊 -->
        <div class="px-3 mb-1">
          <div class="text-xs font-semibold text-muted uppercase tracking-wide px-2 py-1">单聊</div>
          <div
            v-for="sess in sessions.filter(s => s.type === 'p2p')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
              activeSessionId === sess.id ? 'bg-accent-dim' : 'hover:bg-surface-raised'
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
                <span :class="['text-sm font-medium', activeSessionId === sess.id ? 'text-accent' : 'text-primary']">
                  {{ sess.name }}
                </span>
                <span class="text-xs text-muted flex-shrink-0">{{ getLastTime(sess) }}</span>
              </div>
              <p class="text-xs text-secondary truncate mt-0.5">{{ getLastMessage(sess) }}</p>
            </div>
          </div>
        </div>
        <!-- 群聊 -->
        <div class="px-3">
          <div class="text-xs font-semibold text-muted uppercase tracking-wide px-2 py-1">群聊</div>
          <div
            v-for="sess in sessions.filter(s => s.type === 'group')"
            :key="sess.id"
            @click="selectSession(sess.id)"
            :class="[
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5',
              activeSessionId === sess.id ? 'bg-accent-dim' : 'hover:bg-surface-raised'
            ]"
          >
            <div class="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-base flex-shrink-0">
              <img v-if="sess.avatarUrl" :src="sess.avatarUrl" class="w-full h-full object-cover" />
                <svg v-else class="w-full h-full" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F5F4F0"/><rect x="10" y="12" width="16" height="12" rx="3" stroke="#78716C" stroke-width="1.5"/><circle cx="13" cy="17" r="1.5" fill="#78716C"/><circle cx="23" cy="17" r="1.5" fill="#78716C"/><path d="M13 21h10" stroke="#78716C" stroke-width="1.5" stroke-linecap="round"/><rect x="15" y="8" width="6" height="4" rx="1" fill="#A8A29E"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span :class="['text-sm font-medium', activeSessionId === sess.id ? 'text-accent' : 'text-primary']">
                  {{ sess.name }}
                </span>
                <span class="text-xs text-muted flex-shrink-0">{{ getLastTime(sess) }}</span>
              </div>
              <p class="text-xs text-secondary truncate mt-0.5">{{ getLastMessage(sess) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天窗口 -->
    <div class="flex-1 flex flex-col overflow-hidden bg-surface-raised">
      <!-- 头部 -->
      <div class="px-6 py-4 bg-surface border-b border-border-subtle flex items-center gap-3">
        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img v-if="activeSession.avatarUrl" :src="activeSession.avatarUrl" class="w-full h-full object-cover" />
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
          <div class="font-semibold text-primary">{{ activeSession.name }}</div>
          <div class="text-xs text-muted">
            {{ activeSession.type === 'group' ? `${activeSession.agentIds?.length || 0} 位成员` : '私聊' }}
          </div>
        </div>
        <button
          v-if="activeSession.type === 'group'"
          class="px-3 py-1.5 text-xs text-secondary border border-border rounded-lg hover:bg-surface-raised"
        >
          群设置
        </button>
      </div>

      <!-- 消息列表 -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        <div
          v-for="(msg, idx) in activeSession.messages"
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
                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                msg.sender === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-surface text-primary border border-border-subtle rounded-bl-md'
              ]"
            >
              {{ msg.text }}
            </div>
            <div :class="['text-xs text-muted mt-1', msg.sender === 'user' ? 'text-right' : '']">
              {{ msg.time }}
            </div>
          </div>
        </div>

        <!-- Typing 状态 -->
        <div v-if="typing" class="flex items-end gap-3">
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
        <div class="flex items-end gap-3">
          <textarea
            v-model="inputText"
            @keydown="handleKeydown"
            rows="1"
            placeholder="输入消息，按 Enter 发送..."
            class="flex-1 px-4 py-2.5 bg-surface-raised border border-border rounded-full text-sm resize-none outline-none focus:ring-2 focus:ring-accent focus:border-transparent leading-relaxed"
            style="min-height: 42px; max-height: 120px"
          />
          <button
            @click="sendMessage"
            class="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all duration-150 flex-shrink-0 shadow-xs"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
