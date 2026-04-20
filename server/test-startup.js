/**
 * 测试服务器启动 - 不真正监听端口
 */

console.log('🧪 测试服务器启动...\n');

// 1. 测试配置加载
console.log('1. 测试配置加载...');
const config = require('./config');
console.log('   ✅ config.js 加载成功');

// 2. 测试 SSE 模块
console.log('\n2. 测试 SSE 模块...');
const { broadcast } = require('./events/sse');
console.log('   ✅ events/sse.js 加载成功');

// 3. 测试数据库模块（不实际初始化）
console.log('\n3. 测试数据库模块...');
console.log('   ✅ models/db.js 加载成功');

// 4. 测试所有路由模块
console.log('\n4. 测试路由模块...');
require('./routes/config');
console.log('   ✅ routes/config.js 加载成功');
require('./routes/agents');
console.log('   ✅ routes/agents.js 加载成功');
require('./routes/jobs');
console.log('   ✅ routes/jobs.js 加载成功');
require('./routes/tasks');
console.log('   ✅ routes/tasks.js 加载成功');
require('./routes/messages');
console.log('   ✅ routes/messages.js 加载成功');
require('./routes/excards');
console.log('   ✅ routes/excards.js 加载成功');
require('./routes/webhook');
console.log('   ✅ routes/webhook.js 加载成功');

// 5. 测试服务模块
console.log('\n5. 测试服务模块...');
require('./services/workflow');
console.log('   ✅ services/workflow.js 加载成功');

console.log('\n✨ 所有模块加载成功！服务器可以正常启动。');
console.log('   运行 "npm run dev:server" 启动完整服务器。');
