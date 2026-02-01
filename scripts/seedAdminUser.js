#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const logger = require('../src/utils/logger');
const { serializeRolesCsv } = require('../src/utils/roles');

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@mail.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const rolesCsv = serializeRolesCsv(['admin']);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    email,
  ]);
  if (existing.rowCount > 0) {
    logger.info({ email }, 'Admin user already exists');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `
      INSERT INTO users (email, password_hash, roles, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `,
    [email, passwordHash, rolesCsv],
  );
  logger.info({ email }, 'Admin user created');
}

ensureAdminUser()
  .catch((err) => {
    logger.error({ err }, 'Failed to seed admin user');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

