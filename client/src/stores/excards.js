/**
 * ExCard Store - 管理 ExCard 列表和选中状态
 * 使用 Pinia + API 替换 mock.js
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/client';

export const useExcardStore = defineStore('excards', () => {
  const excards = ref([]);          // 列表（摘要）
  const selectedExcard = ref(null); // 当前选中完整对象
  const loading = ref(false);
  const error = ref(null);

  /** 加载 ExCard 列表 */
  async function fetchExcards() {
    loading.value = true;
    error.value = null;
    try {
      const data = await api.getExcards();
      excards.value = data.excards || [];
    } catch (err) {
      error.value = err.message;
      console.error('[ExcardStore] fetchExcards:', err);
    } finally {
      loading.value = false;
    }
  }

  /** 加载单个 ExCard 完整内容 */
  async function fetchExcard(id) {
    try {
      const ec = await api.getExcard(id);
      selectedExcard.value = ec;
      return ec;
    } catch (err) {
      console.error('[ExcardStore] fetchExcard:', err);
      return null;
    }
  }

  /** 选中并加载完整内容 */
  async function selectExcard(ec) {
    if (!ec) { selectedExcard.value = null; return; }
    // 列表已有摘要，直接加载完整版
    selectedExcard.value = await fetchExcard(ec.id);
  }

  /** 创建 ExCard */
  async function createExcard(data) {
    const result = await api.createExcard(data);
    await fetchExcards(); // 刷新列表
    return result;
  }

  /** 更新 ExCard */
  async function updateExcard(id, data) {
    const result = await api.updateExcard(id, data);
    // 刷新列表和详情
    await fetchExcards();
    if (selectedExcard.value?.id === id) {
      await fetchExcard(id);
    }
    return result;
  }

  /** 删除 ExCard */
  async function deleteExcard(id) {
    await api.deleteExcard(id);
    if (selectedExcard.value?.id === id) {
      selectedExcard.value = null;
    }
    await fetchExcards();
  }

  return {
    excards, selectedExcard, loading, error,
    fetchExcards, fetchExcard, selectExcard,
    createExcard, updateExcard, deleteExcard,
  };
});
