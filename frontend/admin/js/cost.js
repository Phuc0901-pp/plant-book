/* ════════════════════════════════════════════════════════
   Plant Book Admin — cost.js
   Quản trị Chi phí Đầu tư
   ════════════════════════════════════════════════════════ */

let costChartInstance = null;
let costCurrentTab = 'consumable';
let costConsumables = [];
let costFixedAssets = [];

function seedCostDemoData(farms) {
  if (costConsumables.length > 0) return;
  const farmIds = farms.map(f => f.id);
  const farmName = id => { const f = farms.find(x => x.id === id); return f ? f.name : 'N/A'; };
  const types = ['Phân bón', 'Thuốc BVTV', 'Nhiên liệu', 'Nước tưới', 'Lao động'];
  const names = {
    'Phân bón': ['Ure 46%', 'DAP', 'NPK 16-16-8', 'Kali Đỏ'],
    'Thuốc BVTV': ['Anvil 5SC', 'Regent 800WG', 'Map Permethrin'],
    'Nhiên liệu': ['Dầu diesel', 'Xăng A95'],
    'Nước tưới': ['Nước tưới nhỏ giọt'],
    'Lao động': ['Công thu hái', 'Công làm cỏ']
  };
  const units = { 'Phân bón': 'kg', 'Thuốc BVTV': 'lít', 'Nhiên liệu': 'lít', 'Nước tưới': 'm³', 'Lao động': 'công' };
  if (!farmIds.length) return;
  for (let i = 1; i <= 24; i++) {
    const type = types[i % types.length];
    const nameList = names[type];
    const qty = Math.round((Math.random() * 50 + 5) * 10) / 10;
    const price = Math.round((Math.random() * 200000 + 10000) / 1000) * 1000;
    const farmId = farmIds[i % farmIds.length];
    const month = String((i % 12) + 1).padStart(2, '0');
    const year = i < 12 ? '2026' : '2025';
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    costConsumables.push({
      id: i, date: year + '-' + month + '-' + day,
      category: type, name: nameList[i % nameList.length],
      unit: units[type], qty, price,
      total: Math.round(qty * price),
      farm_id: farmId, farm_name: farmName(farmId),
      user_id: null, note: ''
    });
  }
  const fixedCats = ['Máy móc thiết bị', 'Công trình', 'Cây giống'];
  const fixedNames = {
    'Máy móc thiết bị': ['Máy cắt cỏ Honda', 'Bơm nước Pentax', 'Máy phun thuốc'],
    'Công trình': ['Nhà kho vật tư', 'Hệ thống tưới nhỏ giọt'],
    'Cây giống': ['Cây giống ban đầu (100 cây)']
  };
  for (let i = 1; i <= 10; i++) {
    const cat = fixedCats[i % fixedCats.length];
    const nameList = fixedNames[cat];
    const cost = Math.round((Math.random() * 50000000 + 5000000) / 1000000) * 1000000;
    const life = [3, 5, 7, 10][i % 4];
    const yr = 2022 + (i % 4);
    const farmId = farmIds[i % farmIds.length];
    const dep = Math.round(cost / life);
    const remaining = Math.max(0, cost - dep * (2026 - yr));
    costFixedAssets.push({
      id: i, name: nameList[i % nameList.length],
      category: cat, year: yr, cost, life,
      dep_per_year: dep, remaining,
      farm_id: farmId, farm_name: farmName(farmId),
      user_id: null, note: ''
    });
  }
}

async function initCostPage() {
  try {
    const [farms, users] = await Promise.all([api('/farms'), api('/users')]);
    const userSel = document.getElementById('cost-filter-user');
    const farmSel = document.getElementById('cost-filter-farm');
    if (userSel) userSel.innerHTML = '<option value="all">Tất cả khách hàng</option>' +
      users.map(u => '<option value="' + u.id + '">' + esc(u.full_name) + '</option>').join('');
    if (farmSel) farmSel.innerHTML = '<option value="all">Tất cả trang trại</option>' +
      farms.map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('');
    const ceFarm = document.getElementById('ce-farm');
    if (ceFarm) ceFarm.innerHTML = '<option value="">— Chọn trang trại —</option>' +
      farms.map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('');
    seedCostDemoData(farms);
    costConsumables.forEach(c => {
      const farm = farms.find(f => f.id === c.farm_id);
      if (farm) c.user_id = farm.user_id;
    });
    costFixedAssets.forEach(a => {
      const farm = farms.find(f => f.id === a.farm_id);
      if (farm) a.user_id = farm.user_id;
    });
    renderCostPage();
  } catch (err) {
    toast('Lỗi tải dữ liệu Chi phí: ' + err.message, 'error');
  }
}

function costFilterChange() { renderCostPage(); }

function getFilteredData() {
  const userId = document.getElementById('cost-filter-user') ? document.getElementById('cost-filter-user').value : 'all';
  const farmId = document.getElementById('cost-filter-farm') ? document.getElementById('cost-filter-farm').value : 'all';
  let cons = costConsumables;
  let fixed = costFixedAssets;
  if (userId !== 'all') {
    cons = cons.filter(c => String(c.user_id) === String(userId));
    fixed = fixed.filter(a => String(a.user_id) === String(userId));
  }
  if (farmId !== 'all') {
    cons = cons.filter(c => String(c.farm_id) === String(farmId));
    fixed = fixed.filter(a => String(a.farm_id) === String(farmId));
  }
  return { cons, fixed };
}

function renderCostPage() {
  const { cons, fixed } = getFilteredData();
  renderKpiCards(cons, fixed);
  renderConsumableTable(cons);
  renderFixedTable(fixed);
  if (costCurrentTab === 'chart') renderCostChart();
}

function renderKpiCards(cons, fixed) {
  const totalCons = cons.reduce((s, c) => s + (c.total || 0), 0);
  const totalFixed = fixed.reduce((s, a) => s + (a.cost || 0), 0);
  const fmt = n => n.toLocaleString('vi-VN') + ' ₫';
  const kc = document.getElementById('kpi-consumable');
  const kf = document.getElementById('kpi-fixed');
  const kt = document.getElementById('kpi-total');
  if (kc) kc.textContent = fmt(totalCons);
  if (kf) kf.textContent = fmt(totalFixed);
  if (kt) kt.textContent = fmt(totalCons + totalFixed);
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
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fa fa-inbox"></i> Chưa có dữ liệu vật tư tiêu hao.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = cons.map(function(c) {
    const col = catColors[c.category] || '#64748b';
    return '<tr>' +
      '<td>' + (c.date || '—') + '</td>' +
      '<td><span style="background:' + col + '18;color:' + col + ';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + esc(c.category) + '</span></td>' +
      '<td style="font-weight:600;">' + esc(c.name) + '</td>' +
      '<td style="color:#64748b;">' + esc(c.unit) + '</td>' +
      '<td>' + c.qty.toLocaleString('vi-VN') + '</td>' +
      '<td>' + (c.price || 0).toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="font-weight:700;color:#047857;">' + (c.total || 0).toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="font-size:11px;color:#475569;"><i class="fa fa-location-dot" style="color:#10b981;"></i> ' + esc(c.farm_name) + '</td>' +
      '<td style="color:#94a3b8;font-size:11px;">' + esc(c.note || '') + '</td>' +
      '</tr>';
  }).join('');
  const total = cons.reduce(function(s, c) { return s + (c.total || 0); }, 0);
  if (tfoot) tfoot.innerHTML = '<tr><td colspan="6" style="text-align:right;padding:10px 12px;color:#047857;font-size:13px;">Tổng thành tiền:</td><td style="padding:10px 12px;color:#047857;font-size:14px;font-weight:700;">' + total.toLocaleString('vi-VN') + ' ₫</td><td colspan="2"></td></tr>';
}

function renderFixedTable(fixed) {
  const tbody = document.getElementById('cost-fixed-table');
  const tfoot = document.getElementById('cost-fixed-footer');
  if (!tbody) return;
  const catIcon = { 'Máy móc thiết bị': 'fa-gears', 'Công trình': 'fa-building', 'Cây giống': 'fa-seedling' };
  if (!fixed.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fa fa-inbox"></i> Chưa có tài sản cố định nào.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = fixed.map(function(a) {
    const pct = a.cost > 0 ? Math.max(0, Math.min(100, Math.round(a.remaining / a.cost * 100))) : 0;
    const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444';
    const icon = catIcon[a.category] || 'fa-box';
    return '<tr>' +
      '<td style="font-weight:600;"><i class="fa-solid ' + icon + '" style="color:#3b82f6;margin-right:5px;"></i>' + esc(a.name) + '</td>' +
      '<td><span style="font-size:11px;color:#475569;">' + esc(a.category) + '</span></td>' +
      '<td style="text-align:center;">' + a.year + '</td>' +
      '<td style="font-weight:700;color:#1d4ed8;">' + (a.cost || 0).toLocaleString('vi-VN') + ' ₫</td>' +
      '<td style="text-align:center;">' + a.life + ' năm</td>' +
      '<td style="color:#64748b;">' + (a.dep_per_year || 0).toLocaleString('vi-VN') + ' ₫</td>' +
      '<td><div style="font-weight:700;color:' + barColor + ';font-size:12px;margin-bottom:3px;">' + (a.remaining || 0).toLocaleString('vi-VN') + ' ₫</div>' +
        '<div style="background:#e2e8f0;border-radius:4px;height:4px;width:80px;"><div style="background:' + barColor + ';height:4px;border-radius:4px;width:' + pct + '%;"></div></div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">' + pct + '% còn lại</div></td>' +
      '<td style="font-size:11px;color:#475569;"><i class="fa fa-location-dot" style="color:#3b82f6;"></i> ' + esc(a.farm_name) + '</td>' +
      '<td style="color:#94a3b8;font-size:11px;">' + esc(a.note || '') + '</td>' +
      '</tr>';
  }).join('');
  const totalCost = fixed.reduce(function(s,a){return s+(a.cost||0);},0);
  const totalRem = fixed.reduce(function(s,a){return s+(a.remaining||0);},0);
  if (tfoot) tfoot.innerHTML = '<tr><td colspan="3" style="text-align:right;padding:10px 12px;color:#1d4ed8;font-size:13px;">Tổng nguyên giá:</td><td style="padding:10px 12px;color:#1d4ed8;font-size:14px;font-weight:700;">' + totalCost.toLocaleString('vi-VN') + ' ₫</td><td colspan="2" style="text-align:right;padding:10px 12px;color:#047857;font-size:13px;">Còn lại:</td><td style="padding:10px 12px;color:#047857;font-size:14px;font-weight:700;">' + totalRem.toLocaleString('vi-VN') + ' ₫</td><td colspan="2"></td></tr>';
}

function renderCostChart() {
  const canvas = document.getElementById('cost-line-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const year = parseInt(document.getElementById('cost-chart-year') ? document.getElementById('cost-chart-year').value : 2026);
  const typeFilter = document.getElementById('cost-chart-type') ? document.getElementById('cost-chart-type').value : 'all';
  const data = getFilteredData();
  const cons = data.cons;
  const fixed = data.fixed;
  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const consMonthly = Array(12).fill(0);
  cons.forEach(function(item) {
    const d = new Date(item.date);
    if (!isNaN(d) && d.getFullYear() === year) consMonthly[d.getMonth()] += item.total || 0;
  });
  const fixedMonthly = Array(12).fill(0);
  fixed.forEach(function(a) { if (a.year === year) fixedMonthly[0] += a.cost || 0; });
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

function saveCostEntry() {
  const type = document.getElementById('ce-type').value;
  const farmId = parseInt(document.getElementById('ce-farm').value) || null;
  const note = document.getElementById('ce-note').value.trim();
  const date = document.getElementById('ce-date').value;
  if (!farmId) { toast('Vui lòng chọn trang trại!', 'error'); return; }
  const farmSel = document.getElementById('ce-farm');
  const farmName = farmSel.options[farmSel.selectedIndex] ? farmSel.options[farmSel.selectedIndex].text : '—';
  if (type === 'consumable') {
    const name = document.getElementById('ce-name').value.trim();
    const qty = parseFloat(document.getElementById('ce-qty').value) || 0;
    const price = parseFloat(document.getElementById('ce-price').value) || 0;
    const unit = document.getElementById('ce-unit').value.trim();
    const category = document.getElementById('ce-category').value;
    if (!name) { toast('Vui lòng nhập tên vật tư!', 'error'); return; }
    costConsumables.push({ id: Date.now(), date, category, name, unit, qty, price, total: Math.round(qty * price), farm_id: farmId, farm_name: farmName, note });
    toast('Đã thêm vật tư tiêu hao!', 'success');
  } else {
    const fixedCat = document.getElementById('ce-fixed-category').value;
    const fixedYear = parseInt(document.getElementById('ce-fixed-year').value) || new Date().getFullYear();
    const cost = parseFloat(document.getElementById('ce-fixed-price').value) || 0;
    const life = parseInt(document.getElementById('ce-fixed-life').value) || 5;
    const nameEl = document.getElementById('ce-name');
    const entryName = nameEl && nameEl.closest('#ce-fields-consumable') ? '' : (nameEl ? nameEl.value.trim() : '');
    if (!cost) { toast('Vui lòng nhập nguyên giá!', 'error'); return; }
    const dep = Math.round(cost / life);
    const remaining = Math.max(0, cost - dep * (new Date().getFullYear() - fixedYear));
    costFixedAssets.push({ id: Date.now(), name: entryName || fixedCat, category: fixedCat, year: fixedYear, cost, life, dep_per_year: dep, remaining, farm_id: farmId, farm_name: farmName, note });
    toast('Đã thêm tài sản cố định!', 'success');
  }
  closeCostEntryModal();
  renderCostPage();
}
