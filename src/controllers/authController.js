const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errorResponder');
const { parseRolesCsv } = require('../utils/roles');

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return next(new AppError('Invalid credentials', 400));
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', email)
      .query(
        'SELECT Id, Email, PasswordHash, Roles FROM dbo.Users WHERE Email = @email',
      );

    const user = result.recordset && result.recordset[0];
    if (!user) {
      return next(new AppError('Unauthorized', 401));
    }

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) {
      return next(new AppError('Unauthorized', 401));
    }

    const roles = parseRolesCsv(user.Roles);
    const token = jwt.sign(
      { sub: user.Id, email: user.Email, roles },
      config.security.jwtSecret,
      { expiresIn: '1h' },
    );
    return res.status(200).json({ token });
  } catch (err) {
    return next(new AppError('Login failed', 401));
  }
}

module.exports = { login };
