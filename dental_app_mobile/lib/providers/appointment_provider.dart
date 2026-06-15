import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class AppointmentProvider with ChangeNotifier {
  final ApiService _apiService;

  List<Appointment> _appointments = [];
  bool _isLoading = false;
  String? _error;

  AppointmentProvider(this._apiService);

  List<Appointment> get appointments => _appointments;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchAppointments({
    String? startDate,
    String? endDate,
    int? patientId,
    String? status,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final params = <String, String>{
        'page': '1',
        'limit': '${ApiConstants.defaultPageSize}',
      };
      if (startDate != null) params['startDate'] = startDate;
      if (endDate != null) params['endDate'] = endDate;
      if (patientId != null) params['patientId'] = '$patientId';
      if (status != null) params['status'] = status;

      final response = await _apiService.get('/api/appointments', params: params);
      final list =
          (response as Map<String, dynamic>)['appointments'] as List? ?? [];
      _appointments = list
          .map((e) => Appointment.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      _error = e.toString();
      _appointments = [];
      debugPrint('fetchAppointments error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createAppointment(Map<String, dynamic> body) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.post('/api/appointments', body);
      return true;
    } catch (e) {
      _error = e.toString();
      debugPrint('createAppointment error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
