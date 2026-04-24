<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useSettingsStore } from '../stores/settings';

const settingsStore = useSettingsStore();

const frameworks = [
  { id: 'openclaw', name: 'OpenClaw', icon: '🦞', color: 'blue' },
  { id: 'deerflow', name: 'DeerFlow', icon: '🦌', color: 'green' },
  { id: 'hermes', name: 'Hermes Agent', icon: '🐺', color: 'purple' },
];

const selectedFramework = ref('');
const showAddForm = ref(false);
const formData = ref({ name: '', url: '', token: '' });
const testResult = ref(null);
const testing = ref(false);
const saving = ref(false);
const resetting = ref(false);

// 跟踪已连接的适配器
const connectedAdapters = ref(new Set());

let eventSource = null;

async function fetchConnectedAdapters() {
  try {
    const API_BASE = window.location.origin.replace(/:\d+$/, ':4000');
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.adapters && Array.isArray(data.adapters)) {
      connectedAdapters.value = new Set(data.adapters);
    }
  } catch (err) {
    console.error('[Settings] Failed to fetch connected adapters:', err);
  }
}

onMounted(async () => {
  settingsStore.fetchAdapters();
  await fetchConnectedAdapters();
  setupSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});

function setupSSE() {
  const API_BASE = window.location.origin.replace(/:\d+$/, ':4000');
  eventSource = new EventSource(`${API_BASE}/api/events`);

  eventSource.addEventListener('adapter_connected', (event) => {
    const data = JSON.parse(event.data);
    connectedAdapters.value.add(data.name);
  });

  eventSource.addEventListener('adapter_disconnected', (event) => {
    const data = JSON.parse(event.data);
    connectedAdapters.value.delete(data.name);
  });

  eventSource.onerror = (error) => {
    console.error('[Settings] SSE error:', error);
    eventSource.close();
    // 5秒后重试
    setTimeout(setupSSE, 5000);
  };
}

function isAdapterConnected(adapter) {
  return connectedAdapters.value.has(adapter.name);
}

function selectFramework(fw) {
  selectedFramework.value = fw.id;
  showAddForm.value = true;
  formData.value = { name: '', url: '', token: '' };
  testResult.value = null;
}

async function testConnection() {
  // Hermes 不需要 URL 也能测试
  if (selectedFramework.value !== 'hermes' && !formData.value.url) return;
  testing.value = true;
  testResult.value = null;
  try {
    const result = await settingsStore.testAdapter({
      id: selectedFramework.value,
      name: formData.value.name,
      url: formData.value.url,
      token: formData.value.token,
    });

    // 处理配对提示
    if (result.pairing_required) {
      testResult.value = 'pairing_required';
      formData.value.pairingDeviceId = result.deviceId;
      formData.value.pairingMessage = result.message;
    } else {
      testResult.value = result.success ? 'success' : 'failed';
    }
  } catch (err) {
    testResult.value = 'failed';
  } finally {
    testing.value = false;
  }
}

async function saveConnection() {
  if (!formData.value.name ||
      (selectedFramework.value === 'openclaw' && (!formData.value.url || !formData.value.token)) ||
      (selectedFramework.value === 'deerflow' && !formData.value.url)) {
    return;
  }
  saving.value = true;
  try {
    await settingsStore.saveAdapter({
      id: selectedFramework.value,
      type: selectedFramework.value,
      name: formData.value.name,
      url: formData.value.url,
      token: formData.value.token,
    });
    showAddForm.value = false;
    formData.value = { name: '', url: '', token: '' };
    testResult.value = null;
    selectedFramework.value = '';
    alert('保存成功！后端会自动尝试连接。如果需要配对，请查看后端日志。');
  } catch (err) {
    alert('保存失败：' + err.message);
  } finally {
    saving.value = false;
  }
}

const connecting = ref({});
const disconnecting = ref({});

async function deleteConnection(conn) {
  if (!confirm('确定删除此连接？')) return;
  try {
    await settingsStore.deleteAdapter(conn);
  } catch (err) {
    alert('删除失败：' + err.message);
  }
}

async function resetCredentials(type) {
  if (!confirm('确定重置设备凭证？这将清除当前的配对信息，需要重新配对。')) return;
  resetting.value = true;
  try {
    const result = await settingsStore.resetCredentials(type);
    alert(result.message || '凭证重置成功！');
  } catch (err) {
    alert('重置失败：' + err.message);
  } finally {
    resetting.value = false;
  }
}

async function handleConnect(conn) {
  connecting.value[conn.name] = true;
  try {
    await settingsStore.connectAdapter(conn.name);
    fetchConnectedAdapters();
  } catch (err) {
    alert('连接失败：' + err.message);
  } finally {
    connecting.value[conn.name] = false;
  }
}

async function handleDisconnect(conn) {
  disconnecting.value[conn.name] = true;
  try {
    await settingsStore.disconnectAdapter(conn.name);
    fetchConnectedAdapters();
  } catch (err) {
    alert('断开失败：' + err.message);
  } finally {
    disconnecting.value[conn.name] = false;
  }
}
</script>

<template>
  <div class="max-w-4xl h-full overflow-y-auto">
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
        <div v-if="!settingsStore.adapters?.length" class="px-4 py-8 text-center text-muted text-sm">
          暂无连接，点击下方按钮添加
        </div>
        <div
          v-for="conn in settingsStore.adapters"
          :key="conn.id || conn.name"
          class="px-4 py-4 flex items-center justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg" :class="
              (conn.type === 'openclaw' || conn.id === 'openclaw') ? 'bg-blue-50' :
              (conn.type === 'hermes' || conn.id === 'hermes') ? 'bg-purple-50' :
              'bg-green-50'
            ">
              {{ (conn.type === 'openclaw' || conn.id === 'openclaw') ? '🦞' :
                 (conn.type === 'hermes' || conn.id === 'hermes') ? '🐺' :
                 '🦌' }}
            </div>
            <div>
              <h4 class="font-medium text-primary">{{ conn.name }}</h4>
              <p class="text-sm text-muted">{{ conn.url }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :class="isAdapterConnected(conn) ? 'bg-green-500' : 'bg-gray-300'"></span>
                <span class="text-sm" :class="isAdapterConnected(conn) ? 'text-green-600' : 'text-muted'">
                  {{ isAdapterConnected(conn) ? '已连接' : '未连接' }}
                </span>
              </div>
              <p class="text-xs text-muted mt-1">
                上次心跳: {{ conn.lastHeartbeat || '刚刚' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!isAdapterConnected(conn)"
                @click="handleConnect(conn)"
                :disabled="connecting[conn.name]"
                class="px-3 py-1.5 text-sm text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {{ connecting[conn.name] ? '连接中...' : '连接' }}
              </button>
              <button
                v-else
                @click="handleDisconnect(conn)"
                :disabled="disconnecting[conn.name]"
                class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {{ disconnecting[conn.name] ? '断开中...' : '断开' }}
              </button>
              <button
                v-if="conn.type === 'openclaw' || conn.id === 'openclaw'"
                @click="resetCredentials('openclaw')"
                :disabled="resetting"
                class="px-3 py-1.5 text-sm text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
              >
                重置凭证
              </button>
              <button
                @click="deleteConnection(conn)"
                class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                删除
              </button>
            </div>
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
          <h4 class="font-medium text-primary mb-4">
            配置 {{ frameworks.find(f => f.id === selectedFramework)?.name }} 连接
          </h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">连接名称</label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="例如：我的 OpenClaw"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            <!-- OpenClaw 特有配置说明 -->
            <div v-if="selectedFramework === 'openclaw'" class="p-3 bg-blue-50 rounded-lg text-sm">
              <p class="text-blue-800">
                <strong>连接方式：</strong>Dashboard 作为 <code class="bg-blue-100 px-1 rounded">Operator</code> 角色通过 WebSocket 连接到 OpenClaw Gateway。
                首次连接需在 Gateway 端执行 <code class="bg-blue-100 px-1 rounded">openclaw devices approve &lt;requestId&gt;</code> 批准配对。
              </p>
            </div>

            <!-- Hermes 特有配置说明 -->
            <div v-if="selectedFramework === 'hermes'" class="p-3 bg-purple-50 rounded-lg text-sm">
              <p class="text-purple-800">
                <strong>连接方式：</strong>本地 CLI 模式，无需配置 URL 和 Token。
                <br />
                只需安装 Hermes：<code class="bg-purple-100 px-1 rounded">pip install hermes-agent</code>
              </p>
            </div>

            <!-- DeerFlow 特有配置说明 -->
            <div v-if="selectedFramework === 'deerflow'" class="p-3 bg-green-50 rounded-lg text-sm">
              <p class="text-green-800">
                <strong>连接方式：</strong>通过 HTTP REST API 连接到 DeerFlow Gateway。
                支持本地和远程连接。
              </p>
            </div>

            <!-- URL 配置（仅 OpenClaw 和 DeerFlow 需要） -->
            <div v-if="selectedFramework !== 'hermes'">
              <label class="block text-sm font-medium text-primary mb-1">
                {{ selectedFramework === 'openclaw' ? 'Gateway WebSocket URL' : 'DeerFlow API URL' }}
              </label>
              <input
                v-model="formData.url"
                type="text"
                :placeholder="selectedFramework === 'openclaw' ? 'ws://127.0.0.1:18789' : 'http://127.0.0.1:2026'"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <p class="mt-1 text-xs text-muted">
                <template v-if="selectedFramework === 'openclaw'">
                  <strong>本地开发（同机）：</strong><code class="bg-surface-raised px-1 rounded">ws://127.0.0.1:18789</code>
                  <br />
                  <strong>Tailscale 网络（不同机）：</strong><code class="bg-surface-raised px-1 rounded">ws://&lt;服务器TailscaleIP&gt;:18789</code>
                </template>
                <template v-else>
                  <strong>本地开发（同机）：</strong><code class="bg-surface-raised px-1 rounded">http://127.0.0.1:2026</code>
                  <br />
                  <strong>远程服务器：</strong><code class="bg-surface-raised px-1 rounded">http://&lt;服务器IP&gt;:2026</code>
                </template>
              </p>
            </div>

            <!-- Token 配置（Hermes 不需要） -->
            <div v-if="selectedFramework !== 'hermes'">
              <label class="block text-sm font-medium text-primary mb-1">
                {{ selectedFramework === 'openclaw' ? 'Operator Token' : 'API Token（可选）' }}
              </label>
              <input
                v-model="formData.token"
                type="password"
                :placeholder="selectedFramework === 'openclaw' ? '输入 Gateway 配置的 token' : '输入 API Token（如需要）'"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <p class="mt-1 text-xs text-muted">
                <template v-if="selectedFramework === 'openclaw'">
                  Gateway 配置文件中的 <code class="bg-surface-raised px-1 rounded">gateway.auth.token</code>。
                  可通过 <code class="bg-surface-raised px-1 rounded">openclaw config get gateway.auth.token</code> 查看，
                  未设置时用 <code class="bg-surface-raised px-1 rounded">openclaw config set gateway.auth.token "新token"</code> 配置
                </template>
                <template v-else>
                  如 DeerFlow 配置了 API 认证，请在此填写 Token，否则留空
                </template>
              </p>
            </div>

            <!-- Test Result -->
            <div v-if="testResult" :class="[
              'p-3 rounded-lg text-sm',
              testResult === 'success' ? 'bg-green-50 text-green-700' :
              testResult === 'pairing_required' ? 'bg-yellow-50 text-yellow-700' :
              'bg-red-50 text-red-700'
            ]">
              <span v-if="testResult === 'success'">
                ✅ 连接成功！
                <template v-if="selectedFramework === 'openclaw'">Gateway 协议握手完成</template>
                <template v-else-if="selectedFramework === 'deerflow'">DeerFlow API 连接正常</template>
                <template v-else-if="selectedFramework === 'hermes'">Hermes CLI 可用</template>
              </span>
              <span v-else-if="testResult === 'pairing_required'">
                ⏳ 需要设备配对
                <br />
                <strong>配对命令：</strong>
                <code class="bg-yellow-100 px-1 rounded select-all">{{ formData.pairingMessage || `openclaw devices approve ${formData.pairingDeviceId}` }}</code>
                <br />
                <span class="text-xs">你可以直接保存配置，后端会持续尝试连接</span>
              </span>
              <span v-else>
                ❌ 连接失败，请检查配置是否正确
                <br v-if="selectedFramework === 'openclaw'" />
                <span v-if="selectedFramework === 'openclaw'" class="text-xs">
                  如果之前配对过，可能需要重置凭证后重试
                </span>
                <span v-else-if="selectedFramework === 'hermes'" class="text-xs">
                  请确保已安装 Hermes: <code class="bg-purple-100 px-1 rounded">pip install hermes-agent</code>
                </span>
              </span>
            </div>

            <div class="flex flex-wrap gap-3 pt-2">
              <button
                @click="testConnection"
                :disabled="testing || (selectedFramework !== 'hermes' && !formData.url)"
                class="px-4 py-2 text-sm font-medium text-primary bg-surface hover:bg-surface-raised rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button
                @click="saveConnection"
                :disabled="!formData.name ||
                          (selectedFramework === 'openclaw' && (!formData.url || !formData.token)) ||
                          (selectedFramework === 'deerflow' && !formData.url)"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
              <button
                v-if="selectedFramework === 'openclaw'"
                @click="resetCredentials('openclaw')"
                :disabled="resetting"
                class="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {{ resetting ? '重置中...' : '重置凭证' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
