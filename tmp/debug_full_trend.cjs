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
    const trendData = await pool.query(`
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
          t.id,
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
    `);

    let totalTicketsCounted = 0;
    
    console.log("=== Полный расчет Тренда Обращений ===");
    console.log("Месяц\tТикетов (Σ)\tВовлечено линий (U)\tРасчет (Σ/U = Среднее)");
    console.log("-".repeat(70));
    
    trendData.rows.forEach(r => {
      totalTicketsCounted += parseInt(r.ticket_count);
      console.log(`M${r.month_index}\t${r.ticket_count}\t\t${r.active_lines}\t\t\t${r.ticket_count} / ${r.active_lines} = ${r.avg_tickets_per_line}`);
    });
    
    console.log("-".repeat(70));
    console.log(`Всего обращений, попавших в корзины: ${totalTicketsCounted} из 114`);
    
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
