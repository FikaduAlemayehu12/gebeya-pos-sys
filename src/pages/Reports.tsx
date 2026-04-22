import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { formatETB } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Download, Printer, Calendar as CalendarIcon, BarChart3, TrendingUp, Receipt, Loader2,
  ChevronDown, ChevronUp, Clock, User, FileText, AlertTriangle, CheckCircle,
  DollarSign, Search, Filter, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activityLogger';
import { useCurrency } from '@/contexts/CurrencyContext';
import SalesTrendChart from '@/components/SalesTrendChart';
import { exportZReportPdf } from '@/lib/exportPdf';

interface Sale {
  id: string;
  receipt_id: string;
  total: number;
  subtotal: number;
  vat: number;
  payment_method: string;
  created_at: string;
  cashier_id: string | null;
}

interface SaleItem {
  sale_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  product_id: string | null;
  created_at: string;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  details: any;
  amount: number | null;
  created_at: string;
}

interface ZReport {
  id: string;
  report_date: string;
  status: string;
  total_sales: number;
  total_vat: number;
  total_transactions: number;
  cash_sales: number;
  telebirr_sales: number;
  cbe_birr_sales: number;
  bank_transfer_sales: number;
  credit_sales_total: number;
  opening_balance: number;
  closing_balance: number;
  cash_in: number;
  cash_out: number;
  refunds: number;
  discounts: number;
  created_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  shift: string | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  sale_created: { label: 'Sale', color: 'bg-success/10 text-success', icon: CheckCircle },
  sale_voided: { label: 'Void', color: 'bg-destructive/10 text-destructive', icon: X },
  refund_issued: { label: 'Refund', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
  credit_sale_created: { label: 'Credit', color: 'bg-info/10 text-info', icon: DollarSign },
  credit_payment_collected: { label: 'Collection', color: 'bg-success/10 text-success', icon: DollarSign },
  payment_received: { label: 'Payment', color: 'bg-success/10 text-success', icon: DollarSign },
  cart_item_added: { label: 'Cart +', color: 'bg-muted text-muted-foreground', icon: ChevronUp },
  cart_item_removed: { label: 'Cart -', color: 'bg-muted text-muted-foreground', icon: ChevronDown },
  stock_adjusted: { label: 'Stock', color: 'bg-info/10 text-info', icon: BarChart3 },
  product_created: { label: 'Product+', color: 'bg-success/10 text-success', icon: FileText },
  user_login: { label: 'Login', color: 'bg-muted text-muted-foreground', icon: User },
  user_logout: { label: 'Logout', color: 'bg-muted text-muted-foreground', icon: User },
  cash_drawer_open: { label: 'Drawer', color: 'bg-warning/10 text-warning', icon: Receipt },
  cash_in: { label: 'Cash In', color: 'bg-success/10 text-success', icon: TrendingUp },
  cash_out: { label: 'Cash Out', color: 'bg-destructive/10 text-destructive', icon: TrendingUp },
  z_report_opened: { label: 'Z Open', color: 'bg-info/10 text-info', icon: FileText },
  z_report_closed: { label: 'Z Close', color: 'bg-primary/10 text-primary', icon: FileText },
};

export default function Reports() {
  const { toast } = useToast();
  const { formatMoney, currency } = useCurrency();
  // fmt: format an ETB amount in the active display currency, with ETB shown when needed
  const fmt = (etb: number) => formatMoney(Number(etb) || 0, { showCode: true });
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [productCosts, setProductCosts] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [zReports, setZReports] = useState<ZReport[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));
  const [rangePreset, setRangePreset] = useState<string>('today');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'zreport' | 'activity' | 'history'>('zreport');

  // Z-Report actions
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingZReport, setClosingZReport] = useState(false);
  const [cashInOutAmount, setCashInOutAmount] = useState('');
  const [showCashDialog, setShowCashDialog] = useState<'in' | 'out' | null>(null);

  const applyPreset = (preset: string) => {
    setRangePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'today':
        setDateFrom(startOfDay(now));
        setDateTo(endOfDay(now));
        break;
      case 'yesterday':
        setDateFrom(startOfDay(subDays(now, 1)));
        setDateTo(endOfDay(subDays(now, 1)));
        break;
      case 'week':
        setDateFrom(startOfWeek(now, { weekStartsOn: 1 }));
        setDateTo(endOfDay(now));
        break;
      case 'month':
        setDateFrom(startOfMonth(now));
        setDateTo(endOfDay(now));
        break;
      case 'last30':
        setDateFrom(startOfDay(subDays(now, 29)));
        setDateTo(endOfDay(now));
        break;
    }
  };

  const isMultiDay = dateFrom.toDateString() !== dateTo.toDateString();
  const dateFilterLabel = isMultiDay
    ? `${format(dateFrom, 'MMM d')} — ${format(dateTo, 'MMM d, yyyy')}`
    : format(dateFrom, 'MMM d, yyyy');

  const fetchData = useCallback(async () => {
    const [salesRes, productsRes, customersRes, invRes, actRes, zRes, profilesRes, saleItemsRes, productCostsRes] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', dateFrom.toISOString()).lte('created_at', dateTo.toISOString()).order('created_at', { ascending: false }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('price, stock'),
      supabase.from('pos_activity_logs').select('*').gte('created_at', dateFrom.toISOString()).lte('created_at', dateTo.toISOString()).order('created_at', { ascending: false }).limit(500),
      supabase.from('z_reports').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('sale_items').select('sale_id, quantity, unit_price, total, product_id, created_at').gte('created_at', dateFrom.toISOString()).lte('created_at', dateTo.toISOString()),
      supabase.from('products').select('id, cost'),
    ]);

    setSales((salesRes.data || []) as Sale[]);
    setSaleItems((saleItemsRes.data || []) as SaleItem[]);
    
    const costs: Record<string, number> = {};
    (productCostsRes.data || []).forEach((p: any) => { costs[p.id] = Number(p.cost); });
    setProductCosts(costs);
    
    setProductCount(productsRes.count || 0);
    setCustomerCount(customersRes.count || 0);
    setInventoryValue((invRes.data || []).reduce((s: number, p: any) => s + Number(p.price) * Number(p.stock), 0));
    setActivities((actRes.data || []) as ActivityLog[]);
    setZReports((zRes.data || []) as ZReport[]);

    const pMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { pMap[p.user_id] = p.full_name; });
    setProfiles(pMap);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSales = sales.reduce((s, sale) => s + Number(sale.total), 0);
  const totalVat = sales.reduce((s, sale) => s + Number(sale.vat), 0);
  const txnCount = sales.length;

  // Calculate total cost from sale items
  const totalCost = saleItems.reduce((s, item) => {
    const cost = item.product_id ? (productCosts[item.product_id] || 0) : 0;
    return s + cost * Number(item.quantity);
  }, 0);
  const totalProfit = totalSales - totalVat - totalCost;
  const profitMargin = totalSales > 0 ? ((totalProfit / (totalSales - totalVat)) * 100) : 0;

  // Build per-sale cost map for chart
  const saleCostMap = useMemo(() => {
    const map = new Map<string, number>();
    saleItems.forEach(item => {
      const cost = item.product_id ? (productCosts[item.product_id] || 0) * Number(item.quantity) : 0;
      map.set(item.sale_id, (map.get(item.sale_id) || 0) + cost);
    });
    return map;
  }, [saleItems, productCosts]);

  const byMethod: Record<string, number> = {};
  sales.forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total); });

  const methodLabels: Record<string, string> = {
    cash: 'Cash / ጥሬ ገንዘብ', telebirr: 'Telebirr / ቴሌብር', cbe_birr: 'CBE Birr',
    credit: 'Credit / ብድር', bank_transfer: 'Bank Transfer',
  };

  // Filter activities
  const filteredActivities = activities.filter(a => {
    if (actionFilter !== 'all' && a.action_type !== actionFilter) return false;
    if (cashierFilter !== 'all' && a.user_id !== cashierFilter) return false;
    if (searchFilter && !a.description.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const uniqueCashiers = [...new Set(activities.map(a => a.user_id))];

  // Open Z-Report
  const handleOpenZReport = async () => {
    const bal = parseFloat(openingBalance) || 0;
    const { error } = await supabase.from('z_reports').insert({
      report_date: format(dateFrom, 'yyyy-MM-dd'),
      opening_balance: bal,
      opened_by: (await supabase.auth.getUser()).data.user?.id,
      status: 'open',
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity('z_report_opened', `Z-Report opened with balance ${formatETB(bal)}`);
    toast({ title: '✅ Z-Report opened' });
    setOpeningBalance('');
    fetchData();
  };

  // Close Z-Report
  const handleCloseZReport = async (zr: ZReport) => {
    setClosingZReport(true);
    const cashTotal = byMethod['cash'] || 0;
    const { error } = await supabase.from('z_reports').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: (await supabase.auth.getUser()).data.user?.id,
      total_sales: totalSales,
      total_vat: totalVat,
      total_transactions: txnCount,
      cash_sales: cashTotal,
      telebirr_sales: byMethod['telebirr'] || 0,
      cbe_birr_sales: byMethod['cbe_birr'] || 0,
      bank_transfer_sales: byMethod['bank_transfer'] || 0,
      credit_sales_total: byMethod['credit'] || 0,
      closing_balance: zr.opening_balance + cashTotal + zr.cash_in - zr.cash_out,
    } as any).eq('id', zr.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      await logActivity('z_report_closed', `Z-Report closed. Total: ${formatETB(totalSales)}`);
      toast({ title: '✅ Z-Report closed' });
    }
    setClosingZReport(false);
    fetchData();
  };

  // Cash In/Out
  const handleCashInOut = async () => {
    const amount = parseFloat(cashInOutAmount);
    if (!amount || amount <= 0) return;
    const type = showCashDialog!;
    const todayReport = zReports.find(z => z.report_date === format(dateFrom, 'yyyy-MM-dd') && z.status === 'open');
    if (todayReport) {
      const update: any = type === 'in'
        ? { cash_in: todayReport.cash_in + amount }
        : { cash_out: todayReport.cash_out + amount };
      await supabase.from('z_reports').update(update).eq('id', todayReport.id);
    }
    await logActivity(type === 'in' ? 'cash_in' : 'cash_out', `${type === 'in' ? 'Cash In' : 'Cash Out'}: ${formatETB(amount)}`, undefined, { amount });
    toast({ title: `✅ ${type === 'in' ? 'Cash In' : 'Cash Out'}: ${formatETB(amount)}` });
    setCashInOutAmount('');
    setShowCashDialog(null);
    fetchData();
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Time', 'Action', 'Description', 'Amount', 'User'];
    const rows = filteredActivities.map(a => [
      new Date(a.created_at).toLocaleString(),
      a.action_type,
      a.description,
      a.amount || '',
      profiles[a.user_id] || a.user_id,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `z-report-${format(dateFrom, 'yyyy-MM-dd')}-to-${format(dateTo, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const todayZReport = zReports.find(z => z.report_date === format(dateFrom, 'yyyy-MM-dd'));

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Reports</h1></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Z-Report</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">ሪፖርቶች እና ዜድ-ሪፖርት</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Range presets */}
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'last30', label: 'Last 30 Days' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                rangePreset === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Custom date pickers */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-8">
                <CalendarIcon className="w-3.5 h-3.5" />
                {dateFilterLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateFrom, to: dateTo }}
                onSelect={(range) => {
                  if (range?.from) setDateFrom(startOfDay(range.from));
                  if (range?.to) setDateTo(endOfDay(range.to));
                  else if (range?.from) setDateTo(endOfDay(range.from));
                  setRangePreset('custom');
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
            const dailyMap = new Map<string, { date: string; total: number; vat: number; count: number; byMethod: Record<string, number> }>();
            sales.forEach(s => {
              const day = s.created_at.split('T')[0];
              if (!dailyMap.has(day)) dailyMap.set(day, { date: day, total: 0, vat: 0, count: 0, byMethod: {} });
              const d = dailyMap.get(day)!;
              d.total += Number(s.total); d.vat += Number(s.vat); d.count += 1;
              d.byMethod[s.payment_method] = (d.byMethod[s.payment_method] || 0) + Number(s.total);
            });
            exportZReportPdf({
              dateFrom, dateTo, totalSales, totalVat, txnCount, byMethod,
              zReport: todayZReport || null,
              dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
            });
          }}>
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['zreport', 'activity', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {tab === 'zreport' ? 'Z-Report' : tab === 'activity' ? 'Activity Log' : 'Z-Report History'}
          </button>
        ))}
      </div>

      {/* Z-Report Tab */}
      {activeTab === 'zreport' && (
        <div className="space-y-4">
          {/* Z-Report Controls */}
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                {!todayZReport ? (
                  <>
                    <Input
                      type="number"
                      placeholder="Opening balance..."
                      value={openingBalance}
                      onChange={e => setOpeningBalance(e.target.value)}
                      className="w-40 h-9 text-xs"
                    />
                    <Button size="sm" className="gap-1.5 text-xs" onClick={handleOpenZReport}>
                      <FileText className="w-3.5 h-3.5" /> Open Z-Report
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className={cn('text-xs', todayZReport.status === 'open' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground')}>
                      {todayZReport.status === 'open' ? 'Z-Report Open' : 'Z-Report Closed'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Opening: {fmt(todayZReport.opening_balance)}</span>
                    {todayZReport.status === 'open' && (
                      <>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowCashDialog('in')}>
                          <TrendingUp className="w-3 h-3" /> Cash In
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowCashDialog('out')}>
                          <TrendingUp className="w-3 h-3 rotate-180" /> Cash Out
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1 text-xs ml-auto" onClick={() => handleCloseZReport(todayZReport)} disabled={closingZReport}>
                          {closingZReport && <Loader2 className="w-3 h-3 animate-spin" />}
                          Close Z-Report
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Daily Sales Summary */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="w-4 h-4" />
                {isMultiDay ? 'Summary' : 'Daily Z-Report'} — {dateFilterLabel}
                <span className="font-ethiopic text-xs text-muted-foreground ml-1">ዕለታዊ ዜድ-ሪፖርት</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(methodLabels).map(([key, label]) => (
                  <div key={key} className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                    <p className="text-base font-bold text-foreground">{fmt(byMethod[key] || 0)}</p>
                  </div>
                ))}
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">VAT (15%)</p>
                  <p className="text-base font-bold text-foreground">{fmt(totalVat)}</p>
                </div>
              </div>

              {/* Profit Margin Summary */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground">Revenue (excl. VAT)</p>
                  <p className="text-sm font-bold text-foreground">{fmt(totalSales - totalVat)}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5 text-center">
                  <p className="text-[10px] text-muted-foreground">Total Cost / ወጪ</p>
                  <p className="text-sm font-bold text-destructive">{fmt(totalCost)}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10 text-center">
                  <p className="text-[10px] text-success">Gross Profit / ትርፍ</p>
                  <p className="text-sm font-bold text-success">{fmt(totalProfit)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-[10px] text-primary">Margin / ህዳግ</p>
                  <p className="text-sm font-bold text-primary">{profitMargin.toFixed(1)}%</p>
                </div>
              </div>

              {/* Cash Drawer Summary */}
              {todayZReport && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">Opening</p>
                    <p className="text-sm font-bold text-foreground">{fmt(todayZReport.opening_balance)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <p className="text-[10px] text-success">Cash In</p>
                    <p className="text-sm font-bold text-success">{fmt(todayZReport.cash_in)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <p className="text-[10px] text-destructive">Cash Out</p>
                    <p className="text-sm font-bold text-destructive">{fmt(todayZReport.cash_out)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 text-center">
                    <p className="text-[10px] text-primary">Expected Closing</p>
                    <p className="text-sm font-bold text-primary">
                      {fmt(todayZReport.opening_balance + (byMethod['cash'] || 0) + todayZReport.cash_in - todayZReport.cash_out)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 rounded-lg gradient-primary text-primary-foreground flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Sales / ጠቅላላ ሽያጭ</p>
                  <p className="text-2xl font-bold">{fmt(totalSales)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Transactions</p>
                  <p className="text-2xl font-bold">{txnCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Trend Chart */}
          {sales.length > 0 && (
            <SalesTrendChart sales={sales} saleCostMap={saleCostMap} dateFrom={dateFrom} dateTo={dateTo} />
          )}

          {/* Daily Breakdown for multi-day ranges */}
          {isMultiDay && sales.length > 0 && (() => {
            const dailyMap = new Map<string, { total: number; vat: number; count: number; cost: number; byMethod: Record<string, number> }>();
            sales.forEach(s => {
              const day = s.created_at.split('T')[0];
              if (!dailyMap.has(day)) dailyMap.set(day, { total: 0, vat: 0, count: 0, cost: 0, byMethod: {} });
              const d = dailyMap.get(day)!;
              d.total += Number(s.total);
              d.vat += Number(s.vat);
              d.count += 1;
              d.cost += saleCostMap.get(s.id) || 0;
              d.byMethod[s.payment_method] = (d.byMethod[s.payment_method] || 0) + Number(s.total);
            });
            const days = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

            return (
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Daily Breakdown
                    <Badge variant="outline" className="text-[10px] ml-1">{days.length} days</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                         <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 pr-3 font-medium">Date</th>
                          <th className="text-right py-2 px-2 font-medium">Txns</th>
                          <th className="text-right py-2 px-2 font-medium">Cash</th>
                          <th className="text-right py-2 px-2 font-medium">Telebirr</th>
                          <th className="text-right py-2 px-2 font-medium">CBE</th>
                          <th className="text-right py-2 px-2 font-medium">Credit</th>
                          <th className="text-right py-2 px-2 font-medium">VAT</th>
                          <th className="text-right py-2 px-2 font-medium">Cost</th>
                          <th className="text-right py-2 px-2 font-medium">Profit</th>
                          <th className="text-right py-2 pl-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {days.map(([day, d]) => {
                          const dayProfit = d.total - d.vat - d.cost;
                          const dayMargin = (d.total - d.vat) > 0 ? ((dayProfit / (d.total - d.vat)) * 100) : 0;
                          return (
                          <tr key={day} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-3 font-medium text-foreground">{day}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{d.count}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{fmt(d.byMethod['cash'] || 0)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{fmt(d.byMethod['telebirr'] || 0)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{fmt(d.byMethod['cbe_birr'] || 0)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{fmt(d.byMethod['credit'] || 0)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{fmt(d.vat)}</td>
                            <td className="py-2 px-2 text-right text-destructive">{fmt(d.cost)}</td>
                            <td className="py-2 px-2 text-right text-success" title={`${dayMargin.toFixed(1)}% margin`}>{fmt(dayProfit)}</td>
                            <td className="py-2 pl-2 text-right font-bold text-foreground">{fmt(d.total)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-bold">
                          <td className="py-2 pr-3 text-foreground">Total</td>
                          <td className="py-2 px-2 text-right text-foreground">{txnCount}</td>
                          <td className="py-2 px-2 text-right text-foreground">{fmt(byMethod['cash'] || 0)}</td>
                          <td className="py-2 px-2 text-right text-foreground">{fmt(byMethod['telebirr'] || 0)}</td>
                          <td className="py-2 px-2 text-right text-foreground">{fmt(byMethod['cbe_birr'] || 0)}</td>
                          <td className="py-2 px-2 text-right text-foreground">{fmt(byMethod['credit'] || 0)}</td>
                          <td className="py-2 px-2 text-right text-foreground">{fmt(totalVat)}</td>
                          <td className="py-2 px-2 text-right text-destructive">{fmt(totalCost)}</td>
                          <td className="py-2 px-2 text-right text-success">{fmt(totalProfit)} ({profitMargin.toFixed(1)}%)</td>
                          <td className="py-2 pl-2 text-right text-primary">{fmt(totalSales)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Total Products', titleAm: 'ጠቅላላ ምርቶች', icon: BarChart3, desc: `${productCount} products in inventory` },
              { title: 'Customer Report', titleAm: 'የደንበኛ ሪፖርት', icon: TrendingUp, desc: `${customerCount} registered customers` },
              { title: 'Inventory Value', titleAm: 'የክምችት ዋጋ', icon: Receipt, desc: `Total: ${fmt(inventoryValue)}` },
            ].map(report => (
              <Card key={report.title} className="bg-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <report.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{report.title}</p>
                      <p className="text-[10px] font-ethiopic text-muted-foreground">{report.titleAm}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{report.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([key, v]) => (
                      <SelectItem key={key} value={key}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cashierFilter} onValueChange={setCashierFilter}>
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Cashier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueCashiers.map(uid => (
                      <SelectItem key={uid} value={uid}>{profiles[uid] || uid.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs">{filteredActivities.length} logs</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Activity List */}
          <Card className="bg-card">
            <CardContent className="p-0">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No activity logs for this date</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {filteredActivities.map(log => {
                    const config = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'bg-muted text-muted-foreground', icon: Clock };
                    const Icon = config.icon;
                    return (
                      <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.color)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn('text-[10px]', config.color)}>{config.label}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              <User className="w-2.5 h-2.5 inline mr-0.5" />
                              {profiles[log.user_id] || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-0.5">{log.description}</p>
                          {log.amount && (
                            <p className="text-xs font-semibold text-primary mt-0.5">{fmt(log.amount)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Z-Report History Tab */}
      {activeTab === 'history' && (
        <Card className="bg-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Z-Report History</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Showing reports within {dateFilterLabel} • amounts in {currency}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] w-fit">
                {zReports.filter(z => {
                  const d = new Date(z.report_date);
                  return d >= startOfDay(dateFrom) && d <= endOfDay(dateTo);
                }).length} reports
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const filteredReports = zReports.filter(z => {
                const d = new Date(z.report_date);
                return d >= startOfDay(dateFrom) && d <= endOfDay(dateTo);
              });
              if (filteredReports.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No Z-Reports in this date range</p>
                    <p className="text-[11px] mt-1">Try expanding the range or open a new Z-Report on the Z-Report tab.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {filteredReports.map(zr => {
                    const profitLike = (zr.total_sales || 0) - (zr.total_vat || 0);
                    const cashier = profiles[zr.opened_by || ''] || profiles[zr.closed_by || ''] || '—';
                    return (
                    <div key={zr.id} className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{zr.report_date}</span>
                          <Badge variant="outline" className={cn('text-[10px]', zr.status === 'open' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground')}>
                            {zr.status === 'open' ? '🔓 Open' : '🔒 Closed'}
                          </Badge>
                          {zr.shift && (
                            <Badge variant="outline" className="text-[10px] capitalize">Shift: {zr.shift}</Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> {cashier}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Sales</p>
                          <p className="text-base font-bold text-primary">{fmt(zr.total_sales)}</p>
                        </div>
                      </div>

                      {/* Sales by method */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-card rounded-md p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">💵 Cash</p>
                          <p className="text-xs font-semibold text-foreground">{fmt(zr.cash_sales)}</p>
                        </div>
                        <div className="bg-card rounded-md p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">📱 Telebirr</p>
                          <p className="text-xs font-semibold text-foreground">{fmt(zr.telebirr_sales)}</p>
                        </div>
                        <div className="bg-card rounded-md p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">🏦 CBE Birr</p>
                          <p className="text-xs font-semibold text-foreground">{fmt(zr.cbe_birr_sales)}</p>
                        </div>
                        <div className="bg-card rounded-md p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">📝 Credit</p>
                          <p className="text-xs font-semibold text-foreground">{fmt(zr.credit_sales_total)}</p>
                        </div>
                      </div>

                      {/* Cash drawer */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-muted/50 rounded-md p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Opening</p>
                          <p className="text-xs font-semibold text-foreground">{fmt(zr.opening_balance)}</p>
                        </div>
                        <div className="bg-success/5 rounded-md p-2 text-center">
                          <p className="text-[10px] text-success">Cash In</p>
                          <p className="text-xs font-semibold text-success">{fmt(zr.cash_in)}</p>
                        </div>
                        <div className="bg-destructive/5 rounded-md p-2 text-center">
                          <p className="text-[10px] text-destructive">Cash Out</p>
                          <p className="text-xs font-semibold text-destructive">{fmt(zr.cash_out)}</p>
                        </div>
                        <div className="bg-primary/5 rounded-md p-2 text-center">
                          <p className="text-[10px] text-primary">Closing</p>
                          <p className="text-xs font-semibold text-primary">{fmt(zr.closing_balance)}</p>
                        </div>
                      </div>

                      {/* Footer stats */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                        <span>📋 {zr.total_transactions} transactions</span>
                        <span>VAT: <span className="text-foreground font-medium">{fmt(zr.total_vat)}</span></span>
                        <span>Net (excl. VAT): <span className="text-foreground font-medium">{fmt(profitLike)}</span></span>
                        {zr.refunds > 0 && <span>Refunds: <span className="text-warning font-medium">{fmt(zr.refunds)}</span></span>}
                        {zr.closed_at && <span>Closed: {new Date(zr.closed_at).toLocaleString()}</span>}
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Cash In/Out Dialog */}
      <Dialog open={!!showCashDialog} onOpenChange={(o) => !o && setShowCashDialog(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{showCashDialog === 'in' ? 'Cash In' : 'Cash Out'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Amount..."
              value={cashInOutAmount}
              onChange={e => setCashInOutAmount(e.target.value)}
              className="h-10"
            />
            <Button className="w-full" onClick={handleCashInOut}>
              Confirm {showCashDialog === 'in' ? 'Cash In' : 'Cash Out'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
