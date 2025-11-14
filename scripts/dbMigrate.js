#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../src/db');
const logger = require('../src/utils/logger');

async function run() {
  const schemaPath = path.resolve(__dirname, '..', 'db', 'schema_postgres.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  if (!sql.trim()) {
    throw new Error('Schema file is empty');
  }
  await pool.query(sql);
  logger.info('PostgreSQL schema applied');
}

run()
  .catch((err) => {
    logger.error({ err }, 'Failed to run migrations');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

