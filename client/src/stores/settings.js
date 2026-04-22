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
    // 先调用 test（可选，不阻止保存）
    try {
      await testAdapter(config);
    } catch (e) {
      // 测试失败不阻止保存
      console.log('[Settings] Test failed but proceeding to save:', e.message);
    }

    // 保存到配置
    const newConfig = { ...config, enabled: true };
    const res = await fetch(`${API_BASE}/api/config/adapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapters: [...adapters.value, newConfig] }),
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

  // 重置适配器凭证
  async function resetCredentials(type) {
    const res = await fetch(`${API_BASE}/api/adapter/reset-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: '重置失败' }));
      throw new Error(data.message || '重置失败');
    }
    return await res.json();
  }

  return { adapters, fetchAdapters, testAdapter, saveAdapter, deleteAdapter, resetCredentials };
});
