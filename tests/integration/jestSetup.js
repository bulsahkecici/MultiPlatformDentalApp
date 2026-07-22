process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';

const { assertTestDatabase, pool } = require('./dbHelper');

// Süreç başlarken bir kez çalışır — production'a bağlanmayı hemen engeller.
assertTestDatabase();

afterAll(async () => {
  await pool.end().catch(() => {});
});
