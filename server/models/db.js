/**
 * OpenExTeam Database - sql.js 封装
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const { DB_FILE } = require('../config');

let db;

function saveDb() {
  if (db) {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  }
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
  // 添加 agent 列（如果表已存在但没有该列）
  try {
    db.run('ALTER TABLE jobs ADD COLUMN agent TEXT');
  } catch (e) {
    // 列可能已存在，忽略错误
  }
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
  if (params == null) params = [];
  params = params.map(p => p === undefined ? null : p);
  db.run(sql, params);
  saveDb();
}

module.exports = {
  initDb,
  queryAll,
  queryGet,
  queryRun
};
