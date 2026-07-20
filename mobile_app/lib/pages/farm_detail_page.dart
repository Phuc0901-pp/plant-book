import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';
import '../components/log_edit_dialog.dart';
import '../utils/app_config.dart';
import 'plant_detail_page.dart';
import 'package:webview_flutter/webview_flutter.dart';

class FarmDetailPage extends StatefulWidget {
  final Farm farm;

  const FarmDetailPage({super.key, required this.farm});

  @override
  State<FarmDetailPage> createState() => _FarmDetailPageState();
}

class _FarmDetailPageState extends State<FarmDetailPage> {
  final ApiService _apiService = ApiService();
  StreamSubscription? _wsSubscription;
  bool _isLoading = true;
  List<Plant> _farmPlants = [];
  String? _error;

  late final WebViewController _webViewController;

  // Interactive map state variables
  double _centerLng = 108.0;
  double _centerLat = 12.0;
  double _mapZoom = 17.5;
  bool _hasCalculatedCenter = false;

  @override
  void initState() {
    super.initState();

    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..addJavaScriptChannel(
        'FlutterChannel',
        onMessageReceived: (JavaScriptMessage message) {
          try {
            final Map<String, dynamic> data = jsonDecode(message.message);
            final int? plantId = data['plantId'];
            if (plantId != null) {
              final matched = _farmPlants.firstWhere((p) => p.id == plantId);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => PlantDetailPage(plant: matched)),
              ).then((_) => _loadFarmData());
            }
          } catch (e) {
            // Ignore
          }
        },
      );

    _loadFarmData();

    // Listen to real-time events to reload farm data
    _wsSubscription = WebSocketService().stream.listen((event) {
      final ev = event['event'];
      if (ev == 'plants_updated' || ev == 'new_care_log') {
        if (mounted) {
          _loadFarmData();
        }
      }
    });
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    super.dispose();
  }

  void _calculateInitialCenter() {
    if (widget.farm.polygonCoordinates != null && widget.farm.polygonCoordinates!.isNotEmpty) {
      try {
        final List<dynamic> coords = jsonDecode(widget.farm.polygonCoordinates!);
        if (coords.isNotEmpty) {
          List<List<double>> flatCoords = [];
          if (coords[0] is List && coords[0][0] is List) {
            for (var pt in coords[0]) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          } else {
            for (var pt in coords) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          }
          
          if (flatCoords.isNotEmpty) {
            double sumLng = 0;
            double sumLat = 0;
            for (var pt in flatCoords) {
              sumLng += pt[0];
              sumLat += pt[1];
            }
            _centerLng = sumLng / flatCoords.length;
            _centerLat = sumLat / flatCoords.length;
            _hasCalculatedCenter = true;
          }
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  void _updateMapHtml() {
    if (_farmPlants.isEmpty && widget.farm.polygonCoordinates == null) return;
    
    // Format polygon coordinates for javascript array
    String polyCoordsJson = '[]';
    if (widget.farm.polygonCoordinates != null && widget.farm.polygonCoordinates!.isNotEmpty) {
      try {
        final List<dynamic> coords = jsonDecode(widget.farm.polygonCoordinates!);
        if (coords.isNotEmpty) {
          List<List<double>> flatCoords = [];
          if (coords[0] is List && coords[0][0] is List) {
            for (var pt in coords[0]) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          } else {
            for (var pt in coords) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          }
          polyCoordsJson = jsonEncode(flatCoords);
        }
      } catch (e) {
        // Ignore
      }
    }

    // Format plants list for javascript
    final List<Map<String, dynamic>> plantsList = _farmPlants.map((p) => {
      'id': p.id,
      'tree_code': p.treeCode ?? p.id.toString(),
      'lat': p.latitude,
      'lng': p.longitude,
      'health': p.healthStatus,
    }).toList();
    final String plantsJson = jsonEncode(plantsList);

    final mapboxToken = await _apiService.fetchMapboxToken();

    final String htmlContent = '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Mapbox GIS</title>
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 0; }
    #map { position: absolute; top: 0; bottom: 0; width: 100%; height: 100%; }
    .custom-marker {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: #22C55E;
      color: white;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    .custom-marker.sick {
      background-color: #EF4444;
    }
    .custom-marker.warn {
      background-color: #F59E0B;
    }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = '$mapboxToken';
    
    const center = [$_centerLng, $_centerLat];
    const polygonCoords = $polyCoordsJson;
    const plants = $plantsJson;

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center,
      zoom: $_mapZoom,
      attributionControl: false
    });

    map.on('load', () => {
      // Draw polygon if available
      if (polygonCoords && polygonCoords.length > 0) {
        const poly = [...polygonCoords];
        if (poly[0][0] !== poly[poly.length - 1][0] || poly[0][1] !== poly[poly.length - 1][1]) {
          poly.push(poly[0]);
        }

        map.addSource('farm-boundary', {
          'type': 'geojson',
          'data': {
            'type': 'Feature',
            'geometry': {
              'type': 'Polygon',
              'coordinates': [poly]
            }
          }
        });

        map.addLayer({
          'id': 'farm-fill',
          'type': 'fill',
          'source': 'farm-boundary',
          'layout': {},
          'paint': {
            'fill-color': '#22C55E',
            'fill-opacity': 0.15
          }
        });

        map.addLayer({
          'id': 'farm-outline',
          'type': 'line',
          'source': 'farm-boundary',
          'layout': {},
          'paint': {
            'line-color': '#22C55E',
            'line-width': 2
          }
        });
      }

      // Add markers
      plants.forEach(plant => {
        if (plant.lat && plant.lng) {
          const el = document.createElement('div');
          el.className = 'custom-marker';
          if (plant.health === 'Bệnh') el.className += ' sick';
          if (plant.health === 'Cần chú ý') el.className += ' warn';
          el.innerText = plant.tree_code || plant.id;

          el.addEventListener('click', () => {
            if (window.FlutterChannel) {
              window.FlutterChannel.postMessage(JSON.stringify({ plantId: plant.id }));
            }
          });

          new mapboxgl.Marker({ element: el })
            .setLngLat([plant.lng, plant.lat])
            .addTo(map);
        }
      });
    });
  </script>
</body>
</html>
''';

    _webViewController.loadHtmlString(htmlContent, baseUrl: 'https://api.mapbox.com');
  }

  Future<void> _loadFarmData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final plants = await _apiService.fetchPlants();
      setState(() {
        // Filter plants belonging to this farm
        _farmPlants = plants.where((p) => p.farmId == widget.farm.id).toList();
        
        // Sort: Bệnh (Sick) -> Cần chú ý (Warning) -> Tốt (Healthy), then A-Z (1-n)
        _farmPlants.sort((a, b) {
          int getHealthRank(String health) {
            if (health == 'Bệnh') return 0;
            if (health == 'Cần chú ý') return 1;
            return 2;
          }

          int rankA = getHealthRank(a.healthStatus);
          int rankB = getHealthRank(b.healthStatus);
          if (rankA != rankB) return rankA.compareTo(rankB);

          final aCode = a.treeCode ?? a.displayName;
          final bCode = b.treeCode ?? b.displayName;
          return aCode.toLowerCase().compareTo(bCode.toLowerCase());
        });

        // Initialize map center
        if (!_hasCalculatedCenter) {
          _calculateInitialCenter();
        }

        _isLoading = false;
      });
      
      // Load/Update HTML in WebView
      _updateMapHtml();
    } catch (e) {
      setState(() {
        _error = 'Không thể tải thông tin cây trồng của nông trại.';
        _isLoading = false;
      });
    }
  }

  void _showQuickCareLog(String activityType) {
    if (_farmPlants.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nông trại hiện chưa có cây trồng nào để ghi nhật ký.')),
      );
      return;
    }

    showDialog<int?>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Chọn cây trồng để ghi "$activityType"'),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: ListView.builder(
            itemCount: _farmPlants.length,
            itemBuilder: (context, index) {
              final p = _farmPlants[index];
              return ListTile(
                leading: const Icon(Icons.eco_rounded, color: AppTheme.green),
                title: Text('Cây #${p.displayName} - ${p.plantType}'),
                subtitle: Text('Sức khỏe: ${p.healthStatus}'),
                onTap: () => Navigator.pop(context, p.id),
              );
            },
          ),
        ),
      ),
    ).then((plantId) {
      if (plantId != null) {
        showDialog<bool>(
          context: context,
          builder: (context) => LogEditDialog(plantId: plantId),
        ).then((success) {
          if (success == true) {
            _loadFarmData();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Đã ghi nhận "$activityType" thành công!'),
                backgroundColor: AppTheme.greenDark,
              ),
            );
          }
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.farm.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadFarmData,
          )
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Đang tải bản đồ vệ tinh GIS...')
          : _error != null
              ? _buildErrorView()
              : SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Map View Container
                      _buildGisMapBlock(),
                      
                      // Farm Metadata
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.farm.description ?? 'Nông trại canh tác thực địa Tanbao AgTech',
                              style: const TextStyle(fontSize: 14, color: AppTheme.textMuted, height: 1.4),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                _metaChip(Icons.aspect_ratio_rounded, '${widget.farm.area?.toStringAsFixed(0) ?? 0} m²'),
                                const SizedBox(width: 8),
                                _metaChip(Icons.nature_rounded, '${_farmPlants.length} cây trồng'),
                              ],
                            )
                          ],
                        ),
                      ),
                      
                      const Divider(height: 1, color: AppTheme.grayBorder),
                      
                      // Quick actions block
                      _buildQuickCareActions(),
                      
                      const Divider(height: 1, color: AppTheme.grayBorder),
                      
                      // Plants List inside Farm
                      _buildFarmPlantsList(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded, size: 48, color: AppTheme.red),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppTheme.textMuted)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadFarmData, child: const Text('Thử lại')),
        ],
      ),
    );
  }

  Widget _metaChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.greenLight,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.green.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppTheme.greenDark),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.greenDark)),
        ],
      ),
    );
  }

  Widget _buildGisMapBlock() {
    return Container(
      height: 250,
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.black.withOpacity(0.05),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Mapbox GL JS WebView
            Positioned.fill(
              child: WebViewWidget(
                controller: _webViewController,
                gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                  Factory<OneSequenceGestureRecognizer>(
                    () => EagerGestureRecognizer(),
                  ),
                },
              ),
            ),
            
            // Map controls overlay (calling Web Mercator map API methods directly via JS)
            Positioned(
              top: 12,
              right: 12,
              child: Column(
                children: [
                  _mapButton(Icons.add_rounded, () {
                    _webViewController.runJavaScript('map.zoomIn();');
                  }),
                  const SizedBox(height: 6),
                  _mapButton(Icons.remove_rounded, () {
                    _webViewController.runJavaScript('map.zoomOut();');
                  }),
                  const SizedBox(height: 6),
                  _mapButton(Icons.my_location_rounded, () {
                    _webViewController.runJavaScript('map.flyTo({ center: [$_centerLng, $_centerLat], zoom: 17.5 });');
                  }),
                ],
              ),
            ),
            
            // Map legend overlay
            Positioned(
              bottom: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.layers_rounded, size: 12, color: Colors.white70),
                    SizedBox(width: 6),
                    Text(
                      'Mapbox GL Satellite GIS',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _mapButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.9),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 4, offset: const Offset(0, 1))
          ],
        ),
        child: Icon(icon, size: 18, color: AppTheme.textMain),
      ),
    );
  }

  Widget _buildQuickCareActions() {
    final List<Map<String, dynamic>> actions = [
      {'label': 'Tưới nước', 'icon': Icons.water_drop_rounded, 'color': Colors.blue},
      {'label': 'Bón phân', 'icon': Icons.opacity_rounded, 'color': Colors.green},
      {'label': 'Phun thuốc', 'icon': Icons.bug_report_rounded, 'color': Colors.orange},
      {'label': 'Tỉa cành/lá', 'icon': Icons.content_cut_rounded, 'color': Colors.teal},
      {'label': 'Tỉa quả/hoa', 'icon': Icons.grain_rounded, 'color': Colors.purple},
      {'label': 'Bệnh cây', 'icon': Icons.error_outline_rounded, 'color': Colors.red},
    ];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Hoạt động canh tác nhanh',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textMain),
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 2.2,
            ),
            itemBuilder: (context, index) {
              final a = actions[index];
              return InkWell(
                onTap: () => _showQuickCareLog(a['label'] as String),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  decoration: BoxDecoration(
                    color: (a['color'] as Color).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: (a['color'] as Color).withOpacity(0.2), width: 1),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(a['icon'] as IconData, size: 14, color: a['color'] as Color),
                      const SizedBox(width: 6),
                      Text(
                        a['label'] as String,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: a['color'] as Color,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          )
        ],
      ),
    );
  }

  Widget _buildFarmPlantsList() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Cây trồng trong vườn (${_farmPlants.length})',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textMain),
              ),
              const Text('Xem tất cả', style: TextStyle(fontSize: 12, color: AppTheme.green, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          _farmPlants.isEmpty
              ? Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  alignment: Alignment.center,
                  child: const Text('Chưa có cây trồng nào được định vị.', style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _farmPlants.length,
                  itemBuilder: (context, index) {
                    final plant = _farmPlants[index];
                    
                    Color statusColor;
                    if (plant.healthStatus == 'Tốt') {
                      statusColor = AppTheme.green;
                    } else if (plant.healthStatus == 'Cần chú ý') {
                      statusColor = AppTheme.amber;
                    } else {
                      statusColor = AppTheme.red;
                    }

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 8),
                      color: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: const BorderSide(color: AppTheme.grayBorder, width: 1),
                      ),
                      child: ListTile(
                        leading: Container(
                          width: 8,
                          height: 24,
                          decoration: BoxDecoration(
                            color: statusColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        title: Text('Cây #${plant.displayName} - ${plant.plantType}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text('Sức khỏe: ${plant.healthStatus} | Tuổi: ${plant.plantAge ?? 0} năm', style: const TextStyle(fontSize: 12)),
                        trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.textMuted),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => PlantDetailPage(plant: plant)),
                          ).then((_) => _loadFarmData()); // Reload when returning
                        },
                      ),
                    );
                  },
                )
        ],
      ),
    );
  }
}


