const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const logger = require('../utils/logger');

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
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .split('T')[0];

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

    // Last month financial (from treatments)
    const lastMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthFinancial = parseFloat(
      lastMonthFinancialResult.rows[0].total || 0,
    );

    // This month financial
    const thisMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL`,
      [thisMonthStart, thisMonthEnd],
    );
    const thisMonthFinancial = parseFloat(
      thisMonthFinancialResult.rows[0].total || 0,
    );

    // Last month transactions (treatments count)
    const lastMonthTransactionsResult = await query(
      `SELECT COUNT(*) as count FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2`,
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
      [now.toISOString().split('T')[0]],
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

    // Total treatments
    const treatmentsResult = await query(
      `SELECT COUNT(*) as count, 
       COALESCE(SUM(cost), 0) as total_revenue
       FROM treatments`,
    );
    const treatments = treatmentsResult.rows[0];

    // Financials from payments/patient_debts (invoices tablosuna hiç yazılmıyor;
    // gerçek veriler payments + patient_debts'te — JSON şekli istemciler için korunuyor)
    const paymentsAggResult = await query(
      `SELECT COUNT(*) as count,
       COALESCE(SUM(amount), 0) as paid_revenue
       FROM payments`,
    );
    const debtsAggResult = await query(
      'SELECT COALESCE(SUM(total_debt), 0) as total_billed FROM patient_debts',
    );
    const invoices = {
      count: paymentsAggResult.rows[0].count,
      total_revenue: debtsAggResult.rows[0].total_billed,
      paid_revenue: paymentsAggResult.rows[0].paid_revenue,
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
