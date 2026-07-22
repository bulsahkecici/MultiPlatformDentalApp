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

describe('POST /api/appointments — bitiş/başlangıç saat sırası', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('bitiş saati başlangıçtan önce/eşitse 400 döner', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 1,
        appointmentDate: '2026-07-20',
        startTime: '14:00:00',
        endTime: '09:00:00',
      });

    expect(res.status).toBe(400);
    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO appointments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('geçersiz saat (09:60:00) format hatası olarak 400 döner', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 1,
        appointmentDate: '2026-07-20',
        startTime: '09:30:00',
        endTime: '09:60:00',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/appointments/:id — güncellemede çakışma kontrolü', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('randevu başka bir dolu saate taşınmak istenirse 409 döner ve UPDATE çalışmaz', async () => {
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
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        // Aynı doktorun aynı gün başka bir dolu randevusu var
        return Promise.resolve({ rows: [{ id: 999 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ startTime: '10:00:00', endTime: '10:30:00' });

    expect(res.status).toBe(409);

    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE appointments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it("çakışma sorgusu kendi randevu ID'sini hariç tutar", async () => {
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
      if (sql.includes('pg_advisory_xact_lock')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2')
      ) {
        // Kendi ID'si hariç tutulduğu için çakışma bulunmamalı
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE appointments')) {
        return Promise.resolve({
          rows: [{ id: 50, dentist_id: 5, appointment_date: '2026-07-20' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ startTime: '09:15:00', endTime: '09:45:00' });

    expect(res.status).toBe(200);

    const conflictCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('WHERE dentist_id = $1') &&
        sql.includes('appointment_date = $2'),
    );
    expect(conflictCall[0]).toContain('id <>');
  });

  it("sadece startTime değişip yeni değer mevcut endTime'dan sonra ise 400 döner (kısmi güncelleme doğru doğrulanır)", async () => {
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
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      // Sadece startTime gönderiliyor — mevcut endTime (09:30) bundan önce kalıyor
      .send({ startTime: '10:00:00' });

    expect(res.status).toBe(400);

    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE appointments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('sadece notes değişirken (saat/tarih dokunulmadan) çakışma kontrolü hiç çalışmaz', async () => {
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
        return Promise.resolve({
          rows: [{ id: 50, dentist_id: 5, notes: 'yeni not' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ notes: 'yeni not' });

    expect(res.status).toBe(200);

    const lockCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('pg_advisory_xact_lock'),
    );
    expect(lockCall).toBeUndefined();
  });

  it('randevu iptal edilirken (status: cancelled) çakışma kontrolü çalışmaz', async () => {
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
        return Promise.resolve({
          rows: [{ id: 50, dentist_id: 5, status: 'cancelled' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/appointments/50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        status: 'cancelled',
        dentistId: 5,
        appointmentDate: '2026-07-20',
      });

    expect(res.status).toBe(200);

    const lockCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('pg_advisory_xact_lock'),
    );
    expect(lockCall).toBeUndefined();
  });
});
