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

describe('POST /api/payments — tutar ve yöntem doğrulaması', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('negatif tutar 400 ile reddedilir ve hiçbir INSERT çalışmaz', async () => {
    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ patientId: 1, amount: -500, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('sıfır tutar 400 ile reddedilir', async () => {
    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ patientId: 1, amount: 0, paymentMethod: 'cash' });

    expect(res.status).toBe(400);
  });

  it('sayısal olmayan tutar (string "abc") 400 ile reddedilir', async () => {
    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ patientId: 1, amount: 'abc', paymentMethod: 'cash' });

    expect(res.status).toBe(400);
  });

  it('geçersiz ödeme yöntemi 400 ile reddedilir', async () => {
    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ patientId: 1, amount: 100, paymentMethod: 'bitcoin' });

    expect(res.status).toBe(400);
  });

  it('geçerli pozitif tutar ve yöntem kabul edilir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT INTO payments')) {
        return Promise.resolve({
          rows: [
            { id: 1, patient_id: 1, amount: '100.00', payment_method: 'cash' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ patientId: 1, amount: 100, paymentMethod: 'cash' });

    expect(res.status).toBe(201);

    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO payments'),
    );
    expect(insertCall[1][2]).toBe(100); // numericAmount parametre olarak geçmiş
  });
});
