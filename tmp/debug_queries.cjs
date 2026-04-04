
const { Pool } = require('pg');
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "equipment_management",
  user: "postgres",
  password: "postgres"
});

async function run() {
  try {
    console.log("Testing Trend Query...");
    const trendQuery = `
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
        month_index,
        COUNT(*) as ticket_count,
        COUNT(DISTINCT line_id) as active_lines,
        ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT line_id), 0), 2) as avg_tickets_per_line
      FROM TicketRelative
      WHERE month_index >= 0 AND month_index <= 24
      GROUP BY month_index
      ORDER BY month_index ASC;
    `;
    const res1 = await pool.query(trendQuery);
    console.log("Trend query success:", res1.rows.length);

    console.log("Testing Line Query...");
    const lineQuery = `
      WITH LineStart AS (
        SELECT 
          pl.id as line_id, 
          pl.name as line_name, 
          pl.client_id,
          c.name as client_name,
          COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
        FROM production_lines pl
        JOIN sites s ON pl.site_id = s.id
        JOIN clients c ON s.client_id = c.id
      ),
      TicketRelative AS (
        SELECT 
          t.line_id,
          ls.line_name,
          ls.client_id,
          ls.client_name,
          ls.start_date,
          (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
           EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int as month_index,
           t.reported_at
        FROM support_tickets t
        JOIN LineStart ls ON t.line_id = ls.line_id
        WHERE t.reported_at >= ls.start_date::timestamp with time zone
      )
      SELECT 
        line_id,
        line_name,
        client_id,
        client_name,
        start_date,
        COUNT(*) FILTER (WHERE month_index = 0) as first_month_tickets,
        COUNT(*) FILTER (WHERE month_index > 0) as subsequent_tickets,
        ROUND(COUNT(*) FILTER (WHERE month_index > 0)::numeric / NULLIF(MAX(month_index), 0), 2) as subsequent_avg,
        MAX(month_index) as months_since_start,
        COUNT(*) FILTER (WHERE reported_at >= NOW() - INTERVAL '30 days') as last_30d_tickets
      FROM TicketRelative
      GROUP BY line_id, line_name, client_id, client_name, start_date
      ORDER BY client_name ASC, line_name ASC;
    `;
    const res2 = await pool.query(lineQuery);
    console.log("Line query success:", res2.rows.length);

  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
