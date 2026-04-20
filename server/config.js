/**
 * OpenExTeam Config - 配置加载
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.env.HOME || '/root', '.openexteam');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DB_FILE = path.join(__dirname, 'db', 'openexteam.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true);
}
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

function loadConfig() {
  try {
    return fs.existsSync(CONFIG_FILE)
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      : { adapters: [], theme: 'light' };
  } catch {
    return { adapters: [], theme: 'light' };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

module.exports = {
  DATA_DIR,
  CONFIG_FILE,
  DB_FILE,
  loadConfig,
  saveConfig
};
