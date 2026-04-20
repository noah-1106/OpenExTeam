/**
 * 测试 ExCard MD 解析器
 */

console.log('🧪 测试 ExCard MD 解析器...\n');

const { parseExcardMd, toExcardMd, generateTasksFromExcard } = require('./services/excard-parser');

// 测试数据
const sampleMd = `---
id: EC-001
name: 标准文章创作
category: content
version: v1.0
tags: writing, article
---

## Resource Dependencies
- Skill: writing_skill
- File: templates/article.md

## Execution Workflow
1. **调研主题**
   - 收集相关资料
   - 输出: research.md

2. **撰写初稿**
   - 基于调研写作
   - 输入: research.md
   - 输出: draft.md

## Execution Conventions
### Input
topics/{topic_id}.json
### Output
outputs/{timestamp}_article.md
### Error Handling
重试 2 次
`;

console.log('1. 测试 Markdown → JSON...');
const parsed = parseExcardMd(sampleMd);
console.log('   ✅ 解析成功');
console.log(`      ID: ${parsed.id}`);
console.log(`      名称: ${parsed.name}`);
console.log(`      步骤数: ${parsed.workflow.length}`);

console.log('\n2. 测试 JSON → Markdown...');
const md = toExcardMd(parsed);
console.log('   ✅ 转换成功');

console.log('\n3. 测试生成 Task 列表...');
const tasks = generateTasksFromExcard(parsed, 'job-123', 'agent-456');
console.log(`   ✅ 生成 ${tasks.length} 个 Task`);
tasks.forEach(t => console.log(`      [${t.stepIndex}] ${t.title}`));

console.log('\n✨ ExCard MD 解析器测试全部通过！');
