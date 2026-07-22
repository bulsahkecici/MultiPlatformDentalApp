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

function token(roles, sub) {
  return jwt.sign(
    { sub, email: `u${sub}@mail.com`, roles, tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}
const adminToken = () => token(['admin'], 1);
const secretaryToken = () => token(['secretary'], 2);
const dentistToken = (sub) => token(['dentist'], sub);

describe('PUT /api/treatments/:id — tamamlanmış tedavi klinik olarak salt okunur (D3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('tamamlanmış tedavinin tanısını doğrudan PUT ile değiştirmek 409 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'completed', currency: 'TRY' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ diagnosis: 'Yeni tanı' });

    expect(res.status).toBe(409);
    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatments'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('tamamlanmış tedavide cost admin/sekreter tarafından hâlâ PUT ile değiştirilebilir (finansal alan klinik revizyondan bağımsız)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, status, currency FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, status: 'completed', currency: 'TRY' }],
        });
      }
      if (sql.includes('UPDATE treatments')) {
        return Promise.resolve({ rows: [{ id: 9, cost: '2000' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .put('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ cost: 2000 });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/treatments/:id/amend — revizyon akışı (D3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('gerekçesiz amendment 400 döner', async () => {
    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ changes: { diagnosis: 'Yeni tanı' } });

    expect(res.status).toBe(400);
  });

  it('sekreter tamamlanmış tedaviyi amend edemez (403)', async () => {
    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ changes: { diagnosis: 'Yeni tanı' }, reason: 'Düzeltme' });

    expect(res.status).toBe(403);
  });

  it('başka doktorun tedavisini dişhekimi amend edemez (403)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 9, dentist_id: 99, status: 'completed', diagnosis: 'Eski' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ changes: { diagnosis: 'Yeni tanı' }, reason: 'Düzeltme' });

    expect(res.status).toBe(403);
  });

  it('tamamlanmamış (ör. planned) bir tedavi amend edilemez — normal PUT kullanılmalı', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 9, dentist_id: 7, status: 'planned', diagnosis: 'Eski' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ changes: { diagnosis: 'Yeni tanı' }, reason: 'Düzeltme' });

    expect(res.status).toBe(400);
  });

  it('dişhekimi kendi tamamlanmış tedavisini amend edebilir ve revizyon kaydı oluşturulur', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [
            {
              id: 9,
              dentist_id: 7,
              status: 'completed',
              diagnosis: 'Eski tanı',
              treatment_type: 'Dolgu',
            },
          ],
        });
      }
      if (sql.includes('COALESCE(MAX(revision_number)')) {
        return Promise.resolve({ rows: [{ next: 1 }] });
      }
      if (sql.includes('INSERT INTO treatment_revisions')) {
        return Promise.resolve({ rows: [{}] });
      }
      if (sql.includes('UPDATE treatments SET')) {
        return Promise.resolve({
          rows: [{ id: 9, diagnosis: 'Yeni tanı' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ changes: { diagnosis: 'Yeni tanı' }, reason: 'Hasta ek şikayet bildirdi' });

    expect(res.status).toBe(200);
    expect(res.body.revisionNumber).toBe(1);

    const revisionInsert = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO treatment_revisions'),
    );
    expect(revisionInsert).toBeDefined();
    expect(revisionInsert[1]).toContain('diagnosis');
  });

  it('status alanını (yeniden açma) yalnızca admin değiştirebilir, dişhekimi değiştiremez', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 9, dentist_id: 7, status: 'completed' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ changes: { status: 'planned' }, reason: 'Yeniden aç' });

    expect(res.status).toBe(400);
  });

  it('değişmeyen bir değer gönderilirse (no-op) 400 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 9, dentist_id: 7, status: 'completed', diagnosis: 'Aynı tanı' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/amend')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ changes: { diagnosis: 'Aynı tanı' }, reason: 'Deneme' });

    expect(res.status).toBe(400);
  });
});
