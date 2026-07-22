/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Entegrasyon testleri gerçek bir PostgreSQL bağlantısı gerektirir (db
  // mock'lanmaz) — ayrı bir config + npm script (test:integration) ile
  // çalıştırılır (bkz. jest.integration.config.js), normal `npm test`
  // sırasında atlanır.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/integration/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
};
