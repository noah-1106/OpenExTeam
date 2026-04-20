const WebSocket = require('ws');

const url = 'ws://127.0.0.1:18789';
const token = process.env.GATEWAY_TOKEN || '';

console.log('[Test] Connecting to:', url);
console.log('[Test] Token available:', token ? 'Yes' : 'No');

const ws = new WebSocket(url);
let connected = false;
let challengeReceived = false;

ws.on('open', () => {
  console.log('[Test] WebSocket opened');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('[Test] Raw message:', JSON.stringify(msg).slice(0, 300));
    
    // 处理 challenge
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      challengeReceived = true;
      console.log('[Test] Got challenge');
      
      const connectReq = {
        type: 'req',
        id: `conn_${Date.now()}`,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'cli',
            version: '1.0.0',
            platform: 'linux',
            mode: 'cli'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.pairing'],
          auth: token ? { token } : {},
          locale: 'zh-CN'
        }
      };
      
      ws.send(JSON.stringify(connectReq));
      console.log('[Test] Sent connect request');
      return;
    }
    
    // 处理 connect 响应
    if (msg.type === 'res' && msg.id && msg.id.includes('conn_')) {
      console.log('[Test] Connect response - ok:', msg.ok, 'error:', msg.error);
      
      if (msg.ok) {
        connected = true;
        console.log('[Test] ✅ Connect successful!');
        
        // Health check
        setTimeout(() => {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: `health_${Date.now()}`,
            method: 'gateway.health',
            params: {}
          }));
          console.log('[Test] Sent health check');
        }, 500);
      } else {
        console.log('[Test] ❌ Connect failed:', msg.error);
        ws.close();
      }
      return;
    }
    
    // Health response
    if (msg.id && msg.id.includes('health_')) {
      console.log('[Test] Health response:', msg.result !== undefined ? 'OK' : 'Failed', msg.error);
      setTimeout(() => ws.close(), 500);
      return;
    }
    
  } catch (err) {
    console.error('[Test] Error:', err.message);
  }
});

ws.on('error', (err) => {
  console.error('[Test] WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('[Test] Connection closed. Connected:', connected);
  process.exit(connected ? 0 : 1);
});

setTimeout(() => {
  if (!challengeReceived) {
    console.log('[Test] Timeout');
    ws.close();
  }
}, 5000);
