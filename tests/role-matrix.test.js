jest.mock('../src/db', () => ({
  pingDb: jest.fn(),
  query: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

function tokenFor(roles, sub = 1) {
  return jwt.sign(
    { sub, email: 'user@test.com', roles },
    process.env.JWT_SECRET,
  );
}

describe('Role matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pingDb.mockResolvedValue(true);
  });

  it('secretary can query dentist users list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            email: 'dentist@mail.com',
            roles: 'dentist',
            email_verified: true,
            last_login_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            first_name: 'Doc',
            last_name: 'Tor',
            phone: '000',
            tc_no: '111',
          },
        ],
      });

    const res = await request(app)
      .get('/api/users?limit=10&role=dentist')
      .set('Authorization', `Bearer ${tokenFor(['secretary'], 2)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users[0].roles).toContain('dentist');
  });

  it('secretary cannot query all users without role=dentist', async () => {
    const res = await request(app)
      .get('/api/users?limit=10')
      .set('Authorization', `Bearer ${tokenFor(['secretary'], 2)}`);

    expect(res.status).toBe(403);
  });

  it('dentist cannot access pending plans endpoint', async () => {
    const res = await request(app)
      .get('/api/payments/pending-plans')
      .set('Authorization', `Bearer ${tokenFor(['dentist'], 3)}`);

    expect(res.status).toBe(403);
  });

  it('admin can access pending plans endpoint', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/api/payments/pending-plans')
      .set('Authorization', `Bearer ${tokenFor(['admin'], 1)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });
});
