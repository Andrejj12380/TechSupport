import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    try {
        console.log('Checking ENUM values...');
        const res = await pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'remote_access_type_enum'");
        const existingValues = res.rows.map(r => r.enumlabel);

        if (!existingValues.includes('rudesktop')) {
            console.log('Adding rudesktop to ENUM...');
            await pool.query("ALTER TYPE remote_access_type_enum ADD VALUE 'rudesktop'");
        }

        if (!existingValues.includes('rustdesk')) {
            console.log('Adding rustdesk to ENUM...');
            await pool.query("ALTER TYPE remote_access_type_enum ADD VALUE 'rustdesk'");
        }

        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
