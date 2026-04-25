import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatETB } from '@/lib/ethiopian';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Package, AlertTriangle, Loader2, ImageIcon, Boxes, Truck, Building2, Bell, Sparkles, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductFormDialog from '@/components/ProductFormDialog';
import ProductQRCode from '@/components/ProductQRCode';
import TransfersList from '@/components/inventory/TransfersList';
import AssetsList from '@/components/inventory/AssetsList';
import AlertsPanel from '@/components/inventory/AlertsPanel';
import ImportExportPanel from '@/components/inventory/ImportExportPanel';
import StockTransferDialog from '@/components/inventory/StockTransferDialog';
import AssetFormDialog from '@/components/inventory/AssetFormDialog';
import InventoryStatDetail, { StatKind } from '@/components/inventory/InventoryStatDetail';

interface Product {
  id: string;
  name: string;
  name_am: string | null;
  category: string;
  subcategory?: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  reorder_point?: number;
  unit: string;
  barcode: string | null;
  sku?: string | null;
  expiry_date: string | null;
  variants: any;
  updated_at: string;
  description?: string | null;
  image_url?: string | null;
  attributes?: any;
  category_id?: string | null;
  branch_id?: string | null;
  tax_rate?: number;
  track_expiry?: boolean;
  track_batch?: boolean;
  track_serial?: boolean;
}

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('products');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKind, setDetailKind] = useState<StatKind>('all');
  const { formatMoney, currency } = useCurrency();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.name_am || '').includes(search) ||
      (item.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(search.toLowerCase());
    const matchesStock = !filterLowStock || item.stock <= item.min_stock;
    return matchesSearch && matchesStock;
  });

  const totalItems = products.length;
  const lowStockCount = products.filter(i => i.stock <= i.min_stock).length;
  const expiringCount = products.filter(i =>
    i.expiry_date && new Date(i.expiry_date) <= new Date(Date.now() + 30 * 86400000)
  ).length;
  const totalValue = products.reduce((s, i) => s + i.price * i.stock, 0);

  // Critical alerts count for badge
  const criticalAlerts = useMemo(() => {
    const now = Date.now();
    return products.filter(p =>
      p.stock <= 0 ||
      p.stock <= p.min_stock ||
      (p.expiry_date && new Date(p.expiry_date).getTime() <= now + 7 * 86400000)
    ).length;
  }, [products]);

  const openDetail = (k: StatKind) => { setDetailKind(k); setDetailOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header with all actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" /> Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የእቃ ክምችት አስተዳደር</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportExportPanel onSuccess={fetchProducts} />
          <StockTransferDialog onSuccess={fetchProducts} />
          <AssetFormDialog onSuccess={fetchProducts} />
          <ProductFormDialog onSuccess={fetchProducts} />
        </div>
      </div>

      {/* Critical alert banner */}
      {criticalAlerts > 0 && (
        <button
          onClick={() => setActiveTab('alerts')}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-l-4 border-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {criticalAlerts} {criticalAlerts === 1 ? 'item needs' : 'items need'} immediate attention
              </p>
              <p className="text-xs text-muted-foreground">Out-of-stock, low stock, or expiring within 7 days</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Clickable summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => openDetail('all')} className="text-left">
          <Card className="bg-card stat-card-shadow hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Products</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalItems}</p>
                  <p className="text-[10px] text-primary mt-0.5 flex items-center gap-0.5">View all <ChevronRight className="w-2.5 h-2.5" /></p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10"><Package className="w-5 h-5 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => openDetail('low')} className="text-left">
          <Card className="bg-card stat-card-shadow hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Low Stock</p>
                  <p className="text-2xl font-bold text-destructive mt-1">{lowStockCount}</p>
                  <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-0.5">View items <ChevronRight className="w-2.5 h-2.5" /></p>
                </div>
                <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              </div>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => openDetail('expiring')} className="text-left">
          <Card className="bg-card stat-card-shadow hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expiring (30d)</p>
                  <p className="text-2xl font-bold text-warning mt-1">{expiringCount}</p>
                  <p className="text-[10px] text-warning mt-0.5 flex items-center gap-0.5">View items <ChevronRight className="w-2.5 h-2.5" /></p>
                </div>
                <div className="p-2 rounded-lg bg-warning/10"><Bell className="w-5 h-5 text-warning" /></div>
              </div>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => openDetail('value')} className="text-left">
          <Card className="bg-card stat-card-shadow hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Value</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatMoney(totalValue)}</p>
                  {currency !== 'ETB' && <p className="text-[10px] text-muted-foreground mt-0.5">{formatETB(totalValue)}</p>}
                  <p className="text-[10px] text-primary mt-0.5 flex items-center gap-0.5">Breakdown <ChevronRight className="w-2.5 h-2.5" /></p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/10"><Sparkles className="w-5 h-5 text-secondary-foreground" /></div>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="products" className="gap-1.5 text-xs"><Package className="w-3.5 h-3.5" /> Products</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs relative">
            <Bell className="w-3.5 h-3.5" /> Intelligence
            {criticalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {criticalAlerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1.5 text-xs"><Truck className="w-3.5 h-3.5" /> Transfers</TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, SKU, barcode... / ፈልግ" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button
              variant={filterLowStock ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={cn("gap-1.5", filterLowStock && "gradient-primary text-primary-foreground")}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Only
            </Button>
          </div>

          <Card className="bg-card overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No products found. Add your first product or import from Excel!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Product</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Category</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Price</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cost</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Stock</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Unit</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Expiry</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(item => {
                      const isLow = item.stock <= item.min_stock;
                      const isExpiring = item.expiry_date && new Date(item.expiry_date) <= new Date(Date.now() + 30 * 86400000);
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-md object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-foreground">{item.name}</p>
                                {item.name_am && <p className="text-[11px] font-ethiopic text-muted-foreground">{item.name_am}</p>}
                                <div className="flex gap-1.5 mt-0.5">
                                  {item.sku && <span className="text-[10px] text-muted-foreground">SKU: {item.sku}</span>}
                                  {item.barcode && <span className="text-[10px] text-muted-foreground">#{item.barcode}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                            {item.subcategory && <p className="text-[10px] text-muted-foreground mt-0.5">{item.subcategory}</p>}
                          </td>
                          <td className="p-3 text-right font-medium text-foreground">{formatMoney(item.price)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatMoney(item.cost)}</td>
                          <td className={cn('p-3 text-right font-bold', isLow ? 'text-destructive' : 'text-foreground')}>{item.stock}</td>
                          <td className="p-3 text-muted-foreground">{item.unit}</td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {item.expiry_date ? (
                              <span className={isExpiring ? 'text-destructive font-medium' : ''}>
                                {new Date(item.expiry_date).toLocaleDateString()}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3">
                            {isLow ? (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Low Stock</Badge>
                            ) : (
                              <Badge className="bg-success/10 text-success border-success/20 text-[10px]">In Stock</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <ProductFormDialog onSuccess={fetchProducts} editProduct={item} />
                              <ProductQRCode product={item} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="pt-4">
          <AlertsPanel refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="transfers" className="pt-4">
          <TransfersList />
        </TabsContent>

        <TabsContent value="assets" className="pt-4">
          <AssetsList />
        </TabsContent>
      </Tabs>

      <InventoryStatDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind={detailKind}
        products={products}
      />
    </div>
  );
}
