const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    // Let's get M0 data specifically
    const m0Tickets = await pool.query(`
      WITH LineStart AS (
        SELECT 
          pl.id as line_id, 
          pl.name as line_name,
          c.name as client_name,
          COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
        FROM production_lines pl
        JOIN sites s ON pl.site_id = s.id
        JOIN clients c ON s.client_id = c.id
      ),
      TicketRelative AS (
        SELECT 
          t.id,
          t.line_id,
          ls.client_name,
          ls.line_name,
          t.reported_at,
          ls.start_date,
          (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
           EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int as month_index
        FROM support_tickets t
        JOIN LineStart ls ON t.line_id = ls.line_id
        WHERE t.reported_at >= ls.start_date::timestamp with time zone
      )
      SELECT * FROM TicketRelative WHERE month_index = 0
      ORDER BY line_id LIMIT 10;
    `);

    console.log("=== M0 Tickets (First month of lifecycle) ===");
    console.table(m0Tickets.rows);
    
    // Total aggregate for M0
    const m0Agg = await pool.query(`
      WITH LineStart AS (
        SELECT 
          pl.id as line_id, 
          COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
        FROM production_lines pl
        JOIN sites s ON pl.site_id = s.id
        JOIN clients c ON s.client_id = c.id
      ),
      TicketRelative AS (
        SELECT 
          t.line_id,
          (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
           EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int as month_index
        FROM support_tickets t
        JOIN LineStart ls ON t.line_id = ls.line_id
        WHERE t.reported_at >= ls.start_date::timestamp with time zone
      )
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(DISTINCT line_id) as active_lines
      FROM TicketRelative WHERE month_index = 0;
    `);
    console.log("M0 Aggregate:", m0Agg.rows[0]);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
