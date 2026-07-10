import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'api_service.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  WebSocket? _socket;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get stream => _controller.stream;

  bool _isConnecting = false;
  Timer? _reconnectTimer;

  String get wsUrl {
    final apiService = ApiService();
    final baseUrl = apiService.baseUrl;
    // Replace http/https with ws/wss and remove /api suffix
    if (baseUrl.contains('https://')) {
      return baseUrl.replaceAll('https://', 'wss://').replaceAll('/api', '');
    } else {
      return baseUrl.replaceAll('http://', 'ws://').replaceAll('/api', '');
    }
  }

  void connect() async {
    if (_socket != null || _isConnecting) return;
    _isConnecting = true;

    try {
      final url = wsUrl;
      print('🔌 Connecting to WebSocket: $url');
      
      // Override HttpClient to trust self-signed/proxy certificates if needed
      _socket = await WebSocket.connect(url).timeout(const Duration(seconds: 15));
      _isConnecting = false;
      print('✅ WebSocket Connected!');
      
      _reconnectTimer?.cancel();

      _socket!.listen(
        (data) {
          try {
            final Map<String, dynamic> msg = jsonDecode(data.toString());
            _controller.add(msg);
          } catch (e) {
            print('Error parsing ws msg: $e');
          }
        },
        onError: (err) {
          print('WebSocket error: $err');
          _handleDisconnect();
        },
        onDone: () {
          print('WebSocket closed');
          _handleDisconnect();
        },
      );
    } catch (e) {
      _isConnecting = false;
      print('WebSocket connection failed: $e');
      _handleDisconnect();
    }
  }

  void _handleDisconnect() {
    _socket = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      print('🔄 Attempting WebSocket reconnect...');
      connect();
    });
  }

  void close() {
    _reconnectTimer?.cancel();
    _socket?.close();
    _socket = null;
  }
}
