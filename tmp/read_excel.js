import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync('SupportDatesExport.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

fs.writeFileSync('tmp/excel_data.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully wrote tmp/excel_data.json');
