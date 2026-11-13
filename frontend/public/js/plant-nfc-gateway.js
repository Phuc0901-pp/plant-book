// Modular Public Plant NTAG213 Field Binding, Web NFC Direct Write & Smart Farm Gateway
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

  if (titleEl) titleEl.textContent = 'ĐANG CHỜ CHẠM THẺ NFC...';
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

  const section = document.getElementById('gateway-supplies-section');
  if (section) section.style.display = 'none';

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
  const isAuthorized = user && userHasFarmAccess(user, farmId, farm);

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
  window.pendingBindingFarm = { 
    farmId, 
    farmName: farm.name, 
    pucCode: farm.puc_code, 
    nfcUid: null, 
    farmOwnerUserId: farm.user_id, 
    userId: farm.user_id 
  };
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
    
    showPublicToast('Hãy chạm mặt sau điện thoại vào thẻ NFC trên cây ngay...', 'info');
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
  showPublicToast(`Đã phát hiện thẻ NFC: ${cleanUid}`, 'success');

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
    const isAuthorized = user && userHasFarmAccess(user, farmId, data);

    if (isAuthorized) {
      document.getElementById('farm-gateway-view').style.display = 'none';
      initFieldBindingModule(farmId, data.farm_name, data.puc_code, cleanUid, data.in_inventory, data.inventory_warning);
    } else {
      if (data.in_inventory === false) {
        showPublicToast(data.inventory_warning || `Thẻ NFC [${cleanUid}] chưa được nhập kho trang trại.`, 'warning');
      }
      // Prompt staff login
      const promptMsg = data.in_inventory === false
        ? `[Cảnh báo] Đã nhận diện thẻ NFC [${cleanUid}] (CHƯA NHẬP KHO)!\n\nNếu bạn là Quản trị viên / Kỹ thuật viên, bạn có muốn Đăng nhập để kiểm tra không?`
        : `[Định danh] Đã nhận diện thẻ NFC [${cleanUid}] hợp lệ (chưa gán cây)!\n\nNếu bạn là Kỹ thuật viên / Chủ vườn, bạn có muốn Đăng nhập ngay để gán thẻ này vào cây và lưu GPS không?`;

      if (confirm(promptMsg)) {
        window.pendingBindingFarm = { 
          farmId, 
          farmName: data.farm_name, 
          pucCode: data.puc_code, 
          nfcUid: cleanUid, 
          inInventory: data.in_inventory, 
          inventoryWarning: data.inventory_warning,
          farmOwnerUserId: data.farm_user_id || data.farm_owner_user_id || data.user_id,
          userId: data.farm_user_id || data.farm_owner_user_id || data.user_id
        };
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
    const isAuthorized = user && userHasFarmAccess(user, farmId);

    if (isAuthorized) {
      showPublicToast(`Cây #${treeCode} chưa có thẻ. Hãy chạm thẻ NFC vào máy để gán.`, 'nfc');
      triggerGatewayWebNfc();
    } else {
      showPublicToast(`Cây #${treeCode} hiện chưa được gắn thẻ NFC thực địa.`);
    }
  }
}

