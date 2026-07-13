import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/farm.dart';
import '../models/plant.dart';
import '../models/plant_log.dart';
import 'cache_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl => 'https://plant-book.onrender.com/api';

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
  
  Future<bool> login(String email, String password) async {
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
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _token = data['token'] as String;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('pb_token', _token!);
        return true;
      }
      return false;
    } catch (e) {
      print('Login error: $e');
      return false;
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
        final user = jsonDecode(response.body);
        
        // Trigger offline queue sync in the background since we are online!
        syncOfflineLogs();

        // Ensure the logged in role is not admin (this is the farmer portal)
        return user['role'] != 'admin';
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
}
