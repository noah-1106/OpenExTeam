/**
 * Adapter 加载器
 * 根据配置动态加载对应框架的 Adapter
 */

const OpenClawAdapter = require('./openclaw');
const HermesAdapter = require('./hermes');
const DeerFlowAdapter = require('./deerflow');

const adapters = {
  openclaw: OpenClawAdapter,
  hermes: HermesAdapter,
  deerflow: DeerFlowAdapter
};

/**
 * 创建指定类型的 Adapter 实例
 * @param {string} type - 框架类型 (openclaw/deerflow/hermes)
 * @param {Object} config - 框架连接配置
 * @returns {AgentAdapter}
 */
function createAdapter(type, config) {
  const AdapterClass = adapters[type?.toLowerCase()];
  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${type}`);
  }
  return new AdapterClass(config);
}

/**
 * 获取所有可用 Adapter 类型
 */
function getAvailableAdapters() {
  return Object.keys(adapters);
}

module.exports = {
  createAdapter,
  getAvailableAdapters
};
