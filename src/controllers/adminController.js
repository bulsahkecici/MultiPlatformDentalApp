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
    const { startDate, endDate } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total patients
    const patientsResult = await query(
      `SELECT COUNT(*) as count FROM patients ${whereClause.replace(/created_at/g, 'created_at')}`,
      params,
    );
    const totalPatients = parseInt(patientsResult.rows[0].count, 10);

    // Total appointments
    const appointmentsResult = await query(
      `SELECT COUNT(*) as count, 
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
       FROM appointments ${whereClause.replace(/created_at/g, 'appointment_date')}`,
      params,
    );
    const appointments = appointmentsResult.rows[0];

    // Total treatments
    const treatmentsResult = await query(
      `SELECT COUNT(*) as count, 
       SUM(cost) as total_revenue
       FROM treatments 
       ${whereClause.replace(/created_at/g, 'treatment_date')}`,
      params,
    );
    const treatments = treatmentsResult.rows[0];

    // Total revenue from invoices
    const invoicesResult = await query(
      `SELECT COUNT(*) as count,
       SUM(total) as total_revenue,
       SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid_revenue
       FROM invoices ${whereClause}`,
      params,
    );
    const invoices = invoicesResult.rows[0];

    // Dentists count
    const dentistsResult = await query(
      `SELECT COUNT(*) as count FROM users WHERE roles LIKE '%dentist%' AND deleted_at IS NULL`,
    );
    const totalDentists = parseInt(dentistsResult.rows[0].count, 10);

    return res.status(200).json({
      statistics: {
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
