class User {
  final int id;
  final String email;
  final List<String> roles;
  final bool emailVerified;
  final String? firstName;
  final String? lastName;
  final DateTime? lastLoginAt;

  User({
    required this.id,
    required this.email,
    required this.roles,
    required this.emailVerified,
    this.firstName,
    this.lastName,
    this.lastLoginAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      roles: List<String>.from(json['roles'] ?? []),
      emailVerified: json['emailVerified'] ?? json['email_verified'] ?? false,
      firstName: json['firstName'] ?? json['first_name'],
      lastName: json['lastName'] ?? json['last_name'],
      lastLoginAt: json['lastLoginAt'] != null || json['last_login_at'] != null
          ? DateTime.tryParse(json['lastLoginAt'] ?? json['last_login_at'])
          : null,
    );
  }

  String get displayName {
    if (firstName != null || lastName != null) {
      return '${firstName ?? ''} ${lastName ?? ''}'.trim();
    }
    return email;
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

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'],
      refreshToken: json['refreshToken'],
      user: User.fromJson(Map<String, dynamic>.from(json['user'])),
    );
  }
}

class Patient {
  final int id;
  final String firstName;
  final String lastName;
  final DateTime? dateOfBirth;
  final String? gender;
  final String? email;
  final String? phone;
  final String? address;
  final String? city;
  final DateTime? createdAt;

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
    this.createdAt,
  });

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'],
      firstName: json['first_name'] ?? json['firstName'] ?? '',
      lastName: json['last_name'] ?? json['lastName'] ?? '',
      dateOfBirth: _parseDate(json['date_of_birth'] ?? json['dateOfBirth']),
      gender: json['gender'],
      email: json['email'],
      phone: json['phone'],
      address: json['address'],
      city: json['city'],
      createdAt: _parseDate(json['created_at'] ?? json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'firstName': firstName,
      'lastName': lastName,
      if (dateOfBirth != null)
        'dateOfBirth': dateOfBirth!.toIso8601String().split('T').first,
      if (gender != null) 'gender': gender,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      if (address != null) 'address': address,
      if (city != null) 'city': city,
    };
  }

  String get fullName => '$firstName $lastName'.trim();
}

class Appointment {
  final int id;
  final int patientId;
  final int? dentistId;
  final DateTime appointmentDate;
  final String startTime;
  final String endTime;
  final String? appointmentType;
  final String status;
  final String? notes;
  final String? patientFirstName;
  final String? patientLastName;
  final String? dentistEmail;

  Appointment({
    required this.id,
    required this.patientId,
    this.dentistId,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    this.appointmentType,
    required this.status,
    this.notes,
    this.patientFirstName,
    this.patientLastName,
    this.dentistEmail,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'],
      patientId: json['patient_id'] ?? json['patientId'],
      dentistId: json['dentist_id'] ?? json['dentistId'],
      appointmentDate: DateTime.parse(
        json['appointment_date'] ?? json['appointmentDate'],
      ),
      startTime: json['start_time'] ?? json['startTime'] ?? '',
      endTime: json['end_time'] ?? json['endTime'] ?? '',
      appointmentType: json['appointment_type'] ?? json['appointmentType'],
      status: json['status'] ?? 'scheduled',
      notes: json['notes'],
      patientFirstName: json['patient_first_name'] ?? json['patientFirstName'],
      patientLastName: json['patient_last_name'] ?? json['patientLastName'],
      dentistEmail: json['dentist_email'] ?? json['dentistEmail'],
    );
  }

  String? get patientFullName {
    if (patientFirstName != null && patientLastName != null) {
      return '$patientFirstName $patientLastName';
    }
    return null;
  }
}

class Treatment {
  final int id;
  final int patientId;
  final DateTime treatmentDate;
  final String treatmentType;
  final String? toothNumber;
  final double? cost;
  final String currency;
  final String status;
  final String? patientFirstName;
  final String? patientLastName;
  final String? dentistEmail;
  final double? earnings;

  Treatment({
    required this.id,
    required this.patientId,
    required this.treatmentDate,
    required this.treatmentType,
    this.toothNumber,
    this.cost,
    required this.currency,
    required this.status,
    this.patientFirstName,
    this.patientLastName,
    this.dentistEmail,
    this.earnings,
  });

  factory Treatment.fromJson(Map<String, dynamic> json) {
    return Treatment(
      id: json['id'],
      patientId: json['patient_id'] ?? json['patientId'],
      treatmentDate: DateTime.parse(
        json['treatment_date'] ?? json['treatmentDate'],
      ),
      treatmentType: json['treatment_type'] ?? json['treatmentType'] ?? '',
      toothNumber: json['tooth_number']?.toString() ?? json['toothNumber']?.toString(),
      cost: _toDouble(json['cost']),
      currency: json['currency'] ?? 'TRY',
      status: json['status'] ?? 'completed',
      patientFirstName: json['patient_first_name'] ?? json['patientFirstName'],
      patientLastName: json['patient_last_name'] ?? json['patientLastName'],
      dentistEmail: json['dentist_email'] ?? json['dentistEmail'],
      earnings: _toDouble(json['earnings']),
    );
  }

  String? get patientFullName {
    if (patientFirstName != null && patientLastName != null) {
      return '$patientFirstName $patientLastName';
    }
    if (patientFirstName != null) return patientFirstName;
    if (patientLastName != null) return patientLastName;
    return null;
  }
}

class DashboardStats {
  final int totalPatients;
  final double lastMonthFinancial;
  final int lastMonthPatients;
  final int lastMonthTransactions;
  final int thisMonthPatients;
  final double thisMonthFinancial;
  final int upcomingAppointmentsCount;

  DashboardStats({
    required this.totalPatients,
    required this.lastMonthFinancial,
    required this.lastMonthPatients,
    required this.lastMonthTransactions,
    required this.thisMonthPatients,
    required this.thisMonthFinancial,
    required this.upcomingAppointmentsCount,
  });

  factory DashboardStats.fromAdminResponse(Map<String, dynamic> response) {
    final stats = Map<String, dynamic>.from(response['statistics'] ?? {});
    return DashboardStats(
      totalPatients: stats['totalPatients'] ?? stats['patients']?['total'] ?? 0,
      lastMonthFinancial: _toDouble(stats['lastMonthFinancial']) ?? 0,
      lastMonthPatients: stats['lastMonthPatients'] ?? 0,
      lastMonthTransactions: stats['lastMonthTransactions'] ?? 0,
      thisMonthPatients: stats['thisMonthPatients'] ?? 0,
      thisMonthFinancial: _toDouble(stats['thisMonthFinancial']) ?? 0,
      upcomingAppointmentsCount: stats['upcomingAppointmentsCount'] ?? 0,
    );
  }
}

class PendingPlanItem {
  final int id;
  final int treatmentPlanId;
  final int toothNumber;
  final String treatmentType;
  final double cost;
  final String currency;
  final String? notes;

  PendingPlanItem({
    required this.id,
    required this.treatmentPlanId,
    required this.toothNumber,
    required this.treatmentType,
    required this.cost,
    required this.currency,
    this.notes,
  });

  factory PendingPlanItem.fromJson(Map<String, dynamic> json) {
    return PendingPlanItem(
      id: json['id'],
      treatmentPlanId: json['treatment_plan_id'] ?? json['treatmentPlanId'],
      toothNumber: json['tooth_number'] ?? json['toothNumber'] ?? 0,
      treatmentType: json['treatment_type'] ?? json['treatmentType'] ?? '',
      cost: _toDouble(json['cost']) ?? 0,
      currency: json['currency'] ?? 'TRY',
      notes: json['notes'],
    );
  }
}

class PendingPlan {
  final int id;
  final int patientId;
  final int dentistId;
  final String title;
  final String? description;
  final String status;
  final double? totalEstimatedCost;
  final String? patientName;
  final String? dentistEmail;
  final List<PendingPlanItem> items;

  PendingPlan({
    required this.id,
    required this.patientId,
    required this.dentistId,
    required this.title,
    this.description,
    required this.status,
    this.totalEstimatedCost,
    this.patientName,
    this.dentistEmail,
    required this.items,
  });

  factory PendingPlan.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List? ?? [];
    return PendingPlan(
      id: json['id'],
      patientId: json['patient_id'] ?? json['patientId'],
      dentistId: json['dentist_id'] ?? json['dentistId'],
      title: json['title'] ?? '',
      description: json['description'],
      status: json['status'] ?? 'pending',
      totalEstimatedCost: _toDouble(json['total_estimated_cost'] ?? json['totalEstimatedCost']),
      patientName: json['patient_name'] ?? json['patientName'],
      dentistEmail: json['dentist_email'] ?? json['dentistEmail'],
      items: itemsJson
          .map((e) => PendingPlanItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class DentistEarningsData {
  final double totalTurnover;
  final double paidTurnoverShare;
  final double totalEarnings;
  final double salary;
  final double commissionRate;
  final int treatmentCount;
  final List<Treatment> treatments;

  DentistEarningsData({
    required this.totalTurnover,
    required this.paidTurnoverShare,
    required this.totalEarnings,
    required this.salary,
    required this.commissionRate,
    required this.treatmentCount,
    required this.treatments,
  });

  factory DentistEarningsData.fromJson(Map<String, dynamic> json) {
    final earnings = Map<String, dynamic>.from(json['earnings'] ?? {});
    final treatmentsJson = json['treatments'] as List? ?? [];
    return DentistEarningsData(
      totalTurnover: _toDouble(earnings['totalTurnover']) ?? 0,
      paidTurnoverShare: _toDouble(earnings['paidTurnoverShare']) ?? 0,
      totalEarnings: _toDouble(earnings['totalEarnings']) ?? 0,
      salary: _toDouble(earnings['salary']) ?? 0,
      commissionRate: _toDouble(earnings['commissionRate']) ?? 0,
      treatmentCount: earnings['treatmentCount'] ?? 0,
      treatments: treatmentsJson
          .map((e) => Treatment.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}
