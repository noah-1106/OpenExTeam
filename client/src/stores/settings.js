/**
 * Settings Store - 管理框架配对配置
 * 从 server/config/adapters.json 读写
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export const useSettingsStore = defineStore('settings', () => {
  // 已保存的适配器列表
  const adapters = ref([]);

  // 加载所有适配器
  async function fetchAdapters() {
    try {
      const res = await fetch('http://localhost:4000/api/config/adapters');
      const data = await res.json();
      adapters.value = data.adapters || [];
    } catch (err) {
      console.error('[Settings] fetchAdapters error:', err);
      adapters.value = [];
    }
  }

  // 测试连接
  async function testAdapter(config) {
    const res = await fetch('http://localhost:4000/api/adapter/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.ok;
  }

  // 保存适配器配置
  async function saveAdapter(config) {
    // 先调用 test
    const ok = await testAdapter(config);
    if (!ok) throw new Error('连接测试失败');

    // 保存到配置
    const res = await fetch('http://localhost:4000/api/config/adapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapters: [...adapters.value, config] }),
    });
    if (!res.ok) throw new Error('保存失败');
    await fetchAdapters(); // 重新加载
    return true;
  }

  // 删除适配器
  async function deleteAdapter(id) {
    const filtered = adapters.value.filter(a => a.id !== id);
    const res = await fetch('http://localhost:4000/api/config/adapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapters: filtered }),
    });
    if (!res.ok) throw new Error('删除失败');
    await fetchAdapters();
  }

  return { adapters, fetchAdapters, testAdapter, saveAdapter, deleteAdapter };
});
