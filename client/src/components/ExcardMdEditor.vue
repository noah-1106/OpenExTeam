<script setup>
/**
 * ExCard Markdown 编辑器组件
 * 支持：表单编辑 ↔ Markdown 编辑 双向同步
 * 标准格式：Frontmatter + 标准 sections
 */
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const localMd = ref(props.modelValue)

/**
 * 解析 Markdown 到表单数据
 */
function parseMdToForm(md) {
  const data = {
    name: '',
    description: '',
    category: 'general',
    tags: [],
    resources: [],
    workflow: [],
    conventions: {
      input: '',
      output: '',
      errorHandling: ''
    }
  }

  const lines = md.split('\n')
  let currentSection = ''
  let currentStep = null
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const rawLine = lines[i]

    // 解析 Frontmatter
    if (line === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }

    if (inFrontmatter) {
      if (line.startsWith('name:')) data.name = line.slice(5).trim()
      if (line.startsWith('category:')) data.category = line.slice(9).trim()
      if (line.startsWith('tags:')) {
        data.tags = line.slice(5).trim().split(',').map(t => t.trim()).filter(Boolean)
      }
      continue
    }

    // 解析 H1 标题作为名称
    if (line.startsWith('# ')) {
      if (!data.name) data.name = line.slice(2).trim()
      continue
    }

    // 解析 H2 标题
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase()
      continue
    }

    // description (H1 后面的文本)
    if (!currentSection && line && !line.startsWith('#')) {
      if (data.description) data.description += '\n' + line
      else data.description = line
      continue
    }

    // 解析各 section 内容
    if (currentSection === 'resource dependencies') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        data.resources.push(line.slice(2).trim())
      }
    }

    if (currentSection === 'execution workflow') {
      if (line.match(/^\d+\.\s/)) {
        if (currentStep) data.workflow.push(currentStep)
        const stepMatch = line.match(/^(\d+)\.\s\*\*(.*?)\*\*(.*)$/)
        if (stepMatch) {
          currentStep = {
            index: parseInt(stepMatch[1]),
            name: stepMatch[2].trim(),
            description: stepMatch[3].trim()
          }
        } else {
          const simpleMatch = line.match(/^(\d+)\.\s(.*)$/)
          currentStep = {
            index: parseInt(simpleMatch[1]),
            name: simpleMatch[2].trim(),
            description: ''
          }
        }
      } else if (currentStep && line) {
        if (currentStep.description) currentStep.description += '\n' + rawLine.trim()
        else currentStep.description = rawLine.trim()
      }
    }

    if (currentSection === 'execution conventions') {
      if (line.startsWith('### Input')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        data.conventions.input = content
      }
      if (line.startsWith('### Output')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        data.conventions.output = content
      }
      if (line.startsWith('### Error Handling')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        data.conventions.errorHandling = content
      }
    }
  }

  if (currentStep) data.workflow.push(currentStep)
  return data
}

/**
 * 表单数据 转 Markdown
 */
function formToMd(data) {
  let md = `---
name: ${data.name}
category: ${data.category || 'general'}
tags: ${(data.tags || []).join(', ')}
---

# ${data.name}

${data.description || ''}

## Resource Dependencies

${(data.resources || []).map(r => `- ${r}`).join('\n')}

## Execution Workflow

`

  for (const step of (data.workflow || [])) {
    let stepMd = `${step.index || 1}. **${step.name}**`
    if (step.description) stepMd += ` ${step.description}`
    md += stepMd + '\n\n'
  }

  md += `## Execution Conventions

### Input
${data.conventions?.input || ''}

### Output
${data.conventions?.output || ''}

### Error Handling
${data.conventions?.errorHandling || ''}
`

  return md
}

// 监听外部传入的 modelValue
watch(() => props.modelValue, (val) => {
  localMd.value = val
}, { immediate: true })

// 监听本地 Markdown 变化，同步到父组件
watch(localMd, (val) => {
  emit('update:modelValue', val)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 flex flex-col">
      <textarea
        v-model="localMd"
        :readonly="readonly"
        class="flex-1 w-full font-mono text-sm p-3 bg-surface-raised border border-border rounded-lg resize-none focus:outline-none focus:border-accent"
        placeholder="---
name: 示例 ExCard
category: general
tags: 标签1, 标签2
---

# 示例 ExCard

描述内容

## Resource Dependencies

- 资源1
- 资源2

## Execution Workflow

1. **步骤1** 描述内容
2. **步骤2** 描述内容

## Execution Conventions

### Input
输入约定

### Output
输出约定

### Error Handling
错误处理约定"
      />
    </div>
  </div>
</template>
