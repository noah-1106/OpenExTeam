/**
 * ExCard MD 解析器
 * 支持：Markdown ↔ JSON 互转
 * 标准格式：Frontmatter + 标准 sections
 */

const fs = require('fs')
const path = require('path')
const { EXCARDS_MD_DIR } = require('../storage/excards')

/**
 * 解析 ExCard Markdown → JSON
 */
function parseExcardMd(mdContent) {
  const excard = {
    id: '',
    name: '',
    description: '',
    category: 'general',
    agent: '',
    tags: [],
    version: 'v1.0',
    resources: [],
    workflow: [],
    conventions: {
      input: '',
      output: '',
      errorHandling: ''
    }
  }

  const lines = mdContent.split('\n')
  let currentSection = ''
  let currentStep = null
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const rawLine = lines[i]

    // 解析 Frontmatter (--- 开头)
    if (line === '---') {
      inFrontmatter = !inFrontmatter
      continue
    }

    if (inFrontmatter) {
      if (line.startsWith('id:')) excard.id = line.slice(3).trim()
      if (line.startsWith('name:')) excard.name = line.slice(5).trim()
      if (line.startsWith('category:')) excard.category = line.slice(9).trim()
      if (line.startsWith('agent:')) excard.agent = line.slice(6).trim()
      if (line.startsWith('version:')) excard.version = line.slice(8).trim()
      if (line.startsWith('tags:')) {
        excard.tags = line.slice(5).trim().split(',').map(t => t.trim()).filter(Boolean)
      }
      continue
    }

    // 解析 H1 标题作为名称
    if (line.startsWith('# ')) {
      if (!excard.name) excard.name = line.slice(2).trim()
      continue
    }

    // 解析 H2 标题
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase()
      continue
    }

    // description (H1 后面的文本)
    if (!currentSection && line && !line.startsWith('#')) {
      if (excard.description) excard.description += '\n' + line
      else excard.description = line
      continue
    }

    // 解析各 section 内容
    if (currentSection === 'resource dependencies') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const resourceText = line.slice(2).trim()
        excard.resources.push(resourceText)
      }
    }

    if (currentSection === 'execution workflow') {
      if (line.match(/^\d+\.\s/)) {
        if (currentStep) excard.workflow.push(currentStep)
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
        // 继续追加步骤描述
        if (!line.toLowerCase().startsWith('agent:')) {
          if (currentStep.description) currentStep.description += '\n' + rawLine.trim()
          else currentStep.description = rawLine.trim()
        }
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
        excard.conventions.input = content
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
        excard.conventions.output = content
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
        excard.conventions.errorHandling = content
      }
    }
  }

  if (currentStep) excard.workflow.push(currentStep)

  return excard
}

/**
 * JSON → ExCard Markdown
 */
function toExcardMd(excard) {
  let md = `---
id: ${excard.id || ''}
name: ${excard.name}
category: ${excard.category || 'general'}
agent: ${excard.agent || ''}
version: ${excard.version || 'v1.0'}
tags: ${(excard.tags || []).join(', ')}
---

# ${excard.name}

${excard.description || ''}

## Resource Dependencies

${(excard.resources || []).map(r => `- ${r}`).join('\n')}

## Execution Workflow

`

  for (const step of (excard.workflow || [])) {
    let stepMd = `${step.index || 1}. **${step.name}**`
    if (step.description) stepMd += ` ${step.description}`
    md += stepMd + '\n\n'
  }

  md += `## Execution Conventions

### Input
${excard.conventions?.input || ''}

### Output
${excard.conventions?.output || ''}

### Error Handling
${excard.conventions?.errorHandling || ''}
`

  return md
}

/**
 * 保存 ExCard MD 文件
 */
function saveExcardMd(id, mdContent) {
  const file = path.join(EXCARDS_MD_DIR, `${id}.md`)
  fs.writeFileSync(file, mdContent, 'utf8')
  return file
}

/**
 * 读取 ExCard MD 文件
 */
function loadExcardMd(id) {
  const file = path.join(EXCARDS_MD_DIR, `${id}.md`)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8')
}

module.exports = {
  parseExcardMd,
  toExcardMd,
  saveExcardMd,
  loadExcardMd
}
