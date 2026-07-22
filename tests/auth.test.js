jest.mock('../src/db', () => ({
  pingDb: jest.fn(),
  query: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const request = require('supertest');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

describe('Auth login (POST /api/auth/login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pingDb.mockResolvedValue(true);
    // Varsayılan: bilinmeyen sorgular boş sonuç döner (audit log, update vb.)
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('geçerli kimlik bilgileriyle access+refresh token ve kullanıcı döner', async () => {
    const passwordHash = bcrypt.hashSync('Admin@123456', 10);

    db.query.mockImplementation((sql) => {
      if (sql.includes('failed_login_attempts')) {
        // checkAccountLock — kilit yok
        return Promise.resolve({
          rows: [{ failed_login_attempts: 0, account_locked_until: null }],
        });
      }
      if (sql.includes('password_hash')) {
        // Kullanıcı sorgusu
        return Promise.resolve({
          rows: [
            {
              id: 1,
              email: 'admin@mail.com',
              password_hash: passwordHash,
              roles: 'admin',
              email_verified: true,
              deleted_at: null,
              first_name: 'Admin',
              last_name: 'User',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  Admin@MAIL.COM ', password: 'Admin@123456' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toMatchObject({
      id: 1,
      email: 'admin@mail.com',
      roles: ['admin'],
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM users WHERE email = $1'),
      ['admin@mail.com'],
    );
  });

  it('yanlış şifrede 401 döner', async () => {
    const passwordHash = bcrypt.hashSync('DogruSifre1!', 10);

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

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mail.com', password: 'YanlisSifre1!' });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('bilinmeyen kullanıcıda 401 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('failed_login_attempts')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'yok@mail.com', password: 'Birsey1!' });

    expect(res.status).toBe(401);
  });
});
