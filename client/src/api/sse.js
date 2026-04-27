/**
 * SSE 连接管理工具
 * 统一处理 EventSource 创建、重连、清理
 */

import { SSE_URL } from './client';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * 创建带自动重连的 SSE 连接
 *
 * @param {Object} handlers - 事件处理器 { eventName: callback }
 * @param {Object} [options]
 * @param {string} [options.url] - SSE 端点，默认 SSE_URL
 * @param {number} [options.reconnectDelay] - 初始重连延迟 ms
 * @param {Function} [options.onOpen] - 连接打开回调
 * @param {Function} [options.onError] - 连接错误回调
 * @returns {{ close: Function, reconnect: Function }}
 */
export function createSSEConnection(handlers, options = {}) {
  const url = options.url || SSE_URL;
  const initialDelay = options.reconnectDelay || RECONNECT_DELAY;
  let es = null;
  let reconnectTimer = null;
  let currentDelay = initialDelay;
  let closed = false;

  function close() {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  }

  function connect() {
    if (closed) return;
    if (es) {
      es.close();
      es = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    es = new EventSource(url);

    es.addEventListener('open', () => {
      currentDelay = initialDelay; // 重置重连延迟
      if (options.onOpen) options.onOpen();
    });

    es.onerror = () => {
      if (closed) return;
      if (options.onError) options.onError();

      // 指数退避重连
      reconnectTimer = setTimeout(() => {
        currentDelay = Math.min(currentDelay * 1.5, MAX_RECONNECT_DELAY);
        connect();
      }, currentDelay);
    };

    // 注册事件处理器
    if (handlers) {
      for (const [event, handler] of Object.entries(handlers)) {
        es.addEventListener(event, handler);
      }
    }
  }

  function reconnect() {
    close();
    closed = false;
    currentDelay = initialDelay;
    connect();
  }

  connect();

  return { close, reconnect };
}
