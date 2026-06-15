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

describe('Invoices and discounts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pingDb.mockResolvedValue(true);
  });

  it('admin can list discounts', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: 'Genel %10',
          discount_type: 'percentage',
          discount_value: 10,
          is_active: true,
        },
      ],
    });

    const res = await request(app)
      .get('/api/discounts')
      .set('Authorization', `Bearer ${tokenFor(['admin'], 1)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.discounts)).toBe(true);
    expect(res.body.discounts[0].name).toBe('Genel %10');
  });

  it('dentist cannot list discounts', async () => {
    const res = await request(app)
      .get('/api/discounts')
      .set('Authorization', `Bearer ${tokenFor(['dentist'], 3)}`);

    expect(res.status).toBe(403);
  });

  it('secretary can create discount', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 2,
          name: 'Yeni İndirim',
          discount_type: 'percentage',
          discount_value: 15,
          is_active: true,
        },
      ],
    });

    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${tokenFor(['secretary'], 2)}`)
      .send({
        name: 'Yeni İndirim',
        discountType: 'percentage',
        discountValue: 15,
      });

    expect(res.status).toBe(201);
    expect(res.body.discount.name).toBe('Yeni İndirim');
  });

  it('admin can list invoices', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            patient_id: 1,
            invoice_number: 'INV-001',
            total: 1000,
            status: 'pending',
            patient_first_name: 'Ali',
            patient_last_name: 'Veli',
          },
        ],
      });

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor(['admin'], 1)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invoices)).toBe(true);
    expect(res.body.invoices[0].invoice_number).toBe('INV-001');
  });

  it('dentist cannot list invoices', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor(['dentist'], 3)}`);

    expect(res.status).toBe(403);
  });

  it('admin statistics includes dentist turnovers', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ total: '5000' }] })
      .mockResolvedValueOnce({ rows: [{ total: '8000' }] })
      .mockResolvedValueOnce({ rows: [{ count: '15' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({
        rows: [{ count: '100', completed: '80', cancelled: '5' }],
      })
      .mockResolvedValueOnce({
        rows: [{ count: '50', total_revenue: '25000' }],
      })
      .mockResolvedValueOnce({
        rows: [{ count: '10', total_revenue: '12000', paid_revenue: '8000' }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            dentist_id: 3,
            first_name: 'Dr',
            last_name: 'Can',
            email: 'dentist@mail.com',
            turnover: '5000',
            treatment_count: '10',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total_paid: '8000' }] })
      .mockResolvedValueOnce({ rows: [{ total_debt: '2000' }] });

    const res = await request(app)
      .get('/api/admin/statistics')
      .set('Authorization', `Bearer ${tokenFor(['admin'], 1)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statistics.dentistTurnovers)).toBe(true);
    expect(res.body.statistics.dentistTurnovers[0].turnover).toBe(5000);
  });
});
