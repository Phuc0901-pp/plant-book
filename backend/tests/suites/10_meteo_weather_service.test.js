const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');
const weatherService = require('../../services/weatherService');

describe('Suite 10: Open-Meteo Weather API Integration, WMO Interpretation & Fault-Tolerant Resilience', () => {

  it('10.1 Should construct valid Open-Meteo REST forecast URL with precision GPS coordinates and parameters', () => {
    const lat = 10.7298298;
    const lng = 106.6983212;
    const url = weatherService.buildOpenMeteoUrl(lat, lng);

    expect(typeof url).toBe('string');
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast')).toBe(true);
    expect(url.includes(`latitude=${lat}`)).toBe(true);
    expect(url.includes(`longitude=${lng}`)).toBe(true);
    expect(url.includes('temperature_2m')).toBe(true);
    expect(url.includes('relative_humidity_2m')).toBe(true);
    expect(url.includes('apparent_temperature')).toBe(true);
    expect(url.includes('precipitation')).toBe(true);
    expect(url.includes('weather_code')).toBe(true);
    expect(url.includes('wind_speed_10m')).toBe(true);
    expect(url.includes('wind_direction_10m')).toBe(true);
    expect(url.includes('uv_index')).toBe(true);
    expect(url.includes('precipitation_probability_max')).toBe(true);
    expect(url.includes('timezone=auto')).toBe(true);
  });

  it('10.2 Should accurately decode WMO Weather codes (0..99) with icons, Vietnamese labels and safe fallback', () => {
    // 0 = Sunny
    const wmo0 = weatherService.getWmoWeatherInfo(0);
    expect(wmo0.label).toBe('Trời nắng trong xanh');
    expect(wmo0.icon).toBe('fa-solid fa-sun');
    expect(wmo0.category).toBe('clear');

    // 2 = Partly Cloudy
    const wmo2 = weatherService.getWmoWeatherInfo(2);
    expect(wmo2.label).toBe('Mây rải rác');
    expect(wmo2.category).toBe('partly_cloudy');

    // 65 = Heavy Rain
    const wmo65 = weatherService.getWmoWeatherInfo(65);
    expect(wmo65.label).toBe('Mưa to nặng hạt');
    expect(wmo65.category).toBe('heavy_rain');

    // 95 = Thunderstorm
    const wmo95 = weatherService.getWmoWeatherInfo(95);
    expect(wmo95.label).toBe('Mưa dông, sấm sét');
    expect(wmo95.icon).toBe('fa-solid fa-bolt-lightning');

    // 99 = Severe Thunderstorm with Hail
    const wmo99 = weatherService.getWmoWeatherInfo(99);
    expect(wmo99.label).toBe('Dông mạnh kèm mưa đá lớn');

    // Unknown code fallback
    const wmoUnknown = weatherService.getWmoWeatherInfo(999);
    expect(wmoUnknown.label).toBe('Trời quang đãng');
    expect(wmoUnknown.icon).toBe('fa-solid fa-sun');
  });

  it('10.3 Should accurately convert wind degrees into 8 Vietnamese compass directions', () => {
    expect(weatherService.getWindDirection(0)).toBe('Bắc');
    expect(weatherService.getWindDirection(360)).toBe('Bắc');
    expect(weatherService.getWindDirection(45)).toBe('Đông Bắc');
    expect(weatherService.getWindDirection(90)).toBe('Đông');
    expect(weatherService.getWindDirection(135)).toBe('Đông Nam');
    expect(weatherService.getWindDirection(180)).toBe('Nam');
    expect(weatherService.getWindDirection(225)).toBe('Tây Nam');
    expect(weatherService.getWindDirection(270)).toBe('Tây');
    expect(weatherService.getWindDirection(315)).toBe('Tây Bắc');
    expect(weatherService.getWindDirection(null)).toBe('Gió nhẹ');
    expect(weatherService.getWindDirection(undefined)).toBe('Gió nhẹ');
  });

  it('10.4 Should generate accurate Agricultural Action Recommendations based on weather thresholds', () => {
    // Rain condition (>= 60%)
    const rainAgro = weatherService.getAgriRecommendation({ rainProb: 75, temp: 28, humidity: 80, windSpeed: 12 });
    expect(rainAgro.type).toBe('warning');
    expect(rainAgro.tip.includes('hoãn phun thuốc BVTV và bón phân')).toBe(true);

    // Extreme Heat (>= 34°C)
    const heatAgro = weatherService.getAgriRecommendation({ rainProb: 10, temp: 36, humidity: 60, windSpeed: 8 });
    expect(heatAgro.type).toBe('warning');
    expect(heatAgro.tip.includes('Nắng nóng gay gắt')).toBe(true);
    expect(heatAgro.tip.includes('tăng lượng tưới')).toBe(true);

    // High Humidity (>= 85%)
    const humidAgro = weatherService.getAgriRecommendation({ rainProb: 20, temp: 29, humidity: 90, windSpeed: 6 });
    expect(humidAgro.type).toBe('info');
    expect(humidAgro.tip.includes('nấm bệnh và sâu rầy')).toBe(true);

    // Strong Wind (>= 30 km/h)
    const windAgro = weatherService.getAgriRecommendation({ rainProb: 15, temp: 30, humidity: 70, windSpeed: 35 });
    expect(windAgro.type).toBe('warning');
    expect(windAgro.tip.includes('chằng chống cành sầu riêng')).toBe(true);

    // Normal favorable weather
    const normalAgro = weatherService.getAgriRecommendation({ rainProb: 15, temp: 30, humidity: 72, windSpeed: 10 });
    expect(normalAgro.type).toBe('success');
    expect(normalAgro.tip.includes('Thời tiết thuận lợi')).toBe(true);
  });

  it('10.5 Should parse full Open-Meteo sample payload into standardized agro-weather telemetry', () => {
    const mockOpenMeteoResponse = {
      latitude: 10.24,
      longitude: 106.38,
      current: {
        time: '2026-09-06T13:30',
        temperature_2m: 31.4,
        relative_humidity_2m: 72,
        apparent_temperature: 36.2,
        precipitation: 0.0,
        weather_code: 2,
        wind_speed_10m: 14.5,
        wind_direction_10m: 135,
        uv_index: 7.8
      },
      daily: {
        time: ['2026-09-06'],
        temperature_2m_max: [34.0],
        temperature_2m_min: [25.5],
        precipitation_probability_max: [40]
      }
    };

    const parsed = weatherService.parseMeteoResponse(mockOpenMeteoResponse, 'Nông trại Tân Bảo Chợ Lách');

    expect(parsed.success).toBe(true);
    expect(parsed.source).toBe('open_meteo');
    expect(parsed.location).toBe('Nông trại Tân Bảo Chợ Lách');
    expect(parsed.metrics.temp).toBe(31);
    expect(parsed.metrics.feelLike).toBe(36);
    expect(parsed.metrics.humidity).toBe(72);
    expect(parsed.metrics.windSpeed).toBe(15);
    expect(parsed.metrics.windDir).toBe('Đông Nam'); // 110 deg ~ Dong Nam
    expect(parsed.metrics.uv).toBe('7.8');
    expect(parsed.metrics.uvStatus).toBe('Cao');
    expect(parsed.metrics.rainProb).toBe(40);
    expect(parsed.metrics.tempMax).toBe(34);
    expect(parsed.metrics.tempMin).toBe(26);
    expect(parsed.metrics.wmo.label).toBe('Mây rải rác');
    expect(typeof parsed.agro.tip).toBe('string');
  });

  it('10.6 Should provide resilient Climatological Fallback on Open-Meteo HTTP 503 / Network Outage', () => {
    const fallback = weatherService.getFallbackWeather(10.24, 106.38, 'Trang trại Bến Tre');

    expect(fallback.success).toBe(true);
    expect(fallback.source).toBe('climatology_fallback');
    expect(fallback.isFallback).toBe(true);
    expect(fallback.fallbackReason.includes('503')).toBe(true);
    expect(fallback.metrics.temp).toBeGreaterThanOrEqual(24);
    expect(fallback.metrics.temp).toBeLessThanOrEqual(36);
    expect(fallback.metrics.humidity).toBe(78);
    expect(fallback.metrics.wmo.code).toBe(1);
    expect(fallback.agro.type).toBe('success');
  });

  it('10.7 Should verify Frontend Weather Widget file exists and contains Local Cache & Resilience mechanisms', () => {
    const widgetPath = path.join(__dirname, '../../../frontend/user/js/modules/weather-clock.js');
    expect(fs.existsSync(widgetPath)).toBe(true);

    const content = fs.readFileSync(widgetPath, 'utf8');
    expect(content.includes('localStorage')).toBe(true);
    expect(content.includes('tanbao_cached_weather')).toBe(true);
    expect(content.includes('WMO_WEATHER_MAP')).toBe(true);
    expect(content.includes('refreshDeviceWeather')).toBe(true);
    expect(content.includes('startLiveClock')).toBe(true);
  });

});
