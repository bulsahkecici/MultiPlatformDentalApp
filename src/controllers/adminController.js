const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const logger = require('../utils/logger');
const { toLocalDateString } = require('../utils/dateUtils');

async function status(req, res) {
  return res.status(200).json({
    ok: true,
    user: { email: req.user.email, roles: req.user.roles },
  });
}

/**
 * Get clinic statistics
 * Admin only
 */
async function getStatistics(req, res, next) {
  try {
    // Calculate date ranges
    const now = new Date();
    const thisMonthStart = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const thisMonthEnd = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    );
    const lastMonthStart = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    const lastMonthEnd = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth(), 0),
    );
    const nextMonthStart = toLocalDateString(
      new Date(now.getFullYear(), now.getMonth() + 1, 1),
    );

    // Total patients
    const totalPatientsResult = await query(
      'SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL',
    );
    const totalPatients = parseInt(totalPatientsResult.rows[0].count, 10);

    // Last month patients
    const lastMonthPatientsResult = await query(
      `SELECT COUNT(*) as count FROM patients 
       WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthPatients = parseInt(
      lastMonthPatientsResult.rows[0].count,
      10,
    );

    // This month patients
    const thisMonthPatientsResult = await query(
      `SELECT COUNT(*) as count FROM patients 
       WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL`,
      [thisMonthStart, thisMonthEnd],
    );
    const thisMonthPatients = parseInt(
      thisMonthPatientsResult.rows[0].count,
      10,
    );

    // Last month financial (from treatments) — yalnızca gerçekten tamamlanmış
    // ve void edilmemiş tedaviler üretime dahil edilir (D4); aksi halde
    // planlanmış-ama-yapılmamış ya da void edilmiş tedaviler de "ciro"ya
    // sayılırdı (bkz. denetim raporu).
    const lastMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL
       AND status = 'completed' AND deleted_at IS NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthFinancial = parseFloat(
      lastMonthFinancialResult.rows[0].total || 0,
    );

    // This month financial
    const thisMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL
       AND status = 'completed' AND deleted_at IS NULL`,
      [thisMonthStart, thisMonthEnd],
    );
    const thisMonthFinancial = parseFloat(
      thisMonthFinancialResult.rows[0].total || 0,
    );

    // Last month transactions (treatments count) — void edilmiş kayıtlar
    // varsayılan listelerden gizlendiği gibi burada da sayılmaz.
    const lastMonthTransactionsResult = await query(
      `SELECT COUNT(*) as count FROM treatments
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND deleted_at IS NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthTransactions = parseInt(
      lastMonthTransactionsResult.rows[0].count,
      10,
    );

    // Upcoming appointments count
    const upcomingAppointmentsResult = await query(
      `SELECT COUNT(*) as count FROM appointments
       WHERE appointment_date >= $1 AND status NOT IN ('cancelled', 'no_show')`,
      [toLocalDateString(now)],
    );
    const upcomingAppointmentsCount = parseInt(
      upcomingAppointmentsResult.rows[0].count,
      10,
    );

    // Total appointments
    const appointmentsResult = await query(
      `SELECT COUNT(*) as count, 
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
       FROM appointments`,
    );
    const appointments = appointmentsResult.rows[0];

    // Total treatments — totalRevenue de aynı şekilde yalnızca tamamlanmış,
    // void edilmemiş tedavileri sayar (D4); count ise void'ler hariç tüm
    // kayıtları gösterir (planned/in_progress/cancelled dahil, void hariç).
    const treatmentsResult = await query(
      `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL) as count,
       COALESCE(SUM(cost) FILTER (WHERE status = 'completed' AND deleted_at IS NULL), 0) as total_revenue
       FROM treatments`,
    );
    const treatments = treatmentsResult.rows[0];

    // Financials from payments/patient_debts (invoices tablosuna hiç yazılmıyor;
    // gerçek veriler payments + patient_debts'te — JSON şekli istemciler için korunuyor).
    // paid_revenue artık hareket defterinden (financial_transactions) net
    // olarak hesaplanır: tamamlanmış ödemeler - tamamlanmış iadeler (D4) —
    // ham SUM(payments.amount) iade edilmiş tutarları da "tahsil edilmiş"
    // gösterirdi.
    const paymentsAggResult = await query(
      'SELECT COUNT(*) as count FROM payments',
    );
    const ledgerAggResult = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'payment' AND status = 'completed' THEN amount ELSE 0 END), 0) as gross_payments,
         COALESCE(SUM(CASE WHEN transaction_type = 'refund' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_refunds
       FROM financial_transactions`,
    );
    const netPaidRevenue =
      parseFloat(ledgerAggResult.rows[0].gross_payments || 0) -
      parseFloat(ledgerAggResult.rows[0].total_refunds || 0);
    const debtsAggResult = await query(
      'SELECT COALESCE(SUM(total_debt), 0) as total_billed FROM patient_debts',
    );
    const invoices = {
      count: paymentsAggResult.rows[0].count,
      total_revenue: debtsAggResult.rows[0].total_billed,
      paid_revenue: netPaidRevenue,
    };

    // Dentists count
    const dentistsResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE roles LIKE '%dentist%' AND deleted_at IS NULL",
    );
    const totalDentists = parseInt(dentistsResult.rows[0].count, 10);

    return res.status(200).json({
      statistics: {
        totalPatients,
        lastMonthFinancial,
        lastMonthPatients,
        lastMonthTransactions,
        thisMonthPatients,
        thisMonthFinancial,
        upcomingAppointmentsCount,
        patients: {
          total: totalPatients,
        },
        appointments: {
          total: parseInt(appointments.count, 10),
          completed: parseInt(appointments.completed, 10),
          cancelled: parseInt(appointments.cancelled, 10),
        },
        treatments: {
          total: parseInt(treatments.count, 10),
          totalRevenue: parseFloat(treatments.total_revenue || 0),
        },
        invoices: {
          total: parseInt(invoices.count, 10),
          totalRevenue: parseFloat(invoices.total_revenue || 0),
          paidRevenue: parseFloat(invoices.paid_revenue || 0),
        },
        dentists: {
          total: totalDentists,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch statistics');
    return next(new AppError('Failed to fetch statistics', 500));
  }
}

module.exports = { status, getStatistics };
