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

describe('Diş hekimi fiyatı göremediği gibi API üzerinden de değiştiremez', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('POST /api/treatments — diş hekimi cost göndermeye çalışırsa 403 döner', async () => {
    const res = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({
        patientId: 1,
        treatmentDate: '2026-07-20',
        treatmentType: 'Dolgu',
        cost: 5000,
      });

    expect(res.status).toBe(403);
    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO treatments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('POST /api/treatments — diş hekimi cost göndermezse normal şekilde oluşturabilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO treatments')) {
        return Promise.resolve({
          rows: [{ id: 1, dentist_id: 7, treatment_type: 'Dolgu' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({
        patientId: 1,
        treatmentDate: '2026-07-20',
        treatmentType: 'Dolgu',
      });

    expect(res.status).toBe(201);
  });

  it('POST /api/treatments — admin/sekreter cost gönderebilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO treatments')) {
        return Promise.resolve({
          rows: [{ id: 2, dentist_id: null, cost: '5000' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 1,
        treatmentDate: '2026-07-20',
        treatmentType: 'Dolgu',
        cost: 5000,
      });

    expect(res.status).toBe(201);
  });

  it('PUT /api/treatments/:id — diş hekimi cost değiştirmeye çalışırsa 403 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'in_progress', currency: 'TRY' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ cost: 9999 });

    expect(res.status).toBe(403);
    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('PUT /api/treatments/:id — cost açıkça null gönderilirse (WPF/JSON serileştirme) engellenmez', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'in_progress', currency: 'TRY' }],
        });
      }
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({ rows: [{ id: 9, dentist_id: 7 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ cost: null, currency: 'TRY', status: 'completed' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/treatments/:id — cost içermeyen bir currency değeri tek başına engellenmez (istemciler klinik not güncellerken sabit "TRY" gönderebiliyor)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'in_progress', currency: 'TRY' }],
        });
      }
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({ rows: [{ id: 9, dentist_id: 7 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ currency: 'TRY', procedureNotes: 'Kontrol gerekli' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/treatments/:id — diş hekimi kendi tedavisinin klinik notunu (cost hariç) değiştirebilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'in_progress' }],
        });
      }
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({
          rows: [{ id: 9, dentist_id: 7, procedure_notes: 'İyileşme normal' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ procedureNotes: 'İyileşme normal' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/treatments/:id — admin/sekreter cost değiştirebilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: null, status: 'in_progress' }],
        });
      }
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({ rows: [{ id: 9, cost: '3000' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ cost: 3000 });

    expect(res.status).toBe(200);
  });
});
