import 'dart:async';
import 'dart:convert';
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

  @override
  void initState() {
    super.initState();
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
        _isLoading = false;
      });
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
    double centerLng = 108.0;
    double centerLat = 12.0;
    bool hasCoords = false;

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
            centerLng = sumLng / flatCoords.length;
            centerLat = sumLat / flatCoords.length;
            hasCoords = true;
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    final mapboxToken = AppConfig.mapboxPublicToken;
    final mapboxUrl = hasCoords
        ? 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/$centerLng,$centerLat,17.2,0,0/450x250@2x?access_token=$mapboxToken'
        : 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/108.2,12.0,17.2,0,0/450x250@2x?access_token=$mapboxToken';

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
            // Mapbox Satellite background image
            Positioned.fill(
              child: Image.network(
                mapboxUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  color: const Color(0xFF1E293B),
                  child: const Icon(Icons.broken_image_rounded, color: Colors.white24),
                ),
              ),
            ),
            
            // Base Satellite Map Drawing overlay using Canvas
            Positioned.fill(
              child: CustomPaint(
                painter: FarmGisPainter(
                  polygonCoords: widget.farm.polygonCoordinates,
                  plants: _farmPlants,
                ),
              ),
            ),
            
            // Map controls overlay
            Positioned(
              top: 12,
              right: 12,
              child: Column(
                children: [
                  _mapButton(Icons.add_rounded),
                  const SizedBox(height: 6),
                  _mapButton(Icons.remove_rounded),
                  const SizedBox(height: 6),
                  _mapButton(Icons.my_location_rounded),
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
                      'Mapbox Satellite GIS Live',
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

  Widget _mapButton(IconData icon) {
    return Container(
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

// Custom painter to draw beautiful vectors representing Mapbox satellite maps & GIS data
class FarmGisPainter extends CustomPainter {
  final String? polygonCoords;
  final List<Plant> plants;

  FarmGisPainter({this.polygonCoords, required this.plants});

  @override
  void paint(Canvas canvas, Size size) {
    // 2. Parse polygon and find coordinates boundary box
    List<Offset> projectedPoints = [];
    
    try {
      if (polygonCoords != null && polygonCoords!.isNotEmpty) {
        final List<dynamic> coords = jsonDecode(polygonCoords!);
        if (coords.isNotEmpty) {
          // Flatten coords to handle potential nested arrays (GeoJSON polygon coordinates format)
          List<List<double>> flatCoords = [];
          
          if (coords[0] is List && coords[0][0] is List) {
            // Standard GeoJSON Polygon: [[[lng, lat], [lng, lat]]]
            for (var pt in coords[0]) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          } else {
            // Simple Array: [[lng, lat], [lng, lat]]
            for (var pt in coords) {
              flatCoords.add([double.parse(pt[0].toString()), double.parse(pt[1].toString())]);
            }
          }

          if (flatCoords.isNotEmpty) {
            // Find bounding box
            double minLng = flatCoords[0][0];
            double maxLng = flatCoords[0][0];
            double minLat = flatCoords[0][1];
            double maxLat = flatCoords[0][1];

            for (var pt in flatCoords) {
              if (pt[0] < minLng) minLng = pt[0];
              if (pt[0] > maxLng) maxLng = pt[0];
              if (pt[1] < minLat) minLat = pt[1];
              if (pt[1] > maxLat) maxLat = pt[1];
            }

            // Project polygon coordinates to fit within canvas size
            final padding = 40.0;
            final mapW = size.width - (padding * 2);
            final mapH = size.height - (padding * 2);

            final deltaLng = maxLng - minLng == 0 ? 1.0 : maxLng - minLng;
            final deltaLat = maxLat - minLat == 0 ? 1.0 : maxLat - minLat;

            for (var pt in flatCoords) {
              final px = padding + ((pt[0] - minLng) / deltaLng) * mapW;
              // Flip Y axis since canvas Y starts from top and Lat starts from south
              final py = padding + (1.0 - ((pt[1] - minLat) / deltaLat)) * mapH;
              projectedPoints.add(Offset(px, py));
            }

            // 3. Draw Farm Boundary Polygon
            final polyPath = Path();
            polyPath.moveTo(projectedPoints[0].dx, projectedPoints[0].dy);
            for (var i = 1; i < projectedPoints.length; i++) {
              polyPath.lineTo(projectedPoints[i].dx, projectedPoints[i].dy);
            }
            polyPath.close();

            // Draw filled boundary
            final fillPaint = Paint()
              ..color = AppTheme.green.withOpacity(0.15)
              ..style = PaintingStyle.fill;
            canvas.drawPath(polyPath, fillPaint);

            // Draw border stroke
            final strokePaint = Paint()
              ..color = AppTheme.green
              ..strokeWidth = 2
              ..style = PaintingStyle.stroke;
            canvas.drawPath(polyPath, strokePaint);

            // 4. Draw Plant Markers inside boundaries
            for (var plant in plants) {
              if (plant.latitude != null && plant.longitude != null) {
                final px = padding + ((plant.longitude! - minLng) / deltaLng) * mapW;
                final py = padding + (1.0 - ((plant.latitude! - minLat) / deltaLat)) * mapH;

                Color healthColor;
                if (plant.healthStatus == 'Tốt') {
                  healthColor = AppTheme.green;
                } else if (plant.healthStatus == 'Cần chú ý') {
                  healthColor = AppTheme.amber;
                } else {
                  healthColor = AppTheme.red;
                }

                // Draw marker glow effect
                final glowPaint = Paint()
                  ..color = healthColor.withOpacity(0.3)
                  ..style = PaintingStyle.fill;
                canvas.drawCircle(Offset(px, py), 9, glowPaint);

                // Draw solid inner circle
                final pinPaint = Paint()
                  ..color = healthColor
                  ..style = PaintingStyle.fill;
                canvas.drawCircle(Offset(px, py), 5, pinPaint);

                // Draw inner white dot
                final corePaint = Paint()
                  ..color = Colors.white
                  ..style = PaintingStyle.fill;
                canvas.drawCircle(Offset(px, py), 2, corePaint);
              }
            }
          }
        }
      } else {
        // Fallback drawing if coordinates not loaded yet
        _drawMockBoundary(canvas, size);
      }
    } catch (e) {
      _drawMockBoundary(canvas, size);
    }
  }

  void _drawMockBoundary(Canvas canvas, Size size) {
    // Draw a generic placeholder farm polygon
    final polyPath = Path();
    polyPath.moveTo(size.width * 0.2, size.height * 0.2);
    polyPath.lineTo(size.width * 0.8, size.height * 0.15);
    polyPath.lineTo(size.width * 0.9, size.height * 0.7);
    polyPath.lineTo(size.width * 0.3, size.height * 0.85);
    polyPath.close();

    final fillPaint = Paint()
      ..color = AppTheme.green.withOpacity(0.12)
      ..style = PaintingStyle.fill;
    canvas.drawPath(polyPath, fillPaint);

    final strokePaint = Paint()
      ..color = AppTheme.green
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawPath(polyPath, strokePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
