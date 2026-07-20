import 'package:flutter_test/flutter_test.dart';

import 'package:dental_app_mobile/models/models.dart';

void main() {
  group('Model fromJson', () {
    test('Patient snake_case ve camelCase alanları tolere eder', () {
      final snake = Patient.fromJson({
        'id': 1,
        'first_name': 'Ali',
        'last_name': 'Veli',
        'phone': '5551112233',
      });
      expect(snake.fullName, 'Ali Veli');

      final camel = Patient.fromJson({
        'id': 2,
        'firstName': 'Ayşe',
        'lastName': 'Yılmaz',
      });
      expect(camel.fullName, 'Ayşe Yılmaz');
    });

    test('PatientDebt sıfır-durum camelCase yanıtını parse eder', () {
      final debt = PatientDebt.fromJson({
        'patientId': 5,
        'totalDebt': 0,
        'paidAmount': 0,
        'remainingDebt': 0,
      });
      expect(debt.patientId, 5);
      expect(debt.remainingDebt, 0);
    });

    test('User roles hem liste hem CSV biçimini parse eder', () {
      final fromList = User.fromJson({
        'id': 1,
        'email': 'a@b.com',
        'roles': ['admin', 'dentist'],
      });
      expect(fromList.isAdmin, true);
      expect(fromList.isDentist, true);

      final fromCsv = User.fromJson({
        'id': 2,
        'email': 'c@d.com',
        'roles': 'secretary',
      });
      expect(fromCsv.isSecretary, true);
    });

    test('Appointment tarih alanını YYYY-MM-DD olarak normalize eder', () {
      final appointment = Appointment.fromJson({
        'id': 1,
        'patient_id': 3,
        'appointment_date': '2026-07-20T00:00:00.000Z',
        'start_time': '09:00:00',
        'end_time': '09:30:00',
      });
      expect(appointment.appointmentDate, '2026-07-20');
    });
  });
}
