const {
  normalizeEmail,
  parsePagePagination,
  parseOffsetPagination,
} = require('../src/utils/inputValidation');

jest.mock('../src/db', () => {
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
const { app } = require('../src/server');

function accessToken() {
  return jwt.sign(
    { sub: 1, email: 'admin@mail.com', roles: ['admin'], tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('Ortak giriş doğrulaması', () => {
  it('hesap e-postasını trim edip lowercase yapar', () => {
    expect(normalizeEmail('  User.Name@Example.COM ')).toBe(
      'user.name@example.com',
    );
  });

  it('sayfa parametrelerini güvenli sınırlarda ayrıştırır', () => {
    expect(parsePagePagination({ page: '3', limit: '25' })).toEqual({
      page: 3,
      limit: 25,
      offset: 50,
    });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ limit: 'abc' }, 'limit'],
  ])('geçersiz page/limit değerini reddeder: %j', (query, field) => {
    expect(() => parsePagePagination(query)).toThrow(field);
  });

  it('bildirim offsetini sınırlar', () => {
    expect(() => parseOffsetPagination({ offset: '-1' })).toThrow('offset');
    expect(() => parseOffsetPagination({ limit: '1000' })).toThrow('limit');
  });

  it('liste endpointi sınırı aşan limit için 400 döner', async () => {
    const res = await request(app)
      .get('/api/appointments?limit=101')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('limit');
  });
});
