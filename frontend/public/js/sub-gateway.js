/* Plant Book AgTech (c) 2026 TBSG AgTech. All Rights Reserved.
   modules/sub-gateway.js — Master Controller for Smart NFC Gateway (/sub)
   ======================================================================== */

import { SubGpsEngine } from './sub-gps-engine.js';
import { SubNfcBridge } from './sub-nfc-bridge.js';

class SubGatewayApp {
  constructor() {
    this.nfcBridge = new SubNfcBridge();
    this.gpsEngine = null;
    this.state = {
      token: localStorage.getItem('token') || null,
      user: JSON.parse(localStorage.getItem('user') || 'null'),
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

  init() {
    this.bindEvents();
    this.detectNfcSupport();

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

    // If user already logged in with valid token, prepare farm data
    if (this.state.token && this.state.user) {
      this.loadUserFarms().then(() => {
        // Ready for user
      });
    }

    this.showView('view-landing');
    this.renderIcons();
  }

  detectNfcSupport() {
    const badge = document.getElementById('nfc-detector-badge');
    if (!badge) return;
    if (this.nfcBridge.isSupported()) {
      badge.innerHTML = `<span class="pulse-dot"></span> Web NFC Sẵn Sàng (Chạm thẻ để nạp)`;
      badge.className = 'nfc-badge-pill';
    } else {
      badge.innerHTML = `<span class="pulse-dot warning"></span> Chế độ QR Code & Nhập thủ công (Không có Web NFC)`;
      badge.className = 'nfc-badge-pill warning';
    }
  }

  showView(viewId) {
    document.querySelectorAll('.view-step').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    toast.style.background = type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '700';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'all 0.3s';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  bindEvents() {
    // 1. Landing View Options
    document.getElementById('btn-opt-existing')?.addEventListener('click', () => {
      if (this.state.token && this.state.user) {
        this.loadUserFarms().then(() => this.showView('view-farm-hub'));
      } else {
        this.showView('view-login');
      }
    });

    document.getElementById('btn-opt-new')?.addEventListener('click', () => {
      this.showView('view-register');
      this.autoCaptureFarmGps();
    });

    // Back buttons
    document.querySelectorAll('.btn-back-landing').forEach(btn => {
      btn.addEventListener('click', () => this.showView('view-landing'));
    });
    document.getElementById('btn-back-farm-hub')?.addEventListener('click', () => {
      this.showView('view-farm-hub');
    });

    // 2. Login Form
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    // Switch to register from login
    document.getElementById('btn-switch-register')?.addEventListener('click', () => {
      this.showView('view-register');
      this.autoCaptureFarmGps();
    });

    // 3. Register & Farm Setup Form
    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRegisterAndFarmSetup();
    });

    // Capture farm GPS button
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

    // 5. GPS Engine Lock Button
    document.getElementById('btn-lock-gps')?.addEventListener('click', () => {
      if (this.gpsEngine) {
        const locked = this.gpsEngine.lock();
        this.state.gpsLocked = locked;
        this.showToast(`Đã khóa tọa độ GPS! (Sai số: ±${locked.accuracy}m)`, 'success');
        document.getElementById('badge-gps-status').className = 'gps-accuracy-badge acc-excellent';
        document.getElementById('badge-gps-status').innerText = `ĐÃ KHÓA (±${locked.accuracy}m)`;
      }
    });

    // 6. Plant Form Submit
    document.getElementById('form-plant-detail')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSavePlant();
    });

    // 7. NFC Write Action
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      this.showToast('Đăng nhập thành công!', 'success');
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
        if (txt) txt.innerText = `Tọa độ: ${lat}, ${lng} ${acc}`;
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      this.showToast('Khởi tạo tài khoản & Nông trại thành công!', 'success');
      await this.loadUserFarms();

      // Go directly to single plant registration
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
      if (select) {
        select.innerHTML = this.state.farms.map(f => 
          `<option value="${f.id}" ${f.id === this.state.selectedFarmId ? 'selected' : ''}>${f.name} (Lô: ${f.puc_code || f.id})</option>`
        ).join('');
      }

      if (this.state.farms.length > 0 && !this.state.selectedFarmId) {
        this.state.selectedFarmId = this.state.farms[0].id;
      }

      if (this.state.selectedFarmId) {
        await this.loadFarmPlantsList(this.state.selectedFarmId);
      }
    } catch (_) {}
  }

  async loadFarmPlantsList(farmId) {
    const listEl = document.getElementById('list-existing-plants');
    if (!listEl || !this.state.token) return;

    try {
      listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#9ca3af;">Đang tải danh sách cây...</div>';
      const res = await fetch(`/api/plants?farm_id=${farmId}`, {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      if (!res.ok) return;
      const plants = await res.json();
      const plantArray = Array.isArray(plants) ? plants : (plants.data || []);

      if (plantArray.length === 0) {
        listEl.innerHTML = '<div style="padding:14px; text-align:center; color:#9ca3af;">Chưa có cây nào trong vườn này. Hãy bấm "+ Khai báo cây mới".</div>';
        return;
      }

      listEl.innerHTML = plantArray.map(p => `
        <div class="tree-select-item" data-id="${p.id}" data-code="${p.tree_code || p.id}">
          <div>
            <strong style="color:#34d399;">#${p.tree_code || p.id}</strong> · ${p.plant_variety || p.plant_type || 'Cây'}
            <div style="font-size:11px; color:#9ca3af;">Lô ${p.plot_code || 'A1'} · Hàng ${p.row_number || 1} · ${p.nfc_uid ? `NFC: ${p.nfc_uid}` : 'Chưa gắn thẻ'}</div>
          </div>
          <button class="btn btn-sm btn-outline-green btn-bind-existing-tree" data-id="${p.id}">Chọn Gán Thẻ</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-bind-existing-tree').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const plantId = parseInt(e.target.dataset.id);
          const found = plantArray.find(x => x.id === plantId);
          if (found) {
            this.prepareExistingPlantBind(found);
          }
        });
      });
    } catch (_) {}
  }

  prepareNewPlantForm() {
    this.state.selectedPlant = null;
    const codeEl = document.getElementById('input-tree-code');
    if (codeEl) codeEl.value = '';
    const tagEl = document.getElementById('input-tag-uid');
    if (tagEl && this.state.tagUid) tagEl.value = this.state.tagUid;
    document.getElementById('plant-form-title').innerText = 'Khai Báo Cây Trồng Chi Tiết';
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

    this.gpsEngine = new SubGpsEngine({
      targetAccuracy: 1.0,
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
    const plantType = document.getElementById('input-plant-type')?.value.trim();
    const plantingDate = document.getElementById('input-planting-date')?.value;
    const plantAge = document.getElementById('input-plant-age')?.value.trim();
    const plotCode = document.getElementById('input-plot-code')?.value.trim();
    const rowNumber = document.getElementById('input-row-number')?.value;
    const tagUid = document.getElementById('input-tag-uid')?.value.trim() || this.state.tagUid;
    const initialYield = document.getElementById('input-initial-yield')?.value;
    const health = document.getElementById('input-health-status')?.value;

    const lat = this.state.gpsLocked ? this.state.gpsLocked.latitude : null;
    const lng = this.state.gpsLocked ? this.state.gpsLocked.longitude : null;
    const acc = this.state.gpsLocked ? this.state.gpsLocked.accuracy : null;

    try {
      const btn = document.getElementById('btn-submit-plant');
      if (btn) btn.innerText = 'Đang lưu cây...';

      const payload = {
        farm_id: this.state.selectedFarmId,
        tree_code: treeCode || null,
        plant_variety: variety || 'Sầu riêng Ri6',
        plant_type: plantType || 'Sầu riêng',
        planting_date: plantingDate || null,
        plant_age: plantAge || null,
        plot_code: plotCode || 'A1',
        row_number: rowNumber ? parseInt(rowNumber) : 1,
        latitude: lat,
        longitude: lng,
        gps_accuracy: acc,
        nfc_uid: tagUid || null,
        initial_yield: initialYield ? parseFloat(initialYield) : 0,
        health_status: health || 'Tốt'
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

      this.showToast('🎉 ĐÃ NẠP HỒ SƠ VÀO THẺ THÀNH CÔNG 100%!', 'success');
      if (btn) btn.innerText = '✅ Đã Nạp Thẻ Thành Công';

      // Open Success Banner
      document.getElementById('nfc-write-success-card').style.display = 'block';
    } catch (err) {
      this.showToast('Lỗi khi ghi thẻ: ' + err.message, 'error');
      if (btn) btn.innerText = 'Thử Lại Chạm Thẻ';
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.SubGateway = new SubGatewayApp();
});
