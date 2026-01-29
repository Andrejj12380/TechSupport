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
    try {
        const colRes = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'remote_access'
    `);
        console.log('--- COLUMNS ---');
        colRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (${r.udt_name})`));

        const constRes = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'remote_access'::regclass
    `);
        console.log('--- CONSTRAINTS ---');
        constRes.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

debug();
