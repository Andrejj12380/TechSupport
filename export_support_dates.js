import pkg from 'pg';
const { Pool, types } = pkg;
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Force DATE (1082) to be returned as string, avoiding timezone shifts
types.setTypeParser(1082, val => val);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const query = `
WITH line_status AS (
    SELECT 
        c.name AS "Клиент",
        s.name AS "Площадка",
        pl.name AS "Линия",
        pl.warranty_start_date,
        pl.paid_support_start_date,
        pl.paid_support_end_date,
        c.paid_support_end_date AS client_paid_support_end_date,
        -- Calculate support end based on warranty: 12 months for pre-2026, 2 months for 2026+
        CASE 
            WHEN pl.warranty_start_date IS NULL THEN NULL
            WHEN EXTRACT(YEAR FROM pl.warranty_start_date) >= 2026 
                THEN pl.warranty_start_date + INTERVAL '2 months'
            ELSE pl.warranty_start_date + INTERVAL '12 months'
        END AS warranty_support_end
    FROM clients c
    LEFT JOIN sites s ON s.client_id = c.id
    LEFT JOIN production_lines pl ON pl.site_id = s.id
)
SELECT 
    "Клиент",
    "Площадка",
    "Линия",
    warranty_start_date AS "Начало гарантии (Линия)",
    paid_support_start_date AS "Начало платной ТП (Линия)",
    paid_support_end_date AS "Окончание платной ТП (Линия)",
    CASE 
        -- 1. Paid support active (highest priority)
        WHEN (paid_support_start_date IS NOT NULL AND paid_support_end_date IS NOT NULL 
              AND CURRENT_DATE >= paid_support_start_date AND CURRENT_DATE <= paid_support_end_date)
             OR (client_paid_support_end_date IS NOT NULL AND CURRENT_DATE <= client_paid_support_end_date) -- Simplification for client level
             THEN 'Активна'
        
        -- 2. Warranty support active (Emerald in UI)
        WHEN warranty_start_date IS NOT NULL AND warranty_support_end IS NOT NULL 
             AND CURRENT_DATE >= warranty_start_date AND CURRENT_DATE <= warranty_support_end 
             THEN 'Активна'
             
        -- 3. Expired
        WHEN (paid_support_end_date IS NOT NULL AND CURRENT_DATE > paid_support_end_date)
             OR (warranty_support_end IS NOT NULL AND CURRENT_DATE > warranty_support_end)
             OR (client_paid_support_end_date IS NOT NULL AND CURRENT_DATE > client_paid_support_end_date)
             THEN 'Истекла'
             
        -- 4. Not specified / Not yet active
        ELSE 'Не указана'
    END AS "Статус техподдержки"
FROM line_status
ORDER BY "Клиент", "Площадка", "Линия";
`;

async function exportToExcel() {
    try {
        console.log('Connecting to database...');
        const result = await pool.query(query);
        console.log(`Fetched ${result.rows.length} rows.`);

        if (result.rows.length === 0) {
            console.log('No data found to export.');
            await pool.end();
            return;
        }

        // Format dates to DD-MM-YYYY
        const formattedRows = result.rows.map(row => {
            const newRow = { ...row };
            Object.keys(newRow).forEach(key => {
                const val = newRow[key];
                // Check if it's a date string (YYYY-MM-DD)
                if (val && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    const [y, m, d] = val.split('-');
                    newRow[key] = `${d}-${m}-${y}`;
                }
            });
            return newRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(formattedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SupportDates");

        // Auto-size columns (rough implementation)
        const maxWidths = {};
        formattedRows.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = String(row[key] || '');
                maxWidths[key] = Math.max(maxWidths[key] || 0, val.length + 2, key.length + 2);
            });
        });
        worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: maxWidths[key] }));

        const fileName = 'SupportDatesExport.xlsx';
        const filePath = path.join(__dirname, fileName);

        XLSX.writeFile(workbook, filePath);
        console.log(`Export successful! File saved at: ${filePath}`);

        await pool.end();
    } catch (err) {
        console.error('Error during export:', err);
        process.exit(1);
    }
}

exportToExcel();
