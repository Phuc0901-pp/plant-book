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

function groupAdminCareLogsByDay(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const daysMap = new Map();
  for (const log of logs) {
    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    if (!dateStr) continue;
    if (!daysMap.has(dateStr)) daysMap.set(dateStr, []);
    daysMap.get(dateStr).push(log);
  }

  const sortedDates = Array.from(daysMap.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const recent3Dates = sortedDates.slice(0, 3);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

  const daySummaries = [];

  for (const dateStr of recent3Dates) {
    const dayLogs = daysMap.get(dateStr) || [];
    const dObj = new Date(dateStr);
    const dateFormatted = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    let dateTag = dateFormatted;
    if (dateStr === todayStr) dateTag = 'Hôm nay';
    else if (dateStr === yesterdayStr) dateTag = 'Hôm qua';

    const dayGroupedItems = groupAdminCareLogs(dayLogs);

    daySummaries.push({
      dateStr: dateFormatted,
      dateTag: dateTag,
      items: dayGroupedItems,
      totalActivities: dayLogs.length
    });
  }

  return daySummaries;
}

function groupAdminCareLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  const grouped = [];
  const regularGroups = new Map();

  for (const log of logs) {
    if (log.log_type === 'Bệnh cây') {
      grouped.push({
        ...log,
        isDiseaseLog: true,
        targetDisplay: `Cây #${log.tree_code || log.plant_id}${log.farm_name ? ' (' + log.farm_name + ')' : ''}`
      });
      continue;
    }

    const dateStr = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    const detailsKey = JSON.stringify(log.details || {});
    const key = `${dateStr}_${log.log_type}_${log.farm_id || 0}_${log.created_by || 0}_${detailsKey}_${log.note || ''}`;

    if (!regularGroups.has(key)) {
      regularGroups.set(key, {
        baseLog: log,
        plantsMap: new Map(),
        farmId: log.farm_id,
        farmName: log.farm_name
      });
    }

    const groupObj = regularGroups.get(key);
    groupObj.plantsMap.set(log.plant_id, log.tree_code || String(log.plant_id));
  }

  for (const [key, groupObj] of regularGroups.entries()) {
    const log = { ...groupObj.baseLog };
    const plantIds = Array.from(groupObj.plantsMap.keys());
    const treeCodes = Array.from(groupObj.plantsMap.values());
    treeCodes.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

    const plants = window.allPlants || [];
    let farmPlantsCount = 0;
    if (groupObj.farmId) {
      farmPlantsCount = plants.filter(p => p.farm_id == groupObj.farmId).length;
    } else {
      farmPlantsCount = plants.length;
    }

    let targetDisplay = '';
    if (farmPlantsCount > 0 && plantIds.length >= farmPlantsCount) {
      targetDisplay = `Toàn vườn${groupObj.farmName ? ' ' + groupObj.farmName : ''}`;
    } else if (treeCodes.length > 1) {
      targetDisplay = `Cây #${treeCodes.join(', #')}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    } else {
      targetDisplay = `Cây #${treeCodes[0] || log.plant_id}${groupObj.farmName ? ' (' + groupObj.farmName + ')' : ''}`;
    }

    log.targetDisplay = targetDisplay;
    log.isGrouped = treeCodes.length > 1 || targetDisplay.startsWith('Toàn vườn');
    grouped.push(log);
  }

  grouped.sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  return grouped;
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

  const daySummaries = groupAdminCareLogsByDay(filteredLogs);

  let html = '';
  for (const day of daySummaries) {
    html += `
      <tr style="border-bottom: 1px solid var(--gray-200);">
        <td style="vertical-align: top; width: 140px; padding: 12px 10px;">
          <div style="font-size: 14px; font-weight: 700; color: #1e293b;"><i class="fa-regular fa-calendar-days" style="color:var(--green)"></i> ${day.dateStr}</div>
          <div style="font-size: 11px; font-weight: 700; color: var(--green); margin-top: 2px;">${day.dateTag}</div>
          <small style="color: var(--gray-400); font-size: 11px; display: block; margin-top: 4px;">${day.totalActivities} hoạt động</small>
        </td>
        <td colspan="4" style="padding: 10px 10px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${day.items.map(l => {
              let detailsStr = esc(l.note || '');
              if (l.details && Object.keys(l.details).length > 0) {
                const parts = [];
                if (l.details.method)          parts.push(`Cách: ${l.details.method}`);
                if (l.details.amount)          parts.push(`Lượng: ${l.details.amount} ${l.details.unit || ''}`);
                if (l.details.fertilizer_name) parts.push(`Phân: ${l.details.fertilizer_name}`);
                if (l.details.pesticide_name)  parts.push(`Thuốc: ${l.details.pesticide_name}`);
                if (l.details.reason)          parts.push(`Lý do: ${l.details.reason}`);
                if (l.details.disease_name)    parts.push(`Bệnh: ${l.details.disease_name}`);
                if (l.details.severity)        parts.push(`Mức độ: ${l.details.severity}`);
                if (parts.length > 0) {
                  detailsStr = parts.join(', ') + (l.note ? ` - ${esc(l.note)}` : '');
                }
              }

              const badgeMap = {
                'Tưới nước': 'badge-blue',
                'Bón phân':  'badge-brown',
                'Phun thuốc': 'badge-purple',
                'Cắt lá':    'badge-green',
                'Tỉa hoa':   'badge-amber'
              };

              const farmerName = esc(l.creator_name || 'Nông hộ / Công nhân');

              if (l.isDiseaseLog || l.log_type === 'Bệnh cây') {
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border: 1px solid #fca5a5; border-left: 4px solid #ef4444; border-radius: 8px; padding: 8px 12px; gap: 10px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="badge" style="background:#dc2626; color:#ffffff; font-weight:700; box-shadow:0 2px 6px rgba(220,38,38,0.3); font-size:11px;">🐛 Bệnh cây</span>
                      <strong style="color:#dc2626; font-size:13px;"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(l.targetDisplay)}</strong>
                      ${detailsStr ? `<span style="font-size:12px; color:#7f1d1d; font-weight:600;">[${detailsStr}]</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-user"></i> ${farmerName}</span>
                    </div>
                  </div>
                `;
              } else {
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; gap: 10px; flex-wrap: wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="badge ${badgeMap[l.log_type] || 'badge-gray'}" style="font-weight:600; font-size:11px;">${esc(l.log_type)}</span>
                      <strong style="color:#1e293b; font-size:13px;">${esc(l.targetDisplay)}</strong>
                      ${detailsStr ? `<span style="font-size:12px; color:#475569; background:#f8fafc; padding:2px 8px; border-radius:6px; border:1px solid #e2e8f0;">[${detailsStr}]</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:600; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-user"></i> ${farmerName}</span>
                    </div>
                  </div>
                `;
              }
            }).join('')}
          </div>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
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

