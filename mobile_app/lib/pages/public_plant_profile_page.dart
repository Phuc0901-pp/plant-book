import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../components/loading_indicator.dart';

class PublicPlantProfilePage extends StatefulWidget {
  final String slug;

  const PublicPlantProfilePage({super.key, required this.slug});

  @override
  State<PublicPlantProfilePage> createState() => _PublicPlantProfilePageState();
}

class _PublicPlantProfilePageState extends State<PublicPlantProfilePage> {
  final ApiService _apiService = ApiService();
  
  bool _isLoading = true;
  String? _error;
  
  Map<String, dynamic>? _plantData;
  List<dynamic> _logs = [];
  List<dynamic> _media = [];

  @override
  void initState() {
    super.initState();
    _loadPublicData();
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
    } else {
      setState(() {
        _error = 'Không thể tải hồ sơ cây trồng. Vui lòng kiểm tra lại liên kết hoặc kết nối mạng.';
        _isLoading = false;
      });
    }
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
        backgroundColor: const Color(0xFF0F172A), // Dark slate dialog background
        title: Text(
          'Ghi nhanh: $activityType',
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(detailLabel, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 6),
              TextFormField(
                controller: detailController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  fillColor: Colors.white.withOpacity(0.05),
                  hintText: 'Nhập thông tin...',
                  hintStyle: const TextStyle(color: Colors.white30),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                validator: (val) => val == null || val.isEmpty ? 'Trường này không được trống' : null,
              ),
              const SizedBox(height: 12),
              const Text('Ghi chú thêm:', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 6),
              TextFormField(
                controller: noteController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  fillColor: Colors.white.withOpacity(0.05),
                  hintText: 'Nhập ghi chú...',
                  hintStyle: const TextStyle(color: Colors.white30),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.white54)),
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

      // Call public API
      final success = await _apiService.createPublicLog(
        widget.slug,
        activityType,
        note,
        details,
      );

      if (success) {
        // If type is disease, update health status to Bệnh publicly
        if (activityType == 'Bệnh cây') {
          await _apiService.updatePublicHealth(widget.slug, 'Bệnh');
        }
        
        _loadPublicData();
        
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng bộ nhật ký "$activityType" công khai thành công!'),
            backgroundColor: AppTheme.green,
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
            child: Text(status),
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
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF02231C), // Deep premium forest green background matching mockup
        primaryColor: AppTheme.green,
        colorScheme: const ColorScheme.dark(
          primary: AppTheme.green,
          secondary: AppTheme.userAccent,
        ),
      ),
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF011813),
          foregroundColor: Colors.white,
          title: const Row(
            children: [
              Icon(Icons.spa_rounded, color: AppTheme.green),
              SizedBox(width: 8),
              Text('HỒ SƠ CÂY TRỒNG', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 0.8)),
            ],
          ),
        ),
        body: _isLoading
            ? const LoadingIndicator(message: 'Tải dữ liệu hồ sơ công khai...')
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
                          // 1. Durian Image header
                          _buildPlantHeaderWidget(),
                          const SizedBox(height: 20),
                          
                          // 2. Metadata details grid
                          _buildMetadataGrid(),
                          const SizedBox(height: 20),
                          
                          // 3. Quick Log Actions block
                          _buildQuickLogsBlock(),
                          const SizedBox(height: 20),
                          
                          // 4. Media Gallery block
                          _buildMediaGalleryBlock(),
                          const SizedBox(height: 20),
                          
                          // 5. Timeline Care Logs
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
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
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

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF04342A), // Soft forest green card
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          // Durian Tree vector/icon representation
          const Center(
            child: Column(
              children: [
                Icon(Icons.park_rounded, size: 64, color: AppTheme.green),
                SizedBox(height: 8),
              ],
            ),
          ),
          
          Text(
            '$type ($variety)',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          
          // Badge list row
          Wrap(
            spacing: 8,
            children: [
              _badgeChip('Mã số: #$treeCode', Colors.white24),
              InkWell(
                onTap: _updateHealthPublicly,
                child: _badgeChip('Sức khỏe: $health', statusColor.withOpacity(0.2), textColor: statusColor),
              ),
              _badgeChip('Tuổi: $age năm', Colors.white24),
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
    
    // Hardcoded default blooming date/bloomed status matching web mockup
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
        color: const Color(0xFF04342A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: AppTheme.green),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(fontSize: 9, color: Colors.white60, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
          )
        ],
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
        color: const Color(0xFF04342A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('🌿 Ghi nhật ký nhanh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 4),
          const Text(
            'Chọn quy trình chăm sóc bên dưới để điền thông tin nhanh (không cần đăng nhập).',
            style: TextStyle(fontSize: 10, color: Colors.white60),
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
                    color: Colors.white.withOpacity(0.03),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(item['icon'] as IconData, size: 14, color: item['color'] as Color),
                      const SizedBox(width: 6),
                      Text(item['label'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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
        color: const Color(0xFF04342A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📷 Thư viện hình ảnh', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
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
                    color: Colors.white10,
                    child: const Icon(Icons.broken_image_rounded, color: Colors.white30),
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
        color: const Color(0xFF04342A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📅 Nhật ký chăm sóc cây', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 16),
          _logs.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('Chưa có hoạt động canh tác nào được ghi.', style: TextStyle(fontSize: 12, color: Colors.white30))),
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
                    
                    // Parse details
                    final details = log['details'] as Map<String, dynamic>? ?? {};
                    final detailVal = details['value'] ?? 
                                      details['method'] ?? 
                                      details['fertilizer'] ?? 
                                      details['pesticide'] ?? 
                                      details['reason'] ?? 
                                      details['disease'] ?? '';

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
                                  color: index == _logs.length - 1 ? Colors.transparent : Colors.white12,
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
                                color: Colors.white.withOpacity(0.02),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.white10),
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
                                      Text(date, style: const TextStyle(fontSize: 10, color: Colors.white30)),
                                    ],
                                  ),
                                  if (detailVal.toString().isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text('• Chi tiết: $detailVal', style: const TextStyle(fontSize: 12, color: Colors.white)),
                                  ],
                                  if (note.toString().isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text('• Ghi chú: $note', style: const TextStyle(fontSize: 12, color: Colors.white70)),
                                  ]
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
}
