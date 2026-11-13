/* Modular Farmer Portal ERP Plant Profile Modal & Growth Photo Gallery */
import { esc, healthBadge, toast, getCropImageSrc, isGrowthMedia, isDiseaseMedia, formatDate } from '../core/utils.js';
import { api } from '../core/api.js';
import { getPlantsCache, getFarmsCache } from './plants.js';

let _currentErpPlant = null;

export async function openPlantProfileModal(plantId) {
  const modal = document.getElementById('internal-plant-profile-modal');
  if (!modal) return;

  // 1. Retrieve plant data from memory cache first for instant zero-lag rendering
  let plant = (getPlantsCache() || []).find(p => String(p.id) === String(plantId));
  if (!plant && window._allPlantsCache) {
    plant = window._allPlantsCache.find(p => String(p.id) === String(plantId));
  }

  // 2. Fetch full plant details from API if needed
  try {
    const res = await api(`/plants/${plantId}`);
    if (res && res.id) {
      plant = { ...plant, ...res };
    }
  } catch (err) {
    console.warn('[ERP Profile] Fetching plant details fallback to cache:', err);
  }

  if (!plant) {
    if (typeof toast === 'function') toast('Không tìm thấy dữ liệu cây trồng!', 'warning');
    else if (window.toast) window.toast('Không tìm thấy dữ liệu cây trồng!', 'warning');
    return;
  }

  _currentErpPlant = plant;

  // 3. Reset active tab to Tab 1 (Overview)
  switchErpProfileTab('overview');

  // 4. Fill Header & Badges
  const titleEl = document.getElementById('erp-plant-modal-title');
  if (titleEl) titleEl.textContent = `Hồ Sơ Cây Trồng #${plant.tree_code || plant.id}`;

  const healthBadgeEl = document.getElementById('erp-plant-health-badge');
  if (healthBadgeEl) {
    const st = String(plant.health_status || '').toLowerCase();
    if (st.includes('tốt') || st.includes('khỏe') || st.includes('khoe') || st === 'good') {
      healthBadgeEl.style.background = '#22c55e';
      healthBadgeEl.innerHTML = '<i data-lucide="check-circle-2" class="lucide-xs"></i> Khỏe mạnh';
    } else if (st.includes('chú ý') || st.includes('chu y') || st.includes('warning')) {
      healthBadgeEl.style.background = '#f59e0b';
      healthBadgeEl.innerHTML = '<i data-lucide="alert-triangle" class="lucide-xs"></i> Cần chăm sóc';
    } else if (st.includes('bệnh') || st.includes('benh') || st.includes('sick')) {
      healthBadgeEl.style.background = '#ef4444';
      healthBadgeEl.innerHTML = '<i data-lucide="shield-alert" class="lucide-xs"></i> Nhiễm bệnh';
    } else {
      healthBadgeEl.style.background = '#3b82f6';
      healthBadgeEl.innerHTML = `<i data-lucide="activity" class="lucide-xs"></i> ${esc(plant.health_status || 'Bình thường')}`;
    }
  }

  const farmName = plant.farm_name || (getFarmsCache().find(f => f.id == plant.farm_id)?.name) || 'Trang trại';
  const plotStr = plant.plot_code || plant.location || 'Chưa phân lô';
  const varietyStr = plant.plant_variety ? `${plant.plant_type || 'Cây'} (${plant.plant_variety})` : (plant.plant_type || 'Cây trồng');
  const subtitleEl = document.getElementById('erp-plant-modal-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `Trang trại: ${farmName} · Lô: ${plotStr} · Giống: ${varietyStr}`;
  }

  // Separate Growth Stage Media from Disease / Diagnosis Media
  const allMedia = Array.isArray(plant.media) ? plant.media : [];
  const growthMedia = allMedia.filter(isGrowthMedia);
  const diseaseMedia = allMedia.filter(isDiseaseMedia);

  // Smart Crop Asset Fallback & Real Growth Photo Resolver
  const hasRealGrowthPhoto = growthMedia.length > 0 && growthMedia[0].url && !growthMedia[0].url.includes('photo-1587293852726-70cdb56c2866');
  const cropImgSrc = hasRealGrowthPhoto ? esc(growthMedia[0].url) : getCropImageSrc(plant.plant_type, plant.plant_variety);

  const headerImgEl = document.getElementById('erp-plant-crop-header-img');
  if (headerImgEl) {
    headerImgEl.src = cropImgSrc;
  }

  const tabImgEl = document.getElementById('erp-plant-crop-tab-img');
  if (tabImgEl) {
    tabImgEl.src = cropImgSrc;
  }

  const cropTitleEl = document.getElementById('erp-plant-crop-variety-title');
  if (cropTitleEl) {
    cropTitleEl.textContent = varietyStr;
  }

  const sourceTagEl = document.getElementById('erp-plant-crop-source-tag');
  const descEl = document.getElementById('erp-plant-crop-type-desc');
  if (sourceTagEl) {
    if (hasRealGrowthPhoto) {
      sourceTagEl.style.background = '#d1fae5';
      sourceTagEl.style.color = '#047857';
      sourceTagEl.innerHTML = '<i data-lucide="camera" class="lucide-xs"></i> <span>Ảnh Chụp Thực Tế</span>';
      if (descEl) descEl.textContent = 'Ảnh chụp hiện trường sinh trưởng gần nhất của cây';
    } else {
      sourceTagEl.style.background = '#e0f2fe';
      sourceTagEl.style.color = '#0369a1';
      sourceTagEl.innerHTML = '<i data-lucide="sprout" class="lucide-xs"></i> <span>Ảnh Giống Cây Trồng</span>';
      if (descEl) descEl.textContent = `Ảnh minh họa chuẩn định danh cho giống ${esc(plant.plant_variety || plant.plant_type || 'cây')}`;
    }
  }

  // Render Growth Photo Gallery & Timeline (ONLY growth photos)
  _renderGrowthPhotoGallery(growthMedia, plant);

  // 5. Fill Executive Quick Stats Bar
  const ageVal = plant.plant_age || (plant.planting_date ? calculatePlantAge(plant.planting_date) : '—');
  const statAgeEl = document.getElementById('erp-stat-plant-age');
  if (statAgeEl) {
    statAgeEl.textContent = `${ageVal}${plant.planting_date ? ` (${plant.planting_date})` : ''}`;
  }

  const statLocEl = document.getElementById('erp-stat-location');
  if (statLocEl) {
    statLocEl.textContent = `${plotStr}${plant.row_number ? ` · Hàng ${plant.row_number}` : ''}`;
  }

  const yieldVal = plant.data?.initial_yield || plant.initial_yield || (plant.schema_data?.initial_yield);
  const statYieldEl = document.getElementById('erp-stat-initial-yield');
  if (statYieldEl) {
    statYieldEl.textContent = yieldVal ? `${yieldVal}` : 'Chưa ghi nhận';
  }

  const nfcVal = plant.nfc_uid || (plant.tags && plant.tags.length > 0 ? plant.tags[0].nfc_uid : null);
  const statNfcEl = document.getElementById('erp-stat-nfc-uid');
  if (statNfcEl) {
    statNfcEl.textContent = nfcVal ? nfcVal : 'Chưa gán thẻ';
  }

  // 6. Fill Tab 1: Detailed Agronomic Attributes & Locked Coordinates
  const dtTreeCode = document.getElementById('erp-plant-detail-treecode');
  if (dtTreeCode) dtTreeCode.textContent = plant.tree_code || plant.id;

  const dtType = document.getElementById('erp-plant-detail-type');
  if (dtType) dtType.textContent = plant.plant_type || '—';

  const dtVariety = document.getElementById('erp-plant-detail-variety');
  if (dtVariety) dtVariety.textContent = plant.plant_variety || 'Chưa phân loại';

  const dtPlantingDate = document.getElementById('erp-plant-detail-planting-date');
  if (dtPlantingDate) dtPlantingDate.textContent = plant.planting_date ? `${plant.planting_date} (${ageVal})` : 'Chưa cập nhật';

  const dtPlot = document.getElementById('erp-plant-detail-plot');
  if (dtPlot) dtPlot.textContent = plant.plot_code || plant.location || '—';

  const dtRow = document.getElementById('erp-plant-detail-row');
  if (dtRow) dtRow.textContent = plant.row_number ? `Hàng số ${plant.row_number}` : '—';

  // Past Diseases Badges & Dedicated Disease Media Rendering
  const pastDiseases = plant.data?.past_diseases || plant.past_diseases || (plant.schema_data?.past_diseases);
  const diseasesContainer = document.getElementById('erp-plant-past-diseases-container');
  if (diseasesContainer) {
    let diseaseList = [];
    if (Array.isArray(pastDiseases)) {
      diseaseList = pastDiseases.filter(Boolean);
    } else if (typeof pastDiseases === 'string' && pastDiseases.trim()) {
      try {
        const parsed = JSON.parse(pastDiseases);
        if (Array.isArray(parsed)) diseaseList = parsed;
        else diseaseList = pastDiseases.split(',').map(s => s.trim());
      } catch (_) {
        diseaseList = pastDiseases.split(',').map(s => s.trim());
      }
    }

    let diseaseBadgesHtml = '';
    if (!diseaseList.length || diseaseList.includes('Chưa từng nhiễm bệnh') || diseaseList.includes('Chưa từng nhiễm bệnh (Cây khỏe)')) {
      diseaseBadgesHtml = `
        <span style="display:inline-flex;align-items:center;gap:5px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;">
          <i data-lucide="shield-check" class="lucide-xs"></i> Cây khỏe mạnh, chưa từng ghi nhận bệnh dịch trước đây
        </span>
      `;
    } else {
      diseaseBadgesHtml = diseaseList.map(d => `
        <span style="display:inline-flex;align-items:center;gap:5px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;">
          <i data-lucide="shield-alert" class="lucide-xs"></i> ${esc(d)}
        </span>
      `).join('');
    }

    // Dedicated Disease Media Showcase (Separate from Growth Timeline)
    let diseaseMediaHtml = '';
    if (diseaseMedia.length > 0) {
      diseaseMediaHtml = `
        <div style="margin-top: 10px; background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 12px; padding: 10px 12px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #b91c1c; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="display: flex; align-items: center; gap: 5px;">
              <i data-lucide="shield-alert" class="lucide-xs"></i> Ảnh &amp; Video Bệnh Cây Đã Ghi Nhận
            </span>
            <span style="background: #fee2e2; color: #991b1b; padding: 1px 6px; border-radius: 6px; font-size: 10.5px; font-weight: 800;">${diseaseMedia.length} tệp</span>
          </div>
          <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
            ${diseaseMedia.map(dm => {
              const isVid = dm.media_type === 'video' || (dm.url && (dm.url.endsWith('.mp4') || dm.url.endsWith('.mov') || dm.url.endsWith('.webm')));
              const captionStr = dm.caption || 'Bệnh cây';
              return `
                <div style="flex-shrink: 0; width: 76px; text-align: center;">
                  <div style="width: 76px; height: 58px; border-radius: 8px; overflow: hidden; border: 1.5px solid #f87171; position: relative; background: #0f172a; cursor: pointer;" onclick="if(window.openLightbox) openLightbox('${esc(dm.url)}', '${isVid ? 'video' : 'image'}')">
                    ${isVid 
                      ? `<video src="${esc(dm.url)}" style="width:100%;height:100%;object-fit:cover;"></video><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);color:#fff;"><i data-lucide="play" class="lucide-xs"></i></span>`
                      : `<img src="${esc(dm.url)}" alt="${esc(captionStr)}" style="width:100%;height:100%;object-fit:cover;">`
                    }
                  </div>
                  <div style="font-size: 10px; color: #991b1b; font-weight: 700; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${esc(captionStr)}">
                    ${esc(captionStr)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    diseasesContainer.innerHTML = diseaseBadgesHtml + diseaseMediaHtml;
  }

  // Coordinates GPS Display (Strictly Read-Only, 0 mutation)
  const gpsEl = document.getElementById('erp-plant-gps-text');
  if (gpsEl) {
    const lat = parseFloat(plant.latitude);
    const lng = parseFloat(plant.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      gpsEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } else {
      gpsEl.textContent = 'Chưa xác định tọa độ GPS';
    }
  }

  // NFC UID Display
  const nfcValEl = document.getElementById('erp-plant-nfc-val');
  if (nfcValEl) {
    nfcValEl.textContent = nfcVal ? nfcVal : 'Chưa gán thẻ RFID';
  }

  // 7. Load Tab 2 (VietGAP Timeline) & Tab 3 (Cost Analysis)
  await _loadErpPlantLogsAndCosts(plant.id, plant);

  // 8. Display modal
  modal.style.display = 'flex';
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  if (window.refreshIcons) window.refreshIcons();
}

export function closePlantProfileModal() {
  const modal = document.getElementById('internal-plant-profile-modal');
  if (modal) modal.style.display = 'none';
  _currentErpPlant = null;
}

export function switchErpProfileTab(tab) {
  const tabs = ['overview', 'logs', 'cost'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-erp-${t}`);
    const pane = document.getElementById(`erp-tab-pane-${t}`);
    if (btn) {
      if (t === tab) {
        btn.classList.add('active');
        btn.style.color = '#059669';
        btn.style.borderBottomColor = '#059669';
      } else {
        btn.classList.remove('active');
        btn.style.color = '#64748b';
        btn.style.borderBottomColor = 'transparent';
      }
    }
    if (pane) {
      pane.style.display = (t === tab) ? 'block' : 'none';
    }
  });
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  if (window.refreshIcons) window.refreshIcons();
  setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, 40);
}

export function onErpProfileCareClick() {
  if (!_currentErpPlant) return;
  const p = _currentErpPlant;
  if (window.openCareModal) {
    window.openCareModal(p.id, p.tree_code || p.id, p.plant_type || '');
  }
}

export function onErpProfileNfcClick() {
  if (!_currentErpPlant) return;
  const p = _currentErpPlant;
  if (window.openNfcModal) {
    window.openNfcModal(p.id, p.tree_code || p.id, p.public_slug || '', p.nfc_uid || null);
  }
}

async function _loadErpPlantLogsAndCosts(plantId, plant) {
  const timelineContainer = document.getElementById('erp-plant-logs-timeline-container');
  const logsCountEl = document.getElementById('erp-plant-logs-count');
  const costTotalEl = document.getElementById('erp-cost-total-amount');
  const costFertilizerEl = document.getElementById('erp-cost-fertilizer-amount');
  const costPesticideEl = document.getElementById('erp-cost-pesticide-amount');
  const costWaterEl = document.getElementById('erp-cost-water-amount');
  const materialsListEl = document.getElementById('erp-cost-materials-list');

  // Harvest Economics DOM Elements
  const harvestRevEl = document.getElementById('erp-harvest-total-revenue');
  const harvestKgFruitsEl = document.getElementById('erp-harvest-total-kg-fruits');
  const harvestNetProfitEl = document.getElementById('erp-harvest-net-profit');
  const harvestRoiEl = document.getElementById('erp-harvest-roi-badge');
  const harvestHistoryListEl = document.getElementById('erp-harvest-history-list');
  const harvestBadgeEl = document.getElementById('erp-harvest-count-badge');
  const headerYieldEl = document.getElementById('erp-stat-initial-yield');

  let logs = (plant && Array.isArray(plant.logs)) ? plant.logs : [];

  if (!logs.length) {
    try {
      const res = await api(`/plants/${plantId}/logs`);
      if (res && Array.isArray(res.logs)) {
        logs = res.logs;
      } else if (Array.isArray(res)) {
        logs = res;
      }
    } catch (err) {
      console.warn('[ERP Profile] Could not fetch logs from API, fallback to memory logs:', err);
      if (window._allLogsCache) {
        logs = window._allLogsCache.filter(l => String(l.plant_id) === String(plantId));
      }
    }
  }

  // Ensure supplies cache is loaded for client-side cost enrichment
  if (!window._declaredSuppliesCache || !window._declaredSuppliesCache.length) {
    try {
      window._declaredSuppliesCache = await api('/supplies');
    } catch (e) {
      // ignore
    }
  }
  const suppliesCache = window._declaredSuppliesCache || [];

  if (logsCountEl) logsCountEl.textContent = logs.length;

  // Render Timeline
  if (timelineContainer) {
    if (!logs.length) {
      timelineContainer.innerHTML = `
        <div style="text-align:center;padding:28px 16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;">
          <i data-lucide="calendar-off" class="lucide-md" style="color:#94a3b8;margin-bottom:6px;"></i>
          <div style="font-weight:700;font-size:13px;color:#334155;">Chưa có dữ liệu nhật ký canh tác</div>
          <div style="font-size:12px;margin-top:2px;">Bấm nút "+ Thêm nhật ký mới" để ghi lại hoạt động tưới tiêu, bón phân, phun thuốc hoặc thu hoạch.</div>
        </div>
      `;
    } else {
      timelineContainer.innerHTML = logs.map((log) => {
        let typeColor = '#059669';
        let typeBg = '#ecfdf5';
        let iconName = 'clipboard-check';
        const typeStr = String(log.log_type || '').toLowerCase();
        if (typeStr.includes('tưới') || typeStr.includes('tuoi') || typeStr.includes('water')) {
          typeColor = '#0284c7'; typeBg = '#f0f9ff'; iconName = 'droplet';
        } else if (typeStr.includes('nhân công') || typeStr.includes('nhan cong') || typeStr.includes('labor')) {
          typeColor = '#2563eb'; typeBg = '#eff6ff'; iconName = 'users';
        } else if (typeStr.includes('phân') || typeStr.includes('phan') || typeStr.includes('fertil')) {
          typeColor = '#16a34a'; typeBg = '#f0fdf4'; iconName = 'sprout';
        } else if (typeStr.includes('thuốc') || typeStr.includes('thuoc') || typeStr.includes('pest') || typeStr.includes('sâu') || typeStr.includes('bệnh')) {
          typeColor = '#d97706'; typeBg = '#fffbeb'; iconName = 'shield-alert';
        } else if (typeStr.includes('thu hoạch') || typeStr.includes('harvest')) {
          typeColor = '#9333ea'; typeBg = '#faf5ff'; iconName = 'package-check';
        } else if (typeStr.includes('tỉa') || typeStr.includes('pruning')) {
          typeColor = '#475569'; typeBg = '#f8fafc'; iconName = 'scissors';
        }

        const rawPhotos = Array.isArray(log.media_urls) ? log.media_urls : (log.media_urls ? [log.media_urls] : []);
        const photos = rawPhotos.map(p => (typeof p === 'object' && p !== null) ? p.url : p).filter(Boolean);

        return `
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid ${typeColor};border-radius:10px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div style="width:34px;height:34px;border-radius:8px;background:${typeBg};color:${typeColor};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;margin-top:2px;">
              <i data-lucide="${iconName}" class="lucide-sm"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                <span style="font-size:13px;font-weight:800;color:#0f172a;">${esc(log.log_type || 'Nhật ký chăm sóc')}</span>
                <span style="font-size:11.5px;color:#64748b;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                  <i data-lucide="clock" class="lucide-xs"></i> ${esc(log.log_date || log.created_at || '—')}
                </span>
              </div>
              <div style="font-size:12px;color:#334155;line-height:1.5;">
                ${esc(log.note || log.action || 'Không có ghi chú chi tiết.')}
              </div>
              ${(log.operator_name || log.equipment_used) ? `
                <div style="font-size:11px;color:#64748b;margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">
                  ${log.operator_name ? `<span><i data-lucide="user" class="lucide-xs"></i> Nhân sự: <strong>${esc(log.operator_name)}</strong></span>` : ''}
                  ${log.equipment_used ? `<span><i data-lucide="wrench" class="lucide-xs"></i> Thiết bị: <strong>${esc(log.equipment_used)}</strong></span>` : ''}
                </div>` : ''}
              ${photos.length ? `
                <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
                  ${photos.map(pUrl => `<img src="${esc(pUrl)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer;" onclick="if(window.openLightbox) openLightbox('${esc(pUrl)}')">`).join('')}
                </div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Calculate Costs & Supplies Breakdown & Harvest Economics FIRST
  let totalCost = 0;
  let fertCost = 0;
  let pestCost = 0;
  let waterCost = 0;
  const materialsUsed = [];

  let totalHarvestRev = 0;
  let totalHarvestFruits = 0;
  let totalHarvestKg = 0;
  const harvestList = [];

  // Enriched logs container
  const enrichedLogs = logs.map(log => {
    let typeStr = String(log.log_type || '').toLowerCase();
    let details = log.details || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch(e) { details = {}; }
    }

    // Smart Dual-Defense: Tự động phát hiện log thu hoạch dù log_type có bị lưu nhầm
    const isExplicitHarvest = typeStr.includes('thu hoạch') || typeStr.includes('harvest');
    const isHarvestByDetails = parseFloat(details.fruit_count) > 0 || 
                               parseFloat(details.price_per_tree) > 0 || 
                               parseFloat(details.total_revenue) > 0 ||
                               parseFloat(details.avg_price_per_fruit) > 0 ||
                               (details.quality && !details.pesticide_name && !details.fertilizer_name) ||
                               (parseFloat(details.amount) >= 50 && (details.unit === 'kg' || details.unit === 'tấn' || details.unit === 'trái') && (log.equipment_used === 'Kéo' || !details.pesticide_name));

    // A. NHẬT KÝ THU HOẠCH (HARVEST LOGS)
    if (isExplicitHarvest || isHarvestByDetails) {
      log.log_type = 'Thu hoạch';
      typeStr = 'thu hoạch';

      const hKg = parseFloat(details.amount || log.quantity || 0) || 0;
      const hUnit = details.unit || log.unit || 'kg';
      const hFruits = parseFloat(details.fruit_count || 0) || 0;
      const hRev = parseFloat(details.price_per_tree || details.total_revenue || log.cost || 0) || 0;
      const hAvgPerFruit = hFruits > 0 ? (hRev > 0 ? Math.round(hRev / hFruits) : parseFloat(details.avg_price_per_fruit || 0) || 0) : 0;
      const hQuality = details.quality || 'Loại A (Đạt chuẩn xuất khẩu)';

      totalHarvestRev += hRev;
      totalHarvestFruits += hFruits;
      totalHarvestKg += hKg;

      const harvestItem = {
        date: log.log_date || log.created_at,
        amount: hKg,
        unit: hUnit,
        fruit_count: hFruits,
        revenue: hRev,
        avg_price_per_fruit: hAvgPerFruit,
        quality: hQuality,
        note: log.note || ''
      };
      harvestList.push(harvestItem);

      return {
        ...log,
        log_type: 'Thu hoạch',
        _isHarvest: true,
        _harvestItem: harvestItem
      };
    }

    // B. NHẬT KÝ CANH TÁC CÓ TIÊU HAO VẬT TƯ (CARE LOGS)
    let cost = parseFloat(log.cost || details.cost || details.total_cost || 0) || 0;
    let materialName = log.material_name || details.material_name || details.supply_name || details.fertilizer_name || details.pesticide_name;
    let quantity = log.quantity || details.quantity || details.amount;
    let unit = log.unit || details.unit || '';

    // Sanity check: nếu chi phí tưới nước > 50.000 VNĐ cho 1 cây, chuẩn hóa về giá thực tế (~30L x 15đ = 450đ - 1.500đ)
    if (typeStr.includes('tưới') || typeStr.includes('tuoi') || typeStr.includes('water')) {
      if (!materialName) materialName = 'Nước tưới gốc';
      if (!unit) unit = 'lít';
      const numLiters = parseFloat(quantity) || 30;
      if (cost === 0 || cost > 50000) {
        cost = Math.round(numLiters * 15);
      }
      if (!quantity) quantity = 30;
    } else if (typeStr.includes('thuốc') || typeStr.includes('thuoc') || typeStr.includes('pest') || typeStr.includes('sâu') || typeStr.includes('bệnh')) {
      // Phun thuốc: nếu chưa có tên thuốc hoặc cost = 0, gán thuốc BVTV tiêu chuẩn
      if (!materialName || cost === 0) {
        const pestSup = suppliesCache.find(s => 
          (s.category && (s.category.includes('thuốc') || s.category.includes('Thuốc'))) ||
          (s.name && (s.name.toLowerCase().includes('thuốc') || s.name.toLowerCase().includes('sâu') || s.name.toLowerCase().includes('bệnh')))
        );
        if (pestSup) {
          materialName = materialName || pestSup.name;
          const uP = parseFloat(pestSup.unit_price || pestSup.price) || 35000;
          cost = cost > 0 ? cost : Math.round(uP * (parseFloat(quantity) ? parseFloat(quantity)/1000 : 0.05));
          if (cost <= 0) cost = 35000;
        } else {
          materialName = materialName || 'Thuốc BVTV sinh học';
          if (cost <= 0) cost = 35000;
        }
      }
      if (!quantity) { quantity = 1; unit = 'bình 20L'; }
    } else if (typeStr.includes('nhân công') || typeStr.includes('nhan cong') || typeStr.includes('labor')) {
      materialName = details.work_content ? `Nhân công: ${details.work_content}` : (materialName || 'Nhân công canh tác');
      if (details.worker_count) {
        quantity = details.worker_count;
        unit = `người${details.time_range ? ' · ' + details.time_range : ''}`;
      }
    } else if (typeStr.includes('phân') || typeStr.includes('phan') || typeStr.includes('fertil')) {
      // Bón phân: nếu chưa có tên phân hoặc cost = 0, gán phân bón tiêu chuẩn
      if (!materialName || cost === 0) {
        const fertSup = suppliesCache.find(s => 
          (s.category && (s.category.includes('phân') || s.category.includes('Phân'))) ||
          (s.name && (s.name.toLowerCase().includes('phân') || s.name.toLowerCase().includes('npk') || s.name.toLowerCase().includes('hữu cơ')))
        );
        if (fertSup) {
          materialName = materialName || fertSup.name;
          const uP = parseFloat(fertSup.unit_price || fertSup.price) || 25000;
          cost = cost > 0 ? cost : Math.round(uP * (parseFloat(quantity) ? parseFloat(quantity)/1000 : 0.2));
          if (cost <= 0) cost = 25000;
        } else {
          materialName = materialName || 'Phân bón NPK vi lượng';
          if (cost <= 0) cost = 25000;
        }
      }
      if (!quantity) { quantity = 200; unit = 'gam'; }
    }

    if (materialName && cost > 0) {
      materialsUsed.push({
        date: log.log_date || log.created_at,
        type: log.log_type,
        name: materialName,
        quantity: quantity ? `${quantity} ${unit}`.trim() : 'Định mức tiêu chuẩn',
        cost: cost
      });

      totalCost += cost;
      if (typeStr.includes('phân') || typeStr.includes('phan') || typeStr.includes('fertil')) {
        fertCost += cost;
      } else if (typeStr.includes('thuốc') || typeStr.includes('thuoc') || typeStr.includes('pest') || typeStr.includes('sâu') || typeStr.includes('bệnh')) {
        pestCost += cost;
      } else if (typeStr.includes('tưới') || typeStr.includes('tuoi') || typeStr.includes('water')) {
        waterCost += cost;
      }
    }

    return {
      ...log,
      _materialName: materialName,
      _materialQty: quantity ? `${quantity} ${unit}`.trim() : '',
      _cost: cost
    };
  });

  // Render Timeline (Tab 2) WITH INLINE COST & SUPPLY BADGES
  if (timelineContainer) {
    if (!enrichedLogs.length) {
      timelineContainer.innerHTML = `
        <div style="text-align:center;padding:28px 16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;">
          <i data-lucide="calendar-off" class="lucide-md" style="color:#94a3b8;margin-bottom:6px;"></i>
          <div style="font-weight:700;font-size:13px;color:#334155;">Chưa có dữ liệu nhật ký canh tác</div>
          <div style="font-size:12px;margin-top:2px;">Bấm nút "+ Thêm nhật ký mới" để ghi lại hoạt động tưới tiêu, bón phân, phun thuốc hoặc thu hoạch.</div>
        </div>
      `;
    } else {
      timelineContainer.innerHTML = enrichedLogs.map((log) => {
        let typeColor = '#059669';
        let typeBg = '#ecfdf5';
        let iconName = 'clipboard-check';
        const typeStr = String(log.log_type || '').toLowerCase();
        if (typeStr.includes('tưới') || typeStr.includes('tuoi') || typeStr.includes('water')) {
          typeColor = '#0284c7'; typeBg = '#f0f9ff'; iconName = 'droplet';
        } else if (typeStr.includes('nhân công') || typeStr.includes('nhan cong') || typeStr.includes('labor')) {
          typeColor = '#2563eb'; typeBg = '#eff6ff'; iconName = 'users';
        } else if (typeStr.includes('phân') || typeStr.includes('phan') || typeStr.includes('fertil')) {
          typeColor = '#16a34a'; typeBg = '#f0fdf4'; iconName = 'sprout';
        } else if (typeStr.includes('thuốc') || typeStr.includes('thuoc') || typeStr.includes('pest') || typeStr.includes('sâu') || typeStr.includes('bệnh')) {
          typeColor = '#d97706'; typeBg = '#fffbeb'; iconName = 'shield-alert';
        } else if (typeStr.includes('thu hoạch') || typeStr.includes('harvest')) {
          typeColor = '#9333ea'; typeBg = '#faf5ff'; iconName = 'package-check';
        } else if (typeStr.includes('tỉa') || typeStr.includes('pruning')) {
          typeColor = '#475569'; typeBg = '#f8fafc'; iconName = 'scissors';
        }

        const rawPhotos = Array.isArray(log.media_urls) ? log.media_urls : (log.media_urls ? [log.media_urls] : []);
        const photos = rawPhotos.map(p => (typeof p === 'object' && p !== null) ? p.url : p).filter(Boolean);

        return `
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid ${typeColor};border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div style="width:36px;height:36px;border-radius:10px;background:${typeBg};color:${typeColor};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;margin-top:2px;">
              <i data-lucide="${iconName}" class="lucide-sm"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                <span style="font-size:13.5px;font-weight:800;color:#0f172a;">${esc(log.log_type || 'Nhật ký chăm sóc')}</span>
                <span style="font-size:11.5px;color:#64748b;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                  <i data-lucide="clock" class="lucide-xs"></i> ${esc(log.log_date || log.created_at || '—')}
                </span>
              </div>
              
              <div style="font-size:12px;color:#334155;line-height:1.5;">
                ${esc(log.note || log.action || 'Không có ghi chú chi tiết.')}
              </div>

              ${log._isHarvest ? `
                <div style="margin-top:8px;padding:10px 14px;background:linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);border:1.5px solid #d8b4fe;border-radius:10px;box-shadow:0 2px 6px rgba(147,51,234,0.06);">
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:13px;color:#6b21a8;font-weight:800;display:inline-flex;align-items:center;gap:6px;">
                      <i data-lucide="package-check" class="lucide-sm" style="color:#9333ea;"></i>
                      <span>Sản lượng: <strong style="color:#581c87;font-size:14px;">${log._harvestItem.amount} ${log._harvestItem.unit}</strong> ${log._harvestItem.fruit_count > 0 ? `(${log._harvestItem.fruit_count} quả)` : ''}</span>
                    </div>
                    <div style="font-size:13px;font-weight:900;color:#047857;background:#dcfce7;border:1px solid #86efac;padding:3px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">
                      <i data-lucide="badge-dollar-sign" class="lucide-xs"></i>
                      <span>+${log._harvestItem.revenue.toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                  </div>
                  <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #e9d5ff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:11.5px;color:#7e22ce;">
                    ${log._harvestItem.avg_price_per_fruit > 0 ? `
                      <span style="display:inline-flex;align-items:center;gap:4px;font-weight:700;">
                        <i data-lucide="calculator" class="lucide-xs"></i> Bình quân: <strong>${log._harvestItem.avg_price_per_fruit.toLocaleString('vi-VN')} VNĐ/quả</strong>
                      </span>
                    ` : ''}
                    ${log._harvestItem.quality ? `
                      <span style="display:inline-flex;align-items:center;gap:4px;color:#6b21a8;font-weight:600;">
                        <i data-lucide="award" class="lucide-xs"></i> ${esc(log._harvestItem.quality)}
                      </span>
                    ` : ''}
                    ${(log.batch_code || (log.details && log.details.batch_code)) ? `
                      <span style="font-family:monospace;font-weight:700;color:#0369a1;background:#e0f2fe;padding:1px 6px;border-radius:4px;border:1px solid #bae6fd;">
                        <i data-lucide="scan" class="lucide-xs"></i> Lô: ${esc(log.batch_code || log.details.batch_code)}
                      </span>
                    ` : ''}
                  </div>
                </div>
              ` : (log._materialName && log._cost > 0) ? `
                <div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                  <div style="font-size:12px;color:#166534;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                    <i data-lucide="package" class="lucide-xs" style="color:#16a34a;"></i>
                    <span>Vật tư: <strong>${esc(log._materialName)}</strong> ${log._materialQty ? `(${esc(log._materialQty)})` : ''}</span>
                  </div>
                  <div style="font-size:12.5px;font-weight:800;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">
                    <i data-lucide="receipt" class="lucide-xs"></i>
                    <span>Tiêu hao: ${log._cost.toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                </div>
              ` : ''}

              ${(log.operator_name || log.equipment_used) ? `
                <div style="font-size:11px;color:#64748b;margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;">
                  ${log.operator_name ? `<span><i data-lucide="user" class="lucide-xs"></i> Nhân sự: <strong>${esc(log.operator_name)}</strong></span>` : ''}
                  ${log.equipment_used ? `<span><i data-lucide="wrench" class="lucide-xs"></i> Thiết bị: <strong>${esc(log.equipment_used)}</strong></span>` : ''}
                </div>` : ''}
              
              ${photos.length ? `
                <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
                  ${photos.map(pUrl => `<img src="${esc(pUrl)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer;" onclick="if(window.openLightbox) openLightbox('${esc(pUrl)}')">`).join('')}
                </div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Cost Breakdown in Tab 3
  if (costTotalEl) costTotalEl.textContent = `${totalCost.toLocaleString('vi-VN')} VNĐ`;
  if (costFertilizerEl) costFertilizerEl.textContent = `${fertCost.toLocaleString('vi-VN')} VNĐ`;
  if (costPesticideEl) costPesticideEl.textContent = `${pestCost.toLocaleString('vi-VN')} VNĐ`;
  if (costWaterEl) costWaterEl.textContent = `${waterCost.toLocaleString('vi-VN')} VNĐ`;

  // Render Harvest Economics (Revenue, Net Profit, ROI)
  const netProfit = totalHarvestRev - totalCost;
  const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : (totalHarvestRev > 0 ? 100 : 0);

  if (harvestRevEl) harvestRevEl.textContent = `${totalHarvestRev.toLocaleString('vi-VN')} VNĐ`;
  if (harvestKgFruitsEl) harvestKgFruitsEl.textContent = `${totalHarvestKg.toLocaleString('vi-VN')} kg · ${totalHarvestFruits.toLocaleString('vi-VN')} trái`;

  if (harvestNetProfitEl) {
    const profitSign = netProfit > 0 ? '+' : '';
    harvestNetProfitEl.textContent = `${profitSign}${netProfit.toLocaleString('vi-VN')} VNĐ`;
    harvestNetProfitEl.style.color = netProfit >= 0 ? '#15803d' : '#b91c1c';
  }

  if (harvestRoiEl) {
    const roiSign = roi > 0 ? '+' : '';
    harvestRoiEl.textContent = `ROI: ${roiSign}${roi}%`;
    if (netProfit >= 0) {
      harvestRoiEl.style.background = '#dcfce7';
      harvestRoiEl.style.color = '#15803d';
    } else {
      harvestRoiEl.style.background = '#fee2e2';
      harvestRoiEl.style.color = '#b91c1c';
    }
  }

  if (harvestBadgeEl) {
    harvestBadgeEl.textContent = `${harvestList.length} đợt thu hoạch`;
  }

  // Update Header Metric 3 (Initial Yield / Actual Harvest)
  if (headerYieldEl) {
    if (totalHarvestKg > 0 || totalHarvestRev > 0) {
      headerYieldEl.textContent = `${totalHarvestKg.toLocaleString('vi-VN')} kg (${totalHarvestRev.toLocaleString('vi-VN')} đ)`;
      headerYieldEl.title = `Tổng sản lượng: ${totalHarvestKg} kg, Tổng số trái: ${totalHarvestFruits} quả, Doanh thu: ${totalHarvestRev.toLocaleString('vi-VN')} VNĐ`;
    } else if (plant && plant.initial_yield) {
      headerYieldEl.textContent = `${plant.initial_yield} kg/năm`;
    } else {
      headerYieldEl.textContent = 'Chưa thu hoạch';
    }
  }

  // Render Harvest History Table
  if (harvestHistoryListEl) {
    if (!harvestList.length) {
      harvestHistoryListEl.innerHTML = `
        <div style="text-align: center; padding: 16px; color: #64748b; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
          <i data-lucide="package-open" class="lucide-sm" style="color: #94a3b8; margin-bottom: 4px;"></i>
          <div>Chưa có đợt thu hoạch nào được ghi nhận cho cây này.</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Vào tab 2 "Lịch Sử Canh Tác" bấm "+ Thêm nhật ký mới" &gt; chọn hạng mục <strong>Thu hoạch</strong> để lưu kết quả.</div>
        </div>
      `;
    } else {
      harvestHistoryListEl.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:#f8fafc; color:#475569; text-align:left;">
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Ngày thu</th>
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Sản lượng</th>
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Số lượng trái</th>
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Doanh thu</th>
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Giá TB/Quả</th>
                <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Phẩm cấp</th>
              </tr>
            </thead>
            <tbody>
              ${harvestList.map(h => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 10px; color:#64748b; font-weight:600;">${esc(h.date || '—')}</td>
                  <td style="padding:8px 10px; font-weight:700; color:#0f172a;">${h.amount > 0 ? `${h.amount} ${esc(h.unit)}` : '—'}</td>
                  <td style="padding:8px 10px; font-weight:700; color:#0284c7;">${h.fruit_count > 0 ? `${h.fruit_count} trái` : '—'}</td>
                  <td style="padding:8px 10px; font-weight:800; color:#15803d;">${h.revenue > 0 ? `${h.revenue.toLocaleString('vi-VN')} VNĐ` : '—'}</td>
                  <td style="padding:8px 10px; color:#475569; font-weight:600;">${h.avg_price_per_fruit > 0 ? `${h.avg_price_per_fruit.toLocaleString('vi-VN')} đ/trái` : '—'}</td>
                  <td style="padding:8px 10px;">
                    <span style="background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11px;">
                      ${esc(h.quality)}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Render Materials Used Table (Tab 3) WITH TOTAL SUMMARY FOOTER
  if (materialsListEl) {
    if (!materialsUsed.length) {
      materialsListEl.innerHTML = '<span style="color:#64748b;">Chưa phát sinh chi phí vật tư phân bón / thuốc BVTV riêng biệt cho cây này.</span>';
    } else {
      materialsListEl.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;">
            <thead>
              <tr style="background:#f1f5f9;color:#475569;text-align:left;">
                <th style="padding:8px 10px;border:1px solid #e2e8f0;">Ngày dùng</th>
                <th style="padding:8px 10px;border:1px solid #e2e8f0;">Hoạt động & Vật tư</th>
                <th style="padding:8px 10px;border:1px solid #e2e8f0;">Định lượng</th>
                <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Chi phí tiêu hao</th>
              </tr>
            </thead>
            <tbody>
              ${materialsUsed.map(m => `
                <tr>
                  <td style="padding:8px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:600;">${esc(m.date || '—')}</td>
                  <td style="padding:8px 10px;border:1px solid #e2e8f0;">
                    <div style="font-weight:700;color:#0f172a;">${esc(m.name)}</div>
                    <div style="font-size:11px;color:#64748b;">${esc(m.type)}</div>
                  </td>
                  <td style="padding:8px 10px;border:1px solid #e2e8f0;color:#334155;font-weight:600;">${esc(m.quantity || 'Định mức chuẩn')}</td>
                  <td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:800;color:#15803d;text-align:right;">
                    ${m.cost.toLocaleString('vi-VN')} VNĐ
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;font-weight:800;">
                <td colspan="3" style="padding:10px;border:1px solid #e2e8f0;text-align:right;color:#0f172a;">
                  <i data-lucide="calculator" class="lucide-xs" style="color:#059669;margin-right:4px;"></i> TỔNG CỘNG CHI PHÍ VẬT TƯ:
                </td>
                <td style="padding:10px;border:1px solid #e2e8f0;text-align:right;color:#b91c1c;font-size:13.5px;">
                  ${totalCost.toLocaleString('vi-VN')} VNĐ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  if (window.refreshIcons) window.refreshIcons();
  setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, 50);
}

window.openPlantProfileModal = openPlantProfileModal;
window.closePlantProfileModal = closePlantProfileModal;
window.switchErpProfileTab = switchErpProfileTab;
window.onErpProfileCareClick = onErpProfileCareClick;
window.onErpProfileNfcClick = onErpProfileNfcClick;

// ── Growth Stage Photo Timeline & Gallery Controller (Append-Only) ──
function _getGrowthStageLucideIcon(stageStr) {
  const s = (stageStr || '').toLowerCase();
  if (s.includes('hoa') || s.includes('flower') || s.includes('mầm')) {
    return { icon: 'flower-2', color: '#db2777' };
  }
  if (s.includes('trái non') || s.includes('đậu trái')) {
    return { icon: 'circle-dot', color: '#16a34a' };
  }
  if (s.includes('nuôi trái') || s.includes('phát triển quả') || s.includes('quả') || s.includes('trái')) {
    return { icon: 'apple', color: '#ea580c' };
  }
  if (s.includes('thu hoạch') || s.includes('harvest')) {
    return { icon: 'shopping-bag', color: '#d97706' };
  }
  if (s.includes('phục hồi') || s.includes('recovery')) {
    return { icon: 'rotate-ccw', color: '#0284c7' };
  }
  if (s.includes('cơi đọt') || s.includes('dinh dưỡng') || s.includes('lá')) {
    return { icon: 'leaf', color: '#059669' };
  }
  return { icon: 'sprout', color: '#059669' };
}

export function _renderGrowthPhotoGallery(mediaList, plant) {
  const container = document.getElementById('erp-plant-growth-gallery-container');
  const countBadge = document.getElementById('erp-plant-media-count-badge');
  if (!container) return;

  const items = (Array.isArray(mediaList) ? mediaList : []).filter(isGrowthMedia);
  if (countBadge) countBadge.textContent = `${items.length} ảnh`;

  if (!items.length) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 22px 16px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px auto;">
          <i data-lucide="image" class="lucide-sm"></i>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #334155;">Chưa có ảnh chụp sinh trưởng thực tế</div>
        <div style="font-size: 11.5px; color: #64748b; margin-top: 3px;">
          Hệ thống đang hiển thị ảnh nhận diện chuẩn theo loài &amp; giống cây. Bấm nút <strong>+ Chụp / Tải ảnh mới</strong> để lưu mốc sinh trưởng.
        </div>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    if (window.refreshIcons) window.refreshIcons();
    return;
  }

  container.innerHTML = items.map((m, idx) => {
    const rawStage = m.caption || m.growth_stage || 'Cập nhật sinh trưởng';
    // Remove any unicode emojis that might have been saved in DB
    const stage = rawStage.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    const stageIcon = _getGrowthStageLucideIcon(stage);
    const dateStr = m.uploaded_at ? formatDate(m.uploaded_at) : (m.created_at ? formatDate(m.created_at) : 'Mới đây');
    const isLatest = idx === 0;

    return `
      <div style="background: #ffffff; border: 1.5px solid ${isLatest ? '#10b981' : '#e2e8f0'}; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.04); display: flex; flex-direction: column; position: relative;">
        ${isLatest ? `<span style="position: absolute; top: 6px; left: 6px; z-index: 2; background: #059669; color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="sparkles" class="lucide-xs"></i> Mới nhất</span>` : ''}
        
        <div style="height: 105px; width: 100%; overflow: hidden; position: relative; background: #f1f5f9; cursor: pointer;" onclick="if(window.openLightbox) openLightbox('${esc(m.url)}', 'image')">
          <img src="${esc(m.url)}" alt="${esc(stage)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s;" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">
          <button type="button" style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Phóng to">
            <i data-lucide="maximize-2" class="lucide-xs"></i>
          </button>
        </div>

        <div style="padding: 8px 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
          <div style="font-size: 11.5px; font-weight: 800; color: #064e3b; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 5px;" title="${esc(stage)}">
            <i data-lucide="${stageIcon.icon}" class="lucide-xs" style="color: ${stageIcon.color}; flex-shrink: 0;"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(stage)}</span>
          </div>
          <div style="font-size: 10.5px; color: #64748b; font-weight: 600; display: flex; align-items: center; gap: 3px;">
            <i data-lucide="calendar" class="lucide-xs"></i> <span>${esc(dateStr)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
  if (window.refreshIcons) window.refreshIcons();
}
window._renderGrowthPhotoGallery = _renderGrowthPhotoGallery;

let _erpGrowthModalFile = null;

export function openErpUploadGrowthPhotoModal() {
  if (!_currentErpPlant) {
    if (window.toast) window.toast('Vui lòng mở hồ sơ cây trồng trước!', 'warning');
    return;
  }
  _erpGrowthModalFile = null;
  const modal = document.getElementById('erp-upload-growth-photo-modal');
  const fileInp = document.getElementById('erp-growth-modal-file');
  const previewWrap = document.getElementById('erp-growth-modal-preview-wrap');
  const placeholder = document.getElementById('erp-growth-modal-placeholder');
  const captionInp = document.getElementById('erp-growth-modal-caption');
  
  if (fileInp) fileInp.value = '';
  if (previewWrap) previewWrap.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
  if (captionInp) captionInp.value = '';

  if (modal) modal.style.display = 'flex';
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  if (window.refreshIcons) window.refreshIcons();
}
window.openErpUploadGrowthPhotoModal = openErpUploadGrowthPhotoModal;

export function closeErpUploadGrowthPhotoModal() {
  const modal = document.getElementById('erp-upload-growth-photo-modal');
  if (modal) modal.style.display = 'none';
  _erpGrowthModalFile = null;
}
window.closeErpUploadGrowthPhotoModal = closeErpUploadGrowthPhotoModal;

export function onErpGrowthModalFileChange(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  _erpGrowthModalFile = file;

  const previewWrap = document.getElementById('erp-growth-modal-preview-wrap');
  const imgPreview = document.getElementById('erp-growth-modal-img-preview');
  const placeholder = document.getElementById('erp-growth-modal-placeholder');

  const reader = new FileReader();
  reader.onload = (e) => {
    if (imgPreview) imgPreview.src = e.target.result;
    if (previewWrap) previewWrap.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    if (window.refreshIcons) window.refreshIcons();
  };
  reader.readAsDataURL(file);
}
window.onErpGrowthModalFileChange = onErpGrowthModalFileChange;

export async function submitErpGrowthPhoto() {
  if (!_currentErpPlant) return;
  if (!_erpGrowthModalFile) {
    if (window.toast) window.toast('Vui lòng chụp hoặc chọn tệp tin ảnh!', 'warning');
    else alert('Vui lòng chụp hoặc chọn tệp tin ảnh!');
    return;
  }

  const stage = document.getElementById('erp-growth-modal-stage')?.value || 'Nuôi trái / Phát triển quả';
  const caption = (document.getElementById('erp-growth-modal-caption')?.value || '').trim();
  const fullCaption = caption ? `${stage} · ${caption}` : stage;

  const btn = document.getElementById('btn-submit-erp-growth-photo');
  const origBtn = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin lucide-xs"></i> Đang tải lên...';
    btn.disabled = true;
  }

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('pb_token');
    const formData = new FormData();
    formData.append('files', _erpGrowthModalFile);
    formData.append('growth_stage', fullCaption);

    const resp = await fetch(`/api/plants/${_currentErpPlant.id}/growth-photo`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: formData
    });

    const res = await resp.json();
    if (!resp.ok) {
      throw new Error(res.error || 'Lỗi khi tải ảnh sinh trưởng.');
    }

    // Update active plant in memory
    _currentErpPlant.cover_image = res.cover_image || (_currentErpPlant.cover_image);
    _currentErpPlant.media = res.all_media || (_currentErpPlant.media || []);

    const growthMedia = (_currentErpPlant.media || []).filter(isGrowthMedia);

    // Refresh Profile Header & Tab Images
    const headerImgEl = document.getElementById('erp-plant-crop-header-img');
    const tabImgEl = document.getElementById('erp-plant-crop-tab-img');
    if (headerImgEl && res.cover_image) headerImgEl.src = res.cover_image;
    if (tabImgEl && res.cover_image) tabImgEl.src = res.cover_image;

    const sourceTagEl = document.getElementById('erp-plant-crop-source-tag');
    const descEl = document.getElementById('erp-plant-crop-type-desc');
    if (sourceTagEl) {
      sourceTagEl.style.background = '#d1fae5';
      sourceTagEl.style.color = '#047857';
      sourceTagEl.innerHTML = '<i data-lucide="camera" class="lucide-xs"></i> <span>Ảnh Chụp Thực Tế</span>';
      if (descEl) descEl.textContent = 'Ảnh chụp hiện trường sinh trưởng gần nhất của cây';
    }

    // Re-render gallery with ONLY growth photos
    _renderGrowthPhotoGallery(growthMedia, _currentErpPlant);

    closeErpUploadGrowthPhotoModal();
    if (window.toast) window.toast(`✅ Đã lưu ảnh sinh trưởng (${stage}) thành công!`, 'success');
  } catch (err) {
    console.error('Lỗi khi tải ảnh sinh trưởng:', err);
    const msg = 'Lỗi tải ảnh: ' + err.message;
    if (window.toast) window.toast(msg, 'error');
    else alert(msg);
  } finally {
    if (btn) {
      btn.innerHTML = origBtn || '<i data-lucide="check" class="lucide-xs"></i> <span>Lưu Ảnh Sinh Trưởng</span>';
      btn.disabled = false;
    }
  }
}
window.submitErpGrowthPhoto = submitErpGrowthPhoto;
window.openErpUploadGrowthPhotoModal = openErpUploadGrowthPhotoModal;
window.closeErpUploadGrowthPhotoModal = closeErpUploadGrowthPhotoModal;
window.onErpGrowthModalFileChange = onErpGrowthModalFileChange;
window.onErpGrowthPhotoSelected = onErpGrowthModalFileChange;
window.triggerErpGrowthPhotoUpload = openErpUploadGrowthPhotoModal;

