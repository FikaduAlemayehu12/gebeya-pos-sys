import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Loader2, Search } from 'lucide-react';
import AssetFormDialog from './AssetFormDialog';

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  subcategory: string;
  branch_id: string | null;
  assigned_to: string | null;
  purchase_cost: number;
  current_value: number;
  condition: string;
  status: string;
  next_maintenance_date: string | null;
  warranty_expiry: string | null;
  serial_number: string | null;
}

const CONDITION_STYLE: Record<string, string> = {
  excellent: 'bg-success/10 text-success border-success/20',
  good: 'bg-primary/10 text-primary border-primary/20',
  fair: 'bg-warning/10 text-warning border-warning/20',
  poor: 'bg-destructive/10 text-destructive border-destructive/20',
  needs_repair: 'bg-destructive/10 text-destructive border-destructive/20',
  retired: 'bg-muted text-muted-foreground border-border',
};

export default function AssetsList() {
  const { formatMoney } = useCurrency();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
    setAssets((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = assets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
    || a.asset_code.toLowerCase().includes(search.toLowerCase())
    || a.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const needsRepair = assets.filter(a => a.condition === 'needs_repair' || a.condition === 'poor').length;
  const today = new Date();
  const upcomingMaint = assets.filter(a => a.next_maintenance_date && new Date(a.next_maintenance_date) <= new Date(today.getTime() + 30 * 86400000)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Assets</h2>
          <p className="text-xs text-muted-foreground">Fixed assets, depreciation & maintenance</p>
        </div>
        <AssetFormDialog onSuccess={fetchData} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Assets</p>
          <p className="text-xl font-bold text-foreground mt-1">{assets.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Value</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatMoney(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Maintenance Due (30d)</p>
          <p className="text-xl font-bold text-warning mt-1">{upcomingMaint}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Needs Attention</p>
          <p className="text-xl font-bold text-destructive mt-1">{needsRepair}</p>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search assets by name, code, category..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No assets registered yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Asset</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Cost</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Current</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Condition</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Next Maint.</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.asset_code}{a.serial_number && ` · SN: ${a.serial_number}`}</p>
                    </td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{a.category}</Badge></td>
                    <td className="p-3 text-right text-muted-foreground">{formatMoney(a.purchase_cost)}</td>
                    <td className="p-3 text-right font-semibold text-foreground">{formatMoney(a.current_value)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[10px] ${CONDITION_STYLE[a.condition] || ''}`}>{a.condition.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {a.next_maintenance_date ? new Date(a.next_maintenance_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 text-center"><AssetFormDialog onSuccess={fetchData} editAsset={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
