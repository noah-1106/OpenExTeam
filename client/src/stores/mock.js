// Mock data for OpenExTeam Prototype

export const mockAgents = [
  { id: 'agent-1', name: '品品', status: 'busy', framework: 'openclaw', task: '撰写 PRD 文档', avatarUrl: null },
  { id: 'agent-2', name: '开开', status: 'online', framework: 'openclaw', task: null, avatarUrl: null },
  { id: 'agent-3', name: '前前', status: 'online', framework: 'openclaw', task: null, avatarUrl: null },
  { id: 'agent-4', name: '维维', status: 'offline', framework: 'openclaw', task: null, avatarUrl: null },
  { id: 'agent-5', name: '测测', status: 'online', framework: 'deerflow', task: null, avatarUrl: null },
]

export const mockFrameworks = [
  { id: 'oc', name: 'OpenClaw', icon: '🦞', status: 'connected', agentCount: 4 },
  { id: 'deer', name: 'DeerFlow', icon: '🦌', status: 'connected', agentCount: 1 },
  { id: 'her', name: 'Hermes', icon: '🐺', status: 'disconnected', agentCount: 0 },
]

export const mockJobs = [
  {
    id: 'job-1',
    title: 'OpenExTeam MVP 开发',
    description: '完成 Phase 1 所有功能',
    agent: '品品',
    type: 'one-time',
    cycle: null,
    schedule: null,
    excard: null,
    status: 'in-progress',
    createdAt: '2026-04-14 08:00',
  },
  {
    id: 'job-2',
    title: '每日技术调研',
    description: '每天收集 AI Agent 领域最新动态',
    agent: '品品',
    type: 'recurring',
    cycle: 'daily',
    schedule: { cycle: 'daily', time: '09:00' },
    excard: 'ec-004',
    status: 'in-progress',
    createdAt: '2026-04-14 08:00',
  },
]

export const mockTasks = [
  {
    id: 'task-1', jobId: 'job-1',
    title: '调研竞品 Mission Control', description: '分析其 Adapter 实现思路',
    agent: '品品', excard: null, priority: 'medium', status: 'done', createdAt: '2026-04-14 08:00',
  },
  {
    id: 'task-2', jobId: 'job-1',
    title: '编写 PRD 需求文档', description: '整理产品功能规格',
    agent: '品品', excard: null, priority: 'high', status: 'done', createdAt: '2026-04-14 09:00',
  },
  {
    id: 'task-3', jobId: 'job-1',
    title: '设计系统架构', description: '完成 Adapter 层接口定义',
    agent: '品品', excard: null, priority: 'high', status: 'in-progress', createdAt: '2026-04-14 10:00',
  },
  {
    id: 'task-4', jobId: 'job-1',
    title: '搭建前端项目结构', description: 'Vue3 + Vite + TailwindCSS',
    agent: '前前', excard: 'ec-006', priority: 'medium', status: 'todo', createdAt: '2026-04-14 11:00',
  },
  {
    id: 'task-5', jobId: 'job-1',
    title: '开发 OpenClaw Adapter', description: '实现 healthCheck、listAgents',
    agent: '开开', excard: null, priority: 'high', status: 'todo', createdAt: '2026-04-14 11:30',
  },
  {
    id: 'task-6', jobId: 'job-1',
    title: '开发任务看板界面', description: '拖拽卡片、创建任务、详情面板',
    agent: '前前', excard: null, priority: 'medium', status: 'todo', createdAt: '2026-04-14 14:00',
  },
  {
    id: 'task-7', jobId: 'job-1',
    title: '开发监控面板', description: 'Agent 状态、Token 消耗、实时日志',
    agent: '前前', excard: null, priority: 'low', status: 'todo', createdAt: '2026-04-14 15:00',
  },
  {
    id: 'task-8', jobId: 'job-1',
    title: '开发聊天界面', description: '私聊、群聊、模拟 agent 回复',
    agent: '前前', excard: null, priority: 'medium', status: 'todo', createdAt: '2026-04-14 16:00',
  },
]

export const mockConnections = [
  {
    id: 'conn-1', type: 'openclaw', name: '我的 OpenClaw',
    url: 'http://localhost:18789', token: 'sk-xxx...xxx',
    status: 'connected', lastHeartbeat: '2026-04-14 18:00',
  },
]

export const mockExcards = [
  { id: 'EC001-pinpin-standard-article', name: '标准文章创作' },
  { id: 'EC002-pinpin-article-polish', name: '文章润色修改' },
  { id: 'EC003-kaikai-rss-fetch', name: '24小时RSS数据采集' },
  { id: 'EC004-qianqian-frontend-dev', name: '前端开发流程' },
  { id: 'EC005-kaikai-bug-reproduce', name: 'Bug复现流程' },
]
