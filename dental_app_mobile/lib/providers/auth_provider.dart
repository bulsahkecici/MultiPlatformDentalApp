import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService;
  User? _currentUser;
  bool _isAuthenticated = false;
  bool _isLoading = true;

  AuthProvider(this._apiService);

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;

  bool get isAdmin => _currentUser?.roles.contains('admin') ?? false;
  bool get isDentist => _currentUser?.roles.contains('dentist') ?? false;
  bool get isSecretary => _currentUser?.roles.contains('secretary') ?? false;

  String get roleLabel {
    if (isAdmin) return 'Admin';
    if (isSecretary) return 'Sekreter';
    if (isDentist) return 'Diş Hekimi';
    return 'Kullanıcı';
  }

  Future<bool> login(String email, String password) async {
    try {
      final response = await _apiService.post('/api/auth/login', {
        'email': email,
        'password': password,
      });

      final loginResponse = LoginResponse.fromJson(
        Map<String, dynamic>.from(response as Map),
      );
      _currentUser = loginResponse.user;
      _isAuthenticated = true;

      await _apiService.saveTokens(
        loginResponse.accessToken,
        loginResponse.refreshToken,
      );

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Login error: $e');
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.loadTokens();
      final refreshToken = _apiService.refreshToken;
      if (refreshToken != null) {
        await _apiService.post('/api/auth/logout', {
          'refreshToken': refreshToken,
        });
      }
    } catch (e) {
      debugPrint('Logout error: $e');
    } finally {
      _currentUser = null;
      _isAuthenticated = false;
      await _apiService.clearTokens();
      notifyListeners();
    }
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _apiService.loadTokens();
      final response = await _apiService.get('/api/auth/me');
      final userJson = (response as Map<String, dynamic>)['user'];
      _currentUser = User.fromJson(Map<String, dynamic>.from(userJson));
      _isAuthenticated = true;
    } on UnauthorizedException {
      _currentUser = null;
      _isAuthenticated = false;
      await _apiService.clearTokens();
    } catch (e) {
      debugPrint('checkAuth error: $e');
      _currentUser = null;
      _isAuthenticated = false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void handleUnauthorized() {
    _currentUser = null;
    _isAuthenticated = false;
    _apiService.clearTokens();
    notifyListeners();
  }
}
