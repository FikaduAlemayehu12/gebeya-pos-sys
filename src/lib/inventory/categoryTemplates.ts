/**
 * Built-in field templates per category slug.
 * These are merged with DB overrides from `category_field_schemas`.
 * Hybrid model: code defines defaults; admins can override per category at runtime.
 */

export type FieldType =
  | 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean' | 'currency';

export interface CustomField {
  key: string;        // stored under products.attributes[key]
  label: string;
  labelAm?: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for select
  placeholder?: string;
  helper?: string;
}

export interface CategoryTemplate {
  defaultUnit?: string;
  defaultTaxRate?: number;       // %
  trackExpiry?: boolean;
  trackBatch?: boolean;
  trackSerial?: boolean;
  trackWarranty?: boolean;
  defaultWarrantyMonths?: number;
  defaultReorderPoint?: number;
  storageConditions?: string;
  subcategories?: string[];
  customFields?: CustomField[];
  /** Suggested keywords on the standard product fields */
  hints?: string[];
  /** Product-name suggestions, keyed by subcategory (or "_default" when no sub picked) */
  productNameSuggestions?: Record<string, string[]>;
}

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  agriculture: {
    defaultUnit: 'Quintal',
    defaultTaxRate: 0,
    defaultReorderPoint: 10,
    subcategories: ['Teff', 'Wheat', 'Barley', 'Maize', 'Coffee Beans', 'Sesame', 'Spices', 'Vegetables', 'Fruits'],
    productNameSuggestions: {
      'Teff': ['White Teff (Magna)', 'Red Teff (Quey)', 'Mixed Teff (Sergegna)', 'Bunign Teff'],
      'Wheat': ['Soft Wheat', 'Hard Wheat (Durum)', 'Bread Wheat', 'Whole Wheat'],
      'Barley': ['Food Barley', 'Malt Barley', 'Hulless Barley'],
      'Maize': ['Yellow Maize', 'White Maize', 'Hybrid Maize'],
      'Coffee Beans': ['Yirgacheffe', 'Sidamo', 'Harrar', 'Limu', 'Jimma', 'Guji', 'Washed Arabica', 'Natural Arabica'],
      'Sesame': ['White Sesame (Humera)', 'Mixed Sesame (Wollega)'],
      'Spices': ['Berbere', 'Mitmita', 'Korerima', 'Black Cumin (Tikur Azmud)', 'Turmeric', 'Ginger', 'Garlic Powder'],
      'Vegetables': ['Tomato', 'Onion', 'Potato', 'Carrot', 'Cabbage', 'Pepper', 'Lettuce', 'Spinach'],
      'Fruits': ['Banana', 'Mango', 'Avocado', 'Orange', 'Papaya', 'Pineapple', 'Apple', 'Lemon'],
    },
    customFields: [
      { key: 'origin_region', label: 'Origin Region', type: 'text', placeholder: 'e.g. Oromia, Sidama' },
      { key: 'harvest_date', label: 'Harvest Date', type: 'date' },
      { key: 'grade', label: 'Grade', type: 'select', options: ['Grade 1', 'Grade 2', 'Grade 3', 'Premium'] },
    ],
  },
  pharmacy: {
    defaultUnit: 'Piece',
    defaultTaxRate: 0,
    trackExpiry: true,
    trackBatch: true,
    defaultReorderPoint: 20,
    storageConditions: 'Cool, dry place below 25°C',
    subcategories: ['Tablets', 'Capsules', 'Syrup', 'Injection', 'Cream', 'Drops', 'Antibiotics', 'Vitamins'],
    productNameSuggestions: {
      'Tablets': ['Paracetamol 500mg', 'Ibuprofen 400mg', 'Aspirin 100mg', 'Metformin 500mg', 'Amlodipine 5mg'],
      'Capsules': ['Amoxicillin 500mg', 'Omeprazole 20mg', 'Doxycycline 100mg', 'Fluconazole 150mg'],
      'Syrup': ['Cough Syrup', 'Paracetamol Syrup', 'Iron Syrup', 'Vitamin C Syrup'],
      'Injection': ['Ceftriaxone 1g', 'Insulin', 'Diclofenac Injection', 'Vitamin B12 Injection'],
      'Cream': ['Hydrocortisone Cream', 'Antifungal Cream', 'Antibiotic Cream'],
      'Drops': ['Eye Drops', 'Ear Drops', 'Nasal Drops'],
      'Antibiotics': ['Amoxicillin 500mg', 'Azithromycin 500mg', 'Ciprofloxacin 500mg', 'Metronidazole 400mg'],
      'Vitamins': ['Vitamin C 1000mg', 'Vitamin D3', 'Multivitamin', 'Iron + Folic Acid', 'Zinc Tablets'],
    },
    customFields: [
      { key: 'batch_number', label: 'Batch Number', type: 'text', required: true },
      { key: 'dosage', label: 'Dosage', type: 'text', placeholder: 'e.g. 500mg' },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'prescription_required', label: 'Prescription Required', type: 'boolean' },
      { key: 'active_ingredient', label: 'Active Ingredient', type: 'text' },
    ],
  },
  'medical-equipment': {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 12,
    defaultReorderPoint: 2,
    customFields: [
      { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'calibration_date', label: 'Last Calibration', type: 'date' },
    ],
  },
  laboratory: {
    defaultUnit: 'Piece',
    trackExpiry: true,
    trackBatch: true,
    storageConditions: 'Refrigerated 2-8°C where applicable',
    customFields: [
      { key: 'reagent_grade', label: 'Reagent Grade', type: 'select', options: ['Analytical', 'Reagent', 'Technical', 'USP'] },
      { key: 'cas_number', label: 'CAS Number', type: 'text' },
    ],
  },
  'it-equipment': {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 24,
    defaultReorderPoint: 2,
    subcategories: ['Laptops', 'Desktops', 'Servers', 'Monitors', 'Printers', 'Networking', 'Storage', 'Accessories'],
    customFields: [
      { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text', placeholder: 'HP, Dell, Lenovo...' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'specifications', label: 'Specifications', type: 'textarea' },
    ],
  },
  electronics: {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 12,
    defaultReorderPoint: 5,
    subcategories: ['Phones', 'TVs', 'Audio', 'Cameras', 'Cables', 'Chargers', 'Speakers', 'Accessories'],
    productNameSuggestions: {
      'Phones': ['Samsung Galaxy A14', 'Tecno Spark 10', 'iPhone 13', 'Infinix Hot 30', 'Xiaomi Redmi Note 12'],
      'TVs': ['Samsung 43" Smart TV', 'LG 32" LED TV', 'Sony Bravia 50"', 'Hisense 55" 4K'],
      'Audio': ['JBL Speaker', 'Bluetooth Headphones', 'Sound Bar', 'Earbuds'],
      'Cameras': ['Canon EOS', 'Nikon DSLR', 'Sony Mirrorless', 'GoPro Hero'],
      'Cables': ['HDMI Cable', 'USB-C Cable', 'Lightning Cable', 'Aux Cable'],
      'Chargers': ['Fast Charger 25W', 'Wireless Charger', 'Power Bank 10000mAh', 'Car Charger'],
      'Speakers': ['Bluetooth Speaker', 'Home Theater', 'Portable Speaker'],
      'Accessories': ['Phone Case', 'Screen Protector', 'Memory Card', 'Tripod'],
    },
    customFields: [
      { key: 'serial_number', label: 'Serial Number / IMEI', type: 'text' },
      { key: 'manufacturer', label: 'Brand', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
    ],
  },
  machinery: {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 24,
    defaultReorderPoint: 1,
    customFields: [
      { key: 'serial_number', label: 'Serial Number', type: 'text', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'power_rating', label: 'Power Rating', type: 'text' },
      { key: 'maintenance_interval', label: 'Maintenance Interval (days)', type: 'number' },
    ],
  },
  vehicles: {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 36,
    defaultReorderPoint: 1,
    subcategories: ['Cars', 'Trucks', 'Motorcycles', 'Buses', 'Pickups', 'Spare Parts'],
    productNameSuggestions: {
      'Cars': ['Toyota Corolla', 'Toyota Vitz', 'Hyundai Accent', 'Kia Picanto', 'Suzuki Dzire'],
      'Trucks': ['Isuzu FSR', 'Sino Truck Howo', 'FAW Tipper', 'Mitsubishi Canter'],
      'Motorcycles': ['Bajaj Boxer', 'TVS Star', 'Yamaha Crux', 'Honda CB125'],
      'Buses': ['Toyota Coaster', 'Higer Bus', 'Yutong Bus', 'King Long'],
      'Pickups': ['Toyota Hilux', 'Isuzu D-Max', 'Mitsubishi L200', 'Ford Ranger'],
      'Spare Parts': ['Brake Pad', 'Engine Oil', 'Air Filter', 'Tire', 'Battery', 'Spark Plug'],
    },
    customFields: [
      { key: 'chassis_number', label: 'Chassis Number (VIN)', type: 'text', required: true },
      { key: 'engine_number', label: 'Engine Number', type: 'text', required: true },
      { key: 'registration_number', label: 'Plate / Registration', type: 'text' },
      { key: 'year_manufactured', label: 'Year', type: 'number' },
      { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'] },
      { key: 'mileage_km', label: 'Mileage (km)', type: 'number' },
    ],
  },
  furniture: {
    defaultUnit: 'Piece',
    defaultReorderPoint: 3,
    subcategories: ['Sofas', 'Beds', 'Tables', 'Chairs', 'Wardrobes', 'Office Furniture'],
    productNameSuggestions: {
      'Sofas': ['3-Seater Sofa', 'L-Shape Sectional', 'Recliner Sofa', 'Loveseat'],
      'Beds': ['King Size Bed', 'Queen Size Bed', 'Single Bed', 'Bunk Bed'],
      'Tables': ['Dining Table', 'Coffee Table', 'Office Desk', 'Side Table'],
      'Chairs': ['Office Chair', 'Dining Chair', 'Plastic Chair', 'Bar Stool'],
      'Wardrobes': ['3-Door Wardrobe', '4-Door Wardrobe', 'Sliding Wardrobe'],
      'Office Furniture': ['Executive Desk', 'Filing Cabinet', 'Conference Table', 'Reception Counter'],
    },
    customFields: [
      { key: 'material', label: 'Material', type: 'text', placeholder: 'Wood, Metal, Fabric' },
      { key: 'dimensions', label: 'Dimensions (LxWxH)', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
    ],
  },
  dairy: {
    defaultUnit: 'Liter',
    defaultTaxRate: 0,
    trackExpiry: true,
    trackBatch: true,
    defaultReorderPoint: 20,
    storageConditions: 'Cold storage 2-8°C',
    subcategories: ['Fresh Milk', 'Yogurt', 'Cheese', 'Butter', 'Ayib', 'Ergo', 'Cream'],
    productNameSuggestions: {
      'Fresh Milk': ['Whole Milk 1L', 'Skim Milk 1L', 'Family Milk 2L', 'Lame Milk 500ml'],
      'Yogurt': ['Plain Yogurt', 'Strawberry Yogurt', 'Vanilla Yogurt', 'Greek Yogurt'],
      'Cheese': ['Mozzarella', 'Cheddar', 'Cream Cheese', 'Cottage Cheese'],
      'Butter': ['Salted Butter', 'Unsalted Butter', 'Niter Kibbeh (Spiced)'],
      'Ayib': ['Fresh Ayib', 'Aged Ayib'],
      'Ergo': ['Plain Ergo', 'Sweet Ergo'],
      'Cream': ['Whipping Cream', 'Sour Cream', 'Heavy Cream'],
    },
    customFields: [
      { key: 'fat_content', label: 'Fat Content %', type: 'number' },
      { key: 'pasteurized', label: 'Pasteurized', type: 'boolean' },
    ],
  },
  'food-beverage': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackExpiry: true,
    defaultReorderPoint: 15,
    customFields: [
      { key: 'ingredients', label: 'Ingredients', type: 'textarea' },
      { key: 'allergens', label: 'Allergens', type: 'text' },
    ],
  },
  alcohol: {
    defaultUnit: 'Piece',
    defaultTaxRate: 50,
    defaultReorderPoint: 12,
    subcategories: ['Beer', 'Wine', 'Whiskey', 'Vodka', 'Gin', 'Local Tej/Tella'],
    customFields: [
      { key: 'alcohol_percent', label: 'Alcohol %', type: 'number', required: true },
      { key: 'volume_ml', label: 'Volume (ml)', type: 'number' },
      { key: 'origin_country', label: 'Country of Origin', type: 'text' },
    ],
  },
  'packed-foods': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackExpiry: true,
    trackBatch: true,
    defaultReorderPoint: 15,
    customFields: [
      { key: 'package_size', label: 'Package Size', type: 'text' },
      { key: 'allergens', label: 'Allergens', type: 'text' },
    ],
  },
  'street-foods': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    defaultReorderPoint: 0,
    customFields: [
      { key: 'preparation_time_min', label: 'Prep Time (min)', type: 'number' },
    ],
  },
  'traditional-food': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    subcategories: ['Doro Wat', 'Tibs', 'Kitfo', 'Shiro', 'Injera', 'Dulet', 'Beyaynetu'],
    customFields: [
      { key: 'spice_level', label: 'Spice Level', type: 'select', options: ['Mild', 'Medium', 'Hot', 'Extra Hot'] },
      { key: 'fasting_friendly', label: 'Fasting (Tsom)', type: 'boolean' },
    ],
  },
  'european-menu': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    subcategories: ['Pasta', 'Pizza', 'Steak', 'Salads', 'Soups', 'Desserts'],
    customFields: [
      { key: 'cuisine', label: 'Cuisine', type: 'select', options: ['Italian', 'French', 'German', 'Spanish', 'British'] },
      { key: 'vegetarian', label: 'Vegetarian', type: 'boolean' },
    ],
  },
  'hotel-services': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'service_duration', label: 'Duration', type: 'text', placeholder: 'e.g. per night, per hour' },
      { key: 'room_type', label: 'Room/Service Type', type: 'text' },
    ],
  },
  restaurant: {
    defaultUnit: 'Piece',
    defaultReorderPoint: 10,
    customFields: [
      { key: 'station', label: 'Kitchen Station', type: 'select', options: ['Hot', 'Cold', 'Bar', 'Pastry', 'Grill'] },
    ],
  },
  bakery: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackExpiry: true,
    defaultReorderPoint: 20,
    subcategories: ['Bread', 'Cakes', 'Pastries', 'Cookies', 'Donuts', 'Muffins'],
    customFields: [
      { key: 'baked_date', label: 'Baked Date', type: 'date' },
      { key: 'shelf_life_days', label: 'Shelf Life (days)', type: 'number' },
    ],
  },
  supermarket: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    defaultReorderPoint: 10,
    trackExpiry: true,
  },
  cosmetics: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackExpiry: true,
    trackBatch: true,
    subcategories: ['Skincare', 'Makeup', 'Hair Care', 'Fragrance', 'Nail Care'],
    customFields: [
      { key: 'volume_ml', label: 'Volume (ml)', type: 'number' },
      { key: 'skin_type', label: 'Skin Type', type: 'select', options: ['All', 'Dry', 'Oily', 'Sensitive', 'Combination'] },
    ],
  },
  clothing: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    subcategories: ['Men', 'Women', 'Kids', 'Traditional', 'Sportswear'],
    customFields: [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Unisex', 'Kids'] },
    ],
  },
  'shoes-bags': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'material', label: 'Material', type: 'text' },
    ],
  },
  construction: {
    defaultUnit: 'Quintal',
    defaultTaxRate: 15,
    defaultReorderPoint: 5,
    subcategories: ['Cement', 'Iron Bars', 'Bricks', 'Sand', 'Tiles', 'Paint', 'Wood'],
    customFields: [
      { key: 'grade', label: 'Grade/Class', type: 'text' },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
    ],
  },
  hardware: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'tool_type', label: 'Tool Type', type: 'text' },
    ],
  },
  'raw-materials': {
    defaultUnit: 'kg',
    defaultTaxRate: 15,
    trackBatch: true,
    customFields: [
      { key: 'purity_percent', label: 'Purity %', type: 'number' },
      { key: 'origin', label: 'Origin', type: 'text' },
    ],
  },
  textile: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'fabric_type', label: 'Fabric Type', type: 'text' },
      { key: 'width_cm', label: 'Width (cm)', type: 'number' },
    ],
  },
  printing: {
    defaultUnit: 'Piece',
    customFields: [
      { key: 'paper_size', label: 'Paper Size', type: 'select', options: ['A0','A1','A2','A3','A4','A5','Letter','Legal'] },
      { key: 'gsm', label: 'GSM', type: 'number' },
    ],
  },
  education: {
    defaultUnit: 'Piece',
    defaultTaxRate: 0,
    customFields: [
      { key: 'grade_level', label: 'Grade Level', type: 'text' },
    ],
  },
  books: {
    defaultUnit: 'Piece',
    defaultTaxRate: 0,
    customFields: [
      { key: 'isbn', label: 'ISBN', type: 'text' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'publisher', label: 'Publisher', type: 'text' },
      { key: 'language', label: 'Language', type: 'text' },
    ],
  },
  sports: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'sport_type', label: 'Sport', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
    ],
  },
  jewelry: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackSerial: true,
    customFields: [
      { key: 'material', label: 'Material', type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Diamond', 'Other'] },
      { key: 'karat', label: 'Karat / Purity', type: 'text' },
      { key: 'weight_grams', label: 'Weight (g)', type: 'number' },
    ],
  },
  telecom: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackSerial: true,
    customFields: [
      { key: 'imei', label: 'IMEI', type: 'text' },
      { key: 'sim_type', label: 'SIM Type', type: 'text' },
    ],
  },
  utilities: {
    defaultUnit: 'Piece',
    customFields: [
      { key: 'service_period', label: 'Service Period', type: 'text', placeholder: 'monthly, yearly' },
    ],
  },
  cleaning: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
  },
  laundry: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
  },
  fuel: {
    defaultUnit: 'Liter',
    defaultTaxRate: 0,
    storageConditions: 'Underground tanks; flammable',
    customFields: [
      { key: 'octane_rating', label: 'Octane / Cetane', type: 'text' },
    ],
  },
  water: {
    defaultUnit: 'Liter',
    defaultTaxRate: 0,
  },
  security: {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 24,
  },
  events: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
  },
  rental: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    customFields: [
      { key: 'rental_period', label: 'Rental Period', type: 'select', options: ['Hourly', 'Daily', 'Weekly', 'Monthly'] },
      { key: 'security_deposit', label: 'Security Deposit (ETB)', type: 'currency' },
    ],
  },
  baby: {
    defaultUnit: 'Piece',
    defaultTaxRate: 0,
    trackExpiry: true,
    customFields: [
      { key: 'age_range', label: 'Age Range', type: 'text', placeholder: '0-6 months' },
    ],
  },
  pet: {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    trackExpiry: true,
    customFields: [
      { key: 'pet_type', label: 'Pet Type', type: 'select', options: ['Dog', 'Cat', 'Bird', 'Fish', 'Other'] },
    ],
  },
  'agri-equipment': {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 24,
  },
  wholesale: {
    defaultUnit: 'Piece',
    defaultReorderPoint: 50,
  },
  'import-export': {
    defaultUnit: 'Piece',
    customFields: [
      { key: 'hs_code', label: 'HS Code', type: 'text' },
      { key: 'country_of_origin', label: 'Country of Origin', type: 'text' },
      { key: 'declaration_number', label: 'Customs Declaration #', type: 'text' },
    ],
  },
  assets: {
    defaultUnit: 'Piece',
    trackSerial: true,
    trackWarranty: true,
    defaultWarrantyMonths: 12,
  },
  'general-goods': {
    defaultUnit: 'Piece',
    defaultTaxRate: 15,
    defaultReorderPoint: 10,
  },
};

/** Merge built-in template with DB override row. DB values win when not null. */
export function mergeTemplate(
  base: CategoryTemplate | undefined,
  override: any | null | undefined
): CategoryTemplate {
  const b = base || {};
  if (!override) return b;
  return {
    ...b,
    defaultUnit: override.default_unit ?? b.defaultUnit,
    defaultTaxRate: override.default_tax_rate ?? b.defaultTaxRate,
    trackExpiry: override.track_expiry ?? b.trackExpiry,
    trackBatch: override.track_batch ?? b.trackBatch,
    trackSerial: override.track_serial ?? b.trackSerial,
    trackWarranty: override.track_warranty ?? b.trackWarranty,
    defaultWarrantyMonths: override.default_warranty_months ?? b.defaultWarrantyMonths,
    defaultReorderPoint: override.default_reorder_point ?? b.defaultReorderPoint,
    storageConditions: override.storage_conditions ?? b.storageConditions,
    customFields: Array.isArray(override.custom_fields) && override.custom_fields.length > 0
      ? override.custom_fields
      : b.customFields,
  };
}
