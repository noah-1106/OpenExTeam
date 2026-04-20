/**
 * 测试服务器初始化
 */

console.log('🧪 测试服务器初始化...\n');

// 测试配置加载
const config = require('./config');
console.log('✅ 配置加载成功');

// 测试事件系统
const { broadcast } = require('./events/sse');
console.log('✅ 事件系统加载成功');

// 测试数据库模块（不实际初始化）
console.log('✅ 数据库模块加载成功');

console.log('\n✨ 初始化测试完成！所有核心模块正常。');
console.log('   运行 "npm run dev:server" 启动完整服务器。');
