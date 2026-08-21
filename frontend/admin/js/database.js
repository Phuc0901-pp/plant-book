/* ════════════════════════════════════════════════════════
   Plant Book Admin — database.js (Cơ sở dữ liệu & Nhật ký Canh tác)
   Sub-tabs: 1. Dữ liệu canh tác, 2. Vật tư, 3. Thư viện media
   ════════════════════════════════════════════════════════ */

let dbUsersCache = [];
let dbFarmsCache = [];
let dbPlantsCache = [];
let activeDbTab = 'cultivation';

async function initDatabasePage() {
  try {
    dbUsersCache = await api('/users') || [];
    dbFarmsCache = await api('/farms') || [];
    dbPlantsCache = await api('/plants') || [];

    // Populate User filter
    const uSelect = document.getElementById('db-filter-user');
    if (uSelect) {
      uSelect.innerHTML = '<option value="">— tất cả khách hàng —</option>' +
        dbUsersCache.filter(u => u.role === 'user').map(u => `<option value="${u.id}">👤 ${esc(u.full_name)} (${esc(u.phone || u.email)})</option>`).join('');
    }

    // Populate Farm filter
    const fSelect = document.getElementById('db-filter-farm');
    if (fSelect) {
      fSelect.innerHTML = '<option value="">— tất cả trang trại —</option>' +
        dbFarmsCache.map(f => `<option value="${f.id}">🏡 ${esc(f.name)}</option>`).join('');
    }

    // Populate Plant filter
    const pSelect = document.getElementById('db-filter-plant');
    if (pSelect) {
      pSelect.innerHTML = '<option value="">— Chọn Cây trồng để xem Nhật ký Canh tác —</option>' +
        dbPlantsCache.map(p => `<option value="${p.id}">🌳 Cây #${p.tree_code || p.id} (${esc(p.plant_type)})</option>`).join('');
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
    let totalHarvestValue = 0;  // Giá trị thu hoạch

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
              🌳 HỒ SƠ TỔNG TỔNG DỮ LIỆU CANH TÁC & CHI PHÍ ĐẦU TƯ CÂY #${esc(plant.tree_code || plant.id)}
            </div>
            <div style="font-size:22px; font-weight:800; margin-top:4px;">
              ${esc(plant.plant_type)} ${plant.plant_variety ? `(${esc(plant.plant_variety)})` : ''} · Trang trại: ${esc(plant.farm_name || 'Vườn Nông hộ')}
            </div>
            <div style="font-size:13px; opacity:0.9; margin-top:2px;">
              Tình trạng: <strong>${esc(plant.health_status)}</strong> · Tuổi cây: <strong>${esc(plant.plant_age || 'Chưa rõ')}</strong> · Vị trí: <strong>${esc(plant.location || 'Chưa gán')}</strong>
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
            <div style="font-size:12.5px; color:#166534; margin-top:4px;">Cây #${esc(plant.tree_code || plant.id)} (${esc(plant.plant_type)}) được khởi tạo dữ liệu canh tác vĩnh viễn.</div>
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
      const supplyName = details.supply_name || details.product_name || '';
      const supplyImg = details.supply_image || details.product_image || '';
      const quantity = details.quantity || details.dosage || '';
      const unit = details.unit || '';
      const cost = parseFloat(details.cost || details.supply_cost || l.cost || 0);

      // Render Supply Thumbnail & Details if applicable
      let supplyBoxHtml = '';
      if (supplyName || cost > 0 || quantity) {
        supplyBoxHtml = `
          <div style="margin-top:10px; background:#ffffff; border:1px solid ${cfg.border}; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              ${supplyImg ? `<img src="${esc(supplyImg)}" alt="${esc(supplyName)}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;">` : `<div style="width:40px; height:40px; border-radius:8px; background:${cfg.bg}; color:${cfg.iconColor}; display:flex; align-items:center; justify-content:center; font-size:18px;"><i class="fa-solid ${cfg.icon}"></i></div>`}
              <div>
                <div style="font-size:13px; font-weight:800; color:#0f172a;">${esc(supplyName || l.log_type)}</div>
                ${quantity ? `<div style="font-size:11.5px; color:#64748b; font-weight:600;">Liều lượng / Sử dụng: <strong>${esc(quantity)} ${esc(unit)}</strong></div>` : ''}
              </div>
            </div>
            ${cost > 0 ? `<div style="font-size:13px; font-weight:800; color:#047857; background:#ecfdf5; padding:4px 10px; border-radius:8px; border:1px solid #a7f3d0;"><i class="fa-solid fa-coins"></i> ${cost.toLocaleString('vi-VN')} đ</div>` : ''}
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
              ${l.creator_name ? `<small style="color:#94a3b8; font-weight:600;"><i class="fa fa-user"></i> ${esc(l.creator_name)}</small>` : ''}
            </div>

            <div style="font-size:13.5px; color:#1e293b; margin-top:8px; line-height:1.5; font-weight:500;">
              ${esc(l.note || 'Không có ghi chú thêm.')}
            </div>

            ${supplyBoxHtml}
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

  tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải danh mục vật tư...</td></tr>';

  try {
    const supplies = await api('/supplies') || [];
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
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Kho vật tư hiện chưa có sản phẩm nào.</td></tr>';
    return;
  }

  tbody.innerHTML = supplies.map(s => `
    <tr>
      <td>
        ${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" style="width:44px; height:44px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;">` : `<div style="width:44px; height:44px; border-radius:8px; background:#f1f5f9; color:#94a3b8; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-box"></i></div>`}
      </td>
      <td style="font-weight:700; color:#0f172a;">${esc(s.name)}</td>
      <td><span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700; padding:4px 8px; border-radius:6px;">${esc(s.type || 'Vật tư')}</span></td>
      <td style="font-weight:700; color:#047857;">${s.quantity || 0} ${esc(s.unit || '')}</td>
      <td style="font-weight:800; color:#059669;">${s.unit_price ? parseFloat(s.unit_price).toLocaleString('vi-VN') + ' đ' : '—'}</td>
      <td style="font-size:12px; color:#64748b;">${esc(s.supplier || s.note || '—')}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editSupply(${s.id})"><i class="fa fa-pen"></i> Sửa</button>
      </td>
    </tr>
  `).join('');
}

function filterSupplies() {
  const q = (document.getElementById('supply-search')?.value || '').toLowerCase().trim();
  if (!q) {
    renderSuppliesTable(allSuppliesCache);
    return;
  }
  const filtered = allSuppliesCache.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.type || '').toLowerCase().includes(q) ||
    (s.supplier || '').toLowerCase().includes(q)
  );
  renderSuppliesTable(filtered);
}

window.initDatabasePage = initDatabasePage;
window.switchDatabaseTab = switchDatabaseTab;
window.onDbFilterChange = onDbFilterChange;
window.loadPlantCultivationTimeline = loadPlantCultivationTimeline;
window.loadSuppliesTab = loadSuppliesTab;
window.filterSupplies = filterSupplies;
