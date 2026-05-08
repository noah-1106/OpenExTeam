<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const localMd = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  localMd.value = val
}, { immediate: true })

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
        class="flex-1 w-full font-mono text-[13px] p-3 bg-[#F6F7FA] border border-[#E8E8EC] rounded-md resize-none outline-none focus:border-[#5B6AD7] transition-all"
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
