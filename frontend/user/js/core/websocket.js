/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   websocket.js — Real-time WebSockets synchronization
   ═══════════════════════════════════════════════════════════════ */

import { token } from './api.js';
import { loadUserDashboard } from '../modules/dashboard.js';

let socket = null;
let reconnectTimer = null;
let isManualClose = false;

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
  console.log('🔌 [User] Connecting to WebSocket:', wsUrl);

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('✅ [User] WebSocket connected');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('📥 [User] WebSocket message received:', msg);
      handleUserRealtimeEvent(msg);
    } catch (e) {
      console.error('Error parsing user WS message:', e);
    }
  };

  socket.onclose = () => {
    socket = null;
    if (!isManualClose && token) {
      console.log('❌ [User] WebSocket connection closed. Reconnecting in 3s...');
      reconnectTimer = setTimeout(connectWebSocket, 3000);
    } else {
      console.log('ℹ️ [User] WebSocket closed cleanly (logged out).');
    }
  };

  socket.onerror = (err) => {
    console.error('[User] WebSocket error:', err);
    if (socket) socket.close();
  };
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
