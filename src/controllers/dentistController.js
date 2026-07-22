const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const logger = require('../utils/logger');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Belirli bir tarih aralığı için maaşın ne kadarının kazanca dahil edileceğini
 * hesaplar (D4/D9 — "tam maaşın herhangi bir kısa tarih aralığına otomatik
 * eklenmesi engellenmeli"). Aralık verilmemişse (lifetime görünüm) tam maaş
 * olduğu gibi döner — bu, "şu ana kadarki toplam" projeksiyonu için doğru
 * davranıştır. Aralık verilmişse gün bazında oranlanır: aralık tek bir takvim
 * ayının içindeyse o ayın gerçek gün sayısına, birden fazla ayı kapsıyorsa
 * (basitleştirme olarak) 30 günlük bir aya oranlanır.
 *
 * Bu, gerçek bir bordro/dönem sistemi değil, kısa aralıklara tam maaşın kazara
 * eklenmesini önleyen dokümante edilmiş bir yaklaşıklamadır — tam bir bordro
 * dönemi modeli bu turun kapsamı dışındadır (bkz. nihai rapor, kalan riskler).
 */
function computeProratedSalary(salary, startDate, endDate) {
  if (!startDate && !endDate) {
    return salary;
  }
  if (!startDate || !endDate) {
    // Yalnızca bir uç verilmiş — güvenli taraf: açık olmayan bir aralığa
    // maaş ekleme, sıfır döndür (istemci ikisini de göndermeli).
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  const days = Math.floor((end - start) / MS_PER_DAY) + 1; // dahil aralık
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  const daysInStartMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const denominator = sameMonth ? daysInStartMonth : 30;

  return Math.round(salary * (days / denominator) * 100) / 100;
}

/**
 * Get dentist earnings (kazanç)
 * Only dentists can see their own earnings
 */
async function getDentistEarnings(req, res, next) {
  try {
    const dentistId = req.user.sub;
    const { startDate, endDate } = req.query;

    // Get dentist commission rate and salary
    const userResult = await query(
      'SELECT commission_rate, salary FROM users WHERE id = $1',
      [dentistId],
    );

    if (userResult.rows.length === 0) {
      return next(new AppError('Dentist not found', 404));
    }

    const commissionRate = userResult.rows[0].commission_rate;
    const rawSalary = parseFloat(userResult.rows[0].salary || 0);
    const salary = computeProratedSalary(
      rawSalary,
      startDate || null,
      endDate || null,
    );

    if (!commissionRate || commissionRate <= 0) {
      return res.status(200).json({
        earnings: {
          totalTurnover: 0,
          paidTurnoverShare: 0,
          totalEarnings: salary,
          salary,
          fullSalary: rawSalary,
          commissionRate: 0,
        },
        treatments: [],
      });
    }

    // Build date filter
    const conditions = [
      't.dentist_id = $1',
      't.status = $2',
      't.cost IS NOT NULL',
    ];
    const params = [dentistId, 'completed'];
    let paramIndex = 3;

    if (startDate) {
      conditions.push(`t.treatment_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`t.treatment_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get treatments with earnings calculation
    const result = await query(
      `SELECT
        t.id,
        t.treatment_date,
        t.treatment_type,
        t.cost,
        t.currency,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        (t.cost * $${paramIndex} / 100) as earnings
       FROM treatments t
       LEFT JOIN patients p ON t.patient_id = p.id
       WHERE ${whereClause}
       ORDER BY t.treatment_date DESC`,
      [...params, commissionRate],
    );

    const treatments = result.rows;
    const totalTurnover = treatments.reduce(
      (sum, t) => sum + parseFloat(t.cost || 0),
      0,
    );

    // Ödenen komisyon: ödeme tarihine (created_at) göre filtrelenir (tedavi
    // tarihine göre DEĞİL — D4/D9) ve tamamlanmış iadeler oranında düşürülür.
    // Plansız ödemeler zaten payments.dentist_id/dentist_commission hiç
    // set edilmediği için (bkz. paymentController.processPayment) buraya
    // dahil olmaz.
    const commissionResult = await query(
      `SELECT
         COALESCE(SUM(p.dentist_commission), 0) as gross_commission,
         COALESCE(SUM(
           p.dentist_commission * COALESCE(refunded.total, 0) / NULLIF(p.amount, 0)
         ), 0) as reversed_commission
       FROM payments p
       LEFT JOIN (
         SELECT payment_id, SUM(amount) as total
         FROM financial_transactions
         WHERE transaction_type = 'refund' AND status = 'completed'
         GROUP BY payment_id
       ) refunded ON refunded.payment_id = p.id
       WHERE p.dentist_id = $1
         AND p.dentist_commission IS NOT NULL
         AND ($2::date IS NULL OR p.created_at >= $2::date)
         AND ($3::date IS NULL OR p.created_at < ($3::date + INTERVAL '1 day'))`,
      [dentistId, startDate || null, endDate || null],
    );
    const grossCommission = parseFloat(
      commissionResult.rows[0].gross_commission || 0,
    );
    const reversedCommission = parseFloat(
      commissionResult.rows[0].reversed_commission || 0,
    );
    const paidTurnoverShare = Math.max(
      0,
      Math.round((grossCommission - reversedCommission) * 100) / 100,
    );
    const totalEarnings = Math.round((salary + paidTurnoverShare) * 100) / 100;

    return res.status(200).json({
      earnings: {
        totalTurnover,
        paidTurnoverShare,
        totalEarnings,
        salary,
        fullSalary: rawSalary,
        commissionRate: parseFloat(commissionRate),
        treatmentCount: treatments.length,
      },
      treatments: treatments.map((t) => ({
        id: t.id,
        treatment_date: t.treatment_date,
        treatment_type: t.treatment_type,
        cost: parseFloat(t.cost || 0),
        currency: t.currency || 'TRY',
        patient_first_name: t.patient_first_name || '',
        patient_last_name: t.patient_last_name || '',
        earnings: parseFloat(t.earnings || 0),
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch dentist earnings');
    return next(new AppError('Failed to fetch dentist earnings', 500));
  }
}

module.exports = {
  getDentistEarnings,
  computeProratedSalary,
};
