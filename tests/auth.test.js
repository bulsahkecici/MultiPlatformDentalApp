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
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          email: 'admin@mail.com',
          password_hash: passwordHash,
          roles: 'admin',
        },
      ],
    });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'admin@mail.com', password: '123456' });

    expect(db.query).toHaveBeenCalledWith(
      'SELECT id, email, password_hash, roles FROM users WHERE email = $1',
      ['admin@mail.com'],
    );
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

