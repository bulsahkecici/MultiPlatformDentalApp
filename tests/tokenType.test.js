jest.mock('../src/db', () => {
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';
// JWT_REFRESH_SECRET bilerek tanımsız bırakılıyor — asıl korumanın
// (tokenType claim'i) secret'lar aynı olsa bile çalıştığını doğrular.
delete process.env.JWT_REFRESH_SECRET;

const { app } = require('../src/server');

describe('Access/refresh token ayrımı (tokenType claim)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation((sql) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '0' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  });

  it('refresh token ile imzalanmış bir JWT, korumalı bir API rotasında Bearer olarak kabul edilmez', async () => {
    const refreshLikeToken = jwt.sign(
      {
        sub: 1,
        email: 'admin@mail.com',
        roles: ['admin'],
        tokenType: 'refresh',
      },
      'test-secret',
      { expiresIn: '7d' },
    );

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${refreshLikeToken}`);

    expect(res.status).toBe(401);
  });

  it("tokenType claim'i olmayan eski biçimli bir token da reddedilir", async () => {
    const legacyToken = jwt.sign(
      { sub: 1, email: 'admin@mail.com', roles: ['admin'] },
      'test-secret',
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${legacyToken}`);

    expect(res.status).toBe(401);
  });

  it('access token doğru şekilde kabul edilir', async () => {
    const accessToken = jwt.sign(
      {
        sub: 1,
        email: 'admin@mail.com',
        roles: ['admin'],
        tokenType: 'access',
      },
      'test-secret',
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('POST /api/auth/login sonrası dönen accessToken bir sonraki istekte kabul edilir', async () => {
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync('Admin@123456', 10);

    db.query.mockImplementation((sql) => {
      if (sql.includes('failed_login_attempts')) {
        return Promise.resolve({
          rows: [{ failed_login_attempts: 0, account_locked_until: null }],
        });
      }
      if (sql.includes('password_hash')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              email: 'admin@mail.com',
              password_hash: passwordHash,
              roles: 'admin',
              email_verified: true,
              deleted_at: null,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mail.com', password: 'Admin@123456' });

    expect(loginRes.status).toBe(200);

    db.query.mockImplementation((sql) => {
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '0' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const apiRes = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(apiRes.status).toBe(200);

    // refreshToken login yanıtında döner ama Bearer olarak kabul edilmemeli
    const misuseRes = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${loginRes.body.refreshToken}`);

    expect(misuseRes.status).toBe(401);
  });
});
