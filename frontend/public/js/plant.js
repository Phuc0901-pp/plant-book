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

function userHasFarmAccess(user, farmId, farmObj = null) {
  if (!user || !user.id) return false;
  if (user.role === 'admin') return true;
  const targetFarmId = Number(farmId);
  if (user.farm_id && Number(user.farm_id) === targetFarmId) return true;
  if (Array.isArray(user.owned_farm_ids) && user.owned_farm_ids.map(Number).includes(targetFarmId)) return true;
  
  if (farmObj) {
    if (farmObj.user_id && Number(farmObj.user_id) === Number(user.id)) return true;
    if (farmObj.farm_owner_user_id && Number(farmObj.farm_owner_user_id) === Number(user.id)) return true;
    if (farmObj.owner_id && Number(farmObj.owner_id) === Number(user.id)) return true;
    if (farmObj.userId && Number(farmObj.userId) === Number(user.id)) return true;
    if (farmObj.farmOwnerUserId && Number(farmObj.farmOwnerUserId) === Number(user.id)) return true;
  }
  
  const currentFarm = window._currentFarmPortalData?.farm;
  if (currentFarm && (!targetFarmId || Number(currentFarm.id) === targetFarmId)) {
    if (currentFarm.user_id && Number(currentFarm.user_id) === Number(user.id)) return true;
    if (currentFarm.owner_id && Number(currentFarm.owner_id) === Number(user.id)) return true;
  }
  return false;
}

function userHasPlantAccess(user, plant) {
  if (!user || !user.id || !plant) return false;
  if (user.role === 'admin') return true;
  if (plant.farm_id && userHasFarmAccess(user, plant.farm_id, plant)) return true;
  if (user.farm_id && plant.farm_id && Number(user.farm_id) === Number(plant.farm_id)) return true;
  if (Array.isArray(user.owned_farm_ids) && plant.farm_id && user.owned_farm_ids.map(Number).includes(Number(plant.farm_id))) return true;
  if (plant.assigned_to_user_id && Number(user.id) === Number(plant.assigned_to_user_id)) return true;
  if (plant.farm_owner_user_id && Number(user.id) === Number(plant.farm_owner_user_id)) return true;
  if (plant.farm_owner_id && Number(user.id) === Number(plant.farm_owner_id)) return true;
  if (plant.farm_user_id && Number(user.id) === Number(plant.farm_user_id)) return true;
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
    const cropType = plant.plant_type || 'durian';
    const eng = resolveCropEnglishName(cropType);
    imgEl.onerror = function() {
      if (this.src.endsWith('/assets/crop/' + eng + '.png')) {
        this.src = '/assets/' + eng + '.png';
      } else if (this.src.endsWith('/assets/' + eng + '.png')) {
        this.src = '/assets/crop/durian.png';
      } else if (this.src.endsWith('/assets/crop/durian.png')) {
        this.src = '/assets/durian.png';
      } else {
        this.onerror = null;
        this.src = '/assets/crop/durian.png';
      }
    };
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
      const isAuthorized = userHasFarmAccess(data.user, pFarm.farmId, pFarm);
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

function showPublicToast(msg, type = 'info') {
  let toast = document.getElementById('public-auth-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'public-auth-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(15, 23, 42, 0.94)';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.backdropFilter = 'blur(8px)';
    toast.style.border = '1px solid rgba(255,255,255,0.18)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
  }

  let iconName = 'info';
  let iconColor = '#34d399';
  if (type === 'error' || /lỗi|thất bại|không thể|chưa|hết hàng/i.test(msg)) {
    iconName = 'alert-circle';
    iconColor = '#f87171';
  } else if (type === 'warning' || /cảnh báo|chú ý/i.test(msg)) {
    iconName = 'alert-triangle';
    iconColor = '#fbbf24';
  } else if (type === 'success' || /thành công|đã lưu|đã phát hiện|hợp lệ/i.test(msg)) {
    iconName = 'check-circle-2';
    iconColor = '#34d399';
  } else if (/nfc|quét|chạm/i.test(msg)) {
    iconName = 'radio';
    iconColor = '#38bdf8';
  } else if (/giọng nói|ghi nhận|micro/i.test(msg)) {
    iconName = 'mic';
    iconColor = '#a78bfa';
  }

  const cleanMsg = msg.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]+/g, '').trim();
  toast.innerHTML = `<i data-lucide="${iconName}" class="lucide-sm" style="color:${iconColor}; flex-shrink:0;"></i> <span>${cleanMsg}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  if (window.lucide) window.lucide.createIcons();
  
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
// [Modularized] Modal helpers moved to plant-care-modals.js

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
    ${(() => {
      if (totalItems <= pageSize) {
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: #64748b; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span>Tổng số: <strong>${totalItems}</strong> mặt hàng vật tư trong kho</span>
            <span style="font-weight: 700; color: #059669;">Trang 1 / 1 (10 bản ghi / trang)</span>
          </div>
        `;
      }

      let pageButtonsHtml = '';
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
          const isActive = p === page;
          pageButtonsHtml += `
            <button type="button" class="btn btn-xs ${isActive ? 'btn-primary' : 'btn-secondary'}" onclick="${onPageChangeFnName}(${p})" 
              style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 6px; border: 1px solid ${isActive ? '#059669' : '#cbd5e1'}; background: ${isActive ? '#059669' : '#ffffff'}; color: ${isActive ? '#ffffff' : '#334155'}; cursor: ${isActive ? 'default' : 'pointer'}; min-width: 30px; height: 28px;">
              ${p}
            </button>
          `;
        } else if (p === page - 2 || p === page + 2) {
          pageButtonsHtml += `<span style="padding: 2px 4px; color: #94a3b8; font-size: 12px; font-weight: 700;">…</span>`;
        }
      }

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600;">
            Hiển thị <strong>${startIdx + 1} - ${Math.min(startIdx + pageSize, totalItems)}</strong> trên <strong>${totalItems}</strong> vật tư (10 bản ghi / trang)
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <button type="button" class="btn btn-secondary btn-xs" ${page <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="${onPageChangeFnName}(${page - 1})"`} style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; border-radius: 6px; height: 28px; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="chevron-left" class="lucide-xs"></i> Trước
            </button>
            ${pageButtonsHtml}
            <button type="button" class="btn btn-secondary btn-xs" ${page >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : `onclick="${onPageChangeFnName}(${page + 1})"`} style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; border-radius: 6px; height: 28px; display: flex; align-items: center; gap: 4px;">
              Tiếp <i data-lucide="chevron-right" class="lucide-xs"></i>
            </button>
          </div>
        </div>
      `;
    })()}
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
  const stockBadge = isPermanent ? '' : (isOut ? ' [HẾT HÀNG]' : ` (Tồn kho: ${stock} ${s.unit})`);

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
          ${_formatSupplyOptionText(s)}
        </option>
      `).join('');
      html += '<option value="" data-price="0">Không hạch toán tiền nước</option>';
      waterSelect.innerHTML = html;
    } else {
      waterSelect.innerHTML = `
        <option value="" data-price="0">Nước giếng khoan trang trại (Không tính phí)</option>
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
            ${_formatSupplyOptionText(s)}
          </option>
        `;
      }).join('');
    } else {
      (configData.fertilizers || ['NPK 20-20-15', 'Phân hữu cơ vi sinh', 'DAP', 'Ure', 'Kali']).forEach(f => {
        html += `<option value="" data-name="${esc(f)}" data-price="0" data-unit="kg">${esc(f)}</option>`;
      });
    }
    html += '<option value="__custom__">+ Phân bón khác (Nhập thủ công)...</option>';
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
            ${_formatSupplyOptionText(s)}
          </option>
        `;
      }).join('');
    } else {
      (configData.pesticides || ['Ridomil Gold 68WG', 'Anvil 5SC', 'Radiant 60SC', 'Confidor 200SL', 'Coc 85']).forEach(p => {
        html += `<option value="" data-name="${esc(p)}" data-ing="Hoạt chất phổ thông" data-phi="14" data-price="0" data-unit="ml">${esc(p)}</option>`;
      });
    }
    html += '<option value="__custom__">+ Thuốc BVTV khác (Nhập thủ công)...</option>';
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
        showPublicToast(`Đã ghi nhận: "${transcript}"`, 'speech');
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
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
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
        document.title = `Sổ Nông Nhàn - TBSG Agtech - Hồ sơ cây ${plant.tree_code || plant.id} - Vườn ${plant.farm_name || 'Tân Bảo'}`;
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
    document.title = `Sổ Nông Nhàn - TBSG Agtech - Hồ sơ cây ${plant.tree_code || plant.id} - Vườn ${plant.farm_name || 'Tân Bảo'}`;

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

// [Modularized] Field binding, Web NFC & Smart Farm Gateway moved to plant-nfc-gateway.js
// Helper: Get fertilizer / supply / pesticide name from details
// [Modularized] Timeline & agronomic calculators moved to plant-timeline.js
// Render dynamic plant data with 4-Section Enterprise Profile System
async function renderPlant(plant, isEditable) {
  document.title = `Sổ Nông Nhàn - TBSG Agtech - Hồ sơ cây ${plant.tree_code || plant.id} - Vườn ${plant.farm_name || 'Tân Bảo'}`;
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
  const vietgapNumber = plant.vietgap_cert_number || 'VG-2024-8892';
  const vietgapOrg = plant.vietgap_cert_org || 'Trung tâm Giám định & Chứng nhận Nông nghiệp (AgriCert)';
  const certStandard = plant.vietgap_cert_number ? `VietGAP ${esc(plant.vietgap_cert_number)}` : 'VietGAP Trồng Trọt (TCVN 11892-1:2017)';
  const seedOrigin = extra.seed_origin || 'Viện Cây Ăn Quả Miền Nam (SOFRI) - F1';
  const batchCode = extra.batch_code || (pucCode + '-' + new Date().getFullYear() + '-LOT-' + (plant.plot_code || 'A1'));
  const farmerOwnerName = plant.owner_name || plant.farm_name || 'Nông hộ Tân Bảo Agtech';
  const farmerOwnerPhone = plant.owner_phone || '0908.048.895';
  const farmAddress = plant.farm_address || 'Vùng chuyên canh nông sản Tân Bảo';
  const plotInfo = plant.plot_code ? (plant.row_number ? `Lô: ${esc(plant.plot_code)} · Hàng: ${plant.row_number}` : `Lô: ${esc(plant.plot_code)}`) : (plant.location ? esc(plant.location) : 'Lô A-01 (Khu thực nghiệm)');
  const growthStage = plant.initial_growth_stage || (plant.plant_type && plant.plant_type.toLowerCase().includes('sầu') ? 'Kinh doanh (Ra hoa - Nuôi trái)' : 'Sinh trưởng ổn định');
  const gpsAccuracyText = plant.gps_accuracy ? `±${parseFloat(plant.gps_accuracy).toFixed(1)}m` : '±1.2m (RTK-GPS)';
  const securityHash = `SHA256-TBAG-${((Number(plant.id || 1) * 883 + 1307) % 65535).toString(16).toUpperCase()}-VERIFIED`;

  // ── Media Categorization Engine ──
  const allMediaList = [];
  const mediaSeenUrls = new Set();

  function addMediaItem(url, type, caption, category, date) {
    if (!url || !url.trim() || mediaSeenUrls.has(url.trim())) return;
    mediaSeenUrls.add(url.trim());
    allMediaList.push({
      url: url.trim(),
      type: type || (url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image'),
      caption: caption || 'Minh chứng canh tác thực địa',
      category: category || 'growth',
      date: date || plant.created_at
    });
  }

  // 1. Direct media array
  (plant.media || []).forEach(m => {
    let cat = m.category || (m.media_type === 'video' ? 'video' : 'growth');
    if (m.caption && /bệnh|sâu|nấm|thối|rệp|chích/i.test(m.caption)) cat = 'disease';
    addMediaItem(m.url, m.media_type, m.caption, cat, m.created_at);
  });

  // 2. Cover image (if real photo)
  if (plant.cover_image && !plant.cover_image.includes('photo-1587293852726-70cdb56c2866')) {
    addMediaItem(plant.cover_image, 'image', `Ảnh sinh trưởng Cây #${plant.tree_code || plant.id}`, 'growth', plant.created_at);
  }

  // 3. Media from logs
  (plant.logs || []).forEach(l => {
    const details = l.details || {};
    const photoUrl = l.photo_url || details.photo_url || details.image_url;
    const videoUrl = details.video_url || l.video_url;
    const date = l.log_date || l.created_at;

    if (photoUrl) {
      const isDisease = l.log_type === 'Bệnh cây' || /bệnh|sâu|nấm/i.test(l.log_type || '');
      addMediaItem(photoUrl, 'image', isDisease ? `[Bệnh cây] ${details.disease_name || l.note || 'Ảnh triệu chứng'}` : `[${l.log_type}] ${getCareLogSummary(l)}`, isDisease ? 'disease' : 'growth', date);
    }
    if (videoUrl) {
      addMediaItem(videoUrl, 'video', `[Video thực địa] ${l.log_type || 'Nhật ký'}: ${esc(l.note || '')}`, 'video', date);
    }
  });

  const growthPhotos = allMediaList.filter(m => m.category === 'growth' && m.type !== 'video');
  const diseasePhotos = allMediaList.filter(m => m.category === 'disease' && m.type !== 'video');
  const fieldVideos = allMediaList.filter(m => m.type === 'video' || m.category === 'video');

  window._allPublicMedia = allMediaList;

  // Update Enterprise Unified Header Slots
  const breadcrumbSlot = document.getElementById('erp-header-breadcrumbs-slot');
  if (breadcrumbSlot) {
    breadcrumbSlot.innerHTML = `
      <nav class="erp-breadcrumbs-nav" aria-label="Breadcrumb">
        <a href="/${plant.farm_id ? plant.farm_id + '/public' : ''}" class="breadcrumb-item home" title="Trang trại ${esc(plant.farm_name || '')}">
          <i data-lucide="sprout" class="lucide-xs"></i> <span>${esc(plant.farm_name || 'Trang trại Tân Bảo')}</span>
        </a>
        <span class="breadcrumb-separator"><i data-lucide="chevron-right" class="lucide-xs"></i></span>
        <span class="breadcrumb-item current">
          <strong>Cây #${esc(plant.tree_code || plant.id)}</strong> (${esc(plant.plant_type)})
        </span>
        <span class="breadcrumb-trace-tag">${traceCode}</span>
      </nav>
    `;
  }

  const actionSlot = document.getElementById('erp-header-actions-slot');
  if (actionSlot) {
    if (isEditable && user && user.id) {
      actionSlot.innerHTML = `
        <button type="button" class="erp-nav-btn" onclick="window.print()" title="In hồ sơ cây trồng">
          <i data-lucide="printer" class="lucide-xs"></i> <span>In hồ sơ</span>
        </button>
        <button type="button" class="erp-nav-btn" onclick="sharePage()" title="Chia sẻ liên kết">
          <i data-lucide="share-2" class="lucide-xs"></i> <span>Chia sẻ</span>
        </button>
        <button type="button" class="erp-nav-btn user-btn" onclick="logoutGate()" title="Đang đăng nhập: ${esc(user.full_name || user.email)} (Bấm để đăng xuất)">
          <i data-lucide="user-check" class="lucide-xs" style="color:#059669;"></i> <span class="user-name">${esc(user.full_name || user.email || 'Nông hộ')}</span> <i data-lucide="log-out" class="lucide-xs logout-icon"></i>
        </button>
      `;
    } else {
      actionSlot.innerHTML = `
        <button type="button" class="erp-nav-btn" onclick="window.print()" title="In hồ sơ cây trồng">
          <i data-lucide="printer" class="lucide-xs"></i> <span>In hồ sơ</span>
        </button>
        <button type="button" class="erp-nav-btn" onclick="sharePage()" title="Chia sẻ liên kết">
          <i data-lucide="share-2" class="lucide-xs"></i> <span>Chia sẻ</span>
        </button>
        <button type="button" class="erp-nav-btn login-btn" onclick="showAuthGateView()" title="Đăng nhập tài khoản nông hộ">
          <i data-lucide="lock" class="lucide-xs"></i> <span>Đăng nhập nông hộ</span>
        </button>
      `;
    }
  }

  // Construct UI using Enterprise 4-Section Layout Standards
  let html = `
    <!-- =========================================================================
         SECTION I: THÔNG TIN CHI TIẾT CỦA CÂY TRỒNG (Chi tiết & Hộ chiếu cây trồng)
         ========================================================================= -->
    <section class="profile-section-block" id="section-plant-core">
      <div class="section-block-header">
        <h2 class="section-block-title">
          <i data-lucide="sprout"></i>
          <span>I. Thông Tin Chi Tiết Cây Trồng &amp; Hộ Chiếu Số</span>
        </h2>
        <span class="section-block-badge">
          <i data-lucide="shield-check"></i> Hồ sơ gốc &amp; Hộ chiếu số
        </span>
      </div>

      <div class="core-profile-layout">
        <!-- Left: Plant Core Overview & 6-Tile KPI Telemetry -->
        <div class="glass-panel hero-card" style="margin-bottom:0;">
          <div class="cover-image-container">
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
                  <i data-lucide="smartphone-nfc" class="lucide-xs"></i> Nạp link thẻ NFC
                </span>
              ` : ''}

              <span class="badge badge-info" style="font-size:11px;">
                <i data-lucide="calendar" class="lucide-xs"></i> ${treeAgeFormatted}
              </span>
            </div>
            
            <!-- 6-Tile Balanced ERP Telemetry Grid -->
            <div class="erp-telemetry-grid">
              <!-- Tile 1: Giống & Độ Tuổi -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="sprout" class="lucide-xs" style="color:#059669;"></i> Giống &amp; Độ Tuổi</span>
                  <span style="font-size:9.5px; color:#059669; font-weight:700; background:#ecfdf5; padding:1px 5px; border-radius:4px;">Gốc</span>
                </div>
                <div class="erp-kpi-value">${esc(plant.plant_variety || plant.plant_type)}</div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="clock" class="lucide-xs"></i> ${plantDateFormatted} (${treeAgeFormatted})
                </div>
              </div>

              <!-- Tile 2: Định vị vệ tinh GIS -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="crosshair" class="lucide-xs" style="color:#0284c7;"></i> Tọa Độ Vệ Tinh RTK</span>
                  <span style="font-size:9.5px; color:#0284c7; font-weight:700; background:#f0f9ff; padding:1px 5px; border-radius:4px;">${hasRealCoords ? 'Đã khóa GPS' : 'Vùng'}</span>
                </div>
                <div class="erp-kpi-value" style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:#0f172a;">
                  ${hasRealCoords ? `${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : 'Vùng canh tác trang trại'}
                </div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="map-pin" class="lucide-xs"></i> ${hasRealCoords ? 'Độ chính xác: ±1.2m' : 'Vị trí theo ranh giới'}
                </div>
              </div>

              <!-- Tile 3: Tiêu chuẩn canh tác -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="award" class="lucide-xs" style="color:#d97706;"></i> Tiêu Chuẩn Canh Tác</span>
                  <span style="font-size:9.5px; color:#d97706; font-weight:700; background:#fffbeb; padding:1px 5px; border-radius:4px;">PUC</span>
                </div>
                <div class="erp-kpi-value" style="font-size:12.5px;">${esc(certStandard)}</div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="shield-check" class="lucide-xs"></i> Mã PUC: <strong>${esc(pucCode)}</strong>
                </div>
              </div>

              <!-- Tile 4: An toàn PHI & Thu hoạch -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="shield-alert" class="lucide-xs" style="color:#ea580c;"></i> An Toàn Cách Ly PHI</span>
                  <span style="font-size:9.5px; color:${phiStatus.isSafe ? '#059669' : '#b45309'}; font-weight:700; background:${phiStatus.isSafe ? '#ecfdf5' : '#fffbeb'}; padding:1px 5px; border-radius:4px;">${phiStatus.isSafe ? 'Đạt' : 'Cách ly'}</span>
                </div>
                <div class="erp-kpi-value" style="font-size:13px; color:${phiStatus.isSafe ? '#047857' : '#b45309'};">${phiStatus.text}</div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="info" class="lucide-xs"></i> ${phiStatus.subtext}
                </div>
              </div>

              <!-- Tile 5: Hạch toán đầu tư & vật tư -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="coins" class="lucide-xs" style="color:#059669;"></i> Tổng Đầu Tư Cây</span>
                  <span style="font-size:9.5px; color:#059669; font-weight:700; background:#ecfdf5; padding:1px 5px; border-radius:4px;">Ledger</span>
                </div>
                <div class="erp-kpi-value" style="color:#059669; font-family:var(--font-mono); font-size:13px;">${formatVnd(plant.total_cost || 0)}</div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="receipt" class="lucide-xs"></i> ${(plant.supply_usages || []).length} đợt dùng &nbsp;•&nbsp; ${(plant.farm_supplies || []).length} loại kho
                </div>
              </div>

              <!-- Tile 6: Mã Lô Nông Sản VietGAP -->
              <div class="erp-kpi-tile">
                <div class="erp-kpi-header">
                  <span class="erp-kpi-label"><i data-lucide="boxes" class="lucide-xs" style="color:#0284c7;"></i> Mã Lô VietGAP</span>
                  <span style="font-size:9.5px; color:#0284c7; font-weight:700; background:#f0f9ff; padding:1px 5px; border-radius:4px;">Batch</span>
                </div>
                <div class="erp-kpi-value" style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:#0369a1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${esc(batchCode)}
                </div>
                <div class="erp-kpi-subtext">
                  <i data-lucide="scan" class="lucide-xs"></i> Truy xuất nguồn gốc
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Right: Digital Plant Passport Card (Standard Enterprise Full-Width Spec Rows) -->
        <div class="erp-passport-card">
          <div class="erp-passport-inner">
            <!-- Passport Header -->
            <div class="passport-header-bar">
              <div class="passport-title-group">
                <div class="passport-emblem"><i data-lucide="shield-check" class="lucide-sm"></i></div>
                <div>
                  <div class="passport-main-title">HỘ CHIẾU CÂY TRỒNG SỐ</div>
                  <div class="passport-sub-title">DIGITAL PLANT PASSPORT · VIETGAP CERTIFIED</div>
                </div>
              </div>
              <div class="passport-status-pill">
                <span class="live-dot"></span> ĐÃ XÁC THỰC
              </div>
            </div>

            <!-- Official Certification Badges Strip (PUC & VietGAP Standard Badges) -->
            <div class="passport-certs-row">
              <div class="passport-cert-card puc" title="Mã Vùng Trồng (PUC) Cấp Bởi Cục Bảo Vệ Thực Vật">
                <div class="cert-card-icon"><i data-lucide="map-pinned" class="lucide-xs"></i></div>
                <div class="cert-card-body">
                  <div class="cert-card-label">MÃ VÙNG TRỒNG (PUC)</div>
                  <div class="cert-card-val">${esc(pucCode)}</div>
                </div>
              </div>

              <div class="passport-cert-card vietgap" title="Tiêu Chuẩn Canh Tác VietGAP Quốc Gia">
                <div class="cert-card-icon"><i data-lucide="award" class="lucide-xs"></i></div>
                <div class="cert-card-body">
                  <div class="cert-card-label">CHỨNG NHẬN VIETGAP</div>
                  <div class="cert-card-val">${esc(vietgapNumber)}</div>
                </div>
              </div>
            </div>

            <!-- Full-Width Clean Specification Table (No Cramping, No Truncation) -->
            <div class="passport-spec-table">
              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="qr-code" class="lucide-xs"></i> Trace ID</span>
                <span class="spec-value mono">
                  ${traceCode}
                  <button type="button" class="spec-copy-btn" onclick="copyPassportText('${traceCode}', this)" title="Sao chép">
                    <i data-lucide="copy" class="lucide-xs"></i>
                  </button>
                </span>
              </div>
              
              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="boxes" class="lucide-xs"></i> Mã Lô VietGAP</span>
                <span class="spec-value mono highlight-blue">${esc(batchCode)}</span>
              </div>

              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="sprout" class="lucide-xs"></i> Giống &amp; Cấp giống</span>
                <span class="spec-value">${esc(plant.plant_type)} (${esc(plant.plant_variety || 'Tiêu chuẩn')}) · <strong style="color:#047857;">${esc(seedOrigin)}</strong></span>
              </div>

              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="user-check" class="lucide-xs"></i> Nông hộ &amp; Liên hệ</span>
                <span class="spec-value">
                  ${esc(farmerOwnerName)} &nbsp;•&nbsp; <a href="tel:${esc(farmerOwnerPhone)}" class="spec-phone-link">${esc(farmerOwnerPhone)}</a>
                </span>
              </div>

              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="map-pin" class="lucide-xs"></i> Phân lô &amp; GIS RTK</span>
                <span class="spec-value">
                  ${esc(plotInfo)} &nbsp;•&nbsp; <span class="mono">${hasRealCoords ? `${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : 'Vùng trang trại'}</span>
                </span>
              </div>

              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="shield-alert" class="lucide-xs"></i> An toàn PHI</span>
                <span class="spec-value"><strong style="color:${phiStatus.isSafe ? '#059669' : '#d97706'}">${phiStatus.text}</strong> <span style="font-size:11px; font-weight:normal; color:#64748b;">(${phiStatus.subtext})</span></span>
              </div>

              <div class="passport-spec-row">
                <span class="spec-label"><i data-lucide="radio" class="lucide-xs"></i> Thẻ chip NFC</span>
                <span class="spec-value mono highlight-green"><i data-lucide="cpu" class="lucide-xs"></i> ${esc(plant.nfc_uid || 'NTAG213')}</span>
              </div>
            </div>

            <!-- Security Hash Micro-bar -->
            <div class="passport-security-hash">
              <i data-lucide="lock" class="lucide-xs" style="color:#059669;"></i>
              <span class="hash-title">Mã băm bảo chứng SHA-256:</span>
              <span class="hash-code mono">${securityHash}</span>
            </div>
          </div>

          <!-- Bottom Verification Seal Strip -->
          <div class="passport-bottom-actions">
            <div class="passport-seal-badge full">
              <i data-lucide="shield-check" class="lucide-xs" style="color:#059669;"></i>
              <span>Chuẩn Quốc Gia VietGAP &amp; Cấp Mã Vùng Trồng PUC Xuất Khẩu</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- =========================================================================
         SECTION II: THÔNG TIN MỞ RỘNG (GPS Map, Chi Phí Đầu Tư, Minh Chứng Thực Địa)
         ========================================================================= -->
    <section class="profile-section-block" id="section-plant-extended">
      <div class="section-block-header">
        <h2 class="section-block-title">
          <i data-lucide="layers"></i>
          <span>II. Thông Tin Mở Rộng</span>
        </h2>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="section-block-badge">
            <i data-lucide="database"></i> GPS · Chi phí ERP · Minh chứng thực địa
          </span>
          <button type="button" class="erp-section-toggle-btn" onclick="toggleExtendedSection()" id="btn-toggle-extended" title="Bấm để ẩn / hiện thông tin mở rộng">
            <i data-lucide="chevron-down" id="icon-toggle-extended" class="lucide-xs"></i>
            <span id="text-toggle-extended">Xem chi tiết</span>
          </button>
        </div>
      </div>

      <!-- Preview Summary Card (Shown when collapsed) -->
      <div class="glass-panel glass-card erp-collapse-preview-card" id="extended-preview-box">
        <div class="erp-collapse-summary-grid">
          <div class="erp-collapse-summary-tile" onclick="toggleExtendedSection(true)">
            <div class="tile-icon map"><i data-lucide="map-pin" class="lucide-sm"></i></div>
            <div class="tile-info">
              <div class="tile-label">Vị Trí Bản Đồ GIS</div>
              <div class="tile-val">${hasRealCoords ? `Tọa độ RTK: ${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : (plant.farm_name || 'Đã định vị vùng trang trại')}</div>
            </div>
          </div>
          <div class="erp-collapse-summary-tile" onclick="toggleExtendedSection(true)">
            <div class="tile-icon cost"><i data-lucide="receipt" class="lucide-sm"></i></div>
            <div class="tile-info">
              <div class="tile-label">Hạch Toán Đầu Tư Cây</div>
              <div class="tile-val" style="color:#059669; font-weight:800; font-family:var(--font-mono);">${formatVnd(plant.total_cost || 0)} <span style="font-size:11px; font-weight:500; color:#64748b;">(${(plant.supply_usages || []).length} lần ghi nhận)</span></div>
            </div>
          </div>
          <div class="erp-collapse-summary-tile" onclick="toggleExtendedSection(true)">
            <div class="tile-icon media"><i data-lucide="camera" class="lucide-sm"></i></div>
            <div class="tile-info">
              <div class="tile-label">Minh Chứng Thực Địa</div>
              <div class="tile-val">${allMediaList.length} hình ảnh &amp; video giám sát</div>
            </div>
          </div>
        </div>
        <div style="text-align:center; margin-top:16px;">
          <button type="button" class="erp-expand-main-btn" onclick="toggleExtendedSection(true)">
            <i data-lucide="layers" class="lucide-sm"></i>
            <span>Bấm để xem chi tiết thông tin mở rộng (Bản đồ vệ tinh, Chi phí vật tư &amp; Thư viện thực địa)</span>
            <i data-lucide="chevron-down" class="lucide-xs"></i>
          </button>
        </div>
      </div>

      <!-- Detail Collapsible Container (Shown when expanded) -->
      <div id="extended-detail-content" class="erp-detail-collapsible" style="display:none;">
        <div class="extended-info-grid">
          <!-- 1. Vị trí GPS của cây trên bản đồ -->
          ${hasMap ? `
          <div class="glass-panel glass-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
              <h2 class="sec-title" style="margin: 0; font-size: 16px;">
                <i data-lucide="map" class="lucide-sm" style="color: var(--green-bright)"></i>
                <span>Vị Trí GPS Của Cây Trên Bản Đồ &amp; Ranh Giới Lô Canh Tác</span>
              </h2>
              <div style="display: flex; align-items: center; gap: 4px; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <button type="button" id="btn-plant-sat-google" class="btn btn-xs active" onclick="switchPlantSatelliteSource('google')" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; border: none; background: #059669; color: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
                  <i data-lucide="globe" class="lucide-xs"></i> Google Satellite
                </button>
                <button type="button" id="btn-plant-sat-mapbox" class="btn btn-xs" onclick="switchPlantSatelliteSource('mapbox')" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; border: none; background: transparent; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
                  <i data-lucide="layers" class="lucide-xs"></i> Mapbox
                </button>
              </div>
            </div>
            <div class="plant-map-container" style="position:relative; width:100%; height:340px; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1;">
              <div id="plant-location-map" style="width:100%;height:100%;"></div>
              ${plant.farm_name ? `<div class="map-farm-badge" style="position:absolute; bottom:12px; left:12px; z-index:5; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px; font-size:11.5px; color:#fff; border:1px solid rgba(255,255,255,0.15);"><i data-lucide="sprout" class="lucide-xs" style="color:#34d399"></i> Trang trại: ${esc(plant.farm_name)}</div>` : ''}
              ${(!plant.latitude || !plant.longitude) ? `<div class="map-no-gps-badge" style="position:absolute; top:12px; left:12px; z-index:5; background:rgba(15,23,42,0.88); backdrop-filter:blur(8px); padding:6px 12px; border-radius:8px; font-size:11.5px; color:#fde047; border:1px solid rgba(253,224,71,0.3);"><i data-lucide="info" class="lucide-xs"></i> Vị trí trang trại · Cây chưa có định vị GPS</div>` : ''}
            </div>
          </div>
          ` : ''}

          <!-- 2. Chi phí đầu tư (Vật Tư & Hạch Toán Chi Phí Canh Tác) -->
          <div class="glass-panel glass-card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
              <h2 class="sec-title" style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                <i data-lucide="receipt" class="lucide-sm" style="color: var(--green-bright)"></i>
                <span>Chi Phí Đầu Tư (Vật Tư &amp; Hạch Toán Chi Phí Canh Tác)</span>
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
                      ${plant.supply_usages.map(u => {
                        const dateStr = fmtDate(u.usage_date || u.used_date || u.log_date || u.created_at);
                        const isWater = (u.supply_category === 'Tiền nước') || (u.supply_name && u.supply_name.toLowerCase().includes('nước'));
                        const opName = u.operator_name || (plant.farm_name ? `Kỹ thuật viên (${plant.farm_name})` : 'Chủ trang trại');
                        const equip = u.equipment_used || (isWater ? 'Hệ thống tưới tự động bù áp' : '');
                        return `
                        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                          <td style="padding: 9px 12px; white-space: nowrap; font-weight: 600; color: #334155;">${dateStr}</td>
                          <td style="padding: 9px 12px; white-space: nowrap;">
                            <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 10.5px; font-weight: 700;">${esc(u.log_type || u.supply_category || (isWater ? 'Tưới nước' : 'Chăm sóc'))}</span>
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
                            <span style="font-weight: 700; color: #1e293b;">${esc(opName)}</span>
                            ${equip ? `<div style="color: #64748b; font-size: 10.5px; margin-top: 2px; display: flex; align-items: center; gap: 4px;"><i data-lucide="wrench" class="lucide-xs" style="vertical-align:-1px;"></i> <span>${esc(equip)}</span></div>` : ''}
                          </td>
                        </tr>
                        `;
                      }).join('')}
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

          <!-- 3. Minh chứng hình ảnh thực địa (Ảnh sinh trưởng, Ảnh bệnh cây, Video thực địa) -->
          <div class="glass-panel glass-card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
              <h2 class="sec-title" style="margin: 0; font-size: 16px;">
                <i data-lucide="camera" class="lucide-sm" style="color: var(--green-bright)"></i>
                <span>Minh Chứng Hình Ảnh Thực Địa (Ảnh Sinh Trưởng, Bệnh Cây &amp; Video)</span>
              </h2>
              <span class="badge badge-info" style="font-size: 11.5px;">
                <i data-lucide="images" class="lucide-xs"></i> Tổng ${allMediaList.length} tư liệu thực địa
              </span>
            </div>

            <!-- Category Filter Tabs -->
            <div class="extended-media-filter-tabs">
              <button class="media-filter-tab active" onclick="filterPublicMedia('all', this)">
                <i data-lucide="layout-grid" class="lucide-xs"></i> Tất cả (${allMediaList.length})
              </button>
              <button class="media-filter-tab" onclick="filterPublicMedia('growth', this)">
                <i data-lucide="sprout" class="lucide-xs"></i> Ảnh sinh trưởng (${growthPhotos.length})
              </button>
              <button class="media-filter-tab" onclick="filterPublicMedia('disease', this)">
                <i data-lucide="shield-alert" class="lucide-xs"></i> Ảnh bệnh cây (${diseasePhotos.length})
              </button>
              <button class="media-filter-tab" onclick="filterPublicMedia('video', this)">
                <i data-lucide="video" class="lucide-xs"></i> Video thực địa (${fieldVideos.length})
              </button>
            </div>

            <!-- Media Cards Grid -->
            <div class="media-card-grid" id="public-media-cards-container">
              ${window.renderMediaItemsHtml ? window.renderMediaItemsHtml(allMediaList) : ''}
            </div>
          </div>
        </div>

        <div style="text-align:center; margin-top:18px;">
          <button type="button" class="erp-collapse-bottom-btn" onclick="toggleExtendedSection(false)">
            <i data-lucide="chevron-up" class="lucide-xs"></i> Thu gọn thông tin mở rộng
          </button>
        </div>
      </div>
    </section>

    <!-- =========================================================================
         SECTION III: NHẬT KÝ CANH TÁC (Traceability Timeline Chuẩn VietGAP)
         ========================================================================= -->
    <section class="profile-section-block" id="section-plant-timeline">
      <div class="section-block-header">
        <h2 class="section-block-title">
          <i data-lucide="history"></i>
          <span>III. Nhật Ký Canh Tác</span>
        </h2>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="section-block-badge">
            <i data-lucide="clock"></i> Chuẩn VietGAP · Tổng ${window._publicLogDates.length} ngày canh tác
          </span>
          <button type="button" class="erp-section-toggle-btn" onclick="toggleTimelineSection()" id="btn-toggle-timeline" title="Bấm để ẩn / hiện nhật ký canh tác">
            <i data-lucide="chevron-down" id="icon-toggle-timeline" class="lucide-xs"></i>
            <span id="text-toggle-timeline">Xem chi tiết</span>
          </button>
        </div>
      </div>

      <!-- Preview Summary Card (Shown when collapsed) -->
      <div class="glass-panel glass-card erp-collapse-preview-card" id="timeline-preview-box">
        <div class="erp-collapse-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
          <div class="erp-collapse-summary-tile" onclick="toggleTimelineSection(true)">
            <div class="tile-icon history"><i data-lucide="calendar-check" class="lucide-sm"></i></div>
            <div class="tile-info">
              <div class="tile-label">Tổng Nhật Ký Canh Tác</div>
              <div class="tile-val">${logs.length} sự kiện (${window._publicLogDates.length} ngày canh tác VietGAP)</div>
            </div>
          </div>
          <div class="erp-collapse-summary-tile" onclick="toggleTimelineSection(true)">
            <div class="tile-icon clock"><i data-lucide="clock" class="lucide-sm"></i></div>
            <div class="tile-info">
              <div class="tile-label">Hoạt Động Gần Nhất</div>
              <div class="tile-val">${logs.length > 0 ? `${fmtDate(logs[0].log_date || logs[0].created_at)} — ${esc(logs[0].log_type || 'Chăm sóc')}` : 'Chưa có ghi chép'}</div>
            </div>
          </div>
        </div>
        <div style="text-align:center; margin-top:16px;">
          <button type="button" class="erp-expand-main-btn" onclick="toggleTimelineSection(true)">
            <i data-lucide="history" class="lucide-sm"></i>
            <span>Bấm để xem chi tiết nhật ký canh tác (Dòng thời gian VietGAP đầy đủ)</span>
            <i data-lucide="chevron-down" class="lucide-xs"></i>
          </button>
        </div>
      </div>

      <!-- Detail Collapsible Container (Shown when expanded) -->
      <div id="timeline-detail-content" class="erp-detail-collapsible" style="display:none;">
        <div class="glass-panel glass-card">
          <div id="public-timeline-container">
            <!-- Rendered dynamically -->
          </div>

          <div id="public-timeline-pagination">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <div style="text-align:center; margin-top:18px;">
          <button type="button" class="erp-collapse-bottom-btn" onclick="toggleTimelineSection(false)">
            <i data-lucide="chevron-up" class="lucide-xs"></i> Thu gọn nhật ký canh tác
          </button>
        </div>
      </div>
    </section>

    <!-- =========================================================================
         SECTION IV: THAO TÁC CANH TÁC NHANH
         ========================================================================= -->
    <section class="profile-section-block" id="section-plant-quick-actions">
      <div class="section-block-header">
        <h2 class="section-block-title">
          <i data-lucide="zap"></i>
          <span>IV. Thao Tác Canh Tác Nhanh</span>
        </h2>
        <span class="section-block-badge">
          ${isEditable 
            ? '<i data-lucide="edit-3"></i> Quyền ghi nhận thực địa' 
            : '<i data-lucide="shield-check"></i> Cổng minh bạch công khai'}
        </span>
      </div>

      ${isEditable ? `
      <div class="glass-panel glass-card">
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.4;">
          Chọn quy trình chăm sóc bên dưới để hạch toán vật tư và ghi nhật ký tức thời vào hồ sơ cây:
        </p>
        <div class="care-actions-grid">
          <button class="care-btn care-btn-water" onclick="openModal('modal-water')">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-water', 32) : '<i data-lucide="droplet" class="lucide-sm" style="color: var(--color-water)"></i>'}
            <span>Tưới nước</span>
          </button>
          <button class="care-btn care-btn-fertilize" onclick="openModal('modal-fertilize')">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-fertilize', 32) : '<i data-lucide="leaf" class="lucide-sm" style="color: var(--color-fertilize)"></i>'}
            <span>Bón phân</span>
          </button>
          <button class="care-btn care-btn-pesticide" onclick="openModal('modal-pesticide')">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-pesticide', 32) : '<i data-lucide="flask-conical" class="lucide-sm" style="color: var(--color-pesticide)"></i>'}
            <span>Phun thuốc</span>
          </button>
          <button class="care-btn care-btn-labor" onclick="openModal('modal-labor')" style="border-color:#bae6fd; background:#f0f9ff;">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-labor', 32) : '<i data-lucide="users" class="lucide-sm" style="color: #0284c7"></i>'}
            <span style="color: #0369a1; font-weight: 700;">Thuê nhân công</span>
          </button>
          <button class="care-btn care-btn-disease" onclick="openModal('modal-disease')">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-disease', 32) : '<i data-lucide="shield-alert" class="lucide-sm" style="color: var(--color-disease)"></i>'}
            <span>Bệnh cây</span>
          </button>
          <button class="care-btn care-btn-harvest" onclick="openModal('modal-harvest')">
            ${window.ChibiIcons ? window.ChibiIcons.get('chibi-harvest', 32) : '<i data-lucide="wheat" class="lucide-sm" style="color: #d97706"></i>'}
            <span style="color: #92400e; font-weight: 700;">Thu hoạch</span>
          </button>
        </div>
      </div>
      ` : `
      <div class="glass-panel glass-card">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 12.5px; color: #475569; line-height: 1.5; margin-bottom: 14px;">
          <i data-lucide="info" class="lucide-sm" style="color: #059669; margin-right: 4px;"></i>
          Bạn đang truy cập ở <strong>Chế độ Xem Minh Bạch (Public Traceability)</strong>. Toàn bộ thông tin vùng trồng, vật tư tiêu hao, cách ly PHI và nhật ký thực địa được bảo chứng toàn vẹn.
        </div>
        <button onclick="showAuthGateView()" style="width: 100%; background: #ffffff; border: 1.5px dashed #059669; color: #059669; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" onmouseover="this.style.background='#f0fdf4';" onmouseout="this.style.background='#ffffff';">
          <i data-lucide="lock" class="lucide-sm"></i> Đăng nhập nông hộ để ghi nhận canh tác
        </button>
      </div>
      `}
    </section>
    
    <!-- =========================================================================
         ENTERPRISE ERP FOOTER & 2 NAVIGATION BLOCKS
         ========================================================================= -->
    <footer class="erp-main-footer">
      <div class="erp-footer-container">
        <!-- 2 Main Quick Navigation Cards -->
        <div class="footer-nav-grid">
          <!-- Card 1: VỀ ỨNG DỤNG CHÍNH -->
          <a href="/" class="footer-nav-card app-card" title="Về Trang chủ Quản trị & Sổ Nông Tân Bảo AgTech">
            <div class="nav-card-icon-box green">
              <i data-lucide="layout-dashboard" class="lucide-md"></i>
            </div>
            <div class="nav-card-content">
              <div class="nav-card-badge green">
                <span class="badge-dot green"></span>
                <span>HỆ THỐNG QUẢN TRỊ</span>
              </div>
              <div class="nav-card-title">VỀ ỨNG DỤNG CHÍNH</div>
              <div class="nav-card-desc">Truy cập hệ thống quản trị và sổ nông số hóa</div>
              <div class="nav-card-link-text">
                <span>Truy cập hệ thống</span> <i data-lucide="arrow-right" class="lucide-xs"></i>
              </div>
            </div>
          </a>

          <!-- Card 2: WEBSITE DOANH NGHIỆP -->
          <a href="https://tanbaocorp-agritech.vn" target="_blank" rel="noopener noreferrer" class="footer-nav-card web-card" title="Truy cập Website Doanh nghiệp Tân Bảo">
            <div class="nav-card-icon-box blue">
              <i data-lucide="globe" class="lucide-md"></i>
            </div>
            <div class="nav-card-content">
              <div class="nav-card-badge blue">
                <span class="badge-dot blue"></span>
                <span>CỔNG THÔNG TIN DOANH NGHIỆP</span>
              </div>
              <div class="nav-card-title">WEBSITE DOANH NGHIỆP</div>
              <div class="nav-card-desc">Truy cập cổng thông tin doanh nghiệp TBSG Agtech</div>
              <div class="nav-card-link-text">
                <span>Xem website công ty</span> <i data-lucide="external-link" class="lucide-xs"></i>
              </div>
            </div>
          </a>
        </div>

        <!-- Corporate Metadata & Trust Verification Bar (Centered for Laptop & Mobile) -->
        <div class="footer-bottom-bar">
          <div class="footer-brand-centered">
            <div class="footer-logo-box">
              <img src="/assets/logo.png" alt="TANBAO AgTech" class="footer-logo-img">
            </div>
            <div class="footer-company-info">
              <div class="footer-company-name">CÔNG TY TNHH CÔNG NGHỆ NÔNG NGHIỆP TÂN BẢO SÀI GÒN – TBSG AGTECH</div>
              <div class="footer-company-sub">SỔ NÔNG NHÀN – TBSG AGTECH</div>
            </div>
          </div>

          <div class="footer-trust-badges">
            <div class="footer-trust-item">
              <i data-lucide="shield-check" class="lucide-sm" style="color:#059669;"></i>
              <span>Bảo chứng VietGAP TCVN 11892-1:2017</span>
            </div>
            <div class="footer-trust-item">
              <i data-lucide="cpu" class="lucide-sm" style="color:#0284c7;"></i>
              <span>Thẻ định danh Cây trồng</span>
            </div>
            <div class="footer-trust-item">
              <i data-lucide="clock" class="lucide-sm" style="color:#64748b;"></i>
              <span>Cập nhật: ${fmtDateTime(plant.updated_at || plant.created_at)}</span>
            </div>
          </div>

          <div class="footer-copyright">
            &copy; ${new Date().getFullYear()} Tân Bảo AgTech. Bản quyền hệ thống số hóa nông nghiệp được bảo lưu toàn diện.
          </div>
        </div>
      </div>
    </footer>
  `;

  document.getElementById('loader').style.display = 'none';
  const view = document.getElementById('plant-view');
  view.innerHTML = html;
  view.style.display = 'block';
  if (window.lucide) window.lucide.createIcons();

  // Render initial media cards
  const mediaCardsContainer = document.getElementById('public-media-cards-container');
  if (mediaCardsContainer && window.renderMediaItemsHtml) {
    mediaCardsContainer.innerHTML = window.renderMediaItemsHtml(allMediaList);
  }

  // Populate farm supplies into care modals
  populateCareSuppliesDropdowns(plant.farm_supplies || []);

  // Render initial care timeline
  renderPublicLogTimeline(1, false);

  // Satellite Layer Switcher for Public Plant Map
  window._currentPlantSatSource = 'google';
  window.switchPlantSatelliteSource = function(source) {
    window._currentPlantSatSource = source;
    const map = window._publicPlantMap;
    const btnGoogle = document.getElementById('btn-plant-sat-google');
    const btnMapbox = document.getElementById('btn-plant-sat-mapbox');

    if (btnGoogle) {
      btnGoogle.style.background = source === 'google' ? '#059669' : 'transparent';
      btnGoogle.style.color = source === 'google' ? '#ffffff' : '#475569';
    }
    if (btnMapbox) {
      btnMapbox.style.background = source === 'mapbox' ? '#059669' : 'transparent';
      btnMapbox.style.color = source === 'mapbox' ? '#ffffff' : '#475569';
    }

    if (!map) return;
    try {
      const googleLayer = map.getLayer('google-satellite-layer');
      if (googleLayer) {
        map.setLayoutProperty('google-satellite-layer', 'visibility', source === 'google' ? 'visible' : 'none');
      }
    } catch (err) {
      console.warn('Lỗi chuyển nguồn ảnh vệ tinh:', err);
    }
  };

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

      // Map on load: Setup satellite raster layers & farm boundaries
      plantMap.on('load', () => {
        try {
          if (!plantMap.getSource('google-satellite-src')) {
            plantMap.addSource('google-satellite-src', {
              type: 'raster',
              tiles: [
                'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
              ],
              tileSize: 256,
              maxzoom: 20,
              attribution: '&copy; Google Satellite'
            });
          }

          if (!plantMap.getLayer('google-satellite-layer')) {
            plantMap.addLayer({
              id: 'google-satellite-layer',
              type: 'raster',
              source: 'google-satellite-src',
              layout: { visibility: (window._currentPlantSatSource || 'google') === 'google' ? 'visible' : 'none' },
              paint: { 'raster-opacity': 1 }
            });
          }
        } catch (layerErr) {
          console.warn('Google satellite source init warning:', layerErr);
        }

        // Draw farm polygon if available
        if (plant.farm_boundary && plant.farm_boundary.coordinates) {
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
        }

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

// [Modularized] Care log submission & drafts moved to plant-care-modals.js
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

// [Modularized] Export, certificates & contour map export moved to plant-export-certs.js
// Startup
async function init() {
  await loadConfigurations();
  await loadPlant();
  await restoreDiseaseDraft(); // Restore on initial load in case page reloaded while capturing
}

init();
