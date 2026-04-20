/**
 * 测试新架构模块加载
 */

console.log('🧪 测试模块加载...\n');

try {
  console.log('1. 加载 config.js...');
  const config = require('./config');
  console.log('   ✅ config.js 加载成功');
  console.log(`   DATA_DIR: ${config.DATA_DIR}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

try {
  console.log('\n2. 加载 events/sse.js...');
  const sse = require('./events/sse');
  console.log('   ✅ events/sse.js 加载成功');
  console.log(`   broadcast 函数: ${typeof sse.broadcast}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

try {
  console.log('\n3. 加载 models/db.js...');
  const db = require('./models/db');
  console.log('   ✅ models/db.js 加载成功');
  console.log(`   initDb 函数: ${typeof db.initDb}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

try {
  console.log('\n4. 加载 models/job.js...');
  const job = require('./models/job');
  console.log('   ✅ models/job.js 加载成功');
  console.log(`   createJob 函数: ${typeof job.createJob}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

try {
  console.log('\n5. 加载 services/workflow.js...');
  const workflow = require('./services/workflow');
  console.log('   ✅ services/workflow.js 加载成功');
  console.log(`   startWorkflow 函数: ${typeof workflow.startWorkflow}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

try {
  console.log('\n6. 加载 routes/jobs.js...');
  const jobsRoute = require('./routes/jobs');
  console.log('   ✅ routes/jobs.js 加载成功');
  console.log(`   setupJobsRoutes 函数: ${typeof jobsRoute.setupJobsRoutes}`);
} catch (e) {
  console.error(`   ❌ 失败: ${e.message}`);
}

console.log('\n✨ 模块加载测试完成！');
