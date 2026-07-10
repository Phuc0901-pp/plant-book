/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   websocket.js — Real-time WebSockets synchronization
   ═══════════════════════════════════════════════════════════════ */

import { token } from './api.js';
import { loadUserDashboard } from '../modules/dashboard.js';

let socket = null;

export function connectWebSocket() {
  if (!token) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
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
    console.log('❌ [User] WebSocket connection closed. Reconnecting in 3s...');
    socket = null;
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (err) => {
    console.error('[User] WebSocket error:', err);
    socket.close();
  };
}

export function closeWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

function handleUserRealtimeEvent(msg) {
  const { event } = msg;

  if (event === 'plants_updated' || event === 'farms_updated') {
    console.log('🔄 Dashboard updated from server event');
    loadUserDashboard();
  }
}
