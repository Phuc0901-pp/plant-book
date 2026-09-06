/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   websocket.js — Real-time WebSockets synchronization
   ═══════════════════════════════════════════════════════════════ */

import { token } from './api.js';
import { loadUserDashboard } from '../modules/dashboard.js';

let socket = null;
let reconnectTimer = null;
let isManualClose = false;
let retryCount = 0;

export function connectWebSocket() {
  if (!token) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isManualClose = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      retryCount = 0;
      console.log('✅ [User] WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleUserRealtimeEvent(msg);
      } catch (e) {
        console.warn('Error parsing user WS message:', e.message);
      }
    };

    socket.onclose = () => {
      socket = null;
      if (!isManualClose && token) {
        retryCount++;
        // Exponential backoff: 3s, 6s, 12s, max 30s
        const delay = Math.min(3000 * Math.pow(1.5, retryCount - 1), 30000);
        reconnectTimer = setTimeout(connectWebSocket, delay);
      }
    };

    socket.onerror = () => {
      // Khi server đang khởi động, im lặng đóng socket và để onclose xử lý backoff
      if (socket) {
        try { socket.close(); } catch (_) {}
      }
    };
  } catch (_) {
    socket = null;
    if (!isManualClose && token) {
      reconnectTimer = setTimeout(connectWebSocket, 5000);
    }
  }
}

export function closeWebSocket() {
  isManualClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

function handleUserRealtimeEvent(msg) {
  const { event } = msg;

  if (event === 'plants_updated' || event === 'farms_updated' || event === 'supplies_updated' || event === 'new_care_log') {
    console.log('🔄 Live refresh from server event:', event);
    if (typeof loadUserDashboard === 'function') loadUserDashboard();
    if (typeof window.loadSupplies === 'function') window.loadSupplies();
    if (typeof window.loadSuppliesAnalytics === 'function') window.loadSuppliesAnalytics();
  }
}
