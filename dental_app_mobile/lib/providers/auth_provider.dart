import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/api_repository.dart';
import '../core/mobile_access_policy.dart';
import '../core/socket_service.dart';
import '../models/models.dart';

/// Oturum durumu.
/// - login: token'ları güvenli depoya yazar, soketi bağlar
/// - checkAuth: açılışta GET /api/auth/me ile oturumu backend'de doğrular
/// - logout: refresh token'ı sunucuda iptal eder, soketi kapatır
class AuthProvider extends ChangeNotifier {
  final ApiClient _client;
  final ApiRepository _repository;
  final SocketService socketService;

  User? _currentUser;
  bool _isAuthenticated = false;
  bool _initialized = false;

  AuthProvider(this._client, this._repository, this.socketService) {
    // Refresh de başarısız olursa oturumu kapat
    _client.onSessionExpired = () {
      _currentUser = null;
      _isAuthenticated = false;
      socketService.disconnect();
      notifyListeners();
    };
  }

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get initialized => _initialized;

  Future<bool> login(String email, String password, {String? mfaCode}) async {
    try {
      final response =
          await _repository.login(email, password, mfaCode: mfaCode);
      final access = MobileAccessPolicy.forUser(response.user);
      if (!access.isSupported) {
        await _client.clearTokens();
        throw ApiException(
          'Mobil uygulamaya yalnızca patron ve diş hekimi hesapları giriş yapabilir.',
          statusCode: 403,
        );
      }
      if (response.mfaEnrollmentRequired) {
        await _client.clearTokens();
        throw ApiException(
          'Hesabınız için iki aşamalı doğrulama kurulumu zorunlu. İlk kurulumu web uygulamasından tamamlayın.',
          statusCode: 403,
          code: 'MFA_ENROLLMENT_REQUIRED',
        );
      }
      await _client.saveTokens(response.accessToken, response.refreshToken);
      _currentUser = response.user;
      _isAuthenticated = true;
      socketService.connect(response.accessToken);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      debugPrint('Login failed: ${e.message}');
      rethrow;
    }
  }

  /// Açılışta çağrılır: saklanan token varsa /api/auth/me ile doğrular.
  Future<void> checkAuth() async {
    try {
      await _client.loadTokens();
      if (!_client.hasToken) {
        return;
      }
      final user = await _repository.me();
      if (!MobileAccessPolicy.forUser(user).isSupported) {
        await _client.clearTokens();
        return;
      }
      _currentUser = user;
      _isAuthenticated = true;
      final token = _client.accessToken;
      if (token != null) {
        socketService.connect(token);
      }
    } catch (_) {
      // Token geçersiz — sessizce login ekranına düş
      await _client.clearTokens();
      _currentUser = null;
      _isAuthenticated = false;
    } finally {
      _initialized = true;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _repository.logout(_client.refreshToken);
    } catch (_) {
      // Sunucuya ulaşılamıyorsa yoksay — lokal çıkış yeterli
    }
    await _client.clearTokens();
    socketService.disconnect();
    _currentUser = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
