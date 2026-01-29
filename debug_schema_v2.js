import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'equipment_management',
    user: 'postgres',
    password: 'postgres',
});

async function debug() {
    console.log('Connecting to database...');
    try {
        const res = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'remote_access'");
        console.log('SCHEMA_START');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('SCHEMA_END');

        // Also check if there are any rows to see if the table exists
        const countRes = await pool.query("SELECT COUNT(*) FROM remote_access");
        console.log('Row count:', countRes.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

debug();
