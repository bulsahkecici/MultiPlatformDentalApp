const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errorResponder');
const { parseRolesCsv } = require('../utils/roles');

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return next(new AppError('Invalid credentials', 400));
    }

    const result = await query(
      'SELECT id, email, password_hash, roles FROM users WHERE email = $1',
      [email],
    );

    const user = result.rows && result.rows[0];
    if (!user) {
      return next(new AppError('Unauthorized', 401));
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return next(new AppError('Unauthorized', 401));
    }

    const roles = parseRolesCsv(user.roles);
    const token = jwt.sign(
      { sub: user.id, email: user.email, roles },
      config.security.jwtSecret,
      { expiresIn: '1h' },
    );
    return res.status(200).json({ token });
  } catch (err) {
    return next(new AppError('Login failed', 401));
  }
}

module.exports = { login };
