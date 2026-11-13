// Modular Public Plant VietGAP Export, Certificates, Contour Lines & A4 Map Export
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
  const fromDate = document.getElementById('export-from-date')?.value || '';
  const toDate = document.getElementById('export-to-date')?.value || '';
  
  const checkedCats = [];
  document.querySelectorAll('#export-categories-container input[name="export-cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });
  
  if (checkedCats.length === 0) {
    alert("Vui lòng chọn ít nhất một hạng mục nhật ký để xuất.");
    return;
  }
  
  const targetId = currentPlantData?.nfc_uid || currentPlantData?.public_slug || currentPlantData?.id || (typeof slugInfo !== 'undefined' ? (slugInfo.slug || slugInfo.plantId) : slug);
  if (!targetId) {
    alert("Không xác định được mã cây trồng để xuất báo cáo.");
    return;
  }

  const reportUrl = `/plant/${encodeURIComponent(targetId)}/report?from=${fromDate}&to=${toDate}&categories=${encodeURIComponent(checkedCats.join(','))}`;
  window.open(reportUrl, '_blank');
  closeExportModal();
}

function exportPublicLogsCsv() {
  if (!currentPlantData) {
    alert("Dữ liệu cây trồng chưa được nạp xong.");
    return;
  }

  const fromDate = document.getElementById('export-from-date')?.value || '';
  const toDate = document.getElementById('export-to-date')?.value || '';
  
  const checkedCats = [];
  document.querySelectorAll('#export-categories-container input[name="export-cat"]:checked').forEach(cb => {
    checkedCats.push(cb.value);
  });
  
  if (checkedCats.length === 0) {
    alert("Vui lòng chọn ít nhất một hạng mục nhật ký để xuất.");
    return;
  }

  const logs = currentPlantData.logs || [];
  const filteredLogs = logs.filter(log => {
    const logDateStr = new Date(log.log_date).toISOString().split('T')[0];
    const isWithinDate = (!fromDate || logDateStr >= fromDate) && (!toDate || logDateStr <= toDate);
    const isMatchedCat = checkedCats.length === 0 || checkedCats.includes(log.log_type);
    return isWithinDate && isMatchedCat;
  });
  filteredLogs.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));

  if (filteredLogs.length === 0) {
    alert("Không có nhật ký canh tác nào khớp với khoảng thời gian và hạng mục đã chọn.");
    return;
  }

  const headers = [
    "STT",
    "Mã Cây",
    "Tên Cây",
    "Giống Cây",
    "Trang Trại",
    "Ngày Thực Hiện",
    "Hoạt Động Canh Tác",
    "Chi Tiết Hoạt Động / Vật Tư",
    "Người Thực Hiện",
    "Ghi Chú",
    "Hình Ảnh / Video"
  ];

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = [];
  rows.push(headers.map(escapeCsvCell).join(','));

  filteredLogs.forEach((log, index) => {
    let detailsText = '';
    const d = log.details || {};
    if (log.log_type === 'Tưới nước') {
      detailsText = `Cách: ${d.method || '—'}, Lượng: ${d.amount || '—'} ${d.unit || ''}`;
    } else if (log.log_type === 'Bón phân') {
      detailsText = `Loại: ${d.type || '—'}, Tên phân: ${d.fertilizer_name || '—'}, Lượng: ${d.amount || '—'} ${d.unit || ''}`;
    } else if (log.log_type === 'Phun thuốc') {
      detailsText = `Loại: ${d.type || '—'}, Thuốc: ${d.pesticide_name || '—'}, Liều lượng: ${d.amount || '—'}, Lý do: ${d.reason || '—'}`;
    } else if (log.log_type === 'Cắt lá') {
      detailsText = `Số cành/lá tỉa: ${d.amount || '—'}, Lý do: ${d.reason || '—'}`;
    } else if (log.log_type === 'Tỉa hoa') {
      detailsText = `Số bông/trái tỉa: ${d.amount || '—'}, Lý do: ${d.reason || '—'}`;
    } else if (log.log_type === 'Bệnh cây') {
      detailsText = `Bệnh: ${d.disease_name || 'Chưa rõ'}, Mức độ: ${d.severity || '—'}, Mô tả: ${d.description || '—'}`;
    } else {
      detailsText = d.method || d.amount || '';
    }

    const mediaUrls = (log.media_urls && Array.isArray(log.media_urls)) 
      ? log.media_urls.map(m => m.url || m).join('; ') 
      : '';

    const row = [
      index + 1,
      currentPlantData.tree_code || currentPlantData.id || '',
      currentPlantData.plant_type || '',
      currentPlantData.plant_variety || '',
      currentPlantData.farm_name || '',
      new Date(log.log_date).toLocaleDateString('vi-VN'),
      log.log_type || '',
      detailsText,
      log.creator_name || 'Nông hộ',
      log.note || '',
      mediaUrls
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanPlantType = (currentPlantData.plant_type || 'Cay').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const cleanTreeCode = (currentPlantData.tree_code || currentPlantData.id || 'Tree').toString().replace(/[^a-zA-Z0-9_]/g, '_');
  const dateSuffix = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `NhatKyCanhTac_${cleanPlantType}_${cleanTreeCode}_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  closeExportModal();
}
// Global Collapsible Toggles for Section II (Extended Info) & Section III (Timeline)
window.toggleExtendedSection = function(forceOpen) {
  const previewBox = document.getElementById('extended-preview-box');
  const detailBox = document.getElementById('extended-detail-content');
  const btnText = document.getElementById('text-toggle-extended');
  const btnIcon = document.getElementById('icon-toggle-extended');
  const btn = document.getElementById('btn-toggle-extended');
  if (!detailBox) return;

  const isCurrentlyOpen = detailBox.style.display !== 'none';
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

  if (shouldOpen) {
    if (previewBox) previewBox.style.display = 'none';
    detailBox.style.display = 'block';
    if (btnText) btnText.textContent = 'Thu gọn';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'chevron-up');
    if (btn) btn.classList.add('active');

    // Trigger Mapbox/Leaflet resize when container becomes visible
    setTimeout(() => {
      if (window._publicPlantMap && typeof window._publicPlantMap.resize === 'function') {
        window._publicPlantMap.resize();
      }
      if (window.lucide) window.lucide.createIcons();
    }, 150);
  } else {
    if (previewBox) previewBox.style.display = 'block';
    detailBox.style.display = 'none';
    if (btnText) btnText.textContent = 'Xem chi tiết';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'chevron-down');
    if (btn) btn.classList.remove('active');
  }

  if (window.lucide) window.lucide.createIcons();
};

window.toggleTimelineSection = function(forceOpen) {
  const previewBox = document.getElementById('timeline-preview-box');
  const detailBox = document.getElementById('timeline-detail-content');
  const btnText = document.getElementById('text-toggle-timeline');
  const btnIcon = document.getElementById('icon-toggle-timeline');
  const btn = document.getElementById('btn-toggle-timeline');
  if (!detailBox) return;

  const isCurrentlyOpen = detailBox.style.display !== 'none';
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

  if (shouldOpen) {
    if (previewBox) previewBox.style.display = 'none';
    detailBox.style.display = 'block';
    if (btnText) btnText.textContent = 'Thu gọn';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'chevron-up');
    if (btn) btn.classList.add('active');
  } else {
    if (previewBox) previewBox.style.display = 'block';
    detailBox.style.display = 'none';
    if (btnText) btnText.textContent = 'Xem chi tiết';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'chevron-down');
    if (btn) btn.classList.remove('active');
  }

  if (window.lucide) window.lucide.createIcons();
};

// Copy Passport Text Helper
function copyPassportText(text, btnEl) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (btnEl) {
      const oldHtml = btnEl.innerHTML;
      btnEl.innerHTML = '<i data-lucide="check" class="lucide-xs"></i> Đã chép!';
      btnEl.style.background = '#dcfce7';
      btnEl.style.color = '#15803d';
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btnEl.innerHTML = oldHtml;
        btnEl.style.background = '';
        btnEl.style.color = '';
        if (window.lucide) window.lucide.createIcons();
      }, 1800);
    }
  }).catch(() => {
    prompt('Sao chép mã định danh:', text);
  });
}

// Open Certificate Viewer Modal (PUC / VietGAP)
function openCertificateModal(certType) {
  if (!currentPlantData) {
    alert('Dữ liệu chứng thư chưa được nạp xong. Vui lòng thử lại sau giây lát.');
    return;
  }

  const p = currentPlantData;
  const pucCode = p.puc_code || 'VN-ĐN-OR-0017';
  const vietgapNumber = p.vietgap_cert_number || 'VG-2024-8892';
  const vietgapOrg = p.vietgap_cert_org || 'Trung tâm Giám định & Chứng nhận Nông nghiệp (AgriCert)';
  const certStandard = p.vietgap_cert_number ? `VietGAP ${esc(p.vietgap_cert_number)}` : 'VietGAP Trồng Trọt (TCVN 11892-1:2017)';
  const farmerOwnerName = p.owner_name || p.farm_name || 'Nông hộ Tân Bảo Agtech';
  const farmerOwnerPhone = p.owner_phone || '0908.048.895';
  const farmAddress = p.farm_address || 'Vùng chuyên canh nông sản Tân Bảo';
  const traceCode = `TB-TRC-${p.farm_id || '00'}-${esc(p.tree_code || p.id)}`;
  const isPuc = certType === 'puc';
  const plantLat = parseFloat(p.latitude);
  const plantLng = parseFloat(p.longitude);
  const hasCoords = !isNaN(plantLat) && !isNaN(plantLng);

  const container = document.getElementById('cert-modal-dynamic-content');
  if (!container) return;

  container.innerHTML = `
    <div class="cert-sheet">
      <!-- Certificate Header -->
      <div class="cert-header">
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:6px;">
          <img src="/assets/logo.png" alt="Tanbao AgTech" style="height:32px; width:auto;">
        </div>
        <div class="cert-governing-body">
          ${isPuc ? 'BỘ NÔNG NGHIỆP & PHÁT TRIỂN NÔNG THÔN — CỤC TRỒNG TRỌT &amp; BVTV' : 'HỆ THỐNG KIỂM ĐỊNH NÔNG NGHIỆP SẠCH VIỆT NAM (AGRICERT)'}
        </div>
        <div class="cert-sub-body">
          ${isPuc ? 'Cơ Sở Dữ Liệu Định Danh Vùng Trồng Xuất Khẩu Quốc Gia (PUC Standard)' : 'Chứng Nhận Thực Hành Sản Xuất Nông Nghiệp Tốt (VietGAP / GlobalG.A.P.)'}
        </div>
        <div class="cert-main-title">
          ${isPuc ? 'GIẤY XÁC NHẬN MÃ SỐ VÙNG TRỒNG (PUC)' : 'CHỨNG THƯ NÔNG NGHIỆP CHUẨN VIETGAP'}
        </div>
        <div class="cert-subtitle">
          Chứng thư xác thực điện tử bất biến được cấp bởi hệ thống Sổ Nông Số Hóa TANBAO AgTech
        </div>
      </div>

      <!-- Certificate Table Specifications -->
      <table class="cert-table">
        <tbody>
          <tr>
            <td class="cert-col-lbl">${isPuc ? 'Mã Số Vùng Trồng (PUC):' : 'Số Hiệu Chứng Nhận VietGAP:'}</td>
            <td class="cert-col-val" style="font-family:var(--font-mono); font-size:14px; color:${isPuc ? '#059669' : '#d97706'}; font-weight:800;">
              ${isPuc ? esc(pucCode) : esc(vietgapNumber)}
            </td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Đối Tượng Cây Trồng:</td>
            <td class="cert-col-val"><strong>${esc(p.plant_type)}</strong> (${esc(p.plant_variety || 'Tiêu chuẩn thuần chủng')})</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Trang Trại / Cơ Sở Sản Xuất:</td>
            <td class="cert-col-val">${esc(p.farm_name || 'Trang trại Tân Bảo AgTech')}</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Nông Hộ Quản Lý:</td>
            <td class="cert-col-val">${esc(farmerOwnerName)} &nbsp;•&nbsp; SĐT: ${esc(farmerOwnerPhone)}</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Địa Chỉ Vùng Trồng:</td>
            <td class="cert-col-val">${esc(farmAddress)}</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Tọa Độ GIS Vệ Tinh:</td>
            <td class="cert-col-val" style="font-family:var(--font-mono); font-size:11.5px;">
              ${hasCoords ? `${plantLat.toFixed(5)}, ${plantLng.toFixed(5)}` : 'Đã định vị vùng trang trại'}
            </td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Mã Định Danh Cây (Trace ID):</td>
            <td class="cert-col-val" style="font-family:var(--font-mono); font-size:11.5px; color:#059669;">${traceCode}</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Tổ Chức Giám Định &amp; Cấp Mã:</td>
            <td class="cert-col-val">${esc(vietgapOrg)}</td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Tiêu Chuẩn Áp Dụng:</td>
            <td class="cert-col-val"><span style="color:#047857; font-weight:800;">${esc(certStandard)}</span></td>
          </tr>
          <tr>
            <td class="cert-col-lbl">Tình Trạng Hiệu Lực:</td>
            <td class="cert-col-val">
              <span style="background:#ecfdf5; color:#047857; font-weight:800; padding:2px 8px; border-radius:100px; border:1px solid #86efac; font-size:11px;">
                ✓ ĐANG HIỆU LỰC &amp; ĐỦ ĐIỀU KIỆN XUẤT KHẨU
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Certificate Footer with Official Red Seal Stamp -->
      <div class="cert-footer-row">
        <div style="font-size:11px; color:#64748b; line-height:1.5;">
          <div><strong>CHỨNG THỰC BẢO BẢO TOÀN VẸN SỐ</strong></div>
          <div style="font-family:var(--font-mono); font-size:10px; color:#059669; margin-top:2px;">SHA256: ${esc(p.nfc_uid || pucCode)}-VERIFIED-SECURE</div>
          <div style="margin-top:4px;">Tra cứu trực tuyến tại: <a href="/" target="_blank" style="color:#0284c7; text-decoration:underline;">plant-book.tanbaocorp-agritech.vn</a></div>
        </div>

        <div class="cert-seal-stamp">
          <div style="font-size:7.5px; font-weight:700;">★ TANBAO AGTECH ★</div>
          <div style="font-size:10px; font-weight:900; margin:2px 0;">${isPuc ? 'PUC VERIFIED' : 'VIETGAP'}</div>
          <div style="font-size:7px; font-weight:700;">ĐÃ KIỂM ĐỊNH</div>
        </div>
      </div>

      <!-- Action Buttons inside modal -->
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; padding-top:14px; border-top:1px solid #e2e8f0;">
        <button type="button" onclick="closeCertificateModal()" style="padding:8px 16px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer;">
          Đóng
        </button>
        <button type="button" onclick="window.print()" style="padding:8px 16px; background:#059669; border:none; border-radius:8px; font-size:12.5px; font-weight:700; color:#ffffff; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <i data-lucide="printer" class="lucide-xs"></i> In Chứng Thư Số
        </button>
      </div>
    </div>
  `;

  const modal = document.getElementById('cert-viewer-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  }
}

function closeCertificateModal() {
  const modal = document.getElementById('cert-viewer-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Render Media Items Helper for Extended Info Tab
window.renderMediaItemsHtml = function(list) {
  if (!list || list.length === 0) {
    return `
      <div style="grid-column: 1 / -1; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 32px 20px; text-align: center; color: #64748b; font-size: 13px;">
        <i data-lucide="image-off" class="lucide-sm" style="color: #94a3b8; font-size: 24px; margin-bottom: 6px;"></i>
        <div>Chưa có tư liệu hình ảnh hoặc video trong danh mục này.</div>
      </div>
    `;
  }

  return list.map(m => {
    const isVideo = m.type === 'video' || (m.url && m.url.match(/\.(mp4|webm|ogg|mov)$/i));
    let badgeClass = 'growth';
    let badgeText = 'Ảnh sinh trưởng';
    let badgeIcon = 'sprout';

    if (m.category === 'disease' || /bệnh/i.test(m.caption || '')) {
      badgeClass = 'disease';
      badgeText = 'Ảnh bệnh cây';
      badgeIcon = 'shield-alert';
    } else if (isVideo) {
      badgeClass = 'video';
      badgeText = 'Video thực địa';
      badgeIcon = 'video';
    }

    const dateStr = fmtDate(m.date);

    return `
      <div class="media-card-item" onclick="openLightbox('${esc(m.url)}', '${isVideo ? 'video' : 'image'}')">
        <div class="media-card-thumb-wrap">
          ${isVideo 
            ? `<video src="${esc(m.url)}" muted preload="metadata"></video><div class="media-card-play-icon"><i data-lucide="play" class="lucide-sm" style="fill:currentColor; margin-left:2px;"></i></div>`
            : `<img src="${esc(m.url)}" alt="${esc(m.caption || '')}" loading="lazy" onerror="this.src='/assets/logo.png'">`
          }
          <div class="media-card-badge ${badgeClass}">
            <i data-lucide="${badgeIcon}" class="lucide-xs"></i>
            <span>${badgeText}</span>
          </div>
        </div>
        <div class="media-card-info">
          <div class="media-card-caption" title="${esc(m.caption || '')}">${esc(m.caption || 'Minh chứng thực địa')}</div>
          <div class="media-card-date">
            <i data-lucide="calendar" class="lucide-xs"></i>
            <span>${dateStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.filterPublicMedia = function(category, btnEl) {
  document.querySelectorAll('.media-filter-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const container = document.getElementById('public-media-cards-container');
  if (!container) return;

  const all = window._allPublicMedia || [];
  let filtered = all;

  if (category === 'growth') {
    filtered = all.filter(m => m.category === 'growth' && m.type !== 'video');
  } else if (category === 'disease') {
    filtered = all.filter(m => m.category === 'disease' && m.type !== 'video');
  } else if (category === 'video') {
    filtered = all.filter(m => m.type === 'video' || m.category === 'video');
  }

  container.innerHTML = window.renderMediaItemsHtml(filtered);
  if (window.lucide) window.lucide.createIcons();
};

window.copyPassportText = copyPassportText;
window.openCertificateModal = openCertificateModal;
window.closeCertificateModal = closeCertificateModal;
window.generateExportReport = generateExportReport;
window.exportPublicLogsCsv = exportPublicLogsCsv;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.toggleAllExportCategories = toggleAllExportCategories;


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
            btnContour.innerHTML = '<i data-lucide="mountain-snow" style="width:14px; height:14px;"></i>';

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
            btnExportA4.innerHTML = '<i data-lucide="ruler" style="width:14px; height:14px;"></i>';

            btnExportA4.onclick = () => {
              openPublicFarmA4ExportModal(m);
            };

            this._container.appendChild(btnContour);
            this._container.appendChild(btnExportA4);
            if (window.lucide) {
              setTimeout(() => window.lucide.createIcons({ root: this._container }), 10);
            }
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
          display: flex; align-items: center; gap: 4px;
        ">
          <i data-lucide="x" class="lucide-xs"></i> Đóng
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
              <span style="font-size:9px; color:#15803d; font-weight:700; display:flex; align-items:center; gap:3px;">
                <i data-lucide="layers" class="lucide-xs"></i> Nét vẽ CAD
              </span>
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


// ── Export Multi-Language (i18n: VI | EN | ZH) Live Dossier Adapter ──────────
(function initPublicExportI18nAdapter() {
  function ensureHeaderLanguageSwitcher() {
    const slot = document.getElementById('erp-header-actions-slot');
    if (!slot) return;
    if (!document.getElementById('export-lang-switcher')) {
      const curLang = (window.PlantBookI18n && window.PlantBookI18n.getLanguage()) || 'vi';
      const wrap = document.createElement('div');
      wrap.id = 'export-lang-switcher';
      wrap.style.cssText = 'display:inline-flex; align-items:center; gap:2px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:9px; padding:2px; margin-right:4px;';
      wrap.innerHTML = `
        <button type="button" data-lang-btn="vi" onclick="window.switchExportLanguage('vi')" style="border:none; border-radius:7px; padding:4px 7px; font-size:11px; font-weight:${curLang === 'vi' ? '800' : '700'}; cursor:pointer; background:${curLang === 'vi' ? '#059669' : 'transparent'}; color:${curLang === 'vi' ? '#ffffff' : '#334155'};">🇻🇳 VI</button>
        <button type="button" data-lang-btn="en" onclick="window.switchExportLanguage('en')" style="border:none; border-radius:7px; padding:4px 7px; font-size:11px; font-weight:${curLang === 'en' ? '800' : '700'}; cursor:pointer; background:${curLang === 'en' ? '#059669' : 'transparent'}; color:${curLang === 'en' ? '#ffffff' : '#334155'};">🇬🇧 EN</button>
        <button type="button" data-lang-btn="zh" onclick="window.switchExportLanguage('zh')" style="border:none; border-radius:7px; padding:4px 7px; font-size:11px; font-weight:${curLang === 'zh' ? '800' : '700'}; cursor:pointer; background:${curLang === 'zh' ? '#059669' : 'transparent'}; color:${curLang === 'zh' ? '#ffffff' : '#334155'};">🇨🇳 中文</button>
      `;
      slot.insertBefore(wrap, slot.firstChild);
    }
  }

  window.addEventListener('pb:languageChanged', function() {
    ensureHeaderLanguageSwitcher();
    if (window.PlantBookI18n && typeof window.PlantBookI18n.applyDomTranslations === 'function') {
      window.PlantBookI18n.applyDomTranslations();
    }
  });

  setInterval(ensureHeaderLanguageSwitcher, 1200);
})();

