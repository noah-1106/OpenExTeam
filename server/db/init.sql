-- OpenExTeam 初始化数据
-- 运行: cd server && sqlite3 db/openexteam.db < db/init.sql

-- 清空现有数据
DELETE FROM message_log;
DELETE FROM workflow_state;
DELETE FROM tasks;
DELETE FROM jobs;

-- 插入示例 Jobs
INSERT INTO jobs (id, title, description, type, status, excard_id) VALUES
('job-1', 'OpenExTeam MVP开发', '完成Phase 1所有功能', 'one-time', 'in-progress', NULL),
('job-2', '每日技术调研', '每天收集AI Agent领域最新动态', 'recurring', 'in-progress', 'ec-004');

-- 插入示例 Tasks (Job 1: MVP开发)
INSERT INTO tasks (id, job_id, title, description, agent, status, created_at) VALUES
('task-1', 'job-1', '调研竞品Mission Control', '分析其Adapter实现思路', '品品', 'done', '2026-04-14 08:00:00'),
('task-2', 'job-1', '编写PRD需求文档', '整理产品功能规格', '品品', 'done', '2026-04-14 09:00:00'),
('task-3', 'job-1', '设计系统架构', '完成Adapter层接口定义', '品品', 'in-progress', '2026-04-14 10:00:00'),
('task-4', 'job-1', '搭建前端项目结构', 'Vue3 + Vite + TailwindCSS', '前前', 'todo', '2026-04-14 11:00:00'),
('task-5', 'job-1', '开发OpenClaw Adapter', '实现healthCheck、listAgents', '开开', 'todo', '2026-04-14 11:30:00'),
('task-6', 'job-1', '开发任务看板界面', '拖拽卡片、创建任务、详情面板', '前前', 'todo', '2026-04-14 14:00:00'),
('task-7', 'job-1', '开发监控面板', 'Agent状态、Token消耗、实时日志', '前前', 'todo', '2026-04-14 15:00:00'),
('task-8', 'job-1', '开发聊天界面', '私聊、群聊、模拟agent回复', '前前', 'todo', '2026-04-14 16:00:00');

-- 插入 Workflow State
INSERT INTO workflow_state (job_id, status, current_step) VALUES
('job-1', 'running', 3);
