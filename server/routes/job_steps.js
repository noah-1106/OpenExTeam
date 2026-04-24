/**
 * Job Steps API Routes - 工作步骤 API 路由
 */

const {
  getStepsForJob,
  createStep,
  updateStep,
  deleteStep,
  deleteStepsForJob,
  reorderSteps
} = require('../models/job_steps');
const { v4: uuidv4 } = require('uuid');

function setupJobStepsRoutes(app) {
  app.get('/api/jobs/:id/steps', (req, res) => {
    const { id } = req.params;
    res.json({ steps: getStepsForJob(id) });
  });

  app.post('/api/jobs/:id/steps', (req, res) => {
    const { id } = req.params;
    const { stepType, title, description, agent, excardId, stepOrder } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }

    const result = createStep({
      jobId: id,
      stepType: stepType || 'task',
      title,
      description,
      agent,
      excardId,
      stepOrder: stepOrder ?? 0
    });

    res.json({ success: true, id: result.id });
  });

  app.patch('/api/job-steps/:id', (req, res) => {
    const step = updateStep(req.params.id, req.body);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }
    res.json({ success: true });
  });

  app.delete('/api/job-steps/:id', (req, res) => {
    deleteStep(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/jobs/:id/steps/reorder', (req, res) => {
    const { id } = req.params;
    const { stepIds } = req.body;
    if (!Array.isArray(stepIds)) {
      return res.status(400).json({ error: 'stepIds must be an array' });
    }
    reorderSteps(id, stepIds);
    res.json({ success: true });
  });
}

module.exports = { setupJobStepsRoutes };
