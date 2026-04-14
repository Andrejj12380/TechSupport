// Quick debug: run the category queries directly against DB
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
    // 1. Check basic data exists
    const ticketCount = await pool.query('SELECT COUNT(*) as cnt FROM support_tickets');
    console.log('Total tickets:', ticketCount.rows[0].cnt);

    const withCategory = await pool.query('SELECT COUNT(*) as cnt FROM support_tickets WHERE category_id IS NOT NULL');
    console.log('Tickets with category:', withCategory.rows[0].cnt);

    const withLine = await pool.query('SELECT COUNT(*) as cnt FROM support_tickets WHERE line_id IS NOT NULL');
    console.log('Tickets with line_id:', withLine.rows[0].cnt);

    const withReported = await pool.query('SELECT COUNT(*) as cnt FROM support_tickets WHERE reported_at IS NOT NULL');
    console.log('Tickets with reported_at:', withReported.rows[0].cnt);

    // 2. Check categories exist
    const cats = await pool.query('SELECT id, name FROM ticket_categories ORDER BY sort_order');
    console.log('\nCategories:', cats.rows.map(r => `${r.id}:${r.name}`).join(', '));

    // 3. Check lines have start dates
    const linesWithDates = await pool.query(`
      SELECT pl.id, pl.name, 
        COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
      FROM production_lines pl
      JOIN sites s ON pl.site_id = s.id
      JOIN clients c ON s.client_id = c.id
      LIMIT 5
    `);
    console.log('\nSample lines with start_date:');
    linesWithDates.rows.forEach(r => console.log(`  ${r.name}: start=${r.start_date}`));

    // 4. Try the lifecycle query
    console.log('\n--- Testing categoryByLifecycle query ---');
    const lifecycleResult = await pool.query(`
      WITH LineStart AS (
        SELECT 
          pl.id as line_id, 
          COALESCE(pl.warranty_start_date, pl.paid_support_start_date, c.warranty_start_date, c.paid_support_start_date, c.created_at::date) as start_date
        FROM production_lines pl
        JOIN sites s ON pl.site_id = s.id
        JOIN clients c ON s.client_id = c.id
      ),
      TicketCat AS (
        SELECT 
          t.line_id,
          COALESCE(tc.name, 'Не указано') as category_name,
          (EXTRACT(YEAR FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)) * 12 + 
           EXTRACT(MONTH FROM AGE(t.reported_at, ls.start_date::timestamp with time zone)))::int as month_index
        FROM support_tickets t
        JOIN LineStart ls ON t.line_id = ls.line_id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        WHERE t.reported_at >= ls.start_date::timestamp with time zone
      ),
      TopCats AS (
        SELECT category_name, COUNT(*) as total
        FROM TicketCat WHERE month_index >= 0 AND month_index <= 24
        GROUP BY category_name ORDER BY total DESC LIMIT 5
      ),
      Labeled AS (
        SELECT 
          month_index,
          CASE WHEN tc.category_name IS NOT NULL THEN t.category_name ELSE 'Прочее' END as category_name,
          t.line_id
        FROM TicketCat t
        LEFT JOIN TopCats tc ON t.category_name = tc.category_name
        WHERE t.month_index >= 0 AND t.month_index <= 24
      )
      SELECT 
        month_index,
        category_name,
        COUNT(*) as ticket_count,
        COUNT(DISTINCT line_id) as active_lines,
        ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT line_id), 0), 2) as avg_per_line
      FROM Labeled
      GROUP BY month_index, category_name
      ORDER BY month_index ASC, ticket_count DESC;
    `);
    console.log('Lifecycle rows:', lifecycleResult.rows.length);
    if (lifecycleResult.rows.length > 0) {
      console.log('Sample:', lifecycleResult.rows.slice(0, 5));
    }

    // 5. Try the calendar query
    console.log('\n--- Testing categoryByCalendar query ---');
    const calendarResult = await pool.query(`
      WITH TopCats AS (
        SELECT COALESCE(tc.name, 'Не указано') as category_name, COUNT(*) as total
        FROM support_tickets t
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        GROUP BY category_name ORDER BY total DESC LIMIT 5
      ),
      Labeled AS (
        SELECT 
          TO_CHAR(t.reported_at, 'YYYY-MM') as calendar_month,
          CASE WHEN tc2.category_name IS NOT NULL 
               THEN COALESCE(tc.name, 'Не указано') 
               ELSE 'Прочее' END as category_name
        FROM support_tickets t
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        LEFT JOIN TopCats tc2 ON COALESCE(tc.name, 'Не указано') = tc2.category_name
        WHERE t.reported_at IS NOT NULL
      )
      SELECT 
        calendar_month,
        category_name,
        COUNT(*) as ticket_count
      FROM Labeled
      GROUP BY calendar_month, category_name
      ORDER BY calendar_month ASC, ticket_count DESC;
    `);
    console.log('Calendar rows:', calendarResult.rows.length);
    if (calendarResult.rows.length > 0) {
      console.log('Sample:', calendarResult.rows.slice(0, 5));
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

debug();
