/**
 * ExCard MD 解析器
 * 支持：Markdown ↔ JSON 互转，以及从 ExCard 生成 Task 列表
 */

const fs = require('fs');
const path = require('path');
const { EXCARDS_MD_DIR } = require('../storage/excards');
const { v4: uuidv4 } = require('uuid');

/**
 * 解析 ExCard Markdown → JSON
 */
function parseExcardMd(mdContent) {
  const excard = {
    id: '',
    name: '',
    description: '',
    category: 'general',
    tags: [],
    version: 'v1.0',
    resources: [],
    workflow: [],
    conventions: {
      input: null,
      output: null,
      errorHandling: null
    }
  };

  const lines = mdContent.split('\n');
  let currentSection = '';
  let currentStep = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 解析 Frontmatter (--- 开头)
    if (line === '---') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '---') {
        const fmLine = lines[j].trim();
        if (fmLine.startsWith('id:')) excard.id = fmLine.slice(3).trim();
        if (fmLine.startsWith('name:')) excard.name = fmLine.slice(5).trim();
        if (fmLine.startsWith('category:')) excard.category = fmLine.slice(9).trim();
        if (fmLine.startsWith('version:')) excard.version = fmLine.slice(8).trim();
        if (fmLine.startsWith('tags:')) {
          excard.tags = fmLine.slice(5).trim().split(',').map(t => t.trim()).filter(Boolean);
        }
        j++;
      }
      i = j;
      continue;
    }

    // 解析 H2 标题
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase();
      continue;
    }

    // 解析各 section 内容
    if (currentSection === 'resource dependencies' || currentSection === 'resource dependencies') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        excard.resources.push(line.slice(2).trim());
      }
    }

    if (currentSection === 'execution workflow' || currentSection === 'execution workflow') {
      if (line.match(/^\d+\.\s/)) {
        if (currentStep) excard.workflow.push(currentStep);
        const stepMatch = line.match(/^(\d+)\.\s\*\*(.*?)\*\*(.*)$/);
        if (stepMatch) {
          currentStep = {
            index: parseInt(stepMatch[1]),
            name: stepMatch[2].trim(),
            description: stepMatch[3].trim()
          };
        } else {
          const simpleMatch = line.match(/^(\d+)\.\s(.*)$/);
          currentStep = {
            index: parseInt(simpleMatch[1]),
            name: simpleMatch[2].trim(),
            description: ''
          };
        }
      } else if (currentStep && line.startsWith('- ')) {
        if (!currentStep.actions) currentStep.actions = [];
        currentStep.actions.push(line.slice(2).trim());
      }
    }

    if (currentSection === 'execution conventions' || currentSection === 'execution conventions') {
      if (line.startsWith('### Input') || line.startsWith('### Input')) {
        excard.conventions.input = lines[i + 1]?.trim() || '';
      }
      if (line.startsWith('### Output') || line.startsWith('### Output')) {
        excard.conventions.output = lines[i + 1]?.trim() || '';
      }
      if (line.startsWith('### Error Handling') || line.startsWith('### Error Handling')) {
        excard.conventions.errorHandling = lines[i + 1]?.trim() || '';
      }
    }
  }

  if (currentStep) excard.workflow.push(currentStep);

  return excard;
}

/**
 * JSON → ExCard Markdown
 */
function toExcardMd(excard) {
  let md = `---
id: ${excard.id}
name: ${excard.name}
category: ${excard.category || 'general'}
version: ${excard.version || 'v1.0'}
tags: ${(excard.tags || []).join(', ')}
---

# ${excard.name}

${excard.description || ''}

## Resource Dependencies

${(excard.resources || []).map(r => `- ${r}`).join('\n')}

## Execution Workflow

${(excard.workflow || []).map(step => {
  let stepMd = `${step.index}. **${step.name}**`;
  if (step.description) stepMd += ` ${step.description}`;
  if (step.actions && step.actions.length) {
    stepMd += '\n' + step.actions.map(a => `  - ${a}`).join('\n');
  }
  return stepMd;
}).join('\n\n')}

## Execution Conventions

### Input
${excard.conventions?.input || ''}

### Output
${excard.conventions?.output || ''}

### Error Handling
${excard.conventions?.errorHandling || ''}
`;
  return md;
}

/**
 * 从 ExCard 生成 Task 列表
 */
function generateTasksFromExcard(excard, jobId, agentId) {
  return (excard.workflow || []).map(step => ({
    id: uuidv4(),
    jobId,
    title: step.name,
    description: step.description + (step.actions ? '\n\n' + step.actions.map(a => `- ${a}`).join('\n') : ''),
    agent: agentId,
    status: 'todo',
    stepIndex: step.index,
    excardStep: step.index
  }));
}

/**
 * 保存 ExCard MD 文件
 */
function saveExcardMd(id, mdContent) {
  const file = path.join(EXCARDS_MD_DIR, `${id}.md`);
  fs.writeFileSync(file, mdContent, 'utf8');
  return file;
}

/**
 * 读取 ExCard MD 文件
 */
function loadExcardMd(id) {
  const file = path.join(EXCARDS_MD_DIR, `${id}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

module.exports = {
  parseExcardMd,
  toExcardMd,
  generateTasksFromExcard,
  saveExcardMd,
  loadExcardMd
};
