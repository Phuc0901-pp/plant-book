/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   modules/care-modal.js — Care log modal: open, close, form fields, save
   ═══════════════════════════════════════════════════════════════ */

import { api, token, API }      from '../core/api.js';
import { toast, esc }           from '../core/utils.js';
import { selectedCareFiles, clearSelectedFiles, watermarkImage, onCareMediaSelected } from './media.js';

// ── Truy cập config/plants qua window để tránh circular import ──
function _configs()  { return window._allConfigsCache || {}; }
function _plants()   { return window._allPlantsCache  || []; }

// ── Open / Close ──────────────────────────────────────────────

/**
 * Mở modal nhật ký chăm sóc.
 * - Nếu plantId được cung cấp → khoá vào 1 cây cụ thể
 * - Nếu plantId = null (FAB) → hiển thị dropdown chọn cây
 *
 * @param {number|null} plantId
 * @param {string|null} treeCode
 * @param {string|null} plantType
 */
export function openCareModal(plantId, treeCode, plantType) {
  clearSelectedFiles();

  // Reset form
  const noteEl    = document.getElementById('c-note');
  const logTypeEl = document.getElementById('c-log-type');
  if (noteEl)    noteEl.value    = '';
  if (logTypeEl) logTypeEl.value = 'Tưới nước';
  onCareLogTypeChange();

  const displayEl = document.getElementById('c-plant-display');
  const selectEl  = document.getElementById('c-plant-id-select');
  const idEl      = document.getElementById('c-plant-id');

  if (plantId) {
    // Cây cụ thể
    window._activePlantTreeCode = treeCode;
    if (idEl)      idEl.value             = plantId;
    if (displayEl) { displayEl.value       = `Cây ${treeCode} - ${plantType}`; displayEl.style.display = 'block'; }
    if (selectEl)  selectEl.style.display = 'none';
  } else {
    // FAB chung: dropdown tất cả cây
    window._activePlantTreeCode = '';
    if (idEl)      idEl.value              = '';
    if (displayEl) displayEl.style.display = 'none';
    if (selectEl) {
      selectEl.innerHTML = _plants().map(p =>
        `<option value="${p.id}" data-code="${esc(p.tree_code || p.id)}">Cây ${esc(p.tree_code || p.id)} - ${esc(p.plant_type)}</option>`
      ).join('');
      selectEl.style.display = 'block';
    }
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
 * 6 loại: Tưới nước | Bón phân | Phun thuốc | Cắt lá | Tỉa hoa | Bệnh cây
 */
export function onCareLogTypeChange() {
  const logType   = document.getElementById('c-log-type')?.value;
  const container = document.getElementById('care-detail-fields');
  if (!container || !logType) return;

  const configs = _configs();
  container.innerHTML = _buildDetailFields(logType, configs);
}

/**
 * Trả về HTML form fields theo loại hoạt động.
 * @private
 */
function _buildDetailFields(logType, configs) {
  switch (logType) {
    case 'Tưới nước': {
      const methods = configs.water_methods || [];
      return `
        <div class="field">
          <label>Phương pháp tưới nước *</label>
          <select id="c-detail-method">${methods.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Lượng nước (Lít) *</label>
          <input type="number" step="any" id="c-detail-amount" value="2">
        </div>`;
    }
    case 'Bón phân': {
      const fertilizers = configs.fertilizers || [];
      return `
        <div class="field">
          <label>Loại phân bón *</label>
          <select id="c-detail-fertilizer">${fertilizers.map(f => `<option>${esc(f)}</option>`).join('')}</select>
        </div>
        <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
          <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="100"></div>
          <div class="field" style="flex:1;"><label>Đơn vị</label>
            <select id="c-detail-unit"><option value="gam">gam</option><option value="kg">kg</option><option value="ml">ml</option><option value="lít">lít</option></select>
          </div>
        </div>`;
    }
    case 'Phun thuốc': {
      const pesticides = configs.pesticides || [];
      return `
        <div class="field">
          <label>Loại thuốc bảo vệ thực vật *</label>
          <select id="c-detail-pesticide">${pesticides.map(p => `<option>${esc(p)}</option>`).join('')}</select>
        </div>
        <div class="field" style="display:flex;gap:10px;margin-bottom:0;">
          <div class="field" style="flex:2;"><label>Liều lượng *</label><input type="number" step="any" id="c-detail-amount" value="50"></div>
          <div class="field" style="flex:1;"><label>Đơn vị</label>
            <select id="c-detail-unit"><option value="ml">ml</option><option value="gam">gam</option><option value="lít">lít</option></select>
          </div>
        </div>`;
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
            <option value="Nhẹ">🟡 Nhẹ</option>
            <option value="Trung bình" selected>🟠 Trung bình</option>
            <option value="Nghiêm trọng">🔴 Nghiêm trọng</option>
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

  // Cập nhật tree code nếu chọn từ dropdown
  if (selectEl?.style.display === 'block') {
    const opt = selectEl.options[selectEl.selectedIndex];
    window._activePlantTreeCode = opt?.getAttribute('data-code') || plantId;
  }

  const logType = document.getElementById('c-log-type')?.value;
  const note    = document.getElementById('c-note')?.value.trim() || '';

  const body = { log_type: logType, log_date: new Date().toISOString().slice(0, 10), note, media_urls: [], details: {} };

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

      // Upload ảnh có watermark
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
        body.media_urls = uploaded.map(f => ({ url: f.url, type: f.media_type }));
      }
    }

    if (btn) btn.innerHTML = '<span class="spinner"></span> Tạo nhật ký...';
    await api(`/plants/${plantId}/logs`, { method: 'POST', body: JSON.stringify(body) });

    toast('Ghi nhật ký chăm sóc thành công!');
    closeCareModal();
    if (typeof window.loadUserDashboard === 'function') window.loadUserDashboard();

  } catch (err) {
    toast('Lỗi lưu nhật ký: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
  }
}
