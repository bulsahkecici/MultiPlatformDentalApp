import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class PatientProvider with ChangeNotifier {
  final ApiService _apiService;

  List<Patient> _patients = [];
  bool _isLoading = false;
  String? _error;
  String _search = '';

  PatientProvider(this._apiService);

  List<Patient> get patients => _patients;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get search => _search;

  Future<void> fetchPatients({String? search}) async {
    _isLoading = true;
    _error = null;
    if (search != null) _search = search;
    notifyListeners();

    try {
      final response = await _apiService.get('/api/patients', params: {
        'page': '1',
        'limit': '${ApiConstants.defaultPageSize}',
        if (_search.isNotEmpty) 'search': _search,
      });
      final list = (response as Map<String, dynamic>)['patients'] as List? ?? [];
      _patients = list
          .map((e) => Patient.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _error = e.toString();
      _patients = [];
      debugPrint('fetchPatients error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Patient?> createPatient(Map<String, dynamic> data) async {
    try {
      final response = await _apiService.post('/api/patients', data);
      final patient = Patient.fromJson(
        Map<String, dynamic>.from((response as Map)['patient']),
      );
      _patients = [patient, ..._patients];
      notifyListeners();
      return patient;
    } catch (e) {
      debugPrint('createPatient error: $e');
      rethrow;
    }
  }

  Future<Patient?> updatePatient(int id, Map<String, dynamic> data) async {
    try {
      final response = await _apiService.put('/api/patients/$id', data);
      final patient = Patient.fromJson(
        Map<String, dynamic>.from((response as Map)['patient']),
      );
      final index = _patients.indexWhere((p) => p.id == id);
      if (index >= 0) {
        _patients[index] = patient;
        notifyListeners();
      }
      return patient;
    } catch (e) {
      debugPrint('updatePatient error: $e');
      rethrow;
    }
  }

  Future<bool> deletePatient(int id) async {
    try {
      await _apiService.delete('/api/patients/$id');
      _patients = _patients.where((p) => p.id != id).toList();
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('deletePatient error: $e');
      return false;
    }
  }
}
