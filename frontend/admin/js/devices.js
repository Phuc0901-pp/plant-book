/* ════════════════════════════════════════════════════════
   Plant Book Admin — devices.js
   Hệ thống Trạm Thời tiết & Cảm biến Đất IoT Canh tác Thông minh
   1. Trạm Thời tiết & Dự báo (Weather Telemetry & Real 7-day Open-Meteo Forecasting)
   2. Cảm biến Đất đa tầng (10, 20, 30cm) với Lucide Icons chuẩn quốc tế
   3. Thuật toán Cảnh báo & Khuyến nghị Canh tác AI
   4. Quản lý Thiết bị & Sổ Đăng Ký Phân Tầng
   ════════════════════════════════════════════════════════ */

let devicesCache = [];
let iotMasterOnline = true;
let currentSoilDepth = 10;
let iotCurrentTab = 'weather';
let weatherChartInstance = null;
let _cachedWeatherFarmId = null;

// WMO Weather Interpretation Codes Map to Lucide icons
const WMO_WEATHER_MAP = {
  0: { label: 'Trời nắng trong xanh', icon: 'sun', color: '#f59e0b', bg: '#fef3c7' },
  1: { label: 'Trời quang, ít mây', icon: 'cloud-sun', color: '#0ea5e9', bg: '#e0f2fe' },
  2: { label: 'Mây rải rác', icon: 'cloud-sun', color: '#0ea5e9', bg: '#e0f2fe' },
  3: { label: 'Trời nhiều mây', icon: 'cloud', color: '#64748b', bg: '#f1f5f9' },
  45: { label: 'Sương mù', icon: 'cloud-fog', color: '#94a3b8', bg: '#f1f5f9' },
  48: { label: 'Sương mù đọng sương', icon: 'cloud-fog', color: '#94a3b8', bg: '#f1f5f9' },
  51: { label: 'Mưa phùn nhẹ', icon: 'cloud-drizzle', color: '#38bdf8', bg: '#e0f2fe' },
  53: { label: 'Mưa phùn vừa', icon: 'cloud-drizzle', color: '#0284c7', bg: '#e0f2fe' },
  55: { label: 'Mưa phùn nặng hạt', icon: 'cloud-rain', color: '#0284c7', bg: '#e0f2fe' },
  61: { label: 'Mưa rào nhẹ', icon: 'cloud-rain', color: '#38bdf8', bg: '#e0f2fe' },
  63: { label: 'Mưa rào vừa', icon: 'cloud-rain', color: '#0284c7', bg: '#e0f2fe' },
  65: { label: 'Mưa to nặng hạt', icon: 'cloud-rain-wind', color: '#1d4ed8', bg: '#dbeafe' },
  80: { label: 'Mưa rào thoáng qua', icon: 'cloud-sun-rain', color: '#0ea5e9', bg: '#e0f2fe' },
  81: { label: 'Mưa rào từng cơn', icon: 'cloud-rain', color: '#0284c7', bg: '#e0f2fe' },
  82: { label: 'Mưa rất to xối xả', icon: 'cloud-rain-wind', color: '#1e40af', bg: '#dbeafe' },
  95: { label: 'Mưa dông, sấm sét', icon: 'cloud-lightning', color: '#d97706', bg: '#fef3c7' },
  96: { label: 'Dông lốc kèm mưa đá', icon: 'cloud-hail', color: '#ea580c', bg: '#ffedd5' },
  99: { label: 'Dông bão nguy hiểm', icon: 'cloud-lightning', color: '#dc2626', bg: '#fee2e2' }
};

function getWmoDetails(code) {
  const c = parseInt(code, 10);
  return WMO_WEATHER_MAP[c] || { label: 'Khí hậu ổn định', icon: 'cloud-sun', color: '#059669', bg: '#ecfdf5' };
}

function getWindDirectionVietnamese(deg) {
  if (deg === undefined || deg === null || isNaN(deg)) return 'Gió nhẹ';
  const directions = ['Bắc (N)', 'Đông Bắc (NE)', 'Đông (E)', 'Đông Nam (SE)', 'Nam (S)', 'Tây Nam (SW)', 'Tây (W)', 'Tây Bắc (NW)'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

// Multi-depth soil demo telemetry data
const soilDepthData = {
  10: {
    ph: 6.5, phStatus: 'Đất hơi chua (Tối ưu sầu riêng)', phColor: '#10b981',
    temp: 25.8, tempStatus: 'Thích hợp phát triển rễ tơ', tempColor: '#10b981',
    humidity: 48, humStatus: 'Mức trung bình (Cần bổ sung tưới)', humColor: '#f59e0b',
    ec: 1.1, ecStatus: 'Dinh dưỡng đất hài hòa (1.1 mS/cm)', ecColor: '#10b981',
    npk: 'N: 130 | P: 40 | K: 200 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.12, salStatus: 'Không nhiễm mặn (0.12 ‰)', salColor: '#10b981'
  },
  20: {
    ph: 6.6, phStatus: 'Đất trung tính - Tốt cho rễ chính', phColor: '#10b981',
    temp: 25.2, tempStatus: 'Nhiệt độ ổn định tầng giữa', tempColor: '#10b981',
    humidity: 50, humStatus: 'Độ ẩm 50% (Khuyến nghị nâng lên 60%)', humColor: '#f59e0b',
    ec: 1.3, ecStatus: 'Mức dinh dưỡng lý tưởng (1.3 mS/cm)', ecColor: '#10b981',
    npk: 'N: 145 | P: 48 | K: 215 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.15, salStatus: 'Không nhiễm mặn (0.15 ‰)', salColor: '#10b981'
  },
  30: {
    ph: 6.8, phStatus: 'Đất ổn định tầng sâu', phColor: '#10b981',
    temp: 24.5, tempStatus: 'Mát mẻ, bảo vệ củ rễ', tempColor: '#10b981',
    humidity: 58, humStatus: 'Độ ẩm tốt tầng sâu (58%)', humColor: '#10b981',
    ec: 1.5, ecStatus: 'Tích tụ dinh dưỡng dồi dào', ecColor: '#10b981',
    npk: 'N: 160 | P: 52 | K: 230 (mg/kg)', npkColor: '#3b82f6',
    salinity: 0.18, salStatus: 'An toàn (0.18 ‰)', salColor: '#10b981'
  }
};

// Initialize IoT Devices Page
async function initDevicesPage() {
  renderSoilMetrics(currentSoilDepth);
  await Promise.all([
    fetchDeviceWeatherTelemetry(),
    loadDevices()
  ]);
}

// Fetch Real-time & 7-day Open-Meteo Weather Data
async function fetchDeviceWeatherTelemetry(targetFarmId = null) {
  const farmVal = targetFarmId || document.getElementById('db-iot-filter-farm')?.value || 'all';
  
  let lat = null;
  let lng = null;
  let farmDisplayName = 'Toàn hệ thống';

  const farms = window._allFarmsCache || (typeof dbFarmsCache !== 'undefined' ? dbFarmsCache : []);

  if (farmVal !== 'all' && farms.length > 0) {
    const selectedFarm = farms.find(f => f.id == farmVal);
    if (selectedFarm) {
      farmDisplayName = selectedFarm.name || `Trang trại #${selectedFarm.id}`;
      if (selectedFarm.latitude && selectedFarm.longitude && !isNaN(parseFloat(selectedFarm.latitude)) && !isNaN(parseFloat(selectedFarm.longitude))) {
        lat = parseFloat(selectedFarm.latitude);
        lng = parseFloat(selectedFarm.longitude);
      } else if (selectedFarm.polygon_coordinates) {
        try {
          const poly = typeof selectedFarm.polygon_coordinates === 'string'
            ? JSON.parse(selectedFarm.polygon_coordinates)
            : selectedFarm.polygon_coordinates;
          if (Array.isArray(poly) && poly.length > 0) {
            const ring = Array.isArray(poly[0][0]) ? poly[0] : poly;
            let sumLat = 0, sumLng = 0, validCount = 0;
            ring.forEach(pt => {
              const pLng = parseFloat(pt[0]);
              const pLat = parseFloat(pt[1]);
              if (!isNaN(pLng) && !isNaN(pLat)) {
                sumLng += pLng;
                sumLat += pLat;
                validCount++;
              }
            });
            if (validCount > 0) {
              lat = sumLat / validCount;
              lng = sumLng / validCount;
            }
          }
        } catch (_) {}
      }
    }
  } else {
    // "all" mode: use first farm with valid GPS or benchmark Long Khánh, Đồng Nai
    const farmWithCoords = farms.find(f => f.latitude && f.longitude && !isNaN(parseFloat(f.latitude)) && !isNaN(parseFloat(f.longitude)));
    if (farmWithCoords) {
      lat = parseFloat(farmWithCoords.latitude);
      lng = parseFloat(farmWithCoords.longitude);
      farmDisplayName = `Toàn hệ thống · Chuẩn ${farmWithCoords.name}`;
    } else {
      // Tọa độ vùng trồng Long Khánh, Đồng Nai làm chuẩn hệ thống
      lat = 10.9415;
      lng = 107.2418;
      farmDisplayName = 'Toàn hệ thống (Chuẩn GPS Long Khánh, Đồng Nai)';
    }
  }

  // Update Location Name
  const locEl = document.getElementById('iot-weather-location');
  if (locEl) {
    if (lat !== null && lng !== null) {
      locEl.innerHTML = `<i data-lucide="map-pin" class="lucide-sm" style="color:#059669;"></i> Trạm Khí tượng Nông nghiệp · ${esc(farmDisplayName)} <span style="font-size:11px; color:#64748b; font-weight:600;">(${lat.toFixed(4)}, ${lng.toFixed(4)})</span>`;
    } else {
      locEl.innerHTML = `<i data-lucide="map-pin-off" class="lucide-sm" style="color:#dc2626;"></i> Trạm Khí tượng Nông nghiệp · ${esc(farmDisplayName)} <span style="color:#dc2626; font-weight:700; font-size:11px;">(Tọa độ GPS: null)</span>`;
    }
  }

  // If GPS coordinates could not be retrieved, display null state
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    renderNullWeather(farmDisplayName);
    return;
  }

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,surface_pressure,et0_fao_evapotranspiration,soil_temperature_0cm,soil_temperature_18cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,direct_normal_irradiance&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,et0_fao_evapotranspiration,shortwave_radiation_sum&timezone=auto`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(weatherUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();

    const cur = data.current || {};
    const daily = data.daily || {};
    const hourly = data.hourly || {};

    // Determine current hour index in hourly arrays
    let curHourIdx = 0;
    if (hourly.time && hourly.time.length > 0) {
      const nowIsoHour = new Date().toISOString().slice(0, 13);
      const matchIdx = hourly.time.findIndex(t => t.startsWith(nowIsoHour));
      if (matchIdx !== -1) curHourIdx = matchIdx;
    }

    const wmo = getWmoDetails(cur.weather_code);
    const tempVal = cur.temperature_2m !== undefined && cur.temperature_2m !== null ? Math.round(cur.temperature_2m) : null;
    const appTemp = cur.apparent_temperature !== undefined && cur.apparent_temperature !== null ? Math.round(cur.apparent_temperature) : tempVal;
    const todayRainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max.length > 0) ? daily.precipitation_probability_max[0] : null;
    const todayRainSum = (daily.precipitation_sum && daily.precipitation_sum.length > 0) ? daily.precipitation_sum[0] : (cur.precipitation || 0);
    const todayWindGusts = (daily.wind_gusts_10m_max && daily.wind_gusts_10m_max.length > 0) ? Math.round(daily.wind_gusts_10m_max[0]) : (cur.wind_gusts_10m ? Math.round(cur.wind_gusts_10m) : null);
    
    // AgTech Parameters from Hourly & Daily
    const curDewPoint = (hourly.dew_point_2m && hourly.dew_point_2m[curHourIdx] !== undefined)
      ? Math.round(hourly.dew_point_2m[curHourIdx] * 10) / 10
      : (cur.temperature_2m !== undefined && cur.relative_humidity_2m !== undefined ? Math.round((cur.temperature_2m - ((100 - cur.relative_humidity_2m) / 5)) * 10) / 10 : null);
    
    const todayEt0 = (daily.et0_fao_evapotranspiration && daily.et0_fao_evapotranspiration.length > 0)
      ? Math.round(daily.et0_fao_evapotranspiration[0] * 10) / 10
      : (hourly.et0_fao_evapotranspiration && hourly.et0_fao_evapotranspiration[curHourIdx] !== undefined ? Math.round(hourly.et0_fao_evapotranspiration[curHourIdx] * 24 * 10) / 10 : 4.2);

    const curSolarRad = (hourly.direct_normal_irradiance && hourly.direct_normal_irradiance[curHourIdx] !== undefined)
      ? Math.round(hourly.direct_normal_irradiance[curHourIdx])
      : (daily.shortwave_radiation_sum && daily.shortwave_radiation_sum.length > 0 ? Math.round(daily.shortwave_radiation_sum[0]) : null);

    const satelliteSoilMoist = (hourly.soil_moisture_0_to_1cm && hourly.soil_moisture_0_to_1cm[curHourIdx] !== undefined)
      ? Math.round(hourly.soil_moisture_0_to_1cm[curHourIdx] * 100)
      : (hourly.soil_moisture_1_to_3cm && hourly.soil_moisture_1_to_3cm[curHourIdx] !== undefined ? Math.round(hourly.soil_moisture_1_to_3cm[curHourIdx] * 100) : 52);

    const satelliteSoilTemp = (hourly.soil_temperature_0cm && hourly.soil_temperature_0cm[curHourIdx] !== undefined)
      ? Math.round(hourly.soil_temperature_0cm[curHourIdx] * 10) / 10
      : (hourly.soil_temperature_18cm && hourly.soil_temperature_18cm[curHourIdx] !== undefined ? Math.round(hourly.soil_temperature_18cm[curHourIdx] * 10) / 10 : 25.5);

    // Irrigation recommendation calculation (FAO-56 durian standard: ET0 * Canopy ~30m2 * Kc ~0.85)
    const irrigationLiters = todayEt0 !== null ? Math.round(todayEt0 * 30 * 0.85) : 110;

    // 1. Render Hero Card
    const tempEl = document.getElementById('iot-weather-temp');
    if (tempEl) tempEl.textContent = tempVal !== null ? `${tempVal}°C` : 'null';

    const iconEl = document.getElementById('iot-weather-icon');
    if (iconEl) iconEl.innerHTML = `<i data-lucide="${wmo.icon}" class="lucide-sm" style="color:${wmo.color};"></i>`;

    const descEl = document.getElementById('iot-weather-desc');
    if (descEl) descEl.textContent = wmo.label || 'null';

    const sumEl = document.getElementById('iot-weather-summary');
    if (sumEl) {
      if (todayRainProb !== null && todayRainProb > 45) {
        sumEl.textContent = `Xác suất mưa hôm nay ${todayRainProb}% (${todayRainSum}mm). Chú ý tiêu thoát nước vườn và hoãn phun thuốc BVTV.`;
      } else if (todayEt0 && todayEt0 > 5.0) {
        sumEl.textContent = `Bốc thoát hơi nước cao (${todayEt0}mm/ngày). Khuyến nghị tăng cường tưới bù ~${irrigationLiters}L/cây để giữ ẩm gốc.`;
      } else {
        sumEl.textContent = `Thời tiết thuận lợi cho việc chăm sóc sầu riêng, đo đạc dinh dưỡng và quản lý cơi đọt.`;
      }
    }

    // 2. Render 6 Specialized AgTech Telemetry Cards
    // Card 1: Wind & Wind Gusts
    const windEl = document.getElementById('iot-weather-wind');
    if (windEl) {
      windEl.innerHTML = cur.wind_speed_10m !== undefined && cur.wind_speed_10m !== null
        ? `${Math.round(cur.wind_speed_10m)} <small style="font-size:12px; color:#64748b;">km/h</small>`
        : '<span style="color:#94a3b8;">null</span>';
    }

    const windDirEl = document.getElementById('iot-weather-wind-dir');
    if (windDirEl) {
      windDirEl.textContent = cur.wind_direction_10m !== undefined && cur.wind_direction_10m !== null
        ? `Hướng: ${getWindDirectionVietnamese(cur.wind_direction_10m)}`
        : 'Hướng: null';
    }

    const windGustsEl = document.getElementById('iot-weather-wind-gusts');
    if (windGustsEl) {
      windGustsEl.textContent = todayWindGusts !== null ? `Gió giật max: ${todayWindGusts} km/h` : 'Gió giật max: -- km/h';
    }

    // Card 2: Rain & Rain Probability & 24h Rain Sum
    const rainEl = document.getElementById('iot-weather-rain');
    if (rainEl) {
      rainEl.innerHTML = cur.precipitation !== undefined && cur.precipitation !== null
        ? `${cur.precipitation} <small style="font-size:12px; color:#64748b;">mm</small>`
        : '<span style="color:#94a3b8;">null</span>';
    }

    const rainProbEl = document.getElementById('iot-weather-rain-prob');
    if (rainProbEl) {
      rainProbEl.textContent = todayRainProb !== null ? `Xác suất mưa: ${todayRainProb}%` : 'Xác suất mưa: null';
    }

    const rainSumEl = document.getElementById('iot-weather-rain-sum');
    if (rainSumEl) {
      rainSumEl.textContent = `Tổng mưa 24h: ${todayRainSum !== null ? todayRainSum + ' mm' : '0 mm'}`;
    }

    // Card 3: Humidity & Dew Point
    const humEl = document.getElementById('iot-weather-humidity');
    if (humEl) {
      humEl.innerHTML = cur.relative_humidity_2m !== undefined && cur.relative_humidity_2m !== null
        ? `${cur.relative_humidity_2m}%`
        : '<span style="color:#94a3b8;">null</span>';
    }

    const appEl = document.getElementById('iot-weather-apparent');
    if (appEl) {
      appEl.textContent = `Cảm giác: ${appTemp !== null ? appTemp + '°C' : 'null'}`;
    }

    const dewPointEl = document.getElementById('iot-weather-dewpoint');
    if (dewPointEl) {
      dewPointEl.textContent = `Điểm sương: ${curDewPoint !== null ? curDewPoint + '°C' : '--°C'}`;
    }

    // Card 4: Evapotranspiration ET0 & Irrigation Recommendation
    const et0El = document.getElementById('iot-weather-et0');
    if (et0El) {
      et0El.innerHTML = todayEt0 !== null ? `${todayEt0} <small style="font-size:12px; color:#64748b;">mm/ngày</small>` : '<span style="color:#94a3b8;">null</span>';
    }

    const et0StatusEl = document.getElementById('iot-weather-et0-status');
    if (et0StatusEl) {
      et0StatusEl.textContent = todayEt0 !== null
        ? (todayEt0 < 3.0 ? 'Nhu cầu nước: Thấp' : todayEt0 <= 5.0 ? 'Nhu cầu nước: Vừa phải' : 'Nhu cầu nước: Rất cao')
        : 'Nhu cầu nước: Vừa phải';
    }

    const irrigEl = document.getElementById('iot-weather-irrigation-rec');
    if (irrigEl) {
      irrigEl.textContent = `Tưới bù: ~${irrigationLiters} Lít/cây`;
    }

    // Card 5: UV Index & Solar Radiation
    const uvEl = document.getElementById('iot-weather-uv');
    const uvVal = cur.uv_index !== undefined && cur.uv_index !== null ? cur.uv_index : ((daily.uv_index_max && daily.uv_index_max[0]) || 0);
    if (uvEl) {
      uvEl.textContent = uvVal !== null ? uvVal : 'null';
    }

    const uvLevelEl = document.getElementById('iot-weather-uv-level');
    if (uvLevelEl) {
      let uvLabel = 'Thấp (An toàn)';
      if (uvVal >= 11) uvLabel = 'Cực kỳ nguy hại';
      else if (uvVal >= 8) uvLabel = 'Rất cao (Nguy hại)';
      else if (uvVal >= 6) uvLabel = 'Cao (Cần che chắn)';
      else if (uvVal >= 3) uvLabel = 'Trung bình';
      uvLevelEl.textContent = `Mức độ: ${uvLabel}`;
    }

    const solarRadEl = document.getElementById('iot-weather-solar-rad');
    if (solarRadEl) {
      solarRadEl.textContent = curSolarRad !== null ? `Bức xạ: ${curSolarRad} W/m²` : 'Bức xạ: -- W/m²';
    }

    // Card 6: Satellite Soil & Pressure
    const soilMoistEl = document.getElementById('iot-weather-soil-moist');
    if (soilMoistEl) {
      soilMoistEl.textContent = `${satelliteSoilMoist}%`;
    }

    const soilTempEl = document.getElementById('iot-weather-soil-temp');
    if (soilTempEl) {
      soilTempEl.textContent = `Nhiệt độ đất: ${satelliteSoilTemp}°C`;
    }

    const pressEl = document.getElementById('iot-weather-pressure');
    if (pressEl) {
      pressEl.textContent = cur.surface_pressure !== undefined && cur.surface_pressure !== null
        ? `Áp suất: ${Math.round(cur.surface_pressure)} hPa`
        : 'Áp suất: -- hPa';
    }

    // 3. Render Smart AgTech Crop Advisory Box
    const sprayWindowEl = document.getElementById('iot-weather-spray-window');
    const advisoryDetailEl = document.getElementById('iot-weather-advisory-detail');
    const windSpeed = cur.wind_speed_10m || 0;
    const rainProb = todayRainProb || 0;

    if (sprayWindowEl) {
      if (rainProb >= 50 || windSpeed >= 25 || (todayWindGusts && todayWindGusts >= 35)) {
        sprayWindowEl.style.background = '#fef2f2';
        sprayWindowEl.style.color = '#b91c1c';
        sprayWindowEl.style.borderColor = '#fecaca';
        sprayWindowEl.innerHTML = '<i data-lucide="alert-triangle" class="lucide-xs"></i> Cửa sổ Phun thuốc: KHÔNG NÊN PHUN (Mưa/Gió giật)';
      } else if (rainProb >= 25 || windSpeed >= 15) {
        sprayWindowEl.style.background = '#fffbeb';
        sprayWindowEl.style.color = '#b45309';
        sprayWindowEl.style.borderColor = '#fde68a';
        sprayWindowEl.innerHTML = '<i data-lucide="alert-circle" class="lucide-xs"></i> Cửa sổ Phun thuốc: Thận trọng (Có gió/Khả năng mưa)';
      } else {
        sprayWindowEl.style.background = '#ecfdf5';
        sprayWindowEl.style.color = '#047857';
        sprayWindowEl.style.borderColor = '#a7f3d0';
        sprayWindowEl.innerHTML = '<i data-lucide="check-circle-2" class="lucide-xs"></i> Cửa sổ Phun thuốc: AN TOÀN (Lý tưởng)';
      }
    }

    if (advisoryDetailEl) {
      let detailMsg = `Dự báo bốc thoát hơi nước hôm nay <strong>${todayEt0} mm/ngày</strong> (khuyến nghị tưới bù ~<strong>${irrigationLiters} Lít/cây</strong>). `;
      if (curDewPoint !== null && cur.temperature_2m !== undefined) {
        const dewDelta = cur.temperature_2m - curDewPoint;
        if (dewDelta <= 2.5 && cur.relative_humidity_2m >= 85) {
          detailMsg += `Chênh lệch điểm sương thấp (${dewDelta.toFixed(1)}°C) kèm độ ẩm cao (${cur.relative_humidity_2m}%) -> <strong>Cảnh báo nguy cơ nấm Phytophthora & thán thư</strong>. `;
        } else {
          detailMsg += `Độ ẩm & điểm sương ở mức tối ưu cho hô hấp của bộ rễ và tán lá sầu riêng. `;
        }
      }
      if (todayWindGusts && todayWindGusts >= 35) {
        detailMsg += `Cảnh báo gió giật mạnh lên đến <strong>${todayWindGusts} km/h</strong>, cần kiểm tra chằng chống cành mang hoa và quả non.`;
      } else {
        detailMsg += `Thời tiết thuận lợi cho các hoạt động chăm sóc vườn và theo dõi dinh dưỡng.`;
      }
      advisoryDetailEl.innerHTML = detailMsg;
    }

    const timeEl = document.getElementById('iot-weather-updated-time');
    if (timeEl) {
      timeEl.textContent = `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 4. Render Hourly Temperature Chart (Next 8 hours)
    renderWeatherHourlyChart(data.hourly);

    // 5. Render 7-Day Forecast Cards
    render7DayForecast(data.daily);

  } catch (err) {
    console.warn('[devices.js] Lỗi tải Open-Meteo API:', err.message);
    renderNullWeather(farmDisplayName);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Render 7-Day Forecast Cards with AgTech metrics & actionable crop advisories
function render7DayForecast(dailyData) {
  const container = document.getElementById('iot-7day-forecast-list');
  if (!container) return;

  if (!dailyData || !dailyData.time || dailyData.time.length === 0) {
    container.innerHTML = '<div style="padding:16px; text-align:center; color:#94a3b8; font-size:12px;">Chưa nhận được dữ liệu dự báo 7 ngày (null).</div>';
    return;
  }

  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const count = Math.min(dailyData.time.length, 7);

  let html = '';
  for (let i = 0; i < count; i++) {
    const dateObj = new Date(dailyData.time[i]);
    let dayLabel = daysOfWeek[dateObj.getDay()];
    if (i === 0) dayLabel = 'Hôm nay';
    else if (i === 1) dayLabel = 'Ngày mai';

    const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const code = dailyData.weather_code ? dailyData.weather_code[i] : 0;
    const wmo = getWmoDetails(code);
    const tMax = dailyData.temperature_2m_max && dailyData.temperature_2m_max[i] !== null ? Math.round(dailyData.temperature_2m_max[i]) : 'null';
    const tMin = dailyData.temperature_2m_min && dailyData.temperature_2m_min[i] !== null ? Math.round(dailyData.temperature_2m_min[i]) : 'null';
    const rainProb = dailyData.precipitation_probability_max && dailyData.precipitation_probability_max[i] !== null ? dailyData.precipitation_probability_max[i] : 0;
    const rainSum = dailyData.precipitation_sum ? dailyData.precipitation_sum[i] : 0;
    const et0 = dailyData.et0_fao_evapotranspiration ? Math.round(dailyData.et0_fao_evapotranspiration[i] * 10) / 10 : null;
    const windMax = dailyData.wind_speed_10m_max ? Math.round(dailyData.wind_speed_10m_max[i]) : null;
    const windGusts = dailyData.wind_gusts_10m_max ? Math.round(dailyData.wind_gusts_10m_max[i]) : null;

    // Actionable Agri-Advisory Tag
    let agriActionChip = '';
    if (rainProb >= 60 || rainSum >= 15) {
      agriActionChip = `<span style="font-size:10px; font-weight:800; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 7px; border-radius:10px;">Hoãn phun BVTV · Thoát nước</span>`;
    } else if (et0 && et0 >= 5.0) {
      agriActionChip = `<span style="font-size:10px; font-weight:800; background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; padding:2px 7px; border-radius:10px;">Tưới bù ET0 ${et0}mm</span>`;
    } else if (windGusts && windGusts >= 35) {
      agriActionChip = `<span style="font-size:10px; font-weight:800; background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:2px 7px; border-radius:10px;">Chống cành · Gió giật ${windGusts}km/h</span>`;
    } else {
      agriActionChip = `<span style="font-size:10px; font-weight:700; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 7px; border-radius:10px;">Canh tác thuận lợi</span>`;
    }

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:${i === 0 ? '#ecfdf5' : '#f8fafc'}; border-radius:10px; font-size:12.5px; border:1px solid ${i === 0 ? '#a7f3d0' : '#e2e8f0'}; transition:all 0.15s ease; gap:8px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px; min-width:110px;">
          <strong style="color:#0f172a; font-weight:800;">${dayLabel}</strong>
          <span style="font-size:11px; color:#64748b;">(${dateStr})</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:${wmo.color}; flex:1; justify-content:center; flex-wrap:wrap;">
          <i data-lucide="${wmo.icon}" class="lucide-sm"></i>
          <span style="font-size:11.5px; color:#334155;">${wmo.label}</span>
          <span style="font-size:11px; color:#0284c7; background:#e0f2fe; padding:1px 6px; border-radius:10px; font-weight:800;" title="Xác suất mưa">${rainProb}%</span>
          ${rainSum > 0 ? `<span style="font-size:10.5px; color:#0369a1; font-weight:700;">(${rainSum}mm)</span>` : ''}
          ${et0 !== null ? `<span style="font-size:10.5px; color:#059669; background:#d1fae5; padding:1px 5px; border-radius:6px; font-weight:700;">ET₀: ${et0}mm</span>` : ''}
          ${agriActionChip}
        </div>
        <div style="font-weight:800; color:#0f172a; text-align:right; min-width:70px;">
          <span>${tMax}°</span> <span style="color:#94a3b8; font-weight:600; font-size:11.5px;">/ ${tMin}°</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Render Null State when GPS or weather data is not received
function renderNullWeather(farmDisplayName = '') {
  const tempEl = document.getElementById('iot-weather-temp');
  if (tempEl) tempEl.innerHTML = '<span style="color:#94a3b8; font-size:32px;">null</span>';

  const iconEl = document.getElementById('iot-weather-icon');
  if (iconEl) iconEl.innerHTML = `<i data-lucide="cloud-off" class="lucide-sm" style="color:#94a3b8;"></i>`;

  const descEl = document.getElementById('iot-weather-desc');
  if (descEl) descEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">null (Chưa nhận được dữ liệu)</span>`;

  const sumEl = document.getElementById('iot-weather-summary');
  if (sumEl) sumEl.textContent = 'Trang trại chưa cấu hình tọa độ GPS hoặc trạm khí tượng chưa gửi dữ liệu.';

  const windEl = document.getElementById('iot-weather-wind');
  if (windEl) windEl.innerHTML = `<span style="color:#94a3b8;">null</span>`;

  const windDirEl = document.getElementById('iot-weather-wind-dir');
  if (windDirEl) windDirEl.textContent = 'Hướng gió: null';

  const windGustsEl = document.getElementById('iot-weather-wind-gusts');
  if (windGustsEl) windGustsEl.textContent = 'Gió giật max: null';

  const rainEl = document.getElementById('iot-weather-rain');
  if (rainEl) rainEl.innerHTML = `<span style="color:#94a3b8;">null</span>`;

  const rainProbEl = document.getElementById('iot-weather-rain-prob');
  if (rainProbEl) rainProbEl.textContent = 'Xác suất mưa: null';

  const rainSumEl = document.getElementById('iot-weather-rain-sum');
  if (rainSumEl) rainSumEl.textContent = 'Tổng mưa 24h: null';

  const humEl = document.getElementById('iot-weather-humidity');
  if (humEl) humEl.innerHTML = `<span style="color:#94a3b8;">null</span>`;

  const appEl = document.getElementById('iot-weather-apparent');
  if (appEl) appEl.textContent = 'Cảm giác: null';

  const dewPointEl = document.getElementById('iot-weather-dewpoint');
  if (dewPointEl) dewPointEl.textContent = 'Điểm sương: null';

  const et0El = document.getElementById('iot-weather-et0');
  if (et0El) et0El.innerHTML = `<span style="color:#94a3b8;">null</span>`;

  const et0StatusEl = document.getElementById('iot-weather-et0-status');
  if (et0StatusEl) et0StatusEl.textContent = 'Nhu cầu nước: null';

  const irrigEl = document.getElementById('iot-weather-irrigation-rec');
  if (irrigEl) irrigEl.textContent = 'Tưới bù: null';

  const uvEl = document.getElementById('iot-weather-uv');
  if (uvEl) uvEl.textContent = 'null';

  const uvLevelEl = document.getElementById('iot-weather-uv-level');
  if (uvLevelEl) uvLevelEl.textContent = 'Mức độ: null';

  const solarRadEl = document.getElementById('iot-weather-solar-rad');
  if (solarRadEl) solarRadEl.textContent = 'Bức xạ: null';

  const soilMoistEl = document.getElementById('iot-weather-soil-moist');
  if (soilMoistEl) soilMoistEl.textContent = 'null%';

  const soilTempEl = document.getElementById('iot-weather-soil-temp');
  if (soilTempEl) soilTempEl.textContent = 'Nhiệt độ đất: null';

  const pressEl = document.getElementById('iot-weather-pressure');
  if (pressEl) pressEl.textContent = 'Áp suất: null';

  const sprayWindowEl = document.getElementById('iot-weather-spray-window');
  if (sprayWindowEl) {
    sprayWindowEl.style.background = '#f1f5f9';
    sprayWindowEl.style.color = '#64748b';
    sprayWindowEl.style.borderColor = '#cbd5e1';
    sprayWindowEl.textContent = 'Cửa sổ Phun thuốc: null';
  }

  const advisoryDetailEl = document.getElementById('iot-weather-advisory-detail');
  if (advisoryDetailEl) advisoryDetailEl.textContent = 'Chưa nhận được dữ liệu khí tượng Open-Meteo cho trang trại này.';

  const timeEl = document.getElementById('iot-weather-updated-time');
  if (timeEl) timeEl.textContent = 'Dữ liệu: null';

  if (weatherChartInstance) {
    weatherChartInstance.destroy();
    weatherChartInstance = null;
  }

  const container = document.getElementById('iot-7day-forecast-list');
  if (container) {
    container.innerHTML = `
      <div style="padding:28px 16px; text-align:center; color:#94a3b8; font-size:12.5px; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1;">
        <div style="width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#94a3b8; display:inline-flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:8px;">
          <i data-lucide="cloud-off" class="lucide-sm"></i>
        </div>
        <div style="font-weight:800; color:#475569; font-size:13px;">Chưa nhận được dữ liệu dự báo 7 ngày (null)</div>
        <div style="font-size:11.5px; color:#64748b; margin-top:4px;">Vui lòng cài đặt tọa độ GPS trong mục Quản lý Trang trại để kích hoạt dự báo tự động.</div>
      </div>
    `;
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Master Toggle Switch Power Button
function toggleIotMasterPower() {
  iotMasterOnline = !iotMasterOnline;
  const badge = document.getElementById('iot-status-badge');
  const text = document.getElementById('iot-status-text');
  const btn = document.getElementById('iot-master-toggle-btn');

  if (iotMasterOnline) {
    if (badge) {
      badge.style.background = 'rgba(16,185,129,0.15)';
      badge.style.borderColor = 'rgba(16,185,129,0.4)';
      badge.style.color = '#10b981';
    }
    if (text) text.textContent = 'TRẠM IOT ĐANG HOẠT ĐỘNG (LIVE)';
    if (btn) {
      btn.style.background = '#10b981';
      btn.innerHTML = '<i data-lucide="power" class="lucide-sm"></i> Đang Bật Trạm IoT';
    }
    toast('Đã bật kết nối Trạm Cảm biến IoT & Trạm Thời tiết!', 'success');
  } else {
    if (badge) {
      badge.style.background = 'rgba(239,68,68,0.15)';
      badge.style.borderColor = 'rgba(239,68,68,0.4)';
      badge.style.color = '#ef4444';
    }
    if (text) text.textContent = 'TRẠM IOT ĐÃ TẮT (OFFLINE)';
    if (btn) {
      btn.style.background = '#64748b';
      btn.innerHTML = '<i data-lucide="power" class="lucide-sm"></i> Đã Tắt Trạm IoT';
    }
    toast('Đã tắt kết nối Trạm Cảm biến IoT.', 'info');
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Switch Sub-Tabs inside IoT Page
function switchIotTab(tab) {
  iotCurrentTab = tab;
  ['weather', 'soil', 'ai', 'devices'].forEach(t => {
    const pane = document.getElementById('iot-pane-' + t);
    const btn = document.getElementById('iot-tab-' + t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });

  if (tab === 'weather') {
    fetchDeviceWeatherTelemetry();
  } else if (tab === 'soil') {
    renderSoilMetrics(currentSoilDepth);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Switch Multi-depth Soil Sensors (10, 20, 30 cm)
function switchSoilDepth(depth) {
  currentSoilDepth = depth;
  [10, 20, 30].forEach(d => {
    const btn = document.getElementById(`soil-depth-btn-${d}`);
    if (btn) {
      if (d === depth) {
        btn.style.background = '#ffffff';
        btn.style.color = '#0f172a';
        btn.style.fontWeight = '800';
        btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = 'none';
      }
    }
  });
  renderSoilMetrics(depth);
}

// Render Soil Telemetry Cards based on Depth with International Lucide Icons
function renderSoilMetrics(depth) {
  const grid = document.getElementById('soil-metrics-grid');
  if (!grid) return;

  const data = soilDepthData[depth] || soilDepthData[10];

  grid.innerHTML = `
    <!-- Card 1: Soil pH -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="flask-conical" class="lucide-sm" style="color:#059669;"></i> Độ pH Đất (${depth} cm)
        </div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.ph}</div>
        <div style="font-size:12px; font-weight:700; color:${data.phColor}; margin-top:2px;">${data.phStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#ecfdf5; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#10b981; font-size:18px;">
          <i data-lucide="flask-conical" class="lucide-sm"></i>
        </div>
      </div>
    </div>

    <!-- Card 2: Soil Temp -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="thermometer" class="lucide-sm" style="color:#ea580c;"></i> Nhiệt độ đất (${depth} cm)
        </div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.temp} <small style="font-size:14px; color:#64748b;">°C</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.tempColor}; margin-top:2px;">${data.tempStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#fff7ed; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#ea580c; font-size:18px;">
          <i data-lucide="thermometer" class="lucide-sm"></i>
        </div>
      </div>
    </div>

    <!-- Card 3: Soil Moisture -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="droplet" class="lucide-sm" style="color:#0284c7;"></i> Độ ẩm đất (${depth} cm)
        </div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.humidity}%</div>
        <div style="font-size:12px; font-weight:700; color:${data.humColor}; margin-top:2px;">${data.humStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#f0f9ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#0284c7; font-size:18px;">
          <i data-lucide="droplet" class="lucide-sm"></i>
        </div>
      </div>
    </div>

    <!-- Card 4: Electrical Conductivity (EC) -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="zap" class="lucide-sm" style="color:#d97706;"></i> Độ dẫn điện EC (${depth} cm)
        </div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.ec} <small style="font-size:13px; color:#64748b;">mS/cm</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.ecColor}; margin-top:2px;">${data.ecStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#fef3c7; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#d97706; font-size:18px;">
          <i data-lucide="zap" class="lucide-sm"></i>
        </div>
      </div>
    </div>

    <!-- Card 5: NPK Content -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="sprout" class="lucide-sm" style="color:#3b82f6;"></i> Dinh dưỡng NPK (${depth} cm)
        </div>
        <div style="font-size:16px; font-weight:900; color:#0f172a; margin-top:6px;">${data.npk}</div>
        <div style="font-size:12px; font-weight:700; color:${data.npkColor}; margin-top:4px;">Hàm lượng Đạm-Lân-Kali dồi dào</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#eff6ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#3b82f6; font-size:18px;">
          <i data-lucide="sprout" class="lucide-sm"></i>
        </div>
      </div>
    </div>

    <!-- Card 6: Salinity -->
    <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
      <div>
        <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
          <i data-lucide="sparkles" class="lucide-sm" style="color:#64748b;"></i> Độ mặn của đất (${depth} cm)
        </div>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin-top:4px;">${data.salinity} <small style="font-size:13px; color:#64748b;">‰</small></div>
        <div style="font-size:12px; font-weight:700; color:${data.salColor}; margin-top:2px;">${data.salStatus}</div>
      </div>
      <div style="text-align:right; margin-top:12px;">
        <div style="width:42px; height:42px; background:#f1f5f9; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#64748b; font-size:18px;">
          <i data-lucide="sparkles" class="lucide-sm"></i>
        </div>
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Render Weather Hourly Temperature Trend Line Chart from Open-Meteo Hourly Data
function renderWeatherHourlyChart(hourlyData = null) {
  const canvas = document.getElementById('weather-hourly-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  let hours = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];
  let temps = [28, 28, 27, 27, 26, 26, 25, 25];

  if (hourlyData && hourlyData.time && hourlyData.temperature_2m) {
    const nowIso = new Date().toISOString().slice(0, 13); // Match YYYY-MM-DDTHH
    let curIdx = hourlyData.time.findIndex(t => t.startsWith(nowIso));
    if (curIdx === -1) curIdx = 0;

    const sliceTimes = hourlyData.time.slice(curIdx, curIdx + 8);
    const sliceTemps = hourlyData.temperature_2m.slice(curIdx, curIdx + 8);

    if (sliceTimes.length > 0) {
      hours = sliceTimes.map(t => {
        const d = new Date(t);
        const h = d.getHours();
        return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      });
      temps = sliceTemps.map(v => Math.round(v));
    }
  }

  if (weatherChartInstance) {
    weatherChartInstance.destroy();
    weatherChartInstance = null;
  }

  weatherChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [{
        label: 'Nhiệt độ (°C)',
        data: temps,
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.12)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#059669',
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` Nhiệt độ: ${ctx.raw}°C` }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10, weight: '700' } }, grid: { display: false } },
        y: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });
}

// Open Modal to Add Custom Warning Rule Condition
function openAddRuleModal() {
  const ruleName = prompt('Nhập tên Quy tắc Thuật toán Cảnh báo AI mới:');
  if (!ruleName) return;

  const ruleCond = prompt('Nhập điều kiện (VD: Độ ẩm đất 20cm < 50% AND Dự báo mưa > 30%):');
  if (!ruleCond) return;

  const ruleAction = prompt('Nhập hành động/khuyến nghị tự động:');
  if (!ruleAction) return;

  const rulesList = document.getElementById('iot-rules-list');
  if (!rulesList) return;

  const div = document.createElement('div');
  div.style.cssText = 'background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;';
  div.innerHTML = `
    <div>
      <div style="font-size:14px; font-weight:800; color:#0f172a;">${esc(ruleName)}</div>
      <div style="font-size:12px; color:#475569; margin-top:2px;">Điều kiện: <code>${esc(ruleCond)}</code></div>
      <div style="font-size:12px; color:#059669; margin-top:2px; font-weight:600;">Hành động: ${esc(ruleAction)}</div>
    </div>
    <div>
      <span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700;">ĐANG HOẠT ĐỘNG</span>
    </div>
  `;
  rulesList.insertBefore(div, rulesList.firstChild);
  toast('Đã thêm quy tắc thuật toán cảnh báo AI thành công!', 'success');
}

// Load devices table from backend PostgreSQL
async function loadDevices() {
  const tbody = document.getElementById('devices-table');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="loader-2" class="lucide-spin lucide-sm"></i> Đang tải danh sách thiết bị...</td></tr>';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  try {
    const devices = await api('/devices') || [];
    devicesCache = devices;
    filterDbDevices();
  } catch (err) {
    console.error('Lỗi tải danh sách thiết bị:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i data-lucide="alert-triangle" class="lucide-sm"></i> Lỗi: ${esc(err.message)}</td></tr>`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }
}

function updateIotKpis(devices) {
  const total = devices.length;
  const online = devices.filter(d => d.status !== 'Mất kết nối').length;
  const offline = devices.filter(d => d.status === 'Mất kết nối').length;
  const battGood = devices.filter(d => (d.battery_level === null || d.battery_level >= 80)).length;

  const totalEl = document.getElementById('kpi-iot-total');
  const onlineEl = document.getElementById('kpi-iot-online');
  const offlineEl = document.getElementById('kpi-iot-offline');
  const battEl = document.getElementById('kpi-iot-battery');

  if (totalEl) totalEl.textContent = total;
  if (onlineEl) onlineEl.textContent = online;
  if (offlineEl) offlineEl.textContent = offline;
  if (battEl) battEl.textContent = `${battGood}/${total}`;
}

function renderDevices(devices) {
  const tbody = document.getElementById('devices-table');
  if (!tbody) return;

  if (!devices || devices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i data-lucide="cpu" class="lucide-sm"></i> Không tìm thấy thiết bị nào phù hợp với bộ lọc. Nhấp "+ Đăng ký thiết bị mới" để thêm.</td></tr>';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    return;
  }

  tbody.innerHTML = devices.map(d => {
    let batteryIcon = 'battery';
    let batteryColor = '#059669';
    if (d.battery_level <= 20) { batteryIcon = 'battery-low'; batteryColor = '#dc2626'; }
    else if (d.battery_level <= 50) { batteryIcon = 'battery-medium'; batteryColor = '#d97706'; }

    let statusStyle = 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;';
    if (d.status === 'Mất kết nối') statusStyle = 'background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;';
    else if (d.status === 'Bảo trì') statusStyle = 'background:#fffbeb; color:#b45309; border:1px solid #fde68a;';

    return `
      <tr style="border-bottom:1px solid #f1f5f9; font-size:13px;">
        <td data-label="Thiết bị" style="padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:8px; background:#ecfdf5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">
              <i data-lucide="cpu" class="lucide-sm"></i>
            </div>
            <div>
              <div style="font-weight:800; color:#0f172a; font-size:13.5px;">${esc(d.name)}</div>
              <div style="font-size:11px; color:#64748b;">Node/IP: <code>${esc(d.ip_address || '192.168.1.100')}</code></div>
            </div>
          </div>
        </td>
        <td data-label="Phân loại"><span style="font-size:12px; font-weight:700; color:#334155; background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">${esc(d.device_type)}</span></td>
        <td data-label="Trang trại"><strong style="color:#059669; font-size:12.5px;"><i data-lucide="home" class="lucide-sm" style="font-size:11px;"></i> ${esc(d.farm_name || 'Toàn hệ thống')}</strong></td>
        <td data-label="Mức Pin">
          <span style="display:inline-flex; align-items:center; gap:5px; font-weight:700; color:${batteryColor}; font-size:12.5px;">
            <i data-lucide="${batteryIcon}" class="lucide-sm"></i> ${d.battery_level !== null ? d.battery_level : 100}%
          </span>
        </td>
        <td data-label="Trạng thái"><span class="badge" style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; ${statusStyle}">${esc(d.status || 'Hoạt động')}</span></td>
        <td data-label="Lần kết nối" style="font-size:11.5px; color:#64748b;">${d.last_connection ? new Date(d.last_connection).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) + ' ' + new Date(d.last_connection).toLocaleDateString('vi-VN') : 'Vừa cập nhật'}</td>
        <td data-label="Thao tác" style="text-align:center;">
          <div style="display:inline-flex; gap:6px;">
            <button class="btn btn-sm" onclick="openDeviceModal(${d.id})" title="Chỉnh sửa" style="padding:4px 8px; font-size:11px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; color:#0284c7; cursor:pointer;">
              <i data-lucide="edit-3" class="lucide-sm"></i>
            </button>
            <button class="btn btn-sm" onclick="deleteDevice(${d.id})" title="Xóa" style="padding:4px 8px; font-size:11px; background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; color:#dc2626; cursor:pointer;">
              <i data-lucide="trash-2" class="lucide-sm"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function filterDbDevices() {
  const farmVal = document.getElementById('db-iot-filter-farm')?.value || 'all';
  const typeVal = document.getElementById('db-iot-filter-type')?.value || 'all';
  const statusVal = document.getElementById('db-iot-filter-status')?.value || 'all';
  const searchVal = document.getElementById('db-iot-search-input')?.value.trim().toLowerCase() || '';

  const filtered = (devicesCache || []).filter(d => {
    const matchesFarm = (farmVal === 'all') || (d.farm_id == farmVal);
    const matchesType = (typeVal === 'all') || (d.device_type === typeVal);
    const matchesStatus = (statusVal === 'all') || (d.status === statusVal);
    const matchesSearch = !searchVal || 
      (d.name && d.name.toLowerCase().includes(searchVal)) || 
      (d.ip_address && d.ip_address.toLowerCase().includes(searchVal)) ||
      (d.device_type && d.device_type.toLowerCase().includes(searchVal));

    return matchesFarm && matchesType && matchesStatus && matchesSearch;
  });

  renderDevices(filtered);
  updateIotKpis(filtered);

  // When user changes farm filter, fetch live weather for that farm if on weather tab
  if (farmVal !== _cachedWeatherFarmId) {
    _cachedWeatherFarmId = farmVal;
    fetchDeviceWeatherTelemetry(farmVal);
  }
}

function filterDevices() {
  filterDbDevices();
}

window.initDevicesPage = initDevicesPage;
window.loadDbDevicesTab = initDevicesPage;
window.fetchDeviceWeatherTelemetry = fetchDeviceWeatherTelemetry;
window.toggleIotMasterPower = toggleIotMasterPower;
window.switchIotTab = switchIotTab;
window.switchSoilDepth = switchSoilDepth;
window.openAddRuleModal = openAddRuleModal;
window.loadDevices = loadDevices;
window.filterDevices = filterDevices;
window.filterDbDevices = filterDbDevices;
window.renderDevices = renderDevices;
window.updateIotKpis = updateIotKpis;

