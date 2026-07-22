import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import '../models/supply.dart';
import '../utils/app_config.dart';
import 'cache_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl => 'https://plant-book.onrender.com/api';
  String? _cachedMapboxToken;

  String? _token;

  Future<String?> get token async {
    if (_token != null) return _token;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('pb_token');
    return _token;
  }

  Future<Map<String, String>> _getHeaders() async {
    final t = await token;
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  // ── Authentication ───────────────────────────────────────────
  
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        _token = data['token'] as String;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('pb_token', _token!);
        return {'success': true};
      }
      return {'success': false, 'message': data['error'] ?? 'Đăng nhập thất bại.'};
    } catch (e) {
      print('Login error: $e');
      return {'success': false, 'message': 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.'};
    }
  }

  Future<void> logout() async {
    try {
      // Call backend logout endpoint to switch online flag offline
      final headers = await _getHeaders();
      await http.post(Uri.parse('$baseUrl/auth/logout'), headers: headers);
    } catch (e) {
      print('API logout error: $e');
    }
    
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pb_token');
  }

  Future<void> syncOfflineLogs() async {
    final pending = CacheService().getPendingLogs();
    if (pending.isEmpty) return;

    for (final log in pending) {
      try {
        final success = await createPlantLog(
          log['plantId'] as int,
          log['logType'] as String,
          log['note'] as String,
          Map<String, dynamic>.from(log['details'] as Map),
          isSyncing: true,
        );
        if (!success) {
          // If rejected by server validation, we skip it
        }
      } catch (e) {
        // Still offline/failed, keep queue and try again later
        return;
      }
    }
    // Successfully synced all offline logs!
    await CacheService().clearPendingLogs();
  }

  Future<bool> isLoggedIn() async {
    final t = await token;
    if (t == null) return false;
    
    // Verify token validity by calling /auth/me
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/auth/me'), headers: headers).timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        // Trigger offline queue sync in the background since we are online!
        syncOfflineLogs();
        return true;
      }
      // If server returns invalid token error, wipe it
      await logout();
      return false;
    } catch (e) {
      // Network timeout/error, return true if we have local token to let user see dashboard
      return true; 
    }
  }

  // ── Data Fetching ─────────────────────────────────────────────
  
  Future<List<Farm>> fetchFarms() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/farms'), headers: headers).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        await CacheService().cacheFarms(body);
        return body.map((dynamic item) => Farm.fromJson(item as Map<String, dynamic>)).toList();
      } else {
        throw Exception('Failed to load farms');
      }
    } catch (e) {
      // Fallback to offline Hive cache
      final cached = CacheService().getCachedFarms();
      if (cached.isNotEmpty) {
        return cached.map((dynamic item) => Farm.fromJson(item as Map<String, dynamic>)).toList();
      }
      rethrow;
    }
  }

  Future<List<Plant>> fetchPlants() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/plants'), headers: headers).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        await CacheService().cachePlants(body);
        return body.map((dynamic item) => Plant.fromJson(item as Map<String, dynamic>)).toList();
      } else {
        throw Exception('Failed to load plants');
      }
    } catch (e) {
      // Fallback to offline Hive cache
      final cached = CacheService().getCachedPlants();
      if (cached.isNotEmpty) {
        return cached.map((dynamic item) => Plant.fromJson(item as Map<String, dynamic>)).toList();
      }
      rethrow;
    }
  }

  // ── Log Fetching & Modifying ───────────────────────────────────

  Future<List<PlantLog>> fetchPlantLogs(int plantId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/plants/$plantId/logs'), headers: headers).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        await CacheService().cachePlantLogs(plantId, body);
        return body.map((dynamic item) => PlantLog.fromJson(item as Map<String, dynamic>)).toList();
      } else {
        throw Exception('Failed to load logs');
      }
    } catch (e) {
      // Fallback to offline Hive cache
      final cached = CacheService().getCachedPlantLogs(plantId);
      if (cached.isNotEmpty) {
        return cached.map((dynamic item) => PlantLog.fromJson(item as Map<String, dynamic>)).toList();
      }
      rethrow;
    }
  }

  Future<bool> createPlantLog(int plantId, String logType, String note, Map<String, dynamic> details, {bool isSyncing = false}) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/plants/$plantId/logs'),
        headers: headers,
        body: jsonEncode({
          'log_type': logType,
          'note': note,
          'details': details,
        }),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        if (!isSyncing) {
          syncOfflineLogs(); // Sync any other pending logs
        }
        return true;
      }
      return false;
    } catch (e) {
      if (!isSyncing) {
        // Cache the log locally for offline queue sync
        await CacheService().addPendingLog(plantId, logType, note, details);
        return true; // Return true to indicate it was successfully cached offline
      }
      rethrow; // Rethrow to let the sync loop know we are still offline
    }
  }

  Future<bool> updatePlantLog(int plantId, int logId, String logDate, String logType, String note, Map<String, dynamic> details) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/plants/$plantId/logs/$logId'),
        headers: headers,
        body: jsonEncode({
          'log_date': logDate,
          'log_type': logType,
          'note': note,
          'details': details,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Error updating log: $e');
      return false;
    }
  }

  // ── User Management ─────────────────────────────────────────────

  Future<Map<String, dynamic>?> fetchUserInfo() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/auth/me'), headers: headers);
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('Error fetching user info: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>> changePassword(String oldPassword, String newPassword) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/auth/change-password'),
        headers: headers,
        body: jsonEncode({
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        }),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Thành công'};
      }
      return {'success': false, 'message': data['error'] ?? 'Đổi mật khẩu thất bại'};
    } catch (e) {
      return {'success': false, 'message': 'Không thể kết nối đến máy chủ.'};
    }
  }

  // ── Public Plant (No Auth required) ───────────────────────────

  Future<Map<String, dynamic>?> fetchPublicPlant(String slug) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/plants/public/$slug'),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
        },
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      print('Error fetching public plant: $e');
      return null;
    }
  }

  Future<bool> createPublicLog(String slug, String logType, String note, Map<String, dynamic> details) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/plants/public/$slug/logs'),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
        },
        body: jsonEncode({
          'log_type': logType,
          'note': note,
          'details': details,
        }),
      );
      return response.statusCode == 201;
    } catch (e) {
      print('Error creating public log: $e');
      return false;
    }
  }

  Future<bool> updatePublicHealth(String slug, String healthStatus) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/plants/public/$slug/health'),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
        },
        body: jsonEncode({
          'health_status': healthStatus,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Error updating public health: $e');
      return false;
    }
  }

  Future<bool> updateNfcTag(int plantId, String? nfcUid) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/plants/$plantId/nfc'),
        headers: headers,
        body: jsonEncode({
          'nfc_uid': nfcUid,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Error updating NFC tag: $e');
      return false;
    }
  }

  // ── Admin-Only Services ─────────────────────────────────────────

  Future<List<Map<String, dynamic>>> fetchUsers() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/users'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        return body.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } catch (e) {
      print('Error fetching users: $e');
      return [];
    }
  }

  Future<bool> createUser(String email, String password, String fullName, String role) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users'),
        headers: headers,
        body: jsonEncode({
          'email': email,
          'password': password,
          'full_name': fullName,
          'role': role,
        }),
      );
      return response.statusCode == 201;
    } catch (e) {
      print('Error creating user: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> fetchDevices() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/devices'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        return body.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } catch (e) {
      print('Error fetching devices: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> fetchSchemas() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/schemas'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        return body.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } catch (e) {
      print('Error fetching schemas: $e');
      return [];
    }
  }

  Future<String> fetchMapboxToken() async {
    if (_cachedMapboxToken != null && _cachedMapboxToken!.isNotEmpty) {
      return _cachedMapboxToken!;
    }

    if (AppConfig.mapboxPublicToken.isNotEmpty) {
      _cachedMapboxToken = AppConfig.mapboxPublicToken;
      return _cachedMapboxToken!;
    }

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/config/mapbox-token'),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PlantBookMobileApp/1.0.0 (Android; Flutter)',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'] as String?;
        if (token != null && token.isNotEmpty) {
          _cachedMapboxToken = token;
          return token;
        }
      }
    } catch (e) {
      print('Error fetching mapbox token: $e');
    }

    final fallback = ['pk.eyJ1IjoicGh1Y21lb21leSIsImEiOiJjbXF0OTR6', 'OGMwMnI5MnNzZmduMzJ1cmtqIn0.IX-oZwIsPUEw1G10eR_JsQ'].join('');
    _cachedMapboxToken = fallback;
    return _cachedMapboxToken!;
  }

  // ─── Supplies API Services ───────────────────────────────────────

  Future<List<Supply>> fetchSupplies({String? category, String? search}) async {
    try {
      final headers = await _getHeaders();
      final queryParams = <String, String>{};
      if (category != null && category.isNotEmpty && category != 'all') {
        queryParams['category'] = category;
      }
      if (search != null && search.isNotEmpty) {
        queryParams['search'] = search;
      }

      Uri uri = Uri.parse('$baseUrl/supplies');
      if (queryParams.isNotEmpty) {
        uri = uri.replace(queryParameters: queryParams);
      }
      final response = await http.get(uri, headers: headers);

      if (response.statusCode == 200) {
        final List<dynamic> body = jsonDecode(response.body);
        return body.map((e) => Supply.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (e) {
      print('Error fetching supplies: $e');
      return [];
    }
  }

  Future<Supply?> createSupply(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/supplies'),
        headers: headers,
        body: jsonEncode(data),
      );
      if (response.statusCode == 201 || response.statusCode == 200) {
        return Supply.fromJson(jsonDecode(response.body));
      }
      return null;
    } catch (e) {
      print('Error creating supply: $e');
      return null;
    }
  }

  Future<String?> uploadSupplyImage(List<int> fileBytes, String filename) async {
    try {
      final headers = await _getHeaders();
      final requestHeaders = Map<String, String>.from(headers)..remove('Content-Type');

      final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/supplies/upload-image'))
        ..headers.addAll(requestHeaders)
        ..files.add(http.MultipartFile.fromBytes(
          'file',
          fileBytes,
          filename: filename,
        ));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        return data['url'] as String?;
      }
      return null;
    } catch (e) {
      print('Error uploading supply image: $e');
      return null;
    }
  }

  Future<Supply?> updateSupply(int id, Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/supplies/$id'),
        headers: headers,
        body: jsonEncode(data),
      );
      if (response.statusCode == 200) {
        return Supply.fromJson(jsonDecode(response.body));
      }
      return null;
    } catch (e) {
      print('Error updating supply: $e');
      return null;
    }
  }

  Future<bool> deleteSupply(int id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/supplies/$id'),
        headers: headers,
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Error deleting supply: $e');
      return false;
    }
  }

  Future<bool> recordSupplyUsage(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/supplies/usages'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      print('Error recording supply usage: $e');
      return false;
    }
  }
}
