/// Uygulama modelleri.
///
/// Backend PostgreSQL satırlarını snake_case döndürür; bazı uçlar camelCase
/// döner. Tüm fromJson fabrikaları iki biçimi de tolere eder (web'deki
/// data-mapper.ts ile aynı yaklaşım). toJson çıktıları backend'in beklediği
/// biçimdedir.
library models;

dynamic _pick(Map<String, dynamic> json, String snake, String camel) =>
    json.containsKey(snake) ? json[snake] : json[camel];

int _toInt(dynamic v, [int fallback = 0]) {
  if (v == null) return fallback;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? fallback;
}

int? _toIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

double _toDouble(dynamic v, [double fallback = 0]) {
  if (v == null) return fallback;
  if (v is double) return v;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? fallback;
}

String _toStr(dynamic v, [String fallback = '']) =>
    v == null ? fallback : v.toString();

String? _toStrOrNull(dynamic v) => v?.toString();

/// "2026-07-19T00:00:00.000Z" veya "2026-07-19" → "2026-07-19"
String _dateOnly(dynamic v) {
  final s = _toStr(v);
  return s.length >= 10 ? s.substring(0, 10) : s;
}

// ---------------------------------------------------------------------------
// Kullanıcı / oturum
// ---------------------------------------------------------------------------

class User {
  final int id;
  final String email;
  final List<String> roles;
  final bool emailVerified;
  final String firstName;
  final String lastName;

  User({
    required this.id,
    required this.email,
    required this.roles,
    this.emailVerified = false,
    this.firstName = '',
    this.lastName = '',
  });

  bool get isAdmin => roles.contains('admin');
  bool get isSecretary => roles.contains('secretary');
  bool get isDentist => roles.contains('dentist');

  String get displayName {
    final name = '$firstName $lastName'.trim();
    return name.isEmpty ? email : name;
  }

  factory User.fromJson(Map<String, dynamic> json) {
    final rawRoles = json['roles'];
    return User(
      id: _toInt(json['id']),
      email: _toStr(json['email']),
      roles: rawRoles is List
          ? rawRoles.map((r) => r.toString()).toList()
          : _toStr(rawRoles).split(',').where((r) => r.isNotEmpty).toList(),
      emailVerified:
          (_pick(json, 'email_verified', 'emailVerified') ?? false) == true,
      firstName: _toStr(_pick(json, 'first_name', 'firstName')),
      lastName: _toStr(_pick(json, 'last_name', 'lastName')),
    );
  }
}

class LoginResponse {
  final String accessToken;
  final String refreshToken;
  final User user;

  LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
        accessToken: _toStr(json['accessToken']),
        refreshToken: _toStr(json['refreshToken']),
        user: User.fromJson(json['user'] as Map<String, dynamic>),
      );
}

/// GET /api/users/dentists elemanı — seçiciler için.
class DentistSummary {
  final int id;
  final String email;
  final String firstName;
  final String lastName;

  DentistSummary({
    required this.id,
    required this.email,
    this.firstName = '',
    this.lastName = '',
  });

  String get displayName {
    final name = '$firstName $lastName'.trim();
    return name.isEmpty ? email : name;
  }

  factory DentistSummary.fromJson(Map<String, dynamic> json) => DentistSummary(
        id: _toInt(json['id']),
        email: _toStr(json['email']),
        firstName: _toStr(_pick(json, 'first_name', 'firstName')),
        lastName: _toStr(_pick(json, 'last_name', 'lastName')),
      );
}

// ---------------------------------------------------------------------------
// Hasta
// ---------------------------------------------------------------------------

class Patient {
  final int id;
  final String firstName;
  final String lastName;
  final String? dateOfBirth;
  final String? gender;
  final String? email;
  final String? phone;
  final String? address;
  final String? city;
  final String? notes;
  final String? allergies;
  final String? medicalConditions;

  Patient({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.dateOfBirth,
    this.gender,
    this.email,
    this.phone,
    this.address,
    this.city,
    this.notes,
    this.allergies,
    this.medicalConditions,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory Patient.fromJson(Map<String, dynamic> json) => Patient(
        id: _toInt(json['id']),
        firstName: _toStr(_pick(json, 'first_name', 'firstName')),
        lastName: _toStr(_pick(json, 'last_name', 'lastName')),
        dateOfBirth:
            _toStrOrNull(_pick(json, 'date_of_birth', 'dateOfBirth')),
        gender: _toStrOrNull(json['gender']),
        email: _toStrOrNull(json['email']),
        phone: _toStrOrNull(json['phone']),
        address: _toStrOrNull(json['address']),
        city: _toStrOrNull(json['city']),
        notes: _toStrOrNull(json['notes']),
        allergies: _toStrOrNull(json['allergies']),
        medicalConditions: _toStrOrNull(
            _pick(json, 'medical_conditions', 'medicalConditions')),
      );

  Map<String, dynamic> toJson() => {
        // createPatient camelCase bekler; updatePatient iki biçimi de kabul eder.
        'firstName': firstName,
        'lastName': lastName,
        if (dateOfBirth != null && dateOfBirth!.isNotEmpty)
          'dateOfBirth': dateOfBirth,
        if (gender != null && gender!.isNotEmpty) 'gender': gender,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
        if (address != null && address!.isNotEmpty) 'address': address,
        if (city != null && city!.isNotEmpty) 'city': city,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        if (allergies != null && allergies!.isNotEmpty)
          'allergies': allergies,
        if (medicalConditions != null && medicalConditions!.isNotEmpty)
          'medicalConditions': medicalConditions,
      };
}

// ---------------------------------------------------------------------------
// Randevu
// ---------------------------------------------------------------------------

class Appointment {
  final int id;
  final int patientId;
  final int? dentistId;
  final String appointmentDate; // YYYY-MM-DD
  final String startTime; // HH:mm:ss
  final String endTime; // HH:mm:ss
  final String? appointmentType;
  final String status;
  final String? notes;
  final String? cancellationReason;
  final String patientFirstName;
  final String patientLastName;
  final String? dentistEmail;

  Appointment({
    required this.id,
    required this.patientId,
    this.dentistId,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    this.appointmentType,
    this.status = 'scheduled',
    this.notes,
    this.cancellationReason,
    this.patientFirstName = '',
    this.patientLastName = '',
    this.dentistEmail,
  });

  String get patientFullName => '$patientFirstName $patientLastName'.trim();

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: _toInt(json['id']),
        patientId: _toInt(_pick(json, 'patient_id', 'patientId')),
        dentistId: _toIntOrNull(_pick(json, 'dentist_id', 'dentistId')),
        appointmentDate:
            _dateOnly(_pick(json, 'appointment_date', 'appointmentDate')),
        startTime: _toStr(_pick(json, 'start_time', 'startTime')),
        endTime: _toStr(_pick(json, 'end_time', 'endTime')),
        appointmentType:
            _toStrOrNull(_pick(json, 'appointment_type', 'appointmentType')),
        status: _toStr(json['status'], 'scheduled'),
        notes: _toStrOrNull(json['notes']),
        cancellationReason: _toStrOrNull(
            _pick(json, 'cancellation_reason', 'cancellationReason')),
        patientFirstName:
            _toStr(_pick(json, 'patient_first_name', 'patientFirstName')),
        patientLastName:
            _toStr(_pick(json, 'patient_last_name', 'patientLastName')),
        dentistEmail:
            _toStrOrNull(_pick(json, 'dentist_email', 'dentistEmail')),
      );

  /// createAppointment camelCase body bekler (appointmentController.js).
  Map<String, dynamic> toCreateJson() => {
        'patientId': patientId,
        if (dentistId != null) 'dentistId': dentistId,
        'appointmentDate': appointmentDate,
        'startTime': startTime,
        'endTime': endTime,
        if (appointmentType != null) 'appointmentType': appointmentType,
        'status': status,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

// ---------------------------------------------------------------------------
// Tedavi
// ---------------------------------------------------------------------------

class Treatment {
  final int id;
  final int patientId;
  final int? appointmentId;
  final int? dentistId;
  final String treatmentDate;
  final String? treatmentType;
  final String? toothNumber;
  final String? description;
  final String? diagnosis;
  final double? cost;
  final String currency;
  final String status;
  final String patientFirstName;
  final String patientLastName;

  Treatment({
    required this.id,
    required this.patientId,
    this.appointmentId,
    this.dentistId,
    required this.treatmentDate,
    this.treatmentType,
    this.toothNumber,
    this.description,
    this.diagnosis,
    this.cost,
    this.currency = 'TRY',
    this.status = 'planned',
    this.patientFirstName = '',
    this.patientLastName = '',
  });

  String get patientFullName => '$patientFirstName $patientLastName'.trim();

  factory Treatment.fromJson(Map<String, dynamic> json) => Treatment(
        id: _toInt(json['id']),
        patientId: _toInt(_pick(json, 'patient_id', 'patientId')),
        appointmentId:
            _toIntOrNull(_pick(json, 'appointment_id', 'appointmentId')),
        dentistId: _toIntOrNull(_pick(json, 'dentist_id', 'dentistId')),
        treatmentDate:
            _dateOnly(_pick(json, 'treatment_date', 'treatmentDate')),
        treatmentType:
            _toStrOrNull(_pick(json, 'treatment_type', 'treatmentType')),
        toothNumber: _toStrOrNull(_pick(json, 'tooth_number', 'toothNumber')),
        description: _toStrOrNull(json['description']),
        diagnosis: _toStrOrNull(json['diagnosis']),
        cost: json['cost'] == null ? null : _toDouble(json['cost']),
        currency: _toStr(json['currency'], 'TRY'),
        status: _toStr(json['status'], 'planned'),
        patientFirstName:
            _toStr(_pick(json, 'patient_first_name', 'patientFirstName')),
        patientLastName:
            _toStr(_pick(json, 'patient_last_name', 'patientLastName')),
      );

  Map<String, dynamic> toCreateJson() => {
        'patientId': patientId,
        if (appointmentId != null) 'appointmentId': appointmentId,
        if (dentistId != null) 'dentistId': dentistId,
        'treatmentDate': treatmentDate,
        if (treatmentType != null) 'treatmentType': treatmentType,
        if (toothNumber != null) 'toothNumber': toothNumber,
        if (description != null) 'description': description,
        if (diagnosis != null) 'diagnosis': diagnosis,
        if (cost != null) 'cost': cost,
        'currency': currency,
        'status': status,
      };
}

// ---------------------------------------------------------------------------
// Tedavi planı / ödemeler
// ---------------------------------------------------------------------------

class PlanItem {
  final int id;
  final String? treatmentType;
  final String? toothNumber;
  final double cost;

  PlanItem({
    required this.id,
    this.treatmentType,
    this.toothNumber,
    this.cost = 0,
  });

  factory PlanItem.fromJson(Map<String, dynamic> json) => PlanItem(
        id: _toInt(json['id']),
        treatmentType:
            _toStrOrNull(_pick(json, 'treatment_type', 'treatmentType')),
        toothNumber: _toStrOrNull(_pick(json, 'tooth_number', 'toothNumber')),
        cost: _toDouble(json['cost']),
      );
}

class PendingPlan {
  final int id;
  final int patientId;
  final String patientName;
  final String? dentistEmail;
  final String? title;
  final String status;
  final double totalEstimatedCost;
  final List<PlanItem> items;

  PendingPlan({
    required this.id,
    required this.patientId,
    this.patientName = '',
    this.dentistEmail,
    this.title,
    this.status = 'pending',
    this.totalEstimatedCost = 0,
    this.items = const [],
  });

  double get total => items.isNotEmpty
      ? items.fold(0.0, (sum, i) => sum + i.cost)
      : totalEstimatedCost;

  factory PendingPlan.fromJson(Map<String, dynamic> json) => PendingPlan(
        id: _toInt(json['id']),
        patientId: _toInt(_pick(json, 'patient_id', 'patientId')),
        patientName: _toStr(_pick(json, 'patient_name', 'patientName')),
        dentistEmail:
            _toStrOrNull(_pick(json, 'dentist_email', 'dentistEmail')),
        title: _toStrOrNull(json['title']),
        status: _toStr(json['status'], 'pending'),
        totalEstimatedCost: _toDouble(
            _pick(json, 'total_estimated_cost', 'totalEstimatedCost')),
        items: (json['items'] as List? ?? [])
            .map((i) => PlanItem.fromJson(i as Map<String, dynamic>))
            .toList(),
      );
}

class PatientDebt {
  final int patientId;
  final double totalDebt;
  final double paidAmount;
  final double remainingDebt;

  PatientDebt({
    required this.patientId,
    this.totalDebt = 0,
    this.paidAmount = 0,
    this.remainingDebt = 0,
  });

  factory PatientDebt.fromJson(Map<String, dynamic> json) => PatientDebt(
        patientId: _toInt(_pick(json, 'patient_id', 'patientId')),
        totalDebt: _toDouble(_pick(json, 'total_debt', 'totalDebt')),
        paidAmount: _toDouble(_pick(json, 'paid_amount', 'paidAmount')),
        remainingDebt:
            _toDouble(_pick(json, 'remaining_debt', 'remainingDebt')),
      );
}

class PaymentRecord {
  final int id;
  final double amount;
  final String paymentMethod;
  final String createdAt;
  final String? notes;

  PaymentRecord({
    required this.id,
    required this.amount,
    required this.paymentMethod,
    required this.createdAt,
    this.notes,
  });

  String get methodLabel => paymentMethod == 'cash' ? 'Nakit' : 'Kart';

  factory PaymentRecord.fromJson(Map<String, dynamic> json) => PaymentRecord(
        id: _toInt(json['id']),
        amount: _toDouble(json['amount']),
        paymentMethod:
            _toStr(_pick(json, 'payment_method', 'paymentMethod')),
        createdAt: _toStr(_pick(json, 'created_at', 'createdAt')),
        notes: _toStrOrNull(json['notes']),
      );
}

// ---------------------------------------------------------------------------
// Hekim kazançları
// ---------------------------------------------------------------------------

class EarningsSummary {
  final double totalTurnover;
  final double paidTurnoverShare;
  final double totalEarnings;
  final double salary;
  final double commissionRate;
  final int treatmentCount;

  EarningsSummary({
    this.totalTurnover = 0,
    this.paidTurnoverShare = 0,
    this.totalEarnings = 0,
    this.salary = 0,
    this.commissionRate = 0,
    this.treatmentCount = 0,
  });

  factory EarningsSummary.fromJson(Map<String, dynamic> json) =>
      EarningsSummary(
        totalTurnover: _toDouble(json['totalTurnover']),
        paidTurnoverShare: _toDouble(json['paidTurnoverShare']),
        totalEarnings: _toDouble(json['totalEarnings']),
        salary: _toDouble(json['salary']),
        commissionRate: _toDouble(json['commissionRate']),
        treatmentCount: _toInt(json['treatmentCount']),
      );
}

class EarningsTreatment {
  final int id;
  final String treatmentDate;
  final String treatmentType;
  final double cost;
  final String currency;
  final String patientFirstName;
  final String patientLastName;
  final double earnings;

  EarningsTreatment({
    required this.id,
    required this.treatmentDate,
    this.treatmentType = '',
    this.cost = 0,
    this.currency = 'TRY',
    this.patientFirstName = '',
    this.patientLastName = '',
    this.earnings = 0,
  });

  String get patientFullName => '$patientFirstName $patientLastName'.trim();

  factory EarningsTreatment.fromJson(Map<String, dynamic> json) =>
      EarningsTreatment(
        id: _toInt(json['id']),
        treatmentDate:
            _dateOnly(_pick(json, 'treatment_date', 'treatmentDate')),
        treatmentType: _toStr(_pick(json, 'treatment_type', 'treatmentType')),
        cost: _toDouble(json['cost']),
        currency: _toStr(json['currency'], 'TRY'),
        patientFirstName:
            _toStr(_pick(json, 'patient_first_name', 'patientFirstName')),
        patientLastName:
            _toStr(_pick(json, 'patient_last_name', 'patientLastName')),
        earnings: _toDouble(json['earnings']),
      );
}

// ---------------------------------------------------------------------------
// Kurum anlaşmaları
// ---------------------------------------------------------------------------

class InstitutionAgreement {
  final int id;
  final String institutionName;
  final String? contactPerson;
  final String? contactPhone;
  final String? contactEmail;
  final double discountPercentage;
  final String? notes;

  InstitutionAgreement({
    required this.id,
    required this.institutionName,
    this.contactPerson,
    this.contactPhone,
    this.contactEmail,
    this.discountPercentage = 0,
    this.notes,
  });

  factory InstitutionAgreement.fromJson(Map<String, dynamic> json) =>
      InstitutionAgreement(
        id: _toInt(json['id']),
        institutionName:
            _toStr(_pick(json, 'institution_name', 'institutionName')),
        contactPerson:
            _toStrOrNull(_pick(json, 'contact_person', 'contactPerson')),
        contactPhone:
            _toStrOrNull(_pick(json, 'contact_phone', 'contactPhone')),
        contactEmail:
            _toStrOrNull(_pick(json, 'contact_email', 'contactEmail')),
        discountPercentage: _toDouble(
            _pick(json, 'discount_percentage', 'discountPercentage')),
        notes: _toStrOrNull(json['notes']),
      );
}

// ---------------------------------------------------------------------------
// Bildirimler
// ---------------------------------------------------------------------------

class AppNotification {
  final int id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    this.isRead = false,
    this.createdAt = '',
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: _toInt(json['id']),
        type: _toStr(json['type']),
        title: _toStr(json['title']),
        message: _toStr(json['message']),
        isRead: (_pick(json, 'is_read', 'isRead') ?? false) == true,
        createdAt: _toStr(_pick(json, 'created_at', 'createdAt')),
      );
}

// ---------------------------------------------------------------------------
// Admin istatistikleri
// ---------------------------------------------------------------------------

class AdminStatistics {
  final int totalPatients;
  final double lastMonthFinancial;
  final double thisMonthFinancial;
  final int lastMonthPatients;
  final int thisMonthPatients;
  final int upcomingAppointmentsCount;

  AdminStatistics({
    this.totalPatients = 0,
    this.lastMonthFinancial = 0,
    this.thisMonthFinancial = 0,
    this.lastMonthPatients = 0,
    this.thisMonthPatients = 0,
    this.upcomingAppointmentsCount = 0,
  });

  factory AdminStatistics.fromJson(Map<String, dynamic> json) =>
      AdminStatistics(
        totalPatients: _toInt(json['totalPatients']),
        lastMonthFinancial: _toDouble(json['lastMonthFinancial']),
        thisMonthFinancial: _toDouble(json['thisMonthFinancial']),
        lastMonthPatients: _toInt(json['lastMonthPatients']),
        thisMonthPatients: _toInt(json['thisMonthPatients']),
        upcomingAppointmentsCount: _toInt(json['upcomingAppointmentsCount']),
      );
}

// ---------------------------------------------------------------------------
// TDB tarifesi (assets/data/tdb_2026_tarife_full.json)
// ---------------------------------------------------------------------------

class TariffItem {
  final String code;
  final String name;
  final double priceInclVat;
  final String currency;

  TariffItem({
    required this.code,
    required this.name,
    required this.priceInclVat,
    this.currency = 'TRY',
  });

  factory TariffItem.fromJson(Map<String, dynamic> json) => TariffItem(
        code: _toStr(json['code']),
        name: _toStr(json['name']),
        priceInclVat: _toDouble(json['price_incl_vat']),
        currency: _toStr(json['currency'], 'TRY'),
      );
}

class TariffCategory {
  final String name;
  final List<TariffItem> items;

  TariffCategory({required this.name, this.items = const []});

  factory TariffCategory.fromJson(Map<String, dynamic> json) => TariffCategory(
        name: _toStr(json['name']),
        items: (json['items'] as List? ?? [])
            .map((i) => TariffItem.fromJson(i as Map<String, dynamic>))
            .toList(),
      );
}
