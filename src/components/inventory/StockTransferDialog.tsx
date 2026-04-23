import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Loader2, Plus, Trash2 } from 'lucide-react';

interface TransferItem {
  product_id: string;
  product_name: string;
  available: number;
  quantity: number;
  unit_cost: number;
}

export default function StockTransferDialog({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selectProduct, setSelectProduct] = useState('');
  const [selectQty, setSelectQty] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [b, p] = await Promise.all([
        supabase.from('branches').select('id, name, code').eq('is_active', true).order('name'),
        supabase.from('products').select('id, name, stock, cost, unit, branch_id').eq('is_active', true).order('name'),
      ]);
      setBranches(b.data || []);
      setProducts(p.data || []);
    })();
  }, [open]);

  const reset = () => {
    setSourceId(''); setDestId(''); setReason(''); setNotes(''); setItems([]);
    setSelectProduct(''); setSelectQty('');
  };

  const addItem = () => {
    const prod = products.find(p => p.id === selectProduct);
    if (!prod) return;
    if (items.find(i => i.product_id === prod.id)) {
      toast({ title: 'Already added', variant: 'destructive' });
      return;
    }
    const qty = Number(selectQty) || 0;
    if (qty <= 0) { toast({ title: 'Invalid quantity', variant: 'destructive' }); return; }
    if (qty > prod.stock) { toast({ title: 'Not enough stock', description: `Only ${prod.stock} available.`, variant: 'destructive' }); return; }
    setItems([...items, {
      product_id: prod.id,
      product_name: prod.name,
      available: prod.stock,
      quantity: qty,
      unit_cost: prod.cost,
    }]);
    setSelectProduct(''); setSelectQty('');
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.product_id !== id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !destId) { toast({ title: 'Source and destination required', variant: 'destructive' }); return; }
    if (sourceId === destId) { toast({ title: 'Source and destination must differ', variant: 'destructive' }); return; }
    if (items.length === 0) { toast({ title: 'Add at least one item', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const code = `TRF-${Date.now()}`;
      const { data: trf, error: trfErr } = await supabase.from('stock_transfers').insert({
        transfer_code: code,
        source_branch_id: sourceId,
        destination_branch_id: destId,
        reason,
        notes,
        status: 'pending',
        requested_by: user?.id,
        total_items: items.length,
        total_quantity: totalQty,
      }).select('id').single();
      if (trfErr) throw trfErr;
      const { error: itemsErr } = await supabase.from('stock_transfer_items').insert(
        items.map(i => ({
          transfer_id: trf!.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        }))
      );
      if (itemsErr) throw itemsErr;
      toast({ title: 'Transfer requested', description: `${code} created. Awaiting approval.` });
      reset();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs">
          <ArrowRightLeft className="w-3.5 h-3.5" /> New Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Branch Stock Transfer</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From Branch *</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Branch *</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Restock, redistribution, customer order..." />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Items</Label>
            <div className="flex gap-2">
              <Select value={selectProduct} onValueChange={setSelectProduct}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Pick product" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" min="1" value={selectQty} onChange={e => setSelectQty(e.target.value)} placeholder="Qty" className="w-24" />
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-muted-foreground">Product</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Qty</th>
                      <th className="text-right p-2 text-xs font-medium text-muted-foreground">Available</th>
                      <th className="w-8 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.product_id} className="border-t">
                        <td className="p-2">{i.product_name}</td>
                        <td className="p-2 text-right font-medium">{i.quantity}</td>
                        <td className="p-2 text-right text-muted-foreground">{i.available}</td>
                        <td className="p-2"><button type="button" onClick={() => removeItem(i.product_id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {items.length > 0 && (
              <div className="flex justify-end">
                <Badge variant="outline">{items.length} items • {items.reduce((s, i) => s + i.quantity, 0)} units</Badge>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional internal notes..." />
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Submit Transfer Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
