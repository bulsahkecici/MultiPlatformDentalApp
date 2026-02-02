const express = require('express');
const { getDentistEarnings } = require('../controllers/dentistController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Dentist earnings (only dentists can access)
router.get('/api/dentist/earnings', requireAuth, requireRole('dentist'), getDentistEarnings);

module.exports = router;
