/**
 * Jobs API Routes - 工作 API 路由
 */

const { getAllJobs, createJob, updateJob, deleteJob } = require('../models/job');

function setupJobsRoutes(app) {
  app.get('/api/jobs', (_, res) => {
    res.json({ jobs: getAllJobs() });
  });

  app.post('/api/jobs', (req, res) => {
    const { id, title, description, type, excardId } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }
    const result = createJob({ id, title, description, type, excardId });
    res.json({ success: true, id: result.id });
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
