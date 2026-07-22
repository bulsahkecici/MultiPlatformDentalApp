const request = require('supertest');
const { pool, resetDatabase, createUser, createPatient } = require('./dbHelper');
const { app } = require('../../src/server');

describe('Randevu bütünlüğü (gerçek PostgreSQL)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('geçersiz saat (09:60:00) API seviyesinde 400 ile reddedilir', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        appointmentDate: '2026-08-01',
        startTime: '09:30:00',
        endTime: '09:60:00',
      });
    expect(res.status).toBe(400);

    const count = await pool.query('SELECT COUNT(*) FROM appointments');
    expect(parseInt(count.rows[0].count, 10)).toBe(0);
  });

  it('bitiş başlangıçtan önce/eşitse 400 döner', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        appointmentDate: '2026-08-01',
        startTime: '10:00:00',
        endTime: '09:00:00',
      });
    expect(res.status).toBe(400);
  });

  it('status sütunundaki DB CHECK constraint geçersiz bir değeri doğrudan SQL seviyesinde de reddeder', async () => {
    const patient = await createPatient();
    await expect(
      pool.query(
        `INSERT INTO appointments (patient_id, appointment_date, start_time, end_time, status)
         VALUES ($1, '2026-08-01', '09:00:00', '09:30:00', 'bogus_status')`,
        [patient.id],
      ),
    ).rejects.toThrow(/chk_appointments_status_allowed/);
  });

  it('aynı doktor+gün+saat için çakışan iki eşzamanlı POST isteğinden yalnızca biri başarılı olur', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const dentist = await createUser({ roles: ['dentist'] });
    const patient = await createPatient();

    const payload = {
      patientId: patient.id,
      dentistId: dentist.id,
      appointmentDate: '2026-08-05',
      startTime: '11:00:00',
      endTime: '11:30:00',
    };

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(payload),
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await pool.query(
      `SELECT COUNT(*) FROM appointments WHERE dentist_id = $1 AND appointment_date = '2026-08-05'`,
      [dentist.id],
    );
    expect(parseInt(count.rows[0].count, 10)).toBe(1);
  });

  it('iptal edilmiş randevu, slot başka bir randevuyla dolduysa reopen ile yeniden açılamaz (409), veri bozulmaz', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const dentist = await createUser({ roles: ['dentist'] });
    const patientA = await createPatient({ firstName: 'A' });
    const patientB = await createPatient({ firstName: 'B' });

    // Randevu #1: oluşturulur, sonra iptal edilir.
    const createdA = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patientA.id,
        dentistId: dentist.id,
        appointmentDate: '2026-08-10',
        startTime: '14:00:00',
        endTime: '14:30:00',
      });
    expect(createdA.status).toBe(201);
    const appointmentAId = createdA.body.appointment.id;

    const cancelRes = await request(app)
      .put(`/api/appointments/${appointmentAId}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Hasta iptal etti' });
    expect(cancelRes.status).toBe(200);

    // Aynı slota patient B için yeni bir randevu verilir (D6 senaryosu).
    const createdB = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patientB.id,
        dentistId: dentist.id,
        appointmentDate: '2026-08-10',
        startTime: '14:00:00',
        endTime: '14:30:00',
      });
    expect(createdB.status).toBe(201);

    // Randevu #1'i sadece status ile yeniden 'scheduled' yapmaya çalışmak
    // (eski, hatalı davranış) artık matris tarafından tamamen engellenir.
    const badReactivate = await request(app)
      .put(`/api/appointments/${appointmentAId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'scheduled' });
    expect(badReactivate.status).toBe(409);

    // Doğru yol (reopen) da çakışma kontrolünden geçtiği için aynı şekilde engellenir.
    const reopenRes = await request(app)
      .post(`/api/appointments/${appointmentAId}/reopen`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(reopenRes.status).toBe(409);

    const row = await pool.query(
      'SELECT status FROM appointments WHERE id = $1',
      [appointmentAId],
    );
    expect(row.rows[0].status).toBe('cancelled'); // hâlâ iptal — bozulmadı
  });

  it('boş bir slota reopen başarıyla çalışır', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const dentist = await createUser({ roles: ['dentist'] });
    const patient = await createPatient();

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        dentistId: dentist.id,
        appointmentDate: '2026-08-11',
        startTime: '15:00:00',
        endTime: '15:30:00',
      });
    const appointmentId = created.body.appointment.id;

    await request(app)
      .put(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Hasta gelemedi' });

    const reopenRes = await request(app)
      .post(`/api/appointments/${appointmentId}/reopen`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.appointment.status).toBe('scheduled');
  });
});
