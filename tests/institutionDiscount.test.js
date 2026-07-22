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

describe('POST /api/payments/approve-plan/:id — kurum/kategori indirimi faturaya yansır', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('%20 genel kurum indirimli hasta — plan 1000 TL yerine 800 TL borçlandırılır', async () => {
    db.query.mockImplementation((sql, params) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [{ id: 1, treatment_type: 'Dolgu', cost: '1000' }],
        });
      }
      if (sql.includes('JOIN institution_agreements')) {
        return Promise.resolve({
          rows: [{ id: 7, discount_percentage: '20' }],
        });
      }
      if (sql.includes('FROM institution_agreement_category_discounts')) {
        return Promise.resolve({ rows: [] }); // kategori indirimi tanımlı değil
      }
      if (sql.includes("WHERE id = $3 AND status = 'pending'")) {
        return Promise.resolve({
          rows: [
            { id: 30, patient_id: 9, dentist_id: null, status: 'approved' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/30')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);

    const planUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes("WHERE id = $3 AND status = 'pending'"),
    );
    // total_estimated_cost = 1000 * (1 - 20/100) = 800
    expect(planUpdateCall[1][1]).toBe(800);

    const debtCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO patient_debts'),
    );
    expect(debtCall[1]).toEqual([9, 800]);

    const itemSnapshotCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE treatment_plan_items') &&
        sql.includes('discount_percentage'),
    );
    expect(itemSnapshotCall[1]).toEqual([20, 800, 1]);
  });

  it('kategori bazlı indirim genel orandan önceliklidir (implant %40 > genel %10)', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [
            { id: 1, treatment_type: 'İmplant', cost: '1000' },
            { id: 2, treatment_type: 'Dolgu', cost: '200' },
          ],
        });
      }
      if (sql.includes('JOIN institution_agreements')) {
        return Promise.resolve({
          rows: [{ id: 7, discount_percentage: '10' }],
        });
      }
      if (sql.includes('FROM institution_agreement_category_discounts')) {
        return Promise.resolve({
          rows: [{ category_name: 'İmplant', discount_percentage: '40' }],
        });
      }
      if (sql.includes("WHERE id = $3 AND status = 'pending'")) {
        return Promise.resolve({
          rows: [
            { id: 31, patient_id: 11, dentist_id: null, status: 'approved' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/31')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);

    // İmplant: 1000 * 0.6 = 600, Dolgu: 200 * 0.9 = 180 → toplam 780
    const planUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes("WHERE id = $3 AND status = 'pending'"),
    );
    expect(planUpdateCall[1][1]).toBe(780);
  });

  it('hasta bir kuruma bağlı değilse (veya anlaşma pasifse) tam liste fiyatı üzerinden borçlandırılır', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT id, treatment_type, cost FROM treatment_plan_items',
        )
      ) {
        return Promise.resolve({
          rows: [{ id: 1, treatment_type: 'Dolgu', cost: '350' }],
        });
      }
      if (sql.includes('JOIN institution_agreements')) {
        return Promise.resolve({ rows: [] }); // kuruma bağlı değil / anlaşma pasif
      }
      if (sql.includes("WHERE id = $3 AND status = 'pending'")) {
        return Promise.resolve({
          rows: [
            { id: 32, patient_id: 12, dentist_id: null, status: 'approved' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approve-plan/32')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });

    expect(res.status).toBe(200);

    const planUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes("WHERE id = $3 AND status = 'pending'"),
    );
    expect(planUpdateCall[1][1]).toBe(350);
  });
});
