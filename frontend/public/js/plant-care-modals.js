// Modular Plant Care Log Modals, Draft Persistence & Submission
function toggleCustomInput(prefix) {
  const select = document.getElementById(`${prefix}-select`) || document.getElementById(`${prefix}-supply-select`);
  const custom = document.getElementById(`${prefix}-custom`);
  if (!select || !custom) return;
  if (select.value === '__custom__') {
    custom.style.display = 'inline-block';
    custom.required = true;
  } else {
    custom.style.display = 'none';
    custom.required = false;
    custom.value = '';
  }
}

// Open / Close Modal Helpers
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Set default datetime to local now in YYYY-MM-DDTHH:mm format
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
  
  const dtInput = document.getElementById(id).querySelector('input[type="datetime-local"]');
  if (dtInput) {
    dtInput.value = localISOTime;
  }
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.getElementById(id).querySelector('form')?.reset();
  // Reset custom input visibility
  const customInputs = document.getElementById(id).querySelectorAll('input[id$="-custom"]');
  customInputs.forEach(i => i.style.display = 'none');
  
  // Restore body overflow only if there are no other open modals
  const openModals = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => m.style.display === 'flex');
  if (openModals.length === 0) {
    document.body.style.overflow = '';
  }
}
function closeModalOnOuterClick(event, id) {
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

// Populates a dropdown select with options and appends a "Khác..." option
function populateDropdown(selectId, list, prefix) {
  const select = document.getElementById(selectId);
  if (!select || !list) return;
  let html = list.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('');
  html += `<option value="__custom__">➕ Khác...</option>`;
  select.innerHTML = html;
  if (prefix) toggleCustomInput(prefix);
}

// Submit log entries from care forms
async function submitCareLog(event, type, modalId, formId) {
  event.preventDefault();
  
  const form = document.getElementById(formId);
  const submitBtn = form.querySelector('.btn-submit');
  const oldText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang lưu...';
  submitBtn.disabled = true;

  // Gather details depending on log type
  const details = {};
  let note = '';

  if (type === 'Tưới nước') {
    const selectVal = document.getElementById('water-method-select')?.value;
    details.method = selectVal === '__custom__' ? document.getElementById('water-method-custom')?.value.trim() : selectVal;
    details.amount = parseFloat(document.getElementById('water-amount')?.value) || 0;
    details.unit = document.getElementById('water-unit')?.value || 'Lít';
    details.time = document.getElementById('water-time')?.value || 'Sáng';
    details.supply_id = document.getElementById('water-supply-select')?.value || null;
    details.operator_name = document.getElementById('water-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('water-equipment-used')?.value.trim() || '';
    note = document.getElementById('water-note')?.value.trim() || '';
  } 
  else if (type === 'Bón phân') {
    const selectEl = document.getElementById('fertilizer-supply-select');
    const selectVal = selectEl?.value;
    const opt = selectEl?.options[selectEl?.selectedIndex];
    const isCustom = selectVal === '__custom__';
    details.type = isCustom 
      ? document.getElementById('fertilizer-custom')?.value.trim() 
      : (opt?.getAttribute('data-name') || selectVal || 'Phân bón');
    details.supply_id = (isCustom || !selectVal) ? null : selectVal;
    details.amount = parseFloat(document.getElementById('fertilizer-amount')?.value) || 0;
    details.unit = document.getElementById('fertilizer-unit')?.value || 'g';
    details.method = document.getElementById('fertilizer-method')?.value || 'Bón gốc';
    details.operator_name = document.getElementById('fertilizer-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('fertilizer-equipment-used')?.value.trim() || '';
    note = document.getElementById('fertilizer-note')?.value.trim() || '';
  } 
  else if (type === 'Phun thuốc') {
    const selectEl = document.getElementById('pesticide-supply-select');
    const selectVal = selectEl?.value;
    const opt = selectEl?.options[selectEl?.selectedIndex];
    const isCustom = selectVal === '__custom__';
    details.type = isCustom 
      ? document.getElementById('pesticide-custom')?.value.trim() 
      : (opt?.getAttribute('data-name') || selectVal || 'Thuốc BVTV');
    details.supply_id = (isCustom || !selectVal) ? null : selectVal;
    details.active_ingredient = opt?.getAttribute('data-ing') || '';
    details.phi_days = parseInt(opt?.getAttribute('data-phi') || '14');
    details.amount = parseFloat(document.getElementById('pesticide-amount')?.value) || 0;
    details.unit = document.getElementById('pesticide-unit')?.value || 'ml';
    details.water_volume = parseFloat(document.getElementById('pesticide-water')?.value) || 0;
    details.purpose = document.getElementById('pesticide-purpose')?.value || 'Trừ sâu';
    details.operator_name = document.getElementById('pesticide-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('pesticide-equipment-used')?.value.trim() || '';
    note = document.getElementById('pesticide-note')?.value.trim() || '';
  } 
  else if (type === 'Nhân công') {
    const selectVal = document.getElementById('labor-work-select')?.value;
    const workContent = selectVal === '__custom__' ? document.getElementById('labor-work-custom')?.value.trim() : selectVal;
    const costVal = parseFloat(document.getElementById('labor-cost')?.value) || 0;
    const workersCount = parseInt(document.getElementById('labor-workers-count')?.value) || 1;
    details.work_content = workContent || 'Thuê nhân công chăm sóc';
    details.activity = details.work_content;
    details.cost = costVal;
    details.labor_cost = costVal;
    details.workers_count = workersCount;
    details.operator_name = document.getElementById('labor-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('labor-equipment-used')?.value.trim() || '';
    note = document.getElementById('labor-note')?.value.trim() || '';
  }
  else if (type === 'Cắt lá') {
    details.amount = document.getElementById('leaf-amount')?.value.trim() || '';
    const selectVal = document.getElementById('leaf-reason-select')?.value;
    details.reason = selectVal === '__custom__' ? document.getElementById('leaf-reason-custom')?.value.trim() : selectVal;
    details.operator_name = document.getElementById('leaf-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('leaf-equipment-used')?.value.trim() || '';
    note = document.getElementById('leaf-note')?.value.trim() || '';
  } 
  else if (type === 'Tỉa hoa') {
    details.amount = document.getElementById('flower-amount')?.value.trim() || '';
    const selectVal = document.getElementById('flower-reason-select')?.value;
    details.reason = selectVal === '__custom__' ? document.getElementById('flower-reason-custom')?.value.trim() : selectVal;
    details.operator_name = document.getElementById('flower-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('flower-equipment-used')?.value.trim() || '';
    note = document.getElementById('flower-note')?.value.trim() || '';
  }
  else if (type === 'Thu hoạch') {
    const harvestAmountInput = document.getElementById('harvest-amount');
    details.amount = harvestAmountInput ? parseFloat(harvestAmountInput.value) : 0;
    details.yield_kg = details.amount;
    const harvestUnitInput = document.getElementById('harvest-unit');
    details.unit = harvestUnitInput ? harvestUnitInput.value : 'kg';
    const harvestFruitCountInput = document.getElementById('harvest-fruit-count');
    details.fruit_count = harvestFruitCountInput ? parseFloat(harvestFruitCountInput.value) : 0;
    const harvestTreeRevInput = document.getElementById('harvest-tree-revenue');
    details.price_per_tree = harvestTreeRevInput ? parseFloat(harvestTreeRevInput.value) : 0;
    details.total_revenue = details.price_per_tree;
    details.avg_price_per_fruit = details.fruit_count > 0 ? Math.round(details.price_per_tree / details.fruit_count) : 0;
    const harvestQualityInput = document.getElementById('harvest-quality');
    details.quality = harvestQualityInput ? harvestQualityInput.value.trim() : '';
    details.operator_name = document.getElementById('harvest-operator-name')?.value.trim() || '';
    details.equipment_used = document.getElementById('harvest-equipment-used')?.value.trim() || '';
    const harvestNoteInput = document.getElementById('harvest-note');
    note = harvestNoteInput ? harvestNoteInput.value.trim() : '';
  }

  const dtInput = form.querySelector('input[type="datetime-local"]');
  let performedAt = new Date().toISOString();
  let logDate = performedAt.slice(0, 10);
  if (dtInput && dtInput.value) {
    const localDate = new Date(dtInput.value);
    performedAt = localDate.toISOString();
    logDate = dtInput.value.slice(0, 10);
  }
  
  details.performed_at = performedAt;

  const payload = {
    log_type: type,
    note: note,
    details: details,
    log_date: logDate,
    media_urls: []
  };

  const targetSlug = currentPlantData?.id || currentPlantData?.nfc_uid || currentPlantData?.public_slug || slug || slugInfo.plantId || slugInfo.nfcUid;
  if (!targetSlug) {
    alert('Không xác định được mã cây trồng để lưu nhật ký. Vui lòng tải lại trang.');
    return;
  }

  const { token } = getStoredAuth();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/plants/public/${encodeURIComponent(targetSlug)}/logs`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        alert(errData.error || 'Bạn không có quyền ghi nhật ký cho cây này. Vui lòng đăng nhập tài khoản trang trại.');
        openPublicAuthModal(modalId);
        return;
      }
      throw new Error(errData.error || 'Lỗi server khi lưu nhật ký');
    }
    
    closeModal(modalId);
    showPublicToast(`Đã lưu nhật ký "${type}" thành công!`);
    
    // Refresh current plant logs directly without breaking view
    try {
      const fetchKey = currentPlantData?.id || targetSlug;
      const refRes = await fetch(`/api/plants/public/${encodeURIComponent(fetchKey)}`);
      if (refRes.ok) {
        const updatedPlant = await refRes.json();
        currentPlantData = updatedPlant;
        const { user } = getStoredAuth();
        const hasAccess = userHasPlantAccess(user, updatedPlant);
        await renderPlant(updatedPlant, hasAccess);
      } else {
        await loadPlant();
      }
    } catch (_) {
      await loadPlant();
    }
  } catch (err) {
    alert('Không thể lưu nhật ký: ' + err.message);
  } finally {
    submitBtn.innerHTML = oldText;
    submitBtn.disabled = false;
  }
}

function calculatePublicHarvestEconomics() {
  const fruitCount = parseFloat(document.getElementById('harvest-fruit-count')?.value) || 0;
  const treeRev = parseFloat(document.getElementById('harvest-tree-revenue')?.value) || 0;
  const avgEl = document.getElementById('public-harvest-avg-fruit');
  if (avgEl) {
    const avg = fruitCount > 0 ? Math.round(treeRev / fruitCount) : 0;
    avgEl.textContent = `${new Intl.NumberFormat('vi-VN').format(avg)} VNĐ / quả`;
  }
}
window.calculatePublicHarvestEconomics = calculatePublicHarvestEconomics;

// ── Bệnh cây Feature ─────────────────────────────────────────────
let diseaseImageFiles = [];
let diseaseVideoFiles = [];

// IndexedDB for File Caching
const DB_NAME = 'PlantAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'draftFiles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveDraftFiles(key, files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(files, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getDraftFiles(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function clearDraftFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(`diseaseImages_${slug}`);
    tx.objectStore(STORE_NAME).delete(`diseaseVideos_${slug}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Save text inputs to localStorage
function saveDiseaseDraftText() {
  const draft = {
    name: document.getElementById('disease-name').value,
    desc: document.getElementById('disease-desc').value,
    severity: document.getElementById('disease-severity').value,
    datetime: document.getElementById('disease-datetime').value,
    note: document.getElementById('disease-note').value
  };
  localStorage.setItem(`diseaseText_${slug}`, JSON.stringify(draft));
}

// Restore draft text and files
async function restoreDiseaseDraft() {
  const draftTxt = localStorage.getItem(`diseaseText_${slug}`);
  if (draftTxt) {
    try {
      const draft = JSON.parse(draftTxt);
      if (draft.name) document.getElementById('disease-name').value = draft.name;
      if (draft.desc) document.getElementById('disease-desc').value = draft.desc;
      if (draft.severity) document.getElementById('disease-severity').value = draft.severity;
      if (draft.datetime) document.getElementById('disease-datetime').value = draft.datetime;
      if (draft.note) document.getElementById('disease-note').value = draft.note;
    } catch(e) {}
  }
  try {
    diseaseImageFiles = await getDraftFiles(`diseaseImages_${slug}`);
    diseaseVideoFiles = await getDraftFiles(`diseaseVideos_${slug}`);
    renderDiseasePreviews('images');
    renderDiseasePreviews('videos');
  } catch(e) {
    console.error("Lỗi khôi phục files:", e);
  }
}

// Bind auto-save to inputs
document.querySelectorAll('#form-disease input, #form-disease textarea, #form-disease select').forEach(el => {
  if (el.type !== 'file') {
    el.addEventListener('input', saveDiseaseDraftText);
    el.addEventListener('change', saveDiseaseDraftText);
  }
});

async function handleDiseaseFiles(input, type) {
  const files = Array.from(input.files);
  if (!files.length) return;
  if (type === 'images') {
    const toAdd = files.slice(0, 10 - diseaseImageFiles.length);
    diseaseImageFiles = [...diseaseImageFiles, ...toAdd];
    renderDiseasePreviews('images');
    await saveDraftFiles(`diseaseImages_${slug}`, diseaseImageFiles);
  } else {
    const toAdd = files.slice(0, 2 - diseaseVideoFiles.length);
    diseaseVideoFiles = [...diseaseVideoFiles, ...toAdd];
    renderDiseasePreviews('videos');
    await saveDraftFiles(`diseaseVideos_${slug}`, diseaseVideoFiles);
  }
  // Reset file input so the same file can be re-selected if needed
  input.value = '';
}

async function removeDiseaseFile(idx, type) {
  if (type === 'images') {
    diseaseImageFiles.splice(idx, 1);
    renderDiseasePreviews('images');
    await saveDraftFiles(`diseaseImages_${slug}`, diseaseImageFiles);
  } else {
    diseaseVideoFiles.splice(idx, 1);
    renderDiseasePreviews('videos');
    await saveDraftFiles(`diseaseVideos_${slug}`, diseaseVideoFiles);
  }
}

function renderDiseasePreviews(type) {
  const files = type === 'images' ? diseaseImageFiles : diseaseVideoFiles;
  const previewEl = document.getElementById(type === 'images' ? 'disease-img-preview' : 'disease-vid-preview');
  const zoneEl = document.getElementById(type === 'images' ? 'disease-img-zone' : 'disease-vid-zone');
  if (!previewEl || !zoneEl) return;

  previewEl.innerHTML = '';
  zoneEl.classList.toggle('has-file', files.length > 0);

  files.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-preview';
    removeBtn.innerHTML = '×';
    removeBtn.type = 'button';
    removeBtn.onclick = () => removeDiseaseFile(idx, type);

    if (file.type && file.type.startsWith('video')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      item.appendChild(video);
      const badge = document.createElement('div');
      badge.className = 'video-badge';
      badge.textContent = 'VIDEO';
      item.appendChild(badge);
    } else {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);
    }
    item.appendChild(removeBtn);
    previewEl.appendChild(item);
  });
}

async function submitDiseaseLog(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btn-disease-submit');
  const oldHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang tải lên...';
  submitBtn.disabled = true;

  const diseaseName = document.getElementById('disease-name').value.trim();
  const desc = document.getElementById('disease-desc').value.trim();
  const severity = document.getElementById('disease-severity').value;
  const note = document.getElementById('disease-note').value.trim();
  const dtInput = document.getElementById('disease-datetime');

  let performedAt = new Date().toISOString();
  let logDate = performedAt.slice(0, 10);
  if (dtInput && dtInput.value) {
    const localDate = new Date(dtInput.value);
    performedAt = localDate.toISOString();
    logDate = dtInput.value.slice(0, 10);
  }

  const operatorName = document.getElementById('disease-operator-name')?.value.trim() || '';
  const equipmentUsed = document.getElementById('disease-equipment-used')?.value.trim() || '';

  const details = {
    disease_name: diseaseName,
    description: desc,
    severity: severity,
    operator_name: operatorName,
    equipment_used: equipmentUsed,
    performed_at: performedAt
  };

  try {
    const formData = new FormData();
    formData.append('log_type', 'Bệnh cây');
    formData.append('log_date', logDate);
    formData.append('note', note);
    formData.append('operator_name', operatorName);
    formData.append('equipment_used', equipmentUsed);
    formData.append('details', JSON.stringify(details));

    diseaseImageFiles.forEach(f => formData.append('files', f));
    diseaseVideoFiles.forEach(f => formData.append('files', f));

    const targetSlug = currentPlantData?.id || currentPlantData?.nfc_uid || currentPlantData?.public_slug || slug || slugInfo.plantId || slugInfo.nfcUid;
    if (!targetSlug) {
      alert('Không xác định được mã cây trồng để ghi nhận bệnh cây.');
      return;
    }

    const { token } = getStoredAuth();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/plants/public/${encodeURIComponent(targetSlug)}/logs`, {
      method: 'POST',
      headers: headers,
      // Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        alert(errData.error || 'Bạn không có quyền ghi nhận bệnh cây cho cây này. Vui lòng đăng nhập tài khoản trang trại.');
        openPublicAuthModal('modal-disease');
        return;
      }
      throw new Error(errData.error || 'Lỗi server khi lưu nhật ký');
    }

    // Reset form and clear drafts
    document.getElementById('form-disease').reset();
    diseaseImageFiles = [];
    diseaseVideoFiles = [];
    renderDiseasePreviews('images');
    renderDiseasePreviews('videos');
    localStorage.removeItem(`diseaseText_${slug}`);
    await clearDraftFiles();

    closeModal('modal-disease');
    showPublicToast('Đã ghi nhận nhật ký bệnh cây thành công!');

    // Refresh current plant logs directly without breaking view
    try {
      const fetchKey = currentPlantData?.id || targetSlug;
      const refRes = await fetch(`/api/plants/public/${encodeURIComponent(fetchKey)}`);
      if (refRes.ok) {
        const updatedPlant = await refRes.json();
        currentPlantData = updatedPlant;
        const { user } = getStoredAuth();
        const hasAccess = userHasPlantAccess(user, updatedPlant);
        await renderPlant(updatedPlant, hasAccess);
      } else {
        await loadPlant();
      }
    } catch (_) {
      await loadPlant();
    }
  } catch (err) {
    alert('Không thể lưu nhật ký bệnh cây: ' + err.message);
  } finally {
    submitBtn.innerHTML = oldHtml;
    submitBtn.disabled = false;
  }
}

// Restore drafts if user cancels out and re-opens
function onModalOpen(modalId) {
  if (modalId === 'modal-disease') {
    restoreDiseaseDraft();
  }
}

// Modifying the existing openModal function:
const originalOpenModal = openModal;
openModal = function(modalId) {
  originalOpenModal(modalId);
  onModalOpen(modalId);
};

