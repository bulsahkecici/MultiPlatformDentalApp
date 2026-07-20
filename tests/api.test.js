jest.mock('../src/db', () => ({
  pingDb: jest.fn(),
  query: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

function adminToken() {
  return jwt.sign(
    { sub: 1, email: 'admin@mail.com', roles: ['admin'] },
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

  it('PUT /api/treatments/:id — UPDATE sorgusu var olmayan deleted_at kolonunu içermez', async () => {
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
    // Regresyon: treatments tablosunda deleted_at yok — sorguda geçmemeli
    expect(updateCall[0]).not.toContain('deleted_at');
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
