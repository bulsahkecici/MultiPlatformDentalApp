const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { requireRole } = require('../middlewares/auth');
const logger = require('../utils/logger');

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
        const salary = parseFloat(userResult.rows[0].salary || 0);
        
        if (!commissionRate || commissionRate <= 0) {
            return res.status(200).json({
                earnings: {
                    totalTurnover: 0,
                    paidTurnoverShare: 0,
                    totalEarnings: salary,
                    salary: salary,
                    commissionRate: 0,
                },
                treatments: [],
            });
        }

        // Build date filter
        const conditions = ['t.dentist_id = $1', 't.status = $2', 't.cost IS NOT NULL'];
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
        const totalTurnover = treatments.reduce((sum, t) => sum + parseFloat(t.cost || 0), 0);

        // Get paid commission from payments table
        const paymentsResult = await query(
            `SELECT COALESCE(SUM(dentist_commission), 0) as paid_commission
            FROM payments
            WHERE dentist_id = $1`,
            [dentistId],
        );
        const paidTurnoverShare = parseFloat(paymentsResult.rows[0].paid_commission || 0);
        const totalEarnings = salary + paidTurnoverShare;

        return res.status(200).json({
            earnings: {
                totalTurnover,
                paidTurnoverShare,
                totalEarnings,
                salary,
                commissionRate: parseFloat(commissionRate),
                treatmentCount: treatments.length,
            },
            treatments: treatments.map(t => ({
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
};
