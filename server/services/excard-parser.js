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
  let currentResource = null
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

    // 解析 H2 标题（支持中英文）
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim().toLowerCase()
      if (title.includes('resource') || title.includes('资源')) {
        currentSection = 'resource dependencies'
      } else if (title.includes('workflow') || title.includes('工作流') || title.includes('执行步骤') || title.includes('步骤')) {
        currentSection = 'execution workflow'
      } else if (title.includes('convention') || title.includes('约定') || title.includes('输出要求') || title.includes('执行约定')) {
        currentSection = 'execution conventions'
      } else if (title.includes('purpose') || title.includes('目的') || title.includes('描述') || title.includes('任务')) {
        currentSection = 'description'
      } else {
        currentSection = title
      }
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
      if (line.startsWith('### ')) {
        // Sub-heading format: ### Resource Name — finalize previous resource first
        if (currentResource && currentResource.name) {
          excard.resources.push(currentResource)
        }
        const resName = line.slice(4).trim()
        if (resName) {
          currentResource = { name: resName, type: '', source: '', path: '', purpose: '' }
        }
      } else if (currentResource && line.match(/^-\s+\*\*/)) {
        // Key-value within resource sub-heading: - **Key**: value
        const kvMatch = line.match(/^-\s+\*\*(.*?)\*\*:\s*(.*)$/)
        if (kvMatch) {
          const key = kvMatch[1].trim().toLowerCase()
          const value = kvMatch[2].trim()
          if (key === 'type') currentResource.type = value
          else if (key === 'source') currentResource.source = value
          else if (key === 'path') currentResource.path = value
          else if (key === 'purpose') currentResource.purpose = value
        }
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Simple list format (only when not inside a sub-heading resource)
        if (!currentResource) {
          const resourceText = line.slice(2).trim()
          excard.resources.push(resourceText)
        }
      } else if (line.startsWith('|') && !line.match(/^\|[\s-|]+\|$/)) {
        // Table format: | Type | Name | Source | Path | Purpose |
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        if (cells.length >= 2 && cells[0] !== 'Resource Type') {
          excard.resources.push({
            type: cells[0] || '-',
            name: cells[1] || '-',
            source: cells[2] || '-',
            path: cells[3] || '-',
            purpose: cells[4] || '-'
          })
        }
      } else if (line.trim() === '' && currentResource) {
        // Blank line = end of current resource
        if (currentResource.name) {
          excard.resources.push(currentResource)
        }
        currentResource = null
      }
    }

    if (currentSection === 'execution workflow') {
      // ### Step N: name format
      if (line.match(/^###\s+step\s+\d+/i)) {
        if (currentStep) excard.workflow.push(currentStep)
        const stepMatch = line.match(/^###\s+[Ss]tep\s+(\d+)\s*[:：]?\s*(.*)$/)
        if (stepMatch) {
          currentStep = {
            index: parseInt(stepMatch[1]),
            name: stepMatch[2].trim(),
            description: '',
            action: '',
            tool: '',
            input: '',
            output: '',
            checkpoint: ''
          }
        }
      }
      // Numbered list format: 1. **name** description
      else if (line.match(/^\d+\.\s/)) {
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
        // Parse key-value pairs in Step sub-heading format
        const kvMatch = line.match(/^-\s+\*\*(.*?)\*\*:\s*(.*)$/)
        if (kvMatch) {
          const key = kvMatch[1].trim().toLowerCase()
          const value = kvMatch[2].trim()
          if (key === 'action') currentStep.action = value
          else if (key === 'tool used' || key === 'tool') currentStep.tool = value
          else if (key === 'input') currentStep.input = value
          else if (key === 'output') currentStep.output = value
          else if (key === 'checkpoint') currentStep.checkpoint = value
          else if (key === 'description') currentStep.description = value
        }
        // Fallback: append to description for numbered list format
        else if (!line.toLowerCase().startsWith('agent:')) {
          if (currentStep.description) currentStep.description += '\n' + rawLine.trim()
          else currentStep.description = rawLine.trim()
        }
      }
    }

    if (currentSection === 'execution conventions') {
      if (line.toLowerCase().startsWith('### input') || line.toLowerCase().startsWith('## input') ||
          line.toLowerCase().includes('### 输入') || line.toLowerCase().includes('## 输入') ||
          line.toLowerCase().includes('input conventions')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        excard.conventions.input = content
      } else if (line.toLowerCase().startsWith('### output') || line.toLowerCase().startsWith('## output') ||
                 line.toLowerCase().includes('### 输出') || line.toLowerCase().includes('## 输出') ||
                 line.toLowerCase().includes('output conventions')) {
        let j = i + 1
        let content = ''
        while (j < lines.length && (lines[j].trim() === '' || !lines[j].trim().startsWith('#'))) {
          if (lines[j].trim()) {
            content = content ? content + '\n' + lines[j].trim() : lines[j].trim()
          }
          j++
        }
        excard.conventions.output = content
      } else if (line.toLowerCase().startsWith('### error') || line.toLowerCase().startsWith('## error') ||
                 line.toLowerCase().includes('### 错误') || line.toLowerCase().includes('## 错误')) {
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
    } else if (currentSection === '输出要求' || currentSection.includes('输出要求')) {
      // 如果有单独的"输出要求"部分，把内容放到 output 约定中
      if (!line.startsWith('#')) {
        if (excard.conventions.output) excard.conventions.output += '\n' + line
        else excard.conventions.output = line
      }
    }
  }

  if (currentStep) excard.workflow.push(currentStep)
  if (currentResource && currentResource.name) excard.resources.push(currentResource)

  return excard
}

/**
 * JSON → ExCard Markdown
 * 输出符合 OpenExCard 规范的格式（清单形式，避免表格）
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

`

  if ((excard.resources || []).length > 0) {
    for (const r of excard.resources) {
      if (typeof r === 'object') {
        md += `### ${r.name || '未命名资源'}
- **Type**: ${r.type || '-'}
- **Source**: ${r.source || '-'}
- **Path**: ${r.path || '-'}
- **Purpose**: ${r.purpose || '-'}

`
      } else {
        md += `- ${r}\n`
      }
    }
  } else {
    md += '暂无\n'
  }

  md += `## Execution Workflow

`

  for (const step of (excard.workflow || [])) {
    md += `### Step ${step.index || 1}: ${step.name || ''}
- **Action**: ${step.action || step.description || '-'}
- **Tool Used**: ${step.tool || '-'}
- **Input**: ${step.input || '-'}
- **Output**: ${step.output || '-'}
- **Checkpoint**: ${step.checkpoint || '-'}

`
  }

  md += `## Execution Conventions

### Input Conventions
${excard.conventions?.input || '-'}

### Output Conventions
${excard.conventions?.output || '-'}

### Error Handling
${excard.conventions?.errorHandling || '-'}
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
