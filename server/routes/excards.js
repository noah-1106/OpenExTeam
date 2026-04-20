/**
 * ExCards API Routes - ExCard API 路由
 */

const { listExcards, getExcard, createExcard, updateExcard, deleteExcard } = require('../storage/excards');
const { broadcast } = require('../events/sse');

function setupExcardsRoutes(app) {
  app.get('/api/excards', (_, res) => {
    try {
      res.json({ excards: listExcards() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/excards/:id', (req, res) => {
    try {
      const ec = getExcard(req.params.id);
      if (!ec) return res.status(404).json({ error: 'ExCard not found' });
      res.json(ec);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/excards', (req, res) => {
    try {
      if (!req.body.id || !req.body.name) {
        return res.status(400).json({ error: 'id and name required' });
      }
      const ec = createExcard(req.body);
      broadcast('excard_created', { id: ec.id, name: ec.name });
      res.json({ success: true, excard: ec });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/excards/:id', (req, res) => {
    try {
      const ec = updateExcard(req.params.id, req.body);
      broadcast('excard_updated', { id: ec.id, name: ec.name });
      res.json({ success: true, excard: ec });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/excards/:id', (req, res) => {
    try {
      deleteExcard(req.params.id);
      broadcast('excard_deleted', { id: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}

module.exports = { setupExcardsRoutes };
