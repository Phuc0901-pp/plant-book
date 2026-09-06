/**
 * backend/services/weatherService.js
 * Comprehensive Open-Meteo Weather Service, WMO Interpretation Engine & Agro-Advisory System
 */

// WMO Weather Interpretation Codes (WW)
const WMO_WEATHER_MAP = {
  0: { code: 0, label: 'Trời nắng trong xanh', icon: 'fa-solid fa-sun', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', category: 'clear' },
  1: { code: 1, label: 'Trời quang, ít mây', icon: 'fa-solid fa-cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', category: 'partly_cloudy' },
  2: { code: 2, label: 'Mây rải rác', icon: 'fa-solid fa-cloud-sun', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', category: 'partly_cloudy' },
  3: { code: 3, label: 'Trời nhiều mây âm u', icon: 'fa-solid fa-cloud', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', category: 'cloudy' },
  45: { code: 45, label: 'Sương mù sáng sớm', icon: 'fa-solid fa-smog', color: '#cbd5e1', bg: 'rgba(203,213,225,0.15)', category: 'fog' },
  48: { code: 48, label: 'Sương mù đọng sương', icon: 'fa-solid fa-smog', color: '#cbd5e1', bg: 'rgba(203,213,225,0.15)', category: 'fog' },
  51: { code: 51, label: 'Mưa phùn nhẹ', icon: 'fa-solid fa-cloud-rain', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', category: 'drizzle' },
  53: { code: 53, label: 'Mưa phùn vừa', icon: 'fa-solid fa-cloud-rain', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', category: 'drizzle' },
  55: { code: 55, label: 'Mưa phùn hạt nặng', icon: 'fa-solid fa-cloud-rain', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', category: 'drizzle' },
  61: { code: 61, label: 'Mưa rào nhẹ', icon: 'fa-solid fa-cloud-showers-heavy', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', category: 'rain' },
  63: { code: 63, label: 'Mưa rào vừa', icon: 'fa-solid fa-cloud-showers-heavy', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', category: 'rain' },
  65: { code: 65, label: 'Mưa to nặng hạt', icon: 'fa-solid fa-cloud-showers-heavy', color: '#1d4ed8', bg: 'rgba(29,78,216,0.2)', category: 'heavy_rain' },
  80: { code: 80, label: 'Mưa rào thoáng qua', icon: 'fa-solid fa-cloud-sun-rain', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', category: 'rain_shower' },
  81: { code: 81, label: 'Mưa rào từng cơn', icon: 'fa-solid fa-cloud-showers-heavy', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', category: 'rain_shower' },
  82: { code: 82, label: 'Mưa rất to xối xả', icon: 'fa-solid fa-cloud-showers-water', color: '#1e40af', bg: 'rgba(30,64,175,0.25)', category: 'heavy_rain' },
  95: { code: 95, label: 'Mưa dông, sấm sét', icon: 'fa-solid fa-bolt-lightning', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', category: 'thunderstorm' },
  96: { code: 96, label: 'Dông lốc kèm mưa đá nhẹ', icon: 'fa-solid fa-cloud-bolt', color: '#ea580c', bg: 'rgba(234,88,12,0.2)', category: 'thunderstorm' },
  99: { code: 99, label: 'Dông mạnh kèm mưa đá lớn', icon: 'fa-solid fa-cloud-bolt', color: '#dc2626', bg: 'rgba(220,38,38,0.25)', category: 'thunderstorm' }
};

const DEFAULT_WMO = {
  code: 0,
  label: 'Trời quang đãng',
  icon: 'fa-solid fa-sun',
  color: '#fbbf24',
  bg: 'rgba(251,191,36,0.15)',
  category: 'clear'
};

const WIND_DIRECTIONS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];

/**
 * Convert degree angles (0 - 360) to Vietnamese compass directions
 */
function getWindDirection(deg) {
  if (deg === undefined || deg === null || isNaN(deg)) return 'Gió nhẹ';
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return WIND_DIRECTIONS[index];
}

/**
 * Get WMO Weather code metadata
 */
function getWmoWeatherInfo(code) {
  return WMO_WEATHER_MAP[code] || DEFAULT_WMO;
}

/**
 * Build Open-Meteo REST API forecast URL
 */
function buildOpenMeteoUrl(lat, lng) {
  const latitude = parseFloat(lat) || 10.2415;
  const longitude = parseFloat(lng) || 106.3752;
  const currentParams = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'uv_index'
  ].join(',');

  const dailyParams = [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max'
  ].join(',');

  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${currentParams}&daily=${dailyParams}&timezone=auto`;
}

/**
 * Generate Smart Agricultural Action Recommendation based on real-time weather metrics
 */
function getAgriRecommendation(metrics = {}) {
  const rainProb = metrics.rainProb ?? 0;
  const temp = metrics.temp ?? 30;
  const humidity = metrics.humidity ?? 75;
  const windSpeed = metrics.windSpeed ?? 10;

  if (rainProb >= 60) {
    return {
      type: 'warning',
      badge: 'Cảnh báo mưa',
      tip: '⚠️ Khả năng mưa cao: Cân nhắc hoãn phun thuốc BVTV và bón phân để tránh bị rửa trôi.',
      actionAdvice: 'Tạm hoãn bón phân / phun thuốc bảo vệ thực vật'
    };
  }
  
  if (temp >= 34) {
    return {
      type: 'warning',
      badge: 'Nắng nóng cao',
      tip: '☀️ Nắng nóng gay gắt: Khuyến nghị tăng lượng tưới giữ ẩm đất và phun sương làm mát tán.',
      actionAdvice: 'Tăng cường tưới nhỏ giọt / làm mát gốc cây'
    };
  }

  if (humidity >= 85) {
    return {
      type: 'info',
      badge: 'Ẩm độ cao',
      tip: '💧 Độ ẩm không khí cao: Chú ý kiểm tra nấm bệnh và sâu rầy trên đọt non.',
      actionAdvice: 'Kiểm tra rầy xanh, thán thư, nấm phytophthora'
    };
  }

  if (windSpeed >= 30) {
    return {
      type: 'warning',
      badge: 'Gió mạnh',
      tip: '💨 Gió cấp lớn: Chú ý chằng chống cành sầu riêng đang mang trái.',
      actionAdvice: 'Chằng néo cành nhánh cây ăn trái'
    };
  }

  return {
    type: 'success',
    badge: 'Thời tiết tốt',
    tip: 'Thời tiết thuận lợi cho việc chăm sóc cây trồng và theo dõi độ ẩm đất.',
    actionAdvice: 'Tiến hành chăm sóc, bón phân định kỳ bình thường'
  };
}

/**
 * Parse raw Open-Meteo API JSON response into standardized format
 */
function parseMeteoResponse(data = {}, locationName = 'Vườn mẫu Tân Bảo Agtech') {
  const current = data.current || {};
  const daily = data.daily || {};

  const temp = Math.round(current.temperature_2m ?? 29);
  const feelLike = Math.round(current.apparent_temperature ?? temp);
  const humidity = Math.round(current.relative_humidity_2m ?? 75);
  const windSpeed = Math.round(current.wind_speed_10m ?? 12);
  const windDirectionDeg = current.wind_direction_10m ?? 90;
  const windDir = getWindDirection(windDirectionDeg);
  
  const uvNum = current.uv_index !== undefined ? Number(current.uv_index) : 4.5;
  const uv = isNaN(uvNum) ? '4.5' : uvNum.toFixed(1);
  
  const rainProb = daily.precipitation_probability_max?.[0] !== undefined 
    ? Number(daily.precipitation_probability_max[0]) 
    : 15;
  const tempMax = daily.temperature_2m_max?.[0] !== undefined 
    ? Math.round(daily.temperature_2m_max[0]) 
    : temp + 3;
  const tempMin = daily.temperature_2m_min?.[0] !== undefined 
    ? Math.round(daily.temperature_2m_min[0]) 
    : temp - 4;

  const weatherCode = current.weather_code ?? 0;
  const wmo = getWmoWeatherInfo(weatherCode);

  const agro = getAgriRecommendation({ rainProb, temp, humidity, windSpeed });

  return {
    success: true,
    source: 'open_meteo',
    timestamp: Date.now(),
    location: locationName,
    metrics: {
      temp,
      feelLike,
      tempMax,
      tempMin,
      humidity,
      windSpeed,
      windDirectionDeg,
      windDir,
      uv,
      uvStatus: parseFloat(uv) > 6 ? 'Cao' : 'An toàn',
      rainProb,
      weatherCode,
      wmo
    },
    agro
  };
}

/**
 * Generate a realistic Agronomic Baseline Fallback when Open-Meteo is 503 or offline
 */
function getFallbackWeather(lat, lng, locationName = 'Vùng Nông nghiệp Trọng điểm (Bến Tre)') {
  const now = new Date();
  const hour = now.getHours();

  // Realistic diurnal temperature cycle in Southern Vietnam (25°C at dawn to 33°C at noon)
  let estimatedTemp = 28;
  if (hour >= 6 && hour <= 10) estimatedTemp = 28 + (hour - 6) * 1.2;
  else if (hour > 10 && hour <= 15) estimatedTemp = 32.5;
  else if (hour > 15 && hour <= 18) estimatedTemp = 30;
  else estimatedTemp = 26;

  const roundedTemp = Math.round(estimatedTemp);
  const wmo = getWmoWeatherInfo(1); // Trời quang, ít mây

  return {
    success: true,
    source: 'climatology_fallback',
    timestamp: Date.now(),
    location: locationName,
    isFallback: true,
    fallbackReason: 'Mạng khí tượng dự phòng (Open-Meteo 503 / Offline)',
    metrics: {
      temp: roundedTemp,
      feelLike: roundedTemp + 1,
      tempMax: roundedTemp + 3,
      tempMin: roundedTemp - 4,
      humidity: 78,
      windSpeed: 11,
      windDirectionDeg: 90,
      windDir: 'Đông',
      uv: '4.5',
      uvStatus: 'An toàn',
      rainProb: 20,
      weatherCode: 1,
      wmo
    },
    agro: getAgriRecommendation({ rainProb: 20, temp: roundedTemp, humidity: 78, windSpeed: 11 })
  };
}

module.exports = {
  WMO_WEATHER_MAP,
  DEFAULT_WMO,
  WIND_DIRECTIONS,
  getWindDirection,
  getWmoWeatherInfo,
  buildOpenMeteoUrl,
  getAgriRecommendation,
  parseMeteoResponse,
  getFallbackWeather
};
