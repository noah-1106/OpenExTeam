/**
 * ExCard 存储层
 * 将 ExCard 存为 JSON 文件 + Markdown 文件，支持 CRUD 操作
 * 路径: ~/.openexteam/excards/{id}.json (JSON)
 * 路径: ~/.openexteam/excards-md/{id}.md (Markdown)
 */

const path = require('path');
const fs = require('fs');
// 延迟加载避免循环依赖
let parseExcardMd, toExcardMd;
function getParsers() {
  if (!parseExcardMd) {
    const parsers = require('../services/excard-parser');
    parseExcardMd = parsers.parseExcardMd;
    toExcardMd = parsers.toExcardMd;
  }
  return { parseExcardMd, toExcardMd };
}

const EXCARDS_DIR = path.join(process.env.HOME || '/root', '.openexteam', 'excards');
const EXCARDS_MD_DIR = path.join(process.env.HOME || '/root', '.openexteam', 'excards-md');

if (!fs.existsSync(EXCARDS_DIR)) {
  fs.mkdirSync(EXCARDS_DIR, { recursive: true });
}
if (!fs.existsSync(EXCARDS_MD_DIR)) {
  fs.mkdirSync(EXCARDS_MD_DIR, { recursive: true });
}

/**
 * 从 MD 文件同步到 JSON
 */
function syncFromMd(id) {
  const { parseExcardMd } = getParsers();
  const mdFile = path.join(EXCARDS_MD_DIR, `${id}.md`);
  const jsonFile = path.join(EXCARDS_DIR, `${id}.json`);

  if (fs.existsSync(mdFile) && !fs.existsSync(jsonFile)) {
    const mdContent = fs.readFileSync(mdFile, 'utf8');
    const parsed = parseExcardMd(mdContent);
    fs.writeFileSync(jsonFile, JSON.stringify(parsed, null, 2));
    return parsed;
  }
  return null;
}

/**
 * 从 JSON 同步到 MD 文件
 */
function syncToMd(excard) {
  const { toExcardMd } = getParsers();
  const mdFile = path.join(EXCARDS_MD_DIR, `${excard.id}.md`);
  const mdContent = toExcardMd(excard);
  fs.writeFileSync(mdFile, mdContent, 'utf8');
  return mdFile;
}

/**
 * 列出所有 ExCard
 */
function listExcards() {
  if (!fs.existsSync(EXCARDS_DIR)) return [];
  const files = fs.readdirSync(EXCARDS_DIR).filter(f => f.endsWith('.json'));
  return files.map(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(EXCARDS_DIR, file), 'utf8'));
      // 返回摘要（不含完整 workflow/conventions 等大字段）
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        version: data.version,
        updatedAt: data.updatedAt,
        taskCount: data.taskCount || 0,
        resources: data.resources || [],
        workflow: data.workflow || []
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * 获取单个 ExCard 完整内容
 */
function getExcard(id) {
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 创建 ExCard
 */
function createExcard(data) {
  const id = data.id;
  if (!id) throw new Error('ExCard ID is required');
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  if (fs.existsSync(file)) throw new Error(`ExCard ${id} already exists`);

  const excard = {
    ...data,
    agent: data.agent || '',
    version: data.version || 'v1.0',
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    taskCount: 0
  };

  fs.writeFileSync(file, JSON.stringify(excard, null, 2));
  syncToMd(excard); // 同步创建 MD 文件
  return excard;
}

/**
 * 更新 ExCard
 */
function updateExcard(id, updates) {
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`ExCard ${id} not found`);

  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  const updated = {
    ...existing,
    ...updates,
    id, // 禁止修改 ID
    updatedAt: new Date().toISOString().split('T')[0]
  };

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  syncToMd(updated); // 同步更新 MD 文件
  return updated;
}

/**
 * 获取 ExCard Markdown 内容
 */
function getExcardMd(id) {
  const mdFile = path.join(EXCARDS_MD_DIR, `${id}.md`);
  if (!fs.existsSync(mdFile)) {
    const excard = getExcard(id);
    if (excard) {
      syncToMd(excard);
      return fs.readFileSync(mdFile, 'utf8');
    }
    return null;
  }
  return fs.readFileSync(mdFile, 'utf8');
}

/**
 * 更新 ExCard Markdown 内容（解析并同步到 JSON）
 */
function updateExcardMd(id, mdContent) {
  const { parseExcardMd } = getParsers();
  const mdFile = path.join(EXCARDS_MD_DIR, `${id}.md`);
  const jsonFile = path.join(EXCARDS_DIR, `${id}.json`);

  if (!fs.existsSync(jsonFile)) throw new Error(`ExCard ${id} not found`);

  // 解析 MD 并合并到现有数据
  const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const parsed = parseExcardMd(mdContent);

  const updated = {
    ...existing,
    ...parsed,
    id, // 保持原 ID
    updatedAt: new Date().toISOString().split('T')[0]
  };

  // 保存两个文件
  fs.writeFileSync(mdFile, mdContent, 'utf8');
  fs.writeFileSync(jsonFile, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * 删除 ExCard
 */
function deleteExcard(id) {
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  const mdFile = path.join(EXCARDS_MD_DIR, `${id}.md`);

  if (!fs.existsSync(file)) throw new Error(`ExCard ${id} not found`);

  fs.unlinkSync(file);
  if (fs.existsSync(mdFile)) fs.unlinkSync(mdFile);

  return true;
}

/**
 * 更新 ExCard 绑定的任务数
 */
function updateTaskCount(id, count) {
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.taskCount = count;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  listExcards,
  getExcard,
  createExcard,
  updateExcard,
  deleteExcard,
  updateTaskCount,
  getExcardMd,
  updateExcardMd,
  EXCARDS_DIR,
  EXCARDS_MD_DIR
};
