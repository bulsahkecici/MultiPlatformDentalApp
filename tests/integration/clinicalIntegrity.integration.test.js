const request = require('supertest');
const { pool, resetDatabase, createUser, createPatient } = require('./dbHelper');
const { app } = require('../../src/server');

describe('Klinik kayıt bütünlüğü (gerçek PostgreSQL)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('treatment asla hard-delete edilmez — void sonrası satır DB\'de aynen kalır', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const dentist = await createUser({ roles: ['dentist'] });
    const patient = await createPatient();

    const created = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        dentistId: dentist.id,
        treatmentDate: '2026-07-01',
        treatmentType: 'Dolgu',
        cost: 500,
      });
    expect(created.status).toBe(201);
    const treatmentId = created.body.treatment.id;

    const voided = await request(app)
      .delete(`/api/treatments/${treatmentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Yanlış hasta' });
    expect(voided.status).toBe(204);

    const row = await pool.query('SELECT * FROM treatments WHERE id = $1', [
      treatmentId,
    ]);
    expect(row.rows).toHaveLength(1); // satır hâlâ orada — hard delete olmadı
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect(row.rows[0].void_reason).toBe('Yanlış hasta');
  });

  it('void nedeni boş bırakılırsa 400 döner ve kayıt etkilenmez', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const created = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ patientId: patient.id, treatmentDate: '2026-07-01', treatmentType: 'Kontrol' });
    const treatmentId = created.body.treatment.id;

    const res = await request(app)
      .delete(`/api/treatments/${treatmentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);

    const row = await pool.query(
      'SELECT deleted_at FROM treatments WHERE id = $1',
      [treatmentId],
    );
    expect(row.rows[0].deleted_at).toBeNull();
  });

  it('sekreter tamamlanmış bir tedavinin tanısını değiştiremez (409), amend endpointini kullanmalı', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const secretary = await createUser({ roles: ['secretary'] });
    const dentist = await createUser({ roles: ['dentist'] });
    const patient = await createPatient();

    const treatmentRow = await pool.query(
      `INSERT INTO treatments (patient_id, dentist_id, treatment_date, treatment_type, diagnosis, status, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, '2026-06-01', 'Kanal Tedavisi', 'Eski tanı', 'completed', $3, $3, NOW(), NOW())
       RETURNING id`,
      [patient.id, dentist.id, admin.id],
    );
    const treatmentId = treatmentRow.rows[0].id;

    const putRes = await request(app)
      .put(`/api/treatments/${treatmentId}`)
      .set('Authorization', `Bearer ${secretary.token}`)
      .send({ diagnosis: 'Sekreterin yazdığı yeni tanı' });
    expect(putRes.status).toBe(409);

    const row = await pool.query(
      'SELECT diagnosis FROM treatments WHERE id = $1',
      [treatmentId],
    );
    expect(row.rows[0].diagnosis).toBe('Eski tanı'); // hiç değişmedi

    // Doğru yol: hekim amend endpoint'ini kullanır, revizyon geçmişi oluşur.
    const amendRes = await request(app)
      .post(`/api/treatments/${treatmentId}/amend`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ changes: { diagnosis: 'Güncellenmiş tanı' }, reason: 'Kontrol sonrası netleşti' });
    expect(amendRes.status).toBe(200);

    const revisions = await pool.query(
      'SELECT * FROM treatment_revisions WHERE treatment_id = $1',
      [treatmentId],
    );
    expect(revisions.rows).toHaveLength(1);
    expect(revisions.rows[0].previous_values.diagnosis).toBe('Eski tanı');
    expect(revisions.rows[0].new_values.diagnosis).toBe('Güncellenmiş tanı');
    expect(revisions.rows[0].reason).toBe('Kontrol sonrası netleşti');

    const updatedRow = await pool.query(
      'SELECT diagnosis FROM treatments WHERE id = $1',
      [treatmentId],
    );
    expect(updatedRow.rows[0].diagnosis).toBe('Güncellenmiş tanı');
  });

  it('dişhekimi başka bir dişhekimi adına tedavi oluşturamaz (403), kayıt oluşmaz', async () => {
    const dentistA = await createUser({ roles: ['dentist'] });
    const dentistB = await createUser({ roles: ['dentist'] });
    const patient = await createPatient();

    const res = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${dentistA.token}`)
      .send({
        patientId: patient.id,
        dentistId: dentistB.id,
        treatmentDate: '2026-07-01',
        treatmentType: 'Dolgu',
      });
    expect(res.status).toBe(403);

    const count = await pool.query('SELECT COUNT(*) FROM treatments');
    expect(parseInt(count.rows[0].count, 10)).toBe(0);
  });

  it('sekreter silinmiş/pasif bir kullanıcıyı dişhekimi olarak seçemez', async () => {
    const secretary = await createUser({ roles: ['secretary'] });
    const deletedDentist = await createUser({ roles: ['dentist'] });
    await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [
      deletedDentist.id,
    ]);
    const patient = await createPatient();

    const res = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${secretary.token}`)
      .send({
        patientId: patient.id,
        dentistId: deletedDentist.id,
        treatmentDate: '2026-07-01',
        treatmentType: 'Dolgu',
      });
    expect(res.status).toBe(400);
  });
});
