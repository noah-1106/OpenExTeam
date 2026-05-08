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
  <div class="flex h-full">
    <!-- 左侧：文档列表 -->
    <div class="w-[220px] flex-shrink-0 bg-white border-r border-[#E8E8EC] flex flex-col">
      <div class="px-4 py-3 border-b border-[#ECECF0]">
        <h2 class="text-[14px] font-semibold text-[#2D2D35]">文档</h2>
        <p class="text-[12px] text-[#9CA3AF] mt-0.5">使用指南与连接说明</p>
      </div>

      <div class="flex-1 overflow-y-auto py-2 px-2">
        <div v-if="loading" class="text-[13px] text-[#9CA3AF] py-4 text-center">加载中...</div>
        <div v-else-if="docs.length === 0" class="text-[13px] text-[#9CA3AF] py-4 text-center">暂无文档</div>
        <div v-else class="space-y-0.5">
          <div
            v-for="doc in docs"
            :key="doc.id"
            @click="selectDoc(doc)"
            :class="[
              'px-3 py-2.5 rounded-md cursor-pointer transition-all duration-150 text-[13px]',
              selectedDoc?.id === doc.id
                ? 'bg-[#F0F1FE] text-[#5B6AD7] font-medium'
                : 'text-[#2D2D35] hover:bg-[#F6F7FA]'
            ]"
          >
            {{ doc.title }}
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：文档内容 -->
    <div class="flex-1 bg-white overflow-hidden flex flex-col">
      <div v-if="selectedDoc" class="flex flex-col h-full">
        <div class="px-6 py-3 border-b border-[#ECECF0] flex-shrink-0">
          <h3 class="text-[15px] font-semibold text-[#2D2D35]">{{ selectedDoc.title }}</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loadingContent" class="text-[13px] text-[#9CA3AF] text-center py-8">加载中...</div>
          <div
            v-else
            class="prose max-w-[720px] mx-auto"
            v-html="renderedContent"
          ></div>
        </div>
      </div>
      <div v-else-if="!loading" class="flex items-center justify-center h-full text-[#9CA3AF]">
        <div class="text-center">
          <svg class="w-10 h-10 text-[#C5C9D3] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <div class="text-[13px]">请选择一篇文档查看</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose {
  line-height: 1.7;
  font-size: 14px;
  color: #2D2D35;
}
.prose h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #2D2D35; }
.prose h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; margin-top: 1.5rem; color: #4A4A55; }
.prose h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1rem; color: #4A4A55; }
.prose p { margin-bottom: 0.75rem; color: #5A5A68; }
.prose ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose li { margin-bottom: 0.25rem; color: #5A5A68; }
.prose code { background: #F0F0F4; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.875rem; color: #B86565; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; }
.prose pre { background: #2D2D35; color: #F6F7FA; padding: 1rem; border-radius: 6px; overflow-x: auto; margin-bottom: 0.75rem; font-size: 13px; }
.prose pre code { background: transparent; padding: 0; color: inherit; }
.prose table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; font-size: 13px; }
.prose th, .prose td { border: 1px solid #E8E8EC; padding: 0.5em 0.75em; text-align: left; }
.prose th { background: #F6F7FA; font-weight: 600; }
.prose blockquote { border-left: 3px solid #5B6AD7; padding-left: 1em; margin-left: 0; margin-bottom: 0.75em; color: #6B6B78; }
.prose a { color: #5B6AD7; text-decoration: none; }
.prose a:hover { text-decoration: underline; }
.prose hr { border: none; border-top: 1px solid #E8E8EC; margin: 1.5em 0; }
</style>
