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
    double centerLat = 12.68;
    double centerLng = 108.03;

    final plantsList = widget.plants.where((p) => p.latitude != null && p.longitude != null).map((p) {
      return {
        'id': p.id,
        'tree_code': p.displayName,
        'lat': p.latitude,
        'lng': p.longitude,
        'health': p.healthStatus,
        'plant_type': p.plantType,
        'variety': p.plantVariety ?? '',
      };
    }).toList();

    if (plantsList.isNotEmpty) {
      double sumLat = 0;
      double sumLng = 0;
      for (final p in plantsList) {
        sumLat += (p['lat'] as double);
        sumLng += (p['lng'] as double);
      }
      centerLat = sumLat / plantsList.length;
      centerLng = sumLng / plantsList.length;
    } else if (widget.farms.isNotEmpty && widget.farms.first.latitude != null && widget.farms.first.longitude != null) {
      centerLat = widget.farms.first.latitude!;
      centerLng = widget.farms.first.longitude!;
    }

    final String plantsJson = jsonEncode(plantsList);

    final List<dynamic> polygons = [];
    for (final farm in widget.farms) {
      if (farm.polygonCoordinates != null && farm.polygonCoordinates!.isNotEmpty) {
        polygons.add({
          'farm_id': farm.id,
          'farm_name': farm.name,
          'coords': farm.polygonCoordinates,
        });
      }
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
      font-size: 10px;
      font-weight: 800;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .tree-marker:active { transform: scale(1.3); }
    .tree-marker.sick { background-color: #EF4444; }
    .tree-marker.warn { background-color: #F59E0B; }
    
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
    .user-pos-marker {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #3B82F6;
      border: 3px solid white;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
    }
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

    polygons.forEach(poly => {
      if (poly.coords && poly.coords.length > 0) {
        const leafletCoords = poly.coords.map(pt => [pt[1], pt[0]]);
        const polyLayer = L.polygon(leafletCoords, {
          color: '#10B981',
          weight: 3,
          fillColor: '#10B981',
          fillOpacity: 0.15
        }).addTo(map);
        bounds.extend(polyLayer.getBounds());
        hasBounds = true;
      }
    });

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
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
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
