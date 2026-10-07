import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const file = path.join(process.cwd(), 'docs', 'memento.xlsx');
console.log('Lendo:', file);
const wb = XLSX.readFile(file);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(ws);
  const outPath = path.join(process.cwd(), 'docs', `${sheetName}.csv`);
  fs.writeFileSync(outPath, csv, 'utf-8');
  console.log(`Exportado: ${sheetName}.csv (${csv.length} bytes)`);
});
