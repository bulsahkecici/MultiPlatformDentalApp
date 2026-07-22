const request = require('supertest');
const { pool, resetDatabase, createUser, createPatient } = require('./dbHelper');
const { app } = require('../../src/server');

async function createApprovedPlan(app, admin, patient, dentist, items) {
  const created = await request(app)
    .post('/api/treatment-plans')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({
      patientId: patient.id,
      dentistId: dentist ? dentist.id : undefined,
      title: 'Plan',
      items,
    });
  const planId = created.body.plan.id;
  const approved = await request(app)
    .post(`/api/payments/approve-plan/${planId}`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ approved: true });
  return { planId, approved };
}

describe('Finansal bütünlük (gerçek PostgreSQL)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('plan onayı tahakkuk (charge) hareketi + patient_debts günceller', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const { planId, approved } = await createApprovedPlan(app, admin, patient, null, [
      { toothNumber: '11', treatmentType: 'Dolgu', cost: 1000 },
      { toothNumber: '12', treatmentType: 'Kanal', cost: 2000 },
    ]);
    expect(approved.status).toBe(200);
    expect(parseFloat(approved.body.plan.total_estimated_cost)).toBe(3000);

    const debt = await pool.query(
      'SELECT * FROM patient_debts WHERE patient_id = $1',
      [patient.id],
    );
    expect(parseFloat(debt.rows[0].total_debt)).toBe(3000);
    expect(parseFloat(debt.rows[0].remaining_debt)).toBe(3000);

    const charge = await pool.query(
      `SELECT * FROM financial_transactions WHERE treatment_plan_id = $1 AND transaction_type = 'charge'`,
      [planId],
    );
    expect(charge.rows).toHaveLength(1);
    expect(parseFloat(charge.rows[0].amount)).toBe(3000);
  });

  it('kurum genel indirimi onayda kaleme uygulanır', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const agreement = await pool.query(
      `INSERT INTO institution_agreements (institution_name, discount_percentage, is_active, created_at, updated_at)
       VALUES ('ACME', 10, true, NOW(), NOW()) RETURNING id`,
    );
    const patient = await createPatient({
      institutionAgreementId: agreement.rows[0].id,
    });

    const { approved } = await createApprovedPlan(app, admin, patient, null, [
      { toothNumber: '11', treatmentType: 'Dolgu', cost: 1000 },
    ]);
    expect(approved.status).toBe(200);
    // %10 indirim: 1000 -> 900
    expect(parseFloat(approved.body.plan.total_estimated_cost)).toBe(900);
  });

  it('bekleyen planda uygulanan manuel indirim onayda kaybolmaz', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const created = await request(app)
      .post('/api/treatment-plans')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        title: 'Plan',
        items: [{ toothNumber: '11', treatmentType: 'Dolgu', cost: 1000 }],
      });
    const planId = created.body.plan.id;

    const discountRes = await request(app)
      .post('/api/payments/discount')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ treatmentPlanId: planId, discountAmount: 150, reason: 'Sadık hasta' });
    expect(discountRes.status).toBe(200);

    const approved = await request(app)
      .post(`/api/payments/approve-plan/${planId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ approved: true });

    // 1000 (kurum indirimi yok) - 150 manuel indirim = 850
    expect(parseFloat(approved.body.plan.total_estimated_cost)).toBe(850);

    const debt = await pool.query(
      'SELECT total_debt FROM patient_debts WHERE patient_id = $1',
      [patient.id],
    );
    expect(parseFloat(debt.rows[0].total_debt)).toBe(850);
  });

  it('kısmi iade net tahsilatı (total-income) doğru düşürür', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const payment = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ patientId: patient.id, amount: 1000, paymentMethod: 'cash' });
    expect(payment.status).toBe(201);
    const paymentId = payment.body.payment.id;

    const refund = await request(app)
      .post(`/api/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ amount: 300, reason: 'Kısmi iade — fazla ödeme' });
    expect(refund.status).toBe(200);

    const income = await request(app)
      .get('/api/payments/total-income')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(income.body.totalIncome).toBe(700);
    expect(income.body.grossPayments).toBe(1000);
    expect(income.body.totalRefunds).toBe(300);
  });

  it('onaylanmış plan iptal edildiğinde borç ters kayıtla (reversal) düşer', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patient = await createPatient();

    const { planId } = await createApprovedPlan(app, admin, patient, null, [
      { toothNumber: '11', treatmentType: 'Dolgu', cost: 1000 },
    ]);

    const cancelRes = await request(app)
      .post(`/api/payments/plans/${planId}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Hasta vazgeçti' });
    expect(cancelRes.status).toBe(200);

    const debt = await pool.query(
      'SELECT total_debt, remaining_debt FROM patient_debts WHERE patient_id = $1',
      [patient.id],
    );
    expect(parseFloat(debt.rows[0].total_debt)).toBe(0);
    expect(parseFloat(debt.rows[0].remaining_debt)).toBe(0);

    const reversal = await pool.query(
      `SELECT * FROM financial_transactions WHERE treatment_plan_id = $1 AND transaction_type = 'reversal'`,
      [planId],
    );
    expect(reversal.rows).toHaveLength(1);
  });

  it('başka bir hastanın planına ödeme yapılamaz (400), ödeme kaydı oluşmaz', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const patientA = await createPatient({ firstName: 'A' });
    const patientB = await createPatient({ firstName: 'B' });

    const { planId } = await createApprovedPlan(app, admin, patientA, null, [
      { toothNumber: '11', treatmentType: 'Dolgu', cost: 500 },
    ]);

    const res = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patientB.id,
        treatmentPlanId: planId,
        amount: 500,
        paymentMethod: 'cash',
      });
    expect(res.status).toBe(400);

    const payments = await pool.query('SELECT COUNT(*) FROM payments');
    expect(parseInt(payments.rows[0].count, 10)).toBe(0);
  });

  it('doktor komisyonu plansız ödemede oluşmaz, planlı ödemede oluşur ve iade oranında geri düşer', async () => {
    const admin = await createUser({ roles: ['admin'] });
    const dentist = await createUser({ roles: ['dentist'], commissionRate: 20 });
    const patient = await createPatient();

    // Plansız ödeme — komisyon oluşmamalı.
    const noPlanPayment = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ patientId: patient.id, amount: 500, paymentMethod: 'cash' });
    expect(noPlanPayment.body.payment.dentist_commission).toBeNull();

    const { planId } = await createApprovedPlan(app, admin, patient, dentist, [
      { toothNumber: '11', treatmentType: 'Dolgu', cost: 1000 },
    ]);

    const planPayment = await request(app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        patientId: patient.id,
        treatmentPlanId: planId,
        amount: 1000,
        paymentMethod: 'cash',
      });
    expect(parseFloat(planPayment.body.payment.dentist_commission)).toBe(200); // %20 of 1000

    const earningsBefore = await request(app)
      .get('/api/dentist/earnings')
      .set('Authorization', `Bearer ${dentist.token}`);
    expect(earningsBefore.body.earnings.paidTurnoverShare).toBe(200);

    // Bu ödemenin tamamı iade edilirse komisyon da tamamen geri düşmeli.
    await request(app)
      .post(`/api/payments/${planPayment.body.payment.id}/refund`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Tam iade' });

    const earningsAfter = await request(app)
      .get('/api/dentist/earnings')
      .set('Authorization', `Bearer ${dentist.token}`);
    expect(earningsAfter.body.earnings.paidTurnoverShare).toBe(0);
  });
});
