const express = require('express');
const {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deactivateDiscount,
} = require('../controllers/discountController');
const {
  requireAuth,
  requireAnyRole,
  requireRole,
} = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get(
  '/api/discounts',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  listDiscounts,
);
router.get(
  '/api/discounts/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getDiscountById,
);
router.post(
  '/api/discounts',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  createDiscount,
);
router.put(
  '/api/discounts/:id',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  mutateLimiter,
  updateDiscount,
);
router.delete(
  '/api/discounts/:id',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  deactivateDiscount,
);

module.exports = router;
