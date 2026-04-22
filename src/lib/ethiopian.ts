// Ethiopian Birr currency formatter and utilities

export const formatETB = (amount: number): string => {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPhone = (phone: string): string => {
  if (phone.startsWith('+251')) return phone;
  if (phone.startsWith('0')) return `+251${phone.slice(1)}`;
  return `+251${phone}`;
};

// Ethiopian calendar approximate conversion (simplified)
export const toEthiopianDate = (date: Date): string => {
  const gcYear = date.getFullYear();
  const gcMonth = date.getMonth() + 1;
  const gcDay = date.getDate();
  
  // Simplified offset (Ethiopian calendar is ~7-8 years behind Gregorian)
  let etYear = gcYear - 8;
  let etMonth = gcMonth - 4; // rough offset
  let etDay = gcDay;
  
  if (gcMonth >= 9 && gcDay >= 11) {
    etYear = gcYear - 7;
    etMonth = 1;
    etDay = gcDay - 10;
  }
  
  if (etMonth <= 0) etMonth += 13;
  if (etDay <= 0) etDay = 1;
  
  const months = ['መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'];
  
  return `${months[Math.min(etMonth - 1, 12)]} ${etDay}, ${etYear}`;
};

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash / ጥሬ ገንዘብ', icon: 'Banknote' },
  { id: 'telebirr', label: 'Telebirr', icon: 'Smartphone' },
  { id: 'cbe_birr', label: 'CBE Birr', icon: 'CreditCard' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: 'Building2' },
  { id: 'credit', label: 'Credit / ወዳጅ', icon: 'HandCoins' },
] as const;

export const ETHIOPIAN_UNITS = [
  'kg', 'g', 'Ferenji', 'Saharien', 'Birchiko', 'Tassa', 'Kabis', 
  'Melekiya', 'Sini', 'Efugn', 'Piece', 'Bundle/Guso', 'Dozen/Dizen', 'Liter', 'Quintal'
] as const;

export const PRODUCT_CATEGORIES = [
  'Teff', 'Wheat', 'Barley', 'Coffee', 'Berbere', 'Shiro', 'Mitmita',
  'Oil & Fats', 'Sugar', 'Salt', 'Rice', 'Pasta', 'Beverages', 
  'Dairy', 'Meat', 'Vegetables', 'Fruits', 'Household', 'Religious Items',
  'Electronics', 'Clothing', 'Cosmetics', 'Stationery', 'Other'
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['id'];
export type EthiopianUnit = typeof ETHIOPIAN_UNITS[number];
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
