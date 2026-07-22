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

describe('DELETE /api/treatments/:id — void talep/onay akışı (D2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('sekreter void talebi oluşturur (202), hard/soft void hemen uygulanmaz', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, void_status FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, void_status: null }],
        });
      }
      if (sql.includes("SET void_status = 'pending'")) {
        return Promise.resolve({ rows: [{ id: 9 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ reason: 'Yanlış hastaya girilmiş' });

    expect(res.status).toBe(202);
    expect(res.body.pending).toBe(true);

    const deletedAtCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('deleted_at = NOW()'),
    );
    expect(deletedAtCall).toBeUndefined();
  });

  it('dişhekimi başka bir doktorun tedavisi için void talebi açamaz (403)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, void_status FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 99, void_status: null }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ reason: 'Hatalı kayıt' });

    expect(res.status).toBe(403);
  });

  it('dişhekimi kendi tedavisi için void talebi açabilir (202)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, void_status FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, void_status: null }],
        });
      }
      if (sql.includes("SET void_status = 'pending'")) {
        return Promise.resolve({ rows: [{ id: 9 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${dentistToken(7)}`)
      .send({ reason: 'Hatalı kayıt' });

    expect(res.status).toBe(202);
  });

  it('admin voidu anında uygular (204) — bu hâlâ bir soft void, hard delete değil', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, void_status FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, void_status: null }],
        });
      }
      if (sql.includes('deleted_at = NOW()')) {
        return Promise.resolve({ rows: [{ id: 9 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Acil düzeltme' });

    expect(res.status).toBe(204);

    const hardDeleteCall = db.query.mock.calls.find(([sql]) =>
      sql.trim().startsWith('DELETE FROM treatments'),
    );
    expect(hardDeleteCall).toBeUndefined();
  });

  it('zaten bekleyen bir void talebi varken ikinci talep 409 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT dentist_id, void_status FROM treatments')) {
        return Promise.resolve({
          rows: [{ dentist_id: 7, void_status: 'pending' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .delete('/api/treatments/9')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ reason: 'Tekrar deneme' });

    expect(res.status).toBe(409);
  });
});

describe('GET/POST void-requests — patron onay/red akışı', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('sekreter/dişhekimi onay kuyruğunu göremez (403)', async () => {
    const res = await request(app)
      .get('/api/treatments/void-requests/pending')
      .set('Authorization', `Bearer ${secretaryToken()}`);
    expect(res.status).toBe(403);
  });

  it('admin bekleyen void taleplerini listeleyebilir', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 9, void_request_reason: 'x' }] });
    const res = await request(app)
      .get('/api/treatments/void-requests/pending')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
  });

  it('admin bekleyen talebi onaylarsa tedavi gerçekten void olur', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("void_status = 'pending' AND deleted_at IS NULL")) {
        return Promise.resolve({
          rows: [{ id: 9, void_requested_by: 7, void_request_reason: 'x' }],
        });
      }
      if (sql.includes('deleted_at = NOW()')) {
        return Promise.resolve({
          rows: [{ id: 9, void_requested_by: 7, void_status: 'approved' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/treatments/9/void-decision')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);
  });

  it('admin talebi reddederse gerekçe zorunludur ve tedavi void olmaz', async () => {
    const res = await request(app)
      .post('/api/treatments/9/void-decision')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: false });

    expect(res.status).toBe(400);
    const deletedAtCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('deleted_at = NOW()'),
    );
    expect(deletedAtCall).toBeUndefined();
  });
});
