#!/usr/bin/env node
/**
 * This script grants permissions to dentaluser
 * Run this with postgres superuser credentials
 * 
 * Usage: 
 * DB_USER=postgres DB_PASS=your_postgres_password node scripts/fixPermissions.js
 */

const { Pool } = require('pg');
const config = require('../src/config');

// Use postgres superuser for granting permissions
const adminPool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name, // Connect directly to dentalappdb
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || config.db.pass,
});

async function grantPermissions() {
  const client = await adminPool.connect();
  try {
    console.log('Granting permissions to dentaluser...');
    
    // Grant schema permissions
    await client.query('GRANT USAGE ON SCHEMA public TO dentaluser');
    await client.query('GRANT CREATE ON SCHEMA public TO dentaluser');
    
    // Grant table permissions
    await client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dentaluser');
    await client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dentaluser');
    
    // Grant default privileges for future tables
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dentaluser');
    await client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dentaluser');
    
    // Grant database privileges
    await client.query('GRANT ALL PRIVILEGES ON DATABASE dentalappdb TO dentaluser');
    
    console.log('Permissions granted successfully!');
  } catch (err) {
    console.error('Error granting permissions:', err.message);
    throw err;
  } finally {
    client.release();
    await adminPool.end();
  }
}

grantPermissions()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
