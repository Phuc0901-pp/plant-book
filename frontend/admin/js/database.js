/* ════════════════════════════════════════════════════════
   Plant Book Admin — database.js (Cơ sở dữ liệu & Nhật ký Canh tác)
   Sub-tabs: 1. Dữ liệu canh tác, 2. Vật tư & Kho, 3. Thư viện media
   Version: v1.0.1
   ════════════════════════════════════════════════════════ */

let dbUsersCache = [];
let dbFarmsCache = [];
let dbPlantsCache = [];
let activeDbTab = 'cultivation';
let supplyGroupMode = 'category'; // 'category', 'farm', 'flat'

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

    // Populate Tab 1 Filters
    const uSelect = document.getElementById('db-filter-user');
    if (uSelect) {
      uSelect.innerHTML = '<option value="">— tất cả khách hàng —</option>' +
        normalUsers.map(u => `<option value="${u.id}">👤 ${esc(u.full_name)} (${esc(u.phone || u.email)})</option>`).join('');
    }

    const fSelect = document.getElementById('db-filter-farm');
    if (fSelect) {
      fSelect.innerHTML = '<option value="">— tất cả trang trại —</option>' +
        dbFarmsCache.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
    }

    const pSelect = document.getElementById('db-filter-plant');
    if (pSelect) {
      pSelect.innerHTML = '<option value="">— Chọn Cây trồng để xem Nhật ký Canh tác —</option>' +
        dbPlantsCache.map(p => `<option value="${p.id}">🌳 Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');
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

function switchDatabaseTab(tab) {
  activeDbTab = tab;

  // Update tabs active state
  ['cultivation', 'supplies', 'media', 'history'].forEach(t => {
    const tabEl = document.getElementById(`db-tab-${t}`);
    const paneEl = document.getElementById(`db-pane-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (paneEl) paneEl.style.display = (t === tab ? 'block' : 'none');
  });

  if (tab === 'media') {
    initGlobalMediaLibrary();
  } else if (tab === 'supplies') {
    loadSuppliesTab();
  } else if (tab === 'history') {
    loadHistoryTab();
  }
}


function setSupplyGroupMode(mode) {
  supplyGroupMode = mode;
  ['cat', 'farm', 'flat'].forEach(m => {
    const btn = document.getElementById(`btn-supply-group-${m}`);
    if (btn) {
      const active = (m === mode || (m === 'cat' && mode === 'category'));
      btn.style.background = active ? '#059669' : 'transparent';
      btn.style.color = active ? '#ffffff' : '#475569';
      btn.style.fontWeight = active ? '800' : '700';
    }
  });

  renderSuppliesTable(allSuppliesCache);
}

function onDbFilterChange() {
  const userId = document.getElementById('db-filter-user')?.value;
  const farmSelect = document.getElementById('db-filter-farm');
  const plantSelect = document.getElementById('db-filter-plant');

  let filteredFarms = dbFarmsCache;
  if (userId) {
    filteredFarms = dbFarmsCache.filter(f => f.user_id == userId);
    if (farmSelect && farmSelect.value && !filteredFarms.some(f => f.id == farmSelect.value)) {
      farmSelect.value = '';
    }
  }

  if (farmSelect) {
    farmSelect.innerHTML = '<option value="">— tất cả trang trại —</option>' +
      filteredFarms.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
  }

  let filteredPlants = dbPlantsCache;
  const activeFarmId = farmSelect?.value;
  if (activeFarmId) {
    filteredPlants = dbPlantsCache.filter(p => p.farm_id == activeFarmId);
  } else if (userId) {
    const userFarmIds = filteredFarms.map(f => f.id);
    filteredPlants = dbPlantsCache.filter(p => userFarmIds.includes(p.farm_id));
  }

  if (plantSelect) {
    plantSelect.innerHTML = '<option value="">— Chọn Cây trồng để xem Nhật ký Canh tác —</option>' +
      filteredPlants.map(p => `<option value="${p.id}">🌳 Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');
  }

  loadPlantCultivationTimeline();
}

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

async function loadPlantCultivationTimeline() {
  const plantId = document.getElementById('db-filter-plant')?.value;
  const summaryBox = document.getElementById('db-plant-cost-summary');
  const container = document.getElementById('db-cultivation-timeline-container');

  if (!container) return;

  if (!plantId) {
    if (summaryBox) summaryBox.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; text-align:center;">
        <i class="fa-solid fa-tree-city" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
        <p style="font-size:14px; font-weight:700; color:#475569;">Vui lòng chọn Cây trồng ở bộ lọc phía trên để theo dõi toàn bộ Nhật ký Canh tác & Chi phí từ lúc khởi tạo đến hiện tại.</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;"><i class="fa fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px;"></i> Đang tải dữ liệu canh tác & chi phí đầu tư cây...</div>';

  try {
    const plant = await api(`/plants/${plantId}`);
    const logs = plant.logs || [];

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

    // Render Cost Summary Box
    if (summaryBox) {
      summaryBox.style.display = 'block';
      summaryBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.85;">
              🌳 HỒ SƠ TỔNG DỮ LIỆU CANH TÁC & CHI PHÍ ĐẦU TƯ CÂY #${esc(plant.tree_code || plant.id)}
            </div>
            <div style="font-size:22px; font-weight:800; margin-top:4px;">
              ${esc(plant.plant_type)} ${plant.plant_variety ? `(${esc(plant.plant_variety)})` : ''} · Trang trại: ${esc(plant.farm_name || 'Vườn Nông hộ')}
            </div>
            <div style="font-size:13px; opacity:0.9; margin-top:2px;">
              Khách hàng: <strong>${esc(plant.owner_name || 'Chưa gán')}</strong> · Sức khỏe: <strong>${esc(plant.health_status)}</strong> · Tuổi cây: <strong>${esc(plant.plant_age || 'Chưa rõ')}</strong>
            </div>
          </div>

          <!-- Total Cost Pills -->
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(4px); padding:12px 18px; border-radius:12px; border:1px solid rgba(255,255,255,0.25); text-align:right;">
              <div style="font-size:11px; text-transform:uppercase; opacity:0.85; font-weight:700;">💰 TỔNG CHI PHÍ ĐẦU TƯ</div>
              <div style="font-size:20px; font-weight:800; color:#fde047; margin-top:2px;">
                ${totalInvestmentCost > 0 ? totalInvestmentCost.toLocaleString('vi-VN') + ' đ' : '0 đ'}
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.1); padding:10px 14px; border-radius:12px; font-size:12px; display:flex; flex-direction:column; justify-content:center;">
              <div>🧪 Phân bón & Thuốc: <strong>${totalConsumableCost.toLocaleString('vi-VN')} đ</strong></div>
              <div>💧 Nhân công & Điện nước: <strong>${totalFixedCost.toLocaleString('vi-VN')} đ</strong></div>
            </div>
          </div>
        </div>
      `;
    }

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; text-align:center;">
          <i class="fa-solid fa-clipboard-list" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:700; color:#475569;">Cây này chưa có nhật ký canh tác nào được ghi nhận.</p>
        </div>`;
      return;
    }

    // Activity Items Config (Color & Icon Mapping)
    const typeConfigs = {
      'Tưới nước': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-droplet', iconColor: '#3b82f6' },
      'Bón phân': { bg: '#fef3c7', color: '#78350f', border: '#fde68a', icon: 'fa-seedling', iconColor: '#92400e' },
      'Phun thuốc': { bg: '#f3e8ff', color: '#6b21a8', border: '#ddd6fe', icon: 'fa-spray-can-sparkles', iconColor: '#8b5cf6' },
      'Cắt lá': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: 'fa-scissors', iconColor: '#10b981' },
      'Tỉa hoa': { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: 'fa-scissors', iconColor: '#ea580c' },
      'Bệnh cây': { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', icon: 'fa-bug', iconColor: '#ef4444' },
      'Thu hoạch': { bg: '#fefce8', color: '#a16207', border: '#fef08a', icon: 'fa-basket-shopping', iconColor: '#f59e0b' }
    };

    // Group Logs By Date (Newest Date First)
    const groupedByDate = {};
    logs.forEach(l => {
      const dObj = new Date(l.log_date || l.created_at);
      const dateKey = !isNaN(dObj) ? dObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Không rõ ngày';
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(l);
    });

    let timelineHtml = `
      <!-- Initiation Node -->
      <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:14px; padding:16px; color:#064e3b; margin-bottom:24px; box-shadow:0 4px 14px rgba(16,185,129,0.08); display:flex; align-items:center; gap:14px;">
        <div style="width:42px; height:42px; border-radius:12px; background:#059669; color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 10px rgba(5,150,105,0.3);">
          <i class="fa-solid fa-flag"></i>
        </div>
        <div>
          <div style="font-size:12px; font-weight:800; text-transform:uppercase; color:#047857;">🌱 THÔNG TIN KHỞI TẠO VĨNH VIỄN CÂY TRỒNG</div>
          <div style="font-size:14px; font-weight:800; color:#064e3b; margin-top:2px;">Cây #${esc(plant.tree_code || plant.id)} (${esc(plant.plant_type)}) · Ngày tạo: ${fmtDate(plant.created_at)}</div>
        </div>
      </div>
    `;

    Object.keys(groupedByDate).forEach(dateStr => {
      const dayLogs = groupedByDate[dateStr];
      // Sort within the day chronologically
      dayLogs.sort((a, b) => new Date(a.log_date || a.created_at) - new Date(b.log_date || b.created_at));

      timelineHtml += `
        <div style="margin-bottom:28px; background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.03);">
          <!-- Date Header Card -->
          <div style="background:linear-gradient(135deg, #f8fafc, #f1f5f9); padding:12px 18px; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:14px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <i class="fa-regular fa-calendar-check" style="color:#059669; font-size:16px;"></i> Ngày ${esc(dateStr)}
            </div>
            <span class="badge" style="background:#059669; color:#ffffff; font-weight:800; font-size:11.5px; padding:3px 12px; border-radius:20px;">
              ${dayLogs.length} hoạt động canh tác
            </span>
          </div>

          <div style="padding:16px 18px; display:flex; flex-direction:column; gap:16px;">
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

        // Parse attached log media photos & videos
        let logMediaList = [];
        if (l.media_urls) {
          try {
            const raw = typeof l.media_urls === 'string' ? JSON.parse(l.media_urls) : l.media_urls;
            if (Array.isArray(raw)) logMediaList = raw;
          } catch(e) {}
        }

        // Supply details box
        let supplyBoxHtml = '';
        if (supplyName || cost > 0 || quantity || method || reason) {
          supplyBoxHtml = `
            <div style="margin-top:10px; background:#f8fafc; border:1px solid ${cfg.border}; border-radius:10px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:12px;">
                ${supplyImg 
                  ? `<img src="${esc(supplyImg)}" alt="${esc(supplyName)}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1;">` 
                  : `<div style="width:44px; height:44px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:20px;"><i class="fa-solid ${cfg.icon}"></i></div>`
                }
                <div>
                  <div style="font-size:13.5px; font-weight:800; color:#0f172a;">${esc(supplyName || l.log_type)}</div>
                  ${quantity ? `<div style="font-size:12px; color:#475569; font-weight:600;">Số lượng / Liều lượng: <strong>${esc(quantity)} ${esc(unit)}</strong></div>` : ''}
                  ${method ? `<div style="font-size:12px; color:#475569; font-weight:600;">Phương thức: <strong>${esc(method)}</strong></div>` : ''}
                  ${reason ? `<div style="font-size:12px; color:#475569; font-weight:600;">Mục đích / Lý do: <strong>${esc(reason)}</strong></div>` : ''}
                </div>
              </div>
              ${cost > 0 ? `<div style="font-size:13.5px; font-weight:800; color:#047857; background:#ecfdf5; padding:6px 14px; border-radius:8px; border:1px solid #a7f3d0;"><i class="fa-solid fa-coins"></i> ${cost.toLocaleString('vi-VN')} đ</div>` : ''}
            </div>
          `;
        }

        // Media attachments (Supports Image & HTML5 Video)
        let attachedMediaHtml = '';
        if (logMediaList.length > 0) {
          attachedMediaHtml = `
            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              ${logMediaList.map(renderMediaThumbnail).join('')}
            </div>
          `;
        }

        timelineHtml += `
          <div style="background:#ffffff; border:1px solid ${cfg.border}; border-radius:12px; padding:14px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:800; display:inline-flex; align-items:center; gap:6px;">
                  <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(l.log_type)}
                </span>
                ${timeStr ? `<span style="font-size:12px; font-weight:700; color:#64748b;"><i class="fa-regular fa-clock"></i> ${timeStr}</span>` : ''}
              </div>
              ${l.creator_name ? `<small style="color:#475569; font-weight:700; background:#f1f5f9; padding:3px 10px; border-radius:8px;"><i class="fa fa-user"></i> ${esc(l.creator_name)}</small>` : ''}
            </div>

            ${l.note ? `<div style="font-size:13.5px; color:#1e293b; margin-top:8px; line-height:1.5; font-weight:500;">${esc(l.note)}</div>` : ''}

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

  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--red);"><i class="fa fa-circle-xmark"></i> Lỗi: ${esc(err.message)}</div>`;
  }
}

// ── Tab 2: Supplies Catalog ──
let allSuppliesCache = [];

async function loadSuppliesTab() {
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;

  const userId = document.getElementById('db-supply-filter-user')?.value;
  const farmId = document.getElementById('db-supply-filter-farm')?.value;

  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('user_id', userId);
  if (farmId) queryParams.set('farm_id', farmId);

  tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải kho vật tư...</td></tr>';

  try {
    const supplies = await api(`/supplies?${queryParams.toString()}`) || [];
    allSuppliesCache = supplies;
    renderSuppliesTable(supplies);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-danger"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

function renderSuppliesTable(supplies) {
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;

  if (supplies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Kho vật tư hiện chưa có sản phẩm nào theo bộ lọc đã chọn.</td></tr>';
    return;
  }

  // Row Renderer Helper
  const renderRow = (s) => {
    const cat = s.category || s.type || 'Vật tư';
    const cfg = getSupplyCatConfig(cat);
    const priceDisplay = s.unit_price ? parseFloat(s.unit_price).toLocaleString('vi-VN') + ' đ' : (s.package_price ? parseFloat(s.package_price).toLocaleString('vi-VN') + ' đ' : '—');
    const ownerText = s.creator_name || s.supplier || s.note || 'Admin';

    const isEndlessCategory = ['Nhân công', 'Tiền nước'].includes(cat);

    let stockDisplay = '';
    if (isEndlessCategory) {
      stockDisplay = `<span class="badge" style="background:#ecfdf5; color:#047857; font-weight:800; padding:4px 10px; border-radius:20px; border:1px solid #a7f3d0; font-size:11.5px;"><i class="fa-solid fa-infinity"></i> Vô hạn ∞</span>`;
    } else {
      const isLowStock = (s.stock_quantity <= 5);
      stockDisplay = `
        <span style="font-weight:800; color:${isLowStock ? '#dc2626' : '#047857'};">
          ${s.stock_quantity || s.quantity || 0} ${esc(s.unit || '')}
        </span>
        ${isLowStock ? `<span style="font-size:10px; background:#fee2e2; color:#dc2626; padding:1px 5px; border-radius:4px; margin-left:4px;">Gần hết</span>` : ''}
      `;
    }

    return `
      <tr>
        <td>
          ${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" style="width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="openViewSupplyModal(${s.id})">` : `<div style="width:44px; height:44px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer;" onclick="openViewSupplyModal(${s.id})"><i class="fa-solid ${cfg.icon}"></i></div>`}
        </td>
        <td style="font-weight:700; color:#0f172a;">
          <a href="javascript:void(0)" onclick="openViewSupplyModal(${s.id})" style="color:#0f172a; text-decoration:none;" onmouseover="this.style.color='#059669'" onmouseout="this.style.color='#0f172a'">
            ${esc(s.name)}
          </a>
        </td>
        <td>
          <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; font-weight:800; padding:4px 10px; border-radius:20px; font-size:11.5px; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(cat)}
          </span>
        </td>
        <td>${stockDisplay}</td>
        <td style="font-weight:800; color:#059669;">${priceDisplay}</td>
        <td style="font-size:12px; color:#64748b;">👤 ${esc(ownerText)}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary btn-sm" onclick="openViewSupplyModal(${s.id})" style="padding:4px 8px; font-size:11.5px; font-weight:700;" title="Xem chi tiết">
              <i class="fa-solid fa-eye"></i> Xem
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editSupply(${s.id})" style="padding:4px 8px; font-size:11.5px; font-weight:700;" title="Chỉnh sửa">
              <i class="fa fa-pen"></i> Sửa
            </button>
          </div>
        </td>
      </tr>
    `;
  };

  // Flat List View
  if (supplyGroupMode === 'flat') {
    tbody.innerHTML = supplies.map(renderRow).join('');
    return;
  }

  // Category Grouped View
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
          <td colspan="7" style="padding:10px 16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:24px; height:24px; border-radius:6px; background:${cfg.bg}; color:${cfg.iconColor}; display:inline-flex; align-items:center; justify-content:center; font-size:13px; border:1px solid ${cfg.border};">
                  <i class="fa-solid ${cfg.icon}"></i>
                </span>
                <strong style="font-size:13.5px; color:${cfg.color}; font-weight:800;">HOẠT ĐỘNG / HẠNG MỤC: ${esc(catName).toUpperCase()}</strong>
              </div>
              <span class="badge" style="background:#e2e8f0; color:#334155; font-weight:800; font-size:11px; padding:3px 10px; border-radius:12px;">
                ${catItems.length} sản phẩm trong kho
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

  // Farm / Customer Grouped View
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
          <td colspan="7" style="padding:10px 16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <strong style="font-size:13.5px; color:#047857; font-weight:800;"><i class="fa-solid fa-house-chimney-window"></i> NÔNG HỘ / TRANG TRẠI: ${esc(ownerName).toUpperCase()}</strong>
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
  if (!q) {
    renderSuppliesTable(allSuppliesCache);
    return;
  }
  const filtered = allSuppliesCache.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.category || s.type || '').toLowerCase().includes(q) ||
    (s.creator_name || s.supplier || s.note || '').toLowerCase().includes(q)
  );
  renderSuppliesTable(filtered);
}

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

    const isFarmTarget = h.target_type === 'Trang trại' && h.record_id;

    return `
      <tr>
        <td style="font-size:12px; font-weight:700; color:#64748b;"><i class="fa-regular fa-clock"></i> ${dateStr}</td>
        <td>${actionBadge}</td>
        <td>${targetBadge}</td>
        <td style="font-weight:700; color:#0f172a;">${esc(h.title)}</td>
        <td style="font-size:12.5px; color:#475569; font-weight:600;">👤 ${esc(h.user_name || h.current_user_name || 'Hệ thống')}</td>
        <td>
          <div style="display:inline-flex; gap:6px; align-items:center;">
            <button class="btn btn-secondary btn-sm" onclick="openViewHistoryModal(${h.id})" style="padding:4px 10px; font-size:11.5px; font-weight:700;">
              <i class="fa-solid fa-circle-info"></i> Chi tiết
            </button>
            ${isFarmTarget ? `
              <button class="btn btn-danger btn-sm" onclick="adminHardDeleteFarm(${h.record_id}, '${esc(h.title.replace(/'/g, "\\'"))}')" style="padding:4px 10px; font-size:11.5px; font-weight:800; background:#dc2626; color:#ffffff; border:none; border-radius:6px; cursor:pointer;" title="Xóa vĩnh viễn trang trại khỏi CSDL PostgreSQL">
                <i class="fa-solid fa-trash-can"></i> Xóa vĩnh viễn
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function adminHardDeleteFarm(farmId, farmTitle) {
  if (!confirm(`⚠️ CẢNH BÁO QUẢN TRỊ VIÊN:\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN Trang trại "${farmTitle}" (ID: #${farmId}) khỏi CSDL PostgreSQL?\n\nThao tác này sẽ xóa triệt để dữ liệu và KHÔNG THỂ KHÔI PHỤC!`)) {
    return;
  }
  try {
    const res = await api(`/farms/${farmId}`, { method: 'DELETE' });
    if (res && (res.success || res.message)) {
      toast('🗑️ Admin đã xóa vĩnh viễn trang trại khỏi CSDL PostgreSQL thành công!');
      loadHistoryTab();
    }
  } catch (err) {
    alert(err.message || 'Lỗi khi xóa vĩnh viễn trang trại.');
  }
}
window.adminHardDeleteFarm = adminHardDeleteFarm;

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
window.onDbFilterChange = onDbFilterChange;
window.onSupplyFilterChange = onSupplyFilterChange;
window.loadPlantCultivationTimeline = loadPlantCultivationTimeline;
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

