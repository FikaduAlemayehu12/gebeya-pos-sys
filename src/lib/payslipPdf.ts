import { format } from 'date-fns';
import { formatETB } from './payroll';

export interface PayslipData {
  company: { name: string; name_am?: string; address?: string; phone?: string; tin?: string };
  employee: {
    employee_code: string;
    full_name: string;
    full_name_am?: string;
    position?: string;
    department?: string;
    branch_name?: string;
    bank_name?: string;
    bank_account?: string;
    tin_number?: string;
    pension_number?: string;
    hire_date?: string;
  };
  period: { month: number; year: number };
  pay_date: string;
  payslip_no: string;

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
  employee_pension: number;
  employer_pension: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  days_worked: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function exportPayslipPdf(d: PayslipData) {
  const periodLabel = `${MONTHS[d.period.month - 1]} ${d.period.year}`;

  const earningsRows: Array<[string, number]> = [
    ['Basic Salary / መሰረታዊ ደመወዝ', d.base_salary],
    ['Transport Allowance / የትራንስፖርት', d.transport_allowance],
    ['Housing Allowance / የቤት', d.housing_allowance],
    ['Position Allowance / የደረጃ', d.position_allowance],
    ['Other Allowance / ሌላ', d.other_allowance],
    ['Overtime / ትርፍ ሰዓት', d.overtime_amount],
    ['Bonus / ጉርሻ', d.bonus],
  ].filter(([_, v]) => (v as number) > 0) as Array<[string, number]>;

  const deductionsRows: Array<[string, number]> = [
    ['Income Tax (PAYE) / የገቢ ግብር', d.paye_tax],
    ['Pension 7% / ጡረታ (ሰራተኛ)', d.employee_pension],
    ['Loan Repayment / የብድር ክፍያ', d.loan_deduction],
    ['Other Deductions / ሌላ ቅናሽ', d.other_deductions],
  ].filter(([_, v]) => (v as number) > 0) as Array<[string, number]>;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Payslip — ${d.employee.full_name} — ${periodLabel}</title>
<style>
  @page { margin: 12mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #1a1a1a; padding: 10px; }
  .header { background: linear-gradient(135deg,#8B4513,#a0522d); color: #fff; padding: 18px 22px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; }
  .header .sub { font-size: 11px; opacity: 0.9; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 11px; }
  .header .meta strong { font-size: 14px; }
  .title { text-align: center; margin: 18px 0 10px; }
  .title h2 { font-size: 16px; color: #8B4513; letter-spacing: 1px; }
  .title .period { font-size: 12px; color: #666; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .info-box { border: 1px solid #e5e0d6; border-radius: 8px; padding: 10px 12px; background: #fdfbf7; }
  .info-box .lbl { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-box .val { font-size: 12px; font-weight: 600; margin-top: 1px; }
  .info-box .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .info-box .row .k { color: #666; }
  .info-box .row .v { font-weight: 600; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; border-radius: 8px; overflow: hidden; }
  th { background: #f5f0eb; padding: 8px 10px; text-align: left; font-weight: 700; color: #5a3a1a; font-size: 11px; border-bottom: 2px solid #d8c9b3; }
  th.right { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  td.right { text-align: right; font-weight: 600; }
  tfoot td { background: #f5f0eb; font-weight: 700; border-top: 2px solid #d8c9b3; border-bottom: none; }
  .net-pay { margin-top: 16px; background: linear-gradient(135deg,#16a34a,#15803d); color: #fff; padding: 16px 22px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .net-pay .lbl { font-size: 12px; opacity: 0.95; }
  .net-pay .lbl strong { display: block; font-size: 14px; }
  .net-pay .amt { font-size: 26px; font-weight: 800; }
  .extras { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 10px; }
  .extras .box { border: 1px dashed #ccc; padding: 8px 10px; border-radius: 6px; }
  .extras .box .k { color: #888; }
  .extras .box .v { font-weight: 700; margin-top: 1px; font-size: 11px; }
  .signatures { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .sig { border-top: 1px solid #888; padding-top: 4px; text-align: center; font-size: 10px; color: #666; }
  .footer { text-align: center; margin-top: 18px; padding-top: 10px; border-top: 1px solid #eee; font-size: 9px; color: #999; }
</style>
</head><body>

<div class="header">
  <div>
    <h1>${d.company.name}</h1>
    ${d.company.name_am ? `<div class="sub">${d.company.name_am}</div>` : ''}
    ${d.company.address ? `<div class="sub">${d.company.address}${d.company.phone ? ' • ' + d.company.phone : ''}</div>` : ''}
    ${d.company.tin ? `<div class="sub">TIN: ${d.company.tin}</div>` : ''}
  </div>
  <div class="meta">
    <strong>PAYSLIP</strong>
    <div>No: ${d.payslip_no}</div>
    <div>Pay Date: ${format(new Date(d.pay_date), 'dd MMM yyyy')}</div>
  </div>
</div>

<div class="title">
  <h2>EMPLOYEE PAYSLIP / የሰራተኛ ደመወዝ ማስታወቂያ</h2>
  <div class="period">Pay Period: ${periodLabel}</div>
</div>

<div class="info-grid">
  <div class="info-box">
    <div class="lbl">Employee Details</div>
    <div class="row"><span class="k">Name</span><span class="v">${d.employee.full_name}</span></div>
    ${d.employee.full_name_am ? `<div class="row"><span class="k">ስም</span><span class="v">${d.employee.full_name_am}</span></div>` : ''}
    <div class="row"><span class="k">Employee No</span><span class="v">${d.employee.employee_code}</span></div>
    <div class="row"><span class="k">Position</span><span class="v">${d.employee.position || '-'}</span></div>
    <div class="row"><span class="k">Department</span><span class="v">${d.employee.department || '-'}</span></div>
    <div class="row"><span class="k">Branch</span><span class="v">${d.employee.branch_name || '-'}</span></div>
    ${d.employee.hire_date ? `<div class="row"><span class="k">Hire Date</span><span class="v">${format(new Date(d.employee.hire_date), 'dd MMM yyyy')}</span></div>` : ''}
  </div>
  <div class="info-box">
    <div class="lbl">Payment & Identifiers</div>
    <div class="row"><span class="k">Bank</span><span class="v">${d.employee.bank_name || '-'}</span></div>
    <div class="row"><span class="k">Account</span><span class="v">${d.employee.bank_account || '-'}</span></div>
    <div class="row"><span class="k">TIN</span><span class="v">${d.employee.tin_number || '-'}</span></div>
    <div class="row"><span class="k">Pension No</span><span class="v">${d.employee.pension_number || '-'}</span></div>
    <div class="row"><span class="k">Days Worked</span><span class="v">${d.days_worked}</span></div>
    <div class="row"><span class="k">Payment Method</span><span class="v">Bank Transfer</span></div>
  </div>
</div>

<div class="columns">
  <div>
    <table>
      <thead><tr><th>Earnings / ገቢ</th><th class="right">ETB</th></tr></thead>
      <tbody>
        ${earningsRows.map(([k, v]) => `<tr><td>${k}</td><td class="right">${formatETB(v)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td>Gross Pay / ጠቅላላ</td><td class="right">${formatETB(d.gross_pay)}</td></tr></tfoot>
    </table>
  </div>
  <div>
    <table>
      <thead><tr><th>Deductions / ቅናሽ</th><th class="right">ETB</th></tr></thead>
      <tbody>
        ${deductionsRows.map(([k, v]) => `<tr><td>${k}</td><td class="right">${formatETB(v)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td>Total Deductions / ጠቅላላ ቅናሽ</td><td class="right">${formatETB(d.total_deductions)}</td></tr></tfoot>
    </table>
  </div>
</div>

<div class="extras">
  <div class="box"><div class="k">Taxable Income</div><div class="v">${formatETB(d.taxable_income)}</div></div>
  <div class="box"><div class="k">PAYE Tax</div><div class="v">${formatETB(d.paye_tax)}</div></div>
  <div class="box"><div class="k">Employer Pension (11%)</div><div class="v">${formatETB(d.employer_pension)}</div></div>
</div>

<div class="net-pay">
  <div class="lbl"><strong>Net Pay / የተጣራ ደመወዝ</strong>Amount transferred to employee</div>
  <div class="amt">${formatETB(d.net_pay)}</div>
</div>

<div class="signatures">
  <div class="sig">Employee Signature / የሰራተኛ ፊርማ</div>
  <div class="sig">HR / Payroll Officer</div>
</div>

<div class="footer">
  Generated on ${new Date().toLocaleString()} • Computed per Income Tax Proclamation 1395/2025 & Pension Proclamation 1268/2022<br/>
  This is a computer-generated payslip.
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    alert('Please allow pop-ups to download the payslip');
    return;
  }
  w.document.write(html);
  w.document.close();
}
