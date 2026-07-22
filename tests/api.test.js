jest.mock('../src/db', () => {
  // withTransaction, aynı mocklanmış `query` fonksiyonunu "client.query" olarak
  // geçirir — böylece transaction içi çağrılar da db.query.mock.calls'ta görünür
  // ve testler gerçek/mock ayrımı yapmadan aynı assertion'ları kullanabilir.
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

function adminToken() {
  return jwt.sign(
    { sub: 1, email: 'admin@mail.com', roles: ['admin'], tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

function dentistToken(sub) {
  return jwt.sign(
    {
      sub,
      email: `dentist${sub}@mail.com`,
      roles: ['dentist'],
      tokenType: 'access',
    },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('Randevu iptali', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('PUT /api/appointments/:id/cancel — reason anahtarıyla iptal eder (web istemcisi)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("status = 'cancelled'")) {
        return Promise.resolve({
          rows: [
            {
              id: 5,
              status: 'cancelled',
              cancellation_reason: 'Hasta gelemedi',
              dentist_id: null,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/5/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Hasta gelemedi' });

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('cancelled');

    // reason → cancellation_reason parametresi olarak geçmiş olmalı
    const cancelCall = db.query.mock.calls.find(([sql]) =>
      sql.includes("status = 'cancelled'"),
    );
    expect(cancelCall[1][0]).toBe('Hasta gelemedi');
  });

  it('DELETE /api/appointments/:id — desktop istemcisi için alias çalışır', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("status = 'cancelled'")) {
        return Promise.resolve({
          rows: [
            {
              id: 6,
              status: 'cancelled',
              cancellation_reason: null,
              dentist_id: null,
              appointment_date: '2026-07-21',
              start_time: '10:00:00',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/appointments/6')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('cancelled');
  });
});

describe('Tedavi güncelleme (deleted_at regresyonu)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('PUT /api/treatments/:id — UPDATE sorgusu voided (deleted_at dolu) kaydı hariç tutar', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({
          rows: [{ id: 7, status: 'completed', dentist_id: null }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/7')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);

    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatments'),
    );
    expect(updateCall).toBeDefined();
    // Void edilmiş (deleted_at dolu) bir kayıt sessizce güncellenemesin
    expect(updateCall[0]).toContain('deleted_at IS NULL');
  });
});

describe('DELETE /api/treatments/:id — tedavi kaydı asla hard-delete edilmez (void)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('DELETE isteği bir UPDATE (soft void) üretir, hiçbir zaman DELETE FROM treatments çalıştırmaz', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('UPDATE treatments') &&
        sql.includes('deleted_at = NOW()')
      ) {
        return Promise.resolve({ rows: [{ id: 9 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Yanlış hasta kaydına girilmiş' });

    expect(res.status).toBe(204);

    const hardDeleteCall = db.query.mock.calls.find(([sql]) =>
      sql.trim().startsWith('DELETE FROM treatments'),
    );
    expect(hardDeleteCall).toBeUndefined();

    const voidCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE treatments') && sql.includes('deleted_at = NOW()'),
    );
    expect(voidCall).toBeDefined();
    expect(voidCall[1]).toEqual(['Yanlış hasta kaydına girilmiş', 1, 9]);
  });

  it('zaten void edilmiş bir kaydı tekrar void etmeye çalışmak 404 döner', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 }); // WHERE deleted_at IS NULL eşleşmez

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe('Bildirimler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('GET /api/notifications — liste + okunmamış sayısı döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM notifications')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              user_id: 1,
              type: 'appointment',
              title: 'Yeni randevu',
              message: '2026-07-20 09:00',
              is_read: false,
              created_at: '2026-07-20T08:00:00Z',
            },
          ],
        });
      }
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '1' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.unreadCount).toBe(1);
  });

  it('PUT /api/notifications/:id/read — okundu işaretler', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SET is_read = true')) {
        return Promise.resolve({
          rows: [{ id: 3, is_read: true }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/notifications/3/read')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.notification.is_read).toBe(true);
  });
});

describe('Randevu yetkilendirme (IDOR koruması — diş hekimi sadece kendi randevusuna erişebilir)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('GET /api/appointments/:id — başka dişhekiminin randevusuna 403 döner', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 10,
          dentist_id: 1,
          appointment_date: '2026-07-20',
          start_time: '09:00:00',
        },
      ],
    });

    const res = await request(app)
      .get('/api/appointments/10')
      .set('Authorization', `Bearer ${dentistToken(99)}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/appointments/:id — kendi randevusuna erişebilir', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 11,
          dentist_id: 99,
          appointment_date: '2026-07-20',
          start_time: '09:00:00',
        },
      ],
    });

    const res = await request(app)
      .get('/api/appointments/11')
      .set('Authorization', `Bearer ${dentistToken(99)}`);

    expect(res.status).toBe(200);
  });

  it('PUT /api/appointments/:id — başka dişhekiminin randevusunu güncelleyemez', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT dentist_id, appointment_date, start_time, end_time, status FROM appointments',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 1,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
              end_time: '09:30:00',
              status: 'scheduled',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/12')
      .set('Authorization', `Bearer ${dentistToken(99)}`)
      .send({ notes: 'değişiklik' });

    expect(res.status).toBe(403);

    // Sahiplik reddedildiği için UPDATE hiç çalıştırılmamalı
    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE appointments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('PUT /api/appointments/:id/cancel — başka dişhekiminin randevusunu iptal edemez', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id FROM appointments')) {
        return Promise.resolve({ rows: [{ dentist_id: 1 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/13/cancel')
      .set('Authorization', `Bearer ${dentistToken(99)}`)
      .send({ reason: 'iptal' });

    expect(res.status).toBe(403);
  });
});

describe('Randevu oluşturma — çakışma kontrolü ve advisory lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('POST /api/appointments — çakışma varsa 409 döner ve kayıt eklenmez', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        return Promise.resolve({ rows: [{ id: 999 }] }); // mevcut çakışan randevu
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 1,
        appointmentDate: '2026-07-20',
        startTime: '09:00:00',
        endTime: '09:30:00',
      });

    expect(res.status).toBe(409);

    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO appointments'),
    );
    expect(insertCall).toBeUndefined();

    const lockCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('pg_advisory_xact_lock'),
    );
    expect(lockCall).toBeDefined();
  });

  it('POST /api/appointments — çakışma yoksa transaction içinde oluşturulur', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        return Promise.resolve({ rows: [] }); // çakışma yok
      }
      if (sql.includes('INSERT INTO appointments')) {
        return Promise.resolve({ rows: [{ id: 30 }] });
      }
      if (sql.includes('FROM appointments a')) {
        return Promise.resolve({
          rows: [
            {
              id: 30,
              dentist_id: 1,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 1,
        appointmentDate: '2026-07-20',
        startTime: '09:00:00',
        endTime: '09:30:00',
      });

    expect(res.status).toBe(201);
    expect(res.body.appointment.id).toBe(30);
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('Tedavi planı onayı — idempotent (çift onay borcu iki kez eklemez)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('İlk onayda plan güncellenir ve borç eklenir', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [{ id: 1, treatment_type: 'Dolgu', cost: '500' }],
        });
      }
      if (sql.includes('FROM institution_agreements')) {
        return Promise.resolve({ rows: [] }); // hasta bir kuruma bağlı değil
      }
      if (sql.includes("WHERE id = $3 AND status = 'pending'")) {
        return Promise.resolve({
          rows: [
            {
              id: 20,
              patient_id: 3,
              dentist_id: null,
              status: 'approved',
              title: 'Plan A',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/20')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);
    expect(res.body.plan.status).toBe('approved');

    const debtCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO patient_debts'),
    );
    expect(debtCall).toBeDefined();
  });

  it('Zaten onaylanmış planı tekrar onaylamaya çalışmak 409 döner ve borç tekrar eklenmez', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [{ id: 1, treatment_type: 'Dolgu', cost: '500' }],
        });
      }
      if (sql.includes('FROM institution_agreements')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("WHERE id = $3 AND status = 'pending'")) {
        // Plan zaten 'pending' dışında bir durumda — hiçbir satır güncellenmez
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT status FROM treatment_plans')) {
        return Promise.resolve({ rows: [{ status: 'approved' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/20')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(409);

    const debtCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO patient_debts'),
    );
    expect(debtCall).toBeUndefined();
  });
});

describe('Tedavi planı oluşturma — plan ve kalemler tek transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('Kalem eklerken hata oluşursa plan da geri alınır (transaction rollback)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO treatment_plans')) {
        return Promise.resolve({ rows: [{ id: 40, patient_id: 5 }] });
      }
      if (sql.includes('INSERT INTO treatment_plan_items')) {
        return Promise.reject(new Error('DB kalem eklerken patladı'));
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatment-plans')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 5,
        title: 'Kanal Tedavisi',
        items: [{ toothNumber: '36', treatmentType: 'Kanal', cost: 1000 }],
      });

    expect(res.status).toBe(500);
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('Tüm kalemler başarıyla eklenirse plan kalemleriyle birlikte döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO treatment_plans')) {
        return Promise.resolve({
          rows: [{ id: 41, patient_id: 5, title: 'Dolgu' }],
        });
      }
      if (sql.includes('INSERT INTO treatment_plan_items')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT * FROM treatment_plan_items')) {
        return Promise.resolve({
          rows: [
            { id: 1, tooth_number: '36', treatment_type: 'Dolgu', cost: 500 },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatment-plans')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 5,
        title: 'Dolgu',
        items: [{ toothNumber: '36', treatmentType: 'Dolgu', cost: 500 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.plan.items).toHaveLength(1);
  });
});
