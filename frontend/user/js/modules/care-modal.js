/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/care-modal.js — Care log modal: open, close, form fields, save
   ═══════════════════════════════════════════════════════════════ */

import { api, token, API }      from '../core/api.js';
import { toast, esc }           from '../core/utils.js';
import { selectedCareFiles, clearSelectedFiles, watermarkImage } from './media.js';
import { getLogsCache }         from './logs.js';

// ── Truy cập config/plants qua window để tránh circular import ──
function _configs()  { return window._allConfigsCache || {}; }
function _plants()   { return window._allPlantsCache  || []; }

// ── Open / Close ──────────────────────────────────────────────

/**
 * Mở modal nhật ký chăm sóc.
 * - Nếu plantId được cung cấp → khoá vào 1 cây cụ thể
 * - Nếu plantId = null (FAB) → hiển thị dropdown chọn cây
 * - Nếu logId được cung cấp → chuyển sang chế độ CHỈNH SỬA nhật ký
 *
 * @param {number|null} plantId
 * @param {string|null} treeCode
 * @param {string|null} plantType
 * @param {number|null} logId
 */
export function openCareModal(plantId, treeCode, plantType, logId = null) {
  clearSelectedFiles();

  const noteEl      = document.getElementById('c-note');
  const logTypeEl   = document.getElementById('c-log-type');
  const dateEl      = document.getElementById('c-log-date');
  const titleEl     = document.getElementById('care-modal-title');
  const saveTextEl  = document.getElementById('care-save-text');
  const displayEl   = document.getElementById('c-plant-display');
  const selectEl    = document.getElementById('c-plant-id-select');
  const idEl        = document.getElementById('c-plant-id');

  if (logId) {
    // ── CHẾ ĐỘ CHỈNH SỬA (EDIT MODE) ──
    const log = getLogsCache().find(l => l.id === logId);
    if (!log) {
      toast('Không tìm thấy dữ liệu nhật ký này trong bộ nhớ.', 'error');
      return;
    }

    window._activeEditLogId = logId;
    window._existingMediaUrls = log.media_urls || [];
    window._activePlantTreeCode = treeCode || log.tree_code || plantId;

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--green)"></i> Chỉnh sửa nhật ký`;
    if (saveTextEl) saveTextEl.innerHTML = `<i class="fa fa-floppy-disk"></i> Cập nhật nhật ký`;

    if (idEl) idEl.value = plantId || log.plant_id;
    if (displayEl) {
      displayEl.value = `Cây ${treeCode || log.tree_code || plantId} - ${plantType || log.plant_type}`;
      displayEl.style.display = 'block';
    }
    if (selectEl) selectEl.style.display = 'none';

    if (dateEl) dateEl.value = log.log_date ? new Date(log.log_date).toISOString().slice(0, 10) : '';
    if (logTypeEl) {
      logTypeEl.value = log.log_type;
      logTypeEl.disabled = true; // Khóa loại hoạt động để bảo toàn schema details
    }

    // Loại bỏ phần thông tin thời gian chỉnh sửa cũ trong ghi chú để điền vào textarea
    if (noteEl) {
      noteEl.value = (log.note || '').replace(/\n\(Chỉnh sửa lúc: .*\)/g, '').trim();
    }

    // Render form fields
    onCareLogTypeChange();

    // Điền dữ liệu chi tiết của log cũ vào form sau khi render xong
    setTimeout(() => {
      _populateDetailFields(log);
    }, 50);

  } else {
    // ── CHẾ ĐỘ GHI MỚI (CREATE MODE) ──
    window._activeEditLogId = null;
    window._existingMediaUrls = [];

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-file-signature" style="color:var(--green)"></i> Ghi nhật ký chăm sóc`;
    if (saveTextEl) saveTextEl.innerHTML = `<i class="fa fa-floppy-disk"></i> Lưu nhật ký`;

    if (noteEl) noteEl.value = '';
    if (logTypeEl) {
      logTypeEl.value = 'Tưới nước';
      logTypeEl.disabled = false;
    }
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

    if (plantId) {
      window._activePlantTreeCode = treeCode;
      if (idEl) idEl.value = plantId;
      if (displayEl) { displayEl.value = `Cây ${treeCode} - ${plantType}`; displayEl.style.display = 'block'; }
      if (selectEl) selectEl.style.display = 'none';
    } else {
      window._activePlantTreeCode = '';
      if (idEl) idEl.value = '';
      if (displayEl) displayEl.style.display = 'none';
      if (selectEl) {
        selectEl.innerHTML = _plants().map(p =>
          `<option value="${p.id}" data-code="${esc(p.tree_code || p.id)}">Cây ${esc(p.tree_code || p.id)} - ${esc(p.plant_type)}</option>`
        ).join('');
        selectEl.style.display = 'block';
      }
    }

    onCareLogTypeChange();
  }

  const modal = document.getElementById('care-modal');
  if (modal) modal.style.display = 'flex';
}

/**
 * Đóng modal nhật ký chăm sóc.
 */
export function closeCareModal() {
  const modal = document.getElementById('care-modal');
  if (modal) modal.style.display = 'none';
}

// ── Dynamic Form Fields ───────────────────────────────────────

/**
 * Cập nhật các trường form trong modal khi người dùng thay đổi loại hoạt động.
 */
export async function onCareLogTypeChange() {
  const logType   = document.getElementById('c-log-type')?.value;
  const container = document.getElementById('care-detail-fields');
  if (!container || !logType) return;

  // Load supplies if not loaded
  if (!window._declaredSuppliesCache) {
    try {
      window._declaredSuppliesCache = await api('/supplies');
    } catch (_) {
      window._declaredSuppliesCache = [];
    }
  }

  const configs = _configs();
  const supplies = window._declaredSuppliesCache || [];
  container.innerHTML = _buildDetailFields(logType, configs, supplies);
}

export function onCareSupplySelected(selectEl, hiddenInputId) {
  if (!selectEl) return;
  const opt = selectEl.options[selectEl.selectedIndex];
  if (opt && hiddenInputId) {
    const hiddenInput = document.getElementById(hiddenInputId);
    if (hiddenInput) hiddenInput.value = opt.getAttribute('data-name') || opt.text;
  }
}
window.onCareSupplySelected = onCareSupplySelected;

function _formatSupplyOptionText(s) {
  const pkgQty = parseFloat(s.package_qty) || 1;
  const pkgPrice = parseFloat(s.package_price) || 0;
  let unitPrice = parseFloat(s.unit_price) || 0;

  if (pkgPrice > 0 && pkgQty > 1 && unitPrice >= pkgPrice) {
    unitPrice = pkgPrice / pkgQty;
  }

  const pkgUnit = s.package_unit || s.unit || '';
  const pkgText = s.package_size
    ? (s.package_size.toLowerCase().includes(pkgUnit.toLowerCase()) ? s.package_size : `${s.package_size} ${pkgUnit}`)
    : `${pkgQty} ${pkgUnit}`;

  const formattedPrice = new Intl.NumberFormat('vi-VN').format(Math.round(unitPrice)) + ' VNĐ';
  return `${esc(s.name)} (${pkgText}) — ${formattedPrice} / ${s.unit}`;
}

/**
 * Trả về HTML form fields theo loại hoạt động.
 * @private
 */
function _buildDetailFields(logType, configs, supplies = []) {
  switch (logType) {
    case 'Tưới nước': {
      const methods = configs.water_methods || [];
      const waterSupplies = supplies.filter(s => s.category === 'Tiền nước');
      return `
        <div class="field">
          <label>Phương pháp tưới nước *</label>
          <select id="c-detail-method">${methods.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        </div>
        ${waterSupplies.length > 0 ? `
          <div class="field">
            <label><i class="fa-solid fa-droplet" style="color:var(--green)"></i> Nguồn nước / Tiền nước (Từ Kho vật tư)</label>
            <select id="c-detail-supply-id">
              <option value="">Không hạch toán tiền nước</option>
              ${waterSupplies.map(s => `<option value="${s.id}">💧 ${_formatSupplyOptionText(s)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div class="field">
          <label>Lượng nước (Lít) *</label>
          <input type="number" step="any" id="c-detail-amount" value="2">
        </div>`;
    }
    case 'Bón phân': {
      const fertilizers = configs.fertilizers || [];
      const declaredFertilizers = supplies.filter(s => s.category === 'Bón phân');

      if (declaredFertilizers.length > 0) {
        return `
          <div class="field">
            <label><i class="fa-solid fa-link" style="color:var(--green)"></i> Chọn loại Phân bón (Từ Kho Vật tư) *</label>
            <select id="c-detail-supply-id" onchange="onCareSupplySelected(this, 'c-detail-fertilizer')">
              ${declaredFertilizers.map(s => `
                <option value="${s.id}" data-name="${esc(s.name)}">
                  🧪 ${_formatSupplyOptionText(s)}
                </option>
              `).join('')}
            </select>
            <input type="hidden" id="c-detail-fertilizer" value="${esc(declaredFertilizers[0].name)}">
            <small style="color:var(--green-dark); font-weight:600; margin-top:4px; display:block;">
              <i class="fa-solid fa-circle-check"></i> Đã liên kết với Kho vật tư (Tự động hạch toán chi phí)
            </small>
          </div>
          <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
            <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="100"></div>
            <div class="field" style="flex:1;"><label>Đơn vị</label>
              <select id="c-detail-unit"><option value="gam">gam</option><option value="kg">kg</option><option value="ml">ml</option><option value="lít">lít</option></select>
            </div>
          </div>`;
      } else {
        return `
          <div class="field">
            <label>Loại phân bón *</label>
            <select id="c-detail-fertilizer">${fertilizers.map(f => `<option>${esc(f)}</option>`).join('')}</select>
            <small style="color:var(--text-muted); margin-top:4px; display:block;">
              <a href="#" onclick="closeCareModal(); showPage('supplies'); openSupplyModal(); return false;" style="color:#2563eb; font-weight:600;">
                <i class="fa-solid fa-plus"></i> Khai báo loại phân này vào Kho Vật tư để tự động tính tiền
              </a>
            </small>
          </div>
          <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
            <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="100"></div>
            <div class="field" style="flex:1;"><label>Đơn vị</label>
              <select id="c-detail-unit"><option value="gam">gam</option><option value="kg">kg</option><option value="ml">ml</option><option value="lít">lít</option></select>
            </div>
          </div>`;
      }
    }
    case 'Phun thuốc': {
      const pesticides = configs.pesticides || [];
      const declaredPesticides = supplies.filter(s => s.category === 'Phun thuốc');

      if (declaredPesticides.length > 0) {
        return `
          <div class="field">
            <label><i class="fa-solid fa-link" style="color:var(--green)"></i> Chọn Thuốc BVTV (Từ Kho Vật tư) *</label>
            <select id="c-detail-supply-id" onchange="onCareSupplySelected(this, 'c-detail-pesticide')">
              ${declaredPesticides.map(s => `
                <option value="${s.id}" data-name="${esc(s.name)}">
                  🛡️ ${_formatSupplyOptionText(s)}
                </option>
              `).join('')}
            </select>
            <input type="hidden" id="c-detail-pesticide" value="${esc(declaredPesticides[0].name)}">
            <small style="color:var(--green-dark); font-weight:600; margin-top:4px; display:block;">
              <i class="fa-solid fa-circle-check"></i> Đã liên kết với Kho vật tư (Tự động hạch toán chi phí)
            </small>
          </div>
          <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
            <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="50"></div>
            <div class="field" style="flex:1;"><label>Đơn vị</label>
              <select id="c-detail-unit"><option value="ml">ml</option><option value="gam">gam</option><option value="lít">lít</option></select>
            </div>
          </div>`;
      } else {
        return `
          <div class="field">
            <label>Loại thuốc bảo vệ thực vật *</label>
            <select id="c-detail-pesticide">${pesticides.map(p => `<option>${esc(p)}</option>`).join('')}</select>
            <small style="color:var(--text-muted); margin-top:4px; display:block;">
              <a href="#" onclick="closeCareModal(); showPage('supplies'); openSupplyModal(); return false;" style="color:#2563eb; font-weight:600;">
                <i class="fa-solid fa-plus"></i> Khai báo loại thuốc này vào Kho Vật tư để tự động tính tiền
              </a>
            </small>
          </div>
          <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
            <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="50"></div>
            <div class="field" style="flex:1;"><label>Đơn vị</label>
              <select id="c-detail-unit"><option value="ml">ml</option><option value="gam">gam</option><option value="lít">lít</option></select>
            </div>
          </div>`;
      }
    }
    case 'Cắt lá': {
      const reasons = configs.leaf_cut_reasons || [];
      return `
        <div class="field"><label>Lý do cắt tỉa *</label><select id="c-detail-reason">${reasons.map(r => `<option>${esc(r)}</option>`).join('')}</select></div>
        <div class="field"><label>Số lượng cành/lá đã cắt</label><input type="number" id="c-detail-amount" value="5" min="1"></div>`;
    }
    case 'Tỉa hoa': {
      const reasons = configs.flower_prune_reasons || [];
      return `
        <div class="field"><label>Lý do tỉa hoa/quả *</label><select id="c-detail-reason">${reasons.map(r => `<option>${esc(r)}</option>`).join('')}</select></div>
        <div class="field"><label>Số lượng hoa/quả đã tỉa</label><input type="number" id="c-detail-amount" value="3" min="1"></div>`;
    }
    case 'Bệnh cây':
      return `
        <div class="field"><label>Tên bệnh / Triệu chứng *</label><input type="text" id="c-detail-disease-name" placeholder="Ví dụ: Vàng lá thối rễ, Sâu đục thân..."></div>
        <div class="field"><label>Mức độ nghiêm trọng *</label>
          <select id="c-detail-severity">
            <option value="Nhẹ">Nhẹ</option>
            <option value="Trung bình" selected>Trung bình</option>
            <option value="Nghiêm trọng">Nghiêm trọng</option>
          </select>
        </div>
        <div class="field"><label>Mô tả dấu hiệu / Triệu chứng</label><textarea id="c-detail-description" rows="2" placeholder="Nhập thêm chi tiết quan sát được..."></textarea></div>
        <div class="field">
          <label>Hình ảnh / Video thực tế (Tự động đóng dấu ảnh) *</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input type="file" id="c-detail-media-capture" accept="image/*,video/*" capture="environment" multiple style="display:none;" onchange="onCareMediaSelected('capture')">
            <input type="file" id="c-detail-media-library" accept="image/*,video/*" multiple style="display:none;" onchange="onCareMediaSelected('library')">
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('c-detail-media-capture').click()" style="flex:1;justify-content:center;gap:6px;padding:10px;display:inline-flex;align-items:center;">
                <i class="fa-solid fa-camera"></i> Chụp hình
              </button>
              <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('c-detail-media-library').click()" style="flex:1;justify-content:center;gap:6px;padding:10px;background:#fff;display:inline-flex;align-items:center;">
                <i class="fa-solid fa-images"></i> Thư viện
              </button>
            </div>
            <div id="c-media-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;"></div>
          </div>
        </div>`;
    default:
      return '';
  }
}

// ── Điền giá trị chi tiết khi sửa đổi ─────────────────────────────
function _populateDetailFields(log) {
  const t = log.log_type;
  const d = log.details || {};
  if (t === 'Tưới nước') {
    _setVal('c-detail-method', d.method);
    _setVal('c-detail-amount', d.amount);
  } else if (t === 'Bón phân') {
    _setVal('c-detail-fertilizer', d.fertilizer_name);
    _setVal('c-detail-amount',     d.amount);
    _setVal('c-detail-unit',       d.unit);
  } else if (t === 'Phun thuốc') {
    _setVal('c-detail-pesticide',  d.pesticide_name);
    _setVal('c-detail-amount',     d.amount);
    _setVal('c-detail-unit',       d.unit);
  } else if (t === 'Cắt lá' || t === 'Tỉa hoa') {
    _setVal('c-detail-reason',     d.reason);
    _setVal('c-detail-amount',     d.amount);
  } else if (t === 'Bệnh cây') {
    _setVal('c-detail-disease-name', d.disease_name);
    _setVal('c-detail-severity',     d.severity);
    _setVal('c-detail-description',  d.description);
    renderMediaPreviews();
  }
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val;
}

function _buildDetailsString(logType, details) {
  const parts = [];
  const d = details || {};
  if (logType === 'Tưới nước') {
    if (d.method) parts.push(`Cách: ${d.method}`);
    if (d.amount) parts.push(`Lượng: ${d.amount} lít`);
  } else if (logType === 'Bón phân') {
    if (d.fertilizer_name) parts.push(`Phân: ${d.fertilizer_name}`);
    if (d.amount) parts.push(`Lượng: ${d.amount} ${d.unit || ''}`);
  } else if (logType === 'Phun thuốc') {
    if (d.pesticide_name) parts.push(`Thuốc: ${d.pesticide_name}`);
    if (d.amount) parts.push(`Lượng: ${d.amount} ${d.unit || ''}`);
  } else if (logType === 'Cắt lá') {
    if (d.reason) parts.push(`Lý do: ${d.reason}`);
    if (d.amount) parts.push(`Lượng: ${d.amount}`);
  } else if (logType === 'Tỉa hoa') {
    if (d.reason) parts.push(`Lý do: ${d.reason}`);
    if (d.amount) parts.push(`Lượng: ${d.amount}`);
  } else if (logType === 'Bệnh cây') {
    if (d.disease_name) parts.push(`Bệnh: ${d.disease_name}`);
    if (d.severity) parts.push(`Mức độ: ${d.severity}`);
  }
  return parts.join(', ');
}

// ── Preview & Xóa Media ─────────────────────────────────────────

export function renderMediaPreviews() {
  const preview = document.getElementById('c-media-preview');
  if (!preview) return;
  preview.innerHTML = '';

  // 1. Ảnh hiện tại (Đã lưu)
  const existing = window._existingMediaUrls || [];
  existing.forEach((item, index) => {
    const div = Object.assign(document.createElement('div'), {});
    Object.assign(div.style, {
      position: 'relative', width: '64px', height: '64px',
      borderRadius: '8px', overflow: 'hidden',
      border: '1px solid var(--gray-200)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    });
    div.innerHTML = `
      <img src="${item.url}" style="width:100%;height:100%;object-fit:cover;">
      <button type="button" onclick="window.removeExistingPhoto(${index})" style="position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.85); color:#fff; border:none; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:9px;">
        <i class="fa-solid fa-xmark"></i>
      </button>`;
    preview.appendChild(div);
  });

  // 2. Ảnh mới (Đang chờ upload)
  selectedCareFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = Object.assign(document.createElement('div'), {});
      Object.assign(div.style, {
        position: 'relative', width: '64px', height: '64px',
        borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--gray-200)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      });

      if (file.type.startsWith('image/')) {
        div.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        div.innerHTML = `
          <div style="width:100%;height:100%;background:var(--gray-100);display:flex;align-items:center;justify-content:center;">
            <i class="fa-solid fa-video" style="color:var(--text-muted)"></i>
          </div>`;
      }
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

export function removeExistingPhoto(index) {
  if (window._existingMediaUrls) {
    window._existingMediaUrls.splice(index, 1);
    renderMediaPreviews();
  }
}

window.renderMediaPreviews = renderMediaPreviews;
window.removeExistingPhoto = removeExistingPhoto;

// ── Save ──────────────────────────────────────────────────────

/**
 * Xác thực, xử lý media, và lưu nhật ký chăm sóc lên API.
 */
export async function saveCareLog() {
  const selectEl = document.getElementById('c-plant-id-select');
  const plantId  = selectEl?.style.display === 'block'
    ? selectEl.value
    : document.getElementById('c-plant-id')?.value;

  if (!plantId) { toast('Vui lòng chọn một cây trồng!', 'error'); return; }

  if (selectEl?.style.display === 'block') {
    const opt = selectEl.options[selectEl.selectedIndex];
    window._activePlantTreeCode = opt?.getAttribute('data-code') || plantId;
  }

  const logType = document.getElementById('c-log-type')?.value;
  const note    = document.getElementById('c-note')?.value.trim() || '';
  const logDate = document.getElementById('c-log-date')?.value || new Date().toISOString().slice(0, 10);

  const body = { log_type: logType, log_date: logDate, note, media_urls: [], details: {} };

  const btn     = document.getElementById('care-save-btn');
  const oldText = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Đang lưu...'; }

  try {
    // ── Thu thập details theo loại ──────────────────────────
    if (logType === 'Tưới nước') {
      const amount = parseFloat(document.getElementById('c-detail-amount')?.value);
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập lượng nước hợp lệ!');
      body.details = { method: document.getElementById('c-detail-method')?.value, amount, unit: 'lít' };

    } else if (logType === 'Bón phân') {
      const amount = parseFloat(document.getElementById('c-detail-amount')?.value);
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập liều lượng hợp lệ!');
      body.details = { fertilizer_name: document.getElementById('c-detail-fertilizer')?.value, amount, unit: document.getElementById('c-detail-unit')?.value };

    } else if (logType === 'Phun thuốc') {
      const amount = parseFloat(document.getElementById('c-detail-amount')?.value);
      if (isNaN(amount) || amount <= 0) throw new Error('Vui lòng nhập liều lượng hợp lệ!');
      body.details = { pesticide_name: document.getElementById('c-detail-pesticide')?.value, amount, unit: document.getElementById('c-detail-unit')?.value };

    } else if (logType === 'Cắt lá') {
      body.details = { reason: document.getElementById('c-detail-reason')?.value, amount: parseInt(document.getElementById('c-detail-amount')?.value) || 0 };

    } else if (logType === 'Tỉa hoa') {
      body.details = { reason: document.getElementById('c-detail-reason')?.value, amount: parseInt(document.getElementById('c-detail-amount')?.value) || 0 };

    } else if (logType === 'Bệnh cây') {
      const disease_name = document.getElementById('c-detail-disease-name')?.value.trim();
      if (!disease_name) throw new Error('Vui lòng nhập tên bệnh hoặc triệu chứng!');
      body.details = {
        disease_name,
        severity:    document.getElementById('c-detail-severity')?.value,
        description: document.getElementById('c-detail-description')?.value.trim()
      };

      // Hợp nhất ảnh cũ và ảnh mới
      let mediaUrls = [...(window._existingMediaUrls || [])];

      if (selectedCareFiles.length > 0) {
        if (btn) btn.innerHTML = '<span class="spinner"></span> Đóng dấu ảnh...';
        const formData  = new FormData();
        const treeCode  = window._activePlantTreeCode || plantId;

        for (const file of selectedCareFiles) {
          const processed = file.type.startsWith('image/')
            ? await watermarkImage(file, treeCode, disease_name)
            : file;
          formData.append('files', processed, file.name);
        }

        const uploadRes = await fetch(`${API}/plants/${plantId}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Lỗi tải ảnh/video lên máy chủ');
        }
        const uploaded = await uploadRes.json();
        uploaded.forEach(f => {
          mediaUrls.push({ url: f.url, type: f.media_type });
        });
      }
      body.media_urls = mediaUrls;
    }

    if (window._activeEditLogId) {
      // Ghi chú thêm thời gian chỉnh sửa kèm dữ liệu gốc
      const editTimeStr = new Date().toLocaleString('vi-VN');
      const originalLog = getLogsCache().find(l => l.id === window._activeEditLogId);
      let origDetailsStr = '';
      if (originalLog) {
        const origVal = _buildDetailsString(originalLog.log_type, originalLog.details);
        const origNote = originalLog.note ? ` | Ghi chú gốc: ${originalLog.note.replace(/\n\(Chỉnh sửa lúc: .*\)/g, '').trim()}` : '';
        origDetailsStr = `. Dữ liệu gốc: ${origVal}${origNote}`;
      }

      const cleanedNote = note.replace(/\n\(Chỉnh sửa lúc: .*\)/g, '').trim();
      body.note = cleanedNote + `\n(Chỉnh sửa lúc: ${editTimeStr}${origDetailsStr})`;

      if (btn) btn.innerHTML = '<span class="spinner"></span> Cập nhật...';
      await api(`/plants/${plantId}/logs/${window._activeEditLogId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Đã cập nhật nhật ký thành công!');
    } else {
      if (btn) btn.innerHTML = '<span class="spinner"></span> Tạo nhật ký...';
      await api(`/plants/${plantId}/logs`, { method: 'POST', body: JSON.stringify(body) });

      // ── Tự động hạch toán Tiêu hao Vật tư nếu có chọn từ Kho Vật tư ──
      const supplyId = document.getElementById('c-detail-supply-id')?.value;
      if (supplyId) {
        try {
          const amount = parseFloat(document.getElementById('c-detail-amount')?.value) || 1;
          const unit = document.getElementById('c-detail-unit')?.value || 'kg';
          
          let usageQty = amount;
          if (unit === 'gam' || unit === 'g' || unit === 'ml') {
            usageQty = amount / 1000;
          }

          await api('/supplies/usages', {
            method: 'POST',
            body: JSON.stringify({
              supply_id: supplyId,
              usage_date: logDate,
              quantity: usageQty,
              plant_id: plantId,
              note: `Tự động hạch toán từ Nhật ký Chăm sóc: ${logType} (Cây ${window._activePlantTreeCode || plantId})`
            })
          });
          toast('Đã ghi nhật ký & tự động hạch toán chi phí vào Giám sát Vật tư!', 'success');
        } catch (suppErr) {
          console.error('Auto-recording supply usage failed:', suppErr);
        }
      } else {
        toast('Ghi nhật ký chăm sóc thành công!');
      }
    }

    closeCareModal();
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();

  } catch (err) {
    toast('Lỗi lưu nhật ký: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
  }
}
