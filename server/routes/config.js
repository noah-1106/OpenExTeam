/**
 * Config API Routes - 配置 API 路由
 */

const { loadConfig, saveConfig } = require('../config');
const { createAdapter } = require('../adapter');
const fs = require('fs');
const path = require('path');

function setupConfigRoutes(app, activeAdapters, adapterConfigs, helpers) {
  app.get('/api/config', (_, res) => res.json(loadConfig()));

  app.get('/api/config/adapters', (_, res) => {
    const cfg = loadConfig();
    res.json({ adapters: cfg.adapters || [] });
  });

  app.post('/api/config/adapters', (req, res) => {
    const cfg = loadConfig();
    cfg.adapters = req.body.adapters || [];
    saveConfig(cfg);

    // 更新内存中的配置
    if (adapterConfigs) {
      adapterConfigs.clear();
      for (const ac of cfg.adapters || []) {
        adapterConfigs.set(ac.name, ac);
      }
      console.log(`[Config] Saved and updated ${cfg.adapters?.length || 0} adapter(s) in memory`);
    }

    res.json({ success: true });
  });

  app.post('/api/adapter/test', async (req, res) => {
    let { type, url, token } = req.body;
    try {
      // 自动修复 URL 格式 - 仅 OpenClaw 需要 WebSocket
      if (type === 'openclaw' && url) {
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'ws://');
          console.log(`[Adapter Test] Auto-converted URL to: ${url}`);
        }
        if (url.startsWith('https://')) {
          url = url.replace('https://', 'wss://');
          console.log(`[Adapter Test] Auto-converted URL to: ${url}`);
        }

        // OpenClaw 需要 WebSocket URL
        if (!url || !url.startsWith('ws://') && !url.startsWith('wss://')) {
          return res.status(400).json({
            success: false,
            message: 'OpenClaw URL 格式不正确，需要以 ws:// 或 wss:// 开头'
          });
        }
      }

      // DeerFlow 需要 HTTP URL
      if (type === 'deerflow' && url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return res.status(400).json({
            success: false,
            message: 'DeerFlow URL 格式不正确，需要以 http:// 或 https:// 开头'
          });
        }
      }

      console.log(`[Adapter Test] Testing ${type} connection${url ? ' to ' + url : ''}`);

      const a = createAdapter(type, { name: 'test', url, token });

      let pairingInfo = null;
      let testTimedOut = false;
      let connectDone = false;
      let responseSent = false;

      // 5秒超时
      const timeout = setTimeout(() => {
        if (!connectDone && !responseSent) {
          testTimedOut = true;
          console.log('[Adapter Test] Test timed out after 5 seconds');
          a.disconnect().catch(() => {});
          responseSent = true;
          res.json({
            success: false,
            message: '连接超时，请检查 URL 是否正确，或直接保存配置让后台尝试连接'
          });
        }
      }, 5000);

      const sendPairingResponse = async (info) => {
        if (responseSent) return;
        responseSent = true;
        clearTimeout(timeout);
        connectDone = true;

        console.log('[Adapter Test] Sending pairing response:', info);

        await a.disconnect().catch(() => {});
        res.json({
          success: false,
          pairing_required: true,
          deviceId: info.deviceId,
          message: info.message
        });
      };

      a.on('pairing_required', (info) => {
        pairingInfo = info;
        console.log('[Adapter Test] Pairing required event received:', info);
        sendPairingResponse(info);
      });

      a.on('pairing_pending', (info) => {
        console.log('[Adapter Test] Pairing pending event received:', info);
        pairingInfo = info;
        sendPairingResponse(info);
      });

      try {
        await a.connect();

        if (responseSent) return;

        clearTimeout(timeout);
        connectDone = true;

        if (a.connected) {
          const ok = await a.healthCheck().catch(() => false);
          await a.disconnect();
          responseSent = true;
          res.json({ success: ok, message: ok ? '连接成功！' : '连接但健康检查失败' });
        } else if (pairingInfo) {
          await a.disconnect().catch(() => {});
          responseSent = true;
          res.json({
            success: false,
            pairing_required: true,
            deviceId: pairingInfo.deviceId,
            message: pairingInfo.message
          });
        } else {
          await a.disconnect().catch(() => {});
          responseSent = true;
          res.status(400).json({ success: false, message: '连接失败' });
        }
      } catch (err) {
        if (responseSent) return;

        clearTimeout(timeout);
        connectDone = true;
        if (testTimedOut) return;

        // 检查错误是否是配对相关的
        if (err.message && (err.message.includes('PAIRING_REQUIRED') || err.message.includes('pairing'))) {
          console.log('[Adapter Test] Pairing required from error');
          await a.disconnect().catch(() => {});
          responseSent = true;
          res.json({
            success: false,
            pairing_required: true,
            deviceId: a.getDeviceId ? a.getDeviceId() : null,
            message: pairingInfo?.message || '需要设备配对，请检查后端日志'
          });
          return;
        }

        await a.disconnect().catch(() => {});
        console.error('[Adapter Test] Connection error:', err.message);
        responseSent = true;
        res.status(400).json({
          success: false,
          message: `连接失败: ${err.message}`
        });
      }
    } catch (err) {
      console.error('[Adapter Test] Error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // 重置适配器凭证
  app.post('/api/adapter/reset-credentials', async (req, res) => {
    const { type } = req.body;
    console.log(`[Config] Resetting credentials for adapter: ${type}`);

    try {
      // 断开并移除当前活动的适配器
      for (const [name, adapter] of activeAdapters.entries()) {
        if (adapter.name === type) {
          try {
            await adapter.disconnect().catch(() => {});
          } catch (e) {
            console.warn(`[Config] Error disconnecting adapter:`, e.message);
          }
          activeAdapters.delete(name);
          console.log(`[Config] Removed active adapter: ${name}`);
        }
      }

      // 对于 OpenClaw 适配器，删除凭证文件
      if (type === 'openclaw') {
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const identityDir = path.join(homeDir, '.openclaw', 'identity');

        if (fs.existsSync(identityDir)) {
          const files = fs.readdirSync(identityDir);
          for (const file of files) {
            if (file === 'device.json' || file === 'device-auth.json' || file === 'device-private.pem') {
              const filePath = path.join(identityDir, file);
              fs.unlinkSync(filePath);
              console.log(`[Config] Deleted credential file: ${filePath}`);
            }
          }
        }
      }

      res.json({ success: true, message: '凭证已重置，可以重新连接' });
    } catch (err) {
      console.error('[Config] Error resetting credentials:', err);
      res.status(500).json({ success: false, message: `重置失败: ${err.message}` });
    }
  });
}

module.exports = { setupConfigRoutes };
