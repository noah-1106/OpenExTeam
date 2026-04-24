/**
 * Workflow API Routes - 工作流 API 路由
 */

const { startWorkflow, getWorkflowStatus } = require('../services/workflow');
const { validators, validateWorkflowStart } = require('../validation');

function setupWorkflowRoutes(app) {
  app.post('/api/workflow/start', (req, res) => {
    // 输入验证
    const validation = validateWorkflowStart(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.errors
      });
    }

    const { jobId } = req.body;

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
