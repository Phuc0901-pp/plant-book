/* Plant Book Agtech (c) 2026 TBSG Agtech. All Rights Reserved. Enterprise Protected Asset */
/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   core/utils.js — Shared UI utilities
   ═══════════════════════════════════════════════════════════════ */

/**
 * Hiển thị thông báo toast tạm thời.
 * @param {string} msg   — nội dung thông báo
 * @param {'success'|'error'|'info'} type
 */
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/**
 * Escape ký tự HTML đặc biệt để tránh XSS.
 * @param {*} str
 * @returns {string}
 */
export function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Trả về HTML badge màu theo trạng thái sức khoẻ cây.
 * @param {string} status
 * @returns {string} HTML string
 */
export function healthBadge(status) {
  if (status === 'Tốt') {
    return '<span class="badge badge-green" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg> Tốt</span>';
  }
  if (status === 'Bình thường') {
    return '<span class="badge badge-gray" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg> Bình thường</span>';
  }
  if (status === 'Cần chú ý') {
    return '<span class="badge badge-amber" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg> Cần chú ý</span>';
  }
  if (status === 'Bệnh') {
    return '<span class="badge badge-red" style="display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg> Bệnh</span>';
  }
  return `<span class="badge badge-gray">${esc(status)}</span>`;
}

/**
 * Format ngày theo định dạng Việt Nam (DD/MM/YYYY).
 * @param {string} dateStr — ISO date string
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

/**
 * Lấy chuỗi ngày hôm nay dạng YYYY-MM-DD (local time).
 * @returns {string}
 */
export function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Format diện tích thông minh (ha nếu >= 10.000 m2, m2 nếu < 10.000 m2)
 * @param {number|string} areaVal
 * @returns {string}
 */
export function formatSmartArea(areaVal) {
  if (!areaVal && areaVal !== 0) return '0 m²';
  const num = parseFloat(areaVal);
  if (isNaN(num) || num <= 0) return '0 m²';
  if (num >= 10000) {
    const ha = (num / 10000).toFixed(2).replace(/\.00$/, '');
    return `${ha} ha <span style="font-size:11px; font-weight:500; color:#64748b;">(${Math.round(num).toLocaleString('vi-VN')} m²)</span>`;
  }
  return `${Math.round(num).toLocaleString('vi-VN')} m²`;
}

/**
 * Robust Multi-dimensional GeoJSON Polygon coordinates parser and sanitizer
 * @param {*} rawCoords
 * @returns {Array<[number, number]>} Array of [lng, lat]
 */
export function sanitizeCoordinates(rawCoords) {
  let coords = [];
  try {
    coords = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : (rawCoords || []);
  } catch(e) { return []; }

  while (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    coords = coords[0];
  }

  if (!Array.isArray(coords)) return [];

  const validPts = [];
  coords.forEach(pt => {
    if (Array.isArray(pt) && pt.length >= 2) {
      let v1 = parseFloat(pt[0]);
      let v2 = parseFloat(pt[1]);
      if (!isNaN(v1) && !isNaN(v2)) {
        let lng = v1 > 50 ? v1 : v2;
        let lat = v2 < 50 ? v2 : v1;
        if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          validPts.push([lng, lat]);
        }
      }
    }
  });
  return validPts;
}

// ── Crop Asset Mappings ─────────────────────────────────────
export const CROP_NAME_TO_ENGLISH = {
  'sau_rieng': 'durian', 'sau rieng': 'durian', 'saurieng': 'durian', 'durian': 'durian',
  'ri6': 'durian', 'ri 6': 'durian', 'dona': 'durian', 'musang_king': 'durian', 'musang king': 'durian', 'chuong_bo': 'durian', 'black_thorn': 'durian', 'sau': 'durian',
  'ca_phe': 'coffee', 'ca phe': 'coffee', 'caphe': 'coffee', 'coffee': 'coffee',
  'robusta': 'coffee', 'arabica': 'coffee', 'moka': 'coffee', 'culi': 'coffee',
  'ca_cao': 'cacao', 'ca cao': 'cacao', 'cacao': 'cacao', 'cocoa': 'cacao',
  'cao_su': 'rubber', 'cao su': 'rubber', 'caosu': 'rubber', 'rubber': 'rubber',
  'buoi': 'pomelo', 'bưởi': 'pomelo', 'pomelo': 'pomelo', 'da_xanh': 'pomelo', 'da xanh': 'pomelo', 'nam_roi': 'pomelo', 'dien': 'pomelo',
  'cam': 'orange', 'orange': 'orange', 'sanh': 'orange', 'cam_sanh': 'orange', 'cam sanh': 'orange', 'vinh': 'orange', 'xoan': 'orange',
  'mit': 'jackfruit', 'mít': 'jackfruit', 'jackfruit': 'jackfruit', 'thai': 'jackfruit', 'mit_thai': 'jackfruit', 'ruot_do': 'jackfruit',
  'bo': 'avocado', 'bơ': 'avocado', 'avocado': 'avocado', '034': 'avocado', 'bo_034': 'avocado', 'hass': 'avocado', 'bo_hass': 'avocado',
  'tieu': 'pepper', 'ho_tieu': 'pepper', 'hồ tiêu': 'pepper', 'tiêu': 'pepper', 'pepper': 'pepper',
  'chom_chom': 'rambutan', 'chôm chôm': 'rambutan', 'rambutan': 'rambutan',
  'mang_cut': 'mangosteen', 'măng cụt': 'mangosteen', 'mangosteen': 'mangosteen',
  'xoai': 'mango', 'xoài': 'mango', 'mango': 'mango', 'cat_hoa_loc': 'mango', 'cat_chu': 'mango', 'keo': 'mango',
  'chuoi': 'banana', 'chuối': 'banana', 'banana': 'banana', 'gia_nam_my': 'banana', 'su': 'banana', 'cau': 'banana',
  'thanh_long': 'dragon_fruit', 'thanh long': 'dragon_fruit', 'dragon_fruit': 'dragon_fruit', 'dragon fruit': 'dragon_fruit',
  'dua': 'coconut', 'dừa': 'coconut', 'coconut': 'coconut', 'xiem': 'coconut', 'dua_xiem': 'coconut', 'sap': 'coconut',
  'chanh': 'lemon', 'lemon': 'lemon', 'lime': 'lemon', 'khong_hat': 'lemon',
  'nhan': 'longan', 'nhãn': 'longan', 'longan': 'longan', 'xuong_com_vang': 'longan', 'ido': 'longan',
  'vai': 'lychee', 'vải': 'lychee', 'lychee': 'lychee', 'thieu': 'lychee',
  'oi': 'guava', 'ổi': 'guava', 'guava': 'guava', 'nu_hoang': 'guava',
  'chanh_day': 'passion_fruit', 'chanh day': 'passion_fruit', 'passion_fruit': 'passion_fruit',
  'tra': 'tea', 'trà': 'tea', 'che': 'tea', 'chè': 'tea',
  'dieu': 'cashew', 'điều': 'cashew', 'cashew': 'cashew',
  'dau_tay': 'strawberry', 'strawberry': 'strawberry',
  'mac_ca': 'macadamia', 'macadamia': 'macadamia',
  'thom': 'pineapple', 'khom': 'pineapple', 'pineapple': 'pineapple'
};

export const LOCAL_CROP_ICONS = new Set(['durian', 'coffee', 'cacao', 'rubber']);

export const CROP_DEFAULT_PHOTOS = {
  durian: '/assets/crop/durian.png',
  coffee: '/assets/crop/coffee.png',
  cacao: '/assets/crop/cacao.png',
  rubber: '/assets/crop/rubber.png',
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
  pineapple: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=1200&auto=format&fit=crop&q=80',
  coconut: 'https://images.unsplash.com/photo-1589984662646-e7b2e4962f18?w=1200&auto=format&fit=crop&q=80',
  lychee: 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=1200&auto=format&fit=crop&q=80',
  longan: 'https://images.unsplash.com/photo-1629813366051-b58137b2792c?w=1200&auto=format&fit=crop&q=80',
  rambutan: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&auto=format&fit=crop&q=80',
  mangosteen: 'https://images.unsplash.com/photo-1596707323867-b50a24128f7d?w=1200&auto=format&fit=crop&q=80',
  apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=1200&auto=format&fit=crop&q=80'
};

export function resolveCropEnglishName(term, variety = '') {
  const combined = `${term || ''} ${variety || ''}`.trim();
  if (!combined) return 'durian';
  const raw = combined.toLowerCase();
  
  const clean = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. Direct match
  if (CROP_NAME_TO_ENGLISH[clean]) return CROP_NAME_TO_ENGLISH[clean];
  const under = clean.replace(/\s+/g, '_');
  if (CROP_NAME_TO_ENGLISH[under]) return CROP_NAME_TO_ENGLISH[under];

  // 2. Substring search
  for (const [k, v] of Object.entries(CROP_NAME_TO_ENGLISH)) {
    if (clean.includes(k) || under.includes(k)) return v;
  }
  return 'durian';
}

export function isGrowthMedia(m) {
  if (!m) return false;
  if (m.media_type === 'video') return false;
  const caption = (m.caption || m.growth_stage || '').toLowerCase();
  const objName = (m.object_name || m.url || '').toLowerCase();
  const cat = (m.category || '').toLowerCase();

  if (cat === 'disease' || cat === 'pest' || cat === 'treatment' || cat === 'log') return false;
  if (objName.includes('/disease/') || objName.includes('/benh/') || objName.includes('/pest/') || objName.includes('/logs/')) return false;
  if (caption.startsWith('bệnh cây') || caption.startsWith('benh cay') || caption.includes('sâu bệnh') || caption.includes('bệnh hại') || caption.includes('chẩn đoán') || caption.includes('dịch bệnh')) {
    return false;
  }
  return true;
}

export function isDiseaseMedia(m) {
  if (!m) return false;
  return !isGrowthMedia(m);
}

export function getCropImageSrc(plantOrType, plantVariety = '') {
  if (typeof plantOrType === 'object' && plantOrType !== null) {
    const cover = plantOrType.cover_image || '';
    const isDiseaseCover = cover.includes('/disease/') || cover.includes('/benh/') || cover.includes('photo-1587293852726-70cdb56c2866');
    if (cover && !isDiseaseCover) {
      return esc(cover);
    }
    const type = plantOrType.plant_type || '';
    const variety = plantOrType.plant_variety || '';
    const eng = resolveCropEnglishName(type, variety);
    if (LOCAL_CROP_ICONS.has(eng)) {
      return `/assets/crop/${eng}.png`;
    }
    if (CROP_DEFAULT_PHOTOS[eng]) {
      return CROP_DEFAULT_PHOTOS[eng];
    }
    return `/assets/crop/${eng}.png`;
  }
  
  const eng = resolveCropEnglishName(plantOrType, plantVariety);
  if (LOCAL_CROP_ICONS.has(eng)) {
    return `/assets/crop/${eng}.png`;
  }
  if (CROP_DEFAULT_PHOTOS[eng]) {
    return CROP_DEFAULT_PHOTOS[eng];
  }
  return `/assets/crop/${eng}.png`;
}

if (typeof window !== 'undefined') {
  window.esc = esc;
  window.toast = toast;
  window.healthBadge = healthBadge;
  window.formatDate = formatDate;
  window.todayString = todayString;
  window.sanitizeCoordinates = sanitizeCoordinates;
  window.formatSmartArea = formatSmartArea;
  window.resolveCropEnglishName = resolveCropEnglishName;
  window.getCropImageSrc = getCropImageSrc;
  window.isGrowthMedia = isGrowthMedia;
  window.isDiseaseMedia = isDiseaseMedia;
}
