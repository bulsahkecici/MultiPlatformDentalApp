jest.mock('../src/db', () => {
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

const CURRENT_SELECT =
  'SELECT dentist_id, appointment_date, start_time, end_time, status FROM appointments';

describe('PUT /api/appointments/:id — durum geçiş matrisi (D6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  function mockCurrent(status) {
    db.query.mockImplementation((sql) => {
      if (sql.includes(CURRENT_SELECT)) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 5,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
              end_time: '09:30:00',
              status,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  }

  it('completed -> scheduled engellenir (409)', async () => {
    mockCurrent('completed');
    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'scheduled' });
    expect(res.status).toBe(409);
  });

  it('cancelled -> completed engellenir (409)', async () => {
    mockCurrent('cancelled');
    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(409);
  });

  it('cancelled -> scheduled (status-only reaktivasyon) normal PUT ile engellenir — reopen endpoint kullanılmalı', async () => {
    mockCurrent('cancelled');
    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'scheduled' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('reopen');
  });

  it('scheduled -> confirmed izinlidir (200)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes(CURRENT_SELECT)) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 5,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
              end_time: '09:30:00',
              status: 'scheduled',
            },
          ],
        });
      }
      if (sql.includes('UPDATE appointments')) {
        return Promise.resolve({ rows: [{ id: 50, status: 'confirmed' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
  });

  it('no_show -> scheduled engellenir (yeni randevu oluşturulması önerilir)', async () => {
    mockCurrent('no_show');
    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'scheduled' });
    expect(res.status).toBe(409);
  });
});

describe('Randevu iptal endpointi — durum geçiş matrisi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('completed randevu ayrı cancel endpointi üzerinden de iptal edilemez', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT dentist_id, status') &&
        sql.includes('FOR UPDATE')
      ) {
        return Promise.resolve({
          rows: [{ dentist_id: 5, status: 'completed' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Yanlış kayıt' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('completed -> cancelled');
    expect(
      db.query.mock.calls.some(([sql]) =>
        sql.includes("SET status = 'cancelled'"),
      ),
    ).toBe(false);
  });

  it('scheduled randevu iptal edilebilir', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT dentist_id, status') &&
        sql.includes('FOR UPDATE')
      ) {
        return Promise.resolve({
          rows: [{ dentist_id: 5, status: 'scheduled' }],
        });
      }
      if (sql.includes("SET status = 'cancelled'")) {
        return Promise.resolve({
          rows: [{ id: 50, dentist_id: 5, status: 'cancelled' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Hasta talebi' });

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('cancelled');
  });
});

describe('POST /api/appointments/:id/reopen — koşulsuz çakışma kontrolü (D6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('sadece cancelled randevular reopen edilebilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes(CURRENT_SELECT)) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 5,
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
      .post('/api/appointments/50/reopen')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('aynı slot başka bir randevu tarafından doldurulduysa reopen 409 döner (schedule alanları hiç gönderilmese bile)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes(CURRENT_SELECT)) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 5,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
              end_time: '09:30:00',
              status: 'cancelled',
            },
          ],
        });
      }
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        // Aynı slotu dolduran başka bir randevu (D6 senaryosu)
        return Promise.resolve({ rows: [{ id: 777 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/appointments/50/reopen')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(409);
    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE appointments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('slot boşsa reopen başarıyla scheduled durumuna döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes(CURRENT_SELECT)) {
        return Promise.resolve({
          rows: [
            {
              dentist_id: 5,
              appointment_date: '2026-07-20',
              start_time: '09:00:00',
              end_time: '09:30:00',
              status: 'cancelled',
            },
          ],
        });
      }
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE appointments')) {
        return Promise.resolve({
          rows: [{ id: 50, status: 'scheduled' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/appointments/50/reopen')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('scheduled');
  });
});
