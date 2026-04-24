import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatETB } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import {
  DollarSign, ShoppingCart, Users, Package, AlertTriangle,
  TrendingUp, CreditCard, Smartphone, Loader2, ExternalLink
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import IntegrationActivityFeed from '@/components/IntegrationActivityFeed';
import { cn } from '@/lib/utils';

const METHOD_BADGE: Record<string, { label: string; className: string }> = {
  cash: { label: 'Cash', className: 'bg-success/10 text-success border-success/20' },
  telebirr: { label: 'Telebirr', className: 'bg-info/10 text-info border-info/20' },
  credit: { label: 'Credit', className: 'bg-warning/10 text-warning border-warning/20' },
  cbe_birr: { label: 'CBE Birr', className: 'bg-primary/10 text-primary border-primary/20' },
  bank_transfer: { label: 'Bank', className: 'bg-earth/10 text-earth border-earth/20' },
};

interface Sale {
  id: string;
  receipt_id: string;
  total: number;
  payment_method: string;
  created_at: string;
  subtotal: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState(0);
  const [todayTxnCount, setTodayTxnCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<Record<string, number>>({});

  const fetchDashboard = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [salesRes, customersRes, lowStockRes] = await Promise.all([
      supabase.from('sales').select('*').gte('created_at', todayStart.toISOString()).order('created_at', { ascending: false }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id, name, unit, stock, min_stock').order('stock', { ascending: true }),
    ]);

    const sales = (salesRes.data || []) as Sale[];
    setRecentSales(sales.slice(0, 8));
    setTodaySales(sales.reduce((s, sale) => s + Number(sale.total), 0));
    setTodayTxnCount(sales.length);
    setCustomerCount(customersRes.count || 0);

    const breakdown: Record<string, number> = {};
    sales.forEach(s => {
      breakdown[s.payment_method] = (breakdown[s.payment_method] || 0) + Number(s.total);
    });
    setPaymentBreakdown(breakdown);

    const allProducts = (lowStockRes.data || []) as LowStockProduct[];
    setLowStockItems(allProducts.filter(p => p.stock <= p.min_stock));

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
    const channel = supabase
      .channel('dashboard-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => {
        fetchDashboard();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalBreakdown = Object.values(paymentBreakdown).reduce((s, v) => s + v, 0) || 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">ዳሽቦርድ • Today's Overview</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const paymentMethods = [
    { label: 'Cash', labelAm: 'ጥሬ ገንዘብ', key: 'cash', icon: DollarSign },
    { label: 'Telebirr', labelAm: 'ቴሌብር', key: 'telebirr', icon: Smartphone },
    { label: 'CBE Birr', labelAm: 'CBE ብር', key: 'cbe_birr', icon: CreditCard },
    { label: 'Credit', labelAm: 'ብድር', key: 'credit', icon: CreditCard },
    { label: 'Bank', labelAm: 'ባንክ', key: 'bank_transfer', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-ethiopic">ዳሽቦርድ • Today's Overview</p>
      </div>

      {/* Stats Grid - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/reports')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatCard title="Today's Sales" titleAm="የዛሬ ሽያጭ" value={formatETB(todaySales)} icon={DollarSign} variant="primary" />
        </div>
        <div onClick={() => navigate('/pos')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatCard title="Transactions" titleAm="ግብይቶች" value={String(todayTxnCount)} icon={ShoppingCart} />
        </div>
        <div onClick={() => navigate('/customers')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatCard title="Total Customers" titleAm="ደንበኞች" value={String(customerCount)} icon={Users} />
        </div>
        <div onClick={() => navigate('/inventory')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <StatCard
            title="Low Stock Items"
            titleAm="ዝቅተኛ ክምችት"
            value={String(lowStockItems.length)}
            change={lowStockItems.length > 0 ? 'Needs attention' : 'All good'}
            changeType={lowStockItems.length > 0 ? 'negative' : 'positive'}
            icon={AlertTriangle}
            variant={lowStockItems.length > 0 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Recent Transactions <span className="text-xs font-ethiopic text-muted-foreground ml-2">የቅርብ ግብይቶች</span></span>
              <button onClick={() => navigate('/reports')} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                View All <ExternalLink className="w-3 h-3" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/pos')}>
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No sales today yet. Start selling!</p>
                <p className="text-xs font-ethiopic">ዛሬ ሽያጭ የለም</p>
                <p className="text-xs text-primary mt-2">Click to go to POS →</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentSales.map(sale => {
                  const time = new Date(sale.created_at);
                  const ago = getTimeAgo(time);
                  return (
                    <div
                      key={sale.id}
                      onClick={() => navigate(`/receipt/${sale.receipt_id}`)}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {sale.receipt_id.slice(-3)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{sale.receipt_id}</p>
                          <p className="text-xs text-muted-foreground">{ago}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className={cn('text-[10px] font-medium', METHOD_BADGE[sale.payment_method]?.className)}>
                          {METHOD_BADGE[sale.payment_method]?.label || sale.payment_method}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground w-24 text-right">{formatETB(Number(sale.total))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className={cn('w-4 h-4', lowStockItems.length > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground')} />
                Low Stock Alert
              </span>
              {lowStockItems.length > 0 && (
                <button onClick={() => navigate('/inventory')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  Restock <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">All items stocked!</p>
              </div>
            ) : (
              lowStockItems.slice(0, 6).map(item => (
                <div
                  key={item.id}
                  onClick={() => navigate('/inventory')}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10 cursor-pointer hover:bg-destructive/10 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{item.stock}</p>
                    <p className="text-[10px] text-muted-foreground">min: {item.min_stock}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cross-module Integration Feed */}
      <IntegrationActivityFeed />

      {/* Payment Methods Breakdown */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Payment Methods <span className="text-xs font-ethiopic text-muted-foreground ml-2">የክፍያ ዘዴዎች</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {paymentMethods.map(pm => {
              const amount = paymentBreakdown[pm.key] || 0;
              const pct = totalBreakdown > 0 ? Math.round((amount / totalBreakdown) * 100) : 0;
              return (
                <div
                  key={pm.key}
                  onClick={() => navigate('/reports')}
                  className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                >
                  <pm.icon className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs font-medium text-foreground">{pm.label}</p>
                  <p className="text-[10px] font-ethiopic text-muted-foreground">{pm.labelAm}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{pct}%</p>
                  <p className="text-[10px] text-muted-foreground">{formatETB(amount)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return date.toLocaleDateString();
}
