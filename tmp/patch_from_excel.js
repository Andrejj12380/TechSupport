import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const data = JSON.parse(fs.readFileSync('./tmp/excel_data.json', 'utf8'));

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function patch() {
  await client.connect();
  console.log('Connected to database');

  let clientsAdded = 0;
  let sitesAdded = 0;
  let linesAdded = 0;
  let linesUpdated = 0;

  for (const row of data) {
    const clientName = row['Клиент']?.trim();
    if (!clientName) continue;

    // 1. Get or create client
    let res = await client.query('SELECT id FROM clients WHERE name = $1', [clientName]);
    let clientId;
    if (res.rows.length === 0) {
      res = await client.query('INSERT INTO clients (name) VALUES ($1) RETURNING id', [clientName]);
      clientId = res.rows[0].id;
      clientsAdded++;
    } else {
      clientId = res.rows[0].id;
    }

    // 2. Get or create site
    const siteName = row['Площадка']?.trim() || 'Основная площадка';
    res = await client.query('SELECT id FROM sites WHERE client_id = $1 AND name = $2', [clientId, siteName]);
    let siteId;
    if (res.rows.length === 0) {
      res = await client.query('INSERT INTO sites (client_id, name) VALUES ($1, $2) RETURNING id', [clientId, siteName]);
      siteId = res.rows[0].id;
      sitesAdded++;
    } else {
      siteId = res.rows[0].id;
    }

    // 3. Get or create production line
    const lineName = row['Линия']?.trim();
    if (!lineName) continue;

    res = await client.query('SELECT id FROM production_lines WHERE site_id = $1 AND name = $2', [siteId, lineName]);
    let lineId;
    if (res.rows.length === 0) {
      res = await client.query('INSERT INTO production_lines (site_id, name) VALUES ($1, $2) RETURNING id', [siteId, lineName]);
      lineId = res.rows[0].id;
      linesAdded++;
    } else {
      lineId = res.rows[0].id;
    }

    // 4. Update support dates
    const warrantyStart = row['Начало гарантии (Линия)'];
    const paidStart = row['Начало платной ТП (Линия)'];
    const paidEnd = row['Окончание платной ТП (Линия)'];

    // Convert Excel date string (DD.MM.YYYY or DD-MM-YYYY) to YYYY-MM-DD
    const parseDate = (d) => {
      if (!d || d === 'Не указана' || d === '-' || d === 'Истекла') return null;
      const parts = d.toString().split(/[.-]/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    const wDate = parseDate(warrantyStart);
    const psDate = parseDate(paidStart);
    const peDate = parseDate(paidEnd);

    if (wDate || psDate || peDate) {
      await client.query(
        `UPDATE production_lines SET 
          warranty_start_date = COALESCE($1, warranty_start_date),
          paid_support_start_date = COALESCE($2, paid_support_start_date),
          paid_support_end_date = COALESCE($3, paid_support_end_date)
        WHERE id = $4`,
        [wDate, psDate, peDate, lineId]
      );
      linesUpdated++;
    }
  }

  console.log(`Patch completed:
  - Clients added: ${clientsAdded}
  - Sites added: ${sitesAdded}
  - Lines added: ${linesAdded}
  - Lines updated: ${linesUpdated}`);

  await client.end();
}

patch().catch(err => {
  console.error('Patch failed:', err);
  process.exit(1);
});
