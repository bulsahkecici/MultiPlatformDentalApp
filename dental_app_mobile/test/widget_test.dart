import 'package:flutter_test/flutter_test.dart';

import 'package:dental_app_mobile/core/mobile_access_policy.dart';
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

    test(
        'Patient create payload backendin beklediği camelCase alanları kullanır',
        () {
      final payload = Patient(
        id: 0,
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        dateOfBirth: '1990-05-12',
        medicalConditions: 'Hipertansiyon',
      ).toJson();

      expect(payload['firstName'], 'Ayşe');
      expect(payload['lastName'], 'Yılmaz');
      expect(payload['dateOfBirth'], '1990-05-12');
      expect(payload['medicalConditions'], 'Hipertansiyon');
      expect(payload.containsKey('first_name'), false);
    });
  });

  group('Mobil rol politikası', () {
    User userWith(List<String> roles) => User(
          id: 1,
          email: 'user@bulka.test',
          roles: roles,
        );

    test('patron finansı ve randevuları salt okunur görür', () {
      final access = MobileAccessPolicy.forUser(userWith(['admin']));

      expect(access.isSupported, true);
      expect(access.canViewFinancials, true);
      expect(access.canManageAppointments, false);
      expect(access.canManagePatients, false);
      expect(access.canManageTreatments, false);
    });

    test('diş hekimi randevu, hasta ve tedavi işlemlerini yönetir', () {
      final access = MobileAccessPolicy.forUser(userWith(['dentist']));

      expect(access.isSupported, true);
      expect(access.canViewFinancials, false);
      expect(access.canManageAppointments, true);
      expect(access.canManagePatients, true);
      expect(access.canManageTreatments, true);
    });

    test('sekreter mobilde desteklenmez', () {
      final access = MobileAccessPolicy.forUser(userWith(['secretary']));
      expect(access.isSupported, false);
    });

    test('admin rolü çok rollü hesapta salt-okunur patron önceliği alır', () {
      final access = MobileAccessPolicy.forUser(userWith(['admin', 'dentist']));
      expect(access.isOwner, true);
      expect(access.canManageAppointments, false);
    });
  });
}
