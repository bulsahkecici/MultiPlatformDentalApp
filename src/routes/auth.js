const express = require('express');
const { login } = require('../controllers/authController');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/api/login', mutateLimiter, login);

module.exports = router;
