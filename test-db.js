const { pool, pingDb } = require('./src/db');
const logger = require('./src/utils/logger');

async function testConnection() {
    console.log('Testing database connection...');
    const isConnected = await pingDb();
    if (isConnected) {
        console.log('Successfully connected to the database!');
        try {
            const res = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
            console.log('Tables found:', res.rows.map(r => r.table_name).join(', '));
        } catch (err) {
            console.error('Error fetching tables:', err.message);
        }
    } else {
        console.log('Failed to connect to the database.');
    }
    await pool.end();
}

testConnection();
