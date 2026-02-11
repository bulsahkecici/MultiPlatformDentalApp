jest.mock('../src/db', () => ({
  pingDb: jest.fn(),
  query: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const request = require('supertest');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

describe('Auth login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pingDb.mockResolvedValue(true);
  });

  it('returns a JWT for the seeded admin user', async () => {
    const passwordHash = bcrypt.hashSync('123456', 10);
    db.query
      // checkAccountLock
      .mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 0, account_locked_until: null }],
      })
      // get user
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: 'admin@mail.com',
            password_hash: passwordHash,
            roles: 'admin',
            email_verified: true,
            deleted_at: null,
            last_login_at: null,
            first_name: 'Admin',
            last_name: 'User',
            phone: '',
            tc_no: '',
            created_at: new Date().toISOString(),
          },
        ],
      })
      // resetFailedAttempts
      .mockResolvedValueOnce({ rows: [] })
      // update last login
      .mockResolvedValueOnce({ rows: [] })
      // store refresh token
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // audit login success
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@mail.com', password: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
  });
});

