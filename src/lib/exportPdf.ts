import { formatETB } from '@/lib/ethiopian';
import { format } from 'date-fns';

interface PdfData {
  dateFrom: Date;
  dateTo: Date;
  totalSales: number;
  totalVat: number;
  txnCount: number;
  byMethod: Record<string, number>;
  zReport?: {
    opening_balance: number;
    closing_balance: number;
    cash_in: number;
    cash_out: number;
    status: string;
  } | null;
  dailyBreakdown?: Array<{
    date: string;
    total: number;
    vat: number;
    count: number;
    byMethod: Record<string, number>;
  }>;
}

export function exportZReportPdf(data: PdfData) {
  const { dateFrom, dateTo, totalSales, totalVat, txnCount, byMethod, zReport, dailyBreakdown } = data;
  const isMultiDay = dateFrom.toDateString() !== dateTo.toDateString();
  const dateLabel = isMultiDay
    ? `${format(dateFrom, 'MMM d')} — ${format(dateTo, 'MMM d, yyyy')}`
    : format(dateFrom, 'MMM d, yyyy');

  const methodRows = [
    ['Cash / ጥሬ ገንዘብ', formatETB(byMethod['cash'] || 0)],
    ['Telebirr / ቴሌብር', formatETB(byMethod['telebirr'] || 0)],
    ['CBE Birr', formatETB(byMethod['cbe_birr'] || 0)],
    ['Credit / ብድር', formatETB(byMethod['credit'] || 0)],
    ['Bank Transfer', formatETB(byMethod['bank_transfer'] || 0)],
  ];

  const dailyRows = (dailyBreakdown || []).map(d => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${d.date}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${d.count}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${formatETB(d.byMethod['cash'] || 0)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${formatETB(d.byMethod['telebirr'] || 0)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${formatETB(d.byMethod['cbe_birr'] || 0)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${formatETB(d.byMethod['credit'] || 0)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;">${formatETB(d.vat)}</td>
      <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;font-weight:bold;">${formatETB(d.total)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Z-Report — ${dateLabel}</title>
<style>
  @page { margin: 15mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #8B4513; padding-bottom: 16px; }
  .header h1 { font-size: 22px; color: #8B4513; margin-bottom: 4px; }
  .header .subtitle { font-size: 13px; color: #666; }
  .header .date { font-size: 14px; font-weight: 600; margin-top: 8px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: 700; color: #333; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f5f0eb; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
  th.right { text-align: right; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .summary-box { background: #f9f6f2; border: 1px solid #e8e0d6; border-radius: 8px; padding: 14px; }
  .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-box .value { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
  .total-bar { background: #8B4513; color: white; padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .total-bar .label { font-size: 13px; opacity: 0.9; }
  .total-bar .amount { font-size: 24px; font-weight: 800; }
  .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
</style>
</head><body>

<div class="header">
  <h1>GEBEYA POS</h1>
  <div class="subtitle">Z-Report / ዜድ-ሪፖርት</div>
  <div class="date">${dateLabel}</div>
</div>

<div class="summary-grid">
  <div class="summary-box">
    <div class="label">Total Sales / ጠቅላላ ሽያጭ</div>
    <div class="value">${formatETB(totalSales)}</div>
  </div>
  <div class="summary-box">
    <div class="label">Transactions / ግብይቶች</div>
    <div class="value">${txnCount}</div>
  </div>
  <div class="summary-box">
    <div class="label">VAT (15%) / ተ.እ.ታ</div>
    <div class="value">${formatETB(totalVat)}</div>
  </div>
  <div class="summary-box">
    <div class="label">Net Sales</div>
    <div class="value">${formatETB(totalSales - totalVat)}</div>
  </div>
</div>

${zReport ? `
<div class="section" style="margin-top:20px;">
  <div class="section-title">Cash Drawer / የገንዘብ ሳጥን</div>
  <div class="summary-grid">
    <div class="summary-box"><div class="label">Opening Balance</div><div class="value">${formatETB(zReport.opening_balance)}</div></div>
    <div class="summary-box"><div class="label">Cash In</div><div class="value" style="color:#16a34a;">${formatETB(zReport.cash_in)}</div></div>
    <div class="summary-box"><div class="label">Cash Out</div><div class="value" style="color:#dc2626;">${formatETB(zReport.cash_out)}</div></div>
    <div class="summary-box"><div class="label">Closing Balance</div><div class="value" style="color:#8B4513;">${formatETB(zReport.closing_balance)}</div></div>
  </div>
</div>
` : ''}

<div class="section" style="margin-top:20px;">
  <div class="section-title">Payment Breakdown / የክፍያ ዘዴ</div>
  <table>
    <thead><tr><th>Method</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${methodRows.map(([m, a]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${m}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font-weight:600;">${a}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

${dailyBreakdown && dailyBreakdown.length > 1 ? `
<div class="section" style="margin-top:20px;">
  <div class="section-title">Daily Breakdown / ዕለታዊ ትንተና</div>
  <table>
    <thead><tr>
      <th>Date</th><th class="right">Txns</th><th class="right">Cash</th><th class="right">Telebirr</th>
      <th class="right">CBE</th><th class="right">Credit</th><th class="right">VAT</th><th class="right">Total</th>
    </tr></thead>
    <tbody>${dailyRows}</tbody>
    <tfoot><tr style="font-weight:bold;border-top:2px solid #333;">
      <td style="padding:8px;">Total</td>
      <td style="padding:8px;text-align:right;">${txnCount}</td>
      <td style="padding:8px;text-align:right;">${formatETB(byMethod['cash'] || 0)}</td>
      <td style="padding:8px;text-align:right;">${formatETB(byMethod['telebirr'] || 0)}</td>
      <td style="padding:8px;text-align:right;">${formatETB(byMethod['cbe_birr'] || 0)}</td>
      <td style="padding:8px;text-align:right;">${formatETB(byMethod['credit'] || 0)}</td>
      <td style="padding:8px;text-align:right;">${formatETB(totalVat)}</td>
      <td style="padding:8px;text-align:right;">${formatETB(totalSales)}</td>
    </tr></tfoot>
  </table>
</div>
` : ''}

<div class="total-bar">
  <div><div class="label">Grand Total / ጠቅላላ</div></div>
  <div class="amount">${formatETB(totalSales)}</div>
</div>

<div class="footer">
  Generated on ${new Date().toLocaleString()} • Gebeya POS System<br/>
  This is a computer-generated report.
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=1100');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
