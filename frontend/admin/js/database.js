/* ════════════════════════════════════════════════════════
   Plant Book Admin — database.js (Cơ sở dữ liệu & Nhật ký Canh tác)
   Sub-tabs: 1. Dữ liệu canh tác, 2. Vật tư & Kho, 3. Thư viện media
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
  ['cultivation', 'supplies', 'media'].forEach(t => {
    const tabEl = document.getElementById(`db-tab-${t}`);
    const paneEl = document.getElementById(`db-pane-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (paneEl) paneEl.style.display = (t === tab ? 'block' : 'none');
  });

  if (tab === 'media') {
    initGlobalMediaLibrary();
  } else if (tab === 'supplies') {
    loadSuppliesTab();
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
    const media = plant.media || [];

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

    // Sort logs chronologically (from initiation to current)
    const sortedLogs = [...logs].sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

    if (sortedLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; text-align:center;">
          <i class="fa-solid fa-clipboard-list" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
          <p style="font-size:14px; font-weight:700; color:#475569;">Cây này chưa có nhật ký canh tác nào được ghi nhận.</p>
        </div>`;
      return;
    }

    // Render Lifetime Timeline (Vòng đời Canh tác)
    let timelineHtml = `
      <div style="position:relative; padding-left:32px; border-left:3px solid #059669; margin-left:20px;">
        <!-- Initiation Node -->
        <div style="position:relative; margin-bottom:24px;">
          <div style="position:absolute; left:-46px; top:0; width:26px; height:26px; border-radius:50%; background:#059669; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; border:3px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
            <i class="fa-solid fa-flag"></i>
          </div>
          <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:12px; padding:14px; color:#064e3b;">
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; color:#047857;">🌱 KHỞI TẠO CÂY TRỒNG TRÊN ỨNG DỤNG</div>
            <div style="font-size:13.5px; font-weight:700; margin-top:2px;">Ngày đăng ký: ${fmtDate(plant.created_at)}</div>
            <div style="font-size:12.5px; color:#166534; margin-top:4px;">Cây #${esc(plant.tree_code || plant.id)} (${esc(plant.plant_type)}) khởi tạo dữ liệu canh tác vĩnh viễn trên hệ thống Tanbao AgTech.</div>
          </div>
        </div>
    `;

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

    sortedLogs.forEach((l, idx) => {
      const cfg = typeConfigs[l.log_type] || { bg: '#f8fafc', color: '#334155', border: '#e2e8f0', icon: 'fa-clipboard-check', iconColor: '#059669' };

      let details = {};
      try {
        details = typeof l.details === 'string' ? JSON.parse(l.details) : (l.details || {});
      } catch (e) { details = {}; }

      // Supplies info (Phân bón / Thuốc)
      const supplyName = details.supply_name || details.product_name || details.fertilizer_name || details.pesticide_name || '';
      const supplyImg = details.supply_image || details.product_image || details.image_url || '';
      const quantity = details.quantity || details.dosage || details.amount || '';
      const unit = details.unit || details.dosage_unit || '';
      const method = details.method || details.water_method || '';
      const reason = details.reason || '';
      const cost = parseFloat(details.cost || details.supply_cost || l.cost || 0);

      // Parse attached log media photos
      let logMediaList = [];
      if (l.media_urls) {
        try {
          const raw = typeof l.media_urls === 'string' ? JSON.parse(l.media_urls) : l.media_urls;
          if (Array.isArray(raw)) logMediaList = raw;
        } catch(e) {}
      }

      // Render Supply Box if applicable
      let supplyBoxHtml = '';
      if (supplyName || cost > 0 || quantity || method || reason) {
        supplyBoxHtml = `
          <div style="margin-top:10px; background:#ffffff; border:1px solid ${cfg.border}; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              ${supplyImg ? `<img src="${esc(supplyImg)}" alt="${esc(supplyName)}" style="width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1;">` : `<div style="width:40px; height:40px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:18px;"><i class="fa-solid ${cfg.icon}"></i></div>`}
              <div>
                <div style="font-size:13px; font-weight:800; color:#0f172a;">${esc(supplyName || l.log_type)}</div>
                ${quantity ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Liều lượng / Số lượng: <strong>${esc(quantity)} ${esc(unit)}</strong></div>` : ''}
                ${method ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Phương thức: <strong>${esc(method)}</strong></div>` : ''}
                ${reason ? `<div style="font-size:11.5px; color:#475569; font-weight:600;">Mục đích / Lý do: <strong>${esc(reason)}</strong></div>` : ''}
              </div>
            </div>
            ${cost > 0 ? `<div style="font-size:13px; font-weight:800; color:#047857; background:#ecfdf5; padding:5px 12px; border-radius:8px; border:1px solid #a7f3d0;"><i class="fa-solid fa-coins"></i> ${cost.toLocaleString('vi-VN')} đ</div>` : ''}
          </div>
        `;
      }

      // Render Attached Photos/Videos
      let attachedMediaHtml = '';
      if (logMediaList.length > 0) {
        attachedMediaHtml = `
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            ${logMediaList.map(m => {
              const url = typeof m === 'string' ? m : m.url;
              return `<img src="${esc(url)}" alt="Hình ảnh nhật ký" style="width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer;" onclick="window.open('${esc(url)}')">`;
            }).join('')}
          </div>
        `;
      }

      timelineHtml += `
        <div style="position:relative; margin-bottom:20px;">
          <div style="position:absolute; left:-46px; top:4px; width:26px; height:26px; border-radius:50%; background:${cfg.bg}; color:${cfg.iconColor}; border:2px solid ${cfg.border}; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
            <i class="fa-solid ${cfg.icon}"></i>
          </div>

          <div style="background:#ffffff; border:1.5px solid ${cfg.border}; border-radius:14px; padding:14px 16px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; padding:4px 10px; border-radius:20px; font-size:11.5px; font-weight:800; display:inline-flex; align-items:center; gap:6px;">
                  <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(l.log_type)}
                </span>
                <span style="font-size:12px; font-weight:700; color:#64748b;"><i class="fa-regular fa-clock"></i> ${fmtDate(l.log_date)}</span>
              </div>
              ${l.creator_name ? `<small style="color:#64748b; font-weight:700; background:#f1f5f9; padding:2px 8px; border-radius:6px;"><i class="fa fa-user"></i> ${esc(l.creator_name)}</small>` : ''}
            </div>

            ${l.note ? `<div style="font-size:13.5px; color:#1e293b; margin-top:8px; line-height:1.5; font-weight:500;">${esc(l.note)}</div>` : ''}

            ${supplyBoxHtml}
            ${attachedMediaHtml}
          </div>
        </div>
      `;
    });

    timelineHtml += `</div>`;
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
        <td style="font-weight:800; color:${s.stock_quantity <= 5 ? '#dc2626' : '#047857'};">
          ${s.stock_quantity || s.quantity || 0} ${esc(s.unit || '')}
          ${s.stock_quantity <= 5 ? `<span style="font-size:10px; background:#fee2e2; color:#dc2626; padding:1px 5px; border-radius:4px; margin-left:4px;">Gần hết</span>` : ''}
        </td>
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
            <div style="font-size:18px; font-weight:800; color:${supply.stock_quantity <= 5 ? '#dc2626' : '#047857'}; margin-top:2px;">
              ${supply.stock_quantity || 0} ${esc(supply.unit || '')}
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
  const stock_quantity = parseFloat(document.getElementById('f-supply-stock').value) || 0;
  const unit_price = parseFloat(document.getElementById('f-supply-price').value) || 0;
  const user_id = document.getElementById('f-supply-user').value;
  const note = document.getElementById('f-supply-note').value.trim();
  const image_url = document.getElementById('f-supply-image-url').value;

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
