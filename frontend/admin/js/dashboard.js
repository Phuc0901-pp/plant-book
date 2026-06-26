// ── Dashboard ─────────────────────────────────────────────

async function loadDashboard() {
  try {
    const [plants, schemas, farms, recentLogs] = await Promise.all([
      api('/plants'),
      api('/schemas'),
      api('/farms'),
      api('/plants/logs/recent')
    ]);
    allPlants = plants;
    allFarms = farms;
    allRecentLogs = recentLogs;

    const healthy = plants.filter(p => p.health_status === 'Tốt').length;
    const watch = plants.filter(p => ['Cần chú ý','Bệnh'].includes(p.health_status)).length;
    document.getElementById('stat-plants').textContent = plants.length;
    document.getElementById('stat-healthy').textContent = healthy;
    document.getElementById('stat-watch').textContent = watch;
    document.getElementById('stat-schemas').textContent = schemas.length;

    // Reset and update filter buttons
    currentDashboardFilter = 'all';
    document.querySelectorAll('.dashboard-filter-bar .filter-chip').forEach(btn => btn.classList.remove('active'));
    const btnAll = document.getElementById('btn-filter-all');
    if (btnAll) btnAll.classList.add('active');

    // Load Overview map
    initDashboardMap(farms, plants);

    // Initial render of dashboard logs table
    renderDashboardLogsTable(recentLogs);
  } catch (err) {
    toast('Lỗi tải dashboard: ' + err.message, 'error');
  }
}

function renderDashboardLogsTable(logs) {
  const tbody = document.getElementById('dashboard-logs-table');
  if (!tbody) return;

  const filteredLogs = logs.filter(log => {
    const plant = allPlants.find(p => p.id === log.plant_id);
    if (!plant) return false;
    return matchesFilter(plant, currentDashboardFilter);
  });

  if (!filteredLogs.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa fa-list-check"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filteredLogs.map(l => {
    const plant = allPlants.find(p => p.id === l.plant_id) || {};
    const plantLabel = `<strong>Cây #${l.plant_id}</strong> (${esc(l.plant_type || plant.plant_type || '—')})`;
    
    // Build details text or use note
    let detailsStr = esc(l.note || '');
    if (l.details && Object.keys(l.details).length > 0) {
      const parts = [];
      if (l.details.method) parts.push(`Cách: ${l.details.method}`);
      if (l.details.amount) parts.push(`Lượng: ${l.details.amount} ${l.details.unit || ''}`);
      if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
      if (l.details.pesticide_name) parts.push(`Thuốc: ${l.details.pesticide_name}`);
      if (l.details.reason) parts.push(`Lý do: ${l.details.reason}`);
      if (parts.length > 0) {
        detailsStr = `<span style="color:var(--green)">[${parts.join(', ')}]</span>` + (l.note ? ` - ${esc(l.note)}` : '');
      }
    }

    return `
      <tr>
        <td>${fmtDate(l.log_date)}</td>
        <td>${plantLabel}</td>
        <td><span class="log-type-tag">${esc(l.log_type || 'Ghi chú')}</span></td>
        <td>${detailsStr}</td>
        <td><small>${esc(l.creator_name || 'Khách/Công nhân')}</small></td>
      </tr>
    `;
  }).join('');
}

function matchesFilter(plant, type) {
  if (type === 'all') return true;
  if (type === 'sick') return plant.health_status === 'Bệnh';
  if (type === 'watch') return plant.health_status === 'Cần chú ý';
  
  const now = new Date();
  if (type === 'not-watered') {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return plant.last_watered !== todayStr;
  }
  
  if (type === 'not-fertilized') {
    if (!plant.last_fertilized) return true;
    const lastFertDate = new Date(plant.last_fertilized + 'T00:00:00');
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 7);
    limitDate.setHours(0,0,0,0);
    return lastFertDate < limitDate;
  }
  return true;
}

function filterDashboard(type) {
  currentDashboardFilter = type;
  document.querySelectorAll('.dashboard-filter-bar .filter-chip').forEach(btn => btn.classList.remove('active'));
  
  let btnId = 'btn-filter-all';
  if (type === 'sick') btnId = 'btn-filter-sick';
  else if (type === 'watch') btnId = 'btn-filter-watch';
  else if (type === 'not-watered') btnId = 'btn-filter-not-watered';
  else if (type === 'not-fertilized') btnId = 'btn-filter-not-fertilized';
  
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  // Toggle map markers visibility/opacity
  dashboardMarkers.forEach(({ marker, plant, element }) => {
    if (matchesFilter(plant, type)) {
      element.classList.remove('filtered-out');
    } else {
      element.classList.add('filtered-out');
    }
  });

  // Filter logs table
  renderDashboardLogsTable(allRecentLogs);
}

