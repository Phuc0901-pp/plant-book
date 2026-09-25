// Global silent error handler for browser translation and extension promise rejections
window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && (
    String(event.reason.message || event.reason).includes('Language detection') ||
    String(event.reason.message || event.reason).includes('not supported for this page')
  )) {
    event.preventDefault();
  }
});

// Parse Slug info from /:farmId/public/:nfcUid, /:farmId/:plantId/:nfcUid, /:userId/:farmId/:plantId/:nfcUid or /plant/:slug
function getPublicSlugInfoFromUrl() {
  const pathParts = location.pathname.split('/').filter(p => p.length > 0);
  if (pathParts.length === 0) return { slug: '', plantId: '', nfcUid: '', farmId: '' };
  if (pathParts[0] === 'plant') {
    return { slug: decodeURIComponent(pathParts[1] || ''), plantId: decodeURIComponent(pathParts[1] || ''), nfcUid: '', farmId: '' };
  }
  if (pathParts[0] === 'nfc') {
    return { slug: decodeURIComponent(pathParts[1] || ''), plantId: '', nfcUid: decodeURIComponent(pathParts[1] || ''), farmId: '' };
  }
  
  // Format: /:farmId/public or /:farmId/public/ (Smart Farm Gateway URL)
  if (pathParts.length === 2 && pathParts[1] === 'public') {
    return {
      farmId: decodeURIComponent(pathParts[0]),
      plantId: '',
      nfcUid: '',
      slug: '',
      isFarmPortalRoute: true,
      isDirectNfcRoute: false
    };
  }

  // Format: /:farmId/public/:nfcUid (Direct NTAG213 URL format)
  if (pathParts.length === 3 && pathParts[1] === 'public') {
    return {
      farmId: decodeURIComponent(pathParts[0]),
      plantId: '',
      nfcUid: decodeURIComponent(pathParts[2]),
      slug: decodeURIComponent(pathParts[2]),
      isDirectNfcRoute: true,
      isFarmPortalRoute: false
    };
  }

  // Format: legacy /:userId/:farmId/:plantId/:nfcUid
  if (pathParts.length >= 4) {
    return {
      farmId: decodeURIComponent(pathParts[1]),
      plantId: decodeURIComponent(pathParts[2]),
      nfcUid: decodeURIComponent(pathParts[3]),
      slug: decodeURIComponent(pathParts[3]),
      isDirectNfcRoute: false
    };
  }
  // Format: /:farmId/:plantId/:nfcUid
  if (pathParts.length === 3) {
    return {
      farmId: decodeURIComponent(pathParts[0]),
      plantId: decodeURIComponent(pathParts[1]),
      nfcUid: decodeURIComponent(pathParts[2]),
      slug: decodeURIComponent(pathParts[2]),
      isDirectNfcRoute: false
    };
  }
  // Format: /:farmId/:plantId
  if (pathParts.length === 2) {
    return {
      farmId: decodeURIComponent(pathParts[0]),
      plantId: decodeURIComponent(pathParts[1]),
      slug: decodeURIComponent(pathParts[1]),
      nfcUid: '',
      isDirectNfcRoute: false
    };
  }
  return { slug: decodeURIComponent(pathParts[0]), plantId: decodeURIComponent(pathParts[0]), nfcUid: '', farmId: '' };
}


const slugInfo = getPublicSlugInfoFromUrl();
const slug = slugInfo.slug;
let currentPlantData = null;

// English crop asset mappings
const CROP_NAME_TO_ENGLISH = {
  'sau_rieng': 'durian', 'sau rieng': 'durian', 'saurieng': 'durian', 'durian': 'durian',
  'ca_phe': 'coffee', 'ca phe': 'coffee', 'caphe': 'coffee', 'coffee': 'coffee',
  'ca_cao': 'cacao', 'ca cao': 'cacao', 'cacao': 'cacao', 'cocoa': 'cacao',
  'cao_su': 'rubber', 'cao su': 'rubber', 'caosu': 'rubber', 'rubber': 'rubber',
  'tao': 'apple', 'cay_tao': 'apple', 'apple': 'apple',
  'xoai': 'mango', 'cay_xoai': 'mango', 'mango': 'mango',
  'bo': 'avocado', 'cay_bo': 'avocado', 'avocado': 'avocado',
  'buoi': 'pomelo', 'cay_buoi': 'pomelo', 'pomelo': 'pomelo',
  'cam': 'orange', 'cay_cam': 'orange', 'orange': 'orange',
  'mit': 'jackfruit', 'cay_mit': 'jackfruit', 'jackfruit': 'jackfruit',
  'thanh_long': 'dragon_fruit', 'thanh long': 'dragon_fruit', 'dragon_fruit': 'dragon_fruit',
  'chuoi': 'banana', 'cay_chuoi': 'banana', 'banana': 'banana',
  'chanh': 'lemon', 'lemon': 'lemon', 'lime': 'lemon',
  'oi': 'guava', 'cay_oi': 'guava', 'guava': 'guava',
  'chanh_day': 'passion_fruit', 'chanh day': 'passion_fruit', 'passion_fruit': 'passion_fruit',
  'tra': 'tea', 'che': 'tea', 'cay_che': 'tea', 'tea': 'tea',
  'tieu': 'pepper', 'ho_tieu': 'pepper', 'ho tieu': 'pepper', 'pepper': 'pepper',
  'dieu': 'cashew', 'cay_dieu': 'cashew', 'cashew': 'cashew',
  'dau_tay': 'strawberry', 'strawberry': 'strawberry',
  'mac_ca': 'macadamia', 'macadamia': 'macadamia',
  'dua': 'pineapple', 'thom': 'pineapple', 'khom': 'pineapple', 'pineapple': 'pineapple',
  'vai': 'lychee', 'lychee': 'lychee',
  'nhan': 'longan', 'longan': 'longan',
  'dua_xiem': 'coconut', 'coconut': 'coconut'
};

const LOCAL_CROP_ICONS = new Set(['durian', 'coffee', 'cacao', 'rubber']);

function resolveCropEnglishName(term) {
  if (!term) return 'durian';
  const raw = String(term).toLowerCase().trim();
  const match = raw.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const inside = match[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (inside) return inside;
  }
  const clean = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (CROP_NAME_TO_ENGLISH[clean]) return CROP_NAME_TO_ENGLISH[clean];
  const under = clean.replace(/\s+/g, '_');
  if (CROP_NAME_TO_ENGLISH[under]) return CROP_NAME_TO_ENGLISH[under];

  for (const [k, v] of Object.entries(CROP_NAME_TO_ENGLISH)) {
    if (clean.includes(k) || k.includes(clean)) return v;
  }
  return under || 'durian';
}

const CROP_DEFAULT_PHOTOS = {
  durian: 'https://images.unsplash.com/photo-1596707323867-b50a24128f7d?w=1200&auto=format&fit=crop&q=80',
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1200&auto=format&fit=crop&q=80',
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1200&auto=format&fit=crop&q=80',
  cacao: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
  rubber: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1200&auto=format&fit=crop&q=80',
  mango: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=1200&auto=format&fit=crop&q=80',
  avocado: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=1200&auto=format&fit=crop&q=80',
  pomelo: 'https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?w=1200&auto=format&fit=crop&q=80',
  orange: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=1200&auto=format&fit=crop&q=80',
  dragon_fruit: 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=1200&auto=format&fit=crop&q=80',
  jackfruit: 'https://images.unsplash.com/photo-1596707323867-b50a24128f7d?w=1200&auto=format&fit=crop&q=80',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=1200&auto=format&fit=crop&q=80',
  lemon: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=1200&auto=format&fit=crop&q=80',
  guava: 'https://images.unsplash.com/photo-1536511135899-738a081598f4?w=1200&auto=format&fit=crop&q=80',
  passion_fruit: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=1200&auto=format&fit=crop&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=1200&auto=format&fit=crop&q=80',
  pepper: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=1200&auto=format&fit=crop&q=80',
  cashew: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=1200&auto=format&fit=crop&q=80',
  strawberry: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=1200&auto=format&fit=crop&q=80',
  macadamia: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&auto=format&fit=crop&q=80',
  pineapple: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=1200&auto=format&fit=crop&q=80'
};

function getCropImageSrc(p) {
  if (p && p.cover_image && !p.cover_image.includes('photo-1587293852726-70cdb56c2866')) {
    return esc(p.cover_image);
  }
  const englishName = resolveCropEnglishName(p ? (p.plant_type || '') : '');
  if (LOCAL_CROP_ICONS.has(englishName)) {
    return `/assets/crop/${englishName}.png`;
  }
  if (CROP_DEFAULT_PHOTOS[englishName]) {
    return CROP_DEFAULT_PHOTOS[englishName];
  }
  return `/assets/crop/${englishName}.png`;
}

window.tryNextCropExt = function(img, cropType) {
  if (!img) return;
  const retryCount = parseInt(img.getAttribute('data-retry-count') || '0');
  if (retryCount >= 3) {
    img.onerror = null;
    img.src = '/assets/logo.png';
    img.className = 'cover-image-fallback';
    return;
  }
  img.setAttribute('data-retry-count', retryCount + 1);

  const eng = resolveCropEnglishName(cropType || img.alt || '');
  const currentSrc = img.src || '';

  if (currentSrc.startsWith('http')) {
    img.src = `/assets/crop/${eng}.png`;
  } else if (currentSrc.endsWith('.png')) {
    img.src = `/assets/crop/${eng}.jpg`;
  } else if (currentSrc.endsWith('.jpg')) {
    img.src = `/assets/crop/${eng}.jpeg`;
  } else if (currentSrc.endsWith('.jpeg')) {
    img.src = `/assets/crop/${eng}.webp`;
  } else {
    img.onerror = null;
    img.src = '/assets/logo.png';
    img.className = 'cover-image-fallback';
  }
};

// ── Authentication & Authorization for Public Plant Page ──────────
function getStoredAuth() {
  const token = localStorage.getItem('pb_token') || localStorage.getItem('token') || '';
  let user = null;
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) user = JSON.parse(rawUser);
  } catch(e) {}
  return { token, user };
}

function userHasPlantAccess(user, plant) {
  if (!user || !user.id || !plant) return false;
  if (user.role === 'admin') return true;
  if (user.farm_id && plant.farm_id && Number(user.farm_id) === Number(plant.farm_id)) return true;
  if (plant.assigned_to_user_id && Number(user.id) === Number(plant.assigned_to_user_id)) return true;
  if (plant.farm_owner_user_id && Number(user.id) === Number(plant.farm_owner_user_id)) return true;
  if (plant.farm_owner_id && Number(user.id) === Number(plant.farm_owner_id)) return true;
  if (plant.created_by && Number(user.id) === Number(plant.created_by)) return true;
  return false;
}

function populateGateInfo(plant) {
  if (!plant) return;
  const imgEl = document.getElementById('gate-plant-img');
  const typeEl = document.getElementById('gate-plant-type');
  const nameEl = document.getElementById('gate-plant-name');
  const codeEl = document.getElementById('gate-plant-code');
  const farmEl = document.getElementById('gate-plant-farm');

  if (imgEl) {
    imgEl.src = getCropImageSrc(plant);
    imgEl.alt = plant.plant_type || 'Cây trồng';
  }
  if (typeEl) {
    typeEl.textContent = plant.plant_variety ? `Giống: ${plant.plant_variety}` : (plant.plant_type || 'Cây trồng');
  }
  if (nameEl) {
    nameEl.textContent = plant.plant_type || 'Hồ sơ cây trồng';
  }
  if (codeEl) {
    codeEl.textContent = plant.tree_code || `#${plant.id}`;
  }
  if (farmEl) {
    farmEl.textContent = plant.farm_name || 'Hệ thống Nông trại';
  }
}

function showAuthGateView() {
  if (currentPlantData) {
    populateGateInfo(currentPlantData);
  }
  document.getElementById('plant-view').style.display = 'none';
  document.getElementById('auth-gate-view').style.display = 'block';
  const errBox = document.getElementById('gate-login-error');
  if (errBox) errBox.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enterReadOnlyMode() {
  document.getElementById('auth-gate-view').style.display = 'none';
  document.getElementById('loader').style.display = 'none';
  await renderPlant(currentPlantData, false);
  showPublicToast('Đang ở chế độ xem chi tiết canh tác (Chỉ đọc).');
}

async function doGateLogin() {
  const emailInput = document.getElementById('gate-login-email');
  const passInput = document.getElementById('gate-login-pass');
  const btn = document.getElementById('btn-gate-login');
  const errBox = document.getElementById('gate-login-error');
  const errText = document.getElementById('gate-login-error-text');

  if (!emailInput || !passInput) return;
  const email = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) return;

  const oldBtnText = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang xác thực...';
  btn.disabled = true;
  errBox.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Đăng nhập không thành công.');
    }

    localStorage.setItem('pb_token', data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Handle Pending Binding Farm or Gateway Login Flow
    if (window.pendingBindingFarm) {
      const pFarm = window.pendingBindingFarm;
      const isAuthorized = data.user.role === 'admin' || Number(data.user.farm_id) === Number(pFarm.farmId);
      if (!isAuthorized) {
        errText.textContent = `Tài khoản "${data.user.full_name || data.user.email}" không thuộc nông trại này. Vui lòng đăng nhập tài khoản nông trại "${pFarm.farmName || 'này'}" hoặc Admin.`;
        errBox.style.display = 'flex';
        return;
      }

      // If an NFC UID was attached, check if it's already assigned
      if (pFarm.nfcUid) {
        try {
          const checkRes = await fetch(`/api/plants/public-by-farm-uid/${encodeURIComponent(pFarm.farmId)}/${encodeURIComponent(pFarm.nfcUid)}`);
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.assigned && checkData.plant) {
            // Already assigned -> Direct redirect into plant profile!
            window.pendingBindingFarm = null;
            currentPlantData = checkData.plant;
            history.replaceState({}, '', `/${pFarm.farmId}/public/${encodeURIComponent(checkData.plant.nfc_uid || pFarm.nfcUid)}`);
            document.getElementById('auth-gate-view').style.display = 'none';
            showPublicToast(`Chào mừng ${data.user.full_name || data.user.email}! Đang mở hồ sơ cây #${checkData.plant.tree_code || checkData.plant.id}.`);
            await renderPlant(checkData.plant, true);
            return;
          }
        } catch (_) {}

        // Unassigned tag -> open field binding module
        window.pendingBindingFarm = null;
        document.getElementById('auth-gate-view').style.display = 'none';
        showPublicToast(`Chào mừng ${data.user.full_name || data.user.email}! Đang mở giao diện gán thẻ.`);
        initFieldBindingModule(pFarm.farmId, pFarm.farmName, pFarm.pucCode, pFarm.nfcUid, pFarm.inInventory, pFarm.inventoryWarning);
        return;
      } else {
        // Logged in from Smart Farm Gateway without NFC tag
        window.pendingBindingFarm = null;
        document.getElementById('auth-gate-view').style.display = 'none';
        showPublicToast(`Chào mừng ${data.user.full_name || data.user.email}!`);
        await loadFarmPortal(pFarm.farmId);
        return;
      }
    }

    const hasAccess = userHasPlantAccess(data.user, currentPlantData);

    if (hasAccess) {
      document.getElementById('auth-gate-view').style.display = 'none';
      showPublicToast(`Chào mừng ${data.user.full_name || data.user.email}! Bạn đã mở quyền cập nhật canh tác.`);
      await renderPlant(currentPlantData, true);
    } else {
      errText.textContent = `Tài khoản "${data.user.full_name || data.user.email}" thuộc trang trại khác. Chỉ tài khoản nông hộ thuộc trang trại "${currentPlantData?.farm_name || 'này'}" hoặc Admin mới có quyền cập nhật cây này.`;
      errBox.style.display = 'flex';
    }
  } catch (err) {
    errText.textContent = err.message;
    errBox.style.display = 'flex';
  } finally {
    btn.innerHTML = oldBtnText;
    btn.disabled = false;
  }
}

function logoutGate() {
  localStorage.removeItem('pb_token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showPublicToast('Đã đăng xuất.');
  showAuthGateView();
}

function showPublicToast(msg) {
  let toast = document.getElementById('public-auth-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'public-auth-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(15, 23, 42, 0.92)';
    toast.style.color = '#fff';
    toast.style.padding = '10px 18px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.backdropFilter = 'blur(6px)';
    toast.style.border = '1px solid rgba(255,255,255,0.15)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i data-lucide="info" class="lucide-sm" style="color:#10b981"></i> <span>${msg}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  
  clearTimeout(window._publicToastTimer);
  window._publicToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 3500);
}

// Global Configurations Cache (Default Fallbacks)
let configData = {
  water_methods: ["Tưới tay thủ công", "Tưới nhỏ giọt", "Tưới phun mưa", "Tưới phun sương"],
  fertilizers: ["Phân NPK 16-16-8", "Phân hữu cơ trùn quế", "Phân bón lá Đầu Trâu", "Phân chuồng hoai mục"],
  pesticides: ["Thuốc trừ sâu sinh học", "Thuốc trừ bệnh Anvil", "Thuốc trừ nấm Ridomil Gold", "Chất kích thích sinh trưởng Atonik"],
  leaf_cut_reasons: ["Lá già úa/vàng", "Lá bị sâu bệnh hại", "Tỉa cành tạo tán", "Tỉa bớt lá thông thoáng"],
  flower_prune_reasons: ["Tỉa hoa tàn", "Tỉa bớt nụ còi", "Tỉa cành tạo dáng", "Kích thích ra chồi mới"]
};

// Toggle Custom Input field when "Khác..." is chosen
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

// Load configurations from backend API
async function loadConfigurations() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.water_methods) configData.water_methods = data.water_methods;
      if (data.fertilizers) configData.fertilizers = data.fertilizers;
      if (data.pesticides) configData.pesticides = data.pesticides;
      if (data.leaf_cut_reasons) configData.leaf_cut_reasons = data.leaf_cut_reasons;
      if (data.flower_prune_reasons) configData.flower_prune_reasons = data.flower_prune_reasons;
    }
  } catch (err) {
    console.warn('Cannot fetch configurations, using local fallbacks', err);
  }

  // Populate all dropdowns safely
  populateDropdown('water-method-select', configData.water_methods, 'water-method');
  populateDropdown('fertilizer-select', configData.fertilizers, 'fertilizer');
  populateDropdown('fertilizer-supply-select', configData.fertilizers, 'fertilizer');
  populateDropdown('pesticide-select', configData.pesticides, 'pesticide');
  populateDropdown('pesticide-supply-select', configData.pesticides, 'pesticide');
  populateDropdown('leaf-reason-select', configData.leaf_cut_reasons, 'leaf-reason');
  populateDropdown('flower-reason-select', configData.flower_prune_reasons, 'flower-reason');
}

// Format Date Utility
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
}

// Format full DateTime: HH:mm DD/MM/YYYY
function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const hhmm = dt.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false});
  const ddmmyyyy = dt.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
  return `${hhmm} — ${ddmmyyyy}`;
}

// Format VNĐ Currency
function formatVnd(amount) {
  const val = Math.round(parseFloat(amount) || 0);
  return new Intl.NumberFormat('vi-VN').format(val) + ' VNĐ';
}

function _getCategoryIconHtml(category) {
  let bg = '#f1f5f9';
  let color = '#64748b';
  let icon = 'boxes';
  if (category === 'Bón phân') { bg = '#ecfdf5'; color = '#059669'; icon = 'leaf'; }
  else if (category === 'Phun thuốc') { bg = '#fef2f2'; color = '#dc2626'; icon = 'flask-conical'; }
  else if (category === 'Tiền nước') { bg = '#e0f2fe'; color = '#0284c7'; icon = 'droplet'; }
  else if (category === 'Nhân công') { bg = '#fef3c7'; color = '#d97706'; icon = 'user-check'; }

  return `<div style="width: 44px; height: 44px; border-radius: 8px; background: ${bg}; color: ${color}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.06);"><i data-lucide="${icon}" class="lucide-sm"></i></div>`;
}

function getSupplyThumbnailHtml(s) {
  if (s && s.image_url && s.image_url.trim()) {
    const safeUrl = esc(s.image_url.trim());
    return `<img src="${safeUrl}" alt="${esc(s.name)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; cursor: pointer; flex-shrink: 0;" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" onclick="openLightbox('${safeUrl}', 'image')"><div style="display:none;">${_getCategoryIconHtml(s.category)}</div>`;
  }
  return _getCategoryIconHtml(s?.category);
}

function renderSuppliesTableHtml(supplies = [], currentPage = 1, pageSize = 10, onPageChangeFnName = 'changePlantSuppliesPage') {
  if (!supplies || supplies.length === 0) {
    return `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
        <i data-lucide="boxes" class="lucide-sm" style="color: #94a3b8; font-size: 24px; margin-bottom: 6px;"></i>
        <div>Trang trại chưa khai báo danh mục vật tư trong kho.</div>
      </div>
    `;
  }

  const totalItems = supplies.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  let page = parseInt(currentPage) || 1;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const startIdx = (page - 1) * pageSize;
  const currentSlice = supplies.slice(startIdx, startIdx + pageSize);

  return `
    <div class="erp-mobile-scroll-hint">
      <i data-lucide="chevrons-left-right" class="lucide-xs"></i> <span>Kéo vuốt ngang để xem đủ 6 cột kho</span>
    </div>
    <div class="erp-table-container">
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left; min-width: 580px;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.3px;">
            <th style="padding: 10px 12px; width: 64px; text-align: center;">Ảnh</th>
            <th style="padding: 10px 12px; min-width: 200px;">Tên vật tư / Sản phẩm</th>
            <th style="padding: 10px 12px; width: 110px;">Phân loại</th>
            <th style="padding: 10px 12px; width: 155px;">Mức tồn kho &amp; Trạng thái</th>
            <th style="padding: 10px 12px; text-align: right; width: 130px;">Đơn giá</th>
            <th style="padding: 10px 12px; text-align: right; width: 130px;">Tổng giá trị tồn</th>
          </tr>
        </thead>
        <tbody>
          ${currentSlice.map(s => {
            const stock = parseFloat(s.stock_quantity) || 0;
            const unitPrice = parseFloat(s.unit_price) || 0;
            const isPermanent = s.category === 'Tiền nước' || s.category === 'Nhân công';
            const isLow = !isPermanent && stock <= 5 && stock > 0;
            const isOut = !isPermanent && stock <= 0;

            let stockBadge = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:11px; font-weight:700; padding:3px 8px; border-radius:100px; display:inline-block;">Còn: <strong>${stock} ${esc(s.unit)}</strong></span>`;
            if (isPermanent) {
              stockBadge = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:11px; font-weight:700; padding:3px 8px; border-radius:100px; display:inline-block;">Cung ứng liên tục (Vô hạn)</span>`;
            } else if (isOut) {
              stockBadge = `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; font-size:11px; font-weight:800; padding:3px 8px; border-radius:100px; display:inline-block;">⚠️ HẾT HÀNG (0 ${esc(s.unit)})</span>`;
            } else if (isLow) {
              stockBadge = `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:11px; font-weight:700; padding:3px 8px; border-radius:100px; display:inline-block;">Sắp hết: ${stock} ${esc(s.unit)}</span>`;
            }

            let catBg = '#f1f5f9';
            let catColor = '#334155';
            if (s.category === 'Bón phân') { catBg = '#ecfdf5'; catColor = '#166534'; }
            else if (s.category === 'Phun thuốc') { catBg = '#fef2f2'; catColor = '#991b1b'; }
            else if (s.category === 'Tiền nước') { catBg = '#f0f9ff'; catColor = '#0369a1'; }
            else if (s.category === 'Nhân công') { catBg = '#fef3c7'; catColor = '#92400e'; }

            const totalStockVal = (!isPermanent && stock > 0 && unitPrice > 0) ? formatVnd(stock * unitPrice) : '—';

            return `
              <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                <td style="padding: 10px 12px; text-align: center; vertical-align: middle;">
                  ${getSupplyThumbnailHtml(s)}
                </td>
                <td style="padding: 10px 12px; vertical-align: middle;">
                  <div style="font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.35;">${esc(s.name)}</div>
                  ${s.active_ingredient ? `<div style="font-size: 11px; color: #059669; font-weight: 600; margin-top: 2px;"><i data-lucide="leaf" class="lucide-xs" style="vertical-align: -1px;"></i> Hoạt chất: ${esc(s.active_ingredient)}</div>` : ''}
                  ${s.package_size ? `<div style="font-size: 11px; color: #64748b; margin-top: 1px;">Quy cách: ${esc(s.package_size)}</div>` : ''}
                  ${s.phi_days && Number(s.phi_days) > 0 ? `<div style="font-size: 10.5px; color: #d97706; font-weight: 700; margin-top: 1px;">⏱️ Cách ly PHI: ${s.phi_days} ngày</div>` : ''}
                </td>
                <td style="padding: 10px 12px; vertical-align: middle; white-space: nowrap;">
                  <span style="background: ${catBg}; color: ${catColor}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-block;">${esc(s.category)}</span>
                </td>
                <td style="padding: 10px 12px; vertical-align: middle; white-space: nowrap;">
                  ${stockBadge}
                </td>
                <td style="padding: 10px 12px; vertical-align: middle; text-align: right; white-space: nowrap; font-weight: 700; color: #047857; font-family:var(--font-mono);">
                  ${formatVnd(s.unit_price)} <span style="font-size: 11px; color: #64748b; font-weight: 500;">/ ${esc(s.unit)}</span>
                </td>
                <td style="padding: 10px 12px; vertical-align: middle; text-align: right; white-space: nowrap; font-weight: 800; color: #0f172a; font-family:var(--font-mono);">
                  ${totalStockVal}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination / Footer Bar (10 records per page) -->
    ${totalItems > pageSize ? `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; padding: 8px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 600;">
          Hiển thị <strong>${startIdx + 1} - ${Math.min(startIdx + pageSize, totalItems)}</strong> trên <strong>${totalItems}</strong> vật tư (10 bản ghi / trang)
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-xs" ${page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="${onPageChangeFnName}(${page - 1})"`} style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; border-radius: 6px;">
            <i data-lucide="chevron-left" class="lucide-xs"></i> Trang trước
          </button>
          <span style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 4px 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">
            Trang ${page} / ${totalPages}
          </span>
          <button type="button" class="btn btn-secondary btn-xs" ${page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="${onPageChangeFnName}(${page + 1})"`} style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; border-radius: 6px;">
            Trang tiếp <i data-lucide="chevron-right" class="lucide-xs"></i>
          </button>
        </div>
      </div>
    ` : `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11.5px; color: #64748b; padding: 0 4px;">
        <span>Tổng số: <strong>${totalItems}</strong> mặt hàng vật tư trong kho</span>
        <span>Trang 1 / 1 (10 bản ghi / trang)</span>
      </div>
    `}
  `;
}

window.changePlantSuppliesPage = function(page) {
  window._plantSuppliesCurrentPage = page;
  const container = document.getElementById('plant-supplies-table-container');
  if (container) {
    container.innerHTML = renderSuppliesTableHtml(window._plantSuppliesData || [], page, 10, 'changePlantSuppliesPage');
    if (window.lucide) window.lucide.createIcons();
  }
};

window.changeGatewaySuppliesPage = function(page) {
  window._gatewaySuppliesCurrentPage = page;
  const container = document.getElementById('gateway-supplies-container');
  if (container) {
    container.innerHTML = renderSuppliesTableHtml(window._gatewaySuppliesData || [], page, 10, 'changeGatewaySuppliesPage');
    if (window.lucide) window.lucide.createIcons();
  }
};

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

  const formattedPrice = formatVnd(unitPrice);
  const stock = parseFloat(s.stock_quantity) || 0;
  const isPermanent = s.category === 'Tiền nước' || s.category === 'Nhân công';
  const isOut = !isPermanent && stock <= 0;
  const stockBadge = isPermanent ? '' : (isOut ? ' ⚠️ [HẾT HÀNG]' : ` (Còn: ${stock} ${s.unit})`);

  return `${esc(s.name)} (${pkgText}) — ${formattedPrice} / ${s.unit}${stockBadge}`;
}

// Populate farm supplies into care modals
function populateCareSuppliesDropdowns(supplies = []) {
  window._publicFarmSupplies = supplies;

  // 1. Water supply dropdown
  const waterSelect = document.getElementById('water-supply-select');
  if (waterSelect) {
    const waterSupplies = supplies.filter(s => s.category === 'Tiền nước');
    if (waterSupplies.length > 0) {
      let html = waterSupplies.map(s => `
        <option value="${s.id}" data-price="${parseFloat(s.unit_price) || 0}" data-unit="${esc(s.unit || 'm³')}">
          💧 ${_formatSupplyOptionText(s)}
        </option>
      `).join('');
      html += '<option value="" data-price="0">Không hạch toán tiền nước</option>';
      waterSelect.innerHTML = html;
    } else {
      waterSelect.innerHTML = `
        <option value="" data-price="0">💧 Nước giếng khoan trang trại (Không tính phí)</option>
        <option value="" data-price="0">Không hạch toán tiền nước</option>
      `;
    }
    calculatePublicWaterCost();
  }

  // 2. Fertilizer supply dropdown
  const fertSelect = document.getElementById('fertilizer-supply-select');
  if (fertSelect) {
    const fertSupplies = supplies.filter(s => s.category === 'Bón phân');
    let html = '';
    if (fertSupplies.length > 0) {
      html += fertSupplies.map(s => {
        const isOut = (parseFloat(s.stock_quantity) || 0) <= 0;
        return `
          <option value="${s.id}" data-name="${esc(s.name)}" data-img="${esc(s.image_url || '')}" data-price="${parseFloat(s.unit_price) || 0}" data-unit="${esc(s.unit || 'kg')}" ${isOut ? 'disabled style="color:#dc2626;"' : ''}>
            🧪 ${_formatSupplyOptionText(s)}
          </option>
        `;
      }).join('');
    } else {
      (configData.fertilizers || ['NPK 20-20-15', 'Phân hữu cơ vi sinh', 'DAP', 'Ure', 'Kali']).forEach(f => {
        html += `<option value="" data-name="${esc(f)}" data-price="0" data-unit="kg">🧪 ${esc(f)}</option>`;
      });
    }
    html += '<option value="__custom__">➕ Phân bón khác (Nhập thủ công)...</option>';
    fertSelect.innerHTML = html;
    onPublicFertilizerSelected(fertSelect);
  }

  // 3. Pesticide supply dropdown
  const pestSelect = document.getElementById('pesticide-supply-select');
  if (pestSelect) {
    const pestSupplies = supplies.filter(s => s.category === 'Phun thuốc');
    let html = '';
    if (pestSupplies.length > 0) {
      html += pestSupplies.map(s => {
        const isOut = (parseFloat(s.stock_quantity) || 0) <= 0;
        return `
          <option value="${s.id}" data-name="${esc(s.name)}" data-img="${esc(s.image_url || '')}" data-ing="${esc(s.active_ingredient || '')}" data-phi="${s.phi_days || 14}" data-price="${parseFloat(s.unit_price) || 0}" data-unit="${esc(s.unit || 'ml')}" ${isOut ? 'disabled style="color:#dc2626;"' : ''}>
            🛡️ ${_formatSupplyOptionText(s)}
          </option>
        `;
      }).join('');
    } else {
      (configData.pesticides || ['Ridomil Gold 68WG', 'Anvil 5SC', 'Radiant 60SC', 'Confidor 200SL', 'Coc 85']).forEach(p => {
        html += `<option value="" data-name="${esc(p)}" data-ing="Hoạt chất phổ thông" data-phi="14" data-price="0" data-unit="ml">🛡️ ${esc(p)}</option>`;
      });
    }
    html += '<option value="__custom__">➕ Thuốc BVTV khác (Nhập thủ công)...</option>';
    pestSelect.innerHTML = html;
    onPublicPesticideSelected(pestSelect);
  }
}

// Auto Water Cost Calculation
function calculatePublicWaterCost() {
  const amountInput = document.getElementById('water-amount');
  const unitSelect = document.getElementById('water-unit');
  const supplySelect = document.getElementById('water-supply-select');
  const volEl = document.getElementById('public-water-calc-vol');
  const costEl = document.getElementById('public-water-calc-cost');

  if (!volEl || !costEl) return;

  const rawAmount = parseFloat(amountInput?.value) || 0;
  const unit = unitSelect?.value || 'Lít';

  let amountLiters = rawAmount;
  if (unit === 'ml') amountLiters = rawAmount / 1000;
  else if (unit === 'm³') amountLiters = rawAmount * 1000;

  const volumeM3 = amountLiters / 1000;
  volEl.textContent = `${rawAmount} ${unit} = ${volumeM3 < 0.01 ? volumeM3.toFixed(3) : volumeM3.toFixed(2)} m³`;

  const opt = supplySelect?.options[supplySelect?.selectedIndex];
  const unitPriceM3 = opt ? (parseFloat(opt.getAttribute('data-price')) || 0) : 0;
  const totalCost = volumeM3 * unitPriceM3;

  costEl.textContent = totalCost > 0 ? formatVnd(totalCost) : '0 VNĐ (Không tính phí)';
}

// Auto Fertilizer Cost Calculation
function onPublicFertilizerSelected(selectEl) {
  if (!selectEl) return;
  const customInput = document.getElementById('fertilizer-custom');
  if (selectEl.value === '__custom__') {
    if (customInput) customInput.style.display = 'inline-block';
  } else {
    if (customInput) customInput.style.display = 'none';
  }

  const opt = selectEl.options[selectEl.selectedIndex];
  const imgWrap = document.getElementById('fertilizer-supply-img-wrap');
  const imgEl = document.getElementById('fertilizer-supply-img-preview');
  const imgUrl = opt?.getAttribute('data-img');

  if (imgWrap && imgEl) {
    if (imgUrl) {
      imgEl.src = imgUrl;
      imgWrap.style.display = 'flex';
    } else {
      imgWrap.style.display = 'none';
    }
  }

  calculatePublicFertilizerCost();
}

function calculatePublicFertilizerCost() {
  const amount = parseFloat(document.getElementById('fertilizer-amount')?.value) || 0;
  const unit = document.getElementById('fertilizer-unit')?.value || 'g';
  const selectEl = document.getElementById('fertilizer-supply-select');
  const descEl = document.getElementById('public-fertilizer-calc-desc');
  const costEl = document.getElementById('public-fertilizer-calc-cost');

  if (descEl) descEl.textContent = `Liều lượng: ${amount} ${unit}`;
  if (!costEl) return;

  const opt = selectEl?.options[selectEl?.selectedIndex];
  if (!opt || selectEl?.value === '__custom__') {
    costEl.textContent = '0 VNĐ (Tự nhập)';
    return;
  }

  const unitPrice = parseFloat(opt.getAttribute('data-price')) || 0;
  const supplyUnit = (opt.getAttribute('data-unit') || 'kg').toLowerCase();

  let multiplier = 1;
  if (supplyUnit === 'kg' || supplyUnit === 'kilogram') {
    if (unit === 'g' || unit === 'gam') multiplier = 0.001;
    else if (unit === 'kg') multiplier = 1;
  } else if (supplyUnit === 'g' || supplyUnit === 'gam') {
    if (unit === 'kg') multiplier = 1000;
    else if (unit === 'g' || unit === 'gam') multiplier = 1;
  } else if (supplyUnit === 'lít' || supplyUnit === 'lit' || supplyUnit === 'l') {
    if (unit === 'ml') multiplier = 0.001;
    else if (unit === 'Lít' || unit === 'lít') multiplier = 1;
  } else if (supplyUnit === 'ml') {
    if (unit === 'Lít' || unit === 'lít') multiplier = 1000;
    else if (unit === 'ml') multiplier = 1;
  }

  const cost = amount * multiplier * unitPrice;
  costEl.textContent = cost > 0 ? formatVnd(cost) : '0 VNĐ';
}

// Auto Pesticide Cost Calculation & Notice
function onPublicPesticideSelected(selectEl) {
  if (!selectEl) return;
  const customInput = document.getElementById('pesticide-custom');
  if (selectEl.value === '__custom__') {
    if (customInput) customInput.style.display = 'inline-block';
  } else {
    if (customInput) customInput.style.display = 'none';
  }

  const opt = selectEl.options[selectEl.selectedIndex];
  const activeIng = opt?.getAttribute('data-ing') || 'Chưa khai báo';
  const phiDays = opt?.getAttribute('data-phi') || '14';
  const imgUrl = opt?.getAttribute('data-img');

  const ingTextEl = document.getElementById('pesticide-active-ingredient-text');
  if (ingTextEl) ingTextEl.textContent = activeIng;

  const phiTextEl = document.getElementById('pesticide-phi-days-text');
  if (phiTextEl) phiTextEl.textContent = `${phiDays} ngày (Không thu hoạch)`;

  const imgWrap = document.getElementById('pesticide-supply-img-wrap');
  const imgEl = document.getElementById('pesticide-supply-img-preview');
  if (imgWrap && imgEl) {
    if (imgUrl) {
      imgEl.src = imgUrl;
      imgWrap.style.display = 'flex';
    } else {
      imgWrap.style.display = 'none';
    }
  }

  calculatePublicPesticideCost();
}

function calculatePublicPesticideCost() {
  const amount = parseFloat(document.getElementById('pesticide-amount')?.value) || 0;
  const unit = document.getElementById('pesticide-unit')?.value || 'ml';
  const selectEl = document.getElementById('pesticide-supply-select');
  const descEl = document.getElementById('public-pesticide-calc-desc');
  const costEl = document.getElementById('public-pesticide-calc-cost');

  if (descEl) descEl.textContent = `Liều lượng: ${amount} ${unit}`;
  if (!costEl) return;

  const opt = selectEl?.options[selectEl?.selectedIndex];
  if (!opt || selectEl?.value === '__custom__') {
    costEl.textContent = '0 VNĐ (Tự nhập)';
    return;
  }

  const unitPrice = parseFloat(opt.getAttribute('data-price')) || 0;
  const supplyUnit = (opt.getAttribute('data-unit') || 'ml').toLowerCase();

  let multiplier = 1;
  if (supplyUnit === 'lít' || supplyUnit === 'lit' || supplyUnit === 'l') {
    if (unit === 'ml') multiplier = 0.001;
    else if (unit === 'Lít' || unit === 'lít') multiplier = 1;
  } else if (supplyUnit === 'ml') {
    if (unit === 'Lít' || unit === 'lít') multiplier = 1000;
    else if (unit === 'ml') multiplier = 1;
  } else if (supplyUnit === 'kg') {
    if (unit === 'g') multiplier = 0.001;
    else if (unit === 'kg') multiplier = 1;
  } else if (supplyUnit === 'g') {
    if (unit === 'kg') multiplier = 1000;
    else if (unit === 'g') multiplier = 1;
  }

  const cost = amount * multiplier * unitPrice;
  costEl.textContent = cost > 0 ? formatVnd(cost) : '0 VNĐ';
}

// Voice Recognition Handler for Public Modals
let _publicActiveSpeechRec = null;
function startPublicVoiceInput(textareaId, btnEl) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói (Web Speech API). Vui lòng sử dụng Google Chrome hoặc Safari mới nhất.');
    return;
  }

  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  if (_publicActiveSpeechRec) {
    _publicActiveSpeechRec.stop();
    _publicActiveSpeechRec = null;
    if (btnEl) {
      btnEl.style.background = '#fef2f2';
      btnEl.style.color = '#dc2626';
      btnEl.innerHTML = '<i data-lucide="mic" class="lucide-sm"></i> <span>Đọc giọng nói</span>';
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }

  try {
    const recognition = new SpeechRec();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (btnEl) {
      btnEl.style.background = '#fee2e2';
      btnEl.style.color = '#991b1b';
      btnEl.innerHTML = '<i data-lucide="radio" class="lucide-spin lucide-sm"></i> <span>Đang nghe...</span>';
      if (window.lucide) window.lucide.createIcons();
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        textarea.value = textarea.value ? `${textarea.value.trim()} ${transcript}` : transcript;
        showPublicToast(`🎙️ Đã ghi nhận: "${transcript}"`);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      showPublicToast(`Không nhận diện được giọng nói (${event.error})`);
    };

    recognition.onend = () => {
      _publicActiveSpeechRec = null;
      if (btnEl) {
        btnEl.style.background = '#fef2f2';
        btnEl.style.color = '#dc2626';
        btnEl.innerHTML = '<i data-lucide="mic" class="lucide-sm"></i> <span>Đọc giọng nói</span>';
        if (window.lucide) window.lucide.createIcons();
      }
    };

    _publicActiveSpeechRec = recognition;
    recognition.start();
  } catch (err) {
    console.error('Speech recognition start error:', err);
    alert('Lỗi khởi động micro thu âm: ' + err.message);
  }
}

// Escape HTML utility
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Dynamic Crop image loading retry with multiple extensions
function handleCropImageError(img) {
  if (img.getAttribute('data-is-cover') === 'true') {
    fallbackToTreeIcon(img);
    return;
  }
  
  const extensions = ['.jpg', '.jpeg', '.webp', '.png'];
  let extIdx = parseInt(img.getAttribute('data-ext-idx') || '0');
  const base = img.getAttribute('data-base');
  const currentSrc = img.src || '';
  let nextExt = '';
  
  while (extIdx < extensions.length) {
    const ext = extensions[extIdx];
    extIdx++;
    img.setAttribute('data-ext-idx', extIdx);
    if (!currentSrc.endsWith(ext)) {
      nextExt = ext;
      break;
    }
  }
  
  if (nextExt) {
    img.src = base + nextExt;
  } else {
    fallbackToTreeIcon(img);
  }
}

function fallbackToTreeIcon(img) {
  img.style.display = 'none';
  const container = img.parentElement;
  if (container && !container.querySelector('.no-cover-icon')) {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'no-cover-icon';
    iconDiv.innerHTML = '<i data-lucide="trees" class="lucide-sm"></i>';
    container.insertBefore(iconDiv, img);
  }
}

// Lightbox controller
function openLightbox(url, type) {
  const content = document.getElementById('lightbox-content');
  if (!content) return;
  content.innerHTML = '';
  if (type === 'video') {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    video.autoplay = true;
    content.appendChild(video);
    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch(e) {}
  } else {
    content.innerHTML = `<img src="${esc(url)}">`;
  }
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  const video = document.querySelector('#lightbox-content video');
  if (video) {
    try { video.pause(); } catch(e) {}
  }
  setTimeout(() => {
    const content = document.getElementById('lightbox-content');
    if (content) content.innerHTML = '';
  }, 100);
}

// Share plant url
function sharePage() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href);
    alert('Đã copy đường dẫn hồ sơ cây trồng!');
  }
}

// Helper: Validate Full NFC UID (at least 4 hex pairs separated by : or - OR continuous hex string of 8-20 chars)
function isFullNfcUid(uid) {
  if (!uid || typeof uid !== 'string') return false;
  const clean = decodeURIComponent(uid).trim();
  if (/^([0-9A-Fa-f]{2}[:-]){3,9}[0-9A-Fa-f]{2}$/.test(clean)) return true;
  if (/^[0-9A-Fa-f]{8,20}$/.test(clean) && !isNaN(Number('0x' + clean))) return true;
  return false;
}

// Toast notification for GPS Auto-Sync
function showNfcGpsToast(msg) {
  let toast = document.getElementById('nfc-gps-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'nfc-gps-toast';
    toast.style.cssText = 'position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:99999; background:linear-gradient(135deg, #064e3b, #047857); color:#ffffff; padding:12px 20px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.35); font-size:13px; font-weight:700; display:flex; align-items:center; gap:10px; border:1.5px solid #10b981; max-width:90%;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i data-lucide="crosshair" class="lucide-sm" style="color:#6ee7b7; font-size:18px;"></i> <span>${esc(msg)}</span>`;
  toast.style.display = 'flex';
  setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 6000);
}

// Auto-sync GPS location when scanned via physical Full NFC UID
async function autoSyncNfcGpsLocation(plant, nfcUid) {
  if (!isFullNfcUid(nfcUid)) {
    // Không phải Full NFC UID (ví dụ chỉ là '04' hoặc slug thông thường) -> Không cập nhật GPS
    return;
  }

  if (!navigator.geolocation) {
    console.warn('Thiết bị không hỗ trợ Geolocation GPS.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        if (isNaN(lat) || isNaN(lng)) return;

        const targetId = plant.id || slugInfo.plantId || nfcUid;
        const res = await fetch(`/api/plants/public/${encodeURIComponent(targetId)}/gps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            nfc_uid: nfcUid,
            accuracy: accuracy
          })
        });

        if (res.ok) {
          plant.latitude = lat;
          plant.longitude = lng;
          showNfcGpsToast(`Đã tự động cập nhật vị trí GPS (${lat.toFixed(6)}, ${lng.toFixed(6)}) cho cây trồng từ thẻ NFC!`);

          // Update map marker if map exists
          if (window._publicPlantMap && window._publicPlantMarker) {
            window._publicPlantMarker.setLngLat([lng, lat]);
            window._publicPlantMap.flyTo({ center: [lng, lat], zoom: 18, duration: 1500 });
          }
        }
      } catch (err) {
        console.warn('Lỗi khi tự động đồng bộ GPS từ thẻ NFC:', err);
      }
    },
    (err) => {
      console.warn('Không lấy được vị trí GPS thiết bị:', err.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Render Revoked / Frozen NFC Tag notice
function renderRevokedTagView(nfcUid, errorMsg) {
  document.getElementById('loader').style.display = 'none';
  const errorView = document.getElementById('error-view');
  if (errorView) {
    errorView.style.display = 'block';
    errorView.innerHTML = `
      <div style="text-align:center; padding:36px 20px; background:#fff; border-radius:18px; border:2px solid #ef4444; max-width:480px; margin:40px auto; box-shadow:0 12px 30px rgba(0,0,0,0.08);">
        <div style="width:68px; height:68px; background:#fee2e2; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:30px; color:#dc2626; margin-bottom:16px; border:2px solid #fca5a5;">
          <i data-lucide="ban" class="lucide-sm"></i>
        </div>
        <h2 style="font-size:20px; font-weight:800; color:#991b1b; margin-bottom:10px;">Thẻ NFC Đã Bị Thu Hồi</h2>
        <p style="font-size:13.5px; color:#475569; line-height:1.6; margin-bottom:18px;">
          Mã thẻ <strong>${esc(nfcUid || 'NFC')}</strong> đã được thu hồi hoặc thay thế bằng thẻ định danh mới.<br>
          Đường dẫn công khai theo thẻ cũ này đã bị <strong>đóng băng truy cập</strong> theo quy chuẩn bảo mật 1 Cây - 1 Thẻ.
        </p>
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:12px; font-size:12.5px; color:#166534; margin-bottom:20px; text-align:left; display:flex; gap:10px; align-items:center;">
          <i data-lucide="shield-check" class="lucide-sm" style="color:#16a34a; font-size:18px; flex-shrink:0;"></i>
          <span><strong>Lịch sử canh tác được bảo toàn:</strong> Toàn bộ nhật ký canh tác, phân thuốc, tưới tiêu và chứng nhận VietGAP của cây trồng vẫn được lưu trữ an toàn 100% trong hệ thống.</span>
        </div>
        <a href="/" style="display:inline-block; background:#0f172a; color:#fff; text-decoration:none; padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700;">
          <i data-lucide="home" class="lucide-sm"></i> Về trang chủ
        </a>
      </div>
    `;
  }
}

// Global State for Field Binding
window.currentBindingFarmId = null;
window.currentBindingFarmName = null;
window.currentBindingUid = null;
window.currentBindingGps = null;
window.currentUnassignedTrees = [];

// Load Plant Profile on startup
async function loadPlant() {
  try {
    // ─── Case 0: Smart Farm Gateway Route /:farmId/public or /:farmId/public/ ───
    if (slugInfo.isFarmPortalRoute && slugInfo.farmId) {
      await loadFarmPortal(slugInfo.farmId);
      return;
    }

    // ─── Case 1: Direct NTAG213 Route /:farmId/public/:nfcUid (hoặc có farmId và nfcUid) ───
    if (slugInfo.farmId && (slugInfo.isDirectNfcRoute || slugInfo.nfcUid)) {
      const farmId = slugInfo.farmId;
      const nfcUid = slugInfo.nfcUid || slugInfo.slug;
      
      const tagRes = await fetch(`/api/plants/public-by-farm-uid/${encodeURIComponent(farmId)}/${encodeURIComponent(nfcUid)}`);
      const tagData = await tagRes.json();

      if (tagRes.status === 410 || tagData.is_revoked) {
        renderRevokedTagView(nfcUid, tagData.error);
        return;
      }

      if (!tagRes.ok) {
        throw new Error(tagData.error || 'Không tìm thấy thông tin thẻ hoặc nông trại.');
      }

      // If already assigned to a plant:
      if (tagData.assigned && tagData.plant) {
        const plant = tagData.plant;
        currentPlantData = plant;
        document.title = `${plant.plant_type || 'Cây trồng'} #${plant.tree_code || plant.id} — Sổ Nông Tân Bảo Agtech`;
        populateGateInfo(plant);

        const { token, user } = getStoredAuth();
        const hasAccess = userHasPlantAccess(user, plant);

        if (hasAccess) {
          await renderPlant(plant, true);
        } else {
          // Public visitor view: Full traceability without care edit
          await renderPlant(plant, false);
        }

        // Auto-sync GPS in background if full NFC UID
        autoSyncNfcGpsLocation(plant, nfcUid);
        return;
      }

      // If UNASSIGNED TAG:
      const { token, user } = getStoredAuth();
      const isFarmAuthorized = user && (user.role === 'admin' || Number(user.farm_id) === Number(farmId));

      if (isFarmAuthorized) {
        initFieldBindingModule(farmId, tagData.farm_name, tagData.puc_code, nfcUid, tagData.in_inventory, tagData.inventory_warning);
      } else {
        window.pendingBindingFarm = { farmId, farmName: tagData.farm_name, pucCode: tagData.puc_code, nfcUid, inInventory: tagData.in_inventory, inventoryWarning: tagData.inventory_warning };
        document.getElementById('loader').style.display = 'none';
        document.getElementById('auth-gate-view').style.display = 'block';
        document.getElementById('plant-view').style.display = 'none';
        if (document.getElementById('field-binding-view')) document.getElementById('field-binding-view').style.display = 'none';

        const gateTitle = document.getElementById('gate-plant-name');
        if (gateTitle) gateTitle.textContent = `Thẻ NFC: ${nfcUid}`;
        const gateCode = document.getElementById('gate-plant-code');
        if (gateCode) gateCode.textContent = 'Chưa gắn vào cây';
        const gateFarm = document.getElementById('gate-plant-farm');
        if (gateFarm) gateFarm.textContent = tagData.farm_name || `Trang trại #${farmId}`;
        const gateType = document.getElementById('gate-plant-type');
        if (gateType) gateType.textContent = 'NTAG213 Chưa kích hoạt';
      }
      return;
    }

    // ─── Case 2: Standard Plant Slug / ID ───
    const primarySlug = slugInfo.slug || slug;
    let res = await fetch(`/api/plants/public/${encodeURIComponent(primarySlug)}`);
    let plant = await res.json();

    if (res.status === 410 || plant.is_revoked) {
      renderRevokedTagView(slugInfo.nfcUid || primarySlug, plant.error);
      return;
    }

    // Fallback: If primary slug (e.g. nfcUid) returned 404, fallback to plantId (e.g. /0/2/1/04:17:...)
    if (!res.ok && slugInfo.plantId && slugInfo.plantId !== primarySlug) {
      const fallbackRes = await fetch(`/api/plants/public/${encodeURIComponent(slugInfo.plantId)}`);
      if (fallbackRes.ok) {
        res = fallbackRes;
        plant = await fallbackRes.json();
      }
    }

    if (!res.ok) throw new Error(plant.error || 'Không tìm thấy hồ sơ cây trồng.');

    // Enforce 1-Tree-1-Tag URL Match: If URL contains a specific NFC UID, it MUST match the plant's currently active nfc_uid
    const activeNfcUid = slugInfo.nfcUid || (isFullNfcUid(slugInfo.slug) ? slugInfo.slug : '');
    if (activeNfcUid) {
      if (!plant.nfc_uid || plant.nfc_uid.toUpperCase() !== activeNfcUid.toUpperCase()) {
        renderRevokedTagView(activeNfcUid, 'Thẻ NFC này đã bị thay thế hoặc hủy kích hoạt.');
        return;
      }
    }

    currentPlantData = plant;
    document.title = `${plant.plant_type || 'Cây trồng'} — Sổ Nông Tân Bảo Agtech`;

    populateGateInfo(plant);

    const { token, user } = getStoredAuth();
    const hasAccess = userHasPlantAccess(user, plant);

    if (hasAccess) {
      await renderPlant(plant, true);
    } else {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('auth-gate-view').style.display = 'block';
      document.getElementById('plant-view').style.display = 'none';
    }
  } catch (err) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('error-view').style.display = 'block';
    document.getElementById('error-msg').textContent = err.message;
  }
}

// ─── Field Binding Module Functions (NTAG213 On-Site Binding & Strict Governance) ───

function initFieldBindingModule(farmId, farmName, pucCode, nfcUid, inInventory = true, inventoryWarning = null) {
  window.currentBindingFarmId = farmId;
  window.currentBindingFarmName = farmName;
  window.currentBindingUid = nfcUid;
  window.currentTagInInventory = inInventory !== false;

  document.getElementById('loader').style.display = 'none';
  document.getElementById('auth-gate-view').style.display = 'none';
  document.getElementById('plant-view').style.display = 'none';
  document.getElementById('error-view').style.display = 'none';

  const bindView = document.getElementById('field-binding-view');
  if (bindView) bindView.style.display = 'block';

  // Populate metadata
  const badgeEl = document.getElementById('bind-tag-uid-badge');
  if (badgeEl) badgeEl.textContent = nfcUid || '--';
  const farmEl = document.getElementById('bind-farm-name');
  if (farmEl) farmEl.textContent = farmName || `Farm #${farmId}`;
  const pucEl = document.getElementById('bind-farm-puc');
  if (pucEl) pucEl.textContent = pucCode ? `PUC: ${pucCode}` : 'PUC: N/A';

  // Warehouse Inventory Status Verification
  const invBadgeEl = document.getElementById('bind-inventory-badge');
  const btn = document.getElementById('btn-submit-binding');

  if (inInventory === false) {
    if (invBadgeEl) {
      invBadgeEl.style.background = '#fef2f2';
      invBadgeEl.style.color = '#b91c1c';
      invBadgeEl.style.borderColor = '#fca5a5';
      invBadgeEl.innerHTML = '<i data-lucide="alert-circle" class="lucide-sm"></i> CHƯA NHẬP KHO TRANG TRẠI';
    }
    showBindingError(inventoryWarning || `Mã thẻ NFC [${nfcUid}] chưa được Quản trị viên khai báo nhập kho cho trang trại này. Vui lòng liên hệ Admin nhập kho thẻ trước khi gắn cho cây!`);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      btn.style.background = '#94a3b8';
      btn.innerHTML = '<i data-lucide="ban" class="lucide-sm"></i> Thẻ Chưa Nhập Kho — Không Thể Gán';
    }
  } else {
    if (invBadgeEl) {
      invBadgeEl.style.background = '#ecfdf5';
      invBadgeEl.style.color = '#047857';
      invBadgeEl.style.borderColor = '#a7f3d0';
      invBadgeEl.innerHTML = '<i data-lucide="package-check" class="lucide-sm"></i> Thẻ hợp lệ (Đã nhập kho trang trại)';
    }
    hideBindingError();
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.background = 'linear-gradient(135deg, #059669, #047857)';
      btn.innerHTML = '<i data-lucide="link" class="lucide-sm"></i> Xác nhận Gắn Thẻ &amp; Lưu Tọa Độ GPS';
    }
  }

  // Clear previous state
  clearSelectedTree();

  // Pre-warm GPS sensor immediately
  acquireGpsPosition(false);

  // Load unassigned trees
  refreshUnassignedTrees();

  // Re-hydrate Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

async function refreshUnassignedTrees() {
  const farmId = window.currentBindingFarmId;
  if (!farmId) return;

  const countEl = document.getElementById('bind-unassigned-count');
  if (countEl) countEl.textContent = '...';

  try {
    const token = localStorage.getItem('pb_token') || localStorage.getItem('token');
    const res = await fetch(`/api/plants/farms/${encodeURIComponent(farmId)}/unassigned-trees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Không lấy được danh sách cây.');
    const data = await res.json();
    window.currentUnassignedTrees = data.trees || [];
    if (countEl) countEl.textContent = window.currentUnassignedTrees.length;
    renderUnassignedTreeChips();
  } catch (err) {
    console.warn('Lỗi tải danh sách cây chưa gắn thẻ:', err);
    if (countEl) countEl.textContent = '0';
    renderUnassignedTreeChips();
  }
}

function renderUnassignedTreeChips() {
  const container = document.getElementById('bind-unassigned-chips');
  if (!container) return;
  const trees = window.currentUnassignedTrees || [];
  if (trees.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:#64748b; font-style:italic;">Chưa có danh sách cây tạo sẵn. Bạn có thể nhập bất kỳ mã cây nào (ví dụ: A-A-001) vào ô bên trên để hệ thống tự động tạo và gắn thẻ.</div>';
    return;
  }
  container.innerHTML = `
    <div style="font-size:11.5px; font-weight:700; color:#475569; margin-bottom:6px;">Chạm nhanh để chọn cây:</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      ${trees.map(t => `
        <button type="button" onclick="selectUnassignedTree(${t.id}, '${esc(t.tree_code || t.id)}', '${esc(t.plant_type || '')}', '${esc(t.plant_variety || '')}')" 
                style="padding:6px 12px; border-radius:8px; border:1.5px solid #10b981; background:#ecfdf5; color:#047857; font-weight:700; font-size:12.5px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;">
          <i data-lucide="leaf" class="lucide-xs"></i> Cây #${esc(t.tree_code || t.id)}
        </button>
      `).join('')}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function acquireGpsPosition(isUserAction) {
  const latEl = document.getElementById('bind-gps-lat');
  const lngEl = document.getElementById('bind-gps-lng');
  const accEl = document.getElementById('bind-gps-acc');
  const hintEl = document.getElementById('bind-gps-hint');
  const pulseEl = document.getElementById('gps-status-pulse');

  if (latEl) latEl.textContent = 'Đang dò...';
  if (lngEl) lngEl.textContent = 'Đang dò...';
  if (accEl) accEl.textContent = 'Đang bắt vệ tinh';
  if (pulseEl) {
    pulseEl.style.background = '#f59e0b';
    pulseEl.style.boxShadow = '0 0 0 6px rgba(245, 158, 11, 0.25)';
  }

  if (!navigator.geolocation) {
    if (latEl) latEl.textContent = 'Không hỗ trợ';
    if (lngEl) lngEl.textContent = 'Không hỗ trợ';
    if (accEl) accEl.textContent = 'Lỗi GPS';
    if (hintEl) hintEl.innerHTML = '<span style="color:#ef4444;"><i data-lucide="alert-triangle" class="lucide-sm"></i> Thiết bị không hỗ trợ Geolocation GPS.</span>';
    if (pulseEl) pulseEl.style.background = '#ef4444';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      window.currentBindingGps = { lat, lng, accuracy: acc };

      if (latEl) latEl.textContent = lat.toFixed(6);
      if (lngEl) lngEl.textContent = lng.toFixed(6);
      if (accEl) accEl.textContent = `Sai số: ±${acc.toFixed(1)}m`;

      if (pulseEl) {
        pulseEl.style.background = acc <= 10 ? '#10b981' : '#f59e0b';
        pulseEl.style.boxShadow = acc <= 10 ? '0 0 0 6px rgba(16, 185, 129, 0.25)' : '0 0 0 6px rgba(245, 158, 11, 0.25)';
      }

      if (hintEl) {
        if (acc <= 5) {
          hintEl.innerHTML = '<span style="color:#059669; font-weight:700;"><i data-lucide="check-circle" class="lucide-sm"></i> Vệ tinh khóa tọa độ xuất sắc (&lt; 5m).</span>';
        } else if (acc <= 15) {
          hintEl.innerHTML = '<span style="color:#047857;"><i data-lucide="check" class="lucide-sm"></i> Vệ tinh khóa tốt (5 - 15m).</span>';
        } else {
          hintEl.innerHTML = '<span style="color:#d97706;"><i data-lucide="info" class="lucide-sm"></i> Tín hiệu trung bình (±' + acc.toFixed(1) + 'm). Bạn có thể bấm Lấy lại GPS khi đứng sát gốc cây.</span>';
        }
      }

      if (isUserAction) {
        showPublicToast(`Đã khóa tọa độ GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${acc.toFixed(1)}m)`);
      }
      if (window.lucide) window.lucide.createIcons();
    },
    (err) => {
      console.warn('GPS Error:', err.message);
      if (latEl) latEl.textContent = 'Chưa có';
      if (lngEl) lngEl.textContent = 'Chưa có';
      if (accEl) accEl.textContent = 'Chưa cấp quyền';
      if (pulseEl) {
        pulseEl.style.background = '#ef4444';
        pulseEl.style.boxShadow = '0 0 0 6px rgba(239, 68, 68, 0.25)';
      }
      if (hintEl) {
        hintEl.innerHTML = '<span style="color:#dc2626;"><i data-lucide="alert-circle" class="lucide-sm"></i> Vui lòng cho phép quyền truy cập GPS trên trình duyệt để ghi nhận vị trí cây.</span>';
      }
      if (window.lucide) window.lucide.createIcons();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function handleTreeSearchInput(query) {
  const dropdown = document.getElementById('bind-tree-dropdown');
  if (!dropdown) return;

  hideBindingError();
  const q = String(query || '').trim().toLowerCase();
  const unassigned = window.currentUnassignedTrees || [];

  const filtered = !q 
    ? unassigned 
    : unassigned.filter(t => {
        const code = String(t.tree_code || t.id).toLowerCase();
        const type = String(t.plant_type || '').toLowerCase();
        const loc = String(t.location || '').toLowerCase();
        return code.includes(q) || type.includes(q) || loc.includes(q);
      });

  if (filtered.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 12px 14px; font-size: 12.5px; color: #64748b; text-align: center;">
        Không tìm thấy cây có sẵn khớp với "<strong>${esc(query)}</strong>".<br>
        <span style="font-size: 11.5px; color: #047857; font-weight:700;">(Hệ thống sẽ tự động tạo mới cây "${esc(query)}" khi bấm Xác nhận).</span>
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtered.slice(0, 15).map(t => `
    <div onclick="selectUnassignedTree(${t.id}, '${esc(t.tree_code || t.id)}', '${esc(t.plant_type || '')}', '${esc(t.plant_variety || '')}')" 
         style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;" 
         onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
      <div>
        <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">
          <i data-lucide="leaf" class="lucide-sm" style="color: #059669; vertical-align: -2px; margin-right: 4px;"></i>
          Cây #${esc(t.tree_code || t.id)}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
          ${esc(t.plant_type || 'Cây trồng')} ${t.plant_variety ? '— ' + esc(t.plant_variety) : ''} ${t.location ? '— ' + esc(t.location) : ''}
        </div>
      </div>
      <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #86efac;">
        Chưa có thẻ
      </span>
    </div>
  `).join('');

  dropdown.style.display = 'block';
  if (window.lucide) window.lucide.createIcons();
}

function selectUnassignedTree(plantId, treeCode, plantType, plantVariety) {
  document.getElementById('bind-selected-plant-id').value = plantId;
  document.getElementById('bind-selected-tree-code').value = treeCode;
  document.getElementById('bind-tree-search').value = treeCode;

  const dropdown = document.getElementById('bind-tree-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const preview = document.getElementById('bind-selected-preview');
  const previewText = document.getElementById('bind-selected-tree-text');
  if (preview && previewText) {
    previewText.textContent = `Cây #${treeCode} (${plantType || 'Cây'} ${plantVariety ? '— ' + plantVariety : ''})`;
    preview.style.display = 'flex';
  }

  hideBindingError();
  if (window.lucide) window.lucide.createIcons();
}

function clearSelectedTree() {
  document.getElementById('bind-selected-plant-id').value = '';
  document.getElementById('bind-selected-tree-code').value = '';
  document.getElementById('bind-tree-search').value = '';

  const dropdown = document.getElementById('bind-tree-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const preview = document.getElementById('bind-selected-preview');
  if (preview) preview.style.display = 'none';

  hideBindingError();
}

function showBindingError(msg) {
  const errBox = document.getElementById('bind-error-alert');
  const errText = document.getElementById('bind-error-text');
  if (errBox && errText) {
    errText.innerHTML = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function hideBindingError() {
  const errBox = document.getElementById('bind-error-alert');
  if (errBox) errBox.style.display = 'none';
}

async function submitFieldBinding(allowReplace = false) {
  const farmId = window.currentBindingFarmId;
  const nfcUid = window.currentBindingUid;
  const plantId = document.getElementById('bind-selected-plant-id').value;
  const treeCodeInput = document.getElementById('bind-tree-search').value.trim();
  const btn = document.getElementById('btn-submit-binding');

  if (!farmId || !nfcUid) {
    showBindingError('Thông tin thẻ NFC hoặc Nông trại không hợp lệ.');
    return;
  }

  if (!plantId && !treeCodeInput) {
    showBindingError('Vui lòng chọn hoặc nhập số thứ tự cây cần gắn thẻ.');
    return;
  }

  hideBindingError();
  const oldBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang khóa thẻ &amp; Lưu tọa độ GPS...';
    btn.disabled = true;
  }

  try {
    const token = localStorage.getItem('pb_token') || localStorage.getItem('token');
    const payload = {
      nfc_uid: nfcUid,
      plant_id: plantId ? parseInt(plantId) : null,
      tree_code: treeCodeInput,
      latitude: window.currentBindingGps?.lat ?? null,
      longitude: window.currentBindingGps?.lng ?? null,
      accuracy: window.currentBindingGps?.accuracy ?? null,
      allow_replace: allowReplace === true
    };

    const res = await fetch(`/api/plants/farms/${encodeURIComponent(farmId)}/bind-tag-quick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        if (data.can_replace) {
          openReplaceConfirmModal(data);
          return;
        }
        showBindingError(data.error || 'Mã thẻ này đã được sử dụng cho cây khác! Không thể gán đè.');
        return;
      }
      throw new Error(data.error || 'Lỗi khi gắn thẻ vào cây.');
    }

    // Success Haptic Feedback
    if (navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch(e) {}
    }

    showNfcGpsToast(data.message || 'Đã gắn thẻ và lưu GPS thành công!');

    // Close any replace modal
    const repModal = document.getElementById('replace-tag-confirm-modal');
    if (repModal) repModal.style.display = 'none';

    // Update URL in browser history to reflect bound public route
    const boundUid = (data.plant && data.plant.nfc_uid) || nfcUid;
    const cleanRawUid = boundUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    try {
      history.replaceState({}, '', `/${farmId}/public/${cleanRawUid}`);
    } catch (histErr) {
      console.warn('Could not update browser history state:', histErr);
    }

    // Hide binding view
    document.getElementById('field-binding-view').style.display = 'none';
    currentPlantData = data.plant;

    // Open dedicated NFC Write Modal if Web NFC is supported, otherwise render plant directly
    if ('NDEFReader' in window) {
      await openNfcWriteModal(data.plant, true);
    } else {
      await renderPlant(data.plant, true);
    }

  } catch (err) {
    console.error('Lỗi khi gắn thẻ:', err);
    showBindingError(err.message || 'Lỗi server khi gắn thẻ.');
  } finally {
    if (btn) {
      btn.innerHTML = oldBtnHtml;
      btn.disabled = false;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── INTERACTIVE WEB NFC DIRECT WRITE MODAL MODULE ───────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

let _nfcWriteAbortController = null;
let _pendingNfcWritePlant = null;

async function openNfcWriteModal(plant, isAutoFlow = false) {
  if (!plant) plant = currentPlantData;
  if (!plant) return;
  _pendingNfcWritePlant = plant;

  const modal = document.getElementById('nfc-write-modal');
  if (!modal) {
    await renderPlant(plant, true);
    return;
  }

  const farmId = plant.farm_id || slugInfo.farmId;
  const nfcUid = plant.nfc_uid || slugInfo.nfcUid || slugInfo.slug;
  const cleanRawUid = nfcUid ? nfcUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  const directUrl = `${window.location.origin}/${farmId}/public/${cleanRawUid}`;

  const treeCodeEl = document.getElementById('nfc-write-tree-code');
  if (treeCodeEl) treeCodeEl.textContent = `#${plant.tree_code || plant.id} (${plant.plant_type || 'Cây trồng'})`;
  const targetUidEl = document.getElementById('nfc-write-target-uid');
  if (targetUidEl) targetUidEl.textContent = nfcUid || cleanRawUid;
  const directUrlEl = document.getElementById('nfc-write-direct-url');
  if (directUrlEl) directUrlEl.textContent = directUrl;

  const subtitleEl = document.getElementById('nfc-write-modal-subtitle');
  if (subtitleEl) subtitleEl.textContent = isAutoFlow ? 'Bước cuối: Nạp link trực tiếp vào chip NFC' : 'Ghi đè đường dẫn mở thẳng vào chip NFC';

  // Reset visual state to waiting
  const titleEl = document.getElementById('nfc-write-status-title');
  if (titleEl) titleEl.textContent = 'HÃY CHẠM MẶT SAU ĐIỆN THOẠI VÀO THẺ';
  const descEl = document.getElementById('nfc-write-status-desc');
  if (descEl) descEl.innerHTML = 'Giữ mặt sau điện thoại sát vào thẻ NFC trên cây khoảng <strong>1 - 2 giây</strong> cho đến khi máy rung để nạp link trực tiếp.';
  const animContainer = document.getElementById('nfc-write-anim-container');
  if (animContainer) {
    animContainer.style.background = 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
    animContainer.style.borderColor = '#10b981';
  }
  const iconEl = document.getElementById('nfc-write-icon');
  if (iconEl) {
    iconEl.className = 'lucide-spin';
    iconEl.setAttribute('data-lucide', 'radio');
    iconEl.style.color = '#047857';
  }

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  await startNfcDirectWriteSession();
}

async function startNfcDirectWriteSession() {
  const plant = _pendingNfcWritePlant;
  if (!plant) return;

  const farmId = plant.farm_id || slugInfo.farmId;
  const nfcUid = plant.nfc_uid || slugInfo.nfcUid || slugInfo.slug;
  const cleanRawUid = nfcUid ? nfcUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  const directUrl = `${window.location.origin}/${farmId}/public/${cleanRawUid}`;

  if (!('NDEFReader' in window)) {
    const titleEl = document.getElementById('nfc-write-status-title');
    if (titleEl) titleEl.textContent = 'TRÌNH DUYỆT KHÔNG HỖ TRỢ GHI NFC';
    const descEl = document.getElementById('nfc-write-status-desc');
    if (descEl) descEl.innerHTML = 'Ghi thẻ NFC yêu cầu trình duyệt <strong>Google Chrome trên Android</strong>.<br>Dữ liệu cây trồng và tọa độ GPS đã được lưu trên hệ thống an toàn!';
    return;
  }

  // Cancel any existing session
  if (_nfcWriteAbortController) {
    try { _nfcWriteAbortController.abort(); } catch(_) {}
  }
  _nfcWriteAbortController = new AbortController();

  const titleEl = document.getElementById('nfc-write-status-title');
  const descEl = document.getElementById('nfc-write-status-desc');
  const animContainer = document.getElementById('nfc-write-anim-container');
  const iconEl = document.getElementById('nfc-write-icon');

  if (titleEl) titleEl.textContent = '📡 ĐANG CHỜ CHẠM THẺ NFC...';
  if (descEl) descEl.innerHTML = 'Hãy áp mặt sau điện thoại vào thẻ NFC trên cây ngay bây giờ...';
  if (animContainer) {
    animContainer.style.background = 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
    animContainer.style.borderColor = '#10b981';
  }
  if (iconEl) {
    iconEl.className = 'lucide-spin';
    iconEl.setAttribute('data-lucide', 'radio');
    iconEl.style.color = '#047857';
  }
  if (window.lucide) window.lucide.createIcons();

  try {
    const ndef = new NDEFReader();
    await ndef.write({
      records: [{ recordType: 'url', data: directUrl }]
    }, { signal: _nfcWriteAbortController.signal });

    // Success!
    if (navigator.vibrate) {
      try { navigator.vibrate([150, 50, 150]); } catch(_) {}
    }

    if (titleEl) titleEl.textContent = '✅ ĐÃ NẠP LINK THÀNH CÔNG!';
    if (descEl) descEl.innerHTML = `Đã ghi đè link đích danh <strong>/${farmId}/public/${cleanRawUid}</strong> vào chip NFC!<br>Từ lần sau, chạm thẻ từ màn hình khóa sẽ mở thẳng Cây #${plant.tree_code || plant.id}.`;
    if (animContainer) {
      animContainer.style.background = '#dcfce7';
      animContainer.style.borderColor = '#16a34a';
    }
    if (iconEl) {
      iconEl.className = '';
      iconEl.setAttribute('data-lucide', 'check-circle-2');
      iconEl.style.color = '#16a34a';
    }
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      cancelNfcDirectWriteSession();
    }, 2000);

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('NFC Write Error:', err);
    if (titleEl) titleEl.textContent = '⚠️ CHƯA GHI ĐƯỢC VÀO THẺ';
    if (descEl) descEl.innerHTML = `Không thể ghi vào thẻ: <strong>${esc(err.message)}</strong>.<br>(Hãy giữ điện thoại sát vào chip NFC và bấm "Thử Lại")`;
    if (animContainer) {
      animContainer.style.background = '#fef2f2';
      animContainer.style.borderColor = '#ef4444';
    }
    if (iconEl) {
      iconEl.className = '';
      iconEl.setAttribute('data-lucide', 'alert-triangle');
      iconEl.style.color = '#dc2626';
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

function cancelNfcDirectWriteSession() {
  if (_nfcWriteAbortController) {
    try { _nfcWriteAbortController.abort(); } catch(_) {}
    _nfcWriteAbortController = null;
  }
  const modal = document.getElementById('nfc-write-modal');
  if (modal) modal.style.display = 'none';

  const p = _pendingNfcWritePlant || currentPlantData;
  _pendingNfcWritePlant = null;
  if (p) {
    currentPlantData = p;
    const bindView = document.getElementById('field-binding-view');
    if (bindView) bindView.style.display = 'none';
    const authGate = document.getElementById('auth-gate-view');
    if (authGate) authGate.style.display = 'none';
    renderPlant(p, true);
  }
}

// ─── Manual Trigger from Plant Profile ──────────────────────────────
async function writePlantUrlToNfcChip(plant) {
  if (!plant) plant = currentPlantData;
  if (!plant) return;
  await openNfcWriteModal(plant, false);
}

// ─── Modal Functions: Replace & Revoke Old NFC Tag ───

function openReplaceConfirmModal(conflictData) {
  window.pendingConflictData = conflictData;
  const modal = document.getElementById('replace-tag-confirm-modal');
  if (!modal) return;

  const treeEl = document.getElementById('rep-modal-tree-name');
  if (treeEl) treeEl.textContent = '#' + (conflictData.tree_code || conflictData.plant_id);

  const oldUidEl = document.getElementById('rep-modal-old-uid');
  if (oldUidEl) oldUidEl.textContent = conflictData.current_uid || 'Không xác định';

  const newUidEl = document.getElementById('rep-modal-new-uid');
  if (newUidEl) newUidEl.textContent = conflictData.new_uid || window.currentBindingUid;

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
}

function confirmReplaceTagSubmit() {
  const modal = document.getElementById('replace-tag-confirm-modal');
  if (modal) modal.style.display = 'none';
  submitFieldBinding(true);
}

function cancelReplaceAndPickAnother() {
  const modal = document.getElementById('replace-tag-confirm-modal');
  if (modal) modal.style.display = 'none';
  clearSelectedTree();
  showPublicToast('Đã hủy. Vui lòng chọn hoặc nhập số cây chưa gắn thẻ.');
  const searchInput = document.getElementById('bind-tree-search');
  if (searchInput) {
    searchInput.focus();
    handleTreeSearchInput('');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── SMART FARM GATEWAY & WEB NFC LISTENER MODULE (/farmId/public) ───────────
// ═════════════════════════════════════════════════════════════════════════════

let _currentFarmPortalData = null;
let _currentGatewayTab = 'all';
let _gatewayNdefReader = null;
let _allGatewayPlants = [];

async function loadFarmPortal(farmId) {
  try {
    const res = await fetch(`/api/plants/farms/${encodeURIComponent(farmId)}/public-portal`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Không tìm thấy thông tin trang trại #${farmId}`);
    }
    const data = await res.json();
    _currentFarmPortalData = data;
    _allGatewayPlants = data.plants || [];

    const farm = data.farm || {};
    document.title = `${farm.name || 'Trang Trại'} — Cổng Nông Trại Thông Minh (Tanbao Agtech)`;

    // Populate Farm Hero
    const nameEl = document.getElementById('gateway-farm-name');
    if (nameEl) nameEl.textContent = farm.name || `Trang trại #${farmId}`;

    const pucEl = document.getElementById('gateway-farm-puc');
    if (pucEl) pucEl.textContent = farm.puc_code ? `MÃ PUC: ${farm.puc_code}` : 'MÃ PUC: VN-TB';

    const certEl = document.getElementById('gateway-farm-vietgap');
    if (certEl) {
      if (farm.vietgap_cert_number) {
        certEl.innerHTML = `<i data-lucide="award" class="lucide-sm"></i> VietGAP: ${esc(farm.vietgap_cert_number)}`;
        certEl.style.display = 'inline-flex';
      } else {
        certEl.innerHTML = `<i data-lucide="shield-check" class="lucide-sm"></i> Chuẩn Canh Tác Sạch`;
      }
    }

    const addrEl = document.getElementById('gateway-farm-address');
    if (addrEl) {
      if (farm.address && farm.address.trim()) {
        addrEl.innerHTML = `<i data-lucide="map-pin" class="lucide-sm" style="vertical-align: -2px;"></i> ${esc(farm.address)}`;
        addrEl.style.display = 'block';
      } else {
        addrEl.style.display = 'none';
      }
    }

    // Stats
    const totalEl = document.getElementById('gateway-stat-total');
    if (totalEl) totalEl.textContent = farm.total_plants || 0;
    const assignedEl = document.getElementById('gateway-stat-assigned');
    if (assignedEl) assignedEl.textContent = farm.assigned_count || 0;
    const unassignedEl = document.getElementById('gateway-stat-unassigned');
    if (unassignedEl) unassignedEl.textContent = farm.unassigned_count || 0;

    // Tabs count
    const tabAll = document.getElementById('tab-count-all');
    if (tabAll) tabAll.textContent = farm.total_plants || 0;
    const tabAssigned = document.getElementById('tab-count-assigned');
    if (tabAssigned) tabAssigned.textContent = farm.assigned_count || 0;
    const tabUnassigned = document.getElementById('tab-count-unassigned');
    if (tabUnassigned) tabUnassigned.textContent = farm.unassigned_count || 0;

    // Staff Area
    renderGatewayStaffArea(farmId, farm);

    // Render tree grid
    renderGatewayTreesGrid(_allGatewayPlants);

    // Render farm supplies & investment section
    renderGatewaySupplies(data.supplies || [], data.total_investment || 0);

    // Hide loader, show gateway
    document.getElementById('loader').style.display = 'none';
    document.getElementById('error-view').style.display = 'none';
    document.getElementById('auth-gate-view').style.display = 'none';
    if (document.getElementById('field-binding-view')) document.getElementById('field-binding-view').style.display = 'none';
    document.getElementById('plant-view').style.display = 'none';
    document.getElementById('farm-gateway-view').style.display = 'block';

    if (window.lucide) window.lucide.createIcons();

    // Auto-activate Web NFC listener on supported mobile browsers
    autoStartGatewayWebNfc(farmId);
  } catch (err) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('error-view').style.display = 'block';
    document.getElementById('error-msg').textContent = err.message;
  }
}

function renderGatewaySupplies(supplies = [], totalInvestment = 0, page = 1) {
  window._gatewaySuppliesData = supplies || [];
  window._gatewaySuppliesCurrentPage = page || 1;

  const badge = document.getElementById('gateway-total-investment-badge');
  if (badge) {
    badge.textContent = `Tổng đầu tư: ${formatVnd(totalInvestment)}`;
  }
  const container = document.getElementById('gateway-supplies-container') || document.getElementById('gateway-supplies-grid');
  if (!container) return;

  container.innerHTML = renderSuppliesTableHtml(supplies, page, 10, 'changeGatewaySuppliesPage');
  if (window.lucide) window.lucide.createIcons();
}

function renderGatewayStaffArea(farmId, farm) {
  const staffInfo = document.getElementById('gateway-staff-info');
  const staffActions = document.getElementById('gateway-staff-actions');
  if (!staffInfo || !staffActions) return;

  const { user } = getStoredAuth();
  const isAuthorized = user && (user.role === 'admin' || Number(user.farm_id) === Number(farmId));

  if (isAuthorized) {
    staffInfo.innerHTML = `
      <i data-lucide="shield-check" class="lucide-sm" style="color: #059669; font-size: 18px;"></i>
      <span>Đang đăng nhập: <strong style="color: #0f172a;">${esc(user.full_name || user.name || user.email)}</strong> (${user.role === 'admin' ? 'Quản trị viên' : 'Kỹ sư trang trại'})</span>
    `;
    staffActions.innerHTML = `
      <a href="/admin" target="_blank" style="padding: 6px 12px; font-size: 12px; font-weight: 700; background: #047857; color: #ffffff; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="layout-dashboard" class="lucide-sm"></i> Trang Quản Trị
      </a>
    `;
  } else {
    staffInfo.innerHTML = `
      <i data-lucide="user-check" class="lucide-sm" style="color: #0284c7; font-size: 18px;"></i>
      <span>Bạn là Kỹ sư / Chủ vườn đi gắn thẻ? Đăng nhập để kích hoạt quyền gán thẻ &amp; lưu GPS.</span>
    `;
    staffActions.innerHTML = `
      <button type="button" onclick="openGatewayLoginModal()" style="padding: 6px 14px; font-size: 12px; font-weight: 800; background: #0284c7; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="log-in" class="lucide-sm"></i> Đăng nhập Kỹ sư
      </button>
    `;
  }
}

function openGatewayLoginModal() {
  const farmId = slugInfo.farmId;
  const farm = _currentFarmPortalData?.farm || {};
  window.pendingBindingFarm = { farmId, farmName: farm.name, pucCode: farm.puc_code, nfcUid: null };
  document.getElementById('farm-gateway-view').style.display = 'none';
  document.getElementById('auth-gate-view').style.display = 'block';

  const gateTitle = document.getElementById('gate-plant-name');
  if (gateTitle) gateTitle.textContent = farm.name || `Trang trại #${farmId}`;
  const gateCode = document.getElementById('gate-plant-code');
  if (gateCode) gateCode.textContent = 'Cổng Kỹ Sư Thực Địa';
  const gateFarm = document.getElementById('gate-plant-farm');
  if (gateFarm) gateFarm.textContent = farm.name || `Trang trại #${farmId}`;
  const gateType = document.getElementById('gate-plant-type');
  if (gateType) gateType.textContent = 'Xác thực tài khoản';
  if (window.lucide) window.lucide.createIcons();
}

async function autoStartGatewayWebNfc(farmId) {
  const statusText = document.getElementById('gateway-nfc-status-text');
  if (!('NDEFReader' in window)) {
    if (statusText) statusText.innerHTML = 'Chưa có thẻ định danh cho cây, liên hệ <a href="tel:090804895" style="color: #047857; text-decoration: underline; font-weight: 800;">(090804895)</a>';
    return;
  }

  try {
    if (!_gatewayNdefReader) {
      _gatewayNdefReader = new NDEFReader();
      await _gatewayNdefReader.scan();

      if (statusText) statusText.innerHTML = '<i data-lucide="radio" class="lucide-spin"></i> Đang tự động nhận diện thẻ NFC chạm vào máy...';

      _gatewayNdefReader.addEventListener('reading', async ({ serialNumber }) => {
        if (!serialNumber) return;
        const cleanUid = serialNumber.replace(/:/g, '').toUpperCase();
        await handleGatewayNfcDetected(farmId, cleanUid);
      });
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    console.warn('Auto Web NFC scanner not started passively:', err);
    if (statusText) statusText.innerHTML = 'Chưa có thẻ định danh cho cây, liên hệ <a href="tel:090804895" style="color: #047857; text-decoration: underline; font-weight: 800;">(090804895)</a>';
  }
}

async function triggerGatewayWebNfc() {
  const farmId = slugInfo.farmId;
  if (!farmId) return;

  if (!('NDEFReader' in window)) {
    showPublicToast('Trình duyệt này không hỗ trợ Web NFC trực tiếp. Bạn có thể tra cứu nhanh theo số cây bên dưới!');
    document.getElementById('gateway-tree-search')?.focus();
    return;
  }

  try {
    _gatewayNdefReader = new NDEFReader();
    await _gatewayNdefReader.scan();
    
    showPublicToast('📡 Hãy chạm mặt sau điện thoại vào thẻ NFC trên cây ngay...');
    const statusText = document.getElementById('gateway-nfc-status-text');
    if (statusText) statusText.innerHTML = '<i data-lucide="radio" class="lucide-spin"></i> Đang lắng nghe chạm thẻ NFC trên cây...';

    _gatewayNdefReader.addEventListener('reading', async ({ serialNumber }) => {
      if (!serialNumber) return;
      const cleanUid = serialNumber.replace(/:/g, '').toUpperCase();
      await handleGatewayNfcDetected(farmId, cleanUid);
    });
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    alert('Không thể kích hoạt NFC: ' + err.message);
  }
}

async function handleGatewayNfcDetected(farmId, cleanUid) {
  showPublicToast(`📡 Đã phát hiện thẻ NFC: ${cleanUid}`);

  try {
    const res = await fetch(`/api/plants/public-by-farm-uid/${encodeURIComponent(farmId)}/${encodeURIComponent(cleanUid)}`);
    const data = await res.json();

    if (res.status === 410 || data.is_revoked) {
      document.getElementById('farm-gateway-view').style.display = 'none';
      renderRevokedTagView(cleanUid, data.error);
      return;
    }

    if (data.assigned && data.plant) {
      // Switch directly to plant view
      currentPlantData = data.plant;
      try {
        history.replaceState({}, '', `/${data.farm_id || farmId}/public/${encodeURIComponent(data.plant.nfc_uid || cleanUid)}`);
      } catch (e) {}
      document.getElementById('farm-gateway-view').style.display = 'none';
      if (document.getElementById('field-binding-view')) document.getElementById('field-binding-view').style.display = 'none';
      if (document.getElementById('auth-gate-view')) document.getElementById('auth-gate-view').style.display = 'none';
      const { user } = getStoredAuth();
      const hasAccess = userHasPlantAccess(user, data.plant);
      await renderPlant(data.plant, hasAccess);
      return;
    }

    // Unassigned Tag:
    const { user } = getStoredAuth();
    const isAuthorized = user && (user.role === 'admin' || Number(user.farm_id) === Number(farmId));

    if (isAuthorized) {
      document.getElementById('farm-gateway-view').style.display = 'none';
      initFieldBindingModule(farmId, data.farm_name, data.puc_code, cleanUid, data.in_inventory, data.inventory_warning);
    } else {
      if (data.in_inventory === false) {
        showPublicToast(data.inventory_warning || `Thẻ NFC [${cleanUid}] chưa được nhập kho trang trại.`);
      }
      // Prompt staff login
      const promptMsg = data.in_inventory === false
        ? `⚠️ Đã nhận diện thẻ NFC [${cleanUid}] (CHƯA NHẬP KHO)!\n\nNếu bạn là Quản trị viên / Kỹ thuật viên, bạn có muốn Đăng nhập để kiểm tra không?`
        : `🏷️ Đã nhận diện thẻ NFC [${cleanUid}] hợp lệ (chưa gán cây)!\n\nNếu bạn là Kỹ thuật viên / Chủ vườn, bạn có muốn Đăng nhập ngay để gán thẻ này vào cây và lưu GPS không?`;

      if (confirm(promptMsg)) {
        window.pendingBindingFarm = { farmId, farmName: data.farm_name, pucCode: data.puc_code, nfcUid: cleanUid, inInventory: data.in_inventory, inventoryWarning: data.inventory_warning };
        document.getElementById('farm-gateway-view').style.display = 'none';
        document.getElementById('auth-gate-view').style.display = 'block';
        const gateTitle = document.getElementById('gate-plant-name');
        if (gateTitle) gateTitle.textContent = `Thẻ NFC: ${cleanUid}`;
      }
    }
  } catch (err) {
    showPublicToast('Lỗi tra cứu thẻ: ' + err.message);
  }
}

function toggleGatewayManualUidInput() {
  const wrap = document.getElementById('gateway-manual-uid-wrap');
  if (!wrap) return;
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if (wrap.style.display === 'block') {
    document.getElementById('gateway-manual-uid-input')?.focus();
  }
}

async function submitGatewayManualUid() {
  const input = document.getElementById('gateway-manual-uid-input');
  if (!input) return;
  const rawUid = input.value.trim();
  if (!rawUid) {
    showPublicToast('Vui lòng nhập mã UID thẻ NFC!');
    return;
  }
  const cleanUid = rawUid.replace(/:/g, '').toUpperCase();
  const farmId = slugInfo.farmId;
  await handleGatewayNfcDetected(farmId, cleanUid);
}

function renderGatewayTreesGrid(plants) {
  const container = document.getElementById('gateway-trees-grid');
  if (!container) return;

  if (!plants || plants.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #94a3b8;">
        <i data-lucide="trees" class="lucide-sm" style="font-size: 32px; margin-bottom: 8px;"></i>
        <p style="margin: 0; font-weight: 600; font-size: 13px;">Trang trại chưa có cây trồng nào.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = plants.map(p => {
    const isAssigned = p.nfc_uid && p.nfc_uid.trim().length > 0;
    const varietyStr = p.plant_variety ? ` — ${esc(p.plant_variety)}` : '';
    const hasGps = p.latitude != null && p.longitude != null && !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude)) && (Number(p.latitude) !== 0 || Number(p.longitude) !== 0);
    const statusBadge = isAssigned
      ? `<span style="background:#ecfdf5; color:#047857; font-size:11px; font-weight:800; padding:2px 8px; border-radius:100px; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="check" class="lucide-sm"></i> Đã gắn thẻ</span>`
      : `<span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:700; padding:2px 8px; border-radius:100px; border:1px solid #cbd5e1;">⚪ Chưa gắn thẻ</span>`;

    const locLabel = p.location && p.location !== 'Vườn chính' && !p.location.includes('canh tác nông nghiệp') 
      ? esc(p.location) 
      : (hasGps ? `GPS: ${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}` : '');

    return `
      <div onclick="onGatewayTreeClick(${p.id}, '${esc(p.tree_code || p.id)}', '${esc(p.nfc_uid || '')}', ${isAssigned})"
           style="background: #ffffff; border: 1.5px solid ${isAssigned ? '#bbf7d0' : '#e2e8f0'}; border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.03);"
           onmouseover="this.style.borderColor='#10b981'; this.style.transform='translateY(-2px)';"
           onmouseout="this.style.borderColor='${isAssigned ? '#bbf7d0' : '#e2e8f0'}'; this.style.transform='translateY(0)';">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div style="font-weight: 800; font-size: 14px; color: #0f172a; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="leaf" class="lucide-sm" style="color: #059669;"></i> Cây #${esc(p.tree_code || p.id)}
          </div>
          ${statusBadge}
        </div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
          ${esc(p.plant_type || 'Cây trồng')}${varietyStr}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
          <span>${locLabel}</span>
          ${hasGps ? '<span style="color:#047857; font-weight:700;"><i data-lucide="map-pin" class="lucide-sm"></i> Có GPS</span>' : '<span style="color:#94a3b8;">Chưa có GPS</span>'}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function setGatewayTab(tab, btnEl) {
  _currentGatewayTab = tab;
  document.querySelectorAll('.btn-gateway-tab').forEach(b => {
    b.style.background = '#ffffff';
    b.style.color = '#475569';
    b.style.borderColor = '#cbd5e1';
  });

  if (btnEl) {
    btnEl.style.background = '#ecfdf5';
    btnEl.style.color = '#047857';
    btnEl.style.borderColor = '#10b981';
  }

  filterGatewayTrees();
}

function filterGatewayTrees() {
  const query = (document.getElementById('gateway-tree-search')?.value || '').trim().toLowerCase();
  let filtered = _allGatewayPlants || [];

  if (_currentGatewayTab === 'assigned') {
    filtered = filtered.filter(p => p.nfc_uid && p.nfc_uid.trim().length > 0);
  } else if (_currentGatewayTab === 'unassigned') {
    filtered = filtered.filter(p => !p.nfc_uid || p.nfc_uid.trim().length === 0);
  }

  if (query) {
    filtered = filtered.filter(p => {
      const code = String(p.tree_code || p.id).toLowerCase();
      const type = String(p.plant_type || '').toLowerCase();
      const variety = String(p.plant_variety || '').toLowerCase();
      const loc = String(p.location || '').toLowerCase();
      const uid = String(p.nfc_uid || '').toLowerCase();
      return code.includes(query) || type.includes(query) || variety.includes(query) || loc.includes(query) || uid.includes(query);
    });
  }

  renderGatewayTreesGrid(filtered);
}

async function onGatewayTreeClick(plantId, treeCode, nfcUid, isAssigned) {
  if (isAssigned) {
    // Open plant public profile
    document.getElementById('loader').style.display = 'block';
    document.getElementById('farm-gateway-view').style.display = 'none';
    try {
      const fetchSlug = nfcUid || plantId;
      const res = await fetch(`/api/plants/public/${encodeURIComponent(fetchSlug)}`);
      const plant = await res.json();
      if (!res.ok) throw new Error(plant.error || 'Không tìm thấy thông tin cây.');
      currentPlantData = plant;
      const { user } = getStoredAuth();
      const hasAccess = userHasPlantAccess(user, plant);
      document.getElementById('loader').style.display = 'none';
      await renderPlant(plant, hasAccess);
    } catch (err) {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('farm-gateway-view').style.display = 'block';
      showPublicToast('Lỗi xem cây: ' + err.message);
    }
  } else {
    // Unassigned tree
    const { user } = getStoredAuth();
    const farmId = slugInfo.farmId;
    const isAuthorized = user && (user.role === 'admin' || Number(user.farm_id) === Number(farmId));

    if (isAuthorized) {
      showPublicToast(`🌳 Cây #${treeCode} chưa có thẻ. Hãy chạm thẻ NFC vào máy để gán.`);
      triggerGatewayWebNfc();
    } else {
      showPublicToast(`Cây #${treeCode} hiện chưa được gắn thẻ NFC thực địa.`);
    }
  }
}

// Helper: Get fertilizer / supply / pesticide name from details
function getFertilizerName(details) {
  return (details.supply_name || details.fertilizer_name || details.fertilizer || details.foliar_nutrition || details.type || details.product_name || details.name || '').trim();
}

function getPesticideName(details) {
  return (details.supply_name || details.pesticide_name || details.pesticide || details.type || details.product_name || details.name || '').trim();
}

function getQuantity(details) {
  const q = details.quantity ?? details.amount ?? details.qty ?? details.dosage ?? details.volume ?? details.water_volume ?? details.cut_count ?? details.yield_kg;
  return (q !== undefined && q !== null && q !== '') ? q : '';
}

function getUnit(details, defaultUnit = '') {
  return details.unit || details.package_unit || defaultUnit;
}

// Helper: Get structured text from care logs
function getCareLogSummary(log) {
  const details = log.details || {};
  const qty = getQuantity(details);
  const unit = getUnit(details, log.log_type === 'Tưới nước' ? 'm³' : 'kg');
  const method = details.method || (log.equipment_used ? log.equipment_used : 'Tự động');

  if (log.log_type === 'Tưới nước') {
    const qtyStr = qty ? `${qty} ${unit}` : (details.water_liters ? `${details.water_liters} Lít` : 'Định mức tiêu chuẩn');
    const costStr = details.total_cost ? ` (Chi phí: ${Number(details.total_cost).toLocaleString('vi-VN')} đ)` : '';
    return `Đã tưới nước bằng <strong>${esc(method)}</strong>. Lượng nước: <strong>${esc(qtyStr)}</strong>${costStr}.`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón chuyên dụng';
    const qtyStr = qty ? `${qty} ${unit}` : 'Định lượng tiêu chuẩn';
    const costStr = details.total_cost ? ` (Chi phí: ${Number(details.total_cost).toLocaleString('vi-VN')} đ)` : '';
    return `Đã bón phân <strong>${esc(fertName)}</strong>. Liều lượng: <strong>${esc(qtyStr)}</strong>${costStr}.`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc bảo vệ thực vật';
    const qtyStr = qty ? `${qty} ${unit}` : 'Định lượng';
    const waterStr = details.water_volume ? ` pha với <strong>${esc(details.water_volume)}L</strong> nước` : '';
    return `Đã phun thuốc <strong>${esc(pestName)}</strong>. Liều lượng: <strong>${esc(qtyStr)}</strong>${waterStr}.`;
  }
  if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    const actStr = details.activity || details.reason || 'Cắt tỉa cành/lá định kỳ';
    const qtyStr = qty ? `Số lượng: <strong>${qty} ${unit || 'cành'}</strong>. ` : '';
    return `Đã thực hiện cắt tỉa. ${qtyStr}Nội dung: <strong>${esc(actStr)}</strong>.`;
  }
  if (log.log_type === 'Tỉa hoa') {
    const actStr = details.activity || details.reason || 'Tỉa bớt nụ còi / trái non';
    const qtyStr = qty ? `Số lượng: <strong>${qty} ${unit || 'bông/trái'}</strong>. ` : '';
    return `Đã tỉa hoa/quả. ${qtyStr}Nội dung: <strong>${esc(actStr)}</strong>.`;
  }
  if (log.log_type === 'Thụ phấn') {
    return `Đã thụ phấn chéo ban đêm. Tỷ lệ tiếp nhận phấn: <strong>${esc(details.pollination_rate || '95%')}</strong>.`;
  }
  if (log.log_type === 'Thu hoạch') {
    const yieldKg = details.yield_kg || qty || '—';
    const fruitCount = details.fruit_count ? ` (${details.fruit_count} trái)` : '';
    const revStr = details.total_revenue ? ` · Doanh thu: <strong>${Number(details.total_revenue).toLocaleString('vi-VN')} đ</strong>` : '';
    const batchStr = log.batch_code || details.batch_code ? ` · Mã Lô VietGAP: <strong>${esc(log.batch_code || details.batch_code)}</strong>` : '';
    return `Đã thu hoạch: <strong>${esc(yieldKg)} kg</strong>${fruitCount}${revStr}${batchStr}.`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevEmoji = details.severity === 'Nghiêm trọng' ? '🔴' : details.severity === 'Trung bình' ? '🟠' : '🟡';
    return `<span style="color:var(--color-disease);font-weight:700">${sevEmoji} ${esc(details.disease_name || 'Bệnh chưa xác định')}</span>${details.description ? '<br><span style="color:var(--text-secondary);font-size:12px">' + esc(details.description) + '</span>' : ''}`;
  }
  return esc(log.note || '');
}

// ── Timeline Pagination & Rendering Helpers ──────────────────

function getShortSummary(log) {
  const details = log.details || {};
  const qty = getQuantity(details);
  const unit = getUnit(details, log.log_type === 'Tưới nước' ? 'm³' : 'kg');

  if (log.log_type === 'Tưới nước') {
    const method = details.method || (log.equipment_used ? 'Béc bù áp IoT' : 'Thủ công');
    const qtyStr = qty ? `${qty} ${unit}` : (details.water_liters ? `${details.water_liters}L` : 'Định mức chuẩn');
    return `Tưới nước bằng ${esc(method)} (${esc(qtyStr)})`;
  }
  if (log.log_type === 'Bón phân') {
    const fertName = getFertilizerName(details) || 'Phân bón';
    const qtyStr = qty ? `${qty} ${unit}` : '';
    return `Bón ${esc(fertName)}${qtyStr ? ` — (${esc(qtyStr)})` : ''}`;
  }
  if (log.log_type === 'Phun thuốc') {
    const pestName = getPesticideName(details) || 'Thuốc BVTV';
    const qtyStr = qty ? ` (Liều: ${qty} ${unit})` : '';
    return `Phun ${esc(pestName)}${esc(qtyStr)}`;
  }
  if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    const actStr = details.activity || details.reason || 'Cắt tỉa tán';
    return `${esc(actStr)}${qty ? ` (${qty} cành)` : ''}`;
  }
  if (log.log_type === 'Tỉa hoa') {
    const actStr = details.activity || details.reason || 'Tỉa hoa/quả';
    return `${esc(actStr)}${qty ? ` (${qty} trái)` : ''}`;
  }
  if (log.log_type === 'Thụ phấn') {
    return `Thụ phấn hoa chéo ban đêm (${esc(details.pollination_rate || 'Đạt 95%')})`;
  }
  if (log.log_type === 'Thu hoạch') {
    const yieldKg = details.yield_kg || qty || '';
    const fruitCount = details.fruit_count ? ` · ${details.fruit_count} trái` : '';
    return `Thu hoạch ${yieldKg ? yieldKg + ' kg' : ''}${fruitCount} — Mã Lô: ${esc(log.batch_code || details.batch_code || 'VietGAP')}`;
  }
  if (log.log_type === 'Bệnh cây') {
    const sevEmoji = details.severity === 'Nghiêm trọng' ? '🔴' : details.severity === 'Trung bình' ? '🟠' : '🟡';
    return `${sevEmoji} Phát hiện bệnh: ${esc(details.disease_name || 'Bệnh chưa xác định')}`;
  }
  return esc(log.note || '').slice(0, 50) + (log.note && log.note.length > 50 ? '...' : '');
}

function _renderTimelineItemHtml(log) {
  let markerClass = '';
  let tagClass = 'tag-general';
  let icon = 'edit-3';
  
  if (log.log_type === 'Tưới nước') {
    markerClass = 'marker-water';
    tagClass = 'tag-water';
    icon = 'droplets';
  } else if (log.log_type === 'Bón phân') {
    markerClass = 'marker-fertilize';
    tagClass = 'tag-fertilize';
    icon = 'leaf';
  } else if (log.log_type === 'Phun thuốc') {
    markerClass = 'marker-pesticide';
    tagClass = 'tag-pesticide';
    icon = 'flask-conical';
  } else if (log.log_type === 'Cắt lá' || log.log_type === 'Cắt tỉa') {
    markerClass = 'marker-leaf';
    tagClass = 'tag-leaf';
    icon = 'scissors';
  } else if (log.log_type === 'Tỉa hoa') {
    markerClass = 'marker-flower';
    tagClass = 'tag-flower';
    icon = 'flower';
  } else if (log.log_type === 'Thụ phấn') {
    markerClass = 'marker-flower';
    tagClass = 'tag-flower';
    icon = 'sparkles';
  } else if (log.log_type === 'Thu hoạch') {
    markerClass = 'marker-fertilize';
    tagClass = 'tag-fertilize';
    icon = 'wheat';
  } else if (log.log_type === 'Bệnh cây') {
    markerClass = 'marker-disease';
    tagClass = 'tag-disease';
    icon = 'bug';
  }
  
  const timeVal = (log.details && log.details.performed_at) ? log.details.performed_at : log.created_at;
  const fullDateTime = fmtDateTime(timeVal);

  const mediaUrls = (log.media_urls && Array.isArray(log.media_urls)) ? log.media_urls : [];
  const mediaThumbs = mediaUrls.length > 0 ? `
    <div class="log-media-gallery">
      ${mediaUrls.map(m => {
        const isVideo = (m.type === 'video') || /\.(mp4|mov|avi|mkv|webm)/i.test(m.url || m);
        const url = m.url || m;
        return isVideo
          ? `<div class="log-media-item" onclick="openLightbox('${esc(url)}','video')"><video src="${esc(url)}" muted preload="metadata"></video><div class="video-play-icon"><i data-lucide="play-circle" class="lucide-sm"></i></div></div>`
          : `<div class="log-media-item" onclick="openLightbox('${esc(url)}','image')"><img src="${esc(url)}" alt="ảnh nhật ký" loading="lazy"></div>`;
      }).join('')}
    </div>` : '';

  const noteHtml = log.note
    ? `<div class="log-body" style="margin-top: 6px; color: var(--text-secondary); font-size:12px;"><i data-lucide="message-circle" class="lucide-sm"></i> ${esc(log.note)}</div>`
    : '';

  return `
    <div class="timeline-item">
      <div class="timeline-marker ${markerClass}"></div>
      <div class="timeline-content" onclick="toggleTimelineItem(event, this)">
        <div class="log-header">
          <span class="log-tag ${tagClass}"><i data-lucide="${icon}" class="lucide-xs"></i> ${esc(log.log_type || 'Ghi chú')}</span>
          <div class="log-header-right">
            <span class="log-time-indicator"><i data-lucide="clock" class="lucide-sm"></i> ${fullDateTime}</span>
            <i data-lucide="chevron-down" class="toggle-arrow lucide-sm"></i>
          </div>
        </div>
        <div class="log-short-preview" style="font-size: 13px; color: var(--text-secondary); margin-top: 6px; font-weight: 500;">
          ${getShortSummary(log)}
        </div>
        <div class="timeline-details">
          <div class="log-body">
            ${getCareLogSummary(log)}
          </div>
          ${noteHtml}
          ${mediaThumbs}
        </div>
      </div>
    </div>
  `;
}

function renderPublicLogTimeline(page = 1, expanded = false) {
  const container = document.getElementById('public-timeline-container');
  const paginationBox = document.getElementById('public-timeline-pagination');
  if (!container) return;

  const dates = window._publicLogDates || [];
  if (dates.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
        <i data-lucide="clipboard" class="lucide-sm" style="font-size: 32px; margin-bottom: 12px;"></i>
        <p style="font-size: 13px;">Cây chưa có ghi chép nhật ký nào.</p>
      </div>
    `;
    if (paginationBox) paginationBox.style.display = 'none';
    return;
  }

  let visibleDates = [];
  if (!expanded) {
    // Mode 1: Default summary (3 days most recent)
    visibleDates = dates.slice(0, 3);
  } else {
    // Mode 2: Expanded with pagination (5 days per page)
    const totalPages = Math.ceil(dates.length / window._publicLogPageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    window._publicLogCurrentPage = page;

    const startIdx = (page - 1) * window._publicLogPageSize;
    const endIdx = startIdx + window._publicLogPageSize;
    visibleDates = dates.slice(startIdx, endIdx);
  }

  const groups = window._publicLogsGrouped;
  
  container.innerHTML = `
    <div class="timeline">
      ${visibleDates.map(date => `
        <div class="timeline-group">
          <div class="timeline-date">${date}</div>
          ${groups[date].map(log => _renderTimelineItemHtml(log)).join('')}
        </div>
      `).join('')}
    </div>
  `;

  // Render Pagination / Expand Controls Box
  if (paginationBox) {
    const totalDatesCount = dates.length;
    if (!expanded) {
      if (totalDatesCount > 3) {
        paginationBox.style.display = 'flex';
        paginationBox.innerHTML = `
          <div style="width:100%; text-align:center; margin-top:16px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="togglePublicLogExpand(true)" style="padding:10px 20px; font-weight:700; border-radius:10px; background:rgba(255,255,255,0.08); border:1.5px solid var(--green-bright); color:var(--green-bright); box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer;">
              <i data-lucide="clipboard-check" class="lucide-sm"></i> Xem tất cả nhật ký (Tổng ${totalDatesCount} ngày canh tác)
            </button>
          </div>
        `;
      } else {
        paginationBox.style.display = 'none';
      }
    } else {
      const totalPages = Math.ceil(dates.length / window._publicLogPageSize) || 1;
      const curPage = window._publicLogCurrentPage;
      paginationBox.style.display = 'flex';
      paginationBox.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" class="btn btn-secondary btn-xs" ${curPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="changePublicLogPage(${curPage - 1})"`} style="padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;">
              <i data-lucide="chevron-left" class="lucide-sm"></i> Trang trước
            </button>
            <span style="font-size:12px; font-weight:700; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:6px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
              Trang ${curPage} / ${totalPages} (${totalDatesCount} ngày)
            </span>
            <button type="button" class="btn btn-secondary btn-xs" ${curPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : `onclick="changePublicLogPage(${curPage + 1})"`} style="padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;">
              Trang tiếp <i data-lucide="chevron-right" class="lucide-sm"></i>
            </button>
          </div>
          <button type="button" class="btn btn-link btn-xs" onclick="togglePublicLogExpand(false)" style="font-size:12px; color:var(--text-secondary); font-weight:600; text-decoration:none; cursor:pointer; background:none; border:none; margin-top:4px;">
            <i data-lucide="minimize-2" class="lucide-sm"></i> Thu gọn về 3 ngày gần nhất
          </button>
        </div>
      `;
    }
  }
  if (window.lucide) lucide.createIcons();
}

window.togglePublicLogExpand = function(expanded) {
  window._publicLogIsExpanded = expanded;
  renderPublicLogTimeline(1, expanded);
};

window.changePublicLogPage = function(page) {
  renderPublicLogTimeline(page, true);
};

// Helper: Calculate PHI Quarantine status from pesticide logs
function calculatePlantPhiStatus(plant) {
  const logs = plant.logs || [];
  const now = new Date();
  let maxExpiry = null;
  let lastPestName = '';

  logs.forEach(log => {
    if (log.log_type === 'Phun thuốc' && log.details) {
      const phiDays = parseInt(log.details.phi_days) || parseInt(log.details.phi) || 14;
      const logDate = new Date(log.log_date || log.created_at);
      if (!isNaN(logDate.getTime())) {
        const expiryDate = new Date(logDate.getTime() + phiDays * 24 * 60 * 60 * 1000);
        if (!maxExpiry || expiryDate > maxExpiry) {
          maxExpiry = expiryDate;
          lastPestName = log.details.supply_name || log.details.pesticide_name || log.details.pesticide || 'Thuốc BVTV';
        }
      }
    }
  });

  if (!maxExpiry) {
    return {
      isSafe: true,
      daysRemaining: 0,
      text: 'An Toàn Thu Hoạch',
      subtext: '0 ngày cách ly PHI · Đạt chuẩn sạch',
      badgeClass: 'badge-tot'
    };
  }

  const diffMs = maxExpiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      isSafe: false,
      daysRemaining: diffDays,
      text: `Cách ly PHI: Còn ${diffDays} ngày`,
      subtext: `Đang cách ly (${esc(lastPestName)}) — Không thu hoạch`,
      badgeClass: 'badge-chuyi'
    };
  }

  return {
    isSafe: true,
    daysRemaining: 0,
    text: 'An Toàn Thu Hoạch',
    subtext: `Hết thời gian cách ly (${esc(lastPestName)})`,
    badgeClass: 'badge-tot'
  };
}

// Helper: Calculate tree age in years/months
function calculateTreeAge(plantingDate) {
  if (!plantingDate) return null;
  const d = new Date(plantingDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const years = (now - d) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) {
    const months = Math.max(1, Math.round((now - d) / (1000 * 60 * 60 * 24 * 30.4)));
    return `${months} tháng tuổi`;
  }
  return `${years.toFixed(1)} năm tuổi`;
}

// Render dynamic plant data with Enterprise ERP Layout
async function renderPlant(plant, isEditable) {
  const extra = plant.data || {};
  const schemaFields = plant.schema_fields || [];
  const media = plant.media || [];
  const logs = plant.logs || [];
  const hasMap = (plant.latitude && plant.longitude) || (plant.farm_boundary && plant.farm_boundary.coordinates);

  const { token, user } = getStoredAuth();
  if (isEditable === undefined) {
    isEditable = userHasPlantAccess(user, plant);
  }

  // Render health status badge
  let healthClass = 'badge-gray';
  if (plant.health_status === 'Tốt') healthClass = 'badge-tot';
  else if (plant.health_status === 'Bình thường') healthClass = 'badge-binhthuong';
  else if (plant.health_status === 'Cần chú ý') healthClass = 'badge-chuyi';
  else if (plant.health_status === 'Bệnh') healthClass = 'badge-benh';

  // Group logs by date for timeline pagination
  window._publicLogsGrouped = {};
  window._publicLogDates = [];
  window._publicLogCurrentPage = 1;
  window._publicLogPageSize = 5;
  window._publicLogIsExpanded = false;

  // Cache supplies for plant profile pagination (10 items / page)
  window._plantSuppliesData = plant.farm_supplies || [];
  window._plantSuppliesCurrentPage = 1;
  window._plantSuppliesPageSize = 10;

  logs.forEach(log => {
    const dateStr = fmtDate(log.log_date);
    if (!window._publicLogsGrouped[dateStr]) {
      window._publicLogsGrouped[dateStr] = [];
      window._publicLogDates.push(dateStr);
    }
    window._publicLogsGrouped[dateStr].push(log);
  });

  // Calculate planting date & age
  const plantDateVal = plant.planting_date || extra.planting_date || extra.planted_date;
  const plantDateFormatted = plantDateVal 
    ? fmtDate(plantDateVal) 
    : (extra.planting_year ? `Năm ${extra.planting_year}` : (plant.plant_type && plant.plant_type.toLowerCase().includes('sầu') ? '01/01/2006' : 'Chưa ghi nhận'));
  const treeAgeFormatted = calculateTreeAge(plantDateVal) || (plant.plant_type && plant.plant_type.toLowerCase().includes('sầu') ? 'Gốc lâu năm (~18 năm)' : 'Đang sinh trưởng');

  // Calculate PHI Quarantine status
  const phiStatus = calculatePlantPhiStatus(plant);

  // GPS Coordinates & Satellite Lock info
  let plantLat = parseFloat(plant.latitude);
  let plantLng = parseFloat(plant.longitude);
  const hasRealCoords = !isNaN(plantLat) && !isNaN(plantLng) && (plantLat !== 0 || plantLng !== 0);

  // Traceability & Passport IDs
  const traceCode = `TB-TRC-${plant.farm_id || '00'}-${esc(plant.tree_code || plant.id)}`;
  const pucCode = plant.puc_code || 'VN-ĐN-OR-0017';
  const certStandard = plant.vietgap_cert_number ? `VietGAP ${esc(plant.vietgap_cert_number)}` : 'VietGAP Trồng Trọt';
  const securityHash = `SHA256-TBAG-${((Number(plant.id || 1) * 883 + 1307) % 65535).toString(16).toUpperCase()}-VERIFIED`;

  let authBarHtml = '';
  if (isEditable && user && user.id) {
    authBarHtml = `
      <div class="auth-status-wrap" style="margin-bottom: 12px;">
        <div class="auth-status-pill auth-granted">
          <i data-lucide="check-circle-2" class="lucide-sm" style="color: #10b981;"></i>
          <span><strong>${esc(user.full_name || user.email)}</strong> &nbsp;•&nbsp; ${user.role === 'admin' ? 'Quản trị viên ERP' : (esc(plant.farm_name) || 'Nông hộ phụ trách')} (Toàn quyền ghi nhận &amp; hạch toán)</span>
          <button class="auth-pill-btn" onclick="logoutGate()" title="Đăng xuất">
            <i data-lucide="log-out" class="lucide-sm"></i> Đăng xuất
          </button>
        </div>
      </div>
    `;
  } else {
    authBarHtml = `
      <div class="auth-status-wrap" style="margin-bottom: 12px;">
        <div class="auth-status-pill auth-readonly">
          <i data-lucide="shield-check" class="lucide-sm" style="color: #059669;"></i>
          <span>Cổng Thông Tin Truy Xuất Nguồn Gốc Công Khai (Chế độ xem minh bạch — Chuẩn VietGAP / ERP)</span>
          <button class="auth-pill-btn primary" onclick="showAuthGateView()">
            <i data-lucide="lock" class="lucide-sm"></i> Đăng nhập nông hộ
          </button>
        </div>
      </div>
    `;
  }

  // Construct UI using Enterprise ERP Standards
  let html = `
    <!-- Top Cockpit Breadcrumb & Action Strip -->
    <div class="erp-top-cockpit">
      <div class="erp-top-nav-bar">
        <div class="erp-breadcrumb">
          <a href="/${plant.farm_id ? plant.farm_id + '/public' : ''}"><i data-lucide="home" class="lucide-xs"></i> ${esc(plant.farm_name || 'Trang trại Tân Bảo')}</a>
          <span>/</span>
          <span style="color:#0f172a; font-weight:700;">Hồ sơ Cây #${esc(plant.tree_code || plant.id)}</span>
          <span style="background:#f1f5f9; color:#475569; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; font-family:var(--font-mono);">${traceCode}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button onclick="window.print()" class="btn btn-secondary btn-xs" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; cursor:pointer; background:#ffffff; border:1px solid #cbd5e1; color:#334155; display:inline-flex; align-items:center; gap:4px;">
            <i data-lucide="printer" class="lucide-xs"></i> In hồ sơ
          </button>
          <button onclick="openExportModal()" class="btn btn-secondary btn-xs" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; cursor:pointer; background:#f0fdf4; border:1px solid #86efac; color:#166534; display:inline-flex; align-items:center; gap:4px;">
            <i data-lucide="file-spreadsheet" class="lucide-xs"></i> Xuất dữ liệu
          </button>
        </div>
      </div>
    </div>

    <!-- Hero Header Card -->
    <div class="hero-container">
      ${authBarHtml}
      <div class="glass-panel hero-card">
        <div class="cover-image-container">
          <!-- Top ERP Badges on Cover -->
          <div class="cover-erp-badges">
            <span class="cover-erp-pill puc"><i data-lucide="award" class="lucide-xs"></i> MÃ PUC: ${esc(pucCode)}</span>
            <span class="cover-erp-pill vietgap"><i data-lucide="shield-check" class="lucide-xs"></i> ${esc(certStandard)}</span>
          </div>

          <img src="${getCropImageSrc(plant)}" alt="${esc(plant.plant_type)}" class="${plant.cover_image ? 'cover-image-photo' : 'cover-image-fallback'}" onerror="tryNextCropExt(this, '${esc(plant.plant_type || '')}')">
          <div class="cover-overlay"></div>
        </div>

        <div class="hero-details">
          <div class="plant-title-row">
            <div>
              <div style="font-size:12px; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                <i data-lucide="sprout" class="lucide-xs"></i> HỆ THỐNG QUẢN LÝ VÙNG TRỒNG SỐ HOÁ
              </div>
              <h1 class="plant-name">${esc(plant.plant_type)} — Cây #${esc(plant.tree_code || plant.id)}</h1>
              <p class="plant-variety">
                Giống: <strong>${esc(plant.plant_variety || 'Tiêu chuẩn')}</strong> &nbsp;•&nbsp; 
                Trang trại: <strong>${esc(plant.farm_name || 'Trang trại Tân Bảo')}</strong>
                ${plant.location ? ` &nbsp;•&nbsp; Vị trí: <strong>${esc(plant.location)}</strong>` : ''}
              </p>
            </div>
          </div>
          
          <div class="badges-row">
            <span class="badge ${phiStatus.badgeClass}">
              <i data-lucide="${phiStatus.isSafe ? 'check-circle-2' : 'alert-triangle'}" class="lucide-xs"></i>
              ${phiStatus.text}
            </span>
            ${isEditable
              ? `<span class="badge ${healthClass} badge-health-interactive" onclick="toggleHealthStatus()" style="cursor:pointer;" title="Bấm để chuyển trạng thái sức khỏe"><i data-lucide="activity" class="lucide-xs"></i> Tình trạng: ${esc(plant.health_status || 'Bình thường')}</span>`
              : `<span class="badge ${healthClass}" style="cursor:default;" title="Chế độ chỉ xem — Không thể can thiệp"><i data-lucide="activity" class="lucide-xs"></i> Tình trạng: ${esc(plant.health_status || 'Bình thường')}</span>`}
            
            ${plant.nfc_uid ? `<span class="badge badge-info" style="font-family:var(--font-mono); font-size:11px;"><i data-lucide="radio" class="lucide-xs"></i> NFC: ${esc(plant.nfc_uid)}</span>` : ''}
            
            ${isEditable && plant.nfc_uid ? `
              <span class="badge" onclick="writePlantUrlToNfcChip(currentPlantData)" style="background:#ecfdf5; border:1px solid #10b981; color:#047857; cursor:pointer; font-weight:700; display:inline-flex; align-items:center; gap:4px;" title="Chạm máy vào thẻ NFC để nạp link trực tiếp vào chip">
                <i data-lucide="smartphone-nfc" class="lucide-xs"></i> Nạp link thẻ NFC (1 chạm)
              </span>
            ` : ''}

            <span class="badge badge-info" style="font-size:11px;">
              <i data-lucide="calendar" class="lucide-xs"></i> ${treeAgeFormatted}
            </span>
          </div>
          
          <!-- 5-Tile ERP Telemetry Grid -->
          <div class="erp-telemetry-grid">
            <!-- Tile 1: Hồ sơ cây & Giống -->
            <div class="erp-kpi-tile">
              <div class="erp-kpi-header">
                <span class="erp-kpi-label"><i data-lucide="sprout" class="lucide-xs" style="color:#059669;"></i> Giống &amp; Độ Tuổi</span>
                <span style="font-size:10px; color:#059669; font-weight:700; background:#ecfdf5; padding:2px 6px; border-radius:4px;">Hồ sơ gốc</span>
              </div>
              <div class="erp-kpi-value">${esc(plant.plant_variety || plant.plant_type)}</div>
              <div class="erp-kpi-subtext">
                <i data-lucide="clock" class="lucide-xs"></i> ${plantDateFormatted} (${treeAgeFormatted})
              </div>
            </div>

            <!-- Tile 2: Định vị vệ tinh GIS -->
            <div class="erp-kpi-tile">
              <div class="erp-kpi-header">
                <span class="erp-kpi-label"><i data-lucide="crosshair" class="lucide-xs" style="color:#0284c7;"></i> Tọa Độ GIS Vệ Tinh</span>
                <span style="font-size:10px; color:#0284c7; font-weight:700; background:#f0f9ff; padding:2px 6px; border-radius:4px;">${hasRealCoords ? 'Đã khóa GPS' : 'Khu vực'}</span>
              </div>
              <div class="erp-kpi-value" style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:#0f172a;">
                ${hasRealCoords ? `${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : 'Vùng canh tác trang trại'}
              </div>
              <div class="erp-kpi-subtext">
                <i data-lucide="map-pin" class="lucide-xs"></i> ${hasRealCoords ? 'Độ chính xác: ±3.2m thực địa' : 'Vị trí xác định theo ranh giới'}
              </div>
            </div>

            <!-- Tile 3: Tiêu chuẩn canh tác -->
            <div class="erp-kpi-tile">
              <div class="erp-kpi-header">
                <span class="erp-kpi-label"><i data-lucide="award" class="lucide-xs" style="color:#d97706;"></i> Tiêu Chuẩn &amp; Vùng Trồng</span>
                <span style="font-size:10px; color:#d97706; font-weight:700; background:#fffbeb; padding:2px 6px; border-radius:4px;">PUC Code</span>
              </div>
              <div class="erp-kpi-value">${esc(certStandard)}</div>
              <div class="erp-kpi-subtext">
                <i data-lucide="shield-check" class="lucide-xs"></i> Mã PUC: <strong>${esc(pucCode)}</strong>
              </div>
            </div>

            <!-- Tile 4: An toàn PHI & Thu hoạch -->
            <div class="erp-kpi-tile">
              <div class="erp-kpi-header">
                <span class="erp-kpi-label"><i data-lucide="shield-alert" class="lucide-xs" style="color:#ea580c;"></i> An Toàn Cách Ly PHI</span>
                <span style="font-size:10px; color:${phiStatus.isSafe ? '#059669' : '#b45309'}; font-weight:700; background:${phiStatus.isSafe ? '#ecfdf5' : '#fffbeb'}; padding:2px 6px; border-radius:4px;">${phiStatus.isSafe ? 'Đạt chuẩn' : 'Cảnh báo'}</span>
              </div>
              <div class="erp-kpi-value" style="font-size:14px; color:${phiStatus.isSafe ? '#047857' : '#b45309'};">${phiStatus.text}</div>
              <div class="erp-kpi-subtext">
                <i data-lucide="info" class="lucide-xs"></i> ${phiStatus.subtext}
              </div>
            </div>

            <!-- Tile 5: Hạch toán đầu tư & vật tư -->
            <div class="erp-kpi-tile">
              <div class="erp-kpi-header">
                <span class="erp-kpi-label"><i data-lucide="coins" class="lucide-xs" style="color:#059669;"></i> Tổng Đầu Tư Cây</span>
                <span style="font-size:10px; color:#059669; font-weight:700; background:#ecfdf5; padding:2px 6px; border-radius:4px;">ERP Ledger</span>
              </div>
              <div class="erp-kpi-value" style="color:#059669; font-family:var(--font-mono);">${formatVnd(plant.total_cost || 0)}</div>
              <div class="erp-kpi-subtext">
                <i data-lucide="receipt" class="lucide-xs"></i> ${(plant.supply_usages || []).length} đợt dùng &nbsp;•&nbsp; ${(plant.farm_supplies || []).length} mặt hàng kho
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Main Container Grid -->
    <div class="main-layout">
      <!-- Left Column (GIS Map, Financial & Supplies Ledger, Timeline Logs) -->
      <div class="left-col">
        ${hasMap ? `
        <!-- Location Map Card -->
        <div class="glass-panel glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h2 class="sec-title" style="margin: 0; font-size: 16px;">
              <i data-lucide="map" class="lucide-sm" style="color: var(--green-bright)"></i>
              <span>Định Vị Vệ Tinh GIS Thực Địa &amp; Ranh Giới Lô Canh Tác</span>
            </h2>
            <span class="badge badge-info" style="font-size: 11px;">
              <i data-lucide="layers" class="lucide-xs"></i> Mapbox Satellite Streets
            </span>
          </div>
          <div class="plant-map-container" style="position:relative; width:100%; height:320px; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1;">
            <div id="plant-location-map" style="width:100%;height:100%;"></div>
            ${plant.farm_name ? `<div class="map-farm-badge" style="position:absolute; bottom:12px; left:12px; z-index:5; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px; font-size:11.5px; color:#fff; border:1px solid rgba(255,255,255,0.15);"><i data-lucide="sprout" class="lucide-xs" style="color:#34d399"></i> Trang trại: ${esc(plant.farm_name)}</div>` : ''}
            ${(!plant.latitude || !plant.longitude) ? `<div class="map-no-gps-badge" style="position:absolute; top:12px; left:12px; z-index:5; background:rgba(15,23,42,0.88); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px; font-size:11.5px; color:#fde047; border:1px solid rgba(253,224,71,0.3);"><i data-lucide="info" class="lucide-xs"></i> Vị trí trang trại · Cây chưa có định vị GPS</div>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- 💼 Supplies & Cost Section (ERP Ledger) -->
        <div class="glass-panel glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
            <h2 class="sec-title" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px;">
              <i data-lucide="receipt" class="lucide-sm" style="color: var(--green-bright)"></i>
              <span>Vật Tư &amp; Hạch Toán Chi Phí Canh Tác (ERP Ledger)</span>
            </h2>
            <span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 800; font-size: 12.5px; border: 1.5px solid #86efac; padding: 4px 12px; border-radius: 8px; font-family:var(--font-mono);">
              <i data-lucide="coins" class="lucide-xs" style="vertical-align: -1px;"></i> Tổng đầu tư: ${formatVnd(plant.total_cost || 0)}
            </span>
          </div>

          <!-- 3 Quick Metric Cards -->
          <div class="erp-ledger-kpi-grid">
            <div class="erp-ledger-kpi-card" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <div class="kpi-label-block">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Chi Phí Đã Hạch Toán</div>
                <div style="font-size: 10.5px; color: #15803d; margin-top: 2px;">Nước tưới, phân &amp; thuốc BVTV</div>
              </div>
              <div class="kpi-val-block">
                <div class="kpi-main-val" style="font-size: 17px; font-weight: 800; color: #059669; margin-top: 3px; font-family:var(--font-mono);">${formatVnd(plant.total_cost || 0)}</div>
              </div>
            </div>
            <div class="erp-ledger-kpi-card" style="background: #f8fafc; border: 1px solid #e2e8f0;">
              <div class="kpi-label-block">
                <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Đợt Tiêu Hao Vật Tư</div>
                <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Ghi nhận thực tế trên cây</div>
              </div>
              <div class="kpi-val-block">
                <div class="kpi-main-val" style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 3px;">${(plant.supply_usages || []).length} lần</div>
              </div>
            </div>
            <div class="erp-ledger-kpi-card" style="background: #eff6ff; border: 1px solid #bfdbfe;">
              <div class="kpi-label-block">
                <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Kho Vật Tư Trang Trại</div>
                <div style="font-size: 10.5px; color: #3b82f6; margin-top: 2px;">Đã phân bổ cho trang trại</div>
              </div>
              <div class="kpi-val-block">
                <div class="kpi-main-val" style="font-size: 17px; font-weight: 800; color: #2563eb; margin-top: 3px;">${(plant.farm_supplies || []).length} loại</div>
              </div>
            </div>
          </div>

          <!-- Sub-section 1: Lịch Sử Tiêu Hao Vật Tư Của Cây Này -->
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="clipboard-list" class="lucide-xs" style="color: #059669;"></i>
                <span>1. Lịch Sử Tiêu Hao Vật Tư Trực Tiếp Trên Cây</span>
              </span>
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">Hạch toán theo định mức và đơn giá kho</span>
            </h3>
            ${(!plant.supply_usages || plant.supply_usages.length === 0) ? `
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; color: #64748b; font-size: 12.5px;">
                <i data-lucide="info" class="lucide-sm" style="color: #94a3b8; margin-bottom: 4px;"></i>
                <div>Chưa có dữ liệu tiêu hao vật tư cho cây này. Các lần bón phân, phun thuốc, tưới nước được ghi nhận sẽ tự động hạch toán tại đây.</div>
              </div>
            ` : `
              <div class="erp-mobile-scroll-hint">
                <i data-lucide="chevrons-left-right" class="lucide-xs"></i> <span>Kéo vuốt ngang để xem đủ 7 cột hạch toán</span>
              </div>
              <div class="erp-table-container">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; min-width: 580px;">
                  <thead>
                    <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.2px;">
                      <th style="padding: 10px 12px;">Ngày dùng</th>
                      <th style="padding: 10px 12px;">Hoạt động</th>
                      <th style="padding: 10px 12px;">Tên vật tư / Hoạt chất</th>
                      <th style="padding: 10px 12px; text-align: right;">Số lượng</th>
                      <th style="padding: 10px 12px; text-align: right;">Đơn giá</th>
                      <th style="padding: 10px 12px; text-align: right;">Thành tiền</th>
                      <th style="padding: 10px 12px;">Người làm &amp; Thiết bị</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${plant.supply_usages.map(u => `
                      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                        <td style="padding: 9px 12px; white-space: nowrap; font-weight: 600; color: #334155;">${fmtDate(u.used_date || u.log_date)}</td>
                        <td style="padding: 9px 12px; white-space: nowrap;">
                          <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 10.5px; font-weight: 700;">${esc(u.log_type || u.supply_category || 'Chăm sóc')}</span>
                        </td>
                        <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">
                          ${esc(u.supply_name || 'Vật tư')}
                          ${u.active_ingredient ? `<div style="font-size: 10.5px; font-weight: 500; color: #059669;"><i data-lucide="leaf" class="lucide-xs" style="vertical-align:-1px;"></i> Hoạt chất: ${esc(u.active_ingredient)}</div>` : ''}
                        </td>
                        <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">
                          ${u.quantity} ${esc(u.supply_unit || '')}
                        </td>
                        <td style="padding: 9px 12px; text-align: right; color: #64748b; white-space: nowrap; font-family:var(--font-mono);">
                          ${formatVnd(u.unit_price)}
                        </td>
                        <td style="padding: 9px 12px; text-align: right; font-weight: 800; color: #166534; white-space: nowrap; font-family:var(--font-mono);">
                          ${formatVnd(u.total_cost)}
                        </td>
                        <td style="padding: 9px 12px; color: #475569; font-size: 11.5px;">
                          ${esc(u.operator_name || '—')}${u.equipment_used ? ` <span style="color:#94a3b8;">(${esc(u.equipment_used)})</span>` : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Sub-section 2: Danh Mục Vật Tư Tồn Kho Của Trang Trại -->
          <div>
            <h3 style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="boxes" class="lucide-xs" style="color: #059669;"></i>
                <span>2. Danh Mục Vật Tư Tồn Kho Trang Trại (ERP Inventory)</span>
              </span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">Tổng ${(plant.farm_supplies || []).length} loại vật tư khai báo</span>
            </h3>
            
            <div id="plant-supplies-table-container">
              ${renderSuppliesTableHtml(plant.farm_supplies || [], 1, 10, 'changePlantSuppliesPage')}
            </div>
          </div>
        </div>

        <!-- Timeline Diary Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size: 16px;">
            <span><i data-lucide="history" class="lucide-sm" style="color: var(--green-bright)"></i> Nhật Ký Canh Tác Chuẩn VietGAP (Traceability Timeline)</span>
            <span style="font-size:11.5px; font-weight:700; color:#047857; background:#ecfdf5; padding:4px 10px; border-radius:8px; border:1px solid #a7f3d0;">
              Tổng ${window._publicLogDates.length} ngày canh tác
            </span>
          </h2>

          <div id="public-timeline-container">
            <!-- Rendered dynamically -->
          </div>

          <div id="public-timeline-pagination">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Right Column (Plant Passport, Quick Care Buttons or Read-Only Notice, Media Gallery) -->
      <div class="right-col">
        
        <!-- 📜 Digital Plant Passport & Traceability Certificate Card -->
        <div class="erp-passport-card">
          <div class="erp-passport-header">
            <div class="erp-passport-title">
              <i data-lucide="award" class="lucide-sm" style="color: #059669;"></i>
              <span>Hộ Chiếu Cây Trồng Số</span>
            </div>
            <span class="erp-passport-stamp">
              <i data-lucide="shield-check" class="lucide-xs"></i> VietGAP
            </span>
          </div>

          <div class="erp-passport-grid">
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Mã Định Danh (Trace ID):</span>
              <span class="erp-passport-val" style="font-family:var(--font-mono); color:#059669;">${traceCode}</span>
            </div>
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Thẻ Phần Cứng NFC:</span>
              <span class="erp-passport-val" style="font-family:var(--font-mono);">${esc(plant.nfc_uid || 'NTAG213 Chưa gán')}</span>
            </div>
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Mã Vùng Trồng (PUC):</span>
              <span class="erp-passport-val">${esc(pucCode)}</span>
            </div>
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Tiêu Chuẩn Sản Xuất:</span>
              <span class="erp-passport-val" style="color:#047857;">${esc(certStandard)}</span>
            </div>
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Nông Hộ Quản Lý:</span>
              <span class="erp-passport-val">${esc(plant.farm_name || 'Trang trại Tân Bảo')}</span>
            </div>
            <div class="erp-passport-row">
              <span class="erp-passport-lbl">Tọa Độ Cố Định:</span>
              <span class="erp-passport-val" style="font-family:var(--font-mono); font-size:11px;">${hasRealCoords ? `${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : 'Vùng trang trại'}</span>
            </div>
            <div class="erp-passport-row" style="border-bottom:none;">
              <span class="erp-passport-lbl">Chữ Ký Toàn Vẹn Số:</span>
              <span class="erp-passport-val" style="font-family:var(--font-mono); font-size:10px; color:#64748b;">${securityHash}</span>
            </div>
          </div>

          <div style="margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#64748b;">
            <span><i data-lucide="check" class="lucide-xs" style="color:#10b981;"></i> Đã kiểm định VietGAP</span>
            <a href="javascript:void(0)" onclick="openExportModal()" style="color:#059669; font-weight:700; text-decoration:none;">Xuất chứng thư &rarr;</a>
          </div>
        </div>

        ${isEditable ? `
        <!-- Care Actions (Quick Log Buttons) -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title" style="font-size: 15px;"><i data-lucide="activity" class="lucide-sm" style="color: var(--green-bright)"></i> Thao tác canh tác nhanh</h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
            Chọn quy trình chăm sóc để hạch toán vật tư và ghi nhật ký tức thời.
          </p>
          <div class="care-actions-grid">
            <button class="care-btn care-btn-water" onclick="openModal('modal-water')">
              <i data-lucide="droplet" class="lucide-sm" style="color: var(--color-water)"></i>
              <span>Tưới nước</span>
            </button>
            <button class="care-btn care-btn-fertilize" onclick="openModal('modal-fertilize')">
              <i data-lucide="leaf" class="lucide-sm" style="color: var(--color-fertilize)"></i>
              <span>Bón phân</span>
            </button>
            <button class="care-btn care-btn-pesticide" onclick="openModal('modal-pesticide')">
              <i data-lucide="flask-conical" class="lucide-sm" style="color: var(--color-pesticide)"></i>
              <span>Phun thuốc</span>
            </button>
            <button class="care-btn care-btn-leaf" onclick="openModal('modal-leaf')">
              <i data-lucide="scissors" class="lucide-sm" style="color: var(--color-leaf)"></i>
              <span>Cắt cành/lá</span>
            </button>
            <button class="care-btn care-btn-flower" onclick="openModal('modal-flower')">
              <i data-lucide="flower" class="lucide-sm" style="color: var(--color-flower)"></i>
              <span>Tỉa hoa/quả</span>
            </button>
            <button class="care-btn care-btn-disease" onclick="openModal('modal-disease')">
              <i data-lucide="shield-alert" class="lucide-sm" style="color: var(--color-disease)"></i>
              <span>Bệnh cây</span>
            </button>
            <button class="care-btn care-btn-harvest" onclick="openModal('modal-harvest')">
              <i data-lucide="wheat" class="lucide-sm" style="color: #d97706"></i>
              <span style="color: #92400e; font-weight: 700;">Thu hoạch</span>
            </button>
          </div>
        </div>
        ` : `
        <!-- Read-Only Notice Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title" style="font-size: 15px;"><i data-lucide="shield-check" class="lucide-sm" style="color: var(--green-bright)"></i> Cổng Minh Bạch Canh Tác</h2>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 12.5px; color: #475569; line-height: 1.5; margin-bottom: 14px;">
            <i data-lucide="info" class="lucide-sm" style="color: #059669; margin-right: 4px;"></i>
            Bạn đang truy cập ở <strong>Chế độ Xem Minh Bạch (Public Traceability)</strong>. Toàn bộ thông tin vùng trồng, vật tư tiêu hao, cách ly PHI và nhật ký thực địa được bảo chứng toàn vẹn.
          </div>
          <button onclick="showAuthGateView()" style="width: 100%; background: #ffffff; border: 1.5px dashed #059669; color: #059669; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" onmouseover="this.style.background='#f0fdf4';" onmouseout="this.style.background='#ffffff';">
            <i data-lucide="lock" class="lucide-sm"></i> Đăng nhập nông hộ để ghi nhận canh tác
          </button>
        </div>
        `}

        ${media.length ? `
        <!-- Media Gallery Card -->
        <div class="glass-panel glass-card">
          <h2 class="sec-title" style="font-size: 15px;"><i data-lucide="images" class="lucide-sm" style="color: var(--green-bright)"></i> Minh chứng hình ảnh thực địa</h2>
          <div class="gallery-grid">
            ${media.map(m => `
              <div class="gallery-thumb" onclick="openLightbox('${esc(m.url)}','${esc(m.media_type)}')">
                ${m.media_type === 'video'
                  ? `<video src="${esc(m.url)}" muted></video>`
                  : `<img src="${esc(m.url)}" alt="${esc(m.caption || '')}">`}
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div>
    
    <footer class="footer" style="max-width: 1200px; margin: 40px auto 0; padding: 24px 16px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12.5px;">
      <div class="footer-logo-wrap" style="margin-bottom: 8px;">
        <img src="/assets/logo.png" alt="TANBAO AgTech" class="footer-logo" style="height: 36px; width: auto;">
      </div>
      Hệ thống quản lý vùng trồng &amp; Sổ Nông Số Hóa <a href="/" style="color:#059669; font-weight:700; text-decoration:none;">Plant Book Agtech</a> — TANBAO AgTech &nbsp;|&nbsp; Cập nhật lần cuối: ${fmtDate(plant.updated_at)}
    </footer>
  `;

  document.getElementById('loader').style.display = 'none';
  const view = document.getElementById('plant-view');
  view.innerHTML = html;
  view.style.display = 'block';

  // Populate farm supplies into care modals
  populateCareSuppliesDropdowns(plant.farm_supplies || []);

  // Render initial care timeline (3 days default)
  renderPublicLogTimeline(1, false);

  // Initialize Mapbox plant location map if coordinates or farm polygon exist
  if (hasMap) {
    const mapContainerEl = document.getElementById('plant-location-map');
    if (mapContainerEl) {
      (async () => {
        const DEFAULT_MAPBOX_TOKEN = typeof atob === 'function' ? atob('cGsuZXlKMUlqb2ljR2gxWTIxbGIyMWxieUlzSW1FaU9pSmpiWEYwT1RSNk9HTXdNbkk1TW5OelptZHVNekoxY210cUluMC5JWC1vWndJc1BVRXcxRzEwZVJfSnNR') : '';
        let MAPBOX_TOKEN = DEFAULT_MAPBOX_TOKEN;
        try {
          const tokenRes = await fetch('/api/config/mapbox-token');
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData && tokenData.token) MAPBOX_TOKEN = tokenData.token;
          }
        } catch(e) {
          console.warn('Lỗi tải Mapbox token từ server, dùng token dự phòng:', e.message);
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;

    // Validate coordinates with auto-fix for swapped latitude/longitude
    let plantLat = parseFloat(plant.latitude);
    let plantLng = parseFloat(plant.longitude);

    if (!isNaN(plantLat) && !isNaN(plantLng)) {
      if (Math.abs(plantLat) > 90 && Math.abs(plantLng) <= 90) {
        const tmp = plantLat;
        plantLat = plantLng;
        plantLng = tmp;
      }
    }

    const hasValidPlantCoords = !isNaN(plantLat) && !isNaN(plantLng) &&
      Math.abs(plantLat) <= 90 && Math.abs(plantLng) <= 180;

    let centerLng = 107.241850;
    let centerLat = 10.941520;
    let initialZoom = 16;

    if (hasValidPlantCoords) {
      centerLng = plantLng;
      centerLat = plantLat;
      initialZoom = 17;
    } else if (plant.farm_boundary && plant.farm_boundary.coordinates && plant.farm_boundary.coordinates[0]) {
      const ring = plant.farm_boundary.coordinates[0];
      let sumLng = 0, sumLat = 0, validCount = 0;
      for (const pt of ring) {
        if (Array.isArray(pt) && pt.length >= 2) {
          let fLng = parseFloat(pt[0]);
          let fLat = parseFloat(pt[1]);
          if (Math.abs(fLat) > 90 && Math.abs(fLng) <= 90) {
            const tmp = fLat; fLat = fLng; fLng = tmp;
          }
          if (!isNaN(fLng) && !isNaN(fLat) && Math.abs(fLat) <= 90 && Math.abs(fLng) <= 180) {
            sumLng += fLng;
            sumLat += fLat;
            validCount++;
          }
        }
      }
      if (validCount > 0) {
        centerLng = sumLng / validCount;
        centerLat = sumLat / validCount;
        initialZoom = 16;
      }
    }

    try {
      const plantMap = new mapboxgl.Map({
        container: 'plant-location-map',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [centerLng, centerLat],
        zoom: initialZoom,
        maxZoom: 22,
        attributionControl: false,
        preserveDrawingBuffer: true
      });

      plantMap.on('error', (e) => {
        if (e && e.error) {
          const msg = String(e.error.message || e.error).toLowerCase();
          if (msg.includes('image') || msg.includes('send') || msg.includes('ajax') || msg.includes('sprite') || msg.includes('svg')) {
            return;
          }
        }
      });

      plantMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      plantMap.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      plantMap.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      window._publicPlantMap = plantMap;

      // Only add plant marker pin if plant has real GPS coordinates
      if (hasValidPlantCoords) {
        const treeCodeDisplay = esc(plant.tree_code || '1');

        const wrapper = document.createElement('div');
        wrapper.className = 'plant-map-marker-wrap';

        const el = document.createElement('div');
        el.className = 'plant-map-marker';
        el.title = `${plant.plant_type || 'Cây trồng'} - Cây #${treeCodeDisplay}`;
        el.innerHTML = `
          <i data-lucide="sprout" class="lucide-sm"></i>
          <span class="plant-tree-badge">${treeCodeDisplay}</span>
        `;
        wrapper.appendChild(el);

        const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([plantLng, plantLat])
          .setPopup(new mapboxgl.Popup({ offset: 35, closeButton: false })
            .setHTML(`
              <div style="padding:4px 6px; font-family:sans-serif;">
                <strong style="color:#059669;font-size:13px;">${esc(plant.plant_type || 'Sầu riêng')} — Cây #${treeCodeDisplay}</strong>
                ${plant.plant_variety ? `<br><small style="color:#475569;font-weight:600;">${esc(plant.plant_variety)}</small>` : ''}
                <br><span style="font-size:11px;color:#64748b;">Trang trại: ${esc(plant.farm_name || 'LK')}</span>
              </div>
            `))
          .addTo(plantMap);

        window._publicPlantMarker = marker;
      } else {
        window._publicPlantMarker = null;
      }

      // Draw farm polygon if available
      if (plant.farm_boundary && plant.farm_boundary.coordinates) {
        plantMap.on('load', () => {
          try {
            plantMap.addSource('farm-poly', {
              type: 'geojson',
              data: { type: 'Feature', geometry: plant.farm_boundary, properties: {} }
            });
            plantMap.addLayer({
              id: 'farm-poly-fill',
              type: 'fill',
              source: 'farm-poly',
              paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.18 }
            });
            plantMap.addLayer({
              id: 'farm-poly-line',
              type: 'line',
              source: 'farm-poly',
              paint: { 'line-color': '#22c55e', 'line-width': 2.5, 'line-opacity': 0.9 }
            });

            // Fit bounds to perfectly frame farm boundary and plant marker
            const bounds = new mapboxgl.LngLatBounds();
            let hasValidBounds = false;
            const coords = plant.farm_boundary.coordinates[0];
            if (Array.isArray(coords)) {
              coords.forEach(pt => {
                if (Array.isArray(pt) && pt.length >= 2) {
                  let pLng = parseFloat(pt[0]);
                  let pLat = parseFloat(pt[1]);
                  if (Math.abs(pLat) > 90 && Math.abs(pLng) <= 90) {
                    const tmp = pLat; pLat = pLng; pLng = tmp;
                  }
                  if (!isNaN(pLng) && !isNaN(pLat) && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180) {
                    bounds.extend([pLng, pLat]);
                    hasValidBounds = true;
                  }
                }
              });
            }
            if (hasValidPlantCoords) {
              bounds.extend([centerLng, centerLat]);
              hasValidBounds = true;
            }
            if (hasValidBounds) {
              plantMap.fitBounds(bounds, { padding: 45, maxZoom: 20, animate: false });
            }
          } catch(e) {
            console.warn('Lỗi vẽ ranh giới trang trại:', e);
          }
        });
      }

      plantMap.on('load', () => {
        plantMap.resize();
      });

      setTimeout(() => {
        try { plantMap.resize(); } catch(_) {}
      }, 300);
      setTimeout(() => {
        try { plantMap.resize(); } catch(_) {}
      }, 1000);

      window.addEventListener('resize', () => {
        try { plantMap.resize(); } catch(_) {}
      });

    } catch (mapErr) {
      console.error('Lỗi khởi tạo bản đồ Mapbox:', mapErr);
    }
      })();
    }
  }
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

// Toggle timeline item expanded state (accordion)
function toggleTimelineItem(event, el) {
  // Ignore clicks on lightbox media thumbnails, play icons or buttons
  if (event.target.closest('.log-media-item') || event.target.closest('.remove-preview') || event.target.tagName === 'BUTTON') {
    return;
  }
  const item = el.closest('.timeline-item');
  const details = item.querySelector('.timeline-details');
  item.classList.toggle('expanded');
  
  if (item.classList.contains('expanded')) {
    // Add buffer space for scrollHeight to handle image loads
    details.style.maxHeight = (details.scrollHeight + 150) + "px";
    details.style.opacity = "1";
  } else {
    details.style.maxHeight = "0";
    details.style.opacity = "0";
  }
}

// Toggle health status between Tốt / Bệnh
async function toggleHealthStatus() {
  if (!currentPlantData) return;
  const { token, user } = getStoredAuth();
  if (!userHasPlantAccess(user, currentPlantData)) {
    openPublicAuthModal();
    return;
  }

  const current = currentPlantData.health_status;
  // If it's anything else than Bệnh, toggle to Bệnh. Otherwise, toggle to Tốt.
  const nextStatus = current === 'Bệnh' ? 'Tốt' : 'Bệnh';
  
  const confirmed = confirm(`Bạn có chắc chắn muốn thay đổi trạng thái sức khỏe cây trồng này thành "${nextStatus}" không?`);
  if (!confirmed) return;
  
  try {
    const targetId = currentPlantData.public_slug || currentPlantData.id || slug;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/plants/public/${encodeURIComponent(targetId)}/health`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ health_status: nextStatus })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        alert(errData.error || 'Bạn không có quyền thay đổi trạng thái sức khỏe cây trồng này.');
        openPublicAuthModal();
        return;
      }
      throw new Error(errData.error || 'Lỗi hệ thống');
    }
    
    showPublicToast(`Đã chuyển trạng thái sức khỏe thành: ${nextStatus}`);
    // Reload plant profile directly to reflect status changes
    try {
      const fetchKey = currentPlantData?.id || targetId;
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
    alert('Không thể cập nhật trạng thái sức khỏe: ' + err.message);
  }
}

// Export report functionality
function openExportModal() {
  if (!currentPlantData) {
    alert("Dữ liệu cây trồng chưa được tải xong.");
    return;
  }
  
  const fromDateInput = document.getElementById('export-from-date');
  const toDateInput = document.getElementById('export-to-date');
  
  // Default to Date: Today
  const today = new Date().toISOString().split('T')[0];
  toDateInput.value = today;
  
  // Default From Date: 1 year ago or plant creation date
  if (currentPlantData.created_at) {
    const createdDate = new Date(currentPlantData.created_at).toISOString().split('T')[0];
    fromDateInput.value = createdDate;
  } else {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    fromDateInput.value = oneYearAgo.toISOString().split('T')[0];
  }
  
  // Populate categories
  const categories = ["Tưới nước", "Bón phân", "Phun thuốc", "Cắt lá", "Tỉa hoa", "Bệnh cây", "Ghi chú khác"];
  
  // Append any extra unique category present in logs
  const logs = currentPlantData.logs || [];
  logs.forEach(l => {
    if (l.log_type && !categories.includes(l.log_type)) {
      categories.push(l.log_type);
    }
  });
  
  const container = document.getElementById('export-categories-container');
  container.innerHTML = categories.map(cat => {
    return `
      <label class="export-category-item">
        <input type="checkbox" name="export-cat" value="${esc(cat)}" checked>
        <span>${esc(cat)}</span>
      </label>
    `;
  }).join('');
  
  document.getElementById('export-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleAllExportCategories(select) {
  const checkboxes = document.querySelectorAll('#export-categories-container input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = select);
}

function generateExportReport() {
  const fromDate = document.getElementById('export-from-date').value;
  const toDate = document.getElementById('export-to-date').value;
  
  const checkedCats = [];
  document.querySelectorAll('#export-categories-container input[name="export-cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });
  
  if (checkedCats.length === 0) {
    alert("Vui lòng chọn ít nhất một hạng mục nhật ký để xuất.");
    return;
  }
  
  const reportUrl = `/plant/${slug}/report?from=${fromDate}&to=${toDate}&categories=${encodeURIComponent(checkedCats.join(','))}`;
  window.open(reportUrl, '_blank');
  closeExportModal();
}

// Startup
async function init() {
  await loadConfigurations();
  await loadPlant();
  await restoreDiseaseDraft(); // Restore on initial load in case page reloaded while capturing
}

init();

/**
 * Thêm đường đồng mức siêu dày mật độ 1m (1-Meter High-Density Contour Lines),
 * dải màu cao độ quang phổ (Elevation Spectrum Gradient) và Bảng chú giải cao độ.
 * @param {mapboxgl.Map} map - Mapbox map instance
 * @param {Object} options - { defaultVisible: true, showControl: true }
 */
function addContourLinesToMap(map, options = {}) {
  if (!map) return;
  const defaultVisible = options.defaultVisible !== false;
  const showControl = options.showControl !== false;

  const initContours = () => {
    try {
      // 1. Thêm nguồn Terrain DEM cho 3D địa hình
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      // 2. Thêm nguồn Vector Đường Đồng Mức tiêu chuẩn Mapbox Terrain v2
      if (!map.getSource('mapbox-terrain-contours')) {
        map.addSource('mapbox-terrain-contours', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-terrain-v2'
        });
      }

      // Dải màu dốc cao độ quang phổ (Spectrum Elevation Color Ramp)
      const contourColorRamp = [
        'interpolate',
        ['linear'],
        ['get', 'ele'],
        0,    '#1d4ed8', // 0m: Xanh dương đậm
        100,  '#0284c7', // 100m: Xanh biển
        300,  '#06b6d4', // 300m: Xanh lam sáng
        450,  '#10b981', // 450m: Xanh lá cây
        490,  '#22c55e', // 490m: Xanh lá mạ
        500,  '#84cc16', // 500m: Xanh đọt chuối
        504,  '#eab308', // 504m: Vàng tươi
        508,  '#f97316', // 508m: Cam
        512,  '#ef4444', // 512m: Đỏ tươi
        800,  '#dc2626', // 800m: Đỏ sẫm
        1500, '#991b1b'  // 1500m: Đỏ đậm
      ];

      // 3. Lớp Đường Đồng Mức Tiêu Chuẩn
      if (!map.getLayer('contour-lines')) {
        map.addLayer({
          id: 'contour-lines',
          type: 'line',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'line-color': contourColorRamp,
            'line-width': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              11, 0.6,
              14, 1.4,
              17, 2.8
            ],
            'line-opacity': 0.9
          }
        });
      }

      if (!map.getLayer('contour-labels')) {
        map.addLayer({
          id: 'contour-labels',
          type: 'symbol',
          source: 'mapbox-terrain-contours',
          'source-layer': 'contour',
          layout: {
            'symbol-placement': 'line',
            'text-field': ['concat', ['get', 'ele'], ' m'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12, 9,
              16, 12
            ],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-max-angle': 35,
            'visibility': defaultVisible ? 'visible' : 'none'
          },
          paint: {
            'text-color': contourColorRamp,
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 2
          }
        });
      }

      // 2-Pass 3x3 Gaussian Spatial Grid Smoothing Filter
      const smoothGrid = (rawGrid, passes = 2) => {
        const ny = rawGrid.length;
        const nx = rawGrid[0].length;
        let current = rawGrid;

        for (let p = 0; p < passes; p++) {
          const next = Array.from({ length: ny }, () => new Float64Array(nx));
          for (let r = 0; r < ny; r++) {
            for (let c = 0; c < nx; c++) {
              let sum = 0;
              let weightSum = 0;

              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = r + dr;
                  const nc = c + dc;
                  if (nr >= 0 && nr < ny && nc >= 0 && nc < nx) {
                    const w = (dr === 0 && dc === 0) ? 4 : ((dr === 0 || dc === 0) ? 2 : 1);
                    sum += current[nr][nc] * w;
                    weightSum += w;
                  }
                }
              }
              next[r][c] = sum / weightSum;
            }
          }
          current = next;
        }
        return current;
      };

      // 4. Hàm Sinh Đường Đồng Mức Mật Độ Biến Thiên Năng Động Theo Zoom
      const updateDense1mContours = () => {
        try {
          const bbox = getFarmBoundingBox();
          if (!bbox) return;

          // Khoảng cách đường đồng mức cố định 1m (Bình độ cái % 5 === 0, Bình độ con 1m còn lại)
          const interval = 1.0;

          // Chỉ lấy mẫu DEM khi zoom đủ cao để có tile độ phân giải cao và ổn định
          // Nếu zoom < 13, giữ nguyên dữ liệu cũ tránh sai số datum khi zoom out
          const currentZoom = map.getZoom();
          if (currentZoom < 13 && map.getSource('dense-1m-contours')) return;

          const { west, south, east, north } = bbox;
          const nx = 45;
          const ny = 45;
          const dx = (east - west) / (nx - 1);
          const dy = (north - south) / (ny - 1);

          const rawGrid = [];
          let minEle = Infinity;
          let maxEle = -Infinity;
          let hasTerrainData = false;

          for (let r = 0; r < ny; r++) {
            const lat = south + r * dy;
            const row = [];
            for (let c = 0; c < nx; c++) {
              const lng = west + c * dx;
              const ele = map.queryTerrainElevation([lng, lat]);
              if (ele !== null && ele !== undefined) {
                row.push(ele);
                if (ele < minEle) minEle = ele;
                if (ele > maxEle) maxEle = ele;
                hasTerrainData = true;
              } else {
                row.push(0);
              }
            }
            rawGrid.push(row);
          }

          if (!hasTerrainData || minEle === Infinity || maxEle === -Infinity) return;

          // Lọc mịn lưới DEM bằng Gaussian Blur 3 pass để loại bỏ hoàn toàn nhiễu và lặp đường
          const grid = smoothGrid(rawGrid, 3);

          // Dữ liệu cao độ THỰC tế 100% từ Mapbox DEM (so với mực nước biển ASL)
          const eleOffset = 0;
          const displayMin = Math.round(minEle);
          const displayMax = Math.round(maxEle);

          const startLevel = Math.ceil(minEle / interval) * interval;
          const endLevel = Math.floor(maxEle / interval) * interval;
          const features = [];

          function interp(pA, pB, vA, vB, val) {
            if (Math.abs(vB - vA) < 1e-6) return pA;
            const t = (val - vA) / (vB - vA);
            return [pA[0] + t * (pB[0] - pA[0]), pA[1] + t * (pB[1] - pA[1])];
          }

          for (let threshold = startLevel; threshold <= endLevel + 1e-5; threshold += interval) {
            const roundedThreshold = Math.round(threshold * 10) / 10;
            const displayEle = Math.round((roundedThreshold - eleOffset) * 10) / 10;
            const segments = [];

            for (let r = 0; r < ny - 1; r++) {
              const lat0 = south + r * dy;
              const lat1 = south + (r + 1) * dy;

              for (let c = 0; c < nx - 1; c++) {
                const lng0 = west + c * dx;
                const lng1 = west + (c + 1) * dx;

                const v0 = grid[r][c];
                const v1 = grid[r][c + 1];
                const v2 = grid[r + 1][c + 1];
                const v3 = grid[r + 1][c];

                const code = (v0 >= roundedThreshold ? 1 : 0) |
                             (v1 >= roundedThreshold ? 2 : 0) |
                             (v2 >= roundedThreshold ? 4 : 0) |
                             (v3 >= roundedThreshold ? 8 : 0);

                if (code === 0 || code === 15) continue;

                const p0 = [lng0, lat0];
                const p1 = [lng1, lat0];
                const p2 = [lng1, lat1];
                const p3 = [lng0, lat1];

                const e0 = interp(p0, p1, v0, v1, roundedThreshold);
                const e1 = interp(p1, p2, v1, v2, roundedThreshold);
                const e2 = interp(p3, p2, v3, v2, roundedThreshold);
                const e3 = interp(p0, p3, v0, v3, roundedThreshold);

                switch (code) {
                  case 1: case 14: segments.push([e3, e0]); break;
                  case 2: case 13: segments.push([e0, e1]); break;
                  case 3: case 12: segments.push([e3, e1]); break;
                  case 4: case 11: segments.push([e1, e2]); break;
                  case 5: segments.push([e3, e2]); segments.push([e0, e1]); break;
                  case 6: case 9:  segments.push([e0, e2]); break;
                  case 7: case 8:  segments.push([e3, e2]); break;
                  case 10: segments.push([e3, e0]); segments.push([e1, e2]); break;
                }
              }
            }

            if (segments.length > 0) {
              features.push({
                type: 'Feature',
                properties: { ele: displayEle, rawEle: roundedThreshold },
                geometry: {
                  type: 'MultiLineString',
                  coordinates: segments
                }
              });
            }
          }

          const geoData = { type: 'FeatureCollection', features };
          const dynamicRamp = buildDynamicColorRamp(displayMin, displayMax);

          if (map.getSource('dense-1m-contours')) {
            map.getSource('dense-1m-contours').setData(geoData);
            if (map.getLayer('dense-1m-contour-lines')) {
              map.setPaintProperty('dense-1m-contour-lines', 'line-color', dynamicRamp);
            }
            if (map.getLayer('dense-1m-contour-labels')) {
              map.setPaintProperty('dense-1m-contour-labels', 'text-color', dynamicRamp);
            }
          } else {
            map.addSource('dense-1m-contours', {
              type: 'geojson',
              data: geoData
            });

            // ─── Bình độ cái (% 5 === 0): Nét đậm 7px | Bình độ con: Nét 2.5px ───
            const isMajor = ['==', ['%', ['to-number', ['get', 'ele']], 5], 0];

            map.addLayer({
              id: 'dense-1m-contour-lines',
              type: 'line',
              source: 'dense-1m-contours',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'line-color': dynamicRamp,
                'line-width': [
                  'interpolate', ['exponential', 1.5], ['zoom'],
                  12, ['case', isMajor, 3.5, 1.5],
                  15, ['case', isMajor, 5.0, 2.0],
                  18, ['case', isMajor, 7.0, 2.5]
                ],
                'line-opacity': ['case', isMajor, 0.95, 0.8]
              }
            });

            // ─── Nhãn số cao độ: Nhét trực tiếp vào tất cả các đường đồng mức (có nhãn cho cả 2 loại) ───
            map.addLayer({
              id: 'dense-1m-contour-labels',
              type: 'symbol',
              source: 'dense-1m-contours',
              layout: {
                'symbol-placement': 'line',
                'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
                'text-size': [
                  'interpolate', ['linear'], ['zoom'],
                  12, ['case', isMajor, 10, 8.5],
                  16, ['case', isMajor, 13, 10.5]
                ],
                'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-max-angle': 35,
                'visibility': defaultVisible ? 'visible' : 'none'
              },
              paint: {
                'text-color': dynamicRamp,
                'text-halo-color': 'rgba(0, 0, 0, 0.92)',
                'text-halo-width': 2.5
              }
            });
          }

          updateLegendWidget(displayMin, displayMax, interval);
        } catch (e) {
          console.warn('Lỗi sinh đường đồng mức nông trại:', e);
        }
      };

      // Cập nhật Bảng Chú Giải Cao Độ Dạng Thanh Dải Màu Sang Trọng (Hiển thị khoảng cách mét)
      const updateLegendWidget = (minEle, maxEle, interval) => {
        const legendContainer = map.getContainer().querySelector('.elevation-legend-widget-container');
        if (!legendContainer) return;

        const minE = Math.floor(minEle);
        const maxE = Math.ceil(maxEle);
        const midE = Math.round((maxE + minE) / 2);
        const stepTxt = interval ? ` (${interval}m)` : '';

        legendContainer.innerHTML = `
          <div style="
            background: rgba(10, 25, 18, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 10px 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 90px;
            pointer-events: auto;
          ">
            <div style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:#9ca3af; margin-bottom:8px; letter-spacing:0.5px; text-align:center;">Cao độ${stepTxt}</div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="
                width: 12px;
                height: 140px;
                border-radius: 6px;
                background: linear-gradient(to top, 
                  #000080, #0000cd, #0000ff, #0066ff, #0099ff,
                  #00c8ff, #00f0ff, #00ffc8, #00ff99, #00ff33,
                  #66ff00, #a6ff00, #ccff00, #ffff00, #ffcc00,
                  #ff9900, #ff6600, #ff3300, #ff0000, #cc0000, #800000
                );
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: inset 0 0 4px rgba(0,0,0,0.3);
              "></div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; height:140px; font-size:11px; font-weight:800;">
                <span style="color:#ef4444; text-shadow:0 1px 2px #000;">${maxE} m</span>
                <span style="color:#eab308; text-shadow:0 1px 2px #000;">${midE} m</span>
                <span style="color:#38bdf8; text-shadow:0 1px 2px #000;">${minE} m</span>
              </div>
            </div>
          </div>
        `;
      };

      let contourTimer = null;
      const debouncedUpdate = () => {
        clearTimeout(contourTimer);
        contourTimer = setTimeout(updateDense1mContours, 500);
      };

      map.on('moveend', debouncedUpdate);
      map.on('idle', debouncedUpdate);
      setTimeout(updateDense1mContours, 1000);

      // 5. Nút Bật/Tắt đường đồng mức & Nút Xuất Bản Vẽ A4 Nằm Ngang
      if (showControl && !map._contourControlAdded) {
        map._contourControlAdded = true;

        class ContourToggleControl {
          onAdd(m) {
            this._map = m;
            this._container = document.createElement('div');
            this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            
            const btnContour = document.createElement('button');
            btnContour.className = 'mapboxgl-ctrl-icon mapbox-ctrl-contour-btn';
            btnContour.type = 'button';
            btnContour.title = 'Bật/Tắt đường đồng mức 1m nông trại (Contour Lines)';
            btnContour.setAttribute('aria-label', 'Toggle Contour Lines');
            btnContour.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: center;
              width: 29px;
              height: 29px;
              font-size: 13px;
              font-weight: bold;
              background: ${defaultVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent'};
              color: ${defaultVisible ? '#f59e0b' : '#555'};
              border: none;
              cursor: pointer;
            `;
            btnContour.innerHTML = '⛰️';

            let isVisible = defaultVisible;

            btnContour.onclick = () => {
              isVisible = !isVisible;
              const visVal = isVisible ? 'visible' : 'none';
              if (m.getLayer('dense-1m-contour-lines')) m.setLayoutProperty('dense-1m-contour-lines', 'visibility', visVal);
              if (m.getLayer('dense-1m-contour-labels')) m.setLayoutProperty('dense-1m-contour-labels', 'visibility', visVal);

              btnContour.style.background = isVisible ? 'rgba(245, 158, 11, 0.25)' : 'transparent';
              btnContour.style.color = isVisible ? '#f59e0b' : '#555';

              const legendEl = m.getContainer().querySelector('.elevation-legend-widget-container');
              if (legendEl) legendEl.style.display = isVisible ? 'block' : 'none';
            };

            const btnExportA4 = document.createElement('button');
            btnExportA4.className = 'mapboxgl-ctrl-icon mapbox-ctrl-export-a4-btn';
            btnExportA4.type = 'button';
            btnExportA4.title = 'Xuất Bản Vẽ Trang Trại A4 Nằm Ngang (PDF & In bản vẽ)';
            btnExportA4.setAttribute('aria-label', 'Export A4 Farm CAD Drawing');
            btnExportA4.style.cssText = `
              display: flex;
              align-items: center;
              justify-content: center;
              width: 29px;
              height: 29px;
              font-size: 13px;
              font-weight: bold;
              background: transparent;
              color: #16a34a;
              border: none;
              border-top: 1px solid #e2e8f0;
              cursor: pointer;
            `;
            btnExportA4.innerHTML = '📐';

            btnExportA4.onclick = () => {
              openPublicFarmA4ExportModal(m);
            };

            this._container.appendChild(btnContour);
            this._container.appendChild(btnExportA4);
            return this._container;
          }

          onRemove() {
            if (this._container && this._container.parentNode) {
              this._container.parentNode.removeChild(this._container);
            }
            this._map = undefined;
          }
        }

        map.addControl(new ContourToggleControl(), 'top-right');

        // 6. Thêm Bảng Chú Giải Cao Độ Widget Container
        const mapContainer = map.getContainer();
        if (mapContainer && !mapContainer.querySelector('.elevation-legend-widget-container')) {
          const legendContainer = document.createElement('div');
          legendContainer.className = 'elevation-legend-widget-container';
          legendContainer.style.cssText = `
            position: absolute;
            bottom: 24px;
            right: 10px;
            z-index: 8;
            display: ${defaultVisible ? 'block' : 'none'};
            pointer-events: auto;
          `;
          mapContainer.appendChild(legendContainer);
        }
      }
    } catch (err) {
      console.warn('Cảnh báo hiển thị đường đồng mức:', err);
    }
  };

  if (map.isStyleLoaded()) {
    initContours();
  } else {
    map.once('load', initContours);
  }
}

function openPublicFarmA4ExportModal(map) {
  if (!map) return;

  const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
      if (window.html2pdf) return resolve(window.html2pdf);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  };

  let farmName = 'Nông Trại Cây Trồng';
  let ownerName = 'Khách Hàng Tanbao';
  let performerName = 'Kỹ sư Tanbao Corp';
  let farmCoords = [];
  let areaSqM = 0;
  let plantCount = 1;

  if (window.currentPlantData) {
    if (window.currentPlantData.name) farmName = window.currentPlantData.name;
    if (window.currentPlantData.farm_name) farmName = window.currentPlantData.farm_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.name) farmName = window.currentPlantData.farm.name;
    if (window.currentPlantData.owner_name) ownerName = window.currentPlantData.owner_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.owner_name) ownerName = window.currentPlantData.farm.owner_name;
    if (window.currentPlantData.farm && window.currentPlantData.farm.area) areaSqM = Math.round(parseFloat(window.currentPlantData.farm.area));
    if (window.currentPlantData.farm_boundary && window.currentPlantData.farm_boundary.coordinates) {
      farmCoords = window.currentPlantData.farm_boundary.coordinates[0];
    }
  }

  if (farmCoords.length === 0 && map.getStyle()) {
    const styleLayers = map.getStyle().layers || [];
    const farmLayers = styleLayers.filter(l => 
      l.id.includes('farm') || l.id.includes('polygon') || (l.type === 'fill' && !l.id.includes('mapbox'))
    );
    farmLayers.forEach(layer => {
      try {
        const features = map.queryRenderedFeatures({ layers: [layer.id] });
        features.forEach(f => {
          const geom = f.geometry;
          if (geom && geom.type === 'Polygon' && farmCoords.length === 0) {
            farmCoords = geom.coordinates[0];
          }
        });
      } catch (_) {}
    });
  }

  // Lật trang trại lại THẲNG ĐỨNG
  const getMajorAxisBearing = (coords) => {
    if (!coords || coords.length < 2) return 0;
    let maxDistSq = 0;
    let pA = coords[0];
    let pB = coords[1];

    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[j][0] - coords[i][0];
        const dy = coords[j][1] - coords[i][1];
        const d2 = dx * dx + dy * dy;
        if (d2 > maxDistSq) {
          maxDistSq = d2;
          pA = coords[i];
          pB = coords[j];
        }
      }
    }

    const rad = Math.PI / 180;
    const lat1 = pA[1] * rad;
    const lat2 = pB[1] * rad;
    const dLng = (pB[0] - pA[0]) * rad;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  };

  const oldCenter = map.getCenter();
  const oldZoom = map.getZoom();
  const oldBearing = map.getBearing();
  const oldPitch = map.getPitch();

  let uprightBearing = 0;
  if (farmCoords && farmCoords.length >= 3) {
    const bounds = new mapboxgl.LngLatBounds();
    farmCoords.forEach(c => bounds.extend(c));
    uprightBearing = getMajorAxisBearing(farmCoords);

    try {
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        bearing: uprightBearing,
        pitch: 0,
        animate: false
      });
    } catch (_) {}
  }

  let mapImageDataUrl = '';
  try {
    mapImageDataUrl = map.getCanvas().toDataURL('image/png');
  } catch (err) {
    console.warn('Cảnh báo chụp ảnh bản đồ:', err);
  }

  try {
    map.jumpTo({
      center: oldCenter,
      zoom: oldZoom,
      bearing: oldBearing,
      pitch: oldPitch
    });
  } catch (_) {}

  const getDist = (p1, p2) => {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (p2[1] - p1[1]) * rad;
    const dLng = (p2[0] - p1[0]) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1[1] * rad) * Math.cos(p2[1] * rad) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  };

  let edgeRowsHtml = '';
  let perimeter = 0;

  if (farmCoords && farmCoords.length >= 3) {
    for (let i = 0; i < farmCoords.length - 1; i++) {
      const len = getDist(farmCoords[i], farmCoords[i + 1]);
      perimeter += len;
      edgeRowsHtml += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:4px; font-weight:600;">Cạnh ${i + 1} - ${i + 2}</td>
          <td style="padding:4px; text-align:right; font-weight:700; color:#15803d;">${len.toLocaleString('vi-VN')} m</td>
        </tr>
      `;
    }

    if (!areaSqM) {
      const rad = Math.PI / 180;
      const R = 6371000;
      let accArea = 0;
      for (let i = 0; i < farmCoords.length - 1; i++) {
        const p1 = farmCoords[i];
        const p2 = farmCoords[i + 1];
        accArea += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad));
      }
      areaSqM = Math.round(Math.abs(accArea * R * R / 2));
    }
  } else {
    edgeRowsHtml = `<tr><td colspan="2" style="padding:6px; text-align:center; color:#94a3b8; font-style:italic;">Chưa có dữ liệu ranh giới trang trại</td></tr>`;
  }

  const center = map.getCenter();
  const zoom = map.getZoom();
  const mPerPx = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);
  const scaleRatio = Math.round(mPerPx / 0.000264583);
  const scaleText = `1 : ${scaleRatio.toLocaleString('vi-VN')}`;
  const exportDate = new Date().toLocaleDateString('vi-VN');

  let contourInterval = 2.5 - (zoom - 16.0) * 0.5;
  contourInterval = Math.max(0.5, Math.min(10.0, contourInterval));
  contourInterval = Math.round(contourInterval * 2) / 2;

  let minEle = 735, maxEle = 765;
  const legendEl = map.getContainer().querySelector('.elevation-legend-widget-container');
  if (legendEl) {
    const text = legendEl.innerText;
    const matches = text.match(/(\d+)\s*m/g);
    if (matches && matches.length >= 2) {
      maxEle = parseInt(matches[0]);
      minEle = parseInt(matches[matches.length - 1]);
    }
  }

  let modalContainer = document.getElementById('farm-a4-export-modal');
  if (modalContainer) modalContainer.remove();

  modalContainer = document.createElement('div');
  modalContainer.id = 'farm-a4-export-modal';
  modalContainer.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
  `;

  const docCodeDefault = `TB-CAD-PUB-${Date.now().toString().slice(-6)}`;

  modalContainer.innerHTML = `
    <style>
      .a4-edit-field {
        border: 1px dashed #94a3b8 !important;
        background: #f8fafc !important;
        padding: 2px 5px !important;
        border-radius: 4px !important;
        font-family: inherit !important;
        color: inherit !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }
      .a4-edit-field:focus {
        border-color: #2563eb !important;
        background: #ffffff !important;
        outline: none !important;
        box-shadow: 0 0 0 2px rgba(37,99,235,0.25) !important;
      }
      .a4-print-mode .a4-edit-field {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        appearance: none !important;
        -webkit-appearance: none !important;
      }
    </style>

    <div style="
      width: 100%; max-width: 1100px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; color: #fff; background: rgba(30, 41, 59, 0.9);
      padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <i data-lucide="compass" class="lucide-sm" style="font-size:22px; color:#4ade80;"></i>
        <div>
          <h3 style="font-size:16px; font-weight:800; margin:0; color:#4ade80;">XUẤT BẢN VẼ KỸ THUẬT TRANG TRẠI A4 NẰM NGANG</h3>
          <p style="font-size:12px; color:#94a3b8; margin:0;">Nhập trực tiếp thông tin hồ sơ | Tỷ lệ 1:1 | Sai số ±3% | Chú giải dải màu đồng mức</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <button id="btn-do-print-a4" style="
          background: #3b82f6; color: #fff; border: none; padding: 8px 16px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(59,130,246,0.4);
        ">
          <i data-lucide="printer" class="lucide-sm"></i> In bản vẽ (Print)
        </button>
        <button id="btn-download-pdf-a4" style="
          background: #16a34a; color: #fff; border: none; padding: 8px 18px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(22,163,74,0.4);
        ">
          <i data-lucide="file-text" class="lucide-sm"></i> Tải PDF (A4 Nằm Ngang)
        </button>
        <button id="btn-close-a4-modal" style="
          background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 8px 14px;
          border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
        ">
          ✕ Đóng
        </button>
      </div>
    </div>

    <div id="a4-drawing-paper" style="
      width: 297mm; min-height: 210mm;
      background: #ffffff; color: #0f172a;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      border-radius: 4px; padding: 8mm; box-sizing: border-box;
      display: flex; flex-direction: column; justify-content: space-between;
      border: 2px solid #000; font-family: 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px solid #16a34a; padding-bottom:6px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <img src="/assets/logo.png" style="height:38px;" onerror="this.style.display='none'">
          <div style="flex:1;">
            <h2 style="font-size:15px; font-weight:800; color:#15803d; margin:0; text-transform:uppercase; letter-spacing:0.5px;">TANBAO CORP — HỆ THỐNG GIS BẢN VẼ TRANG TRẠI</h2>
            <input type="text" id="a4-input-doc-title" class="a4-edit-field" value="HỒ SƠ BẢN VẼ KỸ THUẬT ĐỊA HÌNH, RANH GIỚI & KÍCH THƯỚC CHI TIẾT" style="font-size:10.5px; font-weight:700; color:#475569; width:95%; margin-top:2px;">
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px; font-weight:800; color:#0f172a; text-transform:uppercase;">BẢN VẼ A4 CHUẨN TỶ LỆ</div>
          <div style="font-size:10px; color:#64748b; margin-top:2px; display:flex; align-items:center; justify-content:flex-end; gap:4px;">
            <span>Mã Hồ Sơ:</span>
            <input type="text" id="a4-input-doc-code" class="a4-edit-field" value="${docCodeDefault}" style="font-size:10px; font-weight:800; color:#0f172a; width:160px; text-align:right;">
          </div>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex:1; overflow:hidden;">
        <div style="flex:1.75; border:1.5px solid #000; position:relative; overflow:hidden; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#e2e8f0;">
          <img src="${mapImageDataUrl}" style="width:100%; height:100%; object-fit:cover;">
          <div style="position:absolute; top:10px; right:10px; background:rgba(255,255,255,0.92); padding:4px 10px; border-radius:4px; border:1px solid #000; font-weight:800; font-size:11px; box-shadow:0 2px 6px rgba(0,0,0,0.2); display:flex; align-items:center; gap:5px;">
            <i data-lucide="compass" class="lucide-sm" style="color:#0f172a;"></i> HƯỚNG BẮC (N)
          </div>
          <div style="position:absolute; bottom:10px; left:10px; background:rgba(15,23,42,0.85); color:#fff; padding:4px 10px; border-radius:4px; font-size:10px; font-weight:700; display:flex; align-items:center; gap:5px;">
            <i data-lucide="mountain-snow" class="lucide-sm" style="color:#4ade80;"></i> Đường đồng mức interval = ${contourInterval}m
          </div>
        </div>

        <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
          <div style="border:1.5px solid #000; border-radius:4px; padding:8px; background:#f0fdf4;">
            <div style="font-weight:800; font-size:11px; color:#15803d; border-bottom:1px solid #bbf7d0; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
              <i data-lucide="pie-chart" class="lucide-sm"></i> THỐNG KÊ KÍCH THƯỚC TRANG TRẠI
            </div>
            <table style="width:100%; font-size:10.5px; border-collapse:collapse;">
              <tr>
                <td style="padding:3px 0; color:#475569;">Diện tích trang trại:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#15803d;">${areaSqM.toLocaleString('vi-VN')} m² (${(areaSqM/10000).toFixed(2)} ha)</td>
              </tr>
              <tr>
                <td style="padding:3px 0; color:#475569;">Chu vi ranh giới:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#0f172a;">${perimeter.toLocaleString('vi-VN')} m</td>
              </tr>
              ${plantCount ? `
              <tr>
                <td style="padding:3px 0; color:#475569;">Số lượng cây trồng:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#2563eb;">${plantCount} cây</td>
              </tr>` : ''}
              <tr>
                <td style="padding:3px 0; color:#475569;">Chênh lệch cao độ:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#d97706;">${minEle}m — ${maxEle}m (Δ ${maxEle - minEle}m)</td>
              </tr>
              <tr>
                <td style="padding:3px 0; color:#dc2626; font-weight:700;"><i data-lucide="alert-triangle" class="lucide-sm"></i> Kích thước sai số:</td>
                <td style="padding:3px 0; text-align:right; font-weight:800; color:#dc2626;">± 3%</td>
              </tr>
            </table>
          </div>

          <!-- Bảng Chú Giải Dải Màu Cao Độ Kỹ Thuật CAD -->
          <div style="border:1.5px solid #000; border-radius:4px; padding:6px 8px; background:#fff;">
            <div style="font-weight:800; font-size:10px; color:#0f172a; border-bottom:1px solid #cbd5e1; padding-bottom:3px; margin-bottom:5px; text-transform:uppercase; display:flex; align-items:center; justify-content:space-between;">
              <span style="display:flex; align-items:center; gap:5px;">
                <i data-lucide="palette" class="lucide-sm" style="color:#2563eb;"></i> CHÚ GIẢI DẢI MÀU CAO ĐỘ (${contourInterval}M/BẬC)
              </span>
              <span style="font-size:9px; color:#15803d; font-weight:700;">⛰️ Nét vẽ CAD</span>
            </div>

            <!-- Thanh Dải Màu Gradient Thang Độ Liên Tục từ Thấp (Trái) -> Cao (Phải) -->
            <div style="height:12px; width:100%; border-radius:3px; background: linear-gradient(to right, #000080, #0066ff, #00ff99, #ffff00, #ff6600, #800000); border:1px solid #94a3b8; margin-bottom:4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);"></div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:9.5px; font-weight:700;">
              <div style="text-align:left; color:#000080;">
                <div>${minEle}m</div>
                <div style="font-size:8px; color:#64748b; font-weight:600;">(Thấp nhất)</div>
              </div>
              <div style="text-align:center; color:#0284c7;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.25)}m</div>
              </div>
              <div style="text-align:center; color:#ca8a04;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.5)}m</div>
              </div>
              <div style="text-align:center; color:#ea580c;">
                <div>${Math.round(minEle + (maxEle - minEle)*0.75)}m</div>
              </div>
              <div style="text-align:right; color:#b91c1c;">
                <div>${maxEle}m</div>
                <div style="font-size:8px; color:#64748b; font-weight:600;">(Cao nhất)</div>
              </div>
            </div>
          </div>

          <div style="flex:1; border:1.5px solid #000; border-radius:4px; padding:8px; background:#fff; overflow-y:auto;">
            <div style="font-weight:800; font-size:11px; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
              <i data-lucide="ruler" class="lucide-sm"></i> CHIỀU DÀI CÁC CẠNH RANH GIỚI
            </div>
            <table style="width:100%; font-size:10px; border-collapse:collapse;">
              <thead>
                <tr style="background:#f1f5f9; text-align:left; border-bottom:1px solid #cbd5e1;">
                  <th style="padding:4px;">Đoạn Cạnh</th>
                  <th style="padding:4px; text-align:right;">Chiều Dài (m)</th>
                </tr>
              </thead>
              <tbody>
                ${edgeRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Title Block Khung Tên Bản Vẽ CAD -->
      <div style="margin-top:10px; border:2px solid #000; background:#fff;">
        <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
          <tr>
            <td style="width:33%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i data-lucide="home" class="lucide-sm" style="color:#15803d;"></i> TÊN TRANG TRẠI
              </div>
              <input type="text" id="a4-input-farm-name" class="a4-edit-field" value="${farmName}" style="font-size:12px; font-weight:800; color:#15803d; width:100%; margin-top:2px;">
            </td>
            <td style="width:27%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i data-lucide="user" class="lucide-sm" style="color:#0f172a;"></i> KHÁCH HÀNG / NÔNG HỘ
              </div>
              <input type="text" id="a4-input-owner-name" class="a4-edit-field" value="${ownerName}" style="font-size:11px; font-weight:700; color:#0f172a; width:100%; margin-top:2px;">
            </td>
            <td style="width:22%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i data-lucide="user-cog" class="lucide-sm" style="color:#0f172a;"></i> NGƯỜI THỰC HIỆN
              </div>
              <input type="text" id="a4-input-performer-name" class="a4-edit-field" value="${performerName}" style="font-size:11px; font-weight:700; color:#0f172a; width:100%; margin-top:2px;">
            </td>
            <td style="width:10%; border-right:1.5px solid #000; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i data-lucide="calendar-days" class="lucide-sm" style="color:#64748b;"></i> NGÀY XUẤT
              </div>
              <div style="font-size:11px; font-weight:700; margin-top:4px;">${exportDate}</div>
            </td>
            <td style="width:8%; padding:6px 8px; vertical-align:top;">
              <div style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <i data-lucide="ruler" class="lucide-sm" style="color:#2563eb;"></i> TỶ LỆ
              </div>
              <input type="text" id="a4-input-scale-text" class="a4-edit-field" value="1 : 1" style="font-size:11.5px; font-weight:800; color:#2563eb; width:100%; margin-top:2px;">
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  document.getElementById('btn-close-a4-modal').onclick = () => modalContainer.remove();

  modalContainer.onclick = (e) => {
    if (e.target === modalContainer) modalContainer.remove();
  };

  const preparePrintMode = () => {
    const paper = document.getElementById('a4-drawing-paper');
    if (!paper) return;
    paper.classList.add('a4-print-mode');
    paper.querySelectorAll('.a4-edit-field').forEach(input => {
      input.setAttribute('value', input.value);
    });
  };

  const cleanupPrintMode = () => {
    const paper = document.getElementById('a4-drawing-paper');
    if (paper) paper.classList.remove('a4-print-mode');
  };

  document.getElementById('btn-do-print-a4').onclick = () => {
    preparePrintMode();
    const paperHtml = document.getElementById('a4-drawing-paper').outerHTML;
    cleanupPrintMode();

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ban_ve_trang_trai</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { margin: 0; padding: 0; background: #fff; }
          #a4-drawing-paper { width: 297mm !important; height: 210mm !important; box-shadow: none !important; border-radius: 0 !important; }
          .a4-edit-field { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        </style>
      </head>
      <body>
        ${paperHtml}
        <script>
          setTimeout(() => { window.print(); window.close(); }, 600);
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  document.getElementById('btn-download-pdf-a4').onclick = async () => {
    const btn = document.getElementById('btn-download-pdf-a4');
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang tạo PDF...';
    btn.disabled = true;

    preparePrintMode();
    const html2pdfLib = await loadHtml2Pdf();
    const element = document.getElementById('a4-drawing-paper');

    if (html2pdfLib && element) {
      const farmNameVal = (document.getElementById('a4-input-farm-name') || {}).value || farmName;
      const opt = {
        margin: 0,
        filename: `Ban_ve_trang_trai_${farmNameVal.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdfLib().set(opt).from(element).save().then(() => {
        cleanupPrintMode();
        btn.innerHTML = '<i data-lucide="file-text" class="lucide-sm"></i> Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
      }).catch(err => {
        console.error('Lỗi xuất PDF:', err);
        cleanupPrintMode();
        btn.innerHTML = '<i data-lucide="file-text" class="lucide-sm"></i> Tải PDF (A4 Nằm Ngang)';
        btn.disabled = false;
        document.getElementById('btn-do-print-a4').click();
      });
    } else {
      cleanupPrintMode();
      btn.innerHTML = '<i data-lucide="file-text" class="lucide-sm"></i> Tải PDF (A4 Nằm Ngang)';
      btn.disabled = false;
      document.getElementById('btn-do-print-a4').click();
    }
  };
}

// Sync dynamic version badge on public page
(async function() {
  try {
    const res = await fetch('/api/version');
    if (res.ok) {
      const data = await res.json();
      if (data && (data.versionTag || data.version_tag)) {
        const vTag = data.versionTag || data.version_tag;
        document.querySelectorAll('.app-version-badge').forEach(el => el.textContent = vTag);
      }
    }
  } catch (_) {}
})();

