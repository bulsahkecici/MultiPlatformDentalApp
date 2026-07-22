const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../src/db');
const config = require('../../src/config');
const { serializeRolesCsv } = require('../../src/utils/roles');

/**
 * Güvenlik kontrolü: entegrasyon testleri asla bir production/gerçek klinik
 * veritabanına bağlanmamalı — bu testler tabloları TRUNCATE eder. DB adında
 * "test" geçmiyorsa ya da NODE_ENV production ise süreci hemen durdurur.
 */
function assertTestDatabase() {
  const dbName = (config.db.name || '').toLowerCase();
  if (config.isProduction) {
    throw new Error(
      'Refusing to run integration tests with NODE_ENV=production',
    );
  }
  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to run integration tests against a database whose name ("${config.db.name}") ` +
        'does not contain "test". Set DB_NAME to a dedicated test database (e.g. dentalappdb_test).',
    );
  }
}

const TABLES_TO_RESET = [
  'financial_transactions',
  'treatment_revisions',
  'payments',
  'patient_debts',
  'treatment_plan_items',
  'treatment_plans',
  'treatments',
  'appointments',
  'patient_discount_reasons',
  'institution_agreement_category_discounts',
  'institution_agreements',
  'patients',
  'notifications',
  'audit_logs',
  'refresh_tokens',
  'users',
];

async function resetDatabase() {
  assertTestDatabase();
  await pool.query(
    `TRUNCATE TABLE ${TABLES_TO_RESET.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

let userCounter = 0;

async function createUser({
  roles = [],
  commissionRate = null,
  salary = null,
  email,
} = {}) {
  userCounter += 1;
  const finalEmail = email || `integration-user-${userCounter}@example.com`;
  const passwordHash = await bcrypt.hash('Test@12345', 4);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, roles, commission_rate, salary, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
     RETURNING *`,
    [
      finalEmail,
      passwordHash,
      serializeRolesCsv(roles),
      commissionRate,
      salary,
    ],
  );
  const user = result.rows[0];
  const token = jwt.sign(
    { sub: user.id, email: user.email, roles, tokenType: 'access' },
    config.security.jwtSecret,
    { expiresIn: '15m' },
  );
  return { ...user, roles, token };
}

async function createPatient(overrides = {}) {
  const result = await pool.query(
    `INSERT INTO patients (first_name, last_name, institution_agreement_id, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [
      overrides.firstName || 'Test',
      overrides.lastName || 'Patient',
      overrides.institutionAgreementId || null,
    ],
  );
  return result.rows[0];
}

module.exports = {
  pool,
  assertTestDatabase,
  resetDatabase,
  createUser,
  createPatient,
};
