import { useState, useEffect, useCallback } from 'react';
import { formatETB, ETHIOPIAN_UNITS, PRODUCT_CATEGORIES } from '@/lib/ethiopian';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search, Package, AlertTriangle, Download, Upload, Loader2, ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductFormDialog from '@/components/ProductFormDialog';
import ProductQRCode from '@/components/ProductQRCode';

interface Product {
  id: string;
  name: string;
  name_am: string | null;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  barcode: string | null;
  expiry_date: string | null;
  variants: any;
  updated_at: string;
  description?: string | null;
  image_url?: string | null;
}

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatMoney, currency } = useCurrency();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || (item.name_am || '').includes(search);
    const matchesStock = !filterLowStock || item.stock <= item.min_stock;
    return matchesSearch && matchesStock;
  });

  const totalItems = products.length;
  const lowStockCount = products.filter(i => i.stock <= i.min_stock).length;
  const totalValue = products.reduce((s, i) => s + i.price * i.stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የእቃ ክምችት</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          <ProductFormDialog onSuccess={fetchProducts} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold text-foreground">{totalItems}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-bold text-destructive">{lowStockCount}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold text-foreground">{formatMoney(totalValue)}</p>
          {currency !== 'ETB' && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatETB(totalValue)}</p>
          )}
        </CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search inventory... / ፈልግ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button
          variant={filterLowStock ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={cn("gap-1.5", filterLowStock && "gradient-primary text-primary-foreground")}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock Only
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
              <p className="text-sm">No products found. Add your first product!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Unit</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Expiry</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
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
                            {item.barcode && <p className="text-[10px] text-muted-foreground">#{item.barcode}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      </td>
                      <td className="p-3 text-right font-medium text-foreground">{formatMoney(item.price)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatMoney(item.cost)}</td>
                      <td className={cn('p-3 text-right font-bold', isLow ? 'text-destructive' : 'text-foreground')}>
                        {item.stock}
                      </td>
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
    </div>
  );
}
