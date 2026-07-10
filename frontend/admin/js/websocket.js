/* ════════════════════════════════════════════════════════
   Plant Book Admin — websocket.js
   Real-time events synchronization via WebSockets
   ════════════════════════════════════════════════════════ */

let socket = null;

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('✅ WebSocket connected');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('📥 WebSocket message received:', msg);
      handleRealtimeEvent(msg);
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };

  socket.onclose = () => {
    console.log('❌ WebSocket connection closed. Reconnecting in 3s...');
    socket = null;
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
    socket.close();
  };
}

function closeWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

function handleRealtimeEvent(msg) {
  const { event, data } = msg;

  if (event === 'user_status_changed') {
    // 1. Update in-memory allUsers cache
    const u = allUsers.find(x => x.id === data.id);
    if (u) {
      u.is_online = data.is_online;
      u.last_active_at = data.last_active_at;
    }
    
    // 2. Render both user tables
    renderUsersTable(allUsers);
    renderUserStatusTable(allUsers);
    
    // 3. Highlight/Flash the modified row
    flashUserRow(data.id);
  }

  if (event === 'new_care_log') {
    // 1. If currently viewing dashboard, reload activity logs and stats
    const activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id === 'page-dashboard') {
      loadDashboard();
      toast(`🔔 Hoạt động mới: Nông hộ ${data.creator_name} vừa ghi nhật ký [${data.log.log_type}] cho cây ${data.plant_type || ''}`, 'info');
    }

    // 2. If viewing a plant modal and the tab is "tab-logs", reload it
    const plantModal = document.getElementById('plant-modal');
    const logsTab = document.getElementById('tab-logs');
    if (plantModal && plantModal.style.display === 'flex' && logsTab && logsTab.classList.contains('active') && editingPlantId === data.log.plant_id) {
      loadPlantLogs(editingPlantId);
    }
  }

  if (event === 'device_status_changed') {
    const activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id === 'page-devices') {
      loadDevices();
    }
  }

  if (event === 'plants_updated') {
    const activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id === 'page-plants') {
      loadPlants();
    } else if (activeSection && activeSection.id === 'page-dashboard') {
      loadDashboard();
    }
  }

  if (event === 'farms_updated') {
    const activeSection = document.querySelector('.page-section.active');
    if (activeSection && activeSection.id === 'page-gis') {
      // Reload farms list
      if (typeof loadFarmsList === 'function') loadFarmsList();
    }
  }
}

// Visual flash notification on updated row
function flashUserRow(userId) {
  const rows = document.querySelectorAll(`tr[data-user-id="${userId}"]`);
  rows.forEach(row => {
    row.style.transition = 'background-color 0.3s ease';
    row.style.backgroundColor = '#dcfce7'; // green-light flash
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 1500);
  });
}
