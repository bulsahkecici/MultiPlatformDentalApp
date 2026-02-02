#!/usr/bin/env node
const { pool } = require('../src/db');
const { parseRolesCsv } = require('../src/utils/roles');

async function listUsers() {
  try {
    const result = await pool.query(
      'SELECT id, email, roles FROM users WHERE deleted_at IS NULL ORDER BY id'
    );
    
    console.log('\n=== KULLANICILAR VE ROLLERİ ===\n');
    
    if (result.rows.length === 0) {
      console.log('Veritabanında kullanıcı bulunamadı.');
    } else {
      result.rows.forEach((user) => {
        const roles = parseRolesCsv(user.roles);
        const roleNames = roles.length > 0 ? roles.join(', ') : '(rol yok)';
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Roller: ${roleNames}`);
        console.log('---');
      });
    }
    
    await pool.end();
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}

listUsers();
