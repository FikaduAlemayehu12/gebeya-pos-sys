import * as XLSX from 'xlsx';

/** Download a workbook as .xlsx in the browser. */
export function downloadWorkbook(rows: Record<string, any>[], fileName: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/** Parse uploaded .xlsx/.csv file into JSON rows. */
export async function parseSpreadsheet(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/** Standard product import template columns. */
export const PRODUCT_TEMPLATE_COLUMNS = [
  'name', 'name_am', 'category_slug', 'subcategory', 'sku', 'barcode',
  'unit', 'price', 'cost', 'stock', 'min_stock', 'reorder_point',
  'tax_rate', 'expiry_date', 'description',
];

export const PRODUCT_TEMPLATE_SAMPLE: Record<string, any> = {
  name: 'White Teff',
  name_am: 'ነጭ ጤፍ',
  category_slug: 'agriculture',
  subcategory: 'Teff',
  sku: 'TEFF-001',
  barcode: '6291041500213',
  unit: 'Quintal',
  price: 8500,
  cost: 7200,
  stock: 50,
  min_stock: 5,
  reorder_point: 10,
  tax_rate: 0,
  expiry_date: '',
  description: 'Premium white teff from Oromia region',
};

export const ASSET_TEMPLATE_COLUMNS = [
  'asset_code', 'name', 'category', 'subcategory', 'serial_number',
  'manufacturer', 'model', 'purchase_date', 'purchase_cost',
  'useful_life_years', 'condition', 'location',
];

export const ASSET_TEMPLATE_SAMPLE: Record<string, any> = {
  asset_code: 'AST-0001',
  name: 'Toyota Hilux',
  category: 'Vehicles',
  subcategory: 'Pickup',
  serial_number: 'JT123456789',
  manufacturer: 'Toyota',
  model: 'Hilux 2022',
  purchase_date: '2024-01-15',
  purchase_cost: 2500000,
  useful_life_years: 7,
  condition: 'good',
  location: 'Head Office',
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: Record<string, any>;
}

/** Lenient validation for product import rows. Returns parsed data + errors/warnings. */
export function validateProductRow(
  row: Record<string, any>,
  categoryMap: Map<string, string>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = String(row.name || '').trim();
  if (!name) errors.push('Missing required field: name');

  const slug = String(row.category_slug || '').trim().toLowerCase();
  let category_id: string | null = null;
  if (slug) {
    category_id = categoryMap.get(slug) || null;
    if (!category_id) warnings.push(`Unknown category slug "${slug}" — imported without category`);
  } else {
    warnings.push('No category_slug provided');
  }

  const price = Number(row.price);
  if (Number.isNaN(price) || price < 0) errors.push(`Invalid price: ${row.price}`);

  const stock = Number(row.stock || 0);
  if (Number.isNaN(stock)) errors.push(`Invalid stock: ${row.stock}`);

  const parsed = {
    name,
    name_am: String(row.name_am || '').trim(),
    category: slug || 'general',
    category_id,
    subcategory: String(row.subcategory || '').trim(),
    sku: String(row.sku || '').trim() || null,
    barcode: String(row.barcode || '').trim() || null,
    unit: String(row.unit || 'Piece').trim(),
    price: Number.isNaN(price) ? 0 : price,
    cost: Number(row.cost) || 0,
    stock: Number.isNaN(stock) ? 0 : stock,
    min_stock: Number(row.min_stock) || 0,
    reorder_point: Number(row.reorder_point) || 5,
    tax_rate: Number(row.tax_rate) || 0,
    expiry_date: row.expiry_date ? String(row.expiry_date) : null,
    description: String(row.description || '').trim(),
  };

  return { valid: errors.length === 0, errors, warnings, parsed };
}
