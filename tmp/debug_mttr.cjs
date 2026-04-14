// Debug: find the MTTR peak and what tickets cause it
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function debug() {
  try {
    // 1. Get MTTR by month_index to find the peak
    const mttr = await pool.query(`
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
          t.problem_description,
          t.reported_at,
          t.resolved_at,
          t.total_work_minutes,
          t.status,
          COALESCE(NULLIF(t.total_work_minutes, 0) / 60.0, EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0) as resolution_hours,
          (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
           EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int as month_index
        FROM support_tickets t
        JOIN LineStart ls ON t.line_id = ls.line_id
        WHERE t.reported_at >= ls.start_date::timestamp with time zone
      )
      SELECT 
        month_index,
        COUNT(*) as ticket_count,
        ROUND(AVG(resolution_hours)::numeric, 1) as avg_resolution_hours
      FROM TicketRelative
      WHERE month_index >= 0 AND month_index <= 24
      GROUP BY month_index
      ORDER BY month_index ASC
    `);
    
    console.log('=== MTTR by month ===');
    mttr.rows.forEach(r => {
      const bar = '█'.repeat(Math.round(Number(r.avg_resolution_hours) / 10));
      console.log(`  M${r.month_index}: ${r.avg_resolution_hours}ч (${r.ticket_count} обращений) ${bar}`);
    });

    // Find the peak
    const peak = mttr.rows.reduce((max, r) => Number(r.avg_resolution_hours) > Number(max.avg_resolution_hours) ? r : max, mttr.rows[0]);
    console.log(`\n=== PEAK: M${peak.month_index} = ${peak.avg_resolution_hours}ч ===`);

    // 2. Show the actual tickets in that peak month
    const tickets = await pool.query(`
      WITH LineStart AS (
        SELECT 
          pl.id as line_id,
          pl.name as line_name,
          c.name as client_name,
          COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
        FROM production_lines pl
        JOIN sites s ON pl.site_id = s.id
        JOIN clients c ON s.client_id = c.id
      )
      SELECT 
        t.id,
        ls.client_name,
        ls.line_name,
        t.problem_description,
        t.reported_at,
        t.resolved_at,
        t.total_work_minutes,
        t.status,
        COALESCE(tc.name, 'Не указано') as category,
        ROUND(COALESCE(NULLIF(t.total_work_minutes, 0) / 60.0, EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)::numeric, 1) as hours
      FROM support_tickets t
      JOIN LineStart ls ON t.line_id = ls.line_id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
             EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int = $1
        AND t.reported_at >= ls.start_date::timestamp with time zone
      ORDER BY hours DESC NULLS LAST
    `, [peak.month_index]);

    console.log(`\nОбращения в M${peak.month_index}:`);
    tickets.rows.forEach(t => {
      console.log(`  #${t.id} | ${t.hours}ч | ${t.status} | ${t.category} | ${t.client_name} → ${t.line_name}`);
      console.log(`         ${t.problem_description.substring(0, 80)}`);
      console.log(`         reported: ${t.reported_at} → resolved: ${t.resolved_at || 'НЕ РЕШЕНО'}`);
      console.log(`         work_minutes: ${t.total_work_minutes || 'не указано'}`);
      console.log('');
    });

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

debug();
