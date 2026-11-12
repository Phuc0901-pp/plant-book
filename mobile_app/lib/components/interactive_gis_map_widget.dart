import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../pages/plant_detail_page.dart';
import 'loading_indicator.dart';

/// Component Bản đồ GIS Vệ Tinh Tương Tác dùng chung cho toàn bộ Mobile App
class InteractiveGisMapWidget extends StatefulWidget {
  final List<Farm> farms;
  final List<Plant> plants;
  final Plant? initialSelectedPlant;
  final Function(Plant plant)? onPlantTap;
  final double height;
  final bool showHeader;
  final bool showControls;
  final bool isFullscreen;
  final List<Farm>? allFarms;
  final Function(Farm farm)? onFarmChanged;

  const InteractiveGisMapWidget({
    super.key,
    required this.farms,
    required this.plants,
    this.initialSelectedPlant,
    this.onPlantTap,
    this.height = 360,
    this.showHeader = true,
    this.showControls = true,
    this.isFullscreen = false,
    this.allFarms,
    this.onFarmChanged,
  });

  @override
  State<InteractiveGisMapWidget> createState() => _InteractiveGisMapWidgetState();
}

class _InteractiveGisMapWidgetState extends State<InteractiveGisMapWidget> {
  WebViewController? _webViewController;
  bool _isLoading = true;
  String? _mapboxToken;
  Plant? _selectedPlant;

  @override
  void initState() {
    super.initState();
    _selectedPlant = widget.initialSelectedPlant;
    _initMap();
  }

  @override
  void didUpdateWidget(covariant InteractiveGisMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.plants != widget.plants || oldWidget.farms != widget.farms) {
      _initMap();
    }
  }

  Future<void> _initMap() async {
    setState(() => _isLoading = true);
    try {
      _mapboxToken = await ApiService().fetchMapboxToken();
      final html = _generateMapHtml();

      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF0F172A))
        ..addJavaScriptChannel(
          'PlantTapChannel',
          onMessageReceived: (message) {
            final plantId = int.tryParse(message.message);
            if (plantId != null) {
              final found = widget.plants.where((p) => p.id == plantId).toList();
              if (found.isNotEmpty) {
                final plant = found.first;
                setState(() => _selectedPlant = plant);
                if (widget.onPlantTap != null) {
                  widget.onPlantTap!(plant);
                } else {
                  _showPlantQuickBottomSheet(plant);
                }
              }
            }
          },
        )
        ..loadHtmlString(html);

      if (mounted) {
        setState(() {
          _webViewController = controller;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showPlantQuickBottomSheet(Plant plant) {
    final healthColor = plant.healthStatus.toLowerCase().contains('bệnh')
        ? AppTheme.red
        : (plant.healthStatus.toLowerCase().contains('chú ý') ? AppTheme.amber : AppTheme.green);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(color: Colors.black26, blurRadius: 15, offset: Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: AppTheme.grayBorder, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: healthColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: healthColor.withOpacity(0.3)),
                        ),
                        child: Icon(Icons.park_rounded, color: healthColor, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Cây #${plant.displayName}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppTheme.textMain),
                          ),
                          Text(
                            '${plant.plantType} ${plant.plantVariety != null ? "(${plant.plantVariety})" : ""}',
                            style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: healthColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: healthColor.withOpacity(0.4)),
                    ),
                    child: Text(
                      plant.healthStatus,
                      style: TextStyle(color: healthColor, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(color: AppTheme.grayBorder),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _infoTile(Icons.location_on_rounded, 'Vị trí', plant.location ?? 'Trong vườn'),
                  ),
                  Expanded(
                    child: _infoTile(Icons.calendar_today_rounded, 'Tuổi cây', '${plant.plantAge ?? "—"} năm'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _infoTile(Icons.water_drop_rounded, 'Tưới gần nhất', plant.lastWatered ?? 'Chưa ghi nhận'),
                  ),
                  Expanded(
                    child: _infoTile(Icons.verified_user_rounded, 'Cách ly PHI', (plant.phiRemainingDays ?? 0) > 0 ? '${plant.phiRemainingDays} ngày' : 'An Toàn'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => PlantDetailPage(plant: plant)),
                        );
                      },
                      icon: const Icon(Icons.info_outline_rounded, size: 18),
                      label: const Text('Xem Hồ Sơ 4-Tabs'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: AppTheme.greenDark, width: 1.2),
                        foregroundColor: AppTheme.greenDark,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => PlantDetailPage(plant: plant)),
                        );
                      },
                      icon: const Icon(Icons.edit_note_rounded, size: 18),
                      label: const Text('Ghi Nhật Ký'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        backgroundColor: AppTheme.greenDark,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppTheme.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted)),
              Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain), overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    );
  }

  String _generateMapHtml() {
    double centerLat = 10.9575; // Default reference coordinate
    double centerLng = 107.0850;

    final primaryFarm = widget.farms.isNotEmpty ? widget.farms.first : null;
    if (primaryFarm != null && primaryFarm.latitude != null && primaryFarm.longitude != null && primaryFarm.latitude != 0) {
      centerLat = primaryFarm.latitude!;
      centerLng = primaryFarm.longitude!;
    }

    // 1. Process Farm Boundary Polygon
    final List<dynamic> polygons = [];

    for (final farm in widget.farms) {
      List<dynamic> coords = [];
      if (farm.polygonCoordinates != null && farm.polygonCoordinates!.isNotEmpty) {
        try {
          final decoded = jsonDecode(farm.polygonCoordinates!);
          if (decoded is List) {
            coords = decoded;
          }
        } catch (_) {}
      }

      // If no custom polygon, generate a clean, realistic agricultural boundary around farm center (~120m x 90m)
      if (coords.isEmpty) {
        final fLat = farm.latitude ?? centerLat;
        final fLng = farm.longitude ?? centerLng;
        const dLat = 0.00050; // ~55m north/south
        const dLng = 0.00060; // ~66m east/west
        coords = [
          [fLng - dLng, fLat - dLat * 0.9],
          [fLng + dLng * 0.95, fLat - dLat],
          [fLng + dLng, fLat + dLat * 0.95],
          [fLng - dLng * 0.9, fLat + dLat],
          [fLng - dLng, fLat - dLat * 0.9],
        ];
      }

      polygons.add({
        'farm_id': farm.id,
        'farm_name': farm.name,
        'coords': coords,
      });
    }

    final String polygonsJson = jsonEncode(polygons);

    // 2. Process Plants: Align plants strictly inside the farm boundary!
    final List<Map<String, dynamic>> processedPlants = [];
    int cols = 6;
    if (widget.plants.length > 18) cols = 7;
    if (widget.plants.length > 36) cols = 9;

    for (int i = 0; i < widget.plants.length; i++) {
      final p = widget.plants[i];
      double pLat = centerLat;
      double pLng = centerLng;

      bool validPlantCoords = false;
      if (p.latitude != null && p.longitude != null && p.latitude != 0 && p.longitude != 0) {
        if (widget.farms.length <= 1) {
          // If viewing a single farm, detect if coordinates are an outlier from another province/mock seed
          final dLat = (p.latitude! - centerLat).abs();
          final dLng = (p.longitude! - centerLng).abs();
          // ~0.015 degrees is ~1.6km. Outlier plants outside 1.6km are automatically aligned into the farm grid
          if (dLat < 0.015 && dLng < 0.015) {
            validPlantCoords = true;
            pLat = p.latitude!;
            pLng = p.longitude!;
          }
        } else {
          validPlantCoords = true;
          pLat = p.latitude!;
          pLng = p.longitude!;
        }
      }

      if (!validPlantCoords) {
        // Auto-generate realistic agricultural grid coordinates neatly inside the farm plot
        final row = i ~/ cols;
        final col = i % cols;
        final totalRows = (widget.plants.length / cols).ceil().clamp(1, 100);
        final dLat = (row - (totalRows / 2.0) + 0.5) * 0.00010;
        final dLng = (col - (cols / 2.0) + 0.5) * 0.00011;
        pLat = centerLat + dLat;
        pLng = centerLng + dLng;
      }

      processedPlants.add({
        'id': p.id,
        'tree_code': p.displayName,
        'lat': pLat,
        'lng': pLng,
        'health': p.healthStatus,
        'plant_type': p.plantType,
        'variety': p.plantVariety ?? '',
      });
    }

    final String plantsJson = jsonEncode(processedPlants);
    final String token = _mapboxToken ?? '';

    return '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>GIS Satellite Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-user-select: none;
      user-select: none;
    }
    
    /* Tree Marker Styling */
    .tree-marker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
      font-size: 10px;
      font-weight: 800;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.4);
      cursor: pointer;
      transition: transform 0.15s ease-out;
    }
    .tree-marker:active {
      transform: scale(1.35);
    }
    .tree-marker.sick {
      background: linear-gradient(135deg, #EF4444, #DC2626);
      border-color: #FEE2E2;
      box-shadow: 0 2px 8px rgba(239,68,68,0.7);
    }
    .tree-marker.warn {
      background: linear-gradient(135deg, #F59E0B, #D97706);
      border-color: #FEF3C7;
      box-shadow: 0 2px 8px rgba(245,158,11,0.7);
    }
    
    /* Farm Boundary Label Badge */
    .farm-label {
      background: rgba(15, 23, 42, 0.92) !important;
      border: 1.5px solid #10B981 !important;
      border-radius: 8px !important;
      padding: 5px 10px !important;
      color: #34D399 !important;
      font-weight: 800 !important;
      font-size: 11.5px !important;
      letter-spacing: 0.2px !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5) !important;
    }
    .farm-label:before {
      border-top-color: #10B981 !important;
    }

    /* Boundary Corner Stake Marker */
    .boundary-stake {
      width: 12px;
      height: 12px;
      background: #F59E0B;
      border: 2px solid white;
      border-radius: 3px;
      transform: rotate(45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
    }

    /* GPS Live Radar */
    .user-pos-marker {
      width: 16px;
      height: 16px;
      background: #2563EB;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.4), 0 2px 8px rgba(0,0,0,0.5);
      animation: pulseRadar 2s infinite ease-out;
    }
    @keyframes pulseRadar {
      0% { box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.8), 0 2px 6px rgba(0,0,0,0.5); }
      70% { box-shadow: 0 0 0 16px rgba(37, 99, 235, 0), 0 2px 6px rgba(0,0,0,0.5); }
      100% { box-shadow: 0 0 0 2px rgba(37, 99, 235, 0), 0 2px 6px rgba(0,0,0,0.5); }
    }

    /* Map UI Controls Toolbar */
    .map-controls-toolbar {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ctrl-btn {
      background: rgba(15, 23, 42, 0.90);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.18);
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    .ctrl-btn:active {
      background: #1e293b;
      transform: scale(0.95);
    }

    /* Bottom GPS Button */
    .gps-btn {
      position: absolute;
      bottom: 16px;
      right: 14px;
      z-index: 1000;
      background: white;
      color: #064E3B;
      border: none;
      padding: 9px 15px;
      border-radius: 24px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .gps-btn:active { background: #f1f5f9; }

    /* Map Legend Pill */
    .legend-pill {
      position: absolute;
      bottom: 16px;
      left: 14px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 5px 12px;
      color: #94A3B8;
      font-size: 10.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Custom On-Map Zoom & Focus Controls -->
  <div class="map-controls-toolbar">
    <button class="ctrl-btn" onclick="map.zoomIn()" title="Phóng to">+</button>
    <button class="ctrl-btn" onclick="map.zoomOut()" title="Thu nhỏ">−</button>
    <button class="ctrl-btn" onclick="resetToFarm()" title="Trở về ranh giới vườn">🎯</button>
    <button class="ctrl-btn" onclick="toggleLayer()" title="Đổi kiểu bản đồ">🗺️</button>
  </div>

  <div class="legend-pill">
    <span class="legend-dot" style="background:#10B981;"></span> Khỏe
    <span class="legend-dot" style="background:#F59E0B;"></span> Chú ý
    <span class="legend-dot" style="background:#EF4444;"></span> Cần xử lý
  </div>

  <button class="gps-btn" onclick="locateUser()">
    <span>📍</span> Định vị tôi
  </button>

  <script>
    const center = [$centerLat, $centerLng];
    const plants = $plantsJson;
    const polygons = $polygonsJson;
    const mapboxToken = '$token';

    const map = L.map('map', {
      zoomControl: false,
      maxZoom: 22,
      minZoom: 13,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      tap: true
    }).setView(center, 18);

    // Satellite Imagery Layer
    let satelliteLayer;
    if (mapboxToken && mapboxToken.length > 10) {
      satelliteLayer = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=' + mapboxToken, {
        maxNativeZoom: 18,
        maxZoom: 22,
        tileSize: 512,
        zoomOffset: -1
      });
    } else {
      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18,
        maxZoom: 22
      });
    }
    satelliteLayer.addTo(map);

    // Street / Reference labels
    const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      maxNativeZoom: 18,
      maxZoom: 22,
      subdomains: 'abcd'
    }).addTo(map);

    // Street Maps Alternative Layer
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 22
    });

    let isSatellite = true;
    function toggleLayer() {
      if (isSatellite) {
        map.removeLayer(satelliteLayer);
        map.removeLayer(labelsLayer);
        streetLayer.addTo(map);
        isSatellite = false;
      } else {
        map.removeLayer(streetLayer);
        satelliteLayer.addTo(map);
        labelsLayer.addTo(map);
        isSatellite = true;
      }
    }

    const farmBounds = L.latLngBounds();
    let hasFarmPolygon = false;

    // Draw Farm Polygon Boundaries with High-Contrast VietGAP Aesthetics
    polygons.forEach(poly => {
      let coords = poly.coords;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch(e) { coords = []; }
      }
      if (Array.isArray(coords) && coords.length > 0) {
        const leafletCoords = coords.map(pt => [pt[1], pt[0]]);
        
        // Outer dark shadow boundary for crisp contrast on light satellite backgrounds
        L.polygon(leafletCoords, {
          color: '#064E3B',
          weight: 6,
          opacity: 0.7,
          fill: false
        }).addTo(map);

        // Solid Vivid Emerald Core Polygon
        const polyLayer = L.polygon(leafletCoords, {
          color: '#10B981',
          weight: 3.5,
          opacity: 1.0,
          fillColor: '#10B981',
          fillOpacity: 0.28
        }).addTo(map);

        if (poly.farm_name) {
          polyLayer.bindTooltip('🏡 ' + poly.farm_name + ' · Chuẩn VietGAP', {
            permanent: true,
            direction: 'top',
            className: 'farm-label'
          });
        }

        // Draw Corner Boundary Stakes (Đ1, Đ2, Đ3, Đ4...)
        coords.slice(0, coords.length - 1).forEach((pt, idx) => {
          const stakeIcon = L.divIcon({
            className: 'custom-stake-icon',
            html: '<div class="boundary-stake" title="Mốc ranh giới Đ' + (idx + 1) + '"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });
          L.marker([pt[1], pt[0]], { icon: stakeIcon }).addTo(map)
            .bindPopup('<div style="font-size:12px;font-weight:bold;color:#064E3B;">📍 Cột mốc ranh giới Đ' + (idx + 1) + '</div><div style="font-size:10px;color:#64748B;">Tọa độ: ' + Number(pt[1]).toFixed(6) + ', ' + Number(pt[0]).toFixed(6) + '</div>');
        });

        farmBounds.extend(polyLayer.getBounds());
        hasFarmPolygon = true;
      }
    });

    // Draw Digital Tree Markers
    plants.forEach(plant => {
      if (plant.lat && plant.lng) {
        let healthClass = '';
        const h = (plant.health || '').toLowerCase();
        if (h.includes('bệnh')) healthClass = 'sick';
        else if (h.includes('chú ý')) healthClass = 'warn';

        const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="tree-marker ' + healthClass + '">' + plant.tree_code + '</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([plant.lat, plant.lng], { icon: customIcon }).addTo(map);
        marker.on('click', function() {
          if (window.PlantTapChannel) {
            window.PlantTapChannel.postMessage(String(plant.id));
          }
        });
      }
    });

    // Fit strictly to Farm Polygon Boundary to guarantee razor-sharp zoom into the property
    if (hasFarmPolygon && farmBounds.isValid()) {
      map.fitBounds(farmBounds, { padding: [35, 35], maxZoom: 18 });
    } else {
      map.setView(center, 18);
    }

    function resetToFarm() {
      if (hasFarmPolygon && farmBounds.isValid()) {
        map.fitBounds(farmBounds, { padding: [35, 35], maxZoom: 18 });
      } else {
        map.flyTo(center, 18);
      }
    }

    let userMarker = null;
    function locateUser() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            
            if (userMarker) map.removeLayer(userMarker);
            
            const userIcon = L.divIcon({
              className: 'gps-user-icon',
              html: '<div class="user-pos-marker"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);
            userMarker.bindPopup('<div style="font-size:12px;font-weight:bold;color:#064E3B;padding:2px;">📍 Vị trí thực địa của bạn</div><div style="font-size:10px;color:#64748B;">Đang đứng tại: ' + userLat.toFixed(6) + ', ' + userLng.toFixed(6) + '</div>').openPopup();
            map.flyTo([userLat, userLng], 19, { animate: true });
          },
          function(err) {
            alert('Không thể định vị GPS: ' + err.message);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        alert('Thiết bị không hỗ trợ Geolocation.');
      }
    }
  </script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    final mapWidget = Container(
      height: widget.isFullscreen ? double.infinity : widget.height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: widget.isFullscreen ? BorderRadius.zero : BorderRadius.circular(16),
        border: widget.isFullscreen ? null : Border.all(color: AppTheme.grayBorder, width: 1.2),
        boxShadow: widget.isFullscreen ? null : [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 3)),
        ],
      ),
      child: ClipRRect(
        borderRadius: widget.isFullscreen ? BorderRadius.zero : BorderRadius.circular(16),
        child: _isLoading || _webViewController == null
            ? const Center(child: LoadingIndicator(message: 'Đang tải bản đồ GIS vệ tinh...'))
            : WebViewWidget(
                controller: _webViewController!,
                gestureRecognizers: {
                  Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
                },
              ),
      ),
    );

    if (widget.isFullscreen) {
      return mapWidget;
    }

    return Stack(
      children: [
        mapWidget,
        // Nút mở rộng Toàn màn hình (Fullscreen Button)
        Positioned(
          top: 12,
          right: 12,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => GisMapFullScreenPage(
                      farms: widget.farms,
                      allFarms: widget.allFarms ?? widget.farms,
                      plants: widget.plants,
                      onPlantTap: widget.onPlantTap,
                      onFarmChanged: widget.onFarmChanged,
                    ),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withOpacity(0.88),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white24, width: 1),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.35), blurRadius: 8, offset: const Offset(0, 2)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.fullscreen_rounded, color: Colors.white, size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Toàn màn hình',
                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Màn hình Bản đồ GIS Vệ Tinh Toàn Màn Hình (Fullscreen GIS Experience)
class GisMapFullScreenPage extends StatefulWidget {
  final List<Farm> farms;
  final List<Farm> allFarms;
  final List<Plant> plants;
  final Function(Plant plant)? onPlantTap;
  final Function(Farm farm)? onFarmChanged;

  const GisMapFullScreenPage({
    super.key,
    required this.farms,
    required this.allFarms,
    required this.plants,
    this.onPlantTap,
    this.onFarmChanged,
  });

  @override
  State<GisMapFullScreenPage> createState() => _GisMapFullScreenPageState();
}

class _GisMapFullScreenPageState extends State<GisMapFullScreenPage> {
  late Farm _activeFarm;
  late List<Plant> _activePlants;

  @override
  void initState() {
    super.initState();
    _activeFarm = widget.farms.isNotEmpty ? widget.farms.first : (widget.allFarms.isNotEmpty ? widget.allFarms.first : Farm(id: 1, name: 'Trang trại Nông hộ', area: 1.0));
    _activePlants = widget.plants;
  }

  void _onSelectFarm(Farm farm) {
    setState(() {
      _activeFarm = farm;
      _activePlants = widget.plants.where((p) => p.farmId == farm.id || (widget.allFarms.length <= 1 && farm.id == 1)).toList();
    });
    if (widget.onFarmChanged != null) {
      widget.onFarmChanged!(farm);
    }
  }

  @override
  Widget build(BuildContext context) {
    final healthyCount = _activePlants.where((p) => !p.healthStatus.toLowerCase().contains('bệnh') && !p.healthStatus.toLowerCase().contains('chú ý')).length;
    final warningCount = _activePlants.where((p) => p.healthStatus.toLowerCase().contains('chú ý')).length;
    final sickCount = _activePlants.where((p) => p.healthStatus.toLowerCase().contains('bệnh')).length;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF064E3B),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _activeFarm.name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
              overflow: TextOverflow.ellipsis,
            ),
            const Text(
              'Bản đồ GIS Vệ Tinh Độ Phân Giải Cao · VietGAP',
              style: TextStyle(fontSize: 10.5, color: Color(0xFF6EE7B7), fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          if (widget.allFarms.length > 1)
            PopupMenuButton<Farm>(
              icon: const Icon(Icons.swap_horiz_rounded, color: Colors.white),
              tooltip: 'Đổi vườn',
              onSelected: _onSelectFarm,
              itemBuilder: (ctx) => widget.allFarms.map((f) => PopupMenuItem<Farm>(
                value: f,
                child: Row(
                  children: [
                    Icon(
                      f.id == _activeFarm.id ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                      size: 16,
                      color: f.id == _activeFarm.id ? AppTheme.greenDark : AppTheme.textMuted,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(f.name, style: TextStyle(fontWeight: f.id == _activeFarm.id ? FontWeight.bold : FontWeight.normal))),
                  ],
                ),
              )).toList(),
            ),
        ],
      ),
      body: Stack(
        children: [
          InteractiveGisMapWidget(
            farms: [_activeFarm],
            plants: _activePlants,
            height: double.infinity,
            isFullscreen: true,
            onPlantTap: widget.onPlantTap,
          ),
          // Top Floating Stats Pill
          Positioned(
            top: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withOpacity(0.92),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white24, width: 0.8),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 8, offset: const Offset(0, 2)),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.park_rounded, color: Color(0xFF34D399), size: 14),
                  const SizedBox(width: 5),
                  Text(
                    '${_activePlants.length} cây',
                    style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(width: 8),
                  Container(width: 1, height: 12, color: Colors.white24),
                  const SizedBox(width: 8),
                  Text('🟢 $healthyCount', style: const TextStyle(color: Colors.white, fontSize: 10.5)),
                  if (warningCount > 0) ...[
                    const SizedBox(width: 6),
                    Text('🟡 $warningCount', style: const TextStyle(color: Colors.white, fontSize: 10.5)),
                  ],
                  if (sickCount > 0) ...[
                    const SizedBox(width: 6),
                    Text('🔴 $sickCount', style: const TextStyle(color: Colors.white, fontSize: 10.5)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
