/**
 * Jobs API Routes - 工作 API 路由
 *
 * 设计原则：
 * - Job 可以绑定 ExCard（完整的执行模板）
 * - ExCard 不拆分成多个 Task，而是作为整体发送给 Agent
 * - Task 是可选的，用于人工跟踪，不是 ExCard 的拆分结果
 */

const { getAllJobs, createJob, updateJob, deleteJob } = require('../models/job');
const { getExcard, getExcardMd } = require('../storage/excards');

function setupJobsRoutes(app) {
  app.get('/api/jobs', (_, res) => {
    res.json({ jobs: getAllJobs() });
  });

  app.post('/api/jobs', (req, res) => {
    const { id, title, description, type, excardId, excard, agent } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }
    // 支持 excardId 和 excard 两种字段名
    const useExcardId = excardId || excard;
    const result = createJob({
      id,
      title,
      description,
      type,
      excardId: useExcardId,
      agentId: agent
    });

    res.json({ success: true, id: result.id });
  });

  // 获取 Job 绑定的 ExCard 完整内容（Markdown 格式）
  app.get('/api/jobs/:id/excard', (req, res) => {
    const { id } = req.params;
    const jobs = getAllJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const useExcardId = job.excard_id || job.excard;
    if (!useExcardId) {
      return res.status(400).json({ error: 'No ExCard associated with this job' });
    }

    try {
      const excardMd = getExcardMd(useExcardId);
      const excardData = getExcard(useExcardId);

      if (!excardMd && !excardData) {
        return res.status(404).json({ error: 'ExCard not found' });
      }

      res.json({
        success: true,
        excardId: useExcardId,
        markdown: excardMd,
        data: excardData
      });
    } catch (err) {
      console.error('[Jobs] Failed to get ExCard:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/jobs/:id', (req, res) => {
    deleteJob(req.params.id);
    res.json({ success: true });
  });

  app.patch('/api/jobs/:id', (req, res) => {
    const job = updateJob(req.params.id, req.body);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true });
  });
}

module.exports = { setupJobsRoutes };
