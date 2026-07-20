/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   supplies.js — Quản lý & Giám sát Vật tư (Bón phân, Tiền nước, Phun thuốc, Nhân công)
   ═══════════════════════════════════════════════════════════════ */

import { api } from './core/api.js';
import { toast, esc } from './core/utils.js';

let currentCategoryFilter = 'all';
let currentPeriodFilter = 'day';
let cachedSupplies = [];

// ─── Formatting helpers ──────────────────────────────────────────
function formatVND(amount) {
  const val = parseFloat(amount) || 0;
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' VNĐ';
}

function getCategoryBadge(category) {
  switch (category) {
    case 'Bón phân':
      return `<span class="badge-cat-fertilizer"><i class="fa-solid fa-flask"></i> Bón phân</span>`;
    case 'Tiền nước':
      return `<span class="badge-cat-water"><i class="fa-solid fa-droplet"></i> Tiền nước</span>`;
    case 'Phun thuốc':
      return `<span class="badge-cat-pesticide"><i class="fa-solid fa-shield-virus"></i> Phun thuốc</span>`;
    case 'Nhân công':
      return `<span class="badge-cat-labor"><i class="fa-solid fa-user-gear"></i> Nhân công</span>`;
    default:
      return `<span class="badge-gray">${category}</span>`;
  }
}

// ─── TAB 1: QUẢN LÝ VẬT TƯ (CRUD) ───────────────────────────────

// ─── Live Unit Auto-Calculation ──────────────────────────────────
export function autoCalculateSupplyUnits() {
  const pkgQty = parseFloat(document.getElementById('sp-package-qty')?.value) || 1;
  const pkgUnit = document.getElementById('sp-package-unit')?.value || 'kg';
  const pkgPrice = parseFloat(document.getElementById('sp-package-price')?.value) || 0;

  let unitLarge = 'kg';
  let unitSmall = 'g';
  let priceLarge = 0;
  let priceSmall = 0;

  if (pkgUnit === 'kg') {
    unitLarge = 'kg';
    unitSmall = 'g';
    priceLarge = pkgPrice / pkgQty;
    priceSmall = priceLarge / 1000;
  } else if (pkgUnit === 'g') {
    unitLarge = 'kg';
    unitSmall = 'g';
    priceSmall = pkgPrice / pkgQty;
    priceLarge = priceSmall * 1000;
  } else if (pkgUnit === 'lít') {
    unitLarge = 'lít';
    unitSmall = 'ml';
    priceLarge = pkgPrice / pkgQty;
    priceSmall = priceLarge / 1000;
  } else if (pkgUnit === 'ml') {
    unitLarge = 'lít';
    unitSmall = 'ml';
    priceSmall = pkgPrice / pkgQty;
    priceLarge = priceSmall * 1000;
  } else if (pkgUnit === 'm3') {
    unitLarge = 'm³';
    unitSmall = 'lít';
    priceLarge = pkgPrice / pkgQty;
    priceSmall = priceLarge / 1000;
  } else if (pkgUnit === 'ngày công') {
    unitLarge = 'ngày công';
    unitSmall = 'giờ công';
    priceLarge = pkgPrice / pkgQty;
    priceSmall = priceLarge / 8;
  } else {
    unitLarge = pkgUnit;
    unitSmall = pkgUnit;
    priceLarge = pkgPrice / pkgQty;
    priceSmall = priceLarge;
  }

  // Update hidden form inputs
  if (document.getElementById('sp-unit')) document.getElementById('sp-unit').value = unitLarge;
  if (document.getElementById('sp-unit-price')) document.getElementById('sp-unit-price').value = priceLarge;
  if (document.getElementById('sp-package-size')) document.getElementById('sp-package-size').value = `${pkgQty} ${pkgUnit}`;
  if (document.getElementById('sp-unit-price-small')) document.getElementById('sp-unit-price-small').value = priceSmall;

  // Update live preview UI
  const largeLabel = document.getElementById('calc-unit-large-name');
  const smallLabel = document.getElementById('calc-unit-small-name');
  const largeVal = document.getElementById('calc-price-large');
  const smallVal = document.getElementById('calc-price-small');

  if (largeLabel) largeLabel.textContent = unitLarge;
  if (smallLabel) smallLabel.textContent = unitSmall;
  if (largeVal) largeVal.textContent = `${formatVND(priceLarge)} / ${unitLarge}`;

  if (smallVal) {
    if (priceSmall > 0 && priceSmall < 1) {
      smallVal.textContent = `${priceSmall.toFixed(2)} VNĐ / ${unitSmall}`;
    } else {
      smallVal.textContent = `${formatVND(priceSmall)} / ${unitSmall}`;
    }
  }
}

export async function uploadSupplyImage(fileInput) {
  const file = fileInput?.files[0];
  if (!file) return;

  const btnText = document.getElementById('sp-upload-btn-text');
  if (btnText) btnText.textContent = 'Đang tải...';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const data = await api('/supplies/upload-image', {
      method: 'POST',
      body: formData,
      isFormData: true
    });

    setSupplyImagePreview(data.url);
    toast('Đã tải ảnh bao bì thành công!');
  } catch (err) {
    toast('Lỗi tải ảnh: ' + err.message, 'error');
  } finally {
    if (btnText) btnText.textContent = 'Tải ảnh bao bì...';
  }
}
window.uploadSupplyImage = uploadSupplyImage;

export function setSupplyImagePreview(url) {
  const preview = document.getElementById('sp-image-preview');
  const placeholder = document.getElementById('sp-image-placeholder-icon');
  const inputUrl = document.getElementById('sp-image-url');
  const removeBtn = document.getElementById('sp-remove-img-btn');

  if (url) {
    if (preview) { preview.src = url; preview.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    if (inputUrl) inputUrl.value = url;
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
    if (inputUrl) inputUrl.value = '';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

export function removeSupplyImage() {
  setSupplyImagePreview('');
  const fileInput = document.getElementById('sp-image-file');
  if (fileInput) fileInput.value = '';
}
window.removeSupplyImage = removeSupplyImage;

export async function loadSupplies() {
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;

  try {
    const params = new URLSearchParams();
    if (currentCategoryFilter !== 'all') {
      params.append('category', currentCategoryFilter);
    }

    cachedSupplies = await api(`/supplies?${params.toString()}`);

    if (!cachedSupplies || cachedSupplies.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <i class="fa-solid fa-boxes-packing" style="font-size:32px; color:var(--gray-300); margin-bottom:8px; display:block;"></i>
            Chưa có vật tư nào được khai báo${currentCategoryFilter !== 'all' ? ` trong hạng mục "${currentCategoryFilter}"` : ''}.<br>
            <button class="btn btn-primary btn-sm" onclick="openSupplyModal()" style="margin-top:10px;">
              <i class="fa-solid fa-plus"></i> Khai báo vật tư mới
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = cachedSupplies.map(sp => {
      const priceLarge = parseFloat(sp.unit_price) || 0;
      const priceSmall = parseFloat(sp.unit_price_small) || (sp.package_qty > 0 ? priceLarge / sp.package_qty : priceLarge);
      const smallUnit = (sp.unit === 'kg' ? 'g' : (sp.unit === 'lít' ? 'ml' : (sp.unit === 'm³' || sp.unit === 'm3' ? 'lít' : sp.unit)));

      return `
        <tr>
          <td>${getCategoryBadge(sp.category)}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              ${sp.image_url 
                ? `<img src="${esc(sp.image_url)}" style="width:38px; height:38px; border-radius:8px; object-fit:cover; border:1px solid var(--gray-200); box-shadow:0 2px 4px rgba(0,0,0,0.05);" onclick="openLightbox('${esc(sp.image_url)}', 'image')" class="clickable">` 
                : `<div style="width:38px; height:38px; border-radius:8px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:16px;"><i class="fa-solid fa-boxes-packing"></i></div>`}
              <div>
                <strong>${esc(sp.name)}</strong>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-gray" style="background:#f1f5f9; color:#334155; font-weight:700;">
              <i class="fa-solid fa-weight-hanging"></i> ${sp.package_qty || 1} ${sp.package_unit || sp.unit}
            </span>
          </td>
          <td><span class="badge-gray">${sp.unit}</span></td>
          <td>
            <strong style="color:var(--green-dark);">${formatVND(priceLarge)}</strong> / ${sp.unit}
            <br>
            <small style="color:#2563eb; font-weight:600;">
              (<i class="fa-solid fa-calculator"></i> ${priceSmall > 0 && priceSmall < 1 ? priceSmall.toFixed(2) + 'đ' : formatVND(priceSmall)} / ${smallUnit})
            </small>
          </td>
          <td><strong style="color:#2563eb;">${formatVND(sp.total_spent)}</strong> <br><small style="color:var(--text-muted);">(${sp.total_used_qty} ${sp.unit})</small></td>
          <td>${sp.note ? sp.note : '<span style="color:var(--gray-300);">—</span>'}</td>
          <td style="text-align:center;">
            <div style="display:flex; gap:6px; justify-content:center;">
              <button class="btn btn-secondary btn-sm" onclick="openSupplyModal(${sp.id})" title="Chỉnh sửa vật tư"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deleteSupply(${sp.id})" title="Xóa vật tư"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading supplies:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:red;">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
  }
}

export function filterSupplyCategory(cat) {
  currentCategoryFilter = cat;
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  loadSupplies();
}

export function openSupplyModal(id = null) {
  const modal = document.getElementById('modal-supply');
  const title = document.getElementById('modal-supply-title');
  if (!modal) return;

  document.getElementById('sp-id').value = id || '';
  document.getElementById('sp-category').value = 'Bón phân';
  document.getElementById('sp-name').value = '';
  document.getElementById('sp-package-qty').value = '50';
  document.getElementById('sp-package-unit').value = 'kg';
  document.getElementById('sp-package-price').value = '1530000';
  document.getElementById('sp-note').value = '';
  setSupplyImagePreview('');

  if (id) {
    const sp = cachedSupplies.find(item => item.id == id);
    if (sp) {
      if (title) title.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--green)"></i> Chỉnh sửa vật tư';
      document.getElementById('sp-category').value = sp.category;
      document.getElementById('sp-name').value = sp.name;
      document.getElementById('sp-package-qty').value = sp.package_qty || 1;
      document.getElementById('sp-package-unit').value = sp.package_unit || sp.unit || 'kg';
      document.getElementById('sp-package-price').value = sp.package_price || (sp.unit_price * (sp.package_qty || 1));
      document.getElementById('sp-note').value = sp.note || '';
      setSupplyImagePreview(sp.image_url || '');
    }
  } else {
    if (title) title.innerHTML = '<i class="fa-solid fa-boxes-packing" style="color:var(--green)"></i> Khai báo vật tư mới';
  }

  autoCalculateSupplyUnits();
  modal.style.display = 'flex';
}

export function closeSupplyModal() {
  const modal = document.getElementById('modal-supply');
  if (modal) modal.style.display = 'none';
}

export async function saveSupply() {
  autoCalculateSupplyUnits();

  const id = document.getElementById('sp-id').value;
  const category = document.getElementById('sp-category').value;
  const name = document.getElementById('sp-name').value.trim();
  const package_qty = parseFloat(document.getElementById('sp-package-qty').value) || 1;
  const package_unit = document.getElementById('sp-package-unit').value;
  const package_price = parseFloat(document.getElementById('sp-package-price').value) || 0;
  const package_size = document.getElementById('sp-package-size').value;
  const unit = document.getElementById('sp-unit').value;
  const unit_price = parseFloat(document.getElementById('sp-unit-price').value) || 0;
  const unit_price_small = parseFloat(document.getElementById('sp-unit-price-small').value) || 0;
  const note = document.getElementById('sp-note').value.trim();
  const image_url = document.getElementById('sp-image-url')?.value || '';

  if (!name || !package_price) {
    toast('Vui lòng điền đầy đủ Tên vật tư và Tổng giá tiền mua!', 'warning');
    return;
  }

  const btn = document.getElementById('supply-save-btn');
  if (btn) btn.disabled = true;

  const payload = {
    category,
    name,
    package_qty,
    package_unit,
    package_price,
    package_size,
    unit,
    unit_price,
    unit_price_small,
    note,
    image_url
  };

  try {
    if (id) {
      await api(`/supplies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast('Đã cập nhật thông tin vật tư thành công!');
    } else {
      await api('/supplies', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast('Đã khai báo vật tư mới thành công!');
    }

    closeSupplyModal();
    loadSupplies();
    loadSuppliesAnalytics();
  } catch (err) {
    toast('Lỗi lưu vật tư: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function deleteSupply(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa vật tư này? Lịch sử tiêu hao liên quan cũng sẽ bị xóa.')) return;
  try {
    await api(`/supplies/${id}`, { method: 'DELETE' });
    toast('Đã xóa vật tư thành công!');
    loadSupplies();
    loadSuppliesAnalytics();
  } catch (err) {
    toast('Lỗi xóa vật tư: ' + err.message, 'error');
  }
}

// ─── TAB SWITCHER ────────────────────────────────────────────────

export function switchSuppliesTab(tab) {
  const tabManage = document.getElementById('supplies-tab-manage');
  const tabMonitor = document.getElementById('supplies-tab-monitor');
  const paneManage = document.getElementById('pane-supplies-manage');
  const paneMonitor = document.getElementById('pane-supplies-monitor');

  if (tabManage) tabManage.classList.toggle('active', tab === 'manage');
  if (tabMonitor) tabMonitor.classList.toggle('active', tab === 'monitor');
  if (paneManage) paneManage.style.display = tab === 'manage' ? 'block' : 'none';
  if (paneMonitor) paneMonitor.style.display = tab === 'monitor' ? 'block' : 'none';

  if (tab === 'manage') loadSupplies();
  if (tab === 'monitor') loadSuppliesAnalytics();
}

// ─── TAB 2: GIÁM SÁT VẬT TƯ & CHI PHÍ ────────────────────────────

export function switchSupplyPeriod(period) {
  currentPeriodFilter = period;
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  loadSuppliesAnalytics();
}

export async function loadSuppliesAnalytics() {
  const yearSelect = document.getElementById('supplies-filter-year');
  const farmSelect = document.getElementById('supplies-filter-farm');
  
  const year = yearSelect ? yearSelect.value : new Date().getFullYear();
  const farm_id = farmSelect ? farmSelect.value : 'all';

  try {
    const data = await api(`/supplies/analytics?period=${currentPeriodFilter}&year=${year}&farm_id=${farm_id}`);

    // Update Stats Cards
    const totalEl = document.getElementById('cost-stat-total');
    const fertEl = document.getElementById('cost-stat-fertilizer');
    const waterEl = document.getElementById('cost-stat-water');
    const pestLaborEl = document.getElementById('cost-stat-pesticide-labor');

    if (totalEl) totalEl.textContent = formatVND(data.summary.total_expenditure);
    if (fertEl) fertEl.textContent = formatVND(data.summary.categories['Bón phân']);
    if (waterEl) waterEl.textContent = formatVND(data.summary.categories['Tiền nước']);
    
    const combinedPestLabor = (data.summary.categories['Phun thuốc'] || 0) + (data.summary.categories['Nhân công'] || 0);
    if (pestLaborEl) pestLaborEl.textContent = formatVND(combinedPestLabor);

    // Render Breakdown Table
    renderBreakdownTable(data.time_breakdown, data.summary.total_expenditure);

    // Also load recent usages log table
    loadSupplyUsagesLog();

  } catch (err) {
    console.error('Error loading supplies analytics:', err);
  }
}

function renderBreakdownTable(breakdown, grandTotal) {
  const tbody = document.getElementById('supplies-breakdown-table-body');
  const title = document.getElementById('breakdown-table-title');

  const periodNames = {
    day: 'Ngày trong tháng',
    month: 'Tháng trong năm',
    quarter: 'Quý trong năm',
    year: 'Năm'
  };

  if (title) {
    title.innerHTML = `<i class="fa-solid fa-chart-bar" style="color:var(--green)"></i> Bảng tổng hợp chi phí vật tư (${periodNames[currentPeriodFilter] || 'Theo thời gian'})`;
  }

  if (!tbody) return;

  if (!breakdown || breakdown.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Không có dữ liệu tiêu hao vật tư trong khoảng thời gian này.</td></tr>';
    return;
  }

  tbody.innerHTML = breakdown.map(row => {
    const cost = parseFloat(row.total_cost) || 0;
    const percentage = grandTotal > 0 ? ((cost / grandTotal) * 100).toFixed(1) : 0;

    return `
      <tr>
        <td><strong>${row.period_label}</strong></td>
        <td>${getCategoryBadge(row.category)}</td>
        <td>${row.total_quantity}</td>
        <td><strong style="color:var(--green-dark);">${formatVND(cost)}</strong></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; height:8px; background:var(--gray-100); border-radius:4px; overflow:hidden;">
              <div style="width:${percentage}%; height:100%; background:var(--green); border-radius:4px;"></div>
            </div>
            <span style="font-size:12px; font-weight:600; color:var(--text-muted); width:40px;">${percentage}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── GHI NHẬN TIÊU HAO VẬT TƯ (USAGE LOGS) ─────────────────────

export async function openRecordUsageModal() {
  const modal = document.getElementById('modal-supply-usage');
  const select = document.getElementById('su-supply-id');
  const dateInput = document.getElementById('su-usage-date');
  const farmSelect = document.getElementById('su-farm-id');

  if (!modal) return;

  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  document.getElementById('su-quantity').value = '1';
  document.getElementById('su-note').value = '';

  // Load supplies into dropdown
  try {
    cachedSupplies = await api('/supplies');
    if (!cachedSupplies || cachedSupplies.length === 0) {
      toast('Vui lòng Khai báo ít nhất 1 Vật tư trước khi ghi nhận tiêu hao!', 'warning');
      switchSuppliesTab('manage');
      return;
    }

    if (select) {
      select.innerHTML = cachedSupplies.map(s => `
        <option value="${s.id}" data-price="${s.unit_price}" data-unit="${s.unit}">
          [${s.category}] ${s.name} ${s.package_size ? `(${s.package_size})` : ''} — ${formatVND(s.unit_price)} / ${s.unit}
        </option>
      `).join('');
    }

    // Load farms into dropdown
    const farms = await api('/farms');
    if (farmSelect) {
      farmSelect.innerHTML = '<option value="">Toàn bộ trang trại (Không chọn)</option>' +
        (farms || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    }

    onSupplySelectionChange();
    modal.style.display = 'flex';

  } catch (err) {
    toast('Lỗi mở form ghi nhận: ' + err.message, 'error');
  }
}

export function closeRecordUsageModal() {
  const modal = document.getElementById('modal-supply-usage');
  if (modal) modal.style.display = 'none';
}

export function onSupplySelectionChange() {
  const select = document.getElementById('su-supply-id');
  const unitLabel = document.getElementById('su-unit-label');

  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (opt) {
    const unit = opt.dataset.unit || 'đơn vị';
    if (unitLabel) unitLabel.textContent = unit;
  }
  calculateUsageCostPreview();
}

export function calculateUsageCostPreview() {
  const select = document.getElementById('su-supply-id');
  const qtyInput = document.getElementById('su-quantity');
  const pricePreview = document.getElementById('su-price-preview');
  const totalPreview = document.getElementById('su-total-preview');

  if (!select || !qtyInput) return;

  const opt = select.options[select.selectedIndex];
  if (!opt) return;

  const price = parseFloat(opt.dataset.price) || 0;
  const qty = parseFloat(qtyInput.value) || 0;
  const total = price * qty;

  if (pricePreview) pricePreview.textContent = formatVND(price);
  if (totalPreview) totalPreview.textContent = formatVND(total);
}

export async function saveSupplyUsage() {
  const supply_id = document.getElementById('su-supply-id').value;
  const usage_date = document.getElementById('su-usage-date').value;
  const quantity = document.getElementById('su-quantity').value;
  const farm_id = document.getElementById('su-farm-id').value;
  const note = document.getElementById('su-note').value.trim();

  if (!supply_id || !quantity) {
    toast('Vui lòng chọn vật tư và nhập số lượng tiêu hao!', 'warning');
    return;
  }

  const btn = document.getElementById('su-save-btn');
  if (btn) btn.disabled = true;

  try {
    await api('/supplies/usages', {
      method: 'POST',
      body: JSON.stringify({
        supply_id,
        usage_date,
        quantity,
        farm_id: farm_id || null,
        note
      })
    });

    toast('Đã ghi nhận tiêu hao vật tư thành công!');
    closeRecordUsageModal();
    loadSuppliesAnalytics();
  } catch (err) {
    toast('Lỗi ghi nhận tiêu hao: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function loadSupplyUsagesLog() {
  const tbody = document.getElementById('supplies-usages-log-body');
  if (!tbody) return;

  try {
    const farmSelect = document.getElementById('supplies-filter-farm');
    const farm_id = farmSelect ? farmSelect.value : 'all';

    const params = new URLSearchParams();
    if (farm_id && farm_id !== 'all') params.append('farm_id', farm_id);
    params.append('limit', '20');

    const logs = await api(`/supplies/usages?${params.toString()}`);

    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Chưa có đợt tiêu hao vật tư nào được ghi nhận.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const dateStr = new Date(l.usage_date).toLocaleDateString('vi-VN');
      return `
        <tr>
          <td><strong>${dateStr}</strong></td>
          <td><strong>${l.supply_name}</strong></td>
          <td>${getCategoryBadge(l.category)}</td>
          <td>${l.farm_name ? l.farm_name : '<span style="color:var(--gray-300);">Toàn vườn</span>'}</td>
          <td><strong>${l.quantity}</strong> ${l.unit}</td>
          <td>${formatVND(l.unit_price)}</td>
          <td><strong style="color:var(--green-dark);">${formatVND(l.total_cost)}</strong></td>
          <td style="text-align:center;">
            <button class="btn btn-danger btn-sm" onclick="deleteSupplyUsage(${l.id})" title="Xóa đợt tiêu hao"><i class="fa fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading supply usages log:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:red;">Lỗi tải lịch sử: ${err.message}</td></tr>`;
  }
}

export async function deleteSupplyUsage(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa lịch sử tiêu hao này?')) return;
  try {
    await api(`/supplies/usages/${id}`, { method: 'DELETE' });
    toast('Đã xóa đợt tiêu hao vật tư thành công!');
    loadSuppliesAnalytics();
  } catch (err) {
    toast('Lỗi xóa lịch sử: ' + err.message, 'error');
  }
}

// ─── EXPOSE TO WINDOW FOR HTML ONCLICK ───────────────────────────
window.autoCalculateSupplyUnits = autoCalculateSupplyUnits;
window.loadSupplies = loadSupplies;
window.filterSupplyCategory = filterSupplyCategory;
window.openSupplyModal = openSupplyModal;
window.closeSupplyModal = closeSupplyModal;
window.saveSupply = saveSupply;
window.deleteSupply = deleteSupply;
window.switchSuppliesTab = switchSuppliesTab;
window.switchSupplyPeriod = switchSupplyPeriod;
window.loadSuppliesAnalytics = loadSuppliesAnalytics;
window.openRecordUsageModal = openRecordUsageModal;
window.closeRecordUsageModal = closeRecordUsageModal;
window.onSupplySelectionChange = onSupplySelectionChange;
window.calculateUsageCostPreview = calculateUsageCostPreview;
window.saveSupplyUsage = saveSupplyUsage;
window.loadSupplyUsagesLog = loadSupplyUsagesLog;
window.deleteSupplyUsage = deleteSupplyUsage;
