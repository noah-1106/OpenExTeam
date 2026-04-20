/**
 * Settings Store - 管理框架配对配置
 * 从 server/config/adapters.json 读写
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

const API_BASE = window.location.origin.replace(/:\d+$/, ':4000');

export const useSettingsStore = defineStore('settings', () => {
  // 已保存的适配器列表
  const adapters = ref([]);

  // 加载所有适配器
  async function fetchAdapters() {
    try {
      const res = await fetch(`${API_BASE}/api/config/adapters`);
      const data = await res.json();
      adapters.value = data.adapters || [];
    } catch (err) {
      console.error('[Settings] fetchAdapters error:', err);
      adapters.value = [];
    }
  }

  // 测试连接
  async function testAdapter(config) {
    const res = await fetch(`${API_BASE}/api/adapter/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: config.type || config.id, url: config.url, token: config.token }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return data; // 返回完整结果，包含 pairing_required 等信息
  }

  // 保存适配器配置
  async function saveAdapter(config) {
    // 先调用 test
    const result = await testAdapter(config);
    if (result.pairing_required) {
      throw new Error(`请先完成设备配对: ${result.message}`);
    }
    if (!result.success) throw new Error('连接测试失败');

    // 保存到配置
    const res = await fetch(`${API_BASE}/api/config/adapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapters: [...adapters.value, config] }),
    });
    if (!res.ok) throw new Error('保存失败');
    await fetchAdapters(); // 重新加载
    return true;
  }

  // 删除适配器
  async function deleteAdapter(conn) {
    // 根据 id 或 name 过滤
    const filtered = adapters.value.filter(a => 
      (conn.id && a.id !== conn.id) || (conn.name && a.name !== conn.name)
    );
    const res = await fetch(`${API_BASE}/api/config/adapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapters: filtered }),
    });
    if (!res.ok) throw new Error('删除失败');
    await fetchAdapters();
  }

  return { adapters, fetchAdapters, testAdapter, saveAdapter, deleteAdapter };
});
