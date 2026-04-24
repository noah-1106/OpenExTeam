/**
 * OpenExTeam Database - sql.js 封装
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const { DB_FILE } = require('../config');

let db;
let saveTimeout = null;
const SAVE_DELAY_MS = 100; // 100ms节流
let pendingSave = false;

// 事务支持
let inTransaction = false;

function saveDb() {
  if (!db) return;

  // 如果有定时器，清除它
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  try {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
    pendingSave = false;
  } catch (err) {
    console.error('[DB] Failed to save database:', err.message);
    // 如果保存失败，稍后重试
    if (!pendingSave) {
      pendingSave = true;
      saveTimeout = setTimeout(saveDb, 1000);
    }
  }
}

// 节流保存：延迟写入，合并多次操作
function throttledSaveDb() {
  if (inTransaction) return; // 事务中不保存，等事务提交

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(saveDb, SAVE_DELAY_MS);
}

async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
    type TEXT DEFAULT 'one-time', status TEXT DEFAULT 'idle',
    excard_id TEXT, agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 添加周期性任务新字段（向后兼容）
  try { db.run('ALTER TABLE jobs ADD COLUMN agent TEXT'); } catch (e) {}
  try { db.run('ALTER TABLE jobs ADD COLUMN schedule_type TEXT DEFAULT "daily"'); } catch (e) {}
  try { db.run('ALTER TABLE jobs ADD COLUMN schedule_days TEXT DEFAULT "[1,2,3,4,5]"'); } catch (e) {}
  try { db.run('ALTER TABLE jobs ADD COLUMN schedule_times TEXT DEFAULT "[\'09:00\']"'); } catch (e) {}

  // 新增 Job 步骤表，支持 Task 和 ExCard 混合编排
  db.run(`CREATE TABLE IF NOT EXISTS job_steps (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL DEFAULT 'task', title TEXT NOT NULL, description TEXT,
    agent TEXT, excard_id TEXT, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT, agent TEXT NOT NULL, status TEXT DEFAULT 'todo',
    step_index INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workflow_state (
    job_id TEXT PRIMARY KEY, status TEXT DEFAULT 'idle',
    current_step INTEGER DEFAULT 0, started_at DATETIME, completed_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS message_log (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, job_id TEXT, task_id TEXT,
    from_agent TEXT, to_agent TEXT, content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  saveDb();
  console.log('[DB] Initialized at', DB_FILE);
}

function queryAll(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  if (params == null) params = [];
  params = params.map(p => p === undefined ? null : p);
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function queryGet(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function queryRun(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  if (params == null) params = [];
  params = params.map(p => p === undefined ? null : p);
  db.run(sql, params);
  throttledSaveDb();
}

// 事务支持
function beginTransaction() {
  if (inTransaction) {
    console.warn('[DB] Transaction already in progress');
    return;
  }
  db.run('BEGIN TRANSACTION');
  inTransaction = true;
}

function commitTransaction() {
  if (!inTransaction) {
    console.warn('[DB] No transaction in progress');
    return;
  }
  db.run('COMMIT');
  inTransaction = false;
  saveDb(); // 事务提交后立即保存
}

function rollbackTransaction() {
  if (!inTransaction) {
    console.warn('[DB] No transaction in progress');
    return;
  }
  try {
    db.run('ROLLBACK');
  } catch (e) {
    console.warn('[DB] Rollback failed:', e.message);
  }
  inTransaction = false;
  // 回滚不需要保存
}

// 事务包裹函数
async function runTransaction(fn) {
  beginTransaction();
  try {
    const result = await fn();
    commitTransaction();
    return result;
  } catch (err) {
    rollbackTransaction();
    throw err;
  }
}

// 进程退出时确保保存
process.on('exit', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveDb();
});

process.on('SIGINT', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveDb();
  process.exit();
});

module.exports = {
  initDb,
  queryAll,
  queryGet,
  queryRun,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  runTransaction
};
