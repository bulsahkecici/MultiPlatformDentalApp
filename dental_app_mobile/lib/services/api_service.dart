import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException([this.message = 'Unauthorized']);
  @override
  String toString() => message;
}

class ApiService {
  final String baseUrl;
  String? _accessToken;
  String? _refreshToken;
  bool _isRefreshing = false;

  ApiService({required this.baseUrl});

  String? get refreshToken => _refreshToken;

  Future<void> loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('accessToken');
    _refreshToken = prefs.getString('refreshToken');
  }

  Future<void> saveTokens(String accessToken, String refreshToken) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', accessToken);
    await prefs.setString('refreshToken', refreshToken);
  }

  Future<void> saveToken(String token) async {
    _accessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', token);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
  }

  Map<String, String> _headers({bool includeAuth = true}) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (includeAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  dynamic _decodeBody(String body) {
    if (body.isEmpty) return {};
    return json.decode(body);
  }

  Future<bool> _tryRefreshToken() async {
    if (_refreshToken == null || _isRefreshing) return false;
    _isRefreshing = true;
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/auth/refresh'),
        headers: _headers(includeAuth: false),
        body: json.encode({'refreshToken': _refreshToken}),
      );
      if (response.statusCode == 200) {
        final data = _decodeBody(response.body) as Map<String, dynamic>;
        await saveTokens(
          data['accessToken'] as String,
          data['refreshToken'] as String,
        );
        return true;
      }
      await clearTokens();
      return false;
    } catch (_) {
      await clearTokens();
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  Future<dynamic> _request(
    Future<http.Response> Function(Map<String, String> headers) send, {
    bool retryOnUnauthorized = true,
  }) async {
    var response = await send(_headers());

    if (response.statusCode == 401 && retryOnUnauthorized) {
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        response = await send(_headers());
      } else {
        throw UnauthorizedException();
      }
    }

    if (response.statusCode == 401) {
      await clearTokens();
      throw UnauthorizedException();
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return _decodeBody(response.body);
    }

    throw Exception(
      'API error ${response.statusCode}: ${response.body.isNotEmpty ? response.body : "no body"}',
    );
  }

  Future<dynamic> get(
    String endpoint, {
    Map<String, String>? params,
  }) async {
    var uri = Uri.parse('$baseUrl$endpoint');
    if (params != null && params.isNotEmpty) {
      uri = uri.replace(queryParameters: params);
    }
    return _request((headers) => http.get(uri, headers: headers));
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> data) async {
    return _request(
      (headers) => http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
        body: json.encode(data),
      ),
    );
  }

  Future<dynamic> put(String endpoint, Map<String, dynamic> data) async {
    return _request(
      (headers) => http.put(
        Uri.parse('$baseUrl$endpoint'),
        headers: headers,
        body: json.encode(data),
      ),
    );
  }

  Future<void> delete(String endpoint) async {
    await _request(
      (headers) => http.delete(Uri.parse('$baseUrl$endpoint'), headers: headers),
    );
  }
}
