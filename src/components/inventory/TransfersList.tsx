import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Check, Clock, X, Truck, Loader2 } from 'lucide-react';
import StockTransferDialog from './StockTransferDialog';

interface TransferRow {
  id: string;
  transfer_code: string;
  status: string;
  reason: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  source_branch_id: string;
  destination_branch_id: string;
  source?: { name: string };
  destination?: { name: string };
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-primary/10 text-primary border-primary/20',
  shipped: 'bg-secondary/10 text-secondary-foreground border-secondary/20',
  received: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export default function TransfersList() {
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const [items, setItems] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = roles.includes('admin') || roles.includes('inventory_manager') || roles.includes('branch_manager');

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, source:branches!stock_transfers_source_branch_id_fkey(name), destination:branches!stock_transfers_destination_branch_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'approved') { patch.approved_by = user?.id; patch.approved_at = new Date().toISOString(); }
    if (status === 'shipped') patch.shipped_at = new Date().toISOString();
    if (status === 'received') patch.received_at = new Date().toISOString();
    const { error } = await supabase.from('stock_transfers').update(patch).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Apply stock changes when received
    if (status === 'received') {
      const { data: tItems } = await supabase
        .from('stock_transfer_items')
        .select('product_id, quantity')
        .eq('transfer_id', id);
      const { data: trf } = await supabase
        .from('stock_transfers').select('source_branch_id, destination_branch_id').eq('id', id).single();
      if (tItems && trf) {
        for (const it of tItems) {
          const { data: prod } = await supabase.from('products').select('stock').eq('id', it.product_id).single();
          if (!prod) continue;
          await supabase.from('products').update({ stock: prod.stock }).eq('id', it.product_id);
          await supabase.from('stock_movements').insert([
            {
              product_id: it.product_id,
              movement_type: 'transfer_out',
              quantity_change: -it.quantity,
              quantity_before: prod.stock,
              quantity_after: prod.stock - it.quantity,
              branch_id: trf.source_branch_id,
              reference_type: 'transfer',
              reference_id: id,
              performed_by: user?.id,
            },
            {
              product_id: it.product_id,
              movement_type: 'transfer_in',
              quantity_change: it.quantity,
              quantity_before: 0,
              quantity_after: it.quantity,
              branch_id: trf.destination_branch_id,
              reference_type: 'transfer',
              reference_id: id,
              performed_by: user?.id,
            },
          ]);
        }
      }
    }

    toast({ title: `Transfer ${status}` });
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Truck className="w-4 h-4" /> Stock Transfers</h2>
          <p className="text-xs text-muted-foreground">Move inventory between branches with approval workflow</p>
        </div>
        <StockTransferDialog onSuccess={fetchData} />
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground text-sm">No transfers yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Truck className="w-4 h-4 text-primary" /></div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.transfer_code}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {t.source?.name || '—'} <ArrowRight className="w-3 h-3" /> {t.destination?.name || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.total_items} items</span>
                    <span>•</span>
                    <span>{t.total_quantity} units</span>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLE[t.status] || ''}>
                    {t.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {t.status === 'received' && <Check className="w-3 h-3 mr-1" />}
                    {t.status}
                  </Badge>
                  {isManager && (
                    <div className="flex gap-1.5">
                      {t.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateStatus(t.id, 'approved')}>
                            <Check className="w-3 h-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => updateStatus(t.id, 'rejected')}>
                            <X className="w-3 h-3" /> Reject
                          </Button>
                        </>
                      )}
                      {t.status === 'approved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(t.id, 'shipped')}>Mark Shipped</Button>
                      )}
                      {t.status === 'shipped' && (
                        <Button size="sm" className="h-7 text-xs gradient-primary text-primary-foreground" onClick={() => updateStatus(t.id, 'received')}>
                          Confirm Received
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {t.reason && <p className="text-xs text-muted-foreground mt-2 ml-12">Reason: {t.reason}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
