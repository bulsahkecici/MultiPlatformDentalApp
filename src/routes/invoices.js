const express = require('express');
const {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice,
} = require('../controllers/invoiceController');
const { requireAuth, requireAnyRole } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get(
  '/api/invoices',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  listInvoices,
);
router.get(
  '/api/invoices/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getInvoiceById,
);
router.post(
  '/api/invoices',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  createInvoice,
);
router.put(
  '/api/invoices/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  updateInvoice,
);
router.delete(
  '/api/invoices/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  cancelInvoice,
);

module.exports = router;
