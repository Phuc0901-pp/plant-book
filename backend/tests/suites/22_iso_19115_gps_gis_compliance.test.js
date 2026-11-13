/* ═══════════════════════════════════════════════════════════════════════════
   SUITE 22: ISO 19111 / ISO 19115 / ISO 19157 / RFC 7946 GPS & GIS COMPLIANCE
   Kiểm định chuẩn dữ liệu không gian, tọa độ WGS 84, GeoJSON Polygon & PostGIS
   ═══════════════════════════════════════════════════════════════════════════ */
const { describe, it, expect } = require('../test-framework');
const fs = require('fs');
const path = require('path');

const {
  WGS84_SRID,
  WGS84_CRS_URN,
  normalizeGpsPayload,
  validateGeoJsonPolygon,
} = require('../../utils/geoIsoValidator');

const rootDir = path.resolve(__dirname, '../../..');

describe('Suite 22: ISO 19111 / ISO 19115 / RFC 7946 GPS & GIS Compliance', () => {
  it('22.1 [ISO-19111/19115] normalizeGpsPayload normalizes flat & nested GPS payloads with UTC timestamp & EPSG:4326', () => {
    const flatRes = normalizeGpsPayload({
      latitude: 10.94152,
      longitude: 107.24185,
      gps_accuracy: 3.4,
      gps_altitude: 42.5,
    });
    expect(flatRes.valid).toBe(true);
    expect(flatRes.hasCoordinates).toBe(true);
    expect(flatRes.data.gps_srid).toBe(WGS84_SRID);
    expect(flatRes.data.crs).toBe(WGS84_CRS_URN);
    expect(flatRes.data.gps_accuracy).toBe(3.4);
    expect(flatRes.data.gps_altitude).toBe(42.5);
    expect(typeof flatRes.data.gps_captured_at).toBe('string');

    const nestedRes = normalizeGpsPayload({
      gps: {
        latitude: 10.776889,
        longitude: 106.700806,
        accuracy: 2.1,
        altitude: 12.0,
        captured_at: '2026-11-13T04:00:00.000Z',
        srid: 4326,
      },
    });
    expect(nestedRes.valid).toBe(true);
    expect(nestedRes.data.gps_captured_at).toBe('2026-11-13T04:00:00.000Z');
  });

  it('22.2 [ISO-19157] normalizeGpsPayload rejects out-of-bounds WGS 84 coords, negative accuracy & non-4326 SRID', () => {
    expect(normalizeGpsPayload({ latitude: 95, longitude: 106 }).valid).toBe(false);
    expect(normalizeGpsPayload({ latitude: 10, longitude: 185 }).valid).toBe(false);
    expect(normalizeGpsPayload({ latitude: 10, longitude: 106, gps_accuracy: -1 }).valid).toBe(false);
    expect(normalizeGpsPayload({ latitude: 10, longitude: 106, gps_srid: 3857 }).valid).toBe(false);
    expect(normalizeGpsPayload({ latitude: 10 }).valid).toBe(false);
  });

  it('22.3 [RFC-7946] validateGeoJsonPolygon enforces closed ring & WGS 84 bounds for GeoJSON and legacy arrays', () => {
    const validGeoJson = {
      type: 'Polygon',
      coordinates: [[
        [107.241, 10.941],
        [107.242, 10.941],
        [107.242, 10.942],
        [107.241, 10.941],
      ]],
    };
    const okGeo = validateGeoJsonPolygon(validGeoJson);
    expect(okGeo.valid).toBe(true);
    expect(okGeo.format).toBe('geojson');

    const unclosedGeoJson = {
      type: 'Polygon',
      coordinates: [[
        [107.241, 10.941],
        [107.242, 10.941],
        [107.242, 10.942],
        [107.241, 10.942],
      ]],
    };
    expect(validateGeoJsonPolygon(unclosedGeoJson).valid).toBe(false);

    const legacyOk = validateGeoJsonPolygon([[10.941, 107.241], [10.942, 107.242]]);
    expect(legacyOk.valid).toBe(true);
    expect(legacyOk.format).toBe('legacy_array');

    const legacyBad = validateGeoJsonPolygon([[10.941, 220.0]]);
    expect(legacyBad.valid).toBe(false);
  });

  it('22.4 [BE-GPS-WIRE] Backend plants.js & farms.js integrate geoIsoValidator & Mobile api_service.dart sends ISO 19115 metadata', () => {
    const plantsJs = fs.readFileSync(path.join(rootDir, 'backend/routes/plants.js'), 'utf8');
    const farmsJs = fs.readFileSync(path.join(rootDir, 'backend/routes/farms.js'), 'utf8');
    const migrationSql = fs.readFileSync(path.join(rootDir, 'backend/db/migrations/011_iso_19115_gps_gis_hardening.sql'), 'utf8');
    const apiDart = fs.readFileSync(path.join(rootDir, 'mobile_app/lib/services/api_service.dart'), 'utf8');

    expect(plantsJs.includes('normalizeGpsPayload')).toBe(true);
    expect(plantsJs.includes('gps_srid')).toBe(true);
    expect(farmsJs.includes('validateGeoJsonPolygon')).toBe(true);
    expect(migrationSql.includes('CREATE EXTENSION IF NOT EXISTS postgis')).toBe(true);
    expect(migrationSql.includes('idx_plants_postgis_gist')).toBe(true);
    expect(apiDart.includes("'gps_srid': 4326")).toBe(true);
    expect(apiDart.includes("'gps_captured_at'")).toBe(true);
  });
});
