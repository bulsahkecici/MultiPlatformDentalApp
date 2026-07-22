jest.mock('../src/db', () => {
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

function accessToken(sub = 7) {
  return jwt.sign(
    { sub, email: 'user@mail.com', roles: ['dentist'], tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('Şifre değişiminde oturum iptali', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('kullanıcı şifresini değiştirince tüm refresh tokenları silinir', async () => {
    const oldHash = bcrypt.hashSync('EskiSifre1!', 10);
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT id, password_hash FROM users')) {
        return Promise.resolve({ rows: [{ id: 7, password_hash: oldHash }] });
      }
      if (sql.includes('SELECT password_hash FROM password_history')) {
        return Promise.resolve({ rows: [{ password_hash: oldHash }] });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    const res = await request(app)
      .put('/api/users/7/password')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ currentPassword: 'EskiSifre1!', newPassword: 'YeniSifre2!' });

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [7],
    );
  });

  it('reset tokenıyla şifre sıfırlanınca tüm refresh tokenları silinir', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('WHERE password_reset_token = $1')) {
        return Promise.resolve({ rows: [{ id: 8, email: 'reset@mail.com' }] });
      }
      if (sql.includes('SELECT password_hash FROM password_history')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-reset-token', newPassword: 'YeniSifre2!' });

    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [8],
    );
  });
});
