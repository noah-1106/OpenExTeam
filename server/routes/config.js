/**
 * Config API Routes - 配置 API 路由
 */

const { loadConfig, saveConfig } = require('../config');
const { createAdapter } = require('../adapter');

function setupConfigRoutes(app, activeAdapters) {
  app.get('/api/config', (_, res) => res.json(loadConfig()));

  app.get('/api/config/adapters', (_, res) => {
    const cfg = loadConfig();
    res.json({ adapters: cfg.adapters || [] });
  });

  app.post('/api/config/adapters', (req, res) => {
    const cfg = loadConfig();
    cfg.adapters = req.body.adapters || [];
    saveConfig(cfg);
    res.json({ success: true });
  });

  app.post('/api/adapter/test', async (req, res) => {
    const { type, url, token } = req.body;
    try {
      const a = createAdapter(type, { url, token });

      let pairingInfo = null;
      let pairingComplete = false;

      a.on('pairing_required', (info) => {
        pairingInfo = info;
        console.log('[Adapter Test] Pairing required:', info);
      });

      a.on('pairing_complete', (info) => {
        pairingComplete = true;
        console.log('[Adapter Test] Pairing complete:', info);
      });

      const result = await a.connect().catch(err => ({ connected: false, err }));

      if (a.connected) {
        const ok = await a.healthCheck();
        await a.disconnect();
        res.json({ success: ok, message: ok ? 'OK' : 'Health check failed' });
        return;
      }

      if (pairingInfo) {
        console.log('[Adapter Test] Waiting for pairing to complete (max 30s)...');

        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          if (pairingComplete) {
            console.log('[Adapter Test] Pairing completed!');
            const retryResult = await a.connect().catch(err => ({ connected: false, err }));
            if (retryResult.connected) {
              const ok = await a.healthCheck();
              await a.disconnect();
              res.json({ success: ok, message: ok ? 'OK' : 'Health check failed' });
            } else {
              res.status(400).json({ success: false, message: '配对完成但连接失败' });
              await a.disconnect().catch(() => {});
            }
            return;
          }
        }

        res.json({
          success: false,
          pairing_required: true,
          device_id: pairingInfo.deviceId,
          message: pairingInfo.message
        });
        await a.disconnect().catch(() => {});
        return;
      }

      await a.disconnect().catch(() => {});
      res.status(400).json({ success: false, message: result.err?.message || '连接失败' });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });
}

module.exports = { setupConfigRoutes };
