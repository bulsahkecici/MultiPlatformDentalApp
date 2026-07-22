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

function token(roles, sub = 4) {
  return jwt.sign(
    { sub, email: `u${sub}@mail.com`, roles, tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('Hasta klinik veri güvenliği', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('sekreter anamnez verisiyle hasta oluşturamaz', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token(['secretary'])}`)
      .send({ firstName: 'Ayşe', lastName: 'Yılmaz', allergies: 'Penisilin' });

    expect(res.status).toBe(403);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('sekreter hasta detayında klinik alanları göremez', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 8,
            first_name: 'Ayşe',
            allergies: 'Penisilin',
            critical_alerts: 'Anafilaksi',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/patients/8')
      .set('Authorization', `Bearer ${token(['secretary'])}`);

    expect(res.status).toBe(200);
    expect(res.body.patient.allergies).toBeNull();
    expect(res.body.patient.critical_alerts).toBeNull();
    expect(res.body.patient.clinical_access).toBe(false);
  });

  it('diş hekimi anamnez değişikliğinde gerekçe vermek zorundadır', async () => {
    const res = await request(app)
      .put('/api/patients/8')
      .set('Authorization', `Bearer ${token(['dentist'], 7)}`)
      .send({ allergies: 'Lateks' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('reason');
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it('aynı kimlik numarasıyla ikinci aktif hasta açılamaz', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 9, protocol_number: 'P-2026-000009' }],
    });

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token(['secretary'])}`)
      .send({
        firstName: 'Ali',
        lastName: 'Kaya',
        identityType: 'tc',
        identityNumber: '10000000146',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('identity');
  });
});
