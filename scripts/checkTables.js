#!/usr/bin/env node
const { pool } = require('../src/db');

async function checkTables() {
  try {
    // Check if users table exists and who owns it
    const result = await pool.query(`
      SELECT 
        t.table_name,
        t.table_schema,
        pg_get_userbyid(c.relowner) as owner
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name;
    `);
    
    console.log('Tables found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name} (owner: ${row.owner})`);
    });
    
    // Check if users table has any data
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\nUsers table has ${userCount.rows[0].count} users`);
    
    if (userCount.rows[0].count > 0) {
      const users = await pool.query('SELECT id, email, roles FROM users LIMIT 5');
      console.log('\nSample users:');
      users.rows.forEach(user => {
        console.log(`  - ${user.email} (roles: ${user.roles})`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
