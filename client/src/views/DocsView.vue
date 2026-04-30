<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import api from '../api/client'

const docs = ref([])
const selectedDoc = ref(null)
const selectedContent = ref('')
const loading = ref(true)
const loadingContent = ref(false)

async function fetchDocs() {
  try {
    loading.value = true
    const data = await api.getDocs()
    docs.value = data.docs || []
    if (docs.value.length > 0 && !selectedDoc.value) {
      selectDoc(docs.value[0])
    }
  } catch (err) {
    console.error('[Docs] Failed to load docs:', err)
  } finally {
    loading.value = false
  }
}

async function selectDoc(doc) {
  selectedDoc.value = doc
  loadingContent.value = true
  try {
    const data = await api.getDocContent(doc.filename)
    selectedContent.value = data.content || ''
  } catch (err) {
    console.error('[Docs] Failed to load doc content:', err)
    selectedContent.value = ''
  } finally {
    loadingContent.value = false
  }
}

const renderedContent = computed(() => {
  if (!selectedContent.value) return ''
  const raw = marked.parse(selectedContent.value)
  return DOMPurify.sanitize(raw)
})

onMounted(fetchDocs)
</script>

<template>
  <div class="flex gap-4 h-full">
    <!-- 左侧：文档列表 -->
    <div class="w-64 flex-shrink-0 overflow-y-auto">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-primary">文档</h2>
        <p class="text-sm text-secondary mt-0.5">使用指南与连接说明</p>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="text-sm text-muted py-4 text-center">加载中...</div>
      <!-- 空状态 -->
      <div v-else-if="docs.length === 0" class="text-sm text-muted py-4 text-center">暂无文档</div>
      <!-- 文档列表 -->
      <div v-else class="space-y-1">
        <div
          v-for="doc in docs"
          :key="doc.id"
          @click="selectDoc(doc)"
          :class="[
            'p-3 rounded-lg cursor-pointer transition-all duration-150',
            selectedDoc?.id === doc.id
              ? 'bg-accent-dim border border-accent/30 shadow-xs'
              : 'hover:bg-surface-raised border border-transparent'
          ]"
        >
          <div class="text-sm font-medium text-primary">{{ doc.title }}</div>
        </div>
      </div>
    </div>

    <!-- 右侧：文档内容 -->
    <div class="flex-1 bg-surface rounded-xl border border-border-subtle overflow-hidden flex flex-col">
      <div v-if="selectedDoc" class="flex flex-col h-full">
        <!-- 头部 -->
        <div class="px-6 py-4 border-b border-border-subtle flex-shrink-0">
          <h3 class="text-lg font-semibold text-primary">{{ selectedDoc.title }}</h3>
        </div>
        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loadingContent" class="text-sm text-muted text-center py-8">加载中...</div>
          <div
            v-else
            class="prose prose-sm max-w-none"
            v-html="renderedContent"
          ></div>
        </div>
      </div>
      <div v-else-if="!loading" class="flex items-center justify-center h-full text-muted">
        请选择一篇文档查看
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Prose styles for markdown rendering */
.prose h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937; }
.prose h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; margin-top: 1.5rem; color: #374151; }
.prose h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1rem; color: #374151; }
.prose p { margin-bottom: 0.75rem; line-height: 1.6; color: #4b5563; }
.prose ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose li { margin-bottom: 0.25rem; color: #4b5563; }
.prose code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; color: #dc2626; }
.prose pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 0.75rem; }
.prose pre code { background: transparent; padding: 0; color: inherit; }
.prose table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; }
.prose th, .prose td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
.prose th { background: #f9fafb; font-weight: 600; }
</style>
