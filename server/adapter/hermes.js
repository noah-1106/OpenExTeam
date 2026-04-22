/**
 * Hermes Agent Adapter
 *
 * 根据 API-RESEARCH.md 中的技术调研实现：
 * - 连接方式：
 *   - CLI 命令（subprocess）- 当前实现，仅本地
 *   - api_server.py REST endpoint - 预留框架，将来支持
 *   - ACP adapter - 将来支持
 * - 认证：CLI 模式无需认证 / API 模式需 API Token
 * - Agent 列表：hermes status（单 agent，返回当前 profile）
 * - Session 管理：hermes sessions
 * - 任务执行：hermes chat -q "task prompt" --quiet
 * - Token/Cost：hermes insights
 *
 * 文档：https://hermes-agent.nousresearch.com/docs/
 * GitHub：https://github.com/NousResearch/hermes-agent
 */

const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const http = require('http');
const path = require('path');
const fs = require('fs');

class HermesAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = 'hermes';
    this.version = '1.0.0';
    this.config = config;
    this.connected = false;
    this.ready = false;
    this.pythonPath = config.pythonPath || 'python3';
    this.hermesPath = config.hermesPath || 'hermes';
    this.apiUrl = config.url || null; // 如果配置了 URL，尝试使用 API Server 模式
    this.apiToken = config.token || null;
    this.workingDir = config.workingDir || process.env.HOME;
    this._connectResolve = null;
    this._connectReject = null;

    // 解析 API URL
    if (this.apiUrl) {
      try {
        const url = new URL(this.apiUrl);
        this.apiHostname = url.hostname;
        this.apiPort = url.port || 80;
        this.apiPathname = url.pathname || '';
        this.useAPIMode = true;
      } catch {
        this.apiUrl = null;
        this.useAPIMode = false;
      }
    } else {
      this.useAPIMode = false;
    }
  }

  /**
   * 连接到 Hermes
   * 先尝试 API Server 模式（如果配置了 URL），再尝试 CLI 模式
   */
  async connect() {
    return new Promise(async (resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;

      try {
        // 如果配置了 URL，先尝试 API Server 模式
        if (this.useAPIMode) {
          console.log('[HermesAdapter] Trying API Server mode...');
          try {
            const apiHealth = await this._apiHealthCheck();
            if (apiHealth) {
              this.connected = true;
              this.ready = true;
              console.log('[HermesAdapter] Connected via API Server successfully');
              this.emit('connected');
              resolve();
              return;
            }
          } catch (apiErr) {
            console.warn('[HermesAdapter] API Server mode failed, falling back to CLI:', apiErr.message);
            this.useAPIMode = false;
          }
        }

        // CLI 模式
        console.log('[HermesAdapter] Using CLI mode (local only)...');

        // 首先检查 Hermes CLI 是否可用
        const cliAvailable = await this._checkCLIAvailable();
        if (!cliAvailable) {
          throw new Error('Hermes CLI not found. Please install Hermes: pip install hermes-agent');
        }

        // 检查 Hermes 状态
        const status = await this._getHermesStatus();
        if (!status) {
          throw new Error('Failed to get Hermes status');
        }

        this.connected = true;
        this.ready = true;
        console.log('[HermesAdapter] Connected via CLI successfully');
        this.emit('connected');
        resolve();
      } catch (err) {
        console.error('[HermesAdapter] Connection failed:', err.message);
        this.emit('error', err);
        reject(err);
      }
    });
  }

  /**
   * API Server 健康检查（预留框架）
   */
  async _apiHealthCheck() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHostname,
        port: this.apiPort,
        path: this.apiPathname + '/health',
        method: 'GET',
        headers: this.apiToken ? { 'Authorization': `Bearer ${this.apiToken}` } : {}
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy(new Error('API timeout'));
      });
      req.end();
    });
  }

  /**
   * 检查 Hermes CLI 是否可用
   */
  async _checkCLIAvailable() {
    return new Promise((resolve) => {
      exec(`${this.hermesPath} --help`, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[HermesAdapter] CLI check failed:', error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 获取 Hermes 状态
   */
  async _getHermesStatus() {
    return new Promise((resolve, reject) => {
      exec(`${this.hermesPath} status`, { timeout: 10000, cwd: this.workingDir }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[HermesAdapter] status command failed:', error.message);
          resolve(null);
        } else {
          try {
            const status = JSON.parse(stdout);
            resolve(status);
          } catch {
            resolve({
              ok: true,
              raw: stdout,
              version: 'unknown'
            });
          }
        }
      });
    });
  }

  /**
   * 断开连接
   */
  async disconnect() {
    this.connected = false;
    this.ready = false;
    this.emit('disconnected');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.connected || !this.ready) {
      return false;
    }

    if (this.useAPIMode) {
      try {
        await this._apiHealthCheck();
        return true;
      } catch {
        return false;
      }
    } else {
      const status = await this._getHermesStatus();
      return status !== null;
    }
  }

  // ===== Agent 操作 =====

  /**
   * 列出 Agents
   * Hermes 是单 Agent 架构，通过 profiles 管理不同配置
   */
  async listAgents() {
    try {
      const profiles = await this._listProfiles();
      const isConnected = this.connected && this.ready;

      if (profiles && profiles.length > 0) {
        return profiles.map(profile => ({
          id: profile.id || profile.name,
          name: profile.name || profile.id,
          status: isConnected ? 'online' : 'offline',
          connected: isConnected,
          framework: 'hermes',
          isDefault: profile.isDefault || false
        }));
      }

      return [{
        id: 'hermes-default',
        name: 'Hermes Agent',
        status: isConnected ? 'online' : 'offline',
        connected: isConnected,
        framework: 'hermes',
        isDefault: true
      }];
    } catch (err) {
      console.error('[HermesAdapter] Failed to list agents:', err.message);
      return [];
    }
  }

  /**
   * 列出 Hermes profiles
   */
  async _listProfiles() {
    if (this.useAPIMode) {
      // TODO: API 模式下获取 profiles
      return [];
    }

    return new Promise((resolve) => {
      exec(`${this.hermesPath} profiles list`, { timeout: 10000, cwd: this.workingDir }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[HermesAdapter] profiles list failed:', error.message);
          resolve([]);
        } else {
          try {
            const profiles = JSON.parse(stdout);
            resolve(Array.isArray(profiles) ? profiles : []);
          } catch {
            resolve(this._parseProfilesText(stdout));
          }
        }
      });
    });
  }

  /**
   * 解析文本格式的 profiles 输出
   */
  _parseProfilesText(text) {
    const lines = text.trim().split('\n');
    const profiles = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('─') && !trimmed.toLowerCase().includes('profile')) {
        const name = trimmed.replace('*', '').trim();
        if (name) {
          profiles.push({
            id: name,
            name: name,
            isDefault: trimmed.includes('*')
          });
        }
      }
    }
    return profiles;
  }

  /**
   * 获取 Agent 状态
   */
  async getAgentStatus(agentId) {
    const agents = await this.listAgents();
    return agents.find(a => a.id === agentId) || null;
  }

  // ===== 消息发送 =====

  /**
   * 发送消息给 Agent
   */
  async send(agentId, message) {
    if (!this.ready) {
      throw new Error("Hermes not connected");
    }

    const content = typeof message === 'string' ? message : message.content || message.text;
    if (!content) {
      throw new Error("Message content is required");
    }

    try {
      let result;
      if (this.useAPIMode) {
        // TODO: API 模式下发送消息
        result = { message: 'API mode not implemented yet' };
      } else {
        result = await this._executeChat(content, agentId);
      }

      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        result: result
      };
    } catch (err) {
      console.error('[HermesAdapter] Failed to send message:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * 执行 Hermes chat 命令
   */
  async _executeChat(prompt, profileName = null) {
    return new Promise((resolve, reject) => {
      let cmd = `${this.hermesPath} chat -q "${this._escapeQuotes(prompt)}" --quiet`;

      if (profileName && profileName !== 'hermes-default') {
        cmd += ` --profile ${profileName}`;
      }

      console.log('[HermesAdapter] Executing:', cmd);

      const child = exec(cmd, {
        timeout: 300000,
        cwd: this.workingDir,
        maxBuffer: 10 * 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[HermesAdapter] Chat command failed:', error.message);
          reject(error);
        } else {
          const message = {
            type: 'chat',
            from: profileName || 'hermes-default',
            content: stdout.trim(),
            timestamp: new Date().toISOString()
          };
          this.emit('message', message);
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * 转义命令行中的引号
   */
  _escapeQuotes(str) {
    return str.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
  }

  // ===== 会话管理 =====

  /**
   * 列出会话
   */
  async listSessions() {
    if (this.useAPIMode) {
      // TODO: API 模式下获取 sessions
      return [];
    }

    return new Promise((resolve) => {
      exec(`${this.hermesPath} sessions`, { timeout: 10000, cwd: this.workingDir }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[HermesAdapter] sessions list failed:', error.message);
          resolve([]);
        } else {
          try {
            const sessions = JSON.parse(stdout);
            resolve(Array.isArray(sessions) ? sessions : []);
          } catch {
            resolve(this._parseSessionsText(stdout));
          }
        }
      });
    });
  }

  /**
   * 解析文本格式的 sessions 输出
   */
  _parseSessionsText(text) {
    const lines = text.trim().split('\n');
    const sessions = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('─') && !trimmed.toLowerCase().includes('session')) {
        sessions.push({
          id: trimmed,
          name: trimmed
        });
      }
    }
    return sessions;
  }

  // ===== Token/Cost 分析 =====

  /**
   * 获取 token 使用情况
   */
  async getTokenUsage(days = 7) {
    if (this.useAPIMode) {
      // TODO: API 模式下获取 insights
      return null;
    }

    return new Promise((resolve) => {
      exec(`${this.hermesPath} insights --days ${days}`, { timeout: 15000, cwd: this.workingDir }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[HermesAdapter] insights failed:', error.message);
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ raw: stdout });
          }
        }
      });
    });
  }

  // ===== 解析消息 =====

  /**
   * 解析原始消息
   */
  parse(raw) {
    if (!raw) return null;
    return {
      messageId: raw.messageId || raw.id || `msg_${Date.now()}`,
      type: raw.type || 'chat',
      taskId: raw.taskId,
      jobId: raw.jobId,
      agent: raw.agent || raw.from || 'hermes-default',
      content: raw.content || raw.result || raw,
      timestamp: raw.timestamp || new Date().toISOString()
    };
  }
}

module.exports = HermesAdapter;
