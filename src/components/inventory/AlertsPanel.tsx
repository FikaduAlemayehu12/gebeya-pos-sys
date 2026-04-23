import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Bell, Clock, Loader2, Package, X, Zap } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  reorder_point: number;
  expiry_date: string | null;
  price: number;
  unit: string;
}

interface Alert {
  id: string;
  type: 'low_stock' | 'expired' | 'expiring' | 'reorder';
  severity: 'critical' | 'warning' | 'info';
  product: Product;
  message: string;
  recommendation: string;
  daysUntilExpiry?: number;
  suggestedDiscount?: number;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-l-4 border-destructive bg-destructive/5',
  warning: 'border-l-4 border-warning bg-warning/5',
  info: 'border-l-4 border-primary bg-primary/5',
};

export default function AlertsPanel({ refreshKey }: { refreshKey?: number }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('id, name, stock, min_stock, reorder_point, expiry_date, price, unit')
        .eq('is_active', true);
      setProducts((data as Product[]) || []);
      setLoading(false);
    })();
  }, [refreshKey]);

  const alerts = useMemo<Alert[]>(() => {
    const now = new Date();
    const out: Alert[] = [];
    for (const p of products) {
      if (dismissed.has(`${p.id}-stock`)) continue;
      // Stock alerts
      if (p.stock <= 0) {
        out.push({
          id: `${p.id}-stock`,
          type: 'low_stock',
          severity: 'critical',
          product: p,
          message: `Out of stock`,
          recommendation: `Place an urgent purchase order immediately.`,
        });
      } else if (p.stock <= p.min_stock) {
        out.push({
          id: `${p.id}-stock`,
          type: 'low_stock',
          severity: 'critical',
          product: p,
          message: `Below minimum stock (${p.stock}/${p.min_stock} ${p.unit})`,
          recommendation: `Reorder from primary supplier.`,
        });
      } else if (p.stock <= (p.reorder_point || p.min_stock)) {
        out.push({
          id: `${p.id}-stock`,
          type: 'reorder',
          severity: 'warning',
          product: p,
          message: `At reorder point (${p.stock}/${p.reorder_point} ${p.unit})`,
          recommendation: `Schedule a reorder soon to avoid stockouts.`,
        });
      }

      // Expiry alerts
      if (p.expiry_date) {
        const exp = new Date(p.expiry_date);
        const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
        if (dismissed.has(`${p.id}-expiry`)) continue;
        if (days < 0) {
          out.push({
            id: `${p.id}-expiry`,
            type: 'expired',
            severity: 'critical',
            product: p,
            message: `Expired ${Math.abs(days)} days ago`,
            recommendation: `Remove from sales floor and dispose per regulations.`,
            daysUntilExpiry: days,
          });
        } else if (days <= 7) {
          out.push({
            id: `${p.id}-expiry`,
            type: 'expiring',
            severity: 'critical',
            product: p,
            message: `Expires in ${days} day(s)`,
            recommendation: `Apply 50% discount immediately. Use FEFO — sell this batch first.`,
            daysUntilExpiry: days,
            suggestedDiscount: 50,
          });
        } else if (days <= 30) {
          out.push({
            id: `${p.id}-expiry`,
            type: 'expiring',
            severity: 'warning',
            product: p,
            message: `Expires in ${days} days`,
            recommendation: `Promote at 20-30% discount or move to high-traffic shelf.`,
            daysUntilExpiry: days,
            suggestedDiscount: 25,
          });
        } else if (days <= 90) {
          out.push({
            id: `${p.id}-expiry`,
            type: 'expiring',
            severity: 'info',
            product: p,
            message: `Expires in ${days} days`,
            recommendation: `Monitor sales velocity; bundle in promotions if slow-moving.`,
            daysUntilExpiry: days,
            suggestedDiscount: 10,
          });
        }
      }
    }
    // Sort: critical first, then warning, info; within same severity, soonest expiry first
    return out.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999);
    });
  }, [products, dismissed]);

  const dismiss = (id: string) => setDismissed(s => new Set([...s, id]));

  const applyDiscount = async (productId: string, percent: number, currentPrice: number) => {
    const newPrice = Math.round(currentPrice * (1 - percent / 100) * 100) / 100;
    const { error } = await supabase.from('products').update({ price: newPrice }).eq('id', productId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Discount applied`, description: `New price: ETB ${newPrice}` });
    setProducts(p => p.map(x => x.id === productId ? { ...x, price: newPrice } : x));
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const critical = alerts.filter(a => a.severity === 'critical').length;
  const warning = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Bell className="w-4 h-4" /> Inventory Intelligence</h2>
          <p className="text-xs text-muted-foreground">Smart expiry, low-stock & reorder recommendations (FEFO logic)</p>
        </div>
        <div className="flex gap-2">
          <Badge className="gap-1 bg-destructive/10 text-destructive border-destructive/20"><Zap className="w-3 h-3" />{critical} critical</Badge>
          <Badge className="gap-1 bg-warning/10 text-warning border-warning/20"><AlertTriangle className="w-3 h-3" />{warning} warnings</Badge>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">All systems healthy. No active alerts.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-2.5">
          {alerts.map(a => (
            <Card key={a.id} className={SEVERITY_STYLE[a.severity]}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-background shadow-sm">
                    {a.type === 'low_stock' && <Package className="w-4 h-4 text-destructive" />}
                    {a.type === 'reorder' && <AlertTriangle className="w-4 h-4 text-warning" />}
                    {(a.type === 'expired' || a.type === 'expiring') && <Clock className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{a.product.name}</p>
                    <p className="text-xs text-foreground/80">{a.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">💡 {a.recommendation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.suggestedDiscount && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 border-warning/30 text-warning hover:bg-warning/10"
                      onClick={() => applyDiscount(a.product.id, a.suggestedDiscount!, a.product.price)}
                    >
                      Apply -{a.suggestedDiscount}%
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => dismiss(a.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
