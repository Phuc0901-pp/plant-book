import 'package:flutter/material.dart';
import '../models/plant.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../pages/plant_detail_page.dart';

class QrNfcScanner extends StatefulWidget {
  final bool isNfcMode;

  const QrNfcScanner({super.key, this.isNfcMode = false});

  @override
  State<QrNfcScanner> createState() => _QrNfcScannerState();
}

class _QrNfcScannerState extends State<QrNfcScanner> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  final TextEditingController _codeController = TextEditingController();
  
  bool _isProcessing = false;
  String? _statusText;
  List<Plant> _availablePlants = [];

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    
    _loadPlants();
  }

  Future<void> _loadPlants() async {
    try {
      final plants = await ApiService().fetchPlants();
      setState(() {
        _availablePlants = plants;
      });
    } catch (e) {
      // Ignored
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _processScan(String code) async {
    if (code.trim().isEmpty) return;
    
    setState(() {
      _isProcessing = true;
      _statusText = widget.isNfcMode ? 'Đang đọc thẻ NFC...' : 'Đang đối chiếu mã QR...';
    });

    await Future<void>.delayed(const Duration(milliseconds: 1200));

    // Try finding the plant with matching tree_code or ID
    Plant? matchedPlant;
    for (var p in _availablePlants) {
      if (p.treeCode?.toLowerCase() == code.toLowerCase() || p.id.toString() == code) {
        matchedPlant = p;
        break;
      }
    }

    if (!mounted) return;

    if (matchedPlant != null) {
      setState(() {
        _isProcessing = false;
        _statusText = 'Kết nối thành công!';
      });
      
      Navigator.pop(context); // Close scanner modal
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PlantDetailPage(plant: matchedPlant!),
        ),
      );
    } else {
      setState(() {
        _isProcessing = false;
        _statusText = 'Không tìm thấy cây trồng có mã "$code"';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.isNfcMode ? 'Đọc thẻ NFC Cây' : 'Quét Mã QR Cây';

    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 5,
            decoration: BoxDecoration(
              color: AppTheme.grayBorder,
              borderRadius: BorderRadius.circular(2.5),
            ),
          ),
          const SizedBox(height: 16),
          
          // Header title
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textMain,
            ),
          ),
          const SizedBox(height: 24),
          
          // Scanner Box
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  if (!widget.isNfcMode) ...[
                    // QR Scanner View simulation
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 200,
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppTheme.greenDark, width: 4),
                            borderRadius: BorderRadius.circular(16),
                            color: Colors.black.withOpacity(0.05),
                          ),
                          child: const Icon(Icons.qr_code_2_rounded, size: 100, color: Colors.black12),
                        ),
                        // Scanning laser line animation
                        AnimatedBuilder(
                          animation: _animationController,
                          builder: (context, child) {
                            return Positioned(
                              top: 10 + (_animationController.value * 170),
                              child: Container(
                                width: 180,
                                height: 3,
                                decoration: BoxDecoration(
                                  color: Colors.redAccent,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.redAccent.withOpacity(0.5),
                                      blurRadius: 4,
                                      spreadRadius: 1,
                                    )
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ] else ...[
                    // NFC Scanner View simulation
                    Container(
                      width: 200,
                      height: 200,
                      decoration: BoxDecoration(
                        color: AppTheme.userAccentSoft,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppTheme.userAccent.withOpacity(0.3), width: 3),
                      ),
                      child: const Icon(
                        Icons.nfc_rounded,
                        size: 80,
                        color: AppTheme.userAccent,
                      ),
                    ),
                  ],
                  
                  const SizedBox(height: 24),
                  
                  // Status Text
                  if (_statusText != null)
                    Text(
                      _statusText!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: _statusText!.contains('thành công') ? AppTheme.green : AppTheme.red,
                      ),
                    ),
                  
                  const SizedBox(height: 24),
                  
                  // Form input to type / simulate scan
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Nhập mã định danh cây (Simulate Scan):',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          decoration: const InputDecoration(
                            hintText: 'Nhập mã cây (ví dụ: XOAI-001, 2...)',
                            contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          ),
                          enabled: !_isProcessing,
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isProcessing ? null : () => _processScan(_codeController.text),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: widget.isNfcMode ? AppTheme.userAccent : AppTheme.green,
                        ),
                        child: const Text('OK'),
                      )
                    ],
                  ),
                  
                  const SizedBox(height: 24),
                  const Divider(color: AppTheme.grayBorder),
                  const SizedBox(height: 12),
                  
                  // Quick lists of plants to test scan instantly
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Hoặc chọn nhanh từ danh sách cây thực tế:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted),
                    ),
                  ),
                  const SizedBox(height: 8),
                  
                  _availablePlants.isEmpty
                      ? const Text('Đang tải danh sách cây trồng...', style: TextStyle(fontSize: 12, color: AppTheme.textMuted))
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _availablePlants.length,
                          itemBuilder: (context, index) {
                            final p = _availablePlants[index];
                            final displayCode = p.treeCode ?? p.id.toString();
                            return ListTile(
                              title: Text('Cây #$displayCode - ${p.plantType}'),
                              subtitle: Text('Sức khỏe: ${p.healthStatus}'),
                              trailing: Icon(Icons.arrow_forward_ios_rounded, size: 14, color: widget.isNfcMode ? AppTheme.userAccent : AppTheme.green),
                              onTap: _isProcessing ? null : () {
                                _codeController.text = displayCode;
                                _processScan(displayCode);
                              },
                            );
                          },
                        ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
