import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';

/// API hata sarmalayıcısı — kullanıcıya gösterilebilir Türkçe mesaj taşır.
class ApiException implements Exception {
  final int? statusCode;
  final String message;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

/// Dio tabanlı HTTP istemcisi.
///
/// - Tokenlar flutter_secure_storage'da tutulur (refresh token dahil).
/// - 401 alınca otomatik olarak POST /api/auth/refresh ile access token
///   yenilenir ve istek BİR kez tekrarlanır; yenileme de başarısız olursa
///   oturum kapatılır ve [onSessionExpired] tetiklenir.
class ApiClient {
  final Dio _dio;
  final FlutterSecureStorage _storage;

  String? _accessToken;
  String? _refreshToken;

  /// Refresh de başarısız olduğunda çağrılır (UI login'e yönlendirir).
  VoidCallback? onSessionExpired;

  ApiClient({Dio? dio, FlutterSecureStorage? storage})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              headers: {'Content-Type': 'application/json'},
            )),
        _storage = storage ?? const FlutterSecureStorage() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_accessToken != null && !options.path.contains('/auth/login')) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        handler.next(options);
      },
    ));
  }

  String? get accessToken => _accessToken;
  bool get hasToken => _accessToken != null;

  // ---- Token yönetimi ----

  Future<void> loadTokens() async {
    _accessToken = await _storage.read(key: 'accessToken');
    _refreshToken = await _storage.read(key: 'refreshToken');
  }

  Future<void> saveTokens(String accessToken, String refreshToken) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    await _storage.write(key: 'accessToken', value: accessToken);
    await _storage.write(key: 'refreshToken', value: refreshToken);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) return false;
    try {
      // Ayrı bir Dio kullan — interceptor döngüsüne girmesin
      final response = await Dio(BaseOptions(baseUrl: AppConfig.apiUrl)).post(
        '/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String?;
      final newRefresh = (data['refreshToken'] as String?) ?? refreshToken;
      if (newAccess == null) return false;
      await saveTokens(newAccess, newRefresh);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- HTTP metodları ----

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _request(() => _dio.get(path, queryParameters: query));

  Future<dynamic> post(String path, {Object? data}) =>
      _request(() => _dio.post(path, data: data));

  Future<dynamic> put(String path, {Object? data}) =>
      _request(() => _dio.put(path, data: data));

  Future<dynamic> delete(String path, {Object? data}) =>
      _request(() => _dio.delete(path, data: data));

  Future<dynamic> _request(Future<Response> Function() send,
      {bool retried = false}) async {
    try {
      final response = await send();
      return response.data;
    } on DioException catch (e) {
      final status = e.response?.statusCode;

      // 401 → bir kez refresh dene
      if (status == 401 && !retried) {
        final refreshed = await _tryRefresh();
        if (refreshed) {
          return _request(send, retried: true);
        }
        await clearTokens();
        onSessionExpired?.call();
        throw ApiException('Oturum süresi doldu, lütfen tekrar giriş yapın.',
            statusCode: 401);
      }

      throw ApiException(_extractMessage(e), statusCode: status);
    }
  }

  String _extractMessage(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final error = data['error'];
      if (error is Map<String, dynamic> && error['message'] is String) {
        return error['message'] as String;
      }
      if (data['message'] is String) return data['message'] as String;
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'Sunucuya bağlanılamadı (zaman aşımı).';
      case DioExceptionType.connectionError:
        return 'Sunucuya ulaşılamıyor. Ağ bağlantınızı kontrol edin.';
      default:
        return 'İstek başarısız oldu (${e.response?.statusCode ?? 'ağ hatası'}).';
    }
  }
}
