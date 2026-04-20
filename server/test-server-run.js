/**
 * 快速测试服务器启动（然后立即关闭）
 */

console.log('🧪 测试服务器启动...\n');

const http = require('http');

// 临时创建一个测试服务器
const testServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// 测试端口是否可用
testServer.listen(0, '127.0.0.1', () => {
  const port = testServer.address().port;
  console.log('✅ 端口可用');
  testServer.close(() => {
    console.log('✅ HTTP 服务器测试通过');

    // 测试加载 express app
    try {
      console.log('\n📦 加载 Express app...');
      const app = require('./index');
      console.log('✅ Express app 加载成功');
      console.log('\n✨ 服务器可以正常启动！');
      console.log('   运行 "npm run dev:server" 启动完整服务器。');
      process.exit(0);
    } catch (e) {
      console.error('❌ Express app 加载失败:', e.message);
      process.exit(1);
    }
  });
});

testServer.on('error', (e) => {
  console.error('❌ 端口测试失败:', e.message);
  process.exit(1);
});
