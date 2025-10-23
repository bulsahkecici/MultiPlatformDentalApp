const express = require('express');
const { pingDb } = require('../db');

const router = express.Router();

router.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/readyz', async (req, res) => {
  const dbOk = await pingDb();
  if (!dbOk) {
    return res.status(503).json({ status: 'not_ready' });
  }
  return res.status(200).json({ status: 'ready' });
});

module.exports = router;
