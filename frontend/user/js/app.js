/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Panel  /  app.js
   Router, sidebar toggle, toast, api helper
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';
let token       = localStorage.getItem('pb_token') || '';
let currentUser = null;

/* ── Các trang trong user panel ─────────────────────────────── */
const PAGE_TITLES = {
  home:     'Trang chủ',
  myplants: 'Cây trồng của tôi',
  logs:     'Nhật ký canh tác',
  reports:  'Báo cáo',
  settings: 'Cài đặt tài khoản',
};

/* ── Router ─────────────────────────────────────────────────── */
function showPage(page) {
  /* Ẩn tất cả sections */
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  /* Bỏ active nav */
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  /* Active section */
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  /* Active nav item */
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  } else {
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');
  }

  /* Cập nhật tiêu đề topbar */
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  /* Đóng mobile sidebar */
  closeMobileSidebar();

  if (page === 'home') {
    loadUserDashboard();
  }
}

/* ── Mobile sidebar ─────────────────────────────────────────── */
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }
}

/* ── API helper ─────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Toast notification ─────────────────────────────────────── */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ── Helper esc HTML ── */
function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── User Dashboard Logic ── */
let userMap = null;
let userMarkers = [];
let allConfigsCache = {};

async function loadUserDashboard() {
  try {
    const [farms, plants, recentLogs, configs] = await Promise.all([
      api('/farms'),
      api('/plants'),
      api('/plants/logs/recent'),
      api('/config')
    ]);

    allConfigsCache = configs;

    // Update Welcome
    const nameEl = document.getElementById('welcome-name');
    if (nameEl && currentUser) {
      nameEl.textContent = currentUser.full_name || currentUser.name || 'nông hộ';
    }
    
    document.getElementById('user-plant-count').textContent = plants.length;

    renderUserFarmsList(farms);
    renderUserPlantsTable(plants);
    renderUserLogsTable(recentLogs);
    renderUserReminders(plants);

    await ensureUserMapboxToken();
    initUserMap(farms, plants);

  } catch (err) {
    toast('Lỗi tải dữ liệu: ' + err.message, 'error');
  }
}

function renderUserFarmsList(farms) {
  const container = document.getElementById('user-farms-container');
  if (!container) return;
  if (!farms.length) {
    container.innerHTML = '<div class="empty-state" style="padding:12px"><p>Bạn chưa được gán phụ trách trang trại nào.</p></div>';
    return;
  }
  container.innerHTML = farms.map(f => `
    <div style="padding: 12px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px;">
      <h4 style="font-size: 13px; font-weight: 700; color: var(--green-dark); margin-bottom: 4px;">🏡 ${esc(f.name)}</h4>
      <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 12px; flex-wrap: wrap;">
        <span><i class="fa-solid fa-ruler-combined"></i> ${f.area ? Math.round(parseFloat(f.area)).toLocaleString('vi-VN') : 0} m²</span>
        <span><i class="fa-solid fa-seedling"></i> ${f.plant_count || 0} cây</span>
      </div>
    </div>
  `).join('');
}

function renderUserPlantsTable(plants) {
  const tbody = document.getElementById('user-plants-table');
  if (!tbody) return;
  if (!plants.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-seedling"></i><p>Không có cây trồng nào được giao</p></td></tr>';
    return;
  }
  tbody.innerHTML = plants.map(p => `
    <tr>
      <td><strong>${esc(p.tree_code || p.id)}</strong></td>
      <td>
        <strong>${esc(p.plant_type)}</strong>
        ${p.plant_variety ? `<br><small style="color:var(--gray-400)">${esc(p.plant_variety)}</small>` : ''}
      </td>
      <td>${esc(p.plant_age || '—')}</td>
      <td>${healthBadge(p.health_status)}</td>
      <td>${esc(p.location || '—')}</td>
      <td>
        <button class="btn btn-secondary btn-xs" onclick="openCareModal(${p.id}, '${esc(p.tree_code || p.id)}', '${esc(p.plant_type)}')">
          <i class="fa-solid fa-file-signature"></i> Nhật ký
        </button>
      </td>
    </tr>
  `).join('');
}

function healthBadge(status) {
  if (status === 'Tốt') return '<span class="badge badge-green">Tốt</span>';
  if (status === 'Bình thường') return '<span class="badge badge-gray">Bình thường</span>';
  if (status === 'Cần chú ý') return '<span class="badge badge-amber">Cần chú ý</span>';
  if (status === 'Bệnh') return '<span class="badge badge-red">Bệnh</span>';
  return `<span class="badge badge-gray">${esc(status)}</span>`;
}

function renderUserLogsTable(logs) {
  const tbody = document.getElementById('user-logs-table');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>Không có hoạt động canh tác nào trong 3 ngày qua</p></td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => {
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
    const dateStr = l.log_date ? new Date(l.log_date).toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }) : '—';
    return `
      <tr>
        <td>${dateStr}</td>
        <td><strong>Cây #${l.plant_id}</strong> (${esc(l.plant_type)})</td>
        <td><span class="badge badge-gray" style="text-transform:none; font-weight:500;">${esc(l.log_type)}</span></td>
        <td>${detailsStr}</td>
        <td><small>${esc(l.creator_name || 'Khách/Nông hộ')}</small></td>
      </tr>
    `;
  }).join('');
}

function renderUserReminders(plants) {
  const container = document.getElementById('reminder-container');
  const countEl = document.getElementById('reminder-count');
  if (!container) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const unwatered = [];
  const unfertilized = [];

  plants.forEach(p => {
    if (p.last_watered !== todayStr) {
      unwatered.push(p);
    }
    if (!p.last_fertilized) {
      unfertilized.push(p);
    } else {
      const lastFert = new Date(p.last_fertilized + 'T00:00:00');
      const limit = new Date();
      limit.setDate(limit.getDate() - 7);
      limit.setHours(0,0,0,0);
      if (lastFert < limit) {
        unfertilized.push(p);
      }
    }
  });

  const totalReminders = unwatered.length + unfertilized.length;
  if (countEl) countEl.textContent = `${totalReminders} nhắc nhở`;

  if (totalReminders === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:16px"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i><p>Tất cả cây đã được chăm sóc đầy đủ hôm nay!</p></div>';
    return;
  }

  let html = '';

  if (unwatered.length > 0) {
    html += `<div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; letter-spacing:0.04em;"><i class="fa-solid fa-droplet" style="color:var(--blue)"></i> Chưa tưới hôm nay (${unwatered.length})</div>`;
    html += unwatered.slice(0, 5).map(p => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fff7ed; border:1px solid #ffedd5; border-radius:8px; margin-bottom:6px;">
        <div style="font-size:12px;">
          <strong>Cây ${esc(p.tree_code || p.id)}</strong> (${esc(p.plant_type)})
        </div>
        <button class="btn btn-primary btn-xs" style="background:var(--blue); color:#fff;" onclick="quickCare(${p.id}, 'Tưới nước')">
          Tưới nhanh
        </button>
      </div>
    `).join('');
    if (unwatered.length > 5) {
      html += `<div style="font-size:11px; color:var(--text-muted); text-align:center; margin-bottom:10px;">Và ${unwatered.length - 5} cây khác...</div>`;
    } else {
      html += `<div style="height:8px"></div>`;
    }
  }

  if (unfertilized.length > 0) {
    html += `<div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; letter-spacing:0.04em;"><i class="fa-solid fa-flask" style="color:var(--amber)"></i> Quá 7 ngày chưa bón phân (${unfertilized.length})</div>`;
    html += unfertilized.slice(0, 5).map(p => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; margin-bottom:6px;">
        <div style="font-size:12px;">
          <strong>Cây ${esc(p.tree_code || p.id)}</strong> (${esc(p.plant_type)})
        </div>
        <button class="btn btn-primary btn-xs" style="background:var(--amber); color:#fff;" onclick="quickCare(${p.id}, 'Bón phân')">
          Bón nhanh
        </button>
      </div>
    `).join('');
    if (unfertilized.length > 5) {
      html += `<div style="font-size:11px; color:var(--text-muted); text-align:center;">Và ${unfertilized.length - 5} cây khác...</div>`;
    }
  }

  container.innerHTML = html;
}

async function quickCare(plantId, logType) {
  try {
    let details = {};
    if (logType === 'Tưới nước') {
      const waterMethods = allConfigsCache.water_methods || [];
      details = {
        method: waterMethods[0] || 'Tưới tay thủ công',
        amount: 2,
        unit: 'lít'
      };
    } else if (logType === 'Bón phân') {
      const fertilizers = allConfigsCache.fertilizers || [];
      details = {
        fertilizer_name: fertilizers[0] || 'Phân NPK 16-16-8',
        amount: 100,
        unit: 'gam'
      };
    }

    const payload = {
      log_type: logType,
      log_date: new Date().toISOString().slice(0,10),
      note: 'Ghi nhận nhanh từ Cổng nông hộ',
      media_urls: [],
      details
    };

    await api(`/plants/${plantId}/logs`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    toast(`Đã ghi nhận ${logType} thành công!`);
    loadUserDashboard();
  } catch (err) {
    toast(`Lỗi ghi nhận: ${err.message}`, 'error');
  }
}

/* ── Mapbox GL JS ── */
let mapboxTokenFetched = false;
async function ensureUserMapboxToken() {
  if (mapboxTokenFetched) return;
  const res = await fetch(API + '/config/mapbox-token');
  if (!res.ok) throw new Error('Không thể lấy cấu hình Mapbox từ server');
  const data = await res.json();
  if (!data || !data.token) throw new Error('Cấu hình Mapbox không hợp lệ');
  mapboxgl.accessToken = data.token;
  mapboxTokenFetched = true;
}

function initUserMap(farms, plants) {
  const container = document.getElementById('user-map');
  if (!container) return;

  if (userMap) {
    try {
      userMap.remove();
    } catch (e) {}
    userMap = null;
  }
  userMarkers = [];

  container.innerHTML = '';
  const mapDiv = document.createElement('div');
  mapDiv.style.width = '100%';
  mapDiv.style.height = '100%';
  container.appendChild(mapDiv);

  const map = new mapboxgl.Map({
    container: mapDiv,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [106.3, 12.5],
    zoom: 5
  });
  userMap = map;

  map.addControl(new mapboxgl.NavigationControl());

  map.on('load', () => {
    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    // Draw Farms
    farms.forEach(farm => {
      let coords = [];
      try {
        coords = typeof farm.polygon_coordinates === 'string' ? JSON.parse(farm.polygon_coordinates) : farm.polygon_coordinates;
      } catch (e) {}

      if (coords && coords.length > 0) {
        const farmSourceId = `user-farm-src-${farm.id}`;
        const farmLayerId = `user-farm-layer-${farm.id}`;
        const farmOutlineId = `user-farm-outline-${farm.id}`;

        const polygonCoords = [...coords];
        if (polygonCoords.length > 0 && 
            (polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] || 
             polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1])) {
          polygonCoords.push(polygonCoords[0]);
        }

        map.addSource(farmSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [polygonCoords]
            }
          }
        });

        map.addLayer({
          id: farmLayerId,
          type: 'fill',
          source: farmSourceId,
          layout: {},
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.25
          }
        });

        map.addLayer({
          id: farmOutlineId,
          type: 'line',
          source: farmSourceId,
          layout: {},
          paint: {
            'line-color': '#10b981',
            'line-width': 2
          }
        });

        coords.forEach(pt => {
          bounds.extend(pt);
          hasBounds = true;
        });

        map.on('click', farmLayerId, (e) => {
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="map-tooltip" style="font-family: inherit; font-size: 12px; color: var(--text-main);">
                <h4 style="font-size: 13px; font-weight:700; color:var(--green-dark); margin-bottom:4px;">🏡 ${esc(farm.name)}</h4>
                <p style="margin-bottom:2px;">Diện tích: <strong>${farm.area ? Math.round(parseFloat(farm.area)).toLocaleString('vi-VN') : 0} m²</strong></p>
                <p style="color:var(--text-muted); font-style:italic;">${esc(farm.description || 'Không có mô tả')}</p>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', farmLayerId, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', farmLayerId, () => map.getCanvas().style.cursor = '');
      }
    });

    // Draw Plants
    plants.forEach(plant => {
      if (plant.latitude && plant.longitude) {
        const lat = parseFloat(plant.latitude);
        const lng = parseFloat(plant.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const wrapper = document.createElement('div');
          wrapper.className = 'plant-marker-wrap';
          wrapper.style.cursor = 'pointer';

          const el = document.createElement('div');
          let healthClass = 'health-default';
          if (plant.health_status === 'Tốt') healthClass = 'health-tot';
          else if (plant.health_status === 'Cần chú ý') healthClass = 'health-watch';
          else if (plant.health_status === 'Bệnh') healthClass = 'health-sick';

          el.className = `plant-id-marker ${healthClass}`;
          el.innerHTML = `<span>${esc(plant.tree_code || plant.id)}</span>`;
          wrapper.appendChild(el);

          el.style.width = '30px';
          el.style.height = '30px';
          el.style.borderRadius = '50%';
          el.style.border = '2px white solid';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.fontSize = '9px';
          el.style.fontWeight = '700';
          el.style.color = '#fff';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

          if (plant.health_status === 'Tốt') el.style.background = '#22c55e';
          else if (plant.health_status === 'Cần chú ý') el.style.background = '#eab308';
          else if (plant.health_status === 'Bệnh') el.style.background = '#ef4444';
          else el.style.background = '#3b82f6';

          const marker = new mapboxgl.Marker(wrapper)
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div class="map-tooltip" style="font-family: inherit; font-size: 12px; color: var(--text-main); min-width: 160px;">
                  <h4 style="font-size: 13px; font-weight:700; color:var(--green-dark); margin-bottom:6px;"><i class="fa-solid fa-tree"></i> Cây ${esc(plant.tree_code || plant.id)}</h4>
                  <p style="margin-bottom:3px;">Loại: <strong>${esc(plant.plant_type)}</strong></p>
                  <p style="margin-bottom:3px;">Sức khỏe: <strong>${esc(plant.health_status)}</strong></p>
                  <p style="margin-bottom:6px; color:var(--text-muted);">Vị trí: ${esc(plant.location || 'Chưa rõ')}</p>
                  <div>
                    <button class="btn btn-primary btn-xs" onclick="openCareModal(${plant.id}, '${esc(plant.tree_code || plant.id)}', '${esc(plant.plant_type)}')">
                      <i class="fa-solid fa-file-signature"></i> Nhật ký
                    </button>
                  </div>
                </div>
              `)
            )
            .addTo(map);

          userMarkers.push({ marker, plant });
          bounds.extend([lng, lat]);
          hasBounds = true;
        }
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 1000 });
    }
  });
}

/* ── Care Log Modal ── */
function openCareModal(plantId, treeCode, plantType) {
  document.getElementById('c-plant-id').value = plantId;
  document.getElementById('c-plant-display').value = `Cây ${treeCode} - ${plantType}`;
  document.getElementById('c-note').value = '';
  document.getElementById('c-log-type').value = 'Tưới nước';
  
  onCareLogTypeChange();

  document.getElementById('care-modal').style.display = 'flex';
}

function closeCareModal() {
  document.getElementById('care-modal').style.display = 'none';
}

function onCareLogTypeChange() {
  const logType = document.getElementById('c-log-type').value;
  const container = document.getElementById('care-detail-fields');
  if (!container) return;

  container.innerHTML = '';
  const configs = allConfigsCache || {};

  if (logType === 'Tưới nước') {
    const waterMethods = configs.water_methods || [];
    container.innerHTML = `
      <div class="field">
        <label>Phương pháp tưới nước *</label>
        <select id="c-detail-method">
          ${waterMethods.map(m => `<option>${esc(m)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Lượng nước (Lít) *</label>
        <input type="number" step="any" id="c-detail-amount" value="2">
      </div>
    `;
  } else if (logType === 'Bón phân') {
    const fertilizers = configs.fertilizers || [];
    container.innerHTML = `
      <div class="field">
        <label>Loại phân bón *</label>
        <select id="c-detail-fertilizer">
          ${fertilizers.map(f => `<option>${esc(f)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="display: flex; gap: 10px; margin-bottom: 0;">
        <div class="field" style="flex: 2;">
          <label>Liều lượng *</label>
          <input type="number" step="any" id="c-detail-amount" value="100">
        </div>
        <div class="field" style="flex: 1;">
          <label>Đơn vị</label>
          <select id="c-detail-unit">
            <option value="gam">gam</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="lít">lít</option>
          </select>
        </div>
      </div>
    `;
  } else if (logType === 'Phun thuốc') {
    const pesticides = configs.pesticides || [];
    container.innerHTML = `
      <div class="field">
        <label>Loại thuốc bảo vệ thực vật *</label>
        <select id="c-detail-pesticide">
          ${pesticides.map(p => `<option>${esc(p)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="display: flex; gap: 10px; margin-bottom: 0;">
        <div class="field" style="flex: 2;">
          <label>Liều lượng *</label>
          <input type="number" step="any" id="c-detail-amount" value="50">
        </div>
        <div class="field" style="flex: 1;">
          <label>Đơn vị</label>
          <select id="c-detail-unit">
            <option value="ml">ml</option>
            <option value="gam">gam</option>
            <option value="lít">lít</option>
          </select>
        </div>
      </div>
    `;
  } else if (logType === 'Cắt cành & Cắt lá') {
    const leafReasons = configs.leaf_cut_reasons || [];
    container.innerHTML = `
      <div class="field">
        <label>Lý do cắt tỉa *</label>
        <select id="c-detail-reason">
          ${leafReasons.map(r => `<option>${esc(r)}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (logType === 'Tỉa hoa') {
    const flowerReasons = configs.flower_prune_reasons || [];
    container.innerHTML = `
      <div class="field">
        <label>Lý do tỉa hoa *</label>
        <select id="c-detail-reason">
          ${flowerReasons.map(r => `<option>${esc(r)}</option>`).join('')}
        </select>
      </div>
    `;
  }
}

async function saveCareLog() {
  const plantId = document.getElementById('c-plant-id').value;
  const logType = document.getElementById('c-log-type').value;
  const note = document.getElementById('c-note').value.trim();

  const body = {
    log_type: logType,
    log_date: new Date().toISOString().slice(0,10),
    note,
    media_urls: [],
    details: {}
  };

  const btn = document.getElementById('care-save-btn');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...';

  try {
    if (logType === 'Tưới nước') {
      const method = document.getElementById('c-detail-method').value;
      const amount = parseFloat(document.getElementById('c-detail-amount').value);
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập lượng nước hợp lệ!');
      body.details = { method, amount, unit: 'lít' };
    } else if (logType === 'Bón phân') {
      const fertilizer_name = document.getElementById('c-detail-fertilizer').value;
      const amount = parseFloat(document.getElementById('c-detail-amount').value);
      const unit = document.getElementById('c-detail-unit').value;
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập liều lượng hợp lệ!');
      body.details = { fertilizer_name, amount, unit };
    } else if (logType === 'Phun thuốc') {
      const pesticide_name = document.getElementById('c-detail-pesticide').value;
      const amount = parseFloat(document.getElementById('c-detail-amount').value);
      const unit = document.getElementById('c-detail-unit').value;
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập liều lượng hợp lệ!');
      body.details = { pesticide_name, amount, unit };
    } else if (logType === 'Cắt cành & Cắt lá') {
      const reason = document.getElementById('c-detail-reason').value;
      body.details = { reason };
    } else if (logType === 'Tỉa hoa') {
      const reason = document.getElementById('c-detail-reason').value;
      body.details = { reason };
    }

    await api(`/plants/${plantId}/logs`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    toast('Ghi nhật ký chăm sóc thành công!');
    closeCareModal();
    loadUserDashboard();
  } catch (err) {
    toast('Lỗi lưu nhật ký: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}
