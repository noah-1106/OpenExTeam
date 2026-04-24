/**
 * Jest配置文件
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],

  // 覆盖率配置
  collectCoverageFrom: [
    '**/*.{js,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/jest.config.js'
  ],

  // 覆盖率报告目录
  coverageDirectory: 'coverage',

  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // 测试超时时间
  testTimeout: 30000,

  // 全局设置
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
};
