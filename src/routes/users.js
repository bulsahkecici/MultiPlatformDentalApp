const express = require('express');
const {
  createUser,
  getUsers,
  getDentists,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  updateRoles,
} = require('../controllers/userController');
const {
  requireAuth,
  requireRole,
  requireSelf,
  requireSelfOrAdmin,
} = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// User CRUD operations
router.get('/api/users', requireAuth, requireRole('admin'), getUsers);
router.post(
  '/api/users',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  createUser,
);
// Dişhekimi seçicileri için — tüm personel erişebilir; '/:id' rotasından ÖNCE tanımlanmalı
router.get('/api/users/dentists', requireAuth, getDentists);
router.get('/api/users/:id', requireAuth, requireSelfOrAdmin, getUserById);
router.put(
  '/api/users/:id',
  requireAuth,
  requireSelfOrAdmin,
  mutateLimiter,
  updateUser,
);
router.delete(
  '/api/users/:id',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  deleteUser,
);

// Password management
router.put(
  '/api/users/:id/password',
  requireAuth,
  requireSelf,
  mutateLimiter,
  changePassword,
);

// Role management (admin only)
router.put(
  '/api/users/:id/roles',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  updateRoles,
);

module.exports = router;
