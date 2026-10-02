/* Plant Book AgTech (c) 2026 TBSG AgTech. All Rights Reserved.
   modules/sub-gateway.js — Master Controller for Smart NFC Gateway (/sub)
   ======================================================================== */

import { SubGpsEngine } from './sub-gps-engine.js';
import { SubNfcBridge } from './sub-nfc-bridge.js';

class SubGatewayApp {
  constructor() {
    this.nfcBridge = new SubNfcBridge();
    this.gpsEngine = null;
    this.selectedDiseases = new Set();
    this.capturedPhotoBase64 = null;
    this.state = {
      token: localStorage.getItem('token') || null,
      user: JSON.parse(localStorage.getItem('user') || 'null'),
      encryptedUserId: null,
      currentStep: 1,
      farms: [],
      selectedFarmId: null,
      tagUid: this.getQueryParam('tag_uid') || '',
      selectedPlant: null,
      createdPlant: null,
      gpsLocked: null
    };

    this.init();
  }

  getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || '';
  }

  parseEncryptedUserIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/sub\/(usr_[a-f0-9]+_[a-f0-9]+_[a-f0-9]+)/i);
    if (match) return match[1];
    const qToken = this.getQueryParam('enc_id') || this.getQueryParam('user_token');
    if (qToken && qToken.startsWith('usr_')) return qToken;
    return null;
  }

  updateEncryptedUrl(encId) {
    const token = encId || (this.state.user && this.state.user.encrypted_user_id) || this.state.encryptedUserId;
    if (token) {
      this.state.encryptedUserId = token;
      const targetUrl = `/sub/${token}/set_up`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ encrypted_user_id: token }, '', targetUrl);
      }
    }
  }

  syncStepper(stepNumber) {
    this.state.currentStep = stepNumber;
    for (let i = 1; i <= 4; i++) {
      const node = document.getElementById(`step-node-${i}`);
      const line = document.getElementById(`step-line-${i}`);
      if (!node) continue;
      const circle = node.querySelector('.step-circle');
      if (i < stepNumber) {
        node.classList.remove('active');
        node.classList.add('completed');
        if (circle) circle.innerHTML = '<i data-lucide="check" class="lucide-xs"></i>';
        if (line) line.classList.add('active');
      } else if (i === stepNumber) {
        node.classList.add('active');
        node.classList.remove('completed');
        if (circle) circle.innerText = `${i}`;
        if (line) line.classList.remove('active');
      } else {
        node.classList.remove('active', 'completed');
        if (circle) circle.innerText = `${i}`;
        if (line) line.classList.remove('active');
      }
    }
    this.renderIcons();
  }

  updateFarmSummaryBar() {
    const bar = document.getElementById('active-farm-summary-bar');
    if (!bar) return;
    if (!this.state.token || !this.state.user || this.state.currentStep === 1) {
      bar.style.display = 'none';
      return;
    }

    const currentFarm = (this.state.farms || []).find(f => f.id === this.state.selectedFarmId) || (this.state.farms && this.state.farms[0]);
    const farmName = currentFarm ? currentFarm.name : 'Trang trại của bạn';
    const pucCode = currentFarm && currentFarm.puc_code ? currentFarm.puc_code : `Lô #${this.state.selectedFarmId || 'A1'}`;
    const isAdmin = this.state.user && this.state.user.role === 'admin';
    const ownerName = currentFarm?.user_name || (this.state.user && (this.state.user.full_name || this.state.user.name)) || 'Chủ Vườn';
    const treeCount = (currentFarm && currentFarm.plant_count !== undefined) ? ` · Quy mô: ${currentFarm.plant_count} cây` : '';

    const nameEl = document.getElementById('summary-farm-name');
    const metaEl = document.getElementById('summary-farm-meta');
    if (nameEl) nameEl.innerText = farmName;
    if (metaEl) {
      if (isAdmin) {
        metaEl.innerText = `Quản trị hệ thống · Chủ: ${ownerName} · Mã PUC: ${pucCode}${treeCount}`;
      } else {
        metaEl.innerText = `Chủ vườn: ${ownerName} · Mã Lô: ${pucCode}${treeCount}`;
      }
    }
    bar.style.display = 'flex';
  }

  init() {
    this.bindEvents();
    this.detectNfcSupport();

    const urlEncId = this.parseEncryptedUserIdFromUrl();
    if (urlEncId) {
      this.state.encryptedUserId = urlEncId;
    }

    // Check if initial tag_uid passed in URL
    if (this.state.tagUid) {
      const tagEl = document.getElementById('input-tag-uid');
      if (tagEl) tagEl.value = this.state.tagUid;
    }

    // Auto-start NFC listening if supported
    if (this.nfcBridge.isSupported()) {
      this.nfcBridge.scanTag(
        (data) => {
          this.state.tagUid = data.cleanUid || data.serialNumber;
          const tagEl = document.getElementById('input-tag-uid');
          if (tagEl) tagEl.value = this.state.tagUid;
          this.showToast(`Đã nhận diện Thẻ NFC: [${this.state.tagUid}]`, 'success');
        },
        () => {}
      );
    }

    // If explicit URL with encrypted user id is opened (/sub/usr_.../set_up) and valid session exists:
    if (urlEncId && this.state.token && this.state.user) {
      this.updateEncryptedUrl(urlEncId);
      this.loadUserFarms().then(() => {
        this.showView('view-farm-hub');
      });
    } else {
      // Default: always show landing page so user can choose action
      this.showView('view-landing');
    }

    this.renderIcons();
  }

  detectNfcSupport() {
    const badge = document.getElementById('nfc-detector-badge');
    if (!badge) return;
    if (this.nfcBridge.isSupported()) {
      badge.innerHTML = `<span class="pulse-dot"></span> <i data-lucide="radio" class="lucide-xs"></i> Web NFC Sẵn Sàng (Chạm thẻ để nạp)`;
      badge.className = 'nfc-badge-pill';
    } else {
      badge.innerHTML = `<span class="pulse-dot warning"></span> <i data-lucide="qr-code" class="lucide-xs"></i> Chế độ đường dẫn URL cấu hình công khai`;
      badge.className = 'nfc-badge-pill warning';
    }
    this.renderIcons();
  }

  showView(viewId) {
    document.querySelectorAll('.view-step').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (viewId === 'view-landing' || viewId === 'view-login' || viewId === 'view-register') {
        this.syncStepper(1);
      } else if (viewId === 'view-farm-hub') {
        this.syncStepper(2);
        this.updateEncryptedUrl();
      } else if (viewId === 'view-plant-form') {
        this.syncStepper(3);
        this.updateEncryptedUrl();
      } else if (viewId === 'view-nfc-write') {
        this.syncStepper(4);
        this.updateEncryptedUrl();
      }
      this.updateFarmSummaryBar();
      this.renderIcons();
    }
  }

  renderIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = type === 'error' ? 'rgba(220, 38, 38, 0.95)' : (type === 'warning' ? 'rgba(217, 119, 6, 0.95)' : (type === 'success' ? 'rgba(5, 150, 105, 0.95)' : 'rgba(15, 23, 42, 0.95)'));
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 22px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '13.5px';
    toast.style.fontWeight = '700';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
    toast.style.zIndex = '9999';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.backdropFilter = 'blur(8px)';
    toast.style.border = '1px solid rgba(255,255,255,0.2)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    else if (type === 'error') iconName = 'alert-octagon';
    else if (type === 'warning') iconName = 'alert-triangle';

    const cleanMsg = (msg || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    toast.innerHTML = `<i data-lucide="${iconName}" style="width:18px; height:18px; flex-shrink:0;"></i> <span>${cleanMsg}</span>`;

    document.body.appendChild(toast);
    this.renderIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /**
   * Calculate plant age from planting date string (DD/MM/YYYY or YYYY-MM-DD)
   */
  calculatePlantAge(dateStr) {
    if (!dateStr) return '';
    let plantingDate = null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        plantingDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    } else {
      plantingDate = new Date(dateStr);
    }
    if (!plantingDate || isNaN(plantingDate.getTime())) return '';

    const today = new Date();
    if (plantingDate > today) return 'Mới ươm (Chưa đến ngày trồng)';

    let years = today.getFullYear() - plantingDate.getFullYear();
    let months = today.getMonth() - plantingDate.getMonth();
    let days = today.getDate() - plantingDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (years === 0 && months === 0) {
      parts.push(`${days} ngày`);
    } else if (years === 0 && days > 0 && months < 3) {
      parts.push(`${days} ngày`);
    }

    return parts.join(' ') || '0 ngày';
  }

  bindEvents() {
    // 1. Landing View Options
    document.getElementById('btn-opt-existing')?.addEventListener('click', () => {
      this.showView('view-login');
    });

    document.getElementById('btn-opt-new')?.addEventListener('click', () => {
      this.showView('view-register');
      this.autoCaptureFarmGps();
    });

    // Quick Change Farm Button
    document.getElementById('btn-quick-change-farm')?.addEventListener('click', () => {
      this.showView('view-farm-hub');
    });

    // Stepper navigation click bindings
    document.getElementById('step-node-1')?.addEventListener('click', () => {
      if (!this.state.token) {
        this.showView('view-landing');
      } else {
        this.showToast('Tài khoản đang trong phiên làm việc.', 'info');
      }
    });

    document.getElementById('step-node-2')?.addEventListener('click', () => {
      if (this.state.token) {
        this.showView('view-farm-hub');
      } else {
        this.showToast('Vui lòng đăng nhập trước!', 'warning');
      }
    });

    document.getElementById('step-node-3')?.addEventListener('click', () => {
      if (this.state.selectedFarmId) {
        this.prepareNewPlantForm();
        this.showView('view-plant-form');
        this.startGpsEngine();
      } else {
        this.showToast('Vui lòng chọn trang trại trước!', 'warning');
      }
    });

    document.getElementById('step-node-4')?.addEventListener('click', () => {
      if (this.state.createdPlant) {
        this.showView('view-nfc-write');
      } else {
        this.showToast('Vui lòng hoàn tất lưu cây ở Bước 3 trước!', 'warning');
      }
    });

    // Back / Logout buttons
    document.querySelectorAll('.btn-back-landing').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.innerText.includes('Đăng xuất')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.state.token = null;
          this.state.user = null;
          this.state.farms = [];
          this.state.selectedFarmId = null;
          this.state.encryptedUserId = null;
          window.history.pushState({}, '', '/sub');
          this.showToast('Đã đăng xuất tài khoản.', 'info');
        }
        this.showView('view-landing');
      });
    });
    document.getElementById('btn-back-farm-hub')?.addEventListener('click', () => {
      this.showView('view-farm-hub');
    });

    // 2. Login Form
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    document.getElementById('btn-switch-register')?.addEventListener('click', () => {
      this.showView('view-register');
      this.autoCaptureFarmGps();
    });

    // 3. Register & Farm Setup Form
    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRegisterAndFarmSetup();
    });

    document.getElementById('btn-capture-farm-gps')?.addEventListener('click', () => {
      this.autoCaptureFarmGps();
    });

    // 4. Farm Hub Actions
    document.getElementById('select-farm-hub')?.addEventListener('change', (e) => {
      this.state.selectedFarmId = parseInt(e.target.value);
      this.loadFarmPlantsList(this.state.selectedFarmId);
    });

    document.getElementById('btn-action-new-plant')?.addEventListener('click', () => {
      if (!this.state.selectedFarmId) {
        this.showToast('Vui lòng chọn trang trại trước!', 'error');
        return;
      }
      this.prepareNewPlantForm();
      this.showView('view-plant-form');
      this.startGpsEngine();
    });

    document.getElementById('btn-action-existing-plant')?.addEventListener('click', () => {
      const listContainer = document.getElementById('wrap-existing-plants-list');
      if (listContainer) {
        listContainer.style.display = listContainer.style.display === 'none' ? 'block' : 'none';
      }
    });

    // 5. Auto Calculate Plant Age on Planting Date Change
    document.getElementById('input-planting-date')?.addEventListener('change', (e) => {
      const calculated = this.calculatePlantAge(e.target.value);
      const ageInput = document.getElementById('input-plant-age');
      if (ageInput && calculated) {
        ageInput.value = calculated;
      }
    });

    // 6. Interactive Disease Chips Toggle
    document.querySelectorAll('.disease-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const diseaseName = chip.dataset.disease;
        if (diseaseName === 'other') {
          const inp = document.getElementById('input-other-disease');
          if (inp) {
            const isShown = inp.style.display !== 'none';
            inp.style.display = isShown ? 'none' : 'block';
            chip.classList.toggle('active', !isShown);
            if (!isShown) inp.focus();
          }
          return;
        }

        if (diseaseName.includes('Chưa từng')) {
          // Healthy clicked: clear all others
          this.selectedDiseases.clear();
          document.querySelectorAll('.disease-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.selectedDiseases.add(diseaseName);
          const inp = document.getElementById('input-other-disease');
          if (inp) inp.style.display = 'none';
        } else {
          // Remove healthy chip if selecting a specific disease
          const healthyChip = document.querySelector('.disease-chip.healthy');
          if (healthyChip) {
            healthyChip.classList.remove('active');
            this.selectedDiseases.delete(healthyChip.dataset.disease);
          }

          if (this.selectedDiseases.has(diseaseName)) {
            this.selectedDiseases.delete(diseaseName);
            chip.classList.remove('active');
          } else {
            this.selectedDiseases.add(diseaseName);
            chip.classList.add('active');
          }
        }
      });
    });

    // 7. Photo Capture & Watermark
    const photoBox = document.getElementById('btn-trigger-photo');
    const photoInput = document.getElementById('input-plant-photo');
    photoBox?.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        photoInput?.click();
      }
    });

    photoInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.processPlantPhoto(file);
      }
    });

    // 8. GPS Engine Lock & Manual Toggle
    document.getElementById('btn-lock-gps')?.addEventListener('click', () => {
      const manualLat = document.getElementById('manual-lat-input')?.value.trim();
      const manualLng = document.getElementById('manual-lng-input')?.value.trim();

      if (manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng))) {
        if (this.gpsEngine) {
          const locked = this.gpsEngine.setManualCoord(manualLat, manualLng);
          this.state.gpsLocked = locked;
          this.showToast(`Đã khóa tọa độ thủ công: ${manualLat}, ${manualLng}`, 'success');
          document.getElementById('badge-gps-status').className = 'gps-accuracy-badge acc-excellent';
          document.getElementById('badge-gps-status').innerText = `ĐÃ KHÓA THỦ CÔNG (±1m)`;
          return;
        }
      }

      if (this.gpsEngine) {
        const locked = this.gpsEngine.lock();
        this.state.gpsLocked = locked;
        this.showToast(`Đã khóa tọa độ GPS! (Sai số: ±${locked.accuracy}m)`, 'success');
        document.getElementById('badge-gps-status').className = 'gps-accuracy-badge acc-excellent';
        document.getElementById('badge-gps-status').innerText = `ĐÃ KHÓA (±${locked.accuracy}m)`;
      }
    });

    document.getElementById('btn-toggle-manual-gps')?.addEventListener('click', () => {
      const wrap = document.getElementById('wrap-manual-gps');
      if (wrap) {
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
        if (isHidden && this.state.gpsLocked) {
          document.getElementById('manual-lat-input').value = this.state.gpsLocked.latitude.toFixed(6);
          document.getElementById('manual-lng-input').value = this.state.gpsLocked.longitude.toFixed(6);
        }
      }
    });

    // 9. Plant Form Submit
    document.getElementById('form-plant-detail')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSavePlant();
    });

    // 10. NFC Write Action
    document.getElementById('btn-write-nfc-tag')?.addEventListener('click', async () => {
      await this.handleWriteNfc();
    });

    document.getElementById('btn-copy-public-url')?.addEventListener('click', () => {
      const url = document.getElementById('text-public-plant-url')?.value;
      if (url) {
        navigator.clipboard.writeText(url);
        this.showToast('Đã sao chép đường dẫn hồ sơ!', 'success');
      }
    });
  }

  async processPlantPhoto(file) {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else { w = Math.round((w * maxDim) / h); h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          // Draw Watermark
          const nowStr = new Date().toLocaleString('vi-VN');
          const gpsStr = this.state.gpsLocked ? `GPS: ${this.state.gpsLocked.latitude.toFixed(6)}, ${this.state.gpsLocked.longitude.toFixed(6)}` : 'GPS: TBSG VIRTUAL FIELD';
          const watermarkText = `TBSG AGTECH · ${nowStr} · ${gpsStr}`;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(0, h - 36, w, 36);
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 14px monospace';
          ctx.fillText(watermarkText, 12, h - 14);

          this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);

          // Update Preview UI
          document.getElementById('photo-upload-placeholder').style.display = 'none';
          const previewWrap = document.getElementById('wrap-photo-preview');
          const previewImg = document.getElementById('img-photo-preview');
          const watermarkOverlay = document.getElementById('text-photo-watermark');
          if (previewWrap && previewImg) {
            previewWrap.style.display = 'block';
            previewImg.src = this.capturedPhotoBase64;
            if (watermarkOverlay) watermarkOverlay.innerText = watermarkText;
          }
          this.showToast('Đã tải và đóng dấu Watermark ảnh thực địa!', 'success');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      this.showToast('Lỗi xử lý ảnh: ' + err.message, 'error');
    }
  }

  // --- API CALLS ---

  async handleLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value.trim();
    if (!email || !password) {
      this.showToast('Vui lòng nhập đầy đủ thông tin!', 'error');
      return;
    }

    try {
      const btn = document.getElementById('btn-submit-login');
      if (btn) btn.innerText = 'Đang đăng nhập...';

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại.');

      this.state.token = data.token;
      this.state.user = data.user;
      const encId = data.encrypted_user_id || data.user?.encrypted_user_id;
      if (encId) {
        this.state.encryptedUserId = encId;
        this.updateEncryptedUrl(encId);
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user?.role === 'admin') {
        this.showToast(' Đăng nhập thành công với quyền QUẢN TRỊ VIÊN!', 'success');
      } else {
        this.showToast('Đăng nhập thành công!', 'success');
      }

      await this.loadUserFarms();
      this.showView('view-farm-hub');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      const btn = document.getElementById('btn-submit-login');
      if (btn) btn.innerText = 'Đăng Nhập';
    }
  }

  async autoCaptureFarmGps() {
    if (!('geolocation' in navigator)) return;
    const txt = document.getElementById('text-farm-gps-status');
    if (txt) txt.innerText = 'Đang lấy GPS vị trí vườn...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const acc = pos.coords.accuracy ? ` (±${Math.round(pos.coords.accuracy)}m)` : '';
        document.getElementById('reg-farm-lat').value = lat;
        document.getElementById('reg-farm-lng').value = lng;
        if (txt) txt.innerHTML = `<strong>Tọa độ:</strong> ${lat}, ${lng} <span style="color:#059669; font-weight:700;">${acc}</span>`;
      },
      (err) => {
        if (txt) txt.innerText = 'Không thể lấy GPS (Có thể nhập thủ công sau)';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async handleRegisterAndFarmSetup() {
    const fullName = document.getElementById('reg-fullname')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const password = document.getElementById('reg-password')?.value.trim();
    const farmName = document.getElementById('reg-farm-name')?.value.trim();
    const farmLat = document.getElementById('reg-farm-lat')?.value;
    const farmLng = document.getElementById('reg-farm-lng')?.value;

    if (!phone || !password) {
      this.showToast('Số điện thoại và mật khẩu là bắt buộc!', 'error');
      return;
    }

    try {
      const btn = document.getElementById('btn-submit-register');
      if (btn) btn.innerText = 'Đang thiết lập...';

      const res = await fetch('/api/auth/onboard-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          password,
          farm_name: farmName,
          farm_latitude: farmLat || null,
          farm_longitude: farmLng || null,
          source_tag_uid: this.state.tagUid
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại.');

      this.state.token = data.token;
      this.state.user = data.user;
      this.state.selectedFarmId = data.farm ? data.farm.id : data.user.farm_id;
      const encId = data.encrypted_user_id || data.user?.encrypted_user_id;
      if (encId) {
        this.state.encryptedUserId = encId;
        this.updateEncryptedUrl(encId);
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      this.showToast('Khởi tạo tài khoản & Nông trại thành công!', 'success');
      await this.loadUserFarms();

      this.prepareNewPlantForm();
      this.showView('view-plant-form');
      this.startGpsEngine();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      const btn = document.getElementById('btn-submit-register');
      if (btn) btn.innerText = 'Kích Hoạt Tài Khoản & Tạo Vườn';
    }
  }

  async loadUserFarms() {
    if (!this.state.token) return;
    try {
      const res = await fetch('/api/farms', {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      if (!res.ok) return;
      const farms = await res.json();
      this.state.farms = Array.isArray(farms) ? farms : [];

      const select = document.getElementById('select-farm-hub');
      const label = document.getElementById('label-farm-hub-select');
      const isAdmin = this.state.user && this.state.user.role === 'admin';

      if (label) {
        if (isAdmin) {
          label.innerHTML = `<i data-lucide="shield-check" class="lucide-xs"></i>  [QUẢN TRỊ VIÊN] Danh Sách Toàn Bộ Trang Trại (${this.state.farms.length} vườn)`;
        } else {
          label.innerHTML = `<i data-lucide="trees" class="lucide-xs"></i> Trang Trại Của Bạn (${this.state.farms.length} vườn)`;
        }
      }

      if (select) {
        if (this.state.farms.length === 0) {
          select.innerHTML = '<option value="">Không có trang trại nào</option>';
        } else {
          select.innerHTML = this.state.farms.map(f => {
            const owner = f.user_name || (f.user && f.user.full_name) || '';
            const ownerInfo = (isAdmin && owner) ? ` · Chủ: ${owner}` : '';
            const treeCount = f.plant_count !== undefined ? ` · ${f.plant_count} cây` : '';
            const puc = f.puc_code ? `Mã PUC: ${f.puc_code}` : `Lô #${f.id}`;
            return `<option value="${f.id}" ${f.id === this.state.selectedFarmId ? 'selected' : ''}>${f.name} (${puc}${ownerInfo}${treeCount})</option>`;
          }).join('');
        }
      }

      if (this.state.farms.length > 0 && !this.state.selectedFarmId) {
        this.state.selectedFarmId = this.state.farms[0].id;
      }

      if (this.state.selectedFarmId) {
        await this.loadFarmPlantsList(this.state.selectedFarmId);
        this.updateFarmSummaryBar();
      }
      this.renderIcons();
    } catch (_) {}
  }

  async loadFarmPlantsList(farmId) {
    const listEl = document.getElementById('list-existing-plants');
    if (!listEl || !this.state.token) return;

    try {
      listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#64748b;"><i data-lucide="loader-2" class="lucide-spin lucide-xs"></i> Đang tải danh sách cây trong trang trại...</div>';
      this.renderIcons();

      const res = await fetch(`/api/plants?farm_id=${farmId}`, {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      if (!res.ok) {
        listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#dc2626;">Không thể tải danh sách cây.</div>';
        return;
      }
      const plants = await res.json();
      const plantArray = Array.isArray(plants) ? plants : (plants.data || []);

      if (plantArray.length === 0) {
        listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#64748b;">Chưa có cây nào trong vườn này. Hãy bấm "+ Khai báo cây trồng mới".</div>';
        return;
      }

      listEl.innerHTML = plantArray.map(p => {
        const treeCode = p.tree_code || `#${p.id}`;
        const variety = p.plant_variety || p.plant_type || 'Cây trồng';
        const plot = p.plot_code || 'A1';
        const row = p.row_number || 1;
        const nfcBadge = p.nfc_uid 
          ? `<span style="display:inline-flex; align-items:center; gap:3px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;"><i data-lucide="radio" style="width:11px; height:11px;"></i> ${p.nfc_uid}</span>`
          : `<span style="background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:4px; font-size:11px;">Chưa gắn thẻ</span>`;
        const healthBadge = p.health_status === 'Kém' 
          ? `<span style="display:inline-flex; align-items:center; gap:3px; background:#fef2f2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;"><i data-lucide="alert-triangle" style="width:11px; height:11px;"></i> ${p.health_status}</span>`
          : `<span style="display:inline-flex; align-items:center; gap:3px; background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;"><i data-lucide="sprout" style="width:11px; height:11px;"></i> ${p.health_status || 'Tốt'}</span>`;

        return `
          <div class="tree-select-item" data-id="${p.id}" data-code="${treeCode}">
            <div>
              <strong style="color:#059669; font-size:14px;">${treeCode}</strong> 
              <span style="color:#0f172a; font-weight:700;">· ${variety}</span>
              <div style="font-size:12px; color:#475569; margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span>Lô ${plot} · Hàng ${row}</span>
                ${nfcBadge}
                ${healthBadge}
              </div>
            </div>
            <button class="btn btn-sm btn-outline-green btn-bind-existing-tree" data-id="${p.id}">
              <i data-lucide="link" class="lucide-xs"></i> Chọn Gán Thẻ
            </button>
          </div>
        `;
      }).join('');
      this.renderIcons();

      listEl.querySelectorAll('.btn-bind-existing-tree').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const plantId = parseInt(e.currentTarget.dataset.id);
          const found = plantArray.find(x => x.id === plantId);
          if (found) {
            this.prepareExistingPlantBind(found);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div style="padding:14px; text-align:center; color:#dc2626;">Lỗi tải danh sách cây: ${err.message}</div>`;
    }
  }

  prepareNewPlantForm() {
    this.state.selectedPlant = null;
    this.selectedDiseases.clear();
    this.capturedPhotoBase64 = null;
    document.querySelectorAll('.disease-chip').forEach(c => c.classList.remove('active'));

    const codeEl = document.getElementById('input-tree-code');
    if (codeEl) codeEl.value = '';
    const tagEl = document.getElementById('input-tag-uid');
    if (tagEl && this.state.tagUid) tagEl.value = this.state.tagUid;
    document.getElementById('plant-form-title').innerText = 'Khai Báo Cây Trồng Chi Tiết';

    // Auto-fill Passport defaults from current farm
    const currentFarm = (this.state.farms || []).find(f => f.id === this.state.selectedFarmId) || (this.state.farms && this.state.farms[0]);
    if (currentFarm) {
      const pucInput = document.getElementById('input-passport-puc');
      if (pucInput) pucInput.value = currentFarm.puc_code || 'VN-TB-PUC-001';

      const certNumInput = document.getElementById('input-passport-cert-number');
      if (certNumInput) certNumInput.value = currentFarm.vietgap_cert_number || 'VG-2026-TB-8899';

      const certOrgInput = document.getElementById('input-passport-cert-org');
      if (certOrgInput) certOrgInput.value = currentFarm.vietgap_cert_org || 'Trung tâm Giám định & Chứng nhận Nông nghiệp (AgriCert)';

      const seedInput = document.getElementById('input-passport-seed-origin');
      if (seedInput && !seedInput.value) seedInput.value = 'Viện Cây Ăn Quả Miền Nam (SOFRI) - F1';

      const batchInput = document.getElementById('input-passport-batch-code');
      if (batchInput) {
        const pucPrefix = currentFarm.puc_code || 'VN-TB';
        const year = new Date().getFullYear();
        batchInput.value = `${pucPrefix}-${year}-LOT-A1`;
      }
    }
    this.renderIcons();
  }

  prepareExistingPlantBind(plant) {
    this.state.selectedPlant = plant;
    const origin = window.location.origin;
    const nfcUid = this.state.tagUid || plant.nfc_uid || '';
    const publicUrl = `${origin}/${plant.farm_id}/${plant.id}${nfcUid ? `/${encodeURIComponent(nfcUid)}` : ''}`;

    this.state.createdPlant = {
      ...plant,
      public_url: publicUrl,
      nfc_uid: nfcUid
    };

    document.getElementById('text-public-plant-url').value = publicUrl;
    document.getElementById('link-view-public-profile').href = publicUrl;
    document.getElementById('write-tree-info-text').innerText = `Cây #${plant.tree_code || plant.id} (${plant.plant_variety || 'Cây trồng'})`;
    this.showView('view-nfc-write');
  }

  startGpsEngine() {
    if (this.gpsEngine) {
      this.gpsEngine.stop();
    }

    const badge = document.getElementById('badge-gps-status');
    const coordsText = document.getElementById('text-gps-live-coords');
    const guidance = document.getElementById('text-gps-guidance');

    this.gpsEngine = new SubGpsEngine({
      targetAccuracy: 2.0,
      onUpdate: (data) => {
        if (data.error) {
          if (badge) {
            badge.className = 'gps-accuracy-badge acc-poor';
            badge.innerText = 'LỖI GPS';
          }
          if (coordsText) coordsText.innerText = data.error;
          return;
        }

        if (badge) {
          badge.className = `gps-accuracy-badge acc-${data.quality}`;
          badge.innerText = `±${data.accuracy}m (${data.sampleCount} mẫu)`;
        }

        if (coordsText) {
          coordsText.innerText = `Lat: ${data.latitude.toFixed(6)} | Lng: ${data.longitude.toFixed(6)}`;
        }

        if (guidance && data.statusText) {
          guidance.innerHTML = `<i data-lucide="satellite" class="lucide-xs"></i> <strong>Trạng thái:</strong> ${data.statusText}`;
          this.renderIcons();
        }
      },
      onLock: (locked) => {
        this.state.gpsLocked = locked;
      }
    });

    this.gpsEngine.start();
  }

  async handleSavePlant() {
    if (!this.state.token) {
      this.showToast('Vui lòng đăng nhập trước!', 'error');
      return;
    }

    const treeCode = document.getElementById('input-tree-code')?.value.trim();
    const variety = document.getElementById('input-plant-variety')?.value.trim();
    const plantingDate = document.getElementById('input-planting-date')?.value;
    const plantAge = document.getElementById('input-plant-age')?.value.trim();
    const plotCode = document.getElementById('input-plot-code')?.value.trim();
    const rowNumber = document.getElementById('input-row-number')?.value;
    const tagUid = document.getElementById('input-tag-uid')?.value.trim() || this.state.tagUid;
    const initialYield = document.getElementById('input-initial-yield')?.value;
    const health = document.getElementById('input-health-status')?.value;
    const growthStage = document.getElementById('input-growth-stage')?.value;

    // Passport inputs
    const passportPuc = document.getElementById('input-passport-puc')?.value.trim();
    const passportStandard = document.getElementById('input-passport-standard')?.value;
    const passportCertNumber = document.getElementById('input-passport-cert-number')?.value.trim();
    const passportCertOrg = document.getElementById('input-passport-cert-org')?.value.trim();
    const passportSeedOrigin = document.getElementById('input-passport-seed-origin')?.value.trim();
    const passportBatchCode = document.getElementById('input-passport-batch-code')?.value.trim();

    // Past diseases list
    const pastDiseases = Array.from(this.selectedDiseases);
    const otherDiseaseInput = document.getElementById('input-other-disease')?.value.trim();
    if (otherDiseaseInput && !pastDiseases.includes(otherDiseaseInput)) {
      pastDiseases.push(otherDiseaseInput);
    }

    const manualLat = document.getElementById('manual-lat-input')?.value.trim();
    const manualLng = document.getElementById('manual-lng-input')?.value.trim();

    let lat = this.state.gpsLocked ? this.state.gpsLocked.latitude : null;
    let lng = this.state.gpsLocked ? this.state.gpsLocked.longitude : null;
    let acc = this.state.gpsLocked ? this.state.gpsLocked.accuracy : null;

    if (manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng))) {
      lat = parseFloat(manualLat);
      lng = parseFloat(manualLng);
      acc = 1.0;
    }

    try {
      const btn = document.getElementById('btn-submit-plant');
      if (btn) btn.innerText = 'Đang lưu cây...';

      const payload = {
        farm_id: this.state.selectedFarmId,
        tree_code: treeCode || null,
        plant_variety: variety || 'Sầu riêng Ri6',
        plant_type: variety || 'Sầu riêng',
        planting_date: plantingDate || null,
        plant_age: plantAge || null,
        plot_code: plotCode || 'A1',
        row_number: rowNumber ? parseInt(rowNumber) : 1,
        latitude: lat,
        longitude: lng,
        gps_accuracy: acc,
        nfc_uid: tagUid || null,
        initial_yield: initialYield ? parseFloat(initialYield) : 0,
        health_status: health || 'Tốt',
        initial_growth_stage: growthStage || 'Nuôi trái / Phát triển trái',
        photo_url: this.capturedPhotoBase64 || null,
        past_diseases: pastDiseases,
        puc_code: passportPuc || null,
        passport_standard: passportStandard || null,
        vietgap_cert_number: passportCertNumber || null,
        vietgap_cert_org: passportCertOrg || null,
        seed_origin: passportSeedOrigin || null,
        batch_code: passportBatchCode || null
      };

      const res = await fetch('/api/plants/single-provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu cây thất bại.');

      this.state.createdPlant = data;
      this.state.tagUid = data.nfc_uid || tagUid;

      const finalUrl = data.hierarchical_url || data.public_url;
      document.getElementById('text-public-plant-url').value = finalUrl;
      document.getElementById('link-view-public-profile').href = finalUrl;
      document.getElementById('write-tree-info-text').innerText = `Cây #${data.plant.tree_code || data.plant.id} (${data.plant.plant_variety || 'Cây'})`;

      this.showToast('Đã lưu cây! Hãy chạm thẻ để nạp hồ sơ.', 'success');
      this.showView('view-nfc-write');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      const btn = document.getElementById('btn-submit-plant');
      if (btn) btn.innerText = 'Lưu Cây & Chuẩn Bị Nạp Thẻ';
    }
  }

  async handleWriteNfc() {
    const url = document.getElementById('text-public-plant-url')?.value;
    if (!url) {
      this.showToast('Không tìm thấy đường dẫn hồ sơ!', 'error');
      return;
    }

    if (!this.nfcBridge.isSupported()) {
      this.showToast('Trình duyệt không hỗ trợ Web NFC. Bạn có thể sao chép URL hoặc quét QR!', 'error');
      return;
    }

    const btn = document.getElementById('btn-write-nfc-tag');
    try {
      if (btn) btn.innerText = 'Đang chờ chạm thẻ...';
      this.showToast('Áp lưng điện thoại vào thẻ NFC để ghi dữ liệu...', 'info');

      await this.nfcBridge.writeTagUrl(url);

      // Verify write to backend
      if (this.state.createdPlant && this.state.token) {
        const plantId = this.state.createdPlant.plant ? this.state.createdPlant.plant.id : this.state.createdPlant.id;
        fetch('/api/nfc/verify-write', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            plant_id: plantId,
            nfc_uid: this.state.tagUid,
            written_url: url
          })
        }).catch(() => {});
      }

      this.showToast('ĐÃ NẠP HỒ SƠ VÀO THẺ THÀNH CÔNG 100%!', 'success');
      if (btn) {
        btn.innerHTML = '<i data-lucide="check-circle" class="lucide-sm"></i> Đã Nạp Thẻ Thành Công';
        this.renderIcons();
      }

      document.getElementById('nfc-write-success-card').style.display = 'block';
      this.renderIcons();
    } catch (err) {
      this.showToast('Lỗi khi ghi thẻ: ' + err.message, 'error');
      if (btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw" class="lucide-sm"></i> Thử Lại Chạm Thẻ';
        this.renderIcons();
      }
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.SubGateway = new SubGatewayApp();
});
