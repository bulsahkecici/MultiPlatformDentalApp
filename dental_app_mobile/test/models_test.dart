// Model çözümleme (fromJson) testleri — saf Dart, widget gerektirmez.
// Çalıştırmak için: `cd dental_app_mobile && flutter test`
import 'package:flutter_test/flutter_test.dart';
import 'package:dental_app_mobile/models/models.dart';

void main() {
  group('Appointment.fromJson', () {
    test('snake_case alanları doğru çözer', () {
      final appointment = Appointment.fromJson({
        'id': 1,
        'patient_id': 5,
        'dentist_id': 3,
        'appointment_date': '2026-06-14',
        'start_time': '09:00:00',
        'end_time': '09:30:00',
        'status': 'scheduled',
        'patient_first_name': 'Ali',
        'patient_last_name': 'Veli',
      });

      expect(appointment.patientId, 5);
      expect(appointment.dentistId, 3);
      expect(appointment.startTime, '09:00:00');
      expect(appointment.patientFirstName, 'Ali');
      expect(appointment.status, 'scheduled');
    });

    test('camelCase alanları da kabul eder (fallback)', () {
      final appointment = Appointment.fromJson({
        'id': 2,
        'patientId': 7,
        'appointmentDate': '2026-06-15',
        'startTime': '10:00:00',
        'endTime': '10:30:00',
      });

      expect(appointment.patientId, 7);
      expect(appointment.startTime, '10:00:00');
    });
  });

  group('Treatment.fromJson', () {
    test('para birimi belirtilmemişse TRY varsayar', () {
      final treatment = Treatment.fromJson({
        'id': 1,
        'patient_id': 2,
        'treatment_date': '2026-06-14',
        'treatment_type': 'Dolgu',
        'cost': 100,
      });

      expect(treatment.currency, 'TRY');
      expect(treatment.treatmentType, 'Dolgu');
    });

    test('para birimi belirtilmişse onu korur', () {
      final treatment = Treatment.fromJson({
        'id': 1,
        'patient_id': 2,
        'treatment_date': '2026-06-14',
        'treatment_type': 'Dolgu',
        'cost': 100,
        'currency': 'TRY',
      });

      expect(treatment.currency, 'TRY');
    });
  });
}
