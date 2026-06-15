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
 * Klinik istatistiklerini getirir
 * Yalnızca admin
 */
async function getStatistics(req, res, next) {
  try {
    // Tarih aralıklarını hesapla
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

    // Toplam hasta sayısı
    const totalPatientsResult = await query(
      'SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL',
    );
    const totalPatients = parseInt(totalPatientsResult.rows[0].count, 10);

    // Geçen ayki hastalar
    const lastMonthPatientsResult = await query(
      `SELECT COUNT(*) as count FROM patients 
       WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthPatients = parseInt(
      lastMonthPatientsResult.rows[0].count,
      10,
    );

    // Bu ayki hastalar
    const thisMonthPatientsResult = await query(
      `SELECT COUNT(*) as count FROM patients 
       WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL`,
      [thisMonthStart, thisMonthEnd],
    );
    const thisMonthPatients = parseInt(
      thisMonthPatientsResult.rows[0].count,
      10,
    );

    // Geçen ayki ciro (tedavilerden)
    const lastMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthFinancial = parseFloat(
      lastMonthFinancialResult.rows[0].total || 0,
    );

    // Bu ayki ciro
    const thisMonthFinancialResult = await query(
      `SELECT COALESCE(SUM(cost), 0) as total FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2 AND cost IS NOT NULL`,
      [thisMonthStart, thisMonthEnd],
    );
    const thisMonthFinancial = parseFloat(
      thisMonthFinancialResult.rows[0].total || 0,
    );

    // Geçen ayki işlemler (tedavi sayısı)
    const lastMonthTransactionsResult = await query(
      `SELECT COUNT(*) as count FROM treatments 
       WHERE treatment_date >= $1 AND treatment_date <= $2`,
      [lastMonthStart, lastMonthEnd],
    );
    const lastMonthTransactions = parseInt(
      lastMonthTransactionsResult.rows[0].count,
      10,
    );

    // Yaklaşan randevu sayısı
    const upcomingAppointmentsResult = await query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE appointment_date >= $1 AND status NOT IN ('cancelled', 'no_show')`,
      [now.toISOString().split('T')[0]],
    );
    const upcomingAppointmentsCount = parseInt(
      upcomingAppointmentsResult.rows[0].count,
      10,
    );

    // Toplam randevular
    const appointmentsResult = await query(
      `SELECT COUNT(*) as count, 
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
       FROM appointments`,
    );
    const appointments = appointmentsResult.rows[0];

    // Toplam tedaviler
    const treatmentsResult = await query(
      `SELECT COUNT(*) as count, 
       COALESCE(SUM(cost), 0) as total_revenue
       FROM treatments`,
    );
    const treatments = treatmentsResult.rows[0];

    // Faturalardan toplam gelir
    const invoicesResult = await query(
      `SELECT COUNT(*) as count,
       COALESCE(SUM(total), 0) as total_revenue,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as paid_revenue
       FROM invoices`,
    );
    const invoices = invoicesResult.rows[0];

    // Hekim sayısı
    const dentistsResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE roles LIKE '%dentist%' AND deleted_at IS NULL",
    );
    const totalDentists = parseInt(dentistsResult.rows[0].count, 10);

    // Geçerli ay için hekim cirosu
    const dentistTurnoverResult = await query(
      `SELECT t.dentist_id,
              COALESCE(u.first_name, '') as first_name,
              COALESCE(u.last_name, '') as last_name,
              u.email,
              COALESCE(SUM(t.cost), 0) as turnover,
              COUNT(t.id) as treatment_count
       FROM treatments t
       LEFT JOIN users u ON t.dentist_id = u.id
       WHERE t.cost IS NOT NULL
         AND t.treatment_date >= $1 AND t.treatment_date <= $2
         AND t.dentist_id IS NOT NULL
       GROUP BY t.dentist_id, u.first_name, u.last_name, u.email
       ORDER BY turnover DESC`,
      [thisMonthStart, thisMonthEnd],
    );

    const dentistTurnovers = dentistTurnoverResult.rows.map((row) => ({
      dentistId: row.dentist_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      turnover: parseFloat(row.turnover || 0),
      treatmentCount: parseInt(row.treatment_count, 10),
    }));

    // Toplam ödemeler
    const paymentsResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments',
    );
    const totalPaid = parseFloat(paymentsResult.rows[0].total_paid || 0);

    // Toplam borç
    const debtResult = await query(
      'SELECT COALESCE(SUM(remaining_debt), 0) as total_debt FROM patient_debts',
    );
    const totalDebt = parseFloat(debtResult.rows[0].total_debt || 0);

    return res.status(200).json({
      statistics: {
        totalPatients,
        lastMonthFinancial,
        lastMonthPatients,
        lastMonthTransactions,
        thisMonthPatients,
        thisMonthFinancial,
        upcomingAppointmentsCount,
        totalAmount: parseFloat(treatments.total_revenue || 0),
        paidAmount: totalPaid,
        totalDebt,
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
        dentistTurnovers,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch statistics');
    return next(new AppError('Failed to fetch statistics', 500));
  }
}

module.exports = { status, getStatistics };
