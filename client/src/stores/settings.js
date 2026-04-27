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
      const data = await api.getAdapters();
      adapters.value = data.adapters || [];
    } catch (err) {
      console.error('[Settings] fetchAdapters error:', err);
      adapters.value = [];
    }
  }

  // 测试连接
  async function testAdapter(config) {
    try {
      return await api.testAdapter(config.type || config.id, config.url, config.token);
    } catch {
      return { success: false };
    }
  }

  // 保存适配器配置
  async function saveAdapter(config) {
    const newConfig = { ...config, enabled: true };
    const result = await api.saveAdapters([...adapters.value, newConfig]);
    await fetchAdapters();
    return result;
  }

  // 删除适配器
  async function deleteAdapter(conn) {
    const filtered = adapters.value.filter(a => {
      const idMatch = conn.id && a.id === conn.id;
      const nameMatch = conn.name && a.name === conn.name;
      return !idMatch && !nameMatch;
    });
    await api.saveAdapters(filtered);
    await fetchAdapters();
  }

  // 重置适配器凭证
  async function resetCredentials(type) {
    return await api.resetCredentials(type);
  }

  // 手动连接适配器
  async function connectAdapter(name) {
    const result = await api.connectAdapter(name);
    await fetchAdapters();
    return result;
  }

  // 手动断开适配器
  async function disconnectAdapter(name) {
    const result = await api.disconnectAdapter(name);
    await fetchAdapters();
    return result;
  }

  return { adapters, fetchAdapters, testAdapter, saveAdapter, deleteAdapter, resetCredentials, connectAdapter, disconnectAdapter };
});
