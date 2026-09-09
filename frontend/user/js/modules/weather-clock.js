/**
 * modules/weather-clock.js - Live Digital Clock & Real-Time GPS Weather Widget (Open-Meteo API)
 * Enhanced with Local Storage Caching, Fault-Tolerant Climatology Fallback & 503 Error Resilience
 */

let _clockInterval = null;
let _currentCoords = null;
const CACHE_KEY = 'tanbao_cached_weather';

// WMO Weather Interpretation Codes (WW)
const WMO_WEATHER_MAP = {
  0: { label: 'Trời nắng trong xanh', icon: 'fa-solid fa-sun', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  1: { label: 'Trời quang, ít mây', icon: 'fa-solid fa-cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  2: { label: 'Mây rải rác', icon: 'fa-solid fa-cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  3: { label: 'Trời nhiều mây âm u', icon: 'fa-solid fa-cloud', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  45: { label: 'Sương mù sáng sớm', icon: 'fa-solid fa-smog', color: '#cbd5e1', bg: 'rgba(203,213,225,0.15)' },
  48: { label: 'Sương mù đọng sương', icon: 'fa-solid fa-smog', color: '#cbd5e1', bg: 'rgba(203,213,225,0.15)' },
  51: { label: 'Mưa phùn nhẹ', icon: 'fa-solid fa-cloud-rain', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  53: { label: 'Mưa phùn vừa', icon: 'fa-solid fa-cloud-rain', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  55: { label: 'Mưa phùn hạt nặng', icon: 'fa-solid fa-cloud-rain', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  61: { label: 'Mưa rào nhẹ', icon: 'fa-solid fa-cloud-showers-heavy', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  63: { label: 'Mưa rào vừa', icon: 'fa-solid fa-cloud-showers-heavy', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  65: { label: 'Mưa to nặng hạt', icon: 'fa-solid fa-cloud-showers-heavy', color: '#1d4ed8', bg: 'rgba(29,78,216,0.2)' },
  80: { label: 'Mưa rào thoáng qua', icon: 'fa-solid fa-cloud-sun-rain', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  81: { label: 'Mưa rào từng cơn', icon: 'fa-solid fa-cloud-showers-heavy', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  82: { label: 'Mưa rất to xối xả', icon: 'fa-solid fa-cloud-showers-water', color: '#1e40af', bg: 'rgba(30,64,175,0.25)' },
  95: { label: 'Mưa dông, sấm sét', icon: 'fa-solid fa-bolt-lightning', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)' },
  96: { label: 'Dông lốc kèm mưa đá nhẹ', icon: 'fa-solid fa-cloud-bolt', color: '#ea580c', bg: 'rgba(234,88,12,0.2)' },
  99: { label: 'Dông mạnh kèm mưa đá lớn', icon: 'fa-solid fa-cloud-bolt', color: '#dc2626', bg: 'rgba(220,38,38,0.25)' }
};

function _getWindDirection(deg) {
  if (deg === undefined || deg === null || isNaN(deg)) return 'Gió nhẹ';
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

function _saveCachedWeather(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...payload,
      timestamp: Date.now()
    }));
  } catch (_) {}
}

function _getCachedWeather() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function startLiveClock() {
  if (_clockInterval) clearInterval(_clockInterval);

  function update() {
    const now = new Date();
    
    // Time format HH:mm:ss
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timeEl = document.getElementById('live-clock-time');
    const secEl = document.getElementById('live-clock-seconds');
    if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
    if (secEl) secEl.textContent = `:${seconds}`;

    // Date format in Vietnamese
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const dateStr = `${dayName}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const dateEl = document.getElementById('live-clock-date');
    if (dateEl) dateEl.textContent = dateStr;
  }

  update();
  _clockInterval = setInterval(update, 1000);
}

function _renderWeatherUI(data, locationName, isRealGps, statusBadge = '') {
  const widgetBox = document.getElementById('weather-widget-content');
  if (!widgetBox) return;

  const {
    temp = 30,
    feelLike = 32,
    humidity = 75,
    windSpeed = 12,
    windDir = 'Đông',
    uv = '4.5',
    rainProb = 15,
    tempMax = 33,
    tempMin = 26,
    wmo = { label: 'Trời quang đãng', icon: 'fa-solid fa-sun', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
    agriTip = 'Thời tiết thuận lợi cho việc chăm sóc cây trồng và theo dõi độ ẩm đất.'
  } = data;

  widgetBox.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
      
      <!-- Left: Main Weather Condition & Temperature -->
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="width:64px; height:64px; border-radius:18px; background:${wmo.bg}; display:flex; align-items:center; justify-content:center; font-size:32px; color:${wmo.color}; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid rgba(255,255,255,0.2);">
          <i class="${wmo.icon}"></i>
        </div>
        <div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span id="weather-val-temp" style="font-size:36px; font-weight:900; line-height:1; letter-spacing:-1px;">${temp}°C</span>
            <span style="font-size:13px; color:rgba(255,255,255,0.85); font-weight:700;">(Cảm giác: <span id="weather-val-feel">${feelLike}</span>°C)</span>
          </div>
          <div style="font-size:14.5px; font-weight:800; color:#ffffff; margin-top:4px; display:flex; align-items:center; gap:6px;">
            <span>${wmo.label}</span>
            <span style="font-size:12px; color:rgba(255,255,255,0.75); font-weight:600;">• ${tempMin}° / ${tempMax}°C</span>
          </div>
        </div>
      </div>

      <!-- Right: Detailed Metrics Grid -->
      <div class="weather-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(105px, 1fr)); gap:8px; flex:1; max-width:540px; width:100%;">
        
        <div style="background:rgba(255,255,255,0.12); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 12px;">
          <div style="font-size:11px; color:rgba(255,255,255,0.75); font-weight:700; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-droplet" style="color:#38bdf8;"></i> Độ ẩm KK
          </div>
          <div id="weather-val-humidity" style="font-size:15px; font-weight:900; color:#ffffff; margin-top:2px;">${humidity}%</div>
        </div>

        <div style="background:rgba(255,255,255,0.12); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 12px;">
          <div style="font-size:11px; color:rgba(255,255,255,0.75); font-weight:700; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-wind" style="color:#7dd3fc;"></i> Gió & Hướng
          </div>
          <div style="font-size:13.5px; font-weight:900; color:#ffffff; margin-top:2px;"><span id="weather-val-wind">${windSpeed}</span> km/h <span style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.85);">${windDir}</span></div>
        </div>

        <div style="background:rgba(255,255,255,0.12); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 12px;">
          <div style="font-size:11px; color:rgba(255,255,255,0.75); font-weight:700; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-cloud-rain" style="color:#60a5fa;"></i> Khả năng mưa
          </div>
          <div id="weather-val-rain" style="font-size:15px; font-weight:900; color:#ffffff; margin-top:2px;">${rainProb}%</div>
        </div>

        <div style="background:rgba(255,255,255,0.12); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 12px;">
          <div style="font-size:11px; color:rgba(255,255,255,0.75); font-weight:700; display:flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-sun" style="color:#fbbf24;"></i> Chỉ số UV
          </div>
          <div style="font-size:15px; font-weight:900; color:#ffffff; margin-top:2px;"><span id="weather-val-uv">${uv}</span> <span style="font-size:11px; font-weight:700; color:${parseFloat(uv) > 6 ? '#fca5a5' : '#86efac'};">(${parseFloat(uv) > 6 ? 'Cao' : 'An toàn'})</span></div>
        </div>

      </div>

    </div>

    <!-- Location & Advice footer bar -->
    <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:12.5px;">
      <div style="display:flex; align-items:center; gap:6px; color:#ffffff; flex-wrap:wrap;">
        <i class="fa-solid fa-location-dot" style="color:#fb7185;"></i>
        <span style="font-weight:800;">${locationName}</span>
        ${isRealGps ? `<span style="background:rgba(16,185,129,0.3); color:#86efac; border:1px solid rgba(16,185,129,0.5); font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px;"><i class="fa-solid fa-satellite"></i> GPS Thiết bị</span>` : `<span style="background:rgba(16,185,129,0.25); color:#a7f3d0; border:1px solid rgba(16,185,129,0.4); font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px;"><i class="fa-solid fa-seedling"></i> Trang trại</span>`}
        ${statusBadge ? `<span style="background:rgba(255,255,255,0.15); color:#ffffff; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:12px;">${statusBadge}</span>` : ''}
      </div>

      <div style="color:rgba(255,255,255,0.9); font-weight:600; display:flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-seedling" style="color:#a7f3d0;"></i>
        <span>${agriTip}</span>
      </div>
    </div>
  `;

  // Trigger CountUp animations on weather numbers!
  if (typeof window.animateValue === 'function') {
    window.animateValue(document.getElementById('weather-val-temp'), 0, temp, 800, 0, '°C');
    window.animateValue(document.getElementById('weather-val-feel'), 0, feelLike, 800, 0);
    window.animateValue(document.getElementById('weather-val-humidity'), 0, humidity, 800, 0, '%');
    window.animateValue(document.getElementById('weather-val-wind'), 0, windSpeed, 800, 0);
    window.animateValue(document.getElementById('weather-val-rain'), 0, rainProb, 800, 0, '%');
    window.animateValue(document.getElementById('weather-val-uv'), 0, parseFloat(uv), 800, 1);
  }

  // Sync state to 3D Chibi Mascot
  if (typeof window.setMascotState === 'function') {
    if (rainProb >= 60) {
      window.setMascotState('rain');
    } else if (temp >= 34) {
      window.setMascotState('thirsty');
    }
  }
}

export async function refreshDeviceWeather() {
  const statusEl = document.getElementById('weather-status-text');
  const refreshBtn = document.getElementById('btn-refresh-weather');

  if (refreshBtn) refreshBtn.classList.add('fa-spin');
  if (statusEl) statusEl.textContent = 'Đang xác định vị trí trang trại...';

  // Step 1: Obtain registered farm coordinates or fallback
  const activeFarm = (typeof window.getActiveFarm === 'function' ? window.getActiveFarm() : null)
    || (window._allFarmsCache && window._allFarmsCache.length > 0 ? window._allFarmsCache[0] : null);

  let lat = null;
  let lng = null;
  let isRealGps = false;
  let farmDisplayName = '';

  if (activeFarm) {
    if (activeFarm.latitude && activeFarm.longitude) {
      lat = parseFloat(activeFarm.latitude);
      lng = parseFloat(activeFarm.longitude);
    } else if (activeFarm.polygon_coordinates) {
      try {
        const poly = typeof activeFarm.polygon_coordinates === 'string' 
          ? JSON.parse(activeFarm.polygon_coordinates) 
          : activeFarm.polygon_coordinates;
        if (Array.isArray(poly) && poly.length > 0) {
          const ring = Array.isArray(poly[0][0]) ? poly[0] : poly;
          let sumLat = 0, sumLng = 0;
          ring.forEach(pt => {
            sumLng += parseFloat(pt[0]);
            sumLat += parseFloat(pt[1]);
          });
          lat = sumLat / ring.length;
          lng = sumLng / ring.length;
        }
      } catch (_) {}
    }
    farmDisplayName = activeFarm.name ? `${activeFarm.name} (${activeFarm.address || 'Khu vực canh tác'})` : '';
  }

  // Try real-time device Geolocation
  try {
    if ('geolocation' in navigator) {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 60000
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      isRealGps = true;
    }
  } catch (err) {
    console.warn('[WeatherWidget] GPS position error or permission denied. Using registered Farm coordinates.', err.message);
  }

  // Fallback coordinates if still undefined
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    lat = 10.9415; // Default Long Khánh, Đồng Nai or Mekong Delta
    lng = 107.2418;
  }

  _currentCoords = { lat, lng, isRealGps };

  if (statusEl) statusEl.textContent = 'Đang tải dữ liệu khí tượng Open-Meteo...';

  // Step 2: Fetch Open-Meteo Real-Time Weather API with automatic resilient fallback
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(weatherUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const data = await res.json();

    // Step 3: Fetch Location Name (Reverse Geocode / Farm Name)
    let locationName = isRealGps 
      ? `GPS: ${lat.toFixed(3)}°, ${lng.toFixed(3)}°` 
      : (farmDisplayName || 'Trang trại Nông hộ');

    try {
      const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const district = geoData.locality || geoData.city || '';
        const province = geoData.principalSubdivision || '';
        const geoStr = [district, province].filter(Boolean).join(', ');
        if (geoStr) {
          if (isRealGps) {
            locationName = geoStr;
          } else if (activeFarm && activeFarm.name) {
            locationName = `${activeFarm.name} (${geoStr})`;
          } else {
            locationName = geoStr;
          }
        }
      }
    } catch (_) {}

    // Step 4: Parse Weather metrics
    const current = data.current || {};
    const daily = data.daily || {};

    const temp = Math.round(current.temperature_2m ?? 29);
    const feelLike = Math.round(current.apparent_temperature ?? temp);
    const humidity = Math.round(current.relative_humidity_2m ?? 75);
    const windSpeed = Math.round(current.wind_speed_10m ?? 12);
    const windDir = _getWindDirection(current.wind_direction_10m);
    const uv = current.uv_index !== undefined ? current.uv_index.toFixed(1) : '4.5';
    const rainProb = daily.precipitation_probability_max?.[0] !== undefined ? daily.precipitation_probability_max[0] : 15;
    const tempMax = daily.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : temp + 3;
    const tempMin = daily.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : temp - 4;

    const weatherCode = current.weather_code ?? 0;
    const wmo = WMO_WEATHER_MAP[weatherCode] || { label: 'Trời quang đãng', icon: 'fa-solid fa-sun', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };

    let agriTip = 'Thời tiết thuận lợi cho việc chăm sóc cây trồng và theo dõi độ ẩm đất.';
    if (rainProb >= 60) {
      agriTip = '⚠️ Khả năng mưa cao: Cân nhắc hoãn phun thuốc BVTV và bón phân để tránh bị rửa trôi.';
    } else if (temp >= 34) {
      agriTip = '☀️ Nắng nóng gay gắt: Khuyến nghị tăng lượng tưới giữ ẩm đất và phun sương làm mát tán.';
    } else if (humidity >= 85) {
      agriTip = '💧 Độ ẩm không khí cao: Chú ý kiểm tra nấm bệnh và sâu rầy trên đọt non.';
    }

    const weatherPayload = {
      temp,
      feelLike,
      humidity,
      windSpeed,
      windDir,
      uv,
      rainProb,
      tempMax,
      tempMin,
      wmo,
      agriTip
    };

    // Save to Local Storage Cache
    _saveCachedWeather({ data: weatherPayload, locationName, isRealGps });

    // Render UI
    _renderWeatherUI(weatherPayload, locationName, isRealGps);

  } catch (err) {
    console.warn('[WeatherWidget] Open-Meteo API unreachable or returning 503/Timeout. Activating cache/fallback resilience.', err.message);
    
    // Check if we have cached weather
    const cached = _getCachedWeather();
    if (cached && cached.data) {
      const timeStr = new Date(cached.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      _renderWeatherUI(cached.data, cached.locationName || 'Vườn mẫu Tân Bảo', cached.isRealGps, `🕒 Lưu lúc ${timeStr}`);
    } else {
      // Climatology fallback
      const now = new Date();
      const hour = now.getHours();
      let estTemp = 29;
      if (hour >= 6 && hour <= 10) estTemp = 28;
      else if (hour > 10 && hour <= 15) estTemp = 32;
      else if (hour > 15 && hour <= 18) estTemp = 30;
      else estTemp = 26;

      const fallbackPayload = {
        temp: estTemp,
        feelLike: estTemp + 1,
        humidity: 78,
        windSpeed: 10,
        windDir: 'Đông',
        uv: '4.5',
        rainProb: 20,
        tempMax: estTemp + 3,
        tempMin: estTemp - 4,
        wmo: { label: 'Trời quang, ít mây', icon: 'fa-solid fa-cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
        agriTip: 'Thời tiết ổn định, thuận lợi cho các hoạt động canh tác nông nghiệp.'
      };

      _renderWeatherUI(fallbackPayload, isRealGps ? `GPS: ${lat.toFixed(3)}°, ${lng.toFixed(3)}°` : 'Vùng Nông nghiệp Trọng điểm (Bến Tre)', isRealGps, '🌤️ Dữ liệu dự phòng');
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('fa-spin');
    if (statusEl) statusEl.textContent = 'Thời tiết thực tế';
  }
}
window.refreshDeviceWeather = refreshDeviceWeather;

export function initWeatherClockWidget() {
  startLiveClock();
  refreshDeviceWeather();
}
window.initWeatherClockWidget = initWeatherClockWidget;
