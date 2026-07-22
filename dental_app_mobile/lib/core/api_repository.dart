import 'api_client.dart';
import '../models/models.dart';

/// Tüm backend uçlarını tipli metodlarla saran depo.
/// Uç listesi src/routes/*.js ile birebir eşleşir.
class ApiRepository {
  final ApiClient client;

  ApiRepository(this.client);

  // ---- Auth ----

  Future<LoginResponse> login(String email, String password,
      {String? mfaCode}) async {
    final data = await client.post('/api/auth/login',
        data: {
          'email': email,
          'password': password,
          if (mfaCode != null && mfaCode.isNotEmpty) 'mfaCode': mfaCode,
        },
        allowTokenRefresh: false);
    return LoginResponse.fromJson(data as Map<String, dynamic>);
  }

  Future<User> me() async {
    final data = await client.get('/api/auth/me');
    return User.fromJson(
        (data as Map<String, dynamic>)['user'] as Map<String, dynamic>);
  }

  Future<void> logout(String? refreshToken) async {
    await client.post('/api/auth/logout',
        data: refreshToken != null ? {'refreshToken': refreshToken} : {});
  }

  // ---- Hastalar ----

  Future<List<Patient>> getPatients(
      {int page = 1, int limit = 20, String? search}) async {
    final data = await client.get('/api/patients', query: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    final map = data as Map<String, dynamic>;
    final list = (map['patients'] ?? map['data'] ?? []) as List;
    return list
        .map((p) => Patient.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<Patient> getPatient(int id) async {
    final data = await client.get('/api/patients/$id');
    return Patient.fromJson(
        (data as Map<String, dynamic>)['patient'] as Map<String, dynamic>);
  }

  Future<Patient> createPatient(Patient patient) async {
    final data = await client.post('/api/patients', data: patient.toJson());
    return Patient.fromJson(
        (data as Map<String, dynamic>)['patient'] as Map<String, dynamic>);
  }

  Future<Patient> updatePatient(int id, Patient patient) async {
    final data = await client.put('/api/patients/$id', data: patient.toJson());
    return Patient.fromJson(
        (data as Map<String, dynamic>)['patient'] as Map<String, dynamic>);
  }

  Future<void> deletePatient(int id) => client.delete('/api/patients/$id');

  // ---- Randevular ----

  Future<List<Appointment>> getAppointments({
    int page = 1,
    int limit = 100,
    String? startDate,
    String? endDate,
    int? patientId,
  }) async {
    final data = await client.get('/api/appointments', query: {
      'page': page,
      'limit': limit,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (patientId != null) 'patientId': patientId,
    });
    final map = data as Map<String, dynamic>;
    final list = (map['appointments'] ?? map['data'] ?? []) as List;
    return list
        .map((a) => Appointment.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  Future<Appointment> createAppointment(Appointment appointment) async {
    final data =
        await client.post('/api/appointments', data: appointment.toCreateJson());
    return Appointment.fromJson(
        (data as Map<String, dynamic>)['appointment'] as Map<String, dynamic>);
  }

  Future<Appointment> updateAppointment(
      int id, Map<String, dynamic> updates) async {
    final data = await client.put('/api/appointments/$id', data: updates);
    return Appointment.fromJson(
        (data as Map<String, dynamic>)['appointment'] as Map<String, dynamic>);
  }

  Future<void> cancelAppointment(int id, {String? reason}) async {
    await client.put('/api/appointments/$id/cancel',
        data: {'cancellationReason': reason});
  }

  // ---- Dişhekimleri ----

  Future<List<DentistSummary>> getDentists() async {
    final data = await client.get('/api/users/dentists');
    final list = ((data as Map<String, dynamic>)['dentists'] ?? []) as List;
    return list
        .map((d) => DentistSummary.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  // ---- Tedaviler ----

  Future<List<Treatment>> getTreatments({
    int page = 1,
    int limit = 50,
    int? patientId,
    String? status,
  }) async {
    final data = await client.get('/api/treatments', query: {
      'page': page,
      'limit': limit,
      if (patientId != null) 'patientId': patientId,
      if (status != null) 'status': status,
    });
    final map = data as Map<String, dynamic>;
    final list = (map['treatments'] ?? map['data'] ?? []) as List;
    return list
        .map((t) => Treatment.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  Future<Treatment> createTreatment(Treatment treatment) async {
    final data =
        await client.post('/api/treatments', data: treatment.toCreateJson());
    return Treatment.fromJson(
        (data as Map<String, dynamic>)['treatment'] as Map<String, dynamic>);
  }

  Future<Treatment> updateTreatment(
      int id, Map<String, dynamic> updates) async {
    final data = await client.put('/api/treatments/$id', data: updates);
    return Treatment.fromJson(
        (data as Map<String, dynamic>)['treatment'] as Map<String, dynamic>);
  }

  // ---- Ödemeler ----

  Future<List<PendingPlan>> getPendingPlans() async {
    final data = await client.get('/api/payments/pending-plans');
    final list = ((data as Map<String, dynamic>)['plans'] ?? []) as List;
    return list
        .map((p) => PendingPlan.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<void> approvePlan(int planId, bool approved) async {
    await client
        .post('/api/payments/approve-plan/$planId', data: {'approved': approved});
  }

  Future<PatientDebt> getPatientDebt(int patientId) async {
    final data = await client.get('/api/payments/patient-debt/$patientId');
    return PatientDebt.fromJson(
        (data as Map<String, dynamic>)['debt'] as Map<String, dynamic>);
  }

  Future<void> processPayment({
    required int patientId,
    required double amount,
    required String paymentMethod,
    int? treatmentPlanId,
    String? notes,
  }) async {
    await client.post('/api/payments/process', data: {
      'patientId': patientId,
      'amount': amount,
      'paymentMethod': paymentMethod,
      if (treatmentPlanId != null) 'treatmentPlanId': treatmentPlanId,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<double> getTotalReceivables() async {
    final data = await client.get('/api/payments/total-receivables');
    return ((data as Map<String, dynamic>)['totalReceivables'] as num?)
            ?.toDouble() ??
        0;
  }

  Future<double> getTotalIncome() async {
    final data = await client.get('/api/payments/total-income');
    return ((data as Map<String, dynamic>)['totalIncome'] as num?)
            ?.toDouble() ??
        0;
  }

  Future<List<PaymentRecord>> getPatientPayments(int patientId) async {
    final data = await client.get('/api/payments/patient-payments/$patientId');
    final list = ((data as Map<String, dynamic>)['payments'] ?? []) as List;
    return list
        .map((p) => PaymentRecord.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // ---- Hekim kazançları ----

  Future<(EarningsSummary, List<EarningsTreatment>)> getEarnings() async {
    final data = await client.get('/api/dentist/earnings');
    final map = data as Map<String, dynamic>;
    final summary = EarningsSummary.fromJson(
        (map['earnings'] ?? {}) as Map<String, dynamic>);
    final treatments = ((map['treatments'] ?? []) as List)
        .map((t) => EarningsTreatment.fromJson(t as Map<String, dynamic>))
        .toList();
    return (summary, treatments);
  }

  // ---- Kurum anlaşmaları ----

  Future<List<InstitutionAgreement>> getAgreements() async {
    final data = await client.get('/api/institution-agreements');
    final map = data as Map<String, dynamic>;
    final list = (map['agreements'] ?? map['data'] ?? []) as List;
    return list
        .map((a) => InstitutionAgreement.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  // ---- Bildirimler ----

  Future<List<AppNotification>> getNotifications(
      {int limit = 50, int offset = 0}) async {
    final data = await client
        .get('/api/notifications', query: {'limit': limit, 'offset': offset});
    final list = ((data as Map<String, dynamic>)['notifications'] ?? []) as List;
    return list
        .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
        .toList();
  }

  Future<int> getUnreadCount() async {
    final data = await client.get('/api/notifications/unread-count');
    return ((data as Map<String, dynamic>)['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> markNotificationRead(int id) =>
      client.put('/api/notifications/$id/read', data: {});

  Future<void> markAllNotificationsRead() =>
      client.put('/api/notifications/read-all', data: {});

  // ---- Admin ----

  Future<AdminStatistics> getAdminStatistics() async {
    final data = await client.get('/api/admin/statistics');
    return AdminStatistics.fromJson(
        (data as Map<String, dynamic>)['statistics'] as Map<String, dynamic>);
  }

  Future<List<User>> getUsers({int limit = 100}) async {
    final data = await client.get('/api/users', query: {'limit': limit});
    final list = ((data as Map<String, dynamic>)['users'] ?? []) as List;
    return list.map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
  }

  Future<void> createUser(Map<String, dynamic> payload) async {
    await client.post('/api/users', data: payload);
  }
}
