const request = require('supertest');
const { app } = require('../src/server');

jest.mock('../src/db', () => require('../src/routes/__mocks__/db.mock'));

describe('Health endpoints', () => {
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
});
