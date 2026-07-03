/* ════════════════════════════════════════════════════════
   Plant Book Admin — devices.js
   Quản lý thiết bị IoT & Giám sát tại trang trại
   ════════════════════════════════════════════════════════ */

let devicesCache = [];

// Load and render all devices
async function loadDevices() {
  const tbody = document.getElementById('devices-table');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fa fa-spinner fa-spin"></i> Đang tải danh sách...</td></tr>';

  try {
    const devices = await api('/devices');
    devicesCache = devices;
    renderDevices(devices);
    await loadFarmsForDeviceModal();
  } catch (err) {
    toast('Lỗi tải danh sách thiết bị: ' + err.message, 'error');
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa fa-triangle-exclamation"></i> Lỗi: ${err.message}</td></tr>`;
  }
}

// Render device table helper
function renderDevices(devices) {
  const tbody = document.getElementById('devices-table');
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fa fa-microchip"></i> Không tìm thấy thiết bị nào.</td></tr>';
    return;
  }

  tbody.innerHTML = devices.map(d => {
    // Battery icon & class based on level
    let batteryIcon = 'fa-battery-full';
    let batteryColor = '#10b981';
    if (d.battery_level <= 20) {
      batteryIcon = 'fa-battery-empty';
      batteryColor = '#ef4444';
    } else if (d.battery_level <= 50) {
      batteryIcon = 'fa-battery-quarter';
      batteryColor = '#f59e0b';
    } else if (d.battery_level <= 80) {
      batteryIcon = 'fa-battery-three-quarters';
      batteryColor = '#3b82f6';
    }

    // Status Badge
    let statusClass = 'badge-green';
    if (d.status === 'Mất kết nối') statusClass = 'badge-red';
    if (d.status === 'Bảo trì') statusClass = 'badge-amber';

    const lastConn = d.last_connection 
      ? new Date(d.last_connection).toLocaleString('vi-VN') 
      : 'Chưa kết nối';

    return `
      <tr>
        <td><strong>${esc(d.name)}</strong></td>
        <td><span style="font-size: 12px; color: var(--gray-600);"><i class="fa fa-circle-nodes"></i> ${esc(d.device_type)}</span></td>
        <td><span style="font-weight: 500; color: var(--green-dark);"><i class="fa-solid fa-house-chimney"></i> ${esc(d.farm_name || '—')}</span></td>
        <td><code style="background: var(--gray-100); padding: 2px 6px; border-radius: 4px; font-size: 12px;">${esc(d.ip_address || '—')}</code></td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: ${batteryColor};">
            <i class="fa-solid ${batteryIcon}"></i> ${d.battery_level}%
          </span>
        </td>
        <td><span class="badge ${statusClass}">${esc(d.status)}</span></td>
        <td><small style="color: var(--gray-500);">${lastConn}</small></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-xs" onclick="openDeviceModal(${d.id})">
              <i class="fa fa-pen"></i> Sửa
            </button>
            <button class="btn btn-danger btn-xs" onclick="deleteDevice(${d.id})">
              <i class="fa fa-trash"></i> Xóa
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Fetch farms to display in the Farm dropdown on Device Modal
async function loadFarmsForDeviceModal() {
  try {
    const farms = await api('/farms');
    const select = document.getElementById('f-device-farm-id');
    if (select) {
      select.innerHTML = '<option value="">— Không thuộc trang trại nào —</option>' + 
        farms.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading farms for device dropdown:', err);
  }
}

// Open modal for Add or Edit Device
async function openDeviceModal(id = null) {
  const modal = document.getElementById('device-modal');
  const title = document.getElementById('device-modal-title');
  if (!modal) return;

  // Reset form inputs
  document.getElementById('f-device-id').value = '';
  document.getElementById('f-device-name').value = '';
  document.getElementById('f-device-type').value = 'Cảm biến nhiệt độ & độ ẩm';
  document.getElementById('f-device-farm-id').value = '';
  document.getElementById('f-device-ip').value = '';
  document.getElementById('f-device-battery').value = '100';
  document.getElementById('f-device-status').value = 'Hoạt động';

  if (id) {
    title.innerHTML = '<i class="fa-solid fa-microchip" style="color:var(--green)"></i> Cập nhật thiết bị';
    try {
      const dev = await api(`/devices/${id}`);
      document.getElementById('f-device-id').value = dev.id;
      document.getElementById('f-device-name').value = dev.name;
      document.getElementById('f-device-type').value = dev.device_type;
      document.getElementById('f-device-farm-id').value = dev.farm_id || '';
      document.getElementById('f-device-ip').value = dev.ip_address || '';
      document.getElementById('f-device-battery').value = dev.battery_level !== null ? dev.battery_level : 100;
      document.getElementById('f-device-status').value = dev.status;
    } catch (err) {
      toast('Không thể lấy chi tiết thiết bị: ' + err.message, 'error');
      return;
    }
  } else {
    title.innerHTML = '<i class="fa-solid fa-microchip" style="color:var(--green)"></i> Thêm thiết bị mới';
  }

  modal.style.display = 'flex';
}

// Close Modal
function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.style.display = 'none';
}

// Save or Update Device
async function saveDevice() {
  const id = document.getElementById('f-device-id').value;
  const name = document.getElementById('f-device-name').value.trim();
  const device_type = document.getElementById('f-device-type').value;
  const farm_id = document.getElementById('f-device-farm-id').value;
  const ip_address = document.getElementById('f-device-ip').value.trim();
  const battery_level = document.getElementById('f-device-battery').value;
  const status = document.getElementById('f-device-status').value;

  if (!name) {
    toast('Tên thiết bị không được để trống.', 'error');
    return;
  }

  const btn = document.getElementById('device-save-btn');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Đang xử lý...';
  btn.disabled = true;

  const body = {
    name,
    device_type,
    farm_id: farm_id ? parseInt(farm_id) : null,
    ip_address: ip_address || null,
    battery_level: battery_level !== '' ? parseInt(battery_level) : 100,
    status
  };

  try {
    if (id) {
      await api(`/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      toast('Cập nhật thiết bị thành công!');
    } else {
      await api('/devices', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      toast('Thêm thiết bị mới thành công!');
    }
    closeDeviceModal();
    loadDevices();
  } catch (err) {
    toast('Lỗi khi lưu thiết bị: ' + err.message, 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

// Delete device
async function deleteDevice(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa thiết bị này không?')) return;

  try {
    await api(`/devices/${id}`, { method: 'DELETE' });
    toast('Đã xóa thiết bị thành công.');
    loadDevices();
  } catch (err) {
    toast('Lỗi khi xóa thiết bị: ' + err.message, 'error');
  }
}

// Filter devices locally
function filterDevices() {
  const searchVal = document.getElementById('device-search').value.trim().toLowerCase();
  const typeVal = document.getElementById('device-filter-type').value;
  const statusVal = document.getElementById('device-filter-status').value;

  const filtered = devicesCache.filter(d => {
    const matchesSearch = !searchVal || 
      d.name.toLowerCase().includes(searchVal) || 
      (d.ip_address && d.ip_address.toLowerCase().includes(searchVal));
    
    const matchesType = typeVal === 'all' || d.device_type === typeVal;
    const matchesStatus = statusVal === 'all' || d.status === statusVal;

    return matchesSearch && matchesType && matchesStatus;
  });

  renderDevices(filtered);
}
