import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:nfc_manager/nfc_manager.dart';
import '../models/plant.dart';
import '../core/security/crypto_security_service.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';
import '../services/geo_fence_service.dart';
import '../utils/theme.dart';
import '../pages/plant_detail_page.dart';
import '../pages/public_plant_profile_page.dart';

class QrScannerPage extends StatefulWidget {
  final List<Plant> availablePlants;
  const QrScannerPage({super.key, required this.availablePlants});

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage>
    with TickerProviderStateMixin {
  MobileScannerController? _controller;
  bool _hasScanned = false;
  bool _torchOn = false;

  late AnimationController _lineController;
  late Animation<double> _lineAnimation;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );

    _lineController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _lineAnimation = Tween<double>(begin: 0.05, end: 0.95).animate(
      CurvedAnimation(parent: _lineController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    _lineController.dispose();
    super.dispose();
  }

  void _handleBarcode(String rawValue) async {
    if (_hasScanned) return;
    setState(() => _hasScanned = true);
    await _controller?.stop();

    await Future.delayed(const Duration(milliseconds: 100));

    if (!mounted) return;
    _routeToPlant(context, rawValue, '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Quét mã QR cây trồng',
            style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_off_rounded : Icons.flash_on_rounded,
                color: Colors.white),
            onPressed: () {
              setState(() => _torchOn = !_torchOn);
              _controller?.toggleTorch();
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller!,
            onDetect: (capture) {
              final barcodes = capture.barcodes;
              if (barcodes.isNotEmpty) {
                final rawValue = barcodes.first.rawValue ?? '';
                if (rawValue.isNotEmpty) _handleBarcode(rawValue);
              }
            },
          ),

          _buildOverlay(),

          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                const Icon(Icons.qr_code_scanner_rounded, color: Colors.white54, size: 28),
                const SizedBox(height: 8),
                Text(
                  _hasScanned ? 'Đọc mã thành công! Đang điều hướng...' : 'Hướng camera vào mã QR cây trồng',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _hasScanned ? AppTheme.green : Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverlay() {
    final double cutoutSize = MediaQuery.of(context).size.width * 0.72;
    return Stack(
      children: [
        Column(
          children: [
            Expanded(child: Container(color: Colors.black.withOpacity(0.65))),
            Row(
              children: [
                Container(
                    width: (MediaQuery.of(context).size.width - cutoutSize) / 2,
                    height: cutoutSize,
                    color: Colors.black.withOpacity(0.65)),
                SizedBox(
                  width: cutoutSize,
                  height: cutoutSize,
                  child: Stack(
                    children: [
                      AnimatedBuilder(
                        animation: _lineAnimation,
                        builder: (context, _) => Positioned(
                          top: cutoutSize * _lineAnimation.value,
                          left: 12,
                          right: 12,
                          child: Container(
                            height: 2.5,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  AppTheme.green.withOpacity(0.8),
                                  AppTheme.green,
                                  AppTheme.green.withOpacity(0.8),
                                  Colors.transparent,
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.green.withOpacity(0.4),
                                  blurRadius: 8,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      ..._buildCornerBrackets(cutoutSize),
                    ],
                  ),
                ),
                Container(
                    width: (MediaQuery.of(context).size.width - cutoutSize) / 2,
                    height: cutoutSize,
                    color: Colors.black.withOpacity(0.65)),
              ],
            ),
            Expanded(child: Container(color: Colors.black.withOpacity(0.65))),
          ],
        ),
      ],
    );
  }

  List<Widget> _buildCornerBrackets(double size) {
    const thick = 4.0;
    const length = 28.0;
    const Color bracketColor = AppTheme.green;
    return [
      Positioned(top: 0, left: 0, child: _corner(length, thick, bracketColor, true, true)),
      Positioned(top: 0, right: 0, child: _corner(length, thick, bracketColor, true, false)),
      Positioned(bottom: 0, left: 0, child: _corner(length, thick, bracketColor, false, true)),
      Positioned(bottom: 0, right: 0, child: _corner(length, thick, bracketColor, false, false)),
    ];
  }

  Widget _corner(double len, double thick, Color color, bool top, bool left) {
    return SizedBox(
      width: len,
      height: len,
      child: CustomPaint(painter: _CornerPainter(color, thick, top, left)),
    );
  }
}

class _CornerPainter extends CustomPainter {
  final Color color;
  final double thick;
  final bool top;
  final bool left;

  _CornerPainter(this.color, this.thick, this.top, this.left);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thick
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    if (top && left) {
      canvas.drawLine(Offset(0, size.height), Offset(0, 0), paint);
      canvas.drawLine(Offset(0, 0), Offset(size.width, 0), paint);
    } else if (top && !left) {
      canvas.drawLine(Offset(size.width, size.height), Offset(size.width, 0), paint);
      canvas.drawLine(Offset(size.width, 0), Offset(0, 0), paint);
    } else if (!top && left) {
      canvas.drawLine(Offset(0, 0), Offset(0, size.height), paint);
      canvas.drawLine(Offset(0, size.height), Offset(size.width, size.height), paint);
    } else {
      canvas.drawLine(Offset(size.width, 0), Offset(size.width, size.height), paint);
      canvas.drawLine(Offset(size.width, size.height), Offset(0, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class NfcScannerPage extends StatefulWidget {
  final List<Plant> availablePlants;
  const NfcScannerPage({super.key, required this.availablePlants});

  @override
  State<NfcScannerPage> createState() => _NfcScannerPageState();
}

class _NfcScannerPageState extends State<NfcScannerPage>
    with TickerProviderStateMixin {
  String _statusText = 'Đưa điện thoại lại gần thẻ NFC...';
  bool _isSuccess = false;
  bool _isError = false;
  bool _isReading = false;
  bool _nfcAvailable = false;

  late AnimationController _rippleController;
  late Animation<double> _rippleScale;
  late Animation<double> _rippleOpacity;

  late AnimationController _successController;
  late Animation<double> _successScale;

  @override
  void initState() {
    super.initState();

    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();

    _rippleScale = Tween<double>(begin: 0.8, end: 1.6).animate(
      CurvedAnimation(parent: _rippleController, curve: Curves.easeOut),
    );
    _rippleOpacity = Tween<double>(begin: 0.6, end: 0.0).animate(
      CurvedAnimation(parent: _rippleController, curve: Curves.easeOut),
    );

    _successController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _successScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _successController, curve: Curves.elasticOut),
    );

    _initNfc();
  }

  @override
  void dispose() {
    NfcManager.instance.stopSession();
    _rippleController.dispose();
    _successController.dispose();
    super.dispose();
  }

  Future<void> _initNfc() async {
    final isAvail = await NfcManager.instance.isAvailable();
    if (!mounted) return;

    if (!isAvail) {
      setState(() {
        _nfcAvailable = false;
        _isError = true;
        _statusText = 'Thiết bị không hỗ trợ NFC hoặc NFC chưa được bật.';
      });
      return;
    }

    setState(() {
      _nfcAvailable = true;
      _isReading = true;
    });

    NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
      final List<dynamic>? identifier =
          tag.data['isodep']?['identifier'] ??
          tag.data['nfca']?['identifier'] ??
          tag.data['mifare']?['identifier'] ??
          tag.data['mifareultralight']?['identifier'] ??
          tag.data['ndef']?['identifier'];

      String? scannedUid;
      if (identifier != null) {
        scannedUid = identifier.map((e) => e.toRadixString(16).padLeft(2, '0').toUpperCase()).join(':');
      }

      final ndef = Ndef.from(tag);
      String? readValue;

      if (ndef != null) {
        try {
          final cachedMessage = ndef.cachedMessage;
          if (cachedMessage != null) {
            for (final record in cachedMessage.records) {
              final payload = record.payload;
              if (payload.isNotEmpty) {
                final prefix = payload[0];
                String text;
                if (prefix >= 0x01 && prefix <= 0x04) {
                  const prefixes = {
                    0x01: 'http://www.',
                    0x02: 'https://www.',
                    0x03: 'http://',
                    0x04: 'https://',
                  };
                  final scheme = prefixes[prefix] ?? '';
                  text = scheme + String.fromCharCodes(payload.sublist(1));
                } else {
                  final langLength = payload[0] & 0x3F;
                  text = String.fromCharCodes(payload.sublist(1 + langLength));
                }
                readValue = text.trim();
                break;
              }
            }
          }
        } catch (_) {
          readValue = null;
        }
      }

      await NfcManager.instance.stopSession();
      if (!mounted) return;

      if ((readValue != null && readValue.isNotEmpty) || (scannedUid != null && scannedUid.isNotEmpty)) {
        _onReadSuccess(readValue ?? '', scannedUid ?? '');
      } else {
        setState(() {
          _isError = true;
          _isReading = false;
          _statusText = 'Thẻ NFC trống hoặc không nhận diện được mã thẻ.';
        });
      }
    }, onError: (error) async {
      if (!mounted) return;
      setState(() {
        _isError = true;
        _isReading = false;
        _statusText = 'Lỗi đọc thẻ: ${error.message}';
      });
    });
  }

  void _onReadSuccess(String value, String scannedUid) async {
    setState(() {
      _isSuccess = true;
      _isReading = false;
      _statusText = 'Đọc thẻ thành công!';
    });

    _rippleController.stop();
    _successController.forward();

    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    _routeToPlant(context, value, scannedUid);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A1628),
        foregroundColor: Colors.white,
        title: const Text('Đọc thẻ NFC cây trồng',
            style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 200,
              height: 200,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (_isReading) ...[
                    AnimatedBuilder(
                      animation: _rippleController,
                      builder: (context, _) => Transform.scale(
                        scale: _rippleScale.value,
                        child: Container(
                          width: 160,
                          height: 160,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppTheme.green.withOpacity(_rippleOpacity.value),
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                    ),
                    AnimatedBuilder(
                      animation: _rippleController,
                      builder: (context, _) {
                        final delayed = (_rippleController.value + 0.4) % 1.0;
                        final scale = 0.8 + delayed * 0.8;
                        final opacity = 0.6 - delayed * 0.6;
                        return Transform.scale(
                          scale: scale,
                          child: Container(
                            width: 160,
                            height: 160,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppTheme.green.withOpacity(opacity.clamp(0.0, 1.0)),
                                width: 2,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ],

                  AnimatedContainer(
                    duration: const Duration(milliseconds: 400),
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _isSuccess
                          ? AppTheme.green
                          : _isError
                              ? AppTheme.red
                              : const Color(0xFF1E3A5F),
                      boxShadow: [
                        BoxShadow(
                          color: (_isSuccess
                              ? AppTheme.green
                              : _isError
                                  ? AppTheme.red
                                  : AppTheme.green).withOpacity(0.3),
                          blurRadius: 24,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: _isSuccess
                        ? ScaleTransition(
                            scale: _successScale,
                            child: const Icon(Icons.check_rounded,
                                size: 56, color: Colors.white),
                          )
                        : _isError
                            ? const Icon(Icons.close_rounded,
                                size: 56, color: Colors.white)
                            : const Icon(Icons.nfc_rounded,
                                size: 56, color: AppTheme.green),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _statusText,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: _isError ? AppTheme.red : Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 8),

            if (_isReading)
              const Text(
                'Chạm thẻ NFC của cây trồng vào mặt sau điện thoại',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, fontSize: 13),
              ),

            if (_isError) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    _isReading = true;
                    _isError = false;
                    _isSuccess = false;
                    _statusText = 'Đưa điện thoại lại gần thẻ NFC...';
                  });
                  _rippleController.repeat();
                  _initNfc();
                },
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Thử lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],

            if (_isError && !_nfcAvailable) ...[
              const SizedBox(height: 24),
              const Text(
                'Hãy bật NFC trong Cài đặt → Kết nối → NFC',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

void _routeToPlant(BuildContext context, String code, String scannedUid) async {
  final apiService = ApiService();

  final cleanScannedUid = scannedUid.trim();
  final cleanCode = code.trim();

  String pathNfcUid = '';
  String pathPlantId = '';
  String pathSlug = '';
  String? scannedCounter;
  String? scannedToken;
  int scannedIssueLevel = 1;

  if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://') || cleanCode.contains('/')) {
    final uri = Uri.tryParse(cleanCode);
    final segments = uri?.pathSegments ?? cleanCode.split('/').where((s) => s.isNotEmpty).toList();

    if (uri != null) {
      scannedCounter = uri.queryParameters['ctr'];
      scannedToken = uri.queryParameters['sig'] ?? uri.queryParameters['token'];
      final ilParam = uri.queryParameters['il'] ?? uri.queryParameters['issue_level'];
      if (ilParam != null) {
        scannedIssueLevel = int.tryParse(ilParam.replaceAll(RegExp(r'[^0-9]'), '')) ?? 1;
      }
    }

    if (segments.isNotEmpty) {
      pathSlug = Uri.decodeComponent(segments.last);
      if (segments.length >= 4) {
        pathPlantId = Uri.decodeComponent(segments[2]);
        pathNfcUid = Uri.decodeComponent(segments[3]);
      } else if (segments.length == 3) {
        pathPlantId = Uri.decodeComponent(segments[2]);
      } else if (segments.length == 2 && (segments[0] == 'nfc' || segments[0] == 'plant')) {
        if (segments[0] == 'nfc') pathNfcUid = Uri.decodeComponent(segments[1]);
        if (segments[0] == 'plant') pathSlug = Uri.decodeComponent(segments[1]);
      }
    }
  }

  final searchUid = cleanScannedUid.isNotEmpty ? cleanScannedUid : pathNfcUid;
  final searchPlantId = pathPlantId;

  List<Plant> allPlants = [];
  try {
    allPlants = await apiService.fetchPlants();
  } catch (_) {
    final cached = CacheService().getCachedPlants();
    allPlants = cached
        .whereType<Map>()
        .map((e) => Plant.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Plant? matched;

  if (allPlants.isNotEmpty) {
    if (searchUid.isNotEmpty) {
      final normalizedSearchUid = CryptoSecurityService.normalizeNfcUid(searchUid);
      try {
        matched = allPlants.firstWhere(
          (p) => p.nfcUid != null && CryptoSecurityService.normalizeNfcUid(p.nfcUid!) == normalizedSearchUid,
        );
      } catch (_) {}
    }

    if (matched == null && searchPlantId.isNotEmpty) {
      try {
        matched = allPlants.firstWhere(
          (p) => p.id.toString() == searchPlantId,
        );
      } catch (_) {}
    }

    if (matched == null && pathSlug.isNotEmpty) {
      try {
        matched = allPlants.firstWhere(
          (p) =>
              p.publicSlug == pathSlug ||
              (p.nfcUid != null && CryptoSecurityService.normalizeNfcUid(p.nfcUid!) == CryptoSecurityService.normalizeNfcUid(pathSlug)) ||
              p.id.toString() == pathSlug ||
              (p.treeCode != null && p.treeCode!.toLowerCase() == pathSlug.toLowerCase()),
        );
      } catch (_) {}
    }

    if (matched == null && cleanCode.isNotEmpty) {
      try {
        matched = allPlants.firstWhere(
          (p) =>
              (p.treeCode != null && p.treeCode!.toLowerCase() == cleanCode.toLowerCase()) ||
              (p.nfcUid != null && CryptoSecurityService.normalizeNfcUid(p.nfcUid!) == CryptoSecurityService.normalizeNfcUid(cleanCode)) ||
              p.id.toString() == cleanCode,
        );
      } catch (_) {}
    }
  }

  if (matched != null) {
    final pos = await GeoFenceService().getCurrentPositionSafe();
    final effectiveUid = searchUid.isNotEmpty ? searchUid : (matched.nfcUid ?? 'NTAG213-${matched.id}');
    final verification = CryptoSecurityService.verifyNtag213Scan5Layer(
      scannedUid: effectiveUid,
      expectedPlantUid: matched.nfcUid,
      scannedIssueLevel: scannedIssueLevel,
      expectedIssueLevel: matched.issueLevel,
      scannedHmacSignature: scannedToken,
      plantId: matched.id,
      expectedChuidHash: matched.chuidHash,
      userLat: pos?.latitude,
      userLng: pos?.longitude,
      plantLat: matched.latitude,
      plantLng: matched.longitude,
    );

    if (searchUid.isNotEmpty || scannedCounter != null || scannedToken != null) {
      apiService.verifyNfcScan(
        nfcUid: effectiveUid,
        plantId: matched.id,
        counter: int.tryParse(scannedCounter ?? ''),
        token: scannedToken,
        issueLevel: scannedIssueLevel,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );
    }

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                verification.isValid ? Icons.verified_user_rounded : Icons.gpp_maybe_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Cây #${matched.treeCode ?? matched.id} · Bảo mật ${verification.passedLayers}/5 lớp (IL${matched.issueLevel} · HMAC-SHA256)',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                ),
              ),
            ],
          ),
          backgroundColor: verification.isValid ? AppTheme.green : AppTheme.amber,
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => PlantDetailPage(plant: matched!)),
      );
      return;
    }
  }

  final fetchQuery = searchUid.isNotEmpty
      ? searchUid
      : (searchPlantId.isNotEmpty ? searchPlantId : (pathSlug.isNotEmpty ? pathSlug : cleanCode));

  if (fetchQuery.isNotEmpty) {
    try {
      final publicData = await apiService.fetchPublicPlant(fetchQuery);
      if (publicData != null && publicData['id'] != null) {
        final fetchedPlant = Plant.fromJson(publicData);
        if (context.mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => PlantDetailPage(plant: fetchedPlant)),
          );
          return;
        }
      }
    } catch (_) {}

    if (searchPlantId.isNotEmpty && searchPlantId != fetchQuery) {
      try {
        final publicData = await apiService.fetchPublicPlant(searchPlantId);
        if (publicData != null && publicData['id'] != null) {
          final fetchedPlant = Plant.fromJson(publicData);
          if (context.mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => PlantDetailPage(plant: fetchedPlant)),
            );
            return;
          }
        }
      } catch (_) {}
    }
  }

  if (pathSlug.isNotEmpty || fetchQuery.isNotEmpty) {
    if (context.mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => PublicPlantProfilePage(slug: pathSlug.isNotEmpty ? pathSlug : fetchQuery),
        ),
      );
      return;
    }
  }

  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(cleanScannedUid.isNotEmpty
            ? 'Không tìm thấy cây trồng khớp với thẻ NFC "$cleanScannedUid".'
            : 'Không tìm thấy cây trồng phù hợp.'),
        backgroundColor: AppTheme.red,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class QrNfcScanner extends StatelessWidget {
  final bool isNfcMode;
  const QrNfcScanner({super.key, this.isNfcMode = false});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
