/**
 * Workflow API Routes - 工作流 API 路由
 */

const { startWorkflow, getWorkflowStatus } = require('../services/workflow');

function setupWorkflowRoutes(app) {
  app.post('/api/workflow/start', (req, res) => {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' });
    }

    const result = startWorkflow(jobId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  app.get('/api/workflow/status', (req, res) => {
    const { jobId } = req.query;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' });
    }

    const status = getWorkflowStatus(jobId);
    res.json(status);
  });
}

module.exports = { setupWorkflowRoutes };
