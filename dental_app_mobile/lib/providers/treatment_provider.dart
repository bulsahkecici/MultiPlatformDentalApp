import 'package:flutter/foundation.dart';

import '../services/api_service.dart';

class TreatmentProvider with ChangeNotifier {
  final ApiService _apiService;

  bool _isLoading = false;
  String? _error;

  TreatmentProvider(this._apiService);

  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<bool> createTreatment(Map<String, dynamic> body) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.post('/api/treatments', body);
      return true;
    } catch (e) {
      _error = e.toString();
      debugPrint('createTreatment error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
