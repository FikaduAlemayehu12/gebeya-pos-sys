// Ethiopian Payroll Calculator
// Per Income Tax (Amendment) Proclamation No. 1395/2025 — effective July 1, 2025
// Pension per Private Organization Employees Pension Proclamation No. 1268/2022

export interface PayrollInput {
  base_salary: number;
  transport_allowance?: number;   // Tax-exempt up to 2,200 ETB per Ethiopian rules
  housing_allowance?: number;
  position_allowance?: number;
  other_allowance?: number;
  overtime_amount?: number;
  bonus?: number;
  loan_deduction?: number;
  other_deductions?: number;
}

export interface PayrollResult {
  base_salary: number;
  transport_allowance: number;
  housing_allowance: number;
  position_allowance: number;
  other_allowance: number;
  overtime_amount: number;
  bonus: number;
  gross_pay: number;
  taxable_income: number;
  paye_tax: number;
  employee_pension: number;   // 7%
  employer_pension: number;   // 11%
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  bracket_breakdown: Array<{ band: string; rate: number; tax: number }>;
}

// Transport allowance tax-exemption cap (ETB / month)
export const TRANSPORT_EXEMPT_CAP = 2200;

// Pension rates per Proclamation 1268/2022
export const EMPLOYEE_PENSION_RATE = 0.07;
export const EMPLOYER_PENSION_RATE = 0.11;

/**
 * Ethiopian PAYE brackets per Proclamation 1395/2025 (effective July 1, 2025)
 *  0       - 2,000   : 0%
 *  2,001   - 4,000   : 15%
 *  4,001   - 7,000   : 20%
 *  7,001   - 10,000  : 25%
 *  10,001  - 14,000  : 30%
 *  14,001  +         : 35%
 */
export const PAYE_BRACKETS: Array<{ from: number; to: number; rate: number; label: string }> = [
  { from: 0,      to: 2000,        rate: 0.00, label: '0 – 2,000' },
  { from: 2000,   to: 4000,        rate: 0.15, label: '2,001 – 4,000' },
  { from: 4000,   to: 7000,        rate: 0.20, label: '4,001 – 7,000' },
  { from: 7000,   to: 10000,       rate: 0.25, label: '7,001 – 10,000' },
  { from: 10000,  to: 14000,       rate: 0.30, label: '10,001 – 14,000' },
  { from: 14000,  to: Infinity,    rate: 0.35, label: '14,001+' },
];

export function calculatePAYE(taxableIncome: number) {
  let remaining = Math.max(0, taxableIncome);
  let total = 0;
  const breakdown: Array<{ band: string; rate: number; tax: number }> = [];

  for (const b of PAYE_BRACKETS) {
    if (taxableIncome <= b.from) break;
    const slice = Math.min(taxableIncome, b.to) - b.from;
    if (slice <= 0) continue;
    const tax = slice * b.rate;
    total += tax;
    breakdown.push({ band: b.label, rate: b.rate, tax });
    remaining -= slice;
  }
  return { total, breakdown };
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const base_salary       = +(input.base_salary || 0);
  const transport         = +(input.transport_allowance || 0);
  const housing           = +(input.housing_allowance || 0);
  const position          = +(input.position_allowance || 0);
  const other_allow       = +(input.other_allowance || 0);
  const overtime_amount   = +(input.overtime_amount || 0);
  const bonus             = +(input.bonus || 0);
  const loan_deduction    = +(input.loan_deduction || 0);
  const other_deductions  = +(input.other_deductions || 0);

  const gross_pay = base_salary + transport + housing + position + other_allow + overtime_amount + bonus;

  // Tax-exempt portion of transport allowance
  const transport_exempt = Math.min(transport, TRANSPORT_EXEMPT_CAP);

  // Taxable income excludes the exempt transport amount
  const taxable_income = Math.max(0, gross_pay - transport_exempt);

  const paye = calculatePAYE(taxable_income);
  // Pension applies to base salary only (Ethiopian standard)
  const employee_pension = +(base_salary * EMPLOYEE_PENSION_RATE).toFixed(2);
  const employer_pension = +(base_salary * EMPLOYER_PENSION_RATE).toFixed(2);

  const total_deductions = +(paye.total + employee_pension + loan_deduction + other_deductions).toFixed(2);
  const net_pay = +(gross_pay - total_deductions).toFixed(2);

  return {
    base_salary,
    transport_allowance: transport,
    housing_allowance: housing,
    position_allowance: position,
    other_allowance: other_allow,
    overtime_amount,
    bonus,
    gross_pay: +gross_pay.toFixed(2),
    taxable_income: +taxable_income.toFixed(2),
    paye_tax: +paye.total.toFixed(2),
    employee_pension,
    employer_pension,
    loan_deduction,
    other_deductions,
    total_deductions,
    net_pay,
    bracket_breakdown: paye.breakdown,
  };
}

export const formatETB = (n: number) =>
  new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2 }).format(n);
