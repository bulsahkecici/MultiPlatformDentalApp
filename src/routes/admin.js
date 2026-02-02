const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { status, getStatistics } = require('../controllers/adminController');

const router = express.Router();

router.get('/api/admin/status', requireAuth, requireRole('admin'), status);
router.get('/api/admin/statistics', requireAuth, requireRole('admin'), getStatistics);

module.exports = router;
