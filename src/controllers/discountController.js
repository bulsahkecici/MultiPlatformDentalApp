const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const logger = require('../utils/logger');

async function listDiscounts(req, res, next) {
  try {
    const { activeOnly = 'true' } = req.query;
    const conditions = [];
    const params = [];

    if (activeOnly === 'true') {
      conditions.push('is_active = true');
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM discounts ${whereClause} ORDER BY name ASC`,
      params,
    );

    return res.status(200).json({ discounts: result.rows });
  } catch (err) {
    logger.error({ err }, 'Failed to list discounts');
    return next(new AppError('Failed to list discounts', 500));
  }
}

async function getDiscountById(req, res, next) {
  try {
    const discountId = parseInt(req.params.id, 10);
    const result = await query('SELECT * FROM discounts WHERE id = $1', [
      discountId,
    ]);

    if (result.rows.length === 0) {
      return next(new AppError('Discount not found', 404));
    }

    return res.status(200).json({ discount: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to fetch discount', 500));
  }
}

async function createDiscount(req, res, next) {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      minAmount,
      maxDiscount,
      startDate,
      endDate,
      isActive = true,
    } = req.body || {};

    if (!name || !discountType || discountValue === undefined) {
      return next(
        new AppError('name, discountType and discountValue are required', 400),
      );
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return next(
        new AppError('discountType must be percentage or fixed', 400),
      );
    }

    const result = await query(
      `INSERT INTO discounts (
                name, description, discount_type, discount_value,
                min_amount, max_discount, start_date, end_date, is_active,
                created_by, updated_by, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,NOW(),NOW())
            RETURNING *`,
      [
        name,
        description || null,
        discountType,
        discountValue,
        minAmount || null,
        maxDiscount || null,
        startDate || null,
        endDate || null,
        isActive,
        req.user.sub,
      ],
    );

    const discount = result.rows[0];

    await logDataEvent({
      eventType: AuditEventType.DATA_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'discount',
      resourceId: discount.id,
      changes: { name, discountType, discountValue },
    });

    return res.status(201).json({ discount });
  } catch (err) {
    logger.error({ err }, 'Failed to create discount');
    return next(new AppError('Failed to create discount', 500));
  }
}

async function updateDiscount(req, res, next) {
  try {
    const discountId = parseInt(req.params.id, 10);
    const updates = req.body || {};
    const allowedFields = [
      'name',
      'description',
      'discount_type',
      'discount_value',
      'min_amount',
      'max_discount',
      'start_date',
      'end_date',
      'is_active',
    ];

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = $${paramIndex++}`);
        params.push(updates[key]);
      }
    });

    if (setClauses.length === 0) {
      return next(new AppError('No valid fields to update', 400));
    }

    setClauses.push(`updated_by = $${paramIndex++}`);
    params.push(req.user.sub);
    setClauses.push('updated_at = NOW()');
    params.push(discountId);

    const result = await query(
      `UPDATE discounts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return next(new AppError('Discount not found', 404));
    }

    return res.status(200).json({ discount: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to update discount', 500));
  }
}

async function deactivateDiscount(req, res, next) {
  try {
    const discountId = parseInt(req.params.id, 10);
    const result = await query(
      `UPDATE discounts SET is_active = false, updated_by = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
      [req.user.sub, discountId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Discount not found', 404));
    }

    return res
      .status(200)
      .json({ discount: result.rows[0], message: 'Discount deactivated' });
  } catch (err) {
    return next(new AppError('Failed to deactivate discount', 500));
  }
}

module.exports = {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deactivateDiscount,
};
