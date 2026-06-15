const express = require('express');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  updateRoles,
} = require('../controllers/userController');
const {
  requireAuth,
  requireRole,
  requireAnyRole,
  requireSelf,
  requireSelfOrAdmin,
} = require('../middlewares/auth');
const { mutateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Kullanıcı CRUD işlemleri
router.get(
  '/api/users',
  requireAuth,
  requireAnyRole('admin', 'secretary'),
  getUsers,
);
router.post(
  '/api/users',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  createUser,
);
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

// Parola yönetimi
router.put(
  '/api/users/:id/password',
  requireAuth,
  requireSelf,
  mutateLimiter,
  changePassword,
);

// Rol yönetimi (yalnızca admin)
router.put(
  '/api/users/:id/roles',
  requireAuth,
  requireRole('admin'),
  mutateLimiter,
  updateRoles,
);

module.exports = router;
