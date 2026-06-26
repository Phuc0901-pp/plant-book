// ── Helpers & Translation ───────────────────────────────

const CROP_TRANSLATIONS = {
  // Trái cây / Fruits
  "sầu riêng": "durian",
  "cà phê": "coffee",
  "ca cao": "cacao",
  "bơ": "avocado",
  "mít": "jackfruit",
  "điều": "cashew",
  "cao su": "rubber",
  "lúa nước": "rice",
  "lúa": "rice",
  "khoai tây": "potato",
  "khoai lang": "sweet potato",
  "ngô": "corn",
  "bắp": "corn",
  "tiêu": "pepper",
  "hồ tiêu": "pepper",
  "chè": "tea",
  "trà": "tea",
  "cam": "orange",
  "quýt": "mandarin",
  "bưởi": "pomelo",
  "chanh": "lemon",
  "xoài": "mango",
  "chuối": "banana",
  "nhãn": "longan",
  "vải": "lychee",
  "vải thiều": "lychee",
  "chôm chôm": "rambutan",
  "măng cụt": "mangosteen",
  "dừa": "coconut",
  "thanh long": "dragonfruit",
  "đu đủ": "papaya",
  "dứa": "pineapple",
  "thơm": "pineapple",
  "khóm": "pineapple",
  "ổi": "guava",
  "mận": "plum",
  "đào": "peach",
  "na": "custard apple",
  "mãng cầu": "custard apple",
  "mãng cầu xiêm": "soursop",
  "hồng": "persimmon",
  "táo": "apple",
  "nho": "grape",
  "dâu tây": "strawberry",
  "dưa hấu": "watermelon",
  "dưa lưới": "cantaloupe",
  "ớt": "chili",
  "tỏi": "garlic",
  "hành": "onion",
  "hành tây": "onion",
  "hành lá": "scallion",
  "gừng": "ginger",
  "nghệ": "turmeric",
  "sả": "lemongrass",
  "sen": "lotus",
  "khoai mì": "cassava",
  "sắn": "cassava",
  "mắc ca": "macadamia",
  "macca": "macadamia",
  "hạt điều": "cashew",
  "muống": "water spinach",
  "rau muống": "water spinach",
  "cải": "cabbage",
  "rau cải": "cabbage",
  "xà lách": "lettuce",
  "rau xà lách": "lettuce",
  "cà chua": "tomato",
  "cà tím": "eggplant",
  "dưa leo": "cucumber",
  "dưa chuột": "cucumber",
  "đậu": "bean",
  "đậu nành": "soybean",
  "đậu tương": "soybean",
  "đậu phộng": "peanut",
  "lạc": "peanut",
  "mướp": "luffa",
  "bầu": "gourd",
  "bí": "squash",
  "bí đỏ": "pumpkin",
  "bí ngô": "pumpkin",
  "khổ qua": "bitter melon",
  "mướp đắng": "bitter melon",

  // Không dấu / Diacritic-free
  "sau rieng": "durian",
  "ca phe": "coffee",
  "ca-phe": "coffee",
  "ca phay": "coffee",
  "ca cao": "cacao",
  "bo": "avocado",
  "mit": "jackfruit",
  "dieu": "cashew",
  "cao su": "rubber",
  "lua": "rice",
  "lua nuoc": "rice",
  "khoai tay": "potato",
  "khoai lang": "sweet potato",
  "ngo": "corn",
  "bap": "corn",
  "tieu": "pepper",
  "ho tieu": "pepper",
  "che": "tea",
  "tra": "tea",
  "cam": "orange",
  "quyt": "mandarin",
  "buoi": "pomelo",
  "chanh": "lemon",
  "xoai": "mango",
  "chuoi": "banana",
  "nhan": "longan",
  "vai": "lychee",
  "vai thieu": "lychee",
  "chom chom": "rambutan",
  "mang cut": "mangosteen",
  "dua": "coconut",
  "thanh long": "dragonfruit",
  "du du": "papaya",
  "dua": "pineapple",
  "thom": "pineapple",
  "khom": "pineapple",
  "oi": "guava",
  "man": "plum",
  "dao": "peach",
  "na": "custard apple",
  "mang cau": "custard apple",
  "mang cau xiem": "soursop",
  "hong": "persimmon",
  "tao": "apple",
  "nho": "grape",
  "dau tay": "strawberry",
  "dua hau": "watermelon",
  "dua luoi": "cantaloupe",
  "ot": "chili",
  "toi": "garlic",
  "hanh": "onion",
  "hanh tay": "onion",
  "hanh la": "scallion",
  "gung": "ginger",
  "nghe": "turmeric",
  "sa": "lemongrass",
  "sen": "lotus",
  "khoai mi": "cassava",
  "san": "cassava",
  "mac ca": "macadamia",
  "macca": "macadamia",
  "hat dieu": "cashew",
  "muong": "water spinach",
  "rau muong": "water spinach",
  "cai": "cabbage",
  "rau cai": "cabbage",
  "xa lach": "lettuce",
  "rau xa lach": "lettuce",
  "ca chua": "tomato",
  "ca tim": "eggplant",
  "dua leo": "cucumber",
  "dua chuot": "cucumber",
  "dau": "bean",
  "dau nanh": "soybean",
  "dau tuong": "soybean",
  "dau phong": "peanut",
  "lac": "peanut",
  "muop": "luffa",
  "bau": "gourd",
  "bi": "squash",
  "bi do": "pumpkin",
  "bi ngo": "pumpkin",
  "kho qua": "bitter melon",
  "muop dang": "bitter melon"
};

function removeDiacritics(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d");
}

async function translateCropName(viName) {
  const cleanVi = viName.trim().toLowerCase();
  if (!cleanVi) return "";
  
  // 1. Check direct match in dictionary
  if (CROP_TRANSLATIONS[cleanVi]) {
    return CROP_TRANSLATIONS[cleanVi];
  }
  
  // 2. Check normalized match (no diacritics)
  const normVi = removeDiacritics(cleanVi);
  if (CROP_TRANSLATIONS[normVi]) {
    return CROP_TRANSLATIONS[normVi];
  }
  
  // 3. Fallback to MyMemory translation API
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(viName)}&langpair=vi|en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      let enText = data?.responseData?.translatedText;
      if (enText) {
        enText = enText.replace(/\./g, "").trim().toLowerCase();
        if (enText.startsWith("the ")) {
          enText = enText.slice(4).trim();
        }
        return enText;
      }
    }
  } catch (e) {
    console.error("MyMemory translation error:", e);
  }
  
  // 4. Ultimate fallback: use the normalized name itself
  return normVi.replace(/[^a-z0-9]/g, "_");
}


function api(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    }
  }).then(async r => {
    if (r.status === 401) { logout(); return; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Lỗi server');
    return data;
  });
}

function apiForm(path, body) {
  return fetch(API + path, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Lỗi upload');
    return data;
  });
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toast-icon').innerHTML = type === 'success'
    ? '<i class="fa-solid fa-circle-check" style="color:#4ade80"></i>'
    : '<i class="fa-solid fa-circle-xmark" style="color:#f87171"></i>';
  document.getElementById('toast-msg').textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric'});
}

function healthBadge(h) {
  const map = { 'Tốt':'badge-green','Bình thường':'badge-blue','Cần chú ý':'badge-amber','Bệnh':'badge-red' };
  return `<span class="badge ${map[h]||'badge-gray'}">${esc(h)}</span>`;
}


// ── Schemas ─────────────────────────────────────────────────

async function loadSchemas() {
  try {
    const schemas = await api('/schemas');
    schemasCache = schemas;
    const tbody = document.getElementById('schemas-table');
    if (!schemas.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fa fa-layer-group"></i><p>Chưa có schema nào</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = schemas.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td style="color:var(--gray-600);font-size:12px">${esc(s.description||'—')}</td>
        <td><span class="badge badge-blue">${(s.fields||[]).length} trường</span></td>
        <td>${fmtDate(s.created_at)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="openSchemaModal(${s.id})"><i class="fa fa-pen"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteSchema(${s.id},'${esc(s.name)}')"><i class="fa fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast('Lỗi tải schema: ' + err.message, 'error');
  }
}

async function loadSchemasDropdown() {
  try {
    const schemas = await api('/schemas');
    schemasCache = schemas;
    
    // Populate f-plant-type select
    const pTypeSel = document.getElementById('f-plant-type');
    if (pTypeSel) {
      pTypeSel.innerHTML = '<option value="">— Chọn loại cây —</option>' +
        schemas.map(s => `<option value="${esc(s.name)}" data-schema-id="${s.id}">${esc(s.name)}</option>`).join('');
    }
    
    // Populate csv-plant-type select
    const csvTypeSel = document.getElementById('csv-plant-type');
    if (csvTypeSel) {
      csvTypeSel.innerHTML = '<option value="">— Chọn loại cây —</option>' +
        schemas.map(s => `<option value="${esc(s.name)}" data-schema-id="${s.id}">${esc(s.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Lỗi tải schemas dropdown:', err);
  }
}

function onPlantTypeChange() {
  const pTypeSel = document.getElementById('f-plant-type');
  const selectedOpt = pTypeSel.options[pTypeSel.selectedIndex];
  const schemaId = selectedOpt ? selectedOpt.getAttribute('data-schema-id') : '';
  
  document.getElementById('f-schema-id').value = schemaId || '';
  renderExtraFields();
}

function onCsvPlantTypeChange() {
  const csvTypeSel = document.getElementById('csv-plant-type');
  const selectedOpt = csvTypeSel.options[csvTypeSel.selectedIndex];
  const schemaId = selectedOpt ? selectedOpt.getAttribute('data-schema-id') : '';
  
  document.getElementById('csv-schema-id').value = schemaId || '';
}

async function openSchemaModal(id = null) {
  editingSchemaId = id;
  schemaFields = [];
  document.getElementById('schema-modal-title').innerHTML = id
    ? '<i class="fa-solid fa-pen" style="color:var(--green)"></i> Chỉnh sửa Schema'
    : '<i class="fa-solid fa-sliders" style="color:var(--green)"></i> Tạo Schema loại cây';
  document.getElementById('s-name').value = '';
  document.getElementById('s-desc').value = '';

  // Reset image upload fields
  const fileInput = document.getElementById('s-image');
  if (fileInput) fileInput.value = '';
  document.getElementById('schema-image-preview-container').style.display = 'none';
  document.getElementById('schema-image-filename').textContent = 'Chưa chọn ảnh';

  if (id) {
    try {
      const schema = await api(`/schemas/${id}`);
      const name = schema.name || '';
      document.getElementById('s-name').value = name;
      document.getElementById('s-desc').value = schema.description || '';
      schemaFields = schema.fields || [];

      // Check if schema name has English translation in parentheses for cover image preview
      const match = name.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const englishName = match[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const imgEl = document.getElementById('schema-image-preview');
        imgEl.src = `/assets/crop/${englishName}.png`;
        imgEl.setAttribute('data-ext-idx', '0');
        imgEl.onerror = function() {
          const exts = ['.jpg', '.jpeg', '.webp', '.gif'];
          let extIdx = parseInt(this.getAttribute('data-ext-idx') || '0');
          if (extIdx < exts.length) {
            const nextExt = exts[extIdx];
            this.setAttribute('data-ext-idx', extIdx + 1);
            this.src = `/assets/crop/${englishName}${nextExt}`;
          } else {
            // Failed to load any extension, hide preview
            document.getElementById('schema-image-preview-container').style.display = 'none';
            document.getElementById('schema-image-filename').textContent = 'Chưa có ảnh đại diện';
          }
        };
        document.getElementById('schema-image-preview-container').style.display = 'flex';
        document.getElementById('schema-image-filename').textContent = 'Đã có ảnh (assets)';
      }
    } catch (err) { toast('Lỗi: ' + err.message, 'error'); return; }
  }
  renderSchemaFields();
  document.getElementById('schema-modal').style.display = 'flex';
}

function closeSchemaModal() {
  document.getElementById('schema-modal').style.display = 'none';
  editingSchemaId = null;
  schemaFields = [];
  const imgInput = document.getElementById('s-image');
  if (imgInput) imgInput.value = '';
  document.getElementById('schema-image-preview-container').style.display = 'none';
  document.getElementById('schema-image-filename').textContent = 'Chưa chọn ảnh';
}

function previewSchemaImage(input) {
  const container = document.getElementById('schema-image-preview-container');
  const img = document.getElementById('schema-image-preview');
  const label = document.getElementById('schema-image-filename');
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    label.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
      img.onerror = null; // Clear error handler for local preview
      container.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }
}

function removeSelectedSchemaImage() {
  document.getElementById('s-image').value = '';
  document.getElementById('schema-image-preview-container').style.display = 'none';
  document.getElementById('schema-image-filename').textContent = 'Chưa chọn ảnh';
}

function renderSchemaFields() {
  const list = document.getElementById('schema-fields-list');
  if (!schemaFields.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--gray-400);padding:8px">Chưa có trường nào. Thêm bên dưới.</p>';
    return;
  }
  const typeLabels = { text:'Văn bản', number:'Số', date:'Ngày', select:'Lựa chọn', textarea:'Đoạn văn' };
  list.innerHTML = schemaFields.map((f, i) => `
    <div class="schema-field-item">
      <div class="field-info">
        <div><strong>${esc(f.name)}</strong></div>
        <div class="field-type">${typeLabels[f.type]||f.type}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeSchemaField(${i})">
        <i class="fa fa-trash"></i>
      </button>
    </div>`).join('');
}

function addSchemaField() {
  const name = document.getElementById('new-field-name').value.trim();
  const type = document.getElementById('new-field-type').value;
  if (!name) { toast('Vui lòng nhập tên trường!', 'error'); return; }
  if (schemaFields.find(f => f.name === name)) { toast('Trường đã tồn tại!', 'error'); return; }
  schemaFields.push({ name, type });
  document.getElementById('new-field-name').value = '';
  renderSchemaFields();
}

function removeSchemaField(i) {
  schemaFields.splice(i, 1);
  renderSchemaFields();
}

async function saveSchema() {
  let name = document.getElementById('s-name').value.trim();
  if (!name) { toast('Tên schema là bắt buộc!', 'error'); return; }
  
  const btn = document.querySelector('#schema-modal .modal-footer button.btn-primary');
  let oldHtml = '';
  if (btn) {
    oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Đang dịch & lưu...';
  }

  try {
    // Automatically translate and append English name in parentheses if not already present
    if (!/\([^)]+\)/.test(name)) {
      const translated = await translateCropName(name);
      if (translated) {
        name = `${name}(${translated})`;
        document.getElementById('s-name').value = name;
      }
    }

    const body = { name, description: document.getElementById('s-desc').value.trim(), fields: schemaFields };
    if (editingSchemaId) {
      await api(`/schemas/${editingSchemaId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/schemas', { method: 'POST', body: JSON.stringify(body) });
    }

    // Upload crop image if selected
    const fileInput = document.getElementById('s-image');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const fd = new FormData();
      fd.append('image', fileInput.files[0]);
      
      const match = name.match(/\(([^)]+)\)/);
      const englishName = (match && match[1]) ? match[1].trim() : 'unknown';
      fd.append('englishName', englishName);

      await apiForm('/schemas/upload-image', fd);
    }

    toast('Đã lưu schema!');
    closeSchemaModal();
    loadSchemas();
    loadSchemasDropdown();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }
}

async function deleteSchema(id, name) {
  if (!confirm(`Xóa schema "${name}"?`)) return;
  try {
    await api(`/schemas/${id}`, { method: 'DELETE' });
    toast('Đã xóa schema.');
    loadSchemas();
    loadSchemasDropdown();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'error');
  }
}

// Enter key for add field
document.getElementById('new-field-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addSchemaField();
});

// ── Configuration tabs & care options ──────────────────────

function switchConfigTab(tab) {
  document.getElementById('config-tab-schema').classList.toggle('active', tab === 'schema');
  document.getElementById('config-tab-care').classList.toggle('active', tab === 'care');
  document.getElementById('pane-config-schema').style.display = tab === 'schema' ? 'block' : 'none';
  document.getElementById('pane-config-care').style.display = tab === 'care' ? 'block' : 'none';
}

async function loadCareConfigs() {
  try {
    const configs = await api('/config');
    document.getElementById('cfg-water-methods').value = (configs.water_methods || []).join('\n');
    document.getElementById('cfg-fertilizers').value = (configs.fertilizers || []).join('\n');
    document.getElementById('cfg-pesticides').value = (configs.pesticides || []).join('\n');
    document.getElementById('cfg-leaf-reasons').value = (configs.leaf_cut_reasons || []).join('\n');
    document.getElementById('cfg-flower-reasons').value = (configs.flower_prune_reasons || []).join('\n');
  } catch (err) {
    toast('Lỗi tải cấu hình quy trình: ' + err.message, 'error');
  }
}

async function saveCareConfigs() {
  const btn = document.getElementById('save-care-cfg-btn');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Đang lưu...';
  btn.disabled = true;

  const parseTextarea = (id) => {
    return document.getElementById(id).value
      .split('\n')
      .map(x => x.trim())
      .filter(x => x.length > 0);
  };

  const body = {
    water_methods: parseTextarea('cfg-water-methods'),
    fertilizers: parseTextarea('cfg-fertilizers'),
    pesticides: parseTextarea('cfg-pesticides'),
    leaf_cut_reasons: parseTextarea('cfg-leaf-reasons'),
    flower_prune_reasons: parseTextarea('cfg-flower-reasons')
  };

  try {
    await api('/config', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    toast('Lưu cấu hình quy trình thành công!');
  } catch (err) {
    toast('Lỗi lưu cấu hình: ' + err.message, 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

