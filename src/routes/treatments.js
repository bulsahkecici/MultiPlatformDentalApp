const express = require('express');
const {
    createTreatment,
    getTreatments,
    getTreatmentById,
    updateTreatment,
    createTreatmentPlan,
    getTreatmentPlans,
} = require('../controllers/treatmentController');
const { requireAuth } = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.get('/api/treatments', requireAuth, getTreatments);
router.post('/api/treatments', requireAuth, mutateLimiter, createTreatment);
router.get('/api/treatments/:id', requireAuth, getTreatmentById);
router.put('/api/treatments/:id', requireAuth, mutateLimiter, updateTreatment);

// Treatment plans
router.get('/api/treatment-plans', requireAuth, getTreatmentPlans);
router.post('/api/treatment-plans', requireAuth, mutateLimiter, createTreatmentPlan);

module.exports = router;
