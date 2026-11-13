/* Modular Farmer Portal IoT Soil Depth & Open-Meteo 24h Weather Module */
import { esc, toast } from '../core/utils.js';
import { api } from '../core/api.js';
import { getFarmsCache, getActiveFarmId } from './plants.js';

let _currentFarmIoTData = null;
let _selectedSoilDepth = '20cm';

export function selectSoilDepth(depth) {
  if (depth !== '10cm' && typeof window.isProUser === 'function' && !window.isProUser()) {
    if (typeof window.openProUpgradeModal === 'function') {
      window.openProUpgradeModal('soil_depth');
    } else {
      alert('🔒 Tầng đất 20cm & 30cm dành riêng cho Nông hộ PRO. Vui lòng nâng cấp tài khoản!');
    }
    return;
  }
  _selectedSoilDepth = depth;
  const depths = ['10cm', '20cm', '30cm'];
  depths.forEach(d => {
    const btn = document.getElementById(`soil-depth-btn-${d}`);
    if (btn) {
      if (d === depth) {
        btn.style.background = '#fef3c7';
        btn.style.color = '#78350f';
        btn.style.borderColor = '#d97706';
        btn.style.fontWeight = '800';
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = '#854d0e';
        btn.style.borderColor = '#fde68a';
        btn.style.fontWeight = '700';
      }
    }
  });

  if (_currentFarmIoTData && _currentFarmIoTData.soil_data) {
    const soil = _currentFarmIoTData.soil_data;
    const levelData = soil[`depth_${depth}`] || soil.depth_20cm || {};

    if (document.getElementById('iot-soil-moisture')) document.getElementById('iot-soil-moisture').textContent = `${levelData.moisture || 68} %`;
    if (document.getElementById('iot-soil-temp')) document.getElementById('iot-soil-temp').textContent = `${levelData.temperature || 25.5} °C`;
    if (document.getElementById('iot-soil-ph')) document.getElementById('iot-soil-ph').textContent = levelData.ph || 6.5;
    if (document.getElementById('iot-soil-ec')) document.getElementById('iot-soil-ec').innerHTML = `${levelData.ec || 1.2} <span style="font-size:11px;">mS/cm</span>`;
    if (document.getElementById('iot-soil-salinity')) document.getElementById('iot-soil-salinity').textContent = `${levelData.salinity || 0.2} ‰`;
    if (document.getElementById('iot-soil-npk')) {
      const npk = levelData.npk || { n: 45, p: 32, k: 58 };
      document.getElementById('iot-soil-npk').textContent = `N:${npk.n} | P:${npk.p} | K:${npk.k}`;
    }
  }
}
window.selectSoilDepth = selectSoilDepth;

export async function refreshIoTDemoData() {
  if (!getActiveFarmId()) return;
  try {
    const res = await api(`/farms/${getActiveFarmId()}/iot-data/refresh`, { method: 'POST' });
    if (res && res.success) {
      _currentFarmIoTData = res;
      _applyIoTDemoDataToUI(res);
      if (window.toast) window.toast('🔄 Đã lưu & làm mới dữ liệu cảm biến IoT trong Database thành công!', 'success');
    }
  } catch (err) {
    console.warn('Lỗi làm mới dữ liệu IoT:', err);
  }
}
window.refreshIoTDemoData = refreshIoTDemoData;

// ── Real Open-Meteo 6-Day Agricultural Weather Forecast ─────────────
const WMO_FORECAST_CONFIG = {
  0: { icon: 'sun', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Trời nắng trong xanh', advice: 'Nắng ấm: Rất thích hợp bón phân rễ & tưới nước buổi sáng sớm.' },
  1: { icon: 'sun-medium', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Quang mây, ít mây', advice: 'Mát mẻ: Thời điểm lý tưởng để tỉa cành, tạo tán và làm cỏ vườn.' },
  2: { icon: 'cloud-sun', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', label: 'Mây rải rác', advice: 'Nắng gián đoạn: Thích hợp phun phân bón lá & vi lượng hấp thu nhanh.' },
  3: { icon: 'cloud', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Nhiều mây âm u', advice: 'Trời nhiều mây: Thuận lợi thu hoạch trái và kiểm tra sâu bệnh hại.' },
  45: { icon: 'cloud-fog', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', label: 'Sương mù sáng sớm', advice: 'Sương mù ẩm: Chú ý phòng ngừa nấm bệnh sương mai trên đọt non.' },
  48: { icon: 'cloud-fog', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', label: 'Sương mù đọng sương', advice: 'Đọng sương ẩm: Tránh tưới quá ẩm làm tăng nguy cơ thối rễ.' },
  51: { icon: 'cloud-drizzle', color: '#38bdf8', bg: '#f0fdfa', border: '#99f6e4', label: 'Mưa phùn nhẹ', advice: 'Mưa phùn nhẹ: Có thể giảm lượng tưới nước, theo dõi độ ẩm đất.' },
  53: { icon: 'cloud-drizzle', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa phùn vừa', advice: 'Mưa phùn: Hoãn phun thuốc BVTV để tránh lãng phí và trôi thuốc.' },
  55: { icon: 'cloud-rain', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa phùn nặng', advice: 'Mưa kéo dài: Cần đảm bảo hệ thống rãnh thoát nước vườn thông thoáng.' },
  61: { icon: 'cloud-rain', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa rào nhẹ', advice: 'Mưa rào rải rác: Tận dụng nguồn đạm tự nhiên, tạm hoãn bón phân đạm.' },
  63: { icon: 'cloud-rain-wind', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa rào vừa', advice: 'Mưa rào vừa: Kiểm tra thoát nước gốc cây, tránh đọng nước cổ rễ.' },
  65: { icon: 'cloud-rain-wind', color: '#1d4ed8', bg: '#eff6ff', border: '#60a5fa', label: 'Mưa to nặng hạt', advice: 'Mưa to nặng hạt: Khơi thông dòng chảy thoát lũ, không đi lại làm nén đất.' },
  80: { icon: 'cloud-sun-rain', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe', label: 'Mưa rào thoáng qua', advice: 'Mưa rào ngắn: Thời tiết thuận lợi sau mưa để tiến hành thăm vườn.' },
  81: { icon: 'cloud-rain-wind', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'Mưa rào từng cơn', advice: 'Mưa từng đợt: Cắt tỉa cành khô, cành sâu bệnh bị gãy đổ.' },
  82: { icon: 'cloud-rain-wind', color: '#1e40af', bg: '#f1f5f9', border: '#94a3b8', label: 'Mưa rất to xối xả', advice: 'Mưa xối xả: Kê cao vật tư phân bón, kiểm tra an toàn điện trạm bơm.' },
  95: { icon: 'cloud-lightning', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Mưa dông sét', advice: 'Dông sét: Gia cố cọc chống cây trồng lớn, ngắt nguồn điện tưới ngoài trời.' },
  96: { icon: 'cloud-lightning', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Dông lốc, mưa đá nhẹ', advice: 'Cảnh báo dông lốc: Kiểm tra neo giàn và lưới che chắn nhà màng.' },
  99: { icon: 'cloud-lightning', color: '#991b1b', bg: '#fef2f2', border: '#f87171', label: 'Dông lốc nguy hiểm', advice: 'Dông bão mạnh: Tạm dừng toàn bộ hoạt động ngoài đồng ruộng để an toàn.' }
};

let _userCachedForecastData = null;
let _userSelectedHourlyDayMode = 'live24';

export async function fetchLiveOpenMeteoForecast(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,surface_pressure,et0_fao_evapotranspiration,soil_temperature_0cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,wind_speed_10m,wind_gusts_10m,uv_index,direct_normal_irradiance&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,et0_fao_evapotranspiration,shortwave_radiation_sum&forecast_days=7&timezone=auto`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _userCachedForecastData = data;

    const daily = data.daily || {};
    if (!daily.time || !Array.isArray(daily.time)) return null;

    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const forecastList = [];
    const count = Math.min(daily.time.length, 7);

    for (let i = 0; i < count; i++) {
      const dateStr = daily.time[i];
      const d = new Date(dateStr);
      const code = daily.weather_code ? daily.weather_code[i] : 0;
      const tMax = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[i]) : 32;
      const tMin = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[i]) : 25;
      const rain = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 10;
      const rainSum = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;
      const humidity = daily.relative_humidity_2m_mean ? Math.round(daily.relative_humidity_2m_mean[i]) : 70;
      const wind = daily.wind_speed_10m_max ? Math.round(daily.wind_speed_10m_max[i]) : 12;
      const windGusts = daily.wind_gusts_10m_max ? Math.round(daily.wind_gusts_10m_max[i]) : null;
      const et0 = daily.et0_fao_evapotranspiration ? Math.round(daily.et0_fao_evapotranspiration[i] * 10) / 10 : 4.2;

      const cfg = WMO_FORECAST_CONFIG[code] || WMO_FORECAST_CONFIG[0];
      let advice = cfg.advice;
      if (rain >= 70 || rainSum >= 15) {
        advice = 'Khả năng mưa rất cao: Tuyệt đối không bón phân hay phun xịt thuốc BVTV vì sẽ bị rửa trôi.';
      } else if (et0 >= 5.0) {
        advice = `Bốc thoát hơi nước cao (${et0}mm/ngày): Khuyến nghị tưới bù ~${Math.round(et0 * 30 * 0.85)}L/cây và che phủ gốc.`;
      } else if (windGusts && windGusts >= 35) {
        advice = `Cảnh báo gió giật ${windGusts} km/h: Kiểm tra giàn chống cành mang trái non.`;
      }

      forecastList.push({
        date: dateStr,
        day_index: i,
        day_label: i === 0 ? 'Hôm nay' : dayNames[d.getDay()],
        date_str: `${d.getDate()}/${d.getMonth() + 1}`,
        icon: cfg.icon,
        color: cfg.color,
        bg: cfg.bg,
        border: cfg.border,
        temp: `${tMin}°C - ${tMax}°C`,
        rain: `${rain}%`,
        rainSum: rainSum,
        humidity: `${humidity}%`,
        wind: `${wind} km/h`,
        windGusts: windGusts,
        et0: et0,
        advice: advice,
        is_live_meteo: true
      });
    }

    // Render 24-Hour Continuous Timeline for User Portal
    renderUser24HourHourlySection(data.hourly, data.daily, _userSelectedHourlyDayMode);

    return forecastList;
  } catch (err) {
    console.warn('[IoTWeather] Could not fetch live Open-Meteo forecast, using fallback.', err);
    return null;
  }
}
window.fetchLiveOpenMeteoForecast = fetchLiveOpenMeteoForecast;

export function renderUser24HourHourlySection(hourlyData, dailyData, selectedMode = 'live24') {
  if (!hourlyData || !hourlyData.time || !Array.isArray(hourlyData.time)) return;

  _userSelectedHourlyDayMode = selectedMode;
  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  // 1. Render Day Selector Pills
  const pillsContainer = document.getElementById('user-iot-hourly-day-pills');
  if (pillsContainer && dailyData && dailyData.time) {
    let pillsHtml = `
      <button type="button" class="btn btn-sm ${selectedMode === 'live24' ? 'active' : ''}" onclick="selectUserHourlyForecastDay('live24')" style="padding:3px 9px; font-size:11px; font-weight:800; border-radius:6px; white-space:nowrap; cursor:pointer; ${selectedMode === 'live24' ? 'background:#059669; color:#fff; border:1px solid #059669;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
        <i data-lucide="clock" class="lucide-xs"></i> 24h Tiếp theo (Live)
      </button>
    `;

    const dayCount = Math.min(dailyData.time.length, 7);
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(dailyData.time[i]);
      let dayName = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : daysOfWeek[d.getDay()];
      const isAct = selectedMode === `day_${i}`;
      pillsHtml += `
        <button type="button" class="btn btn-sm ${isAct ? 'active' : ''}" onclick="selectUserHourlyForecastDay('day_${i}')" style="padding:3px 9px; font-size:11px; font-weight:700; border-radius:6px; white-space:nowrap; cursor:pointer; ${isAct ? 'background:#059669; color:#fff; border:1px solid #059669;' : 'background:#ffffff; color:#475569; border:1px solid #cbd5e1;'}">
          ${dayName} (${d.getDate()}/${d.getMonth() + 1})
        </button>
      `;
    }
    pillsContainer.innerHTML = pillsHtml;
  }

  // 2. Determine 24-hour Slice Range
  let startIdx = 0;
  let viewTitleStr = '';

  if (selectedMode === 'live24') {
    const nowIso = new Date().toISOString().slice(0, 13);
    let curIdx = hourlyData.time.findIndex(t => t.startsWith(nowIso));
    if (curIdx === -1) curIdx = 0;
    // Start from next hour forward (e.g. 4 PM -> 5 PM)
    startIdx = curIdx + 1;
    if (startIdx >= hourlyData.time.length) startIdx = curIdx;

    const startObj = new Date(hourlyData.time[startIdx]);
    const endObj = new Date(hourlyData.time[Math.min(startIdx + 23, hourlyData.time.length - 1)]);
    viewTitleStr = `Dự báo 24 giờ liên tục từ ${startObj.getHours()}:00 ${startObj.getDate()}/${startObj.getMonth() + 1} đến ${endObj.getHours()}:00 ${endObj.getDate()}/${endObj.getMonth() + 1}`;
  } else {
    const dayIdx = parseInt(selectedMode.replace('day_', ''), 10) || 0;
    startIdx = dayIdx * 24;
    if (startIdx >= hourlyData.time.length) startIdx = 0;
    const targetDate = new Date(hourlyData.time[startIdx]);
    let dayLabel = dayIdx === 0 ? 'Hôm nay' : dayIdx === 1 ? 'Ngày mai' : daysOfWeek[targetDate.getDay()];
    viewTitleStr = `Dự báo trọn vẹn 24 khung giờ của ${dayLabel} (${targetDate.toLocaleDateString('vi-VN')}) (00:00 - 23:00)`;
  }

  const titleEl = document.getElementById('user-iot-hourly-title');
  if (titleEl) titleEl.textContent = viewTitleStr;

  const endIdx = Math.min(startIdx + 24, hourlyData.time.length);
  const sliceTimes = hourlyData.time.slice(startIdx, endIdx);
  const sliceTemps = hourlyData.temperature_2m ? hourlyData.temperature_2m.slice(startIdx, endIdx) : [];
  const sliceRainProbs = hourlyData.precipitation_probability ? hourlyData.precipitation_probability.slice(startIdx, endIdx) : [];
  const sliceRainSums = hourlyData.precipitation ? hourlyData.precipitation.slice(startIdx, endIdx) : [];
  const sliceWmoCodes = hourlyData.weather_code ? hourlyData.weather_code.slice(startIdx, endIdx) : [];
  const sliceWinds = hourlyData.wind_speed_10m ? hourlyData.wind_speed_10m.slice(startIdx, endIdx) : [];
  const sliceWindGusts = hourlyData.wind_gusts_10m ? hourlyData.wind_gusts_10m.slice(startIdx, endIdx) : [];
  const sliceEt0s = hourlyData.et0_fao_evapotranspiration ? hourlyData.et0_fao_evapotranspiration.slice(startIdx, endIdx) : [];

  // 3. Render Scrollable 24-Hour Hourly Cards Track
  const track = document.getElementById('user-iot-24h-hourly-track');
  if (track) {
    let cardsHtml = '';
    const firstDateDay = sliceTimes.length > 0 ? new Date(sliceTimes[0]).getDate() : null;

    for (let i = 0; i < sliceTimes.length; i++) {
      const dObj = new Date(sliceTimes[i]);
      const hourNum = dObj.getHours();
      const hourLabel = (hourNum < 10 ? '0' : '') + hourNum + ':00';
      const isNextDay = firstDateDay !== null && dObj.getDate() !== firstDateDay;

      const code = sliceWmoCodes[i] !== undefined ? sliceWmoCodes[i] : 0;
      const cfg = WMO_FORECAST_CONFIG[code] || WMO_FORECAST_CONFIG[0];
      const temp = sliceTemps[i] !== undefined ? Math.round(sliceTemps[i]) : '--';
      const rainP = sliceRainProbs[i] !== undefined ? sliceRainProbs[i] : 0;
      const rainM = sliceRainSums[i] !== undefined ? sliceRainSums[i] : 0;
      const wind = sliceWinds[i] !== undefined ? Math.round(sliceWinds[i]) : 0;
      const gusts = sliceWindGusts[i] !== undefined ? Math.round(sliceWindGusts[i]) : null;
      const et0 = sliceEt0s[i] !== undefined ? (Math.round(sliceEt0s[i] * 10) / 10) : null;

      // Spray Safety Assessment (Clean Lucide Icons)
      let sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="check-circle-2" class="lucide-xs"></i> Phun tốt</span>';
      if (rainP >= 50 || wind >= 25 || (gusts && gusts >= 35)) {
        sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="x-circle" class="lucide-xs"></i> Không phun</span>';
      } else if (rainP >= 25 || wind >= 15) {
        sprayBadge = '<span style="font-size:9.5px; font-weight:800; background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:2px 6px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="alert-triangle" class="lucide-xs"></i> Thận trọng</span>';
      }

      cardsHtml += `
        <div style="min-width:130px; max-width:134px; background:#ffffff; border:1.5px solid ${i === 0 ? '#059669' : '#e2e8f0'}; border-radius:12px; padding:9px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.02); flex-shrink:0;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
              <span style="font-size:12px; font-weight:900; color:#0f172a; background:#f1f5f9; padding:2px 5px; border-radius:6px;">${hourLabel}</span>
              ${isNextDay ? '<span style="font-size:9px; font-weight:800; color:#059669; background:#ecfdf5; padding:1px 3px; border-radius:4px;">+1d</span>' : ''}
            </div>

            <div style="text-align:center; padding:5px 0 3px;">
              <i data-lucide="${cfg.icon}" style="width:24px; height:24px; color:${cfg.color}; margin-bottom:2px; display:inline-block;"></i>
              <div style="font-size:16px; font-weight:900; color:#0f172a;">${temp}°C</div>
            </div>

            <div style="font-size:10.5px; color:#475569; display:flex; flex-direction:column; gap:2px; background:#f8fafc; padding:5px 6px; border-radius:6px; margin:3px 0 5px;">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#0284c7;"><i data-lucide="cloud-rain" class="lucide-xs"></i> Mưa:</span>
                <strong>${rainP}%${rainM > 0 ? ` (${rainM}mm)` : ''}</strong>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#64748b;"><i data-lucide="wind" class="lucide-xs"></i> Gió:</span>
                <strong>${wind}km/h</strong>
              </div>
              ${et0 !== null ? `
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#16a34a;"><i data-lucide="sprout" class="lucide-xs"></i> ET₀:</span>
                <strong style="color:#15803d;">${et0}mm</strong>
              </div>` : ''}
            </div>
          </div>

          <div style="text-align:center;">
            ${sprayBadge}
          </div>
        </div>
      `;
    }
    track.innerHTML = cardsHtml;
  }

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
}
window.renderUser24HourHourlySection = renderUser24HourHourlySection;

export function selectUserHourlyForecastDay(dayMode) {
  _userSelectedHourlyDayMode = dayMode;
  if (_userCachedForecastData && _userCachedForecastData.hourly && _userCachedForecastData.daily) {
    renderUser24HourHourlySection(_userCachedForecastData.hourly, _userCachedForecastData.daily, dayMode);
  }
}
window.selectUserHourlyForecastDay = selectUserHourlyForecastDay;

export async function renderIoTDemoData(farmId, forceRefresh = false) {
  if (!farmId) return;
  try {
    const endpoint = forceRefresh ? `/farms/${farmId}/iot-data/refresh` : `/farms/${farmId}/iot-data`;
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await api(endpoint, { method });
    if (res && res.success) {
      _currentFarmIoTData = res;
      _applyIoTDemoDataToUI(res);

      // Asynchronously fetch 100% real-time Open-Meteo 7-day & 24h weather forecast based on farm GPS coordinates
      const farmObj = (getFarmsCache() && getFarmsCache().length) ? getFarmsCache().find(f => String(f.id) === String(farmId)) : null;
      let lat = null;
      let lng = null;
      if (farmObj) {
        if (farmObj.latitude && farmObj.longitude && !isNaN(parseFloat(farmObj.latitude)) && !isNaN(parseFloat(farmObj.longitude))) {
          lat = parseFloat(farmObj.latitude);
          lng = parseFloat(farmObj.longitude);
        } else if (farmObj.polygon_coordinates) {
          const validPts = sanitizeCoordinates(farmObj.polygon_coordinates);
          if (validPts.length > 0) {
            let sumLat = 0, sumLng = 0;
            validPts.forEach(pt => { sumLng += pt[0]; sumLat += pt[1]; });
            lat = sumLat / validPts.length;
            lng = sumLng / validPts.length;
          }
        }
      }
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        lat = null;
        lng = null;
      }

      if (lat && lng) {
        fetchLiveOpenMeteoForecast(lat, lng).then(liveForecast => {
          if (liveForecast && liveForecast.length > 0) {
            _renderForecastGrid(liveForecast);
            const badge = document.getElementById('iot-weather-source-badge');
            if (badge) {
              badge.innerHTML = `<i data-lucide="satellite" class="lucide-xs" style="color:#059669;"></i> Realtime (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
            }
            if (window.lucide) {
              try { lucide.createIcons(); } catch (_) {}
            }
          }
        });
      } else {
        const badge = document.getElementById('iot-weather-source-badge');
        if (badge) {
          badge.innerHTML = `<i data-lucide="map-pin-off" class="lucide-xs" style="color:#f59e0b;"></i> GPS: null (Chưa thiết lập tọa độ)`;
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi tải dữ liệu IoT từ Database:', err);
  }
}
window.renderIoTDemoData = renderIoTDemoData;

function _cleanUtf8Mojibake(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    // Strip broken emoji mojibake artifacts
    .replace(/ã˜Ë¡|ðŸŒ¦ï¸|ã€\.\.\.|ðŸŒ¤ï¸|ðŸ[^\s]*|ã[^\s]*/gu, '')
    // Fix degrees
    .replace(/Â°/g, '°')
    // Fix days
    .replace(/Thá»©\s*Hai/g, 'Thứ Hai')
    .replace(/Thá»©\s*Ba/g, 'Thứ Ba')
    .replace(/Thá»©\s*TÆ°/g, 'Thứ Tư')
    .replace(/Thá»©\s*NÄƒm/g, 'Thứ Năm')
    .replace(/Thá»©\s*Sáu|Thá»©\s*Su/g, 'Thứ Sáu')
    .replace(/Thá»©\s*Bảy|Thá»©\s*By/g, 'Thứ Bảy')
    .replace(/Chá»§\s*Nháº­t|Chá»§\s*Nháºt/g, 'Chủ Nhật')
    .replace(/HÃ´m\s*nay|Hm\s*nay/g, 'Hôm nay')
    // Fix common words in advisory
    .replace(/Náº¯ng/g, 'Nắng')
    .replace(/áº¥m/g, 'ấm')
    .replace(/Thích\s*há»£p/g, 'Thích hợp')
    .replace(/phân\s*rá»\.\.\.|phân\s*rá»/g, 'phân rễ')
    .replace(/tÆ°á»›i/g, 'tưới')
    .replace(/nÆ°á»›c/g, 'nước')
    .replace(/buá»•i/g, 'buổi')
    .replace(/MÆ°a/g, 'Mưa')
    .replace(/Hạn\s*cháº¿/g, 'Hạn chế')
    .replace(/thuá»‘c/g, 'thuốc')
    .replace(/dá»\.\.\.|dá»/g, 'dễ')
    .replace(/bá»‹/g, 'bị')
    .replace(/rá»a/g, 'rửa')
    .replace(/Nhiá»\s*u/g, 'Nhiều')
    .replace(/Thá»\s*i/g, 'Thời')
    .replace(/Ä'iá»ƒm|Ä'iểm/g, 'điểm')
    .replace(/tá»'t|tốt/g, 'tốt')
    .replace(/nháº¥t/g, 'nhất')
    .replace(/Ä'á»ƒ/g, 'để')
    .replace(/gián\s*Ä'oạn/g, 'gián đoạn')
    .replace(/vi\s*lÆ°á»£ng/g, 'vi lượng')
    .replace(/dông\s*chiá»\s*u|giông\s*chiá»\s*u/g, 'dông chiều')
    .replace(/KhÆ¡i/g, 'Khơi')
    .replace(/ngáºp/g, 'ngập')
    .replace(/rá»±c/g, 'rực')
    .replace(/rá»¡/g, 'rỡ')
    .replace(/há»‡\s*thá»‘ng/g, 'hệ thống')
    .replace(/tá»±\s*Ä'á»™ng/g, 'tự động')
    // General vowels
    .replace(/Thá»©/g, 'Thứ')
    .replace(/TÆ°/g, 'Tư')
    .replace(/NÄƒm/g, 'Năm')
    .replace(/Æ°/g, 'ư')
    .replace(/Æ¡/g, 'ơ')
    .replace(/Äƒ/g, 'ă')
    .replace(/Ä'/g, 'đ')
    .replace(/á»©/g, 'ứ')
    .replace(/á»±/g, 'ự')
    .replace(/á»›/g, 'ớ')
    .replace(/á»£/g, 'ợ')
    .replace(/áº¯/g, 'ắ')
    .replace(/áº¥/g, 'ấ')
    .replace(/áº¿/g, 'ế')
    .replace(/á»‘/g, 'ố')
    .replace(/á»•/g, 'ổ')
    .replace(/á»‡/g, 'ệ')
    .replace(/á»‹/g, 'ị')
    .replace(/áº¡/g, 'ạ')
    .replace(/áº£/g, 'ả')
    .replace(/á»/g, 'ộ')
    .replace(/TÃ¢y/g, 'Tây')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãª/g, 'ê')
    .replace(/Ä\x90Ã´ng/g, 'Đông')
    .replace(/Ä\x90/g, 'Đ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã\xa0/g, 'à')
    .replace(/áº£/g, 'ả')
    .replace(/Ã£/g, 'ã')
    .replace(/áº¡/g, 'ạ')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/áº½/g, 'ẽ')
    .replace(/áº¹/g, 'ẹ')
    .replace(/Ã\xad/g, 'í')
    .replace(/Ã¬/g, 'ì')
    .replace(/á»\x89/g, 'ỉ')
    .replace(/Ä©/g, 'ĩ')
    .replace(/á»\x8b/g, 'ị')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã²/g, 'ò')
    .replace(/á»\x8f/g, 'ỏ')
    .replace(/Ãµ/g, 'õ')
    .replace(/á»\x8d/g, 'ọ')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã¹/g, 'ù')
    .replace(/á»§/g, 'ủ')
    .replace(/Å©/g, 'ũ')
    .replace(/á»¥/g, 'ụ')
    .replace(/Ã½/g, 'ý')
    .replace(/á»³/g, 'ỳ')
    .replace(/á»·/g, 'ỷ')
    .replace(/á»¹/g, 'ỹ')
    .replace(/á»µ/g, 'ỵ')
    .replace(/Ä\x91/g, 'đ')
    .trim();
}

function _renderForecastGrid(forecast) {
  const grid = document.getElementById('iot-weather-forecast-grid');
  if (!grid || !forecast || !forecast.length) return;

  grid.innerHTML = forecast.map((w, idx) => {
    let iconName = (w.icon || 'sun').trim();
    if (iconName.includes('⚡') || iconName.includes('⛈') || iconName.includes('🌩')) iconName = 'cloud-lightning';
    else if (iconName.includes('🌦')) iconName = 'cloud-sun-rain';
    else if (iconName.includes('🌧')) iconName = 'cloud-rain';
    else if (iconName.includes('⛅') || iconName.includes('🌤')) iconName = 'cloud-sun';
    else if (iconName.includes('☁')) iconName = 'cloud';
    else if (iconName.includes('☀️') || iconName.includes('☀')) iconName = 'sun';
    else if (iconName.startsWith('fa-')) {
      if (iconName.includes('sun-rain')) iconName = 'cloud-sun-rain';
      else if (iconName.includes('cloud-sun')) iconName = 'cloud-sun';
      else if (iconName.includes('sun')) iconName = 'sun';
      else if (iconName.includes('showers') || iconName.includes('rain')) iconName = 'cloud-rain';
      else if (iconName.includes('bolt') || iconName.includes('lightning')) iconName = 'cloud-lightning';
      else if (iconName.includes('cloud')) iconName = 'cloud';
      else iconName = 'sun';
    } else if (!/^[a-z0-9-]+$/.test(iconName)) {
      iconName = 'sun';
    }
    const isAct = _userSelectedHourlyDayMode === `day_${idx}`;
    const dayLabelClean = _cleanUtf8Mojibake(w.day_label || 'Hôm nay');
    const adviceClean = _cleanUtf8Mojibake(w.advice || '');
    const windClean = _cleanUtf8Mojibake(w.wind || '12 km/h');
    const tempClean = _cleanUtf8Mojibake(w.temp || '25°C - 33°C');
    const gridCardClass = idx < 4 ? 'weather-card-top-4' : 'weather-card-bottom-3';

    return `
      <div class="${gridCardClass}" onclick="selectUserHourlyForecastDay('day_${idx}')" style="background:${isAct ? '#ecfdf5' : (w.bg || '#fff7ed')}; border:1.5px solid ${isAct ? '#059669' : (w.border || '#ffedd5')}; border-radius:14px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:${isAct ? '0 2px 8px rgba(5,150,105,0.15)' : '0 2px 8px rgba(0,0,0,0.02)'}; cursor:pointer; transition:transform 0.15s ease;" title="Nhấp để xem 24 khung giờ chi tiết của ${dayLabelClean}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13.5px; color:#0f172a;">${dayLabelClean}</strong>
            <span style="font-size:11px; color:#64748b; font-weight:700;">${w.date_str || ''}</span>
          </div>
          <div style="text-align:center; padding:8px 0;">
            <i data-lucide="${iconName}" style="width:34px; height:34px; stroke-width:2.2; color:${w.color || '#f59e0b'}; margin-bottom:4px; display:inline-block;"></i>
            <div style="font-size:16px; font-weight:900; color:#0f172a;">${tempClean}</div>
          </div>
          <div style="font-size:11px; color:#475569; display:flex; flex-direction:column; gap:5px; margin-bottom:10px; background:rgba(255,255,255,0.75); padding:8px 10px; border-radius:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="cloud-rain" class="lucide-xs" style="color:#0284c7;"></i> Mưa:</span>
              <strong>${w.rain || '10%'}${w.rainSum > 0 ? ` (${w.rainSum}mm)` : ''}</strong>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="sprout" class="lucide-xs" style="color:#16a34a;"></i> Bốc hơi ET₀:</span>
              <strong style="color:#15803d;">${w.et0 ? w.et0 + ' mm' : '--'}</strong>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="wind" class="lucide-xs" style="color:#64748b;"></i> Gió:</span>
              <strong>${windClean}${w.windGusts ? ` (${w.windGusts})` : ''}</strong>
            </div>
          </div>
        </div>
        <div style="font-size:11px; color:#334155; font-weight:700; line-height:1.4; border-top:1px dashed ${w.border || '#ffedd5'}; padding-top:8px; display:flex; align-items:flex-start; gap:5px;">
          <i data-lucide="info" class="lucide-xs" style="color:${w.color || '#059669'}; margin-top:2px; flex-shrink:0;"></i>
          <span>${adviceClean}</span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
}
function _applyIoTDemoDataToUI(res) {
  const air = res.air_data || {};
  const water = res.water_data || {};
  const forecast = res.weather_forecast || [];

  const windDirClean = _cleanUtf8Mojibake(air.wind_direction || 'Đông Nam');

  // Update Air Environment
  if (document.getElementById('iot-air-temp')) document.getElementById('iot-air-temp').textContent = `${air.temperature || 28.5} °C`;
  if (document.getElementById('iot-air-humidity')) document.getElementById('iot-air-humidity').textContent = `${air.humidity || 74} %`;
  if (document.getElementById('iot-air-pressure')) document.getElementById('iot-air-pressure').textContent = `${air.pressure || 1012} hPa`;
  if (document.getElementById('iot-air-wind')) document.getElementById('iot-air-wind').textContent = `${air.wind_speed || 12} km/h - ${windDirClean}`;
  if (document.getElementById('iot-air-rain')) document.getElementById('iot-air-rain').textContent = `${air.rainfall || 1.5} mm (${air.rain_intensity || 0.5} mm/h)`;
  if (document.getElementById('iot-air-uv')) document.getElementById('iot-air-uv').innerHTML = `${air.uv_index || 4.2} <span style="font-size:11px; color:#64748b;">(Vừa)</span>`;
  if (document.getElementById('iot-air-solar')) document.getElementById('iot-air-solar').textContent = `${air.solar_radiation || 650} W/m²`;

  // Update Soil Multi-Depth
  selectSoilDepth(_selectedSoilDepth || '20cm');

  // Update Water Environment
  if (document.getElementById('iot-water-ph')) document.getElementById('iot-water-ph').textContent = water.ph || 6.8;
  if (document.getElementById('iot-water-do')) document.getElementById('iot-water-do').innerHTML = `${water.do || 6.5} <span style="font-size:11px;">mg/L</span>`;
  if (document.getElementById('iot-water-turbidity')) document.getElementById('iot-water-turbidity').innerHTML = `${water.turbidity || 12} <span style="font-size:11px;">NTU</span>`;
  if (document.getElementById('iot-water-level')) document.getElementById('iot-water-level').textContent = `${water.level || 85} %`;

  // Initial render of 6-Day Weather Forecast from DB cache
  _renderForecastGrid(forecast);

  if (window.lucide) {
    try { lucide.createIcons(); } catch (_) {}
  }
}

// ── Web Audio Feedback API for NFC Scan (Ding & Beep-beep) ─────────
