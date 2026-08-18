/* ════════════════════════════════════════════════════════
   Plant Book Admin — cost.js
   Quản trị Chi phí Đầu tư (Dữ liệu thực từ PostgreSQL DB)
   ════════════════════════════════════════════════════════ */

let costChartInstance = null;
let costCurrentTab = 'consumable';
let costConsumables = [];
let costFixedAssets = [];

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
    let queryFixed = '/costs/fixed?';
    if (userSelVal !== 'all') { queryCons += 'user_id=' + userSelVal + '&'; queryFixed += 'user_id=' + userSelVal + '&'; }
    if (farmSelVal !== 'all') { queryCons += 'farm_id=' + farmSelVal + '&'; queryFixed += 'farm_id=' + farmSelVal + '&'; }

    const [consData, fixedData] = await Promise.all([
      api(queryCons),
      api(queryFixed)
    ]);

    costConsumables = consData || [];
    costFixedAssets = fixedData || [];

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
  renderKpiCards(costConsumables, costFixedAssets);
  renderConsumableTable(costConsumables);
  renderFixedTable(costFixedAssets);
  if (costCurrentTab === 'chart') renderCostChart();
}

async function renderKpiCards(cons, fixed) {
  const totalCons = cons.reduce((s, c) => s + (parseFloat(c.total || c.total_cost) || 0), 0);
  const totalFixed = fixed.reduce((s, a) => s + (parseFloat(a.cost) || 0), 0);
  const grandTotal = totalCons + totalFixed;

  const fmt = n => n.toLocaleString('vi-VN') + ' ₫';
  const kc = document.getElementById('kpi-consumable');
  const kf = document.getElementById('kpi-fixed');
  const kt = document.getElementById('kpi-total');
  const kplant = document.getElementById('kpi-cost-per-plant');
  const karea = document.getElementById('kpi-cost-per-area');

  if (kc) kc.textContent = fmt(totalCons);
  if (kf) kf.textContent = fmt(totalFixed);
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
  const isCons = costCurrentTab === 'consumable';
  const filename = isCons ? 'vat-tu-tieu-hao.csv' : 'tai-san-co-dinh.csv';
  let csvContent = '\uFEFF'; // UTF-8 BOM

  if (isCons) {
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
  } else {
    csvContent += 'Ten tai san,Phan loai,Nam mua,Nguyen gia (VND),Thoi gian dung (nam),Khau hao/nam (VND),Gia tri con lai (VND),Trang trai,Ghi chu\n';
    costFixedAssets.forEach(a => {
      const name = `"${(a.name || '').replace(/"/g, '""')}"`;
      const cat = `"${(a.category || '').replace(/"/g, '""')}"`;
      const yr = a.year || '';
      const cost = a.cost || 0;
      const life = a.life || 5;
      const dep = a.dep_per_year || 0;
      const rem = a.remaining || 0;
      const farm = `"${(a.farm_name || '').replace(/"/g, '""')}"`;
      const note = `"${(a.note || '').replace(/"/g, '""')}"`;
      csvContent += `${name},${cat},${yr},${cost},${life},${dep},${rem},${farm},${note}\n`;
    });
  }

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
  ['consumable', 'fixed', 'chart'].forEach(function(t) {
    const pane = document.getElementById('cost-pane-' + t);
    const btn = document.getElementById('cost-tab-' + t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'chart') setTimeout(renderCostChart, 50);
}

function renderConsumableTable(cons) {
  const tbody = document.getElementById('cost-consumable-table');
  const tfoot = document.getElementById('cost-consumable-footer');
  if (!tbody) return;
  const catColors = { 'Phân bón': '#10b981', 'Thuốc BVTV': '#f59e0b', 'Nhiên liệu': '#ef4444', 'Nước tưới': '#3b82f6', 'Lao động': '#8b5cf6' };
  if (!cons.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fa fa-inbox"></i> Chưa có dữ liệu vật tư tiêu hao thực tế. Nhấp "Thêm vật tư" để nhập mới.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = cons.map(function(c) {
    const col = catColors[c.category] || '#64748b';
    const dateStr = c.date ? new Date(c.date).toISOString().split('T')[0] : '—';
    const qtyVal = parseFloat(c.qty || c.quantity || 0);
    const priceVal = parseFloat(c.price || c.unit_price || 0);
    const totalVal = parseFloat(c.total || c.total_cost || (qtyVal * priceVal));
    return '<tr>' +
      '<td>' + dateStr + '</td>' +
      '<td><span style="background:' + col + '18;color:' + col + ';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + esc(c.category || 'Vật tư') + '</span></td>' +
      '<td style="font-weight:600;">' + esc(c.name || c.supply_name || '—') + '</td>' +
      '<td style="color:#64748b;">' + esc(c.unit || 'đơn vị') + '</td>' +
      '<td>' + qtyVal.toLocaleString('vi-VN') + '</td>' +
      '<td>' + priceVal.toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="font-weight:700;color:#047857;">' + totalVal.toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="font-size:11px;color:#475569;"><i class="fa fa-location-dot" style="color:#10b981;"></i> ' + esc(c.farm_name || '—') + '</td>' +
      '<td style="color:#94a3b8;font-size:11px;">' + esc(c.note || '') + '</td>' +
      '</tr>';
  }).join('');
  const total = cons.reduce(function(s, c) { return s + (parseFloat(c.total || c.total_cost) || 0); }, 0);
  if (tfoot) tfoot.innerHTML = '<tr><td colspan="6" style="text-align:right;padding:10px 12px;color:#047857;font-size:13px;">Tổng thành tiền:</td><td style="padding:10px 12px;color:#047857;font-size:14px;font-weight:700;">' + total.toLocaleString('vi-VN') + ' ₫</td><td colspan="2"></td></tr>';
}

function renderFixedTable(fixed) {
  const tbody = document.getElementById('cost-fixed-table');
  const tfoot = document.getElementById('cost-fixed-footer');
  if (!tbody) return;
  const catIcon = { 'Máy móc thiết bị': 'fa-gears', 'Công trình': 'fa-building', 'Cây giống': 'fa-seedling' };
  if (!fixed.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fa fa-inbox"></i> Chưa có tài sản cố định thực tế. Nhấp "Thêm tài sản" để nhập mới.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = fixed.map(function(a) {
    const costVal = parseFloat(a.cost) || 0;
    const remVal = parseFloat(a.remaining) || 0;
    const pct = costVal > 0 ? Math.max(0, Math.min(100, Math.round(remVal / costVal * 100))) : 0;
    const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444';
    const icon = catIcon[a.category] || 'fa-box';
    return '<tr>' +
      '<td style="font-weight:600;"><i class="fa-solid ' + icon + '" style="color:#3b82f6;margin-right:5px;"></i>' + esc(a.name) + '</td>' +
      '<td><span style="font-size:11px;color:#475569;">' + esc(a.category) + '</span></td>' +
      '<td style="text-align:center;">' + a.year + '</td>' +
      '<td style="font-weight:700;color:#1d4ed8;">' + costVal.toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="text-align:center;">' + a.life + ' năm</td>' +
      '<td style="color:#64748b;">' + (parseFloat(a.dep_per_year) || 0).toLocaleString('vi-VN') + ' ₫</td>' +
      '<td><div style="font-weight:700;color:' + barColor + ';font-size:12px;margin-bottom:3px;">' + remVal.toLocaleString('vi-VN') + ' ₫</div>' +
        '<div style="background:#e2e8f0;border-radius:4px;height:4px;width:80px;"><div style="background:' + barColor + ';height:4px;border-radius:4px;width:' + pct + '%;"></div></div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">' + pct + '% còn lại</div></td>' +
      '<td style="font-size:11px;color:#475569;"><i class="fa fa-location-dot" style="color:#3b82f6;"></i> ' + esc(a.farm_name || '—') + '</td>' +
      '<td style="color:#94a3b8;font-size:11px;">' + esc(a.note || '') + '</td>' +
      '</tr>';
  }).join('');
  const totalCost = fixed.reduce(function(s,a){return s+(parseFloat(a.cost)||0);},0);
  const totalRem = fixed.reduce(function(s,a){return s+(parseFloat(a.remaining)||0);},0);
  if (tfoot) tfoot.innerHTML = '<tr><td colspan="3" style="text-align:right;padding:10px 12px;color:#1d4ed8;font-size:13px;">Tổng nguyên giá:</td><td style="padding:10px 12px;color:#1d4ed8;font-size:14px;font-weight:700;">' + totalCost.toLocaleString('vi-VN') + ' ₫</td><td colspan="2" style="text-align:right;padding:10px 12px;color:#047857;font-size:13px;">Còn lại:</td><td style="padding:10px 12px;color:#047857;font-size:14px;font-weight:700;">' + totalRem.toLocaleString('vi-VN') + ' ₫</td><td colspan="2"></td></tr>';
}

function renderCostChart() {
  const canvas = document.getElementById('cost-line-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const year = parseInt(document.getElementById('cost-chart-year') ? document.getElementById('cost-chart-year').value : new Date().getFullYear());
  const typeFilter = document.getElementById('cost-chart-type') ? document.getElementById('cost-chart-type').value : 'all';
  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const consMonthly = Array(12).fill(0);
  costConsumables.forEach(function(item) {
    if (!item.date) return;
    const d = new Date(item.date);
    if (!isNaN(d) && d.getFullYear() === year) consMonthly[d.getMonth()] += parseFloat(item.total || item.total_cost || 0);
  });
  const fixedMonthly = Array(12).fill(0);
  costFixedAssets.forEach(function(a) {
    if (parseInt(a.year) === year) fixedMonthly[0] += parseFloat(a.cost || 0);
  });
  const datasets = [];
  if (typeFilter === 'all' || typeFilter === 'consumable') {
    datasets.push({ label: 'Vật tư tiêu hao', data: consMonthly, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#10b981', tension: 0.35, fill: true });
  }
  if (typeFilter === 'all' || typeFilter === 'fixed') {
    datasets.push({ label: 'Tài sản cố định', data: fixedMonthly, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#3b82f6', tension: 0.35, fill: true });
  }
  if (costChartInstance) { costChartInstance.destroy(); costChartInstance = null; }
  costChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: months, datasets: datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12, family: 'Inter' }, padding: 16, usePointStyle: true } },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#f1f5f9', bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12,
          callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.raw.toLocaleString('vi-VN') + ' ₫'; } }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 12, family: 'Inter' }, color: '#64748b' } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', callback: function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v; } } }
      }
    }
  });
  const summary = document.getElementById('cost-chart-summary');
  if (summary) {
    const totalCons = consMonthly.reduce(function(s,v){return s+v;},0);
    const totalFixed = fixedMonthly.reduce(function(s,v){return s+v;},0);
    const maxIdx = consMonthly.indexOf(Math.max.apply(null, consMonthly));
    const peak = months[maxIdx] || '—';
    const cards = [
      { label: 'Tổng vật tư', value: totalCons.toLocaleString('vi-VN') + ' ₫', color: '#10b981', icon: 'fa-boxes-stacked' },
      { label: 'Tổng tài sản', value: totalFixed.toLocaleString('vi-VN') + ' ₫', color: '#3b82f6', icon: 'fa-landmark' },
      { label: 'Tháng cao nhất', value: peak, color: '#f59e0b', icon: 'fa-chart-line' },
      { label: 'Tổng năm ' + year, value: (totalCons + totalFixed).toLocaleString('vi-VN') + ' ₫', color: '#8b5cf6', icon: 'fa-coins' }
    ];
    summary.innerHTML = cards.map(function(s) {
      return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px;"><div style="width:36px;height:36px;background:' + s.color + '18;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid ' + s.icon + '" style="color:' + s.color + ';font-size:15px;"></i></div><div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;">' + s.label + '</div><div style="font-size:13px;font-weight:700;color:#0f172a;">' + s.value + '</div></div></div>';
    }).join('');
  }
}

function openCostEntryModal(type) {
  document.getElementById('ce-type').value = type;
  document.getElementById('cost-entry-modal-title').innerHTML = type === 'consumable'
    ? '<i class="fa-solid fa-boxes-stacked" style="color:#10b981;"></i> Thêm vật tư tiêu hao'
    : '<i class="fa-solid fa-landmark" style="color:#3b82f6;"></i> Thêm tài sản cố định';
  document.getElementById('ce-fields-consumable').style.display = type === 'consumable' ? 'block' : 'none';
  document.getElementById('ce-fields-fixed').style.display = type === 'fixed' ? 'block' : 'none';
  document.getElementById('ce-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ce-note').value = '';
  if (type === 'consumable') {
    document.getElementById('ce-name').value = '';
    document.getElementById('ce-qty').value = '';
    document.getElementById('ce-price').value = '';
    document.getElementById('ce-unit').value = '';
  } else {
    if (document.getElementById('ce-fixed-price')) document.getElementById('ce-fixed-price').value = '';
    if (document.getElementById('ce-fixed-life')) document.getElementById('ce-fixed-life').value = '5';
    if (document.getElementById('ce-fixed-year')) document.getElementById('ce-fixed-year').value = new Date().getFullYear();
  }
  document.getElementById('cost-entry-modal').style.display = 'flex';
}

function closeCostEntryModal() {
  document.getElementById('cost-entry-modal').style.display = 'none';
}

async function saveCostEntry() {
  const type = document.getElementById('ce-type').value;
  const farmId = parseInt(document.getElementById('ce-farm').value) || null;
  const note = document.getElementById('ce-note').value.trim();
  const date = document.getElementById('ce-date').value;
  if (!farmId) { toast('Vui lòng chọn trang trại!', 'error'); return; }

  try {
    if (type === 'consumable') {
      const name = document.getElementById('ce-name').value.trim();
      const qty = parseFloat(document.getElementById('ce-qty').value) || 0;
      const price = parseFloat(document.getElementById('ce-price').value) || 0;
      const unit = document.getElementById('ce-unit').value.trim() || 'kg';
      const category = document.getElementById('ce-category').value;
      if (!name) { toast('Vui lòng nhập tên vật tư!', 'error'); return; }
      if (!qty) { toast('Vui lòng nhập số lượng!', 'error'); return; }

      await api('/costs/consumables', {
        method: 'POST',
        body: JSON.stringify({ farm_id: farmId, date, category, name, unit, qty, price, note })
      });
      toast('Đã lưu vật tư tiêu hao vào CSDL PostgreSQL!', 'success');
    } else {
      const fixedCat = document.getElementById('ce-fixed-category').value;
      const fixedYear = parseInt(document.getElementById('ce-fixed-year').value) || new Date().getFullYear();
      const cost = parseFloat(document.getElementById('ce-fixed-price').value) || 0;
      const life = parseInt(document.getElementById('ce-fixed-life').value) || 5;
      const nameEl = document.getElementById('ce-name');
      const entryName = nameEl && nameEl.closest('#ce-fields-consumable') ? '' : (nameEl ? nameEl.value.trim() : '');
      if (!cost) { toast('Vui lòng nhập nguyên giá!', 'error'); return; }

      await api('/costs/fixed', {
        method: 'POST',
        body: JSON.stringify({ farm_id: farmId, name: entryName || fixedCat, category: fixedCat, year: fixedYear, cost, life, note })
      });
      toast('Đã lưu tài sản cố định vào CSDL PostgreSQL!', 'success');
    }

    closeCostEntryModal();
    initCostPage();
  } catch (err) {
    console.error('saveCostEntry error:', err);
    toast('Lỗi lưu chi phí: ' + err.message, 'error');
  }
}
