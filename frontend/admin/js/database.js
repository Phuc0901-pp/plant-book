/* ════════════════════════════════════════════════════════
   Plant Book Admin — database.js (Cơ sở dữ liệu & Nhật ký Canh tác)
   Sub-tabs: 1. Dữ liệu canh tác, 2. Vật tư & Kho, 3. Thư viện media
   Version: v1.0.1
   ════════════════════════════════════════════════════════ */

let dbUsersCache = [];
let dbFarmsCache = [];
let dbPlantsCache = [];
let activeDbTab = 'cultivation';

// Distinct Category Badge Styles & Colors
const supplyCategoryConfigs = {
  'Bón phân': { bg: '#fef3c7', color: '#78350f', border: '#fde68a', icon: 'fa-seedling', iconColor: '#92400e', label: '🧮 Bón phân' },
  'Phun thuốc': { bg: '#f3e8ff', color: '#6b21a8', border: '#ddd6fe', icon: 'fa-spray-can-sparkles', iconColor: '#8b5cf6', label: '🧪 Phun thuốc' },
  'Tiền nước': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-droplet', iconColor: '#3b82f6', label: '💧 Tiền nước' },
  'Nhân công': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: 'fa-user-gear', iconColor: '#10b981', label: '👷 Nhân công' }
};

function getSupplyCatConfig(catName) {
  return supplyCategoryConfigs[catName] || { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', icon: 'fa-box-open', iconColor: '#64748b', label: catName || 'Vật tư khác' };
}

function isVideoUrl(url) {
  if (!url) return false;
  const str = String(url).toLowerCase();
  return str.endsWith('.mp4') || str.endsWith('.webm') || str.endsWith('.ogg') || str.endsWith('.mov') || str.endsWith('.m4v') || str.includes('video') || str.includes('.mp4?');
}

function renderMediaThumbnail(m) {
  const url = typeof m === 'string' ? m : (m.url || m.file_url || '');
  if (!url) return '';

  if (isVideoUrl(url)) {
    return `
      <div style="position:relative; display:inline-block;">
        <video src="${esc(url)}" controls preload="metadata" style="max-width:280px; max-height:160px; border-radius:10px; border:1.5px solid #cbd5e1; background:#000; display:block;"></video>
        <span style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; backdrop-filter:blur(2px);">
          <i class="fa-solid fa-play"></i> Video
        </span>
      </div>
    `;
  }

  return `<img src="${esc(url)}" alt="Hình ảnh nhật ký" style="width:70px; height:70px; object-fit:cover; border-radius:10px; border:1.5px solid #cbd5e1; cursor:pointer;" onclick="window.open('${esc(url)}')">`;
}

async function initDatabasePage() {
  try {
    dbUsersCache = await api('/users') || [];
    dbFarmsCache = await api('/farms') || [];
    dbPlantsCache = await api('/plants') || [];

    const normalUsers = dbUsersCache.filter(u => u.role === 'user');

    // Populate Tab 1 Farm Filter (Primary Step)
    const fSelect = document.getElementById('db-filter-farm');
    if (fSelect) {
      fSelect.innerHTML = '<option value="">— Vui lòng chọn Trang trại trước —</option>' +
        dbFarmsCache.map(f => `<option value="${f.id}">🏡 ${esc(f.name)} ${f.owner_name ? `(${esc(f.owner_name)})` : ''}</option>`).join('');
    }

    // Populate Tab 2 Supplies Filters
    const suUserSelect = document.getElementById('db-supply-filter-user');
    if (suUserSelect) {
      suUserSelect.innerHTML = '<option value="">— Tất cả Khách hàng —</option>' +
        normalUsers.map(u => `<option value="${u.id}">👤 ${esc(u.full_name)} (${esc(u.phone || u.email)})</option>`).join('');
    }

    const suFarmSelect = document.getElementById('db-supply-filter-farm');
    if (suFarmSelect) {
      suFarmSelect.innerHTML = '<option value="">— Tất cả Trang trại —</option>' +
        dbFarmsCache.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
    }

    const fSupplyUser = document.getElementById('f-supply-user');
    if (fSupplyUser) {
      fSupplyUser.innerHTML = '<option value="">— Mặc định (Admin) —</option>' +
        normalUsers.map(u => `<option value="${u.id}">👤 ${esc(u.full_name)}</option>`).join('');
    }

    switchDatabaseTab('cultivation');
  } catch (err) {
    console.error('Error initializing database page:', err);
  }
}

function switchDatabaseTab(tab, syncUrl = true) {
  activeDbTab = tab;

  // Update tabs active state
  ['cultivation', 'supplies', 'media', 'history'].forEach(t => {
    const tabEl = document.getElementById(`db-tab-${t}`);
    const paneEl = document.getElementById(`db-pane-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (paneEl) paneEl.style.display = (t === tab ? 'block' : 'none');
  });

  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ page: 'database', tab });
  }

  if (tab === 'media') {
    initGlobalMediaLibrary();
  } else if (tab === 'supplies') {
    loadSuppliesTab();
  } else if (tab === 'history') {
    loadHistoryTab();
  }
}



// ── Tab 1: Dữ liệu Canh tác (Split-View Master-Detail AgTech ERP) ──
let currentDbSelectedFarmId = null;
let currentDbSelectedPlantId = null;
let currentDbPlantLogsCache = [];
let currentDbActiveActivityFilter = 'all';
let currentDbFarmPlantsCache = [];
let currentDbPlantProfileCache = null;

async function onDbFarmChange() {
  const farmId = document.getElementById('db-filter-farm')?.value;
  const heroBar = document.getElementById('db-farm-hero-bar');
  const splitView = document.getElementById('db-cultivation-split-view');
  const emptyPlaceholder = document.getElementById('db-farm-empty-placeholder');
  const farmTitle = document.getElementById('db-active-farm-title');
  const personnelList = document.getElementById('db-farm-personnel-list');
  const heroPlantsCount = document.getElementById('db-hero-plants-count');
  const masterPlantBadge = document.getElementById('db-master-plant-count-badge');

  currentDbSelectedFarmId = farmId ? parseInt(farmId) : null;
  currentDbSelectedPlantId = null;
  currentDbPlantLogsCache = [];

  if (!farmId) {
    if (farmTitle) farmTitle.textContent = 'Vui lòng chọn Trang trại';
    if (heroBar) heroBar.style.display = 'none';
    if (splitView) splitView.style.display = 'none';
    if (emptyPlaceholder) emptyPlaceholder.style.display = 'block';
    return;
  }

  const farm = dbFarmsCache.find(f => f.id == farmId);
  if (farmTitle) {
    farmTitle.textContent = `🏡 ${farm ? farm.name : 'Trang trại'} ${farm && farm.owner_name ? `· Nông hộ: ${farm.owner_name}` : ''}`;
  }

  // 1. Gather Personnel (Owner + assigned users) - NO ROLE DISPLAYED
  const farmUsersMap = new Map();
  if (farm && farm.user_id) {
    const owner = dbUsersCache.find(u => u.id == farm.user_id);
    if (owner) {
      farmUsersMap.set(owner.id, {
        id: owner.id,
        name: owner.full_name || farm.owner_name || 'Chủ trang trại',
        phone: owner.phone || farm.phone || owner.email || 'Chưa có SĐT'
      });
    } else if (farm.owner_name) {
      farmUsersMap.set(`owner_${farm.id}`, {
        id: farm.user_id,
        name: farm.owner_name,
        phone: farm.phone || 'Chưa có SĐT'
      });
    }
  } else if (farm && farm.owner_name) {
    farmUsersMap.set(`owner_${farm.id}`, {
      id: null,
      name: farm.owner_name,
      phone: farm.phone || 'Chưa có SĐT'
    });
  }

  dbUsersCache.forEach(u => {
    if (u.farm_id == farmId) {
      if (!farmUsersMap.has(u.id)) {
        farmUsersMap.set(u.id, {
          id: u.id,
          name: u.full_name || 'Nông hộ',
          phone: u.phone || u.email || 'Chưa có SĐT'
        });
      }
    }
  });

  const farmPersonnel = Array.from(farmUsersMap.values());

  if (personnelList) {
    if (farmPersonnel.length === 0) {
      personnelList.innerHTML = '<span style="font-size:12px; color:#64748b; font-style:italic;">Chưa có người tham gia</span>';
    } else {
      personnelList.innerHTML = farmPersonnel.map(p => `
        <div style="display:inline-flex; align-items:center; gap:6px; background:#ffffff; border:1.5px solid #a7f3d0; border-radius:20px; padding:4px 12px; font-size:12px; font-weight:700; color:#064e3b; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
          <i class="fa-solid fa-user-check" style="color:#059669; font-size:11px;"></i> ${esc(p.name)} <span style="color:#64748b; font-weight:500;">(${esc(p.phone)})</span>
        </div>
      `).join('');
    }
  }

  // 2. Filter Plants for this Farm
  currentDbFarmPlantsCache = dbPlantsCache.filter(p => p.farm_id == farmId);
  if (heroPlantsCount) heroPlantsCount.textContent = currentDbFarmPlantsCache.length;
  if (masterPlantBadge) masterPlantBadge.textContent = `${currentDbFarmPlantsCache.length} cây`;

  // Show Split-view, hide placeholder
  if (heroBar) heroBar.style.display = 'flex';
  if (splitView) splitView.style.display = 'grid';
  if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';

  // Render Master list
  renderMasterPlantsList(currentDbFarmPlantsCache);

  // Auto select first plant if available
  if (currentDbFarmPlantsCache.length > 0) {
    selectTreeForDetail(currentDbFarmPlantsCache[0].id);
  } else {
    renderEmptyDetailView('Trang trại này chưa có cây trồng nào được khởi tạo.');
  }
}
window.onDbFarmChange = onDbFarmChange;
window.onDbFilterChange = onDbFarmChange;

function renderMasterPlantsList(plants) {
  const container = document.getElementById('db-master-plants-list');
  if (!container) return;

  if (plants.length === 0) {
    container.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8; font-size:12.5px;">Không tìm thấy cây trồng phù hợp.</div>';
    return;
  }

  container.innerHTML = plants.map(p => {
    const isSelected = (p.id === currentDbSelectedPlantId);
    const healthStatus = p.health_status || 'Tốt';
    let healthBadgeStyle = 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;';
    if (healthStatus === 'Bệnh') healthBadgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
    else if (healthStatus === 'Cần theo dõi') healthBadgeStyle = 'background:#fef3c7; color:#d97706; border:1px solid #fde68a;';

    return `
      <div class="db-tree-card" id="db-tree-card-${p.id}" onclick="selectTreeForDetail(${p.id})"
           style="padding:12px 14px; border-radius:12px; cursor:pointer; transition:all 0.2s ease; border:${isSelected ? '2px solid #059669' : '1.5px solid #e2e8f0'}; background:${isSelected ? '#f0fdf4' : '#ffffff'}; box-shadow:${isSelected ? '0 4px 14px rgba(5,150,105,0.15)' : '0 2px 6px rgba(0,0,0,0.02)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:13.5px; color:${isSelected ? '#064e3b' : '#0f172a'}; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-tree" style="color:${isSelected ? '#059669' : '#64748b'};"></i> Cây #${esc(p.tree_code || p.id)}
          </strong>
          <span style="font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:12px; ${healthBadgeStyle}">
            ${esc(healthStatus)}
          </span>
        </div>
        <div style="font-size:12px; color:#475569; font-weight:700;">
          ${esc(p.plant_type)} ${p.plant_variety ? `(${esc(p.plant_variety)})` : ''}
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
          <span><i class="fa-solid fa-location-dot" style="font-size:10px; color:#059669;"></i> ${esc(p.location || 'Chưa gán vị trí')}</span>
          ${p.plant_age ? `<span style="font-weight:600; color:#0f172a;">${esc(p.plant_age)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterMasterPlantList() {
  const query = (document.getElementById('db-plant-search-input')?.value || '').toLowerCase().trim();
  if (!query) {
    renderMasterPlantsList(currentDbFarmPlantsCache);
    return;
  }

  const filtered = currentDbFarmPlantsCache.filter(p => 
    String(p.tree_code || p.id).toLowerCase().includes(query) ||
    String(p.plant_type || '').toLowerCase().includes(query) ||
    String(p.plant_variety || '').toLowerCase().includes(query) ||
    String(p.location || '').toLowerCase().includes(query)
  );

  renderMasterPlantsList(filtered);
}
window.filterMasterPlantList = filterMasterPlantList;

async function selectTreeForDetail(plantId) {
  currentDbSelectedPlantId = plantId;
  currentDbActiveActivityFilter = 'all';

  // Highlight card in left column
  document.querySelectorAll('.db-tree-card').forEach(card => {
    card.style.border = '1.5px solid #e2e8f0';
    card.style.background = '#ffffff';
    card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
  });
  const activeCard = document.getElementById(`db-tree-card-${plantId}`);
  if (activeCard) {
    activeCard.style.border = '2px solid #059669';
    activeCard.style.background = '#f0fdf4';
    activeCard.style.boxShadow = '0 4px 14px rgba(5,150,105,0.15)';
  }

  const summaryBox = document.getElementById('db-plant-cost-summary');
  const filterBar = document.getElementById('db-activity-filter-bar');
  const container = document.getElementById('db-cultivation-timeline-container');

  if (summaryBox) summaryBox.style.display = 'none';
  if (filterBar) filterBar.style.display = 'none';
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;"><i class="fa fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px;"></i> Đang tải dữ liệu canh tác & chi phí đầu tư cây...</div>';
  }

  try {
    const plant = await api(`/plants/${plantId}`);
    currentDbPlantProfileCache = plant;
    const logs = plant.logs || [];
    currentDbPlantLogsCache = logs;

    // Calculate Costs Breakdown
    let totalConsumableCost = 0; // Phân bón, Thuốc
    let totalFixedCost = 0;      // Tưới nước, Tỉa cành, Thuế/Nhân công

    logs.forEach(l => {
      let details = {};
      try {
        details = typeof l.details === 'string' ? JSON.parse(l.details) : (l.details || {});
      } catch (e) { details = {}; }

      const cost = parseFloat(details.cost || details.supply_cost || l.cost || 0);
      if (!isNaN(cost) && cost > 0) {
        if (['Bón phân', 'Phun thuốc'].includes(l.log_type)) {
          totalConsumableCost += cost;
        } else {
          totalFixedCost += cost;
        }
      }
    });

    const totalInvestmentCost = totalConsumableCost + totalFixedCost;

    // Render Profile & Cost Summary Header Box
    if (summaryBox) {
      summaryBox.style.display = 'block';
      summaryBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; opacity:0.85;">
              🌳 HỒ SƠ CÂY #${esc(plant.tree_code || plant.id)} · ${esc(plant.farm_name || 'Trang trại')}
            </div>
            <div style="font-size:20px; font-weight:800; margin-top:2px;">
              ${esc(plant.plant_type)} ${plant.plant_variety ? `(${esc(plant.plant_variety)})` : ''}
            </div>
            <div style="font-size:12.5px; opacity:0.9; margin-top:2px;">
              Vị trí: <strong>${esc(plant.location || 'Chưa gán')}</strong> · Sức khỏe: <strong>${esc(plant.health_status || 'Tốt')}</strong> · Tuổi: <strong>${esc(plant.plant_age || 'Chưa rõ')}</strong>
            </div>
          </div>

          <!-- Total Cost Pills -->
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(4px); padding:10px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.25); text-align:right;">
              <div style="font-size:10.5px; text-transform:uppercase; opacity:0.85; font-weight:700;">💰 TỔNG ĐẦU TƯ</div>
              <div style="font-size:18px; font-weight:800; color:#fde047; margin-top:2px;">
                ${totalInvestmentCost > 0 ? totalInvestmentCost.toLocaleString('vi-VN') + ' đ' : '0 đ'}
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.1); padding:8px 12px; border-radius:12px; font-size:11.5px; display:flex; flex-direction:column; justify-content:center;">
              <div>🧪 Phân & Thuốc: <strong>${totalConsumableCost.toLocaleString('vi-VN')} đ</strong></div>
              <div>💧 Công & Điện nước: <strong>${totalFixedCost.toLocaleString('vi-VN')} đ</strong></div>
            </div>
          </div>
        </div>
      `;
    }

    // Render Activity Filter Chips
    if (filterBar) {
      filterBar.style.display = 'flex';
      renderActivityFilterChips(logs);
    }

    // Render Timeline Feed
    renderDetailTimeline();

  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--red);"><i class="fa fa-circle-xmark"></i> Lỗi: ${esc(err.message)}</div>`;
    }
  }
}
window.selectTreeForDetail = selectTreeForDetail;

function renderActivityFilterChips(logs) {
  const container = document.getElementById('db-activity-chips-container');
  if (!container) return;

  const counts = { all: logs.length };
  logs.forEach(l => {
    const t = l.log_type || 'Khác';
    counts[t] = (counts[t] || 0) + 1;
  });

  const chipTypes = ['all', 'Tưới nước', 'Bón phân', 'Phun thuốc', 'Cắt lá', 'Tỉa hoa', 'Bệnh cây', 'Thu hoạch'];
  const availableTypes = chipTypes.filter(t => t === 'all' || counts[t] > 0);

  const typeIcons = {
    all: 'fa-list-ul',
    'Tưới nước': 'fa-droplet',
    'Bón phân': 'fa-seedling',
    'Phun thuốc': 'fa-spray-can-sparkles',
    'Cắt lá': 'fa-scissors',
    'Tỉa hoa': 'fa-scissors',
    'Bệnh cây': 'fa-bug',
    'Thu hoạch': 'fa-basket-shopping'
  };

  container.innerHTML = availableTypes.map(t => {
    const isActive = (currentDbActiveActivityFilter === t);
    const label = t === 'all' ? 'Tất cả hoạt động' : t;
    const count = counts[t] || 0;
    const icon = typeIcons[t] || 'fa-tag';

    return `
      <button type="button" onclick="filterTimelineByActivity('${esc(t)}')"
              style="padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s ease; border:${isActive ? '1.5px solid #059669' : '1.5px solid #cbd5e1'}; background:${isActive ? '#059669' : '#ffffff'}; color:${isActive ? '#ffffff' : '#475569'}; display:inline-flex; align-items:center; gap:6px;">
        <i class="fa-solid ${icon}"></i> ${esc(label)} <span style="opacity:0.85; font-size:11px;">(${count})</span>
      </button>
    `;
  }).join('');
}

function filterTimelineByActivity(type) {
  currentDbActiveActivityFilter = type;
  renderActivityFilterChips(currentDbPlantLogsCache);
  renderDetailTimeline();
}
window.filterTimelineByActivity = filterTimelineByActivity;

function renderDetailTimeline() {
  const container = document.getElementById('db-cultivation-timeline-container');
  if (!container) return;

  const plant = currentDbPlantProfileCache;
  let logs = currentDbPlantLogsCache;

  if (currentDbActiveActivityFilter !== 'all') {
    logs = logs.filter(l => l.log_type === currentDbActiveActivityFilter);
  }

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; text-align:center;">
        <i class="fa-solid fa-clipboard-list" style="font-size:36px; color:#94a3b8; margin-bottom:12px;"></i>
        <p style="font-size:13.5px; font-weight:700; color:#475569;">
          ${currentDbActiveActivityFilter === 'all' ? 'Cây này chưa có nhật ký canh tác nào.' : `Không có hoạt động "${currentDbActiveActivityFilter}" nào được ghi nhận.`}
        </p>
      </div>`;
    return;
  }

  const typeConfigs = {
    'Tưới nước': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-droplet', iconColor: '#3b82f6' },
    'Bón phân': { bg: '#fef3c7', color: '#78350f', border: '#fde68a', icon: 'fa-seedling', iconColor: '#92400e' },
    'Phun thuốc': { bg: '#f3e8ff', color: '#6b21a8', border: '#ddd6fe', icon: 'fa-spray-can-sparkles', iconColor: '#8b5cf6' },
    'Cắt lá': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: 'fa-scissors', iconColor: '#10b981' },
    'Tỉa hoa': { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: 'fa-scissors', iconColor: '#ea580c' },
    'Bệnh cây': { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', icon: 'fa-bug', iconColor: '#ef4444' },
    'Thu hoạch': { bg: '#fefce8', color: '#a16207', border: '#fef08a', icon: 'fa-basket-shopping', iconColor: '#f59e0b' }
  };

  const groupedByDate = {};
  logs.forEach(l => {
    const dObj = new Date(l.log_date || l.created_at);
    const dateKey = !isNaN(dObj) ? dObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Không rõ ngày';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(l);
  });

  let timelineHtml = `
    <!-- Initiation Node -->
    <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:14px; padding:14px 16px; color:#064e3b; margin-bottom:20px; box-shadow:0 4px 12px rgba(16,185,129,0.06); display:flex; align-items:center; gap:12px;">
      <div style="width:38px; height:38px; border-radius:10px; background:#059669; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 4px 10px rgba(5,150,105,0.25);">
        <i class="fa-solid fa-flag"></i>
      </div>
      <div>
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#047857;">🌱 THÔNG TIN KHỞI TẠO VĨNH VIỄN CÂY TRỒNG</div>
        <div style="font-size:13.5px; font-weight:800; color:#064e3b; margin-top:2px;">Cây #${esc(plant.tree_code || plant.id)} (${esc(plant.plant_type)}) · Ngày tạo: ${fmtDate(plant.created_at)}</div>
      </div>
    </div>
  `;

  Object.keys(groupedByDate).forEach(dateStr => {
    const dayLogs = groupedByDate[dateStr];
    dayLogs.sort((a, b) => new Date(a.log_date || a.created_at) - new Date(b.log_date || b.created_at));

    timelineHtml += `
      <div style="margin-bottom:24px; background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.02);">
        <!-- Date Header -->
        <div style="background:linear-gradient(135deg, #f8fafc, #f1f5f9); padding:10px 16px; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
            <i class="fa-regular fa-calendar-check" style="color:#059669;"></i> Ngày ${esc(dateStr)}
          </div>
          <span class="badge" style="background:#059669; color:#ffffff; font-weight:800; font-size:11px; padding:2px 10px; border-radius:20px;">
            ${dayLogs.length} hoạt động
          </span>
        </div>

        <div style="padding:14px 16px; display:flex; flex-direction:column; gap:14px;">
    `;

    dayLogs.forEach(l => {
      const cfg = typeConfigs[l.log_type] || { bg: '#f8fafc', color: '#334155', border: '#e2e8f0', icon: 'fa-clipboard-check', iconColor: '#059669' };

      let details = {};
      try {
        details = typeof l.details === 'string' ? JSON.parse(l.details) : (l.details || {});
      } catch (e) { details = {}; }

      const timeStr = l.log_date ? new Date(l.log_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      const supplyName = details.supply_name || details.product_name || details.fertilizer_name || details.pesticide_name || '';
      const supplyImg = details.supply_image || details.product_image || details.image_url || '';
      const quantity = details.quantity || details.dosage || details.amount || '';
      const unit = details.unit || details.dosage_unit || '';
      const method = details.method || details.water_method || '';
      const reason = details.reason || '';
      const cost = parseFloat(details.cost || details.supply_cost || l.cost || 0);

      let logMediaList = [];
      if (l.media_urls) {
        try {
          const raw = typeof l.media_urls === 'string' ? JSON.parse(l.media_urls) : l.media_urls;
          if (Array.isArray(raw)) logMediaList = raw;
        } catch(e) {}
      }

      let supplyBoxHtml = '';
      if (supplyName || cost > 0 || quantity || method || reason) {
        supplyBoxHtml = `
          <div style="margin-top:10px; background:#f8fafc; border:1px solid ${cfg.border}; border-radius:10px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              ${supplyImg 
                ? `<img src="${esc(supplyImg)}" alt="${esc(supplyName)}" style="width:42px; height:42px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1;">` 
                : `<div style="width:40px; height:40px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:18px;"><i class="fa-solid ${cfg.icon}"></i></div>`
              }
              <div>
                <div style="font-size:13px; font-weight:800; color:#0f172a;">${esc(supplyName || l.log_type)}</div>
                ${quantity ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Liều lượng: <strong>${esc(quantity)} ${esc(unit)}</strong></div>` : ''}
                ${method ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Phương thức: <strong>${esc(method)}</strong></div>` : ''}
                ${reason ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Mục đích: <strong>${esc(reason)}</strong></div>` : ''}
              </div>
            </div>
            ${cost > 0 ? `<div style="font-size:13px; font-weight:800; color:#047857; background:#ecfdf5; padding:5px 12px; border-radius:8px; border:1px solid #a7f3d0;"><i class="fa-solid fa-coins"></i> ${cost.toLocaleString('vi-VN')} đ</div>` : ''}
          </div>
        `;
      }

      let attachedMediaHtml = '';
      if (logMediaList.length > 0) {
        attachedMediaHtml = `
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            ${logMediaList.map(renderMediaThumbnail).join('')}
          </div>
        `;
      }

      timelineHtml += `
        <div style="background:#ffffff; border:1px solid ${cfg.border}; border-radius:12px; padding:12px 14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; padding:3px 10px; border-radius:20px; font-size:11.5px; font-weight:800; display:inline-flex; align-items:center; gap:5px;">
                <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(l.log_type)}
              </span>
              ${timeStr ? `<span style="font-size:11.5px; font-weight:700; color:#64748b;"><i class="fa-regular fa-clock"></i> ${timeStr}</span>` : ''}
            </div>
            ${(l.creator_name || l.creator_phone) ? `
              <div style="display:inline-flex; align-items:center; gap:6px; background:#f0fdf4; border:1px solid #bbf7d0; color:#064e3b; padding:3px 10px; border-radius:8px; font-size:11.5px; font-weight:700;">
                <i class="fa-solid fa-user-check" style="color:#059669;"></i> 👤 Thực hiện bởi: <strong>${esc(l.creator_name || 'Nông hộ')}</strong> ${l.creator_phone ? `· 📞 <strong>${esc(l.creator_phone)}</strong>` : ''}
              </div>` : ''}
          </div>

          ${l.note ? `<div style="font-size:13px; color:#1e293b; margin-top:8px; line-height:1.5; font-weight:500;">${esc(l.note)}</div>` : ''}

          ${supplyBoxHtml}
          ${attachedMediaHtml}
        </div>
      `;
    });

    timelineHtml += `
        </div>
      </div>
    `;
  });

  container.innerHTML = timelineHtml;
}

function renderEmptyDetailView(msg) {
  const container = document.getElementById('db-cultivation-timeline-container');
  const summaryBox = document.getElementById('db-plant-cost-summary');
  const filterBar = document.getElementById('db-activity-filter-bar');

  if (summaryBox) summaryBox.style.display = 'none';
  if (filterBar) filterBar.style.display = 'none';
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="padding:50px 20px; background:#ffffff; border-radius:16px; border:1.5px solid #e2e8f0; text-align:center;">
        <i class="fa-solid fa-tree" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
        <p style="font-size:13.5px; font-weight:700; color:#475569;">${esc(msg)}</p>
      </div>`;
  }
}

function exportCultivationPDF() {
  if (!currentDbPlantProfileCache) return;
  window.print();
}
window.exportCultivationPDF = exportCultivationPDF;

function onSupplyFilterChange() {
  const userId = document.getElementById('db-supply-filter-user')?.value;
  const farmSelect = document.getElementById('db-supply-filter-farm');

  let filteredFarms = dbFarmsCache;
  if (userId) {
    filteredFarms = dbFarmsCache.filter(f => f.user_id == userId);
    if (farmSelect && farmSelect.value && !filteredFarms.some(f => f.id == farmSelect.value)) {
      farmSelect.value = '';
    }
  }

  if (farmSelect) {
    farmSelect.innerHTML = '<option value="">— Tất cả Trang trại —</option>' +
      filteredFarms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
  }

  loadSuppliesTab();
}

// ── Tab 2: Supplies Catalog & ERP Inventory Suite ──
let allSuppliesCache = [];
let supplyGroupMode = 'flat';
let currentDbActiveSupplyChip = 'all';

async function loadSuppliesTab() {
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;

  const userId = document.getElementById('db-supply-filter-user')?.value;
  const farmId = document.getElementById('db-supply-filter-farm')?.value;

  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('user_id', userId);
  if (farmId) queryParams.set('farm_id', farmId);

  tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải kho vật tư...</td></tr>';

  try {
    const supplies = await api(`/supplies?${queryParams.toString()}`) || [];
    allSuppliesCache = supplies;
    updateSuppliesKPICards(supplies);
    renderSupplyChipsBar(supplies);
    filterSupplies();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

function updateSuppliesKPICards(supplies) {
  const totalCountEl = document.getElementById('kpi-supply-total-count');
  const totalValEl = document.getElementById('kpi-supply-total-value');
  const lowStockEl = document.getElementById('kpi-supply-low-stock');
  const catEl = document.getElementById('kpi-supply-categories');

  let totalSKU = supplies.length;
  let totalValue = 0;
  let lowStockCount = 0;
  const catMap = {};

  supplies.forEach(s => {
    const cat = s.category || s.type || 'Vật tư';
    catMap[cat] = (catMap[cat] || 0) + 1;
    const isEndless = ['Nhân công', 'Tiền nước'].includes(cat);
    const qty = parseFloat(s.stock_quantity || s.quantity || 0);
    const price = parseFloat(s.unit_price || s.package_price || 0);

    if (!isNaN(qty) && !isNaN(price) && !isEndless && qty > 0 && price > 0) {
      totalValue += (qty * price);
    }
    if (!isEndless && qty <= 5) {
      lowStockCount++;
    }
  });

  if (totalCountEl) totalCountEl.textContent = totalSKU;
  if (totalValEl) totalValEl.textContent = totalValue > 0 ? totalValue.toLocaleString('vi-VN') + ' đ' : '0 đ';
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (catEl) catEl.textContent = `${Object.keys(catMap).length} Nhóm hàng`;
}

function renderSupplyChipsBar(supplies) {
  const container = document.getElementById('db-supply-chips-bar');
  if (!container) return;

  const counts = { all: supplies.length, low_stock: 0, endless: 0 };
  supplies.forEach(s => {
    const cat = s.category || s.type || 'Khác';
    counts[cat] = (counts[cat] || 0) + 1;
    const isEndless = ['Nhân công', 'Tiền nước'].includes(cat);
    const qty = parseFloat(s.stock_quantity || s.quantity || 0);
    if (!isEndless && qty <= 5) counts.low_stock++;
    if (isEndless) counts.endless++;
  });

  const availableCategories = Object.keys(counts).filter(k => !['all', 'low_stock', 'endless'].includes(k) && counts[k] > 0);

  let chips = [
    { id: 'all', label: 'Tất cả mặt hàng', icon: 'fa-boxes-stacked', count: counts.all },
    { id: 'low_stock', label: 'Cảnh báo tồn thấp (≤ 5)', icon: 'fa-triangle-exclamation', count: counts.low_stock, isAlert: true }
  ];

  availableCategories.forEach(cat => {
    const cfg = getSupplyCatConfig(cat);
    chips.push({ id: cat, label: cat, icon: cfg.icon, count: counts[cat] });
  });

  if (counts.endless > 0) {
    chips.push({ id: 'endless', label: 'Dịch vụ & Vô hạn', icon: 'fa-infinity', count: counts.endless });
  }

  container.innerHTML = chips.map(c => {
    const isActive = (currentDbActiveSupplyChip === c.id);
    let chipStyle = '';
    if (isActive) {
      chipStyle = c.isAlert 
        ? 'background:#dc2626; color:#ffffff; border:1.5px solid #dc2626;' 
        : 'background:#059669; color:#ffffff; border:1.5px solid #059669;';
    } else {
      chipStyle = c.isAlert 
        ? 'background:#fffafb; color:#dc2626; border:1.5px solid #fecaca;' 
        : 'background:#ffffff; color:#475569; border:1.5px solid #cbd5e1;';
    }

    return `
      <button type="button" onclick="filterSuppliesByChip('${esc(c.id)}')"
              style="padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s ease; ${chipStyle} display:inline-flex; align-items:center; gap:6px;">
        <i class="fa-solid ${c.icon}"></i> ${esc(c.label)} <span style="opacity:0.85; font-size:11px;">(${c.count})</span>
      </button>
    `;
  }).join('');
}

function filterSuppliesByChip(chipType) {
  currentDbActiveSupplyChip = chipType;
  renderSupplyChipsBar(allSuppliesCache);
  filterSupplies();
}
window.filterSuppliesByChip = filterSuppliesByChip;

function renderStockGauge(stockQty, unit, isEndless) {
  if (isEndless) {
    return `<span class="badge" style="background:#ecfdf5; color:#047857; font-weight:800; padding:4px 10px; border-radius:20px; border:1px solid #a7f3d0; font-size:11.5px;"><i class="fa-solid fa-infinity"></i> Vô hạn ∞</span>`;
  }
  const qty = parseFloat(stockQty || 0);
  const isLow = qty <= 5;
  const isMed = qty > 5 && qty <= 20;
  const barColor = isLow ? '#dc2626' : (isMed ? '#f59e0b' : '#059669');
  const barPct = Math.min(100, Math.max(12, isLow ? 20 : (isMed ? 55 : 90)));

  return `
    <div style="display:flex; flex-direction:column; gap:4px; min-width:140px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800; font-size:13px; color:${barColor};">
          ${qty} ${esc(unit || '')}
        </span>
        ${isLow ? `<span style="font-size:10px; font-weight:800; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:6px; border:1px solid #fecaca;"><i class="fa-solid fa-triangle-exclamation"></i> Cần nhập</span>` : ''}
      </div>
      <div style="width:100%; height:6px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
        <div style="width:${barPct}%; height:100%; background:${barColor}; border-radius:4px;"></div>
      </div>
    </div>
  `;
}

function setSupplyGroupMode(mode) {
  supplyGroupMode = mode;

  const btnFlat = document.getElementById('btn-supply-group-flat');
  const btnGrid = document.getElementById('btn-supply-group-grid');
  const btnCat = document.getElementById('btn-supply-group-cat');
  const btnFarm = document.getElementById('btn-supply-group-farm');

  [btnFlat, btnGrid, btnCat, btnFarm].forEach(b => {
    if (b) {
      b.style.background = 'transparent';
      b.style.color = '#475569';
      b.style.fontWeight = '700';
    }
  });

  const activeBtn = mode === 'flat' ? btnFlat : (mode === 'grid' ? btnGrid : (mode === 'category' ? btnCat : btnFarm));
  if (activeBtn) {
    activeBtn.style.background = '#059669';
    activeBtn.style.color = '#ffffff';
    activeBtn.style.fontWeight = '800';
  }

  filterSupplies();
}
window.setSupplyGroupMode = setSupplyGroupMode;

function renderSuppliesTable(supplies) {
  const tableContainer = document.getElementById('supplies-table-container');
  const gridContainer = document.getElementById('supplies-grid-container');
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;

  if (supplies.length === 0) {
    if (tableContainer) tableContainer.style.display = 'block';
    if (gridContainer) gridContainer.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding:40px; text-align:center; color:#94a3b8;"><i class="fa-solid fa-box-open" style="font-size:36px; margin-bottom:10px; display:block;"></i>Kho vật tư hiện chưa có sản phẩm nào theo bộ lọc đã chọn.</td></tr>';
    return;
  }

  // Row Renderer Helper
  const renderRow = (s) => {
    const cat = s.category || s.type || 'Vật tư';
    const cfg = getSupplyCatConfig(cat);
    const priceDisplay = s.unit_price ? parseFloat(s.unit_price).toLocaleString('vi-VN') + ' đ' : (s.package_price ? parseFloat(s.package_price).toLocaleString('vi-VN') + ' đ' : '—');
    const isEndless = ['Nhân công', 'Tiền nước'].includes(cat);
    const qty = parseFloat(s.stock_quantity || s.quantity || 0);
    const price = parseFloat(s.unit_price || s.package_price || 0);
    const totalAssetVal = (!isEndless && qty > 0 && price > 0) ? (qty * price).toLocaleString('vi-VN') + ' đ' : '—';
    const ownerText = s.creator_name || s.supplier || s.note || 'Admin';

    return `
      <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="padding:12px 14px;">
          ${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" style="width:46px; height:46px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer;" onclick="openViewSupplyModal(${s.id})">` : `<div style="width:46px; height:46px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:20px; cursor:pointer;" onclick="openViewSupplyModal(${s.id})"><i class="fa-solid ${cfg.icon}"></i></div>`}
        </td>
        <td style="padding:12px 14px; font-weight:700; color:#0f172a;">
          <a href="javascript:void(0)" onclick="openViewSupplyModal(${s.id})" style="color:#0f172a; text-decoration:none;" onmouseover="this.style.color='#059669'" onmouseout="this.style.color='#0f172a'">
            ${esc(s.name)}
          </a>
        </td>
        <td style="padding:12px 14px;">
          <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; font-weight:800; padding:4px 10px; border-radius:20px; font-size:11.5px; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(cat)}
          </span>
        </td>
        <td style="padding:12px 14px;">
          ${renderStockGauge(s.stock_quantity, s.unit, isEndless)}
        </td>
        <td style="padding:12px 14px; font-weight:800; color:#059669;">${priceDisplay}</td>
        <td style="padding:12px 14px; font-weight:800; color:#0f172a;">${totalAssetVal}</td>
        <td style="padding:12px 14px; font-size:12px; color:#64748b;">👤 ${esc(ownerText)}</td>
        <td style="padding:12px 14px; text-align:center;">
          <div style="display:inline-flex; gap:6px;">
            <button class="btn btn-primary btn-sm" onclick="openViewSupplyModal(${s.id})" style="padding:5px 10px; font-size:11.5px; font-weight:700;" title="Xem chi tiết">
              <i class="fa-solid fa-eye"></i> Xem
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editSupply(${s.id})" style="padding:5px 10px; font-size:11.5px; font-weight:700;" title="Chỉnh sửa">
              <i class="fa fa-pen"></i> Sửa
            </button>
          </div>
        </td>
      </tr>
    `;
  };

  // 1. Grid Cards View Mode
  if (supplyGroupMode === 'grid') {
    if (tableContainer) tableContainer.style.display = 'none';
    if (gridContainer) {
      gridContainer.style.display = 'grid';
      gridContainer.innerHTML = supplies.map(s => {
        const cat = s.category || s.type || 'Vật tư';
        const cfg = getSupplyCatConfig(cat);
        const priceDisplay = s.unit_price ? parseFloat(s.unit_price).toLocaleString('vi-VN') + ' đ' : (s.package_price ? parseFloat(s.package_price).toLocaleString('vi-VN') + ' đ' : '—');
        const isEndless = ['Nhân công', 'Tiền nước'].includes(cat);

        return `
          <div class="card" style="border-radius:14px; overflow:hidden; border:1.5px solid #e2e8f0; background:#ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s ease, box-shadow 0.15s ease;">
            <div style="padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
                <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; font-weight:800; padding:3px 10px; border-radius:20px; font-size:11px; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(cat)}
                </span>
                <span style="font-size:14px; font-weight:800; color:#059669;">${priceDisplay}</span>
              </div>

              <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                ${s.image_url 
                  ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" style="width:54px; height:54px; object-fit:cover; border-radius:10px; border:1px solid #cbd5e1; cursor:pointer;" onclick="openViewSupplyModal(${s.id})">` 
                  : `<div style="width:54px; height:54px; border-radius:10px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:24px; cursor:pointer;" onclick="openViewSupplyModal(${s.id})"><i class="fa-solid ${cfg.icon}"></i></div>`
                }
                <div style="flex:1;">
                  <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:800; color:#0f172a; line-height:1.3; cursor:pointer;" onclick="openViewSupplyModal(${s.id})">
                    ${esc(s.name)}
                  </h4>
                  <div style="font-size:11.5px; color:#64748b;">👤 ${esc(s.creator_name || s.supplier || 'Admin')}</div>
                </div>
              </div>

              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-top:8px;">
                <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px;">Mức Tồn Kho</div>
                ${renderStockGauge(s.stock_quantity, s.unit, isEndless)}
              </div>
            </div>

            <div style="padding:10px 16px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <button class="btn btn-secondary btn-sm" onclick="openViewSupplyModal(${s.id})" style="font-size:11.5px; font-weight:700; padding:4px 10px;">
                <i class="fa-solid fa-eye"></i> Chi tiết
              </button>
              <button class="btn btn-primary btn-sm" onclick="editSupply(${s.id})" style="font-size:11.5px; font-weight:700; padding:4px 10px;">
                <i class="fa fa-pen"></i> Sửa
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
    return;
  }

  // Table Modes
  if (tableContainer) tableContainer.style.display = 'block';
  if (gridContainer) gridContainer.style.display = 'none';

  // 2. Flat List View
  if (supplyGroupMode === 'flat') {
    tbody.innerHTML = supplies.map(renderRow).join('');
    return;
  }

  // 3. Category Grouped View
  if (supplyGroupMode === 'category') {
    const groups = {};
    supplies.forEach(s => {
      const c = s.category || s.type || 'Vật tư khác';
      if (!groups[c]) groups[c] = [];
      groups[c].push(s);
    });

    let html = '';
    Object.keys(groups).forEach(catName => {
      const cfg = getSupplyCatConfig(catName);
      const catItems = groups[catName];

      html += `
        <tr style="background:#f8fafc; border-top:2px solid ${cfg.border}; border-bottom:1.5px solid ${cfg.border};">
          <td colspan="8" style="padding:10px 16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:24px; height:24px; border-radius:6px; background:${cfg.bg}; color:${cfg.iconColor}; display:inline-flex; align-items:center; justify-content:center; font-size:13px; border:1px solid ${cfg.border};">
                  <i class="fa-solid ${cfg.icon}"></i>
                </span>
                <strong style="font-size:13px; color:${cfg.color}; font-weight:800;">NHÓM VẬT TƯ: ${esc(catName).toUpperCase()}</strong>
              </div>
              <span class="badge" style="background:#e2e8f0; color:#334155; font-weight:800; font-size:11px; padding:3px 10px; border-radius:12px;">
                ${catItems.length} sản phẩm
              </span>
            </div>
          </td>
        </tr>
      `;

      html += catItems.map(renderRow).join('');
    });

    tbody.innerHTML = html;
    return;
  }

  // 4. Farm / Customer Grouped View
  if (supplyGroupMode === 'farm') {
    const groups = {};
    supplies.forEach(s => {
      const owner = s.creator_name || s.supplier || 'Mặc định trang trại';
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(s);
    });

    let html = '';
    Object.keys(groups).forEach(ownerName => {
      const items = groups[ownerName];
      html += `
        <tr style="background:#f0fdf4; border-top:2px solid #a7f3d0; border-bottom:1.5px solid #a7f3d0;">
          <td colspan="8" style="padding:10px 16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <strong style="font-size:13px; color:#047857; font-weight:800;"><i class="fa-solid fa-house-chimney-window"></i> NÔNG HỘ / TRANG TRẠI: ${esc(ownerName).toUpperCase()}</strong>
              <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; font-size:11px; padding:3px 10px; border-radius:12px;">
                ${items.length} vật tư khai báo
              </span>
            </div>
          </td>
        </tr>
      `;
      html += items.map(renderRow).join('');
    });

    tbody.innerHTML = html;
  }
}

function filterSupplies() {
  const q = (document.getElementById('supply-search')?.value || '').toLowerCase().trim();
  let filtered = allSuppliesCache;

  // Filter by active chip
  if (currentDbActiveSupplyChip !== 'all') {
    if (currentDbActiveSupplyChip === 'low_stock') {
      filtered = filtered.filter(s => {
        const isEndless = ['Nhân công', 'Tiền nước'].includes(s.category || s.type);
        const qty = parseFloat(s.stock_quantity || s.quantity || 0);
        return !isEndless && qty <= 5;
      });
    } else if (currentDbActiveSupplyChip === 'endless') {
      filtered = filtered.filter(s => ['Nhân công', 'Tiền nước'].includes(s.category || s.type));
    } else {
      filtered = filtered.filter(s => (s.category || s.type) === currentDbActiveSupplyChip);
    }
  }

  // Filter by query string
  if (q) {
    filtered = filtered.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.category || s.type || '').toLowerCase().includes(q) ||
      (s.creator_name || s.supplier || s.note || '').toLowerCase().includes(q)
    );
  }

  renderSuppliesTable(filtered);
}
window.filterSupplies = filterSupplies;

function exportSuppliesPDF() {
  window.print();
}
window.exportSuppliesPDF = exportSuppliesPDF;

// ── Supply Action Modals (View & Edit) ──

function openViewSupplyModal(supplyId) {
  const supply = allSuppliesCache.find(s => s.id == supplyId);
  if (!supply) return;

  const cfg = getSupplyCatConfig(supply.category);
  const modalBody = document.getElementById('supply-view-modal-body');
  const btnEdit = document.getElementById('btn-edit-from-view');
  const isEndless = ['Nhân công', 'Tiền nước'].includes(supply.category);

  if (btnEdit) {
    btnEdit.onclick = () => {
      closeViewSupplyModal();
      editSupply(supplyId);
    };
  }

  if (modalBody) {
    modalBody.innerHTML = `
      <div style="display:flex; gap:16px; align-items:flex-start; margin-bottom:20px;">
        ${supply.image_url 
          ? `<img src="${esc(supply.image_url)}" alt="${esc(supply.name)}" style="width:110px; height:110px; object-fit:cover; border-radius:12px; border:2px solid #cbd5e1; box-shadow:0 4px 12px rgba(0,0,0,0.1);">` 
          : `<div style="width:110px; height:110px; border-radius:12px; background:${cfg.bg}; color:${cfg.iconColor}; border:2px solid ${cfg.border}; display:flex; align-items:center; justify-content:center; font-size:42px;"><i class="fa-solid ${cfg.icon}"></i></div>`
        }
        <div style="flex:1;">
          <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; font-weight:800; padding:4px 12px; border-radius:20px; font-size:12px; display:inline-flex; align-items:center; gap:6px; margin-bottom:6px;">
            <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(supply.category)}
          </span>
          <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin:0 0 6px 0; line-height:1.3;">${esc(supply.name)}</h3>
          <div style="font-size:13px; color:#475569;">Sở hữu / Nông hộ: <strong>${esc(supply.creator_name || supply.supplier || 'Admin')}</strong></div>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Số lượng tồn kho</div>
            <div style="font-size:18px; font-weight:800; color:#047857; margin-top:2px;">
              ${isEndless ? 'Vô hạn ∞' : `${supply.stock_quantity || 0} ${esc(supply.unit || '')}`}
            </div>
          </div>
          <div>
            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Đơn giá hiện tại</div>
            <div style="font-size:18px; font-weight:800; color:#059669; margin-top:2px;">
              ${supply.unit_price ? parseFloat(supply.unit_price).toLocaleString('vi-VN') + ' đ' : '—'}
            </div>
          </div>
        </div>
      </div>

      ${supply.note ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; font-weight:800; color:#334155; margin-bottom:4px;"><i class="fa-solid fa-note-sticky"></i> Ghi chú sản phẩm & Nhà sản xuất:</div>
          <div style="font-size:13px; color:#1e293b; background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:10px; line-height:1.5;">${esc(supply.note)}</div>
        </div>
      ` : ''}
    `;
  }

  document.getElementById('supply-view-modal').style.display = 'flex';
}

function closeViewSupplyModal() {
  document.getElementById('supply-view-modal').style.display = 'none';
}

function openSupplyModal(supplyId = null) {
  document.getElementById('f-supply-id').value = supplyId || '';
  document.getElementById('f-supply-category').value = 'Bón phân';
  document.getElementById('f-supply-name').value = '';
  document.getElementById('f-supply-unit').value = '';
  document.getElementById('f-supply-stock').value = '';
  document.getElementById('f-supply-price').value = '';
  document.getElementById('f-supply-user').value = '';
  document.getElementById('f-supply-note').value = '';
  document.getElementById('f-supply-image-url').value = '';
  document.getElementById('f-supply-img-preview').style.display = 'none';

  document.getElementById('supply-modal-title').innerHTML = supplyId ? '<i class="fa-solid fa-pen"></i> Chỉnh sửa sản phẩm vật tư' : '<i class="fa-solid fa-box-archive"></i> Khai báo Vật tư & Phân bón mới';

  if (supplyId) {
    const supply = allSuppliesCache.find(s => s.id == supplyId);
    if (supply) {
      document.getElementById('f-supply-category').value = supply.category || 'Bón phân';
      document.getElementById('f-supply-name').value = supply.name || '';
      document.getElementById('f-supply-unit').value = supply.unit || '';
      document.getElementById('f-supply-stock').value = supply.stock_quantity || 0;
      document.getElementById('f-supply-price').value = supply.unit_price || supply.package_price || '';
      document.getElementById('f-supply-user').value = supply.user_id || '';
      document.getElementById('f-supply-note').value = supply.note || '';

      if (supply.image_url) {
        document.getElementById('f-supply-image-url').value = supply.image_url;
        document.getElementById('f-supply-img-src').src = supply.image_url;
        document.getElementById('f-supply-img-preview').style.display = 'block';
      }
    }
  }

  document.getElementById('supply-form-modal').style.display = 'flex';
}

function closeSupplyFormModal() {
  document.getElementById('supply-form-modal').style.display = 'none';
}

function editSupply(supplyId) {
  openSupplyModal(supplyId);
}

async function uploadSupplyPhoto(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);

  toast('Đang tải ảnh sản phẩm...');
  try {
    const res = await apiForm('/supplies/upload-image', formData);
    if (res.url) {
      document.getElementById('f-supply-image-url').value = res.url;
      document.getElementById('f-supply-img-src').src = res.url;
      document.getElementById('f-supply-img-preview').style.display = 'block';
      toast('Đã tải ảnh vật tư lên thành công!');
    }
  } catch (err) {
    toast('Lỗi tải ảnh: ' + err.message, 'error');
  }
}

async function saveSupplySubmit() {
  const id = document.getElementById('f-supply-id').value;
  const category = document.getElementById('f-supply-category').value;
  const name = document.getElementById('f-supply-name').value.trim();
  const unit = document.getElementById('f-supply-unit').value.trim();
  let stock_quantity = parseFloat(document.getElementById('f-supply-stock').value);
  const unit_price = parseFloat(document.getElementById('f-supply-price').value) || 0;
  const user_id = document.getElementById('f-supply-user').value;
  const note = document.getElementById('f-supply-note').value.trim();
  const image_url = document.getElementById('f-supply-image-url').value;

  if (['Nhân công', 'Tiền nước'].includes(category)) {
    stock_quantity = 999999;
  } else if (isNaN(stock_quantity)) {
    stock_quantity = 0;
  }

  if (!name || !unit) {
    toast('Vui lòng điền Tên sản phẩm và Đơn vị tính!', 'error');
    return;
  }

  const payload = {
    category,
    name,
    unit,
    stock_quantity,
    unit_price,
    user_id: user_id ? parseInt(user_id) : null,
    note,
    image_url
  };

  const btn = document.getElementById('btn-save-supply');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Đang lưu...';

  try {
    if (id) {
      await api(`/supplies/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Đã cập nhật thông tin vật tư thành công!');
    } else {
      await api('/supplies', { method: 'POST', body: JSON.stringify(payload) });
      toast('Đã thêm sản phẩm vật tư mới thành công!');
    }
    closeSupplyFormModal();
    loadSuppliesTab();
  } catch (err) {
    toast('Lỗi lưu vật tư: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-floppy-disk"></i> Lưu thông tin vật tư';
  }
}

// ── Tab 4: Audit History (Lịch sử biến động dữ liệu bị sửa/xóa) ──
let allHistoryCache = [];

async function loadHistoryTab() {
  const tbody = document.getElementById('db-history-table-body');
  if (!tbody) return;

  const actionType = document.getElementById('db-history-filter-action')?.value || '';
  const targetType = document.getElementById('db-history-filter-target')?.value || '';
  const search = document.getElementById('db-history-search')?.value?.trim() || '';

  const params = new URLSearchParams();
  if (actionType) params.set('action_type', actionType);
  if (targetType) params.set('target_type', targetType);
  if (search) params.set('search', search);

  tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải nhật ký lịch sử dữ liệu...</td></tr>';

  try {
    const historyList = await api(`/history?${params.toString()}`) || [];
    allHistoryCache = historyList;
    renderHistoryTable(historyList);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

function renderHistoryTable(list) {
  const tbody = document.getElementById('db-history-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Chưa có dữ liệu biến động (sửa/xóa) nào được ghi nhận.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(h => {
    const isDelete = h.action_type === 'DELETE' || h.action_type === 'DELETE_SOFT';
    const actionBadge = isDelete
      ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-weight:800; padding:4px 10px; border-radius:20px;"><i class="fa-solid fa-trash-can"></i> ${h.action_type === 'DELETE_SOFT' ? 'Xóa đệm' : 'Xóa vĩnh viễn'}</span>`
      : `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:800; padding:4px 10px; border-radius:20px;"><i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa</span>`;

    const targetBadge = `<span class="badge" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; font-weight:700; padding:4px 10px; border-radius:8px;">${esc(h.target_type)}</span>`;

    const dateStr = h.created_at ? new Date(h.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const isSoftDeletedFarm = h.target_type === 'Trang trại' && h.action_type === 'DELETE_SOFT' && h.record_id;

    return `
      <tr>
        <td style="font-size:12px; font-weight:700; color:#64748b;"><i class="fa-regular fa-clock"></i> ${dateStr}</td>
        <td>${actionBadge}</td>
        <td>${targetBadge}</td>
        <td style="font-weight:700; color:#0f172a;">${esc(h.title)}</td>
        <td style="font-size:12.5px; color:#475569; font-weight:600;">👤 ${esc(h.user_name || h.current_user_name || 'Hệ thống')}</td>
        <td>
          <div style="display:inline-flex; gap:6px; align-items:center; flex-wrap:nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="openViewHistoryModal(${h.id})" style="padding:4px 9px; font-size:11px; font-weight:700;" title="Xem chi tiết dữ liệu">
              <i class="fa-solid fa-circle-info"></i> Chi tiết
            </button>
            ${isSoftDeletedFarm ? `
              <button class="btn btn-danger btn-sm" onclick="adminHardDeleteFarm(${h.record_id}, '${esc(h.title.replace(/'/g, "\\'"))}', ${h.id})" style="padding:4px 9px; font-size:11px; font-weight:800; background:#dc2626; color:#ffffff; border:none; border-radius:6px; cursor:pointer;" title="Xóa vĩnh viễn trang trại khỏi CSDL">
                <i class="fa-solid fa-trash-can"></i> Xóa trang trại
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="deleteAuditLogItem(${h.id})" style="padding:4px 9px; font-size:11px; font-weight:700; color:#dc2626; border-color:#fca5a5; background:#fff1f2;" title="Xóa bản ghi nhật ký lịch sử này khỏi CSDL">
              <i class="fa-solid fa-trash"></i> Xóa dòng
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function adminHardDeleteFarm(farmId, farmTitle, auditId = null) {
  if (!confirm(`⚠️ CẢNH BÁO QUẢN TRỊ VIÊN:\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN Trang trại "${farmTitle}" (ID: #${farmId}) khỏi CSDL PostgreSQL?\n\nThao tác này sẽ xóa triệt để dữ liệu và KHÔNG THỂ KHÔI PHỤC!`)) {
    return;
  }
  try {
    const res = await api(`/farms/${farmId}`, { method: 'DELETE' });
    if (res && (res.success || res.message)) {
      toast(res.message || '🗑️ Admin đã xóa vĩnh viễn trang trại khỏi CSDL PostgreSQL thành công!');
      if (auditId) {
        try { await api(`/history/${auditId}`, { method: 'DELETE' }); } catch(_) {}
      }
      loadHistoryTab();
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi xóa vĩnh viễn trang trại.');
  }
}
window.adminHardDeleteFarm = adminHardDeleteFarm;

async function deleteAuditLogItem(id) {
  if (!confirm('Bạn có chắc chắn muốn XÓA bản ghi nhật ký lịch sử này khỏi CSDL?')) {
    return;
  }
  try {
    const res = await api(`/history/${id}`, { method: 'DELETE' });
    if (res && (res.success || res.message)) {
      toast('Đã xóa bản ghi nhật ký lịch sử thành công!');
      loadHistoryTab();
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi xóa bản ghi nhật ký lịch sử.');
  }
}
window.deleteAuditLogItem = deleteAuditLogItem;

async function clearAllAuditLogs() {
  if (!confirm('⚠️ CẢNH BÁO QUẢN TRỊ VIÊN:\n\nBạn có chắc chắn muốn DỌN DẸP SẠCH TOÀN BỘ NHẬT KÝ LỊCH SỬ BIẾN ĐỘNG khỏi CSDL PostgreSQL?\n\nThao tác này sẽ xóa toàn bộ các dòng nhật ký ghi nhận sửa/xóa trước đây!')) {
    return;
  }
  try {
    const res = await api('/history', { method: 'DELETE' });
    if (res && (res.success || res.message)) {
      toast('Đã dọn dẹp sạch toàn bộ nhật ký lịch sử thành công!');
      loadHistoryTab();
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi dọn dẹp nhật ký lịch sử.');
  }
}
window.clearAllAuditLogs = clearAllAuditLogs;

function filterHistoryTab() {
  const q = (document.getElementById('db-history-search')?.value || '').toLowerCase().trim();
  if (!q) {
    renderHistoryTable(allHistoryCache);
    return;
  }
  const filtered = allHistoryCache.filter(h =>
    (h.title || '').toLowerCase().includes(q) ||
    (h.user_name || h.current_user_name || '').toLowerCase().includes(q) ||
    (h.target_type || '').toLowerCase().includes(q)
  );
  renderHistoryTable(filtered);
}

function openViewHistoryModal(id) {
  const item = allHistoryCache.find(h => h.id == id);
  if (!item) return;

  const modalBody = document.getElementById('history-view-modal-body');
  if (!modalBody) return;

  const isDelete = item.action_type === 'DELETE';
  const actionText = isDelete ? '🗑️ Xóa dữ liệu (DELETE)' : '✏️ Chỉnh sửa dữ liệu (UPDATE)';
  const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  let oldDataStr = '{}';
  let newDataStr = '{}';
  try {
    oldDataStr = typeof item.old_data === 'string' ? item.old_data : JSON.stringify(item.old_data, null, 2);
  } catch(e) {}
  try {
    newDataStr = typeof item.new_data === 'string' ? item.new_data : JSON.stringify(item.new_data, null, 2);
  } catch(e) {}

  modalBody.innerHTML = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
      <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:6px;">${esc(item.title)}</div>
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b;">
        <span>Thao tác: <strong>${actionText}</strong></span>
        <span>Thời gian: <strong>${dateStr}</strong></span>
      </div>
      <div style="font-size:12px; color:#64748b; margin-top:4px;">
        Người thực hiện: <strong>${esc(item.user_name || item.current_user_name || 'Admin')}</strong>
      </div>
    </div>

    ${!isDelete ? `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
        <div>
          <div style="font-size:11.5px; font-weight:800; color:#dc2626; margin-bottom:4px;"><i class="fa-solid fa-rotate-left"></i> Dữ liệu cũ trước khi sửa:</div>
          <pre style="background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:10px; font-size:11px; max-height:220px; overflow:auto; color:#9f1239;">${esc(oldDataStr)}</pre>
        </div>
        <div>
          <div style="font-size:11.5px; font-weight:800; color:#16a34a; margin-bottom:4px;"><i class="fa-solid fa-circle-check"></i> Dữ liệu mới sau khi sửa:</div>
          <pre style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; font-size:11px; max-height:220px; overflow:auto; color:#14532d;">${esc(newDataStr)}</pre>
        </div>
      </div>
    ` : `
      <div style="margin-bottom:16px;">
        <div style="font-size:11.5px; font-weight:800; color:#dc2626; margin-bottom:4px;"><i class="fa-solid fa-trash-can"></i> Dữ liệu chi tiết đã bị xóa:</div>
        <pre style="background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:10px; font-size:11px; max-height:260px; overflow:auto; color:#9f1239;">${esc(oldDataStr)}</pre>
      </div>
    `}
  `;

  document.getElementById('history-view-modal').style.display = 'flex';
}

function closeViewHistoryModal() {
  document.getElementById('history-view-modal').style.display = 'none';
}

window.initDatabasePage = initDatabasePage;
window.switchDatabaseTab = switchDatabaseTab;
window.setSupplyGroupMode = setSupplyGroupMode;
window.filterSuppliesByChip = filterSuppliesByChip;
window.exportSuppliesPDF = exportSuppliesPDF;
window.selectTreeForDetail = selectTreeForDetail;
window.filterMasterPlantList = filterMasterPlantList;
window.filterTimelineByActivity = filterTimelineByActivity;
window.exportCultivationPDF = exportCultivationPDF;
window.loadPlantCultivationTimeline = selectTreeForDetail;
window.loadSuppliesTab = loadSuppliesTab;
window.filterSupplies = filterSupplies;
window.openViewSupplyModal = openViewSupplyModal;
window.closeViewSupplyModal = closeViewSupplyModal;
window.openSupplyModal = openSupplyModal;
window.closeSupplyFormModal = closeSupplyFormModal;
window.editSupply = editSupply;
window.uploadSupplyPhoto = uploadSupplyPhoto;
window.saveSupplySubmit = saveSupplySubmit;
window.loadHistoryTab = loadHistoryTab;
window.filterHistoryTab = filterHistoryTab;
window.openViewHistoryModal = openViewHistoryModal;
window.closeViewHistoryModal = closeViewHistoryModal;

// ── TAB / PAGE: SCHEMA INSPECTOR & LIVE CRUD ───────────────────
let schemaTelemetryCache = null;

async function loadDbSchemaCheck() {
  const grid = document.getElementById('db-schema-tables-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;"><i class="fa fa-spinner fa-spin fa-2x"></i><br><br>Đang thanh tra Schema & Telemetry CSDL PostgreSQL...</div>';

  try {
    const data = await api('/database/check');
    schemaTelemetryCache = data;

    if (!data.tables || data.tables.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">Không tìm thấy bảng CSDL nào.</div>';
      return;
    }

    grid.innerHTML = data.tables.map(t => {
      return `
        <div onclick="viewTableRecords('${esc(t.table_name)}')" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; cursor:pointer; transition:all 0.2s ease; box-shadow:0 4px 14px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:15px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-table" style="color:#059669;"></i> ${esc(t.table_name)}
            </span>
            <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">
              ${t.row_count.toLocaleString('vi-VN')} dòng
            </span>
          </div>
          <div style="font-size:12px; color:#64748b; margin-bottom:12px;">
            Số cột: <strong>${t.column_count} cột</strong> · Kiểu dữ liệu PostgreSQL
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:#059669; border-top:1px solid #f1f5f9; padding-top:10px;">
            <span><i class="fa-solid fa-eye"></i> Xem & Thao tác Dữ liệu</span>
            <i class="fa-solid fa-arrow-right"></i>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#dc2626;">⚠️ Lỗi thanh tra CSDL: ${esc(err.message)}</div>`;
  }
}

async function viewTableRecords(tableName, syncUrl = true) {
  const container = document.getElementById('db-table-records-container');
  if (!container) return;

  if (syncUrl && typeof window.syncAdminUrl === 'function') {
    window.syncAdminUrl({ page: 'db-check', table: tableName });
  }

  container.style.display = 'block';
  container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;"><i class="fa fa-spinner fa-spin fa-2x"></i><br><br>Đang nạp dữ liệu trực tiếp từ bảng <strong>${esc(tableName)}</strong>...</div>`;

  try {
    const data = await api(`/database/tables/${tableName}/records?limit=50`);
    let records = data.records || [];

    if (tableName === 'users' && records.length > 0) {
      records = records.map(r => ({
        id: r.id,
        public_id: (typeof generateIsoPublicId === 'function' ? generateIsoPublicId(r.role, r.id) : (r.role === 'admin' ? `adm-${r.id}` : `usr-${r.id}`)),
        ...r
      }));
    }

    let colHeaders = [];
    if (records.length > 0) {
      colHeaders = Object.keys(records[0]);
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
        <h3 style="margin:0; font-size:16px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-database" style="color:#059669;"></i> Dữ liệu Bảng "${esc(tableName)}" (${data.total_records} dòng)
        </h3>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="adminAddRecord('${esc(tableName)}')" style="background:#059669; border:none; padding:6px 14px; font-weight:700;">
            <i class="fa-solid fa-plus"></i> Thêm bản ghi mới
          </button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('db-table-records-container').style.display='none'" style="padding:6px 12px;">
            <i class="fa-solid fa-xmark"></i> Đóng
          </button>
        </div>
      </div>

      ${records.length === 0 ? `
        <div style="text-align:center; padding:30px; color:#64748b; background:#f8fafc; border-radius:10px;">Bảng "${esc(tableName)}" hiện chưa có dữ liệu nào.</div>
      ` : `
        <div style="overflow-x:auto; max-height:500px;">
          <table class="table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9; text-align:left;">
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Thao tác</th>
                ${colHeaders.map(c => `<th style="padding:10px; border-bottom:2px solid #cbd5e1;">${esc(c)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px; white-space:nowrap;">
                    <button class="btn btn-sm btn-secondary" onclick="adminEditRecord('${esc(tableName)}', ${r.id})" style="padding:3px 8px; font-size:11px; margin-right:4px;">
                      <i class="fa-solid fa-pen"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminDeleteRecord('${esc(tableName)}', ${r.id})" style="padding:3px 8px; font-size:11px; background:#dc2626; color:#fff; border:none; border-radius:4px;">
                      <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                  </td>
                  ${colHeaders.map(c => {
                    const val = r[c];
                    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
                    return `<td style="padding:8px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(valStr)}">${esc(valStr)}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#dc2626; padding:20px;">Lỗi nạp dữ liệu: ${esc(err.message)}</div>`;
  }
}

async function adminDeleteRecord(tableName, recordId) {
  if (!confirm(`⚠️ CẢNH BÁO QUẢN TRỊ VIÊN:\n\nBạn có chắc chắn muốn XÓA bản ghi #${recordId} khỏi bảng "${tableName}"?`)) {
    return;
  }
  try {
    const res = await api(`/database/tables/${tableName}/records/${recordId}`, { method: 'DELETE' });
    if (res && res.success) {
      toast(`🗑️ Đã xóa bản ghi #${recordId} khỏi bảng "${tableName}" thành công!`);
      viewTableRecords(tableName);
      loadDbSchemaCheck();
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi xóa bản ghi.');
  }
}

async function adminEditRecord(tableName, recordId) {
  const jsonStr = prompt(`Chỉnh sửa bản ghi #${recordId} thuộc bảng "${tableName}" (định dạng JSON):`, '{}');
  if (!jsonStr) return;
  try {
    const bodyData = JSON.parse(jsonStr);
    const res = await api(`/database/tables/${tableName}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(bodyData)
    });
    if (res && res.success) {
      toast(`✏️ Cập nhật bản ghi #${recordId} thành công!`);
      viewTableRecords(tableName);
    }
  } catch (err) {
    alert('Lỗi định dạng JSON hoặc server: ' + err.message);
  }
}

async function adminAddRecord(tableName) {
  const jsonStr = prompt(`Thêm bản ghi mới vào bảng "${tableName}" (định dạng JSON):`, '{}');
  if (!jsonStr) return;
  try {
    const bodyData = JSON.parse(jsonStr);
    const res = await api(`/database/tables/${tableName}/records`, {
      method: 'POST',
      body: JSON.stringify(bodyData)
    });
    if (res && res.success) {
      toast(`➕ Thêm bản ghi mới vào bảng "${tableName}" thành công!`);
      viewTableRecords(tableName);
      loadDbSchemaCheck();
    }
  } catch (err) {
    alert('Lỗi định dạng JSON hoặc server: ' + err.message);
  }
}

window.loadDbSchemaCheck = loadDbSchemaCheck;
window.viewTableRecords = viewTableRecords;
window.adminDeleteRecord = adminDeleteRecord;
window.adminEditRecord = adminEditRecord;
window.adminAddRecord = adminAddRecord;

