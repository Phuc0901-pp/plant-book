/* ════════════════════════════════════════════════════════
   Plant Book Admin — cost.js (Quản trị Chi phí Canh tác & Đầu tư)
   1. Gom nhóm theo Ngày -> Loại vật tư -> Tên sản phẩm
   2. Loại bỏ Tài sản cố định
   3. Biểu đồ chi tiết theo từng Loại vật tư (Bón phân, Phun thuốc, Tiền nước, Nhân công)
   Version: v1.0.1
   ════════════════════════════════════════════════════════ */

let costChartInstance = null;
let costCurrentTab = 'consumable';
let costConsumables = [];

const costCategoryConfigs = {
  'Bón phân': { bg: '#fef3c7', color: '#78350f', border: '#fde68a', icon: 'fa-seedling', iconColor: '#92400e', chartColor: '#f59e0b' },
  'Phun thuốc': { bg: '#f3e8ff', color: '#6b21a8', border: '#ddd6fe', icon: 'fa-spray-can-sparkles', iconColor: '#8b5cf6', chartColor: '#8b5cf6' },
  'Tiền nước': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-droplet', iconColor: '#3b82f6', chartColor: '#3b82f6' },
  'Nhân công': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: 'fa-user-gear', iconColor: '#10b981', chartColor: '#10b981' }
};

function getCostCatConfig(catName) {
  return costCategoryConfigs[catName] || { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', icon: 'fa-box-open', iconColor: '#64748b', chartColor: '#64748b' };
}

async function initCostPage() {
  try {
    const userSelVal = document.getElementById('cost-filter-user') ? document.getElementById('cost-filter-user').value : 'all';
    const farmSelVal = document.getElementById('cost-filter-farm') ? document.getElementById('cost-filter-farm').value : 'all';

    const [farms, users] = await Promise.all([api('/farms'), api('/users')]);
    const userSel = document.getElementById('cost-filter-user');
    const farmSel = document.getElementById('cost-filter-farm');
    if (userSel && userSel.options.length <= 1) {
      userSel.innerHTML = '<option value="all">👤 Tất cả khách hàng</option>' +
        users.map(u => '<option value="' + u.id + '">' + esc(u.full_name) + '</option>').join('');
    }
    if (farmSel && farmSel.options.length <= 1) {
      farmSel.innerHTML = '<option value="all">🌿 Tất cả trang trại</option>' +
        farms.map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('');
    }
    const ceFarm = document.getElementById('ce-farm');
    if (ceFarm) {
      ceFarm.innerHTML = '<option value="">— Chọn trang trại —</option>' +
        farms.map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('');
    }

    // Fetch REAL cost data from PostgreSQL backend
    let queryCons = '/costs/consumables?';
    if (userSelVal !== 'all') { queryCons += 'user_id=' + userSelVal + '&'; }
    if (farmSelVal !== 'all') { queryCons += 'farm_id=' + farmSelVal + '&'; }

    const consData = await api(queryCons);
    costConsumables = consData || [];

    renderCostPage();
  } catch (err) {
    console.error('initCostPage error:', err);
    toast('Lỗi tải dữ liệu Chi phí thực từ server: ' + err.message, 'error');
  }
}

function costFilterChange() {
  initCostPage();
}

function renderCostPage() {
  renderKpiCards(costConsumables);
  renderConsumableTable(costConsumables);
  if (costCurrentTab === 'chart') renderCostChart();
}

async function renderKpiCards(cons) {
  const totalCons = cons.reduce((s, c) => s + (parseFloat(c.total || c.total_cost) || 0), 0);
  const grandTotal = totalCons;

  const fmt = n => n.toLocaleString('vi-VN') + ' ₫';
  const kc = document.getElementById('kpi-consumable');
  const kt = document.getElementById('kpi-total');
  const kplant = document.getElementById('kpi-cost-per-plant');
  const karea = document.getElementById('kpi-cost-per-area');

  if (kc) kc.textContent = fmt(totalCons);
  if (kt) kt.textContent = fmt(grandTotal);

  // Fetch farm metadata for plant count & total area calculations
  try {
    const farmId = document.getElementById('cost-filter-farm')?.value || 'all';
    const farms = await api('/farms');
    let totalPlants = 0;
    let totalArea = 0;

    if (farmId !== 'all') {
      const selected = farms.find(f => String(f.id) === String(farmId));
      if (selected) {
        totalPlants = parseInt(selected.plant_count || 0);
        totalArea = parseFloat(selected.area || 0);
      }
    } else {
      farms.forEach(f => {
        totalPlants += parseInt(f.plant_count || 0);
        totalArea += parseFloat(f.area || 0);
      });
    }

    if (kplant) kplant.textContent = totalPlants > 0 ? fmt(Math.round(grandTotal / totalPlants)) : '—';
    if (karea) karea.textContent = totalArea > 0 ? fmt(Math.round(grandTotal / totalArea)) : '—';
  } catch (_) {
    if (kplant) kplant.textContent = '—';
    if (karea) karea.textContent = '—';
  }
}

// ── Export Excel / CSV ─────────────────────────────────────
function exportCostExcel() {
  const filename = 'vat-tu-tieu-hao-va-chi-phi-canh-tac.csv';
  let csvContent = '\uFEFF'; // UTF-8 BOM

  csvContent += 'Ngay,Loai vat tu,Ten vat tu,Don vi,So luong,Don gia (VND),Thanh tien (VND),Trang trai,Ghi chu\n';
  costConsumables.forEach(c => {
    const d = c.date ? new Date(c.date).toISOString().split('T')[0] : '';
    const cat = `"${(c.category || '').replace(/"/g, '""')}"`;
    const name = `"${(c.name || c.supply_name || '').replace(/"/g, '""')}"`;
    const unit = `"${(c.unit || '').replace(/"/g, '""')}"`;
    const qty = c.qty || c.quantity || 0;
    const price = c.price || c.unit_price || 0;
    const total = c.total || c.total_cost || (qty * price);
    const farm = `"${(c.farm_name || '').replace(/"/g, '""')}"`;
    const note = `"${(c.note || '').replace(/"/g, '""')}"`;
    csvContent += `${d},${cat},${name},${unit},${qty},${price},${total},${farm},${note}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('Đã xuất file báo cáo CSV/Excel!', 'success');
}

// ── Export PDF / Print ─────────────────────────────────────
function exportCostPDF() {
  window.print();
}

function switchCostTab(tab) {
  costCurrentTab = tab;
  ['consumable', 'chart'].forEach(function(t) {
    const pane = document.getElementById('cost-pane-' + t);
    const btn = document.getElementById('cost-tab-' + t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'chart') setTimeout(renderCostChart, 50);
}

// ── Render Consumable Table: Grouped by Date -> Category -> Supply Name ──
function renderConsumableTable(cons) {
  const container = document.getElementById('cost-consumable-grouped-container');
  if (!container) return;

  if (!cons || cons.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px; background:#ffffff; border-radius:16px; border:1px solid #e2e8f0; text-align:center;">
        <i class="fa-solid fa-boxes-packing" style="font-size:42px; color:#94a3b8; margin-bottom:12px;"></i>
        <p style="font-size:14px; font-weight:700; color:#475569;">Chưa có dữ liệu chi phí tiêu hao vật tư. Bấm "Thêm vật tư mới" để khai báo.</p>
      </div>`;
    return;
  }

  // 1. Group by Date (Newest Date First)
  const groupedByDate = {};
  cons.forEach(item => {
    const dObj = new Date(item.date || item.usage_date || item.created_at);
    const dateKey = !isNaN(dObj) ? dObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Khác / Chưa rõ ngày';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(item);
  });

  let html = '';

  Object.keys(groupedByDate).forEach(dateStr => {
    const dayItems = groupedByDate[dateStr];
    const dayTotalCost = dayItems.reduce((s, i) => s + (parseFloat(i.total || i.total_cost || (i.qty * i.price)) || 0), 0);

    // 2. Group by Category within the date
    const groupedByCat = {};
    dayItems.forEach(item => {
      const cat = item.category || item.type || 'Vật tư khác';
      if (!groupedByCat[cat]) groupedByCat[cat] = [];
      groupedByCat[cat].push(item);
    });

    html += `
      <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; margin-bottom:24px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <!-- Date Header Bar -->
        <div style="background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:14px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <i class="fa-regular fa-calendar-check" style="color:#10b981;"></i> Ngày ${esc(dateStr)}
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="badge" style="background:rgba(255,255,255,0.15); color:#ffffff; font-size:11.5px; font-weight:700;">${dayItems.length} mục tiêu hao</span>
            <span style="background:#059669; color:#ffffff; font-size:13px; font-weight:800; padding:4px 12px; border-radius:20px;">💰 ${dayTotalCost.toLocaleString('vi-VN')} ₫</span>
          </div>
        </div>

        <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
    `;

    Object.keys(groupedByCat).forEach(catName => {
      const catItems = groupedByCat[catName];
      const cfg = getCostCatConfig(catName);
      const catTotalCost = catItems.reduce((s, i) => s + (parseFloat(i.total || i.total_cost || (i.qty * i.price)) || 0), 0);

      // 3. Group by Supply Name within Category
      const groupedByName = {};
      catItems.forEach(item => {
        const sName = item.name || item.supply_name || catName;
        if (!groupedByName[sName]) {
          groupedByName[sName] = {
            name: sName,
            category: catName,
            unit: item.unit || 'đơn vị',
            totalQty: 0,
            totalCost: 0,
            prices: [],
            farms: new Set(),
            notes: []
          };
        }
        const qty = parseFloat(item.qty || item.quantity || 0);
        const price = parseFloat(item.price || item.unit_price || 0);
        const total = parseFloat(item.total || item.total_cost || (qty * price));

        groupedByName[sName].totalQty += qty;
        groupedByName[sName].totalCost += total;
        if (price > 0) groupedByName[sName].prices.push(price);
        if (item.farm_name) groupedByName[sName].farms.add(item.farm_name);
        if (item.note) groupedByName[sName].notes.push(item.note);
      });

      html += `
        <div style="background:#f8fafc; border:1px solid ${cfg.border}; border-radius:12px; padding:14px;">
          <!-- Category Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px dashed ${cfg.border}; flex-wrap:wrap; gap:8px;">
            <span class="badge" style="background:${cfg.bg}; color:${cfg.color}; border:1px solid ${cfg.border}; font-weight:800; font-size:12px; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
              <i class="fa-solid ${cfg.icon}" style="color:${cfg.iconColor}"></i> ${esc(catName).toUpperCase()}
            </span>
            <span style="font-size:13px; font-weight:800; color:${cfg.color};">Tổng nhóm: ${catTotalCost.toLocaleString('vi-VN')} ₫</span>
          </div>

          <!-- Supply Items List -->
          <div style="display:flex; flex-direction:column; gap:10px;">
      `;

      Object.values(groupedByName).forEach(s => {
        const farmsList = Array.from(s.farms);
        const avgPrice = s.prices.length > 0 ? s.prices.reduce((a, b) => a + b, 0) / s.prices.length : 0;
        const isEndless = ['Nhân công', 'Tiền nước'].includes(catName);

        html += `
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div>
              <div style="font-size:14px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                ${esc(s.name)}
                ${isEndless ? `<span class="badge" style="background:#ecfdf5; color:#047857; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0;"><i class="fa-solid fa-infinity"></i> Vô hạn ∞</span>` : ''}
              </div>
              <div style="font-size:12px; color:#475569; margin-top:3px; font-weight:600;">
                Tổng số lượng: <strong style="color:#047857;">${isEndless && s.totalQty === 0 ? 'Theo đợt' : `${s.totalQty.toLocaleString('vi-VN')} ${esc(s.unit)}`}</strong>
                ${avgPrice > 0 ? ` · Đơn giá bình quân: <strong>${avgPrice.toLocaleString('vi-VN')} ₫</strong>` : ''}
              </div>
              <div style="font-size:12px; color:#64748b; margin-top:4px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                ${farmsList.length > 0 ? `<span><i class="fa-solid fa-house-chimney" style="color:#059669;"></i> Trang trại: <strong>${esc(farmsList.join(', '))}</strong></span>` : ''}
                ${s.notes.length > 0 ? `<span><i class="fa-solid fa-note-sticky" style="color:#eab308;"></i> Ghi chú: <em>${esc(s.notes.join('; '))}</em></span>` : ''}
              </div>
            </div>

            <div style="text-align:right;">
              <div style="font-size:15px; font-weight:800; color:#047857; background:#ecfdf5; padding:6px 14px; border-radius:10px; border:1px solid #a7f3d0;">
                ${s.totalCost.toLocaleString('vi-VN')} ₫
              </div>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ── Render Cost Chart: Categorized by Supply Category (Bón phân, Phun thuốc, Tiền nước, Nhân công) ──
function renderCostChart() {
  const canvas = document.getElementById('cost-line-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const year = parseInt(document.getElementById('cost-chart-year') ? document.getElementById('cost-chart-year').value : new Date().getFullYear());
  const selectedCat = document.getElementById('cost-chart-type') ? document.getElementById('cost-chart-type').value : 'all';

  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

  const categoryConfigs = {
    'Bón phân': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: 'fa-seedling' },
    'Phun thuốc': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: 'fa-spray-can-sparkles' },
    'Tiền nước': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: 'fa-droplet' },
    'Nhân công': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: 'fa-user-gear' },
    'Vật tư khác': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', icon: 'fa-box-open' }
  };

  const monthlyTotals = {
    'Bón phân': Array(12).fill(0),
    'Phun thuốc': Array(12).fill(0),
    'Tiền nước': Array(12).fill(0),
    'Nhân công': Array(12).fill(0),
    'Vật tư khác': Array(12).fill(0)
  };

  costConsumables.forEach(function(item) {
    if (!item.date && !item.usage_date && !item.created_at) return;
    const d = new Date(item.date || item.usage_date || item.created_at);
    if (!isNaN(d) && d.getFullYear() === year) {
      const m = d.getMonth();
      const cat = item.category || item.type || 'Vật tư khác';
      const normCat = monthlyTotals[cat] ? cat : 'Vật tư khác';
      monthlyTotals[normCat][m] += parseFloat(item.total || item.total_cost || (item.qty * item.price) || 0);
    }
  });

  const datasets = [];
  Object.keys(monthlyTotals).forEach(cat => {
    if (selectedCat !== 'all' && selectedCat !== cat) return;
    const cfg = categoryConfigs[cat];
    const totalYear = monthlyTotals[cat].reduce((s, v) => s + v, 0);

    if (selectedCat !== 'all' || totalYear > 0 || ['Bón phân', 'Phun thuốc', 'Tiền nước', 'Nhân công'].includes(cat)) {
      datasets.push({
        label: cat,
        data: monthlyTotals[cat],
        borderColor: cfg.color,
        backgroundColor: cfg.bg,
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: cfg.color,
        tension: 0.35,
        fill: false
      });
    }
  });

  if (costChartInstance) { costChartInstance.destroy(); costChartInstance = null; }
  costChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: months, datasets: datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12, family: 'Inter', weight: '700' }, padding: 16, usePointStyle: true } },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12,
          callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.raw.toLocaleString('vi-VN') + ' ₫'; } }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 12, family: 'Inter', weight: '600' }, color: '#64748b' } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', callback: function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M ₫' : v >= 1000 ? (v/1000).toFixed(0)+'K ₫' : v + ' ₫'; } } }
      }
    }
  });

  // Render Summary Cards Breakdown by Category
  const summary = document.getElementById('cost-chart-summary');
  if (summary) {
    const cardsHtml = Object.keys(monthlyTotals).map(cat => {
      const cfg = categoryConfigs[cat];
      const totalYear = monthlyTotals[cat].reduce((s, v) => s + v, 0);
      return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <div style="width:40px; height:40px; background:${cfg.bg}; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="fa-solid ${cfg.icon}" style="color:${cfg.color}; font-size:16px;"></i>
          </div>
          <div>
            <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${esc(cat)}</div>
            <div style="font-size:15px; font-weight:800; color:#0f172a; margin-top:2px;">${totalYear.toLocaleString('vi-VN')} ₫</div>
          </div>
        </div>
      `;
    }).join('');
    summary.innerHTML = cardsHtml;
  }
}

function openCostEntryModal(type = 'consumable') {
  document.getElementById('ce-type').value = 'consumable';
  document.getElementById('cost-entry-modal-title').innerHTML = '<i class="fa-solid fa-boxes-stacked" style="color:#10b981;"></i> Khai báo Vật tư &amp; Chi phí Canh tác mới';
  document.getElementById('ce-fields-consumable').style.display = 'block';
  document.getElementById('ce-fields-fixed').style.display = 'none';
  document.getElementById('ce-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ce-note').value = '';
  document.getElementById('ce-name').value = '';
  document.getElementById('ce-qty').value = '';
  document.getElementById('ce-price').value = '';
  document.getElementById('ce-unit').value = '';

  document.getElementById('cost-entry-modal').style.display = 'flex';
}

function closeCostEntryModal() {
  document.getElementById('cost-entry-modal').style.display = 'none';
}

async function saveCostEntry() {
  const farmId = parseInt(document.getElementById('ce-farm').value) || null;
  const note = document.getElementById('ce-note').value.trim();
  const date = document.getElementById('ce-date').value;
  if (!farmId) { toast('Vui lòng chọn trang trại!', 'error'); return; }

  try {
    const name = document.getElementById('ce-name').value.trim();
    const qty = parseFloat(document.getElementById('ce-qty').value) || 0;
    const price = parseFloat(document.getElementById('ce-price').value) || 0;
    const unit = document.getElementById('ce-unit').value.trim() || 'kg';
    const category = document.getElementById('ce-category').value;
    if (!name) { toast('Vui lòng nhập tên vật tư!', 'error'); return; }

    await api('/costs/consumables', {
      method: 'POST',
      body: JSON.stringify({ farm_id: farmId, date, category, name, unit, qty, price, note })
    });
    toast('Đã lưu thông tin vật tư tiêu hao vào hệ thống thành công!', 'success');

    closeCostEntryModal();
    initCostPage();
  } catch (err) {
    console.error('saveCostEntry error:', err);
    toast('Lỗi lưu chi phí: ' + err.message, 'error');
  }
}

window.initCostPage = initCostPage;
window.costFilterChange = costFilterChange;
window.switchCostTab = switchCostTab;
window.renderCostChart = renderCostChart;
window.exportCostExcel = exportCostExcel;
window.exportCostPDF = exportCostPDF;
window.openCostEntryModal = openCostEntryModal;
window.closeCostEntryModal = closeCostEntryModal;
window.saveCostEntry = saveCostEntry;
