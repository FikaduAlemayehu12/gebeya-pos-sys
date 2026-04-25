import { useMemo, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, Package, Search } from 'lucide-react';

export type StatKind = 'all' | 'low' | 'expiring' | 'value';

interface ProductLite {
  id: string;
  name: string;
  name_am?: string | null;
  category: string;
  subcategory?: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  reorder_point?: number;
  unit: string;
  expiry_date: string | null;
  image_url?: string | null;
  sku?: string | null;
  barcode?: string | null;
}

const TITLES: Record<StatKind, { title: string; subtitle: string }> = {
  all: { title: 'All Products', subtitle: 'Complete catalog overview' },
  low: { title: 'Low Stock Items', subtitle: 'Below or at minimum stock — reorder soon' },
  expiring: { title: 'Expiring within 30 days', subtitle: 'Apply FEFO — sell or discount these first' },
  value: { title: 'Inventory Valuation', subtitle: 'Stock × selling price per item' },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: StatKind;
  products: ProductLite[];
}

export default function InventoryStatDetail({ open, onOpenChange, kind, products }: Props) {
  const { formatMoney } = useCurrency();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = products;
    if (kind === 'low') list = products.filter(p => p.stock <= p.min_stock);
    if (kind === 'expiring') list = products.filter(p => p.expiry_date && new Date(p.expiry_date).getTime() <= now + 30 * 86400000);
    if (kind === 'value') list = [...products].sort((a, b) => b.price * b.stock - a.price * a.stock);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s) ||
        (p.barcode || '').toLowerCase().includes(s),
      );
    }
    return list;
  }, [products, kind, search]);

  const meta = TITLES[kind];
  const totalValue = filtered.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> {meta.title}
            <Badge variant="outline" className="ml-2 text-[10px]">{filtered.length}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          {kind === 'value' && (
            <Card className="shrink-0">
              <CardContent className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">Subtotal</span>
                <span className="font-bold text-sm text-foreground">{formatMoney(totalValue)}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No items match.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const isLow = p.stock <= p.min_stock;
                const days = p.expiry_date
                  ? Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <Card key={p.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="p-3 flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                          {p.subcategory && <span>{p.subcategory}</span>}
                          {p.sku && <span>SKU: {p.sku}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {kind === 'expiring' && days !== null && (
                          <Badge className={`mb-1 text-[10px] ${days < 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : days <= 7 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                            {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                          </Badge>
                        )}
                        {kind === 'low' && (
                          <Badge className="mb-1 text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                            {p.stock}/{p.min_stock} {p.unit}
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Stock: <span className={`font-semibold ${isLow ? 'text-destructive' : 'text-foreground'}`}>{p.stock} {p.unit}</span>
                        </p>
                        <p className="text-xs font-semibold text-foreground">{formatMoney(p.price * p.stock)}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
