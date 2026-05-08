<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useToast } from '../composables/useToast';
import api from '../api/client';
import { createSSEConnection } from '../api/sse.js';

const settingsStore = useSettingsStore();
const { toast } = useToast();

const frameworks = [
  { id: 'openclaw', name: 'OpenClaw', color: 'blue' },
  { id: 'deerflow', name: 'DeerFlow', color: 'green' },
  { id: 'hermes', name: 'Hermes Agent', color: 'purple' },
];

const selectedFramework = ref('');
const showAddForm = ref(false);
const formData = ref({ name: '', url: '', token: '' });
const saving = ref(false);

// 跟踪已连接的适配器
const connectedAdapters = ref(new Set());

// 跟踪每个适配器的配对信息
const pairingInfo = ref({}); // { adapterName: { message: string, deviceId: string, countdown: number } }

let sseHandle = null;

async function fetchConnectedAdapters() {
  try {
    const data = await api.health();
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
  if (sseHandle) {
    sseHandle.close();
    sseHandle = null;
  }
  // 清除所有倒计时
  Object.values(pairingInfo.value).forEach(info => {
    if (info.countdownInterval) {
      clearInterval(info.countdownInterval);
    }
  });
});

function setupSSE() {
  if (sseHandle) sseHandle.close();

  sseHandle = createSSEConnection({
    adapter_connected: (event) => {
      const data = JSON.parse(event.data);
      connectedAdapters.value.add(data.name);
      if (pairingInfo.value[data.name]) {
        if (pairingInfo.value[data.name].countdownInterval) {
          clearInterval(pairingInfo.value[data.name].countdownInterval);
        }
        delete pairingInfo.value[data.name];
      }
    },

    adapter_disconnected: (event) => {
      const data = JSON.parse(event.data);
      connectedAdapters.value.delete(data.name);
    },

    adapter_pairing_required: (event) => {
      const data = JSON.parse(event.data);
      const countdown = 120;
      pairingInfo.value[data.name] = {
        message: data.message,
        deviceId: data.deviceId,
        countdown: countdown,
        countdownInterval: null
      };
      pairingInfo.value[data.name].countdownInterval = setInterval(() => {
        pairingInfo.value[data.name].countdown--;
        if (pairingInfo.value[data.name].countdown <= 0) {
          clearInterval(pairingInfo.value[data.name].countdownInterval);
        }
      }, 1000);
    },

    adapter_pairing_complete: (event) => {
      const data = JSON.parse(event.data);
      if (pairingInfo.value[data.name]) {
        if (pairingInfo.value[data.name].countdownInterval) {
          clearInterval(pairingInfo.value[data.name].countdownInterval);
        }
        delete pairingInfo.value[data.name];
      }
    },
  }, {
    reconnectDelay: 5000,
  });
}

function isAdapterConnected(adapter) {
  return connectedAdapters.value.has(adapter.name);
}

function selectFramework(fw) {
  selectedFramework.value = fw.id;
  showAddForm.value = true;
  formData.value = { name: '', url: '', token: '' };
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
    // 保存成功后折叠表单并重置
    showAddForm.value = false;
    formData.value = { name: '', url: '', token: '' };
    selectedFramework.value = '';
    // 不需要 alert，配对信息会通过 SSE 显示在对应连接下面
  } catch (err) {
    toast.error('保存失败：' + err.message);
  } finally {
    saving.value = false;
  }
}

const connecting = ref({});
const disconnecting = ref({});

async function deleteConnection(conn) {
  if (!confirm('确定删除此连接？')) return;
  try {
    // 清除配对信息
    if (pairingInfo.value[conn.name]) {
      if (pairingInfo.value[conn.name].countdownInterval) {
        clearInterval(pairingInfo.value[conn.name].countdownInterval);
      }
      delete pairingInfo.value[conn.name];
    }
    await settingsStore.deleteAdapter(conn);
  } catch (err) {
    toast.error('删除失败：' + err.message);
  }
}

async function handleConnect(conn) {
  connecting.value[conn.name] = true;
  try {
    await settingsStore.connectAdapter(conn.name);
    fetchConnectedAdapters();
  } catch (err) {
    toast.error('连接失败：' + err.message);
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
    toast.error('断开失败：' + err.message);
  } finally {
    disconnecting.value[conn.name] = false;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-[15px] font-semibold text-[#2D2D35]">框架配对</h2>
        <p class="text-[13px] text-[#9CA3AF] mt-0.5">添加并管理您的 Agent 框架连接</p>
      </div>

      <!-- Existing Connections -->
      <div class="bg-white rounded-md border border-[#E8E8EC] mb-5">
        <div class="px-4 py-3 border-b border-[#ECECF0]">
          <h3 class="text-[13px] font-medium text-[#2D2D35]">已连接的框架</h3>
        </div>
        <div>
          <div v-if="!settingsStore.adapters?.length" class="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">
            暂无连接，点击下方按钮添加
          </div>
          <div
            v-for="conn in settingsStore.adapters"
            :key="conn.id || conn.name"
            class="border-b border-[#ECECF0] last:border-b-0"
          >
            <div class="px-4 py-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-md flex items-center justify-center text-[13px] font-medium" :class="
                  (conn.type === 'openclaw' || conn.id === 'openclaw') ? 'bg-[#F0F1FE] text-[#5B6AD7]' :
                  (conn.type === 'hermes' || conn.id === 'hermes') ? 'bg-[#F5F0FA] text-[#A67EC5]' :
                  'bg-[#EDF7F3] text-[#4E917A]'
                ">
                  {{ (conn.type === 'openclaw' || conn.id === 'openclaw') ? 'OC' :
                     (conn.type === 'hermes' || conn.id === 'hermes') ? 'He' : 'DF' }}
                </div>
                <div>
                  <h4 class="text-[13px] font-medium text-[#2D2D35]">{{ conn.name }}</h4>
                  <p class="text-[12px] text-[#9CA3AF]">{{ conn.url }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" :class="isAdapterConnected(conn) ? 'bg-[#5FA88F]' : 'bg-[#C5C9D3]'"></span>
                  <span class="text-[12px]" :class="isAdapterConnected(conn) ? 'text-[#4E917A]' : 'text-[#9CA3AF]'">
                    {{ isAdapterConnected(conn) ? '已连接' : '未连接' }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="!isAdapterConnected(conn)"
                    @click="handleConnect(conn)"
                    :disabled="connecting[conn.name]"
                    class="px-3 py-1.5 text-[12px] font-medium text-white bg-[#5B6AD7] hover:bg-[#4A58C0] rounded-md transition-colors disabled:opacity-50"
                  >
                    {{ connecting[conn.name] ? '连接中...' : '连接' }}
                  </button>
                  <button
                    v-else
                    @click="handleDisconnect(conn)"
                    :disabled="disconnecting[conn.name]"
                    class="px-3 py-1.5 text-[12px] font-medium text-[#C97A7A] hover:bg-[#FDF0F0] rounded-md transition-colors disabled:opacity-50"
                  >
                    {{ disconnecting[conn.name] ? '断开中...' : '断开' }}
                  </button>
                  <button
                    @click="deleteConnection(conn)"
                    class="px-3 py-1.5 text-[12px] text-[#9CA3AF] hover:text-[#C97A7A] hover:bg-[#FDF0F0] rounded-md transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
            <!-- 配对信息显示在对应连接下面 -->
            <div v-if="pairingInfo[conn.name]" class="px-4 py-3 bg-[#FDF5EC] border-t border-[#FDF3DC]">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-[#C9965E] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1">
                  <p class="text-[13px] font-medium text-[#8A6A3E]">需要设备配对</p>
                  <p class="text-[12px] text-[#9A7535] mt-1">
                    <strong>配对命令：</strong>
                    <code class="bg-[#FDF3DC] px-1.5 py-0.5 rounded select-all font-mono text-[12px]">{{ pairingInfo[conn.name].message }}</code>
                  </p>
                  <p class="text-[11px] text-[#A87D4A] mt-1.5">
                    倒计时：{{ pairingInfo[conn.name].countdown }}s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add New Framework -->
      <div class="bg-white rounded-md border border-[#E8E8EC]">
        <div class="px-4 py-3 border-b border-[#ECECF0]">
          <h3 class="text-[13px] font-medium text-[#2D2D35]">添加新框架</h3>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="fw in frameworks"
              :key="fw.id"
              @click="selectFramework(fw)"
              :class="[
                'p-4 rounded-md border transition-all hover:border-[#5B6AD7]',
                selectedFramework === fw.id
                  ? 'border-[#5B6AD7] bg-[#F0F1FE]'
                  : 'border-[#E8E8EC] hover:bg-[#F6F7FA]'
              ]"
            >
              <div class="text-[13px] font-semibold text-[#2D2D35]">{{ fw.name }}</div>
            </button>
          </div>

          <!-- Add Form -->
          <div v-if="showAddForm" class="mt-5 pt-5 border-t border-[#ECECF0]">
            <h4 class="text-[13px] font-medium text-[#2D2D35] mb-4">
              配置 {{ frameworks.find(f => f.id === selectedFramework)?.name }} 连接
            </h4>
            <div class="space-y-4">
              <div>
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">连接名称</label>
                <input
                  v-model="formData.name"
                  type="text"
                  placeholder="例如：我的 OpenClaw"
                  class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
                />
              </div>

              <!-- OpenClaw 特有配置说明 -->
              <div v-if="selectedFramework === 'openclaw'" class="p-3 bg-[#F0F1FE] rounded-md text-[12px]">
                <p class="text-[#3D4590]">
                  <strong>连接方式：</strong>Dashboard 作为 <code class="bg-[#E0E3FA] px-1 rounded font-mono">Operator</code> 角色通过 WebSocket 连接到 OpenClaw Gateway。首次连接需在 Gateway 端执行 <code class="bg-[#E0E3FA] px-1 rounded font-mono">openclaw devices approve &lt;requestId&gt;</code> 批准配对。
                </p>
              </div>

              <!-- Hermes 特有配置说明 -->
              <div v-if="selectedFramework === 'hermes'" class="p-3 bg-[#F5F0FA] rounded-md text-[12px]">
                <p class="text-[#7A5A9C]">
                  <strong>连接方式：</strong>本地 CLI 模式，无需配置 URL 和 Token。
                  <br />
                  只需安装 Hermes：<code class="bg-[#E5D5F0] px-1 rounded font-mono">pip install hermes-agent</code>
                </p>
              </div>

              <!-- DeerFlow 特有配置说明 -->
              <div v-if="selectedFramework === 'deerflow'" class="p-3 bg-[#EDF7F3] rounded-md text-[12px]">
                <p class="text-[#3D6B5A]">
                  <strong>连接方式：</strong>通过 HTTP REST API 连接到 DeerFlow Gateway。支持本地和远程连接。
                </p>
              </div>

              <!-- URL 配置（仅 OpenClaw 和 DeerFlow 需要） -->
              <div v-if="selectedFramework !== 'hermes'">
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">
                  {{ selectedFramework === 'openclaw' ? 'Gateway WebSocket URL' : 'DeerFlow API URL' }}
                </label>
                <input
                  v-model="formData.url"
                  type="text"
                  :placeholder="selectedFramework === 'openclaw' ? 'ws://127.0.0.1:18789' : 'http://127.0.0.1:2026'"
                  class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
                />
                <p class="mt-1.5 text-[11px] text-[#9CA3AF]">
                  <template v-if="selectedFramework === 'openclaw'">
                    <strong>本地开发（同机）：</strong><code class="bg-[#F6F7FA] px-1 rounded font-mono">ws://127.0.0.1:18789</code>
                    <br />
                    <strong>Tailscale 网络（不同机）：</strong><code class="bg-[#F6F7FA] px-1 rounded font-mono">ws://&lt;服务器TailscaleIP&gt;:18789</code>
                  </template>
                  <template v-else>
                    <strong>本地开发（同机）：</strong><code class="bg-[#F6F7FA] px-1 rounded font-mono">http://127.0.0.1:2026</code>
                    <br />
                    <strong>远程服务器：</strong><code class="bg-[#F6F7FA] px-1 rounded font-mono">http://&lt;服务器IP&gt;:2026</code>
                  </template>
                </p>
              </div>

              <!-- Token 配置（Hermes 不需要） -->
              <div v-if="selectedFramework !== 'hermes'">
                <label class="block text-[13px] font-medium text-[#2D2D35] mb-1.5">
                  {{ selectedFramework === 'openclaw' ? 'Operator Token' : 'API Token（可选）' }}
                </label>
                <input
                  v-model="formData.token"
                  type="password"
                  :placeholder="selectedFramework === 'openclaw' ? '输入 Gateway 配置的 token' : '输入 API Token（如需要）'"
                  class="w-full px-3 py-2 border border-[#E8E8EC] rounded-md text-[13px] outline-none focus:border-[#5B6AD7] focus:shadow-[0_0_0_3px_rgba(91, 106, 215, 0.08)] transition-all"
                />
                <p class="mt-1.5 text-[11px] text-[#9CA3AF]">
                  <template v-if="selectedFramework === 'openclaw'">
                    Gateway 配置文件中的 <code class="bg-[#F6F7FA] px-1 rounded font-mono">gateway.auth.token</code>。可通过 <code class="bg-[#F6F7FA] px-1 rounded font-mono">openclaw config get gateway.auth.token</code> 查看，未设置时用 <code class="bg-[#F6F7FA] px-1 rounded font-mono">openclaw config set gateway.auth.token "新token"</code> 配置
                  </template>
                  <template v-else>
                    如 DeerFlow 配置了 API 认证，请在此填写 Token，否则留空
                  </template>
                </p>
              </div>

              <div class="flex flex-wrap gap-3 pt-2">
                <button
                  @click="saveConnection"
                  :disabled="!formData.name ||
                            (selectedFramework === 'openclaw' && (!formData.url || !formData.token)) ||
                            (selectedFramework === 'deerflow' && !formData.url)"
                  class="px-4 py-2 text-[13px] font-medium text-white bg-[#5B6AD7] hover:bg-[#4A58C0] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ saving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
