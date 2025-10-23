const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { status } = require('../controllers/adminController');

const router = express.Router();

router.get('/admin/status', requireAuth, requireRole('admin'), status);

module.exports = router;
