<script setup>
/**
 * ExCard Markdown 编辑器组件
 * 支持用户和 Agent 直接编辑 MD 格式
 */
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const editMode = ref('form') // 'form' 或 'md'
const localMd = ref(props.modelValue)

// 解析 MD 为 JSON 的占位（实际用 excard-parser）
function parseMdToJson(md) {
  return {
    id: '',
    name: '',
    description: '',
    category: 'general',
    tags: [],
    resources: [],
    workflow: [],
    conventions: { input: '', output: '', errors: [] },
    redlines: []
  }
}

// JSON 转 MD 的占位
function jsonToMd(json) {
  return `---
id: ${json.id || ''}
name: ${json.name || ''}
category: ${json.category || 'general'}
version: v1.0
tags: ${(json.tags || []).join(', ')}
---

## Resource Dependencies
${(json.resources || []).map(r => `- ${r.name}`).join('\n')}

## Execution Workflow
${(json.workflow || []).map(s => `${s.index || '1'}. **${s.name}**\n   - ${s.desc || ''}`).join('\n\n')}

## Execution Conventions
### Input
${json.conventions?.input || ''}

### Output
${json.conventions?.output || ''}
`
}

watch(() => props.modelValue, (val) => {
  localMd.value = val
})

watch(localMd, (val) => {
  emit('update:modelValue', val)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 模式切换 -->
    <div class="flex items-center gap-2 mb-3 border-b border-border pb-2">
      <button
        @click="editMode = 'form'"
        :class="[
          'px-3 py-1 text-xs rounded transition-all',
          editMode === 'form'
            ? 'bg-accent text-white'
            : 'text-secondary hover:text-primary'
        ]"
      >
        📝 表单编辑
      </button>
      <button
        @click="editMode = 'md'"
        :class="[
          'px-3 py-1 text-xs rounded transition-all',
          editMode === 'md'
            ? 'bg-accent text-white'
            : 'text-secondary hover:text-primary'
        ]"
      >
        📄 Markdown
      </button>
      <span class="text-xs text-muted ml-auto">
        {{ editMode === 'md' ? 'Agent 可直接编辑此 MD 文件' : '表单模式更易用' }}
      </span>
    </div>

    <!-- MD 编辑模式 -->
    <div v-if="editMode === 'md'" class="flex-1 flex flex-col">
      <textarea
        v-model="localMd"
        :readonly="readonly"
        class="flex-1 w-full font-mono text-sm p-3 bg-surface-raised border border-border rounded-lg resize-none focus:outline-none focus:border-accent"
        placeholder="在此编辑 ExCard Markdown..."
      />
    </div>

    <!-- 表单模式提示（实际表单在 ExcardView） -->
    <div v-else class="flex-1 flex items-center justify-center text-muted">
      <div class="text-center">
        <div class="text-3xl mb-2">📝</div>
        <div class="text-sm">请使用下方的表单编辑</div>
        <div class="text-xs mt-1">或切换到 Markdown 模式直接编辑 MD</div>
      </div>
    </div>
  </div>
</template>
