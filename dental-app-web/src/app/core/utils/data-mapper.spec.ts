import { DataMapper } from './data-mapper';

describe('DataMapper', () => {
  it('randevuyu snake_case → camelCase eşler', () => {
    const sonuc = DataMapper.mapAppointment({
      id: 1,
      patient_id: 5,
      dentist_id: 3,
      appointment_date: '2026-06-14',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'scheduled',
      patient_first_name: 'Ali',
      patient_last_name: 'Veli',
    });

    expect(sonuc.patientId).toBe(5);
    expect(sonuc.dentistId).toBe(3);
    expect(sonuc.startTime).toBe('09:00:00');
    expect(sonuc.patientFirstName).toBe('Ali');
    expect(sonuc.patientLastName).toBe('Veli');
  });

  it('zaten camelCase gelen alanları da kabul eder (fallback)', () => {
    const sonuc = DataMapper.mapPatient({
      id: 2,
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
    });

    expect(sonuc.firstName).toBe('Ayşe');
    expect(sonuc.lastName).toBe('Yılmaz');
  });

  it('tedavi para birimi belirtilmemişse TRY varsayar', () => {
    const sonuc = DataMapper.mapTreatment({
      id: 1,
      patient_id: 2,
      treatment_type: 'Dolgu',
      cost: 100,
    });

    expect(sonuc.currency).toBe('TRY');
  });

  it('tedavi para birimi belirtilmişse onu korur', () => {
    const sonuc = DataMapper.mapTreatment({
      id: 1,
      patient_id: 2,
      treatment_type: 'Dolgu',
      cost: 100,
      currency: 'TRY',
    });

    expect(sonuc.currency).toBe('TRY');
  });
});
