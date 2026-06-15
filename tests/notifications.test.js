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

describe('Notifications API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pingDb.mockResolvedValue(true);
  });

  it('returns user notifications', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          user_id: 1,
          type: 'appointment',
          title: 'Yeni Randevu',
          message: 'Test',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor(['admin'], 1)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications[0].title).toBe('Yeni Randevu');
  });

  it('returns unread count', async () => {
    db.query.mockResolvedValue({ rows: [{ count: '3' }] });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenFor(['secretary'], 2)}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
