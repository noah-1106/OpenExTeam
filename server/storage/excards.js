/**
 * ExCard 存储层
 * 将 ExCard 存为 JSON 文件，支持 CRUD 操作
 * 路径: ~/.openexteam/excards/{id}.json
 */

const path = require('path');
const fs = require('fs');

const EXCARDS_DIR = path.join(process.env.HOME || '/root', '.openexteam', 'excards');

if (!fs.existsSync(EXCARDS_DIR)) {
  fs.mkdirSync(EXCARDS_DIR, { recursive: true });
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
        agentName: data.agentName,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        version: data.version,
        updatedAt: data.updatedAt,
        taskCount: data.taskCount || 0,
        resourceCount: data.resources?.length || 0,
        workflowCount: data.workflow?.length || 0,
        redlineCount: data.redlines?.length || 0,
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
    version: data.version || 'v1.0',
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    taskCount: 0,
  };

  fs.writeFileSync(file, JSON.stringify(excard, null, 2));
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
    updatedAt: new Date().toISOString().split('T')[0],
  };

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * 删除 ExCard
 */
function deleteExcard(id) {
  const file = path.join(EXCARDS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`ExCard ${id} not found`);
  fs.unlinkSync(file);
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

module.exports = { listExcards, getExcard, createExcard, updateExcard, deleteExcard, updateTaskCount, EXCARDS_DIR };
