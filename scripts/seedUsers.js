#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const logger = require('../src/utils/logger');
const { serializeRolesCsv } = require('../src/utils/roles');

async function createUser(email, password, roles, commissionRate = null) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  
  if (existing.rowCount > 0) {
    logger.info({ email, roles }, 'User already exists, skipping...');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const rolesCsv = serializeRolesCsv(roles);
  
  // Check if commission_rate column exists
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='users' AND column_name='commission_rate'
  `);
  
  const hasCommissionColumn = columnCheck.rows.length > 0;
  
  let query, params;
  if (hasCommissionColumn && commissionRate !== null) {
    query = `INSERT INTO users (email, password_hash, roles, commission_rate, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`;
    params = [email, passwordHash, rolesCsv, commissionRate];
  } else {
    query = `INSERT INTO users (email, password_hash, roles, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`;
    params = [email, passwordHash, rolesCsv];
  }

  await pool.query(query, params);
  logger.info({ email, roles, commissionRate }, 'User created successfully');
}

async function seedUsers() {
  try {
    // Sekreter kullanıcısı
    await createUser('sekreter@mail.com', 'sekreter123456', ['secretary']);
    
    // Diş hekimi kullanıcısı (varsayılan komisyon oranı %30)
    await createUser('dentist@mail.com', 'dentist123456', ['dentist'], 30.00);
    
    logger.info('All users seeded successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to seed users');
    throw err;
  } finally {
    await pool.end();
  }
}

seedUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  });
