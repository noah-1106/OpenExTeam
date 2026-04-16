<script setup>
import { ref } from 'vue'

const props = defineProps({
  connections: { type: Array, required: true },
})

const frameworks = [
  { id: 'openclaw', name: 'OpenClaw', icon: '🦞', color: 'blue' },
  { id: 'deerflow', name: 'DeerFlow', icon: '🦌', color: 'green' },
  { id: 'hermes', name: 'Hermes Agent', icon: '🐺', color: 'purple' },
]

const selectedFramework = ref('')
const showAddForm = ref(false)
const formData = ref({
  name: '',
  url: '',
  token: '',
})
const testResult = ref(null) // null | 'success' | 'failed'
const testing = ref(false)

function selectFramework(fw) {
  selectedFramework.value = fw.id
  showAddForm.value = true
  formData.value = { name: '', url: '', token: '' }
  testResult.value = null
}

async function testConnection() {
  testing.value = true
  testResult.value = null

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Mock result - success if URL contains 'localhost'
  testResult.value = formData.value.url.includes('localhost') ? 'success' : 'failed'
  testing.value = false
}

function saveConnection() {
  // In real app, would save to backend
  alert('连接已保存（原型演示）')
  showAddForm.value = false
}
</script>

<template>
  <div class="max-w-4xl">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-primary mb-1">框架配对</h2>
      <p class="text-sm text-secondary">添加并管理您的 Agent 框架连接</p>
    </div>

    <!-- Existing Connections -->
    <div class="bg-surface rounded-xl shadow-xs border border-border-subtle mb-6">
      <div class="px-4 py-3 border-b border-border-subtle">
        <h3 class="font-medium text-primary">已连接的框架</h3>
      </div>
      <div class="divide-y divide-gray-50">
        <div
          v-for="conn in connections"
          :key="conn.id"
          class="px-4 py-4 flex items-center justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg">
              🦞
            </div>
            <div>
              <h4 class="font-medium text-primary">{{ conn.name }}</h4>
              <p class="text-sm text-muted">{{ conn.url }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-green-500" />
                <span class="text-sm text-green-600">已连接</span>
              </div>
              <p class="text-xs text-muted mt-1">
                上次心跳: {{ conn.lastHeartbeat }}
              </p>
            </div>
            <button class="px-3 py-1.5 text-sm text-primary hover:bg-surface rounded-lg transition-colors">
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add New Framework -->
    <div class="bg-surface rounded-xl shadow-xs border border-border-subtle">
      <div class="px-4 py-3 border-b border-border-subtle">
        <h3 class="font-medium text-primary">添加新框架</h3>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-3 gap-4">
          <button
            v-for="fw in frameworks"
            :key="fw.id"
            @click="selectFramework(fw)"
            :class="[
              'p-4 rounded-xl border-2 transition-all hover:shadow-sm',
              selectedFramework === fw.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-border hover:border-gray-300'
            ]"
          >
            <div class="text-3xl mb-2">{{ fw.icon }}</div>
            <div class="font-medium text-primary">{{ fw.name }}</div>
          </button>
        </div>

        <!-- Add Form -->
        <div v-if="showAddForm" class="mt-6 pt-6 border-t border-border-subtle">
          <h4 class="font-medium text-primary mb-4">配置 {{ frameworks.find(f => f.id === selectedFramework)?.name }} 连接</h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">连接名称</label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="例如: 我的 OpenClaw"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">Gateway URL</label>
              <input
                v-model="formData.url"
                type="text"
                placeholder="http://localhost:18789"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">Token</label>
              <input
                v-model="formData.token"
                type="password"
                placeholder="输入您的 Gateway Token"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            <!-- Test Result -->
            <div v-if="testResult" :class="[
              'p-3 rounded-lg text-sm',
              testResult === 'success' ? 'bg-green-50 text-green-700' : 'bg-surface-raised text-red-700'
            ]">
              <span v-if="testResult === 'success'">✅ 连接成功！</span>
              <span v-else>❌ 连接失败，请检查 URL 和 Token</span>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                @click="testConnection"
                :disabled="testing || !formData.url"
                class="px-4 py-2 text-sm font-medium text-primary bg-surface hover:bg-surface-raised rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button
                @click="saveConnection"
                :disabled="!formData.name || !formData.url || !formData.token"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
