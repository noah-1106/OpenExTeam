/**
 * Jobs API Routes - 工作 API 路由
 */

const { getAllJobs, createJob, updateJob, deleteJob } = require('../models/job');
const { createTask } = require('../models/task');
const { getExcard } = require('../storage/excards');
const { loadExcardMd, parseExcardMd, generateTasksFromExcard } = require('../services/excard-parser');

function setupJobsRoutes(app) {
  app.get('/api/jobs', (_, res) => {
    res.json({ jobs: getAllJobs() });
  });

  app.post('/api/jobs', (req, res) => {
    const { id, title, description, type, excardId, agentId, autoGenerateTasks = false } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }
    const result = createJob({ id, title, description, type, excardId });

    if (autoGenerateTasks && excardId && agentId) {
      try {
        let excard = getExcard(excardId);
        if (!excard) {
          const mdContent = loadExcardMd(excardId);
          if (mdContent) {
            excard = parseExcardMd(mdContent);
          }
        }

        if (excard) {
          const tasks = generateTasksFromExcard(excard, result.id, agentId);
          tasks.forEach(t => createTask(t));
          res.json({ success: true, id: result.id, tasksGenerated: tasks.length });
          return;
        }
      } catch (err) {
        console.error('[Jobs] Failed to generate tasks from ExCard:', err);
      }
    }

    res.json({ success: true, id: result.id });
  });

  app.post('/api/jobs/:id/generate-tasks', (req, res) => {
    const { id } = req.params;
    const { agentId, excardId: overrideExcardId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    const jobs = getAllJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const useExcardId = overrideExcardId || job.excard_id;
    if (!useExcardId) {
      return res.status(400).json({ error: 'No ExCard associated with this job' });
    }

    try {
      let excard = getExcard(useExcardId);
      if (!excard) {
        const mdContent = loadExcardMd(useExcardId);
        if (mdContent) {
          excard = parseExcardMd(mdContent);
        }
      }

      if (!excard) {
        return res.status(404).json({ error: 'ExCard not found' });
      }

      const tasks = generateTasksFromExcard(excard, id, agentId);
      tasks.forEach(t => createTask(t));
      res.json({ success: true, tasksGenerated: tasks.length, tasks });
    } catch (err) {
      console.error('[Jobs] Failed to generate tasks:', err);
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
