import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService;
  User? _currentUser;
  bool _isAuthenticated = false;

  AuthProvider(this._apiService);

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;

  Future<bool> login(String email, String password) async {
    try {
      final response = await _apiService.post('/api/auth/login', {
        'email': email,
        'password': password,
      });

      final loginResponse = LoginResponse.fromJson(response);
      _currentUser = loginResponse.user;
      _isAuthenticated = true;

      await _apiService.saveToken(loginResponse.accessToken);
      
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Login error: $e');
      return false;
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    _isAuthenticated = false;
    await _apiService.clearToken();
    notifyListeners();
  }

  Future<void> checkAuth() async {
    await _apiService.loadToken();
    // TODO: Verify token with backend
    notifyListeners();
  }
}
