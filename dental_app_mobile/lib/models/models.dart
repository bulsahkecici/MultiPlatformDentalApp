class User {
  final int id;
  final String email;
  final List<String> roles;
  final bool emailVerified;
  final DateTime? lastLoginAt;

  User({
    required this.id,
    required this.email,
    required this.roles,
    required this.emailVerified,
    this.lastLoginAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      roles: List<String>.from(json['roles'] ?? []),
      emailVerified: json['emailVerified'] ?? false,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.parse(json['lastLoginAt'])
          : null,
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

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'],
      refreshToken: json['refreshToken'],
      user: User.fromJson(json['user']),
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
  final String? city;
  final DateTime createdAt;

  Patient({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.dateOfBirth,
    this.gender,
    this.email,
    this.phone,
    this.city,
    required this.createdAt,
  });

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'],
      firstName: json['first_name'] ?? json['firstName'],
      lastName: json['last_name'] ?? json['lastName'],
      dateOfBirth: json['date_of_birth'] != null || json['dateOfBirth'] != null
          ? DateTime.parse(json['date_of_birth'] ?? json['dateOfBirth'])
          : null,
      gender: json['gender'],
      email: json['email'],
      phone: json['phone'],
      city: json['city'],
      createdAt: DateTime.parse(json['created_at'] ?? json['createdAt']),
    );
  }

  String get fullName => '$firstName $lastName';
}

class Appointment {
  final int id;
  final int patientId;
  final DateTime appointmentDate;
  final String startTime;
  final String endTime;
  final String? appointmentType;
  final String status;
  final String? patientFirstName;
  final String? patientLastName;

  Appointment({
    required this.id,
    required this.patientId,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    this.appointmentType,
    required this.status,
    this.patientFirstName,
    this.patientLastName,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'],
      patientId: json['patient_id'] ?? json['patientId'],
      appointmentDate: DateTime.parse(json['appointment_date'] ?? json['appointmentDate']),
      startTime: json['start_time'] ?? json['startTime'],
      endTime: json['end_time'] ?? json['endTime'],
      appointmentType: json['appointment_type'] ?? json['appointmentType'],
      status: json['status'],
      patientFirstName: json['patient_first_name'] ?? json['patientFirstName'],
      patientLastName: json['patient_last_name'] ?? json['patientLastName'],
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
  });

  factory Treatment.fromJson(Map<String, dynamic> json) {
    return Treatment(
      id: json['id'],
      patientId: json['patient_id'] ?? json['patientId'],
      treatmentDate: DateTime.parse(json['treatment_date'] ?? json['treatmentDate']),
      treatmentType: json['treatment_type'] ?? json['treatmentType'],
      toothNumber: json['tooth_number'] ?? json['toothNumber'],
      cost: json['cost']?.toDouble(),
      currency: json['currency'] ?? 'USD',
      status: json['status'],
      patientFirstName: json['patient_first_name'] ?? json['patientFirstName'],
      patientLastName: json['patient_last_name'] ?? json['patientLastName'],
    );
  }
}
