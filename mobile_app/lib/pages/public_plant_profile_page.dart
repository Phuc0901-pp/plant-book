import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../utils/app_config.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';
import '../components/audit_history_view.dart';
import '../models/plant_log.dart' show EditHistory;
import '../components/video_player_view.dart';

class PublicPlantProfilePage extends StatefulWidget {
  final String slug;

  const PublicPlantProfilePage({super.key, required this.slug});

  @override
  State<PublicPlantProfilePage> createState() => _PublicPlantProfilePageState();
}

class _PublicPlantProfilePageState extends State<PublicPlantProfilePage> {
  final ApiService _apiService = ApiService();
  late final WebViewController _webViewController;
  
  bool _isLoading = true;
  String? _error;
  
  Map<String, dynamic>? _plantData;
  List<dynamic> _logs = [];
  List<dynamic> _media = [];

  @override
  void initState() {
    super.initState();

    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white);

    _loadPublicData();
  }

  List<dynamic> _typeofPolyCoords(dynamic poly) {
    if (poly is String) {
      try {
        return jsonDecode(poly);
      } catch (e) {
        return [];
      }
    } else if (poly is List) {
      return poly;
    }
    return [];
  }

  Future<void> _updateMapHtml() async {
    if (_plantData == null) return;

    final double plantLat = double.tryParse(_plantData!['latitude']?.toString() ?? '') ?? 0.0;
    final double plantLng = double.tryParse(_plantData!['longitude']?.toString() ?? '') ?? 0.0;
    final String health = _plantData!['health_status'] ?? 'Tốt';
    final String treeCode = _plantData!['tree_code'] ?? _plantData!['id']?.toString() ?? '';

    // Format polygon coordinates
    String polyCoordsJson = '[]';
    if (_plantData!['farm_polygon'] != null && _plantData!['farm_polygon'].toString().isNotEmpty) {
      try {
        final List<dynamic> coords = _typeofPolyCoords(_plantData!['farm_polygon']);
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

    final mapboxToken = await _apiService.fetchMapboxToken();

    final String htmlContent = '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Mapbox GL JS Satellite Map</title>
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 0; }
    #map { position: absolute; top: 0; bottom: 0; width: 100%; height: 100%; }
    
    .target-marker {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: #22C55E;
      border: 2px solid white;
      box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.35);
      animation: pulse 1.6s infinite alternate;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
      font-size: 11px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .target-marker.sick {
      background-color: #EF4444;
      box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.35);
    }
    .target-marker.warn {
      background-color: #F59E0B;
      box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.35);
    }
    
    @keyframes pulse {
      0% { transform: scale(0.92); box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3); }
      100% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
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
    
    const plantCenter = [$plantLng, $plantLat];
    const polygonCoords = $polyCoordsJson;
    const health = '$health';
    const treeCode = '$treeCode';

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12', // Satellite Streets detail map
      center: plantCenter.length === 2 && plantCenter[0] !== 0 ? plantCenter : [108.2, 12.0],
      zoom: 17.5,
      attributionControl: false
    });

    // Add navigation controls (zoom in/out)
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    // Add Geolocate Control for current phone GPS location
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.addControl(geolocate, 'top-right');

    map.on('load', () => {
      // Auto locate user
      setTimeout(() => {
        try { geolocate.trigger(); } catch (e) {}
      }, 1000);

      // Draw farm polygon boundary
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
            'fill-opacity': 0.12
          }
        });

        map.addLayer({
          'id': 'farm-outline',
          'type': 'line',
          'source': 'farm-boundary',
          'layout': {},
          'paint': {
            'line-color': '#22C55E',
            'line-width': 2.5
          }
        });
      }

      // Draw target plant marker
      if (plantCenter[0] && plantCenter[1]) {
        const el = document.createElement('div');
        el.className = 'target-marker';
        if (health === 'Bệnh') el.className += ' sick';
        if (health === 'Cần chú ý') el.className += ' warn';
        el.innerText = treeCode;

        new mapboxgl.Marker({ element: el })
          .setLngLat(plantCenter)
          .addTo(map);
      }
    });
  </script>
</body>
</html>
''';

    // Inject with HTTPS baseUrl to enforce Secure Context for Location API access
    final String mainBaseUrl = _apiService.baseUrl.replaceAll('/api', '');
    _webViewController.loadHtmlString(htmlContent, baseUrl: mainBaseUrl);
  }

  Future<void> _loadPublicData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final data = await _apiService.fetchPublicPlant(widget.slug);

    if (!mounted) return;

    if (data != null) {
      setState(() {
        _plantData = data;
        _logs = data['logs'] as List<dynamic>? ?? [];
        _media = data['media'] as List<dynamic>? ?? [];
        _isLoading = false;
      });
      _updateMapHtml();
    } else {
      setState(() {
        _error = 'Không thể tải hồ sơ cây trồng. Vui lòng kiểm tra lại liên kết hoặc kết nối mạng.';
        _isLoading = false;
      });
    }
  }

  String _getCropAsset(String plantType) {
    final type = plantType.toLowerCase();
    if (type.contains('sầu riêng') || type.contains('durian')) {
      return 'assets/images/durian.png';
    } else if (type.contains('cà phê') || type.contains('coffee')) {
      return 'assets/images/coffee.png';
    } else if (type.contains('cao su') || type.contains('rubber')) {
      return 'assets/images/rubber.png';
    } else if (type.contains('ca cao') || type.contains('cacao')) {
      return 'assets/images/cacao.png';
    }
    return 'assets/images/durian.png'; // Fallback crop icon
  }

  Future<void> _showQuickLogDialog(String activityType) async {
    final noteController = TextEditingController();
    final detailController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    String detailLabel = 'Thông số chi tiết:';
    if (activityType == 'Tưới nước') detailLabel = 'Lượng nước (lít):';
    if (activityType == 'Bón phân') detailLabel = 'Tên phân bón:';
    if (activityType == 'Phun thuốc') detailLabel = 'Tên thuốc BVTV:';
    if (activityType == 'Cắt cành/lá' || activityType == 'Tỉa hoa/quả') detailLabel = 'Lý do tỉa:';
    if (activityType == 'Bệnh cây') detailLabel = 'Tên sâu bệnh phát hiện:';

    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Ghi nhanh: $activityType',
          style: const TextStyle(color: AppTheme.textMain, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(detailLabel, style: const TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              TextFormField(
                controller: detailController,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 14),
                decoration: const InputDecoration(
                  fillColor: Color(0xFFF8FAFC),
                  hintText: 'Nhập thông tin...',
                  hintStyle: TextStyle(color: Colors.black26, fontSize: 13),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                validator: (val) => val == null || val.isEmpty ? 'Trường này không được trống' : null,
              ),
              const SizedBox(height: 12),
              const Text('Ghi chú thêm:', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
              const SizedBox(height: 6),
              TextFormField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 14),
                decoration: const InputDecoration(
                  fillColor: Color(0xFFF8FAFC),
                  hintText: 'Nhập ghi chú...',
                  hintStyle: TextStyle(color: Colors.black26, fontSize: 13),
                  contentPadding: EdgeInsets.all(12),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
            child: const Text('Ghi lại'),
          ),
        ],
      ),
    );

    if (confirm == true && formKey.currentState!.validate()) {
      final value = detailController.text.trim();
      final note = noteController.text.trim();

      final Map<String, dynamic> details = { 'value': value };
      if (activityType == 'Tưới nước') details['method'] = value;
      if (activityType == 'Bón phân') details['fertilizer'] = value;
      if (activityType == 'Phun thuốc') details['pesticide'] = value;
      if (activityType == 'Cắt cành/lá' || activityType == 'Tỉa hoa/quả') details['reason'] = value;
      if (activityType == 'Bệnh cây') details['disease'] = value;

      final success = await _apiService.createPublicLog(
        widget.slug,
        activityType,
        note,
        details,
      );

      if (success) {
        if (activityType == 'Bệnh cây') {
          await _apiService.updatePublicHealth(widget.slug, 'Bệnh');
        }
        
        _loadPublicData();
        
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng bộ nhật ký "$activityType" công khai thành công!'),
            backgroundColor: AppTheme.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _updateHealthPublicly() async {
    final String? newStatus = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Cập nhật sức khỏe cây'),
        children: ['Tốt', 'Cần chú ý', 'Bệnh'].map((status) {
          return SimpleDialogOption(
            onPressed: () => Navigator.pop(context, status),
            child: Text(status, style: const TextStyle(fontWeight: FontWeight.w500)),
          );
        }).toList(),
      ),
    );

    if (newStatus != null) {
      final success = await _apiService.updatePublicHealth(widget.slug, newStatus);
      if (success) {
        _loadPublicData();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã cập nhật tình trạng sức khỏe thành "$newStatus" công khai!'),
            backgroundColor: AppTheme.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AppTheme.lightTheme,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC), // Light background
        appBar: AppBar(
          backgroundColor: Colors.white,
          foregroundColor: AppTheme.textMain,
          elevation: 0.5,
          title: Row(
            children: [
              Image.asset(
                'assets/images/logo.png',
                height: 28,
                errorBuilder: (_, __, ___) => const Icon(Icons.spa_rounded, color: AppTheme.green),
              ),
              const SizedBox(width: 8),
              const Text('SỔ TAY CANH TÁC ĐIỆN TỬ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
            ],
          ),
        ),
        body: _isLoading
            ? const LoadingIndicator(message: 'Tải dữ liệu sổ tay điện tử...')
            : _error != null
                ? _buildErrorView()
                : RefreshIndicator(
                    onRefresh: _loadPublicData,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // 1. Plant Image header card
                          _buildPlantHeaderWidget(),
                          const SizedBox(height: 16),
                          
                          // 2. Metadata details grid
                          _buildMetadataGrid(),
                          const SizedBox(height: 16),

                          // 3. Map View widget (WebView Satellite Map)
                          _buildMapWidget(),
                          const SizedBox(height: 16),
                          
                          // 4. Quick Log Actions block
                          _buildQuickLogsBlock(),
                          const SizedBox(height: 16),
                          
                          // 5. Media Gallery block
                          _buildMediaGalleryBlock(),
                          const SizedBox(height: 16),
                          
                          // 6. Timeline Care Logs
                          _buildCareLogsTimelineBlock(),
                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 54, color: AppTheme.red),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textMuted)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadPublicData, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }

  Widget _buildPlantHeaderWidget() {
    final type = _plantData?['plant_type'] ?? 'Cây trồng';
    final variety = _plantData?['plant_variety'] ?? '—';
    final treeCode = _plantData?['tree_code'] ?? _plantData?['id']?.toString() ?? '—';
    final age = _plantData?['plant_age']?.toString() ?? '—';
    final health = _plantData?['health_status'] ?? 'Tốt';

    Color statusColor;
    if (health == 'Tốt') {
      statusColor = AppTheme.green;
    } else if (health == 'Cần chú ý') {
      statusColor = AppTheme.amber;
    } else {
      statusColor = AppTheme.red;
    }

    final cropAsset = _getCropAsset(type);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        children: [
          Center(
            child: Column(
              children: [
                Image.asset(
                  cropAsset,
                  height: 64,
                  width: 64,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.park_rounded, size: 64, color: AppTheme.green),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
          
          Text(
            '$type ($variety)',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textMain),
          ),
          const SizedBox(height: 12),
          
          // Badge list row
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _badgeChip('Mã số: #$treeCode', const Color(0xFFF1F5F9), textColor: AppTheme.textMain),
              InkWell(
                onTap: _updateHealthPublicly,
                child: _badgeChip('Sức khỏe: $health', statusColor.withOpacity(0.1), textColor: statusColor),
              ),
              _badgeChip('Tuổi: $age năm', const Color(0xFFF1F5F9), textColor: AppTheme.textMain),
            ],
          ),
        ],
      ),
    );
  }

  Widget _badgeChip(String label, Color bg, {Color textColor = Colors.white}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(color: textColor, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildMetadataGrid() {
    final location = _plantData?['location'] ?? '—';
    final farm = _plantData?['farm_name'] ?? '—';
    final totalLogs = _logs.length;
    final totalPics = _media.length;
    
    const bloomDate = '25/06/2026';

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 2.2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      children: [
        _metaCard(Icons.location_on_rounded, 'VỊ TRÍ / LÔ', '$location ($farm)'),
        _metaCard(Icons.calendar_month_rounded, 'NGÀY SỐ HÓA', bloomDate),
        _metaCard(Icons.history_rounded, 'HOẠT ĐỘNG', '$totalLogs nhật ký · $totalPics hình ảnh'),
        _metaCard(Icons.park_outlined, 'VƯỜN TRỒNG', farm),
      ],
    );
  }

  Widget _metaCard(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 6, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: AppTheme.green),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(fontSize: 9, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain),
          )
        ],
      ),
    );
  }

  Widget _buildMapWidget() {
    return Container(
      height: 250,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            WebViewWidget(
              controller: _webViewController,
              gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                Factory<OneSequenceGestureRecognizer>(
                  () => EagerGestureRecognizer(),
                ),
              },
            ),
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
                    Icon(Icons.gps_fixed_rounded, size: 12, color: Colors.white70),
                    SizedBox(width: 6),
                    Text(
                      'Bản đồ vệ tinh GIS (GPS Vị trí thiết bị)',
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

  Widget _buildQuickLogsBlock() {
    final List<Map<String, dynamic>> items = [
      {'label': 'Tưới nước', 'icon': Icons.water_drop_rounded, 'color': Colors.blue},
      {'label': 'Bón phân', 'icon': Icons.opacity_rounded, 'color': Colors.green},
      {'label': 'Phun thuốc', 'icon': Icons.science_rounded, 'color': Colors.orange},
      {'label': 'Cắt cành/lá', 'icon': Icons.content_cut_rounded, 'color': Colors.teal},
      {'label': 'Tỉa hoa/quả', 'icon': Icons.park_outlined, 'color': Colors.purple},
      {'label': 'Bệnh cây', 'icon': Icons.error_outline_rounded, 'color': Colors.red},
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('🌿 Ghi nhật ký nhanh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
          const SizedBox(height: 4),
          const Text(
            'Chọn quy trình chăm sóc bên dưới để điền thông tin nhanh (không cần đăng nhập).',
            style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 14),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 2.8,
            ),
            itemBuilder: (context, index) {
              final item = items[index];
              return InkWell(
                onTap: () => _showQuickLogDialog(item['label'] as String),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(item['icon'] as IconData, size: 14, color: item['color'] as Color),
                      const SizedBox(width: 6),
                      Text(item['label'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
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

  Widget _buildMediaGalleryBlock() {
    if (_media.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📷 Thư viện hình ảnh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _media.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.3,
            ),
            itemBuilder: (context, index) {
              final pic = _media[index];
              final url = pic['url']?.toString() ?? '';
              return ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    color: const Color(0xFFF1F5F9),
                    child: const Icon(Icons.broken_image_rounded, color: Colors.black26),
                  ),
                ),
              );
            },
          )
        ],
      ),
    );
  }

  Widget _buildCareLogsTimelineBlock() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📅 Nhật ký chăm sóc cây', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMain)),
          const SizedBox(height: 16),
          _logs.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('Chưa có hoạt động canh tác nào được ghi.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted))),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _logs.length,
                  itemBuilder: (context, index) {
                    final log = _logs[index];
                    final date = log['log_date']?.toString().substring(0, 10) ?? '';
                    final type = log['log_type'] ?? 'Khác';
                    final note = log['note'] ?? '';
                    
                    final details = log['details'] as Map<String, dynamic>? ?? {};
                    final detailVal = _formatLogDetails(type, details);
                    
                    final List<dynamic> mediaList = log['media_urls'] as List<dynamic>? ?? [];
                    final List<String> mediaUrls = mediaList.map((dynamic item) {
                      if (item is Map) {
                        return (item['url'] ?? '').toString();
                      }
                      return item.toString();
                    }).where((url) => url.isNotEmpty).toList();
                    
                    final historyList = log['edit_history'] as List<dynamic>? ?? [];
                    final parsedHistory = historyList
                        .map((dynamic item) => EditHistory.fromJson(item as Map<String, dynamic>))
                        .toList();

                    Color logColor = AppTheme.green;
                    if (type == 'Bệnh cây') logColor = AppTheme.red;
                    if (type == 'Cảnh báo' || type == 'Cần chú ý') logColor = AppTheme.amber;

                    return IntrinsicHeight(
                      child: Row(
                        children: [
                          // Timeline bar
                          Column(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: logColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              Expanded(
                                child: Container(
                                  width: 2,
                                  color: index == _logs.length - 1 ? Colors.transparent : const Color(0xFFE2E8F0),
                                ),
                              )
                            ],
                          ),
                          const SizedBox(width: 12),
                          
                          // Log content card
                          Expanded(
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        type.toString().toUpperCase(),
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: logColor),
                                      ),
                                      Text(date, style: const TextStyle(fontSize: 10, color: AppTheme.textMuted)),
                                    ],
                                  ),
                                  if (detailVal.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text('• Chi tiết: $detailVal', style: const TextStyle(fontSize: 12, color: AppTheme.textMain)),
                                  ],
                                  if (note.toString().isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text('• Ghi chú: $note', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                  ],
                                  
                                  // Photos/Videos display
                                  if (mediaUrls.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    SizedBox(
                                      height: 64,
                                      child: ListView.builder(
                                        scrollDirection: Axis.horizontal,
                                        itemCount: mediaUrls.length,
                                        itemBuilder: (context, index) {
                                          final url = mediaUrls[index];
                                          final isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().contains('/video/');
                                          return GestureDetector(
                                            onTap: () {
                                              if (isVideo) {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (_) => VideoPlayerWebviewPage(videoUrl: url),
                                                  ),
                                                );
                                              } else {
                                                showDialog(
                                                  context: context,
                                                  builder: (context) => Dialog(
                                                    backgroundColor: Colors.transparent,
                                                    child: Stack(
                                                      alignment: Alignment.center,
                                                      children: [
                                                        InteractiveViewer(
                                                          child: Image.network(url, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 100, color: Colors.white)),
                                                        ),
                                                        Positioned(
                                                          top: 10,
                                                          right: 10,
                                                          child: CircleAvatar(
                                                            backgroundColor: Colors.black54,
                                                            child: IconButton(
                                                              icon: const Icon(Icons.close, color: Colors.white),
                                                              onPressed: () => Navigator.pop(context),
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                );
                                              }
                                            },
                                            child: Container(
                                              margin: const EdgeInsets.only(right: 8),
                                              width: 64,
                                              height: 64,
                                              decoration: BoxDecoration(
                                                borderRadius: BorderRadius.circular(8),
                                                border: Border.all(color: AppTheme.grayBorder),
                                                image: isVideo
                                                    ? null
                                                    : DecorationImage(
                                                        image: NetworkImage(url),
                                                        fit: BoxFit.cover,
                                                      ),
                                              ),
                                              child: isVideo
                                                  ? const Center(
                                                      child: Icon(Icons.play_circle_fill_rounded, size: 28, color: AppTheme.green),
                                                    )
                                                  : null,
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                  
                                  // Edit history timeline
                                  if (parsedHistory.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    AuditHistoryView(history: parsedHistory),
                                  ],
                                ],
                              ),
                            ),
                          )
                        ],
                      ),
                    );
                  },
                )
        ],
      ),
    );
  }

  String _formatLogDetails(String logType, Map<String, dynamic> details) {
    if (details.isEmpty) return '';
    final List<String> parts = [];
    
    if (logType == 'Tưới nước') {
      final method = details['method'];
      final amount = details['amount'];
      if (method != null && method.toString().isNotEmpty) parts.add('Cách tưới: $method');
      if (amount != null) parts.add('Lượng nước: $amount lít');
    } else if (logType == 'Bón phân') {
      final name = details['fertilizer_name'];
      final amount = details['amount'];
      final unit = details['unit'] ?? 'kg';
      if (name != null && name.toString().isNotEmpty) parts.add('Loại phân: $name');
      if (amount != null) parts.add('Lượng bón: $amount $unit');
    } else if (logType == 'Phun thuốc') {
      final name = details['pesticide_name'];
      final amount = details['amount'];
      final unit = details['unit'] ?? 'lít';
      if (name != null && name.toString().isNotEmpty) parts.add('Loại thuốc: $name');
      if (amount != null) parts.add('Lượng phun: $amount $unit');
    } else if (logType == 'Bệnh cây') {
      final name = details['disease_name'];
      final severity = details['severity'];
      final desc = details['description'];
      if (name != null && name.toString().isNotEmpty) parts.add('Tên bệnh: $name');
      if (severity != null && severity.toString().isNotEmpty) parts.add('Mức độ: $severity');
      if (desc != null && desc.toString().isNotEmpty) parts.add('Mô tả: $desc');
    } else if (logType == 'Tỉa cành/lá' || logType == 'Tỉa quả/hoa') {
      final reason = details['reason'];
      final amount = details['amount'];
      if (reason != null && reason.toString().isNotEmpty) parts.add('Lý do: $reason');
      if (amount != null && amount != 0) parts.add('Số lượng: $amount');
    } else {
      final val = details['value'] ?? details['method'] ?? details['fertilizer'] ?? details['pesticide'] ?? details['reason'] ?? details['disease'];
      if (val != null) parts.add('$val');
    }
    return parts.join(' | ');
  }
}
