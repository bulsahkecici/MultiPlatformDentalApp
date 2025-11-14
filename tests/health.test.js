jest.mock('../src/db', () => ({
  pingDb: jest.fn(),
  query: jest.fn(),
}));

const request = require('supertest');
const db = require('../src/db');
const { app } = require('../src/server');

describe('Health endpoints', () => {
  beforeEach(() => {
    db.pingDb.mockResolvedValue(true);
  });

  it('GET /healthz should return 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /readyz should return 200 when DB ok', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('GET /readyz should return 503 when DB fails', async () => {
    db.pingDb.mockResolvedValueOnce(false);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready' });
  });
});
