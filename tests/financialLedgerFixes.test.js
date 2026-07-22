jest.mock('../src/db', () => {
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/server');

function adminToken() {
  return jwt.sign(
    { sub: 1, email: 'admin@mail.com', roles: ['admin'], tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('GET /api/payments/total-income — ledger bazlı net tahsilat (D4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('brüt ödemeden tamamlanmış iadeler düşülerek net gelir döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('FROM financial_transactions')) {
        return Promise.resolve({
          rows: [{ gross_payments: '10000', total_refunds: '1500' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/payments/total-income')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(8500);
    expect(res.body.grossPayments).toBe(10000);
    expect(res.body.totalRefunds).toBe(1500);
  });
});

describe('POST /api/payments/approve-plan/:id — manuel indirim onayda kaybolmaz (D8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('pending planda uygulanmış manuel indirim, kurum indirimli toplamdan düşülür', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [{ id: 1, treatment_type: 'Dolgu', cost: '1000' }],
        });
      }
      if (sql.includes('SELECT manual_discount_amount FROM treatment_plans')) {
        // Plan pending iken 200 TL manuel indirim uygulanmıştı
        return Promise.resolve({ rows: [{ manual_discount_amount: '200' }] });
      }
      if (sql.includes('institution_agreements')) {
        return Promise.resolve({ rows: [] }); // kurum anlaşması yok
      }
      if (sql.includes('category_name, discount_percentage')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('UPDATE treatment_plans') &&
        sql.includes('SET status = $1')
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 5,
              patient_id: 1,
              dentist_id: null,
              total_estimated_cost: '800',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/5')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);

    const updateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE treatment_plans') &&
        sql.includes('SET status = $1'),
    );
    expect(updateCall).toBeDefined();
    // item cost 1000 (kurum indirimi yok) - 200 manuel indirim = 800
    expect(updateCall[1][1]).toBe(800);
  });
});
