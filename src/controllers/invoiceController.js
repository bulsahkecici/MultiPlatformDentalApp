const { query } = require('../db');
const { AppError } = require('../utils/errorResponder');
const { logDataEvent, AuditEventType } = require('../utils/auditLogger');
const { getClientIp } = require('../middlewares/accountLockout');
const logger = require('../utils/logger');

async function listInvoices(req, res, next) {
  try {
    const { page = 1, limit = 20, patientId, status } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (patientId) {
      conditions.push(`i.patient_id = $${paramIndex++}`);
      params.push(parseInt(patientId, 10));
    }
    if (status) {
      conditions.push(`i.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) as count FROM invoices i ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT i.*, p.first_name as patient_first_name, p.last_name as patient_last_name
             FROM invoices i
             LEFT JOIN patients p ON i.patient_id = p.id
             ${whereClause}
             ORDER BY i.invoice_date DESC, i.id DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, parseInt(limit, 10), offset],
    );

    return res.status(200).json({
      invoices: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list invoices');
    return next(new AppError('Failed to list invoices', 500));
  }
}

async function getInvoiceById(req, res, next) {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const result = await query(
      `SELECT i.*, p.first_name as patient_first_name, p.last_name as patient_last_name
             FROM invoices i
             LEFT JOIN patients p ON i.patient_id = p.id
             WHERE i.id = $1`,
      [invoiceId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Invoice not found', 404));
    }

    return res.status(200).json({ invoice: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to fetch invoice', 500));
  }
}

async function createInvoice(req, res, next) {
  try {
    const {
      patientId,
      treatmentId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      subtotal,
      tax = 0,
      discount = 0,
      total,
      currency = 'TRY',
      status = 'pending',
      notes,
    } = req.body || {};

    if (
      !patientId ||
      !invoiceNumber ||
      !invoiceDate ||
      subtotal === undefined ||
      total === undefined
    ) {
      return next(
        new AppError(
          'patientId, invoiceNumber, invoiceDate, subtotal and total are required',
          400,
        ),
      );
    }

    const result = await query(
      `INSERT INTO invoices (
                patient_id, treatment_id, invoice_number, invoice_date, due_date,
                subtotal, tax, discount, total, currency, status, notes,
                created_by, updated_by, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,NOW(),NOW())
            RETURNING *`,
      [
        patientId,
        treatmentId || null,
        invoiceNumber,
        invoiceDate,
        dueDate || null,
        subtotal,
        tax,
        discount,
        total,
        currency,
        status,
        notes || null,
        req.user.sub,
      ],
    );

    const invoice = result.rows[0];

    await logDataEvent({
      eventType: AuditEventType.DATA_CREATED,
      userId: req.user.sub,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      resourceType: 'invoice',
      resourceId: invoice.id,
      changes: { patientId, total },
    });

    return res.status(201).json({ invoice });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('Invoice number already exists', 409));
    }
    logger.error({ err }, 'Failed to create invoice');
    return next(new AppError('Failed to create invoice', 500));
  }
}

async function updateInvoice(req, res, next) {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const updates = req.body || {};
    const allowedFields = [
      'invoice_date',
      'due_date',
      'subtotal',
      'tax',
      'discount',
      'total',
      'currency',
      'status',
      'payment_method',
      'payment_date',
      'notes',
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
    params.push(invoiceId);

    const result = await query(
      `UPDATE invoices SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return next(new AppError('Invoice not found', 404));
    }

    return res.status(200).json({ invoice: result.rows[0] });
  } catch (err) {
    return next(new AppError('Failed to update invoice', 500));
  }
}

async function cancelInvoice(req, res, next) {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const result = await query(
      `UPDATE invoices SET status = 'cancelled', updated_by = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
      [req.user.sub, invoiceId],
    );

    if (result.rows.length === 0) {
      return next(new AppError('Invoice not found', 404));
    }

    return res
      .status(200)
      .json({ invoice: result.rows[0], message: 'Invoice cancelled' });
  } catch (err) {
    return next(new AppError('Failed to cancel invoice', 500));
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice,
};
