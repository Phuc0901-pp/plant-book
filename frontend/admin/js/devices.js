/* ════════════════════════════════════════════════════════
   Plant Book Admin — devices.js
   Hệ thống Trạm Thời tiết & Cảm biến Đất IoT Canh tác Thông minh
   1. Trạm Thời tiết & Dự báo (Weather Telemetry & Forecasting)
   2. Cảm biến Đất đa tầng (10, 20, 30cm)
   3. Thuật toán Cảnh báo & Khuyến nghị Canh tác AI
   4. Quản lý Thiết bị & Bật/Tắt Trạm Master
   ════════════════════════════════════════════════════════ */

let devicesCache = [];
let iotMasterOnline = true;
let currentSoilDepth = 10;
let iotCurrentTab = 'weather';
let weatherChartInstance = null;

// Multi-depth soil demo telemetry data
const soilDepthData = {
  10: {
    ph: 6.5, phStatus: 'Đất hơi chua (Tối ưu sầu riêng)', phColor: '#10b981',
    temp: 25.8, tempStatus: 'Thích hợp phát triển rễ tơ', tempColor: '#10b981',
    humidity: 48, humStatus: 'Mức trung bình (Cần bổ sung tưới)', humColor: '#f59e0b',
    ec: 1.1, ecStatus: 'Dinh dưỡng đất hài hòa (1.1 mS/cm)', ecColor: '#10b981',
    npk: 'N: 130 | P: 40 | K: 200 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.12, salStatus: 'Không nhiễm mặn (0.12 ‰)', salColor: '#10b981'
  },
  20: {
    ph: 6.6, phStatus: 'Đất trung tính - Tốt cho rễ chính', phColor: '#10b981',
    temp: 25.2, tempStatus: 'Nhiệt độ ổn định tầng giữa', tempColor: '#10b981',
    humidity: 50, humStatus: 'Độ ẩm 50% (Khuyến nghị nâng lên 60%)', humColor: '#f59e0b',
    ec: 1.3, ecStatus: 'Mức dinh dưỡng lý tưởng (1.3 mS/cm)', ecColor: '#10b981',
    npk: 'N: 145 | P: 48 | K: 215 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.15, salStatus: 'Không nhiễm mặn (0.15 ‰)', salColor: '#10b981'
  },
  30: {
    ph: 6.8, phStatus: 'Đất ổn định tầng sâu', phColor: '#10b981',
    temp: 24.5, tempStatus: 'Mát mẻ, bảo vệ củ rễ', tempColor: '#10b981',
    humidity: 58, humStatus: 'Độ ẩm tốt tầng sâu (58%)', humColor: '#10b981',
    ec: 1.5, ecStatus: 'Tích tụ dinh dưỡng dồi dào', ecColor: '#10b981',
    npk: 'N: 160 | P: 52 | K: 230 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.18, salStatus: 'An toàn (0.18 ‰)', salColor: '#10b981'
  }
};

// Initialize IoT Devices Page
async function initDevicesPage() {
  renderSoilMetrics(currentSoilDepth);
  renderWeatherHourlyChart();
  await loadDevices();
}

// Master Toggle Switch Power Button
function toggleIotMasterPower() {
  iotMasterOnline = !iotMasterOnline;
  const badge = document.getElementById('iot-status-badge');
  const text = document.getElementById('iot-status-text');
  const btn = document.getElementById('iot-master-toggle-btn');

  if (iotMasterOnline) {
    if (badge) {
      badge.style.background = 'rgba(16,185,129,0.15)';
      badge.style.borderColor = 'rgba(16,185,129,0.4)';
      badge.style.color = '#10b981';
    }
    if (text) text.textContent = 'TRẠM IOT ĐANG HOẠT ĐỘNG (LIVE)';
    if (btn) {
      btn.style.background = '#10b981';
      btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Đang Bật Trạm IoT';
    }
    toast('Đã bật kết nối Trạm Cảm biến IoT & Trạm Thời tiết!', 'success');
  } else {
    if (badge) {
      badge.style.background = 'rgba(239,68,68,0.15)';
      badge.style.borderColor = 'rgba(239,68,68,0.4)';
      badge.style.color = '#ef4444';
    }
    if (text) text.textContent = 'TRẠM IOT ĐÃ TẮT (OFFLINE)';
    if (btn) {
      btn.style.background = '#64748b';
      btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Đã Tắt Trạm IoT';
    }
    toast('Đã tắt kết nối Trạm Cảm biến IoT.', 'info');
  }
}

// Switch Sub-Tabs inside IoT Page
function switchIotTab(tab) {
  iotCurrentTab = tab;
  ['weather', 'soil', 'ai', 'devices'].forEach(t => {
    const pane = document.getElementById('iot-pane-' + t);
    const btn = document.getElementById('iot-tab-' + t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });

  if (tab === 'weather') {
    setTimeout(renderWeatherHourlyChart, 50);
  } else if (tab === 'soil') {
    renderSoilMetrics(currentSoilDepth);
  }
}

// Switch Multi-depth Soil Sensors (10, 20, 30 cm)
function switchSoilDepth(depth) {
  currentSoilDepth = depth;
  [10, 20, 30].forEach(d => {
    const btn = document.getElementById(`soil-depth-btn-${d}`);
    if (btn) {
      if (d === depth) {
        btn.style.background = '#ffffff';
        btn.style.color = '#0f172a';
        btn.style.fontWeight = '800';
        btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = 'none';
      }
    }
  });
  renderSoilMetrics(depth);
}

// Render Soil Telemetry Cards based on Depth
function renderSoilMetrics(depth) {
  const grid = document.getElementById('soil-metrics-grid');
  if (!grid) return;

  const data = soilDepthData[depth] || soilDepthData[10];

  grid.innerHTML = `
    <!-- Card 1: Soil pH -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🧪 Độ pH Đất (${depth} cm)</div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.ph}</div>
        <div style="font-size:12px; font-weight:700; color:${data.phColor}; margin-top:2px;">${data.phStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#ecfdf5; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#10b981; font-size:18px;">
          <i class="fa-solid fa-flask-vial"></i>
        </div>
      </div>
    </div>

    <!-- Card 2: Soil Temp -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🌡️ Nhiệt độ đất (${depth} cm)</div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.temp} <small style="font-size:14px; color:#64748b;">°C</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.tempColor}; margin-top:2px;">${data.tempStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#fff7ed; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#ea580c; font-size:18px;">
          <i class="fa-solid fa-temperature-half"></i>
        </div>
      </div>
    </div>

    <!-- Card 3: Soil Moisture -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">💧 Độ ẩm đất (${depth} cm)</div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.humidity}%</div>
        <div style="font-size:12px; font-weight:700; color:${data.humColor}; margin-top:2px;">${data.humStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#f0f9ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#0284c7; font-size:18px;">
          <i class="fa-solid fa-droplet"></i>
        </div>
      </div>
    </div>

    <!-- Card 4: Electrical Conductivity (EC) -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">⚡ Độ dẫn điện EC (${depth} cm)</div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.ec} <small style="font-size:13px; color:#64748b;">mS/cm</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.ecColor}; margin-top:2px;">${data.ecStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#fef3c7; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#d97706; font-size:18px;">
          <i class="fa-solid fa-bolt"></i>
        </div>
      </div>
    </div>

    <!-- Card 5: NPK Content -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🧪 Dinh dưỡng NPK (${depth} cm)</div>
        <div style="font-size:16px; font-weight:900; color:#0f172a; margin-top:6px;">${data.npk}</div>
        <div style="font-size:12px; font-weight:700; color:${data.npkColor}; margin-top:4px;">Hàm lượng Đạm-Lân-Kali dồi dào</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#eff6ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#3b82f6; font-size:18px;">
          <i class="fa-solid fa-seedling"></i>
        </div>
      </div>
    </div>

    <!-- Card 6: Salinity -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">🧂 Độ mặn của đất (${depth} cm)</div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.salinity} <small style="font-size:13px; color:#64748b;">‰</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.salColor}; margin-top:2px;">${data.salStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#f1f5f9; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#64748b; font-size:18px;">
          <i class="fa-solid fa-cubes-stacked"></i>
        </div>
      </div>
    </div>
  `;
}

// Render Weather Hourly Temperature Trend Line Chart
function renderWeatherHourlyChart() {
  const canvas = document.getElementById('weather-hourly-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const hours = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];
  const temps = [27, 27, 27, 27, 27, 27, 26, 26];

  if (weatherChartInstance) {
    weatherChartInstance.destroy();
    weatherChartInstance = null;
  }

  weatherChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [{
        label: 'Nhiệt độ (°C)',
        data: temps,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` Nhiệt độ: ${ctx.raw}°C` }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
        y: { min: 20, max: 32, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// Open Modal to Add Custom Warning Rule Condition
function openAddRuleModal() {
  const ruleName = prompt('Nhập tên Quy tắc Thuật toán Cảnh báo AI mới:');
  if (!ruleName) return;

  const ruleCond = prompt('Nhập điều kiện (VD: Độ ẩm đất 20cm < 50% AND Dự báo mưa > 30%):');
  if (!ruleCond) return;

  const ruleAction = prompt('Nhập hành động/khuyến nghị tự động:');
  if (!ruleAction) return;

  const rulesList = document.getElementById('iot-rules-list');
  if (!rulesList) return;

  const div = document.createElement('div');
  div.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;';
  div.innerHTML = `
    <div>
      <div style="font-size:14px; font-weight:800; color:#0f172a;">${esc(ruleName)}</div>
      <div style="font-size:12px; color:#475569; margin-top:2px;">Điều kiện: <code>${esc(ruleCond)}</code></div>
      <div style="font-size:12px; color:#059669; margin-top:2px; font-weight:600;">Hành động: ${esc(ruleAction)}</div>
    </div>
    <div>
      <span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700;">ĐANG HOẠT ĐỘNG</span>
    </div>
  `;
  rulesList.insertBefore(div, rulesList.firstChild);
  toast('Đã thêm quy tắc thuật toán cảnh báo AI thành công!', 'success');
}

// Load devices table from backend PostgreSQL
async function loadDevices() {
  const tbody = document.getElementById('devices-table');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải danh sách thiết bị...</td></tr>';
  }

  try {
    const devices = await api('/devices') || [];
    devicesCache = devices;
    filterDbDevices();
  } catch (err) {
    console.error('Lỗi tải danh sách thiết bị:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${esc(err.message)}</td></tr>`;
    }
  }
}

function updateIotKpis(devices) {
  const total = devices.length;
  const online = devices.filter(d => d.status !== 'Mất kết nối').length;
  const offline = devices.filter(d => d.status === 'Mất kết nối').length;
  const battGood = devices.filter(d => (d.battery_level === null || d.battery_level >= 80)).length;

  const totalEl = document.getElementById('kpi-iot-total');
  const onlineEl = document.getElementById('kpi-iot-online');
  const offlineEl = document.getElementById('kpi-iot-offline');
  const battEl = document.getElementById('kpi-iot-battery');

  if (totalEl) totalEl.textContent = total;
  if (onlineEl) onlineEl.textContent = online;
  if (offlineEl) offlineEl.textContent = offline;
  if (battEl) battEl.textContent = `${battGood}/${total}`;
}

function renderDevices(devices) {
  const tbody = document.getElementById('devices-table');
  if (!tbody) return;

  if (!devices || devices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-microchip"></i> Không tìm thấy thiết bị nào phù hợp với bộ lọc. Nhấp "+ Đăng ký thiết bị mới" để thêm.</td></tr>';
    return;
  }

  tbody.innerHTML = devices.map(d => {
    let batteryIcon = 'fa-battery-full';
    let batteryColor = '#059669';
    if (d.battery_level <= 20) { batteryIcon = 'fa-battery-empty'; batteryColor = '#dc2626'; }
    else if (d.battery_level <= 50) { batteryIcon = 'fa-battery-quarter'; batteryColor = '#d97706'; }

    let statusStyle = 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;';
    if (d.status === 'Mất kết nối') statusStyle = 'background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;';
    else if (d.status === 'Bảo trì') statusStyle = 'background:#fffbeb; color:#b45309; border:1px solid #fde68a;';

    return `
      <tr style="border-bottom:1px solid #f1f5f9; font-size:13px;">
        <td style="padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:8px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
              <i class="fa-solid fa-microchip"></i>
            </div>
            <div>
              <div style="font-weight:800; color:#0f172a; font-size:13.5px;">${esc(d.name)}</div>
              <div style="font-size:11px; color:#64748b;">Node/IP: <code>${esc(d.ip_address || '192.168.1.100')}</code></div>
            </div>
          </div>
        </td>
        <td><span style="font-size:12px; font-weight:700; color:#334155; background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">${esc(d.device_type)}</span></td>
        <td><strong style="color:#059669; font-size:12.5px;"><i class="fa-solid fa-house-chimney" style="font-size:11px;"></i> ${esc(d.farm_name || 'Toàn hệ thống')}</strong></td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:5px; font-weight:700; color:${batteryColor}; font-size:12.5px;">
            <i class="fa-solid ${batteryIcon}"></i> ${d.battery_level !== null ? d.battery_level : 100}%
          </span>
        </td>
        <td><span class="badge" style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; ${statusStyle}">${esc(d.status || 'Hoạt động')}</span></td>
        <td style="font-size:11.5px; color:#64748b;">${d.last_connection ? new Date(d.last_connection).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) + ' ' + new Date(d.last_connection).toLocaleDateString('vi-VN') : 'Vừa cập nhật'}</td>
        <td style="text-align:center;">
          <div style="display:inline-flex; gap:6px;">
            <button class="btn btn-sm" onclick="openDeviceModal(${d.id})" title="Chỉnh sửa" style="padding:4px 8px; font-size:11px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; color:#0284c7; cursor:pointer;">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn btn-sm" onclick="deleteDevice(${d.id})" title="Xóa" style="padding:4px 8px; font-size:11px; background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; color:#dc2626; cursor:pointer;">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDbDevices() {
  const farmVal = document.getElementById('db-iot-filter-farm')?.value || 'all';
  const typeVal = document.getElementById('db-iot-filter-type')?.value || 'all';
  const statusVal = document.getElementById('db-iot-filter-status')?.value || 'all';
  const searchVal = document.getElementById('db-iot-search-input')?.value.trim().toLowerCase() || '';

  const filtered = (devicesCache || []).filter(d => {
    const matchesFarm = (farmVal === 'all') || (d.farm_id == farmVal);
    const matchesType = (typeVal === 'all') || (d.device_type === typeVal);
    const matchesStatus = (statusVal === 'all') || (d.status === statusVal);
    const matchesSearch = !searchVal || 
      (d.name && d.name.toLowerCase().includes(searchVal)) || 
      (d.ip_address && d.ip_address.toLowerCase().includes(searchVal)) ||
      (d.device_type && d.device_type.toLowerCase().includes(searchVal));

    return matchesFarm && matchesType && matchesStatus && matchesSearch;
  });

  renderDevices(filtered);
  updateIotKpis(filtered);
}

function filterDevices() {
  filterDbDevices();
}

window.initDevicesPage = initDevicesPage;
window.toggleIotMasterPower = toggleIotMasterPower;
window.switchIotTab = switchIotTab;
window.switchSoilDepth = switchSoilDepth;
window.openAddRuleModal = openAddRuleModal;
window.loadDevices = loadDevices;
window.filterDevices = filterDevices;
window.filterDbDevices = filterDbDevices;
window.renderDevices = renderDevices;
window.updateIotKpis = updateIotKpis;
