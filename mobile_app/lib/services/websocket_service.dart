import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../core/state/app_state_and_concepts.dart';
import 'api_service.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  WebSocket? _socket;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get stream => _controller.stream;

  bool _isConnecting = false;
  bool _manuallyClosed = false;
  int _reconnectAttempt = 0;
  Timer? _reconnectTimer;

  int get reconnectAttempt => _reconnectAttempt;

  String get wsUrl {
    final baseUrl = ApiService().baseUrl;
    if (baseUrl.contains('https://')) {
      return baseUrl.replaceAll('https://', 'wss://').replaceAll('/api', '');
    } else if (baseUrl.contains('http://')) {
      return baseUrl.replaceAll('http://', 'ws://').replaceAll('/api', '');
    }
    return AppConcepts.wsUrl;
  }

  /// Tính thời gian chờ kết nối lại theo hàm mũ: 5s -> 10s -> 20s -> 40s -> tối đa 60s.
  static Duration computeReconnectDelay(int attempt) {
    final int safeAttempt = attempt < 0 ? 0 : (attempt > 6 ? 6 : attempt);
    final int seconds = AppConcepts.wsBaseReconnectSeconds * (1 << safeAttempt);
    final int capped = seconds > AppConcepts.wsMaxReconnectSeconds
        ? AppConcepts.wsMaxReconnectSeconds
        : seconds;
    return Duration(seconds: capped);
  }

  void connect() async {
    if (_socket != null || _isConnecting) return;
    _manuallyClosed = false;
    _isConnecting = true;

    try {
      final url = wsUrl;
      final authToken = await ApiService().token;
      final Map<String, dynamic>? headers = (authToken != null && authToken.isNotEmpty)
          ? {'Authorization': 'Bearer $authToken'}
          : null;

      _socket = await WebSocket.connect(url, headers: headers)
          .timeout(AppConcepts.wsConnectTimeout);
      _isConnecting = false;
      _reconnectAttempt = 0;
      AppStateStore().setWsConnected(true);
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
    AppStateStore().setWsConnected(false);
    _reconnectTimer?.cancel();
    if (_manuallyClosed) return;

    final delay = computeReconnectDelay(_reconnectAttempt);
    _reconnectAttempt++;
    _reconnectTimer = Timer(delay, () {
      if (_manuallyClosed) return;
      print('🔄 Attempting WebSocket reconnect (delay ${delay.inSeconds}s)...');
      connect();
    });
  }

  void close() {
    _manuallyClosed = true;
    _reconnectAttempt = 0;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _socket?.close();
    _socket = null;
    _isConnecting = false;
    AppStateStore().setWsConnected(false);
  }
}
