import 'dart:convert';
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

  const InteractiveGisMapWidget({
    super.key,
    required this.farms,
    required this.plants,
    this.initialSelectedPlant,
    this.onPlantTap,
    this.height = 360,
    this.showHeader = true,
    this.showControls = true,
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
    double centerLat = 12.6800;
    double centerLng = 108.0300;

    if (widget.farms.isNotEmpty && widget.farms.first.latitude != null && widget.farms.first.longitude != null) {
      centerLat = widget.farms.first.latitude!;
      centerLng = widget.farms.first.longitude!;
    }

    // 1. Process or Synthesize Digital Plant Points inside Farm
    final List<Map<String, dynamic>> processedPlants = [];
    int cols = 6;
    if (widget.plants.length > 20) cols = 8;
    if (widget.plants.length > 50) cols = 10;

    for (int i = 0; i < widget.plants.length; i++) {
      final p = widget.plants[i];
      double pLat;
      double pLng;

      if (p.latitude != null && p.longitude != null && p.latitude != 0 && p.longitude != 0) {
        pLat = p.latitude!;
        pLng = p.longitude!;
      } else {
        // Auto-generate realistic agricultural grid coordinates around farm center
        final row = i ~/ cols;
        final col = i % cols;
        final dLat = (row - (widget.plants.length / cols / 2)) * 0.00009;
        final dLng = (col - (cols / 2)) * 0.00009;
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

    // 2. Process or Synthesize Farm Boundary Polygon
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

      // If no custom polygon, generate a clean agricultural boundary around farm center
      if (coords.isEmpty) {
        final fLat = farm.latitude ?? centerLat;
        final fLng = farm.longitude ?? centerLng;
        final d = 0.00045; // ~50m radius
        coords = [
          [fLng - d * 1.1, fLat - d * 0.8],
          [fLng + d * 1.1, fLat - d * 0.9],
          [fLng + d * 1.2, fLat + d * 0.85],
          [fLng - d * 0.9, fLat + d * 0.95],
          [fLng - d * 1.1, fLat - d * 0.8],
        ];
      }

      polygons.add({
        'farm_id': farm.id,
        'farm_name': farm.name,
        'coords': coords,
      });
    }

    final String polygonsJson = jsonEncode(polygons);
    final String token = _mapboxToken ?? '';

    return '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>GIS Satellite Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; font-family: -apple-system, sans-serif; }
    .tree-marker {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: #10B981;
      color: white;
      font-size: 9.5px;
      font-weight: 900;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .tree-marker:active { transform: scale(1.3); }
    .tree-marker.sick { background-color: #EF4444; }
    .tree-marker.warn { background-color: #F59E0B; }
    
    .farm-label {
      background: rgba(15, 23, 42, 0.85);
      border: 1.5px solid #10B981;
      border-radius: 8px;
      padding: 4px 8px;
      color: #6EE7B7;
      font-weight: 800;
      font-size: 11px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .gps-btn {
      position: absolute;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: white;
      color: #064E3B;
      border: none;
      padding: 10px 14px;
      border-radius: 24px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .gps-btn:active { background: #f1f5f9; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="gps-btn" onclick="locateUser()">
    <span>📍</span> Định vị tôi
  </button>

  <script>
    const center = [$centerLat, $centerLng];
    const plants = $plantsJson;
    const polygons = $polygonsJson;
    const mapboxToken = '$token';

    const map = L.map('map', { zoomControl: false, maxZoom: 22 }).setView(center, 18);

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      maxNativeZoom: 18,
      maxZoom: 22,
      subdomains: 'abcd'
    }).addTo(map);

    const bounds = L.latLngBounds();
    let hasBounds = false;

    // Draw Farm Polygon Boundaries
    polygons.forEach(poly => {
      let coords = poly.coords;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch(e) { coords = []; }
      }
      if (Array.isArray(coords) && coords.length > 0) {
        const leafletCoords = coords.map(pt => [pt[1], pt[0]]);
        const polyLayer = L.polygon(leafletCoords, {
          color: '#10B981',
          weight: 3,
          fillColor: '#10B981',
          fillOpacity: 0.18,
          dashArray: '5, 5'
        }).addTo(map);

        if (poly.farm_name) {
          polyLayer.bindTooltip(poly.farm_name, {
            permanent: true,
            direction: 'top',
            className: 'farm-label'
          });
        }

        bounds.extend(polyLayer.getBounds());
        hasBounds = true;
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
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([plant.lat, plant.lng], { icon: customIcon }).addTo(map);
        marker.on('click', function() {
          if (window.PlantTapChannel) {
            window.PlantTapChannel.postMessage(String(plant.id));
          }
        });

        bounds.extend([plant.lat, plant.lng]);
        hasBounds = true;
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 19 });
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
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);
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
    return Container(
      height: widget.height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.grayBorder, width: 1.2),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10, offset: const Offset(0, 3)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: _isLoading || _webViewController == null
            ? const Center(child: LoadingIndicator(message: 'Đang tải bản đồ GIS vệ tinh...'))
            : WebViewWidget(controller: _webViewController!),
      ),
    );
  }
}
