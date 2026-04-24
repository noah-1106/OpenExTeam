/**
 * Jest全局设置
 */

// 在所有测试前运行
beforeAll(() => {
  console.log('🚀 开始运行测试...');
});

// 在每个测试前运行
beforeEach(() => {
  // 清除所有mock
  jest.clearAllMocks();
});

// 在每个测试后运行
afterEach(() => {
  // 清理
});

// 在所有测试后运行
afterAll(() => {
  console.log('✅ 测试完成！');
});
