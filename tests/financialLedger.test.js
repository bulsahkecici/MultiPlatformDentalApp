jest.mock('../src/db', () => {
  const query = jest.fn();
  const withTransaction = jest.fn((fn) => fn({ query }));
  return { pingDb: jest.fn(), query, withTransaction };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

process.env.JWT_SECRET = 'test-secret';
process.env.HIGH_DISCOUNT_THRESHOLD_PERCENT = '20';

const { app } = require('../src/server');

function adminToken() {
  return jwt.sign(
    { sub: 1, email: 'admin@mail.com', roles: ['admin'], tokenType: 'access' },
    'test-secret',
    { expiresIn: '15m' },
  );
}

function secretaryToken(sub = 2) {
  return jwt.sign(
    {
      sub,
      email: `secretary${sub}@mail.com`,
      roles: ['secretary'],
      tokenType: 'access',
    },
    'test-secret',
    { expiresIn: '15m' },
  );
}

describe('POST /api/payments/discount — yüksek indirim onay eşiği', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('sekreter eşik altı (%10) indirimi hemen uygular', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'approved',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [{ id: 1, status: 'completed', amount: '100.00' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ treatmentPlanId: 30, discountPercentage: 10 });

    expect(res.status).toBe(200);
    expect(res.body.discount).toBe(100);

    const updateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE treatment_plans') &&
        sql.includes('total_estimated_cost'),
    );
    expect(updateCall).toBeDefined();

    // Plan zaten onaylanmış (status: 'approved') olduğu için hastanın asıl
    // borç bakiyesi de aynı miktarda düşmeli — sadece planın nominal
    // tutarı değil (canlı doğrulamada yakalanan gerçek bir tutarsızlıktı).
    const debtUpdateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE patient_debts') &&
        sql.includes('GREATEST(0, total_debt - $2)'),
    );
    expect(debtUpdateCall).toBeDefined();
    expect(debtUpdateCall[1]).toEqual([11, 100]);

    const txCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO financial_transactions'),
    );
    expect(txCall[1]).toEqual(
      expect.arrayContaining([
        11,
        'discount',
        100,
        'TRY',
        30,
        null,
        null,
        'completed',
      ]),
    );
  });

  it("plan hâlâ 'pending' durumundaysa (henüz borçlandırılmamış), indirim patient_debts'e dokunmaz", async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'pending',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [{ id: 1, status: 'completed', amount: '100.00' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ treatmentPlanId: 30, discountPercentage: 10 });

    expect(res.status).toBe(200);

    const debtUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE patient_debts'),
    );
    expect(debtUpdateCall).toBeUndefined();
  });

  it('sekreter eşik üstü (%30) indirimi gerekçesiz talep edemez (400)', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'approved',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ treatmentPlanId: 31, discountPercentage: 30 });

    expect(res.status).toBe(400);
    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatment_plans'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('sekreter eşik üstü (%30) indirimi gerekçeyle talep eder — plan hemen değişmez, pending_approval oluşur (202)', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'approved',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      if (
        sql.includes(
          "status = 'pending_approval' AND transaction_type = 'discount'",
        )
      ) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [{ id: 5, status: 'pending_approval', amount: '300.00' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({
        treatmentPlanId: 31,
        discountPercentage: 30,
        reason: 'Hasta ekonomik zorluk yaşıyor',
      });

    expect(res.status).toBe(202);
    expect(res.body.pending).toBe(true);

    const updateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatment_plans'),
    );
    expect(updateCall).toBeUndefined(); // plan hemen değişmemeli

    const txCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO financial_transactions'),
    );
    expect(txCall[1]).toEqual(
      expect.arrayContaining([
        11,
        'discount',
        300,
        'TRY',
        31,
        'pending_approval',
        'Hasta ekonomik zorluk yaşıyor',
      ]),
    );
  });

  it('aynı plan için zaten bekleyen bir talep varsa 409 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'approved',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      if (
        sql.includes(
          "status = 'pending_approval' AND transaction_type = 'discount'",
        )
      ) {
        return Promise.resolve({ rows: [{ id: 99 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({
        treatmentPlanId: 31,
        discountPercentage: 30,
        reason: 'Tekrar deneme',
      });

    expect(res.status).toBe(409);
  });

  it('patron (admin) eşik üstü indirimi de hemen uygulayabilir — onay gerekmez', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              patient_id: 11,
              status: 'approved',
              total_estimated_cost: '1000',
              currency: 'TRY',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [{ id: 6, status: 'completed', amount: '500.00' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ treatmentPlanId: 31, discountPercentage: 50 });

    expect(res.status).toBe(200);
    expect(res.body.discount).toBe(500);
  });

  it('hesaplanan indirim mevcut toplamı aşarsa 400 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, status, total_estimated_cost, currency FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            { patient_id: 11, total_estimated_cost: '100', currency: 'TRY' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ treatmentPlanId: 31, discountAmount: 500 });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/payments/:id/refund — ödeme iadesi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('patron iadeyi hemen uygular (completed) ve bakiyeyi günceller', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM payments WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 40, patient_id: 11, amount: '500.00' }],
        });
      }
      if (
        sql.includes("transaction_type = 'refund'") &&
        sql.includes('SUM(amount)')
      ) {
        return Promise.resolve({ rows: [{ total: '0' }] });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [
            { id: 7, patient_id: 11, amount: '500.00', status: 'completed' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/40/refund')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Yanlış tahsilat' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(false);

    const balanceCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('INSERT INTO patient_debts') &&
        sql.includes('GREATEST(0, patient_debts.paid_amount'),
    );
    expect(balanceCall).toBeDefined();
  });

  it('sekreter iade talebi oluşturur (pending_approval, 202) — bakiye hemen değişmez', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM payments WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 40, patient_id: 11, amount: '500.00' }],
        });
      }
      if (
        sql.includes("transaction_type = 'refund'") &&
        sql.includes('SUM(amount)')
      ) {
        return Promise.resolve({ rows: [{ total: '0' }] });
      }
      if (sql.includes('INSERT INTO financial_transactions')) {
        return Promise.resolve({
          rows: [
            {
              id: 8,
              patient_id: 11,
              amount: '500.00',
              status: 'pending_approval',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/40/refund')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({ reason: 'Hasta talep etti' });

    expect(res.status).toBe(202);
    expect(res.body.pending).toBe(true);

    const balanceCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO patient_debts'),
    );
    expect(balanceCall).toBeUndefined();
  });

  it('gerekçesiz iade talebi 400 döner', async () => {
    const res = await request(app)
      .post('/api/payments/40/refund')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('ödeme tutarını aşan iade talebi 400 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM payments WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 40, patient_id: 11, amount: '500.00' }],
        });
      }
      if (
        sql.includes("transaction_type = 'refund'") &&
        sql.includes('SUM(amount)')
      ) {
        return Promise.resolve({ rows: [{ total: '0' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/40/refund')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ amount: 999, reason: 'Test' });

    expect(res.status).toBe(400);
  });

  it('daha önce kısmen iade edilmiş bir ödemede kalan tutarı aşan talep 400 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM payments WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 40, patient_id: 11, amount: '500.00' }],
        });
      }
      if (
        sql.includes("transaction_type = 'refund'") &&
        sql.includes('SUM(amount)')
      ) {
        return Promise.resolve({ rows: [{ total: '400' }] }); // zaten 400 iade edilmiş/beklemede
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/40/refund')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ amount: 150, reason: 'Fazladan iade denemesi' });

    expect(res.status).toBe(400);
  });
});

describe('Onay kuyruğu — GET/approve/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('GET /api/payments/approvals/pending — bekleyen listeyi döner', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("WHERE ft.status = 'pending_approval'")) {
        return Promise.resolve({
          rows: [{ id: 5, transaction_type: 'discount', amount: '300.00' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/api/payments/approvals/pending')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.approvals).toHaveLength(1);
  });

  it('sekreter onay/red uç noktasına erişemez (403)', async () => {
    const res = await request(app)
      .post('/api/payments/approvals/5/approve')
      .set('Authorization', `Bearer ${secretaryToken()}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('POST /api/payments/approvals/:id/approve — bekleyen indirimi günceldeki plan toplamına göre uygular', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          "FROM financial_transactions WHERE id = $1 AND status = 'pending_approval'",
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 5,
              transaction_type: 'discount',
              treatment_plan_id: 31,
              amount: '300.00',
              patient_id: 11,
            },
          ],
        });
      }
      if (
        sql.includes(
          'SELECT status, total_estimated_cost FROM treatment_plans WHERE id = $1 FOR UPDATE',
        )
      ) {
        return Promise.resolve({
          rows: [{ status: 'approved', total_estimated_cost: '1000' }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approvals/5/approve')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);

    const planUpdateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE treatment_plans') &&
        sql.includes('total_estimated_cost = total_estimated_cost - $1'),
    );
    expect(planUpdateCall[1]).toEqual([300, 31]);

    const debtUpdateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE patient_debts') &&
        sql.includes('GREATEST(0, total_debt - $2)'),
    );
    expect(debtUpdateCall).toBeDefined();
    expect(debtUpdateCall[1]).toEqual([11, 300]);

    const txUpdateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE financial_transactions') &&
        sql.includes("status = 'completed'"),
    );
    expect(txUpdateCall).toBeDefined();
  });

  it('POST /api/payments/approvals/:id/approve — bekleyen iadeyi uygular ve bakiyeyi günceller', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          "FROM financial_transactions WHERE id = $1 AND status = 'pending_approval'",
        )
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 8,
              transaction_type: 'refund',
              payment_id: 40,
              amount: '500.00',
              patient_id: 11,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approvals/8/approve')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);

    const balanceCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO patient_debts'),
    );
    expect(balanceCall).toBeDefined();
  });

  it('POST /api/payments/approvals/:id/reject — hiçbir bakiye/plan etkisi olmadan reddeder', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes("SET status = 'rejected'")) {
        return Promise.resolve({ rows: [{ id: 5, status: 'rejected' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/approvals/5/reject')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Yetersiz gerekçe' });

    expect(res.status).toBe(200);

    const planUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE treatment_plans'),
    );
    expect(planUpdateCall).toBeUndefined();
  });

  it('artık pending olmayan bir işlemi onaylamaya çalışmak 404 döner', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/api/payments/approvals/999/approve')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe('POST /api/payments/process — ödeme, gönderilen plana ait olmayan bir hastaya yazdırılamaz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('treatmentPlanId var olmayan bir plana işaret ederse 404 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, dentist_id, total_estimated_cost FROM treatment_plans',
        )
      ) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 11,
        amount: 100,
        paymentMethod: 'cash',
        treatmentPlanId: 999,
      });

    expect(res.status).toBe(404);
    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();
  });

  it('treatmentPlanId başka bir hastaya aitse 400 döner, ödeme kaydedilmez ve audit loglanır', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, dentist_id, total_estimated_cost FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            { patient_id: 99, dentist_id: null, total_estimated_cost: '500' },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 11,
        amount: 100,
        paymentMethod: 'cash',
        treatmentPlanId: 5,
      });

    expect(res.status).toBe(400);

    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeUndefined();

    const auditCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO audit_logs'),
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1]).toEqual(
      expect.arrayContaining(['unauthorized_access']),
    );
  });

  it('treatmentPlanId gerçekten o hastaya aitse ödeme normal şekilde işlenir', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes(
          'SELECT patient_id, dentist_id, total_estimated_cost FROM treatment_plans',
        )
      ) {
        return Promise.resolve({
          rows: [
            { patient_id: 11, dentist_id: 24, total_estimated_cost: '500' },
          ],
        });
      }
      if (sql.includes('SELECT commission_rate FROM users')) {
        return Promise.resolve({ rows: [{ commission_rate: '10' }] });
      }
      if (sql.includes('INSERT INTO payments')) {
        return Promise.resolve({
          rows: [{ id: 50, patient_id: 11, amount: '100.00', dentist_id: 24 }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        patientId: 11,
        amount: 100,
        paymentMethod: 'cash',
        treatmentPlanId: 5,
      });

    expect(res.status).toBe(201);
    const insertCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO payments'),
    );
    expect(insertCall).toBeDefined();
  });
});

describe('POST /api/payments/plans/:id/cancel — onaylanmış planın iptalinde borç ters kayıtla düşer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('gerekçesiz istek 400 döner', async () => {
    const res = await request(app)
      .post('/api/payments/plans/4/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('var olmayan plan 404 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT * FROM treatment_plans WHERE id = $1 FOR UPDATE')
      ) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/plans/999/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Test' });

    expect(res.status).toBe(404);
  });

  it("hâlâ 'pending' durumundaki bir planı bu yoldan iptal etmeye çalışmak 409 döner", async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT * FROM treatment_plans WHERE id = $1 FOR UPDATE')
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 4,
              status: 'pending',
              patient_id: 11,
              total_estimated_cost: '1000',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/plans/4/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Yanlış deneme' });

    expect(res.status).toBe(409);

    const debtUpdateCall = db.query.mock.calls.find(([sql]) =>
      sql.includes('UPDATE patient_debts'),
    );
    expect(debtUpdateCall).toBeUndefined();
  });

  it("onaylanmış (status='approved') bir planı iptal eder, borcu ters kayıtla düşürür ve reversal hareketi ekler", async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT * FROM treatment_plans WHERE id = $1 FOR UPDATE')
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 4,
              status: 'approved',
              patient_id: 11,
              dentist_id: 24,
              total_estimated_cost: '700',
              title: 'LEDGER-TEST-PLAN-1',
            },
          ],
        });
      }
      if (
        sql.includes('UPDATE treatment_plans') &&
        sql.includes("status = 'cancelled'")
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 4,
              status: 'cancelled',
              patient_id: 11,
              dentist_id: 24,
              title: 'LEDGER-TEST-PLAN-1',
            },
          ],
        });
      }
      if (
        sql.includes("transaction_type = 'charge'") &&
        sql.includes('ORDER BY created_at DESC')
      ) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/plans/4/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Hasta tedaviden vazgeçti' });

    expect(res.status).toBe(200);

    const debtUpdateCall = db.query.mock.calls.find(
      ([sql]) =>
        sql.includes('UPDATE patient_debts') &&
        sql.includes('GREATEST(0, total_debt - $2)'),
    );
    expect(debtUpdateCall).toBeDefined();
    expect(debtUpdateCall[1]).toEqual([11, 700]);

    const reversalCall = db.query.mock.calls.find(
      ([sql, params]) =>
        sql.includes('INSERT INTO financial_transactions') &&
        params?.includes('reversal'),
    );
    expect(reversalCall).toBeDefined();
    expect(reversalCall[1]).toEqual(
      expect.arrayContaining([11, 'reversal', 700, 'TRY', 4, 1, 'completed']),
    );
  });

  it('zaten iptal edilmiş bir planı tekrar iptal etmeye çalışmak 409 döner', async () => {
    db.query.mockImplementation((sql) => {
      if (
        sql.includes('SELECT * FROM treatment_plans WHERE id = $1 FOR UPDATE')
      ) {
        return Promise.resolve({
          rows: [
            {
              id: 4,
              status: 'cancelled',
              patient_id: 11,
              total_estimated_cost: '700',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/api/payments/plans/4/cancel')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Tekrar deneme' });

    expect(res.status).toBe(409);
  });
});
